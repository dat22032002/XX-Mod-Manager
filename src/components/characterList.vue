<!-- Danh sách nhân vật dọc dưới khung preset (thay hàng chip ngang đã
     bỏ) — giờ là nơi gom HẾT cụm lọc của tab Mod: ô tìm kiếm + nút Bộ
     lọc + Tất cả / Đã chọn + bảng lọc (Đạt dặn 21/11, dời dần từng món
     từ hàng trên xuống đây vì chúng cùng họ với chọn nhân vật, để chung
     1 chỗ thì nhìn là biết đang lọc gì). Bấm tên là lọc lưới mod theo
     nhân vật đó. Hàng đang chọn nền vàng. Số trong ngoặc là số mod của
     nhân vật (theo công tắc "Hiện số lượng mod" trong bảng lọc). -->
<template>
    <div class="character-list OO-box">
        <!-- Khối đầu cố định (không lăn): tiêu đề + hàng tìm kiếm/Bộ lọc
             + hàng Tất cả/Đã chọn + bảng lọc thả xuống. position relative
             để bảng lọc (absolute) neo theo đây, bung ra ngay dưới khối. -->
        <div class="character-list-top">
            <div class="character-list-header">
                <div class="character-list-title">{{ $t('filter.characters') }}</div>
            </div>
            <!-- Hàng tìm kiếm + Bộ lọc: ô tìm kiếm bên trái, nút Bộ lọc
                 bên phải (Đạt dặn 21/11). 4 món (tìm kiếm + Bộ lọc +
                 Tất cả + Đã chọn) chung 1 hàng thì ô tìm kiếm còn ~40px,
                 không gõ được — nên tách 2 hàng: hàng này tìm kiếm +
                 Bộ lọc, hàng dưới Tất cả + Đã chọn. -->
            <div class="character-list-searchrow">
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
                <!-- Nút Bộ lọc: bấm vào thì bảng lọc hiện ra dưới dạng
                     overlay phủ lên danh sách + lưới mod (không đẩy nội
                     dung xuống). Nút vàng lên khi bảng đang mở hoặc đang
                     có lọc/xếp khác mặc định — nhìn là biết lưới đang bị
                     lọc dù bảng đã đóng. -->
                <div id="filter-toggle-chip" class="filter-toggle" :class="{ active: hasActiveFilter, open: panelOpen }" @click="panelOpen = !panelOpen">
                    <div class="filter-toggle-inner">
                        <s-icon>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"></path>
                            </svg>
                        </s-icon>
                        <span>{{ $t('filter.button') }}</span>
                        <span class="filter-toggle-chevron">▼</span>
                    </div>
                </div>
            </div>
            <!-- Tất cả / Đã chọn: chung 1 hàng, mỗi bên một nửa, cố định
                 trên cùng ngoài khung lăn nên không trôi đi khi lăn danh
                 sách. Giữ nguyên id để probe cũ vẫn tìm được mà bấm. Số
                 trong ngoặc: Tất cả = tổng số mod, Đã chọn = số mod đang
                 chọn (đọc thẳng từ tập chọn, mới mỗi lần vẽ lại). Hàng Tất
                 cả vàng cả khi chưa chọn gì (currentCharacter = null lúc
                 mới mở app — lưới lúc đó hiện tất cả, giống luật
                 filteredMods coi trống là 'all'). -->
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
            <!-- Lớp bắt bấm trong suốt phủ cả màn hình khi bảng đang mở:
                 bấm ra ngoài bảng thì đóng bảng. Nằm dưới nút và bảng
                 (z-index) nên không chặn 2 cái đó. -->
            <div class="filter-backdrop" v-show="panelOpen" @click="panelOpen = false"></div>
            <!-- Bảng lọc xếp dọc (Đạt dặn 21/11 — bản 2 cột vẫn chưa gọn:
                 cột loại ngắn hơn cột xếp nên thừa khoảng trống dưới cột
                 loại, nhìn lệch): loại mod ở trên, sắp xếp ở dưới, chip
                 xếp lưới 2 hàng mỗi nhóm, chip đang chọn nền vàng (giống
                 hàng nhân vật) thay cho thanh trượt — thanh trượt chỉ
                 chạy được trên 1 hàng ngang nên bảng hẹp không dùng được
                 nó. Bảng rộng cố định 460px để chip tự xuống hàng (bảng
                 ôm vừa nội dung mà không khóa rộng thì chip lại trải
                 1 hàng như cũ). Bấm chip thì bảng ở lại mở để chọn tiếp
                 nhóm còn lại; bấm nút hoặc bấm ra ngoài thì đóng. Dùng
                 v-show để chip không bị gắn lại khi đóng bảng. -->
            <div class="filter-panel" v-show="panelOpen">
                <div class="filter-grid">
                    <div class="filter-group">
                        <div class="filter-group-label">{{ $t('filter.typeGroup') }}</div>
                        <!-- Chip chia 2 hàng cố định (4+3), chip trong mỗi
                             hàng rộng bằng nhau (flex: 1 1 0) — Đạt dặn
                             21/11: không cái quá dài, cái quá ngắn. Hàng 1
                             4 chip ~95px, hàng 2 3 chip ~129px. -->
                        <div class="filter-chips">
                            <div class="filter-chip-row">
                                <div v-for="(item, i) in typeItems.slice(0, 4)" :key="item" class="filter-chip"
                                    :class="{ active: currentType === item }" @click="handleTypeChange(item)">{{ translatedTypes[i] }}</div>
                            </div>
                            <div class="filter-chip-row">
                                <div v-for="(item, i) in typeItems.slice(4)" :key="item" class="filter-chip"
                                    :class="{ active: currentType === item }" @click="handleTypeChange(item)">{{ translatedTypes[i + 4] }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="filter-group">
                        <div class="filter-group-label">{{ $t('filter.sortGroup') }}</div>
                        <div class="filter-chips">
                            <div class="filter-chip-row">
                                <div v-for="(item, i) in sortItems.slice(0, 4)" :key="item" class="filter-chip"
                                    :class="{ active: currentSort === item }" @click="handleSortChange(item)">{{ translatedSorts[i] }}</div>
                            </div>
                            <div class="filter-chip-row">
                                <div v-for="(item, i) in sortItems.slice(4)" :key="item" class="filter-chip"
                                    :class="{ active: currentSort === item }" @click="handleSortChange(item)">{{ translatedSorts[i + 4] }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Công tắc ẩn/hiện số lượng mod trên chip (Đạt dặn 20/11):
                     nằm ẩn trong bảng lọc thay vì nút # trên thanh lọc. Bật
                     thì mỗi chip nhân vật hiện thêm số mod trong ngoặc,
                     vd Ellen (24). :checked lấy trạng thái đã lưu từ config;
                     @change tự lật config qua Proxy (công tắc Sober tự đổi
                     trạng thái hiển thị khi bấm, giống công tắc gọn ở thanh
                     dưới — không dùng v-model vào ref config vì v-model ghi
                     thẳng vào ref, file config không đổi theo). -->
                <div class="counts-wrap">
                    <span class="counts-label">{{ $t('filter.showCounts') }}</span>
                    <s-switch id="chip-counts-switch" :checked="showChipCounts" @change="toggleChipCounts"></s-switch>
                </div>
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
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { MOD_TAGS, normalizeTypeFilter } from '../../helper/ModTag';
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
// ĐỌC e.target.value, KHÔNG đọc ref searchInput: Vue v-model không cập
// nhật ref trong lúc bộ gõ tiếng Việt đang giữ chữ chưa chốt
// (composition), nên đọc ref thì lúc gõ bằng bộ gõ Telex app nhận giá
// trị cũ, phải bấm Enter chốt chữ thì tìm kiếm mới chạy — đúng lỗi Đạt
// báo 21/11 ("phải bấm enter mới tìm dc"). Bản gốc cũng đọc
// e.target.value, y hệt thế này.
const searchInput = ref('');
const handleSearchInput = (e) => {
    emit('search', e.target.value);
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

//-==================== Nút Bộ lọc + bảng lọc ====================//
// (Dời từ modCharacterFilter.vue sang đây 21/11 — component đó giờ trống
// nên xóa hẳn. Nút + bảng từng Teleport lên hàng trên; giờ nằm thẳng
// trong khối đầu danh sách nên không cần Teleport nữa.)
// Nút Bộ lọc: bảng overlay bung hay đóng — trạng thái chỉ trong phiên
// làm việc (mở app lại thì bảng đóng, như mọi bảng thả xuống). Nút vàng
// lên khi đang có lọc theo loại hoặc xếp khác mặc định — nhìn là biết
// lưới đang bị lọc dù bảng đã đóng.
const panelOpen = ref(false);
const hasActiveFilter = computed(() =>
    g_config_vue.modTypeFilter.value !== 'all' || g_config_vue.modSortBy.value !== 'default');

// Tag mod (ModTag): Character, Skin, Weapon, Effect, Accessory, ETC —
// chuẩn phân loại duy nhất từ 1.5.18, thay tiền tố tên thư mục. Thêm
// tag mới thì thêm vào MOD_TAGS + 1 khóa locale modTag.* + 1 dòng vào
// TYPE_LABEL_KEYS dưới đây. Lựa chọn lưu trong config (modCardManager
// đọc để lọc/xếp danh sách).
const TYPE_ITEMS = ['all', ...MOD_TAGS];
const TYPE_LABEL_KEYS = {
    all: 'filter.allTypes',
    character: 'modTag.character',
    skin: 'modTag.skin',
    weapon: 'modTag.weapon',
    effect: 'modTag.effect',
    accessory: 'modTag.accessory',
    etc: 'modTag.etc',
};
const SORT_OPTIONS = [
    { value: 'default', labelKey: 'filter.sortDefault' },
    { value: 'name-asc', labelKey: 'filter.sortNameAsc' },
    { value: 'name-desc', labelKey: 'filter.sortNameDesc' },
    { value: 'time-desc', labelKey: 'filter.sortTimeDesc' },
    { value: 'time-asc', labelKey: 'filter.sortTimeAsc' },
    { value: 'size-desc', labelKey: 'filter.sortSizeDesc' },
    { value: 'size-asc', labelKey: 'filter.sortSizeAsc' },
];
const SORT_VALUES = SORT_OPTIONS.map(o => o.value);

const { t } = useI18n();
const typeItems = TYPE_ITEMS;
const sortItems = SORT_VALUES;
const translatedTypes = computed(() => TYPE_ITEMS.map(item => t(TYPE_LABEL_KEYS[item])));
const translatedSorts = computed(() => SORT_OPTIONS.map(o => t(o.labelKey)));

// Lựa chọn đang bật (để vàng chip tương ứng trong bảng): loại chuẩn hóa
// qua normalizeTypeFilter (config cũ còn 'outfit'), xếp lạ thì về
// 'default'. Nhãn chip dịch lại tự động khi đổi ngôn ngữ (computed theo
// t) nên không cần đo lại gì như thanh trượt cũ.
const currentType = computed(() => normalizeTypeFilter(g_config_vue.modTypeFilter.value));
const currentSort = computed(() => SORT_VALUES.includes(g_config_vue.modSortBy.value) ? g_config_vue.modSortBy.value : 'default');

// Ghi config dồn: bấm lia lịa thì chờ 300ms sau lần bấm cuối mới ghi
// 1 lần (giống cách ghi mức phóng to ở modCardSection).
let saveFilterTimer = null;
function saveFilterSettings() {
    if (saveFilterTimer) clearTimeout(saveFilterTimer);
    saveFilterTimer = setTimeout(() => {
        saveFilterTimer = null;
        iManager.saveConfig();
    }, 300);
}

function handleTypeChange(type) {
    if (!TYPE_ITEMS.includes(type)) return;
    iManager.config.modTypeFilter = type;
    saveFilterSettings();
}

function handleSortChange(sort) {
    if (!SORT_VALUES.includes(sort)) return;
    iManager.config.modSortBy = sort;
    saveFilterSettings();
}

//-=============== Hiện số lượng mod ===============//
// Công tắc trong bảng lọc (Đạt dặn 20/11): bật thì mỗi nhân vật trong
// danh sách dọc hiện thêm số mod trong ngoặc, vd Ellen (24); Tất cả hiện
// tổng số mod, Đã chọn hiện số mod đang bật vàng. Tắt thì về tên trần
// như cũ. Lựa chọn lưu trong config nên mở app lại vẫn nhớ.
// Số đếm theo TOÀN BỘ kho mod (không theo lọc tag/tìm kiếm đang bật)
// để con số ổn định, đúng nghĩa "nhân vật này có bao nhiêu mod".
function toggleChipCounts() {
    iManager.config.showChipCounts = !g_config_vue.showChipCounts.value;
    saveFilterSettings();
}

onMounted(() => {
    // Config cũ còn lưu loại 'outfit' (tên cũ trước khi có tag): đổi 1 lần
    // thành 'character' cho khớp tag mới.
    if (g_config_vue.modTypeFilter.value === 'outfit') {
        iManager.config.modTypeFilter = 'character';
        saveFilterSettings();
    }
});
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

/* Khối đầu cố định: position relative để bảng lọc (absolute) neo theo
   đây; không đặt overflow để bảng bung ra ngoài khung được. */
.character-list-top {
    position: relative;
    flex-shrink: 0;
}

/* Hàng tiêu đề: chỉ còn chữ Characters (ô tìm kiếm đã xuống hàng dưới,
   cạnh nút Bộ lọc). */
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
    font-size: 16px;
}

/* Hàng tìm kiếm + Bộ lọc: ô tìm kiếm chiếm phần còn lại, nút Bộ lọc
   rộng vừa chữ. */
.character-list-searchrow {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-bottom: 6px;
}

/* Ô tìm kiếm: thẳng (không nghiêng như ô cũ ở hàng trên), cùng kiểu
   với hàng nhân vật (nền surface-container-low, bo 8px). */
.character-search {
    flex: 1;
    min-width: 0;
    height: 32px;
    display: flex;
    align-items: center;
    gap: 4px;
    box-sizing: border-box;
    padding: 0 6px;
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
    font-size: 14px;
    padding: 0;
}

/* Nút Bộ lọc: thẳng như ô tìm kiếm (không nghiêng -20° như nút cũ ở
   hàng trên), cao 32px cho ngang ô tìm kiếm. */
.filter-toggle {
    flex-shrink: 0;
    height: 32px;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0 8px;
    border-radius: 8px;
    background-color: var(--s-color-surface-container-low);
    border: 1px solid var(--s-color-outline-variant);
    color: var(--s-color-on-surface);
    cursor: pointer;
    user-select: none;
    /* Nổi trên lớp bắt bấm (z-index 40) để bấm nút vẫn tắt/bật được
       bảng khi bảng đang mở. */
    position: relative;
    z-index: 60;
}

/* Đang có lọc/xếp khác mặc định thì nút vàng như chip đang chọn. */
.filter-toggle.active {
    background-color: var(--s-color-primary);
    border-color: var(--s-color-primary);
    color: var(--s-color-on-primary);
}

/* Bảng đang mở thì nút cũng vàng lên như chip đang chọn (Đạt muốn
   nút đổi màu vàng thay vì hiệu ứng phát sáng — 19/11). Phân biệt
   với nút vàng do đang lọc bằng mũi tên: ▲ là bảng đang mở. */
.filter-toggle.open {
    background-color: var(--s-color-primary);
    border-color: var(--s-color-primary);
    color: var(--s-color-on-primary);
}

.filter-toggle-inner {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.filter-toggle-inner s-icon {
    flex-shrink: 0;
}

/* Mũi tên xoay ngược khi bảng lọc đang bung ra. */
.filter-toggle-chevron {
    font-size: 10px;
    transition: transform 0.2s ease-in-out;
}

.filter-toggle.open .filter-toggle-chevron {
    transform: rotate(180deg);
}

/* Lớp bắt bấm trong suốt phủ cả màn hình khi bảng lọc đang mở: bấm ra
   ngoài bảng thì đóng bảng. Nằm dưới nút (60) và bảng (50) nên không
   chặn 2 cái đó. */
.filter-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: transparent;
}

/* Bảng lọc overlay: thả xuống từ khối đầu danh sách, phủ lên danh sách
   + lưới mod chứ không đẩy nội dung. Mép trái thẳng với mép trái khối
   đầu (tức mép trong khung danh sách). Rộng 420px (nội dung 400px) —
   đo thật trên app: hàng chip dài nhất là loại hàng 1 (386,9px) và xếp
   hàng 1 (378,8px), nên 400px vừa đủ cho cả 2 hàng đầy với lề 13–21px;
   hẹp hơn nữa thì hàng 1 vỡ sang 3 hàng, rộng hơn thì bên phải dư
   khoảng trống (Đạt chỉ ra 21/11). Giới hạn để không tràn mép phải cửa
   sổ (mép trái bảng cách mép trái cửa sổ ~13px: cột trái bắt đầu ~10px
   + viền 3px của khung; chừa 10px mép phải); cửa sổ hẹp quá thì bảng
   co theo giới hạn, chip tự xuống thêm hàng. */
.filter-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 420px;
    max-width: calc(100vw - 23px);
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    box-sizing: border-box;
    background-color: var(--s-color-surface-container-low);
    border: 1px solid var(--s-color-outline-variant);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}

/* 2 nhóm xếp dọc: loại mod trên, sắp xếp dưới. Mỗi nhóm rộng hết bảng
   để chip xếp 2 hàng cân nhau. */
.filter-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.filter-group {
    width: 100%;
}

.filter-group-label {
    font-size: 13px;
    font-weight: bolder;
    color: var(--s-color-on-surface-variant);
    padding: 2px 2px 6px;
}

/* Nhóm chip trong bảng: 2 hàng cố định (4+3), xếp dọc, cách nhau 6px.
   Chip trong mỗi hàng rộng bằng nhau — hàng 4 chip ~95px, hàng 3 chip
   ~129px (Đạt dặn 21/11: không cái quá dài, cái quá ngắn). Mỗi hàng
   lấp đầy bề rộng bảng nên không còn khúc trống bên phải. */
.filter-chips {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.filter-chip-row {
    display: flex;
    gap: 6px;
}

/* Chip trong bảng: thẳng (không nghiêng như chip trượt cũ), cùng kiểu
   với hàng nhân vật — chip đang chọn nền vàng. Nền chip dùng
   surface-container-lowest (#323232): theme tối của app đặt tên ngược
   với Material — "lowest" mới là màu sáng nhất, "highest" (#191919) còn
   tối hơn nền bảng (#222222).
   Chip chia đều hàng (flex: 1 1 0, min-width: 0): nhãn dài nhất
   "Newest first" chỉ vừa ô 95px khi cỡ chữ 0.8125rem + đệm ngang 6px
   (đo thật: 0.875rem thì chữ chạm đúng mép ô, máy Đạt vẽ chữ rộng hơn
   chút là tràn) — KHÔNG tăng đệm hay cỡ chữ nếu chưa đo lại, và KHÔNG
   thêm font-weight cho chip đang chọn (chữ đậm rộng hơn sẽ tràn ô;
   nền vàng đã đủ báo đang chọn). */
.filter-chip {
    flex: 1 1 0;
    min-width: 0;
    padding: 6px;
    border-radius: 8px;
    background-color: var(--s-color-surface-container-lowest);
    color: var(--s-color-on-surface);
    font-size: 0.8125rem;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    text-align: center;
}

.filter-chip.active {
    background-color: var(--s-color-primary);
    color: var(--s-color-on-primary);
}

/* Hàng công tắc ẩn/hiện số lượng trong bảng lọc: nhãn trái, công tắc
   phải, cách hàng xếp phía trên 1 khoảng. */
.counts-wrap {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 4px 2px;
    box-sizing: border-box;
}

.counts-label {
    font-size: 0.875rem;
    color: var(--s-color-on-surface);
    white-space: nowrap;
}

/* 2 hàng Tất cả / Đã chọn: chung 1 hàng, mỗi bên một nửa (Đạt dặn
   21/11). Cố định trên cùng, ngoài khung lăn. Vạch ngăn dưới để mắt
   phân biệt "2 hàng đứng yên" với "danh sách lăn". Đệm ngang thu lại
   (8px thay vì 12px như hàng nhân vật) để tên + số còn chỗ — nửa hàng
   chỉ ~98px, tên dài thì tự cắt ngắn, số trong ngoặc vẫn hiện đủ. */
.character-list-fixed {
    flex-shrink: 0;
    display: flex;
    flex-direction: row;
    gap: 4px;
    padding-bottom: 6px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--s-color-outline-variant);
}

.character-list-fixed .character-row {
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
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
    font-size: 14px;
}
</style>
