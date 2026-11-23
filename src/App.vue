<template>
    <div class="main-container" ref="modCardState">
        <div class="head">
            <div class="window-controls">
                <s-icon-button class="OO-icon-button window-control-btn" :title="$t('buttons.close')" @click="handleCloseClick">
                    <s-icon>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                            <path d="M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z" />
                        </svg>
                    </s-icon>
                </s-icon-button>
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
            <!-- Dòng thống kê kho mod (1.5.26): dời lên hàng trên cùng,
                 ngang hàng thanh Mod/Banana/Help, phía bên phải. -->
            <span class="mod-stats head-stats">{{ $t('stats.line', { total: statsTotal, enabled: statsEnabled, characters: statsCharacters }) }}</span>
            <sectionSelector :sections="sections" :hover-switch="true" @update:currentSection="handleSectionChange"></sectionSelector>
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
                    <bananaSection :active="currentSection === 'banana'" />
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
    <dialogConfirmClose />
    <dialogConfirmDeleteMod />
    <dialogConfirmDeletePreset />
    <dialogConfirmConflict />
    <dialogUpdateAvailable />
    <dialogUpdateDownloaded />
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

import modCardSection from './section/modCardSection.vue';
import bananaSection from './section/bananaSection.vue';
import sectionSelector from './components/sectionSelector.vue';
import dialogAddPreset from './dialogs/dialogAddPreset.vue';
import settingSection from './section/settingSection.vue'; 
import CssProxy from './components/cssProxy.vue';
import dialogModInfo2 from './dialogs/dialogModInfo2.vue';
import helpSection from './section/helpSection.vue';
import dialogLoading from './dialogs/dialogLoading.vue';
import dialogEnterPassword from './dialogs/dialogEnterPassword.vue';
import dialogApplyResult from './dialogs/dialogApplyResult.vue';
import dialogConfirmReset from './dialogs/dialogConfirmReset.vue';
import dialogConfirmClose from './dialogs/dialogConfirmClose.vue';
import dialogConfirmDeleteMod from './dialogs/dialogConfirmDeleteMod.vue';
import dialogConfirmDeletePreset from './dialogs/dialogConfirmDeletePreset.vue';
import dialogConfirmConflict from './dialogs/dialogConfirmConflict.vue';
import dialogUpdateAvailable from './dialogs/dialogUpdateAvailable.vue';
import dialogUpdateDownloaded from './dialogs/dialogUpdateDownloaded.vue';

import DialogNeedRefresh from './dialogs/dialogNeedRefresh.vue';
import { EventSystem, EventType } from '../helper/EventSystem';
import { selectedModIdSet } from '../helper/SelectedMods';

// Nghe sự kiện cập nhật từ tiến trình chính (có bản mới -> mở hộp hỏi).
import { initUpdateListener } from '../helper/UpdateHelper';
initUpdateListener();

const loaded = ref(false);

// import IManager from '../electron/IManager';
// const iManager = new IManager();
// 这里不需要 iManager 实例，直接通过waitInit 获取

import { waitInitIManager } from '../electron/IManager';
import IManager from '../electron/IManager';

import { g_temp_vue, g_config_vue } from '../electron/IManager';
const currentMod = g_temp_vue.currentMod;

const sections = ref(['mod', 'banana', 'help', 'settings']);
const currentSection = ref('mod');

const handleSectionChange = (section) => {
    currentSection.value = section;
    //debug
    console.log('handleSectionChange', section);
};

const iManager = new IManager();

//-============================= thống kê kho mod ==============================
// Dòng thống kê ở hàng trên cùng, ngang hàng thanh Mod/Banana/Help, phía
// bên phải (1.5.26 — dời lên từ giữa thanh dưới): tổng số mod, số mod
// đang bật, số nhân vật. modList không phải reactive (chỉ bắn sự kiện
// modListChanged khi gán lại) nên đọc lại mỗi khi có sự kiện
// modListChanged / modInfoChanged (đổi nhân vật của mod cũng đổi số nhân
// vật); số mod đang bật đọc thẳng từ selectedModIdSet (reactive) nên tự
// cập nhật khi bấm chọn/bỏ chọn. "Unknown" không phải nhân vật nên không
// tính. Lọc "chỉ mod nghi hỏng" đang bật thì cả 3 số đều theo mod nghi
// hỏng (Đạt dặn 23/11).
const statsTotal = ref(0);
const statsCharacters = ref(0);
const refreshStats = () => {
    let list = iManager.data.modList || [];
    if (g_config_vue.showOnlySuspected.value) {
        const ids = g_config_vue.fixerSuspectIds.value;
        if (Array.isArray(ids)) {
            const suspectSet = new Set(ids);
            list = list.filter(mod => suspectSet.has(mod.id));
        }
    }
    statsTotal.value = list.length;
    const characters = new Set(list.map(mod => (mod.character || '').trim()).filter(c => c && c !== 'Unknown'));
    statsCharacters.value = characters.size;
};
// Số mod đang bật trong dòng thống kê: lọc nghi hỏng bật thì chỉ đếm
// mod đang bật nằm trong danh sách nghi hỏng.
const statsEnabled = computed(() => {
    if (!g_config_vue.showOnlySuspected.value) return selectedModIdSet.size;
    const ids = g_config_vue.fixerSuspectIds.value;
    if (!Array.isArray(ids)) return selectedModIdSet.size;
    const suspectSet = new Set(ids);
    let n = 0;
    for (const id of selectedModIdSet) if (suspectSet.has(id)) n++;
    return n;
});

onMounted(() => {
    refreshStats();
    EventSystem.on(EventType.modListChanged, refreshStats);
    EventSystem.on(EventType.modInfoChanged, refreshStats);
    // Lọc nghi hỏng đổi (bật/tắt, quét lại) thì tính lại thống kê.
    watch(() => [g_config_vue.showOnlySuspected.value, g_config_vue.fixerSuspectIds.value], refreshStats);
});

// Nút X chỉ mở hộp hỏi xác nhận; chỉ khi bấm Xác nhận mới tắt app.
const handleCloseClick = () => {
    iManager.showDialog('dialog-confirm-close');
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

/* Dòng thống kê kho mod ở hàng trên (1.5.26, dời lên từ thanh dưới):
   cỡ + màu như cũ, chừa khe với thanh chọn mục bên phải. */
.mod-stats {
    font-size: 14px;
    color: var(--s-color-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
}

.head-stats {
    margin-right: 12px;
}

/* 3 nút cửa sổ nối thành 1 viên nhộng (Đạt dặn 20/11): khung cao
   40px như nút chọn mục MOD/HELP/Setting bên phải, 3 nút con vuông
   khít nhau bên trong, ngăn cách bằng vạch mờ. */
.window-controls {
    display: flex;
    align-items: stretch;
    gap: 0;
    margin-left: 8px;
    flex-shrink: 0;
    height: 40px;
    box-sizing: border-box;
    background-color: var(--s-color-surface-container-low);
    border: 1px solid var(--s-color-outline-variant);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: inset 1px 1px 1px rgba(255, 255, 255, 0.2);
}

/* OO-icon-button mặc định tròn + thu nhỏ 0.83 + margin dọc 10px (tràn
   khỏi header 50px) — gỡ hết để nút vuông khít viên nhộng, cao bằng
   khung. */
.window-controls .window-control-btn {
    margin: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    transform: scale(1);
    width: 46px;
    height: 100%;
}

.window-controls .window-control-btn + .window-control-btn {
    border-left: 1px solid var(--s-color-outline-variant);
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
    /* Giữ visible: thử overflow:hidden ở test9 thì khung web Banana
       KHÔNG bị cắt (khung web vẽ ở lớp riêng, không nghe overflow của
       tổ tiên) nên dải tràn vẫn còn. Dải tràn được xử lý bằng cách ẩn
       toàn bộ trang Banana khi rời trang (bananaSection.vue). */
    overflow: visible;
    position: relative;
    height: calc(100%);
    width: 1300%;
}

</style>