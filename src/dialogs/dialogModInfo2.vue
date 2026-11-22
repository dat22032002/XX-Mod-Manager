<template>
  <DialogTemplate id="edit-mod-dialog" ref="edit-mod-dialog" maxWidth="1000px">
    <template v-slot:content>
      <h3 style="height: fit-content;margin: -5px 30px 5px 30px;font-size: 24px;z-index:1" class="font-hongmeng">
        {{ $t('editDialog.edit-mod-info') }}
      </h3>

      <div id="edit-mod-info-dialog-container"
        style="display: flex;flex-direction: column;align-items: center;width: 100%;  font-size: 16px;z-index:1">
        <div id="edit-mod-info-dialog-top" style="display: flex;width: 100%;">
          <!-- 展示mod当前名称、图片 -->
          <div class="OO-box"
            style="width: 280px;min-width: 0;display:flex;flex-direction: column;align-items: center;flex-wrap: nowrap;justify-content: flex-start;"
            id="edit-mod-info-left">
            <div class="OO-box OO-shade-box"
              style="width: calc(100% - 40px);padding: 10px 20px;margin:0;border-radius: 12px;">
              <h3 id="editDialog-mod-info-name" style="white-space:normal;word-break:keep-all;height: fit-content;">
                {{ tempModInfo ? tempModInfo.name : "no name" }}</h3>
            </div>
            <p id="editDialog-mod-info-character"
              style="margin-top: 2px;font-size: small;color: gray;height: fit-content;width: fit-content;margin-bottom: 0;padding-bottom: 10px;">
              {{ props.mod ? props.mod.character : "no character" }}</p>

            <!-- Bấm vào ảnh bìa thì mở Showcase y chang bấm ảnh ở khung
                 phải (Đạt dặn 22/11) — xem khối showcase ở cuối file.
                 Kéo-thả ảnh vào khung bìa thì đổi ảnh bìa (Đạt dặn
                 22/11) — xem handleCoverDrop ở dưới. -->
            <div id="img-container" @click="openShowcase" @dragenter="handleCoverDragEnter"
              @dragleave="handleCoverDragLeave" @dragover="handleCoverDragOver" @drop="handleCoverDrop"
              :class="{ 'cover-drop-hover': coverDragOver }"
              style="width: 280px;height: 224px;border-radius: 12px;overflow: hidden;cursor: pointer;">
              <img id="editDialog-mod-info-image"
                style="width: 100%; height: 100%; max-width: 100%; max-height: 100%; object-fit: cover;" :src="img" />
            </div>

            <div class="OO-setting-bar">
              <!-- Bỏ chú thích khi rê chuột (Đạt thấy không cần thiết,
                   20/11): nhãn và nút giữ nguyên, chỉ gỡ khung tooltip
                   cùng dòng giải thích. -->
              <h3> {{ $t('editDialog.mod-info-image') }} </h3>

              <!-- 2 nút kề nhau ở mép phải hàng: + chọn ảnh bìa (cũ) +
                   mở thư mục mod (Đạt dặn 22/11). Bọc chung 1 div flex
                   để 2 nút dính nhau — để rời thì space-between của hàng
                   đẩy nút + ra giữa hàng. left: 15px dời từ nút + sang
                   div bọc để mép phải của cặp nút vẫn đúng chỗ cũ của
                   nút + (hàng có padding 20px nên mép phải cặp nút cách
                   mép phải cột 18px, như nút + trước đây). -->
              <div style="display: flex; gap: 8px; position: relative; left: 15px;">
                <s-icon-button icon="image" @click="handleSelectImage" class="OO-icon-button"
                  style="position: relative; border: 5px solid var(--s-color-surface-container-high); transform: scale(1);">
                  <s-icon type="add"></s-icon>
                </s-icon-button>
                <s-icon-button id="open-folder-button" @click="handleOpenFolder" class="OO-icon-button"
                  style="position: relative; border: 5px solid var(--s-color-surface-container-high); transform: scale(1);">
                  <!-- Sober không có icon thư mục (icon.js chỉ có home/
                       add/search/menu/mũi tên/chevron/...) nên nhét SVG
                       Material folder_open trực tiếp, cùng kiểu nút Hoàn
                       tác ở thanh dưới (SVG inline trong s-icon). -->
                  <s-icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path
                        d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" /></svg></s-icon>
                </s-icon-button>
              </div>
            </div>
          </div>

          <div style="height: 100%;margin-left: 1%;flex: 1;" id="edit-mod-info-content" class="OO-box">

            <!-- -mod名称 -->
            <div class="OO-setting-bar">
              <h3> {{ $t('editDialog.mod-info-name') }} </h3>

              <!-- <s-button>
                <p id="edit-mod-name"> {{ tempModInfo ? tempModInfo.name : "no name" }} </p>
              </s-button> -->
              <s-text-field :value="tempModInfo.name" @change="handleModNameChange" id="edit-mod-name" />
            </div>

            <!-- -mod角色 -->
            <div class="OO-setting-bar">
              <h3> {{ $t('editDialog.mod-info-character') }} </h3>
              <!-- Ô nhập dời sang trái 47px để chừa chỗ cho nút chọn nhân
                   vật có sẵn ở mép phải hàng (Đạt dặn 20/11). Gõ tay tên
                   mới vẫn được như cũ. -->
              <s-text-field :value="tempModInfo.character" @input="tempModInfo.character = $event.target.value"
                style="right: 52px;" id="edit-mod-character" />
              <!-- Nút chọn nhân vật có sẵn: bấm thì hiện danh sách chip
                   nhân vật đã có (đúng thứ tự chip trên thanh lọc), bấm
                   tên thì điền vào ô nhập. Dùng s-popup như nút xem phím
                   tắt ở hàng Hotkeys (bấm ra ngoài thì tự đóng). -->
              <!-- --z-index: 10: wrapper popup mặc định z-index 1, chip
                   cũng z-index 1, hàng Tag đứng sau trong DOM nên che
                   mất bảng chọn (Đạt thấy 20/11). Nâng lên 10 thì bảng
                   chọn nổi lên trên chip. -->
              <!-- Vị trí tuyệt đối đặt trên KHUNG s-popup (không đặt
                   trên nút): Sober neo bảng chọn theo khung chứa nút
                   (slot trigger), nút mà tuyệt đối thì khung đó co về
                   0x0, bảng chọn mở ra ở đầu hàng rồi đè lên nút
                   (Đạt thấy 21/11). Nút nằm trong luồng bình thường
                   thì khung chứa ôm đúng nút, bảng chọn mở ngay dưới
                   nút, không che nút nữa. Hàng .OO-setting-bar đã
                   position: relative nên khung neo đúng mép phải hàng.
                   z-index: 10 trên KHUNG (không chỉ --z-index):
                   transform tạo stacking context nhốt z-index của
                   bảng chọn, chip hàng Tag (z-index 1) đè lên bảng
                   nếu khung không có z-index riêng (soi ảnh 21/11). -->
              <s-popup id="character-picker-popup" ref="characterPopupRef"
                style="--z-index: 10; position: absolute; right: 5px; top: 50%; transform: translateY(-50%); z-index: 10;">
                <!-- scale(1): nút s-icon-button không có scale(1) thì
                     co về 0.83x (33px thay vì 40px), lệch khỏi nút
                     Hotkeys bên dưới (soi ảnh 21/11). -->
                <s-icon-button slot="trigger" class="OO-icon-button" id="character-picker-button"
                  style="margin: 0; border: 5px solid var(--s-color-surface-container-high); transform: scale(1);">
                  <s-icon type="chevron_down"></s-icon>
                </s-icon-button>
                <div class="OO-box OO-shade-box character-picker-list">
                  <div v-for="name in characterList" :key="name" class="character-picker-item"
                    :class="{ current: name === tempModInfo.character }" :title="name" @click="selectCharacter(name)">
                    {{ name }}
                  </div>
                </div>
              </s-popup>
            </div>

            <!-- -tag mod: chọn trong 6 tag có sẵn, thay ô liên kết nguồn
                 từ 1.5.18 (Đạt dặn 20/11). Liên kết nguồn cũ vẫn nằm
                 trong mod.json, chỉ không sửa ở hộp này nữa. -->
            <div class="OO-setting-bar" id="edit-mod-tag-row">
              <h3> {{ $t('editDialog.mod-info-tag') }} </h3>
              <div style="flex: 1;min-width: 0;display: flex;justify-content: flex-end;">
                <chipRadioBar :items="tagItems" :translatedItems="translatedTags"
                  @itemChange="handleTagChange" ref="tagBarRef" straight />
              </div>
            </div>

            <!-- -mod快捷键 -->
            <div class="OO-setting-bar">
              <h3> {{ $t('editDialog.mod-info-hotkeys') }} </h3>
              <div style="display: flex;flex-direction: row;align-items: center;justify-content: space-between;">
                <horizontalScrollBar class="OO-box OO-shade-box hotkey-container" scrollSpeed=0.5 dragSpeed=1>
                  <div style="display: flex;flex-direction: row;flex-wrap: nowrap;padding: 0 10px;">
                    <div v-for="(hotkey, index) in tempModInfo.hotkeys" :key="index">
                      <div
                        style="margin: 0px 3px;height: 35px;padding: 20px 15px 20px 15px;transform: skew(-20deg);border-radius: 0;min-width: 50px"
                        class="OO-button">
                        <p style="transform: skew(20deg);">
                          {{ hotkey.key }}
                        </p>
                      </div>
                    </div>
                  </div>
                </horizontalScrollBar>
                <s-popup align="left">
                  <s-icon-button slot="trigger" icon="image" class="OO-icon-button"
                    style="position: relative;left: 15px;border: 5px solid var(--s-color-surface-container-high);transform: scale(1);">
                    <s-icon type="chevron_down"></s-icon>
                  </s-icon-button>

                  <div class="OO-box OO-shade-box" style="width: 70vb;height: fit-content;max-height: calc(100vh - 200px);overflow-y: auto;">
                    <div v-for="(hotkey, index) in tempModInfo.hotkeys" :key="index" class="hotkey-item OO-setting-bar">
                      <s-text-field :value="hotkey.description" @input="hotkey.description = $event.target.value"
                        style="left: 5px;" />
                      <s-text-field :value="hotkey.key" @change="handleHotkeyInput(hotkey, $event.target.value)" />
                    </div>
                  </div>

                </s-popup>
              </div>
            </div>

            <!-- -mod描述 -->
            <div class="OO-setting-bar"
              style="display: flex;flex-direction: column;align-items: flex-start;justify-content: space-between;height:150px;">
              <h3 style="padding:15px 0;"> {{ $t('editDialog.mod-info-description') }} </h3>
              <s-text-field class="OO-shade-box"
                style="min-height: calc(100% - 50px);height: 0px;border-radius: 20px;bottom: 5px;top: 45px;left: 5px;right: 5px;max-width: calc(100% - 10px);width: calc(100% - 10px);"
                multiLine="true" :value="tempModInfo.description" @input="tempModInfo.description = $event.target.value"
                id="edit-mod-description"></s-text-field>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-slot:action>
      <s-button slot="action" type="text" id="dialog-cancel" class="OO-button font-hongmeng" @click="handleCancel"
        style="margin-left: 20px;
    margin-right: 20px;">
        <p>{{ $t('buttons.cancel') }}</p>
      </s-button>
      <s-button slot="action" type="text" id="preset-add-confirm" class="OO-button font-hongmeng OO-color-gradient"
        @click="handleSave"
        :style="{ color: 'var(--s-color-surface)', marginLeft: '20px', marginRight: '20px', opacity: tagChosen ? 1 : 0.35 }">
        <p>{{ $t('buttons.save') }}</p>
      </s-button>
    </template>

  </DialogTemplate>

  <!-- -取消时再次询问是否保存 -->
  <!-- -提示是否保存更改 -->
  <DialogTemplate id="save-change-dialog">
    <template v-slot:content>
      <h2 style="padding: 0;margin: 0;">{{ $t('editDialog.changeNotSave') }}</h2>
      <h3 style="z-index:1">{{ $t('editDialog.ifSaveChange') }}</h3>
    </template>
    <template v-slot:action>
      <s-button slot="action" type="text" id="save-change-ignore" @click="handleCancel"
        style="margin-left: 20px;margin-left: 20px;" class="OO-button">{{ $t('editDialog.ignore') }}</s-button>
      <s-button slot="action" type="text" id="save-change-confirm" @click="handleSave"
        style="margin-left: 20px;margin-left: 20px;color: var(--s-color-on-surface);" class="OO-button">{{
          $t('editDialog.save') }}</s-button>
    </template>
  </DialogTemplate>

  <!-- Xem ảnh gốc (Showcase): Y HỆT cơ chế ở khung phải (modInfo.vue) —
       bấm ảnh thì ảnh hiện to giữa màn hình, bấm thêm 1 lần bất kỳ đâu
       hoặc phím Esc thì đóng. Teleport ra body + z-index 9999 nên lớp
       phủ nổi lên TRÊN cả hộp thoại này (hộp Sober chỉ z-index 2);
       lớp phủ che hết màn hình nên lúc đang mở thì không bấm lọt được
       nút Lưu/Hủy hay nền hộp phía sau. -->
  <Teleport to="body">
    <div v-if="showcaseOpen" class="showcase-overlay" @click="closeShowcase">
      <img :src="img" alt="" />
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import { defineProps, defineEmits, onMounted, onUnmounted, computed, watch, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import IManager from '../../electron/IManager';
import { g_data_vue } from '../../electron/IManager';
import fsProxy from '../../electron/fsProxy';
import { snack } from '../../helper/SnackHelper';
import DialogTemplate from './dialogTemplate.vue';
import horizontalScrollBar from '../components/horizontalScrollBar.vue';
import chipRadioBar from '../components/chipRadioBar.vue';
import { ModData } from '../../core/ModHelper';
import { TranslatedText } from '../../helper/Language';
import { MOD_TAGS, isValidTag } from '../../helper/ModTag';
import { EventType, EventSystem } from '../../helper/EventSystem';
const iManager = new IManager();

// 参数为 字符串类型的 mod，之后通过 iManager.getModInfo(mod) 获取 mod 信息
const props = defineProps({
  mod: ModData,
});

const { t } = useI18n();

// TC23: cờ "đang lưu" — nút Lưu nằm trong vùng action của hộp Sober nên
// bấm là hộp tự đóng (Sober gọi dismiss('ACTION')); sự kiện dismiss của
// Sober là cancelable nên bộ nghe dismiss bên dưới gọi preventDefault()
// khi đang lưu, hộp ở lại cho tới khi lưu xong (thành công thì đóng bằng
// code, lỗi thì ở lại để bấm Lưu lại). saveFailed để lần Lưu sau thử ghi
// lại dù nội dung trong RAM đã giống nhau (editModInfo áp dụng trước khi
// ghi đĩa nên sau 1 lần lỗi, equals() đã là true).
let savePending = false;
let saveFailed = false;

let saved = false;

// Hộp đang mở cho mod MỚI (vừa nhập vào) hay mod đã có — cờ do luồng
// nhập đặt trước khi mở hộp (iManager.temp.editingNewMod), hộp đọc lúc
// mở + xóa lúc đóng hẳn. Tính năng nhảy tới mod mới + không chọn sẵn
// tag cùng dùng cờ này.
let isNewMod = false;

// Mod MỚI đóng hộp mà không lưu thì xóa luôn mod vừa nhập (Đạt báo
// 22/11: bấm Cancel mà mod vẫn vào kho). `saved` có sẵn KHÔNG dùng
// được: đường Lưu không đổi gì thì hộp tự đóng mà không đặt saved.
// saveClicked đặt riêng trong handleSave (qua được cổng chọn tag).
// Tên + đường dẫn chụp LÚC MỞ HỘP — lúc hộp đóng hẳn thì props.mod có
// thể đã đổi sang mod khác do rê chuột (bẫy vụ #113).
let saveClicked = false;
let confirmShown = false;
let pendingDiscard = false;
let newModName = null;
let newModPath = null;

// modInfo 为 mod 信息，用于储存临时修改的 mod 信息，最后保存时再将其赋值给 props.mod
const tempModInfo = ref(ModData.fromJson({
  name: 'Unknown',
  character: '',
  url: '',
  hotkeys: [],
  description: '',
  preview: '',
}));

const editModInfoDialog = useTemplateRef('edit-mod-dialog');
const img = ref(null);

//===================== xem ảnh gốc (showcase) =====================//
// Y HỆT cơ chế ở khung phải (modInfo.vue): bấm ảnh bìa trong hộp sửa
// thì ảnh hiện to giữa màn hình (dùng đúng ảnh hộp đang hiện, kể cả ảnh
// vừa dán/chọn chưa lưu). Bấm thêm 1 lần bất kỳ đâu (lớp phủ che hết
// màn hình) hoặc phím Esc thì đóng. Hộp Sober không tự bắt phím Esc
// nên Esc chỉ đóng showcase, không đóng hộp sửa. Đổi mod / hộp đóng
// hẳn thì showcase cũng đóng theo (xem watch props.mod + bộ nghe
// 'dismissed' bên dưới) để lớp phủ không kẹt lại.
const showcaseOpen = ref(false);
const onShowcaseKeydown = (e) => {
  if (e.key === 'Escape') closeShowcase();
};
const openShowcase = () => {
  if (props.mod == null || !img.value) return;
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

// 需要显示的mod发生变化时，更新 临时mod信息
watch(() => props.mod, async (newVal) => {
  console.log('[dialogModInfo2] watch props.mod changed', newVal.name);
  // 检查newVal 的类型，应当为 ModData 类型，如果不是则尝试转化为 ModData 类型
  if (!(newVal instanceof ModData)) {
    console.error('mod is not a ModData instance');
    return;
  }
  if (newVal) {
    // Đổi mod thì đóng showcase (giống khung phải).
    closeShowcase();
    // 显式销毁之前的 tempModInfo
    tempModInfo?.value?.destroy();
    tempModInfo.value = newVal.copy();
    // Mod MỚI: chụp tên + đường dẫn để xóa lúc đóng hộp mà không lưu.
    // Chụp Ở ĐÂY (watch props.mod), không chụp ở bộ nghe 'show': 'show'
    // chạy đồng bộ lúc mở hộp, Vue chưa kịp cập nhật props.mod nên lúc
    // đó props.mod vẫn là mod cũ — chụp ở 'show' sẽ xóa NHẦM mod cũ
    // (bắt được bằng probe 22/11: xóa nhầm Ellen Dress 05).
    if (isNewMod) {
      newModName = newVal.name;
      newModPath = await newVal.getModPath();
    }
    img.value = await newVal.getPreviewBase64(true, true);
  }
});

const handleModNameChange = (event) => {
  //debug
  console.log(`input mod name`, event.target.value, `of`, tempModInfo.value.id);
  tempModInfo.value.name = event.target.value;

  // 检查 mod 名称是否为空，如果为空则设置为默认值
  if (tempModInfo.value.name === '') {
    tempModInfo.value.name = props.mod.name;
    const tt = new TranslatedText(`Cannot set mod name to empty`, `Không đặt tên mod thành trống được`);
    iManager.t_snack(tt, `error`);
  }

  // 检查 mod 名称是否重复，如果重复则设置为默认值
  if (tempModInfo.value.name !== props.mod.name) {
    const modList = iManager.data.modList;
    const modNameList = modList.map(mod => mod.name);
    if (modNameList.includes(tempModInfo.value.name)) {
      tempModInfo.value.name = props.mod.name;
      const tt = new TranslatedText(`Mod name already exists`, `Tên mod đã tồn tại`);
      iManager.t_snack(tt, `error`);
    }
  }

  // Tên sẽ thành tên thư mục trên đĩa nên không được chứa ký tự Windows
  // cấm. (Khoảng trắng/dấu chấm ở cuối tên thì kiểm lúc bấm Lưu — kiểm
  // lúc gõ sẽ chặn cả khi đang gõ tên có khoảng trắng ở giữa.)
  if (/[<>:"\/\\|?*\x00-\x1f]/.test(tempModInfo.value.name)) {
    tempModInfo.value.name = props.mod.name;
    const tt = new TranslatedText(`Mod name cannot contain < > : " / \\ | ? *`, `Tên mod không được chứa ký tự < > : " / \\ | ? *`);
    iManager.t_snack(tt, `error`);
  }
}

//-==================== chọn tag mod ====================//
// 6 tag có sẵn (ModTag), hiển thị bằng chipRadioBar giống hàng lọc.
// Thanh vàng của thanh chip đo theo kích thước chip nên lúc hộp mới mở
// (hộp còn ẩn, chip đo được 0) phải đo lại sau 2 khung hình — xem bộ
// nghe 'show' ở dưới.
const tagItems = MOD_TAGS;
const translatedTags = computed(() => MOD_TAGS.map(tag => t(`modTag.${tag}`)));
const tagBarRef = useTemplateRef('tagBarRef');

// Mod MỚI thì chưa chọn tag nào (Đạt dặn 22/11) — nút Lưu mờ đi cho
// tới khi chọn 1 tag. Mod đã có thì true ngay (giữ tag cũ của nó).
const tagChosen = ref(true);

const handleTagChange = (tag) => {
  if (!isValidTag(tag)) return;
  tempModInfo.value.tag = tag;
  tagChosen.value = true;
};

//-==================== chọn nhân vật có sẵn ====================//
// Danh sách chip nhân vật đã có — characterList vốn đã xếp theo tên,
// đúng thứ tự chip trên thanh lọc. Bấm tên trong danh sách thì điền
// vào ô Character rồi đóng bảng chọn.
const characterList = g_data_vue.characterList;
const characterPopupRef = useTemplateRef('characterPopupRef');
function selectCharacter(name) {
  tempModInfo.value.character = name;
  if (characterPopupRef.value) characterPopupRef.value.dismiss();
}

const handleHotkeyInput = (hotkey, value) => {
  //debug
  console.log(`input hot key`, hotkey, value, `to`, tempModInfo.value.id);
  if (value === '') {
    // 删除快捷键
    const index = tempModInfo.value.hotkeys.indexOf(hotkey);
    tempModInfo.value.hotkeys.splice(index, 1);
    return;
  }
  hotkey.key = value;
}

const handleSelectImage = async () => {
  const imgPath = await iManager.getFilePath('preview', 'image', tempModInfo.value.preview);
  if (imgPath) {
    const imgBase64 = await iManager.getImageBase64(imgPath);
    img.value = "data:image/png;base64," + imgBase64;
    tempModInfo.value.preview = imgPath;
  }
}

// Mở thư mục của mod đang sửa (Đạt dặn 22/11) — dùng Y HỆT cơ chế
// nút Open Folder ở khung phải (modInfo.vue: openModFolder).
const handleOpenFolder = async () => {
  if (props.mod == null) {
    snack(t('no-mod-selected'), 'error');
    return;
  }
  fsProxy.openDir(await props.mod.getModPath());
}

const handleCancel = async () => {
  tempModInfo.value = props.mod.copy();
  img.value = await props.mod.getPreviewBase64(true, true);
  // TC22: hủy thì quên ảnh đã dán, lần lưu sau không ghi đè ảnh bìa nữa.
  changdPreviewByPaste = false;
  // TC23: hủy thì thôi giữ hộp — lần lưu lỗi trước đó không chặn nút Hủy.
  saveFailed = false;
  // Bỏ qua ở hộp xác nhận lưu (hộp sửa đã đóng hẳn, pendingDiscard đang
  // bật) thì xóa mod mới vừa nhập.
  if (pendingDiscard && newModName && newModPath) {
    pendingDiscard = false;
    iManager.discardNewMod(newModName, newModPath);
  }
}

const handleSave = async () => {
  // Bấm Lưu 2 lần liên tiếp (thói quen từ lúc còn lỗi phải bấm 2 lần) sẽ
  // chạy lưu 2 lần chồng nhau — lần sau tính toán trên dữ liệu lần trước
  // đã đổi dở. Đang lưu thì lần bấm sau bỏ qua (Đạt gặp 20/11).
  if (savePending) return;
  // Mod MỚI chưa chọn tag thì chưa cho lưu (Đạt dặn 22/11): đặt
  // saveFailed để bộ nghe dismiss chặn lần tự đóng của Sober (chỉ chặn
  // nguồn ACTION) + báo rõ để chọn tag rồi bấm Lưu lại. Lần Lưu sau
  // (đã chọn tag) chạy đủ bước nhờ đường retry có sẵn của saveFailed.
  if (isNewMod && !tagChosen.value) {
    saveFailed = true;
    const tt = new TranslatedText(`Please choose a tag before saving`, `Hãy chọn 1 tag trước khi lưu`);
    iManager.t_snack(tt, `error`);
    return;
  }
  // Đã bấm Lưu (qua được cổng chọn tag) — mod mới được giữ lại, không
  // xóa lúc hộp đóng (xem 'dismissed'). Lưu lỗi thì đặt lại false ở
  // catch để bấm Cancel sau đó vẫn xóa.
  saveClicked = true;
  pendingDiscard = false;
  //debug
  // Đặt cờ trước mọi await. Nút Lưu nằm trong vùng action của Sober nên
  // bấm là hộp tự đóng theo mặc định thư viện — bộ nghe dismiss (dưới)
  // chặn lại nhờ savePending/saveFailed, và chỉ đóng hộp bằng lệnh khi
  // lưu thành công (xem cuối hàm).
  savePending = true;
  try {
    const ifEqual = props.mod.equals(tempModInfo.value);
    console.log('saved', saved, `equals`, ifEqual);
    // 保存修改的 mod 信息

    if (ifEqual && !changdPreviewByPaste && !saveFailed) {
      // Không có gì để lưu: hạ cờ để hộp tự đóng như cũ.
      // editModInfoDialog.value.$el.dismiss();
      // 点击按钮自动会关闭dialog，这里如果手动关闭会导致再次触发dismiss事件，导致不必要的性能消耗
      // Vẫn tính là đã Lưu (bấm Lưu, không đổi gì) để nhảy tới mod mới.
      savedThisSession = true;
      jumpModName = props.mod.name;
      jumpCharacter = props.mod.character;
      savePending = false;
      return;
    }

    // Tên sẽ thành tên thư mục trên đĩa: không được kết thúc bằng khoảng
    // trắng hay dấu chấm (Windows tự cắt, tên sẽ lệch với những gì đã gõ).
    // Ném lỗi để khối catch dưới giữ hộp mở + báo lỗi như mọi lỗi lưu khác.
    if (tempModInfo.value.name !== props.mod.name && /[\s.]$/.test(tempModInfo.value.name)) {
      throw new Error(t('editDialog.badNameEnding'));
    }

    // Lưu tên cũ trước khi đổi: đổi tên xong thì dời luôn liên kết trong
    // thư mục đích theo tên mới (không thì liên kết cũ gãy).
    const oldName = props.mod.name;

    // 处理 图片 更改
    let needChangePreview = false;
    if (props.mod.preview !== tempModInfo.value.preview) {
      needChangePreview = true;
    }

    // Sao chép/dán ảnh bìa TRƯỚC khi đổi tên trong bộ nhớ: đích sao
    // chép tính theo thư mục mod hiện tại (còn tồn tại). Làm sau khi
    // đổi tên thì đích tính theo tên mới — thư mục chưa tồn tại nên
    // lỗi "không tìm thấy file" và phải bấm Lưu 2 lần (Đạt gặp 19/11
    // khi đổi (ac) thành (mod): copyfile ...(ac)... -> ...(mod)...).
    // editModInfo bên dưới ghi đè this.preview bằng đường dẫn ảnh đã
    // chọn nên phải đặt lại đường dẫn đích sau đó.
    let newPreviewPath = null;
    if (needChangePreview) {
      newPreviewPath = await props.mod.setPreviewByPath(tempModInfo.value.preview);
    }

    // 如果是通过粘贴操作更改的预览图片，则保存到本地
    if (changdPreviewByPaste) {
      newPreviewPath = await props.mod.setPreviewByBase64(img.value);
    }

    // 保存修改的 mod 信息
    props.mod.editModInfo(tempModInfo.value);
    if (newPreviewPath) {
      props.mod.preview = newPreviewPath;
    }

    // TC23: chờ ghi đĩa thật + bắt lỗi — trước đây saveModInfo() không
    // await/không try/catch nên ổ đầy/thư mục bị xóa ngoài thì lỗi chìm
    // trong khi hộp đã tự đóng, người dùng tưởng đã lưu.
    await props.mod.saveModInfo();

    // Đổi tên thì dời luôn liên kết trong thư mục đích theo tên mới
    // (chế độ thường; chế độ truyền thống không có liên kết).
    if (oldName !== props.mod.name) {
      iManager.moveAppliedLink(oldName, props.mod.name);
    }

    tempModInfo.value = props.mod.copy();
    saved = true;
    // Lưu thành công — lúc hộp đóng hẳn sẽ nhảy tới mod này (nếu là mod mới).
    savedThisSession = true;
    jumpModName = props.mod.name;
    jumpCharacter = props.mod.character;
    saveFailed = false;
    // TC22: lưu xong thì quên ảnh đã dán.
    changdPreviewByPaste = false;

    props.mod.triggerChanged();
    props.mod.triggerCurrentModChanged();

    // Lưu xong mới đóng hộp bằng code (lần đóng tự động lúc bấm nút đã bị
    // chặn lại nhờ savePending).
    savePending = false;
    editModInfoDialog.value.$el.dismiss();
  } catch (error) {
    // Lỗi: hộp vẫn mở (lần đóng tự động đã bị chặn), báo rõ lỗi để bấm Lưu lại.
    savePending = false;
    saveFailed = true;
    saveClicked = false;
    console.error('dialogModInfo2: failed to save mod info', error);
    iManager.snack(t('editDialog.saveFailed', { error: error.message }), 'error');
  }
}

// Nhảy tới mod MỚI sau khi Lưu (Đạt dặn 22/11): hộp mở cho mod mới +
// đã Lưu thành công thì lúc hộp đóng hẳn, bắn sự kiện jumpToMod để lưới
// chuyển sang nhân vật của mod + lăn tới thẻ mod đó. Biến riêng của tính
// năng này (không dùng chung cờ với tính năng không-chọn-sẵn-tag) để 2
// nhánh gộp sạch vào nhau.
// Tên + nhân vật chụp LẠI LÚC LƯU (handleSave), không đọc props.mod lúc
// hộp đóng hẳn: lúc đóng, props.mod có thể đã đổi sang mod khác — rê
// chuột lên thẻ nào 0,25 giây là khung phải đổi sang thẻ đó (hover-follow),
// và 'dismissed' chạy SAU khi hiệu ứng đóng kết thúc nên hẹn giờ rê
// chuột kịp chạy trước. Tên mod là khóa khớp (không dùng id: Lưu qua
// hộp sửa sinh lại id mới = md5(đường dẫn) trong file, id trong bộ nhớ
// không đồng bộ lại nên id lúc mở hộp lệch với id sau khi tải lại).
let jumpIsNewMod = false;
let savedThisSession = false;
let jumpModName = '';
let jumpCharacter = '';

let changdPreviewByPaste = false;

// TC22: chỉ nhận dán ảnh khi hộp sửa đang mở (đăng ký lúc show, gỡ lúc
// dismissed), và chỉ nhận file đúng là ảnh. Trước đây bộ nghe đăng ký 1
// lần lúc mở app, không bao giờ gỡ — dán ảnh vào ô tìm kiếm cũng đổi ảnh
// bìa mod đang chọn, dán file zip cũng bị đọc thành ảnh.
const handlePaste = async (event) => {
  //debug
  console.log('paste', event.clipboardData);
  const clipboardData = event.clipboardData || event.originalEvent?.clipboardData;
  const items = clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (!blob || !blob.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imgBase64 = e.target.result;
        img.value = imgBase64;
        // tempModInfo.value.preview = imgBase64;
        changdPreviewByPaste = true;
      };
      reader.readAsDataURL(blob);
    }
  }
};

// Kéo-thả ảnh vào khung bìa (Đạt dặn 22/11) — dùng chung đường dán ảnh:
// thả file ảnh thì khung hiện ảnh mới ngay, bấm Lưu mới ghi thật (cờ
// changdPreviewByPaste), bấm Hủy thì bỏ. Chỉ nhận file đúng là ảnh;
// file khác thì báo lỗi, không làm gì cả. Đếm số lần vào/ra để viền
// sáng không nhấp nháy khi rê qua ảnh con bên trong khung.
const coverDragOver = ref(false);
let coverDragDepth = 0;
const handleCoverDragEnter = (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  coverDragDepth++;
  coverDragOver.value = true;
};
const handleCoverDragLeave = () => {
  coverDragDepth = Math.max(0, coverDragDepth - 1);
  if (coverDragDepth === 0) coverDragOver.value = false;
};
const handleCoverDragOver = (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
};
const handleCoverDrop = (event) => {
  event.preventDefault();
  event.stopPropagation();
  coverDragDepth = 0;
  coverDragOver.value = false;
  const files = event.dataTransfer?.files;
  if (!files) return;
  let imageFile = null;
  for (const file of files) {
    if (file.type && file.type.startsWith('image/')) { imageFile = file; break; }
  }
  if (!imageFile) {
    snack('Invalid image file');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    img.value = e.target.result;
    changdPreviewByPaste = true;
  };
  reader.readAsDataURL(imageFile);
};

onMounted(() => {
  // Nhảy tới mod MỚI sau khi Lưu (Đạt dặn 22/11) — bộ nghe RIÊNG, không
  // sửa bộ nghe show/dismissed có sẵn để gộp sạch với tính năng
  // không-chọn-sẵn-tag (cùng dùng cờ editingNewMod).
  // Lúc mở: đọc cờ mod mới do luồng nhập đặt + quên lần Lưu trước.
  editModInfoDialog.value.$el.addEventListener('show', () => {
    jumpIsNewMod = iManager.temp.editingNewMod === true;
    savedThisSession = false;
    jumpModName = '';
    jumpCharacter = '';
  });
  // Lúc đóng hẳn: chỉ nhảy khi hộp mở cho mod MỚI + đã Lưu thành công
  // (bấm Hủy thì không nhảy). Dùng tên + nhân vật ĐÃ CHỤP LÚC LƯU —
  // không đọc props.mod ở đây (xem ghi chú ở chỗ khai báo biến).
  // Xóa cờ mod mới ở đây luôn để nhánh này đứng một mình vẫn đúng
  // (không có tính năng không-chọn-sẵn-tag thì cờ không ai xóa).
  editModInfoDialog.value.$el.addEventListener('dismissed', () => {
    if (jumpIsNewMod && savedThisSession) {
      EventSystem.trigger(EventType.jumpToMod, { modName: jumpModName, character: jumpCharacter });
    }
    if (iManager.temp.editingNewMod) iManager.temp.editingNewMod = false;
    jumpIsNewMod = false;
    savedThisSession = false;
    jumpModName = '';
    jumpCharacter = '';
  });

  // 监听 dialog 的 dismiss 事件，如果未保存则弹出保存更改的 dialog
  editModInfoDialog.value.$el.addEventListener('dismiss', (event) => {
    // TC23: chặn đóng khi đang lưu (savePending) hoặc lần lưu vừa rồi lỗi
    // (saveFailed). Nút Lưu nằm trong vùng action của Sober nên bấm là hộp
    // tự đóng — kiểm chứng bằng app thật (19/11) cho thấy sự kiện dismiss
    // tới SAU khi lưu async hoàn tất, nên cờ saveFailed mới là cờ giữ hộp
    // ở lại khi lưu lỗi; savePending chỉ phòng trường hợp lưu chậm. Chỉ
    // chặn nguồn ACTION (bấm nút trong hộp) để người dùng vẫn đóng được
    // bằng cách bấm ra ngoài vùng hộp (SCRIM).
    const source = event.detail && event.detail.source;
    if ((savePending || saveFailed) && source === 'ACTION') {
      event.preventDefault();
      return;
    }
    console.log('dismiss', 'props.mod', props.mod, 'tempModInfo', tempModInfo.value, saved);
    confirmShown = !saved && !props.mod.equals(tempModInfo.value);
    if (confirmShown) {
      iManager.showDialog('save-change-dialog');
    }
    saved = false;
  });

  // 监听 dialog 的 show 事件，再同步一次 tempModInfo
  editModInfoDialog.value.$el.addEventListener('show', async () => {
    tempModInfo.value = props.mod.copy();
    // Mod MỚI (vừa nhập vào) hay mod đã có — cờ do luồng nhập đặt.
    isNewMod = iManager.temp.editingNewMod === true;
    // Trạng thái xóa-mod-mới cho lần mở này (tên + đường dẫn chụp ở
    // watch props.mod, không chụp ở đây — xem chú thích ở đó).
    saveClicked = false;
    confirmShown = false;
    pendingDiscard = false;
    newModName = null;
    newModPath = null;
    img.value = await props.mod.getPreviewBase64(true, true);
    // TC22: mở hộp mới thì quên ảnh đã dán lần trước + bắt đầu nghe dán.
    changdPreviewByPaste = false;
    saveFailed = false;
    window.addEventListener('paste', handlePaste);
    // Mod MỚI thì chưa chọn tag nào — nút Lưu mờ cho tới khi chọn 1 tag.
    tagChosen.value = !isNewMod;
    // Đặt thanh chip tag về đúng tag của mod: lúc hộp còn ẩn, chip đo
    // được 0 nên phải đợi hộp hiện xong (2 khung hình) mới đo lại được
    // (giống bảng lọc). selectItemByName có thể phát sự kiện đổi tag
    // nếu thanh đang ở tag khác — nhưng giá trị đó trùng với tag của
    // mod (tempModInfo vừa sao từ props.mod) nên không đổi gì.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!tagBarRef.value) return;
      // Mod MỚI thì bỏ chọn hết (không chọn sẵn tag); mod đã có thì đặt
      // thanh chip về đúng tag của mod như cũ. Dữ liệu tag trong
      // tempModInfo vẫn giữ 'character' để đóng hộp không sửa gì thì
      // equals() vẫn đúng, không hiện hộp "lưu thay đổi?".
      if (isNewMod) tagBarRef.value.clearSelection();
      else tagBarRef.value.selectItemByName(tempModInfo.value.tag);
    }));
  });

  // TC22: hộp đóng hẳn thì thôi nghe dán.
  editModInfoDialog.value.$el.addEventListener('dismissed', () => {
    window.removeEventListener('paste', handlePaste);
    // Hộp đóng hẳn thì đóng showcase theo để lớp phủ không kẹt lại.
    closeShowcase();
    // Mod MỚI đóng hộp mà không lưu (Cancel / bấm ra ngoài) thì xóa mod
    // vừa nhập (Đạt báo 22/11). Nếu hộp xác nhận lưu đang hiện thì chưa
    // xóa — đợi người dùng chọn Lưu (giữ) hay Bỏ qua (xóa ở handleCancel).
    if (isNewMod && !saveClicked && newModName && newModPath) {
      if (confirmShown) {
        pendingDiscard = true;
      } else {
        iManager.discardNewMod(newModName, newModPath);
      }
    }
    // Xóa cờ mod mới để lần mở sau (sửa mod đã có) không bị nhận nhầm.
    // Chỉ ghi khi cờ đang bật — ghi false cũng châm ngòi log debug
    // 'WTF' của Proxy temp nên tránh ghi thừa.
    if (iManager.temp.editingNewMod) iManager.temp.editingNewMod = false;
    isNewMod = false;
  });
});
</script>


<style scoped>
.hotkey-container {
  overflow-y: hidden;
  overflow-x: auto;
  height: 35px;
  align-items: center;
  max-width: 450px;
  padding: 0 10px;
  border-radius: 20px;
}

/* Danh sách chọn nhân vật có sẵn trong bảng chọn: cao tối đa 300px,
   nhiều nhân vật thì lăn dọc. Hàng đang là nhân vật của mod thì vàng
   lên như chip đang chọn. Rộng 130px = một nửa 260px cũ (Đạt dặn 21/11);
   tên nhân vật dài nhất (Alexandrina, 11 chữ) vẫn vừa, tên dài hơn thì
   cắt bằng dấu ... nhờ text-overflow ở .character-picker-item. */
.character-picker-list {
  width: 130px;
  max-height: 300px;
  overflow-y: auto;
  padding: 6px;
  box-sizing: border-box;
}

.character-picker-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-picker-item:hover {
  background-color: var(--s-color-surface-container-high);
}

.character-picker-item.current {
  background-color: var(--s-color-primary);
  color: var(--s-color-on-primary);
  font-weight: 700;
}

/* Lớp phủ xem ảnh gốc (Showcase): Y HỆT khung phải (modInfo.vue) —
   giữa màn hình, bấm bất kỳ đâu để đóng. Ảnh giữ kích thước thật,
   chỉ thu lại khi vượt qua cửa sổ (không phóng to). z-index 9999 để
   nổi lên trên hộp thoại Sober (z-index 2). */
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

/* Nhãn hàng trong hộp (MOD Name, MOD Cover...) đặt thẳng 16px (bậc M):
   rule chung .OO-setting-bar h3 là 1.2em (~19.2px) + max-width 50%,
   cột trái hộp chỉ rộng 280px nên "MOD Cover" bị cắt thành "MOD Co…". */
#edit-mod-dialog .OO-setting-bar h3 {
  font-size: 16px;
}

/* Kéo ảnh tới khung bìa thì sáng viền vàng để biết chỗ thả. */
#img-container.cover-drop-hover {
  outline: 3px solid #f2d900;
  outline-offset: -3px;
}

</style>