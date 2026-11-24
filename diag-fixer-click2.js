// Chẩn đoán sâu: đếm nút trùng tên + xếp chồng phần tử tại điểm bấm.
const { app, BrowserWindow } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let done = false;
function finish(code, msg) {
    if (done) return;
    done = true;
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}
setTimeout(() => finish(1, 'HARD TIMEOUT'), 120000);
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
        await sleep(500);
    }
    const sectionRect = (sec) => `(function () {
        const el = document.querySelector('.section-item[data-section="${sec}"]');
        if (!el) return null;
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
    try {
        const s = await js(sectionRect('settings'));
        await clickAt(s.x, s.y);
        await sleep(800);
        const t = await js(tabRect('Mod Fixer'));
        await clickAt(t.x, t.y);
        await sleep(800);
        const dump = await js(`(function () {
            const out = {};
            out.fixerBlocks = document.querySelectorAll('.fixer-block').length;
            out.settingSections = document.querySelectorAll('.setting-content').length;
            out.allFixerButtons = [...document.querySelectorAll('.fixer-block s-button')].map((b) => {
                const r = b.getBoundingClientRect();
                return { text: b.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
            });
            // Xếp chồng phần tử tại tâm nút Check (374,255) và tâm nút Open (1171,255).
            out.stackAtCheck = document.elementsFromPoint(374, 255).map((e) => e.tagName + ':' + (e.className && e.className.baseVal !== undefined ? '' : (typeof e.className === 'string' ? e.className : '')) + ':' + (e.textContent || '').trim().slice(0, 20));
            out.stackAtOpen = document.elementsFromPoint(1171, 255).map((e) => e.tagName + ':' + (typeof e.className === 'string' ? e.className : '') + ':' + (e.textContent || '').trim().slice(0, 20));
            // Nút Download: hộp của nó + vị trí tính bằng offset.
            const dl = [...document.querySelectorAll('.fixer-block s-button')].find((e) => e.textContent.trim() === 'Download Fixer');
            if (dl) {
                const cs = getComputedStyle(dl);
                out.downloadStyle = { position: cs.position, width: cs.width, left: cs.left, right: cs.right, transform: cs.transform, display: cs.display };
                out.downloadOffset = { offsetLeft: dl.offsetLeft, offsetTop: dl.offsetTop, offsetWidth: dl.offsetWidth, offsetParent: dl.offsetParent ? dl.offsetParent.tagName + '.' + dl.offsetParent.className : null };
            }
            return out;
        })()`);
        console.log(JSON.stringify(dump, null, 1));
    } catch (e) {
        console.log('DIAG EXCEPTION: ' + (e && e.stack || e));
    }
    finish(0, 'diag2 finished');
}, 500);
