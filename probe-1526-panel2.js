// Probe 1.5.26 — bảng tùy chọn hiển thị SỬA LẠI (Đạt sửa 23/11):
//  bảng chỉ thu/phóng theo CHIỀU NGANG, nằm gọn trong hàng thanh dưới,
//  KHÔNG trồi lên chạm khung thẻ mod; mở thì dài sang phải từ nút mở
//  bảng; đang tải mod / đang Apply thì dòng tiến độ vẫn thấy được
//  (bảng tự đóng khi tiến độ hiện).
//  P1. Bảng đóng lúc đầu (rộng 0, mờ).
//  P2. Mở: hình học — mép trên không chạm khung lưới; nằm gọn trong
//      thanh dưới; dài sang phải từ nút mở bảng; không đè nút Apply;
//      4 nút cùng 1 hàng ngang.
//  P3. Thu/phóng thật sự có hiệu ứng ngang (rộng tăng dần theo thời
//      gian + transition max-width trong CSS đã build).
//  P4–P6. 4 nút trong bảng vẫn hoạt động (Dọc/Ngang, zoom, ảnh gốc).
//  P7–P8. Bấm nút thì đóng; bấm ra ngoài thì đóng.
//  P9. Va chạm tải: bảng đang mở, bấm Refresh → bảng đóng + dòng
//      "Loading mod..." hiện và KHÔNG bị bảng che (hit-test).
//  P10. Va chạm áp: bảng đang mở, bấm Apply → bảng đóng + dòng
//       "Applying mod..." hiện và không bị che.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-48.py (46 mod).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-grid48/userdata probe-1526-panel2.js
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

const INSTALL_OBSERVER = `(function () {
    if (!document.documentElement) return false;
    if (window.__lpInstalled) return true;
    window.__lpInstalled = true;
    window.__lpValues = [];
    const record = () => {
        const el = document.querySelector('.apply-progress-text');
        if (!el) return;
        const t = (el.textContent || '').trim();
        if (!t) return;
        const arr = window.__lpValues;
        if (arr[arr.length - 1] !== t) arr.push(t);
    };
    new MutationObserver(record).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    record();
    return true;
})()`;

let win = null;
let wc = null;
let observerInstalled = false;
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

    async function clickAt(x, y, waitMs = 350) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        if (waitMs > 0) await sleep(waitMs);
    }
    async function waitFor(fn, timeoutMs, label) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            try {
                const v = await fn();
                if (v) return v;
            } catch (e) { /* thử lại */ }
            await sleep(200);
        }
        console.log('waitFor TIMEOUT: ' + label);
        return null;
    }
    const centerCode = (selector) => `(function () {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    async function clickEl(code) {
        const c = await js(code);
        if (!c) return false;
        await clickAt(c.x, c.y);
        return true;
    }
    const panelWidth = () => js(`(function () {
        const p = document.querySelector('.view-panel');
        return p ? p.getBoundingClientRect().width : -1;
    })()`);
    const panelRect = () => js(`(function () {
        const p = document.querySelector('.view-panel');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        const trig = document.querySelector('#view-panel-trigger').getBoundingClientRect();
        const grid = document.querySelector('#mod-card-manager').getBoundingClientRect();
        const bar = document.querySelector('.bottom').getBoundingClientRect();
        const apply = document.querySelector('#apply-button').getBoundingClientRect();
        const cap = document.querySelector('#layout-capsule').getBoundingClientRect();
        const sw = p.querySelector('s-switch').getBoundingClientRect();
        const zl = p.querySelector('.zoom-label').getBoundingClientRect();
        const fi = document.querySelector('#full-image-button').getBoundingClientRect();
        return { x: r.left, top: r.top, w: r.width, h: r.height, bottom: r.bottom, right: r.right,
            opacity: getComputedStyle(p).opacity,
            trigRight: trig.right, gridBottom: grid.bottom,
            barTop: bar.top, barBottom: bar.bottom, applyLeft: apply.left,
            cyCap: cap.top + cap.height / 2, cySw: sw.top + sw.height / 2,
            cyZl: zl.top + zl.height / 2, cyFi: fi.top + fi.height / 2 };
    })()`);

    // Đợi tải xong.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && !prog;
    }, 60000, 'load done');
    check('P0 tai xong (co the mod, het tien do)', !!loaded);
    await sleep(1200);

    // ---- P1. Bảng đóng lúc đầu ----
    const closed0 = await js(`(function () {
        const p = document.querySelector('.view-panel');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return { w: r.width, opacity: getComputedStyle(p).opacity };
    })()`);
    check('P1 bang dong luc dau (rong 0, mo)', !!closed0 && closed0.w <= 1 && closed0.opacity === '0', closed0 ? `w=${closed0.w} opacity=${closed0.opacity}` : 'khong thay bang');

    // ---- P3. Hiệu ứng thu/phóng ngang: lấy mẫu rộng theo thời gian ----
    const trigCenter = await js(centerCode('#view-panel-trigger'));
    await clickAt(trigCenter.x, trigCenter.y, 0);
    const w60 = await sleep(60).then(panelWidth);
    const w140 = await sleep(80).then(panelWidth);
    await sleep(400);
    const wFull = await panelWidth();
    const trans = await js(`getComputedStyle(document.querySelector('.view-panel')).transition`);
    check('P3a bang phong dan theo chieu ngang (rong tang theo thoi gian)', w60 < wFull && w140 <= wFull && wFull > 400, `w60=${w60} w140=${w140} wFull=${wFull}`);
    check('P3b CSS co transition max-width', /max-width/.test(trans), trans);

    // ---- P2. Hình học lúc mở ----
    const geo = await panelRect();
    check('P2a bang mo (rong > 400)', !!geo && geo.w > 400, geo ? `w=${geo.w}` : '');
    check('P2b mep tren bang khong cham khung the mod', !!geo && geo.top >= geo.gridBottom, geo ? `panelTop=${geo.top} gridBottom=${geo.gridBottom}` : '');
    check('P2c bang nam gon trong hang thanh duoi', !!geo && geo.top >= geo.barTop - 1 && geo.bottom <= geo.barBottom + 1, geo ? `panelTop=${geo.top} panelBottom=${geo.bottom} barTop=${geo.barTop} barBottom=${geo.barBottom}` : '');
    check('P2d bang dai sang phai tu nut mo bang', !!geo && geo.x >= geo.trigRight, geo ? `panelLeft=${geo.x} trigRight=${geo.trigRight}` : '');
    check('P2e bang khong de nut Apply', !!geo && geo.right < geo.applyLeft, geo ? `panelRight=${geo.right} applyLeft=${geo.applyLeft}` : '');
    check('P2f bang mo ngang (rong >> cao)', !!geo && geo.w > geo.h * 3 && geo.h < 60, geo ? `w=${geo.w} h=${geo.h}` : '');
    const cys = geo ? [geo.cyCap, geo.cySw, geo.cyZl, geo.cyFi] : [];
    const cySpread = cys.length ? Math.max(...cys) - Math.min(...cys) : 999;
    check('P2g 4 nut cung 1 hang ngang', cySpread < 20, `spread=${cySpread} cys=${cys.join(',')}`);
    await shot('shot-1526-panel2-open.png');

    // ---- P4–P6. 4 nút trong bảng vẫn hoạt động ----
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
    check('P4 doi Doc->Ngang trong bang duoc', layoutBefore === 'vertical' && layoutAfter === 'horizontal', `${layoutBefore} -> ${layoutAfter}`);
    await clickEl(`(function () {
        const el = document.querySelector('#layout-capsule .section-item[data-section="vertical"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await sleep(600);

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
    check('P5 zoom - trong bang lam % giam', !zoomOutDisabled && pct(zoomAfter) < pct(zoomBefore), `${zoomBefore} -> ${zoomAfter} (disabled=${zoomOutDisabled})`);

    const fi0 = await js(`document.querySelector('#full-image-button').classList.contains('active')`);
    await clickEl(centerCode('#full-image-button'));
    await sleep(400);
    const fi1 = await js(`document.querySelector('#full-image-button').classList.contains('active')`);
    check('P6 nut anh goc trong bang doi trang thai', fi1 !== fi0, `${fi0} -> ${fi1}`);
    await clickEl(centerCode('#full-image-button'));
    await sleep(400);

    // ---- P7. Bấm nút thì đóng ----
    await clickEl(centerCode('#view-panel-trigger'));
    await sleep(500);
    const wClosed1 = await panelWidth();
    check('P7 bam nut lan nua thi dong bang (rong 0)', wClosed1 <= 1, `w=${wClosed1}`);

    // ---- P8. Bấm ra ngoài thì đóng ----
    await clickEl(centerCode('#view-panel-trigger'));
    await sleep(500);
    const cardCenter = await js(`(function () {
        const c = document.querySelector('.mod-item');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (cardCenter) await clickAt(cardCenter.x, cardCenter.y);
    await sleep(500);
    const wClosed2 = await panelWidth();
    check('P8 bam ra ngoai (len the mod) thi dong bang', wClosed2 <= 1, `w=${wClosed2}`);

    // ---- P9. Va chạm tải: bảng đang mở, bấm Refresh ----
    // (Cú bấm vào Refresh đã là "bấm ra ngoài" nên bảng đóng ngay;
    //  watcher tiến độ là lưới an toàn cho đường tải không qua bấm.
    //  Kiểm điều người dùng thấy: bảng đóng + dòng tiến độ hiện và
    //  không bị bảng che.)
    await clickEl(centerCode('#view-panel-trigger'));
    await sleep(500);
    await js(`window.__lpValues = [];`);
    // Bấm Refresh rồi thăm dò NGAY (không ngủ sau cú bấm): tải 46 mod
    // xong rất nhanh, ngủ 350ms là lỡ mất cửa sổ tiến độ.
    const refCenter = await js(centerCode('#refresh-button'));
    await clickAt(refCenter.x, refCenter.y, 0);
    let hitOk = null;
    let sawProgress = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
        const st = await js(`(function () {
            const prog = document.querySelector('.apply-progress-text');
            const panel = document.querySelector('.view-panel');
            if (!prog) return { has: false };
            const r = prog.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { has: true, hitPanel: !!(el && el.closest('.view-panel')),
                panelW: panel ? panel.getBoundingClientRect().width : -1,
                text: prog.textContent.trim() };
        })()`);
        if (st && st.has) {
            sawProgress = true;
            // Bảng đóng có hiệu ứng 0,25s nên mẫu đầu có thể bắt trúng
            // lúc bảng đang co — chỉ chốt "tốt" khi có mẫu đạt, chốt
            // "chưa tốt" khi mẫu chưa đạt, đừng chốt ngay mẫu đầu.
            if (!st.hitPanel && st.panelW <= 1) { hitOk = true; break; }
            hitOk = false;
        }
        const stillLoading = await js(`!!document.querySelector('.apply-progress')`);
        if (sawProgress && !stillLoading) break;
        await sleep(50);
    }
    const refreshValues = await js(`window.__lpValues || []`);
    console.log('REFRESH PROGRESS VALUES: ' + JSON.stringify(refreshValues));
    const refreshSeen = refreshValues.some((v) => /^Loading mod \d+ of \d+\.\.\.$/.test(v));
    check('P9a bam Refresh luc bang mo thi tien do tai hien', refreshSeen, refreshValues.join(' | ') || 'khong thay');
    check('P9b dong tien do khong bi bang che (hit-test)', hitOk === true, `hitOk=${hitOk} sawProgress=${sawProgress}`);
    const loadDone2 = await waitFor(async () => {
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return !prog;
    }, 30000, 'refresh done');
    check('P9c tai xong sau Refresh', !!loadDone2);
    await sleep(800);

    // ---- P10. Va chạm áp: chọn thẻ, mở bảng, bấm Apply ----
    const cardCenters = await js(`(function () {
        const cards = [...document.querySelectorAll('.mod-item')].slice(0, 3);
        return cards.map((c) => {
            const r = c.getBoundingClientRect();
            const clicked = c.getAttribute('clicked') === 'true';
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), clicked };
        });
    })()`);
    if (cardCenters) {
        for (const cc of cardCenters) {
            if (!cc.clicked) { await clickAt(cc.x, cc.y); await sleep(200); }
        }
    }
    await sleep(500);
    await clickEl(centerCode('#view-panel-trigger'));
    await sleep(500);
    const panelOpenBeforeApply = await panelWidth();
    await js(`window.__lpValues = [];`);
    // Bấm Apply rồi thăm dò NGAY (áp 2 mod xong rất nhanh).
    const applyCenter = await js(centerCode('#apply-button'));
    await clickAt(applyCenter.x, applyCenter.y, 0);
    let hitOkApply = null;
    let sawApply = false;
    const t1 = Date.now();
    while (Date.now() - t1 < 20000) {
        const st = await js(`(function () {
            const prog = document.querySelector('.apply-progress-text');
            const panel = document.querySelector('.view-panel');
            if (!prog) return { has: false };
            const r = prog.getBoundingClientRect();
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { has: true, hitPanel: !!(el && el.closest('.view-panel')),
                panelW: panel ? panel.getBoundingClientRect().width : -1,
                text: prog.textContent.trim() };
        })()`);
        if (st && st.has && /^Applying mod/.test(st.text || '')) {
            sawApply = true;
            if (!st.hitPanel && st.panelW <= 1) { hitOkApply = true; break; }
            hitOkApply = false;
        }
        const stillApplying = await js(`!!document.querySelector('.apply-progress')`);
        if (sawApply && !stillApplying) break;
        await sleep(50);
    }
    const applyValues = await js(`window.__lpValues || []`);
    console.log('APPLY PROGRESS VALUES: ' + JSON.stringify(applyValues));
    const applySeen = applyValues.some((v) => /^Applying mod \d+ of \d+\.\.\.$/.test(v));
    check('P10a bang mo truoc khi bam Apply', panelOpenBeforeApply > 400, `w=${panelOpenBeforeApply}`);
    check('P10b Apply hien tien do "Applying mod..."', applySeen, applyValues.join(' | ') || 'khong thay');
    check('P10c dong tien do Apply khong bi bang che', hitOkApply === true, `hitOk=${hitOkApply} sawApply=${sawApply}`);
    const applyDoneGone = await waitFor(async () => {
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return !prog;
    }, 30000, 'apply done');
    check('P10d tien do Apply bien mat khi xong', !!applyDoneGone);

    await shot('shot-1526-panel2-closed.png');
    check('P11 khong co loi console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' || '));
    finish(results.every((r) => r.ok) ? 0 : 1, 'probe-1526-panel2 done');
}
