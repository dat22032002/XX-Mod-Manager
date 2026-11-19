<template>
    <s-card ref="modItemRef" class="mod-item" :clicked=clicked clickable="true" :id="props.modRef.id" inWindow="none"
        :name="props.modRef.name" :character="props.modRef.character" @click="click" :compact="props.compactMode"
        @contextmenu.prevent.stop="openEditModDialog">

        <div slot="image" style="height: calc(var(--card-width, 250px) * 0.8);" v-if="ifDisplayImage"
            @mouseenter="onImageHoverStart" @mouseleave="onImageHoverEnd">
            <img id="editDialog-mod-info-image"
                style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover;" alt="Mod Image"
                :src="img || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D'" @load="enterWindow" />
        </div>

        <div slot="headline" id="mod-item-headline">
            <span class="mod-item-name">{{ props.modRef.name }}</span>
            <button class="pin-btn" :class="{ pinned: props.modRef.pinned }" @click.stop="togglePin"
                :title="pinTitle" aria-label="Pin to top">
                <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                </svg>
            </button>
        </div>
        <div slot="subhead" id="mod-item-subhead">{{ props.modRef.character }}</div>
        <div slot="text" id="mod-item-text">
            <s-scroll-view>
                <!-- <p id="mod-hotkeys">Hotkeys: {{ displayHotKeys }}</p> -->
                <p id="mod-item-description">{{ props.modRef.description }}</p>
                <p v-if="props.displayHotKeysMode == displayHotKeysModes.inline">
                    <!-- 将按键拼合为文本 -->
                    {{props.modRef.hotkeys.map(hotkey => hotkey.description + "->" +hotkey.key).join('  ')}}
                </p>
                <div class="placeholder"></div>
            </s-scroll-view>
            <horizontalScrollBar v-if="props.displayHotKeysMode == displayHotKeysModes.scrollbar"
                class="OO-box OO-shade-box hotkey-container" scrollSpeed=0.1 dragSpeed=1>
                <div style="display: flex;flex-direction: row;flex-wrap: nowrap;">
                    <div v-for="(hotkey, index) in props.modRef.hotkeys" :key="index">
                        <s-tooltip>
                            <div style="margin: 0px 3px;height: 35px;padding: 20px 5px 20px 5px;transform: skew(-20deg);border-radius: 0;min-width: 35px;align-items: center;justify-content: center;"
                                slot="trigger" class="OO-button">
                                <p style="transform: skew(20deg);">
                                    {{ hotkey.key }}
                                </p>
                            </div>
                            <p style="line-height: 1.2;">
                                {{ hotkey.description }} </p>
                        </s-tooltip>
                    </div>
                </div>
            </horizontalScrollBar>
        </div>
    </s-card>
    <!-- Xem trước ảnh gốc khi di chuột lên ảnh thẻ 2 giây: hiện đúng file
         gốc (không phóng to), vừa trong cửa sổ app. Lớp phủ không bắt
         chuột (pointer-events: none) nên di chuột khỏi ảnh thẻ là tắt. -->
    <Teleport to="body">
        <div v-if="hoverPreviewUrl" class="hover-preview-overlay">
            <img :src="hoverPreviewUrl" alt="" />
        </div>
    </Teleport>
</template>

<script setup>
import 'sober'
import { useTemplateRef, computed, defineProps, onMounted, onUnmounted, ref, watch } from 'vue'
import IManager from '../../electron/IManager';
const iManager = new IManager();

import horizontalScrollBar from './horizontalScrollBar.vue';

import { EventSystem, EventType } from '../../helper/EventSystem';
import { TranslatedText } from '../../helper/Language';
import { ModData } from '../../core/ModHelper';
import { DialogHelper, DialogID } from '../../helper/DialogHelper';
import { selectedModIdSet, toggleModSelection, toggleModPin } from '../../helper/SelectedMods';

const displayHotKeysModes = {
    none: 0,
    inline: 1,
    scrollbar: 2,
}

const props = defineProps({
    modRef: {
        type: ModData,
        required: true
    },
    lazyLoad: Boolean,
    compactMode: Boolean,
    cardWidth: {
        type: Number,
        default: 250
    },
    displayHotKeysMode: {
        type: Number,
        default: 1
    },
})
const enteredWindow = ref(false);

const ifDisplayImage = ref(true);

const img = ref(null);

const getImage = async () => {
    // return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D';
    // 直到需要时才加载图片，加载后保存到 img.value
    // 检查 props.modRef 是否存在
    if (props.lazyLoad) {
        if (props.modRef.preview == null) {
            //如果没有预览图片，则不显示图片
            ifDisplayImage.value = false;
            return '';
        }
        ifDisplayImage.value = true;
        return await props.modRef.getPreviewBase64(true);
    }
    else {
        return await props.modRef.getPreviewBase64(true);
    }
}

//==================== init ====================//

const enterWindow = async () => {
    // console.log(`modItem ${props.mod} enterWindow: lazyLoad, img loaded`);
    enteredWindow.value = true;
    if (props.lazyLoad && img.value == null) {
        img.value = await getImage();
    }
}


//===================== 动画效果 =====================//
// Cards unmount when scrolled out of view (windowing) and mount again on the
// way back, so the clicked state is a computed over the shared selection
// set — the single source of truth — instead of a snapshot taken at mount.
const clicked = computed(() => selectedModIdSet.has(props.modRef.id));
const modItemRef = useTemplateRef('modItemRef');
const emit = defineEmits(['click'])

const click = (event) => {
    // Chọn/bỏ chọn qua helper dùng chung với hàng danh sách (kèm luật
    // 1 mod/1 loại + báo mod bị tắt).
    const newClicked = toggleModSelection(iManager.data.modList || [], props.modRef);
    // Đồng bộ thuộc tính DOM ngay để CSS [clicked="true"] và playClickAnim
    // đọc đúng giá trị mới (binding :clicked của Vue chỉ cập nhật ở tick sau).
    modItemRef.value.setAttribute('clicked', newClicked);
    if (event != null) {
        playClickAnim(modItemRef.value, event, modItemRef.value.getBoundingClientRect());
        //emit('click', props.mod);
        // iManager.setLastClickedMod_ByName(props.mod);
        iManager.setCurrentMod(props.modRef);
        iManager.toggledModByName(props.modRef.name);
    }
    else {
        playClickAnim(modItemRef.value);
    }
}

const openEditModDialog = () => {
    iManager.setCurrentMod(props.modRef);
    // iManager.showDialog('edit-mod-dialog');
    DialogHelper.showDialog(DialogID.editModDialog);
}

//===================== ghim mod =====================//
// Nút ghim ở tiêu đề thẻ: bấm để ghim/bỏ ghim, mod đã ghim lên đầu danh
// sách. Lưu ngay vào mod.json để lần mở app sau vẫn còn.
const pinTitle = computed(() => props.modRef.pinned
    ? new TranslatedText('Unpin', 'Bỏ ghim').get()
    : new TranslatedText('Pin to top', 'Ghim lên đầu').get());

const togglePin = async () => {
    await toggleModPin(props.modRef);
};

//===================== xem trước ảnh gốc khi di chuột =====================//
// Di chuột lên ảnh thẻ, giữ yên 2 giây → hiện ảnh preview gốc (file gốc,
// kích thước thật, không phóng to) ở giữa màn hình, vừa trong cửa sổ app.
// Di chuột khỏi ảnh là tắt. Mod không có ảnh preview thì không hiện gì.
const hoverPreviewUrl = ref(null);
let hoverPreviewTimer = null;

const HOVER_PREVIEW_DELAY_MS = 2000;

const hideHoverPreview = () => {
    if (hoverPreviewTimer !== null) {
        clearTimeout(hoverPreviewTimer);
        hoverPreviewTimer = null;
    }
    hoverPreviewUrl.value = null;
};

const onImageHoverStart = () => {
    if (props.modRef.preview == null) {
        return;
    }
    hideHoverPreview();
    hoverPreviewTimer = setTimeout(async () => {
        hoverPreviewTimer = null;
        // Ảnh gốc đầy đủ (thẻ chỉ dùng bản thu nhỏ 250px).
        hoverPreviewUrl.value = await props.modRef.getPreviewBase64(true, true);
    }, HOVER_PREVIEW_DELAY_MS);
};

const onImageHoverEnd = () => {
    hideHoverPreview();
};

onMounted(() => {
    // Cuộn lưới cũng tắt xem trước (thẻ đã chạy khỏi chỗ chuột đang để).
    window.addEventListener('scroll', hideHoverPreview, true);
});

onUnmounted(() => {
    window.removeEventListener('scroll', hideHoverPreview, true);
    hideHoverPreview();
});

function playClickAnim(modItem, event = null, rect = null) {
    //获取鼠标相对于卡片的位置（百分比）
    let x, y, rotateX, rotateY;
    let rotateLevel = -20;
    const clicked = modItem.getAttribute('clicked') == 'true';
    if (event != null && rect != null) {
        //如果传入了event，则使用event的位置
        //获取鼠标相对于卡片的位置（百分比）
        x = (event.clientX - rect.left) / rect.width;
        y = (event.clientY - rect.top) / rect.height;
    }
    else {
        //如果没有传入event，且modItem.clicked为true，则设置为0，0.7，否则设置为0.7，0 偏移0.2*random
        x = !modItem.clicked ? 0 : Math.random() / 5 + 0.7;
        y = !modItem.clicked ? 0.7 : Math.random() / 5;
    }
    //根据鼠标相对于卡片的位置设置反转程度
    rotateX = 2 * (y - 0.5);
    rotateY = -2 * (x - 0.5);

    if (modItem.inWindow == undefined) {
        //如果modItem.inWindow未定义，则设置为true
        modItem.inWindow = true;
    }
    if (!modItem.inWindow) {
        //如果modItem不在视窗内，则不进行动画
        return;
    }

    if (modItem.inWindow == undefined) {
        //如果modItem.inWindow未定义，则设置为true
        modItem.inWindow = true;
    }

    if (modItem.inWindow == false) {
        //如果modItem不在视窗内，则不进行动画
        return;
    }

    //添加动画
    if (clicked) {

        modItem.animate([
            { transform: `perspective( 500px ) rotate3d(1,1,0,0deg)` },
            { transform: `perspective( 500px ) translate(${-rotateY * 15}px,${rotateX * 15}px) rotateX(${rotateX * rotateLevel}deg) rotateY(${rotateY * rotateLevel}deg) scale(1.05)` },
            //缩小一点
            { transform: `perspective( 500px ) translate(${-rotateY * 15}px,${rotateX * 15}px) rotateX(${rotateX * rotateLevel}deg) rotateY(${rotateY * rotateLevel}deg) scale(1)` },
            { transform: `perspective( 500px ) rotate3d(1,1,0,0deg)` }
        ], {
            duration: 600,
            easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
            iterations: 1
        });
    }
    else {
        modItem.animate([
            { transform: `perspective( 500px ) rotate3d(1,1,0,0deg)` },

            { transform: `perspective( 500px ) translate(${-rotateY * 5}px,${rotateX * 5}px) rotateX(${rotateX * rotateLevel}deg) rotateY(${rotateY * rotateLevel * 0.2}deg) scale(0.88)` },
            //缩小一点
            { transform: `perspective( 500px ) translate(${-rotateY * 5}px,${rotateX * 5}px) rotateX(${rotateX * rotateLevel}deg) rotateY(${rotateY * rotateLevel * 0.2}deg) scale(1)` },
            { transform: `perspective( 500px ) rotate3d(1,1,0,0deg)` }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
            iterations: 1
        });
    }

    //todo: 使用tween.js
}

//-==================== compact mode ====================-//
const enterCompactMode = (item) => {
    const normalH = props.cardWidth * 1.4;
    const compactH = props.cardWidth * 0.6;
    item.animate([
        { height: `${normalH}px` },
        { height: `${compactH}px` }
    ], {
        duration: 300,
        easing: 'ease-in-out',
        iterations: 1
    });
    //item下的slot=headline，slot=text，slot=subhead的div元素会缓缓上移
    //获取这些元素
    //遍历子元素，匹配slot属性
    item.childNodes.forEach(child => {
        if (child.slot == 'headline' || child.slot == 'subhead' || child.slot == 'text') {
            child.animate([
                { transform: `translateY(${normalH - compactH}px)` },
                { transform: 'translateY(0px)' }
            ], {
                duration: 300,
                easing: 'ease-in-out',
                iterations: 1
            });
        }
        if (child.slot == 'image') {
            //获取slot下的img元素
            const img = child.querySelector('img');
            if (img)
                img.animate([
                    { opacity: 1, filter: 'blur(0px)' },
                    { opacity: 0.2, filter: 'blur(5px)' }
                ], {
                    duration: 300,
                    easing: 'ease-in-out',
                    iterations: 1
                });
        }
    });
};
const exitCompactMod = (item) => {
    const normalH = props.cardWidth * 1.4;
    const compactH = props.cardWidth * 0.6;
    item.animate([
        { height: `${compactH}px` },
        { height: `${normalH}px` }
    ], {
        duration: 300,
        easing: 'ease-in-out',
        iterations: 1
    });

    //item下的slot=headline，slot=text，slot=subhead的div元素会缓缓下移
    //获取这些元素
    //遍历子元素，匹配slot属性

    item.childNodes.forEach(child => {
        if (child.slot == 'headline' || child.slot == 'subhead' || child.slot == 'text') {
            child.animate([
                { transform: `translateY(-${normalH - compactH}px)` },
                { transform: 'translateY(0px)' }
            ], {
                duration: 300,
                easing: 'ease-in-out',
                iterations: 1
            });
        }
        if (child.slot == 'image') {
            //获取slot下的img元素
            const img = child.querySelector('img');
            if (img)
                img.animate([
                    { opacity: 0.2, filter: 'blur(5px)' },
                    { opacity: 1, filter: 'blur(0px)' }
                ], {
                    duration: 300,
                    easing: 'ease-in-out',
                    iterations: 1
                });
        }
    });
}

watch(() => props.compactMode, (newVal, oldVal) => {
    //debug
    // console.log(`modItem ${props.mod} compactMode changed from ${oldVal} to ${newVal}`);

    const modItem = modItemRef.value;
    //debug
    // console.log(`modItem ${modItem.id} inWindow:${modItem.getAttribute('inWindow')}`);
    // 如果 为 hidden，则不进行动画
    if (modItem.classList.contains('hidden')) {
        return;
    }
    if (modItem.getAttribute('inWindow') != 'true') {
        //如果modItem不在视窗内，则不进行动画
        return;
    }
    if (newVal) {
        enterCompactMode(modItemRef.value);
    }
    else {
        exitCompactMod(modItemRef.value);
    }
})




defineExpose({
    click,
    playClickAnim,
    enterWindow
})
</script>

<style>
.mod-item.hidden {
    display: none;
}

.mod-item[clicked="true"] {
    perspective: 500px;
    background-color: var(--s-color-surface-container-low);
    border: 5px solid transparent;
    background-clip: padding-box, border-box;
    background-origin: padding-box, border-box;
    background-image: linear-gradient(to right, var(--s-color-surface-container-low), var(--s-color-surface-container-low)), linear-gradient(90deg, var(--s-color-primary), var(--s-color-secondary));
    box-sizing: border-box;
    transform: rotate3d(1, 1, 0, 0deg);
    border-radius: 12px;
}

.mod-item[clicked="false"] {
    perspective: 500px;
    background-color: var(--s-color-surface-container-low);
    border: 1px solid transparent;
    border: "";
    transform: rotate3d(1, 1, 0, 0deg);
    border-radius: 12px;
}

.mod-item {
    perspective: 500px;
    /* Kích thước theo mức phóng to: biến --card-width đặt trên
       #mod-container (mặc định 250px); cao = rộng × 1.4, ảnh = rộng × 0.8.
       Sober s-card mặc định max-width 280px — bỏ giới hạn đó thì thẻ mới
       phóng to được tới 300/350px. */
    width: var(--card-width, 250px);
    max-width: none;
    height: calc(var(--card-width, 250px) * 1.4);
    margin-bottom: 0px;
    will-change: transform;

    transition: x, y 0.5s cubic-bezier(.36, -0.64, .34, 1.76);

    >div[slot="image"] {
        width: var(--card-width, 250px);
        height: calc(var(--card-width, 250px) * 0.8);
    }
}

.mod-item img {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: cover;
    user-drag: none;
    -webkit-user-drag: none;
}

.mod-item #mod-item-headline {
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    margin-top: 12px;
}

.mod-item #mod-item-headline .mod-item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    /* Tiêu đề nhỏ theo thẻ khi thu nhỏ dưới 100% (24px ở 250px; 19.2px ở
    200px; 14.4px ở 150px; 9.6px ở 100px); thẻ to hơn 100% thì min() giữ
    nguyên 24px. line-height đi kèm để hàng tiêu đề co theo chữ. */
    font-size: min(24px, calc(var(--card-width, 250px) * 0.096));
    line-height: 1.6;
}

.mod-item .pin-btn {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: var(--s-color-on-surface-variant);
    opacity: 0.55;
}

.mod-item .pin-btn:hover {
    opacity: 1;
    background: var(--s-color-surface-container-high);
}

.mod-item .pin-btn.pinned {
    opacity: 1;
    color: var(--s-color-primary);
}

.mod-item .pin-btn svg {
    fill: currentColor;
}

.mod-item #mod-item-subhead {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: -2px;
}

.mod-item #mod-item-text {
    height: 100px;
    margin-top: -10px;
    border: 0;
}

.mod-item s-scroll-view {
    height: 100%;
    width: 110%;
}

.mod-item .placeholder {
    height: 80px;
    border: 0;
}

.mod-item[compact="true"] {
    width: var(--card-width, 250px);
    height: calc(var(--card-width, 250px) * 0.6);
    transition: all 0.4s;
}

.mod-item[compact="true"] img {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: cover;
    /* position: absolute; */
    filter: blur(5px);
    opacity: 0.2;
}

.mod-item[compact="true"] div[slot="image"] {
    position: absolute;
    z-index: -1;
}
</style>

<style scoped>
.hotkey-container {
    overflow-y: hidden;
    overflow-x: auto;
    height: 25px;
    align-items: center;
    max-width: 450px;
    padding: 0px 0px;
    border-radius: 0 20px 0 20px;

    position: absolute;
    bottom: 5px;
    left: 10px;
    right: 5px;
}

.hotkey-container-inline {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    height: 25px;
    align-items: center;
    max-width: 450px;
    padding: 0px 0px;
    border-radius: 0 20px 0 20px;

    position: absolute;
    bottom: 5px;
    left: 10px;
    right: 5px;
}

/* Lớp phủ xem trước ảnh gốc: giữa màn hình, không bắt chuột để di chuột
   khỏi ảnh thẻ là tắt ngay. Ảnh giữ kích thước thật, chỉ thu lại khi
   vượt quá cửa sổ (không bao giờ phóng to). */
.hover-preview-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: none;
    z-index: 9999;
}

.hover-preview-overlay img {
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    object-fit: contain;
    border-radius: 8px;
}
</style>