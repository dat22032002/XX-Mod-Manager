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
             + hàng Tất cả/Đã chọn. Bảng lọc neo theo hàng tìm kiếm
             (position relative ở .character-list-searchrow), bung ra
             ngay dưới nút Bộ lọc, phủ lên hàng Tất cả/Đã chọn. -->
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
            <!-- Bảng lọc xếp dọc, hẹp (Đạt dặn 21/11): neo ngay dưới
                 hàng tìm kiếm/Bộ lọc (cách đáy nút Bộ lọc ~14px thay vì
                 ~48px như trước — trước đây neo dưới cả khối đầu nên
                 cách nút 1 hàng Tất cả/Đã chọn; giờ bảng mở ra phủ lên
                 hàng Tất cả/Đã chọn). Rộng 226px = đúng rộng cột danh
                 sách, mép trái/phải thẳng khung cột. Hàng đầu mỗi nhóm
                 1 chip full hàng (All types / Default — dài nhất), 3
                 hàng dưới 2 chip 1 hàng (2 nút dưới cùng ETC /
                 Smallest first dài như mấy nút kia). Bấm chip thì bảng
                 ở lại mở để chọn tiếp nhóm còn lại; bấm nút, bấm ra
                 ngoài, hoặc rê chuột ra khỏi bảng thì đóng (Đạt dặn
                 21/11: tự đóng khi rê chuột ra khỏi bảng). Dùng v-show
                 để chip không bị gắn lại khi đóng bảng. -->
            <!-- Hiệu ứng mở/đóng bảng (Đạt duyệt 21/11): mờ dần + trượt
                 xuống ~150ms. Bảng dùng v-show (bật/tắt display) nên
                 transition CSS thuần không chạy được — phải bọc bằng Vue
                 <Transition> (Vue tự giữ bảng trong DOM tới khi chạy xong
                 hiệu ứng đóng rồi mới ẩn). Bấm chip giữa lúc bảng đang mở
                 vẫn ăn vì bảng đã ở vị trí cuối từ đầu, chỉ độ mờ chạy. -->
            <Transition name="filter-panel">
            <div class="filter-panel" v-show="panelOpen" @mouseleave="panelOpen = false">
                <div class="filter-grid">
                    <div class="filter-group">
                        <div class="filter-group-label">{{ $t('filter.typeGroup') }}</div>
                        <div class="filter-chips">
                            <div v-for="row in CHIP_ROWS" :key="'t' + row[0]" class="filter-chip-row">
                                <div v-for="i in row" :key="typeItems[i]" class="filter-chip"
                                    :class="{ active: currentType === typeItems[i] }" @click="handleTypeChange(typeItems[i])">{{ translatedTypes[i] }}</div>
                            </div>
                        </div>
                    </div>
                    <div class="filter-group">
                        <div class="filter-group-label">{{ $t('filter.sortGroup') }}</div>
                        <div class="filter-chips">
                            <div v-for="row in CHIP_ROWS" :key="'s' + row[0]" class="filter-chip-row">
                                <div v-for="i in row" :key="sortItems[i]" class="filter-chip"
                                    :class="{ active: currentSort === sortItems[i] }" @click="handleSortChange(sortItems[i])">{{ translatedSorts[i] }}</div>
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
            </Transition>
            </div>
            <!-- Tất cả / Đã chọn DẠNG TRƯỢT (Đạt dặn 23/11): 1 khung viên
                 nang, viên vàng trượt qua lại giữa 2 bên khi bấm — dùng
                 thẳng component sectionSelector như nút Dọc/Ngang (viên
                 vàng + kiểu trượt y hệt, không tự vẽ lại). Số đếm giữ
                 trong nhãn, cập nhật theo thời gian thực như nút cũ.
                 Khi đang chọn 1 nhân vật cụ thể thì modelValue là tên
                 nhân vật, không khớp mục nào nên viên vàng ẩn đi (không
                 đậu sai chỗ gây hiểu nhầm). Bấm vẫn gọi selectCharacter
                 như cũ nên hành vi lọc không đổi. Giữ nguyên hàng cố
                 định trên cùng ngoài khung lăn nên không trôi đi khi lăn
                 danh sách. -->
            <div class="character-list-fixed">
                <sectionSelector id="all-selected-slider" :sections="ALL_SELECTED_SECTIONS" :labels="allSelectedLabels" :modelValue="currentCharacter || 'all'" :compact="true" @update:modelValue="selectCharacter" />
            </div>
            <!-- Lớp bắt bấm trong suốt phủ cả màn hình khi bảng đang mở:
                 bấm ra ngoài bảng thì đóng bảng. Nằm dưới nút và bảng
                 (z-index) nên không chặn 2 cái đó. -->
            <div class="filter-backdrop" v-show="panelOpen" @click="panelOpen = false"></div>
        </div>
        <div class="character-list-rows" @mouseleave="hoveredIndex = null">
            <div v-for="(name, i) in characterList" :key="name" class="character-row"
                :class="{ active: currentCharacter === name }" :data-arrow="arrowLevel(i)" @click="selectCharacter(name)"
                @mouseenter="hoveredIndex = i">
                <!-- Tên dùng font nút Apply (font-hongmeng, phương án A
                     Đạt chọn 22/11): chữ đậm/to bản lấp đầy hàng, hàng
                     không còn trông trống. Đánh đổi Đạt đã chấp nhận:
                     tên dài nhất Alexandrina cắt thành "Alexandr…" ở
                     hàng xa (3/4), rê chuột vào hàng thì phóng full
                     nên tên hiện đủ. Số đếm giữ font mặc định. -->
                <span class="character-name font-hongmeng">{{ name }}</span>
                <span v-if="showChipCounts" class="character-count">({{ modCountsByCharacter[name] || 0 }})</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import sectionSelector from './sectionSelector.vue';
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

// Hình mũi tên (Đạt duyệt mockup 21/11, sửa theo ý Đạt 23/11): hàng
// nhân vật thu hẹp theo khoảng cách từ MỐC — mốc dài nhất (full),
// 2 hàng kề dài vừa (5/6), còn lại 3/4. Mốc là hàng đang RÊ CHUỘT
// (hoveredIndex) nếu có, không thì hàng đang chọn — nên rê chuột tới
// hàng nào thì CẢ MŨI TÊN dời theo hàng đó như khi bấm chọn; rê ra
// khỏi danh sách thì mũi tên quay về hàng đang chọn thật. Chưa chọn
// nhân vật nào (Tất cả/Đã chọn) VÀ không rê hàng nào thì mọi hàng đều 3/4.
const hoveredIndex = ref(null);
const arrowLevel = (i) => {
    const sel = characterList.value.indexOf(currentCharacter.value);
    const anchor = hoveredIndex.value !== null ? hoveredIndex.value : sel;
    if (anchor < 0) return 2;
    const d = Math.abs(i - anchor);
    return d === 0 ? 0 : d === 1 ? 1 : 2;
};

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

// Nút "Xóa bộ lọc" trên màn hình trống gọi qua đây (modCardSection
// chuyển tiếp từ modCardManager): xóa chữ trong ô tìm — watcher
// currentCharacter không chạy được trường hợp này (lúc gõ tìm không ra
// mod nào, nhân vật vẫn đang là Tất cả nên đặt lại Tất cả không đổi).
const clearSearchInput = () => {
    searchInput.value = '';
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

// Tự đoán nhân vật lúc nhập mod mới (Đạt dặn 22/11): luồng nhập bắn
// fillSearch kèm tên nhân vật đoán được — điền vào ô tìm kiếm + phát
// tìm kiếm để lưới lọc sang nhân vật đó.
EventSystem.on(EventType.fillSearch, (character) => {
    if (!character) return;
    searchInput.value = character;
    emit('search', character);
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

// Hàng chip trong bảng lọc dọc: hàng đầu mỗi nhóm 1 chip full hàng
// (All types / Default — lựa chọn mặc định, dài nhất), 3 hàng dưới
// 2 chip 1 hàng (Đạt dặn 21/11: 2 nút dưới cùng ETC / Smallest first
// để dài như mấy nút kia, không giãn full hàng).
const CHIP_ROWS = [[0], [1, 2], [3, 4], [5, 6]];

const { t } = useI18n();
const typeItems = TYPE_ITEMS;
const sortItems = SORT_VALUES;
const translatedTypes = computed(() => TYPE_ITEMS.map(item => t(TYPE_LABEL_KEYS[item])));
const translatedSorts = computed(() => SORT_OPTIONS.map(o => t(o.labelKey)));

// Nhãn nút trượt Tất cả/Đã chọn (Đạt dặn 23/11): tên + số đếm tách
// riêng (tên cắt … khi dài, số đếm giữ nguyên) — số đếm chỉ hiện khi
// công tắc "Hiện số lượng mod" đang bật, giống nút cũ. Số đọc thẳng từ
// tập chọn/tổng mod nên cập nhật theo thời gian thực.
const ALL_SELECTED_SECTIONS = ['all', 'selected'];
const allSelectedLabels = computed(() => [
    { name: t('buttons.all'), count: showChipCounts.value ? `(${totalModCount.value})` : '' },
    { name: t('buttons.selected'), count: showChipCounts.value ? `(${selectedModIdSet.size})` : '' },
]);

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

defineExpose({ clearSearchInput });
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
    /* position: relative: neo cho bảng lọc (absolute) thả ngay dưới
       hàng này, sát nút Bộ lọc (Đạt dặn 21/11). */
    position: relative;
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

/* Bảng lọc overlay: thả xuống từ hàng tìm kiếm/Bộ lọc, phủ lên hàng
   Tất cả/Đã chọn + danh sách chứ không đẩy nội dung. Rộng 226px =
   đúng rộng cột danh sách; left: -13px để mép trái/phải thẳng khung
   cột (khung lùi vào 13px do viền 3px + đệm 10px). Chip 2 cái 1 hàng
   (nội dung 206px, chip ~100px — nhãn dài nhất "Newest first" ~73px
   vẫn vừa). Cao ~378px (2 preset: đáy ~746; 3 preset: đáy ~788, vừa
   màn hình 800). max-height + lăn dọc chỉ là lưới an toàn cho cửa sổ
   thấp hơn 800 (mặc định app đã là 800, không có min-height): cửa sổ
   800 thì max-height 380px không siết bảng 378px. */
.filter-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: -13px;
    width: 226px;
    max-width: calc(100vw - 23px);
    max-height: calc(100vh - 420px);
    overflow-y: auto;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    box-sizing: border-box;
    /* Bậc 4 của thang xám (#3d3d3d, Đạt dặn 21/11): bảng lọc là bảng
       bật lên nên sáng hơn nền thẻ (#222222) để tách khỏi lưới phía
       sau. Giá trị trực tiếp ở đây, không dùng biến chung để khỏi kéo
       theo chỗ khác. */
    background-color: #3d3d3d;
    border: 1px solid var(--s-color-outline-variant);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}

/* Hiệu ứng mở/đóng bảng lọc (Đạt duyệt 21/11): mờ dần + trượt xuống
   6px trong 150ms (lớp .filter-panel-enter/leave do <Transition> gắn
   vào bảng khi panelOpen đổi). */
.filter-panel-enter-active,
.filter-panel-leave-active {
    transition: opacity 150ms ease, transform 150ms ease;
}

.filter-panel-enter-from,
.filter-panel-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

/* 2 nhóm xếp dọc: loại mod trên, sắp xếp dưới. Mỗi nhóm rộng hết bảng
   để chip xếp 2 hàng cân nhau. */
.filter-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
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

/* Nhóm chip trong bảng dọc: hàng đầu 1 chip full hàng (All types /
   Default — dài nhất), 3 hàng dưới 2 chip 1 hàng, cách nhau 6px.
   Chip trong mỗi hàng 2 cái rộng bằng nhau. */
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
   surface-container-low (#222222) — phương án D Đạt chọn 22/11: chip
   tối hơn nền bảng (#3d3d3d) thì tách rõ (chênh 27 mức); trước đây
   dùng lowest (#323232) chỉ chênh nền 11 mức nên nút chìm vào nền
   (Đạt chê mờ 22/11). Theme tối của app đặt tên ngược với Material —
   "lowest" mới là màu sáng nhất.
   Chip chia đều hàng (flex: 1 1 0, min-width: 0): nhãn dài nhất
   "Newest first" (~73px) vừa ô ~100px khi cỡ chữ 0.8125rem + đệm
   ngang 6px (đo thật: 0.875rem thì chữ chạm đúng mép ô, máy Đạt vẽ
   chữ rộng hơn chút là tràn) — KHÔNG tăng đệm hay cỡ chữ nếu chưa đo
   lại, và KHÔNG thêm font-weight cho chip đang chọn (chữ đậm rộng hơn
   sẽ tràn ô; nền vàng đã đủ báo đang chọn). Đệm dọc 5px (chip cao
   28px thay vì 30px) để bảng dọc 14 hàng chip vừa màn hình 800 kể cả
   khi có 3 preset. */
.filter-chip {
    flex: 1 1 0;
    min-width: 0;
    padding: 5px 6px;
    border-radius: 8px;
    background-color: var(--s-color-surface-container-low);
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

/* Nút trượt Tất cả/Đã chọn (Đạt dặn 23/11): dùng thẳng component
   sectionSelector như nút Dọc/Ngang — kiểu viên vàng + khung nằm trong
   component, chỗ này chỉ chỉnh RIÊNG cho khung hẹp 200px: khung tràn 2
   bên đệm của panel (margin -10px, rộng 220px) để nhãn + số đếm đủ chỗ
   ("Selected (0)" ở rộng 200px thì cắt mất chữ); đệm mục thu lại; chữ
   tên 14px + số đếm 13px mờ (thang chữ S/XS); tên cắt … khi dài, số đếm
   không bao giờ cắt (giống hàng nút cũ). */
.character-list-fixed :deep(#all-selected-slider) {
    /* Rộng 100% = 200px NỘI DUNG + đệm 10px mỗi bên của khung chứa =
       tổng 220px (tràn 10px mỗi bên đệm panel, vừa tới mép trong của
       viền khung trái). KHÔNG dùng border-box ở đây: khung chứa đặt
       height: 20px, border-box sẽ hiểu 20px là tổng cao (cả đệm 26px)
       làm khung sập còn 20px, viên + chữ bị cắt — bẫy gặp khi thử. */
    width: 100%;
    margin: 0 -10px;
    flex: none;
}
/* Khung nút phải lấp đầy khung chứa (mặc định nó chỉ rộng vừa nội dung
   nên 2 mục hẹp lại, viên vàng 100px không khớp mục 71px). */
.character-list-fixed :deep(#all-selected-slider .section-selector) {
    width: 100%;
}
.character-list-fixed :deep(#all-selected-slider .section-item) {
    padding: 10px 4px;
    gap: 4px;
}
.character-list-fixed :deep(#all-selected-slider .section-item p) {
    font-size: 14px;
    /* Tên co lại + cắt … khi nhãn dài hơn nửa khung (số đếm giữ
       nguyên): flex: 0 1 auto = không phình khi ngắn, co khi dài;
       min-width: 0 cho co dưới cỡ chữ. Ghi đè flex: none của bản
       compact trong component (chỉ cho nút này, nút Dọc/Ngang giữ
       nguyên). */
    flex: 0 1 auto;
    width: auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.character-list-fixed :deep(#all-selected-slider .section-label-count) {
    flex: none;
    font-size: 13px;
    opacity: 0.75;
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

/* Hình mũi tên (Đạt duyệt mockup 21/11, sửa theo ý Đạt 23/11): hàng
   nhân vật thu hẹp theo khoảng cách từ mốc — data-arrow do template
   gán (0 = mốc full, 1 = kề 5/6, 2 = còn lại 3/4). Mốc là hàng đang
   rê chuột nếu có, không thì hàng đang chọn; rê chuột thì cả mũi tên
   dời theo (transition 180ms làm mũi tên trượt mượt). Không dùng
   :hover vì nó chỉ phóng được 1 hàng. Hàng Tất cả/Đã chọn nằm ngoài
   .character-list-rows nên không bị ảnh hưởng. */
.character-list-rows .character-row {
    flex: none;
    transition: width 180ms ease;
}

.character-list-rows .character-row[data-arrow="0"] {
    width: 100%;
}

.character-list-rows .character-row[data-arrow="1"] {
    width: 83%;
}

.character-list-rows .character-row[data-arrow="2"] {
    width: 75%;
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
