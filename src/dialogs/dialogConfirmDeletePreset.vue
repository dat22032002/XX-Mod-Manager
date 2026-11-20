<!-- Hỏi xác nhận trước khi xóa preset đang chọn: ghi rõ tên preset +
     hậu quả (không hoàn tác được). Nút thùng rác ở thanh preset mở hộp
     này; bấm Xác nhận thì xóa file preset rồi quay về preset Mặc định. -->
<template>
    <dialogTemplate id="dialog-confirm-delete-preset" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('deletePresetDialog.title') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ confirmMessage }}</p>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.cancel') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="delete-preset-confirm" @click="handleConfirmDelete"
                class="OO-button font-hongmeng OO-color-gradient" style="color: var(--s-color-dark-surface);margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.confirm') }}</p>
            </s-button>
        </template>
    </dialogTemplate>
</template>

<script setup>
import dialogTemplate from './dialogTemplate.vue';
import { ref, onMounted } from 'vue';

import IManager from '../../electron/IManager';
const iManager = new IManager();

import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const confirmMessage = ref('');

// Đọc tên preset đang chọn lúc hộp mở. Preset Mặc định không xóa được
// (nút đã mờ đi) nên hộp không bao giờ mở với preset đó; chốt chặn
// thêm ở đây để lỡ mở thì thông báo trống, không xóa nhầm.
onMounted(() => {
    const dialog = document.getElementById('dialog-confirm-delete-preset');
    dialog?.addEventListener('show', () => {
        const name = iManager.temp.currentPreset;
        confirmMessage.value = (!name || name === 'default')
            ? ''
            : t('deletePresetDialog.message', { name });
    });
});

function handleConfirmDelete() {
    iManager.deletePreset(iManager.temp.currentPreset);
}
</script>
