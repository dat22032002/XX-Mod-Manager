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
    const shift = props.compact ? index * 100 : index * 85 - 15;
    return {
        width: `${100 / props.sections.length}%`,
        transform: `translateX(${shift}%) skew(-20deg)`
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