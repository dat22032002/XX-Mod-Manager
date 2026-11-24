// Tự tìm game ZZZ + XXMI Launcher + thư mục Mods cho trình setup mới
// (1.5.30, Đạt duyệt hướng A 24/11).
//
// Bố cục đã kiểm chứng (24/11, nhiều nguồn độc lập):
// - XXMI Launcher (MSI) cài mặc định vào %AppData%\XXMI Launcher;
//   file chạy ở Resources\Bin\XXMI Launcher.exe; file cấu hình
//   "XXMI Launcher Config.json" ở gốc thư mục launcher, trong đó
//   Importers.ZZMI.Importer có importer_folder + game_folder.
// - ZZMI nằm ở <launcher>\ZZMI\ (d3d11.dll, d3dx.ini, Core\, Mods\);
//   thư mục mod là <launcher>\ZZMI\Mods.
// - Game ZZZ: file ZenlessZoneZero.exe trong thư mục game
//   ("ZenlessZoneZero Game" với HoYoPlay).
//
// Hàm nhận danh sách thư mục gốc để quét — trên Windows thật thì dùng
// WINDOWS_GAME_ROOTS / WINDOWS_LAUNCHER_ROOTS; probe trên máy ảo truyền
// thư mục giả trong /tmp nên không cần máy Windows để kiểm tra logic.

const fs = require('fs');
const path = require('path');
const os = require('os');

const GAME_EXE = 'ZenlessZoneZero.exe';
const LAUNCHER_CONFIG = 'XXMI Launcher Config.json';
const LAUNCHER_EXE_REL = path.join('Resources', 'Bin', 'XXMI Launcher.exe');

// Thư mục hay gặp trên Windows — quét hết, thấy cái nào dùng cái nấy,
// không thấy thì để người dùng chọn tay (không bao giờ đoán mò).
function windowsGameRoots() {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const roots = [];
    for (const base of [pf, pf86]) {
        roots.push(path.join(base, 'HoYoPlay', 'games', 'ZenlessZoneZero Game'));
        roots.push(path.join(base, 'Steam', 'steamapps', 'common', 'ZenlessZoneZero'));
        roots.push(path.join(base, 'Epic Games', 'ZenlessZoneZero'));
    }
    for (const drive of ['C:', 'D:', 'E:', 'F:']) {
        roots.push(path.join(drive, 'Games', 'ZenlessZoneZero Game'));
        roots.push(path.join(drive, 'HoYoPlay', 'games', 'ZenlessZoneZero Game'));
        roots.push(path.join(drive, 'SteamLibrary', 'steamapps', 'common', 'ZenlessZoneZero'));
    }
    return roots;
}

function windowsLauncherRoots() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const roots = [path.join(appData, 'XXMI Launcher')];
    for (const drive of ['C:', 'D:', 'E:', 'F:']) {
        roots.push(path.join(drive, 'Games', 'XXMI Launcher'));
        roots.push(path.join(drive, 'XXMI Launcher'));
    }
    return roots;
}

function isFile(p) {
    try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}

function isDir(p) {
    try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
}

// Tìm file game trong các thư mục gốc — trả đường dẫn đầy đủ tới file
// .exe, không thấy thì null.
function findGameExe(gameRoots) {
    for (const root of gameRoots || []) {
        const exe = path.join(root, GAME_EXE);
        if (isFile(exe)) return exe;
    }
    return null;
}

// Một thư mục có phải thư mục launcher không: có file cấu hình của
// launcher HOẶC có file chạy ở Resources\Bin\.
function isLauncherDir(dir) {
    if (!isDir(dir)) return false;
    return isFile(path.join(dir, LAUNCHER_CONFIG)) || isFile(path.join(dir, LAUNCHER_EXE_REL));
}

function findLauncherDir(launcherRoots) {
    for (const root of launcherRoots || []) {
        if (isLauncherDir(root)) return root;
    }
    return null;
}

// Đường dẫn file chạy của launcher (Resources\Bin\XXMI Launcher.exe) —
// không có thì null.
function findLauncherExe(launcherDir) {
    if (!launcherDir) return null;
    const exe = path.join(launcherDir, LAUNCHER_EXE_REL);
    return isFile(exe) ? exe : null;
}

// Đọc file cấu hình launcher — trả { importerFolder, gameFolder } của
// ZZMI, lỗi/ thiếu thì null từng mục (không văng lỗi ra ngoài).
function readLauncherConfig(launcherDir) {
    const out = { importerFolder: null, gameFolder: null };
    if (!launcherDir) return out;
    try {
        const raw = fs.readFileSync(path.join(launcherDir, LAUNCHER_CONFIG), 'utf8');
        const cfg = JSON.parse(raw);
        const imp = cfg && cfg.Importers && (cfg.Importers.ZZMI || cfg.Importers.Zzmi);
        const inner = imp && (imp.Importer || imp);
        if (inner && typeof inner.importer_folder === 'string' && inner.importer_folder) {
            out.importerFolder = inner.importer_folder;
        }
        if (inner && typeof inner.game_folder === 'string' && inner.game_folder) {
            out.gameFolder = inner.game_folder;
        }
    } catch (_e) { /* file hỏng/thiếu: để null, đường dự phòng sẽ lo */ }
    return out;
}

// Tìm thư mục Mods của ZZMI dưới 1 thư mục launcher. Thứ tự:
// 1. đường dẫn trong file cấu hình launcher (tin cậy nhất),
// 2. <launcher>\ZZMI\Mods (bố cục chuẩn đã kiểm chứng),
// 3. quét thư mục con trực tiếp: thư mục nào có cả d3dx.ini + Mods\
// Trả { modsDir, importerDir, via } hoặc null.
function findZzmiMods(launcherDir) {
    if (!launcherDir || !isDir(launcherDir)) return null;
    const cfg = readLauncherConfig(launcherDir);
    if (cfg.importerFolder) {
        const mods = path.join(cfg.importerFolder, 'Mods');
        if (isDir(mods)) return { modsDir: mods, importerDir: cfg.importerFolder, via: 'config' };
    }
    const stdImporter = path.join(launcherDir, 'ZZMI');
    const stdMods = path.join(stdImporter, 'Mods');
    if (isDir(stdMods) && isFile(path.join(stdImporter, 'd3dx.ini'))) {
        return { modsDir: stdMods, importerDir: stdImporter, via: 'standard' };
    }
    let children = [];
    try { children = fs.readdirSync(launcherDir); } catch (_e) { return null; }
    for (const name of children) {
        const sub = path.join(launcherDir, name);
        if (!isDir(sub)) continue;
        const mods = path.join(sub, 'Mods');
        if (isDir(mods) && isFile(path.join(sub, 'd3dx.ini'))) {
            return { modsDir: mods, importerDir: sub, via: 'scan' };
        }
    }
    return null;
}

// Đếm thư mục con trực tiếp (mỗi mod là 1 thư mục) — dùng cho câu hỏi
// "có X mod đang nằm trong thư mục Mods, chuyển vào kho không?".
function countModFolders(dir) {
    if (!isDir(dir)) return 0;
    try {
        return fs.readdirSync(dir).filter((n) => isDir(path.join(dir, n))).length;
    } catch (_e) { return 0; }
}

// Thư mục này có giống kho mod không: có ít nhất 1 thư mục con chứa
// mod.json hoặc file .ini (mod của XXMM luôn có 1 trong 2).
function looksLikeModLibrary(dir) {
    if (!isDir(dir)) return false;
    let children = [];
    try { children = fs.readdirSync(dir); } catch (_e) { return false; }
    for (const name of children) {
        const sub = path.join(dir, name);
        if (!isDir(sub)) continue;
        if (isFile(path.join(sub, 'mod.json'))) return true;
        try {
            const files = fs.readdirSync(sub);
            if (files.some((f) => f.toLowerCase().endsWith('.ini'))) return true;
        } catch (_e) { /* kệ thư mục này */ }
    }
    return false;
}

// Tạo thư mục (kể cả thư mục cha chưa có) — trả true nếu xong/thư mục
// đã có sẵn, false nếu lỗi.
function ensureDir(dir) {
    try { fs.mkdirSync(dir, { recursive: true }); return isDir(dir); } catch (_e) { return false; }
}

// Chuyển từng thư mục mod con từ thư mục nguồn sang thư mục đích.
// KHÁC moveAllFiles của IManager (chỉ chép được file, gặp thư mục thì
// văng lỗi): hàm này chuyển được cả thư mục con (mod là thư mục).
// Tên đã có sẵn ở đích thì BỎ QUA (không ghi đè, không xóa bản gốc).
// Trả { moved: [tên], skipped: [tên], failed: [tên] }.
function moveModFolders(srcDir, destDir) {
    const out = { moved: [], skipped: [], failed: [] };
    if (!isDir(srcDir) || !ensureDir(destDir)) return out;
    let children = [];
    try { children = fs.readdirSync(srcDir); } catch (_e) { return out; }
    for (const name of children) {
        const src = path.join(srcDir, name);
        const dest = path.join(destDir, name);
        if (!isDir(src)) continue;
        if (fs.existsSync(dest)) { out.skipped.push(name); continue; }
        try {
            fs.cpSync(src, dest, { recursive: true });
            fs.rmSync(src, { recursive: true, force: true });
            out.moved.push(name);
        } catch (_e) {
            out.failed.push(name);
            try { fs.rmSync(dest, { recursive: true, force: true }); } catch (_e2) { /* kệ */ }
        }
    }
    return out;
}

// --- Tải XXMI Launcher (MSI) ---
// Bản mới nhất đã kiểm chứng 24/11: v2.5.0, file MSI tải trực tiếp
// (không bọc trong zip), ~99MB.
const XXMI_API_LATEST = 'https://api.github.com/repos/SpectrumQT/XXMI-Launcher/releases/latest';
const XXMI_MSI_PATTERN = /^XXMI-Launcher-Installer-Online-.*\.msi$/i;

// Chuẩn hóa kết quả GitHub API (kiểu normalizeFixerRelease trong
// ModFixer.ts) — trả { tag, asset: { name, size, downloadUrl } | null }.
function normalizeXxmiRelease(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const tag = typeof raw.tag_name === 'string' ? raw.tag_name : '';
    if (!tag) return null;
    let asset = null;
    const assets = Array.isArray(raw.assets) ? raw.assets : [];
    for (const a of assets) {
        if (a && typeof a.name === 'string' && XXMI_MSI_PATTERN.test(a.name)) {
            asset = {
                name: a.name,
                size: typeof a.size === 'number' ? a.size : 0,
                downloadUrl: typeof a.browser_download_url === 'string' ? a.browser_download_url : '',
            };
            break;
        }
    }
    return { tag, asset };
}

// Thư mục mặc định khi người dùng chưa có kho mod / preset: đặt trong
// Documents cho dễ tìm (không đặt trong thư mục game — tránh rắc rối
// với chống gian lận của game; không đặt trong %AppData% — chỗ đó khuất).
function defaultLibraryDir() {
    return path.join(os.homedir(), 'Documents', 'XXMM Mods');
}

function defaultPresetDir() {
    return path.join(os.homedir(), 'Documents', 'XXMM Presets');
}

export {
    GAME_EXE,
    LAUNCHER_CONFIG,
    XXMI_API_LATEST,
    windowsGameRoots,
    windowsLauncherRoots,
    findGameExe,
    isLauncherDir,
    findLauncherDir,
    findLauncherExe,
    readLauncherConfig,
    findZzmiMods,
    countModFolders,
    looksLikeModLibrary,
    ensureDir,
    moveModFolders,
    normalizeXxmiRelease,
    defaultLibraryDir,
    defaultPresetDir,
};
