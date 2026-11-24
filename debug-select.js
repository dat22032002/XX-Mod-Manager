// Chẩn đoán việc bấm thẻ mod: bấm 3 thẻ đầu, ghi lại tên + trạng thái
// clicked sau mỗi lần bấm (vụ Apply chỉ áp 2/3 mod ở probe 1.5.26).
// Chạy trên fixture grid48 (46 mod).
const { app, BrowserWindow } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let win = null, wc = null, bootStarted = false;
function finish(code, msg) {
    console.log('DONE ' + (msg || '') + ' code=' + code);
    setTimeout(() => { try { app.quit(); } catch (e) {} process.exit(code); }, 300);
}
async function mouseClickAt(x, y) {
    wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
    await sleep(60);
    wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await sleep(60);
    wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await sleep(60);
}
async function waitFor(fn, timeoutMs, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        try { const r = await fn(); if (r) return r; } catch (e) {}
        await sleep(100);
    }
    console.log('waitFor TIMEOUT: ' + label);
    return null;
}
async function cardList() {
    return await wc.executeJavaScript(`(function () {
        return [...document.querySelectorAll('.mod-item')].map((el, i) => {
            const r = el.getBoundingClientRect();
            const nameEl = el.querySelector('.mod-item-name');
            return { i, id: el.id, name: nameEl ? nameEl.textContent.trim() : '?',
                clicked: el.getAttribute('clicked'),
                x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        });
    })()`);
}
async function selectedNames() {
    return await wc.executeJavaScript(`(function () {
        return [...document.querySelectorAll('.mod-item[clicked="true"]')].map((el) => {
            const n = el.querySelector('.mod-item-name');
            return n ? n.textContent.trim() : el.id;
        });
    })()`);
}
async function main() {
    await sleep(300);
    await waitFor(async () => {
        const n = await wc.executeJavaScript(`document.querySelectorAll('.mod-item').length`);
        const prog = await wc.executeJavaScript(`!!document.querySelector('.apply-progress')`);
        return (n > 0 && !prog) ? n : null;
    }, 60000, 'load done');
    await sleep(1500);
    const cards = await cardList();
    console.log('CARDS RENDERED: ' + cards.length);
    cards.slice(0, 6).forEach((c) => console.log('CARD ' + JSON.stringify(c)));
    console.log('SELECTED AT START: ' + JSON.stringify(await selectedNames()));
    for (let i = 0; i < 3; i++) {
        const list = await cardList();
        const c = list[i];
        if (!c) { console.log('NO CARD ' + i); break; }
        const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
        const under = await wc.executeJavaScript(`(function () {
            const el = document.elementFromPoint(${cx}, ${cy});
            if (!el) return 'none';
            const card = el.closest ? el.closest('.mod-item') : null;
            return (el.tagName + '.' + (el.className && el.className.baseVal !== undefined ? '' : el.className)) + ' | inCard=' + (card ? (card.querySelector('.mod-item-name') || {}).textContent : 'no');
        })()`);
        console.log('CLICK ' + (i + 1) + ' on "' + c.name + '" at (' + Math.round(cx) + ',' + Math.round(cy) + ') under=' + under);
        await mouseClickAt(cx, cy);
        await sleep(600);
        console.log('SELECTED AFTER CLICK ' + (i + 1) + ': ' + JSON.stringify(await selectedNames()));
    }
    finish(0, 'debug done');
}
app.whenReady().then(() => {
    require('./electron/main.js');
    const bootTimer = setInterval(() => {
        if (bootStarted) return;
        const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
        if (wins.length === 0) return;
        win = wins[0];
        wc = win.webContents;
        if (wc.isLoading()) return;
        bootStarted = true;
        clearInterval(bootTimer);
        main().catch((e) => { console.log('MAIN ERROR: ' + (e && e.stack || e)); finish(1, 'main crashed'); });
    }, 50);
});
setTimeout(() => { console.log('GLOBAL TIMEOUT'); finish(1, 'global timeout'); }, 180000);
