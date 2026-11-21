<!-- *
* @ Author: XLXZ
* @ Description: 只在左侧显示的菜单栏，仅作为 UI 组件，不涉及具体业务逻辑

* @ Input: tabs: Array<string> 选项卡列表
*         translatedTabs: Array<string> 选项卡列表的翻译
* @ Output: tabChange: string 当选项卡发生变化时触发

* @ function: selectTab: (tab: string) => void 选中某个选项卡

* @ Slot: up-button: 用于自定义上方按钮
*        down-button: 用于自定义下方按钮
* -->


<!-- <div ref="containerRef" style="position: relative; overflow-y: auto; overflow-x: hidden; height: calc(100% - 64px);" >
    <div v-for="(tab, index) in tabs" :key="index" :class="['tab', { active: currentTab === tab }]"
        @click="selectTab(tab,index)">
        <p> {{ translatedTabs[index] || tab }} </p>
        <s-ripple attached="true"></s-ripple>
    </div>
    <div class="slider OO-color-gradient" :style="sliderStyle"></div>
</div> -->

<template>
    <div class="left-menu OO-box" :class="{ 'fit-content': fitContent }">
        <div class="OO-button-box" id="up-button">
            <slot name="up-button">
                <s-icon type="arrow_drop_up"></s-icon>
            </slot>
        </div>

        <div :style="tabsContainerStyle">
            <div v-for="(tab, index) in tabs" :key="index" :class="['tab', { active: currentTab === tab }]"
                @click="selectTab(tab, index)" :ref="setTabRef(tab)">
                <p> {{ translatedTabs[index] || tab }} </p>
                <s-ripple attached="true"></s-ripple>
            </div>
            <div class="slider OO-color-gradient" :style="sliderStyle"></div>
        </div>

        <div class="placeholder"></div>

        <div class="OO-button-box" id="down-button">
            <slot name="down-button">
                <s-icon type="arrow_drop_down"></s-icon>
            </slot>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
const props = defineProps({
    tabs: {
        type: Array,
        required: true
    },
    translatedTabs: {
        type: Array,
        required: false,
        default: () => []
    },
    // fitContent: menu ngắn lại vừa đủ số tab (không căng hết chiều cao),
    // danh sách tab lăn khi quá 3 hàng. Tab Mod dùng để chừa chỗ cho danh
    // sách nhân vật dọc ở dưới; Help/Setting giữ nguyên căng hết.
    fitContent: {
        type: Boolean,
        default: false
    }
});

// Kiểu khung danh sách tab: mặc định căng hết chiều cao menu (trừ 2 nút
// trên/dưới 32px); fitContent thì cao theo nội dung, tối đa 3 hàng
// (3 × 42px = 126px) — thêm preset nữa thì lăn chuột trong khung, khung
// preset không cao thêm (Đạt dặn 21/11: giữ nguyên cỡ 3 preset).
const tabsContainerStyle = computed(() => props.fitContent
    ? { position: 'relative', overflowY: 'auto', overflowX: 'hidden', height: 'auto', maxHeight: '126px' }
    : { position: 'relative', overflowY: 'auto', overflowX: 'hidden', height: 'calc(100% - 64px)' });

const emit = defineEmits(['tabChange']);
const currentTab = ref(props.tabs[0]);

//-=============== 按钮引用 ===============
const tabRefs = ref({});
const setTabRef = (tab) => (el) => {
    tabRefs.value[tab] = el;
}

//-=============== 浮动滑块 ===============
const sliderStyle = reactive({
    top: '0px',
    height: '0px',
    width: '0px',
});

const updateSlider = (index) => {
    const selectedTab = tabRefs.value[props.tabs[index]];
    if (!selectedTab) {
        console.log(`tab not found: ${index}`);
        return;
    }
    //debug
    // console.log(`updateSlider: `, index, selectedTab, props.tabs[index])
    sliderStyle.top = `${selectedTab.offsetTop}px`;
    sliderStyle.height = `${selectedTab.offsetHeight}px`;
    sliderStyle.width = `${selectedTab.offsetWidth}px`;
};


//-=============== 选项切换 ===============
const selectTab = (tab, index) => {
    updateSlider(index);
    if (tab === currentTab.value) return;
    currentTab.value = tab;
    emit('tabChange', tab);
};

const selectTabByName = (tab) => {
    if (tab === currentTab.value) return;
    currentTab.value = tab;
    
    setTimeout(() => {
        const index = props.tabs.indexOf(tab);
        if (index === -1) {
            console.log(`tab not found: ${tab}`);
            return;
        }
        updateSlider(index);
        
    }, 0);

    emit('tabChange', tab);
};

onMounted(() => {
    // 尝试使得 当前 滑块为第一个选项卡
    updateSlider(0);
});

defineExpose({
    currentTab, // 当前选中的选项卡,一般不使用，而是通过监听 tabChange 事件来获取
    selectTab,
    selectTabByName
});

</script>

<style scoped>
.left-menu {
    display: flex;
    flex-direction: column;
    position: relative;
    width: 200px;
    min-width: 100px;
    max-width: 200px;
    height: calc(100% - 20px)
}

/* fitContent: menu co lại vừa nội dung (tab + 2 nút trên/dưới), phần
   đệm flex ở giữa co về 0 vì không còn chỗ trống. */
.left-menu.fit-content {
    height: fit-content;
}

.tab {
    position: relative;
    padding: 10px;
    cursor: pointer;
    transition: background-color 0.3s;
    text-align: center;
    z-index: 1;
    /* height: 20px; */
    height: fit-content;
    line-break: anywhere;
}

.tab p {
    width: 100%;
    text-align: center;
    font-weight: bolder;
    margin: 0;
    transition: color 0.3s;
}

.tab.active {
    color: var(--s-color-on-primary);

    s-ripple {
        opacity: 1;
        color: var(--s-color-primary);
        transition: opacity 0.3s, color 0.5s;
    }
}

.slider {
    position: absolute;
    width: calc(100%);
    height: 40px;
    background-color: var(--s-color-primary);
    border-radius: 12px;
    transition: height 0.3s ease-in-out, top 0.3s;

    will-change: height, top, width;
}

s-ripple {
    /* --ripple-color: var(--s-color-primary); */
    border-radius: 12px;
}

.OO-button-box {
    position: relative;
    height: 32px;
    margin: 0;
    border-radius: 12px;
    width: calc(100% - 26px);
    display: flex;
    align-items: center;
    justify-content: center;
}

#up-button {
    left: -7px;
    top: -7px;
}

.placeholder {
    flex: 1;
}

#down-button {
    left: -7px;
    bottom: -7px;
}
</style>