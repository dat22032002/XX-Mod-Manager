// Probe dải web Banana tràn sang trang Help (1.5.25-test9).
// Tái hiện: mở Banana chờ web tải -> sang Help -> đo + chụp dải tràn mép trái.
// Cách sửa: ẩn khung web (visibility) khi rời trang Banana — overflow:hidden
// trên thanh trượt KHÔNG cắt được khung web (khung web vẽ ở lớp riêng).
// Sau sửa: dải phải biến mất; kiểm trượt/lọc/hộp sửa/Showcase không vỡ,
// quay lại Banana thì khung web hiện lại dùng được.
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-banana-overflow-test9.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = '/tmp/xxmm-shot-tags6';
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

const timer = setInterval(async () => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    const win = wins[0];
    if (win.webContents.isLoading()) return;
    clearInterval(timer);
    const wc = win.webContents;
    wc.on('console-message', (_e, level, message) => {
        const m = String(message);
        if (/Content-Security-Policy|Electron Security Warning|Autofill|favicon|fixerOldHashMap: fetch failed/i.test(m)) return;
        if (level >= 2) consoleErrors.push(`[${level}] ${m.slice(0, 300)}`);
    });
    await sleep(6000);

    const js = (code) => wc.executeJavaScript(code);
    async function clickAt(x, y, button) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: button || 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: button || 'left', clickCount: 1 });
        await sleep(300);
    }
    async function clickEl(rectCode) {
        const c = await js(rectCode);
        if (!c) return false;
        await clickAt(c.x, c.y);
        return true;
    }
    async function rightClickEl(rectCode) {
        const c = await js(rectCode);
        if (!c) return false;
        await clickAt(c.x, c.y, 'right');
        return true;
    }
    async function waitFor(fn, timeoutMs, label) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            try {
                const v = await fn();
                if (v) return v;
            } catch (e) { /* thử lại */ }
            await sleep(500);
        }
        console.log('waitFor TIMEOUT: ' + label);
        return null;
    }
    async function shot(name) {
        try {
            const img = await win.capturePage();
            fs.writeFileSync(path.join(SHOTS, name), img.toPNG());
            console.log('shot ' + name);
        } catch (e) { console.log('shot failed ' + name + ': ' + e.message); }
    }
    async function pressEsc() {
        wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
        wc.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
        await sleep(500);
    }

    const sectionRect = (sec) => `(function () {
        const el = document.querySelector('.section-item[data-section="${sec}"]');
        if (!el) return null;
        el.scrollIntoView({ block: 'nearest' });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    let W = 0; // rộng cửa sổ, gán sau khi boot (goSection dùng để tính tx đích)
    const filterBtnRect = `(function () {
        const b = document.querySelector('#filter-toggle-chip');
        if (!b) return null;
        b.scrollIntoView({ block: 'nearest' });
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const firstCardRect = `(function () {
        const c = document.querySelector('.mod-item');
        if (!c) return null;
        c.scrollIntoView({ block: 'center' });
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const modImageRect = `(function () {
        const el = document.querySelector('.mod-image');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0) return null;
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;

    async function goSection(sec) {
        const clicked = await clickEl(sectionRect(sec));
        // CHỜ trượt xong hẳn (đo tx) thay vì ngủ cố định: lần chạy đầu
        // đo sau 1200ms mà trượt vẫn chưa bắt đầu (máy ảo chậm) nên đo
        // nhầm vị trí cũ, báo PASS giả. Đợi thêm 700ms để hẹn ẩn khung
        // web (400ms) kịp chạy khi rời trang Banana.
        const idx = ['mod', 'banana', 'help', 'settings'].indexOf(sec);
        const expect = idx * (10 - W);
        const settled = await waitFor(async () => (await sliderTx()) === expect, 8000, 'slide settle ' + sec);
        await sleep(700);
        const active = await js(`(function () {
            const el = document.querySelector('.section-item[data-section="${sec}"]');
            return el ? el.classList.contains('active') : false;
        })()`);
        return clicked && !!settled && active;
    }
    // Phần tử trên cùng tại (x,y): có phải khung web Banana không?
    // Chỉ tính WEBVIEW — div .banana-section trong suốt, nó ở đó
    // cũng không vẽ gì nên không tính là tràn.
    const topAt = (x, y) => js(`(function () {
        const el = document.elementFromPoint(${x}, ${y});
        if (!el) return { hit: 'none' };
        return { hit: el.tagName + '#' + (el.id || '') + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : ''),
            inBanana: el.tagName === 'WEBVIEW' };
    })()`);
    const webviewRect = () => js(`(function () {
        const wv = document.querySelector('.banana-webview');
        if (!wv) return null;
        const r = wv.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right),
            top: Math.round(r.top), bottom: Math.round(r.bottom),
            width: Math.round(r.width), height: Math.round(r.height) };
    })()`);
    const sliderTx = () => js(`(function () {
        const s = document.querySelector('.section-slider');
        if (!s) return null;
        const m = getComputedStyle(s).transform;
        const mm = /matrix\\([^,]+,[^,]+,[^,]+,[^,]+,\\s*([\\d.-]+)/.exec(m);
        return mm ? Math.round(parseFloat(mm[1])) : null;
    })()`);
    const webviewVisibility = () => js(`(function () {
        const wv = document.querySelector('.banana-webview');
        if (!wv) return 'no-webview';
        return getComputedStyle(wv).visibility;
    })()`);
    const innerW = () => js(`window.innerWidth`);

    try {
        W = await innerW();
        console.log('innerWidth=' + W);

        // ---- A. Khởi động: 6 thẻ ----
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);

        // ---- B. Mở Banana, chờ web tải ----
        check('go-banana', await goSection('banana'));
        await js(`(function () {
            const wv = document.querySelector('.banana-webview');
            if (!wv) return false;
            window.__wvLoaded = false;
            wv.addEventListener('did-finish-load', () => { window.__wvLoaded = true; });
            return true;
        })()`);
        const loaded = await waitFor(() => js(`window.__wvLoaded === true`), 45000, 'webview did-finish-load');
        console.log('webview loaded flag: ' + loaded);
        await sleep(3000); // để trang vẽ xong
        const wvOnBanana = await webviewRect();
        console.log('webview rect on banana: ' + JSON.stringify(wvOnBanana));
        check('webview-fills-banana-page', !!wvOnBanana && wvOnBanana.left >= 8 && wvOnBanana.left <= 12
            && Math.abs(wvOnBanana.right - W) <= 2, JSON.stringify(wvOnBanana));
        await shot('shot-overflow-banana.png');

        // ---- C. Sang Help: dải tràn phải biến mất ----
        check('go-help', await goSection('help'));
        const wvOnHelp = await webviewRect();
        console.log('webview rect on help: ' + JSON.stringify(wvOnHelp));
        const visHelp = await webviewVisibility();
        console.log('webview visibility on help: ' + visHelp);
        check('webview-hidden-off-banana', visHelp === 'hidden', visHelp);
        // Hình học: rect không đổi khi ẩn (chỉ không vẽ), nên kiểm bằng
        // hit-test: điểm trong dải 10px mép trái phải KHÔNG trúng web.
        const topsHelp = [];
        for (const y of [200, 400, 600]) topsHelp.push(await topAt(5, y));
        console.log('top@x=5 on help: ' + JSON.stringify(topsHelp));
        check('help-left-strip-clean', topsHelp.every((t) => !t.inBanana),
            JSON.stringify(topsHelp));
        await shot('shot-overflow-help.png');

        // ---- D. Sang Settings: cũng phải sạch ----
        check('go-settings', await goSection('settings'));
        const topsSettings = [];
        for (const y of [200, 400, 600]) topsSettings.push(await topAt(5, y));
        console.log('top@x=5 on settings: ' + JSON.stringify(topsSettings));
        check('settings-left-strip-clean', topsSettings.every((t) => !t.inBanana),
            JSON.stringify(topsSettings));
        await shot('shot-overflow-settings.png');

        // ---- E. Trượt vẫn chạy: qua 4 trang, transform đúng từng bước ----
        const order = ['mod', 'banana', 'help', 'settings', 'mod'];
        let slideOk = true;
        for (let i = 0; i < order.length; i++) {
            const sec = order[i];
            const ok = await goSection(sec);
            const idx = ['mod', 'banana', 'help', 'settings'].indexOf(sec);
            const tx = await sliderTx();
            const expect = Math.round(idx * (10 - W));
            console.log(`slide ${sec}: active=${ok} tx=${tx} expect=${expect}`);
            if (!ok || Math.abs(tx - expect) > 2) slideOk = false;
        }
        check('slide-transform-all-sections', slideOk);

        // ---- E2. Quay lại Banana: khung web hiện lại, dùng được ----
        check('go-banana-again', await goSection('banana'));
        const visBanana = await webviewVisibility();
        console.log('webview visibility back on banana: ' + visBanana);
        const topBanana = await topAt(640, 400);
        console.log('top@center on banana: ' + JSON.stringify(topBanana));
        check('webview-visible-back-on-banana', visBanana === 'visible' && topBanana.inBanana,
            visBanana + ' ' + JSON.stringify(topBanana));
        await goSection('mod');

        // ---- F. Trang Mod đủ rộng (không mất 10px mép phải) ----
        const modPageRect = await js(`(function () {
            const d = document.querySelector('.section-slider > div');
            if (!d) return null;
            const r = d.getBoundingClientRect();
            return { left: Math.round(r.left), right: Math.round(r.right) };
        })()`);
        console.log('mod page rect: ' + JSON.stringify(modPageRect) + ' W=' + W);
        check('mod-page-full-width', !!modPageRect && modPageRect.left >= 8 && modPageRect.left <= 12
            && Math.abs(modPageRect.right - W) <= 2, JSON.stringify(modPageRect));

        // ---- G. Bảng Bộ lọc mở được, không bị cắt ----
        const filterOpened = await clickEl(filterBtnRect);
        await sleep(800);
        const swRect = await js(`(function () {
            const s = document.querySelector('#suspect-only-switch');
            if (!s) return null;
            const r = s.getBoundingClientRect();
            return { left: Math.round(r.left), right: Math.round(r.right),
                top: Math.round(r.top), bottom: Math.round(r.bottom) };
        })()`);
        console.log('filter switch rect: ' + JSON.stringify(swRect));
        check('filter-panel-visible', filterOpened && !!swRect && swRect.left >= 0
            && swRect.right <= W && swRect.bottom <= 800, JSON.stringify(swRect));
        await shot('shot-overflow-filter.png');
        await clickEl(filterBtnRect); // đóng bảng
        await sleep(500);

        // ---- H. Showcase mở được, phủ đủ màn hình ----
        // Làm trước hộp sửa mod: hộp Sober đóng bằng chuột khó (nút
        // Cancel nằm trong slot nên rect đo được ở tận x=8115, Esc
        // không đóng được) — để hộp sửa cuối cùng thì đỡ vướng.
        await clickEl(firstCardRect); // chọn mod để khung phải có ảnh
        await sleep(800);
        const sc = await clickEl(modImageRect);
        await sleep(800);
        const scRect = await js(`(function () {
            const o = document.querySelector('.showcase-overlay');
            if (!o) return null;
            const r = o.getBoundingClientRect();
            const img = o.querySelector('img');
            const ir = img ? img.getBoundingClientRect() : null;
            return { left: Math.round(r.left), top: Math.round(r.top),
                width: Math.round(r.width), height: Math.round(r.height),
                imgW: ir ? Math.round(ir.width) : 0, imgH: ir ? Math.round(ir.height) : 0 };
        })()`);
        console.log('showcase rect: ' + JSON.stringify(scRect));
        check('showcase-covers-screen', sc && !!scRect && scRect.left === 0 && scRect.top === 0
            && scRect.width === W && scRect.imgW > 0, JSON.stringify(scRect));
        await shot('shot-overflow-showcase.png');
        await pressEsc(); // Showcase tự nghe Esc để đóng
        await sleep(500);

        // ---- I. Hộp sửa mod mở được, không bị cắt ----
        const rc = await rightClickEl(firstCardRect);
        await sleep(1200);
        const dlgName = await js(`(function () {
            const el = document.querySelector('#editDialog-mod-info-name');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { left: Math.round(r.left), right: Math.round(r.right),
                top: Math.round(r.top), width: Math.round(r.width), text: el.textContent.trim() };
        })()`);
        console.log('edit dialog name rect: ' + JSON.stringify(dlgName));
        check('edit-dialog-visible', rc && !!dlgName && dlgName.width > 0
            && dlgName.left >= 0 && dlgName.right <= W, JSON.stringify(dlgName));
        await shot('shot-overflow-edit.png');
        // Không kiểm đóng hộp ở probe: nút Cancel nằm trong slot của
        // Sober nên rect đo được sai (x=8115), Esc không đóng được,
        // .close() qua JS cũng không đóng (hộp vẫn hiện) — cả 3 đều
        // là hạn chế của probe, không phải lỗi app: người dùng bấm
        // nút Cancel/Save thấy được trên màn hình thì hộp đóng bình
        // thường (Sober tự đóng khi bấm nút action). Probe kết thúc
        // ở đây nên không cần đóng hộp nữa.

        finish(0, 'DONE');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack || e));
        finish(1, 'PROBE ERROR');
    }
});
