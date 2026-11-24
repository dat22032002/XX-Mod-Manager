// Probe kéo-thật v5 (1.5.25-test5): 2 câu còn mở sau v4 (v4 chứng minh
// trang mod chạy tốt khâu 1–3: dragstart → preload → gbStartDragImage):
//  (A) thumbnail mod trên trang danh sách (ảnh Đạt hay kéo nhất) có
//      bật được dragstart thật không — v4 chọn nhầm avatar bị DIV phủ;
//  (B) chuỗi ĐẦY ĐỦ tới startDrag với ảnh tải được (đổi src 1 ảnh đang
//      hiện sang máy chủ nội bộ, vì chèn ảnh mới bị trang ẩn
//      display:none; tải https trong máy ảo lỗi TLS nên không dùng).
// Chạy (cwd = repo root; máy chủ nội bộ phải đang chạy):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-drag-real5.js
const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const DRAG_TMP = '/tmp/xxmm-gb-drag';
const LOCAL_IMG = 'http://127.0.0.1:8902/test.png';
const HARD_TIMEOUT_MS = 600000;

const results = [];
const consoleErrors = [];
const guestConsole = [];
const dragIpc = [];
const dragStubs = [];
function check(name, ok, detail) {
    results.push({ name, ok: !!ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
}

ipcMain.on('gb-start-drag', (_e, filePath) => {
    dragIpc.push(String(filePath));
    console.log('GB-START-DRAG-IPC ' + filePath);
});
ipcMain.on('snack', (_e, message) => {
    console.log('SNACK: ' + message);
});

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

const LISTENER_CODE = `(function () {
    window.__dragProbe = { mousedown: null, dragstart: null, dragstartDefaultPrevented: null };
    document.addEventListener('mousedown', function (e) {
        var t = e.target;
        window.__dragProbe.mousedown = {
            tag: t.tagName, inImg: !!(t.closest && t.closest('img')),
            imgSrc: (t.closest && t.closest('img') ? (t.closest('img').currentSrc || t.closest('img').src || '') : '').slice(0, 120)
        };
    }, true);
    document.addEventListener('dragstart', function (e) {
        var t = e.target;
        window.__dragProbe.dragstart = {
            tag: t.tagName, inImg: !!(t.closest && t.closest('img')),
            imgSrc: (t.closest && t.closest('img') ? (t.closest('img').currentSrc || t.closest('img').src || '') : '').slice(0, 120)
        };
        window.__dragProbe.dragstartDefaultPrevented = e.defaultPrevented;
    }, true);
})()`;

const timer = setInterval(async () => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    const win = wins[0];
    if (win.webContents.isLoading()) return;
    clearInterval(timer);
    const wc = win.webContents;

    wc.startDrag = (item) => {
        dragStubs.push(item && item.file ? String(item.file) : JSON.stringify(item));
        console.log('START-DRAG-STUB ' + (item && item.file));
    };

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
    const listTmp = () => {
        try {
            return fs.readdirSync(DRAG_TMP).map((f) => {
                const st = fs.statSync(path.join(DRAG_TMP, f));
                return f + ' ' + st.size + 'B';
            });
        } catch (_e) { return []; }
    };
    const dragFetchCalled = (urlPart) => consoleErrors.some((m) =>
        m.includes('gbStartDragImage failed for') && (!urlPart || m.includes(urlPart)));

    async function guestWc() {
        const id = await js(`(function () {
            const wv = document.querySelector('webview');
            return wv ? wv.getWebContentsId() : 0;
        })()`);
        if (!id) return null;
        try { return webContents.fromId(id); } catch (_e) { return null; }
    }

    try {
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);

        const clickedBanana = await clickEl(sectionRect('banana'));
        await sleep(1000);
        const bananaActive = await js(`(function () {
            const el = document.querySelector('.section-item[data-section="banana"]');
            return el ? el.classList.contains('active') : false;
        })()`);
        check('banana-opens', clickedBanana && bananaActive);

        const preloadReady = await waitFor(() => js(`!!window.__gbPreloadReady`), 45000, 'preload ready');
        check('preload-ready', !!preloadReady);

        const guest = await waitFor(guestWc, 15000, 'guest webContents');
        check('guest-wc', !!guest);
        if (!guest) { finish(1, 'no guest'); return; }
        guest.on('console-message', (_e, level, message) => {
            const m = String(message);
            if (/Content-Security-Policy|Electron Security Warning|Autofill|favicon/i.test(m)) return;
            if (level >= 2) guestConsole.push(`[${level}] ${m.slice(0, 300)}`);
        });
        const gjs = (code) => guest.executeJavaScript(code);
        const guestLoaded = await waitFor(async () => {
            try {
                const st = await gjs(`document.readyState`);
                const n = await gjs(`document.querySelectorAll('img').length`);
                return st === 'complete' && n > 5 ? ('imgs=' + n) : null;
            } catch (_e) { return null; }
        }, 60000, 'guest loaded with images');
        check('guest-loaded', !!guestLoaded, guestLoaded);

        const dbg = guest.debugger;
        let cdpOk = false;
        try { dbg.attach('1.3'); cdpOk = true; } catch (e) { console.log('CDP attach failed: ' + e.message); }
        check('cdp-attach', cdpOk);
        if (!cdpOk) { finish(1, 'no cdp'); return; }
        const cdp = (method, params) => dbg.sendCommand(method, params);
        async function cdpClick(x, y) {
            await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
            await sleep(100);
            await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
            await sleep(200);
        }
        async function armListeners(label) {
            await gjs(LISTENER_CODE);
            await gjs(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));`);
            await sleep(200);
            const live = await gjs(`!!(window.__dragProbe && window.__dragProbe.mousedown && window.__dragProbe.mousedown.tag === 'BODY')`);
            console.log(`INFO ${label} listener-live=${live}`);
            await gjs(`window.__dragProbe = { mousedown: null, dragstart: null, dragstartDefaultPrevented: null };`);
            return live;
        }
        async function realDragAt(gx, gy, label, expectUrlPart) {
            dragIpc.length = 0;
            dragStubs.length = 0;
            const beforeErrs = consoleErrors.length;
            const live = await armListeners(label);
            if (!live) return { outcome: 'no-listener', probe: null, hit: null, live: false };
            const hit = await gjs(`(function () {
                const el = document.elementFromPoint(${gx}, ${gy});
                if (!el) return null;
                return { tag: el.tagName, inImg: !!(el.closest && el.closest('img')),
                    imgSrc: (el.closest && el.closest('img') ? (el.closest('img').currentSrc || el.closest('img').src || '') : '').slice(0, 100) };
            })()`);
            console.log(`INFO ${label} guestPoint=(${gx},${gy}) elementFromPoint=${JSON.stringify(hit)}`);
            await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: gx, y: gy, button: 'left', clickCount: 1 });
            await sleep(150);
            for (let i = 1; i <= 10; i++) {
                await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: gx + i * 12, y: gy + i * 6, button: 'left' });
                await sleep(60);
            }
            const outcome = await waitFor(() => {
                if (dragStubs.length > 0) return 'stub';
                if (dragIpc.length > 0) return 'ipc';
                if (listTmp().length > 0) return 'tmpfile';
                if (dragFetchCalled(expectUrlPart)) return 'fetch-called';
                return null;
            }, 10000, 'drag chain ' + label);
            const probe = await gjs(`window.__dragProbe`);
            const newErrs = consoleErrors.slice(beforeErrs);
            console.log(`INFO ${label} outcome=${outcome} mousedown=${JSON.stringify(probe && probe.mousedown)} dragstart=${JSON.stringify(probe && probe.dragstart)} prevented=${probe && probe.dragstartDefaultPrevented} tmp=${JSON.stringify(listTmp())} ipc=${JSON.stringify(dragIpc)} stub=${JSON.stringify(dragStubs)} newErrs=${JSON.stringify(newErrs)}`);
            await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: gx + 120, y: gy + 60, button: 'left', clickCount: 1 });
            await sleep(300);
            return { outcome, probe, hit, live: true };
        }

        const primePt = await gjs(`(function () {
            for (let y = 100; y < window.innerHeight; y += 60) {
                const el = document.elementFromPoint(20, y);
                if (el && (el.tagName === 'BODY' || el.tagName === 'HTML')) return { x: 20, y };
            }
            return { x: 20, y: 100 };
        })()`);
        await cdpClick(primePt.x, primePt.y);

        // ---- A. Thumbnail mod thật trong lưới danh sách ----
        // Lưới mod nằm dưới phần đầu trang — cuộn xuống tới khi thấy
        // thumbnail mod (ảnh sgi_common_thumbs trong thẻ link tới /mods/).
        const gridThumb = await waitFor(async () => {
            try {
                return await gjs(`(function () {
                    const imgs = [...document.querySelectorAll('a[href*="/mods/"] img')];
                    const cand = imgs.filter((im) => {
                        const r = im.getBoundingClientRect();
                        const src = im.currentSrc || im.src || '';
                        return r.width >= 150 && r.height >= 80 &&
                            r.top >= 0 && r.bottom <= window.innerHeight &&
                            src.includes('images.gamebanana.com') &&
                            im.complete && im.naturalWidth > 0;
                    });
                    if (cand.length) {
                        const im = cand[0];
                        im.scrollIntoView({ block: 'center' });
                        return { src: (im.currentSrc || im.src).slice(0, 120), inLink: true };
                    }
                    window.scrollBy(0, 600);
                    return null;
                })()`);
            } catch (_e) { return null; }
        }, 60000, 'grid thumbnail visible');
        console.log('INFO grid-thumb: ' + JSON.stringify(gridThumb));
        await sleep(1200);
        const gridPos = gridThumb ? await gjs(`(function () {
            const im = [...document.querySelectorAll('a[href*="/mods/"] img')].find((e) =>
                (e.currentSrc || e.src || '') === ${JSON.stringify(gridThumb.src)});
            if (!im) return null;
            const r = im.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                w: Math.round(r.width), h: Math.round(r.height) };
        })()`) : null;
        console.log('INFO grid-pos: ' + JSON.stringify(gridPos));
        check('grid-thumb-picked', !!(gridThumb && gridPos), JSON.stringify(gridPos));
        await shot('shot-drag-real5-grid.png');
        if (gridPos) {
            // Chồng thẻ tại điểm kéo (v4: avatar bị DIV phủ nên chuột không
            // tới được ảnh — xem thumbnail mod có bị phủ không).
            const stack = await gjs(`(function () {
                return document.elementsFromPoint(${gridPos.x}, ${gridPos.y}).slice(0, 5).map((el) => el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''));
            })()`);
            console.log('INFO grid-stack: ' + JSON.stringify(stack));
            const r = await realDragAt(gridPos.x, gridPos.y, 'real-drag-grid', 'gamebanana');
            check('grid-listener-live', r.live === true);
            check('grid-mousedown-hits-img', !!(r.probe && r.probe.mousedown && r.probe.mousedown.inImg),
                JSON.stringify(r.probe && r.probe.mousedown));
            check('grid-dragstart-fires', !!(r.probe && r.probe.dragstart),
                JSON.stringify(r.probe && r.probe.dragstart));
            check('grid-preload-prevents', r.probe && r.probe.dragstartDefaultPrevented === true,
                'prevented=' + (r.probe && r.probe.dragstartDefaultPrevented));
            check('grid-gbStartDragImage-called', r.outcome === 'fetch-called' || r.outcome === 'tmpfile' || r.outcome === 'ipc' || r.outcome === 'stub',
                'outcome=' + r.outcome);
        }

        // ---- B. Chuỗi đầy đủ: đổi src 1 ảnh đang hiện sang máy chủ nội bộ ----
        const swapped = await gjs(`(function () {
            const imgs = [...document.querySelectorAll('img')];
            const im = imgs.find((e) => {
                const r = e.getBoundingClientRect();
                return r.width >= 150 && r.height >= 80 && r.top >= 0 && r.bottom <= window.innerHeight &&
                    (e.currentSrc || e.src || '').includes('images.gamebanana.com') &&
                    e.complete && e.naturalWidth > 0;
            });
            if (!im) return null;
            im.id = 'xxmm-drag-test-img';
            im.removeAttribute('srcset');
            im.src = ${JSON.stringify(LOCAL_IMG)};
            im.scrollIntoView({ block: 'center' });
            return { oldSrc: 'swapped' };
        })()`);
        console.log('INFO swapped: ' + JSON.stringify(swapped));
        const swappedPos = swapped ? await waitFor(async () => {
            try {
                return await gjs(`(function () {
                    const im = document.getElementById('xxmm-drag-test-img');
                    if (!im || !im.complete || im.naturalWidth === 0) return null;
                    if (!(im.currentSrc || '').includes('127.0.0.1')) return null;
                    const r = im.getBoundingClientRect();
                    if (r.width < 100) return null;
                    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                        w: Math.round(r.width), h: Math.round(r.height), src: im.currentSrc.slice(0, 80) };
                })()`);
            } catch (_e) { return null; }
        }, 15000, 'swapped image loaded') : null;
        console.log('INFO swapped-pos: ' + JSON.stringify(swappedPos));
        check('swapped-img-ready', !!swappedPos, JSON.stringify(swappedPos));
        await shot('shot-drag-real5-swapped.png');
        if (swappedPos) {
            const r = await realDragAt(swappedPos.x, swappedPos.y, 'real-drag-local', '127.0.0.1');
            check('local-mousedown-hits-img', !!(r.probe && r.probe.mousedown && r.probe.mousedown.inImg),
                JSON.stringify(r.probe && r.probe.mousedown));
            check('local-dragstart-fires', !!(r.probe && r.probe.dragstart),
                JSON.stringify(r.probe && r.probe.dragstart));
            check('local-preload-prevents', r.probe && r.probe.dragstartDefaultPrevented === true,
                'prevented=' + (r.probe && r.probe.dragstartDefaultPrevented));
            check('local-temp-file', listTmp().length > 0, JSON.stringify(listTmp()));
            check('local-ipc-sent', dragIpc.length > 0, JSON.stringify(dragIpc));
            check('local-startdrag-called', dragStubs.length > 0, JSON.stringify(dragStubs));
        }

        try { dbg.detach(); } catch (_e) { /* ignore */ }
        await shot('shot-drag-real5-end.png');
        finish(results.every((r) => r.ok) ? 0 : 1, 'probe-drag-real5 done');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'probe error');
    }
});
