// Thí nghiệm: dải (51,51,51) ở mép trái trang Help có phải khung web
// Banana không? Ẩn khung web bằng visibility rồi chụp lại xem dải có mất.
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata diag-overflow-visibility.js
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

require('./electron/main.js');

const timer = setInterval(async () => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    const win = wins[0];
    if (win.webContents.isLoading()) return;
    clearInterval(timer);
    const wc = win.webContents;
    await sleep(6000);

    const js = (code) => wc.executeJavaScript(code);
    async function clickAt(x, y) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        await sleep(100);
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
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const sliderTx = () => js(`(function () {
        const s = document.querySelector('.section-slider');
        const m = /matrix\\([^,]+,[^,]+,[^,]+,[^,]+,\\s*([\\d.-]+)/.exec(getComputedStyle(s).transform);
        return m ? Math.round(parseFloat(m[1])) : null;
    })()`);
    async function waitTxExpect(expect, timeoutMs) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            if (await sliderTx() === expect) return true;
            await sleep(200);
        }
        return false;
    }
    const topAt5 = () => js(`(function () {
        const el = document.elementFromPoint(5, 400);
        if (!el) return 'none';
        return el.tagName + '#' + (el.id || '') + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : '');
    })()`);

    try {
        const banana = await js(sectionRect('banana'));
        await clickAt(banana.x, banana.y);
        await sleep(1500);
        await js(`(function () {
            const wv = document.querySelector('.banana-webview');
            if (!wv) return false;
            window.__wvLoaded = false;
            wv.addEventListener('did-finish-load', () => { window.__wvLoaded = true; });
            return true;
        })()`);
        const t0 = Date.now();
        while (Date.now() - t0 < 45000) {
            if (await js(`window.__wvLoaded === true`)) break;
            await sleep(500);
        }
        console.log('webview loaded: ' + await js(`window.__wvLoaded === true`));
        await sleep(3000);

        // Sang Help, CHỜ trượt xong hẳn (tx = -2540) rồi mới đo.
        const help = await js(sectionRect('help'));
        await clickAt(help.x, help.y);
        const settled = await waitTxExpect(-2540, 8000);
        console.log('slider settled at help: ' + settled + ' tx=' + await sliderTx());
        await sleep(1000);
        console.log('top@x=5 help visible: ' + await topAt5());
        await shot('diag-vis-1-help.png');

        // Ẩn khung web, chụp lại.
        await js(`(function () {
            const wv = document.querySelector('.banana-webview');
            if (wv) wv.style.visibility = 'hidden';
            return !!wv;
        })()`);
        await sleep(1000);
        console.log('top@x=5 help hidden: ' + await topAt5());
        await shot('diag-vis-2-hidden.png');

        // Hiện lại, chụp lại.
        await js(`(function () {
            const wv = document.querySelector('.banana-webview');
            if (wv) wv.style.visibility = 'visible';
            return !!wv;
        })()`);
        await sleep(1000);
        console.log('top@x=5 help reshown: ' + await topAt5());
        await shot('diag-vis-3-reshown.png');
        finish(0, 'DONE');
    } catch (e) {
        console.log('DIAG ERROR: ' + (e && e.stack || e));
        finish(1, 'DIAG ERROR');
    }
});
