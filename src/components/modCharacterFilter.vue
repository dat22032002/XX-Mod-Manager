<!-- Hàng lọc giờ trống: nút Bộ lọc + bảng lọc Teleport lên hàng trên
     cùng của cửa sổ (ngang nút thoát app) — component vẫn gắn ở lưới
     mod nên trạng thái + sự kiện không đổi. Hàng chip nhân vật đã bỏ,
     thay bằng danh sách dọc ở cột trái (characterList.vue); ô tìm kiếm
     đã dời xuống cạnh tiêu đề Characters trong danh sách đó, Tất cả /
     Đã chọn dời xuống làm 2 hàng cố định trên cùng danh sách đó
     (Đạt dặn 21/11) vì chúng cùng họ với chọn nhân vật. -->
<template>
    <div class="filter-row">
        <!-- defer: khung đích nằm ở App.vue (component khác) — đợi cả cây
             gắn xong mới chuyển nội dung sang, tránh lúc gắn sớm khung
             đích chưa sẵn sàng. -->
        <Teleport to="#top-filter-bar" defer>
            <div class="top-filter-row">
        <!-- Nút Bộ lọc: bấm vào thì bảng lọc hiện ra dưới dạng overlay
             phủ lên lưới mod (không đẩy nội dung xuống), mép trái bảng
             thẳng với mép trái nút. Nút phát sáng khi bảng đang mở.
             Đang có lọc/xếp khác mặc định thì nút vàng lên để nhìn là
             biết lưới đang bị lọc. Nghiêng -20° như ô tìm kiếm để mép
             phải song song với mép trái thanh tag. -->
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
        <!-- (Tất cả / Đã chọn từng ở đây, đã dời xuống làm 2 hàng cố
             định trên cùng danh sách nhân vật — Đạt dặn 21/11.) -->
        <!-- (Nút ẩn/hiện số lượng mod từng ở đây, đã dời vào trong bảng
             lọc bên dưới — Đạt muốn nó nằm ẩn trong bảng, 20/11.) -->
        <!-- Lớp bắt bấm trong suốt phủ cả màn hình khi bảng đang mở:
             bấm ra ngoài bảng thì đóng bảng. Nằm dưới nút và bảng
             (z-index) nên không chặn 2 cái đó. -->
        <div class="filter-backdrop" v-show="panelOpen" @click="panelOpen = false"></div>
        <!-- Bảng lọc overlay: mỗi nhóm 1 hàng riêng để đủ chỗ hiện hết
             chip mà không phải lăn ngang (hàng lưới hẹp, 9 chip chung
             1 hàng sẽ bị cắt ở cửa sổ nhỏ). Bấm chip thì bảng ở lại mở
             để chọn tiếp nhóm còn lại; bấm nút hoặc bấm ra ngoài thì đóng.
             Dùng v-show để chipRadioBar không bị gắn lại (thanh vàng giữ
             nguyên vị trí đã đo) khi đóng bảng. -->
        <div class="filter-panel" v-show="panelOpen">
            <div class="type-filter-wrap">
                <chipRadioBar :items="typeItems" :translatedItems="translatedTypes"
                    @itemChange="handleTypeChange" ref="typeFilterRef" />
            </div>
            <div class="sort-wrap">
                <chipRadioBar :items="sortItems" :translatedItems="translatedSorts"
                    @itemChange="handleSortChange" ref="sortBarRef" />
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
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import chipRadioBar from './chipRadioBar.vue';
import { MOD_TAGS, normalizeTypeFilter } from '../../helper/ModTag';
import IManager from '../../electron/IManager';
const iManager = new IManager();

import { g_config_vue } from '../../electron/IManager';

// Nút Bộ lọc: bảng overlay bung hay đóng — trạng thái chỉ trong phiên
// làm việc (mở app lại thì bảng đóng, như mọi bảng thả xuống). Nút vàng
// lên khi đang có lọc theo loại hoặc xếp khác mặc định — nhìn là biết
// lưới đang bị lọc dù bảng đã đóng.
const panelOpen = ref(false);
const hasActiveFilter = computed(() =>
    g_config_vue.modTypeFilter.value !== 'all' || g_config_vue.modSortBy.value !== 'default');

//-==================== Lọc theo tag mod + sắp xếp ====================//
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

const typeFilterRef = useTemplateRef('typeFilterRef');
const sortBarRef = useTemplateRef('sortBarRef');

// Bung bảng lọc ra thì đo lại thanh vàng 2 hàng: lúc bảng đóng (display:
// none) chip có kích thước 0 nên thanh trượt đo lúc gắn/mở app bị lệch;
// đo lại sau 2 khung hình cho bố cục ổn định (giống thanh tag nhân vật).
// selectItemByName với mục đang chọn chỉ đo lại, không phát sự kiện đổi.
watch(panelOpen, (open) => {
    if (!open) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        const type = normalizeTypeFilter(g_config_vue.modTypeFilter.value);
        const sort = SORT_VALUES.includes(g_config_vue.modSortBy.value) ? g_config_vue.modSortBy.value : 'default';
        if (typeFilterRef.value) typeFilterRef.value.selectItemByName(type);
        if (sortBarRef.value) sortBarRef.value.selectItemByName(sort);
    }));
});

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

const language = g_config_vue.language;

//-=============== Hiện số lượng mod ===============//
// Công tắc trong bảng lọc (Đạt dặn 20/11): bật thì mỗi nhân vật trong
// danh sách dọc hiện thêm số mod trong ngoặc, vd Ellen (24); Tất cả hiện
// tổng số mod, Đã chọn hiện số mod đang bật vàng. Tắt thì về tên trần
// như cũ. Lựa chọn lưu trong config nên mở app lại vẫn nhớ.
// Số đếm theo TOÀN BỘ kho mod (không theo lọc tag/tìm kiếm đang bật)
// để con số ổn định, đúng nghĩa "nhân vật này có bao nhiêu mod".
const showChipCounts = g_config_vue.showChipCounts;
function toggleChipCounts() {
    iManager.config.showChipCounts = !g_config_vue.showChipCounts.value;
    saveFilterSettings();
}
watch(language, () => {
    // Chữ trên chip lọc/xếp đổi độ dài theo ngôn ngữ nên đặt lại thanh
    // trượt 2 hàng đó nếu bảng đang mở (bảng đóng thì lần bung sau đo lại).
    if (panelOpen.value) {
        nextTick(() => {
            const type = normalizeTypeFilter(g_config_vue.modTypeFilter.value);
            const sort = SORT_VALUES.includes(g_config_vue.modSortBy.value) ? g_config_vue.modSortBy.value : 'default';
            if (typeFilterRef.value) typeFilterRef.value.selectItemByName(type);
            if (sortBarRef.value) sortBarRef.value.selectItemByName(sort);
        });
    }
});

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
/* Hàng lọc giờ trống (nội dung Teleport lên hàng trên) nên div gốc
   không chiếm chỗ — chỉ còn là nơi gắn component. */
.filter-row {
    display: contents;
}

/* Cụm lọc Teleport lên hàng trên: xếp ngang như hàng lọc cũ. */
.top-filter-row {
    display: flex;
    align-items: center;
}

/* Nút Bộ lọc: khối nghiêng -20° cao 35px, chữ và biểu tượng nghiêng
   ngược lại cho thẳng. Là nút đầu tiên ở hàng trên (ô tìm kiếm đã
   dời xuống danh sách nhân vật). */
.filter-toggle {
    flex-shrink: 0;
    height: 35px;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0px 14px;
    margin-left: 8px;
    border-radius: 8px;
    background-color: var(--s-color-surface-container-low);
    border: 1px solid var(--s-color-outline-variant);
    color: var(--s-color-on-surface);
    cursor: pointer;
    transform: skew(-20deg);
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
    transform: skew(20deg);
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.filter-toggle-inner s-icon {
    flex-shrink: 0;
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

/* Bảng lọc overlay: thả xuống từ nút Bộ lọc (giờ ở hàng trên), phủ lên
   lưới mod chứ không đẩy nội dung. Mép trái thẳng với mép trái nút
   (= lề trái 8px của nút tính từ mép trái khung chứa ở hàng trên; nút
   Bộ lọc giờ là nút đầu tiên vì ô tìm kiếm đã dời xuống danh sách nhân
   vật). Bảng ôm vừa nội dung (chỉ rộng bằng hàng chip dài nhất cộng
   đệm). Giới hạn để không tràn mép phải cửa sổ (mép trái bảng cách mép
   trái cửa sổ ~192px: đệm đầu 20 + lề nút cửa sổ 8 + nút cửa sổ 142 +
   khe 16 + lề nút Bộ lọc 8, trừ 2px làm tròn; chừa 10px mép phải);
   cửa sổ hẹp quá thì hàng chip tự lăn ngang như cũ. */
.filter-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 8px;
    width: fit-content;
    max-width: calc(100vw - 202px);
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

/* Trong bảng overlay, thanh chip chiếm hết chiều rộng bảng (bỏ khe
   20px mặc định của chipRadioBar) để hàng chip dài nhất không bị cắt
   mất 20px cuối khi bảng ôm vừa nội dung. */
.filter-panel .chip-radio-bar {
    width: 100%;
}

.type-filter-wrap {
    width: 100%;
}

.sort-wrap {
    width: 100%;
}
</style>