// Đo hình học vùng thông tin thẻ mod (phục vụ nhãn tag xám, Đạt 24/11):
// thẻ Ngang + Dọc, chưa chọn + đã chọn: khung thẻ, ảnh, tiêu đề,
// ô chữ, dòng dung lượng, dòng đầu mô tả — để biết còn bao nhiêu chỗ
// trống cho 1 dòng nhãn tag trước khi quyết dòng riêng hay chung dòng.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-tagcolors.py
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 2000x1200x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-tagcolors/userdata probe-geometry.js
const { app, BrowserWindow } = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HARD_TIMEOUT_MS = 300000;

function finish(code, msg) {
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}
setTimeout(() => finish(1, 'HARD TIMEOUT'), HARD_TIMEOUT_MS);

require('./electron/main.js');

let win = null;
let wc = null;
let bootStarted = false;

const bootTimer = setInterval(() => {
    if (bootStarted) return;
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    win = wins[0];
    wc = win.webContents;
    if (wc.isLoading()) return;
    bootStarted = true;
    clearInterval(bootTimer);
    main().catch((e) => {
        console.log('MAIN ERROR: ' + (e && e.stack || e));
        finish(1, 'main crashed');
    });
}, 50);

async function main() {
    const js = (code) => wc.executeJavaScript(code);

    async function waitFor(fn, timeoutMs, label) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            try {
                const v = await fn();
                if (v) return v;
            } catch (e) { /* thử lại */ }
            await sleep(300);
        }
        console.log('waitFor TIMEOUT: ' + label);
        return null;
    }

    async function clickAt(x, y) {
        wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
        await sleep(1000);
    }

    const triggerCenter = `(function () {
        const el = document.querySelector('#view-panel-trigger');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const layoutOptCenter = (label) => `(function () {
        const els = [...document.querySelectorAll('#layout-capsule *')];
        const el = els.find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(label)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    async function switchLayout(label) {
        const trig = await js(triggerCenter);
        if (trig) await clickAt(trig.x, trig.y);
        await sleep(600);
        const opt = await js(layoutOptCenter(label));
        if (!opt) return false;
        await clickAt(opt.x, opt.y);
        await sleep(1000);
        const trig2 = await js(triggerCenter);
        if (trig2) await clickAt(trig2.x, trig2.y);
        await sleep(600);
        return true;
    }

    // Đo toàn bộ hình học của thẻ đầu tiên (số tương đối so với đỉnh thẻ).
    async function measure(tag) {
        const m = await js(`(function () {
            const card = document.querySelector('.mod-item');
            if (!card) return null;
            const cs = getComputedStyle(card);
            const cr = card.getBoundingClientRect();
            const rel = (el) => {
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { top: +(r.top - cr.top).toFixed(1), bottom: +(r.bottom - cr.top).toFixed(1), height: +r.height.toFixed(1), width: +r.width.toFixed(1) };
            };
            const desc = card.querySelector('#mod-item-description');
            let descFirst = null;
            if (desc && desc.firstChild) {
                const range = document.createRange();
                range.selectNodeContents(desc);
                const rects = range.getClientRects();
                if (rects.length > 0) {
                    const r0 = rects[0];
                    descFirst = { top: +(r0.top - cr.top).toFixed(1), bottom: +(r0.bottom - cr.top).toFixed(1), height: +r0.height.toFixed(1) };
                }
            }
            const borderTop = parseFloat(cs.borderTopWidth) || 0;
            const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
            return {
                layout: card.getAttribute('data-layout'),
                clicked: card.getAttribute('clicked'),
                cardH: +cr.height.toFixed(1), cardW: +cr.width.toFixed(1),
                borderTop, borderBottom,
                contentBottom: +(cr.height - borderBottom).toFixed(1),
                image: rel(card.querySelector('div[slot="image"]')),
                headline: rel(card.querySelector('#mod-item-headline')),
                text: rel(card.querySelector('#mod-item-text')),
                size: rel(card.querySelector('.mod-item-size')),
                scroll: rel(card.querySelector('s-scroll-view')),
                desc: rel(desc),
                descFirst,
            };
        })()`);
        console.log('GEO ' + tag + ': ' + JSON.stringify(m));
        return m;
    }

    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n === 7 && !prog;
    }, 60000, 'load done (7 cards)');
    if (!loaded) return finish(1, 'khong tai xong');
    await sleep(8000);

    const startLayout = await js(`document.querySelector('.mod-item').getAttribute('data-layout')`);
    console.log('START LAYOUT: ' + startLayout);
    if (startLayout !== 'horizontal') await switchLayout('Horizontal');
    await sleep(500);

    // Ngang: trạng thái lúc mở (chưa biết chọn hay chưa) rồi bấm để đổi trạng thái.
    await measure('H as-loaded');
    const c1 = await js(`(function () {
        const c = document.querySelector('.mod-item');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (c1) await clickAt(c1.x, c1.y);
    await measure('H after-click');

    // Dọc: tương tự.
    await switchLayout('Vertical');
    await sleep(500);
    await measure('V as-loaded');
    const c2 = await js(`(function () {
        const c = document.querySelector('.mod-item');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (c2) await clickAt(c2.x, c2.y);
    await measure('V after-click');

    finish(0, 'geometry done');
}
