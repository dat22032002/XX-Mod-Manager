<!-- Hỏi xác nhận trước khi xóa mod (TC8): ghi rõ tên mod + hậu quả.
     Plugin deleteModPlugin mở hộp này; bấm Xác nhận thì bắn sự kiện
     deleteModConfirmed, plugin lắng nghe rồi mới xóa thật. -->
<template>
    <dialogTemplate id="dialog-confirm-delete-mod" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('deleteModDialog.title') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ confirmMessage }}</p>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.cancel') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="delete-confirm" @click="handleConfirmDelete"
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

// Đọc tên mod + chế độ thùng rác lúc hộp mở (currentMod là mod đang sửa,
// plugin đã kiểm tra khác null trước khi mở hộp).
onMounted(() => {
    const dialog = document.getElementById('dialog-confirm-delete-mod');
    dialog?.addEventListener('show', () => {
        const mod = iManager.temp.currentMod;
        if (!mod) {
            confirmMessage.value = '';
            return;
        }
        // Mặc định của plugin là dùng thùng rác; chỉ khi tắt rõ ràng mới xóa vĩnh viễn.
        const useRecycleBin = iManager.getPluginData('deleteModPlugin', 'useRecycleBin') !== false;
        confirmMessage.value = useRecycleBin
            ? t('deleteModDialog.messageRecycle', { name: mod.name })
            : t('deleteModDialog.messagePermanent', { name: mod.name });
    });
});

function handleConfirmDelete() {
    iManager.trigger('deleteModConfirmed');
}
</script>
