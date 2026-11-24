// Probe nút "Tự sửa hết" (1.5.25-test7, nhánh A/gamebanana) — chạy với
// Fixer GIẢ đã cài sẵn (seed-fixture-fixer.py), vì file .exe Windows
// không chạy được trên máy ảo Linux.
// 1. Nút "Auto-Fix All" hiện cạnh nút Quét (cùng hàng, bên phải); dòng
//    hướng dẫn mới (không còn dặn kiểm trong game, có ý Fixer chỉ sửa
//    mod nó nhận ra + bản gốc giữ lại).
// 2. Bấm nút -> quét chạy -> cả 3 mod nghi hỏng được chép ra thư mục
//    tạm -> Fixer giả mở -> kết quả: Anby fixed, Ellen + Grace
//    unchanged, bản gốc Anby đã sửa, bản dự phòng tồn tại, thư mục
//    tạm đã dọn, danh sách nghi hỏng còn Ellen + Grace.
// 3. Quét ra 0 mod (vá .ini Ellen + Grace sang mã mới rồi bấm lại):
//    báo "No mods look broken", KHÔNG mở Fixer, không tạo thư mục tạm.
// 4. Luồng chọn tay còn nguyên: vá Ellen về mã cũ, bấm Quét -> 1 mod
//    nghi hỏng, tick chọn -> nút "Fix selected mods" mở khóa.
// Fixture: /tmp/xxmm-shot-tags6 (seed-fixture-fixer.py).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-autofix-test7.js
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MODS = '/tmp/xxmm-shot-tags6/mods';
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 900000; // 15 phút

const results = [];
const consoleErrors = [];
const snacks = [];
function check(name, ok, detail) {
    results.push({ name, ok: !!ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
}

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
        if (/Content-Security-Policy|Electron Security Warning|Autofill|favicon|fixerOldHashMap: fetch failed/i.test(m)) return;
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
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
            left: Math.round(r.left), top: Math.round(r.top),
            width: Math.round(r.width), height: Math.round(r.height) };
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
    const tmpDirs = () => {
        let out = [];
        for (const dir of ['/tmp', '/tmp/xxmm-shot-tags6']) {
            try { out = out.concat(fs.readdirSync(dir).filter((d) => d.startsWith('xxmm-fixer-'))); }
            catch (_e) { /* no */ }
        }
        return out;
    };

    try {
        // ---- A. Mở Settings + tab Fixer ----
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);
        await clickEl(sectionRect('settings'));
        await sleep(800);
        await clickEl(tabRect('Mod Fixer'));
        await sleep(800);
        const fixerTitle = await fixerText(/Mod Fixer/);
        check('fixer-tab-opens', !!fixerTitle, fixerTitle);

        // ---- B. Nút mới + dòng hướng dẫn mới ----
        const scanBtn = await js(btnRect('Scan for broken mods'));
        const autoBtn = await js(btnRect('Auto-Fix All'));
        check('autofix-button-present', !!(scanBtn && autoBtn));
        const sameRow = scanBtn && autoBtn &&
            Math.abs(scanBtn.top - autoBtn.top) <= 10 && autoBtn.left > scanBtn.left;
        check('autofix-next-to-scan', sameRow,
            scanBtn && autoBtn ? `scan=(${scanBtn.left},${scanBtn.top}) auto=(${autoBtn.left},${autoBtn.top})` : 'missing');
        const hint = await fixerText(/only fixes mods it recognizes/);
        check('hint-new-text', !!hint, hint);
        const oldHint = await js(`[...document.querySelectorAll('.fixer-block p')]
            .some((e) => e.textContent.includes('Check the listed mods in-game'))`);
        check('hint-no-ingame', oldHint === false);
        await shot('shot-autofix-tab.png');

        // ---- C. Bấm Tự sửa hết: quét + sửa cả 3 mod nghi hỏng ----
        const clickedAuto = await clickEl(btnRect('Auto-Fix All'));
        check('autofix-clicked', clickedAuto);
        const tempPath = await waitFor(async () => {
            const ps = await js(`[...document.querySelectorAll('.fixer-flow .fixer-path')].map((e) => e.textContent.trim())`);
            const t = ps.find((p) => p.includes('xxmm-fixer-'));
            return t || null;
        }, 60000, 'temp path visible');
        check('autofix-shows-temp-path', !!tempPath, tempPath);
        let tempMods = [];
        if (tempPath) {
            try { tempMods = fs.readdirSync(tempPath).sort(); } catch (_e) { /* no */ }
        }
        check('temp-has-all-3-suspects', JSON.stringify(tempMods) === JSON.stringify(['Anby Bikini', 'Ellen Charm', 'Grace Misc'].sort()),
            'temp=' + tempMods.join(', '));
        await shot('shot-autofix-waiting.png');
        const doneText = await waitFor(async () => {
            const s = await fixerText(/Fixed \d+ mod/);
            return s;
        }, 60000, 'fix done');
        check('autofix-done-shows', doneText === 'Fixed 1 mod(s)', doneText);
        // Lưu ý: regex phải khớp đúng dòng kết quả "N mod(s) unchanged"
        // — /unchanged/ trần sẽ trúng dòng hướng dẫn mới ("are left
        // unchanged") đứng trước trong DOM (FAIL giả lần chạy đầu).
        const unchangedText = await fixerText(/\d+ mod\(s\) unchanged/);
        check('autofix-unchanged-2', !!(unchangedText && unchangedText.includes('2 mod(s)')), unchangedText);
        const anbyIni = fs.readFileSync(path.join(MODS, 'Anby Bikini', 'mod.ini'), 'utf8');
        check('anby-fixed-on-disk', anbyIni.includes('4cbe7fbe') && !anbyIni.includes('00487185'), anbyIni.trim());
        const TOOLS = '/tmp/xxmm-shot-tags6/userdata/tools/ZZZ-Mod-Fixer';
        let backupOk = false;
        try {
            const backups = fs.readdirSync(path.join(TOOLS, 'backup')).filter((d) => d.startsWith('Anby Bikini-'));
            const bIni = backups.length > 0
                ? fs.readFileSync(path.join(TOOLS, 'backup', backups[0], 'mod.ini'), 'utf8') : '';
            backupOk = backups.length > 0 && bIni.includes('00487185');
        } catch (_e) { /* no */ }
        check('backup-exists', backupOk);
        const ellenIni = fs.readFileSync(path.join(MODS, 'Ellen Charm', 'mod.ini'), 'utf8');
        const graceIni = fs.readFileSync(path.join(MODS, 'Grace Misc', 'mod.ini'), 'utf8');
        check('ellen-grace-unchanged', ellenIni.includes('00f11ea6') && graceIni.includes('0139f54e'));
        check('temp-cleaned', tmpDirs().length === 0, 'leftover=' + tmpDirs().join(', '));
        const rowsAfter = await suspectRows();
        const namesAfter = rowsAfter.map((r) => r.name).sort();
        check('scan-list-updated', JSON.stringify(namesAfter) === JSON.stringify(['Ellen Charm', 'Grace Misc'].sort()),
            'got=' + namesAfter.join(', '));
        await shot('shot-autofix-done.png');
        await clickEl(btnRect('Close'));
        await sleep(500);

        // ---- D. Quét ra 0 mod: báo, không mở Fixer ----
        fs.writeFileSync(path.join(MODS, 'Ellen Charm', 'mod.ini'), '[TextureOverrideEllen]\nhash = deadbeef\n');
        fs.writeFileSync(path.join(MODS, 'Grace Misc', 'mod.ini'), '[TextureOverrideGrace]\nhash = deadbeef\n');
        const tmpBefore = tmpDirs();
        const snackBefore = snacks.length;
        const clickedAuto2 = await clickEl(btnRect('Auto-Fix All'));
        check('autofix-0-clicked', clickedAuto2);
        const zeroSnack = await waitFor(() => {
            const s = snacks.slice(snackBefore).find((x) => x.message.includes('No mods look broken'));
            return s ? s.message : null;
        }, 60000, 'zero-case snack');
        check('autofix-0-snack', !!zeroSnack, zeroSnack);
        await sleep(2000);
        const tmpAfter = tmpDirs();
        check('autofix-0-no-temp', tmpAfter.length === tmpBefore.length,
            `before=${tmpBefore.length} after=${tmpAfter.length}`);
        const waitingShown = await js(`!!document.querySelector('.fixer-flow')`);
        check('autofix-0-no-flow', waitingShown === false);
        const zeroText = await fixerText(/No mods look broken/);
        check('autofix-0-list-empty', !!zeroText, zeroText);

        // ---- E. Luồng chọn tay còn nguyên ----
        fs.writeFileSync(path.join(MODS, 'Ellen Charm', 'mod.ini'), '[TextureOverrideEllen]\nhash = 00f11ea6\n');
        await clickEl(btnRect('Scan for broken mods'));
        const scanDone = await waitFor(async () => {
            const s = await fixerText(/Found \d+ mod/);
            return s;
        }, 120000, 'rescan done');
        check('manual-rescan-1', scanDone === 'Found 1 mod(s) that may be broken', scanDone);
        const fixBtn0 = await btnState('Fix selected mods');
        check('manual-fix-locked-before-tick', fixBtn0 && fixBtn0.disabled === true, JSON.stringify(fixBtn0));
        const clickedCb = await clickEl(checkboxRect('Ellen Charm'));
        await sleep(500);
        const fixBtn1 = await btnState('Fix selected mods');
        check('manual-fix-unlocked-after-tick', clickedCb && fixBtn1 && fixBtn1.disabled === false, JSON.stringify(fixBtn1));
    } catch (e) {
        console.log('PROBE EXCEPTION: ' + (e && e.stack || e));
    }
    finish(results.every((r) => r.ok) ? 0 : 1, 'probe finished');
}, 500);
