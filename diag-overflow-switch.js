// Chẩn đoán: sau khi đổi .section-slider sang overflow:hidden, bấm sang
// Help từ Banana thì chuyện gì xảy ra (probe test9 thấy ảnh chụp Help
// lại hiện trang Banana). Lấy mẫu trạng thái mỗi 250ms sau cú bấm.
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata diag-overflow-switch.js
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
    async function sample(label) {
        const s = await js(`(function () {
            const active = document.querySelector('.section-item.active');
            const slider = document.querySelector('.section-slider');
            const tm = slider ? getComputedStyle(slider).transform : '';
            const mm = /matrix\\([^,]+,[^,]+,[^,]+,[^,]+,\\s*([\\d.-]+)/.exec(tm);
            const wv = document.querySelector('.banana-webview');
            const wr = wv ? wv.getBoundingClientRect() : null;
            // Viên vàng trong nút Mod/Banana/Help/Settings: transform của nó.
            const pill = document.querySelector('.head .slider');
            const pt = pill ? getComputedStyle(pill).transform : '';
            return {
                activePill: active ? active.getAttribute('data-section') : 'none',
                sliderTx: mm ? Math.round(parseFloat(mm[1])) : null,
                webview: wr ? { left: Math.round(wr.left), right: Math.round(wr.right) } : null,
                pillTransform: pt,
            };
        })()`);
        console.log(label + ' ' + JSON.stringify(s));
        return s;
    }

    try {
        await sample('boot');
        // Sang Banana.
        const banana = await js(sectionRect('banana'));
        console.log('banana pill rect: ' + JSON.stringify(banana));
        await clickAt(banana.x, banana.y);
        await sleep(1500);
        await sample('after-banana-click');
        // Chờ web tải xong.
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
        await sample('banana-loaded');
        await shot('diag-overflow-banana.png');

        // Bấm Help, lấy mẫu liên tục 5 giây.
        const help = await js(sectionRect('help'));
        console.log('help pill rect: ' + JSON.stringify(help));
        // Hit-test tại điểm bấm TRƯỚC khi bấm: có gì đè lên nút Help không?
        const hitBefore = await js(`(function () {
            const el = document.elementFromPoint(${help.x}, ${help.y});
            if (!el) return 'none';
            return el.tagName + '#' + (el.id || '') + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : '');
        })()`);
        console.log('elementFromPoint at help pill before click: ' + hitBefore);
        await clickAt(help.x, help.y);
        for (let i = 0; i <= 20; i++) {
            await sample('help+'+(i * 250)+'ms');
            if (i === 4) await shot('diag-overflow-help-1s.png');
            if (i === 10) await shot('diag-overflow-help-2p5s.png');
            if (i === 20) await shot('diag-overflow-help-5s.png');
            await sleep(250);
        }
        finish(0, 'DONE');
    } catch (e) {
        console.log('DIAG ERROR: ' + (e && e.stack || e));
        finish(1, 'DIAG ERROR');
    }
});
