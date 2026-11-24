// Probe 1.5.26 (sửa 23/11): dòng thống kê VỀ LẠI CHỖ CŨ dưới lưới.
// Kiểm: .bottom-center .mod-stats hiện dưới lưới, số đúng (46 mod,
// 0 bật, 12 nhân vật), hàng trên không còn dòng thống kê, số "đang
// bật" đổi khi bấm chọn thẻ, bảng nổi mở thì dòng thống kê VẪN HIỆN
// (Đạt dặn 23/11: mở bảng mà số liệu biến mất là lỗi — sửa từ hành vi
// cũ "ẩn tạm"). Đo thêm: cửa sổ hẹp 1280 thì dòng số liệu bị cắt tới
// đâu, cửa sổ rộng 1920 thì hiện đủ chữ.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-48.py (46 mod).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-grid48/userdata probe-1526-statsback.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 900000;

const results = [];
const consoleErrors = [];
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
    if (consoleErrors.length > 0) {
        console.log('CONSOLE ERRORS (' + consoleErrors.length + '):');
        consoleErrors.slice(0, 20).forEach((e) => console.log('  ' + e));
    }
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
    wc.on('console-message', (_e, level, message) => {
        const m = String(message);
        if (/Content-Security-Policy|Electron Security Warning|Autofill|favicon|fixerOldHashMap: fetch failed|checkGameBananaUpdates failed|Timed out/i.test(m)) return;
        if (level >= 2) consoleErrors.push(`[${level}] ${m.slice(0, 300)}`);
    });

    async function clickAt(x, y) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        await sleep(350);
    }
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

    // Đợi tải xong: có thẻ mod + khối tiến độ biến mất.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && !prog;
    }, 60000, 'load done');
    check('load xong (co the mod, het tien do)', !!loaded);
    await sleep(1200);

    // ---- Hình học + nội dung dòng thống kê ----
    const geo = await js(`(function () {
        const el = document.querySelector('.bottom-center .mod-stats');
        const headStats = document.querySelector('.head .mod-stats');
        const bar = document.querySelector('.bottom');
        const br = bar ? bar.getBoundingClientRect() : null;
        const grid = document.querySelector('#mod-card-manager');
        const gr = grid ? grid.getBoundingClientRect() : null;
        const bc = document.querySelector('.bottom-center');
        const bcr = bc ? bc.getBoundingClientRect() : null;
        const bl = document.querySelector('.bottom-left');
        const blr = bl ? bl.getBoundingClientRect() : null;
        const bright = document.querySelector('.bottom-right');
        const brr = bright ? bright.getBoundingClientRect() : null;
        if (!el) return { exists: false, headStats: !!headStats };
        const r = el.getBoundingClientRect();
        return { exists: true, headStats: !!headStats, text: el.textContent.trim(),
            x: r.left, y: r.top, w: r.width, h: r.height, cy: r.top + r.height / 2,
            barTop: br ? br.top : null, barBottom: br ? br.bottom : null,
            gridBottom: gr ? gr.bottom : null,
            bcLeft: bcr ? bcr.left : null, bcRight: bcr ? bcr.right : null,
            blRight: blr ? blr.right : null, brLeft: brr ? brr.left : null };
    })()`);
    check('S1 co dong thong ke o .bottom-center', geo.exists, geo.text || '');
    check('S2 so lieu dung', geo.exists && geo.text === '46 mods · 0 enabled · 12 characters', geo.text || '');
    check('S3 hang tren khong con dong thong ke', geo.exists && !geo.headStats, String(geo.headStats));
    check('S4 nam duoi khung luoi', geo.exists && geo.y >= geo.gridBottom, `stats y=${geo.y} gridBottom=${geo.gridBottom}`);
    check('S5 nam trong hang thanh duoi', geo.exists && geo.cy >= geo.barTop && geo.cy <= geo.barBottom, `cy=${geo.cy} bar ${geo.barTop}-${geo.barBottom}`);
    check('S6 nam giua (sau nut trai, truoc nut Apply)', geo.exists && geo.x >= geo.blRight && (geo.x + geo.w) <= geo.brLeft, `stats ${geo.x}-${geo.x + geo.w} blRight=${geo.blRight} brLeft=${geo.brLeft}`);

    // ---- Số "đang bật" đổi khi bấm chọn 2 thẻ khác nhân vật ----
    const cardCenters = await js(`(function () {
        const cards = [...document.querySelectorAll('.mod-item')];
        const first = (el) => {
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        };
        const name = (el) => (el.textContent || '').trim().split(/\\s+/)[0];
        if (cards.length < 2) return null;
        const n0 = name(cards[0]);
        const other = cards.find((c) => name(c) !== n0);
        if (!other) return null;
        return { c0: first(cards[0]), c1: first(other), n0, n1: name(other) };
    })()`);
    check('S7 tim duoc 2 the khac nhan vat', !!cardCenters, cardCenters ? `${cardCenters.n0} / ${cardCenters.n1}` : '');
    if (cardCenters) {
        await clickAt(cardCenters.c0.x, cardCenters.c0.y);
        await clickAt(cardCenters.c1.x, cardCenters.c1.y);
        await sleep(800);
        const statsAfter = await js(`(document.querySelector('.mod-stats') || {}).textContent`);
        check('S8 bat 2 the -> 2 enabled', (statsAfter || '').trim() === '46 mods · 2 enabled · 12 characters', (statsAfter || '').trim());
        // Bỏ chọn lại để trạng thái sạch.
        await clickAt(cardCenters.c0.x, cardCenters.c0.y);
        await clickAt(cardCenters.c1.x, cardCenters.c1.y);
        await sleep(500);
    }

    // ---- Bảng nổi mở thì dòng thống kê VẪN HIỆN (Đạt dặn 23/11) ----
    // Đo thật độ cắt dở ở cửa sổ hẹp 1280 + độ đủ chữ ở cửa sổ rộng 1920.
    const trig = await js(`(function () {
        const el = document.querySelector('#view-panel-trigger');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    check('S9 co nut mo bang', !!trig);
    if (trig) {
        await clickAt(trig.x, trig.y);
        await sleep(600);
        const panelOpen = await js(`(function () {
            const p = document.querySelector('.view-panel');
            const el = document.querySelector('.bottom-center .mod-stats');
            if (!p || !el) return null;
            const pr = p.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            return { panelW: pr.width,
                statsVisible: r.width > 0 && r.height > 0,
                statsW: Math.round(r.width), scrollW: el.scrollWidth,
                clientW: el.clientWidth, text: el.textContent.trim() };
        })()`);
        check('S10 bang mo, thong ke VAN HIEN', !!panelOpen && panelOpen.panelW > 100 && panelOpen.statsVisible, panelOpen ? `panelW=${panelOpen.panelW} statsW=${panelOpen.statsW} scrollW=${panelOpen.scrollW} clientW=${panelOpen.clientW}` : '');
        // Đo độ cắt dở ở cửa sổ hẹp: chữ đầy đủ cần scrollW px, hộp chỉ
        // rộng clientW px. (Cắt dở là đánh đổi Đạt đã chấp nhận.)
        if (panelOpen) {
            const frac = panelOpen.scrollW > 0 ? Math.round(100 * panelOpen.clientW / panelOpen.scrollW) : 0;
            const chars = Math.round(panelOpen.text.length * panelOpen.clientW / panelOpen.scrollW);
            console.log(`MEASURE hep-1280: hien ${panelOpen.clientW}/${panelOpen.scrollW}px (~${frac}%, ~${chars}/${panelOpen.text.length} ky tu)`);
        }
        // Dời chuột ra chỗ trống để tooltip "View options" biến mất rồi mới chụp.
        wc.sendInputEvent({ type: 'mouseMove', x: 700, y: 30 });
        await sleep(500);
        await shot('shot-1526-statsback-panel-open.png');
        // Cửa sổ rộng 1920: bảng vẫn mở, dòng số liệu phải hiện đủ chữ.
        win.setSize(1920, 1000);
        await sleep(800);
        const wide = await js(`(function () {
            const el = document.querySelector('.bottom-center .mod-stats');
            const p = document.querySelector('.view-panel');
            if (!el || !p) return null;
            const r = el.getBoundingClientRect();
            return { panelW: Math.round(p.getBoundingClientRect().width),
                statsW: Math.round(r.width), scrollW: el.scrollWidth,
                clientW: el.clientWidth, text: el.textContent.trim() };
        })()`);
        check('S12 cua so rong 1920, bang mo, thong ke hien DU chu', !!wide && wide.panelW > 100 && wide.scrollW <= wide.clientW + 1, wide ? `statsW=${wide.statsW} scrollW=${wide.scrollW} clientW=${wide.clientW}` : '');
        if (wide) console.log(`MEASURE rong-1920: hien ${wide.clientW}/${wide.scrollW}px`);
        await shot('shot-1526-statsshow-wide.png');
        // Về lại 1280x800 rồi đóng bảng.
        win.setSize(1280, 800);
        await sleep(600);
        await clickAt(trig.x, trig.y);
        await sleep(600);
        const statsBack = await js(`(function () {
            const el = document.querySelector('.bottom-center .mod-stats');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { text: el.textContent.trim(), visible: r.width > 0 && r.height > 0 };
        })()`);
        check('S11 dong bang thi thong ke hien lai', !!statsBack && statsBack.visible && statsBack.text === '46 mods · 0 enabled · 12 characters', statsBack ? statsBack.text : '');
    }

    // Dời chuột ra chỗ trống để tooltip biến mất rồi mới chụp ảnh cuối.
    wc.sendInputEvent({ type: 'mouseMove', x: 700, y: 30 });
    await sleep(500);
    await shot('shot-1526-statsback.png');
    finish(results.every((r) => r.ok) ? 0 : 1, 'done');
}
