// Probe lưu trạng thái lọc sau khi mở lại app (1.5.25-test5).
// Chạy NGAY SAU probe-filter-suspect.js, CÙNG thư mục userdata
// (không gieo lại fixture): công tắc lọc vẫn BẬT, lưới vẫn chỉ hiện
// 2 mod nghi hỏng còn lại (Ellen, Grace), config vẫn giữ 2 id.
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-filter-persist.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const USERDATA = '/tmp/xxmm-shot-tags6/userdata';
const CONFIG = path.join(USERDATA, 'config.json');
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 300000;

const results = [];
const consoleErrors = [];
function check(name, ok, detail) {
    results.push({ name, ok: !!ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
}

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
    const gridNames = () => js(`[...document.querySelectorAll('.mod-item .mod-item-name')]
        .map((e) => e.textContent.trim()).sort()`);
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
        return { checked: !!s.checked, disabled: !!(s.disabled || s.hasAttribute('disabled')) };
    })()`);

    try {
        const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
        const ids = cfg.fixerSuspectIds || [];
        check('config-keeps-2-ids', Array.isArray(ids) && ids.length === 2 &&
            ids.includes('fixture-ellen-charm') && ids.includes('fixture-grace-misc'),
            JSON.stringify(ids));
        check('config-keeps-toggle-on', cfg.showOnlySuspected === true,
            'showOnlySuspected=' + JSON.stringify(cfg.showOnlySuspected));

        // Lưới mở lên đã lọc sẵn (công tắc còn bật từ lần trước).
        const names0 = await waitFor(async () => {
            const ns = await gridNames();
            return ns.length === 2 ? ns : null;
        }, 15000, 'grid shows 2 suspects after restart');
        check('grid-filtered-after-restart', JSON.stringify(names0) === JSON.stringify(['Ellen Charm', 'Grace Misc'].sort()),
            'got=' + JSON.stringify(names0));

        const opened = await clickEl(filterBtnRect);
        await sleep(800);
        check('filter-panel-opens', opened && !!(await js(`!!document.querySelector('#suspect-only-switch')`)));
        const sw = await switchState();
        check('switch-still-on', sw && sw.checked === true && sw.disabled === false, JSON.stringify(sw));
        await shot('shot-filter-persist.png');

        // Tắt lọc -> hiện đủ 6 (vệ sinh: trả fixture về trạng thái thường).
        await clickEl(switchRect);
        const all = await waitFor(async () => {
            const ns = await gridNames();
            return ns.length === 6 ? ns : null;
        }, 15000, 'grid shows all 6 after switching off');
        check('switch-off-shows-6', all && all.length === 6, 'got=' + JSON.stringify(all));

        finish(results.every((r) => r.ok) ? 0 : 1, 'probe-filter-persist done');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'probe error');
    }
});
