<!-- 1 hàng ngang trong dạng danh sách: ảnh nhỏ + tên + nhân vật + phím tắt
     + nút ghim. Hành vi bấm chọn/ghim dùng chung helper với thẻ lưới
     (helper/SelectedMods) nên giống hệt nhau. Ảnh tải ngay lúc hàng hiện
     (danh sách cũng chỉ gắn hàng gần khung nhìn nên không tốn). -->
<template>
    <div class="mod-list-row" ref="rowRef" :clicked="clicked" :id="props.modRef.id" :name="props.modRef.name"
        :character="props.modRef.character" @click="click" @contextmenu.prevent.stop="openEditModDialog">
        <div class="row-thumb">
            <img v-if="img" :src="img" alt="" />
            <div v-else class="row-thumb-empty"></div>
        </div>
        <div class="row-name">{{ props.modRef.name }}</div>
        <div class="row-character">{{ props.modRef.character }}</div>
        <div class="row-hotkeys">{{ hotkeyText }}</div>
        <button class="pin-btn" :class="{ pinned: props.modRef.pinned }" @click.stop="togglePin" :title="pinTitle"
            aria-label="Pin to top">
            <svg viewBox="0 0 24 24" width="18" height="18">
                <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
            </svg>
        </button>
    </div>
</template>

<script setup>
import { useTemplateRef, computed, onMounted, ref } from 'vue';
import IManager from '../../electron/IManager';
const iManager = new IManager();

import { TranslatedText } from '../../helper/Language';
import { DialogHelper, DialogID } from '../../helper/DialogHelper';
import { ModData } from '../../core/ModHelper';
import { selectedModIdSet, toggleModSelection, toggleModPin } from '../../helper/SelectedMods';

const props = defineProps({
    modRef: {
        type: ModData,
        required: true
    },
});

const clicked = computed(() => selectedModIdSet.has(props.modRef.id));
const rowRef = useTemplateRef('rowRef');
const img = ref(null);

const hotkeyText = computed(() =>
    (props.modRef.hotkeys || []).map(h => `${h.description}->${h.key}`).join('  ')
);

onMounted(async () => {
    if (props.modRef.preview != null) {
        img.value = await props.modRef.getPreviewBase64(true);
    }
});

const click = () => {
    const newClicked = toggleModSelection(iManager.data.modList || [], props.modRef);
    // Đồng bộ thuộc tính DOM ngay để CSS [clicked="true"] đọc đúng giá trị
    // mới (binding :clicked của Vue chỉ cập nhật ở tick sau).
    rowRef.value.setAttribute('clicked', newClicked);
    iManager.setCurrentMod(props.modRef);
    iManager.toggledModByName(props.modRef.name);
};

const openEditModDialog = () => {
    iManager.setCurrentMod(props.modRef);
    DialogHelper.showDialog(DialogID.editModDialog);
};

const pinTitle = computed(() => props.modRef.pinned
    ? new TranslatedText('Unpin', 'Bỏ ghim').get()
    : new TranslatedText('Pin to top', 'Ghim lên đầu').get());

const togglePin = async () => {
    await toggleModPin(props.modRef);
};

defineExpose({
    click,
});
</script>

<style>
.mod-list-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 72px;
    padding: 4px 12px;
    box-sizing: border-box;
    border-radius: 12px;
    background-color: var(--s-color-surface-container-low);
    border: 1px solid transparent;
    cursor: pointer;
    user-select: none;
}

.mod-list-row[clicked="true"] {
    border: 5px solid transparent;
    background-clip: padding-box, border-box;
    background-origin: padding-box, border-box;
    background-image: linear-gradient(to right, var(--s-color-surface-container-low), var(--s-color-surface-container-low)), linear-gradient(90deg, var(--s-color-primary), var(--s-color-secondary));
}

.mod-list-row .row-thumb {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--s-color-surface-container-high);
}

.mod-list-row .row-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    -webkit-user-drag: none;
}

.mod-list-row .row-thumb-empty {
    width: 100%;
    height: 100%;
}

.mod-list-row .row-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
}

.mod-list-row .row-character {
    flex-shrink: 0;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--s-color-on-surface-variant);
}

.mod-list-row .row-hotkeys {
    flex-shrink: 0;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--s-color-on-surface-variant);
    font-size: 0.85em;
}

.mod-list-row .pin-btn {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: var(--s-color-on-surface-variant);
    opacity: 0.55;
}

.mod-list-row .pin-btn:hover {
    opacity: 1;
    background: var(--s-color-surface-container-high);
}

.mod-list-row .pin-btn.pinned {
    opacity: 1;
    color: var(--s-color-primary);
}

.mod-list-row .pin-btn svg {
    fill: currentColor;
}
</style>
