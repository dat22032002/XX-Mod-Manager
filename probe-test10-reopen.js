// Probe-reopen cho test10: chạy SAU probe-test10.js (không rebuild
// fixture — dùng nguyên userdata vừa thoát). Kiểm:
//  1. Công tắc cảnh báo trùng mod vẫn ON sau khi mở lại + Apply hiện hộp.
//  2. Tab Mod Card Effect vẫn không có sau khi mở lại (plugin đã bỏ
//     16:12; rê chuột do probe-hover-recheck.js kiểm riêng).
//  3. 3 mục đã bỏ vẫn không có trong cột Cài đặt.
// Cuối probe tắt công tắc trùng mod rồi thoát để kiểm chiều TẮT nhớ
// lại qua config.json trên đĩa.
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-test10-reopen.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = '/tmp/xxmm-shot-tags6';
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 600000;

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
        if (/Content-Security-Policy|Electron Security Warning|Autofill|favicon|fixerOldHashMap: fetch failed/i.test(m)) return;
        if (level >= 2) consoleErrors.push(`[${level}] ${m.slice(0, 300)}`);
    });
    await sleep(8000);

    const js = (code) => wc.executeJavaScript(code);
    await js(`(function () {
        const d = document.getElementById('dialog-confirm-conflict');
        if (!d) return false;
        window.__conflictShown = false;
        d.addEventListener('show', () => { window.__conflictShown = true; });
        d.addEventListener('closed', () => { window.__conflictShown = false; });
        d.addEventListener('dismiss', () => { window.__conflictShown = false; });
        d.addEventListener('close', () => { window.__conflictShown = false; });
        return true;
    })()`);
    async function clickAt(x, y) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        await sleep(350);
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
            await sleep(400);
        }
        console.log('waitFor TIMEOUT: ' + label);
        return null;
    }

    let W = 0;
    const sectionRect = (sec) => `(function () {
        const el = document.querySelector('.section-item[data-section="${sec}"]');
        if (!el) return null;
        el.scrollIntoView({ block: 'nearest' });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const tabRect = (label) => `(function () {
        const tab = [...document.querySelectorAll('.setting-container .left-menu .tab')].find((e) =>
            (e.querySelector('p') || {}).textContent.trim() === ${JSON.stringify(label)});
        if (!tab) return null;
        tab.scrollIntoView({ block: 'nearest' });
        const r = tab.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const sliderTx = () => js(`(function () {
        const s = document.querySelector('.section-slider');
        if (!s) return null;
        const m = getComputedStyle(s).transform;
        const mm = /matrix\\([^,]+,[^,]+,[^,]+,[^,]+,\\s*([\\d.-]+)/.exec(m);
        return mm ? Math.round(parseFloat(mm[1])) : null;
    })()`);
    async function goSection(sec) {
        const clicked = await clickEl(sectionRect(sec));
        const idx = ['mod', 'banana', 'help', 'settings'].indexOf(sec);
        const expect = idx * (10 - W);
        const settled = await waitFor(async () => (await sliderTx()) === expect, 8000, 'slide settle ' + sec);
        await sleep(700);
        return clicked && !!settled;
    }
    const switchState = (label) => js(`(function () {
        const bar = [...document.querySelectorAll('.setting-content .OO-setting-bar')].find((b) => {
            const h = b.querySelector('h3');
            return h && h.textContent.trim() === ${JSON.stringify(label)} && b.querySelector('s-switch');
        });
        if (!bar) return { found: false };
        const sw = bar.querySelector('s-switch');
        bar.scrollIntoView({ block: 'center' });
        const r = sw.getBoundingClientRect();
        return { found: true, checked: sw.hasAttribute('checked') || !!sw.checked,
            x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    async function clickSwitch(label) {
        const s = await switchState(label);
        if (!s.found) return false;
        await clickAt(s.x, s.y);
        return true;
    }
    const cardRectByName = (name) => `(function () {
        const c = document.querySelector('.mod-item[name=${JSON.stringify(name)}]');
        if (!c) return null;
        c.scrollIntoView({ block: 'center' });
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const modTitle = () => js(`(function () {
        const el = document.querySelector('.mod-title');
        return el ? el.textContent.trim() : 'missing';
    })()`);
    // Hộp thoại mở hay đóng: đo bằng SỰ KIỆN show/closed của Sober, không
    // đo rect (nội dung h1 vẫn có khung hình kể cả khi hộp đóng nên đo
    // rect báo nhầm là hộp đang mở — probe lần 1 fail oan 2 check).
    const dialogVisible = () => js(`window.__conflictShown === true`);

    try {
        W = await js(`window.innerWidth`);
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('reopen-6-cards', cards0 === 6, 'cards=' + cards0);

        // 1. Công tắc trùng mod vẫn ON + tab đã bỏ vẫn không có.
        check('go-settings', await goSection('settings'));
        const tabLabels = await js(`[...document.querySelectorAll('.setting-container .left-menu .tab p')]
            .map((e) => e.textContent.trim())`);
        check('reopen-tabs-still-gone', !tabLabels.includes('Switch Configuration')
            && !tabLabels.includes('About') && !tabLabels.includes('Test Plugin')
            && !tabLabels.includes('Mod Card Effect'),
            JSON.stringify(tabLabels));
        check('go-advanced-tab', await clickEl(tabRect('Advanced Settings')));
        await sleep(800);
        const warn = await switchState('Show Mod Conflict Warning');
        check('conflict-toggle-still-on', warn.found && warn.checked === true, JSON.stringify(warn));

        // 2. Mod Card Effect đã bỏ — chỉ về trang Mod cho mục 3.
        check('go-mod', await goSection('mod'));

        // 3. Apply với 2 mod trùng nhau -> hộp hiện (công tắc ON nhớ lại).
        // LỰA CHỌN ĐÃ KHÔI PHỤC KHI MỞ APP: app nạp lại preset hiện tại
        // lúc khởi động (modCardManager loadPreset) nên Anby + Ellen có
        // thể ĐÃ được chọn sẵn — bấm mù sẽ BỎ chọn chúng (lỗi probe lần
        // 1: Apply 0 mod nên không có hộp). Chỉ bấm thẻ nào chưa chọn.
        const cardClicked = (name) => js(`(function () {
            const c = document.querySelector('.mod-item[name=${JSON.stringify(name)}]');
            return c ? c.getAttribute('clicked') : 'missing';
        })()`);
        const anbyWasClicked = await cardClicked('Anby Bikini');
        const ellenWasClicked = await cardClicked('Ellen Charm');
        console.log(`selection at boot: anby=${anbyWasClicked} ellen=${ellenWasClicked}`);
        // Không assert trạng thái lúc mở app: preset lưu lựa chọn của
        // lần chạy trước, lần chạy trước có thể đã bỏ chọn (đúng hành
        // vi) — chỉ cần chắc chắn cả 2 được chọn trước khi Apply.
        if (anbyWasClicked !== 'true') {
            const anbyCard = await js(cardRectByName('Anby Bikini'));
            await clickAt(anbyCard.x, anbyCard.y);
        }
        if (ellenWasClicked !== 'true') {
            const ellenCard = await js(cardRectByName('Ellen Charm'));
            await clickAt(ellenCard.x, ellenCard.y);
        }
        await sleep(500);
        const anbySel = await cardClicked('Anby Bikini');
        const ellenSel = await cardClicked('Ellen Charm');
        check('both-selected-before-apply', anbySel === 'true' && ellenSel === 'true',
            `anby=${anbySel} ellen=${ellenSel}`);
        const applyRect = await js(`(function () {
            const b = document.getElementById('apply-button');
            if (!b) return null;
            b.scrollIntoView({ block: 'nearest' });
            const r = b.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        await clickAt(applyRect.x, applyRect.y);
        const dlgShown = await waitFor(async () => (await dialogVisible()) === true, 8000, 'conflict dialog on reopen');
        check('dialog-shows-after-reopen', !!dlgShown);
        const anywayRect = await js(`(function () {
            const b = document.getElementById('conflict-apply-anyway');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        if (anywayRect) await clickAt(anywayRect.x, anywayRect.y);
        await sleep(1200);
        check('dialog-closed-after-anyway', (await dialogVisible()) === false);

        // 4. Tắt công tắc rồi thoát để kiểm chiều TẮT nhớ lại qua đĩa.
        check('go-settings-2', await goSection('settings'));
        check('go-advanced-tab-2', await clickEl(tabRect('Advanced Settings')));
        await sleep(800);
        check('conflict-turn-off', await clickSwitch('Show Mod Conflict Warning'));
        await sleep(500);
        const warnOff = await switchState('Show Mod Conflict Warning');
        check('conflict-off-after-click', warnOff.checked === false, JSON.stringify(warnOff));

        finish(0, 'DONE reopen');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'PROBE ERROR');
    }
});
