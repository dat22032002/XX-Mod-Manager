// Kiểm lại hành vi rê chuột đổi thẻ sau khi bỏ plugin Mod Card Effect.
// Đo sạch: đọc tên mod đang xem TRƯỚC khi rê (đường cơ sở), chọn 1 thẻ
// khác tên đó để rê, gửi mouseMove trực tiếp (không ngủ thừa 150ms như
// helper cũ) rồi lấy mẫu tên khung phải tại +50/+150/+300/+500ms.
// Kỳ vọng: +50ms vẫn tên cũ (app đợi ~250ms), +500ms đã đổi sang thẻ mới.
const { app, BrowserWindow } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
    if (consoleErrors.length > 0) console.log('CONSOLE ERRORS: ' + consoleErrors.slice(0, 10).join(' | '));
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}
setTimeout(() => finish(1, 'HARD TIMEOUT'), 300000);
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
        if (level >= 2) consoleErrors.push(`[${level}] ${m.slice(0, 200)}`);
    });
    await sleep(8000);
    const js = (code) => wc.executeJavaScript(code);
    const modTitle = () => js(`(function () {
        const el = document.querySelector('.mod-title');
        return el ? el.textContent.trim() : 'missing';
    })()`);
    try {
        const cards = await js(`[...document.querySelectorAll('.mod-item')].map((c) => c.getAttribute('name'))`);
        check('boot-6-cards', cards.length === 6, JSON.stringify(cards));
        const baseline = await modTitle();
        console.log('baseline title: ' + baseline);
        const target = cards.find((n) => n !== baseline) || cards[0];
        console.log('hover target: ' + target);
        const rect = await js(`(function () {
            const c = document.querySelector('.mod-item[name=${JSON.stringify(target)}]');
            if (!c) return null;
            c.scrollIntoView({ block: 'center' });
            const r = c.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        check('target-found', !!rect, JSON.stringify(rect));
        // Đưa chuột về chỗ trung lập trước, đợi hết mọi hẹn đổi đang chờ.
        wc.sendInputEvent({ type: 'mouseMove', x: 640, y: 25 });
        await sleep(600);
        const baseline2 = await modTitle();
        console.log('baseline after neutral: ' + baseline2);
        wc.sendInputEvent({ type: 'mouseMove', x: rect.x, y: rect.y });
        const t0 = Date.now();
        const samples = {};
        for (const delay of [50, 150, 300, 500]) {
            await sleep(delay - (Date.now() - t0));
            samples['+' + delay + 'ms'] = await modTitle();
        }
        console.log('samples: ' + JSON.stringify(samples));
        check('hover-not-immediate-50ms', samples['+50ms'] === baseline2,
            '+50ms=' + samples['+50ms'] + ' baseline=' + baseline2);
        check('hover-switches-by-500ms', samples['+500ms'] === target,
            '+500ms=' + samples['+500ms'] + ' target=' + target);
        check('no-console-errors', consoleErrors.length === 0, 'errors=' + consoleErrors.length);
        finish(0, 'DONE');
    } catch (e) {
        console.log('PROBE EXCEPTION: ' + (e && e.stack || e));
        finish(1, 'EXCEPTION');
    }
});
