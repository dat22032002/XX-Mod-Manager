// Đo hình học gốc (baseline) trước khi đổi Zone: khung lưới, cột trái,
// khung phải, thanh dưới, khung chứa — để đối chiếu sau khi đổi (viền
// OO-box 3px bỏ đi, bù +6px cũng bỏ theo).
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-48.py (46 mod).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-grid48/userdata probe-zone-baseline.js
const { app, BrowserWindow } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(1); }, 300000);
require('./electron/main.js');

const timer = setInterval(async () => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    const win = wins[0];
    if (win.webContents.isLoading()) return;
    clearInterval(timer);
    const wc = win.webContents;
    const js = (code) => wc.executeJavaScript(code);
    // Đợi tải xong.
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        if (n > 0 && !prog) break;
        await sleep(300);
    }
    await sleep(1200);
    const rects = await js(`(function () {
        const q = (s) => document.querySelector(s);
        const r = (el) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width),
                h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom),
                borderTop: cs.borderTopWidth, borderLeft: cs.borderLeftWidth,
                padTop: cs.paddingTop, padLeft: cs.paddingLeft, boxSizing: cs.boxSizing };
        };
        return {
            win: { w: window.innerWidth, h: window.innerHeight },
            head: r(q('.head')),
            mainContainer: r(q('.mod-section .main-container') || q('.main-container')),
            leftColumn: r(q('.left-column')),
            presetFrame: r(q('.left-menu')),
            charList: r(q('.character-list')),
            gridFrame: r(q('#mod-card-manager')),
            modContainer: r(q('#mod-container')),
            rightPanel: r(q('.mod-info-panel')),
            panelTop: r(q('.mod-panel-top')),
            panelBottom: r(q('.mod-panel-bottom')),
            bottom: r(q('.bottom')),
            bottomLeft: r(q('.bottom-left')),
            bottomRight: r(q('.bottom-right')),
            applyBtn: r(q('#apply-button')),
            refreshBtn: r(q('#refresh-button')),
            undoBtn: r(q('#undo-button')),
            sectionSelector: r(q('.head .slider-container')),
            firstCard: r(q('.mod-item')),
        };
    })()`);
    console.log(JSON.stringify(rects, null, 1));
    try { app.quit(); } catch {}
    setTimeout(() => process.exit(0), 800);
}, 50);
