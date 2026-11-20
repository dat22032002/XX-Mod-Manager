<template>
    <div class="mod-info-card OO-box" ref="modInfoRef">
        <div class="mod-title">{{ props.mod ? props.mod.name : $t('modInfo.emptyTitle') }}</div>
        <div class="mod-image" @click="openShowcase" style="cursor: pointer;">
            <img style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover;"
                :alt="t('mod-image')" :src="img" />
            <!-- Viên con nhộng tag: tên nhân vật + loại mod, nền đen, căn
                 giữa dưới hình (Đạt dặn 20/11) — nằm trong khu hình nên
                 lăn chuột không làm mất. Bấm vào tag thì không mở ảnh. -->
            <div v-if="props.mod" class="mod-tag-capsule" @click.stop>
                <span>{{ props.mod.character }}</span>
                <span class="mod-tag-divider"></span>
                <span>{{ t(`modTag.${props.mod.tag || 'character'}`) }}</span>
            </div>
        </div>

        <s-scroll-view class="mod-info-content">
            <h4 v-if="props.mod && props.mod.hotkeys && props.mod.hotkeys.length > 0"> {{ $t('modInfo.hotkeys') }}</h4>
            <div id="hotkey-container" class="OO-colunm-center">
                <div v-for="hotkey in props.mod ? props.mod.hotkeys : []" class="hotkey OO-setting-bar OO-shade-box a-little-left" style="margin-bottom: 5px;">
                    <h3>{{ hotkey.description }}</h3>
                    <h3>{{ hotkey.key }}</h3>
                </div>
            </div>

            <h4> {{ $t('modInfo.description') }}</h4>

            <div class="OO-box OO-shade-box a-little-left" id="mod-info-description">
                <p id="mod-description" style="white-space: pre-warp;">
                    {{ props.mod ? props.mod.description : $t('modInfo.emptyDescription') }}
                </p>
            </div>
            <div class="placeholder"></div>
        </s-scroll-view>

        <div class="buttons">
            <s-tooltip>
                <s-button slot="trigger" @click="editMod" class="edit-button OO-button">
                    <s-icon>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
                            <path
                                d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z">
                            </path>
                        </svg>
                    </s-icon>
                </s-button>
                <p>{{ $t('modInfo.edit') }}</p>
            </s-tooltip>

            <s-tooltip>
                <s-button slot="trigger" @click="openModFolder" class="open-dir-button OO-button font-hongmeng">
                    <s-icon slot="start">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960">
  <path d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z"></path>
</svg>
                    </s-icon>
                    <p>{{ $t('modInfo.openFolder') }}</p>
                </s-button>
                <p>{{ $t('modInfo.openFolder') }}</p>
            </s-tooltip>
        </div>
    </div>
    <!-- Xem anh goc: bam vao hinh trong khung phai thi anh hien to giua
         man hinh; bam them 1 lan bat ky dau hoac phim Esc de dong. -->
    <Teleport to="body">
        <div v-if="showcaseOpen" class="showcase-overlay" @click="closeShowcase">
            <img :src="img" alt="" />
        </div>
    </Teleport>
</template>

<script setup>
import { computed, defineProps, onUnmounted, ref, watch } from 'vue';
import fsProxy from '../../electron/fsProxy';
import { ModData } from '../../core/ModHelper';
import { snack } from '../../helper/SnackHelper';
import { DialogID , DialogHelper } from '../../helper/DialogHelper';
// 导入 i18n 的 t 函数
import { useI18n } from 'vue-i18n';
import { EventSystem, EventType } from '../../helper/EventSystem';
const { t } = useI18n();

const props = defineProps({
    mod: {
        type: ModData,
        default: null
    }
});
const img = ref('data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D');

//===================== xem anh goc (showcase) =====================//
// Bam vao hinh trong khung phai → anh goc hien to giua man hinh (dung
// dung anh goc khung phai dang hien, khoi tai them). Bam them 1 lan bat
// ky dau (lop phu che het man hinh) hoac phim Esc de dong. Doi mod thi
// tu dong (xem watch props.mod ben duoi).
const showcaseOpen = ref(false);
const onShowcaseKeydown = (e) => {
    if (e.key === 'Escape') closeShowcase();
};
const openShowcase = () => {
    if (props.mod == null || props.mod.preview == null) return;
    showcaseOpen.value = true;
    window.addEventListener('keydown', onShowcaseKeydown);
};
const closeShowcase = () => {
    if (!showcaseOpen.value) return;
    showcaseOpen.value = false;
    window.removeEventListener('keydown', onShowcaseKeydown);
};
onUnmounted(() => {
    window.removeEventListener('keydown', onShowcaseKeydown);
});

watch(() => props.mod, (newMod) => {
    closeShowcase();
    if (newMod == null) {
        img.value = null;
        return;
    }
    newMod.getPreviewBase64(true, true).then((base64) => {
        img.value = base64;
    });
});

EventSystem.on(EventType.modInfoChanged,(mod) => {
    if (mod.name == props.mod.name) {
        setTimeout(() => {
            props.mod.getPreviewBase64(true, true).then((base64) => {
                img.value = base64;
            });
        }, 1);
    }
});

// const emit = defineEmits(['clickEditButton']);

const editMod = () => {
    if (props.mod == null) {
        snack(t('no-mod-selected'), 'error');
        return;
    }
    DialogHelper.showDialog(DialogID.editModDialog);
};

const openModFolder = async () => {
    //ipcRenderer.send('open-url', props.mod?.url);
    if (props.mod == null) {
        snack(t('no-mod-selected'), 'error');
        return;
    }
    fsProxy.openDir(await props.mod.getModPath());
};

</script>

<style scoped>
h4 {
    text-align: left;
    font-size: 15px;
    font-weight: bolder;
    margin-bottom: -7px;
    margin-left: 17px;
    color: var(--s-color-on-surface-variant);
}

/* Vùng lăn: cao = chiều cao khung trừ phần trên (tiêu đề ~50 + hình 200
   + lề 10 = 260). Con số 240 cũ tính cho bố cục có ô tên nhân vật
   (hình kết thúc ở 250); bỏ ô đó rồi mà giữ 240 thì vùng lăn dài thừa
   10px ở đáy + margin-top -10px làm nội dung chui xuống dưới hình khi
   lăn (Đạt báo 20/11). */
s-scroll-view {
    height: calc(100% - 260px);
    overflow-y: auto;
    overflow-x: hidden;
}


.mod-info-card {
    position: relative;
    width: 250px;
    margin-right: 10px;
    height: calc(100% - 20px);
    text-align: center;
}

.mod-title {
    font-size: 25px;
    font-weight: bold;
    padding: 10px 0;
    text-align: left;
    word-break: break-all;
    width: 250px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}


/* Hinh khung phai: truoc day margin-top -50px de chui xuong duoi o ten
   nhan vat; bo o do roi thi hinh ve cho binh thuong (Dat dan 20/11). */
.mod-image {
    position: relative;
    width: calc(100% + 20px);
    height: auto;
    border-radius: 8px;
    background-size: cover;
    height: 200px;

    margin-top: 10px;
    margin-left: -10px;
}

/* Viên con nhộng tag: 2 nhãn chung 1 nền đen, căn giữa dưới hình
   (Đạt dặn 20/11 — không nền vàng). Viền mờ để vẫn thấy trên hình tối. */
.mod-tag-capsule {
    position: absolute;
    left: 50%;
    bottom: 10px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: #000000;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
    max-width: calc(100% - 20px);
}
.mod-tag-capsule span {
    overflow: hidden;
    text-overflow: ellipsis;
}
.mod-tag-divider {
    width: 1px;
    height: 14px;
    background-color: rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
}

/* Lop phu xem anh goc: giua man hinh, bam bat ky dau de dong. Anh giu
   kich thuoc that, chi thu lai khi vuot qua cua so (khong phong to). */
.showcase-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    cursor: pointer;
    z-index: 9999;
}
.showcase-overlay img {
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 48px);
    object-fit: contain;
    border-radius: 8px;
}

.hotkey {
    height: 40px;
}

#mod-info-description {
    margin-top: 10px;
    margin-bottom: 10px;
    height: fit-content;
    padding: 5px;
    overflow-y: auto;
    overflow-x: hidden;
    color: var(--s-color-on-surface-variant);
    line-break: anywhere;

    p {
        padding: 10px;
        font-size: 15px;
        text-align: left;
        font-weight: 500;
    }
}

.mod-info-content {
    /* margin-top -10px cũ kéo vùng lăn chui xuống dưới hình 10px nên nội
       dung lăn lên bị hình che mất (Đạt báo 20/11) — về 0 cho vùng lăn
       bắt đầu đúng ở mép dưới hình. */
    margin: 0 -10px 0px 0px;
    padding-right: 5px;
}

.buttons {
    position: absolute;
    display: flex;
    justify-content: space-between;
    margin-top: 16px;
    bottom: 0px;
    left: 8px;
    right: 8px;
    margin-bottom: 26px;
    background-color: #00000000;
    border-radius: 20px;
    height: 30px;
    /* backdrop-filter: blur(2px); */
}

.edit-button {
    border-radius: 25px;
    padding: 0;
    height: 50px;
    width: 50px;
    min-width: 0px;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
}

.open-dir-button {
    height: 50px;
    border-radius: 24px;
    padding: 10px 20px;
}

.placeholder {
    height: 100px;
}

.a-little-left {
    margin-right: 5px;
}
</style>
