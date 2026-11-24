// Kiểm + chụp 2 thử nghiệm nút Apply (Đạt 24/11):
//   A: nút đổi màu cam hẳn khi chưa áp (không nhấp nháy).
//   B: badge số góc nút khi chưa áp (không nhấp nháy).
// Chạy: electron shot-applyvariants.js <A|B>
// Cách tạo trạng thái chưa áp: bấm 1 thẻ mod để chọn nó (lựa chọn
// lệch với tập đang áp) → nút Apply phải có class has-unapplied.
// Ảnh: shot-applyvar-<A|B>-full.png; in APPLYRECT để crop phóng to.
// Fixture: /tmp/xxmm-shot-grid48/userdata (46 mod, đã dựng từ trước).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const VARIANT = process.argv.includes('B') ? 'B' : 'A'; // cờ electron lọt vào argv nên không đọc argv[2]
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
    async function measureApply() {
        return js(`(function () {
            const btn = document.querySelector('#apply-button');
            if (!btn) return null;
            const cs = getComputedStyle(btn);
            const r = btn.getBoundingClientRect();
            const badge = document.querySelector('.apply-badge');
            let badgeRect = null;
            if (badge) {
                const br = badge.getBoundingClientRect();
                badgeRect = { x: Math.round(br.left), y: Math.round(br.top), w: Math.round(br.width), h: Math.round(br.height), right: Math.round(br.right), bottom: Math.round(br.bottom) };
            }
            return {
                hasUnapplied: btn.classList.contains('has-unapplied'),
                bgColor: cs.backgroundColor,
                animName: cs.animationName,
                rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) },
                badgeText: badge ? badge.textContent : null,
                badgeRect: badgeRect,
            };
        })()`);
    }

    // Đợi tải xong: có thẻ mod + khối tiến độ biến mất.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && !prog;
    }, 60000, 'load done');
    check('V0 tai xong', !!loaded);
    if (!loaded) return finish(1, 'khong tai xong');
    await sleep(8000); // đợi thông báo biến mất

    // Bấm thẻ mod đầu tiên để tạo thay đổi chưa áp.
    const c1 = await js(`(function () {
        const card = document.querySelector('.mod-item');
        if (!card) return null;
        card.scrollIntoView({ block: 'center' });
        const r = card.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (c1) {
        await clickAt(c1.x, c1.y);
    } else {
        check('V1 bam the mod', false, 'khong thay the');
        return finish(1, 'khong thay the mod');
    }
    const unapplied = await waitFor(async () => {
        const m = await measureApply();
        return m && m.hasUnapplied ? m : null;
    }, 15000, 'has-unapplied');
    check('V1 nut co has-unapplied sau khi chon mod', !!unapplied);
    if (!unapplied) return finish(1, 'nut khong chuyen trang thai');

    const m = await measureApply();
    console.log('APPLY: ' + JSON.stringify(m));
    check('V2 khong con nhap nhay vo han', m.animName === 'none' || m.animName === '', 'animation=' + m.animName);
    if (VARIANT === 'A') {
        check('V3-A nut mau cam #FF9800', m.bgColor === 'rgb(255, 152, 0)', m.bgColor);
    } else {
        check('V3-B co badge so', !!m.badgeText && /^\d+$/.test(m.badgeText.trim()), 'badge=' + m.badgeText);
        const cornerOk = !!m.badgeRect &&
            m.badgeRect.right >= m.rect.right - 4 && m.badgeRect.right <= m.rect.right + 24 &&
            m.badgeRect.y < m.rect.y && m.badgeRect.bottom > m.rect.y;
        check('V4-B badge nam goc tren-phai nut', cornerOk, m.badgeRect ? JSON.stringify(m.badgeRect) + ' vs nut ' + JSON.stringify(m.rect) : 'khong co badge');
        check('V5-B nut giu mau vang goc (khong cam)', m.bgColor !== 'rgb(255, 152, 0)', m.bgColor);
    }

    await mouseMoveTo(700, 400);
    await sleep(500);
    await shot('shot-applyvar-' + VARIANT + '-full.png');

    const passed = results.filter((r) => r.ok).length;
    finish(passed === results.length ? 0 : 1, 'shot-applyvariants ' + VARIANT + ' xong');
}
