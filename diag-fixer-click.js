// Chẩn đoán bấm nút Fixer: đo rect từng nút + elementFromPoint tại điểm
// bấm (xem click thật sẽ trúng cái gì) + bấm thử từng nút và ghi snack.
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata diag-fixer-click.js
const { app, BrowserWindow, ipcMain } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snacks = [];
ipcMain.on('snack', (_e, message) => {
    snacks.push(String(message));
    console.log('SNACK: ' + message);
});
let done = false;
function finish(code, msg) {
    if (done) return;
    done = true;
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}
setTimeout(() => finish(1, 'HARD TIMEOUT'), 180000);
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
    // Đo rect + elementFromPoint trong CÙNG 1 lần gọi (không scroll trước).
    const probeBtn = (label) => js(`(function () {
        const b = [...document.querySelectorAll('.fixer-block s-button')]
            .find((e) => e.textContent.trim() === ${JSON.stringify(label)});
        if (!b) return null;
        const r = b.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(cx, cy);
        return {
            label: ${JSON.stringify(label)},
            rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
            center: { x: cx, y: cy },
            hitTag: hit ? hit.tagName : null,
            hitText: hit ? (hit.textContent || '').trim().slice(0, 40) : null,
            hitIsButton: hit === b,
        };
    })()`);
    try {
        const s = await js(sectionRect('settings'));
        await clickAt(s.x, s.y);
        await sleep(800);
        const t = await js(tabRect('Mod Fixer'));
        await clickAt(t.x, t.y);
        await sleep(800);
        console.log('--- action buttons (no scroll) ---');
        for (const label of ['Check for updates', 'Download Fixer', 'Open Fixer', 'Scan for broken mods']) {
            console.log(JSON.stringify(await probeBtn(label)));
        }
        // Bấm Check, xem snack nào hiện (kỳ vọng: checkFailed do mạng VM).
        const before = snacks.length;
        const c = await probeBtn('Check for updates');
        await clickAt(c.center.x, c.center.y);
        await sleep(3000);
        console.log('snacks after Check click: ' + JSON.stringify(snacks.slice(before)));
        // Quét để hiện danh sách, rồi đo nút chọn/sửa.
        const sc = await probeBtn('Scan for broken mods');
        await clickAt(sc.center.x, sc.center.y);
        await sleep(8000);
        console.log('--- scan list buttons (no scroll) ---');
        for (const label of ['Select all', 'Deselect all', 'Fix selected mods']) {
            console.log(JSON.stringify(await probeBtn(label)));
        }
        // Bấm Deselect all, xem snack nào hiện (kỳ vọng: không có snack).
        const before2 = snacks.length;
        const d = await probeBtn('Deselect all');
        await clickAt(d.center.x, d.center.y);
        await sleep(2000);
        console.log('snacks after Deselect click: ' + JSON.stringify(snacks.slice(before2)));
    } catch (e) {
        console.log('DIAG EXCEPTION: ' + (e && e.stack || e));
    }
    finish(0, 'diag finished');
}, 500);
