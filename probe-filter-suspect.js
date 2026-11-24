// Probe lọc "chỉ mod nghi hỏng" (1.5.25-test5).
// 1. Chưa quét: công tắc mờ + dòng nhắc quét trước.
// 2. Quét Fixer: tìm đúng 3 mod nghi hỏng, lưu id vào config.
// 3. Bật lọc: lưới chỉ hiện 3 mod nghi hỏng; tắt: hiện đủ 6.
// 4. Sửa Anby + quét lại: Anby biến khỏi danh sách (còn 2), config cập nhật.
// (Khởi động lại app vẫn còn danh sách: probe-filter-persist.js chạy sau,
//  cùng thư mục userdata này.)
// Fixture: seed-fixture-fixer.py (3 mod có mã cũ + Fixer GIẢ).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-filter-suspect.js
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MODS = '/tmp/xxmm-shot-tags6/mods';
const USERDATA = '/tmp/xxmm-shot-tags6/userdata';
const CONFIG = path.join(USERDATA, 'config.json');
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 900000;

const results = [];
const consoleErrors = [];
const snacks = [];
function check(name, ok, detail) {
    results.push({ name, ok: !!ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
}

ipcMain.on('snack', (_e, message, type) => {
    snacks.push({ message: String(message), type });
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
    const suspectRows = () => js(`[...document.querySelectorAll('.fixer-suspect-row')].map((r) => ((
        r.querySelector('.fixer-suspect-name') || {}).textContent || '').trim())`);
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
    const filterBtnRect = `(function () {
        const b = document.querySelector('#filter-toggle-chip');
        if (!b) return null;
        b.scrollIntoView({ block: 'nearest' });
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const switchRect = `(function () {
        const s = document.querySelector('#suspect-only-switch');
        if (!s) return null;
        s.scrollIntoView({ block: 'center' });
        const r = s.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const switchState = () => js(`(function () {
        const s = document.querySelector('#suspect-only-switch');
        if (!s) return null;
        const wrap = s.closest('.counts-wrap');
        return { checked: !!s.checked, disabled: !!(s.disabled || s.hasAttribute('disabled')),
            dimmed: !!(wrap && wrap.classList.contains('disabled')) };
    })()`);
    const hintVisible = () => js(`(function () {
        const h = document.querySelector('.suspect-hint');
        if (!h) return false;
        const r = h.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && h.textContent.trim();
    })()`);
    const gridNames = () => js(`[...document.querySelectorAll('.mod-item .mod-item-name')]
        .map((e) => e.textContent.trim()).sort()`);
    const readConfig = () => {
        try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (_e) { return null; }
    };
    async function openFilterPanel() {
        const opened = await clickEl(filterBtnRect);
        await sleep(800);
        return opened && !!(await js(`!!document.querySelector('#suspect-only-switch')`));
    }
    async function goToModPage() {
        const clicked = await clickEl(sectionRect('mod'));
        await sleep(800);
        return clicked && await js(`(function () {
            const el = document.querySelector('.section-item[data-section="mod"]');
            return el ? el.classList.contains('active') : false;
        })()`);
    }

    try {
        // ---- A. Khởi động: 6 thẻ; chưa quét -> công tắc mờ + nhắc ----
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);
        const cfg0 = readConfig();
        // File config mới chưa có key này (undefined) = chưa quét bao giờ,
        // giống null sau khi app đã lưu 1 lần.
        check('config-never-scanned', cfg0 && cfg0.fixerSuspectIds == null,
            'fixerSuspectIds=' + JSON.stringify(cfg0 && cfg0.fixerSuspectIds));

        const panelOpened = await openFilterPanel();
        check('filter-panel-opens', panelOpened);
        const sw0 = await switchState();
        check('switch-disabled-before-scan', sw0 && sw0.disabled === true && sw0.dimmed === true,
            JSON.stringify(sw0));
        const hint0 = await hintVisible();
        check('scan-first-hint-shows', hint0 === 'Scan for broken mods in Settings → Mod Fixer first',
            JSON.stringify(hint0));
        await shot('shot-filter-before-scan.png');
        await clickEl(filterBtnRect); // đóng bảng
        await sleep(500);

        // ---- B. Quét Fixer: 3 nghi hỏng, lưu vào config ----
        await clickEl(sectionRect('settings'));
        await sleep(800);
        await clickEl(tabRect('Mod Fixer'));
        await sleep(800);
        await clickEl(btnRect('Scan for broken mods'));
        const scanDone = await waitFor(async () => fixerText(/Found \d+ mod/), 240000, 'scan done');
        check('scan-finds-3', scanDone === 'Found 3 mod(s) that may be broken', scanDone);
        const names = (await suspectRows()).sort();
        check('suspects-correct', JSON.stringify(names) === JSON.stringify(['Anby Bikini', 'Ellen Charm', 'Grace Misc'].sort()),
            'got=' + names.join(', '));
        await sleep(1000);
        const cfg1 = readConfig();
        const ids1 = (cfg1 && cfg1.fixerSuspectIds) || [];
        check('config-saves-3-ids', Array.isArray(ids1) && ids1.length === 3 &&
            ids1.includes('fixture-anby-bikini') && ids1.includes('fixture-ellen-charm') &&
            ids1.includes('fixture-grace-misc'), JSON.stringify(ids1));

        // ---- C. Bật lọc: chỉ 3 nghi hỏng; tắt: đủ 6 ----
        check('back-to-mod-page', await goToModPage());
        check('filter-panel-opens-2', await openFilterPanel());
        const sw1 = await switchState();
        check('switch-enabled-after-scan', sw1 && sw1.disabled === false && sw1.checked === false,
            JSON.stringify(sw1));
        const hint1 = await hintVisible();
        check('hint-gone-after-scan', hint1 === false, JSON.stringify(hint1));

        await clickEl(switchRect);
        const onNames = await waitFor(async () => {
            const ns = await gridNames();
            return ns.length === 3 ? ns : null;
        }, 15000, 'grid shows 3 suspects');
        check('filter-on-shows-3', JSON.stringify(onNames) === JSON.stringify(['Anby Bikini', 'Ellen Charm', 'Grace Misc'].sort()),
            'got=' + JSON.stringify(onNames));
        const swOn = await switchState();
        check('switch-checked-when-on', swOn && swOn.checked === true, JSON.stringify(swOn));
        await shot('shot-filter-on.png');

        await clickEl(switchRect);
        const offNames = await waitFor(async () => {
            const ns = await gridNames();
            return ns.length === 6 ? ns : null;
        }, 15000, 'grid shows all 6');
        check('filter-off-shows-6', offNames && offNames.length === 6, 'got=' + JSON.stringify(offNames));
        await clickEl(filterBtnRect); // đóng bảng
        await sleep(500);

        // ---- D. Sửa Anby + quét lại: Anby biến khỏi danh sách ----
        await clickEl(sectionRect('settings'));
        await sleep(800);
        await clickEl(tabRect('Mod Fixer'));
        await sleep(800);
        const clickedCb = await clickEl(checkboxRect('Anby Bikini'));
        await sleep(500);
        const fixBtn = await btnState('Fix selected mods');
        check('select-anby-only', clickedCb && fixBtn && fixBtn.disabled === false, JSON.stringify(fixBtn));
        await clickEl(btnRect('Fix selected mods'));
        const doneText = await waitFor(async () => fixerText(/Fixed \d+ mod/), 90000, 'fix done');
        check('fix-done', doneText === 'Fixed 1 mod(s)', doneText);
        const anbyIni = fs.readFileSync(path.join(MODS, 'Anby Bikini', 'mod.ini'), 'utf8');
        check('anby-fixed-on-disk', anbyIni.includes('4cbe7fbe') && !anbyIni.includes('00487185'), anbyIni.trim());
        await clickEl(btnRect('Close'));
        await sleep(500);
        await clickEl(btnRect('Scan for broken mods'));
        const scanDone2 = await waitFor(async () => fixerText(/Found \d+ mod/), 240000, 'rescan done');
        check('rescan-finds-2', scanDone2 === 'Found 2 mod(s) that may be broken', scanDone2);
        const names2 = (await suspectRows()).sort();
        check('rescan-drops-anby', JSON.stringify(names2) === JSON.stringify(['Ellen Charm', 'Grace Misc'].sort()),
            'got=' + names2.join(', '));
        await sleep(1000);
        const cfg2 = readConfig();
        const ids2 = (cfg2 && cfg2.fixerSuspectIds) || [];
        check('config-saves-2-ids', Array.isArray(ids2) && ids2.length === 2 &&
            !ids2.includes('fixture-anby-bikini'), JSON.stringify(ids2));

        // Lọc đang bật thì lưới chỉ còn 2 (Anby đã sửa tự biến mất).
        check('back-to-mod-page-2', await goToModPage());
        check('filter-panel-opens-3', await openFilterPanel());
        await clickEl(switchRect);
        const onNames2 = await waitFor(async () => {
            const ns = await gridNames();
            return ns.length === 2 ? ns : null;
        }, 15000, 'grid shows 2 suspects');
        check('filter-on-shows-2-after-fix', JSON.stringify(onNames2) === JSON.stringify(['Ellen Charm', 'Grace Misc'].sort()),
            'got=' + JSON.stringify(onNames2));
        await shot('shot-filter-on-after-fix.png');
        // Để công tắc BẬT khi tắt app để probe-filter-persist.js kiểm tra
        // trạng thái còn lưu sau khi mở lại.
        await sleep(1000);

        finish(results.every((r) => r.ok) ? 0 : 1, 'probe-filter-suspect done');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'probe error');
    }
});
