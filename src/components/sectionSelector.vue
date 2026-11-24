<template>
    <div class="slider-container" :class="{ compact: props.compact }">
        <div class="slider OO-color-gradient" :style="sliderStyle"></div>
        <div class="section-selector">
            <div 
                v-for="(sec, index) in sections" 
                :key="index" 
                class="section-item" 
                :class="{ active: sec === currentSection }" 
                :data-section="sec"
                @click="selectSection(sec)"
                @dragenter="onSectionDragHover(sec, $event)"
                @dragover="onSectionDragHover(sec, $event)"
                @dragleave="onSectionDragLeave(sec)"
            >
                <p v-if="!displayLabels"> {{ $t('element.section.' + sec) }} </p>
                <template v-else>
                    <p class="section-label-name">{{ displayLabels[index].name }}</p>
                    <span v-if="displayLabels[index].count" class="section-label-count">{{ displayLabels[index].count }}</span>
                </template>
            </div>
    
        </div>
        
    </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';

const props = defineProps({
    sections: {
        type: Array,
        required: true
    },
    // Khi cha truyền modelValue thì mục đang chọn đi theo cha (dùng cho
    // nút Dọc/Ngang: kiểu thẻ nằm ở config, cha mới là chỗ giữ trạng
    // thái). Không truyền thì component tự giữ trạng thái như cũ (nút
    // Mod/Help/Setting ở App.vue).
    modelValue: {
        type: String,
        default: undefined
    },
    // Thu hẹp khoảng đệm 2 bên chữ để nút ngắn lại (dùng cho nút
    // Dọc/Ngang ở thanh dưới — chữ Vertical/Horizontal dài nên nút mặc
    // định chiếm quá nhiều chỗ). Nút Mod/Help/Setting không truyền thì
    // giữ nguyên như cũ.
    compact: {
        type: Boolean,
        default: false
    },
    // Nhãn tự cho (dùng cho nút trượt Tất cả/Đã chọn: nhãn gồm tên +
    // số đếm, không nằm trong locale element.section). Mỗi mục là chuỗi
    // ("All (12)") hoặc { name, count } (tên + số đếm tách riêng để tên
    // cắt … khi dài mà số đếm vẫn hiện đủ — cha tự lo CSS cho 2 phần
    // này). Không truyền thì nhãn lấy từ locale như cũ (nút Mod/Help/
    // Setting, Dọc/Ngang).
    labels: {
        type: Array,
        default: undefined
    },
    // Chuyển mục khi kéo file rê giữ trên nút (1.5.25 test3): kéo ảnh
    // từ trang Banana, rê qua nút Mod giữ ~0,5 giây thì tự chuyển sang
    // tab Mod để thả vào thẻ. Chỉ bật cho nút Mod/Banana/Help/Settings
    // ở App.vue — nút Dọc/Ngang và Tất cả/Đã chọn không bật.
    hoverSwitch: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:currentSection', 'update:modelValue']);
const internalSection = ref(props.sections[0]);
const currentSection = computed(() => props.modelValue ?? internalSection.value);

// Chuẩn hóa nhãn tự cho về { name, count } để template vẽ 1 kiểu
// (chuỗi thì count rỗng). Map theo sections để dài luôn khớp số mục.
const displayLabels = computed(() => {
    if (!props.labels) return null;
    return props.sections.map((sec, i) => {
        const l = props.labels[i];
        if (l === undefined) return { name: '', count: '' };
        return typeof l === 'string' ? { name: l, count: '' } : l;
    });
});

const selectSection = (sec) => {
    //debug
    console.log('selectSection', sec);
    internalSection.value = sec;
    emit('update:currentSection', sec);
    emit('update:modelValue', sec);
};

// Chuyển mục khi kéo file rê giữ trên nút (1.5.25 test3, xem prop
// hoverSwitch): chỉ nhận gói kéo có file (types chứa 'Files') để kéo
// chữ/link không làm nhảy mục. dragover bắn liên tục nên chỉ hẹn giờ
// 1 lần cho mỗi mục; rời nút thì hủy hẹn; mục đang hiện thì không hẹn.
const HOVER_SWITCH_DELAY_MS = 500;
let hoverSwitchTimer = null;
let hoverSwitchSection = null;
const clearHoverSwitch = () => {
    if (hoverSwitchTimer !== null) {
        clearTimeout(hoverSwitchTimer);
        hoverSwitchTimer = null;
    }
    hoverSwitchSection = null;
};
const onSectionDragHover = (sec, event) => {
    if (!props.hoverSwitch) return;
    if (sec === currentSection.value) return;
    const types = event.dataTransfer ? event.dataTransfer.types : [];
    if (!types.includes('Files')) return;
    if (hoverSwitchSection === sec) return;
    clearHoverSwitch();
    hoverSwitchSection = sec;
    hoverSwitchTimer = setTimeout(() => {
        hoverSwitchTimer = null;
        hoverSwitchSection = null;
        selectSection(sec);
    }, HOVER_SWITCH_DELAY_MS);
};
const onSectionDragLeave = (sec) => {
    if (hoverSwitchSection === sec) clearHoverSwitch();
};
onUnmounted(() => {
    clearHoverSwitch();
});

const sliderStyle = computed(() => {
    const index = props.sections.indexOf(currentSection.value);
    // Công thức gốc của tác giả (translateX theo % của chính viên trượt,
    // viên rộng 100/N%): 3 mục thì viên đi đúng từng mục; 2 mục thì viên
    // đứng lệch ~15% chiều rộng viên sang trái ở mục đầu và lệch phải ở
    // mục cuối — chấp nhận được khi nút rộng (đệm 40px) nhưng lộ rõ khi
    // nút thu gọn. Bản thu gọn (compact) dùng translateX theo đúng chỉ số
    // mục: viên rộng 100/N% nên đi đúng 1 mục = 100% chiều rộng viên.
    // Bản thu gọn còn trừ 10px khỏi rộng viên: khung chứa (.slider-
    // container) rộng hơn khung nút 20px do đệm ngang 10px mỗi bên, nên
    // viên 50% của khung chứa thừa 10px so với 1 nửa nút — thừa đó làm
    // viên lấn ~22px sang chữ nút còn lại (Đạt báo 21/11: "Ho" của
    // Horizontal trắng trên nền vàng) và khi chọn mục 2 thì viên trượt
    // quá tay, chữ H hết vàng. calc(50% - 10px) = đúng 1 nửa nút.
    const shift = props.compact ? index * 100 : index * 85 - 15;
    // Bản thu gọn bỏ nghiêng: khung vuông + viên nghiêng thì góc viên
    // thò ra ngoài mép thẳng của khung (Đạt dặn đổi sang viền chữ nhật
    // 21/11). Nút Mod giữ nghiêng -20° như cũ.
    const transform = props.compact
        ? `translateX(${shift}%)`
        : `translateX(${shift}%) skew(-20deg)`;
    // Bản thu gọn trừ phần đệm ngang của khung chứa (20px) chia đều cho
    // mỗi mục: mục rộng (W-20)/N = W/N - 20/N, nên viên rộng đúng
    // calc(100/N% - 20/N px) thì translateX(index*100%) đậu đúng từng
    // mục với mọi N (N=2 ra calc(50% - 10px) như cũ — nút Dọc/Ngang và
    // Tất cả/Đã chọn không đổi; N=5 ra calc(20% - 4px) cho tab trình
    // setup — công thức cũ trừ cố định 10px làm viên hẹp hơn mục 6px và
    // lệch dần tới 24px ở tab cuối).
    const style = {
        width: props.compact
            ? `calc(${100 / props.sections.length}% - ${20 / props.sections.length}px)`
            : `${100 / props.sections.length}%`,
        transform
    };
    // Mốc không khớp mục nào (vd nút Tất cả/Đã chọn khi đang chọn 1 nhân
    // vật cụ thể — modelValue là tên nhân vật, không nằm trong sections):
    // ẨN viên (opacity 0) thay vì đậu ở 1 mục — đậu sai chỗ sẽ gây hiểu
    // nhầm là đang lọc theo đó. Viên vẫn trượt (transform) nên khi mốc
    // quay lại 1 mục thì viên trượt vào từ mép trái như thường. Nút
    // Mod/Dọc-Ngang luôn khớp 1 mục nên không bị ảnh hưởng.
    if (index < 0) style.opacity = 0;
    return style;
});

const nextSection = () => {
    const index = props.sections.indexOf(currentSection.value);
    if (index < props.sections.length - 1) {
        selectSection(props.sections[index + 1]);
    }
};

const prevSection = () => {
    const index = props.sections.indexOf(currentSection.value);
    if (index > 0) {
        selectSection(props.sections[index - 1]);
    }
};

watch(() => props.sections, (newSection) => {
    if (!newSection.includes(currentSection.value)) {
        internalSection.value = newSection[0];
    }
});

defineExpose({
    nextSection,
    prevSection
});
</script>

<style scoped>
.section-selector {
    display: flex;
    align-items:center;
    position: relative;
    background-color: var(--s-color-on-primary);
    border: 5px solid var(--s-color-outline-variant);
    border-radius: 20px;
    box-shadow: 0 0 0px 3px var(--s-color-surface-container-high),inset 1px 1px 1px rgba(255, 255, 255, 0.2);
    box-sizing: border-box;
    overflow: hidden;
    height: 40px;
}

.section-item {
    flex: 1;
    padding: 10px 40px;
    text-align: center;
    cursor: pointer;
    transition: background-color 0.3s;
    pointer-events: auto;
    z-index: 4;
}

/* Bản thu gọn: đệm 2 bên chữ 40px -> 16px, nút ngắn đi ~48px mỗi mục. */
.slider-container.compact .section-item {
    padding: 10px 16px;
    /* Chữ căn giữa khung (Đạt dặn 21/11): flex: 1 mặc định không co
       dưới cỡ chữ (min-width: auto) nên mục "Horizontal" dài hơn mục
       "Vertical" (118,7px so với 96,5px), ranh giới 2 mục lệch khỏi
       giữa khung 11px. min-width: 0 cho 2 mục rộng bằng nhau đúng nửa
       khung. */
    min-width: 0;
    /* Căn giữa chữ trong mục bằng flex: style.css toàn app đặt `p {
       width: fit-content }` nên <p> co vừa chữ rồi dính mép trái mục;
       cho <p> rộng 100% thì chữ "Vertical" căn giữa được nhưng chữ
       "Horizontal" (86,7px) vẫn tràn khỏi <p> 75,6px — Chrome không
       căn giữa dòng chữ tràn (phần thừa dồn sang phải hết). Flex
       justify-content: center thì tràn đều 2 bên nên chữ vẫn giữa. */
    display: flex;
    justify-content: center;
    align-items: center;
}

/* <p> trong mục thu gọn không được co (flex-shrink mặc định sẽ bóp
   <p> "Horizontal" về 75,6px rồi chữ lại tràn lệch phải). Nút Mod giữ
   nguyên (chữ trái như tác giả gốc). */
.slider-container.compact .section-item p {
    flex: none;
}

/* Bản thu gọn (Dọc/Ngang): khung chữ nhật bo góc (Đạt dặn 21/11: đổi
   từ con nhộng sang chữ nhật rồi thêm bo góc 10px). Nút Mod/Help/
   Setting giữ khung con nhộng bo 20px. */
.slider-container.compact .section-selector {
    border-radius: 10px;
}

/* Bản thu gọn (Dọc/Ngang): viên vàng vừa đúng 1 nửa nút, vừa đúng cao
   khung, và có viền như khung (Đạt dặn 21/11). Viên gốc dùng content-box
   + đệm ngang 10px nên rộng thừa ~30px so với nửa nút, lại cao 46px
   (trồi 3px khỏi khung 40px) và không có viền. Bản thu gọn dùng
   border-box + bỏ đệm (rộng viên = đúng nửa nút, tính cả viền), neo
   đúng mép khung (trái 10px = đệm khung chứa, trên/dưới 3px = khung
   40px nằm giữa khung chứa 46px), viền 5px cùng màu viền khung. Nút
   Mod/Help/Setting không truyền compact nên giữ nguyên như cũ. */
.slider-container.compact .slider {
    box-sizing: border-box;
    left: 10px;
    top: 3px;
    bottom: 3px;
    padding: 0;
    border: 5px solid var(--s-color-outline-variant);
    /* Viên chữ nhật bo góc theo khung (Đạt dặn 21/11: bo góc cả 2 góc
       bên trong khung nữa). Bo 10px bằng khung để 2 góc ngoài của viên
       trùng đúng đường cong của khung, không thò ra ngoài. */
    border-radius: 10px;
}


.section-item>p{
    transition: color 0.3s;
    font-weight: 900;
    /* Không quấn chữ (1.5.29): chữ tiếng Việt có khoảng trắng ("Trợ
       giúp", "Cài đặt") bị quấn 2 dòng trong mục chỉ rộng 54px (mục
       134px trừ đệm 2×40px) rồi bị khung 40px cắt mất nửa trên/dưới.
       nowrap thì mục tự rộng ra vừa chữ (min-width: auto), thanh tab
       dài thêm chút nhưng vẫn vừa đầu trang. */
    white-space: nowrap;
}

.section-item.active {
    color: var(--s-color-on-primary);
}

.slider-container{
    position: relative;
    width: fit-content;
    height: 20px;
    display: flex;
    align-items: center;
    pointer-events:none;
    padding: 13px 10px;
    border-radius: 28px;
    overflow: visible;
    background-color: #007bff00;
    overflow: hidden;
    z-index: 1;
}



.slider {
    position: absolute;
    top: 0;
    bottom: 0;
    background-color: var(--s-color-primary);
    transition: transform 0.3s;
    pointer-events:none;
    padding: 0 10px;
    border-radius: 12px;
    box-sizing: content-box;
    transform: skew(-20deg) translateX(-50%);
    z-index: 3;
}
</style>