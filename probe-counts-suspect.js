// Probe số đếm khi bật lọc "chỉ mod nghi hỏng" (1.5.25-test6).
// Fixture: seed-fixture-fixer.py (6 mod; 3 nghi hỏng: Anby, Ellen, Grace)
// + seed tự vá showChipCounts: true vào config (mặc định false nên số đếm ẩn).
// 1. Chưa lọc: All (6), mỗi nhân vật (1), Selected (0),
//    dòng thống kê "6 mods · 0 enabled · 6 characters".
// 2. Chọn Anby (nghi hỏng) + Billy (không nghi hỏng): Selected (2).
// 3. Quét Fixer (3 nghi hỏng) rồi bật lọc: All (3); Anby/Ellen/Grace (1),
//    Alexandrina/Billy/Corin (0) vẫn giữ hàng; Selected (1);
//    thống kê "3 mods · 1 enabled · 3 characters"; lưới chỉ 3 thẻ.
// 4. Tắt lọc: mọi số về tổng (All (6), Selected (2), thống kê đủ 6).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-counts-suspect.js
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const USERDATA = '/tmp/xxmm-shot-tags6/userdata';
const CONFIG = path.join(USERDATA, 'config.json');
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

const timer = setInterval(async () => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    const win = wins[0];
    if (win.webContents.isLoading()) return;
    clearInterval(timer);
    const wc = win.webContents;
    wc.on('console-message', (_e, level, message) => {
        const m = String(message);
        if (/Content-Security-Policy|Electron Security Warning|Autofill|favicon/i.test(m)) return;
        if (level >= 2) consoleErrors.push(`[${level}] ${m.slice(0, 300)}`);
    });
    await sleep(6000);

    const js = (code) => wc.executeJavaScript(code);
    async function clickAt(x, y) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        await sleep(300);
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
    const sectionRect = (sec) => `(function () {
        const el = document.querySelector('.section-item[data-section="${sec}"]');
        if (!el) return null;
        el.scrollIntoView({ block: 'nearest' });
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const tabRect = (label) => `(function () {
        const tab = [...document.querySelectorAll('.left-menu .tab')].find((e) =>
            (e.querySelector('p') || {}).textContent.trim() === ${JSON.stringify(label)});
        if (!tab) return null;
        const r = tab.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const btnRect = (label) => `(function () {
        const b = [...document.querySelectorAll('.fixer-block s-button')]
            .find((e) => e.textContent.trim() === ${JSON.stringify(label)});
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const fixerText = (re) => js(`(function () {
        const ps = [...document.querySelectorAll('.fixer-block p, .fixer-block h3')];
        const s = ps.find((e) => ${re}.test(e.textContent));
        return s ? s.textContent.trim() : null;
    })()`);
    const filterBtnRect = `(function () {
        const b = document.querySelector('#filter-toggle-chip');
        if (!b) return null;
        b.scrollIntoView({ block: 'nearest' });
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const switchRect = `(function () {
        const s = document.querySelector('#suspect-only-switch');
        if (!s) return null;
        s.scrollIntoView({ block: 'center' });
        const r = s.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const switchState = () => js(`(function () {
        const s = document.querySelector('#suspect-only-switch');
        if (!s) return null;
        // s-switch: trạng thái đọc qua thuộc tính .checked.
        return { checked: s.checked === true, disabled: !!(s.disabled || s.hasAttribute('disabled')) };
    })()`);
    const gridNames = () => js(`[...document.querySelectorAll('.mod-item .mod-item-name')]
        .map((e) => e.textContent.trim()).sort()`);
    const cardRect = (name) => `(function () {
        const card = [...document.querySelectorAll('.mod-item')].find((e) =>
            ((e.querySelector('.mod-item-name') || {}).textContent || '').trim() === ${JSON.stringify(name)});
        if (!card) return null;
        card.scrollIntoView({ block: 'center' });
        const r = card.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    // Số đếm ở thanh trượt Tất cả/Đã chọn: [All, Selected], vd ["(6)", "(2)"].
    const sliderCounts = () => js(`[...document.querySelectorAll('#all-selected-slider .section-label-count')]
        .map((e) => e.textContent.trim())`);
    // Số đếm từng hàng nhân vật: { Alexandrina: "(1)", ... } (tên đầy đủ,
    // textContent không bị cắt … như hiển thị).
    const rowCounts = () => js(`(function () {
        const out = {};
        for (const r of document.querySelectorAll('.character-row')) {
            const n = (r.querySelector('.character-name') || {}).textContent;
            const c = r.querySelector('.character-count');
            if (n) out[n.trim()] = c ? c.textContent.trim() : null;
        }
        return out;
    })()`);
    const statsLine = () => js(`(function () {
        const el = document.querySelector('.mod-stats');
        return el ? el.textContent.trim() : null;
    })()`);
    // Bảng dùng v-show nên công tắc vẫn nằm trong DOM khi bảng đóng —
    // kiểm tra bảng HIỆN THẬT (có kích thước), không chỉ kiểm phần tử
    // tồn tại, không thì bấm công tắc đang ẩn sẽ bấm trượt vào (0,0).
    const panelVisible = () => js(`(function () {
        const p = document.querySelector('.filter-panel');
        if (!p) return false;
        const r = p.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    })()`);
    async function openFilterPanel() {
        const opened = await clickEl(filterBtnRect);
        await sleep(800);
        return opened && await panelVisible();
    }
    // Đóng bảng lọc bằng cách dời chuột ra khỏi bảng: bảng tự đóng khi
    // chuột rời khỏi (@mouseleave). KHÔNG bấm nút Filter để đóng — chuột
    // dời từ công tắc sang nút kích hoạt mouseleave ĐÓNG bảng trước, rồi
    // cú bấm lại MỞ bảng ra, thành ra bảng vẫn mở (đúng lỗi làm rớt 5
    // kiểm ở lần chạy đầu). Điểm (700, 550) là khoảng trống dưới thẻ
    // trong lưới, dời chuột tới đó không bấm nhầm gì.
    async function closePanelByMouseLeave() {
        wc.sendInputEvent({ type: 'mouseMove', x: 700, y: 550 });
        await sleep(800);
        return !(await panelVisible());
    }
    async function goToModPage() {
        const clicked = await clickEl(sectionRect('mod'));
        await sleep(800);
        return clicked && await js(`(function () {
            const el = document.querySelector('.section-item[data-section="mod"]');
            return el ? el.classList.contains('active') : false;
        })()`);
    }

    try {
        // ---- A. Chưa lọc: tổng 6, mỗi nhân vật 1, chưa chọn gì ----
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);
        const cfg0 = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
        check('counts-switch-preseeded', cfg0.showChipCounts === true,
            'showChipCounts=' + JSON.stringify(cfg0.showChipCounts));
        const sl0 = await sliderCounts();
        check('baseline-all-6', sl0[0] === '(6)', JSON.stringify(sl0));
        check('baseline-selected-0', sl0[1] === '(0)', JSON.stringify(sl0));
        const rows0 = await rowCounts();
        const expectRows0 = { Alexandrina: '(1)', Anby: '(1)', Billy: '(1)', Corin: '(1)', Ellen: '(1)', Grace: '(1)' };
        check('baseline-rows-1-each', JSON.stringify(rows0) === JSON.stringify(expectRows0),
            JSON.stringify(rows0));
        const stats0 = await statsLine();
        check('baseline-stats', stats0 === '6 mods · 0 enabled · 6 characters', stats0);

        // ---- B. Chọn Anby (nghi hỏng) + Billy (không nghi hỏng) ----
        check('click-anby-card', await clickEl(cardRect('Anby Bikini')));
        check('click-billy-card', await clickEl(cardRect('Billy Sword')));
        await sleep(800);
        const sl1 = await waitFor(async () => {
            const s = await sliderCounts();
            return s[1] === '(2)' ? s : null;
        }, 15000, 'selected becomes 2');
        check('selected-2-after-clicks', sl1 && sl1[1] === '(2)', JSON.stringify(sl1));
        const stats1 = await statsLine();
        check('stats-enabled-2', stats1 === '6 mods · 2 enabled · 6 characters', stats1);

        // ---- C. Quét Fixer: 3 nghi hỏng ----
        await clickEl(sectionRect('settings'));
        await sleep(800);
        await clickEl(tabRect('Mod Fixer'));
        await sleep(800);
        await clickEl(btnRect('Scan for broken mods'));
        const scanDone = await waitFor(async () => fixerText(/Found \d+ mod/), 240000, 'scan done');
        check('scan-finds-3', scanDone === 'Found 3 mod(s) that may be broken', scanDone);
        check('back-to-mod-page', await goToModPage());

        // ---- D. Bật lọc: mọi số đếm theo 3 nghi hỏng ----
        check('filter-panel-opens', await openFilterPanel());
        const sw0 = await switchState();
        check('switch-enabled-after-scan', sw0 && sw0.disabled === false && sw0.checked === false,
            JSON.stringify(sw0));
        await clickEl(switchRect);
        const sl2 = await waitFor(async () => {
            const s = await sliderCounts();
            return s[0] === '(3)' ? s : null;
        }, 15000, 'all becomes 3');
        check('filter-on-all-3', sl2 && sl2[0] === '(3)', JSON.stringify(sl2));
        check('filter-on-selected-1', sl2 && sl2[1] === '(1)', JSON.stringify(sl2));
        const rows1 = await rowCounts();
        const expectRows1 = { Alexandrina: '(0)', Anby: '(1)', Billy: '(0)', Corin: '(0)', Ellen: '(1)', Grace: '(1)' };
        check('filter-on-rows', JSON.stringify(rows1) === JSON.stringify(expectRows1),
            JSON.stringify(rows1));
        check('filter-on-zero-rows-kept', Object.keys(rows1).length === 6,
            'rows=' + Object.keys(rows1).length);
        const stats2 = await statsLine();
        check('filter-on-stats', stats2 === '3 mods · 1 enabled · 3 characters', stats2);
        const onNames = await gridNames();
        check('filter-on-grid-3', JSON.stringify(onNames) === JSON.stringify(['Anby Bikini', 'Ellen Charm', 'Grace Misc'].sort()),
            'got=' + JSON.stringify(onNames));
        // Đóng bảng để chụp cột trái (số đếm từng hàng) khi lọc đang bật.
        check('panel-closed-on', await closePanelByMouseLeave());
        await shot('shot-counts-filter-on.png');

        // ---- E. Tắt lọc: mọi số về tổng ----
        check('filter-panel-opens-2', await openFilterPanel());
        await clickEl(switchRect);
        const sl3 = await waitFor(async () => {
            const s = await sliderCounts();
            return s[0] === '(6)' ? s : null;
        }, 15000, 'all back to 6');
        check('filter-off-all-6', sl3 && sl3[0] === '(6)', JSON.stringify(sl3));
        check('filter-off-selected-2', sl3 && sl3[1] === '(2)', JSON.stringify(sl3));
        const rows2 = await rowCounts();
        check('filter-off-rows-1-each', JSON.stringify(rows2) === JSON.stringify(expectRows0),
            JSON.stringify(rows2));
        const stats3 = await statsLine();
        check('filter-off-stats', stats3 === '6 mods · 2 enabled · 6 characters', stats3);
        const offNames = await gridNames();
        check('filter-off-grid-6', offNames && offNames.length === 6, 'got=' + JSON.stringify(offNames));
        check('panel-closed-off', await closePanelByMouseLeave());
        await shot('shot-counts-filter-off.png');

        finish(results.every((r) => r.ok) ? 0 : 1, 'probe-counts-suspect done');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'probe error');
    }
});
