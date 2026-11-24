// Chụp ảnh Zone đợt 1 để soi bằng mắt:
//  1. shot-zone-full.png — toàn màn hình lúc nghỉ.
//  2. shot-zone-selected.png — 1 thẻ chọn (viền nhấn), 1 thẻ batch (viền xanh),
//     1 thẻ cả hai (viền đỏ).
//  3. shot-zone-panel-open.png — bảng nổi đang mở.
//  4. shot-zone-filter-open.png — bảng lọc đang mở.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-48.py (46 mod).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-grid48/userdata shot-zone-phase1.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/home/hatch/workspace/xxmm-test';
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(1); }, 180000);
require('./electron/main.js');

const timer = setInterval(async () => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    const win = wins[0];
    if (win.webContents.isLoading()) return;
    clearInterval(timer);
    const wc = win.webContents;
    const js = (code) => wc.executeJavaScript(code);
    const shot = async (name) => {
        const img = await wc.capturePage();
        fs.writeFileSync(path.join(OUT, name), img.toPNG());
        console.log('shot:', name);
    };
    const clickAt = async (x, y, modifiers) => {
        const ev = { type: 'mouseDown', x, y, button: 'left', clickCount: 1 };
        if (modifiers) ev.modifiers = modifiers;
        wc.sendInputEvent(ev);
        wc.sendInputEvent({ ...ev, type: 'mouseUp' });
    };
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        if (n > 0 && !prog) break;
        await sleep(300);
    }
    await sleep(8000);
    // Dời chuột ra chỗ trống cho tooltip biến mất.
    wc.sendInputEvent({ type: 'mouseMove', x: 700, y: 30 });
    await sleep(500);
    await shot('shot-zone-full.png');

    // Chọn 3 thẻ: A (nhấn + batch = đỏ), B (batch xanh), C (chỉ nhấn).
    const centers = await js(`(function () {
        const cards = [...document.querySelectorAll('.mod-item')].slice(0, 3);
        return cards.map((el) => {
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        });
    })()`);
    await clickAt(centers[0].x, centers[0].y);
    await sleep(500);
    await clickAt(centers[1].x, centers[1].y, ['control']);
    await sleep(500);
    await clickAt(centers[0].x, centers[0].y, ['control']);
    await sleep(500);
    await clickAt(centers[2].x, centers[2].y);
    await sleep(500);
    wc.sendInputEvent({ type: 'mouseMove', x: 700, y: 30 });
    await sleep(500);
    await shot('shot-zone-selected.png');

    // Mở bảng nổi.
    const trig = await js(`(function () {
        const el = document.querySelector('#view-panel-trigger');
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await clickAt(trig.x, trig.y);
    await sleep(700);
    wc.sendInputEvent({ type: 'mouseMove', x: 700, y: 30 });
    await sleep(500);
    await shot('shot-zone-panel-open.png');

    // Đóng bảng nổi, mở bảng lọc.
    await clickAt(trig.x, trig.y);
    await sleep(600);
    const filter = await js(`(function () {
        const el = document.querySelector('#filter-toggle-chip');
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await clickAt(filter.x, filter.y);
    await sleep(700);
    // Rê chuột vào giữa bảng lọc để nó không đóng (đóng khi mouseleave).
    wc.sendInputEvent({ type: 'mouseMove', x: 120, y: 350 });
    await sleep(500);
    await shot('shot-zone-filter-open.png');

    try { app.quit(); } catch {}
    setTimeout(() => process.exit(0), 800);
}, 50);
