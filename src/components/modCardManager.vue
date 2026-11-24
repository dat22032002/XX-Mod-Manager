<template>
    <!-- @mousedown bôi đen gắn ở KHUNG NGOÀI (#mod-card-manager) chứ
         không gắn ở #mod-container: container chỉ cao bằng nội dung
         (height: fit-content) nên nhấn chuột ở khoảng trống dưới hàng
         cuối không bao giờ tới được handler nếu gắn ở container (Đạt
         thấy 21/11: ít mod thì bôi đen không bắt đầu được). Gắn ở khung
         ngoài thì toàn bộ khung lưới — kể cả khoảng trống — đều bắt
         đầu được bôi đen. Khung bôi đen (#marquee-box) cũng là con của
         khung ngoài, tọa độ tính theo khung ngoài (xem
         marqueeFramePoint): trước đây nó là con của #mod-container
         (nằm trong s-scroll-view) nên phần vươn xuống dưới đáy scroll
         view bị cắt mất — scroll view chỉ cao bằng nội dung, phần khung
         ngoài hộp của nó nằm trong vùng lăn chưa cuộn tới nên không
         thấy được (Đạt thấy 22/11: khung mất viền dưới). -->
    <div id="mod-card-manager" class="OO-box" ref="modCardManagerRef" @mousedown="handleMarqueeMouseDown">
        <!-- <chipRadioBar class="characterFilter" :items="characters" @itemChange="handleFilterChange"
            :translatedItems="translateCharacters" ref="characterFilterRef" /> -->
        <!-- Giao diện lọc (tìm kiếm + nút "Bộ lọc" + bảng overlay + Tất
             cả / Đã chọn) nằm trong characterList.vue ở cột trái; chỗ này
             chỉ đọc lựa chọn đã lưu trong config để lọc/xếp danh sách
             (xem filteredMods). -->
        <s-scroll-view ref="scrollViewRef" style="overflow-x:hidden;overflow-y: auto;border-radius: 0 0 12px 12px;">
            <div class="refresh-placeholder" ref="refreshPlaceholderRef"></div>
            <div id="mod-container" :compact="compactMode" :data-layout="cardLayout" ref="modContainerRef" :style="containerStyle">
                <!-- Key = id + tên thư mục: phòng khi id vẫn trùng (lỗi
                     glitch lưới 22/11 + 24/11 do nhân đôi thư mục mod).
                     Ký tự '|' không thể có trong tên thư mục Windows nên
                     cặp key không thể nhầm lẫn. DOM id của thẻ + map bôi
                     đen dùng cùng key này (xem modCard.vue + marquee). -->
                <modCard v-for="mod in windowMods" :key="mod.id + '|' + mod.name" :modRef="mod" :lazyLoad=true
                    :compactMode="compactMode" :cardWidth="effectiveCardWidth" :cardLayout="cardLayout" :fullImage="fullImage"
                    :ref="setModCardRef(mod.id + '|' + mod.name)" />
                <!-- Lưới lọc ra 0 mod thì hiện chữ + nút xóa bộ lọc thay
                     vì để trống trơn (Đạt dặn 21/11). Chỉ hiện sau khi
                     đã tải xong danh sách (modsLoaded) để lúc mở app
                     chưa tải xong không nháy lên. @mousedown.stop để bấm
                     nút không kéo khung bôi đen của lưới. -->
                <div v-if="modsLoaded && filteredMods.length === 0" id="empty-state" class="empty-state" @mousedown.stop>
                    <div class="empty-state-text">{{ $t('filter.empty') }}</div>
                    <s-button id="clear-filters-button" @click="clearAllFilters" class="OO-button font-hongmeng">
                        {{ $t('filter.clearFilters') }}
                    </s-button>
                </div>
            </div>
        </s-scroll-view>
        <!-- Khung bôi đen chọn mod (kéo như Windows): vàng = chọn Áp
             Dụng, giữ Ctrl thì xanh = chọn hàng loạt. Là con TRỰC TIẾP
             của khung ngoài (#mod-card-manager), KHÔNG nằm trong
             s-scroll-view — để không bị scroll view cắt khi kéo xuống
             khoảng trống dưới đáy vùng chứa mod (xem chú thích đầu file). -->
        <div v-if="marquee.active" id="marquee-box" :class="marquee.batch ? 'batch' : 'apply'"
            :style="marqueeBoxStyle"></div>
    </div>
</template>

<script setup>
import 'sober';
import { ref, onMounted, onUnmounted, computed, useTemplateRef, watch, reactive, nextTick } from 'vue';
import modCard from './modCard.vue';
import { Tween, Group } from "@tweenjs/tween.js";
import IManager, { g_data_vue } from '../../electron/IManager';
import { g_config_vue, g_temp_vue } from '../../electron/IManager';
import { EventType, EventSystem } from '../../helper/EventSystem';
import { computeWindow, CARD_GAP, OVERSCAN_ROWS, rangeCheckedWidth, computeFillLayout } from './modWindowing.js';
import { selectedModIdSet, setSelectedModIdsExclusive, getModTag, toggleModsInOrder, toggleBatchMods } from '../../helper/SelectedMods';
import { MOD_TAGS, normalizeTypeFilter } from '../../helper/ModTag';

const iManager = new IManager();

// 接受参数
const props = defineProps({
    compactMode: Boolean,
    // Chiều rộng thẻ ở dạng lưới (dọc 100–350 / ngang 200–450).
    cardWidth: {
        type: Number,
        default: 301
    },
    // Kiểu thẻ: 'vertical' (dọc) hay 'horizontal' (ngang).
    cardLayout: {
        type: String,
        default: 'horizontal'
    },
    // Thẻ hiện ảnh gốc đầy đủ thay vì ảnh thu nhỏ 250px.
    fullImage: Boolean
});

// 定义 mods 变量
const mods = ref([]);

// Đã tải xong danh sách mod lần đầu chưa — màn hình trống chỉ hiện sau
// khi tải xong, không thì lúc mở app (mods còn rỗng) nó nháy lên.
const modsLoaded = ref(false);

const currentCharacter = g_temp_vue.currentCharacter;

watch(currentCharacter, (newVal) => {
    if (newVal) {
        //debug
        console.log('currentCharacter changed:', newVal);
        // Snapshot the selection when the 'selected' filter is applied, so
        // the list behaves as before: toggling a card while viewing
        // 'selected' does not make it vanish until the filter is re-applied.
        if (newVal === 'selected') {
            selectedSnapshot.value = new Set(selectedModIdSet);
        }
    }
});

// (Đổi ngôn ngữ: thanh trượt hàng chip lọc/xếp tự đặt lại trong
// characterList — thanh đó nằm ở bảng overlay bên đó. Hàng vàng
// Tất cả / Đã chọn / nhân vật tự theo currentCharacter nên không cần
// đồng bộ gì thêm ở đây.)

const characters = computed(() => {
    const characterList = g_data_vue.characterList;
    if (!characterList) return [];
    //debug
    console.log('get characterList', characterList.value);
    return ['all', 'selected', ...characterList.value];
});

const translateCharacters = computed(() => {
    if (g_config_vue.language.value == 'vi') {
        return ['Tất cả', 'Đã chọn'];
    } else {
        return ['All', 'Selected'];
    }
});

//-==================== Lọc theo tag mod + sắp xếp ====================//
// Giao diện lọc/xếp (nút "Bộ lọc" + bảng overlay) nằm ở
// characterList; chỗ này chỉ đọc lựa chọn đã lưu trong config để
// lọc/xếp danh sách. Tag mod theo getModTag (SelectedMods): Character,
// Skin, Weapon, Effect, Accessory — chuẩn duy nhất từ 1.5.18, thay tiền
// tố tên thư mục. Thêm tag mới thì thêm vào MOD_TAGS + 1 khóa locale
// modTag.*.
const SORT_VALUES = ['default', 'name-asc', 'name-desc', 'time-desc', 'time-asc', 'size-desc', 'size-asc'];

// Đọc qua g_config_vue (lưu trong config.json nên mở app lại vẫn giữ);
// giá trị lạ trong config cũ thì về mặc định ('outfit' cũ thành
// 'character').
const typeFilter = computed(() => normalizeTypeFilter(g_config_vue.modTypeFilter.value));
const sortBy = computed(() =>
    SORT_VALUES.includes(g_config_vue.modSortBy.value) ? g_config_vue.modSortBy.value : 'default');

// Đếm lần dung lượng về (xem listener modSizeReady ở dưới): filteredMods
// đọc nó để xếp lại khi đang xếp theo dung lượng. Khai báo ở đây vì
// watch(filteredMods) đánh giá ngay trong setup — để ở cuối file thì
// đọc trúng vùng chết (TDZ) làm cả lưới không gắn được.
const sizeVersion = ref(0);
let sizeBumpTimer = null;

//-==================== 只渲染视口附近的卡片（虚拟列表） ====================//
// The grid used to mount every mod card at once; with hundreds of mods that
// dominated startup time. Now only the rows near the viewport are mounted
// (plus a small overscan buffer), and blank padding above/below the mounted
// rows keeps the scrollbar and scroll positions exactly as if the whole list
// were mounted. The math lives in ./modWindowing.js so it can be checked
// without a browser.

// Current search text, mirrored from applySearch. The list is
// filtered in Vue state (not only by hiding DOM nodes) because unmounted
// cards have no DOM node to hide.
const searchText = ref('');
// Snapshot of the selection when the 'selected' filter is applied (see the
// currentCharacter watcher above and loadMods below).
const selectedSnapshot = ref(null);

const filteredMods = computed(() => {
    // Đọc để xếp lại khi có dung lượng mới về (xem sizeVersion ở trên).
    void sizeVersion.value;
    const list = mods.value || [];
    let result;
    // Search: same rule as changeFilterToSearch (character-prefix spec) —
    // a search matching exactly one character filters by that character,
    // any other non-empty search matches nothing.
    const keyword = (searchText.value || '').trim().toLowerCase();
    if (keyword !== '') {
        const characterList = g_data_vue.characterList;
        const characterNames = (characterList && characterList.value) || [];
        const matched = characterNames.filter(name => name && name.toLowerCase().startsWith(keyword));
        if (matched.length !== 1) {
            result = [];
        } else {
            const character = matched[0];
            result = list.filter(mod => mod.character === character);
        }
    } else {
        const character = currentCharacter.value;
        if (!character || character === 'all') {
            result = list;
        } else if (character === 'selected') {
            const snapshot = selectedSnapshot.value;
            if (snapshot) result = list.filter(mod => snapshot.has(mod.id));
            else result = list.filter(mod => selectedModIdSet.has(mod.id));
        } else {
            result = list.filter(mod => mod.character === character);
        }
    }
    // Lọc theo tag mod (kết hợp với lọc nhân vật/tìm kiếm ở trên).
    const type = typeFilter.value;
    if (type !== 'all') {
        result = result.filter(mod => getModTag(mod) === type);
    }
    // Chỉ hiện mod nghi hỏng (công tắc trong bảng lọc — Đạt dặn 23/11):
    // giữ lại mod có id trong danh sách lần quét Fixer gần nhất (lưu
    // trong config nên mở app lại vẫn còn; null = chưa quét bao giờ thì
    // công tắc không bật được nên nhánh này không chạy).
    if (g_config_vue.showOnlySuspected.value) {
        const ids = g_config_vue.fixerSuspectIds.value;
        if (Array.isArray(ids)) {
            const suspectSet = new Set(ids);
            result = result.filter(mod => suspectSet.has(mod.id));
        }
    }
    // Sắp xếp: ghim luôn lên đầu, sau đó theo kiểu xếp đã chọn (mặc định
    // giữ thứ tự tải vào như trước; sort của JS là ổn định nên mod ngang
    // nhau không bị xáo trộn). slice() để không sửa mảng gốc.
    const sort = sortBy.value;
    // So sánh dung lượng: mod chưa quét xong (-1) luôn xếp cuối ở cả
    // 2 chiều (không thì chiều nhỏ-trước sẽ đẩy mod chưa biết lên đầu).
    const compareSize = (a, b, desc) => {
        const sa = (typeof a.sizeBytes === 'number' && a.sizeBytes >= 0) ? a.sizeBytes : -1;
        const sb = (typeof b.sizeBytes === 'number' && b.sizeBytes >= 0) ? b.sizeBytes : -1;
        if (sa === -1 && sb === -1) return 0;
        if (sa === -1) return 1;
        if (sb === -1) return -1;
        return desc ? sb - sa : sa - sb;
    };
    return result.slice().sort((a, b) => {
        const pinDiff = Number(!!b.pinned) - Number(!!a.pinned);
        if (pinDiff !== 0) return pinDiff;
        switch (sort) {
            case 'name-asc': return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
            case 'name-desc': return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
            case 'time-desc': return (b.addedMs || 0) - (a.addedMs || 0);
            case 'time-asc': return (a.addedMs || 0) - (b.addedMs || 0);
            case 'size-desc': return compareSize(a, b, true);
            case 'size-asc': return compareSize(a, b, false);
            default: return 0;
        }
    });
});

// Whenever the filtered list changes (filter, search, reload), recompute the
// mounted rows right away: the old window range may point past the end of a
// much shorter list, which would briefly show a blank grid with stale padding.
watch(filteredMods, () => {
    updateWindow();
});

// Mounted slice of filteredMods: [windowRange.start, windowRange.end).
const windowRange = reactive({ start: 0, end: 0 });
const windowPaddingTop = ref(0);
const windowPaddingBottom = ref(0);
const windowMods = computed(() => filteredMods.value.slice(windowRange.start, windowRange.end));

const scrollViewRef = useTemplateRef('scrollViewRef');
let windowRaf = 0;
let windowResizeObserver = null;

function readRowHeight() {
    // The grid row height animates during compact-mode transitions; read the
    // live value so the padding stays in sync with the rows.
    const el = modContainerRef.value;
    if (el) {
        const parsed = parseFloat(getComputedStyle(el).gridAutoRows);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return props.compactMode ? 150 : 350;
}

function scheduleWindowUpdate() {
    if (windowRaf) return;
    windowRaf = requestAnimationFrame(() => {
        windowRaf = 0;
        updateWindow();
    });
}

// Rộng thẻ danh nghĩa (đã kiểm khoảng) + rộng thẻ thật lấp đầy hàng
// (toán dùng chung trong modWindowing.js — nút phóng to ở modCardSection
// dùng cùng hàm nên 2 bên luôn tính ra 1 số).
const nominalCardWidth = computed(() => rangeCheckedWidth(props.cardWidth, props.cardLayout));
const containerWidth = ref(0);
const gridLayout = computed(() => computeFillLayout(containerWidth.value, nominalCardWidth.value, props.cardLayout));
const effectiveCardWidth = computed(() => gridLayout.value.width);

// Khe lề cân 4 phía (Đạt báo 22/11: khe trên/dưới lệch với khe trái/
// phải). Khi lưới KHÔNG lấp đầy được hàng (không ứng viên nào trong
// ±15%), CSS căn giữa lưới nên 2 bên thừa ra leftover/2 mỗi bên, trong
// khi khe trên vẫn 0 — trông lệch (đo 22/11 ở cửa sổ 1400×900, thẻ
// Ngang 100%: trên=0, trái=70, phải=76). Đẩy lưới xuống bằng đúng khe
// ngang và chừa thêm đúng từng đó ở đáy (margin-top + margin-bottom =
// leftover/2) thì 4 phía đều nhau. Dùng margin (ngoài border box) chứ
// không dùng padding-top: toán vẽ từng phần đo scrollOffset từ border
// box nên margin không làm lệch nó. Khi lấp đầy được thì leftover ≈ 0
// nên không đổi gì. Lưới trống (0 mod) thì không áp — chữ "không tìm
// thấy mod" cứ ở trên cùng. (Khe phải vẫn hơn khe trái đúng 6px khi có
// thanh lăn dọc — đó là chỗ thanh lăn chiếm, mọi app đều vậy; đẩy lưới
// sang phải để cân thì thẻ sẽ chui xuống dưới thanh lăn nên không làm.)
const gridSideGap = computed(() => {
    if (filteredMods.value.length === 0) return 0;
    const w = containerWidth.value;
    const { width, columns } = gridLayout.value;
    if (!Number.isFinite(w) || w <= 0 || columns < 1) return 0;
    const leftover = w - (columns * width + (columns - 1) * CARD_GAP);
    // leftover <= 0,5px là sai số làm tròn của phép lấp đầy — coi như 0.
    return leftover <= 0.5 ? 0 : leftover / 2;
});

// Kiểu của khung lưới: khoảng đệm vẽ từng phần + biến rộng thẻ. Thẻ lưới
// đọc --card-width để tự co giãn theo mức phóng to.
const containerStyle = computed(() => {
    return {
        paddingTop: windowPaddingTop.value + 'px',
        paddingBottom: windowPaddingBottom.value + 'px',
        marginTop: gridSideGap.value + 'px',
        marginBottom: gridSideGap.value + 'px',
        '--card-width': effectiveCardWidth.value + 'px',
    };
});

function updateWindow() {
    const container = modContainerRef.value;
    const scrollView = scrollViewRef.value;
    if (!container || !scrollView) return;
    const list = filteredMods.value;
    // Đo rộng khung trước để tính rộng thẻ lấp đầy (gridLayout); số cột
    // lấy từ gridLayout cho khớp số cột CSS đang xếp (xem ghi chú ở
    // gridLayout — không tính lại từ rộng đã kéo).
    containerWidth.value = container.clientWidth;
    const columns = gridLayout.value.columns;
    // Rộng thẻ có thể vừa đổi theo cỡ khung (kéo vừa đủ) — đồng bộ chiều
    // cao hàng theo rộng mới, trừ lúc đang chạy hiệu ứng gọn/thường (để
    // hiệu ứng tự chạy hết, không giật).
    if (!isAnimating) syncRowHeight();
    const rowHeight = readRowHeight();
    const viewRect = scrollView.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    const scrollOffset = Math.max(0, viewRect.top - contRect.top);
    const win = computeWindow({
        itemCount: list.length,
        columns,
        rowHeight,
        gap: CARD_GAP,
        scrollOffset,
        viewportHeight: scrollView.clientHeight,
        overscanRows: OVERSCAN_ROWS,
    });
    if (win.startIndex !== windowRange.start || win.endIndex !== windowRange.end) {
        windowRange.start = win.startIndex;
        windowRange.end = win.endIndex;
        // Newly mounted cards need IntersectionObserver observation so their
        // preview images lazy-load as before.
        nextTick(() => observeMods());
    }
    if (windowPaddingTop.value !== win.paddingTop) windowPaddingTop.value = win.paddingTop;
    if (windowPaddingBottom.value !== win.paddingBottom) windowPaddingBottom.value = win.paddingBottom;
}

// 定义 loadMods 方法
const loadMods = async (recordPresetHistory = true) => {
    mods.value = iManager.data.modList
    modsLoaded.value = true;

    // 检查是否选择了预设，如果选择了预设，则加载预设
    // preset Mặc định cũng được khôi phục từ config (defaultPresetModIds)，
    // không bỏ qua như trước nữa — nếu không lựa chọn ở Mặc định sẽ mất
    // mỗi lần mở app / chuyển preset / làm mới.
    if (iManager.temp.currentPreset) {
        await loadPreset(iManager.temp.currentPreset, recordPresetHistory);
    }

    // The 'selected' filter is a snapshot taken when the filter is applied;
    // refresh it after a reload so it matches the freshly loaded preset.
    if (currentCharacter.value === 'selected') {
        selectedSnapshot.value = new Set(selectedModIdSet);
    }

    //debug
    console.log(`❇️❇️❇️❇️❇️❇️❇️\nsuccess load mods, mod count: ${mods.value.length}, character count: ${characters.value.length}`);

    // The list changed size; recompute which rows to mount.
    await nextTick();
    updateWindow();
};

// 绑定 mod卡片的引用
const modCardRefs = ref({});
// 定义 setModCardRef 方法
const setModCardRef = (id) => (el) => {
    modCardRefs.value[id] = el;
};

// Xóa hết bộ lọc về mặc định (nút trên màn hình trống): xóa chữ tìm
// kiếm, nhân vật về Tất cả, loại về All types, xếp về Default, tắt lọc
// chỉ hiện mod nghi hỏng. Phát 'filtersCleared' để modCardSection bảo
// characterList xóa chữ trong ô tìm — watcher currentCharacter ở đó chỉ
// chạy khi nhân vật ĐỔI, mà lúc gõ tìm không ra mod nào nhân vật vẫn
// đang là Tất cả nên không đổi.
const emit = defineEmits(['filtersCleared']);
const clearAllFilters = () => {
    applySearch('');
    iManager.config.modTypeFilter = 'all';
    iManager.config.modSortBy = 'default';
    iManager.config.showOnlySuspected = false;
    iManager.saveConfig();
    emit('filtersCleared');
};

// 定义 handleFilterChange 方法
const handleFilterChange = (character) => {
    // Chọn nhân vật (hàng trong danh sách dọc): tìm kiếm đang gõ hết hiệu lực.
    searchText.value = '';
    iManager.setCurrentCharacter(character);
};

// Danh sách nhân vật dọc (cột trái) gọi qua đây — giống hệt chọn nhân
// vật cũ. modCardSection gọi qua ref (selectCharacter đã expose).
// 'all' / 'selected' đi chung đường này (2 hàng cố định trên cùng
// danh sách gọi selectCharacter('all' | 'selected')) nên không cần
// handler riêng cho Tất cả / Đã chọn nữa.
const selectCharacter = (character) => {
    handleFilterChange(character);
};

// Nhận chữ tìm kiếm từ ô tìm kiếm cạnh tiêu đề Characters
// (characterList.vue phát 'search', modCardSection chuyển vào đây).
// Hàm này từng là handler của sự kiện filterChangeToSearch từ
// modCharacterFilter (đã xóa, logic dời sang characterList) — ô tìm kiếm
// đã dời chỗ nên đổi thành hàm mở cho
// modCardSection gọi trực tiếp, logic không đổi.
const applySearch = (search) => {
    console.log('applySearch', search);
    if (!search || !search.trim()) {
        // Blank search (e.g. only spaces): same as clearing the search.
        // Without this reset, filteredMods would fall back to the previous
        // character filter and the list would not show everything.
        searchText.value = '';
        iManager.setCurrentCharacter('all');
        return;
    }
    // Mirror the text in Vue state: the list is filtered from it (see
    // filteredMods), because unmounted cards cannot be hidden via the DOM.
    searchText.value = search || '';
    // currentCharacter变成all
    // iManager.setCurrentCharacter('all');
    // 但是筛选并不按照currentCharacter来筛选，而是按照搜索的内容来筛选
    changeFilterToSearch(search);
};

async function changeFilterToSearch(search){
    // Lọc danh sách thật nằm ở filteredMods (theo searchText); hàm này chỉ
    // đổi nhân vật đang chọn khi từ khóa khớp đúng 1 nhân vật, để danh
    // sách dọc vàng đúng hàng của nhân vật đó.
    // 搜索不区分大小写：统一转小写再比较
    const keyword = (search || '').trim().toLowerCase();
    if (keyword === '') {
        return;
    }
    // 只按角色名称的开头几个字母匹配
    const characterList = g_data_vue.characterList;
    const characterNames = (characterList && characterList.value) || [];
    const matched = characterNames.filter(name => name && name.toLowerCase().startsWith(keyword));
    // 唯一匹配：像点击该角色标签一样选中它，显示该角色的 mod
    if (matched.length === 1) {
        iManager.setCurrentCharacter(matched[0]);
    }
}



async function loadPreset(presetName, recordHistory = true) {
    const preset = await iManager.loadPreset(presetName);
    // Tên biến cũ là `mods` — che mất `mods` (danh sách mod, dòng 48)
    // nên `mods.value` ở dưới thành undefined, luật 1 mod/1 tag không
    // bao giờ chạy lúc nạp preset (nạp preset có 2 mod cùng nhân vật
    // + cùng tag thì cả 2 cùng bật — lỗi từ bản 1.5.3, soát ra 20/11).
    const modIds = preset?.getModIds() || [];
    // Record the preset's selection up front. Cards read this shared set
    // (modCard's `clicked` is a computed over it), so mounted cards update
    // on their own and cards that are not mounted yet still get the
    // preset's selection when they mount — no card-clicking loop needed.
    // Áp dụng luật 1 mod/1 loại mỗi nhân vật cho preset luôn (mod sau
    // cùng nhân vật + cùng loại sẽ thắng mod trước), không báo gì thêm để
    // khỏi làm phiền lúc mở app (preset mặc định tự tải lúc khởi động).
    setSelectedModIdsExclusive(mods.value || [], modIds, recordHistory);

    //debug
    console.log('loadPreset', presetName);
    // handleFilterChange('已选择');
};

// Dồn các lần tải lại danh sách: đặt nhân vật hàng loạt / lúc mở app có nhiều
// mod mới bắn N sự kiện liên tiếp — chờ 100ms sau sự kiện cuối rồi tải lại
// 1 lần duy nhất, thay vì tải lại N lần.
// Tải lại KHÔNG đổi bộ lọc: trước đây nhân vật của sự kiện cuối được giữ
// lại để chuyển bộ lọc về nhân vật đó sau khi tải lại — đổi tên 1 mod khi
// đang ở Tất cả thì tự nhảy sang tag nhân vật của mod đó (Đạt báo 20/11).
// Bộ lọc chỉ đổi khi người dùng tự đổi (bấm tag, tìm kiếm); luồng nhập mod
// mới vẫn tự nhảy sang nhân vật của mod đó (IManager, chỗ nhập mod).
let reloadDebounceTimer = null;
const scheduleReload = () => {
    if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer);
    }
    reloadDebounceTimer = setTimeout(async () => {
        reloadDebounceTimer = null;
        mods.value = null;
        await loadMods();
        observeMods();
    }, 100);
};

EventSystem.on('modInfoChanged', () => {
    //debug
    console.log('get modInfoChanged, reload display mods');
    scheduleReload();
});

EventSystem.on(EventType.modListChanged, () => {
    //debug
    console.log('get modListChanged, reload display mods');
    scheduleReload();
});

// Làm mới không tải lại cửa sổ: cập nhật danh sách mà KHÔNG xóa mods.value,
// nên vị trí cuộn + bộ lọc + ô tìm kiếm + lựa chọn đều giữ nguyên.
EventSystem.on(EventType.refreshModList, () => {
    //debug
    console.log('get refreshModList, reload display mods without resetting scroll');
    // Làm mới đã tải lại danh sách rồi — hủy lần tải lại dồn đang chờ (nếu có)
    // để nó không xóa danh sách + mất vị trí cuộn sau đó. (Quét lại kho mod
    // luôn bắn modListChanged nên lần dồn nào cũng đang chờ ở đây.)
    if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer);
        reloadDebounceTimer = null;
    }
    setTimeout(async () => {
        await loadMods();
        observeMods();
    }, 1);
});

EventSystem.on(EventType.addMod, (mod) => {
    //debug
    console.log('get addMod, reload display mods', mods.value);
    scheduleReload();
});

// Nhảy tới mod MỚI vừa Lưu xong (Đạt dặn 22/11): chuyển bộ lọc sang
// nhân vật của mod (nhân vật ĐÃ LƯU — kể cả khi Đạt đổi khác lúc nhập,
// vì setCurrentCharacter lúc nhập chạy TRƯỚC khi hộp mở) rồi lăn lưới
// tới thẻ mod đó, căn giữa khung nhìn.
EventSystem.on(EventType.jumpToMod, async ({ modName, character }) => {
    if (!modName || !character) return;
    // Cập nhật ô tìm kiếm thành nhân vật ĐÃ LƯU trước khi đổi bộ lọc:
    // lúc nhập, ô tìm đã điền nhân vật lúc nhập (sửa lỗi 1 #114); nếu
    // Đạt đổi nhân vật trong hộp sửa thì ô tìm cũ vẫn thắng bộ lọc hàng,
    // lưới hiện nhân vật cũ nên poll không bao giờ tìm thấy mod mới.
    EventSystem.trigger(EventType.fillSearch, character);
    iManager.setCurrentCharacter(character);
    // Đợi mod xuất hiện trong danh sách đã lọc: triggerChanged() dồn
    // tải lại 100ms nên dữ liệu có thể chưa về kịp lúc hộp đóng.
    // Khớp theo TÊN mod (tên thư mục, duy nhất trong kho): id thay đổi
    // mỗi lần Lưu qua hộp sửa (sinh lại = md5 đường dẫn) nên không
    // dùng được làm khóa qua ranh giới lưu/tải lại.
    let index = -1;
    for (let i = 0; i < 20; i++) {
        index = filteredMods.value.findIndex((m) => m.name === modName);
        if (index !== -1) break;
        await new Promise((r) => setTimeout(r, 100));
    }
    if (index === -1) return;
    const scrollView = scrollViewRef.value;
    if (!scrollView) return;
    // Đồng bộ cửa sổ vẽ từng phần trước khi đo (bộ lọc vừa đổi, chiều
    // cao lăn có thể còn cũ) rồi mới tính vị trí lăn.
    await nextTick();
    updateWindow();
    const columns = gridLayout.value.columns;
    if (columns < 1) return;
    const row = Math.floor(index / columns);
    const rowHeight = readRowHeight();
    const rowTop = gridSideGap.value + row * (rowHeight + CARD_GAP);
    const maxScroll = Math.max(0, scrollView.scrollHeight - scrollView.clientHeight);
    scrollView.scrollTop = Math.min(maxScroll, Math.max(0, rowTop + rowHeight / 2 - scrollView.clientHeight / 2));
});

// Dung lượng về dần khi quét nền chạy: mỗi lần có size mới thì xếp
// lại danh sách (chỉ khi đang xếp theo dung lượng). Dồn 200ms để đợt
// quét đầu (hàng trăm mod về liên tiếp) không xếp lại từng cái.
EventSystem.on(EventType.modSizeReady, () => {
    if (sortBy.value !== 'size-desc' && sortBy.value !== 'size-asc') return;
    if (sizeBumpTimer) return;
    sizeBumpTimer = setTimeout(() => {
        sizeBumpTimer = null;
        sizeVersion.value++;
    }, 200);
});

EventSystem.on('currentPresetChanged', (preset) => {
    loadPreset(preset);
});




// 定义动画效果

const animate = new Group();
const modContainerRef = useTemplateRef('modContainerRef');

// Chiều cao 1 hàng theo kiểu thẻ: dọc = rộng × 1.4 (gọn × 0.6) như cũ;
// ngang = rộng × 280/350 (gọn × 0.45). Phải khớp CSS .mod-item không lưới
// sẽ lệch.
function targetRowHeight() {
    const w = effectiveCardWidth.value;
    if (props.cardLayout === 'vertical') {
        return props.compactMode ? w * 0.6 : w * 1.4;
    }
    return props.compactMode ? w * 0.45 : w * 280 / 350;
}

// Đặt chiều cao hàng ngay (lúc đổi mức phóng to).
function syncRowHeight() {
    const el = modContainerRef.value;
    if (el) el.style.gridAutoRows = `${targetRowHeight()}px`;
}

let isAnimating = false;
function updateAnimate() {
    if (!isAnimating) return;
    requestAnimationFrame(updateAnimate)
    animate.update()
}

// Chuyển chế độ gọn/thường: tạo hiệu ứng mới mỗi lần với chiều cao đích
// theo mức phóng to hiện tại (không dùng giá trị cố định 350/150 nữa).
watch(() => props.compactMode, () => {
    const el = modContainerRef.value;
    if (!el) return;
    const from = readRowHeight();
    const to = targetRowHeight();
    if (from === to) return;
    const tween = new Tween({ height: from }).to({ height: to }, 200)
        .onUpdate((object) => {
            el.style.gridAutoRows = `${object.height}px`;
            // Row height is animating: keep the windowing padding in sync.
            updateWindow();
        })
        .onComplete(() => { isAnimating = false; });
    animate.add(tween);
    isAnimating = true;
    tween.start();
    updateAnimate();
    // The row height finishes animating after 200ms; recompute the mounted
    // rows once it has settled.
    setTimeout(updateWindow, 250);
});

// Đổi mức phóng to: đặt lại chiều cao hàng + tính lại hàng đang gắn.
watch(() => props.cardWidth, () => {
    syncRowHeight();
    updateWindow();
});

// 定义 observer 变量
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const modItem = entry.target;
        // 如果元素在视口内，则使其inWindow属性为true

        // 这里时一个优化，卡片默认不加载图片，直到 enterWindow 为 true 时才加载图片
        if (modItem.getAttribute('inWindow') == 'none') {
            //debug
            if (entry.isIntersecting) {
                //debug
                // console.log(`item ${modItem.id} enter window , load image`,entry.isIntersecting);
                // Thẻ có thể đã bị gỡ khỏi danh sách ảo (lăn nhanh /
                // đổi lọc) trước khi callback này chạy — ref không còn
                // thì bỏ qua, không văng lỗi console.
                modCardRefs.value[modItem.id]?.enterWindow();

                modItem.setAttribute('inWindow', entry.isIntersecting);
                modItem.inWindow = entry.isIntersecting;
            }
            return;
        }

        modItem.inWindow = entry.isIntersecting;
        modItem.setAttribute('inWindow', entry.isIntersecting);

        //debug
        //console.log(`modItem ${modItem.id} inWindow:${modItem.inWindow}`);
    });
}, {
    root: null, // 使用视口作为根
    rootMargin: '1000px 0px 1000px 0px', // 扩展视口边界
    threshold: 0 // 只要元素进入视口就触发回调
});

// 在 loadMods 方法中为每个 mod-item 添加 observer
const observeMods = () => {
    document.querySelectorAll('.mod-item').forEach(item => {
        observer.observe(item);
    });
};

const refreshPlaceholderRef = useTemplateRef('refreshPlaceholderRef');
const modCardManagerRef = useTemplateRef('modCardManagerRef');
// 在组件挂载时调用 observeMods 方法
onMounted(async () => {
    await iManager.waitInit();
    // Khôi phục lựa chọn lúc mở app: không phải thao tác của người dùng
    // nên không ghi lịch sử hoàn tác — mới mở app nút Undo phải mờ đi.
    await loadMods(false);
    observeMods();
    refreshPlaceholderRef.value.style.height = '0px';

    // Windowing: recompute the mounted rows when the list is scrolled or
    // resized (window resize changes how many columns fit).
    const scrollView = scrollViewRef.value;
    if (scrollView) {
        scrollView.addEventListener('scroll', scheduleWindowUpdate, { passive: true });
    }
    if (typeof ResizeObserver !== 'undefined') {
        windowResizeObserver = new ResizeObserver(scheduleWindowUpdate);
        if (modContainerRef.value) windowResizeObserver.observe(modContainerRef.value);
        if (scrollView) windowResizeObserver.observe(scrollView);
    }
    // Chặn cú bấm ngay sau 1 lần bôi đen (khung bôi chạy ở pha bắt).
    if (modContainerRef.value) {
        modContainerRef.value.addEventListener('click', handleMarqueeClickCapture, true);
    }
    // Đặt chiều cao hàng theo mức phóng to/kiểu hiển thị đã lưu ngay từ đầu
    // (không thì lần đầu mở app vẫn dùng cỡ mặc định của CSS).
    syncRowHeight();
    updateWindow();

    // Thanh trượt hàng chip lọc/xếp đo lại mỗi lần bảng overlay bung ra
    // (characterList) — bảng đóng lúc mở app nên không đo ở đây.

    // 接受文件拖拽事件，可以直接通过拖拽文件到窗口中导入 mod，或者拖拽图片到窗口中为 mod 添加预览图
    modCardManagerRef.value.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const modItem = event.target.closest('.mod-item');
        if (modItem && modItem.id != iManager.temp.currentMod.id) {
            event.dataTransfer.dropEffect = 'copy';
            // iManager.setLastClickedMod_ByName(modItem.id);
            iManager.setCurrentModById(modItem.id);
        }
    });

    modCardManagerRef.value.addEventListener('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        // console.log('drop', event,event.dataTransfer.files,event.dataTransfer.items);
        iManager.handleDrop(event);
    });
});

onUnmounted(() => {
    const scrollView = scrollViewRef.value;
    if (scrollView) {
        scrollView.removeEventListener('scroll', scheduleWindowUpdate);
    }
    if (windowResizeObserver) {
        windowResizeObserver.disconnect();
        windowResizeObserver = null;
    }
    if (windowRaf) {
        cancelAnimationFrame(windowRaf);
        windowRaf = 0;
    }
    stopMarqueeListeners();
    if (modContainerRef.value) {
        modContainerRef.value.removeEventListener('click', handleMarqueeClickCapture, true);
    }
});

//===================== bôi đen chọn mod (kéo khung như Windows) ===========
// Nhấn giữ chuột trái trong lưới rồi kéo: khung chữ nhật hiện ra, mod nào
// nằm trong khung thì được chọn khi thả chuột. Kéo thường = chọn vàng (Áp
// Dụng, có luật 1 mod/1 loại); giữ Ctrl khi kéo = chọn xanh (hàng loạt),
// khung bôi cũng đổi sang xanh. Bôi đen BẬT/TẮT từng mod trong khung: mod
// chưa chọn thì chọn, mod đã chọn thì hủy chọn (bôi lại lần nữa là tắt).
// Chỉ chọn được thẻ đang thấy trên màn hình (thẻ ngoài khung nhìn chưa
// gắn vào trang nên không nằm trong vùng kéo được).
const MARQUEE_START_PX = 5;
const marquee = reactive({
    active: false,          // đã kéo quá ngưỡng, khung đang hiện
    batch: false,           // true = giữ Ctrl = chọn xanh
    startX: 0, startY: 0,   // điểm nhấn chuột (tọa độ trong khung lưới)
    x: 0, y: 0, w: 0, h: 0, // khung hiện tại (tọa độ trong khung lưới)
});
const marqueeBoxStyle = computed(() => ({
    left: marquee.x + 'px',
    top: marquee.y + 'px',
    width: marquee.w + 'px',
    height: marquee.h + 'px',
}));
let marqueePending = null; // { x, y } điểm nhấn chuột, chờ kéo quá ngưỡng
let marqueeHighlighted = []; // thẻ đang tô viền xem trước
let marqueeSuppressClick = false;
// Độ dày viền khung ngoài (.OO-box: 3px) — đọc lúc nhấn chuột, dùng
// cho mọi tọa độ trong lần kéo đó (xem marqueeFramePoint).
let marqueeBorderL = 0, marqueeBorderT = 0;

// Đổi tọa độ chuột sang tọa độ trong khung lưới: gốc là MÉP TRONG của
// viền khung ngoài (padding box — nơi phần tử absolute như #marquee-box
// neo vào), tức rect.left/top cộng độ dày viền. Không cộng viền thì
// khung lệch khỏi chuột đúng độ dày viền (3px). Điểm kẹp trong khung:
// chuột kéo ra ngoài khung thì điểm dính ở mép trong khung.
function marqueeFramePoint(event) {
    const frameEl = modCardManagerRef.value;
    const rect = frameEl.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(event.clientX - rect.left - marqueeBorderL, frameEl.clientWidth)),
        y: Math.max(0, Math.min(event.clientY - rect.top - marqueeBorderT, frameEl.clientHeight)),
    };
}

function handleMarqueeMouseDown(event) {
    // Chỉ chuột trái, không bắt đầu từ nút bấm (ghim...) hay ô nhập.
    if (event.button !== 0) return;
    if (event.target.closest('button, input, s-button, s-switch, s-icon-button, a')) return;
    const cs = getComputedStyle(modCardManagerRef.value);
    marqueeBorderL = parseFloat(cs.borderLeftWidth) || 0;
    marqueeBorderT = parseFloat(cs.borderTopWidth) || 0;
    marqueePending = marqueeFramePoint(event);
    marquee.batch = !!(event.ctrlKey || event.metaKey);
    window.addEventListener('mousemove', handleMarqueeMouseMove);
    window.addEventListener('mouseup', handleMarqueeMouseUp, { once: true });
}

function marqueeRectInClient() {
    const rect = modCardManagerRef.value.getBoundingClientRect();
    return {
        left: rect.left + marqueeBorderL + marquee.x,
        top: rect.top + marqueeBorderT + marquee.y,
        right: rect.left + marqueeBorderL + marquee.x + marquee.w,
        bottom: rect.top + marqueeBorderT + marquee.y + marquee.h,
    };
}

// Thẻ nào đang nằm trong khung (theo thứ tự hiển thị = thứ tự trong trang).
function marqueeIntersectedCards() {
    const box = marqueeRectInClient();
    const hit = [];
    for (const el of modContainerRef.value.querySelectorAll('.mod-item')) {
        const r = el.getBoundingClientRect();
        if (r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom) {
            hit.push(el);
        }
    }
    return hit;
}

function setMarqueeHighlight(cards) {
    for (const el of marqueeHighlighted) el.removeAttribute('marquee');
    marqueeHighlighted = cards;
    for (const el of cards) el.setAttribute('marquee', marquee.batch ? 'batch' : 'apply');
}

function handleMarqueeMouseMove(event) {
    if (!marqueePending) return;
    // Giữ/thả Ctrl giữa chừng thì đổi màu khung + loại chọn ngay.
    marquee.batch = !!(event.ctrlKey || event.metaKey);
    const p = marqueeFramePoint(event);
    const dx = p.x - marqueePending.x;
    const dy = p.y - marqueePending.y;
    if (!marquee.active) {
        if (Math.abs(dx) < MARQUEE_START_PX && Math.abs(dy) < MARQUEE_START_PX) return;
        marquee.active = true;
        marquee.startX = marqueePending.x;
        marquee.startY = marqueePending.y;
        document.body.style.userSelect = 'none';
    }
    marquee.x = Math.min(marquee.startX, p.x);
    marquee.y = Math.min(marquee.startY, p.y);
    marquee.w = Math.abs(dx);
    marquee.h = Math.abs(dy);
    setMarqueeHighlight(marqueeIntersectedCards());
}

function handleMarqueeMouseUp() {
    stopMarqueeListeners();
    marqueePending = null;
    document.body.style.userSelect = '';
    if (!marquee.active) return;
    const cards = marqueeIntersectedCards();
    const batch = marquee.batch;
    marquee.active = false;
    setMarqueeHighlight([]);
    if (cards.length === 0) return;
    // Thẻ vừa bấm vào cũng nhận sự kiện click khi thả chuột — chặn cú
    // bấm đó để bôi đen không làm đổi chọn của thẻ dưới chuột.
    marqueeSuppressClick = true;
    // Cờ chỉ chặn cú click NGAY SAU lần thả chuột này (nó chạy cùng lượt
    // với mouseup, nếu có). Hết lượt thì gỡ — trước đây cờ dính lại vì
    // kéo qua thẻ khác thì không có cú click nào để gỡ nó, nên cú bấm thẻ
    // TIẾP THEO của người dùng bị nuốt mất (bắt được lúc kiểm tra nút
    // hoàn tác 21/11: bôi đen xong bấm thẻ Grace không ăn).
    setTimeout(() => { marqueeSuppressClick = false; }, 0);
    const byId = new Map((mods.value || []).map(m => [m.id + '|' + m.name, m]));
    const hitMods = [];
    for (const el of cards) {
        const mod = byId.get(el.id);
        if (mod) hitMods.push(mod);
    }
    if (batch) {
        toggleBatchMods(hitMods);
    } else {
        toggleModsInOrder(iManager.data.modList || [], hitMods);
    }
    iManager.setCurrentMod(hitMods[hitMods.length - 1]);
}

function stopMarqueeListeners() {
    window.removeEventListener('mousemove', handleMarqueeMouseMove);
    window.removeEventListener('mouseup', handleMarqueeMouseUp);
}

// Chặn cú bấm (click) ngay sau 1 lần bôi đen — chạy ở pha bắt (capture)
// nên chặn trước khi thẻ kịp xử lý click.
function handleMarqueeClickCapture(event) {
    if (marqueeSuppressClick) {
        marqueeSuppressClick = false;
        event.stopPropagation();
        event.preventDefault();
    }
}


defineExpose({
    loadPreset,
    selectCharacter,
    applySearch
});
</script>

<style scoped>
#mod-container {
    width: 100%;
    height: fit-content;
    position: relative;
    display: grid;
    /* grid-column: span 4;
    grid-column-start: span 4; */
    grid-column-end: auto;
    grid-template-columns: repeat(auto-fill, var(--card-width, 350px));
    grid-row-end: auto;
    grid-auto-rows: calc(var(--card-width, 350px) * 280 / 350);
    gap: 12px;
    /* Căn giữa khối thẻ: chiều rộng vùng hiển thị hiếm khi chia hết cho
       (rộng thẻ + khe) nên luôn thừa một khoảng; để start thì khoảng
       thừa dồn hết sang phải thành vệt đen (Đạt thấy ở toàn màn hình
       19/11), center thì chia đều 2 bên. */
    justify-content: center;
    justify-items: center;
    min-height: 500px;

    /* Only the row height animates (compact mode). The windowing padding
    must change instantly when scrolling, so it is kept out of the
    transition — `all` would make it lag 0.5s behind every scroll. */
    transition: grid-auto-rows 0.5s;
}

/* Kiểu dọc: hàng cao = rộng × 1.4 như cũ. */
#mod-container[data-layout="vertical"] {
    grid-template-columns: repeat(auto-fill, var(--card-width, 250px));
    grid-auto-rows: calc(var(--card-width, 250px) * 1.4);
}

/* Màn hình trống khi lọc ra 0 mod: chữ + nút xóa bộ lọc, chiếm hết
   1 hàng lưới, căn giữa. */
.empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 280px;
    padding: 24px;
    box-sizing: border-box;
    text-align: center;
}

.empty-state-text {
    color: var(--s-color-on-surface-variant);
    font-size: 1rem;
}

/* Khung bôi đen chọn mod: viền + nền mờ, vàng = chọn Áp Dụng, xanh =
   chọn hàng loạt (giữ Ctrl). Không nhận chuột để lần kéo sau vẫn bắt
   đầu được từ chính chỗ khung đang phủ. */
#marquee-box {
    position: absolute;
    z-index: 50;
    pointer-events: none;
    border-radius: 8px;
}
#marquee-box.apply {
    border: 1px solid rgba(220, 254, 0, 0.95);
    background-color: rgba(220, 254, 0, 0.15);
}
#marquee-box.batch {
    border: 1px solid rgba(33, 150, 243, 0.95);
    background-color: rgba(33, 150, 243, 0.18);
}

#mod-card-manager {
    margin: 0 10px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-width: 250px;
    flex: 2;
    height: 100%;
    flex-wrap: nowrap;
    /* Khung bôi đen (#marquee-box) neo tuyệt đối vào khung này nên
       khung phải có position (xem chú thích đầu file). */
    position: relative;
}

/* (Đã bỏ khối .placeholder 300px dưới lưới — khối trống này làm cuối
   lưới thừa 300px khoảng đen khi lăn xuống dưới cùng, và làm cả danh
   sách ngắn (không đủ mod để lăn) vẫn lăn được (Đạt thấy 21/11). Bỏ
   thì lăn tới cuối chạm đúng thẻ mod cuối, ít mod thì khỏi lăn.) */


.refresh-placeholder {
    height: 100%;
    width: 100%;
    transition: height 0.5s;
}

.characterFilter {
    /* background-color: aqua; */
    border-radius: 10px;
}

/* #mod-container[compact="true"] {
    grid-column: span 4;
    grid-column-start: span 4;
    grid-column-end: auto;
    grid-auto-rows: 150px;
    grid-template-columns: repeat(auto-fill, 250px);
    gap: 12px;
    justify-content: start;
    justify-items: center;

    transition: all 0.5s;
} */
</style>