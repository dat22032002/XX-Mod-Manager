<template>
    <!-- Khung phải = 2 khung RIÊNG ngang hàng (Đạt đính chính 20/11:
         KHÔNG phải khung ngoài lồng 2 khung nhỏ bên trong — khung chính
         tự chia đôi). Gốc chỉ là khung bọc trơn xếp dọc, không viền. -->
    <div class="mod-info-panel" ref="modInfoRef">
        <!-- Khung trên: tên + ảnh + tag. Tag nằm DƯỚI hình, nền xám
             giống ô tìm kiếm; phím tắt ở khung dưới riêng nên không
             đè lên tag. -->
        <div class="mod-panel-top OO-box">
            <div class="mod-title">{{ props.mod ? props.mod.name : $t('modInfo.emptyTitle') }}</div>
            <div class="mod-image" @click="openShowcase" style="cursor: pointer;">
                <img style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover;"
                    :alt="t('mod-image')" :src="img" />
            </div>
            <div v-if="props.mod" class="mod-tag-capsule">
                <span>{{ props.mod.character }}</span>
                <span class="mod-tag-divider"></span>
                <span>{{ t(`modTag.${props.mod.tag || 'character'}`) }}</span>
            </div>
        </div>

        <!-- Khung dưới: phím tắt + 2 nút Sửa/Mở Thư Mục ở đáy
             (Đạt dặn 20/11 — bỏ phần mô tả khỏi khung phải; mô tả vẫn
             sửa được trong hộp Sửa thông tin). Tiêu đề cố định trên,
             danh sách lăn ở giữa, nút cố định dưới. -->
        <div class="mod-panel-bottom OO-box">
            <h4 v-if="props.mod && props.mod.hotkeys && props.mod.hotkeys.length > 0"> {{ $t('modInfo.hotkeys') }}</h4>
            <s-scroll-view class="mod-info-content">
                <div id="hotkey-container" class="OO-colunm-center">
                    <div v-for="hotkey in props.mod ? props.mod.hotkeys : []" class="hotkey OO-setting-bar OO-shade-box a-little-left" style="margin-bottom: 5px;">
                        <h3>{{ hotkey.description }}</h3>
                        <h3>{{ hotkey.key }}</h3>
                    </div>
                </div>
                <p v-if="props.mod && (!props.mod.hotkeys || props.mod.hotkeys.length === 0)" class="mod-no-hotkeys">{{ $t('modInfo.noHotkeys') }}</p>
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
    font-size: 14px;
    font-weight: bolder;
    margin-bottom: -7px;
    margin-left: 17px;
    color: var(--s-color-on-surface-variant);
}

/* Vùng lăn phím tắt: căng hết khung dưới (flex), không tính cao bằng
   calc nữa — calc cũ (100% - 260px) gắn với bố cục 1 khung, đổi bố cục
   là lệch. */
s-scroll-view {
    overflow-y: auto;
    overflow-x: hidden;
}


.mod-info-panel {
    position: relative;
    width: 250px;
    margin-right: 10px;
    /* Cao bằng khung lưới chính (Đạt báo lệch 20/11 — đo ra khung phải
       ngắn hơn khung lưới 26px): khung lưới cao 100% + viền OO-box
       3px×2 (box-sizing content-box nên viền cộng thêm ra ngoài, tổng
       100%+6px); khung bọc không có viền nên cộng 6px vào chiều cao
       thì mép dưới mới bằng nhau ở mọi cỡ cửa sổ. */
    height: calc(100% + 6px);
    text-align: center;
    /* Khung bọc trơn (không viền, không nền): 2 khung xếp dọc — khung
       trên (tên + ảnh + tag), khung dưới (phím tắt + 2 nút ở đáy). */
    display: flex;
    flex-direction: column;
    gap: 10px;
}

/* Khung trên: ảnh + tag. Chiều cao theo nội dung (ảnh 200 + tag). */
.mod-panel-top {
    flex-shrink: 0;
}

/* Khung dưới: phím tắt + 2 nút Sửa/Mở Thư Mục ở đáy (nút là con trực
   tiếp của khung, dưới danh sách lăn). Căng phần còn lại. */
.mod-panel-bottom {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.mod-panel-bottom h4 {
    flex-shrink: 0;
    margin: 0 0 8px 7px;
}

.mod-title {
    flex-shrink: 0;
    font-size: 24px;
    font-weight: bold;
    padding: 10px 0;
    text-align: left;
    word-break: break-all;
    /* Lấp đầy chiều rộng trong của khung trên (250px cố định cũ tràn
       ra ngoài khung vì khung trên hẹp hơn khung ngoài cũ). */
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}


/* Hình trong khung trên: lấp đầy chiều rộng trong của khung (không còn
   tràn ra mép khung ngoài như bố cục 1 khung trước đây). */
.mod-image {
    width: 100%;
    height: 200px;
    border-radius: 8px;
    background-size: cover;
    margin: 0;
}

/* Viên con nhộng tag: 2 nhãn chung 1 nền xám GIỐNG Ô TÌM KIẾM
   (surface-container-low #222222 — Đạt dặn 20/11), viền cùng kiểu ô
   tìm kiếm. Nằm DƯỚI hình trong khung trên, căn giữa; phím tắt ở
   khung dưới riêng nên không bao giờ đè lên tag. */
.mod-tag-capsule {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: fit-content;
    max-width: 100%;
    margin: 10px auto 0;
    background-color: var(--s-color-surface-container-low);
    border: 1px solid var(--s-color-outline-variant);
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
    white-space: nowrap;
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

/* Vùng lăn căng hết khung dưới (flex); không còn margin âm — margin
   -10px cũ là để tràn ra mép khung ngoài ở bố cục 1 khung. */
.mod-info-content {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding-right: 5px;
}

/* Dòng hiện khi mod không có phím tắt nào (không thì khung dưới trống). */
.mod-no-hotkeys {
    margin: 8px 0 0 7px;
    text-align: left;
    font-size: 14px;
    color: var(--s-color-on-surface-variant);
}

/* 2 nút Sửa + Mở Thư Mục ở đáy khung dưới (Đạt dặn 20/11): cố định
   dưới danh sách lăn, cách danh sách 10px. Không còn đặt tuyệt đối
   đè lên khung — nút không che dòng phím tắt nào. Cao 50px = cao nút
   thật (khung chứa cũ cao 30px mà nút cao 50px nên nút tràn ra ngoài). */
.buttons {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    background-color: #00000000;
    border-radius: 20px;
    height: 50px;
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

.a-little-left {
    margin-right: 5px;
}
</style>
