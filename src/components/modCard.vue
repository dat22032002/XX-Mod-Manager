<template>
    <s-card ref="modItemRef" class="mod-item" :clicked=clicked :batch-clicked=batchClicked clickable="true" :id="props.modRef.id" inWindow="none"
        :name="props.modRef.name" :character="props.modRef.character" :data-tag="props.modRef.tag" @click="click" :compact="props.compactMode" :data-layout="props.cardLayout"
        @mouseenter="onCardHoverStart" @mouseleave="onCardHoverEnd"
        @contextmenu.prevent.stop="openEditModDialog">

        <div slot="image" v-if="ifDisplayImage">
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
        <div slot="text" id="mod-item-text">
            <!-- Dung lượng thư mục mod (Đạt dặn 20/11): chữ nhỏ kiểu dòng
                 đếm mod, ngay dưới tên mod, thẳng lề trái với tên. -->
            <div class="mod-item-size">{{ sizeText }}</div>
            <s-scroll-view>
                <!-- <p id="mod-hotkeys">Hotkeys: {{ displayHotKeys }}</p> -->
                <p id="mod-item-description">{{ props.modRef.description }}</p>
                <div class="placeholder"></div>
            </s-scroll-view>
        </div>
    </s-card>
</template>

<script setup>
import 'sober'
import { useTemplateRef, computed, defineProps, onMounted, onUnmounted, ref, watch } from 'vue'
import IManager from '../../electron/IManager';
const iManager = new IManager();


import { EventSystem, EventType } from '../../helper/EventSystem';
import { TranslatedText } from '../../helper/Language';
import { ModData } from '../../core/ModHelper';
import { formatModSize } from '../../helper/ModSizeScanner';
import { DialogHelper, DialogID } from '../../helper/DialogHelper';
import { selectedModIdSet, toggleModSelection, toggleModPin, batchSelectedModIdSet, toggleBatchSelection } from '../../helper/SelectedMods';

const props = defineProps({
    modRef: {
        type: ModData,
        required: true
    },
    lazyLoad: Boolean,
    compactMode: Boolean,
    cardWidth: {
        type: Number,
        default: 301
    },
    // Kiểu thẻ: 'vertical' (dọc 250×350 như cũ) hay 'horizontal' (ngang 350×280).
    cardLayout: {
        type: String,
        default: 'horizontal'
    },
    // Hiện ảnh gốc đầy đủ thay vì ảnh thu nhỏ 250px (nút bên phải +).
    fullImage: Boolean,
})
const enteredWindow = ref(false);

const ifDisplayImage = ref(true);

const img = ref(null);

// Dung lượng mod: đọc từ thẻ lúc gắn (đã quét thì có ngay từ bộ nhớ
// sẵn), quét nền xong thì sự kiện modSizeReady cập nhật riêng thẻ này
// (không tải lại cả lưới).
const sizeBytesRef = ref(props.modRef.sizeBytes ?? -1);
const sizeText = computed(() => formatModSize(sizeBytesRef.value));
const onModSizeReady = (mod) => {
    if (mod && mod.id === props.modRef.id) {
        sizeBytesRef.value = mod.sizeBytes;
    }
};

// Số thứ tự lần tải ảnh gần nhất: bấm nút chuyển đổi lia lịa (hay bấm
// đúng lúc ảnh đầu tiên chưa tải xong) thì chỉ lần tải MỚI NHẤT mới được
// gán vào img, các lần cũ hơn về sau thì bỏ — không thì thẻ có thể kẹt
// ở bản ảnh trái với nút đang chọn.
let imageLoadToken = 0;

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
        return await props.modRef.getPreviewBase64(true, props.fullImage);
    }
    else {
        return await props.modRef.getPreviewBase64(true, props.fullImage);
    }
}

//==================== init ====================//

const enterWindow = async () => {
    // console.log(`modItem ${props.mod} enterWindow: lazyLoad, img loaded`);
    enteredWindow.value = true;
    if (props.lazyLoad && img.value == null) {
        const token = ++imageLoadToken;
        const url = await getImage();
        if (token === imageLoadToken) img.value = url;
    }
}

// Đổi ảnh gốc / ảnh thu nhỏ (nút bên phải +): thẻ nào đã hiện ảnh thì
// tải lại đúng bản mới — ảnh cũ vẫn hiện cho tới khi ảnh mới tải xong
// nên không chớp trắng. Thẻ chưa vào khung nhìn thì thôi, lúc lăn tới
// enterWindow sẽ tải đúng bản đang chọn.
watch(() => props.fullImage, async () => {
    if (!enteredWindow.value || !ifDisplayImage.value) return;
    const token = ++imageLoadToken;
    const url = await getImage();
    if (token === imageLoadToken) img.value = url;
});


//===================== 动画效果 =====================//
// Cards unmount when scrolled out of view (windowing) and mount again on the
// way back, so the clicked state is a computed over the shared selection
// set — the single source of truth — instead of a snapshot taken at mount.
const clicked = computed(() => selectedModIdSet.has(props.modRef.id));
// Chọn hàng loạt (Ctrl+bấm): viền xanh biển, riêng với chọn vàng.
const batchClicked = computed(() => batchSelectedModIdSet.has(props.modRef.id));
const modItemRef = useTemplateRef('modItemRef');
const emit = defineEmits(['click'])

const click = (event) => {
    // Ctrl+bấm: thêm/bớt mod khỏi tập chọn hàng loạt (viền xanh biển),
    // không đụng tới chọn vàng, không tắt mod nào khác.
    if (event != null && (event.ctrlKey || event.metaKey)) {
        const newBatchClicked = toggleBatchSelection(props.modRef);
        modItemRef.value.setAttribute('batch-clicked', newBatchClicked);
        iManager.setCurrentMod(props.modRef);
        return;
    }
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

//===================== di chuột đổi khung chi tiết =====================//
// Di chuột lên thẻ, giữ yên 0,25 giây → khung chi tiết bên phải đổi sang
// mod của thẻ này (giống bấm chọn, nhưng không đổi chọn vàng). Độ trễ để
// lia chuột nhanh qua nhiều thẻ không làm khung nhảy liên tục (Đạt dặn
// 20/11: sợ lag khi di chuột nhanh). Di chuột khỏi thẻ là hủy hẹn.
const HOVER_FOLLOW_DELAY_MS = 250;
let hoverFollowTimer = null;

const clearHoverFollow = () => {
    if (hoverFollowTimer !== null) {
        clearTimeout(hoverFollowTimer);
        hoverFollowTimer = null;
    }
};

const onCardHoverStart = () => {
    clearHoverFollow();
    hoverFollowTimer = setTimeout(() => {
        hoverFollowTimer = null;
        // Đã là mod đang xem thì thôi, khỏi vẽ lại khung.
        if (iManager.temp.currentMod !== props.modRef) {
            iManager.setCurrentMod(props.modRef);
        }
    }, HOVER_FOLLOW_DELAY_MS);
};

const onCardHoverEnd = () => {
    clearHoverFollow();
};

onMounted(() => {
    // Đổi ảnh preview (kéo thả ảnh mới vào thẻ, chọn ảnh khác trong hộp
    // sửa mod) thì thẻ phải đọc lại ảnh: trước đây thẻ chỉ tải ảnh 1 lần
    // lúc mới hiện (enterWindow) nên file đã đổi mà thẻ vẫn hiện ảnh cũ.
    // Chi tiết bên phải (modInfo) đã nghe sự kiện này từ trước, thẻ thì chưa.
    EventSystem.on(EventType.modInfoChanged, onModInfoChanged);
    EventSystem.on(EventType.modSizeReady, onModSizeReady);
});

onUnmounted(() => {
    EventSystem.off(EventType.modInfoChanged, onModInfoChanged);
    EventSystem.off(EventType.modSizeReady, onModSizeReady);
    clearHoverFollow();
});

// Thông tin mod đổi: chỉ đọc lại ảnh khi đúng là mod của thẻ này.
const onModInfoChanged = async (mod) => {
    if (mod && mod.id === props.modRef.id) {
        img.value = await getImage();
    }
};

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
// Tỉ lệ cao/rộng theo kiểu thẻ (dọc 1.4 / gọn 0.6 như cũ; ngang 280/350
// / gọn 0.45) — hiệu ứng gọn/phồng dùng tỉ lệ này, phải khớp CSS.
const layoutRatios = computed(() => props.cardLayout === 'vertical'
    ? { normal: 1.4, compact: 0.6 }
    : { normal: 280 / 350, compact: 0.45 });

const enterCompactMode = (item) => {
    const normalH = props.cardWidth * layoutRatios.value.normal;
    const compactH = props.cardWidth * layoutRatios.value.compact;
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
    const normalH = props.cardWidth * layoutRatios.value.normal;
    const compactH = props.cardWidth * layoutRatios.value.compact;
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

/* Khung lồng cho ảnh bìa (Đạt chốt 22/11, kiểu card game): ảnh thụt
   vào như ô ảnh trên lá bài — tấm lót 8px ĐỀU 3 phía trái/trên/phải,
   KHÔNG đóng khung dưới ảnh (Đạt dặn 23/11) để ảnh chạm thẳng phần
   thông tin. Không viền vàng, không màu tag (gradient + vạch đáy tạm
   gạt sang 1 bên). Bóng đổ trong KHÔNG hiện trên <img> (nội dung ảnh
   đè lên) nên vẽ lên lớp ::after của div chứa ảnh.
   - Màu lồng = đúng màu mặt thẻ (biến --s-color-surface-container-low,
     #222222): #262626 cũ lệch 4 tông, nhìn rõ 2 màu ở mép ảnh và phần
     thông tin (Đạt bắt được 23/11).
   - Góc VUÔNG (border-radius 0): góc bo 12px cũ để lại vệt ảnh hình
     lưỡi liềm ở góc — cung bo của lồng nằm trong cung bo của thẻ nên
     ảnh rò ra ở khe giữa 2 cung (Đạt bắt được 23/11). Góc vuông thì
     lồng phủ kín góc div ảnh, không còn khe rò; mép ngoài thẻ vẫn bo
     tròn nhờ thẻ tự cắt phần thừa. */
.mod-item div[slot="image"] {
    position: relative;
}

.mod-item div[slot="image"]::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 0;
    pointer-events: none;
    border: 8px solid var(--s-color-surface-container-low);
    border-bottom: none;
}

/* Chọn hàng loạt (Ctrl+bấm): viền xanh biển, riêng với chọn vàng. */
.mod-item[batch-clicked="true"] {
    border: 5px solid #2196F3;
    box-sizing: border-box;
    border-radius: 12px;
}

/* Xem trước lúc bôi đen: viền nét đứt ngoài thẻ (không đè lên viền
   chọn 5px), vàng = sắp chọn Áp Dụng, xanh = sắp chọn hàng loạt. */
.mod-item[marquee="apply"] {
    outline: 3px dashed rgba(220, 254, 0, 0.9);
    outline-offset: 2px;
}
.mod-item[marquee="batch"] {
    outline: 3px dashed rgba(33, 150, 243, 0.95);
    outline-offset: 2px;
}

/* Cả 2 loại chọn: 1 viền đỏ duy nhất (Đạt dặn 20/11) — thay cho kiểu
   cũ viền vàng + vòng xanh chồng nhau. background-image: none để tắt
   vệt vàng gradient của trạng thái chọn vàng (nền tối của thẻ vẫn giữ
   nguyên nhờ background-color). */
.mod-item[clicked="true"][batch-clicked="true"] {
    border: 5px solid #F44336;
    background-image: none;
    outline: none;
}

.mod-item {
    perspective: 500px;
    /* Kích thước theo mức phóng to: biến --card-width đặt trên
       #mod-container (mặc định 350px); ngang: cao = rộng × 280/350,
       ảnh = rộng × 0.5 (thẻ 350×280 — Đạt dặn 20/11); dọc thì xem
       .mod-item[data-layout="vertical"] bên dưới (250×350 như cũ).
       Sober s-card mặc định max-width 280px — bỏ giới hạn đó thì thẻ mới
       phóng to được tới 450px. */
    width: var(--card-width, 350px);
    max-width: none;
    height: calc(var(--card-width, 350px) * 280 / 350);
    /* Gỡ cả margin-top: rule toàn cục s-card trong style.css đặt
       margin: 6px 0 cho mọi thẻ, chỗ này trước đây chỉ gỡ margin-bottom
       nên thẻ nào cũng lún 6px dưới đỉnh hàng của nó — hàng cuối chòi
       6px khỏi đáy lưới, làm khung lăn thừa 6px lăn được dù lưới vừa
       gọn trong khung nhìn (Đạt thấy 22/11: mod 2-3 hàng lăn được 1
       xíu). Gỡ nốt margin-top thì thẻ khớp đúng hàng, khe giữa các
       hàng vẫn 12px như cũ (khe do gap của lưới, không do margin). */
    margin-top: 0px;
    margin-bottom: 0px;
    will-change: transform;

    transition: x, y 0.5s cubic-bezier(.36, -0.64, .34, 1.76);

    >div[slot="image"] {
        /* Rộng 100% khung chứa, KHÔNG ghi cứng --card-width: thẻ dùng
           border-box nên viền (1px thường, 5px khi chọn) ăn vào trong
           — rộng cứng làm div ảnh chòi 5px ra mép phải khi chọn, thẻ
           cắt mất làm lồng phải chỉ còn 1-3px so với 8px bên trái
           (Đạt bắt được 22/11). Rộng 100% thì div vừa đúng khung chứa
           ở cả 2 trạng thái, lồng đều 8px 3 phía. */
        width: 100%;
        height: calc(var(--card-width, 350px) * 0.5);
    }
}

/* Kiểu dọc (thẻ 250×350). Ảnh × 1.0 thay vì × 0.8: Đạt dặn 23/11
   kéo ảnh xuống vì phần thông tin trống nhiều — đo thật: ô chữ 100px
   mà nội dung (dung lượng 20 + mô tả 20) chỉ cần ~40px, thừa ~53px
   trống. Ảnh cao thêm 50px, ô chữ thu còn 50px (mô tả vẫn hiện đủ
   1 dòng + lăn được khi dài). */
.mod-item[data-layout="vertical"] {
    width: var(--card-width, 250px);
    height: calc(var(--card-width, 250px) * 1.4);
}
.mod-item[data-layout="vertical"] > div[slot="image"] {
    width: 100%;
    height: calc(var(--card-width, 250px) * 1.0);
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
    font-size: min(24px, calc(var(--card-width, 350px) * 0.096));
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


.mod-item #mod-item-text {
    /* Ngang: ~60px ở rộng 350 (280 − ảnh 175 − tên ~45); dọc 50px
       (xem rule .mod-item[data-layout="vertical"] bên dưới) — ngang
       đã chật sẵn, kéo ảnh nữa là mất dòng mô tả nên giữ nguyên. */
    height: calc(var(--card-width, 350px) * 0.171);
    /* margin-top âm cũ (-10px) dùng để kéo sát vào dòng tên nhân vật
       phía trên; bỏ dòng đó rồi thì kéo âm làm mô tả chồng lên tên. */
    margin-top: 0;
    border: 0;
    display: flex;
    flex-direction: column;
}

.mod-item[data-layout="vertical"] #mod-item-text {
    /* 50px = dung lượng 20 + ô lăn mô tả 30 (đủ 1 dòng mô tả); 50px
       tiết kiệm được nhường cho ảnh (× 1.0 ở trên). */
    height: 50px;
}

.mod-item s-scroll-view {
    flex: 1;
    min-height: 0;
    width: 110%;
}

/* Dung lượng thư mục mod: chữ nhỏ kiểu dòng đếm mod (14px, xám
   nhạt), ngay dưới tên mod, thẳng lề trái với tên (Đạt dặn 20/11).
   Dòng cố định 20px trên đầu ô chữ (flex cột); ô lăn mô tả chiếm
   phần còn lại nên không còn chữ nào bị che. */
.mod-item .mod-item-size {
    flex-shrink: 0;
    height: 20px;
    line-height: 20px;
    text-align: left;
    font-size: 14px;
    color: var(--s-color-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mod-item .placeholder {
    height: 80px;
    border: 0;
}

.mod-item[compact="true"] {
    width: var(--card-width, 350px);
    height: calc(var(--card-width, 350px) * 0.45);
    transition: all 0.4s;
}

.mod-item[compact="true"][data-layout="vertical"] {
    width: var(--card-width, 250px);
    height: calc(var(--card-width, 250px) * 0.6);
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
