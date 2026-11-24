// Chụp ảnh duyệt cho 1.5.26 (bản sạch, không toast, không tooltip):
//   1. shot-1526-loading2.png — đang tải mod lúc mở app (fixture 184 mod
//      để cửa sổ tải đủ dài, chụp đúng lúc dòng tiến độ đang hiện).
//   2. shot-1526-final.png — trạng thái xong: số liệu hàng trên + thanh dưới.
//   3. shot-1526-panel-clean.png — bảng nổi đang mở, chuột đã dời đi.
// Ngoài ra kiểm lại việc chọn 3 thẻ + Apply (vụ 2-vs-3 ở probe chính).
// Chạy: xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron
//   --no-sandbox --disable-gpu --ignore-certificate-errors
//   --user-data-dir=/tmp/xxmm-shot-grid200/userdata shot-1526.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = '/home/hatch/workspace/xxmm-test';
const TARGET = '/tmp/xxmm-shot-grid200/target';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let win = null;
let wc = null;
let observerInstalled = false;
let bootStarted = false;
let loadingShotDone = false;
let loadingShotText = '';

function finish(code, msg) {
    console.log('DONE ' + (msg || '') + ' code=' + code);
    setTimeout(() => { try { app.quit(); } catch (e) {} process.exit(code); }, 300);
}

async function shot(name) {
    const img = await win.capturePage();
    fs.writeFileSync(path.join(SHOT_DIR, name), img.toPNG());
    console.log('shot ' + name);
}

const INSTALL_OBSERVER = `(function () {
    if (window.__lpDone) return true;
    window.__lpDone = true;
    window.__lpValues = [];
    window.__lpInRight = [];
    const mo = new MutationObserver(() => {
        const el = document.querySelector('.apply-progress-text');
        if (el && el.textContent.trim()) {
            const v = el.textContent.trim();
            if (window.__lpValues[window.__lpValues.length - 1] !== v) {
                window.__lpValues.push(v);
                window.__lpInRight.push(!!el.closest('.bottom-right'));
            }
        }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    return true;
})()`;

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

    // 1. Đợi tải xong.
    const loaded = await waitFor(async () => {
        const n = await wc.executeJavaScript(`document.querySelectorAll('.mod-item').length`);
        const prog = await wc.executeJavaScript(`!!document.querySelector('.apply-progress')`);
        return (n > 0 && !prog) ? n : null;
    }, 60000, 'load done');
    console.log('LOADED cards=' + loaded);
    const lp = await wc.executeJavaScript(`window.__lpValues || []`);
    console.log('LOAD PROGRESS VALUES: ' + JSON.stringify(lp));
    console.log('LOADING SHOT TEXT: ' + JSON.stringify(loadingShotText));

    // 2. Đợi toast (s-snackbar) tan hết rồi mới chụp ảnh sạch.
    const noSnack = await waitFor(async () => {
        const n = await wc.executeJavaScript(`document.querySelectorAll('s-snackbar').length`);
        return n === 0 ? true : null;
    }, 25000, 'snackbars clear');
    console.log('SNACKBARS CLEAR: ' + !!noSnack);
    await sleep(500);

    // 3. Ảnh sạch: số liệu hàng trên + thanh dưới.
    await mouseMoveTo(640, 300);
    await sleep(600);
    await shot('shot-1526-final.png');

    // 4. Mở bảng nổi, dời chuột đi cho tooltip tắt, chụp.
    await realClickOn('#view-panel-trigger');
    await sleep(600);
    await mouseMoveTo(640, 300);
    await sleep(900);
    await shot('shot-1526-panel-clean.png');

    // 5. Đóng bảng, chọn 3 thẻ (kiểm từng thẻ có clicked="true"), Apply.
    await realClickOn('#view-panel-trigger');
    await sleep(600);
    const centers = await wc.executeJavaScript(`(function () {
        return [...document.querySelectorAll('.mod-item')].slice(0, 3).map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
    })()`);
    for (let i = 0; i < centers.length; i++) {
        await mouseClickAt(centers[i].x, centers[i].y);
        await sleep(400);
        const n = await wc.executeJavaScript(`document.querySelectorAll('.mod-item[clicked="true"]').length`);
        console.log('SELECTED AFTER CLICK ' + (i + 1) + ': ' + n);
    }
    await realClickOn('#apply-button');
    await waitFor(async () => {
        const prog = await wc.executeJavaScript(`!!document.querySelector('.apply-progress')`);
        return !prog ? true : null;
    }, 60000, 'apply done');
    await sleep(1000);
    const links = fs.readdirSync(TARGET);
    console.log('TARGET LINKS: ' + JSON.stringify(links));
    finish(0, 'shots done');
}

app.whenReady().then(() => {
    require('./electron/main.js');
    // Poller chụp đúng lúc dòng tiến độ đang hiện.
    const shotTimer = setInterval(async () => {
        if (loadingShotDone || !wc) return;
        let vis = false;
        let txt = '';
        try {
            const r = await wc.executeJavaScript(`(function () {
                const el = document.querySelector('.apply-progress');
                if (!el) return { vis: false, txt: '' };
                const b = el.getBoundingClientRect();
                const t = document.querySelector('.apply-progress-text');
                return { vis: b.width > 0 && b.height > 0, txt: t ? t.textContent.trim() : '' };
            })()`);
            vis = r.vis; txt = r.txt;
        } catch (e) { return; }
        if (loadingShotDone) return;
        if (vis) {
            loadingShotDone = true;
            loadingShotText = txt;
            try { await shot('shot-1526-loading2.png'); } catch (e) { console.log('loading shot failed: ' + e.message); }
            clearInterval(shotTimer);
        }
    }, 30);

    const bootTimer = setInterval(() => {
        if (bootStarted) return;
        const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
        if (wins.length === 0) return;
        win = wins[0];
        wc = win.webContents;
        if (!observerInstalled) {
            wc.executeJavaScript(INSTALL_OBSERVER).then((ok) => { if (ok) observerInstalled = true; }).catch(() => {});
        }
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
