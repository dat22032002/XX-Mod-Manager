<template>
    <div class="setting-container">
        <leftMenu :tabs="tabs" :translatedTabs="translatedTabs" @tabChange="handleTabChange">
        </leftMenu>

        <div class="setting-content OO-box OO-scorll-box">
            <!-- -=========== 常规设置 =========== -->
            <div v-if="currentTab === 'normal'">
                <settingBar :data="languageData"></settingBar>
                <s-divider></s-divider>
                <settingBar :data="themeData"></settingBar>
                <s-divider></s-divider>
                <settingBar :data="ifStartWithLastPresetData"></settingBar>
                <s-divider></s-divider>
                <settingBar :data="openFirstLoadButton"></settingBar>
                <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
            </div>
            <!-- -高级设置 -->
            <!-- -在这里可以设定 modRootDir，modSourceDir，modLoaderDir，gameDir -->
            <div v-if="currentTab === 'advanced'">

                <settingBar :data="modTargetPathData"></settingBar>

                <s-divider></s-divider>
                <settingBar :data="modSourcePathData"></settingBar>

                <s-divider></s-divider>
                <settingBar :data="presetPathData"></settingBar>
                <settingBar :data="ifUseTraditionalApply"></settingBar>
                <settingBar :data="showConflictWarning"></settingBar>

                <s-divider></s-divider>
                <s-button class="OO-color-gradient" @click="console.log(iManager.config)">
                    {{ $t('setting.showDetail') }} </s-button>
                <s-divider></s-divider>
                <settingBar :data="initAllDataButton"></settingBar>
                <settingBar :data="rescanAllModsButton"></settingBar>
                <div class="OO-setting-bar update-check-row">
                    <h3>{{ $t('update.checkTitle') }}</h3>
                    <p>{{ $t('update.currentVersion', { version: currentVersion }) }}</p>
                    <s-button class="OO-button" :disabled="isCheckingUpdate" @click="handleCheckForUpdates">
                        {{ isCheckingUpdate ? $t('update.checking') : $t('update.checkButton') }}
                    </s-button>
                </div>

                <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
            </div>
            <!-- -Mod Fixer: sửa mod skin hỏng sau khi game cập nhật -->
            <div v-if="currentTab === 'fixer'">
                <div class="OO-setting-bar fixer-block">
                    <h3>{{ $t('fixer.title') }}</h3>
                    <p>{{ $t('fixer.description') }}</p>
                    <p>{{ $t('fixer.currentVersion', { version: fixerVersionText }) }}</p>
                </div>
                <s-divider></s-divider>
                <div class="OO-setting-bar fixer-block fixer-actions">
                    <s-button class="OO-button" :disabled="fixerState.checking || fixerState.downloading" @click="handleFixerCheck">
                        {{ fixerState.checking ? $t('fixer.checking') : $t('fixer.checkButton') }}
                    </s-button>
                    <s-button class="OO-button" :disabled="fixerState.downloading || (fixerInstalled && !fixerState.latestVersion)" @click="handleFixerDownload">
                        {{ fixerState.downloading ? $t('fixer.downloading', { percent: fixerState.downloadPercent }) : $t('fixer.downloadButton') }}
                    </s-button>
                    <s-button class="OO-button" :disabled="!fixerInstalled" @click="handleFixerOpen">
                        {{ $t('fixer.openButton') }}
                    </s-button>
                </div>
                <div class="OO-setting-bar fixer-block">
                    <p>{{ $t('fixer.modsPathLabel') }}</p>
                    <p class="fixer-path">{{ fixerStatus.modsPath }}</p>
                </div>
                <s-divider></s-divider>
                <div class="OO-setting-bar fixer-block">
                    <h3>{{ $t('fixer.scanTitle') }}</h3>
                    <p>{{ $t('fixer.scanHint') }}</p>
                    <div class="fixer-scan-actions">
                        <s-button class="OO-button" :disabled="fixerState.scanning || fixerState.flowStep !== 'idle'" @click="handleFixerScan">
                            {{ fixerState.scanning ? $t('fixer.scanning') : $t('fixer.scanButton') }}
                        </s-button>
                        <s-button class="OO-button" :disabled="fixerState.scanning || fixerState.flowStep !== 'idle'" @click="handleFixerAutoFix">
                            {{ $t('fixer.autoFixButton') }}
                        </s-button>
                    </div>
                </div>
                <div class="OO-setting-bar fixer-block">
                    <h3>{{ $t('fixer.backupTitle') }}</h3>
                    <p>{{ $t('fixer.backupNote') }}</p>
                    <p>{{ fixerBackupText }}</p>
                    <s-button class="OO-button" :disabled="fixerState.backupCount === 0 || fixerState.flowStep !== 'idle'" @click="handleFixerCleanupBackups">
                        {{ $t('fixer.cleanupButton') }}
                    </s-button>
                </div>
                <div v-if="fixerState.scannedOnce" class="OO-setting-bar fixer-block fixer-scan-list">
                    <p v-if="fixerState.suspects.length === 0">{{ $t('fixer.noBrokenMods') }}</p>
                    <template v-else>
                        <p>{{ $t('fixer.scanDone', { count: fixerState.suspects.length }) }}</p>
                        <div class="fixer-select-all">
                            <s-button class="OO-button" @click="handleFixerSelectAll">{{ $t('fixer.selectAll') }}</s-button>
                            <s-button class="OO-button" @click="handleFixerDeselectAll">{{ $t('fixer.deselectAll') }}</s-button>
                        </div>
                        <div v-for="mod in fixerState.suspects" :key="mod.modId" class="fixer-suspect-row">
                            <s-checkbox :checked="fixerState.selectedIds.includes(mod.modId)" @change="handleFixerToggle(mod.modId, $event)"></s-checkbox>
                            <span class="fixer-suspect-name">{{ mod.modName }}</span>
                            <span class="fixer-suspect-count">{{ $t('fixer.oldHashes', { count: mod.matchedHashes.length }) }}</span>
                        </div>
                        <s-button class="OO-button" :disabled="fixerState.selectedIds.length === 0 || fixerState.flowStep !== 'idle'" @click="handleFixerStart">
                            {{ $t('fixer.fixButton') }}
                        </s-button>
                    </template>
                </div>
                <div v-if="fixerState.flowStep !== 'idle'" class="OO-setting-bar fixer-block fixer-flow">
                    <p v-if="fixerState.flowStep === 'preparing'">{{ fixerState.progressTotal > 0 ? $t('fixer.copyingOut', { done: fixerState.progressDone, total: fixerState.progressTotal }) : $t('fixer.fixPreparing') }}</p>
                    <template v-if="fixerState.flowStep === 'waiting' && fixerState.prepared">
                        <p>{{ fixerState.prepared.mods.map((m) => m.modName).join(', ') }}</p>
                        <p>{{ $t('fixer.tempFolderLabel') }}</p>
                        <p class="fixer-path">{{ fixerState.prepared.tempDir }}</p>
                        <s-button class="OO-button" @click="handleFixerCopyTempPath">{{ $t('fixer.copyPath') }}</s-button>
                        <p>{{ $t('fixer.fixWaiting') }}</p>
                    </template>
                    <p v-if="fixerState.flowStep === 'applying'">{{ fixerState.progressTotal > 0 ? $t('fixer.copyingBack', { done: fixerState.progressDone, total: fixerState.progressTotal }) : $t('fixer.fixApplying') }}</p>
                    <div v-if="fixerState.flowStep === 'done'">
                        <p v-if="fixerDoneCount > 0">{{ $t('fixer.fixDone', { count: fixerDoneCount }) }}</p>
                        <p v-if="fixerUnchangedCount > 0">{{ $t('fixer.fixUnchanged', { count: fixerUnchangedCount }) }}</p>
                        <p v-if="fixerFailedCount > 0">{{ $t('fixer.fixFailed', { count: fixerFailedCount }) }}</p>
                        <p v-for="r in fixerState.results" :key="r.modId" class="fixer-result" :class="'fixer-result-' + r.status">{{ r.modName }}</p>
                        <p>{{ $t('fixer.backupNote') }}</p>
                        <s-button class="OO-button" @click="handleFixerDismissResults">{{ $t('buttons.close') }}</s-button>
                    </div>
                </div>
                <div class="placeholder" style="flex: 1;min-height: 150px;"></div>
            </div>
            <!-- Tab Chuyển đổi cấu hình + Giới thiệu đã bỏ theo lệnh Đạt
                 23/11 (test10): đổi cấu hình vẫn làm được bằng tham số
                 dòng lệnh --customConfig / --switchConfig, xem Help. -->

            <!-- -插件管理面板，控制插件的开关 -->
            <div v-if="currentTab === 'plugin'">
                <div class="OO-setting-bar">
                    <h3> {{ $t('setting.managePlugin') }} </h3>
                </div>
                <settingBar :data="refreshDuleToPlugin" v-if="toggledPlugin"></settingBar>
                <div class="OO-box OO-shade-box" style="margin: 10px 0;">
                    <h3> {{ $t('setting.pluginList') }} </h3>
                    <p> {{ $t('setting.pluginListInfo') }} </p>
                </div>
                <div class="OO-setting-bar" v-for="(pluginData, pluginName) in plugins" :key="pluginName">
                    <h3 v-if="pluginData.t_displayName">{{ pluginData.t_displayName[locale] }}</h3>
                    <h3 v-else>{{ pluginName }}</h3>
                    <!-- -如果iManager.disabledPluginNames 中包含 pluginName，则显示为 false，否则显示为 true -->
                    <s-switch class="OO-color-gradient-word"
                        :checked="!IPluginLoader.disabledPluginNames.includes(pluginName)"
                        @change="handePluginToggle(pluginName)">
                    </s-switch>
                </div>


            </div>
            <!-- -这里后面提供 各个插件的设置 -->
            <div v-for="(pluginData, pluginName) in pluginConfig" :key="pluginName">
                <div v-if="currentTab === pluginName">

                    <s-fold folded="true">
                        <s-button class="OO-color-gradient" slot="trigger">{{ $t('setting.showDetail') }}</s-button>
                        <div>
                            {{ pluginName }}
                        </div>
                        <s-divider></s-divider>
                        <div class="OO-box OO-shade-box">
                            <div v-for="data in pluginData" :key="data.name">
                                <div class="OO-setting-bar">
                                    <h3 v-if="data.t_displayName">{{ data.t_displayName[locale] }}</h3>
                                    <h3 v-else>{{ data.displayName }}</h3>
                                    <div>
                                        {{ data.data }}
                                    </div>
                                </div>
                                {{ data }}
                            </div>
                        </div>
                    </s-fold>

                    <s-divider></s-divider>
                    <div v-for="data in pluginData" :key="data.name">
                        <settingBar :data="data"></settingBar>
                    </div>
                </div>


            </div>
        </div>
    </div>
</template>

<script setup>
import leftMenu from '../components/leftMenu.vue';
import settingBar from '../components/settingBar.vue';
import { computed, onMounted, ref, watch } from 'vue';
import IManager from '../../electron/IManager';
const iManager = new IManager();
import fsProxy from '../../electron/fsProxy';
import getData from './settingSectionData.js';
const {
    languageData,
    themeData,
    ifStartWithLastPresetData,
    modTargetPathData,
    modSourcePathData,
    presetPathData,
    initAllDataButton,
    rescanAllModsButton,
    openFirstLoadButton
} = getData();

import { useI18n } from 'vue-i18n'
const { t, locale } = useI18n()

import { IPluginLoader } from '../../helper/PluginLoader.ts';
import { EventSystem, EventType } from '../../helper/EventSystem.ts';
import { SnackType, t_snack, snack } from '../../helper/SnackHelper.ts';
import { updateState, fetchAppVersion, checkForUpdates } from '../../helper/UpdateHelper';
import { fixerState } from '../../helper/FixerHelper';
import { formatModSize } from '../../helper/ModSizeScanner';

const tabs = ref(['normal', 'advanced', 'fixer', 'plugin']);
const translatedTabs = computed(() => {
    const tTab = tabs.value.map((tab) => {
        // 如果 是 插件的 tab ，则尝试获取 plugin.t_displayName
        if (IPluginLoader.plugins[tab]) {
            return IPluginLoader.plugins[tab].t_displayName[locale.value] || tab;
        }
        return t(`setting-tab.${tab}`)
    });
    //debug
    // console.log('translatedTabs', tTab);
    return tTab;
});

const currentTab = ref('normal');

const handleTabChange = (tab) => {
    currentTab.value = tab;
    //debug
    console.log('handleTabChange', tab);
};

//-==================== Kiểm tra cập nhật ====================-
// Version đang chạy (lấy qua IPC get-app-version khi trang mở).
const currentVersion = ref('');
// Đang kiểm tra hoặc đang tải thì khóa nút lại.
const isCheckingUpdate = computed(() => updateState.status === 'checking' || updateState.status === 'downloading');

const handleCheckForUpdates = () => {
    if (isCheckingUpdate.value) {
        return;
    }
    checkForUpdates(true);
};

// Chỉ lần bấm tay mới hiện thông báo kết quả (tự kiểm tra lúc mở app
// thì im lặng: đã là bản mới nhất hoặc lỗi mạng đều không báo).
watch(() => updateState.status, (newStatus) => {
    if (!updateState.manualCheck) {
        return;
    }
    if (newStatus === 'uptodate') {
        snack(t('update.upToDate'));
        updateState.manualCheck = false;
    } else if (newStatus === 'error') {
        snack(
            updateState.checkError === 'unsupported' ? t('update.notSupported')
            : updateState.checkError === 'no-release' ? t('update.noRelease')
            : t('update.checkFailed'),
            SnackType.error,
        );
        updateState.manualCheck = false;
    } else if (newStatus === 'available') {
        // Hộp có-bản-mới đã mở, không cần hiện thêm thông báo.
        updateState.manualCheck = false;
    }
});

//-==================== Mod Fixer ====================-
// Trạng thái Fixer (đọc trực tiếp từ config + đĩa; đọc lại sau mỗi
// thao tác vì computed không tự cập nhật khi config đổi).
const fixerStatus = ref(iManager.fixerStatus());
const fixerInstalled = computed(() => fixerStatus.value.installed);
const fixerVersionText = computed(() => fixerStatus.value.version || t('fixer.notDownloaded'));
const fixerDoneCount = computed(() => fixerState.results.filter((r) => r.status === 'fixed').length);
const fixerUnchangedCount = computed(() => fixerState.results.filter((r) => r.status === 'unchanged').length);
const fixerFailedCount = computed(() => fixerState.results.filter((r) => r.status === 'failed').length);

const refreshFixerStatus = () => { fixerStatus.value = iManager.fixerStatus(); };

// Số đếm bản sao lưu (đọc từ đĩa; fixerState giữ để chuyển section
// đi về không mất). Đếm lại khi mở trang Cài đặt, khi vào tab Fixer
// và khi 1 đợt sửa xong (lúc đó có thể có thêm bản sao lưu mới).
const fixerBackupText = computed(() => fixerState.backupCount === 0
    ? t('fixer.noBackups')
    : t('fixer.backupInfo', { count: fixerState.backupCount, size: formatModSize(fixerState.backupBytes) }));
const refreshFixerBackupInfo = () => {
    const info = iManager.fixerBackupInfo();
    fixerState.backupCount = info.count;
    fixerState.backupBytes = info.bytes;
};
const handleFixerCleanupBackups = () => {
    if (fixerState.backupCount === 0 || fixerState.flowStep !== 'idle') return;
    iManager.showDialog('dialog-confirm-cleanup-fixer-backups');
};
watch(currentTab, (tab) => { if (tab === 'fixer') refreshFixerBackupInfo(); });
watch(() => fixerState.flowStep, (step) => { if (step === 'done') refreshFixerBackupInfo(); });

const handleFixerCheck = async () => {
    if (fixerState.checking || fixerState.downloading) return;
    fixerState.checking = true;
    fixerState.latestVersion = '';
    try {
        const result = await iManager.checkFixerUpdate();
        if (!result) return;
        if (result.updateAvailable) {
            fixerState.latestVersion = result.latest;
            snack(t('fixer.updateAvailable', { version: result.latest }));
        } else {
            snack(t('fixer.upToDate'));
        }
    } catch (e) {
        console.error('checkFixerUpdate failed', e);
        snack(t('fixer.checkFailed'), SnackType.error);
    } finally {
        fixerState.checking = false;
    }
};

const handleFixerDownload = async () => {
    if (fixerState.downloading || (fixerInstalled.value && !fixerState.latestVersion)) return;
    fixerState.downloading = true;
    fixerState.downloadPercent = 0;
    try {
        const exePath = await iManager.downloadFixer((received, total) => {
            fixerState.downloadPercent = total > 0 ? Math.round((received / total) * 100) : 0;
        });
        if (exePath) {
            snack(t('fixer.downloadDone'));
            fixerState.latestVersion = '';
            refreshFixerStatus();
        }
    } catch (e) {
        console.error('downloadFixer failed', e);
        snack(t('fixer.downloadFailed'), SnackType.error);
    } finally {
        fixerState.downloading = false;
        fixerState.downloadPercent = 0;
    }
};

const handleFixerOpen = () => {
    if (!iManager.openFixer()) snack(t('fixer.openFailed'), SnackType.error);
};

const handleFixerScan = async () => {
    if (fixerState.scanning || fixerState.flowStep !== 'idle') return null;
    fixerState.scanning = true;
    try {
        const suspects = await iManager.fixerScanBrokenMods();
        if (suspects) {
            fixerState.suspects = suspects;
            fixerState.selectedIds = [];
            fixerState.scannedOnce = true;
            // Lưu id mod nghi hỏng vào config để công tắc lọc ở trang Mod
            // vẫn dùng được sau khi đóng app mở lại (Đạt dặn 23/11).
            iManager.config.fixerSuspectIds = suspects.map((m) => m.modId);
            iManager.saveConfig();
            return suspects;
        }
        return null;
    } catch (e) {
        console.error('fixerScanBrokenMods failed', e);
        snack(t('fixer.scanFailed'), SnackType.error);
        return null;
    } finally {
        fixerState.scanning = false;
    }
};

// Tự sửa hết (Đạt chốt 23/11: bỏ bước kiểm mod trong game): quét rồi
// sửa hết mod nghi hỏng luôn, dùng lại đúng luồng sửa của nút Sửa
// (chép tạm -> mở Fixer -> đợi đóng -> chép về), chỉ bỏ bước tick
// chọn tay. Quét ra 0 mod thì báo, không mở Fixer.
const handleFixerAutoFix = async () => {
    if (fixerState.scanning || fixerState.flowStep !== 'idle') return;
    if (!fixerInstalled.value) {
        snack(t('fixer.needFixerFirst'), SnackType.error);
        return;
    }
    const suspects = await handleFixerScan();
    if (!suspects) return; // Quét lỗi: handleFixerScan đã báo lỗi rồi.
    if (suspects.length === 0) {
        snack(t('fixer.noBrokenMods'));
        return;
    }
    fixerState.selectedIds = suspects.map((m) => m.modId);
    await handleFixerStart();
};

const handleFixerToggle = (modId, event) => {
    const checked = event && event.target ? event.target.checked : !fixerState.selectedIds.includes(modId);
    if (checked && !fixerState.selectedIds.includes(modId)) fixerState.selectedIds.push(modId);
    else if (!checked) fixerState.selectedIds = fixerState.selectedIds.filter((id) => id !== modId);
};
const handleFixerSelectAll = () => { fixerState.selectedIds = fixerState.suspects.map((m) => m.modId); };
const handleFixerDeselectAll = () => { fixerState.selectedIds = []; };

const handleFixerStart = async () => {
    if (fixerState.flowStep !== 'idle') return;
    if (fixerState.selectedIds.length === 0) {
        snack(t('fixer.fixNoSelection'), SnackType.error);
        return;
    }
    if (!fixerInstalled.value) {
        snack(t('fixer.needFixerFirst'), SnackType.error);
        return;
    }
    fixerState.results = [];
    fixerState.flowStep = 'preparing';
    fixerState.progressDone = 0;
    fixerState.progressTotal = 0;
    let prepared = null;
    try {
        prepared = await iManager.fixerPrepareFix([...fixerState.selectedIds], (done, total) => {
            fixerState.progressDone = done;
            fixerState.progressTotal = total;
        });
    } catch (e) {
        console.error('fixerPrepareFix failed', e);
        snack(t('fixer.fixError'), SnackType.error);
        fixerState.flowStep = 'idle';
        return;
    }
    fixerState.prepared = prepared;
    fixerState.flowStep = 'waiting';
    fixerState.progressDone = 0;
    fixerState.progressTotal = 0;
    const launched = await iManager.fixerLaunchAndWait();
    if (!launched) {
        iManager.fixerAbortFix(prepared);
        fixerState.prepared = null;
        fixerState.flowStep = 'idle';
        snack(t('fixer.openFailed'), SnackType.error);
        return;
    }
    fixerState.flowStep = 'applying';
    fixerState.progressDone = 0;
    fixerState.progressTotal = 0;
    try {
        fixerState.results = await iManager.fixerApplyFixed(prepared, (done, total) => {
            fixerState.progressDone = done;
            fixerState.progressTotal = total;
        });
    } catch (e) {
        console.error('fixerApplyFixed failed', e);
        snack(t('fixer.fixError'), SnackType.error);
        fixerState.results = [];
    }
    fixerState.prepared = null;
    fixerState.flowStep = 'done';
    // Xóa mod đã sửa khỏi danh sách nghi hỏng để không sửa trùng.
    const fixedIds = new Set(fixerState.results.filter((r) => r.status === 'fixed').map((r) => r.modId));
    fixerState.suspects = fixerState.suspects.filter((m) => !fixedIds.has(m.modId));
    fixerState.selectedIds = fixerState.selectedIds.filter((id) => !fixedIds.has(id));
    // Đồng bộ danh sách đã lưu: mod đã sửa biến khỏi lọc ở trang Mod
    // ngay, không cần đợi quét lại.
    iManager.config.fixerSuspectIds = fixerState.suspects.map((m) => m.modId);
    iManager.saveConfig();
};

const handleFixerCopyTempPath = async () => {
    if (!fixerState.prepared) return;
    try {
        await navigator.clipboard.writeText(fixerState.prepared.tempDir);
        snack(t('fixer.pathCopied'));
    } catch (e) {
        console.error('copy temp path failed', e);
    }
};

// Đóng kết quả sửa, về trạng thái chờ để quét/sửa tiếp được — không có
// nút này thì sau 1 lần sửa, nút Quét + nút Sửa khóa luôn (flowStep
// kẹt ở 'done') tới khi mở lại app.
const handleFixerDismissResults = () => {
    fixerState.results = [];
    fixerState.flowStep = 'idle';
};


const plugins = ref({});
const pluginConfig = ref({});
const toggledPlugin = ref(false);
watch(pluginConfig, (newVal) => {
    //debug
    console.log('===pluginConfig changed:', newVal);
    iManager.pluginConfig = newVal;
    iManager.saveConfig();
});

const handePluginToggle = (pluginName) => {
    console.log('handePluginToggle:', pluginName);
    IPluginLoader.togglePlugin(pluginName);
    toggledPlugin.value = true;
}

const refreshDuleToPlugin = {
    name: 'refreshDuleToPlugin',
    data: false,
    type: 'iconbutton',
    displayName: 'Refresh to apply plugin',
    description: 'Application needs to be refreshed to apply plugin changes',
    buttonName: 'Refresh',
    t_displayName: {
        vi: 'Làm mới để áp dụng thay đổi',
        en: 'Refresh to apply plugin'
    },
    t_description: {
        vi: 'Cần làm mới để áp dụng thay đổi',
        en: 'Application needs to be refreshed to apply plugin changes'
    },
    t_buttonName: {
        vi: 'Làm mới',
        en: 'Refresh'
    },
    icon: `                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                            <path
                                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z">
                            </path>
                        </svg>`,
    onChange: (value) => {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('refresh-main-window');
    }
}

const ifUseTraditionalApply = {
    name: 'ifUseTraditionalApply',
    data: iManager.config.ifUseTraditionalApply,
    type: 'boolean',
    displayName: 'Use Traditional Apply',
    t_displayName: {
        vi: 'Dùng cách áp dụng truyền thống',
        en: 'Use Traditional Apply'
    },
    description: 'If true, the mod will be applied in a traditional way',
    t_description: {
        vi: 'Khi bật, mod sẽ được áp dụng theo cách truyền thống, trạng thái áp dụng của mod sẽ đổi bằng cách đổi tên thư mục',
        en: 'If true, the mod will be applied in a traditional way, using the traditional mode, the mod application status will be changed by changing the folder name'
    },
    onChange: (value) => {
        // 检查：modTarget和 modSource 需要是同一个文件夹
        // (Trước đây còn chặn khi bật "giữ tên mod giống tên thư mục" —
        // cài đặt đó đã bỏ, tên mod giờ luôn đồng bộ với tên thư mục và
        // tiền tố "disabled_" được nhận biết riêng nên không xung đột.)

        if (value) {
            if (iManager.config.modTargetPath !== iManager.config.modSourcePath) {
                iManager.config.ifUseTraditionalApply = false;
                console.log('ifUseTraditionalApply changed:', value, 'modTarget and modSource need to be the same folder');
                t_snack({
                    vi: 'Ở chế độ truyền thống, thư mục đích và thư mục nguồn của mod phải là cùng một thư mục',
                    en: 'modTarget and modSource need to be the same folder'
                }, SnackType.error)
                return false;
            }
            // debug
            console.log('ifUseTraditionalApply changed:', value);
            ifUseTraditionalApply.data = true;
            iManager.config.ifUseTraditionalApply = true;
            // return true;
        }
        else {
            // debug
            console.log('ifUseTraditionalApply changed:', value);
            ifUseTraditionalApply.data = false;
            iManager.config.ifUseTraditionalApply = false;
            // return false;
        }

        
        

        
    }
}

// Công tắc cảnh báo mod trùng nhau (Đạt dặn 23/11, test10): mặc định
// TẮT — anh bật khi cần. Tắt thì bấm Apply áp dụng thẳng, không quét
// trùng; bật thì có trùng sẽ hiện hộp cảnh báo trước như cũ.
const showConflictWarning = {
    name: 'showConflictWarning',
    data: iManager.config.showConflictWarning,
    type: 'boolean',
    displayName: 'Show Mod Conflict Warning',
    t_displayName: {
        vi: 'Hiện cảnh báo mod trùng nhau',
        en: 'Show Mod Conflict Warning'
    },
    description: 'If true, applying mods that change the same game asset will show a warning dialog first',
    t_description: {
        vi: 'Khi bật, bấm Áp dụng mà có 2 mod cùng thay 1 thứ trong game thì app hiện hộp cảnh báo trước; khi tắt thì áp dụng thẳng, không hỏi.',
        en: 'When enabled, applying mods that change the same game asset will show a warning dialog first; when disabled, mods are applied directly without asking.'
    },
    onChange: (value) => {
        console.log('showConflictWarning changed:', value);
        showConflictWarning.data = value;
        iManager.config.showConflictWarning = value;
        iManager.saveConfig();
    }
}



onMounted(async () => {
    //初始化tab
    currentTab.value = tabs.value[0];

    // Đếm bản sao lưu của Fixer để hiện trong tab Fixer.
    refreshFixerBackupInfo();

    // Lấy version đang chạy để hiện cạnh nút kiểm tra cập nhật.
    fetchAppVersion().then((v) => {
        currentVersion.value = v;
    });

    // 挂载插件的额外设置
    EventSystem.on(EventType.pluginLoaded, () => {
        plugins.value = IPluginLoader.plugins;
        pluginConfig.value = IPluginLoader.pluginConfig;

        tabs.value.push(...Object.keys(pluginConfig.value));
    });

    // console.log('pluginConfig', pluginConfig);


    // pluginConfig 是 一组 plungeName:pluginData 的键值对
    // 每个 pluginData 是一个 数组，数组中的每个元素是一个data对象，data对象包含了插件的设置
    // 每个 data 对象包含了以下属性
    // data 的格式为
    // {
    //     name: 'ifAblePlugin',
    //     data: true,
    //     type: 'boolean',
    //     displayName: 'If Able Plugin',
    //     description: 'If true, the plugin will be enabled',
    //     t_displayName:{
    //         zh_cn:'是否启用插件',
    //         en:'Enable Plugin'
    //     },
    //     t_description:{
    //         zh_cn:'如果为真，插件将被启用',
    //         en:'If true, the plugin will be enabled'
    //     },
    //     onChange: (value) => {
    //         console.log('ifAblePlugin changed:', value);
    //     }
    // }
    // 通过这个数据，我们可以动态生成插件的设置界面

    // 为 plugin 添加 tab
    // tabs.value.push(...Object.keys(pluginConfig.value));
});
</script>


<style scoped>
.setting-container {
    display: flex;
    height: calc(100% - 60px);
    width: 100%;
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
    flex-wrap: nowrap;
}

/* Hàng kiểm tra cập nhật: tiêu đề + version xếp sát nhau bên trái.
   .OO-setting-bar mặc định space-between sẽ đẩy version ra mép phải,
   chui xuống dưới nút bấm (nút đặt tuyệt đối ở mép phải). */
.update-check-row {
    justify-content: flex-start;
    gap: 16px;
}

.update-check-row p {
    margin: 0;
    white-space: nowrap;
}

/* Mod Fixer: khối xếp dọc (OO-setting-bar mặc định là hàng ngang cao
   50px, không đủ cho mô tả + đường dẫn + danh sách). */
.fixer-block {
    flex-direction: column;
    align-items: flex-start;
    height: auto;
    padding: 16px 20px;
    gap: 8px;
}

.fixer-block h3 {
    max-width: 100%;
}

.fixer-block p {
    margin: 0;
}

/* Nút trong khối Fixer xếp theo luồng thường: style.css đặt
   .OO-setting-bar s-button tuyệt đối ở mép phải (cho hàng 1 nút như
   kiểm tra cập nhật) — trong khối Fixer có nhiều nút, để vậy chúng
   chồng hết lên nhau ở mép phải, bấm nhầm nút (phát hiện qua ảnh chụp
   probe test4). Dùng position: relative (KHÔNG phải static): phần tử
   con tuyệt đối trong shadow DOM của Sober cần host có vị trí để neo
   vào — host static thì chúng neo vào khối .fixer-block, phủ kín cả
   khối, bấm nút nào cũng trúng nút sau cùng (phát hiện qua
   elementFromPoint ở diag test4). Scoped nên thắng luật toàn cục. */
.fixer-block s-button {
    position: relative;
    width: auto;
    height: auto;
    min-width: 0;
    max-width: none;
}

.fixer-actions {
    flex-direction: row;
    flex-wrap: wrap;
}

/* Hàng nút Quét + Tự sửa hết trong khối quét. */
.fixer-scan-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.fixer-path {
    width: 100%;
    word-break: break-all;
    font-size: 13px;
    color: var(--s-color-on-surface-variant, #aaa);
}

.fixer-select-all {
    display: flex;
    gap: 8px;
}

.fixer-suspect-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 0;
}

.fixer-suspect-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.fixer-suspect-count {
    font-size: 12px;
    color: var(--s-color-on-surface-variant, #aaa);
}

.fixer-result-fixed {
    color: #4caf50;
}

.fixer-result-unchanged {
    color: #9e9e9e;
}

.fixer-result-failed {
    color: #f44336;
}

.setting-content {
    position: relative;
    display: flex;
    flex-direction: column;
    width: calc(100% - 200px);
    height: calc(100% - 20px);
    flex: 1;
    margin: 0 10px;
}

.setting-content>div {
    overflow-y: auto;
}
</style>