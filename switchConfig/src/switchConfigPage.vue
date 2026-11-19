<template>
    <div class="head">
        <backButton @click="handleBackButtomClick" />
        <div id="drag-bar" style="flex: 1;height: 100%;app-region: drag;"></div>
    </div>

    <div class="main-container">

        <div id="plain-container" class="OO-box" style="width: calc(100% - 60px); margin-left: 7px;">
            <s-scroll-view
                style="height:100%;width: 100%;display: flex;flex-wrap: wrap;flex-direction: row;align-content: flex-start;">

                <plainConfig2 v-for="(config, index) in allConfig" :key="index" :configRef="config"
                    @click="(e) => selectTape(e,config)" class="config-card"
                    ref="plainConfigRefs" />
                <div class="placeholder"></div>
            </s-scroll-view>
        </div>
        

        
    </div>
    <div class="bottom">
            <div class="bottom-left">
                <s-tooltip>
                    <!-- -刷新按钮 -->
                    <s-icon-button @click="handleRefreshButtonClicked" slot="trigger" class="OO-button"
                        style="color: var(--s-color-on-surface);margin: 0 10px 0 0;transform: scale(0.95);">
                        <s-icon>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                                <path
                                    d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z">
                                </path>
                            </svg></s-icon>
                    </s-icon-button>
                    <p> {{ $t('buttons.refresh') }} </p>
                </s-tooltip>
            </div>
            <div class="bottom-right">
                <s-button @click="handleApplyButtonClicked" id="apply-button" :disabled="!currentTape"
                    class="OO-color-gradient font-hongmeng OO-button" style="color: var(--s-color-surface);">
                    {{ $t('buttons.apply') }}
                </s-button>
            </div>
        </div>

    <CssProxy />
</template>


<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import backButton from '../../src/components/backButton.vue';
import plainConfig2 from './components/plainConfig2.vue';

import CssProxy from '../../src/components/cssProxy.vue';


function handleBackButtomClick() {
    console.log('back button clicked');
}

import TapeConfig from './js/configManager';
import { g_allConfig_vue } from './js/configManager';
import IManager from '../../electron/IManager';
const iManager = new IManager({ light: true });
const { t } = useI18n();
const allConfig = g_allConfig_vue;
// TC30: allConfig là ref nên allConfig[0] là undefined — khởi tạo null,
// nút Apply khóa khi chưa chọn (xem :disabled ở template).
const currentTape = ref<any>(null);

const plainConfigRefs = useTemplateRef("plainConfigRefs");

import XXMMCore from '../../core/XXMMCore';

function selectTape(e, tape) {
    console.log('selectTape', tape)
    currentTape.value = tape;

    // 取消其他卡片的选中状态
    plainConfigRefs.value?.forEach((config) => {
        // debug
        console.log('config:', config, config?.$props.configRef, tape, config?.$props.configRef === tape , config?.clicked);
        if (config && config.$props.configRef !== tape && config.clicked) {
            //debug
            console.log('cancle click:', config);
            config?.click(null as any);
        } 
        if (config && config.$props.configRef === tape && !config.clicked) {
            config?.click(e);
        }
        if (config && config.$props.configRef === tape && config.clicked) {
            config?.click(e, false);
        }
    });
}

function handleRefreshButtonClicked() {
    console.log('handleRefreshButtonClicked');
    TapeConfig.loadAllConfig();
}

function handleApplyButtonClicked() {
    console.log('handleApplyButtonClicked');
    // TC30: chưa chọn cấu hình thì báo + không làm gì (trước đây đọc
    // currentTape.value._dir trên undefined nên app văng TypeError).
    if (!currentTape.value) {
        iManager.snack(t('switchConfig.noSelection'), 'error');
        return;
    }
    iManager.temp.ifDontSaveOnClose = true;
    XXMMCore.setCustomConfigFolder(currentTape.value._dir);
    iManager.changeUrl('');
}


onMounted(() => {
    TapeConfig.loadAllConfig();
    console.log('currentTape:', currentTape.value);
})
</script>



<style>
.control-bar {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 30px;
    background-color: var(--s-color-background);
    -webkit-app-region: drag;
}

.head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 20px;
    height: 50px;
    width: 100%;
}

#plain-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 20px;
    padding: 20px;
    height: 100%;
    width: 100%;
    overflow-y: auto;
}

.config-card {
    margin-right: 10px;
    margin-bottom: 10px;
}

.main-container {
    position: relative;
    display: flex;
    height: calc(100% - 160px);
    width: 100%;
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
}

.bottom {
    position: absolute;
    height: 60px;
    width: 100vw;
    bottom: 0px;
    left: 10px;
    right: 0px;
    /* background-color: var(--s-color-primary); */
    display: flex;
    justify-content: space-between;
    align-items: center;
}

#apply-button {
    padding: 0 60px;
    margin: 0 40px;
    font-size: 20px;

    color: var(--s-color-dark-surface);
}
</style>