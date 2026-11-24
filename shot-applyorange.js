// Kiểm + chụp hiệu ứng trôi cam-vàng của nút Apply lúc chưa áp
// (Đạt 24/11). Chạy: electron shot-applyorange.js
// Đo màu nền nút mỗi 250ms trong 5,5 giây sau khi bấm chọn 1 thẻ mod:
// phải thấy cả đầu cam (g thấp) lẫn đầu vàng (g cao), r luôn cao,
// b luôn thấp. Chụp 2 pha: cam (ngay sau khi bấm) + vàng (lúc đo được
// màu vàng thật). Ảnh: shot-applyorange-orange-full.png,
// shot-applyorange-yellow-full.png (in APPLYRECT để crop phóng to).
// Fixture: /tmp/xxmm-shot-grid48/userdata (46 mod, dựng lại 24/11).
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
    }
    function parseRgb(s) {
        const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s || '');
        return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    }
    async function measureApply() {
        const m = await js(`(function () {
            const btn = document.querySelector('#apply-button');
            if (!btn) return null;
            const cs = getComputedStyle(btn);
            const r = btn.getBoundingClientRect();
            return {
                hasUnapplied: btn.classList.contains('has-unapplied'),
                bgColor: cs.backgroundColor,
                animName: cs.animationName,
                rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
            };
        })()`);
        if (m) m.rgb = parseRgb(m.bgColor);
        return m;
    }

    // Đợi tải xong.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && !prog;
    }, 60000, 'load done');
    check('O0 tai xong', !!loaded);
    if (!loaded) return finish(1, 'khong tai xong');
    await sleep(8000);

    // Lúc chưa có thay đổi: không animation trôi cam.
    // (Tên keyframes trong style scoped của Vue bị gắn thêm hậu tố hash,
    // vd apply-orange-shift-f204a3e4, nên so bằng startsWith.)
    const before = await measureApply();
    check('O1 luc chua ap: khong co animation cam-vang', before && !before.hasUnapplied && before.animName === 'none', before ? 'unapplied=' + before.hasUnapplied + ' anim=' + before.animName + ' bg=' + before.bgColor : 'khong thay nut');

    // Bấm thẻ mod đầu tiên để tạo thay đổi chưa áp.
    const c1 = await js(`(function () {
        const card = document.querySelector('.mod-item');
        if (!card) return null;
        card.scrollIntoView({ block: 'center' });
        const r = card.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (!c1) {
        check('O2 bam the mod', false, 'khong thay the');
        return finish(1, 'khong thay the mod');
    }
    await clickAt(c1.x, c1.y);
    const unapplied = await waitFor(async () => {
        const m = await measureApply();
        return m && m.hasUnapplied ? m : null;
    }, 15000, 'has-unapplied');
    check('O2 nut co has-unapplied sau khi chon mod', !!unapplied);
    if (!unapplied) return finish(1, 'nut khong chuyen trang thai');

    // Chụp pha cam: đợi tới lúc đo được màu cam thật (g <= 170) rồi
    // ngủ thêm 400ms cho khung hình kịp vẽ theo (capturePage có thể
    // chụp khung hình cũ trước khi animation bắt đầu — lần chụp đầu
    // bị vậy: đo được rgb(255,152,0) mà ảnh ra màu vàng-xanh).
    await mouseMoveTo(700, 400);
    const orangePhase = await waitFor(async () => {
        const m = await measureApply();
        return m && m.rgb && m.rgb.g <= 170 ? m : null;
    }, 6000, 'pha cam');
    if (orangePhase) {
        await sleep(400);
        await shot('shot-applyorange-orange-full.png');
    } else {
        console.log('khong bat duoc pha cam');
    }

    const m0 = await measureApply();
    console.log('APPLY0: ' + JSON.stringify(m0));
    check('O3 animation la apply-orange-shift', m0.animName.startsWith('apply-orange-shift'), 'anim=' + m0.animName);

    // Lấy mẫu màu mỗi 250ms trong 5,5 giây (hơn 1 chu kỳ 5 giây).
    const samples = [];
    let yellowShot = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 5500) {
        const m = await measureApply();
        if (m && m.rgb) {
            samples.push(m.rgb);
            // Lúc đo được màu vàng thật thì ngủ 400ms cho khung hình kịp
            // vẽ theo rồi mới chụp pha vàng (tránh khung hình cũ).
            if (!yellowShot && m.rgb.g >= 205) {
                yellowShot = true;
                await sleep(400);
                await shot('shot-applyorange-yellow-full.png');
                console.log('YELLOW-SHOT at g=' + m.rgb.g);
            }
        }
        await sleep(250);
    }
    const gs = samples.map((s) => s.g);
    const rs = samples.map((s) => s.r);
    const bs = samples.map((s) => s.b);
    const minG = Math.min(...gs);
    const maxG = Math.max(...gs);
    console.log('SAMPLES n=' + samples.length + ' minG=' + minG + ' maxG=' + maxG + ' minR=' + Math.min(...rs) + ' maxB=' + Math.max(...bs));
    check('O4 toi duoc dau cam (g thap)', minG <= 175, 'minG=' + minG);
    check('O5 toi duoc dau vang (g cao)', maxG >= 200, 'maxG=' + maxG);
    check('O6 mau trôi that (bien do g >= 25)', maxG - minG >= 25, 'range=' + (maxG - minG));
    check('O7 mau luon trong dai cam-vang (r cao, b thap)', Math.min(...rs) >= 230 && Math.max(...bs) <= 40, 'minR=' + Math.min(...rs) + ' maxB=' + Math.max(...bs));
    check('O8 chup duoc pha vang', yellowShot, yellowShot ? '' : 'khong thay mau vang trong 5,5s');

    const passed = results.filter((r) => r.ok).length;
    finish(passed === results.length ? 0 : 1, 'shot-applyorange xong');
}
