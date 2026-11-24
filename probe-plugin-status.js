// Probe trạng thái plugin: app thật boot lên thì mấy plugin tải được,
// mấy cái bị tắt, có lỗi tải nào không. Fixture tags6 sẵn có.
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-plugin-status.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = '/tmp/xxmm-shot-tags6';

const pluginLogs = [];
let done = false;
function finish(code, msg) {
    if (done) return;
    done = true;
    console.log('=== PLUGIN CONSOLE LINES ===');
    pluginLogs.forEach((l) => console.log(l));
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}
setTimeout(() => finish(1, 'HARD TIMEOUT'), 300000);

// Đọc file cấu hình plugin trong userdata trước khi boot (nếu có).
for (const f of fs.readdirSync(path.join(BASE, 'userdata'))) {
    if (/plugin/i.test(f)) console.log('USERDATA PLUGIN FILE: ' + f);
}
const pcPath = path.join(BASE, 'userdata', 'pluginConfig.json');
if (fs.existsSync(pcPath)) {
    try {
        const pc = JSON.parse(fs.readFileSync(pcPath, 'utf8'));
        console.log('PLUGINCONFIG KEYS: ' + Object.keys(pc).join(', '));
        console.log('PLUGINCONFIG: ' + JSON.stringify(pc).slice(0, 2000));
    } catch (e) { console.log('PLUGINCONFIG PARSE ERROR: ' + e.message); }
}

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
        if (/plugin/i.test(m)) pluginLogs.push(`[${level}] ${m.slice(0, 400)}`);
    });
    await sleep(8000);

    const js = (code) => wc.executeJavaScript(code);
    async function clickAt(x, y) {
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        await sleep(400);
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
        tab.scrollIntoView({ block: 'nearest' });
        const r = tab.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;

    // Vào trang Cài đặt -> tab Plugin, đọc danh sách plugin + công tắc.
    const settings = await js(sectionRect('settings'));
    console.log('settings section rect: ' + JSON.stringify(settings));
    if (settings) await clickAt(settings.x, settings.y);
    await sleep(1500);
    const pluginTab = await js(tabRect('Plugin'));
    console.log('plugin tab rect: ' + JSON.stringify(pluginTab));
    if (pluginTab) await clickAt(pluginTab.x, pluginTab.y);
    await sleep(1500);
    const list = await js(`(function () {
        const rows = [...document.querySelectorAll('.setting-content .OO-setting-bar')];
        return rows.map((r) => {
            const h = r.querySelector('h3');
            const sw = r.querySelector('s-switch');
            if (!h || !sw) return null;
            return { name: h.textContent.trim(), checked: sw.hasAttribute('checked') };
        }).filter(Boolean);
    })()`);
    console.log('PLUGIN TAB LIST: ' + JSON.stringify(list, null, 1));
    finish(0, 'DONE');
});
