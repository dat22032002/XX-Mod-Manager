<!-- Hỏi xác nhận trước khi xóa hết bản sao lưu của Mod Fixer:
     ghi rõ số lượng + dung lượng, xóa rồi không khôi phục được.
     Trang Cài đặt mở hộp này; bấm Xác nhận thì hộp tự xóa + cập
     nhật số đếm trong fixerState + báo snack. -->
<template>
    <dialogTemplate id="dialog-confirm-cleanup-fixer-backups" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('fixer.cleanupTitle') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ confirmMessage }}</p>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.cancel') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="cleanup-confirm" @click="handleConfirmCleanup"
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

import { fixerState } from '../../helper/FixerHelper';
import { formatModSize } from '../../helper/ModSizeScanner';
import { snack } from '../../helper/SnackHelper.ts';

const confirmMessage = ref('');

// Đọc số lượng + dung lượng lúc hộp mở (đếm lại từ đĩa, không dùng
// số đếm đã lưu — bản sao lưu có thể đổi từ lần đếm trước).
onMounted(() => {
    const dialog = document.getElementById('dialog-confirm-cleanup-fixer-backups');
    dialog?.addEventListener('show', () => {
        const info = iManager.fixerBackupInfo();
        confirmMessage.value = t('fixer.cleanupConfirm', { count: info.count, size: formatModSize(info.bytes) });
    });
});

function handleConfirmCleanup() {
    const { deleted } = iManager.fixerDeleteBackups();
    fixerState.backupCount = 0;
    fixerState.backupBytes = 0;
    iManager.dismissDialog('dialog-confirm-cleanup-fixer-backups');
    snack(t('fixer.cleanupDone', { count: deleted }));
}
</script>
