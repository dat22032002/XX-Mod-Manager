// Probe bỏ plugin Mod Card Effect (gộp vào test10, Đạt chốt 16:12).
// Kiểm:
//  A. Cột Cài đặt còn 11 tab, không còn "Mod Card Effect".
//  B. Bảng plugin còn 7 plugin, log "7 plugins loaded", log bỏ qua
//     modCardEffectPlugin.js — kể cả khi userdata/plugins vẫn còn file
//     modCardEffectPlugin.js giả lập (bản sót trên máy Đạt).
//  C. Rê chuột qua thẻ vẫn đổi khung phải (hành vi có sẵn của app,
//     ~250ms — không liên quan plugin đã bỏ).
//  D. 0 lỗi console.
// Chuẩn bị fixture TRƯỚC khi chạy (fixture rebuild xóa userdata nên
// phải gieo modCardEffectPlugin.js SAU khi rebuild):
//   python3 ~/workspace/xxmm-test/build-fixture-tags6.py
//   git show HEAD:plugins/modCardEffectPlugin.js > /tmp/xxmm-shot-tags6/userdata/plugins/modCardEffectPlugin.js
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-remove-card-effect.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 600000; // 10 phút

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
    const cardRectByName = (name) => `(function () {
        const c = document.querySelector('.mod-item[name=${JSON.stringify(name)}]');
        if (!c) return null;
        c.scrollIntoView({ block: 'center' });
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const modTitle = () => js(`(function () {
        const el = document.querySelector('.mod-title');
        return el ? el.textContent.trim() : 'missing';
    })()`);

    try {
        W = await js(`window.innerWidth`);
        console.log('innerWidth=' + W);

        // ---- A. Khởi động + cột Cài đặt còn 11 tab, không còn Mod Card Effect ----
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);
        check('go-settings', await goSection('settings'));
        const tabLabels = await js(`[...document.querySelectorAll('.setting-container .left-menu .tab p')]
            .map((e) => e.textContent.trim())`);
        console.log('settings tabs: ' + JSON.stringify(tabLabels));
        check('tab-no-card-effect', !tabLabels.includes('Mod Card Effect'), JSON.stringify(tabLabels));
        check('tab-count-11', tabLabels.length === 11, 'count=' + tabLabels.length);
        check('tab-keeps-others', tabLabels.includes('Mod Fixer') && tabLabels.includes('Plugin')
            && tabLabels.includes('Mod Status Keeper') && tabLabels.includes('General Settings'),
            JSON.stringify(tabLabels));
        await shot('shot-remove-cardefx-settings.png');

        // ---- B. Bảng plugin còn 7, log bỏ qua file sót trong userdata ----
        check('go-plugin-tab', await clickEl(tabRect('Plugin')));
        await sleep(800);
        const pluginRows = await js(`[...document.querySelectorAll('.setting-content .OO-setting-bar')]
            .map((r) => { const h = r.querySelector('h3'); const sw = r.querySelector('s-switch');
                return (h && sw) ? h.textContent.trim() : null; }).filter(Boolean)`);
        console.log('plugin rows: ' + JSON.stringify(pluginRows));
        check('plugin-list-no-card-effect', !pluginRows.includes('Mod Card Effect')
            && pluginRows.length === 7, JSON.stringify(pluginRows));
        const skipped = pluginLines.some((l) => /modCardEffectPlugin.*skipped/i.test(l));
        const loadedLine = pluginLines.find((l) => /plugins loaded/.test(l)) || '';
        console.log('loaded line: ' + loadedLine);
        check('cardeffect-skipped-log', skipped, JSON.stringify(pluginLines.slice(0, 6)));
        check('plugins-loaded-7', /7 plugins loaded/.test(loadedLine), loadedLine);

        // ---- C. Rê chuột qua thẻ vẫn đổi khung phải (hành vi có sẵn của app) ----
        check('go-mod-for-hover', await goSection('mod'));
        await mouseMoveTo(640, 25);
        await sleep(300);
        // Đo sạch như probe-hover-recheck.js: đọc tên gốc trước, chọn
        // thẻ khác tên gốc để rê, gửi mouseMove trực tiếp (helper
        // mouseMoveTo ngủ thừa 150ms làm mẫu "+120ms" thực ra ~270ms,
        // đã qua ngưỡng 250ms của app -> fail oan).
        const baselineTitle = await modTitle();
        const targetName = baselineTitle === 'Grace Misc' ? 'Alexandrina Outfit' : 'Grace Misc';
        const graceRect0 = await js(cardRectByName(targetName));
        check('grace-card-found', !!graceRect0, JSON.stringify(graceRect0));
        wc.sendInputEvent({ type: 'mouseMove', x: graceRect0.x, y: graceRect0.y });
        await sleep(50);
        const title50 = await modTitle();
        await sleep(450);
        const title500 = await modTitle();
        console.log(`hover titles: baseline=${baselineTitle} +50ms=${title50} +500ms=${title500} target=${targetName}`);
        check('hover-not-immediate', title50 === baselineTitle, '+50ms=' + title50);
        check('hover-app-switches-after-250ms', title500 === targetName, '+500ms=' + title500);

        // ---- D. 0 lỗi console ----
        check('no-console-errors', consoleErrors.length === 0, 'errors=' + consoleErrors.length);

        finish(0, 'DONE');
    } catch (e) {
        console.log('PROBE EXCEPTION: ' + (e && e.stack || e));
        finish(1, 'EXCEPTION');
    }
});
