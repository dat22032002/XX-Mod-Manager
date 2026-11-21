<!-- Danh sách nhân vật dọc dưới khung preset (thay hàng chip ngang đã
     bỏ): bấm tên là lọc lưới mod theo nhân vật đó. Hàng đang chọn nền
     vàng như nút Tất cả / Đã chọn. Số trong ngoặc là số mod của nhân
     vật (theo công tắc "Hiện số lượng mod" trong bảng lọc). -->
<template>
    <div class="character-list">
        <div class="character-list-title">{{ $t('filter.characters') }}</div>
        <div class="character-list-rows">
            <div v-for="name in characterList" :key="name" class="character-row"
                :class="{ active: currentCharacter === name }" @click="selectCharacter(name)">
                <span class="character-name">{{ name }}</span>
                <span v-if="showChipCounts" class="character-count">({{ modCountsByCharacter[name] || 0 }})</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import IManager, { g_config_vue, g_data_vue, g_temp_vue } from '../../electron/IManager';
import { EventType, EventSystem } from '../../helper/EventSystem';

const iManager = new IManager();
const emit = defineEmits(['itemChange']);

const characterList = g_data_vue.characterList;
// Hàng vàng theo nhân vật đang chọn — đọc thẳng từ biến dùng chung nên
// đổi lọc từ bất cứ đâu (tìm kiếm, đặt hàng loạt, đổi preset) danh
// sách cũng vàng theo, không cần hàm đồng bộ riêng.
const currentCharacter = g_temp_vue.currentCharacter;
const showChipCounts = g_config_vue.showChipCounts;

// Đếm số mod theo nhân vật (giống cách đếm của hàng chip cũ):
// g_data_vue.modList không đồng bộ nên đếm từ mảng thật; mỗi lần danh
// sách đổi, sự kiện modListChanged tăng version để tính lại.
const modListVersion = ref(0);
EventSystem.on(EventType.modListChanged, () => { modListVersion.value++; });
const modCountsByCharacter = computed(() => {
    void modListVersion.value;
    const counts = {};
    for (const mod of iManager.data.modList) {
        const c = mod.character;
        counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
});

// Bấm hàng: phát lên modCardSection để gọi vào lưới mod (giống hệt bấm
// chip nhân vật cũ: bỏ tìm kiếm đang gõ rồi đổi nhân vật lọc). Bấm lại
// hàng đang chọn thì không làm gì.
const selectCharacter = (name) => {
    if (name === currentCharacter.value) return;
    emit('itemChange', name);
};
</script>

<style scoped>
.character-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    /* Vạch ngăn với khung preset ở trên. */
    border-top: 1px solid var(--s-color-outline-variant);
    margin-top: 8px;
    padding: 8px 10px 0;
}

.character-list-title {
    font-weight: bolder;
    color: var(--s-color-on-surface-variant);
    padding: 0 2px 6px;
    font-size: 0.9rem;
}

.character-list-rows {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 10px;
}

.character-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 36px;
    padding: 6px 12px;
    box-sizing: border-box;
    border-radius: 8px;
    background-color: var(--s-color-surface-container-low);
    color: var(--s-color-on-surface);
    cursor: pointer;
    user-select: none;
}

.character-row.active {
    background-color: var(--s-color-primary);
    color: var(--s-color-on-primary);
    font-weight: bolder;
}

.character-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.character-count {
    flex-shrink: 0;
    opacity: 0.75;
}
</style>
