// Chẩn đoán: hộp cảnh báo trùng mod mở (sự kiện show đã bắn, đọc được
// nội dung, bấm được nút) nhưng capturePage không thấy hộp. Kiểm tra
// trạng thái thật trong shadow DOM của s-dialog lúc hộp mở + chụp lại
// sau 2s để phân biệt lỗi hiển thị thật với lỗi của capturePage.
// Chuẩn bị: config showConflictWarning=true trên đĩa (probe tự đặt).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';

let done = false;
function finish(code, msg) {
    if (done) return;
    done = true;
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}
setTimeout(() => finish(1, 'HARD TIMEOUT'), 300000);

// Bật công tắc trên đĩa trước khi boot (lần chạy trước đã tắt nó).
const cfgPath = '/tmp/xxmm-shot-tags6/userdata/config.json';
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
cfg.showConflictWarning = true;
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 4));
console.log('showConflictWarning=true on disk');

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
    try {
        const cards = await js(`document.querySelectorAll('.mod-item').length`);
        console.log('cards=' + cards);
        await js(`(function () {
            const d = document.getElementById('dialog-confirm-conflict');
            window.__shown = false;
            d.addEventListener('show', () => { window.__shown = true; });
            d.addEventListener('dismiss', () => { window.__shown = false; });
            return true;
        })()`);
        // Đảm bảo cả 2 mod trùng được chọn (preset khôi phục có thể đã chọn sẵn).
        const clicked = async (name) => js(`(function () {
            const c = document.querySelector('.mod-item[name=${JSON.stringify(name)}]');
            return c ? c.getAttribute('clicked') : 'missing';
        })()`);
        const rect = async (name) => js(`(function () {
            const c = document.querySelector('.mod-item[name=${JSON.stringify(name)}]');
            if (!c) return null;
            c.scrollIntoView({ block: 'center' });
            const r = c.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        const clickAt = async (x, y) => {
            wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
            wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
            await sleep(350);
        };
        for (const name of ['Anby Bikini', 'Ellen Charm']) {
            if ((await clicked(name)) !== 'true') {
                const r = await rect(name);
                await clickAt(r.x, r.y);
            }
        }
        await sleep(500);
        console.log('selected: anby=' + (await clicked('Anby Bikini'))
            + ' ellen=' + (await clicked('Ellen Charm')));
        const applyRect = await js(`(function () {
            const b = document.getElementById('apply-button');
            const r = b.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        await clickAt(applyRect.x, applyRect.y);
        const t0 = Date.now();
        while (Date.now() - t0 < 8000) {
            if ((await js(`window.__shown === true`))) break;
            await sleep(400);
        }
        console.log('show event fired: ' + (await js(`window.__shown === true`)));
        const state = await js(`(function () {
            const d = document.getElementById('dialog-confirm-conflict');
            const sr = d.shadowRoot;
            const wrapper = sr.querySelector('.wrapper');
            const scrim = sr.querySelector('.scrim');
            const container = sr.querySelector('.container');
            const cr = container.getBoundingClientRect();
            const wr = wrapper.getBoundingClientRect();
            const cs = getComputedStyle(container);
            const ss = getComputedStyle(scrim);
            const hostR = d.getBoundingClientRect();
            const h1 = d.querySelector('h1');
            const h1R = h1 ? h1.getBoundingClientRect() : null;
            return {
                wrapperClass: wrapper.className,
                wrapperStyle: wrapper.getAttribute('style'),
                wrapperRect: { x: Math.round(wr.x), y: Math.round(wr.y), w: Math.round(wr.width), h: Math.round(wr.height) },
                containerRect: { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) },
                containerOpacity: cs.opacity, containerFilter: cs.filter, containerTop: cs.top,
                containerDisplay: cs.display, containerVisibility: cs.visibility,
                scrimOpacity: ss.opacity, scrimDisplay: ss.display,
                hostRect: { x: Math.round(hostR.x), y: Math.round(hostR.y), w: Math.round(hostR.width), h: Math.round(hostR.height) },
                h1Rect: h1R ? { x: Math.round(h1R.x), y: Math.round(h1R.y), w: Math.round(h1R.width), h: Math.round(h1R.height) } : null,
            };
        })()`);
        console.log('DIALOG STATE: ' + JSON.stringify(state, null, 1));
        const img1 = await win.capturePage();
        fs.writeFileSync(path.join(SHOTS, 'shot-test10-dialog-diag-0s.png'), img1.toPNG());
        await sleep(2000);
        console.log('still shown after 2s: ' + (await js(`window.__shown === true`)));
        const img2 = await win.capturePage();
        fs.writeFileSync(path.join(SHOTS, 'shot-test10-dialog-diag-2s.png'), img2.toPNG());
        console.log('shots saved');
    } catch (e) {
        console.log('DIAG ERROR: ' + (e && e.stack || e));
    }
    finish(0, 'diag done');
}, 500);
