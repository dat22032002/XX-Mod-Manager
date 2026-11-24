// Chụp cột trái trên fixture tags6 (showChipCounts: true) để soi nhãn
// Tất cả/Đã chọn CÓ số đếm ("Selected (0)") — kiểm viên nhấn tight
// không lấn vào chữ khi nhãn dài thêm số đếm.
// Fixture: python3 ~/workspace/xxmm-test/seed-fixture-fixer.py (6 mod).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata shot-zone-tags6.js
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
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        if (n > 0 && !prog) break;
        await sleep(300);
    }
    await sleep(8000);
    wc.sendInputEvent({ type: 'mouseMove', x: 700, y: 30 });
    await sleep(500);
    const img = await wc.capturePage();
    fs.writeFileSync(path.join(OUT, 'shot-zone-tags6-full.png'), img.toPNG());
    console.log('shot: shot-zone-tags6-full.png');
    try { app.quit(); } catch {}
    setTimeout(() => process.exit(0), 800);
}, 50);
