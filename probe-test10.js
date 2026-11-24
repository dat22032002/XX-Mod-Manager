// Probe bản thử 10 (1.5.25-test10): 4 việc.
//  A. Bỏ Switch Configuration / About / Test Plugin khỏi cột Cài đặt
//     (kể cả khi userdata/plugins vẫn còn file testPlugin.js giả lập).
//  B. (Đã tách ra probe-test10-firstload.js — nút First Load đặt
//     firstLoad=true trong bộ nhớ làm tắt app không lưu cấu hình plugin.)
//     Ở đây chỉ kiểm tab General còn mở được.
//  C. Mod Card Effect ĐÃ BỎ (Đạt chốt 16:12, sau probe này viết): mục
//     này chỉ còn kiểm lọc gỡ thẻ khỏi DOM (phần còn đúng). Rê chuột
//     đổi thẻ do probe-hover-recheck.js kiểm riêng.
//  D. Công tắc cảnh báo mod trùng nhau: mặc định TẮT -> Apply không hộp;
//     bật -> hộp hiện; để ON rồi thoát để probe-reopen kiểm nhớ lại.
//  E. Dải tràn Banana: ẩn TOÀN BỘ trang (kể cả thanh trên) khi rời trang
//     — quét TOÀN BỘ mép trái mọi độ cao (đặc biệt hàng thanh trên).
// Chuẩn bị fixture TRƯỚC khi chạy (fixture rebuild xóa userdata nên
// phải gieo testPlugin.js + ini trùng hash SAU khi rebuild):
//   python3 ~/workspace/xxmm-test/build-fixture-tags6.py
//   git show 9b51c48^:plugins/testPlugin.js > /tmp/xxmm-shot-tags6/userdata/plugins/testPlugin.js
//   (thêm mod.ini trùng hash deadbeef cho Anby Bikini + Ellen Charm)
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-test10.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = '/tmp/xxmm-shot-tags6';
const TARGET = path.join(BASE, 'target');
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 900000; // 15 phút

const results = [];
const consoleErrors = [];
const pluginLines = [];
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
    if (pluginLines.length > 0) {
        console.log('PLUGIN LINES:');
        pluginLines.forEach((l) => console.log('  ' + l));
    }
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
        if (/plugin/i.test(m)) pluginLines.push(`[${level}] ${m.slice(0, 300)}`);
        if (level >= 2) consoleErrors.push(`[${level}] ${m.slice(0, 300)}`);
    });
    await sleep(8000);

    const js = (code) => wc.executeJavaScript(code);
    await js(`(function () {
        const d = document.getElementById('dialog-confirm-conflict');
        if (!d) return false;
        window.__conflictShown = false;
        d.addEventListener('show', () => { window.__conflictShown = true; });
        d.addEventListener('closed', () => { window.__conflictShown = false; });
        d.addEventListener('dismiss', () => { window.__conflictShown = false; });
        d.addEventListener('close', () => { window.__conflictShown = false; });
        return true;
    })()`);
    async function clickAt(x, y) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        await sleep(350);
    }
    async function mouseMoveTo(x, y) {
        wc.sendInputEvent({ type: 'mouseMove', x, y });
        await sleep(150);
    }
    async function clickEl(rectCode) {
        const c = await js(rectCode);
        if (!c) return false;
        await clickAt(c.x, c.y);
        return true;
    }
    async function waitFor(fn, timeoutMs, label) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            try {
                const v = await fn();
                if (v) return v;
            } catch (e) { /* thử lại */ }
            await sleep(400);
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

    let W = 0;
    const sectionRect = (sec) => `(function () {
        const el = document.querySelector('.section-item[data-section="${sec}"]');
        if (!el) return null;
        el.scrollIntoView({ block: 'nearest' });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const tabRect = (label) => `(function () {
        const tab = [...document.querySelectorAll('.setting-container .left-menu .tab')].find((e) =>
            (e.querySelector('p') || {}).textContent.trim() === ${JSON.stringify(label)});
        if (!tab) return null;
        tab.scrollIntoView({ block: 'nearest' });
        const r = tab.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const sliderTx = () => js(`(function () {
        const s = document.querySelector('.section-slider');
        if (!s) return null;
        const m = getComputedStyle(s).transform;
        const mm = /matrix\\([^,]+,[^,]+,[^,]+,[^,]+,\\s*([\\d.-]+)/.exec(m);
        return mm ? Math.round(parseFloat(mm[1])) : null;
    })()`);
    async function goSection(sec) {
        const clicked = await clickEl(sectionRect(sec));
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
    // Công tắc trong 1 hàng settingBar (tìm theo tiêu đề h3): trạng thái +
    // tọa độ để bấm. settingBar boolean dùng s-switch.
    const switchState = (label) => js(`(function () {
        const bar = [...document.querySelectorAll('.setting-content .OO-setting-bar')].find((b) => {
            const h = b.querySelector('h3');
            return h && h.textContent.trim() === ${JSON.stringify(label)} && b.querySelector('s-switch');
        });
        if (!bar) return { found: false };
        const sw = bar.querySelector('s-switch');
        bar.scrollIntoView({ block: 'center' });
        const r = sw.getBoundingClientRect();
        return { found: true, checked: sw.hasAttribute('checked') || !!sw.checked,
            x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    async function clickSwitch(label) {
        const s = await switchState(label);
        if (!s.found) return false;
        await clickAt(s.x, s.y);
        return true;
    }
    const iconButtonRect = (label) => `(function () {
        const bar = [...document.querySelectorAll('.setting-content .OO-setting-bar')].find((b) => {
            const h = b.querySelector('h3');
            return h && h.textContent.trim() === ${JSON.stringify(label)};
        });
        if (!bar) return null;
        const btn = bar.querySelector('s-icon-button');
        if (!btn) return null;
        btn.scrollIntoView({ block: 'center' });
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const cardRectByName = (name) => `(function () {
        const c = document.querySelector('.mod-item[name=${JSON.stringify(name)}]');
        if (!c) return null;
        c.scrollIntoView({ block: 'center' });
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const cardClicked = (name) => js(`(function () {
        const c = document.querySelector('.mod-item[name=${JSON.stringify(name)}]');
        return c ? c.getAttribute('clicked') : 'missing';
    })()`);
    const modTitle = () => js(`(function () {
        const el = document.querySelector('.mod-title');
        return el ? el.textContent.trim() : 'missing';
    })()`);
    // Hộp thoại mở hay đóng: đo bằng SỰ KIỆN show/closed của Sober, không
    // đo rect (nội dung h1 vẫn có khung hình kể cả khi hộp đóng nên đo
    // rect báo nhầm là hộp đang mở — probe lần 1 fail oan 2 check).
    const dialogVisible = () => js(`window.__conflictShown === true`);
    const dialogText = () => js(`(function () {
        const d = document.getElementById('dialog-confirm-conflict');
        return d ? d.textContent.replace(/\\s+/g, ' ').slice(0, 600) : 'missing';
    })()`);
    const targetEntries = () => {
        try { return fs.readdirSync(TARGET).sort(); } catch { return []; }
    };
    const sectionVisibility = () => js(`(function () {
        const s = document.querySelector('.banana-section');
        return s ? getComputedStyle(s).visibility : 'missing';
    })()`);
    const webviewVisibility = () => js(`(function () {
        const wv = document.querySelector('.banana-webview');
        if (!wv) return 'no-webview';
        return getComputedStyle(wv).visibility;
    })()`);
    // Quét TOÀN BỘ mép trái: x = 2/5/9, y từ 55 tới 790 (đặc biệt hàng
    // thanh trên y~60-110). Điểm nào trúng phần tử trong .banana-section
    // là còn tràn.
    const leftEdgeSweep = () => js(`(function () {
        const bad = [];
        for (let y = 55; y <= 790; y += 25) {
            for (const x of [2, 5, 9]) {
                const el = document.elementFromPoint(x, y);
                if (el && el.closest && el.closest('.banana-section')) {
                    bad.push({ x, y, tag: el.tagName });
                }
            }
        }
        return bad;
    })()`);

    try {
        W = await js(`window.innerWidth`);
        console.log('innerWidth=' + W);

        // ---- A. Khởi động + cột Cài đặt đã bỏ 3 mục ----
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);
        check('go-settings', await goSection('settings'));
        const tabLabels = await js(`[...document.querySelectorAll('.setting-container .left-menu .tab p')]
            .map((e) => e.textContent.trim())`);
        console.log('settings tabs: ' + JSON.stringify(tabLabels));
        check('tab-no-switch-config', !tabLabels.includes('Switch Configuration'));
        check('tab-no-about', !tabLabels.includes('About'));
        check('tab-no-test-plugin', !tabLabels.includes('Test Plugin'));
        check('tab-no-card-effect', !tabLabels.includes('Mod Card Effect'));
        check('tab-keeps-plugin-tabs', tabLabels.includes('Plugin') && tabLabels.includes('Mod Fixer'),
            JSON.stringify(tabLabels));
        await shot('shot-test10-settings-tabs.png');
        // Bảng quản lý plugin cũng không còn Test Plugin.
        check('go-plugin-tab', await clickEl(tabRect('Plugin')));
        await sleep(800);
        const pluginRows = await js(`[...document.querySelectorAll('.setting-content .OO-setting-bar')]
            .map((r) => { const h = r.querySelector('h3'); const sw = r.querySelector('s-switch');
                return (h && sw) ? h.textContent.trim() : null; }).filter(Boolean)`);
        console.log('plugin rows: ' + JSON.stringify(pluginRows));
        check('plugin-list-no-test-plugin', !pluginRows.includes('Test Plugin')
            && !pluginRows.includes('Mod Card Effect') && pluginRows.length === 7, JSON.stringify(pluginRows));
        const skipped = pluginLines.some((l) => /testPlugin.*skipped/i.test(l));
        const loadedLine = pluginLines.find((l) => /plugins loaded/.test(l)) || '';
        console.log('loaded line: ' + loadedLine);
        check('testplugin-skipped-log', skipped, JSON.stringify(pluginLines.slice(0, 4)));
        check('plugins-loaded-7', /7 plugins loaded/.test(loadedLine), loadedLine);

        // ---- B. Trang chào lần đầu vẫn mở được ----
        check('go-general-tab', await clickEl(tabRect('General Settings')));
        await sleep(800);
        // Nút First Load KHÔNG bấm ở đây: onChange của nó đặt
        // firstLoad=true trong bộ nhớ, làm onbeforeunload bỏ qua bước
        // lưu khi tắt app -> cấu hình plugin (bật ở pha C) không được
        // lưu xuống đĩa, probe mở lại sẽ fail oan. First Load được
        // kiểm riêng ở probe-test10-firstload.js.

        // ---- C. Mod Card Effect ĐÃ BỎ (Đạt chốt 16:12) ----
        // Tab plugin đã kiểm vắng ở mục A; rê chuột đổi thẻ (~250ms,
        // hành vi có sẵn của app) do probe-hover-recheck.js kiểm riêng.
        // Chỉ còn kiểm lọc theo nhân vật: thẻ không khớp bị GỠ khỏi DOM
        // (không dùng class .hidden).
        check('go-mod-for-filter', await goSection('mod'));
        const anbyRowRect = await js(`(function () {
            const r = [...document.querySelectorAll('.character-row')].find((e) =>
                (e.querySelector('.character-name') || {}).textContent.trim() === 'Anby');
            if (!r) return null;
            r.scrollIntoView({ block: 'nearest' });
            const b = r.getBoundingClientRect();
            return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
        })()`);
        check('click-anby-row', !!anbyRowRect && (await clickAt(anbyRowRect.x, anbyRowRect.y), true));
        await sleep(1000);
        const filtered = await js(`({ total: document.querySelectorAll('.mod-item').length,
            hidden: document.querySelectorAll('.mod-item.hidden').length,
            names: [...document.querySelectorAll('.mod-item')].map((c) => c.getAttribute('name')) })`);
        console.log('after Anby filter: ' + JSON.stringify(filtered));
        check('filter-unmounts-not-hides', filtered.total === 1 && filtered.hidden === 0,
            JSON.stringify(filtered));
        const allBtnRect = await js(`(function () {
            const el = document.querySelector('#all-selected-slider .section-item[data-section="all"]');
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
        })()`);
        check('all-slider-found', !!allBtnRect, JSON.stringify(allBtnRect));
        if (allBtnRect) await clickAt(allBtnRect.x, allBtnRect.y);
        await sleep(1000);
        check('filter-off-6-cards', (await js(`document.querySelectorAll('.mod-item').length`)) === 6);

        // ---- D. Công tắc cảnh báo mod trùng nhau ----
        // Chọn 2 mod trùng hash (Anby Bikini + Ellen Charm cùng hash deadbeef).
        const anbyCard = await js(cardRectByName('Anby Bikini'));
        await clickAt(anbyCard.x, anbyCard.y);
        const ellenCard = await js(cardRectByName('Ellen Charm'));
        await clickAt(ellenCard.x, ellenCard.y);
        await sleep(500);
        check('select-anby-ellen', (await cardClicked('Anby Bikini')) === 'true'
            && (await cardClicked('Ellen Charm')) === 'true',
            `anby=${await cardClicked('Anby Bikini')} ellen=${await cardClicked('Ellen Charm')}`);
        // Mặc định công tắc TẮT.
        check('go-settings-2', await goSection('settings'));
        check('go-advanced-tab', await clickEl(tabRect('Advanced Settings')));
        await sleep(800);
        const warn0 = await switchState('Show Mod Conflict Warning');
        console.log('conflict toggle default: ' + JSON.stringify(warn0));
        check('conflict-toggle-default-off', warn0.found && warn0.checked === false, JSON.stringify(warn0));
        await shot('shot-test10-advanced-toggle.png');
        // TẮT -> Apply: không hộp, áp thẳng (link xuất hiện trong target).
        check('go-mod-for-apply', await goSection('mod'));
        await sleep(500);
        check('selection-kept', (await cardClicked('Anby Bikini')) === 'true'
            && (await cardClicked('Ellen Charm')) === 'true');
        const applyRect = await js(`(function () {
            const b = document.getElementById('apply-button');
            if (!b) return null;
            b.scrollIntoView({ block: 'nearest' });
            const r = b.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        check('apply-button-found', !!applyRect);
        await clickAt(applyRect.x, applyRect.y);
        await sleep(1500);
        check('apply-off-no-dialog', (await dialogVisible()) === false);
        const links1 = await waitFor(async () => {
            const e = targetEntries();
            return (e.includes('Anby Bikini') && e.includes('Ellen Charm')) ? e : null;
        }, 15000, 'links after apply-off');
        check('apply-off-links-created', !!links1, JSON.stringify(targetEntries()));
        // Dọn target để lần áp sau kiểm được từ đầu.
        for (const e of targetEntries()) {
            try { fs.rmSync(path.join(TARGET, e), { recursive: true, force: true }); } catch { /* ignore */ }
        }
        check('target-cleaned', targetEntries().length === 0);
        // BẬT công tắc -> Apply: hộp hiện, liệt kê đủ 2 mod.
        check('go-settings-3', await goSection('settings'));
        check('go-advanced-tab-2', await clickEl(tabRect('Advanced Settings')));
        await sleep(800);
        check('conflict-turn-on', await clickSwitch('Show Mod Conflict Warning'));
        await sleep(500);
        const warn1 = await switchState('Show Mod Conflict Warning');
        check('conflict-on-after-click', warn1.checked === true, JSON.stringify(warn1));
        check('go-mod-for-apply-2', await goSection('mod'));
        await sleep(500);
        const applyRect2 = await js(`(function () {
            const b = document.getElementById('apply-button');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        await clickAt(applyRect2.x, applyRect2.y);
        const dlgShown = await waitFor(async () => (await dialogVisible()) === true, 8000, 'conflict dialog');
        check('apply-on-dialog-shows', !!dlgShown);
        const dlgText = await dialogText();
        console.log('dialog text: ' + dlgText);
        check('dialog-lists-both-mods', dlgText.includes('Anby Bikini') && dlgText.includes('Ellen Charm'), dlgText);
        await shot('shot-test10-conflict-dialog.png');
        const anywayRect = await js(`(function () {
            const b = document.getElementById('conflict-apply-anyway');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        check('apply-anyway-found', !!anywayRect, JSON.stringify(anywayRect));
        if (anywayRect) await clickAt(anywayRect.x, anywayRect.y);
        await sleep(1500);
        check('dialog-closed-after-anyway', (await dialogVisible()) === false);
        const links2 = await waitFor(async () => {
            const e = targetEntries();
            return (e.includes('Anby Bikini') && e.includes('Ellen Charm')) ? e : null;
        }, 15000, 'links after apply-anyway');
        check('apply-anyway-links-created', !!links2, JSON.stringify(targetEntries()));

        // ---- E. Dải tràn Banana: ẩn toàn bộ trang ----
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
        await sleep(3000);
        check('banana-section-visible-on-banana', (await sectionVisibility()) === 'visible');
        await shot('shot-test10-banana.png');
        check('go-help', await goSection('help'));
        check('banana-section-hidden-on-help', (await sectionVisibility()) === 'hidden');
        check('webview-hidden-on-help', (await webviewVisibility()) === 'hidden');
        const sweepHelp = await leftEdgeSweep();
        console.log('help left-edge hits in banana: ' + JSON.stringify(sweepHelp));
        check('help-left-edge-clean-full-height', sweepHelp.length === 0, JSON.stringify(sweepHelp));
        await shot('shot-test10-help-leftedge.png');
        check('go-settings-4', await goSection('settings'));
        check('banana-section-hidden-on-settings', (await sectionVisibility()) === 'hidden');
        const sweepSettings = await leftEdgeSweep();
        console.log('settings left-edge hits in banana: ' + JSON.stringify(sweepSettings));
        check('settings-left-edge-clean-full-height', sweepSettings.length === 0, JSON.stringify(sweepSettings));
        await shot('shot-test10-settings-leftedge.png');
        // Đổi trang nhanh Help -> Banana -> Help trong 0,4s: hẹn ẩn cũ
        // phải bị hủy rồi hẹn lại, cuối cùng vẫn ẩn.
        await clickEl(sectionRect('banana'));
        await sleep(150);
        await clickEl(sectionRect('help'));
        const idxHelp = 2;
        const settledFast = await waitFor(async () => (await sliderTx()) === idxHelp * (10 - W), 8000, 'fast slide settle');
        await sleep(800);
        check('fast-switch-settles', !!settledFast);
        check('fast-switch-hidden-again', (await sectionVisibility()) === 'hidden');
        const sweepFast = await leftEdgeSweep();
        check('fast-switch-left-edge-clean', sweepFast.length === 0, JSON.stringify(sweepFast));
        // Quay lại Banana: hiện ngay, web vẫn tải sẵn (không tải lại).
        await clickEl(sectionRect('banana'));
        await sleep(300);
        check('banana-visible-immediately-on-return', (await sectionVisibility()) === 'visible');
        const wvUrl = await js(`(function () {
            const wv = document.querySelector('.banana-webview');
            return wv ? wv.getURL() : 'no-webview';
        })()`);
        console.log('webview url on return: ' + wvUrl);
        check('webview-keeps-page-on-return', typeof wvUrl === 'string' && wvUrl.includes('gamebanana.com'), wvUrl);
        await goSection('mod');

        // Để công tắc trùng mod + hiệu ứng thẻ ở ON cho probe-reopen kiểm.
        finish(0, 'DONE test10');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'PROBE ERROR');
    }
});
