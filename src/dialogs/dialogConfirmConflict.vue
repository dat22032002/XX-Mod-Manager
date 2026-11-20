<!-- Cảnh báo trước khi Apply khi 2 mod đang bật cùng thay 1 thứ của game.
     Nút Apply mở hộp này; bấm Vẫn áp dụng thì bắn sự kiện
     applyConflictsConfirmed, nút Apply lắng nghe rồi mới áp dụng thật.
     Bấm Hủy thì hộp đóng, không áp dụng gì. -->
<template>
    <dialogTemplate id="dialog-confirm-conflict" type="block">
        <template v-slot:content>
            <h1 style="z-index: 1;">{{ $t('conflictDialog.title') }}</h1>
            <p style="z-index: 1; text-align: center;">{{ $t('conflictDialog.message') }}</p>
            <!-- Danh sách gộp theo cặp mod (1 dòng 1 cặp) + cao tối đa
                 300px, dài hơn thì lăn dọc — Đạt báo 20/11: 2 mod đụng 16
                 hình thì hộp liệt kê 16 dòng, kéo dài quá màn hình. -->
            <ul style="z-index: 1; text-align: left; margin: 8px 0 0 0; padding-left: 20px; max-height: 300px; overflow-y: auto;">
                <li v-for="(g, i) in groupedConflicts" :key="i">{{ groupText(g) }}</li>
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
import { ref, computed, onMounted } from 'vue';

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

// Gộp các lần đụng của cùng 1 cặp mod thành 1 dòng: khóa gộp xếp id
// theo thứ tự để A|B và B|A là 1 cặp (modA/modB tùy thứ tự quét).
const groupedConflicts = computed(() => {
    const groups = new Map();
    for (const c of conflicts.value) {
        const key = [c.modA.id, c.modB.id].sort().join('|');
        let g = groups.get(key);
        if (!g) {
            g = { modA: c.modA, modB: c.modB, count: 0, first: c };
            groups.set(key, g);
        }
        g.count++;
    }
    return [...groups.values()];
});

function conflictText(c) {
    const key = c.type === 'shader' ? 'conflictDialog.itemShader' : 'conflictDialog.itemTexture';
    return t(key, { modA: c.modA.name, modB: c.modB.name, hash: c.hash });
}

// 1 cặp đụng 1 chỗ thì giữ dòng chi tiết cũ (kèm mã); đụng nhiều chỗ
// thì 1 dòng gộp ghi số lượng, không liệt kê từng mã nữa.
function groupText(g) {
    if (g.count === 1) return conflictText(g.first);
    return t('conflictDialog.itemGroup', { modA: g.modA.name, modB: g.modB.name, count: g.count });
}

function handleApplyAnyway() {
    iManager.trigger('applyConflictsConfirmed');
}
</script>
