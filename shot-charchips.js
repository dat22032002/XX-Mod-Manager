// Chụp ảnh thử nghiệm chấm bi trên hàng nhân vật cột trái (Đạt 24/11):
//   1. shot-charchips-full.png — mặc định, chưa chọn nhân vật nào (hàng tối).
//   2. shot-charchips-active.png — đã bấm chọn hàng đầu (hàng vàng, chấm
//      hiện rõ y hệt nút Apply).
// Kèm kiểm đo: ::before của hàng có đúng họa tiết gốc (radial-gradient,
// ô 10px, lệch 5px, chấm đen, độ mờ 0.18) ở cả hàng thường lẫn hàng
// đang chọn; bấm hàng vẫn lọc được như cũ.
// Fixture: /tmp/xxmm-shot-grid48/userdata (46 mod, đã dựng từ trước).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-grid48/userdata shot-charchips.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 600000;

const results = [];
function check(name, ok, detail) {
    results.push({ name, ok: !!ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
}

let done = false;
function finish(code, msg) {
    if (done) return;
    done = true;
    const passed = results.filter((r) => r.ok).length;
    console.log(`=== RESULT ${passed}/${results.length} passed ===`);
    const failed = results.filter((r) => !r.ok).map((r) => r.name);
    if (failed.length > 0) console.log('FAILED: ' + failed.join(', '));
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}

setTimeout(() => finish(1, 'HARD TIMEOUT'), HARD_TIMEOUT_MS);

require('./electron/main.js');

let win = null;
let wc = null;
let bootStarted = false;

async function shot(name) {
    try {
        const img = await win.capturePage();
        fs.writeFileSync(path.join(SHOTS, name), img.toPNG());
        console.log('shot ' + name);
    } catch (e) { console.log('shot failed ' + name + ': ' + e.message); }
}

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

async function main() {
    const js = (code) => wc.executeJavaScript(code);

    async function waitFor(fn, timeoutMs, label) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            try {
                const v = await fn();
                if (v) return v;
            } catch (e) { /* thử lại */ }
            await sleep(300);
        }
        console.log('waitFor TIMEOUT: ' + label);
        return null;
    }
    async function mouseMoveTo(x, y) {
        wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
        await sleep(120);
    }
    async function clickAt(x, y) {
        await mouseMoveTo(x, y);
        wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
        await sleep(60);
        wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
        await sleep(1000);
    }
    // Đo ::before của 1 hàng nhân vật (theo chỉ số).
    async function measureRow(i) {
        return js(`(function () {
            const rows = document.querySelectorAll('.character-row');
            const row = rows[${i}];
            if (!row) return null;
            const cs = getComputedStyle(row, '::before');
            const csRow = getComputedStyle(row);
            return {
                name: row.querySelector('.character-name') ? row.querySelector('.character-name').textContent : null,
                active: row.classList.contains('active'),
                bgImage: cs.backgroundImage,
                bgSize: cs.backgroundSize,
                bgPos: cs.backgroundPosition,
                opacity: cs.opacity,
                bgColor: csRow.backgroundColor,
            };
        })()`);
    }
    function checkPattern(m, tag) {
        check(tag + ' co hoa tiet radial-gradient', !!m && /radial-gradient/.test(m.bgImage || ''));
        check(tag + ' o luoi 10px + lech 5px', !!m && m.bgSize.split(',').every((s) => s.trim() === '10px 10px') && m.bgPos === '0px 0px, 5px 5px', m ? (m.bgSize + ' | ' + m.bgPos) : '');
        check(tag + ' cham den', !!m && /0,\s*0,\s*0/.test(m.bgImage || ''));
        check(tag + ' do mo 0.18', !!m && m.opacity === '0.18', m ? m.opacity : '');
    }

    // Đợi tải xong: có thẻ mod + khối tiến độ biến mất + có hàng nhân vật.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const rows = await js(`document.querySelectorAll('.character-row').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && rows > 0 && !prog;
    }, 60000, 'load done');
    check('C0 tai xong', !!loaded);
    if (!loaded) return finish(1, 'khong tai xong');
    const rowCount = await js(`document.querySelectorAll('.character-row').length`);
    console.log('ROWS: ' + rowCount);
    // Đợi thông báo biến mất để ảnh sạch.
    await sleep(8000);

    // Đo họa tiết ở hàng thường (chưa chọn).
    const beforePlain = await measureRow(0);
    console.log('BEFORE-PLAIN: ' + JSON.stringify(beforePlain));
    check('C1 hang dau chua chon (nen toi)', !!beforePlain && !beforePlain.active, beforePlain ? beforePlain.bgColor : '');
    checkPattern(beforePlain, 'C2 hang thuong');

    await mouseMoveTo(700, 770);
    await sleep(500);
    await shot('shot-charchips-full.png');

    // Bấm chọn hàng đầu tiên bằng chuột thật → hàng vàng lên.
    const c1 = await js(`(function () {
        const row = document.querySelector('.character-row');
        if (!row) return null;
        const r = row.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (c1) {
        await clickAt(c1.x, c1.y);
        await sleep(1200);
        const active = await js(`document.querySelector('.character-row').classList.contains('active')`);
        check('C6 bam chon hang dau tien', active === true, 'active=' + active);
    } else {
        check('C6 bam chon hang dau tien', false, 'khong thay hang');
    }
    // Đo lại họa tiết ở hàng đang chọn (nền vàng).
    const beforeActive = await measureRow(0);
    console.log('BEFORE-ACTIVE: ' + JSON.stringify(beforeActive));
    checkPattern(beforeActive, 'C7 hang dang chon');
    await mouseMoveTo(700, 770);
    await sleep(500);
    await shot('shot-charchips-active.png');

    const passed = results.filter((r) => r.ok).length;
    finish(passed === results.length ? 0 : 1, 'shot-charchips xong');
}
