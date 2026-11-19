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
        <horizontalScrollBar class="chip-radio-bar" id="character-filter-bar" style="height: fit-content;">
            <chipButton :text="$t('buttons.all')" id="all-filter-chip" @click="updateSliderByEvent($event)"></chipButton>
            <chipButton :text="$t('buttons.selected')" id="selected-filter-chip" @click="updateSliderByEvent($event)"></chipButton>
            <!-- 所有角色的filter -->
            <chipButton v-for="(item, index) in characterList" :key="index" :text="item" :filterCharacter="item"
                @click="updateSliderByEvent($event)"></chipButton>
            <div class="slider OO-color-gradient" :style="sliderStyle"></div>
        </horizontalScrollBar>
    </div>
</template>

<script setup lang="ts">
import horizontalScrollBar from './horizontalScrollBar.vue';
import { ref, reactive, watch, Ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import chipButton from './chipButton.vue';
import IManager from '../../electron/IManager';
const iManager = new IManager();

import { g_config_vue } from '../../electron/IManager';
import { g_data_vue } from '../../electron/IManager';

const lastClickedElement = ref<HTMLElement | null>(null);
const searchInput = ref<string>('');

const language = g_config_vue.language;
const characterList = g_data_vue.characterList as Ref<string[]>;
watch(language, (newValue) => {
    // 刷新一下滑块，因为不同语言的长度不一样
    const elment = lastClickedElement.value;
    if (!elment) return;
    updateSlider(elment);
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
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(repositionSlider);
    }
    window.addEventListener('resize', repositionSlider);
    // Lúc mới mở app, thanh vàng chưa bao giờ được đặt vị trí: đường duy nhất
    // đặt nó (watcher ở component cha) đọc một biến không ai ghi, nên nó
    // không chạy; chỉ khi người dùng bấm tag thì thanh mới nhảy đúng chỗ.
    // Đặt vị trí ngay khi mount xong, theo nhân vật đang chọn.
    nextTick(() => {
        const current = iManager.temp.currentCharacter || 'all';
        if (current === 'all' || current === 'selected') {
            const el = document.getElementById(current === 'all' ? 'all-filter-chip' : 'selected-filter-chip');
            if (el) updateSlider(el);
        } else {
            selectItemByName(current);
        }
    });
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', repositionSlider);
});

const updateSliderByEvent = (e) => {
    const elment = e.currentTarget;
    //debug
    // console.log(`updateSlider: `, elment)
    if (!elment) return;
    // debug
    // console.log(`updateSliderByEvent: `, elment, lastClickedElement.value)

    // 如果 lastClickedElement和当前点击的元素相同，则不处理
    if (lastClickedElement.value != elment) {
        // 对于点击的元素分别处理
        const id = elment.id;
        if (id === 'all-filter-chip') {
            emit('filterChangeToAll');
        } else if (id === 'selected-filter-chip') {
            emit('filterChangeToSelected');
        } else {
            // 其他的元素
            const filterCharacter = elment.getAttribute('filterCharacter');
            if (filterCharacter) emit('itemChange', filterCharacter);
        }
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
    // 那么 这个按钮应该是第 index + 2个按钮
    // 因为前面有 all, selected两个按钮（搜索框已移到滚动条外面，不占位置）
    // 主要的目的是滑块同步，lastClickedElement.value = elment
    const characterFilterBar = document.getElementById("character-filter-bar");
    if (!characterFilterBar) return;
    const elment = characterFilterBar.children[index + 2] as HTMLElement;
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
    /* Lấn trái 7px vào ô tìm kiếm: cùng với gap 0 ở .filter-row, mép
       thanh tag dí sát ô tìm kiếm. Mép cắt nghiêng vẫn song song với
       mép phải ô tìm kiếm nên không chèn lên nhau. */
    margin-left: -7px;
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