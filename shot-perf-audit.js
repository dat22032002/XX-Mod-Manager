// Đo hiệu năng app thật cho đợt nghiên cứu tối ưu (Đạt 24/11).
// Chạy 2 lần trên cùng userdata: lần 1 = quét mới (chưa có cache),
// lần 2 = tải từ cache. Đo: thời gian tải mod (từ log console của
// app), số thẻ đang gắn, tổng số node DOM, số phần tử OO-color-gradient
// + chi phí quét lại chúng (refresh() chạy mỗi khung hình), bộ nhớ JS,
// thời gian 1 lần bấm Apply.
// Chạy: electron shot-perf-audit.js (userdata /tmp/xxmm-shot-grid48/userdata)
const { app, BrowserWindow } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HARD_TIMEOUT_MS = 300000;

const consoleLines = [];
let done = false;
function finish(code, msg) {
    if (done) return;
    done = true;
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}
setTimeout(() => finish(1, 'HARD TIMEOUT'), HARD_TIMEOUT_MS);

require('./electron/main.js');

let win = null;
let wc = null;
let bootStarted = false;

const bootTimer = setInterval(() => {
    if (bootStarted) return;
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    win = wins[0];
    wc = win.webContents;
    if (wc.isLoading()) return;
    bootStarted = true;
    clearInterval(bootTimer);
    wc.on('console-message', (e, level, message) => {
        if (/loadMods done|loaded .* mods in|loadConfig done|loadPlugins done/.test(message)) {
            consoleLines.push(message);
        }
    });
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

    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && !prog;
    }, 60000, 'load done');
    if (!loaded) return finish(1, 'khong tai xong');
    await sleep(3000);

    console.log('--- CONSOLE (thoi gian tai) ---');
    consoleLines.forEach((l) => console.log('LOG ' + l));

    const dom = await js(`(function () {
        return {
            modItems: document.querySelectorAll('.mod-item').length,
            totalNodes: document.querySelectorAll('*').length,
            gradientEls: document.querySelectorAll('.OO-color-gradient').length,
            gradientWordEls: document.querySelectorAll('.OO-color-gradient-word').length,
            gradientBorderEls: document.querySelectorAll('.OO-color-gradient-border').length,
            charRows: document.querySelectorAll('.character-row').length,
            heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1,
        };
    })()`);
    console.log('--- DOM ---');
    console.log(JSON.stringify(dom));

    // Chi phí 1 lần refresh() của colorManager: querySelectorAll toàn
    // trang + vòng includes (mô phỏng đúng code trong classManager.js).
    // refresh() chạy MỖI khung hình vì needRefresh không bao giờ tắt.
    const refreshCost = await js(`(function () {
        const items = Array.from(document.querySelectorAll('.OO-color-gradient'));
        const t0 = performance.now();
        const N = 200;
        for (let k = 0; k < N; k++) {
            const newItems = document.querySelectorAll('.OO-color-gradient');
            const removeItems = [];
            const addItems = [];
            items.forEach((item) => {
                if (!item.classList.contains('OO-color-gradient')) removeItems.push(item);
            });
            newItems.forEach((item) => {
                if (!items.includes(item)) addItems.push(item);
            });
        }
        const perCallMs = (performance.now() - t0) / N;
        // Chi phí ghi màu mỗi khung hình: ghi backgroundColor cho mọi
        // phần tử gradient (đúng việc onUpdate làm mỗi khung hình).
        const t1 = performance.now();
        for (let k = 0; k < N; k++) {
            items.forEach((el) => { el.style.backgroundColor = '#ffd300'; });
        }
        const perWriteMs = (performance.now() - t1) / N;
        return { refreshMsPerFrame: +perCallMs.toFixed(3), styleWriteMsPerFrame: +perWriteMs.toFixed(3) };
    })()`);
    console.log('--- CHI PHI MOI KHUNG HINH (60 khung/giay) ---');
    console.log(JSON.stringify(refreshCost));

    // Thời gian 1 lần Apply (46 mod, đa số đã đúng trạng thái nên chỉ
    // kiểm tra rồi bỏ qua): bấm chọn 1 thẻ rồi bấm Apply, đo tới khi
    // dòng tiến độ biến mất.
    const card = await js(`(function () {
        const c = document.querySelector('.mod-item');
        if (!c) return null;
        c.scrollIntoView({ block: 'center' });
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (card) {
        wc.sendInputEvent({ type: 'mouseMove', x: card.x, y: card.y });
        await sleep(120);
        wc.sendInputEvent({ type: 'mouseDown', x: card.x, y: card.y, button: 'left', clickCount: 1 });
        await sleep(60);
        wc.sendInputEvent({ type: 'mouseUp', x: card.x, y: card.y, button: 'left', clickCount: 1 });
        await sleep(800);
        const applyBtn = await js(`(function () {
            const b = document.querySelector('#apply-button');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), disabled: b.disabled };
        })()`);
        if (applyBtn && !applyBtn.disabled) {
            const t0 = Date.now();
            wc.sendInputEvent({ type: 'mouseMove', x: applyBtn.x, y: applyBtn.y });
            await sleep(120);
            wc.sendInputEvent({ type: 'mouseDown', x: applyBtn.x, y: applyBtn.y, button: 'left', clickCount: 1 });
            await sleep(60);
            wc.sendInputEvent({ type: 'mouseUp', x: applyBtn.x, y: applyBtn.y, button: 'left', clickCount: 1 });
            const applyDone = await waitFor(async () => {
                const prog = await js(`!!document.querySelector('.apply-progress')`);
                const dlg = await js(`!!document.querySelector('#dialog-apply-result, .apply-result-dialog, s-dialog[open]')`);
                return !prog && (Date.now() - t0 > 1500 || dlg);
            }, 30000, 'apply done');
            console.log('--- APPLY (46 mod) ---');
            console.log('APPLY_MS=' + (Date.now() - t0) + ' done=' + !!applyDone);
        } else {
            console.log('APPLY: khong bam duoc nut (' + JSON.stringify(applyBtn) + ')');
        }
    }

    finish(0, 'perf-audit xong');
}
