// Chụp ảnh duyệt cho bảng tùy chọn hiển thị SỬA LẠI (1.5.26, Đạt sửa 23/11):
//   1. shot-1526-panel2-closed.png — bảng đóng: thanh dưới gọn, chỉ còn nút mở bảng.
//   2. shot-1526-panel2-open.png — bảng mở: dài sang phải trong hàng thanh dưới,
//      không chạm khung thẻ mod. Chuột dời đi cho tooltip tắt, ảnh sạch.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-200.py (184 mod).
// Chạy: xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron
//   --no-sandbox --disable-gpu --ignore-certificate-errors
//   --user-data-dir=/tmp/xxmm-shot-grid200/userdata shot-1526-panel2.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = '/home/hatch/workspace/xxmm-test';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let win = null;
let wc = null;
let bootStarted = false;

function finish(code, msg) {
    console.log('DONE ' + (msg || '') + ' code=' + code);
    setTimeout(() => { try { app.quit(); } catch (e) {} process.exit(code); }, 300);
}

async function shot(name) {
    const img = await win.capturePage();
    fs.writeFileSync(path.join(SHOT_DIR, name), img.toPNG());
    console.log('shot ' + name);
}

async function mouseMoveTo(x, y) {
    wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
    await sleep(60);
}

async function mouseClickAt(x, y) {
    await mouseMoveTo(x, y);
    wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await sleep(60);
    wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
    await sleep(60);
}

async function realClickOn(sel) {
    const p = await wc.executeJavaScript(`(function () {
        const el = document.querySelector(${JSON.stringify(sel)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!p) throw new Error('khong thay ' + sel);
    await mouseClickAt(p.x, p.y);
}

async function waitFor(fn, timeoutMs, label) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        try { const r = await fn(); if (r) return r; } catch (e) { /* retry */ }
        await sleep(100);
    }
    console.log('waitFor TIMEOUT: ' + label);
    return null;
}

async function main() {
    await sleep(300);

    const loaded = await waitFor(async () => {
        const n = await wc.executeJavaScript(`document.querySelectorAll('.mod-item').length`);
        const prog = await wc.executeJavaScript(`!!document.querySelector('.apply-progress')`);
        return (n > 0 && !prog) ? n : null;
    }, 90000, 'load done');
    console.log('LOADED cards=' + loaded);

    // Đợi toast (s-snackbar) tan hết rồi mới chụp ảnh sạch.
    const noSnack = await waitFor(async () => {
        const n = await wc.executeJavaScript(`document.querySelectorAll('s-snackbar').length`);
        return n === 0 ? true : null;
    }, 25000, 'snackbars clear');
    console.log('SNACKBARS CLEAR: ' + !!noSnack);
    await sleep(500);

    // 1. Bảng đóng: chuột dời ra giữa lưới, chụp.
    await mouseMoveTo(640, 300);
    await sleep(900);
    await shot('shot-1526-panel2-closed.png');

    // 2. Mở bảng, đợi hiệu ứng mở xong, dời chuột đi cho tooltip tắt, chụp.
    await realClickOn('#view-panel-trigger');
    await sleep(700);
    const geo = await wc.executeJavaScript(`(function () {
        const p = document.querySelector('.view-panel');
        const r = p.getBoundingClientRect();
        const grid = document.querySelector('#mod-card-manager').getBoundingClientRect();
        const bar = document.querySelector('.bottom').getBoundingClientRect();
        return { panelTop: r.top, panelBottom: r.bottom, panelLeft: r.left, panelRight: r.right,
            panelW: r.width, panelH: r.height, gridBottom: grid.bottom, barTop: bar.top, barBottom: bar.bottom };
    })()`);
    console.log('PANEL GEO: ' + JSON.stringify(geo));
    await mouseMoveTo(640, 300);
    await sleep(900);
    await shot('shot-1526-panel2-open.png');

    finish(0, 'shots done');
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
        main().catch((e) => {
            console.log('MAIN ERROR: ' + (e && e.stack || e));
            finish(1, 'main crashed');
        });
    }, 50);
});

setTimeout(() => { console.log('GLOBAL TIMEOUT'); finish(1, 'global timeout'); }, 240000);
