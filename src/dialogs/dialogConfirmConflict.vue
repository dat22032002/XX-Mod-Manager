<!-- Cảnh báo trước khi Apply khi 2 mod đang bật cùng thay 1 thứ của game.
     Nút Apply mở hộp này; bấm Vẫn áp dụng thì bắn sự kiện
     applyConflictsConfirmed, nút Apply lắng nghe rồi mới áp dụng thật.
     Bấm Hủy thì hộp đóng, không áp dụng gì. -->
<template>
    <dialogTemplate id="dialog-confirm-conflict" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('conflictDialog.title') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ $t('conflictDialog.message') }}</p>
            <ul style="z-index: 1; text-align: left; margin: 8px 0 0 0; padding-left: 20px;">
                <li v-for="(c, i) in conflicts" :key="i">{{ conflictText(c) }}</li>
            </ul>
        </template>
        <template v-slot:action>
            <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" style="margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('buttons.cancel') }}</p>
            </s-button>
            <s-button slot="action" type="text" id="conflict-apply-anyway" @click="handleApplyAnyway"
                class="OO-button font-hongmeng OO-color-gradient" style="color: var(--s-color-dark-surface);margin-left: 20px;
    margin-right: 20px;">
                <p>{{ $t('conflictDialog.applyAnyway') }}</p>
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

const conflicts = ref([]);

// Đọc danh sách đụng nhau lúc hộp mở (nút Apply đã ghi vào temp trước khi
// mở hộp).
onMounted(() => {
    const dialog = document.getElementById('dialog-confirm-conflict');
    dialog?.addEventListener('show', () => {
        conflicts.value = iManager.temp.pendingConflicts || [];
    });
});

function conflictText(c) {
    const key = c.type === 'shader' ? 'conflictDialog.itemShader' : 'conflictDialog.itemTexture';
    return t(key, { modA: c.modA.name, modB: c.modB.name, hash: c.hash });
}

function handleApplyAnyway() {
    iManager.trigger('applyConflictsConfirmed');
}
</script>
