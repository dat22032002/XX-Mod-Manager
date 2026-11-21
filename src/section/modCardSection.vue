<template>
    <div class="main-container">

        <div class="left-column">
        <leftMenu :tabs="presets" :translatedTabs="translatedPresets" @tabChange="handlePresetChange"
            ref="presetSelectorRef" fit-content>
            <template #up-button>
                <s-icon type="arrow_drop_up"></s-icon>
            </template>
            <template #down-button>
                <!-- Lề phải chừa 80px cho 2 nút bên phải (xóa + thêm),
                     mỗi nút rộng 40px. -->
                <s-tooltip style="margin-right: calc(100% - 80px);">
                    <s-icon-button slot="trigger" @click="handlePresetManageButtonClicked">
                        <s-icon type="menu"></s-icon>
                    </s-icon-button>

                    <p> {{ $t('buttons.managePreset') }} </p>
                </s-tooltip>

                <!-- Xóa preset đang chọn (Đạt dặn 20/11): nút thùng rác
                     kế bên nút thêm; bấm thì hộp xác nhận hiện lên.
                     Preset Mặc định không xóa được nên nút mờ đi — mờ
                     bằng opacity chứ không dùng disabled (nút disabled
                     của Sober biến mất hẳn, nhìn như thiếu nút). -->
                <s-tooltip>
                    <s-icon-button slot="trigger" @click="handlePresetDeleteButtonClicked"
                        :style="currentPreset === 'default' ? 'opacity: 0.35' : ''">
                        <!-- Sober không có sẵn icon 'delete' (type lạ thì
                             vẽ rỗng) nên dùng SVG thùng rác inline. -->
                        <s-icon>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                                <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-600v520-520Z" />
                            </svg>
                        </s-icon>
                    </s-icon-button>
                    <p> {{ $t('buttons.deletePreset') }} </p>
                </s-tooltip>

                <s-tooltip>
                    <s-icon-button slot="trigger" @click="handlePresetAddButtonClicked">
                        <s-icon type="add"></s-icon>
                    </s-icon-button>
                    <p> {{ $t('buttons.addPreset') }} </p>
                </s-tooltip>
            </template>
        </leftMenu>
        <characterList @itemChange="handleCharacterListChange" />
        </div>
        <modCardManager id="mod-card-manager" :compactMode="compactMode" :cardWidth="cardWidth"
            :cardLayout="cardLayout" :fullImage="cardFullImage" ref="modCardManagerRef">
        </modCardManager>
        <modInfo :mod="displayModRef"></modInfo>
    </div>

    <div class="bottom">
        <div class="bottom-left">
            <!-- Viên con nhộng chuyển kiểu thẻ: Dọc / Ngang, ở đầu trái
                 thanh dưới (chỗ nút Refresh cũ — Đạt dặn 20/11). -->
            <!-- Nút Dọc/Ngang dùng thẳng component nút Mod/Help/Setting
                 (sectionSelector), chỉ có 2 mục thay vì 3 (Đạt dặn 21/11):
                 viên vàng + kiểu trượt y hệt nút Mod. -->
            <sectionSelector id="layout-capsule" :sections="layoutSections" :modelValue="cardLayout" :compact="true"
                @update:modelValue="handleLayoutClicked" />
            <s-tooltip>
                <s-switch class="OO-color-gradient-word" v-model="compactMode" @change="handleCompactButtonClicked"
                    slot="trigger" />
                <p> {{ $t('buttons.compactMode') }} </p>
            </s-tooltip>
            <s-tooltip>
                <s-icon-button @click="handleZoomOutClicked" slot="trigger" class="OO-button"
                    :disabled="!canZoomOut" style="color: var(--s-color-on-surface);">
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
                    :disabled="!canZoomIn"
                    style="color: var(--s-color-on-surface);">
                    <s-icon>
                        <svg viewBox="0 0 24 24">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                    </s-icon>
                </s-icon-button>
                <p> {{ $t('buttons.zoomIn') }} </p>
            </s-tooltip>
            <!-- Nút chuyển đổi ảnh gốc / ảnh thu nhỏ (Đạt dặn 20/11): bên
                 phải nút +, nút tròn như nút zoom; đang hiện ảnh gốc thì
                 nền vàng như nút kiểu thẻ đang chọn. -->
            <s-tooltip>
                <button id="full-image-button" class="full-image-button" :class="{ active: cardFullImage }"
                    @click="handleFullImageClicked" slot="trigger">
                    <svg viewBox="0 0 24 24">
                        <path
                            d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                    </svg>
                </button>
                <p> {{ $t('buttons.fullImage') }} </p>
            </s-tooltip>
        </div>
        <div class="bottom-center">
            <span class="mod-stats">{{ $t('stats.line', { total: statsTotal, enabled: selectedModIdSet.size, characters: statsCharacters }) }}</span>
        </div>
        <div class="bottom-right">
            <!-- <s-button @click="handleApplyButtonClicked" /> -->
            <s-popup align="top">
                <s-tooltip slot="trigger" style="position: relative;">
                    <s-icon-button icon="image" class="OO-button"
                        style="border: 5px solid var(--s-color-surface-container-high);transform: scale(1);"
                        slot="trigger" @click="syncBatchTagBar">
                        <s-icon type="chevron_down"></s-icon>
                    </s-icon-button>

                    <p style="line-height: 1.2;">
                        {{ $t('editDialog.batch-operation') }} </p>
                </s-tooltip>
                <!-- Bảng gọn: ôm sát hàng rộng nhất (hàng tag), không cố
                     định 760px nữa; nút + của cả 2 hàng đều ở mép phải.
                     Khung trắng ngoài như khung hộp sửa mod (Đạt dặn
                     20/11), đệm đều quanh nội dung. Nền ĐEN TUYỀN
                     #000000 (Đạt dặn 20/11): KHÔNG dùng
                     surface-container (theme của app định nghĩa nó là
                     #00000052, đen trong suốt 32%, nhìn xuyên thấy thẻ
                     mod phía sau) và KHÔNG dùng surface-container-low
                     (#222222 — trùng màu hàng + nút bấm, cả bảng thành
                     một khối xám phẳng, không phân biệt được). Hàng và
                     nút giữ màu gốc #222222 nên nổi rõ trên nền đen. -->
                <div style="width: fit-content;height: max-content;background-color: #000000;border: 2px solid var(--s-color-outline-variant);border-radius: 16px;padding: 10px 6px;box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);box-sizing: border-box;">
                    <p style="margin: 0 20px 2px;font-size: 0.8rem;color: var(--s-color-outline);">{{ $t('editDialog.batch-hint') }}</p>
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

            <!-- Nút Refresh dạng dài có chữ, giống nút Open Folder ở khung
                 chi tiết (Đạt dặn 20/11): s-button + icon ở đầu + chữ. -->
            <s-button @click="handleRefreshButtonClicked" id="refresh-button" class="OO-button font-hongmeng">
                <s-icon slot="start">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                        <path
                            d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z">
                        </path>
                    </svg>
                </s-icon>
                <p>{{ $t('buttons.refresh') }}</p>
            </s-button>
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
import characterList from '../components/characterList.vue';
import leftMenu from '../components/leftMenu.vue';
import modInfo from '../components/modInfo.vue';
import chipRadioBar from '../components/chipRadioBar.vue';
import sectionSelector from '../components/sectionSelector.vue';
import { ref, onMounted, onUnmounted, useTemplateRef, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import dialogTemplate from '../dialogs/dialogTemplate.vue';
import IManager from '../../electron/IManager';
import { g_temp_vue, g_config_vue, g_data_vue } from '../../electron/IManager';
import fsProxy from '../../electron/fsProxy';
const iManager = new IManager();
import { EventSystem, EventType } from '../../helper/EventSystem';
import { SnackType, t_snack, snack } from '../../helper/SnackHelper';
import { selectedModIdSet, batchSelectedModIdSet } from '../../helper/SelectedMods';
import { MOD_TAGS, isValidTag } from '../../helper/ModTag';
import { computeFillLayout, fillWidthForColumns, rangeCheckedWidth, LAYOUT_BASE, ZOOM_RANGE } from '../components/modWindowing.js';
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

function handlePresetDeleteButtonClicked() {
    console.log('preset delete button clicked');
    // Preset Mặc định không có file riêng nên không xóa được: bấm vào
    // thì chỉ báo cho biết, không mở hộp xác nhận.
    if (currentPreset.value === 'default') {
        iManager.snack(t('deletePresetDialog.cannotDeleteDefault'), 'error');
        return;
    }
    iManager.showDialog('dialog-confirm-delete-preset');
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
    // Thao tác hàng loạt chạy trên tập chọn xanh biển (Ctrl+bấm),
    // không dùng tập chọn vàng (để Áp Dụng).
    const ModIds = batchSelectedModIds();

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
            vi: 'Giữ Ctrl rồi bấm thẻ để chọn mod làm hàng loạt trước đã',
            en: 'Hold Ctrl and click cards to pick mods for batch first',
        },SnackType.error);
        console.error('batchSelectedModIds is empty');
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
    // Thao tác hàng loạt chạy trên tập chọn xanh biển (Ctrl+bấm),
    // không dùng tập chọn vàng (để Áp Dụng).
    const ModIds = batchSelectedModIds();
    if (ModIds.length == 0) {
        t_snack({
            vi: 'Giữ Ctrl rồi bấm thẻ để chọn mod làm hàng loạt trước đã',
            en: 'Hold Ctrl and click cards to pick mods for batch first',
        }, SnackType.error);
        console.error('batchSelectedModIds is empty');
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
// Kiểu thẻ + phóng to (chiều rộng thẻ, px). Dọc: 100–350, 250 là cỡ
// gốc = 100% (thẻ 250×350 như cũ). Ngang: 200–450, 350 là cỡ gốc = 100%
// (thẻ 350×280), NHƯNG mặc định mở ở 86% = 301px (Đạt dặn 20/11).
// Mỗi kiểu nhớ rộng riêng của nó (cardWidthVertical/cardWidthHorizontal):
// đổi qua lại thì về đúng tỉ lệ đã lưu thay vì về 100%.
// Đọc qua g_config_vue (ref phản ứng): lúc mở app, loadConfig ghi giá trị
// đã lưu vào đây, khung lưới tự cập nhật theo. Ghi thì đi qua Proxy
// iManager.config để _config + ref cùng đổi (ghi thẳng vào ref thì file
// config không đổi theo).
const cardLayout = g_config_vue.cardLayout;
// 2 mục của nút Dọc/Ngang (component sectionSelector dùng chung với nút
// Mod/Help/Setting; khai 1 lần để watcher của component không chạy lại
// mỗi lần vẽ).
const layoutSections = ['vertical', 'horizontal'];
const cardWidth = g_config_vue.cardWidth;

// Phóng to theo CỘT (Đạt dặn 20/11): nấc rộng cũ (301 → 350 → 400...)
// hay cho cùng 1 rộng thật vì thẻ tự kéo lấp đầy hàng — bấm 1 lần
// không thấy gì, phải bấm 2 lần mới đổi. Giờ mỗi lần bấm +/− là đổi
// đúng 1 cột: + bớt 1 cột (thẻ to ra), − thêm 1 cột (thẻ nhỏ lại).
// Rộng danh nghĩa lưu trong config là rộng lấp đầy đúng số cột đó.
// Nhãn % hiện rộng THẬT so với cỡ gốc 100% (rộng thật / 250 hay 350),
// không phải số danh nghĩa nữa.
// Rộng khung đo trực tiếp từ DOM (#mod-container nằm trong
// modCardManager nhưng cùng 1 trang nên đo được từ đây) + theo dõi
// bằng ResizeObserver để đổi cỡ cửa sổ là số cột/% cập nhật theo.
const gridContainerWidth = ref(0);
let gridResizeObserver = null;
function measureGridWidth() {
    const el = document.querySelector('#mod-container');
    if (el) gridContainerWidth.value = el.clientWidth;
}
const nominalCardWidth = computed(() => rangeCheckedWidth(cardWidth.value, cardLayout.value));
const fillLayout = computed(() => computeFillLayout(gridContainerWidth.value, nominalCardWidth.value, cardLayout.value));
const zoomPercent = computed(() => Math.round(fillLayout.value.width / LAYOUT_BASE[cardLayout.value] * 100));
const zoomColumns = computed(() => fillLayout.value.columns);
// Bấm + được khi bớt 1 cột mà thẻ vẫn trong khoảng cho phép (không
// vượt rộng tối đa); bấm − được khi thêm 1 cột mà thẻ vẫn không nhỏ
// hơn rộng tối thiểu. Chưa đo được khung thì cả 2 đều tắt.
const canZoomIn = computed(() => {
    const n = zoomColumns.value;
    if (n <= 1) return false;
    return fillWidthForColumns(gridContainerWidth.value, n - 1) <= ZOOM_RANGE[cardLayout.value][1];
});
const canZoomOut = computed(() => {
    const n = zoomColumns.value;
    return fillWidthForColumns(gridContainerWidth.value, n + 1) >= ZOOM_RANGE[cardLayout.value][0];
});

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

// Rộng đã lưu của 1 kiểu (đọc/ghi qua Proxy để _config + file cùng đổi).
function getLayoutWidth(layout) {
    return layout === 'vertical' ? iManager.config.cardWidthVertical : iManager.config.cardWidthHorizontal;
}
function setLayoutWidth(layout, width) {
    if (layout === 'vertical') iManager.config.cardWidthVertical = width;
    else iManager.config.cardWidthHorizontal = width;
}

function handleZoomOutClicked() {
    // Thêm đúng 1 cột: rộng danh nghĩa mới là rộng lấp đầy số cột mới
    // (lưới tự tính ra đúng số cột đó — xem computeFillLayout).
    // Trí nhớ của kiểu đang dùng đổi theo.
    if (!canZoomOut.value) return;
    const w = fillWidthForColumns(gridContainerWidth.value, zoomColumns.value + 1);
    iManager.config.cardWidth = w;
    setLayoutWidth(cardLayout.value, w);
    saveViewSettings();
}

function handleZoomInClicked() {
    // Bớt đúng 1 cột: rộng danh nghĩa mới là rộng lấp đầy số cột mới.
    if (!canZoomIn.value) return;
    const w = fillWidthForColumns(gridContainerWidth.value, zoomColumns.value - 1);
    iManager.config.cardWidth = w;
    setLayoutWidth(cardLayout.value, w);
    saveViewSettings();
}

// Đổi kiểu thẻ (viên con nhộng đầu trái thanh dưới): lưu rộng kiểu cũ
// trước khi đổi, rồi lấy rộng đã lưu của kiểu mới — mỗi kiểu nhớ tỉ lệ
// riêng (Đạt dặn 20/11), không về 100% như trước nữa.
function handleLayoutClicked(layout) {
    if (layout === cardLayout.value) return;
    setLayoutWidth(cardLayout.value, cardWidth.value);
    iManager.config.cardLayout = layout;
    iManager.config.cardWidth = getLayoutWidth(layout);
    saveViewSettings();
}

// Ảnh gốc / ảnh thu nhỏ trên thẻ (nút bên phải + — Đạt dặn 20/11):
// bật thì thẻ hiện ảnh gốc đầy đủ như khung phải, tắt thì về ảnh thu
// nhỏ 250px. Lưu vào config nên tắt app mở lại vẫn nhớ.
const cardFullImage = g_config_vue.cardFullImage;
function handleFullImageClicked() {
    iManager.config.cardFullImage = !cardFullImage.value;
    saveViewSettings();
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
    // Đo rộng khung lưới ngay + theo dõi khi đổi cỡ (để tính số cột,
    // nhãn % thật và nút +/− theo cột).
    measureGridWidth();
    if (typeof ResizeObserver !== 'undefined') {
        gridResizeObserver = new ResizeObserver(measureGridWidth);
        const el = document.querySelector('#mod-container');
        if (el) gridResizeObserver.observe(el);
    }
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
// Id các mod chọn làm hàng loạt (Ctrl+bấm, viền xanh biển).
const batchSelectedModIds = () => [...batchSelectedModIdSet];
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
    if (gridResizeObserver) gridResizeObserver.disconnect();
});

const presetSelectorRef = useTemplateRef('presetSelectorRef');
const modCardManagerRef = useTemplateRef('modCardManagerRef');

// Bấm tên nhân vật trong danh sách dọc: lọc lưới mod theo nhân vật đó
// (giống hệt bấm chip nhân vật cũ).
const handleCharacterListChange = (character) => {
    modCardManagerRef.value?.selectCharacter(character);
};

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

/* Cột trái: khung preset ngắn (vừa đủ số preset) + danh sách nhân vật
   dọc chiếm phần còn lại. */
.left-column {
    display: flex;
    flex-direction: column;
    width: 200px;
    flex-shrink: 0;
    height: calc(100% - 20px);
}

.zoom-label {
    min-width: 44px;
    text-align: center;
    color: var(--s-color-on-surface-variant);
    font-size: 0.85em;
    align-self: center;
}

/* Viên con nhộng chuyển kiểu thẻ (Dọc/Ngang), ở đầu trái thanh dưới
   (Đạt dặn 20/11). Kiểu đang chọn nền vàng như nút MOD; kiểu còn lại
   nền trong suốt. Cao 40px bằng nút phóng to. */
/* Nút Dọc/Ngang dùng component sectionSelector (kiểu dáng nằm trong
   component đó); chỉ giữ cho nút không bị thanh dưới co lại. */
#layout-capsule {
    flex-shrink: 0;
}

/* Nút chuyển đổi ảnh gốc / ảnh thu nhỏ: tròn 40px như nút zoom, đang
   hiện ảnh gốc thì nền vàng như nút kiểu thẻ đang chọn. */
.full-image-button {
    width: 40px;
    height: 40px;
    box-sizing: border-box;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background-color: var(--s-color-surface-container-low);
    border: 1px solid var(--s-color-outline-variant);
    border-radius: 50%;
    color: var(--s-color-on-surface);
    cursor: pointer;
}
.full-image-button.active {
    background-color: var(--s-color-primary);
    color: var(--s-color-on-primary);
}
.full-image-button svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
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
    /* Khoảng cách batch - Refresh - Apply (Refresh chuyển sang đây
       20/11; trước đây chỉ có batch + Apply, Apply đã có margin
       riêng nên không cần gap). */
    gap: 8px;
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
