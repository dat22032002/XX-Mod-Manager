// updater.js — kiểm tra + cài bản cập nhật từ GitHub Releases.
//
// Luồng: app mở lên (bản cài đặt Windows) thì sau 3 giây tự kiểm tra bản
// mới; có bản mới thì báo cho renderer mở hộp hỏi, CHỈ tải khi người dùng
// bấm đồng ý (autoDownload = false). Tải xong thì báo tiếp để hỏi khởi
// động lại. Ngoài ra renderer có thể bấm tay "Kiểm tra cập nhật" trong
// Cài đặt — cùng một đường kiểm tra.
//
// Chỉ chạy khi app đã đóng gói trên Windows (app.isPackaged && win32):
// bản dev không có file app-update.yml nên kiểm tra sẽ lỗi; bản zip giải
// nén chạy luôn cũng không tự thay thế chính nó được. Ngoài 2 điều kiện
// đó, module này chỉ đăng ký IPC trả về { supported: false } và không làm
// gì thêm — không báo lỗi, không hiện thông báo.
const { app, ipcMain } = require('electron');
const path = require('node:path');

const AUTO_CHECK_DELAY_MS = 3000;

let autoUpdater = null;
let mainWindowRef = null;
let updateSupported = false;
let autoChecked = false;

// Chỉ bản cài đặt Windows mới cập nhật được.
function isUpdateSupported() {
    return app.isPackaged && process.platform === 'win32';
}

function sendToRenderer(channel, payload) {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send(channel, payload);
    }
}

// Ghi chú phát hành của electron-updater có thể là chuỗi, mảng chuỗi,
// hoặc mảng object { note } — chuẩn hóa hết về một chuỗi.
function normalizeReleaseNotes(releaseNotes) {
    if (!releaseNotes) {
        return '';
    }
    if (typeof releaseNotes === 'string') {
        return releaseNotes;
    }
    if (Array.isArray(releaseNotes)) {
        return releaseNotes
            .map((n) => (typeof n === 'string' ? n : (n && n.note) || ''))
            .filter(Boolean)
            .join('\n\n');
    }
    return '';
}

function registerUnsupportedHandlers() {
    // App chưa đóng gói / không phải Windows: mọi lệnh cập nhật đều trả
    // về "không hỗ trợ" để renderer hiện đúng thông báo, thay vì lỗi.
    ipcMain.handle('check-for-updates', async () => ({ supported: false }));
    ipcMain.handle('download-update', async () => ({ supported: false }));
    ipcMain.handle('install-update', async () => ({ supported: false }));
}

function initUpdater(mainWindow) {
    mainWindowRef = mainWindow;
    updateSupported = isUpdateSupported();

    // Lấy version hiện tại thì lúc nào cũng có (dev cũng đọc package.json).
    // Đọc thẳng từ package.json của app: app.getVersion() trả về version
    // của Electron (33.2.0) khi app chạy bằng file script thay vì thư mục.
    ipcMain.handle('get-app-version', () => {
        try {
            const pkg = require(path.join(app.getAppPath(), 'package.json'));
            if (pkg && pkg.version) {
                return pkg.version;
            }
        } catch (e) {
            console.error('get-app-version: cannot read package.json:', e);
        }
        return app.getVersion();
    });

    if (!updateSupported) {
        console.log('auto-update disabled: only packaged Windows builds can update');
        registerUnsupportedHandlers();
        return;
    }

    try {
        ({ autoUpdater } = require('electron-updater'));
    } catch (e) {
        // electron-updater thiếu khỏi bản đóng gói thì tắt tính năng thay
        // vì làm sập cả tiến trình chính.
        console.error('electron-updater not available, auto-update disabled:', e);
        updateSupported = false;
        registerUnsupportedHandlers();
        return;
    }

    // Không tự tải: chỉ tải khi người dùng bấm "Cập nhật ngay".
    autoUpdater.autoDownload = false;
    // Đã tải xong mà người dùng bấm "Để sau" thì cài vào lần tắt app sau.
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = console;

    autoUpdater.on('update-available', (info) => {
        console.log('update available:', info.version);
        sendToRenderer('update-available', {
            version: info.version,
            releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        });
    });
    autoUpdater.on('update-not-available', () => {
        console.log('no update available');
        sendToRenderer('update-not-available', {});
    });
    autoUpdater.on('update-downloaded', (info) => {
        console.log('update downloaded:', info.version);
        sendToRenderer('update-downloaded', { version: info.version });
    });
    autoUpdater.on('error', (err) => {
        console.error('auto-updater error:', err);
        sendToRenderer('update-error', {
            message: err ? String(err.message || err) : 'unknown error',
            // Mã lỗi để renderer phân biệt "chưa có bản chính thức"
            // (ERR_UPDATER_LATEST_VERSION_NOT_FOUND /
            // ERR_UPDATER_NO_PUBLISHED_VERSIONS) với lỗi mạng.
            code: err && err.code ? String(err.code) : '',
        });
    });
    autoUpdater.on('download-progress', (progress) => {
        sendToRenderer('download-progress', { percent: progress.percent });
    });

    // Renderer gọi: bấm tay "Kiểm tra cập nhật". Kết quả trả về qua sự
    // kiện update-available / update-not-available / update-error.
    ipcMain.handle('check-for-updates', async () => {
        try {
            await autoUpdater.checkForUpdates();
            return { supported: true };
        } catch (e) {
            // Lỗi lúc kiểm tra: báo cho renderer để hiện snack.
            // (Mạng lỗi hay GitHub chưa có bản chính thức đều đi qua đây;
            // renderer phân biệt bằng mã lỗi kèm theo.)
            console.error('check-for-updates failed:', e);
            sendToRenderer('update-error', {
                message: e ? String(e.message || e) : 'unknown error',
                code: e && e.code ? String(e.code) : '',
            });
            return { supported: true, error: true };
        }
    });

    ipcMain.handle('download-update', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { supported: true };
        } catch (e) {
            console.error('download-update failed:', e);
            sendToRenderer('update-error', {
                message: e ? String(e.message || e) : 'unknown error',
                code: e && e.code ? String(e.code) : '',
            });
            return { supported: true, error: true };
        }
    });

    ipcMain.handle('install-update', async () => {
        // Cài bản đã tải rồi mở lại app.
        autoUpdater.quitAndInstall();
        return { supported: true };
    });

    // Tự kiểm tra 1 lần mỗi phiên, 3 giây sau khi cửa sổ chính load xong
    // (đợi app mở nhanh xong đã, không chặn lúc mở app). Chỉ kiểm tra khi
    // trang đang mở là trang chính — trang cài đặt lần đầu / đổi cấu hình
    // cũng dùng chung cửa sổ này nhưng không phải trang chính.
    mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
            if (autoChecked) {
                return;
            }
            autoChecked = true;
            try {
                const url = mainWindow.webContents.getURL();
                if (!url.endsWith('/dist/index.html')) {
                    console.log('auto-update: not on the main page, skip auto check:', url);
                    return;
                }
            } catch (e) {
                console.error('auto-update: cannot read window URL:', e);
                return;
            }
            autoUpdater.checkForUpdates().catch((e) => {
                // Lỗi mạng lúc tự kiểm tra: im lặng, chỉ ghi log.
                console.error('auto check-for-updates failed:', e);
            });
        }, AUTO_CHECK_DELAY_MS);
    });
}

module.exports = {
    initUpdater,
    isUpdateSupported,
};
