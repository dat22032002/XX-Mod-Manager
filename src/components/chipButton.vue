<template>
    <s-chip clickable="true" :id="props.id" :class="{ straight: props.straight }">
        <slot>
            <p>{{ props.text }}</p>
        </slot>
    </s-chip>
</template>

<script setup>
import {defineProps} from 'vue';

const props = defineProps({
    text: String,
    id: String,
    // straight: chip chữ nhật thẳng, không nghiêng -20° như mặc định
    // (dùng cho ô chọn tag — Đạt muốn chữ nhật thường, 20/11).
    straight: Boolean
});

</script>

<style scoped>
s-chip {
    height: 35px;
    transform: skew(-20deg);
    z-index: 1;
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    padding: 0px 16px;
    box-sizing: border-box;
    white-space: nowrap;
    font-size: 0.875rem;
    position: relative;
    overflow: hidden;
}

s-chip p {
    display: block;
    transform: skew(20deg);
    width: fit-content;
    height: fit-content;
    white-space: nowrap;
    line-height: 1;
    margin: 10px 0px;
    font-weight: bold;
    transition: all 0.3s ease-in-out 0s;
}

/* Chip thẳng: bỏ nghiêng ở cả khung lẫn chữ (chữ mặc định nghiêng
   ngược lại để bù khung nghiêng), đệm ngang thu lại cho gọn. */
s-chip.straight {
    transform: none;
    padding: 0px 10px;
}

s-chip.straight p {
    transform: none;
}

s-chip[type=filled-tonal] {
    border: 1px solid var(--s-color-outline);
    color: var(--s-color-on-primary);
}

s-chip[checked="true"]{
    color: var(--s-color-on-primary);
}
</style>