// Dùng chung cho cả 3 cửa sổ của app (chính / cài đặt lần đầu / đổi cấu
// hình): khởi tạo i18n, hàm hiện thông báo snack + lắng nghe kênh IPC
// 'snack', và khối DOMContentLoaded dò phiên bản Node. Trước đây mỗi entry
// giữ một bản giống hệt nhau (BT14). Khác biệt duy nhất: snack info ở cửa
// sổ chính hiện 2000ms thay vì mặc định — giữ lại qua tham số infoDuration.
import { createI18n } from 'vue-i18n';
import { Snackbar } from 'sober';

import en from '../src/locales/en.json';
import vi from '../src/locales/vi.json';

// Tạo bản i18n dùng chung: tiếng Anh mặc định, tiếng Việt là lựa chọn thứ hai.
export function createAppI18n() {
    return createI18n({
        locale: 'en', // 设置默认语言
        fallbackLocale: 'en', // 设置回退语言
        legacy: false,
        messages: {
            en,
            vi,
        },
    });
}

// Hiện một thông báo snack (giống hệt bản cũ ở 3 entry; chỉ cửa sổ chính
// truyền thêm infoDuration = 2000 cho snack loại info).
export function snack(message, type = 'info', infoDuration) {
    console.log(`snack:${message} type:${type}`);
    switch (type) {
        case 'info': {
            const options = {
                text: message,
                align: 'top',
            };
            if (infoDuration) {
                options.duration = infoDuration;
            }
            Snackbar.show(options);
            break;
        }
        case 'error':
            Snackbar.show({
                text: message,
                align: 'top',
                type: 'error'
            });
            break;
        default:
            Snackbar.show({
                text: message,
                align: 'top'
            });
            break;
    }
}

// Nghe kênh IPC 'snack' từ tiến trình chính rồi hiện bằng snack() ở trên.
export function registerSnackListener(ipcRenderer, infoDuration) {
    ipcRenderer.on('snack', (event, message, type = 'info') => {
        snack(message, type, infoDuration);
    });
}

// Khối DOMContentLoaded cũ ở 3 entry: chỉ đọc phiên bản Node rồi không dùng
// tới — giữ nguyên hành vi (không làm gì) để 3 entry vẫn giống nhau.
export function registerDomReadyProbe() {
    document.addEventListener('DOMContentLoaded', () => {
        // 开启 了 nodeIntegration: true, contextIsolation: false
        // 所以可以直接使用 node.js 的模块

        // 获取 process 对象
        const process = window.process;

        // 获取 node.js 的版本信息
        const nodeVersion = process.versions.node;

        // console.log('DOMContentLoaded' + nodeVersion);
    });
}
