// Trạng thái cập nhật dùng chung cho hộp thoại + trang Cài đặt.
//
// Tiến trình chính (electron/updater.js) báo sự kiện qua IPC:
// update-available / update-not-available / update-downloaded /
// update-error / download-progress. Helper này giữ trạng thái chung
// (reactive) và mở/đóng hộp thoại; trang Cài đặt chỉ đọc trạng thái để
// hiện thông báo khi người dùng bấm tay kiểm tra.
import { reactive } from 'vue';
import { DialogHelper, DialogID } from './DialogHelper';

const { ipcRenderer } = require('electron');

export type UpdateStatus =
    | 'idle'         // chưa kiểm tra
    | 'checking'     // đang kiểm tra
    | 'available'    // có bản mới (hộp đang mở)
    | 'downloading'  // đang tải
    | 'downloaded'   // đã tải xong (hộp khởi động lại đang mở)
    | 'uptodate'     // đã là bản mới nhất
    | 'error';       // lỗi (mạng hoặc không hỗ trợ)

export const updateState = reactive({
    status: 'idle' as UpdateStatus,
    // Phiên bản đang chạy (lấy qua IPC get-app-version).
    currentVersion: '',
    // Phiên bản mới nhất trên GitHub Releases (khi có).
    availableVersion: '',
    // Ghi chú phát hành của bản mới (khi có).
    releaseNotes: '',
    // Tiến độ tải 0-100.
    downloadPercent: 0,
    // Lần kiểm tra gần nhất có phải người dùng bấm tay không — chỉ lần
    // bấm tay mới hiện thông báo "đã là bản mới nhất" / "lỗi mạng".
    manualCheck: false,
    // Lỗi lần kiểm tra gần nhất: 'unsupported' (không phải bản cài đặt
    // Windows) hay 'network' (lỗi mạng). Rỗng khi không lỗi.
    checkError: '' as '' | 'unsupported' | 'network',
    // Người dùng đã bấm "Để sau" trong phiên này thì tự kiểm tra không
    // hỏi lại nữa; bấm tay kiểm tra thì vẫn hỏi lại (checkForUpdates
    // với manual=true sẽ xóa cờ này).
    dismissedThisSession: false,
});

let listenersRegistered = false;

// Đăng ký nghe sự kiện cập nhật từ tiến trình chính. Gọi 1 lần khi app
// mở (App.vue); gọi lại cũng không đăng ký trùng.
export function initUpdateListener() {
    if (listenersRegistered) {
        return;
    }
    listenersRegistered = true;

    ipcRenderer.on('update-available', (_event: any, info: any) => {
        if (updateState.dismissedThisSession && !updateState.manualCheck) {
            return;
        }
        updateState.availableVersion = (info && info.version) || '';
        updateState.releaseNotes = (info && info.releaseNotes) || '';
        updateState.downloadPercent = 0;
        updateState.status = 'available';
        DialogHelper.showDialog(DialogID.dialogUpdateAvailable);
    });

    ipcRenderer.on('update-not-available', () => {
        updateState.status = 'uptodate';
    });

    ipcRenderer.on('update-downloaded', (_event: any, info: any) => {
        if (info && info.version) {
            updateState.availableVersion = info.version;
        }
        updateState.downloadPercent = 100;
        updateState.status = 'downloaded';
        DialogHelper.dismissDialog(DialogID.dialogUpdateAvailable);
        DialogHelper.showDialog(DialogID.dialogUpdateDownloaded);
    });

    ipcRenderer.on('update-error', (_event: any, error: any) => {
        console.error('update error:', (error && error.message) || error);
        updateState.checkError = 'network';
        updateState.status = 'error';
    });

    ipcRenderer.on('download-progress', (_event: any, progress: any) => {
        updateState.downloadPercent = Math.round((progress && progress.percent) || 0);
    });
}

// Lấy version đang chạy (đọc 1 lần rồi nhớ lại).
export async function fetchAppVersion(): Promise<string> {
    if (!updateState.currentVersion) {
        updateState.currentVersion = await ipcRenderer.invoke('get-app-version');
    }
    return updateState.currentVersion;
}

// Kiểm tra bản mới. manual=true khi người dùng bấm nút trong Cài đặt:
// lúc đó xóa cờ "Để sau" để hộp hiện lại nếu vẫn còn bản mới.
export async function checkForUpdates(manual: boolean): Promise<void> {
    if (manual) {
        updateState.dismissedThisSession = false;
    }
    updateState.manualCheck = manual;
    updateState.checkError = '';
    updateState.status = 'checking';
    const result = await ipcRenderer.invoke('check-for-updates');
    if (!result || result.supported === false) {
        // Không phải bản cài đặt Windows: không kiểm tra được.
        updateState.checkError = 'unsupported';
        updateState.status = 'error';
    }
    // Còn lại chờ sự kiện update-available / update-not-available /
    // update-error từ tiến trình chính.
}

// Bắt đầu tải bản mới (sau khi người dùng bấm "Cập nhật ngay").
export async function downloadUpdate(): Promise<void> {
    updateState.downloadPercent = 0;
    updateState.status = 'downloading';
    const result = await ipcRenderer.invoke('download-update');
    if (!result || result.supported === false) {
        updateState.checkError = 'unsupported';
        updateState.status = 'error';
    }
}

// Cài bản đã tải + mở lại app.
export async function installUpdate(): Promise<void> {
    await ipcRenderer.invoke('install-update');
}

// Người dùng bấm "Để sau" ở hộp có-bản-mới: đóng hộp, không hỏi lại
// trong phiên này (trừ khi bấm tay kiểm tra lại).
export function dismissUpdateAvailable(): void {
    updateState.dismissedThisSession = true;
    updateState.status = 'idle';
    DialogHelper.dismissDialog(DialogID.dialogUpdateAvailable);
}
