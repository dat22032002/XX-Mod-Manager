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
            >
                <p> {{ $t('element.section.' + sec) }} </p>
            </div>
    
        </div>
        
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

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
    }
});

const emit = defineEmits(['update:currentSection', 'update:modelValue']);
const internalSection = ref(props.sections[0]);
const currentSection = computed(() => props.modelValue ?? internalSection.value);

const selectSection = (sec) => {
    //debug
    console.log('selectSection', sec);
    internalSection.value = sec;
    emit('update:currentSection', sec);
    emit('update:modelValue', sec);
};

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
    return {
        width: props.compact
            ? `calc(${100 / props.sections.length}% - 10px)`
            : `${100 / props.sections.length}%`,
        transform
    };
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

/* Bản thu gọn (Dọc/Ngang): khung chữ nhật (Đạt dặn 21/11) thay cho
   khung con nhộng bo 20px. Nút Mod/Help/Setting giữ khung con nhộng. */
.slider-container.compact .section-selector {
    border-radius: 0;
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
    /* Viên chữ nhật theo khung (bo 0, Đạt dặn 21/11). */
    border-radius: 0;
}


.section-item>p{
    transition: color 0.3s;
    font-weight: 900;
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