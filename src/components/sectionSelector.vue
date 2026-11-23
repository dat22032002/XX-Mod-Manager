<template>
    <!-- Zone SegmentedTabs (phase 1): khung là .zzz-mat-pill, viên nhấn là
         accent fill [cap][body][cap] — viên SNAP sang mục mới rồi nảy
         (370ms), không trượt; giữ nút chưa chọn thì viên hiện tại phình
         ra. Hành vi Vue (props/events/hover-switch) giữ nguyên y hệt. -->
    <div
        class="zzz-segmented-tabs zzz-mat-pill"
        :class="{ 'zzz-segmented-tabs--tight': tight }"
        :data-surface="surface"
        :data-size="size"
        :data-inflating="inflating ? '' : undefined"
        :style="rootStyle"
        role="tablist"
        aria-orientation="horizontal"
    >
        <div class="zzz-segmented-tabs__track" aria-hidden="true">
            <!-- Mốc không khớp mục nào (vd Tất cả/Đã chọn khi đang chọn 1
                 nhân vật cụ thể): KHÔNG vẽ viên — giống Zone
                 (selectedIndex >= 0) và giống hành vi cũ (opacity 0). -->
            <span
                v-if="selectedIndex >= 0"
                :key="currentSection"
                class="zzz-segmented-tabs__indicator"
                :data-shape="shape"
                :data-pop="hasSwitched ? '' : undefined"
                aria-hidden="true"
            >
                <svg
                    v-if="shape === 'middle' || shape === 'end'"
                    class="zzz-segmented-tabs__cap zzz-segmented-tabs__cap--start"
                    viewBox="0 0 48.91 62"
                    preserveAspectRatio="none"
                    style="aspect-ratio: 48.91 / 62"
                    focusable="false"
                    aria-hidden="true"
                ><path :d="CAP_PATH" /></svg>
                <span class="zzz-segmented-tabs__body" />
                <svg
                    v-if="shape === 'middle' || shape === 'start'"
                    class="zzz-segmented-tabs__cap"
                    viewBox="0 0 48.91 62"
                    preserveAspectRatio="none"
                    style="aspect-ratio: 48.91 / 62"
                    focusable="false"
                    aria-hidden="true"
                ><path :d="CAP_PATH" /></svg>
            </span>
        </div>
        <div class="zzz-segmented-tabs__row">
            <button
                v-for="(sec, index) in sections"
                :key="sec"
                type="button"
                class="zzz-segmented-tabs__tab zzz-focusable section-item"
                :class="{ active: sec === currentSection }"
                :data-section="sec"
                :data-position="tabPosition(index)"
                role="tab"
                :aria-selected="sec === currentSection"
                :data-pressed="pressedTab === sec ? '' : undefined"
                @click="selectSection(sec)"
                @pointerdown="onTabPress(sec)"
                @pointerup="clearTabPress"
                @pointerleave="clearTabPress"
                @dragenter="onSectionDragHover(sec, $event)"
                @dragover="onSectionDragHover(sec, $event)"
                @dragleave="onSectionDragLeave(sec)"
            >
                <span v-if="!displayLabels" class="zzz-segmented-tabs__label zzz-italic">{{ $t('element.section.' + sec) }}</span>
                <span v-else class="zzz-segmented-tabs__label zzz-italic has-counts">
                    <span class="section-label-name">{{ displayLabels[index].name }}</span>
                    <span v-if="displayLabels[index].count" class="section-label-count">{{ displayLabels[index].count }}</span>
                </span>
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';

// Đường cong đầu nghiêng của viên nhấn (Zone geometry.ts, CAP_PATH):
// viewBox 0 0 48.91 62 — góc nghiêng 26.5°, bo góc nhọn 14 / tù 28.
// Tự tính lại bằng đúng công thức trong geometry.ts (đã đối chiếu bằng
// Python), không chạy code của Zone.
const CAP_PATH = 'M-2 0 L26.29 0 A14 14 0 0 1 38.82 20.25 L25.73 46.49 A28 28 0 0 1 0.67 62 L-2 62 Z';
// Rộng mặc định mỗi mục (Zone: 703u black / 786u mesh cho 3 mục).
const PER_TAB = { black: 703 / 3, mesh: 786 / 3 };

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
    },
    // Cỡ Zone: 'sm' (~32px) / 'md' (~40px) / 'lg' (~48px). Mặc định md.
    size: {
        type: String,
        default: 'md'
    },
    // Rộng ngoài của thanh (đơn vị thiết kế Zone; 1u ≈ 0.7px ở cỡ mặc
    // định), 'fill' = rộng 100% khung cha, null = mặc định của Zone
    // (234u/mục black, 262u/mục mesh). Số truyền vào là tuyệt đối,
    // không nhân theo cỡ (đúng như Zone).
    segWidth: {
        type: [Number, String],
        default: null
    },
    // Mặt nền Zone: 'black' = đen tuyền (thanh trên), 'mesh' = đen +
    // lưới chấm (thanh dưới).
    surface: {
        type: String,
        default: 'black'
    },
    // Thanh hẹp 2 mục (Dọc/Ngang, Tất cả/Đã chọn): viên nhấn Zone lấn
    // sang mục kề 33u — thanh rộng thì không sao, nhưng 2 thanh này
    // hẹp mà nhãn dài ("Horizontal" 123px đo thật, "Selected (0)")
    // nên đầu nghiêng của viên lấn vào chữ mục kề (đã đo: chữ H của
    // Horizontal bị viên phủ ở 320u). tight rút phần lấn xuống 12u
    // (xem .zzz-segmented-tabs--tight trong zone-app.css) — viên vẫn
    // phủ hết mục đang chọn + giữ đầu nghiêng kiểu Zone, chỉ không
    // chạm chữ mục kề nữa. Nút Dọc/Ngang còn nới rộng 320u lên 380u
    // vì nhãn "Horizontal" rộng hơn cả mục 112px (chữ 2 mục chạm nhau
    // giữa thanh). Thanh trên (4 mục, rộng) không cần.
    tight: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:currentSection', 'update:modelValue']);
const internalSection = ref(props.sections[0]);
const currentSection = computed(() => props.modelValue ?? internalSection.value);
const selectedIndex = computed(() => props.sections.indexOf(currentSection.value));

// Hình dạng viên nhấn (Zone): mục đầu bo tròn mép trái + đầu nghiêng
// phải, mục cuối ngược lại, mục giữa 2 đầu nghiêng, 1 mục thì bo cả 2.
const shape = computed(() => {
    const n = props.sections.length;
    if (n === 1) return 'only';
    if (selectedIndex.value <= 0) return 'start';
    if (selectedIndex.value >= n - 1) return 'end';
    return 'middle';
});

const tabPosition = (index) => {
    const n = props.sections.length;
    if (n === 1) return 'only';
    if (index === 0) return 'start';
    if (index === n - 1) return 'end';
    return 'middle';
};

// Biến CSS Zone cho khung: rộng, số mục, chỉ số mục đang chọn.
const rootStyle = computed(() => {
    const width = props.segWidth === 'fill'
        ? '100%'
        : typeof props.segWidth === 'number'
            ? `calc(${props.segWidth} * var(--zzz-px))`
            : `calc(${Math.round(PER_TAB[props.surface] * props.sections.length * 100) / 100} * var(--zzz-seg-u))`;
    return {
        '--zzz-seg-width': width,
        '--zzz-seg-count': props.sections.length,
        '--zzz-seg-index': Math.max(0, selectedIndex.value)
    };
});

// Nảy chỉ sau lần chuyển đầu tiên (Zone: hasSwitched) — không nảy lúc
// mới mở app. Một khi đã chuyển thì giữ luôn để lần nào chuyển cũng nảy.
const firstSection = ref(currentSection.value);
const hasSwitched = ref(false);
watch(currentSection, (v) => {
    if (v !== firstSection.value) hasSwitched.value = true;
});

// Giữ nút chưa chọn: viên hiện tại phình ra + chữ nút đó xám (Zone:
// data-inflating + data-pressed). Giữ đúng nút đang chọn thì không làm
// gì.
const pressedTab = ref(null);
const inflating = computed(() => pressedTab.value !== null);
const onTabPress = (sec) => {
    if (sec !== currentSection.value) pressedTab.value = sec;
};
const clearTabPress = () => { pressedTab.value = null; };

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
/* Nhãn tên + số đếm (Tất cả/Đã chọn): 1 hàng flex trong viên nhấn
 * nghiêng, tên cắt … khi dài, số đếm không bao giờ cắt. Cỡ chữ/màu của
 * tên và số đếm do cha lo (characterList.vue). */
.zzz-segmented-tabs__label.has-counts {
    display: inline-flex;
    align-items: baseline;
    gap: calc(4 * var(--zzz-px));
    max-width: 100%;
}

.section-label-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}

.section-label-count {
    flex: none;
}
</style>
