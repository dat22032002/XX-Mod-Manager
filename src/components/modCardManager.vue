<template>
    <div id="mod-card-manager" class="OO-box" ref="modCardManagerRef">
        <!-- <chipRadioBar class="characterFilter" :items="characters" @itemChange="handleFilterChange"
            :translatedItems="translateCharacters" ref="characterFilterRef" /> -->
        <ModCharacterFilter class="characterFilter" @itemChange="handleFilterChange" ref="characterFilterRef" @filterChangeToAll="handleFilterChangeToAll"
            @filterChangeToSelected="handleFilterChangeToSelected" @filterChangeToSearch="handleFilterChangeToSearch" />
        <!-- Giao diện lọc theo loại mod + sắp xếp (nút "Bộ lọc" + bảng
             overlay) nằm trong ModCharacterFilter; chỗ này chỉ đọc lựa
             chọn đã lưu trong config để lọc/xếp danh sách (xem
             filteredMods). -->
        <s-scroll-view ref="scrollViewRef" style="overflow-x:hidden;overflow-y: auto;border-radius: 0 0 10px 10px;">
            <div class="refresh-placeholder" ref="refreshPlaceholderRef"></div>
            <div id="mod-container" :compact="compactMode" ref="modContainerRef" :style="containerStyle">
                <modCard v-for="mod in windowMods" :key="mod.id" :modRef="mod" :lazyLoad=true
                    :compactMode="compactMode" :cardWidth="effectiveCardWidth" :ref="setModCardRef(mod.id)" />
            </div>
            <div class="placeholder"></div>
        </s-scroll-view>
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
import ModCharacterFilter from './modCharacterFilter.vue';
import { computeColumns, computeWindow, CARD_GAP, OVERSCAN_ROWS } from './modWindowing.js';
import { selectedModIdSet, setSelectedModIdsExclusive, getModTag } from '../../helper/SelectedMods';
import { MOD_TAGS, normalizeTypeFilter } from '../../helper/ModTag';

const iManager = new IManager();

// 接受参数
const props = defineProps({
    compactMode: Boolean,
    // Chiều rộng thẻ ở dạng lưới (200/250/300/350/400/450).
    cardWidth: {
        type: Number,
        default: 400
    }
});

// 定义 mods 变量
const mods = ref([]);

const characterFilterRef = useTemplateRef('characterFilterRef');
const currentCharacter = g_temp_vue.currentCharacter;

watch(currentCharacter, (newVal) => {
    if (newVal) {
        //debug
        console.log('currentCharacter changed:', newVal);
        characterFilterRef.value.selectItemByName(newVal);
        // Snapshot the selection when the 'selected' filter is applied, so
        // the list behaves as before: toggling a card while viewing
        // 'selected' does not make it vanish until the filter is re-applied.
        if (newVal === 'selected') {
            selectedSnapshot.value = new Set(selectedModIdSet);
        }
    }
});

// 切换语言的时候，all 和 全部 的长度不一样，所以需要切换
// (Thanh trượt hàng chip lọc/xếp đặt lại trong modCharacterFilter khi
// đổi ngôn ngữ — thanh đó nằm ở bảng overlay bên đó.)
watch(g_config_vue.language, (newVal) => {
    setTimeout(() => {
        characterFilterRef.value.selectItemByName(currentCharacter.value);
    }, 0);
});

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
// modCharacterFilter; chỗ này chỉ đọc lựa chọn đã lưu trong config để
// lọc/xếp danh sách. Tag mod theo getModTag (SelectedMods): Character,
// Skin, Weapon, Effect, Accessory — chuẩn duy nhất từ 1.5.18, thay tiền
// tố tên thư mục. Thêm tag mới thì thêm vào MOD_TAGS + 1 khóa locale
// modTag.*.
const SORT_VALUES = ['default', 'name-asc', 'name-desc', 'time-desc', 'time-asc'];

// Đọc qua g_config_vue (lưu trong config.json nên mở app lại vẫn giữ);
// giá trị lạ trong config cũ thì về mặc định ('outfit' cũ thành
// 'character').
const typeFilter = computed(() => normalizeTypeFilter(g_config_vue.modTypeFilter.value));
const sortBy = computed(() =>
    SORT_VALUES.includes(g_config_vue.modSortBy.value) ? g_config_vue.modSortBy.value : 'default');

//-==================== 只渲染视口附近的卡片（虚拟列表） ====================//
// The grid used to mount every mod card at once; with hundreds of mods that
// dominated startup time. Now only the rows near the viewport are mounted
// (plus a small overscan buffer), and blank padding above/below the mounted
// rows keeps the scrollbar and scroll positions exactly as if the whole list
// were mounted. The math lives in ./modWindowing.js so it can be checked
// without a browser.

// Current search text, mirrored from handleFilterChangeToSearch. The list is
// filtered in Vue state (not only by hiding DOM nodes) because unmounted
// cards have no DOM node to hide.
const searchText = ref('');
// Snapshot of the selection when the 'selected' filter is applied (see the
// currentCharacter watcher above and loadMods below).
const selectedSnapshot = ref(null);

const filteredMods = computed(() => {
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
    // Sắp xếp: ghim luôn lên đầu, sau đó theo kiểu xếp đã chọn (mặc định
    // giữ thứ tự tải vào như trước; sort của JS là ổn định nên mod ngang
    // nhau không bị xáo trộn). slice() để không sửa mảng gốc.
    const sort = sortBy.value;
    return result.slice().sort((a, b) => {
        const pinDiff = Number(!!b.pinned) - Number(!!a.pinned);
        if (pinDiff !== 0) return pinDiff;
        switch (sort) {
            case 'name-asc': return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
            case 'name-desc': return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
            case 'time-desc': return (b.addedMs || 0) - (a.addedMs || 0);
            case 'time-asc': return (a.addedMs || 0) - (b.addedMs || 0);
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

// Rộng thẻ hợp lệ: chỉ nhận 1 trong 6 nấc (200/250/300/350/400/450);
// giá trị lạ trong config cũ thì về 400 để lưới không vỡ.
const ZOOM_LEVELS = [200, 250, 300, 350, 400, 450];
const effectiveCardWidth = computed(() =>
    ZOOM_LEVELS.includes(props.cardWidth) ? props.cardWidth : 400
);

// Kiểu của khung lưới: khoảng đệm vẽ từng phần + biến rộng thẻ. Thẻ lưới
// đọc --card-width để tự co giãn theo mức phóng to.
const containerStyle = computed(() => {
    return {
        paddingTop: windowPaddingTop.value + 'px',
        paddingBottom: windowPaddingBottom.value + 'px',
        '--card-width': effectiveCardWidth.value + 'px',
    };
});

function updateWindow() {
    const container = modContainerRef.value;
    const scrollView = scrollViewRef.value;
    if (!container || !scrollView) return;
    const list = filteredMods.value;
    // Số cột theo chiều rộng thẻ hiện tại.
    const columns = computeColumns(container.clientWidth, effectiveCardWidth.value, CARD_GAP);
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
const loadMods = async () => {
    mods.value = iManager.data.modList

    // 检查是否选择了预设，如果选择了预设，则加载预设
    // preset Mặc định cũng được khôi phục từ config (defaultPresetModIds)，
    // không bỏ qua như trước nữa — nếu không lựa chọn ở Mặc định sẽ mất
    // mỗi lần mở app / chuyển preset / làm mới.
    if (iManager.temp.currentPreset) {
        await loadPreset(iManager.temp.currentPreset);
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

// 定义 handleFilterChange 方法
const handleFilterChange = (character) => {
    // A character chip was clicked: any active search is over.
    searchText.value = '';
    iManager.setCurrentCharacter(character);
};

const handleFilterChangeToAll = () => {
    iManager.setCurrentCharacter('all');
    searchText.value = '';
};

const handleFilterChangeToSelected = () => {
    iManager.setCurrentCharacter('selected');
    searchText.value = '';
};

const handleFilterChangeToSearch = (search) => {
    console.log('handleFilterChangeToSearch', search);
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
    // chuyển chip đang chọn khi từ khóa khớp đúng 1 nhân vật, để thanh
    // trượt trong hàng phím lọc theo kịp từ khóa tìm kiếm.
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



async function loadPreset(presetName) {
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
    setSelectedModIdsExclusive(mods.value || [], modIds);

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

EventSystem.on('currentPresetChanged', (preset) => {
    loadPreset(preset);
});




// 定义动画效果

const animate = new Group();
const modContainerRef = useTemplateRef('modContainerRef');

// Chiều cao 1 hàng theo mức phóng to: thường = rộng × 0.75; gọn = rộng × 0.45
// (thẻ 400×300 — Đạt dặn 20/11; phải khớp CSS .mod-item không lưới sẽ lệch).
function targetRowHeight() {
    return props.compactMode ? effectiveCardWidth.value * 0.45 : effectiveCardWidth.value * 0.75;
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
    await loadMods();
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
    // Đặt chiều cao hàng theo mức phóng to/kiểu hiển thị đã lưu ngay từ đầu
    // (không thì lần đầu mở app vẫn dùng cỡ mặc định của CSS).
    syncRowHeight();
    updateWindow();

    // Thanh trượt hàng chip lọc/xếp đo lại mỗi lần bảng overlay bung ra
    // (modCharacterFilter) — bảng đóng lúc mở app nên không đo ở đây.

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
});


defineExpose({
    loadPreset
});
</script>

<style scoped>
#mod-container {
    width: 100%;
    height: fit-content;

    display: grid;
    /* grid-column: span 4;
    grid-column-start: span 4; */
    grid-column-end: auto;
    grid-template-columns: repeat(auto-fill, var(--card-width, 400px));
    grid-row-end: auto;
    grid-auto-rows: calc(var(--card-width, 400px) * 0.75);
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

#mod-card-manager {
    margin: 0 10px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    min-width: 250px;
    flex: 2;
    height: 100%;
    flex-wrap: nowrap;
}



.placeholder {
    height: 300px;
    width: 100%;
}


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