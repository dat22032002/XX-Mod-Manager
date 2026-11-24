// Probe 1.5.26: 4 việc.
//  A. Tiến độ tải mod lúc mở app: hiện "Loading mod X of 46..." ngay chỗ
//     thanh tiến độ lúc Apply (trong .bottom-right), tăng dần, biến mất
//     khi tải xong. Bằng chứng chính: MutationObserver ghi lại mọi dòng
//     chữ tiến độ (cài càng sớm càng tốt, trước khi tải xong).
//  B. Dòng thống kê VỀ LẠI CHỖ CŨ dưới lưới (Đạt dặn 23/11, sau khi
//     thử dời lên hàng trên ở test1): .bottom-center .mod-stats, giữa
//     thanh dưới; hàng trên không còn dòng thống kê.
//  C. Chevron (batch) + Refresh + Undo ở đầu trái thanh dưới; Apply vẫn
//     ở phải; nút mở bảng nằm bên phải nút Undo.
//  D. Bảng tùy chọn hiển thị: mở/đóng bằng nút, bấm ra ngoài thì đóng,
//     mở ngang TRONG hàng thanh dưới (4 nút xếp 1 hàng, dài sang phải
//     từ nút mở bảng, không chạm khung thẻ mod — Đạt sửa 23/11), 4 nút
//     trong bảng vẫn hoạt động (Dọc/Ngang, zoom, ảnh gốc).
//  E. Hồi quy: bảng batch vẫn mở được từ bên trái; Apply vẫn hiện tiến
//     độ "Applying mod..." rồi biến mất.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-48.py (46 mod,
// tiếng Anh, KHÔNG cache nên lần tải đầu là quét mới — chậm đủ để bắt).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-grid48/userdata probe-1526.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = '/tmp/xxmm-shot-grid48';
const TARGET = path.join(BASE, 'target');
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 900000; // 15 phút

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

// Ghi lại mọi dòng chữ tiến độ (.apply-progress-text) xuất hiện trong
// DOM — cài càng sớm càng tốt để bắt cả lần tải lúc mở app.
const INSTALL_OBSERVER = `(function () {
    if (!document.documentElement) return false;
    if (window.__lpInstalled) return true;
    window.__lpInstalled = true;
    window.__lpValues = [];
    window.__lpInBottomRight = null;
    const record = () => {
        const el = document.querySelector('.apply-progress-text');
        if (!el) return;
        const t = (el.textContent || '').trim();
        if (!t) return;
        const arr = window.__lpValues;
        if (arr[arr.length - 1] !== t) arr.push(t);
        if (window.__lpInBottomRight === null) {
            window.__lpInBottomRight = !!el.closest('.bottom-right');
        }
    };
    new MutationObserver(record).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    record();
    return true;
})()`;

let win = null;
let wc = null;
let observerInstalled = false;
let loadingShotDone = false;
let bootStarted = false;

async function shot(name) {
    try {
        const img = await win.capturePage();
        fs.writeFileSync(path.join(SHOTS, name), img.toPNG());
        console.log('shot ' + name);
    } catch (e) { console.log('shot failed ' + name + ': ' + e.message); }
}

// Săn ảnh lúc đang tải: quét mỗi 60ms, thấy khối tiến độ hiện thì chụp ngay.
const shotTimer = setInterval(async () => {
    if (loadingShotDone || !wc) return;
    let vis = false;
    try {
        vis = await wc.executeJavaScript(`(function () {
            const el = document.querySelector('.apply-progress');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        })()`);
    } catch (e) { return; }
    if (loadingShotDone) return; // một vòng khác đã chụp rồi
    if (vis) {
        loadingShotDone = true;
        await shot('shot-1526-loading.png');
    }
}, 60);

const bootTimer = setInterval(() => {
    if (bootStarted) return;
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    win = wins[0];
    wc = win.webContents;
    // Cài observer nền (không await — await trong này làm các vòng
    // hẹn giờ chồng lên nhau, main() chạy nhiều lần cùng lúc).
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
    const rectOf = async (code) => {
        const c = await js(code);
        return c || null;
    };
    async function clickEl(code) {
        const c = await rectOf(code);
        if (!c) return false;
        await clickAt(c.x, c.y);
        return true;
    }
    const centerCode = (selector) => `(function () {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;

    // Đợi tải xong: có thẻ mod + khối tiến độ biến mất.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && !prog;
    }, 60000, 'load done');
    check('A0 tai xong (co the mod, het tien do)', !!loaded);
    await sleep(1200);

    const startupValues = await js(`window.__lpValues || []`);
    const inBottomRight = await js(`window.__lpInBottomRight`);
    console.log('STARTUP PROGRESS VALUES: ' + JSON.stringify(startupValues));
    const loadRe = /^Loading mod (\d+) of (\d+)\.\.\.$/;
    const loadVals = startupValues.filter((v) => loadRe.test(v));
    check('A1 tien do tai hien luc mo app', loadVals.length > 0, loadVals.join(' | ') || 'khong thay');
    const dones = loadVals.map((v) => parseInt(loadRe.exec(v)[1], 10));
    const totals = loadVals.map((v) => parseInt(loadRe.exec(v)[2], 10));
    check('A2 tong so mod dung (46)', totals.length > 0 && totals.every((t) => t === 46), totals.join(','));
    check('A3 tien do tang dan', dones.length >= 2 && dones[dones.length - 1] > dones[0], dones.join(','));
    check('A4 tien do nam trong .bottom-right (cho Apply)', inBottomRight === true, String(inBottomRight));
    check('A5 anh dang tai chup duoc', loadingShotDone);

    // ---- B. Thống kê về lại chỗ cũ dưới lưới ----
    const stats = await js(`(function () {
        const el = document.querySelector('.bottom-center .mod-stats');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const bar = document.querySelector('.bottom');
        const br = bar ? bar.getBoundingClientRect() : null;
        const grid = document.querySelector('#mod-card-manager');
        const gr = grid ? grid.getBoundingClientRect() : null;
        const headStats = document.querySelector('.head .mod-stats');
        return { text: el.textContent.trim(), x: r.left, y: r.top, w: r.width, h: r.height,
            cy: r.top + r.height / 2, barTop: br ? br.top : null, barBottom: br ? br.bottom : null,
            gridBottom: gr ? gr.bottom : null, headStats: !!headStats };
    })()`);
    check('B1 dong thong ke o duoi luoi (.bottom-center)', !!stats, stats ? stats.text : 'khong thay');
    check('B2 so lieu dung (46 mod, 0 bat, 12 nhan vat)', !!stats && stats.text === '46 mods · 0 enabled · 12 characters', stats ? stats.text : '');
    check('B3 nam trong hang thanh duoi, duoi khung luoi', !!stats && stats.y >= stats.gridBottom && stats.cy >= stats.barTop && stats.cy <= stats.barBottom, stats ? `stats y=${stats.y} gridBottom=${stats.gridBottom} barTop=${stats.barTop} barBottom=${stats.barBottom}` : '');
    check('B4 hang tren khong con dong thong ke', !!stats && !stats.headStats, stats ? String(stats.headStats) : '');
    const bottomCenterGone = await js(`!!document.querySelector('.bottom-center')`);
    check('B5 co .bottom-center', bottomCenterGone);

    // ---- C. Nút dời sang trái ----
    const layout = await js(`(function () {
        const q = (s) => document.querySelector(s);
        const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, right: b.right, cy: b.top + b.height / 2 }; };
        const chev = [...document.querySelectorAll('.bottom-left s-icon-button')].find((b) => b.querySelector('s-icon[type="chevron_down"]'));
        const ref = q('#refresh-button');
        const undo = q('#undo-button');
        const trig = q('#view-panel-trigger');
        const apply = q('#apply-button');
        const bar = q('.bottom');
        const br = bar ? bar.getBoundingClientRect() : null;
        return {
            chev: r(chev), ref: r(ref), undo: r(undo), trig: r(trig), apply: r(apply),
            chevInLeft: !!(chev && chev.closest('.bottom-left')),
            refInLeft: !!(ref && ref.closest('.bottom-left')),
            undoInLeft: !!(undo && undo.closest('.bottom-left')),
            trigInLeft: !!(trig && trig.closest('.bottom-left')),
            applyInRight: !!(apply && apply.closest('.bottom-right')),
            barLeft: br ? br.left : null, barRight: br ? br.right : null,
        };
    })()`);
    check('C1 chevron/Refresh/Undo o .bottom-left', layout.chevInLeft && layout.refInLeft && layout.undoInLeft, JSON.stringify({ c: layout.chevInLeft, r: layout.refInLeft, u: layout.undoInLeft }));
    check('C2 thu tu trai-phai: chevron < Refresh < Undo', layout.chev && layout.ref && layout.undo && layout.chev.x < layout.ref.x && layout.ref.x < layout.undo.x, JSON.stringify({ c: layout.chev && layout.chev.x, r: layout.ref && layout.ref.x, u: layout.undo && layout.undo.x }));
    check('C3 nut mo bang nam ben phai nut Undo', layout.trig && layout.undo && layout.trig.x > layout.undo.right, JSON.stringify({ trigX: layout.trig && layout.trig.x, undoRight: layout.undo && layout.undo.right }));
    check('C4 nut Apply van o .bottom-right, sat mep phai', layout.applyInRight && layout.apply && (layout.barRight - layout.apply.right) < 60, JSON.stringify({ applyRight: layout.apply && layout.apply.right, barRight: layout.barRight }));

    // ---- D. Bảng tùy chọn hiển thị ----
    // Bảng đóng = co về rộng 0 (không còn display:none — 23/11 sửa:
    // bảng nằm trong luồng thanh dưới, thu/phóng bằng max-width).
    const panelHidden0 = await js(`(function () {
        const p = document.querySelector('.view-panel');
        return p && p.getBoundingClientRect().width <= 1;
    })()`);
    check('D0 bang dong luc dau (rong 0)', panelHidden0);
    const controlsInPanel = await js(`(function () {
        const p = document.querySelector('.view-panel');
        if (!p) return false;
        return !!p.querySelector('#layout-capsule') && !!p.querySelector('s-switch')
            && p.querySelectorAll('s-icon-button').length >= 2
            && !!p.querySelector('.zoom-label') && !!p.querySelector('#full-image-button');
    })()`);
    check('D1 du 4 nut trong bang', controlsInPanel);
    await clickEl(centerCode('#view-panel-trigger'));
    await sleep(500);
    const panelOpen = await js(`(function () {
        const p = document.querySelector('.view-panel');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        const trig = document.querySelector('#view-panel-trigger').getBoundingClientRect();
        const cap = document.querySelector('#layout-capsule').getBoundingClientRect();
        const sw = p.querySelector('s-switch').getBoundingClientRect();
        const zl = p.querySelector('.zoom-label').getBoundingClientRect();
        const fi = document.querySelector('#full-image-button').getBoundingClientRect();
        const grid = document.querySelector('#mod-card-manager').getBoundingClientRect();
        const bar = document.querySelector('.bottom').getBoundingClientRect();
        const apply = document.querySelector('#apply-button').getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height,
            top: r.top, bottom: r.bottom, right: r.right,
            trigRight: trig.right, trigTop: trig.top,
            gridBottom: grid.bottom, barTop: bar.top, barBottom: bar.bottom,
            applyLeft: apply.left,
            cyCap: cap.top + cap.height / 2, cySw: sw.top + sw.height / 2,
            cyZl: zl.top + zl.height / 2, cyFi: fi.top + fi.height / 2 };
    })()`);
    check('D2 bam nut mo thi bang mo', panelOpen && panelOpen.w > 400, panelOpen ? `w=${panelOpen.w}` : 'khong thay bang');
    check('D3 bang mo ngang (rong >> cao)', panelOpen && panelOpen.w > 400 && panelOpen.h < 120 && panelOpen.w > panelOpen.h * 3, panelOpen ? `w=${panelOpen.w} h=${panelOpen.h}` : '');
    const cys = panelOpen ? [panelOpen.cyCap, panelOpen.cySw, panelOpen.cyZl, panelOpen.cyFi] : [];
    const cySpread = cys.length ? Math.max(...cys) - Math.min(...cys) : 999;
    check('D4 4 nut cung 1 hang ngang', cySpread < 20, `spread=${cySpread} cys=${cys.join(',')}`);
    // Bảng nằm GỌN TRONG hàng thanh dưới (Đạt sửa 23/11): mép trên
    // không chạm khung lưới, mép trên/dưới nằm trong thanh dưới, bảng
    // dài sang phải từ nút mở bảng, không đè nút Apply.
    check('D5 bang khong cham khung the mod', panelOpen && panelOpen.top >= panelOpen.gridBottom, panelOpen ? `panelTop=${panelOpen.top} gridBottom=${panelOpen.gridBottom}` : '');
    check('D5b bang nam gon trong hang thanh duoi', panelOpen && panelOpen.top >= panelOpen.barTop - 1 && panelOpen.bottom <= panelOpen.barBottom + 1, panelOpen ? `panelTop=${panelOpen.top} panelBottom=${panelOpen.bottom} barTop=${panelOpen.barTop} barBottom=${panelOpen.barBottom}` : '');
    check('D5c bang dai sang phai tu nut mo bang', panelOpen && panelOpen.x >= panelOpen.trigRight && panelOpen.right > panelOpen.trigRight, panelOpen ? `panelLeft=${panelOpen.x} trigRight=${panelOpen.trigRight}` : '');
    check('D5d bang khong de nut Apply', panelOpen && panelOpen.right < panelOpen.applyLeft, panelOpen ? `panelRight=${panelOpen.right} applyLeft=${panelOpen.applyLeft}` : '');
    await shot('shot-1526-panel-open.png');

    // Đổi Dọc -> Ngang trong bảng.
    const layoutBefore = await js(`(function () {
        const a = document.querySelector('#layout-capsule .section-item.active');
        return a ? a.getAttribute('data-section') : null;
    })()`);
    await clickEl(`(function () {
        const el = document.querySelector('#layout-capsule .section-item[data-section="horizontal"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await sleep(600);
    const layoutAfter = await js(`(function () {
        const a = document.querySelector('#layout-capsule .section-item.active');
        return a ? a.getAttribute('data-section') : null;
    })()`);
    check('D6 doi Doc->Ngang trong bang duoc', layoutBefore === 'vertical' && layoutAfter === 'horizontal', `${layoutBefore} -> ${layoutAfter}`);
    // Đổi lại Ngang -> Dọc để app về trạng thái mặc định.
    await clickEl(`(function () {
        const el = document.querySelector('#layout-capsule .section-item[data-section="vertical"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await sleep(600);

    // Zoom - trong bảng: % giảm.
    const zoomBefore = await js(`(function () { const el = document.querySelector('.view-panel .zoom-label'); return el ? el.textContent.trim() : null; })()`);
    const zoomOutDisabled = await js(`(function () {
        const btns = [...document.querySelectorAll('.view-panel s-icon-button')];
        return btns.length > 0 && (btns[0].hasAttribute('disabled') || btns[0].disabled === true);
    })()`);
    if (!zoomOutDisabled) {
        await clickEl(`(function () {
            const btns = [...document.querySelectorAll('.view-panel s-icon-button')];
            if (btns.length === 0) return null;
            const r = btns[0].getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        await sleep(600);
    }
    const zoomAfter = await js(`(function () { const el = document.querySelector('.view-panel .zoom-label'); return el ? el.textContent.trim() : null; })()`);
    const pct = (s) => s ? parseInt(s, 10) : NaN;
    check('D7 zoom - trong bang lam % giam', !zoomOutDisabled && pct(zoomAfter) < pct(zoomBefore), `${zoomBefore} -> ${zoomAfter} (disabled=${zoomOutDisabled})`);

    // Ảnh gốc trong bảng: bật/tắt class active.
    const fi0 = await js(`document.querySelector('#full-image-button').classList.contains('active')`);
    await clickEl(centerCode('#full-image-button'));
    await sleep(400);
    const fi1 = await js(`document.querySelector('#full-image-button').classList.contains('active')`);
    check('D8 nut anh goc trong bang doi trang thai', fi1 !== fi0, `${fi0} -> ${fi1}`);
    await clickEl(centerCode('#full-image-button'));
    await sleep(400);

    // Bấm nút mở bảng lần nữa thì đóng (co về rộng 0).
    await clickEl(centerCode('#view-panel-trigger'));
    await sleep(500);
    const panelClosed1 = await js(`document.querySelector('.view-panel').getBoundingClientRect().width <= 1`);
    check('D9 bam nut lan nua thi dong bang', panelClosed1);
    // Mở lại rồi bấm ra ngoài (lên 1 thẻ mod) thì đóng.
    await clickEl(centerCode('#view-panel-trigger'));
    await sleep(400);
    const cardCenter = await js(`(function () {
        const c = document.querySelector('.mod-item');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (cardCenter) await clickAt(cardCenter.x, cardCenter.y);
    await sleep(500);
    const panelClosed2 = await js(`document.querySelector('.view-panel').getBoundingClientRect().width <= 1`);
    check('D10 bam ra ngoai thi dong bang', panelClosed2);

    // ---- E. Hồi quy: bảng batch vẫn mở được từ bên trái ----
    await clickEl(`(function () {
        const el = [...document.querySelectorAll('.bottom-left s-icon-button')].find((b) => b.querySelector('s-icon[type="chevron_down"]'));
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await sleep(800);
    const batchOpen = await js(`(function () {
        const p = document.querySelector('.bottom-left s-popup');
        if (!p || !p.shadowRoot) return false;
        return !!p.shadowRoot.querySelector('.wrapper.show');
    })()`);
    check('E1 bang batch mo duoc tu ben trai', batchOpen);
    // Đóng bảng batch bằng cách bấm ra ngoài (vùng kéo thả trên đầu, an toàn).
    await clickAt(400, 30);
    await sleep(500);
    const batchClosed = await js(`(function () {
        const p = document.querySelector('.bottom-left s-popup');
        if (!p || !p.shadowRoot) return true;
        return !p.shadowRoot.querySelector('.wrapper.show');
    })()`);
    check('E2 bang batch dong khi bam ra ngoai', batchClosed);

    // ---- F. Hồi quy: Apply vẫn hiện tiến độ rồi biến mất ----
    // Chọn thêm 2 thẻ nữa (đã chọn 1 thẻ ở bước D10).
    const cardCenters = await js(`(function () {
        const cards = [...document.querySelectorAll('.mod-item')].slice(0, 3);
        return cards.map((c) => {
            const r = c.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        });
    })()`);
    // Thẻ đầu đã chọn ở D10 (nếu còn chọn) — chỉ bấm 2 thẻ sau.
    if (cardCenters && cardCenters.length >= 3) {
        await clickAt(cardCenters[1].x, cardCenters[1].y);
        await clickAt(cardCenters[2].x, cardCenters[2].y);
    }
    await sleep(600);
    const selectedCount = await js(`document.querySelectorAll('.mod-item.selected, .mod-item.clicked').length`);
    await js(`window.__lpValues = [];`);
    await clickEl(centerCode('#apply-button'));
    const applyDoneGone = await waitFor(async () => {
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return !prog;
    }, 30000, 'apply done');
    await sleep(500);
    const applyValues = await js(`window.__lpValues || []`);
    console.log('APPLY PROGRESS VALUES: ' + JSON.stringify(applyValues));
    const applySeen = applyValues.some((v) => /^Applying mod \d+ of \d+\.\.\.$/.test(v));
    check('F1 Apply hien tien do "Applying mod..."', applySeen, applyValues.join(' | ') || 'khong thay');
    check('F2 tien do Apply bien mat khi xong', !!applyDoneGone);
    const targetHasLinks = fs.existsSync(TARGET) && fs.readdirSync(TARGET).length > 0;
    check('F3 Apply ghi lien ket vao thu muc dich', targetHasLinks);

    // ---- G. Làm mới: tiến độ tải hiện lại ----
    await js(`window.__lpValues = [];`);
    loadingShotDone = loadingShotDone; // giữ ảnh đã chụp (nếu có)
    await clickEl(centerCode('#refresh-button'));
    await sleep(4000);
    const refreshValues = await js(`window.__lpValues || []`);
    console.log('REFRESH PROGRESS VALUES: ' + JSON.stringify(refreshValues));
    const refreshSeen = refreshValues.some((v) => loadRe.test(v));
    check('G1 bam Refresh thi tien do tai hien lai', refreshSeen, refreshValues.join(' | ') || 'khong thay');

    await shot('shot-1526-bottom-bar.png');
    clearInterval(shotTimer);
    check('H1 khong co loi console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || '));
    finish(results.every((r) => r.ok) ? 0 : 1, 'probe-1526 done');
}
