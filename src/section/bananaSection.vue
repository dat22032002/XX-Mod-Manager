<template>
  <div class="banana-section">
    <!-- Thanh trên: điều hướng + tải mod + kiểm tra bản mới -->
    <div class="banana-bar OO-box">
      <div class="banana-nav">
        <s-tooltip>
          <s-icon-button slot="trigger" @click="goBack" class="OO-icon-button"
            :style="canGoBack ? '' : 'opacity: 0.35'">
            <s-icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg></s-icon>
          </s-icon-button>
          <p>{{ $t('banana.back') }}</p>
        </s-tooltip>
        <s-tooltip>
          <s-icon-button slot="trigger" @click="goHome" class="OO-icon-button">
            <s-icon type="home"></s-icon>
          </s-icon-button>
          <p>{{ $t('banana.home') }}</p>
        </s-tooltip>
        <span class="banana-url" :title="currentUrl">{{ currentUrl }}</span>
      </div>
      <div class="banana-actions">
        <s-button class="OO-button" @click="checkUpdates"
          :style="checking ? 'opacity: 0.6' : ''">
          <p>{{ checking ? $t('banana.checkingUpdates') : $t('banana.checkUpdates') }}</p>
        </s-button>
        <s-button class="OO-button OO-color-gradient" @click="downloadCurrentMod"
          :style="downloadBtnStyle">
          <p>{{ downloadLabel }}</p>
        </s-button>
      </div>
    </div>

    <!-- Mod có nhiều file thì cho chọn file nào tải (mới nhất lên đầu) -->
    <div v-if="fileChoices.length > 0" class="banana-file-list OO-box">
      <div class="banana-file-list-head">
        <span>{{ $t('banana.chooseFile') }}</span>
        <s-icon-button @click="fileChoices = []" class="OO-icon-button banana-file-close">
          <s-icon type="close"></s-icon>
        </s-icon-button>
      </div>
      <div v-for="file in fileChoices" :key="file.id" class="banana-file-item" @click="downloadFile(file)">
        <span class="banana-file-name" :title="file.name">{{ file.name }}</span>
        <span v-if="file.version" class="banana-file-version">{{ file.version }}</span>
        <span class="banana-file-size">{{ formatModSize(file.size) }}</span>
        <span class="banana-file-date">{{ formatGbDate(file.dateAdded) }}</span>
      </div>
    </div>

    <!-- Khung web Banana: chỉ gắn lần đầu mở trang này (đỡ tốn tài
         nguyên lúc mở app), gắn rồi thì giữ nguyên khi chuyển trang
         khác — đăng nhập + vị trí lăn không mất. partition riêng để
         đăng nhập Banana giữ qua các lần mở app (mod người lớn bắt
         đăng nhập xác minh tuổi mới xem được). -->
    <webview v-if="activated" ref="webviewRef" src="https://gamebanana.com/games/19567"
      partition="persist:gamebanana" allowpopups class="banana-webview"></webview>
    <div v-else class="banana-placeholder OO-box">
      <p>{{ $t('banana.loading') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import IManager from '../../electron/IManager';
import { snack } from '../../helper/SnackHelper';
import { parseGameBananaModId, normalizeGbFile, buildGameBananaModUrl, GB_ZZZ_URL } from '../../helper/GameBanana';
import { formatModSize } from '../../helper/ModSizeScanner';

const iManager = new IManager();
const { t } = useI18n();

// CSS giấu khung quảng cáo còn sót lại trên trang Banana (1.5.25):
// yêu cầu quảng cáo đã bị chặn ở main.js nên khung chỉ còn trống —
// giấu hẳn cho trang sạch. .AdTagModule là khung quảng cáo riêng của
// Banana (thấy trong HTML trang thật), còn lại là mẫu chung (khung
// GPT, iframe quảng cáo/theo dõi).
const GB_AD_HIDE_CSS = `
.AdTagModule,
[id^="div-gpt-ad"],
[id*="google_ads_iframe"],
iframe[src*="googletagmanager"],
iframe[src*="doubleclick"],
iframe[src*="googlesyndication"],
.adsbygoogle,
[class*="advertisement"],
.pw-tag,
[id^="pw-oop-"],
#pwAdContainer,
#pwAdPlaceholder,
#AdBlockAppealModule { display: none !important; }
`;

const props = defineProps({
  // Trang này đang hiện hay không (App.vue truyền theo mục đang chọn).
  active: {
    type: Boolean,
    default: false
  }
});

// Khung web chỉ gắn khi mở trang lần đầu — xem chú thích ở template.
const activated = ref(false);
const webviewRef = ref(null);
const currentUrl = ref(GB_ZZZ_URL);
const canGoBack = ref(false);
const checking = ref(false);
const downloading = ref(false);
// Tiến độ tải (0–100); -1 = máy chủ không báo tổng dung lượng.
const downloadProgress = ref(-1);
// Danh sách file để chọn khi mod có nhiều file; rỗng = không hiện bảng.
const fileChoices = ref([]);
// Mã mod của bảng chọn file đang hiện (để nhập đúng mod sau khi chọn).
let pendingModId = 0;

const canDownload = computed(() => parseGameBananaModId(currentUrl.value) !== null);

const downloadLabel = computed(() => {
  if (!downloading.value) return t('banana.downloadMod');
  if (downloadProgress.value < 0) return t('banana.downloading');
  return t('banana.downloadingPercent', { percent: downloadProgress.value });
});

// Nút tải mờ đi khi không ở trang mod / đang tải (không dùng disabled:
// nút Sober bị disabled thì biến mất hẳn, nhìn như thiếu nút).
const downloadBtnStyle = computed(() => {
  if (downloading.value) return 'opacity: 0.6';
  if (!canDownload.value) return 'opacity: 0.35';
  return '';
});

const formatGbDate = (ts) => {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString();
};

const updateNavState = () => {
  const wv = webviewRef.value;
  if (!wv) return;
  try {
    currentUrl.value = wv.getURL() || GB_ZZZ_URL;
    canGoBack.value = wv.canGoBack();
  } catch (_e) {
    // Khung web chưa sẵn sàng: giữ nguyên trạng thái cũ.
  }
};

// Gắn bộ nghe cho khung web sau khi nó được tạo (xem watch activated).
const attachWebviewListeners = () => {
  const wv = webviewRef.value;
  if (!wv || wv.__gbListenersAttached) return;
  wv.__gbListenersAttached = true;
  // Đổi trang trong khung thì cập nhật địa chỉ + nút tải/quay lại.
  wv.addEventListener('did-navigate', updateNavState);
  wv.addEventListener('did-navigate-in-page', updateNavState);
  wv.addEventListener('did-finish-load', updateNavState);
  // Mỗi lần tải xong DOM thì chèn CSS giấu khung quảng cáo (chèn lại
  // mỗi lần sang trang vì CSS chèn mất khi điều hướng).
  wv.addEventListener('dom-ready', () => {
    wv.insertCSS(GB_AD_HIDE_CSS).catch(() => {
      // Khung đóng trước khi kịp chèn: thôi, lần sang trang sau chèn lại.
    });
  });
  // Link mở cửa sổ mới (target=_blank) thì mở bằng trình duyệt ngoài,
  // không mở cửa sổ mới trong app.
  wv.addEventListener('new-window', (e) => {
    e.preventDefault();
    if (e.url) iManager.openUrl(e.url);
  });
  // Chỉ lướt trong gamebanana.com: link ra ngoài thì mở bằng trình
  // duyệt ngoài thay vì lướt trong khung.
  wv.addEventListener('will-navigate', (e) => {
    try {
      const host = new URL(e.url).hostname;
      if (!host.endsWith('gamebanana.com')) {
        e.preventDefault();
        iManager.openUrl(e.url);
      }
    } catch (_e) {
      // Link lỗi: để khung web tự xử lý.
    }
  });
};

watch(() => props.active, async (isActive) => {
  if (!isActive || activated.value) return;
  activated.value = true;
  await nextTick();
  attachWebviewListeners();
}, { immediate: true });

const goBack = () => {
  const wv = webviewRef.value;
  if (!wv || !wv.canGoBack()) return;
  wv.goBack();
};

const goHome = () => {
  const wv = webviewRef.value;
  if (!wv) return;
  wv.loadURL(GB_ZZZ_URL);
};

const checkUpdates = async () => {
  if (checking.value) return;
  checking.value = true;
  try {
    await iManager.checkGameBananaUpdates(true);
  } finally {
    checking.value = false;
  }
};

// Tải file đã chọn về rồi nhập bằng đúng đường nhập mod có sẵn
// (handleArchiveDrop: giải nén, đoán nhân vật, mở hộp sửa) + ghi link
// Banana vào mod để lần sau kiểm tra bản mới được.
const downloadFile = async (file) => {
  const modId = pendingModId || parseGameBananaModId(currentUrl.value);
  if (!modId || downloading.value) return;
  downloading.value = true;
  downloadProgress.value = -1;
  fileChoices.value = [];
  try {
    const dlFile = await iManager.gbDownloadFile(
      file.downloadUrl,
      file.name || `gb-${file.id}.zip`,
      (received, total) => {
        downloadProgress.value = total > 0 ? Math.floor((received / total) * 100) : -1;
      }
    );
    await iManager.handleArchiveDrop(dlFile, {
      url: buildGameBananaModUrl(modId),
      fileId: file.id,
      fileDate: file.dateAdded,
    });
  } catch (e) {
    console.error('bananaSection download failed', e);
    snack(t('banana.downloadFailed'), 'error');
  } finally {
    downloading.value = false;
    downloadProgress.value = -1;
    pendingModId = 0;
  }
};

// Bấm "Tải mod này": hỏi Banana lấy danh sách file của mod đang mở —
// 1 file thì tải luôn, nhiều file thì hiện bảng cho chọn.
const downloadCurrentMod = async () => {
  const modId = parseGameBananaModId(currentUrl.value);
  if (!modId || downloading.value) return;
  downloading.value = true;
  downloadProgress.value = -1;
  try {
    const files = await iManager.gbFetchModFiles(modId);
    if (files === null) {
      // Hỏi Banana lỗi (mạng chập chờn...): báo tải thất bại, không báo
      // "không có file" gây hiểu lầm là mod không có file tải được.
      snack(t('banana.downloadFailed'), 'error');
      return;
    }
    const list = files
      .map(normalizeGbFile)
      .filter(Boolean)
      .sort((a, b) => b.dateAdded - a.dateAdded);
    if (list.length === 0) {
      snack(t('banana.noFiles'), 'error');
      return;
    }
    if (list.length === 1) {
      pendingModId = modId;
      // downloadFile tự quản lý cờ đang tải (chặn bấm 2 lần) nên
      // thả cờ hỏi danh sách file ra trước khi gọi nó.
      downloading.value = false;
      await downloadFile(list[0]);
    } else {
      pendingModId = modId;
      fileChoices.value = list;
    }
  } finally {
    // Hiện bảng chọn file thì thôi trạng thái đang tải (chưa tải gì cả).
    downloading.value = false;
    downloadProgress.value = -1;
  }
};
</script>

<style scoped>
.banana-section {
  display: flex;
  flex-direction: column;
  height: calc(100% - 60px);
  width: 100%;
  gap: 10px;
}

.banana-bar {
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  min-height: 50px;
}

.banana-nav {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.banana-nav .OO-icon-button {
  margin: 0;
  transform: scale(1);
}

.banana-url {
  flex: 1;
  min-width: 0;
  margin-left: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: var(--s-color-on-surface-variant);
}

.banana-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.banana-actions .OO-button {
  height: 40px;
}

.banana-file-list {
  flex-shrink: 0;
  max-height: 220px;
  overflow-y: auto;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.banana-file-list-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  font-size: 14px;
  padding: 2px 4px 6px;
}

.banana-file-close {
  margin: 0;
  transform: scale(1);
}

.banana-file-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
  background-color: var(--s-color-surface-container-low);
}

.banana-file-item:hover {
  background-color: var(--s-color-surface-container-highest);
}

.banana-file-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banana-file-version,
.banana-file-size,
.banana-file-date {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--s-color-on-surface-variant);
  white-space: nowrap;
}

.banana-webview {
  flex: 1;
  min-height: 0;
  width: 100%;
  border-radius: 12px;
  background-color: #ffffff;
}

.banana-placeholder {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--s-color-on-surface-variant);
}
</style>
