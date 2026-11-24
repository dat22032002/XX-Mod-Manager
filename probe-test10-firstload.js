// Probe riêng: trang chào lần đầu (First Load) vẫn mở được sau khi bỏ
// tab Switch Configuration khỏi Cài đặt (bản thử 10).
// Chạy RIÊNG với probe chính vì nút First Load đặt firstLoad=true trong
// bộ nhớ, làm onbeforeunload bỏ qua bước lưu khi tắt app -> cấu hình
// plugin không được lưu xuống đĩa. Probe này chỉ bấm First Load rồi
// thoát nên không ảnh hưởng gì.
// Chạy trên cùng userdata của probe chính (sau probe chính, trước hoặc
// sau probe-reopen đều được — file config trên đĩa không đổi vì bước
// lưu bị bỏ qua khi firstLoad=true trong bộ nhớ).
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-test10-firstload.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 300000; // 5 phút

const results = [];
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
    await sleep(8000);

    const js = (code) => wc.executeJavaScript(code);
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
    async function shot(name, targetWin) {
        try {
            const img = await (targetWin || win).capturePage();
            fs.writeFileSync(path.join(SHOTS, name), img.toPNG());
            console.log('shot ' + name);
        } catch (e) { console.log('shot failed ' + name + ': ' + e.message); }
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
        const active = await js(`(function () {
            const el = document.querySelector('.section-item[data-section="${sec}"]');
            return el ? el.classList.contains('active') : false;
        })()`);
        return clicked && !!settled && active;
    }
    const iconButtonRect = (label) => `(function () {
        const bar = [...document.querySelectorAll('.setting-content .OO-setting-bar')].find((b) => {
            const h = b.querySelector('h3');
            return h && h.textContent.trim() === ${JSON.stringify(label)};
        });
        if (!bar) return null;
        const btn = bar.querySelector('s-icon-button');
        if (!btn) return null;
        btn.scrollIntoView({ block: 'center' });
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;

    try {
        const cardCount = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cardCount === 6, 'cards=' + cardCount);
        if (cardCount !== 6) { finish(1, 'boot failed'); return; }
        W = await js(`window.innerWidth`);
        check('go-settings', await goSection('settings'));
        check('go-general-tab', await clickEl(tabRect('General Settings')));
        await sleep(800);
        check('click-first-load', await clickEl(iconButtonRect('New User Guide')));
        const twoWins = await waitFor(async () =>
            BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length === 2, 8000, 'first-load window');
        check('first-load-window-opens', !!twoWins,
            'windows=' + BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length);
        const child = BrowserWindow.getAllWindows().find((w) => w !== win && !w.isDestroyed());
        if (child) {
            await sleep(1500);
            await shot('shot-test10-firstload.png', child);
            check('first-load-window-visible', child.isVisible());
            child.destroy();
        } else {
            check('first-load-window-visible', false, 'no child window');
        }
        await sleep(800);
        check('first-load-window-closed',
            BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length === 1);
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack || e));
    }
    finish(0, 'first-load probe done');
}, 500);
