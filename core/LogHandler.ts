const fs = require('fs');
const path = require('path');

class LogHandler {
    private static originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
        debug: console.debug,
    };

    // 可选项
    public static ifGetCaller = false;

    private static logBuffer: string[] = [];
    private static flushInterval: NodeJS.Timeout;
    // TC34: init() giờ chạy mặc định lúc tải module (xem cuối file) nên
    // phải chặn gọi 2 lần — plugin test vẫn gọi init() bằng tay.
    private static initialized: boolean = false;

    constructor() {
        console.error('LogHandler cannot be instantiated');
        throw new Error('LogHandler cannot be instantiated');
    }

    // Thư mục ghi log: thư mục dữ liệu của app (userData) thay vì thư mục
    // 'Logs' tương đối như trước — thư mục làm việc hiện tại của app đóng
    // gói không đoán trước được. Không lấy được userData (vd chạy ngoài
    // Electron) thì giữ thư mục 'Logs' tương đối như cũ.
    private static resolveLogDir(): string {
        try {
            const { ipcRenderer } = require('electron');
            const userData = ipcRenderer.sendSync('get-user-data-path-sync');
            if (typeof userData === 'string' && userData) {
                return path.join(userData, 'Logs');
            }
        } catch (e) {
            // Bỏ qua, dùng thư mục tương đối bên dưới.
        }
        return 'Logs';
    }

    static init() {
        if (LogHandler.initialized) {
            return;
        }
        LogHandler.initialized = true;
        console.log('LogHandler init');

        // Tên file gồm cả giây để 2 cửa sổ mở cùng 1 phút (cửa sổ chính +
        // trang đổi cấu hình) không ghi đè log của nhau.
        const logDir = LogHandler.resolveLogDir();
        LogHandler.logFile = path.join(logDir, `XXMMLog${new Date().toISOString().replace(/:/g, '-').slice(0, 19)}.log`);

        // If the log file already exists, delete it
        try {
            if (fs.existsSync(LogHandler.logFile)) {
                fs.unlinkSync(LogHandler.logFile);
            }
        } catch (e) {
            console.warn('LogHandler: cannot remove existing log file', e);
        }

        // If the number of files in the log directory exceeds 10, delete the oldest files
        try {
            if (fs.existsSync(logDir)) {
                while (fs.readdirSync(logDir).map(file => path.join(logDir, file)).length > 10) {
                    const logFiles = fs.readdirSync(logDir).map(file => path.join(logDir, file));
                    logFiles.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
                    fs.unlinkSync(logFiles[0]);
                }
            }
        } catch (e) {
            console.warn('LogHandler: cannot prune old log files', e);
        }

        console.log = LogHandler.log;
        console.error = LogHandler.error;
        console.warn = LogHandler.warn;
        console.info = LogHandler.info;
        console.debug = LogHandler.debug;

        // Start periodic flushing
        LogHandler.flushInterval = setInterval(() => {
            LogHandler.flushBuffer();
        }, 10000);

        // Flush logs on exit
        process.on('exit', () => LogHandler.flushBuffer());
        process.on('SIGINT', () => {
            LogHandler.flushBuffer();
            process.exit();
        });
    }

    static log(...args) {
        LogHandler.writeToBuffer('LOG', ...args);
        if (LogHandler.ifGetCaller) {
            const stackInfo = new Error().stack?.split('\n')[2]?.trim() || '';
            const caller = stackInfo.replace(/^at\s*/, '');
            LogHandler.originalConsole.log(...args, `[${caller}]`);
        }
        else {
            LogHandler.originalConsole.log(...args);
        }
    }

    static error(...args) {
        LogHandler.writeToBuffer('ERROR', ...args);
        LogHandler.originalConsole.error(...args);
    }

    static warn(...args) {
        LogHandler.writeToBuffer('WARN', ...args);
        LogHandler.originalConsole.warn(...args);
    }

    static info(...args) {
        LogHandler.writeToBuffer('INFO', ...args);
        LogHandler.originalConsole.info(...args);
    }

    static debug(...args) {
        LogHandler.writeToBuffer('DEBUG', ...args);
        LogHandler.originalConsole.debug(...args);
    }

    static writeToBuffer(level: string, ...args: any[]) {
        const timestamp = new Date().toISOString();
        const message = `[${level}][${timestamp}]: ${args.join(' ')}\n`;
        LogHandler.logBuffer.push(message);
    }

    static flushBuffer() {
        if (LogHandler.logBuffer.length === 0) return;

        const logDir = path.dirname(LogHandler.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const logData = LogHandler.logBuffer.join('');
        fs.appendFileSync(LogHandler.logFile, logData, 'utf8');
        LogHandler.logBuffer = [];
    }

    static instance: LogHandler;
    static logFile: string;
}

// TC34: bật ghi nhật ký mặc định — trước đây init() bị comment nên chỉ bật
// được qua plugin test, app chạy bình thường thì không có file ghi chép để
// xem khi gặp lỗi. Log ghi ra <userData>/Logs (xem resolveLogDir).
// Lỗi khởi tạo log không được làm hỏng app nên bọc try/catch.
try {
    LogHandler.init();
} catch (e) {
    console.error('LogHandler: failed to start file logging', e);
}


export default LogHandler;
