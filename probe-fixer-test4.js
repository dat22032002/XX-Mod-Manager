// Probe Mod Fixer (1.5.25-test4, nhánh A/gamebanana) — chạy với Fixer GIẢ
// đã cài sẵn (seed trước khi mở app: stub script làm file .exe +
// fixerVersion/fixerFileName trong config), vì Electron trong máy ảo này
// không ra được mạng tới GitHub (Node 20 của Electron 33 không đọc proxy
// của máy ảo -> lỗi TLS EPROTO; máy thật của Đạt không có proxy).
// 1. Tab Mod Fixer trong Settings hiện đúng (bản đã cài, nút, đường dẫn Mods).
// 2. Kiểm tra bản mới báo lỗi đúng cách khi không có mạng (không văng).
// 3. Quét mod nghi hỏng: chỉ 3 mod có mã cũ thật được liệt kê (Anby Bikini,
//    Ellen Charm, Grace Misc); Billy (mã mới), Corin (chỉ chú thích),
//    Alexandrina (không .ini) không bị liệt kê.
// 4. Checkbox chọn mod + chọn hết/bỏ hết.
// 5. Luồng sửa với Fixer GIẢ: Anby -> fixed, Ellen -> unchanged,
//    Grace -> failed (xóa bản gốc giữa chừng). Kiểm tra: bản gốc Anby đã
//    sửa, bản dự phòng tồn tại, thư mục tạm đã dọn, lưới tải lại (5 thẻ).
// 6. Hồi quy nhẹ Banana: trang Banana vẫn mở được, webview tải trang.
// Phần tải Fixer thật từ GitHub KHÔNG test được trong máy ảo — chỉ Đạt
// test được trên máy thật (xem báo cáo). Hàm thuần (đọc release, tách bảng
// mã) đã kiểm chứng riêng bằng Node với dữ liệu thật từ GitHub.
// Fixture: /tmp/xxmm-shot-tags6 (build-fixture-tags6.py + vá .ini + seed).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-fixer-test4.js
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MODS = '/tmp/xxmm-shot-tags6/mods';
const USERDATA = '/tmp/xxmm-shot-tags6/userdata';
const TOOLS = path.join(USERDATA, 'tools', 'ZZZ-Mod-Fixer');
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 900000; // 15 phút (tải exe + quét 101 file .py)

const results = [];
const consoleErrors = [];
const snacks = [];
function check(name, ok, detail) {
    results.push({ name, ok: !!ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
}

// Bắt thông báo snack (renderer gửi qua IPC 'snack') để kiểm tra kết quả
// kiểm tra/tải (trạng thái fixerState không đọc được từ ngoài).
ipcMain.on('snack', (_e, message, type) => {
    snacks.push({ message: String(message), type, t: Date.now() });
    console.log('SNACK: ' + message);
});

let done = false;
function finish(code, msg) {
    if (done) return;
    done = true;
    const passed = results.filter((r) => r.ok).length;
    console.log(`=== RESULT ${passed}/${results.length} passed ===`);
    const failed = results.filter((r) => !r.ok).map((r) => r.name);
    if (failed.length > 0) console.log('FAILED: ' + failed.join(', '));
    if (consoleErrors.length > 0) {
        console.log('CONSOLE ERRORS (' + consoleErrors.length + '):');
        consoleErrors.slice(0, 20).forEach((e) => console.log('  ' + e));
    }
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}

setTimeout(() => finish(1, 'HARD TIMEOUT'), HARD_TIMEOUT_MS);

require('./electron/main.js');

const timer = setInterval(async () => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    const win = wins[0];
    if (win.webContents.isLoading()) return;
    clearInterval(timer);
    const wc = win.webContents;
    wc.on('console-message', (_e, level, message) => {
        const m = String(message);
        if (/Content-Security-Policy|Electron Security Warning|Autofill|favicon/i.test(m)) return;
        if (level >= 2) consoleErrors.push(`[${level}] ${m.slice(0, 300)}`);
    });
    await sleep(6000);

    const js = (code) => wc.executeJavaScript(code);
    async function clickAt(x, y) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        await sleep(300);
    }
    async function clickEl(rectCode) {
        const c = await js(rectCode);
        if (!c) return false;
        await clickAt(c.x, c.y);
        return true;
    }
    async function waitFor(fn, timeoutMs, label) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            try {
                const v = await fn();
                if (v) return v;
            } catch (e) { /* thử lại */ }
            await sleep(500);
        }
        console.log('waitFor TIMEOUT: ' + label);
        return null;
    }
    async function shot(name) {
        try {
            const img = await win.capturePage();
            fs.writeFileSync(path.join(SHOTS, name), img.toPNG());
            console.log('shot ' + name);
        } catch (e) { console.log('shot failed ' + name + ': ' + e.message); }
    }

    const sectionRect = (sec) => `(function () {
        const el = document.querySelector('.section-item[data-section="${sec}"]');
        if (!el) return null;
        // scrollIntoView ở các bước trước có thể cuộn cả trang, đẩy thanh
        // chọn trang lên khỏi khung nhìn — cuộn nó về trước khi đo.
        el.scrollIntoView({ block: 'nearest' });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const tabRect = (label) => `(function () {
        const tab = [...document.querySelectorAll('.left-menu .tab')].find((e) =>
            (e.querySelector('p') || {}).textContent.trim() === ${JSON.stringify(label)});
        if (!tab) return null;
        const r = tab.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const btnRect = (label) => `(function () {
        const b = [...document.querySelectorAll('.fixer-block s-button')]
            .find((e) => e.textContent.trim() === ${JSON.stringify(label)});
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const btnState = (label) => js(`(function () {
        const b = [...document.querySelectorAll('.fixer-block s-button')]
            .find((e) => e.textContent.trim() === ${JSON.stringify(label)});
        if (!b) return null;
        return { disabled: !!(b.disabled || b.hasAttribute('disabled')) };
    })()`);
    const fixerText = (re) => js(`(function () {
        const ps = [...document.querySelectorAll('.fixer-block p, .fixer-block h3')];
        const s = ps.find((e) => ${re}.test(e.textContent));
        return s ? s.textContent.trim() : null;
    })()`);
    const suspectRows = () => js(`[...document.querySelectorAll('.fixer-suspect-row')].map((r) => ({
        name: ((r.querySelector('.fixer-suspect-name') || {}).textContent || '').trim(),
        count: ((r.querySelector('.fixer-suspect-count') || {}).textContent || '').trim(),
    }))`);
    const checkboxRect = (name) => `(function () {
        const row = [...document.querySelectorAll('.fixer-suspect-row')].find((r) =>
            ((r.querySelector('.fixer-suspect-name') || {}).textContent || '').trim() === ${JSON.stringify(name)});
        if (!row) return null;
        const cb = row.querySelector('s-checkbox');
        if (!cb) return null;
        cb.scrollIntoView({ block: 'center' });
        const r = cb.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;

    try {
        // ---- A. Khởi động + mở Settings + tab Fixer ----
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);

        const clickedSettings = await clickEl(sectionRect('settings'));
        await sleep(800);
        const settingsActive = await js(`(function () {
            const el = document.querySelector('.section-item[data-section="settings"]');
            return el ? el.classList.contains('active') : false;
        })()`);
        check('settings-opens', clickedSettings && settingsActive);

        const fixerTabPresent = await js(`[...document.querySelectorAll('.left-menu .tab p')]
            .some((e) => e.textContent.trim() === 'Mod Fixer')`);
        check('fixer-tab-present', fixerTabPresent);

        const clickedFixer = await clickEl(tabRect('Mod Fixer'));
        await sleep(800);
        const fixerTitle = await fixerText(/Mod Fixer/);
        check('fixer-tab-opens', clickedFixer && !!fixerTitle, fixerTitle);

        // ---- B. Trạng thái ban đầu (Fixer giả đã cài sẵn trước khi mở app) ----
        const exePath = path.join(TOOLS, 'zzz-mod-fixer-v3.3.exe');
        let exeStat = null;
        try { exeStat = fs.statSync(exePath); } catch (_e) { /* no */ }
        check('seeded-exe-on-disk', !!(exeStat && exeStat.size > 0), 'size=' + (exeStat && exeStat.size));
        let cfg = {};
        try { cfg = JSON.parse(fs.readFileSync(path.join(USERDATA, 'config.json'), 'utf8')); } catch (_e) { /* no */ }
        check('seeded-config', cfg.fixerVersion === 'zzz-mod-fixer-v2.3.0' && cfg.fixerFileName === 'zzz-mod-fixer-v3.3.exe',
            `version=${cfg.fixerVersion} file=${cfg.fixerFileName}`);
        const status0 = await fixerText(/Fixer version|Not downloaded/);
        check('status-shows-seeded-version', status0 === 'Fixer version: zzz-mod-fixer-v2.3.0', status0);
        const checkBtn = await btnState('Check for updates');
        const dlBtn = await btnState('Download Fixer');
        const openBtn = await btnState('Open Fixer');
        check('buttons-present', !!(checkBtn && dlBtn && openBtn));
        check('open-enabled-seeded', openBtn && openBtn.disabled === false, JSON.stringify(openBtn));
        check('download-disabled-uptodate', dlBtn && dlBtn.disabled === true, JSON.stringify(dlBtn));
        const modsPath = await fixerText(/\/tmp\/xxmm-shot-tags6\/mods/);
        check('mods-path-shown', modsPath === '/tmp/xxmm-shot-tags6/mods', modsPath);
        await shot('shot-fixer-tab.png');

        // ---- C. Kiểm tra bản mới: trong máy ảo này Electron không ra được
        // mạng (Node 20 của Electron 33 không đọc proxy của máy ảo -> lỗi
        // TLS EPROTO; máy thật của Đạt không có proxy nên không gặp). Chỉ
        // kiểm tra app báo lỗi đúng cách, không văng. Nếu mạng làm việc
        // được thì snack sẽ báo bản v2.3.0 — cũng tính là đạt.
        await clickEl(btnRect('Check for updates'));
        const checkOutcome = await waitFor(() => {
            const s = snacks.find((x) => x.message.includes('zzz-mod-fixer-v2.3.0') || x.message.includes('Could not check'));
            return s ? s.message : null;
        }, 60000, 'check outcome snack');
        console.log('INFO check-outcome: ' + checkOutcome);
        check('check-reports-properly', !!checkOutcome, checkOutcome);

        // ---- D. Tải Fixer: bỏ qua tải thật trong máy ảo (đã cài sẵn bản
        // giả + Electron trong máy ảo không tải được từ GitHub — xem báo
        // cáo; phần tải thật chỉ Đạt test được trên máy thật). Chỉ kiểm
        // tra nút Download vẫn khóa khi đã có bản mới nhất.
        const dlBtn2 = await btnState('Download Fixer');
        check('download-locked-when-installed', dlBtn2 && dlBtn2.disabled === true, JSON.stringify(dlBtn2));

        // ---- E. Quét mod nghi hỏng ----
        await clickEl(btnRect('Scan for broken mods'));
        const scanDone = await waitFor(async () => {
            const s = await fixerText(/Found \d+ mod/);
            return s;
        }, 240000, 'scan done');
        check('scan-finds-3', scanDone === 'Found 3 mod(s) that may be broken', scanDone);
        const rows = await suspectRows();
        const names = rows.map((r) => r.name).sort();
        const expect = ['Anby Bikini', 'Ellen Charm', 'Grace Misc'].sort();
        check('suspects-correct', JSON.stringify(names) === JSON.stringify(expect), 'got=' + names.join(', '));
        check('old-hash-counts', rows.every((r) => r.count === '1 old code(s)'), JSON.stringify(rows));
        const cachePath = path.join(TOOLS, 'old-hashes-zzz-mod-fixer-v2.3.0.json');
        console.log('INFO hash-cache-file: ' + (fs.existsSync(cachePath) ? 'present (fresh fetch from GitHub)' : 'absent (bundled table fallback)'));
        await shot('shot-fixer-scan.png');

        // ---- F. Checkbox ----
        const clickedCb = await clickEl(checkboxRect('Anby Bikini'));
        await sleep(500);
        const fixBtn1 = await btnState('Fix selected mods');
        check('checkbox-selects', clickedCb && fixBtn1 && fixBtn1.disabled === false, JSON.stringify(fixBtn1));
        await clickEl(btnRect('Deselect all'));
        await sleep(500);
        const fixBtn2 = await btnState('Fix selected mods');
        check('deselect-all-works', fixBtn2 && fixBtn2.disabled === true, JSON.stringify(fixBtn2));
        await clickEl(btnRect('Select all'));
        await sleep(500);
        const fixBtn3 = await btnState('Fix selected mods');
        check('select-all-works', fixBtn3 && fixBtn3.disabled === false, JSON.stringify(fixBtn3));

        // ---- G. Luồng sửa với Fixer giả (đã cài sẵn trước khi mở app) ----
        // Stub ngủ 3s (để probe kịp chụp trạng thái chờ + xóa bản gốc
        // Grace), rồi chỉ "sửa" Anby Bikini (Ellen để nguyên).
        let stubOk = false;
        try {
            const exeContent = fs.readFileSync(exePath, 'utf8');
            stubOk = exeContent.includes('xxmm-fixer-') && (exeStat.mode & 0o111) !== 0;
        } catch (_e) { /* no */ }
        check('stub-fixer-in-place', stubOk);

        await clickEl(btnRect('Fix selected mods'));
        const tempPath = await waitFor(async () => {
            const ps = await js(`[...document.querySelectorAll('.fixer-flow .fixer-path')].map((e) => e.textContent.trim())`);
            const t = ps.find((p) => p.includes('xxmm-fixer-'));
            return t || null;
        }, 30000, 'temp path visible');
        check('waiting-shows-temp-path', !!tempPath, tempPath);
        // Trong lúc stub đang ngủ: kiểm tra bản chép tạm + xóa bản gốc Grace.
        let tempMods = [];
        if (tempPath) {
            try { tempMods = fs.readdirSync(tempPath).sort(); } catch (_e) { /* no */ }
        }
        check('temp-has-3-copies', JSON.stringify(tempMods) === JSON.stringify(['Anby Bikini', 'Ellen Charm', 'Grace Misc'].sort()),
            'temp=' + tempMods.join(', '));
        await shot('shot-fixer-waiting.png');
        fs.rmSync(path.join(MODS, 'Grace Misc'), { recursive: true, force: true });
        console.log('INFO deleted Grace Misc source mid-flow (failure-path test)');

        const doneText = await waitFor(async () => {
            const s = await fixerText(/Fixed \d+ mod/);
            return s;
        }, 60000, 'fix done');
        check('fix-done-shows', doneText === 'Fixed 1 mod(s)', doneText);
        const unchangedText = await fixerText(/\d+ mod\(s\) unchanged/);
        const failedText = await fixerText(/\d+ mod\(s\) could not be fixed/);
        check('summary-counts', !!(unchangedText && unchangedText.includes('1 mod(s)')) && !!(failedText && failedText.includes('1 mod(s)')),
            `${unchangedText} | ${failedText}`);
        const anbyIni = fs.readFileSync(path.join(MODS, 'Anby Bikini', 'mod.ini'), 'utf8');
        check('anby-fixed-on-disk', anbyIni.includes('4cbe7fbe') && !anbyIni.includes('00487185'), anbyIni.trim());
        let backupOk = false;
        try {
            const backups = fs.readdirSync(path.join(TOOLS, 'backup')).filter((d) => d.startsWith('Anby Bikini-'));
            const bIni = backups.length > 0
                ? fs.readFileSync(path.join(TOOLS, 'backup', backups[0], 'mod.ini'), 'utf8') : '';
            backupOk = backups.length > 0 && bIni.includes('00487185');
        } catch (_e) { /* no */ }
        check('backup-exists', backupOk);
        const ellenIni = fs.readFileSync(path.join(MODS, 'Ellen Charm', 'mod.ini'), 'utf8');
        check('ellen-unchanged', ellenIni.includes('00f11ea6'), ellenIni.trim());
        const leftoverTmp = fs.readdirSync('/tmp').filter((d) => d.startsWith('xxmm-fixer-'))
            .concat(fs.readdirSync('/tmp/xxmm-shot-tags6').filter((d) => d.startsWith('xxmm-fixer-')));
        check('temp-cleaned', leftoverTmp.length === 0, 'leftover=' + leftoverTmp.join(', '));
        const rowsAfter = await suspectRows();
        const namesAfter = rowsAfter.map((r) => r.name).sort();
        check('scan-list-updated', JSON.stringify(namesAfter) === JSON.stringify(['Ellen Charm', 'Grace Misc'].sort()),
            'got=' + namesAfter.join(', '));
        await shot('shot-fixer-done.png');

        // Đóng kết quả -> quét/sửa tiếp được (không có nút này thì sau
        // 1 lần sửa, nút Quét + nút Sửa khóa luôn tới khi mở lại app).
        await clickEl(btnRect('Close'));
        await sleep(500);
        const fixBtnAfter = await btnState('Fix selected mods');
        check('dismiss-enables-fix-again', fixBtnAfter && fixBtnAfter.disabled === false, JSON.stringify(fixBtnAfter));
        const scanBtnAfter = await btnState('Scan for broken mods');
        check('dismiss-enables-scan-again', scanBtnAfter && scanBtnAfter.disabled === false, JSON.stringify(scanBtnAfter));

        // ---- H. Hồi quy nhẹ Banana ----
        await clickEl(sectionRect('banana'));
        const bananaActive = await waitFor(async () => {
            return await js(`(function () {
                const el = document.querySelector('.section-item[data-section="banana"]');
                return el ? el.classList.contains('active') : false;
            })()`);
        }, 10000, 'banana section active');
        check('banana-section-opens', !!bananaActive);
        const banana = await waitFor(async () => {
            return await js(`(function () {
                const wv = document.querySelector('webview');
                if (!wv) return null;
                let url = '';
                try { url = wv.getURL(); } catch (_e) { /* no */ }
                const src = wv.getAttribute('src') || '';
                return (url.includes('gamebanana.com') || src.includes('gamebanana.com')) ? { url: url, src: src } : null;
            })()`);
        }, 30000, 'banana webview gamebanana');
        check('banana-still-loads', !!banana, JSON.stringify(banana));
        await clickEl(sectionRect('mod'));
        await sleep(2000);
        const cards1 = await waitFor(async () => {
            const n = await js(`document.querySelectorAll('.mod-item').length`);
            return n === 5 ? n : null;
        }, 15000, '5 cards after Grace deleted');
        check('mod-cards-5-after-fix', cards1 === 5, 'cards=' + cards1);
    } catch (e) {
        console.log('PROBE EXCEPTION: ' + (e && e.stack || e));
    }
    finish(results.every((r) => r.ok) ? 0 : 1, 'probe finished');
}, 500);
