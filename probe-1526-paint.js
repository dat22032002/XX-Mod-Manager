// Kiểm tra dòng tiến độ có VẼ RA MÀN HÌNH thật không (không chỉ nằm trong
// DOM): chụp liên tục (burst) lúc tải lúc mở app và lúc Apply, rồi soi ảnh.
// Chạy trên fixture grid200 (184 mod). Cần dựng lại fixture trước:
//   python3 ~/workspace/xxmm-test/build-fixture-48.py
//   python3 ~/workspace/xxmm-test/build-fixture-200.py
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

// Đọc trạng thái dòng tiến độ trong DOM.
async function readProgress() {
    try {
        return await wc.executeJavaScript(`(function () {
            const el = document.querySelector('.apply-progress');
            if (!el) return { vis: false, txt: '' };
            const b = el.getBoundingClientRect();
            const t = document.querySelector('.apply-progress-text');
            return { vis: b.width > 0 && b.height > 0, txt: t ? t.textContent.trim() : '' };
        })()`);
    } catch (e) { return { vis: false, txt: '' }; }
}

// Chụp burst: đợi tiến độ xuất hiện (tối đa 5s), rồi chụp mỗi 150ms
// chừng nào còn hiện. Khung đầu có thể dính khung cũ (chụp đua với
// lần vẽ), khung sau (đã qua 1-2 lần vẽ) mới là bằng chứng mắt thấy.
async function burst(prefix, maxShots) {
    const t0 = Date.now();
    let seen = false;
    while (Date.now() - t0 < 5000) {
        const st = await readProgress();
        if (st.vis) { seen = true; break; }
        await sleep(30);
    }
    if (!seen) { console.log(prefix + ': no progress seen'); return 0; }
    let n = 0;
    while (n < maxShots) {
        const st = await readProgress();
        if (!st.vis) break;
        console.log(prefix + ' frame ' + n + ' text=' + JSON.stringify(st.txt));
        try { await shot(prefix + '-' + n + '.png'); } catch (e) { console.log('burst shot failed: ' + e.message); }
        n++;
        await sleep(150);
    }
    return n;
}

async function mouseClickAt(x, y) {
    wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
    await sleep(60);
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
        try { const r = await fn(); if (r) return r; } catch (e) {}
        await sleep(100);
    }
    console.log('waitFor TIMEOUT: ' + label);
    return null;
}

async function main() {
    await sleep(200);
    // Burst lúc tải (chạy song song với việc đợi tải xong).
    const loadBurst = burst('burst-load', 12);
    const loaded = await waitFor(async () => {
        const n = await wc.executeJavaScript(`document.querySelectorAll('.mod-item').length`);
        const prog = await wc.executeJavaScript(`!!document.querySelector('.apply-progress')`);
        return (n > 0 && !prog) ? n : null;
    }, 60000, 'load done');
    const nLoad = await loadBurst;
    console.log('LOAD BURST FRAMES: ' + nLoad + ' cards=' + loaded);
    await sleep(2000);

    // Chọn 2 mod khác nhân vật (thẻ 0 Alexandrina + thẻ 8 Anby) rồi Apply.
    const centers = await wc.executeJavaScript(`(function () {
        return [...document.querySelectorAll('.mod-item')].slice(0, 9).map((el) => {
            const r = el.getBoundingClientRect();
            const n = el.querySelector('.mod-item-name');
            return { name: n ? n.textContent.trim() : '?', x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
    })()`);
    console.log('CARDS: ' + JSON.stringify(centers.map((c) => c.name)));
    await mouseClickAt(centers[0].x, centers[0].y);
    await sleep(500);
    const sel = await wc.executeJavaScript(`[...document.querySelectorAll('.mod-item[clicked="true"]')].map((el) => (el.querySelector('.mod-item-name') || {}).textContent)`);
    console.log('SELECTED FOR APPLY: ' + JSON.stringify(sel));

    // Burst Apply: chạy burst TRƯỚC (nó tự đợi tiến độ xuất hiện),
    // rồi mới bấm Apply — poller đã trực sẵn nên bắt được ngay từ đầu.
    const applyBurstP = burst('burst-apply', 12);
    await realClickOn('#apply-button');
    const nApply = await applyBurstP;
    console.log('APPLY BURST FRAMES: ' + nApply);
    await waitFor(async () => {
        const prog = await wc.executeJavaScript(`!!document.querySelector('.apply-progress')`);
        return !prog ? true : null;
    }, 60000, 'apply done');
    finish(0, 'burst done');
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
setTimeout(() => { console.log('GLOBAL TIMEOUT'); finish(1, 'global timeout'); }, 240000);
