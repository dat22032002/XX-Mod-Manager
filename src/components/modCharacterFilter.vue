<!-- 这个是原本的上面的横幅，但是现在我将其封装起来，只留下接口 -->
<template>
    <div class="filter-row">
        <!-- 搜索框固定在过滤行左侧，不随横向滚动条滚动，始终可见 -->
        <!-- Search box is a plain straight container, NOT a chipButton: the chip is
             skewed -20deg and only its <p> text is counter-skewed, so an input
             inside it renders slanted with clipped text. -->
        <div id="search-filter-chip" class="search-box-fixed">
            <s-icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                    <path
                        d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z">
                    </path>
                </svg>
            </s-icon>
            <div id="search-input-container" style="display: flex;align-items: center;flex: 1;min-width: 0;margin-left: 8px;">
                <s-text-field id="search-input" class="OO-shade-box" style="min-height: 25px;flex: 1;width: 100%;min-width: 0;background-color:var(--s-color-surface);border-radius: 5px;" @input="handleSearchInput" v-model="searchInput">

                </s-text-field>
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
import { ref, reactive, watch, Ref } from 'vue';
import chipButton from './chipButton.vue';

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
};

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
    gap: 5px;
}

.search-box-fixed {
    width: 200px;
    min-width: 0;
    flex-shrink: 0;
    height: 35px;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding: 0px 12px;
    border-radius: 8px;
    background-color: var(--s-color-surface-container);
    border: 1px solid var(--s-color-outline-variant);
    overflow: hidden;
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
    padding: 3px 10px;
    flex: 1;
    min-width: 0;
    min-height: 35px;

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