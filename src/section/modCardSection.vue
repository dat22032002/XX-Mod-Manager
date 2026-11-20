<template>
    <div class="main-container">

        <leftMenu :tabs="presets" :translatedTabs="translatedPresets" @tabChange="handlePresetChange"
            ref="presetSelectorRef">
            <template #up-button>
                <s-icon type="arrow_drop_up"></s-icon>
            </template>
            <template #down-button>
                <s-tooltip style="margin-right: calc(100% - 40px);">
                    <s-icon-button slot="trigger" @click="handlePresetManageButtonClicked">
                        <s-icon type="menu"></s-icon>
                    </s-icon-button>

                    <p> {{ $t('buttons.managePreset') }} </p>
                </s-tooltip>

                <s-tooltip>
                    <s-icon-button slot="trigger" @click="handlePresetAddButtonClicked">
                        <s-icon type="add"></s-icon>
                    </s-icon-button>
                    <p> {{ $t('buttons.addPreset') }} </p>
                </s-tooltip>
            </template>
        </leftMenu>
        <modCardManager id="mod-card-manager" :compactMode="compactMode" :cardWidth="cardWidth"
            ref="modCardManagerRef">
        </modCardManager>
        <modInfo :mod="displayModRef"></modInfo>
    </div>

    <div class="bottom">
        <div class="bottom-left">
            <s-tooltip>
                <!-- -刷新按钮 -->
                <s-icon-button @click="handleRefreshButtonClicked" slot="trigger" class="OO-button"
                    style="color: var(--s-color-on-surface);transform: scale(0.95);">
                    <s-icon>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                            <path
                                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z">
                            </path>
                        </svg></s-icon>
                </s-icon-button>
                <p> {{ $t('buttons.refresh') }} </p>
            </s-tooltip>
            <s-tooltip>
                <s-switch class="OO-color-gradient-word" v-model="compactMode" @change="handleCompactButtonClicked"
                    slot="trigger" />
                <p> {{ $t('buttons.compactMode') }} </p>
            </s-tooltip>
            <s-tooltip>
                <s-icon-button @click="handleZoomOutClicked" slot="trigger" class="OO-button"
                    :disabled="cardWidth <= ZOOM_LEVELS[0]" style="color: var(--s-color-on-surface);">
                    <s-icon>
                        <svg viewBox="0 0 24 24">
                            <path d="M19 13H5v-2h14v2z" />
                        </svg>
                    </s-icon>
                </s-icon-button>
                <p> {{ $t('buttons.zoomOut') }} </p>
            </s-tooltip>
            <span class="zoom-label">{{ zoomPercent }}%</span>
            <s-tooltip>
                <s-icon-button @click="handleZoomInClicked" slot="trigger" class="OO-button"
                    :disabled="cardWidth >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]"
                    style="color: var(--s-color-on-surface);">
                    <s-icon>
                        <svg viewBox="0 0 24 24">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                    </s-icon>
                </s-icon-button>
                <p> {{ $t('buttons.zoomIn') }} </p>
            </s-tooltip>
        </div>
        <div class="bottom-center">
            <span class="mod-stats">{{ $t('stats.line', { total: statsTotal, enabled: selectedModIdSet.size, characters: statsCharacters }) }}</span>
        </div>
        <div class="bottom-right">
            <!-- <s-button @click="handleApplyButtonClicked" /> -->
            <s-popup align="top">
                <s-tooltip slot="trigger" style="position: relative;left: 15px;">
                    <s-icon-button icon="image" class="OO-button"
                        style="border: 5px solid var(--s-color-surface-container-high);transform: scale(1);"
                        slot="trigger" @click="syncBatchTagBar">
                        <s-icon type="chevron_down"></s-icon>
                    </s-icon-button>

                    <p style="line-height: 1.2;">
                        {{ $t('editDialog.batch-operation') }} </p>
                </s-tooltip>
                <!-- Bảng gọn: ôm sát hàng rộng nhất (hàng tag), không cố
                     định 760px nữa; nút + của cả 2 hàng đều ở mép phải. -->
                <div style="width: fit-content;height: max-content;">
                    <div class="OO-setting-bar">
                    <h3>{{ $t('editDialog.batch-set-character') }}</h3>
                    <div style="display: flex;align-items: center;gap: 8px;">
                        <!-- Ô nhập 200px cố định (không căng hết hàng);
                             position static để gỡ quy tắc absolute của
                             .OO-setting-bar s-text-field. -->
                        <s-text-field v-model="targetCharacter"
                            style="position: static;width: 200px;height: 40px;">
                        </s-text-field>
                        <s-icon-button type="filled" class="OO-icon-button"
                            @click="handleBatchSetCharacterButtonClicked">
                            <s-icon type="add"></s-icon>
                        </s-icon-button>
                    </div>
                </div>
                <!-- Đặt tag hàng loạt: chọn tag rồi bấm + (giống đặt nhân
                     vật hàng loạt ở trên). Chip thẳng + căn phải. -->
                <div class="OO-setting-bar">
                    <h3>{{ $t('editDialog.batch-set-tag') }}</h3>
                    <div style="display: flex;align-items: center;gap: 8px;flex: 1;min-width: 0;justify-content: flex-end;">
                        <chipRadioBar :items="batchTagItems" :translatedItems="translatedBatchTags"
                            @itemChange="handleBatchTagChange" ref="batchTagBarRef" straight />
                        <s-icon-button type="filled" class="OO-icon-button"
                            @click="handleBatchSetTagButtonClicked">
                            <s-icon type="add"></s-icon>
                        </s-icon-button>
                    </div>
                </div>
            </div>
                
            </s-popup>
            <div v-if="applying" class="apply-progress">
                <div class="apply-progress-text">{{ $t('apply.progress', { done: applyDone, total: applyTotal }) }}</div>
                <div class="apply-progress-bar">
                    <div class="apply-progress-fill" :style="{ width: applyPercent + '%' }"></div>
                </div>
            </div>
            <s-button @click="handleApplyButtonClicked" id="apply-button" :disabled="applying"
                class="OO-color-gradient font-hongmeng OO-button" style="color: var(--s-color-surface);">
                {{ $t('buttons.apply') }}
            </s-button>
        </div>
    </div>


    <!-- TC16: hộp xác nhận đặt nhân vật hàng loạt -->
    <dialogTemplate id="dialog-confirm-batch-character" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('batchCharacter.title') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ $t('batchCharacter.message', { count: batchConfirmCount, name: batchConfirmName }) }}</p>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.cancel') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="batch-character-confirm" @click="runBatchSetCharacter"
                class="OO-button font-hongmeng OO-color-gradient" style="color: var(--s-color-dark-surface);margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.confirm') }}</p>
            </s-button>
        </template>
    </dialogTemplate>

    <!-- hộp xác nhận đặt tag hàng loạt (giống hộp nhân vật ở trên) -->
    <dialogTemplate id="dialog-confirm-batch-tag" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('batchTag.title') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ $t('batchTag.message', { count: batchTagConfirmCount, name: batchTagConfirmName }) }}</p>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.cancel') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="batch-tag-confirm" @click="runBatchSetTag"
                class="OO-button font-hongmeng OO-color-gradient" style="color: var(--s-color-dark-surface);margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.confirm') }}</p>
            </s-button>
        </template>
    </dialogTemplate>

    <svg width="0" height="0">
        <defs>
            <clipPath id="svgCircle">
                <circle cx="100" cy="100" r="100" />
            </clipPath>
        </defs>
    </svg>
</template>

<script setup>
import modCardManager from '../components/modCardManager.vue';
import leftMenu from '../components/leftMenu.vue';
import modInfo from '../components/modInfo.vue';
import chipRadioBar from '../components/chipRadioBar.vue';
import { ref, onMounted, onUnmounted, useTemplateRef, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import dialogTemplate from '../dialogs/dialogTemplate.vue';
import IManager from '../../electron/IManager';
import { g_temp_vue, g_config_vue, g_data_vue } from '../../electron/IManager';
import fsProxy from '../../electron/fsProxy';
const iManager = new IManager();
import { EventSystem, EventType } from '../../helper/EventSystem';
import { SnackType, t_snack, snack } from '../../helper/SnackHelper';
import { selectedModIdSet } from '../../helper/SelectedMods';
import { MOD_TAGS, isValidTag } from '../../helper/ModTag';
import { DialogHelper, DialogID } from '../../helper/DialogHelper';
import { checkConflicts } from '../../helper/ConflictCheck';

const displayModRef = g_temp_vue.currentMod;

//-============================== 事件处理 ==============================

function handlePresetManageButtonClicked() {
    console.log('preset manage button clicked');
    fsProxy.openDir(iManager.config.presetPath);
    iManager.showDialog('dialog-need-refresh');
}

function handlePresetAddButtonClicked() {
    console.log('preset add button clicked');
    // const addPresetDialog = document.getElementById('add-preset-dialog');
    // addPresetDialog.show();
    iManager.showDialog('add-preset-dialog');
}

function handleRefreshButtonClicked() {
    // Làm mới danh sách mod mà không tải lại cả cửa sổ.
    iManager.refreshModList();
}

const { t } = useI18n();

const targetCharacter = ref('');
// TC16: dữ liệu cho hộp xác nhận đặt nhân vật hàng loạt.
const batchConfirmCount = ref(0);
const batchConfirmName = ref('');
const batchConfirmIds = ref([]);
function handleBatchSetCharacterButtonClicked(){
    console.log('batch set character button clicked', targetCharacter.value);
    // TC16: cắt khoảng trắng thừa — tên toàn khoảng trắng trước đây vẫn qua
    // được kiểm tra rỗng.
    const newCharacter = targetCharacter.value.trim();
    const ModIds = selectedModIds();

    if (!newCharacter) {
        t_snack({
            vi: 'Hãy nhập tên nhân vật',
            en: 'Please enter the character name',
        },SnackType.error);
        console.error('targetCharacter is empty');
        return;
    }
    if (ModIds.length == 0) {
        t_snack({
            vi: 'Hãy chọn ít nhất một mod',
            en: 'Please select at least one mod',
        },SnackType.error);
        console.error('selectedModIds is empty');
        return;
    }
    // TC16: hỏi xác nhận (ghi số mod + tên mới) trước khi ghi đè hàng loạt.
    batchConfirmCount.value = ModIds.length;
    batchConfirmName.value = newCharacter;
    batchConfirmIds.value = ModIds;
    iManager.showDialog('dialog-confirm-batch-character');
}

// TC16: chạy tuần tự, bắt lỗi từng mod, báo kết quả cuối. Trước đây dùng
// forEach(async ...) không await/không try/catch nên lỗi từng mod bị nuốt
// im và không có thông báo nào khi xong.
async function runBatchSetCharacter(){
    const newCharacter = batchConfirmName.value;
    const ModIds = batchConfirmIds.value;
    const failedMods = [];
    let changedCount = 0;
    for (const modId of ModIds) {
        try {
            const ModData = await iManager.getModInfoById(modId);
            if (ModData) {
                ModData.character = newCharacter;
                await ModData.saveModInfo();
                ModData.triggerChanged();
                changedCount++;
            } else {
                failedMods.push(modId);
            }
        } catch (error) {
            console.error('batch set character: failed to save mod', modId, error);
            failedMods.push(modId);
        }
    }
    if (failedMods.length > 0) {
        const names = failedMods.slice(0, 5).join(', ') + (failedMods.length > 5 ? ', …' : '');
        snack(t('batchCharacter.doneWithFailures', { ok: changedCount, fail: failedMods.length, names }), 'error');
    } else {
        snack(t('batchCharacter.done', { count: changedCount }), 'success');
    }
}

//-==================== Đặt tag hàng loạt ====================//
// Giống đặt nhân vật hàng loạt (TC16): chọn tag rồi bấm +, hỏi xác nhận
// (ghi số mod + tên tag) rồi ghi vào từng mod đã chọn. Dùng để gắn tag
// lại cho nhiều mod cũ cùng lúc (vd các mod skin trước đây chưa có
// tiền tố nên tự gắn tag Character).
const batchTag = ref('character');
const batchTagItems = MOD_TAGS;
const translatedBatchTags = computed(() => MOD_TAGS.map(tag => t(`modTag.${tag}`)));
const batchTagBarRef = useTemplateRef('batchTagBarRef');
const batchTagConfirmCount = ref(0);
const batchTagConfirmName = ref('');
const batchTagConfirmIds = ref([]);
function handleBatchTagChange(tag) {
    if (isValidTag(tag)) batchTag.value = tag;
}
// Đồng bộ thanh vàng khi mở bảng thao tác hàng loạt: lúc bảng đóng, chip
// đo được 0 nên thanh lệch — đo lại sau 2 khung hình (giống bảng lọc).
function syncBatchTagBar() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (batchTagBarRef.value) batchTagBarRef.value.selectItemByName(batchTag.value);
    }));
}
function handleBatchSetTagButtonClicked() {
    const ModIds = selectedModIds();
    if (ModIds.length == 0) {
        t_snack({
            vi: 'Hãy chọn ít nhất một mod',
            en: 'Please select at least one mod',
        }, SnackType.error);
        console.error('selectedModIds is empty');
        return;
    }
    batchTagConfirmCount.value = ModIds.length;
    batchTagConfirmName.value = t(`modTag.${batchTag.value}`);
    batchTagConfirmIds.value = ModIds;
    iManager.showDialog('dialog-confirm-batch-tag');
}
async function runBatchSetTag() {
    const newTag = batchTag.value;
    const ModIds = batchTagConfirmIds.value;
    const failedMods = [];
    let changedCount = 0;
    for (const modId of ModIds) {
        try {
            const ModData = await iManager.getModInfoById(modId);
            if (ModData) {
                ModData.tag = newTag;
                await ModData.saveModInfo();
                ModData.triggerChanged();
                changedCount++;
            } else {
                failedMods.push(modId);
            }
        } catch (error) {
            console.error('batch set tag: failed to save mod', modId, error);
            failedMods.push(modId);
        }
    }
    if (failedMods.length > 0) {
        const names = failedMods.slice(0, 5).join(', ') + (failedMods.length > 5 ? ', …' : '');
        snack(t('batchTag.doneWithFailures', { ok: changedCount, fail: failedMods.length, names }), 'error');
    } else {
        snack(t('batchTag.done', { count: changedCount }), 'success');
    }
}

//-============================== Compact Mode ==============================
//#region Compact Mode
const compactMode = ref(false);

function handleCompactButtonClicked() {
    console.log('compact button clicked');
    compactMode.value = !compactMode.value;
    //切换compactMode
    return;
}
//#endregion

//-============================== Phóng to ==============================
//#region Zoom
// Mức phóng to (chiều rộng thẻ, px). 250 là cỡ gốc = 100%.
const ZOOM_LEVELS = [100, 150, 200, 250, 300, 350];
// Đọc qua g_config_vue (ref phản ứng): lúc mở app, loadConfig ghi giá trị
// đã lưu vào đây, khung lưới tự cập nhật theo. Ghi thì đi qua Proxy
// iManager.config để _config + ref cùng đổi (ghi thẳng vào ref thì file
// config không đổi theo).
const cardWidth = g_config_vue.cardWidth;
const zoomPercent = computed(() => Math.round(cardWidth.value / 250 * 100));

// Ghi config dồn: bấm +/− lia lịa thì chờ 300ms sau lần bấm cuối mới ghi
// 1 lần (giống cách ghi preset dồn).
let saveViewTimer = null;
function saveViewSettings() {
    if (saveViewTimer) clearTimeout(saveViewTimer);
    saveViewTimer = setTimeout(() => {
        saveViewTimer = null;
        iManager.saveConfig();
    }, 300);
}

function handleZoomOutClicked() {
    const i = ZOOM_LEVELS.indexOf(cardWidth.value);
    if (i > 0) {
        iManager.config.cardWidth = ZOOM_LEVELS[i - 1];
        saveViewSettings();
    }
}

function handleZoomInClicked() {
    const i = ZOOM_LEVELS.indexOf(cardWidth.value);
    if (i >= 0 && i < ZOOM_LEVELS.length - 1) {
        iManager.config.cardWidth = ZOOM_LEVELS[i + 1];
        saveViewSettings();
    }
}
//#endregion

//-============================= thống kê kho mod ==============================
// Dòng thống kê ở giữa thanh dưới: tổng số mod, số mod đang bật, số nhân
// vật. modList không phải reactive (chỉ bắn sự kiện modListChanged khi
// gán lại) nên đọc lại mỗi khi có sự kiện modListChanged / modInfoChanged
// (đổi nhân vật của mod cũng đổi số nhân vật); số mod đang bật đọc thẳng
// từ selectedModIdSet (reactive) trong template nên tự cập nhật khi bấm
// chọn/bỏ chọn. "Unknown" không phải nhân vật nên không tính.
const statsTotal = ref(0);
const statsCharacters = ref(0);
const refreshStats = () => {
    const list = iManager.data.modList || [];
    statsTotal.value = list.length;
    const characters = new Set(list.map(mod => (mod.character || '').trim()).filter(c => c && c !== 'Unknown'));
    statsCharacters.value = characters.size;
};

onMounted(() => {
    refreshStats();
    EventSystem.on(EventType.modListChanged, refreshStats);
    EventSystem.on(EventType.modInfoChanged, refreshStats);
});

//-============================= presets ==============================
//#region presets
// const presets = ref([]);
const language = g_config_vue.language;
const presets = computed(() => {
    return ['default', ...g_data_vue.presetList.value];
});
const translatedPresets = computed(() => {
    // 根据语言翻译 default
    //debug
    console.log('presets changed', language.value);
    if (language.value === 'vi') {
        return ['Mặc định', ...g_data_vue.presetList.value];
    } else {
        return ['default', ...g_data_vue.presetList.value];
    }
});

// 这里只做显示切换，真正的功能通过 eventsystem.on('currentPresetChanged') 来实现
const currentPreset = g_temp_vue.currentPreset;
watch(currentPreset, (newVal, oldVal) => {
    presetSelectorRef.value.selectTabByName(newVal);
});

function handlePresetChange(tab) {
    // Xả lần ghi preset cũ đang chờ trước khi đổi sang preset khác,
    // không thì lựa chọn vừa bấm sẽ mất khỏi preset cũ.
    flushPresetSave();
    iManager.setCurrentPreset(tab);
}

// Selections live in the shared set (helper/SelectedMods): cards that are
// scrolled out of view are not in the DOM, so reading .mod-item elements
// would silently drop them from presets, Apply, and batch-set-character.
const selectedModIds = () => [...selectedModIdSet];
const selectedModNames = () => [...selectedModIdSet].map(id => iManager.data.modList.find(mod => mod.id === id)?.name).filter(Boolean);


// Ghi preset dồn: mỗi lần bấm chọn/bỏ mod trước đây ghi lại toàn bộ file
// preset ngay — bấm lia lịa là ghi file lia lịa. Giờ chờ 500ms sau lần bấm
// cuối mới ghi 1 lần. Lần ghi đang chờ được xả ngay khi đổi preset hoặc
// đóng cửa sổ để không mất lựa chọn.
let savePresetTimer = null;
function flushPresetSave() {
    if (savePresetTimer) {
        clearTimeout(savePresetTimer);
        savePresetTimer = null;
        writePresetNow();
    }
}
function writePresetNow() {
    // Preset Mặc định không có file riêng: lựa chọn của nó lưu vào config.
    if (currentPreset.value == 'default') {
        iManager.saveDefaultPreset(selectedModIds());
        return;
    }
    //debug
    console.log('save preset', currentPreset.value, selectedModIds());
    iManager.savePresetByModIds(currentPreset.value, selectedModIds());
}
function savePreset() {
    if (savePresetTimer) {
        clearTimeout(savePresetTimer);
    }
    savePresetTimer = setTimeout(() => {
        savePresetTimer = null;
        writePresetNow();
    }, 500);
}

// Xả lần ghi đang chờ khi đóng cửa sổ (ghi file là đồng bộ nên kịp xong
// trước khi cửa sổ đóng).
window.addEventListener('beforeunload', flushPresetSave);
onUnmounted(() => {
    window.removeEventListener('beforeunload', flushPresetSave);
});

const presetSelectorRef = useTemplateRef('presetSelectorRef');

//#endregion

//-=========================== apply button ===========================
const applying = ref(false);
const applyDone = ref(0);
const applyTotal = ref(0);
const applyPercent = computed(() => applyTotal.value > 0 ? Math.round(applyDone.value / applyTotal.value * 100) : 0);

// Phần áp dụng thật (tách riêng để nút Apply và hộp cảnh báo cùng gọi).
async function runApply() {
    applying.value = true;
    applyDone.value = 0;
    applyTotal.value = 0;
    try {
        await iManager.applyMods(selectedModIds(), (done, total) => {
            applyDone.value = done;
            applyTotal.value = total;
        });
        console.log('apply success', selectedModIds());
    } finally {
        applying.value = false;
    }
}

async function handleApplyButtonClicked() {
    if (applying.value) {
        return;
    }
    // Cảnh báo mod đụng nhau: quét các mod đang bật, nếu 2 mod cùng thay
    // 1 thứ của game thì hỏi trước khi áp dụng. Kiểm tra lỗi thì bỏ qua
    // lặng, không chặn Apply.
    let conflicts = [];
    try {
        const selectedMods = (iManager.data.modList || []).filter(m => selectedModIdSet.has(m.id));
        conflicts = await checkConflicts(selectedMods);
    } catch (e) {
        console.error('conflict check failed, applying anyway', e);
    }
    if (conflicts.length === 0) {
        await runApply();
        return;
    }
    const dialog = document.getElementById('dialog-confirm-conflict');
    if (!dialog) {
        // Hộp cảnh báo không có (lỗi lạ): áp dụng thẳng, không chặn user.
        await runApply();
        return;
    }
    // Có đụng nhau: ghi danh sách cho hộp đọc, rồi chờ người dùng chọn.
    // Bấm "Vẫn áp dụng" thì hộp bắn sự kiện applyConflictsConfirmed;
    // bấm Hủy thì hộp đóng, bộ nghe được gỡ để lần bấm Apply sau không
    // bị chạy 2 lần.
    iManager.temp.pendingConflicts = conflicts;
    let confirmed = false;
    const onConfirmed = async () => {
        confirmed = true;
        await EventSystem.off(EventType.applyConflictsConfirmed, onConfirmed);
        await runApply();
    };
    const onDismiss = async () => {
        dialog.removeEventListener('dismiss', onDismiss);
        if (!confirmed) {
            await EventSystem.off(EventType.applyConflictsConfirmed, onConfirmed);
        }
    };
    dialog.addEventListener('dismiss', onDismiss);
    await EventSystem.on(EventType.applyConflictsConfirmed, onConfirmed);
    DialogHelper.showDialog(DialogID.dialogConfirmConflict);
}

EventSystem.on('toggledMod', (mod) => {
    //debug
    console.log('toggled mod', mod.name);
    savePreset();
});
</script>


<style scoped>
#mod-card-manager {
    height: calc(100% - 20px);
}

#test {
    background-color: red;
    cursor: pointer;
    margin: 10px;
    /* border-radius: 0 80px 20px 0px;
    transform: skew(-20deg); */
}

.main-container {
    position: relative;
    display: flex;
    height: calc(100% - 60px);
    width: 100%;
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
}

.zoom-label {
    min-width: 44px;
    text-align: center;
    color: var(--s-color-on-surface-variant);
    font-size: 0.85em;
    align-self: center;
}

.bottom {
    position: absolute;
    height: 60px;
    width: 100vw;
    bottom: -10px;
    /* background-color: var(--s-color-primary); */
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bottom-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.bottom-center {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-width: 0;
}

.mod-stats {
    font-size: 14px;
    color: var(--s-color-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bottom-right {
    display: flex;
    justify-content: flex-end;
    align-items: center;
}

#apply-button {
    padding: 0 60px;
    margin: 0 40px;
    font-size: 20px;

    color: var(--s-color-dark-surface);
}

.apply-progress {
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 260px;
    margin-right: 10px;
}

.apply-progress-text {
    font-size: 14px;
    color: var(--s-color-on-surface);
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.apply-progress-bar {
    height: 6px;
    background: var(--s-color-surface-container-high);
    border-radius: 3px;
    overflow: hidden;
}

.apply-progress-fill {
    height: 100%;
    background: var(--s-color-primary);
    transition: width 0.15s;
}
</style>
