<template>
    <div id="mod-card-manager" class="OO-box" ref="modCardManagerRef">
        <!-- <chipRadioBar class="characterFilter" :items="characters" @itemChange="handleFilterChange"
            :translatedItems="translateCharacters" ref="characterFilterRef" /> -->
        <ModCharacterFilter class="characterFilter" @itemChange="handleFilterChange" ref="characterFilterRef" @filterChangeToAll="handleFilterChangeToAll"
            @filterChangeToSelected="handleFilterChangeToSelected" @filterChangeToSearch="handleFilterChangeToSearch" />
        <s-scroll-view ref="scrollViewRef" style="overflow-x:hidden;overflow-y: auto;border-radius: 0 0 10px 10px;">
            <div class="refresh-placeholder" ref="refreshPlaceholderRef"></div>
            <div id="mod-container" :compact="compactMode" ref="modContainerRef"
                :style="{ paddingTop: windowPaddingTop + 'px', paddingBottom: windowPaddingBottom + 'px' }">
                <modCard v-for="mod in windowMods" :key="mod.id" :modRef="mod" :lazyLoad=true :compactMode="compactMode"
                    :ref="setModCardRef(mod.id)" />
            </div>
            <div class="placeholder"></div>
        </s-scroll-view>
    </div>
</template>

<script setup>
import 'sober';
import chipRadioBar from './chipRadioBar.vue';
import { ref, onMounted, onUnmounted, computed, useTemplateRef, watch, reactive, nextTick } from 'vue';
import modCard from './modCard.vue';
import { Tween, Group } from "@tweenjs/tween.js";
import IManager, { g_data_vue } from '../../electron/IManager';
import { g_config_vue, g_temp_vue } from '../../electron/IManager';
import { EventType, EventSystem } from '../../helper/EventSystem';
import ModCharacterFilter from './modCharacterFilter.vue';
import { computeColumns, computeWindow, CARD_WIDTH, CARD_GAP, OVERSCAN_ROWS } from './modWindowing.js';
import { selectedModIdSet, setSelectedModIds } from '../../helper/SelectedMods';

const iManager = new IManager();

// 接受参数
const props = defineProps({
    compactMode: Boolean
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
        changeFilter(newVal);
        // Snapshot the selection when the 'selected' filter is applied, so
        // the list behaves as before: toggling a card while viewing
        // 'selected' does not make it vanish until the filter is re-applied.
        if (newVal === 'selected') {
            selectedSnapshot.value = new Set(selectedModIdSet);
        }
    }
});

// 切换语言的时候，all 和 全部 的长度不一样，所以需要切换
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
    // Search: same rule as changeFilterToSearch (character-prefix spec) —
    // a search matching exactly one character filters by that character,
    // any other non-empty search matches nothing.
    const keyword = (searchText.value || '').trim().toLowerCase();
    if (keyword !== '') {
        const characterList = g_data_vue.characterList;
        const characterNames = (characterList && characterList.value) || [];
        const matched = characterNames.filter(name => name && name.toLowerCase().startsWith(keyword));
        if (matched.length !== 1) return [];
        const character = matched[0];
        return list.filter(mod => mod.character === character);
    }
    const character = currentCharacter.value;
    if (!character || character === 'all') return list;
    if (character === 'selected') {
        const snapshot = selectedSnapshot.value;
        if (snapshot) return list.filter(mod => snapshot.has(mod.id));
        return list.filter(mod => selectedModIdSet.has(mod.id));
    }
    return list.filter(mod => mod.character === character);
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

function updateWindow() {
    const container = modContainerRef.value;
    const scrollView = scrollViewRef.value;
    if (!container || !scrollView) return;
    const list = filteredMods.value;
    const columns = computeColumns(container.clientWidth, CARD_WIDTH, CARD_GAP);
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

    // 检查是否选择了角色，如果选择了角色，则筛选角色
    // 这里再刷新一次的原因是，因为 mod卡片全部重新加载了之后，之前的筛选就失效了
    // debug
    console.log('changeFilter to currentCharacter:', currentCharacter.value);
    if (currentCharacter.value) {
        setTimeout(() => {
            changeFilter(currentCharacter.value);
        }, 0);
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

let wasSearching = false;
// 定义 handleFilterChange 方法
const handleFilterChange = (character) => {
    // A character chip was clicked: any active search is over.
    searchText.value = '';
    wasSearching = false;
    iManager.setCurrentCharacter(character);
};

const handleFilterChangeToAll = () => {
    iManager.setCurrentCharacter('all');
    searchText.value = '';
    if (wasSearching) {
        wasSearching = false;
        changeFilterToSearch('');
    } else {
        changeFilter('all');
    }
};

const handleFilterChangeToSelected = () => {
    iManager.setCurrentCharacter('selected');
    searchText.value = '';
    if (wasSearching) {
        wasSearching = false;
        changeFilterToSearch('');
    } else {
        changeFilter('selected');
    }
};

const handleFilterChangeToSearch = (search) => {
    console.log('handleFilterChangeToSearch', search);
    if (!search || !search.trim()) {
        // Blank search (e.g. only spaces): same as clearing the search.
        // Without this reset, filteredMods would fall back to the previous
        // character filter and the list would not show everything.
        searchText.value = '';
        wasSearching = false;
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
    wasSearching = true;
};

async function changeFilterToSearch(search){
    // 筛选出所有 mod-item 元素
    const modItems = document.querySelectorAll('.mod-item');
    // 如果搜索内容为空，则显示所有 mod-item 元素
    if (search === '') {
        modItems.forEach(item => {
            item.classList.remove('hidden');
        });
        return;
    }
    // 搜索不区分大小写：统一转小写再比较
    const keyword = search.trim().toLowerCase();
    if (keyword === '') {
        modItems.forEach(item => {
            item.classList.remove('hidden');
        });
        return;
    }
    // 只按角色名称的开头几个字母匹配
    const characterList = g_data_vue.characterList;
    const characterNames = (characterList && characterList.value) || [];
    const matched = characterNames.filter(name => name && name.toLowerCase().startsWith(keyword));
    // 开头字母撞到 0 个或多个角色时，什么都不显示
    if (matched.length !== 1) {
        modItems.forEach(item => {
            item.classList.add('hidden');
        });
        return;
    }
    // 唯一匹配：像点击该角色标签一样选中它，显示该角色的 mod
    iManager.setCurrentCharacter(matched[0]);
}

async function changeFilter(character) {
    // 通过设置 card 的 class 属性来实现筛选

    //debug
    console.log('changeFilter', character);
    if (character === 'all') {
        // for (const [key, value] of Object.entries(modCardRefs.value)) {
        //     if (!value) continue;
        //     value.$el.classList.remove('hidden');
        // }
        // 使用querySelectorAll 会比遍历快很多
        document.querySelectorAll('.mod-item.hidden').forEach(item => {
            item.classList.remove('hidden');
        });
    } else if (character === 'selected') {
        // for (const [key, value] of Object.entries(modCardRefs.value)) {
        //     if (!value) continue;
        //     if (value.$el.getAttribute('clicked') === 'true') {
        //         value.$el.classList.remove('hidden');
        //     } else {
        //         value.$el.classList.add('hidden');
        //     }
        // }
        document.querySelectorAll('.mod-item').forEach(item => {
            if (item.getAttribute('clicked') === 'true') {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    } else {
        // for (const [key, value] of Object.entries(modCardRefs.value)) {
        //     if (!value) continue;
        //     if (value.$props.character === character) {
        //         value.$el.classList.remove('hidden');
        //     } else {
        //         value.$el.classList.add('hidden');
        //     }
        // }

        // return;
        document.querySelectorAll('.mod-item').forEach(item => {
            item.classList.add('hidden');
        });
        document.querySelectorAll(`.mod-item[character="${character}"]`).forEach(item => {
            item.classList.remove('hidden');
        });
    }

    // 重新触发 observer
    // observeMods();
    // 它必须要有一个“进入视口”的动作，否则不会触发 observer
    // 为了触发 observer，我们可以手动触发一次滚动事件
    window.dispatchEvent(new Event('scroll'));
}



async function loadPreset(presetName) {
    const preset = await iManager.loadPreset(presetName);
    const mods = preset?.getModIds() || [];
    // Record the preset's selection up front. Cards that are not mounted
    // (scrolled out of view) read this when they mount, so the preset still
    // applies to them; mounted cards are flipped below as before.
    setSelectedModIds(mods);
    //遍历modCardRefs，如果 满足 mods.includes(mod.name) ^ mod.clicked 则调用click
    for (const [key, value] of Object.entries(modCardRefs.value)) {
        if (!value) continue;
        const clicked = value.$el.getAttribute('clicked') == 'true';
        if (mods.includes(key) ^ clicked) {
            value.click();
        }
    }

    //debug
    console.log('loadPreset', presetName);
    // handleFilterChange('已选择');
};

// Dồn các lần tải lại danh sách: đặt nhân vật hàng loạt / lúc mở app có nhiều
// mod mới bắn N sự kiện liên tiếp — chờ 100ms sau sự kiện cuối rồi tải lại
// 1 lần duy nhất, thay vì tải lại N lần. Nhân vật của sự kiện cuối được giữ
// lại để chuyển bộ lọc về đúng nhân vật đó sau khi tải lại (như trước đây).
let reloadDebounceTimer = null;
let pendingCharacter = null;
const scheduleReload = (character = null) => {
    if (character) {
        pendingCharacter = character;
    }
    if (reloadDebounceTimer) {
        clearTimeout(reloadDebounceTimer);
    }
    reloadDebounceTimer = setTimeout(async () => {
        reloadDebounceTimer = null;
        mods.value = null;
        await loadMods();
        if (pendingCharacter) {
            iManager.setCurrentCharacter(pendingCharacter);
            pendingCharacter = null;
        }
        observeMods();
    }, 100);
};

EventSystem.on('modInfoChanged', (modInfo) => {
    //debug
    console.log('get modInfoChanged, reload display mods');
    scheduleReload(modInfo ? modInfo.character : null);
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
        if (pendingCharacter) {
            iManager.setCurrentCharacter(pendingCharacter);
            pendingCharacter = null;
        }
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
// 监控 compactMode 变量，为其的 grid-auto-rows 添加过渡效果
let isAnimating = false;
// 两个动画效果：从 350px 到 150px，从 150px 到 350px
const compactAnimation = new Tween({ height: 350 }).to({ height: 150 }, 200).onComplete(isAnimating = false);
compactAnimation.onUpdate((object) => {
    modContainerRef.value.style.gridAutoRows = `${object.height}px`;
    // Row height is animating: keep the windowing padding in sync with it.
    updateWindow();
});
const expandAnimation = new Tween({ height: 150 }).to({ height: 350 }, 200).onComplete(isAnimating = false);
expandAnimation.onUpdate((object) => {
    modContainerRef.value.style.gridAutoRows = `${object.height}px`;
    // Row height is animating: keep the windowing padding in sync with it.
    updateWindow();
});

animate.add(compactAnimation);
animate.add(expandAnimation);

watch(() => props.compactMode, (newVal) => {
    if (newVal) {
        modContainerRef.value.style.gridAutoRows = '150px';
        isAnimating = true;
        compactAnimation.start();
        updateAnimate();
    } else {
        modContainerRef.value.style.gridAutoRows = '350px';
        isAnimating = true;
        expandAnimation.start();
        updateAnimate();
    }
    // The row height finishes animating after 200ms; recompute the mounted
    // rows once it has settled.
    setTimeout(updateWindow, 250);
});

function updateAnimate() {
    if (!isAnimating) return;
    requestAnimationFrame(updateAnimate)
    animate.update()
}

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
                modCardRefs.value[modItem.id].enterWindow();

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
    updateWindow();

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
    grid-template-columns: repeat(auto-fill, 250px);
    grid-row-end: auto;
    grid-auto-rows: 350px;
    gap: 12px;
    justify-content: start;
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