<!-- 这个是原本的上面的横幅，但是现在我将其封装起来，只留下接口 -->
<template>
    <div class="filter-row">
        <!-- Search box is slanted like the filter chips (outer skew -20deg),
             with the icon + input counter-skewed back so the text stays
             straight. (Skewing the input itself would slant/clip the text,
             which is why round 3 kept this box straight.)
             The input is a PLAIN <input>, not Sober s-text-field: Sober's
             field paints its own yellow border inside its shadow DOM (it
             ignores the border-color var when focused, and theming the
             primary color transparent would also hide the text caret), so
             the only way to have NO inner box at all — just the slanted
             outer frame — is a native input with transparent background
             and no border/outline. Focus is shown on the outer frame
             instead (:focus-within below). -->
        <div id="search-filter-chip" class="search-box-fixed">
          <div class="search-box-inner">
            <s-icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                    <path
                        d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z">
                    </path>
                </svg>
            </s-icon>
            <div id="search-input-container" style="display: flex;align-items: center;flex: 1;min-width: 0;margin-left: 8px;">
                <input id="search-input" type="text" class="search-input-field" @input="handleSearchInput" v-model="searchInput" />
            </div>
          </div>
        </div>
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
        <!-- Tất cả / Đã chọn: nút CỐ ĐỊNH cạnh ô tìm kiếm + nút Bộ lọc
             (cùng kiểu khối nghiêng như nút Bộ lọc), không nằm trong
             thanh tag lăn được nữa — Đạt muốn 2 nút này không trôi đi
             khi kéo/lăn thanh tag (20/11). Vàng lên khi đang chọn.
             Giữ nguyên id để selectItemByName + lúc mở app vẫn tìm
             được nút mà bấm. -->
        <div id="all-filter-chip" class="filter-toggle" :class="{ active: currentFilter === 'all' }" @click="selectFixedFilter('all')">
            <div class="filter-toggle-inner">
                <span>{{ allFilterLabel }}</span>
            </div>
        </div>
        <div id="selected-filter-chip" class="filter-toggle" :class="{ active: currentFilter === 'selected' }" @click="selectFixedFilter('selected')">
            <div class="filter-toggle-inner">
                <span>{{ selectedFilterLabel }}</span>
            </div>
        </div>
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
        <horizontalScrollBar class="chip-radio-bar" id="character-filter-bar" style="height: fit-content;">
            <!-- Chỉ còn tag nhân vật — Tất cả / Đã chọn đã dời ra nút
                 cố định bên trái (xem trên). -->
            <chipButton v-for="(item, index) in characterList" :key="index" :text="chipLabel(item)" :filterCharacter="item"
                @click="updateSliderByEvent($event)"></chipButton>
            <div class="slider OO-color-gradient" :style="sliderStyle" v-show="currentFilter !== 'all' && currentFilter !== 'selected'"></div>
        </horizontalScrollBar>
    </div>
</template>

<script setup lang="ts">
import horizontalScrollBar from './horizontalScrollBar.vue';
import { ref, reactive, watch, Ref, onMounted, onBeforeUnmount, nextTick, computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import chipButton from './chipButton.vue';
import chipRadioBar from './chipRadioBar.vue';
import { MOD_TAGS, normalizeTypeFilter } from '../../helper/ModTag';
import { selectedModIdSet } from '../../helper/SelectedMods';
import { EventType, EventSystem } from '../../helper/EventSystem';
import IManager from '../../electron/IManager';
const iManager = new IManager();

import { g_config_vue } from '../../electron/IManager';
import { g_data_vue } from '../../electron/IManager';

const lastClickedElement = ref<HTMLElement | null>(null);
const searchInput = ref<string>('');
// Lọc nhân vật đang chọn: 'all' | 'selected' | tên nhân vật. Nút Tất
// cả / Đã chọn vàng theo biến này; thanh vàng chỉ hiện khi đang chọn
// 1 nhân vật cụ thể (không thì nó không có chip nào để bám vào).
const currentFilter = ref<string>('all');

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
const characterList = g_data_vue.characterList as Ref<string[]>;

//-=============== Hiện số lượng mod trên chip ===============//
// Công tắc trong bảng lọc (Đạt dặn 20/11): bật thì mỗi chip nhân vật hiện
// thêm số mod của nhân vật đó trong ngoặc, vd Ellen (24); Tất cả hiện
// tổng số mod, Đã chọn hiện số mod đang bật vàng. Tắt thì chip về tên
// trần như cũ. Lựa chọn lưu trong config nên mở app lại vẫn nhớ.
// Số đếm theo TOÀN BỘ kho mod (không theo lọc tag/tìm kiếm đang bật)
// để con số ổn định, đúng nghĩa "nhân vật này có bao nhiêu mod".
const showChipCounts = g_config_vue.showChipCounts;
// g_data_vue.modList KHÔNG bao giờ được đồng bộ (IManager bỏ qua modList
// khi ghi vào data để khỏi sao chép mảng mod lớn — xem set trap ở
// IManager.js) nên đếm từ iManager.data.modList (mảng thật); mỗi lần
// danh sách đổi, sự kiện modListChanged tăng modListVersion để các
// computed dưới đây tính lại (giống cách modCardManager tải lại lưới).
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
const totalModCount = computed(() => {
    void modListVersion.value;
    return iManager.data.modList.length;
});
const chipLabel = (name) => showChipCounts.value
    ? `${name} (${modCountsByCharacter.value[name] || 0})`
    : name;
const allFilterLabel = computed(() => showChipCounts.value
    ? `${t('buttons.all')} (${totalModCount.value})`
    : t('buttons.all'));
const selectedFilterLabel = computed(() => showChipCounts.value
    ? `${t('buttons.selected')} (${selectedModIdSet.size})`
    : t('buttons.selected'));
function toggleChipCounts() {
    iManager.config.showChipCounts = !g_config_vue.showChipCounts.value;
    saveFilterSettings();
}
// Chip đổi rộng khi thêm/bớt số lượng → thanh vàng bám sai vị trí cũ,
// đo lại sau khi Vue vẽ xong (giống lúc đổi ngôn ngữ).
watch(showChipCounts, () => { nextTick(repositionSlider); });
watch(language, (newValue) => {
    // 刷新一下滑块，因为不同语言的长度不一样
    const elment = lastClickedElement.value;
    if (elment) updateSlider(elment);
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
}, { immediate: true });

//-=============== 定义事件 ===============
// 1. itemChange事件，发生在筛选项发生变化时
// 2. filterChangeToAll事件，发生在筛选项为全部时
// 3. filterChangeToSelected事件，发生在筛选项为已选时
// 4. filterChangeToSearch事件，发生在筛选项为搜索时，包含一个参数，表示搜索的内容

const emit = defineEmits([
    'itemChange',
    'filterChangeToAll',
    'filterChangeToSelected',
    'filterChangeToSearch'
]);

//-=============== 滑块 ===============
const sliderStyle = reactive({
    width: '0px',
    left: '0px'
});
const updateSlider = (element) => {
    //debug
    // console.log(`updateSlider: `, element)
    if (!element) return;
    lastClickedElement.value = element;
    sliderStyle.width = `${element.offsetWidth}px`;
    sliderStyle.left = `${element.offsetLeft}px`;
    // Lần đo đầu tiên lúc mới mở app có thể chạy khi bố cục chưa ổn định
    // (chữ chưa tải xong) nên thanh vàng bị lệch khỏi tag; đo lại sau 2 khung
    // hình để nó khớp đúng vị trí tag. Chỉ đo lại khi tag đó vẫn đang chọn.
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if (lastClickedElement.value === element) {
            sliderStyle.width = `${element.offsetWidth}px`;
            sliderStyle.left = `${element.offsetLeft}px`;
        }
    }));
};

// Chữ tải xong / cửa sổ đổi kích thước đều có thể làm tag đổi rộng → đo lại
// thanh vàng cho khớp.
const repositionSlider = () => {
    if (lastClickedElement.value) updateSlider(lastClickedElement.value);
};
onMounted(() => {
    // Config cũ còn lưu loại 'outfit' (tên cũ trước khi có tag): đổi 1 lần
    // thành 'character' cho khớp tag mới.
    if (g_config_vue.modTypeFilter.value === 'outfit') {
        iManager.config.modTypeFilter = 'character';
        saveFilterSettings();
    }
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(repositionSlider);
    }
    window.addEventListener('resize', repositionSlider);
    // Lúc mới mở app, đặt trạng thái chọn theo nhân vật đang chọn: Tất
    // cả / Đã chọn thì chỉ vàng nút cố định (thanh vàng ẩn vì không có
    // chip nhân vật nào để bám); nhân vật cụ thể thì nhảy thanh tới tag.
    nextTick(() => {
        const current = iManager.temp.currentCharacter || 'all';
        if (current === 'all' || current === 'selected') {
            currentFilter.value = current;
            lastClickedElement.value = null;
        } else {
            selectItemByName(current);
        }
    });
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', repositionSlider);
});

// Bấm nút cố định Tất cả / Đã chọn: đổi lọc, vàng nút đó, ẩn thanh
// vàng (không còn chip nhân vật nào đang chọn), bỏ đánh dấu các tag
// nhân vật. Bấm lại nút đang chọn thì không làm gì.
const selectFixedFilter = (kind) => {
    if (currentFilter.value === kind) return;
    currentFilter.value = kind;
    lastClickedElement.value = null;
    const bar = document.getElementById('character-filter-bar');
    if (bar) {
        for (const child of bar.children as unknown as HTMLElement[]) {
            child.setAttribute('checked', 'false');
        }
    }
    if (kind === 'all') emit('filterChangeToAll');
    else emit('filterChangeToSelected');
};

const updateSliderByEvent = (e) => {
    const elment = e.currentTarget;
    //debug
    // console.log(`updateSlider: `, elment)
    if (!elment) return;
    // debug
    // console.log(`updateSliderByEvent: `, elment, lastClickedElement.value)

    // Thanh tag giờ chỉ còn tag nhân vật (Tất cả / Đã chọn đã dời ra
    // nút cố định, bấm qua selectFixedFilter).
    const filterCharacter = elment.getAttribute('filterCharacter');
    // 如果 lastClickedElement和当前点击的元素相同，则不处理
    if (lastClickedElement.value != elment && filterCharacter) {
        currentFilter.value = filterCharacter;
        emit('itemChange', filterCharacter);
    }

    // 将element的checked属性设置为true，并且将其他的设置为false
    const children = elment.parentElement?.children;
    if (!children) return;
    for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        if (child !== elment) {
            child.setAttribute('checked', 'false');
        } else {
            child.setAttribute('checked', 'true');
        }
    }

    // 更新滑块
    updateSlider(elment);
};

//-=============== 搜索按钮 ===============
const handleSearchInput = (e) => {
    // 发送搜索请求
    const searchText = e.target.value;
    if (searchText) {
        emit('filterChangeToSearch', searchText);
    } else {
        // 如果搜索框为空，则发送空搜索请求
        emit('filterChangeToAll');
    }
}

//-=============== 对外的接口 ===============
const selectItemByName = (name) => {
    // 对于all-filter-chip和selected-filter-chip的处理
    if (name === 'all') {
        const allFilterChip = document.getElementById('all-filter-chip');
        if (allFilterChip) {
            allFilterChip.click();
        }
        return;
    } else if (name === 'selected') {
        const selectedFilterChip = document.getElementById('selected-filter-chip');
        if (selectedFilterChip) {
            selectedFilterChip.click();
        }
        return;
    }
    const index = characterList.value.indexOf(name);
    if (index === -1) return;
    // Tag nhân vật giờ là con thứ index của thanh (Tất cả / Đã chọn đã
    // dời ra ngoài thanh nên không còn +2 nữa; thanh trượt là con cuối,
    // sau các chip, nên không lệch chỉ số).
    // 主要的目的是滑块同步，lastClickedElement.value = elment
    const characterFilterBar = document.getElementById("character-filter-bar");
    if (!characterFilterBar) return;
    const elment = characterFilterBar.children[index] as HTMLElement;
    if (!elment) return;
    // console.log(`selectItemByName: `, name, index, elment)
    lastClickedElement.value = elment;
    // 直接调用updateSliderByEvent
    updateSliderByEvent({ currentTarget: elment });
};

// EventSystem.on(EventType.currentCharacterChanged, (character) => {
//     // 对于all-filter-chip和selected-filter-chip的处理
//     if (character === 'all') {
//         const allFilterChip = document.getElementById('all-filter-chip');
//         if (allFilterChip) {
//             allFilterChip.click();
//         }
//     } else if (character === 'selected') {
//         const selectedFilterChip = document.getElementById('selected-filter-chip');
//         if (selectedFilterChip) {
//             selectedFilterChip.click();
//         }
//     }
//     selectItemByName(character);
// });


defineExpose({
    selectItemByName
});











</script>

<style scoped>
.filter-row {
    display: flex;
    align-items: center;
    width: 100%;
    /* Bảng lọc overlay định vị theo hàng này (absolute) và phải nổi lên
       trên lưới mod ở dưới (z-index). */
    position: relative;
    z-index: 30;
    /* Khe dưới hàng lọc với lưới thẻ mod ở dưới — trước đây 2 khối dí
       sát nhau quá (Đạt báo 19/11). */
    margin-bottom: 10px;
    /* Không để khe: mép trái thanh tag đã nghiêng cùng góc 20° với ô
    tìm kiếm (xem .chip-radio-bar) nên hai mép song song, thanh tag có
    thể dí sát ô tìm kiếm mà không chèn lên nhau — Đạt muốn sát vào
    (19/11). Thanh tag còn lấn trái thêm 7px bằng margin; tag đầu ngồi
    cách ô tìm kiếm ~9px (đủ nhìn thấy khe, xem padding-left ở dưới). */
    gap: 0;
}

.search-box-fixed {
    /* Rộng 160px (Đạt dặn 19:23 19/11: ngắn lại xíu cho gọn; trước đây
       200px). Ngắn ô thì thanh tag có thêm chỗ, đỡ phải lăn. */
    width: 160px;
    min-width: 0;
    flex-shrink: 0;
    height: 35px;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0px 16px;
    border-radius: 8px;
    /* Nền phải nhìn thấy được: surface-container (8,8,8) gần như trùng màu
       nền hàng (12,12,12) nên ô tìm kiếm chỉ còn thấy viền méo, phần nền
       trông như nền thẳng. surface-container-low (34,34,34 — cùng tông
       với các hàng cài đặt) để khối nền méo hiện rõ như viền.
       (surface-container-high đo ra vẫn chỉ (11,11,11) nên không dùng.) */
    background-color: var(--s-color-surface-container-low);
    border: 1px solid var(--s-color-outline-variant);
    overflow: hidden;
    /* Nghiêng như tag chip (-20deg); nội dung bên trong nghiêng ngược lại
       để chữ và ô nhập vẫn thẳng. */
    transform: skew(-20deg);
}

/* Ô nhập đang gõ thì VIỀN MÉO bên ngoài sáng lên (thay cho viền của ô
   nhập đã bỏ): chỉ còn đúng 1 viền là khung méo. */
.search-box-fixed:focus-within {
    border-color: var(--s-color-primary);
}

/* Nút Bộ lọc: cùng kiểu khối nghiêng -20° cao 35px như ô tìm kiếm, chữ
   và biểu tượng nghiêng ngược lại cho thẳng. Cách ô tìm kiếm 8px; thanh
   tag dí sát mép phải nút nhờ margin-left -7px của nó (như trước đây
   dí sát ô tìm kiếm). */
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

/* Bảng lọc overlay: thả xuống từ nút Bộ lọc, phủ lên lưới mod chứ
   không đẩy nội dung. Mép trái thẳng với mép trái nút (= ô tìm kiếm
   160px + khe 8px; đổi rộng ô tìm kiếm thì đổi cả số này). Bảng ôm
   vừa nội dung (chỉ rộng bằng hàng chip dài nhất cộng đệm) — trước
   đây kéo dài hết hàng lọc nên thừa cả một khoảng trống bên phải
   (Đạt báo 19/11). Giới hạn để không tràn mép phải hàng lọc; cửa sổ
   hẹp quá thì hàng chip tự lăn ngang như cũ. */
.filter-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 168px;
    width: fit-content;
    max-width: calc(100% - 168px);
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

.search-input-field {
    flex: 1;
    width: 100%;
    min-width: 0;
    min-height: 25px;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    box-shadow: none;
    color: var(--s-color-on-surface);
    font: inherit;
    caret-color: var(--s-color-on-surface);
}

.search-box-inner {
    transform: skew(20deg);
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
}

#search-filter-chip s-icon {
    flex-shrink: 0;
}

.chip-radio-bar {
    display: flex;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    position: relative;
    height: fit-content;
    /* Lề trái 16px: tag đầu (lúc chưa kéo) ngồi cách ô tìm kiếm ~9px,
       vừa đủ nhìn thấy khe mà vẫn sát như Đạt muốn; đồng thời giữ tag
       đầu nằm phải đường cắt nghiêng ở dưới (nó cách đường cắt 3px). */
    padding: 3px 10px 3px 16px;
    flex: 1;
    min-width: 0;
    min-height: 35px;
    /* Cách nút Bộ lọc 8px (trước đây lấn trái 7px dí sát — từ khi có
       nút Bộ lọc ở giữa, thanh tag dí sát nút quá, Đạt báo 19/11).
       Mép cắt nghiêng vẫn song song với mép phải nút nên không chèn
       lên nhau. */
    margin-left: 8px;
    /* Mép trái cắt nghiêng theo ô tìm kiếm (cùng góc 20°): khi lăn
       chuột, tag trượt vào từ phải bị cắt theo đường này, trông như
       chui ra sau mép ô tìm kiếm. Đường cắt nằm cách mép phải ô tìm
       kiếm 6px suốt chiều cao — đủ nhìn thấy khe. Đường cắt cũ
       (7.5px/-7.5px) tính cho thời khe còn 18px; từ khi thanh dí sát
       ô (1.5.13) nó trùng gần như đúng mép ô (chỉ 0.5px ở mép trên)
       nên tag lúc lăn trông như dí sát vào ô. Tag đầu lúc chưa kéo
       vẫn hiện đủ (mép trái của nó nằm phải đường cắt 3px nhờ lề
       trái 16px ở trên). */
    clip-path: polygon(14px 0, 100% 0, 100% 100%, -1px 100%);

    >* {
        margin-right: 5px;
        transition: all 0.1s ease-in-out;
    }
}

.slider {
    /* height: 35px; */
    transform: skew(-20deg);
    z-index: 0;
    padding: 0px 16px;
    box-sizing: border-box;
    border: 1px solid #00000000;
    border-radius: 8px;
    white-space: nowrap;
    overflow: hidden;

    position: absolute;
    height: 35px;
    top: 3px;
    transform: skew(-20deg);
    background-color: var(--s-color-primary);
    transition: left 0.3s, width 0.3s;

    will-change: left, width;
}
</style>