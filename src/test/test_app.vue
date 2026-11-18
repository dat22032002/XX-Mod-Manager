<template>
    <div class="main-container" ref="modCardState">
        <div class="head">
            <backbutton @click="handleBackButtomClick" />
            <div class="window-controls">
                <s-icon-button class="OO-icon-button window-control-btn" :title="$t('buttons.minimize')" @click="handleMinimizeClick">
                    <s-icon>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                            <path d="M240-440v-80h480v80H240Z" />
                        </svg>
                    </s-icon>
                </s-icon-button>
                <s-icon-button class="OO-icon-button window-control-btn" :title="$t('buttons.fullscreen')" @click="handleFullscreenClick">
                    <s-icon>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                            <path :d="isFullscreen ? fullscreenExitPath : fullscreenPath" />
                        </svg>
                    </s-icon>
                </s-icon-button>
            </div>
            <div id="drag-bar" style="flex: 1;height: 100%;app-region: drag;"></div>
            <sectionSelector :sections="sections" @update:currentSection="handleSectionChange"></sectionSelector>
        </div>

        <div class="section-container">
            <!-- <modCardSection v-if="currentSection === 'mod'" />
            <helpSection v-if="currentSection === 'help'" />
            <settingSection v-if="currentSection === 'settings'" /> -->
            <!-- -使用 v-if 会导致多次重载以及事件绑定 改为使用 左右滑动 -->
            <div class="section-slider" :style="{transform: `translateX(calc(${sections.indexOf(currentSection)} * (10px - 100vw) ))`}">
                <div style="width: calc(100vw - 10px);">
                    <modCardSection />
                </div>
                <div style="width: calc(100vw - 10px);">
                    <helpSection v-if="loaded" />
                </div>
                <div style="width: calc(100vw - 10px);">
                    <settingSection v-if="loaded" />
                </div>
            </div>
            
        </div>
    </div>
    
    <CssProxy />
    <dialogAddPreset></dialogAddPreset>
    <dialogModInfo2 :mod="currentMod"/>
    <dialogLoading />
    <DialogNeedRefresh />
    <dialogEnterPassword/>
    <dialogApplyResult />
    <dialogConfirmReset />
</template>

<script setup>
import { ref} from 'vue';

import modCardSection from '../section/modCardSection.vue';
import backbutton from '../components/backButton.vue';
import sectionSelector from '../components/sectionSelector.vue';
import dialogAddPreset from '../dialogs/dialogAddPreset.vue';
import settingSection from '../section/settingSection.vue'; 
import CssProxy from '../components/cssProxy.vue';
import dialogModInfo2 from '../dialogs/dialogModInfo2.vue';
import helpSection from '../section/helpSection.vue';
import dialogLoading from '../dialogs/dialogLoading.vue';
import dialogEnterPassword from '../dialogs/dialogEnterPassword.vue';
import dialogApplyResult from '../dialogs/dialogApplyResult.vue';
import dialogConfirmReset from '../dialogs/dialogConfirmReset.vue';

import DialogNeedRefresh from '../dialogs/dialogNeedRefresh.vue';
import { EventSystem } from '../../helper/EventSystem';

const loaded = ref(false);

// import IManager from '../../electron/IManager';
// const iManager = new IManager();
// 这里不需要 iManager 实例，直接通过waitInit 获取

import { waitInitIManager } from '../../electron/IManager';

import { g_temp_vue } from '../../electron/IManager';
const currentMod = g_temp_vue.currentMod;

const sections = ref(['mod', 'help', 'settings']);
const currentSection = ref('mod');

const handleSectionChange = (section) => {
    currentSection.value = section;
    //debug
    console.log('handleSectionChange', section);
};

const closeApp = () => {
    //关闭当前窗口
    window.close();
};

// 窗口控制按钮：最小化 / 全屏（主进程已有对应的 IPC 处理）
const isFullscreen = ref(false);
const fullscreenPath = 'M120-120v-200h80v120h120v80H120Zm520 0v-80h120V-320h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z';
const fullscreenExitPath = 'M240-120v-120H120v-80h200v200h-80Zm360 0v-200h200v80H680v120h-80ZM120-640v-80h120V-840h80v200H120Zm520 0v-200h80v120h120v80H640Z';

const handleMinimizeClick = () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('minimize-window');
};

const handleFullscreenClick = async () => {
    const { ipcRenderer } = require('electron');
    const result = await ipcRenderer.invoke('toggle-fullscreen');
    isFullscreen.value = result === true;
};

const handleBackButtomClick = () => {
    closeApp();
};

waitInitIManager().then((iManager) => {
    loaded.value = true;
});
</script>


<style scoped>
.main-container {
    display: flex;
    height: 100%;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
}

.main-container.hiding {
    opacity: 0;

    transition:opacity 0.5s ease-in-out;

    .section-container {
        transform: translateX(40%);
        transition: transform 0.5s ease-in-out;
    }
    .head {
        transform: translateY(-100%);
        transition: transform 0.3s ease-in-out;
    }
}

.main-container.hide {
    display: none;
}

.head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 20px;
    height: 50px;
}

.window-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
    flex-shrink: 0;
}

/* OO-icon-button mặc định có margin dọc 10px, sẽ tràn khỏi header 50px */
.window-control-btn {
    margin: 0;
}

.section-container {
    position: absolute;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    width: calc(100% - 20px);
    height: calc(100% - 70px);
    padding: 10px;
    bottom: 50px;
    top: 50px;
    overflow:visible;
}

.section-slider {
    display: flex;
    flex-direction: row;
    flex: 1;
    transition: transform 0.3s;
    overflow: visible;
    position: relative;
    height: calc(100%);
    width: 1300%;
}

</style>