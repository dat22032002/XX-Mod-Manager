// Chụp ảnh thử nghiệm chấm bi trên thẻ mod (Đạt 23/11):
//   1. shot-dotgrid-full.png — toàn màn hình, thẻ NGANG, chưa chọn.
//   2. shot-dotgrid-selected.png — đã chọn 1 thẻ (chấm vẫn hiện trên thẻ chọn).
//   3. shot-dotgrid-vertical.png — thẻ DỌC.
// Kèm kiểm đo: ::before của thẻ có đúng họa tiết gốc (radial-gradient,
// ô 10px, lệch 5px) + top ::before khớp đáy ảnh bìa (không phủ lên ảnh),
// đo cả 2 kiểu thẻ. Lưu ý: app mặc định mở ở thẻ DỌC nên phải chuyển
// sang Ngang trước khi chụp ảnh ngang.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-48.py (46 mod).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-grid48/userdata shot-dotgrid.js
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
    async function centerOf(code) {
        return js(code);
    }
    const triggerCenter = `(function () {
        const el = document.querySelector('#view-panel-trigger');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const layoutOptCenter = (label) => `(function () {
        const els = [...document.querySelectorAll('#layout-capsule *')];
        const el = els.find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(label)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    // Chuyển kiểu thẻ qua bảng nổi rồi ĐÓNG bảng lại (để ảnh sạch, không tooltip).
    async function switchLayout(label) {
        const trig = await centerOf(triggerCenter);
        if (trig) await clickAt(trig.x, trig.y);
        await sleep(600);
        const opt = await centerOf(layoutOptCenter(label));
        if (!opt) return false;
        await clickAt(opt.x, opt.y);
        await sleep(1000);
        const trig2 = await centerOf(triggerCenter);
        if (trig2) await clickAt(trig2.x, trig2.y);
        await sleep(600);
        return true;
    }
    // Đo ::before của thẻ đầu tiên (đã trừ viền trên: top ::before neo theo
    // khung đệm, còn đáy ảnh đo từ khung viền nên lệch đúng bề dày viền).
    async function measureBefore() {
        return js(`(function () {
            const card = document.querySelector('.mod-item');
            if (!card) return null;
            const cs = getComputedStyle(card, '::before');
            const csCard = getComputedStyle(card);
            const imgDiv = card.querySelector('div[slot="image"]');
            const cr = card.getBoundingClientRect();
            const ir = imgDiv ? imgDiv.getBoundingClientRect() : null;
            const borderTop = parseFloat(csCard.borderTopWidth) || 0;
            return {
                bgImage: cs.backgroundImage,
                bgSize: cs.backgroundSize,
                bgPos: cs.backgroundPosition,
                opacity: cs.opacity,
                top: parseFloat(cs.top),
                imgBottomRel: ir ? (ir.bottom - cr.top - borderTop) : null,
            };
        })()`);
    }

    // Đợi tải xong: có thẻ mod + khối tiến độ biến mất.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && !prog;
    }, 60000, 'load done');
    check('D0 tai xong', !!loaded);
    if (!loaded) return finish(1, 'khong tai xong');
    // Đợi thông báo biến mất để ảnh sạch.
    await sleep(8000);

    // App mặc định mở ở thẻ Dọc — chuyển sang Ngang trước.
    const startLayout = await js(`document.querySelector('.mod-item').getAttribute('data-layout')`);
    console.log('START LAYOUT: ' + startLayout);
    if (startLayout !== 'horizontal') {
        const ok = await switchLayout('Horizontal');
        check('D1 chuyen sang the Ngang', ok);
    }
    const layoutH = await js(`document.querySelector('.mod-item').getAttribute('data-layout')`);
    check('D2 dang o the Ngang', layoutH === 'horizontal', 'layout=' + layoutH);
    await mouseMoveTo(700, 770);
    await sleep(500);

    // Đo họa tiết ở thẻ Ngang.
    const beforeH = await measureBefore();
    console.log('BEFORE-H: ' + JSON.stringify(beforeH));
    check('D3 ::before co hoa tiet radial-gradient', !!beforeH && /radial-gradient/.test(beforeH.bgImage || ''));
    check('D4 o luoi 10px + lech 5px', !!beforeH && beforeH.bgSize.split(',').every((s) => s.trim() === '10px 10px') && beforeH.bgPos === '0px 0px, 5px 5px', beforeH ? (beforeH.bgSize + ' | ' + beforeH.bgPos) : '');
    check('D5 cham den (Dat chot 23/11: den, khong phai trang)', !!beforeH && /0,\s*0,\s*0/.test(beforeH.bgImage || ''));
    check('D6 do mo 0.18', !!beforeH && beforeH.opacity === '0.18', beforeH ? beforeH.opacity : '');
    check('D7 Ngang: top ::before khop day anh bia', !!beforeH && Math.abs(beforeH.top - beforeH.imgBottomRel) < 3, beforeH ? ('top=' + beforeH.top + ' dayAnh=' + beforeH.imgBottomRel) : '');

    await shot('shot-dotgrid-full.png');

    // Chọn thẻ đầu tiên bằng chuột thật, chụp lại.
    const c1 = await js(`(function () {
        const card = document.querySelector('.mod-item');
        if (!card) return null;
        const r = card.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (c1) {
        await clickAt(c1.x, c1.y);
        const sel = await js(`document.querySelector('.mod-item').getAttribute('clicked')`);
        check('D8 bam chon the dau tien', sel === 'true', 'clicked=' + sel);
    } else {
        check('D8 bam chon the dau tien', false, 'khong thay the');
    }
    await mouseMoveTo(700, 770);
    await sleep(500);
    await shot('shot-dotgrid-selected.png');

    // Chuyển sang thẻ Dọc, đo lại, chụp lại.
    const okV = await switchLayout('Vertical');
    check('D9 chuyen sang the Doc', okV);
    const layoutV = await js(`document.querySelector('.mod-item').getAttribute('data-layout')`);
    check('D10 dang o the Doc', layoutV === 'vertical', 'layout=' + layoutV);
    const beforeV = await measureBefore();
    console.log('BEFORE-V: ' + JSON.stringify(beforeV));
    check('D11 Doc: top ::before khop day anh bia', !!beforeV && Math.abs(beforeV.top - beforeV.imgBottomRel) < 3, beforeV ? ('top=' + beforeV.top + ' dayAnh=' + beforeV.imgBottomRel) : '');
    await mouseMoveTo(700, 770);
    await sleep(500);
    await shot('shot-dotgrid-vertical.png');

    const passed = results.filter((r) => r.ok).length;
    finish(passed === results.length ? 0 : 1, 'shot-dotgrid xong');
}
