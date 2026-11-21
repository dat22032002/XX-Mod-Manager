<!-- Danh sách nhân vật dọc dưới khung preset (thay hàng chip ngang đã
     bỏ): bấm tên là lọc lưới mod theo nhân vật đó. Hàng đang chọn nền
     vàng. Tất cả / Đã chọn là 2 hàng CỐ ĐỊNH trên cùng (không lăn theo
     danh sách) — dời từ hàng trên xuống đây vì chúng cùng họ với chọn
     nhân vật ("cho xem mod nào"). Số trong ngoặc là số mod của nhân
     vật (theo công tắc "Hiện số lượng mod" trong bảng lọc). -->
<template>
    <div class="character-list OO-box">
        <!-- Hàng tiêu đề: chữ Characters + ô tìm kiếm cạnh bên (Đạt dặn
             21/11). Ô tìm kiếm vốn ở hàng trên — dời xuống đây vì nó tìm
             theo TÊN NHÂN VẬT (khớp đầu tên, đúng 1 nhân vật mới lọc),
             không tìm tên mod. -->
        <div class="character-list-header">
            <div class="character-list-title">{{ $t('filter.characters') }}</div>
            <div class="character-search">
                <s-icon>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                        <path
                            d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z">
                        </path>
                    </svg>
                </s-icon>
                <input id="search-input" type="text" v-model="searchInput" @input="handleSearchInput" />
            </div>
        </div>
        <!-- Tất cả / Đã chọn: 2 hàng cố định trên cùng, ngoài khung lăn
             nên không trôi đi khi lăn danh sách. Giữ nguyên id để probe
             cũ vẫn tìm được mà bấm. Số trong ngoặc: Tất cả = tổng số
             mod, Đã chọn = số mod đang chọn (đọc thẳng từ tập chọn,
             mới mỗi lần vẽ lại). Hàng Tất cả vàng cả khi chưa chọn gì
             (currentCharacter = null lúc mới mở app — lưới lúc đó hiện
             tất cả, giống luật filteredMods coi trống là 'all'). -->
        <div class="character-list-fixed">
            <div id="all-filter-chip" class="character-row" :class="{ active: currentCharacter === 'all' || !currentCharacter }" @click="selectCharacter('all')">
                <span class="character-name">{{ $t('buttons.all') }}</span>
                <span v-if="showChipCounts" class="character-count">({{ totalModCount }})</span>
            </div>
            <div id="selected-filter-chip" class="character-row" :class="{ active: currentCharacter === 'selected' }" @click="selectCharacter('selected')">
                <span class="character-name">{{ $t('buttons.selected') }}</span>
                <span v-if="showChipCounts" class="character-count">({{ selectedModIdSet.size }})</span>
            </div>
        </div>
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
import { ref, computed, watch } from 'vue';
import IManager, { g_config_vue, g_data_vue, g_temp_vue } from '../../electron/IManager';
import { EventType, EventSystem } from '../../helper/EventSystem';
import { selectedModIdSet } from '../../helper/SelectedMods';

const iManager = new IManager();
const emit = defineEmits(['itemChange', 'search']);

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

// Tổng số mod (số trong ngoặc của hàng Tất cả).
const totalModCount = computed(() => {
    void modListVersion.value;
    return iManager.data.modList.length;
});

// Ô tìm kiếm (dời từ hàng trên xuống đây): gõ thì phát chữ lên
// modCardSection để lọc — khớp đầu tên nhân vật, đúng 1 nhân vật mới
// lọc (luật ở filteredMods, không đổi). Xóa hết chữ thì phát '' để
// lưới về Tất cả (nhánh blank của applySearch).
const searchInput = ref('');
const handleSearchInput = () => {
    emit('search', searchInput.value);
};

// Chữ tìm kiếm cũ phải xóa khi lọc đổi sang chỗ khác, không thì ô vẫn
// hiện chữ cũ trong khi lưới đang lọc theo cái khác: bấm hàng thì xóa
// ở selectCharacter dưới; lọc đổi sang Tất cả / Đã chọn từ bên ngoài
// (vd xóa hết chữ tìm kiếm, đổi preset) thì currentCharacter đổi thành
// 'all'/'selected' — xóa ở đây. Đổi sang tên nhân vật thì KHÔNG xóa
// (đó có thể là do đang gõ tìm).
watch(currentCharacter, (val) => {
    if (val === 'all' || val === 'selected') searchInput.value = '';
});

// Bấm hàng: phát lên modCardSection để gọi vào lưới mod (giống hệt bấm
// chip nhân vật cũ: bỏ tìm kiếm đang gõ rồi đổi nhân vật lọc). Bấm lại
// hàng đang chọn thì không làm gì.
const selectCharacter = (name) => {
    if (name === currentCharacter.value) return;
    searchInput.value = '';
    emit('itemChange', name);
};
</script>

<style scoped>
.character-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    /* Khung giống hệt khung preset (OO-box: viền 3px + đệm 10px +
       bo 20px). border-box để tổng rộng = đúng rộng cột 226px, không
       lòi sang phải như khung preset từng bị. Đệm của OO-box thay cho
       padding riêng; vạch ngăn cũ bỏ vì đã có khung. */
    box-sizing: border-box;
    margin-top: 8px;
}

/* Hàng tiêu đề: chữ Characters + ô tìm kiếm cạnh bên. */
.character-list-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 6px;
}

.character-list-title {
    flex-shrink: 0;
    font-weight: bolder;
    color: var(--s-color-on-surface-variant);
    padding: 0 2px;
    font-size: 0.9rem;
}

/* Ô tìm kiếm: thẳng (không nghiêng như ô cũ ở hàng trên), cùng kiểu
   với hàng nhân vật (nền surface-container-low, bo 8px). */
.character-search {
    flex: 1;
    min-width: 0;
    height: 32px;
    display: flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    padding: 0 8px;
    border-radius: 8px;
    background-color: var(--s-color-surface-container-low);
    color: var(--s-color-on-surface);
}

.character-search:focus-within {
    outline: 1px solid var(--s-color-primary);
}

.character-search s-icon {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
}

.character-search input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--s-color-on-surface);
    font-size: 0.9rem;
    padding: 0;
}

/* 2 hàng Tất cả / Đã chọn: cố định trên cùng, ngoài khung lăn. Vạch
   ngăn dưới để mắt phân biệt "2 hàng đứng yên" với "danh sách lăn". */
.character-list-fixed {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 6px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--s-color-outline-variant);
}

.character-list-rows {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    /* Chặn lăn chuột "tràn" ra ngoài: lăn tới cuối danh sách thì dừng
       ở đó, không kéo cả cửa sổ app trượt lên (trang app vốn lăn
       được, scrollIntoView từng kéo cả hàng trên trôi khỏi màn hình). */
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 4px;
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
