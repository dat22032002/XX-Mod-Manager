// Probe sửa kéo ảnh (1.5.25-test5): startDrag LUÔN có icon.
// - Ảnh webp (định dạng của gần hết ảnh GameBanana): nativeImage đọc
//   ra rỗng -> main.js phải dùng ô vàng dự phòng 64x64, cú kéo vẫn có
//   icon (trước đây không icon -> kéo không bắt đầu, không báo lỗi).
// - Ảnh png: icon là chính tấm ảnh (200x200).
// - Tải ảnh lỗi: hiện thông báo "Couldn't load that image to drag"
//   (trước đây lỗi chỉ ghi log, ngoài mặt không thấy gì).
// - Hồi quy: kéo thumbnail GameBanana thật vẫn tới gbStartDragImage
//   (trong máy ảo tải https lỗi TLS nên chỉ tới bước gọi hàm).
// Kéo thật bằng chuột CDP; startDrag được chặn lại (stub) vì gọi thật
// trên Linux sẽ kẹt vòng lặp kéo. Stub ghi lại icon nhận được.
// Chạy (cwd = repo root; máy chủ nội bộ phải đang chạy):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-drag-icon.js
const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const DRAG_TMP = '/tmp/xxmm-gb-drag';
const LOCAL_WEBP = 'http://127.0.0.1:8902/test.webp';
const LOCAL_PNG = 'http://127.0.0.1:8902/test.png';
const DEAD_URL = 'http://127.0.0.1:9/dead.png';
const HARD_TIMEOUT_MS = 600000;

const results = [];
const consoleErrors = [];
const dragStubs = [];
const snacks = [];
function check(name, ok, detail) {
    results.push({ name, ok: !!ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
}

ipcMain.on('snack', (_e, message, type) => {
    snacks.push({ message: String(message), type });
    console.log('SNACK: ' + message + ' (' + type + ')');
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

    // Chặn startDrag: ghi lại file + icon (rỗng hay không, cỡ bao nhiêu).
    wc.startDrag = (item) => {
        let iconInfo = null;
        try {
            if (item && item.icon) {
                iconInfo = item.icon.isEmpty() ? 'EMPTY' : JSON.stringify(item.icon.getSize());
            }
        } catch (e) { iconInfo = 'ERR ' + e.message; }
        dragStubs.push({ file: item && item.file ? String(item.file) : null, icon: iconInfo, t: Date.now() });
        console.log('START-DRAG-STUB file=' + (item && item.file) + ' icon=' + iconInfo);
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
    const dragFetchCalled = (urlPart) => consoleErrors.some((m) =>
        m.includes('gbStartDragImage failed for') && (!urlPart || m.includes(urlPart)));
    async function waitForSnack(fromIndex, timeoutMs) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            const found = snacks.slice(fromIndex).find((s) =>
                s.message === "Couldn't load that image to drag" && s.type === 'error');
            if (found) return found;
            await sleep(300);
        }
        return null;
    }

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
        async function realDragAt(gx, gy, label, expectUrlPart) {
            dragStubs.length = 0;
            const beforeErrs = consoleErrors.length;
            await gjs(LISTENER_CODE);
            await gjs(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));`);
            await sleep(200);
            const live = await gjs(`!!(window.__dragProbe && window.__dragProbe.mousedown && window.__dragProbe.mousedown.tag === 'BODY')`);
            await gjs(`window.__dragProbe = { mousedown: null, dragstart: null, dragstartDefaultPrevented: null };`);
            if (!live) return { outcome: 'no-listener', probe: null };
            const t0 = Date.now();
            await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: gx, y: gy, button: 'left', clickCount: 1 });
            await sleep(150);
            for (let i = 1; i <= 10; i++) {
                await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: gx + i * 12, y: gy + i * 6, button: 'left' });
                await sleep(60);
            }
            const outcome = await waitFor(() => {
                if (dragStubs.length > 0) return 'stub';
                if (dragFetchCalled(expectUrlPart)) return 'fetch-called';
                return null;
            }, 15000, 'drag chain ' + label);
            const probe = await gjs(`window.__dragProbe`);
            const newErrs = consoleErrors.slice(beforeErrs);
            const latency = dragStubs.length > 0 ? (dragStubs[0].t - t0) + 'ms' : '-';
            console.log(`INFO ${label} outcome=${outcome} latency=${latency} mousedown=${JSON.stringify(probe && probe.mousedown)} dragstart=${JSON.stringify(probe && probe.dragstart)} prevented=${probe && probe.dragstartDefaultPrevented} stub=${JSON.stringify(dragStubs)} newErrs=${JSON.stringify(newErrs)}`);
            await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: gx + 120, y: gy + 60, button: 'left', clickCount: 1 });
            await sleep(300);
            return { outcome, probe };
        }
        // Về lại trang danh sách game (mỗi cú kéo thả chuột trên thẻ link
        // lại bấm vào link -> sang trang mod; tải lại trang danh sách để
        // mỗi lần kiểm bắt đầu từ trạng thái đã biết, có lưới thumbnail).
        async function loadListPage() {
            await gjs(`window.location.href = 'https://gamebanana.com/games/19567'`);
            const loaded = await waitFor(async () => {
                try {
                    const st = await gjs(`document.readyState`);
                    const n = await gjs(`document.querySelectorAll('a[href*="/mods/"] img').length`);
                    return st === 'complete' && n > 3 ? true : null;
                } catch (_e) { return null; }
            }, 60000, 'list page reloaded');
            if (!loaded) return false;
            return waitFor(async () => {
                try {
                    return await gjs(`(function () {
                        const imgs = [...document.querySelectorAll('a[href*="/mods/"] img')];
                        const vis = imgs.some((im) => {
                            const r = im.getBoundingClientRect();
                            return r.width >= 150 && r.top >= 0 && r.bottom <= window.innerHeight;
                        });
                        if (vis) return true;
                        window.scrollBy(0, 600);
                        return null;
                    })()`);
                } catch (_e) { return null; }
            }, 30000, 'grid in view');
        }

        // Chọn ảnh kéo được: mọi ảnh trong khung nhìn (không chỉ thumbnail
        // trong link — sau cú kéo lưới, trang đã sang trang mod nên không
        // còn thumbnail lưới trong khung nhìn), loại nền trang (rộng quá
        // 600 / chứa 'background', hay bị lớp phủ che như vụ v1), đo lại
        // đúng lúc kéo + kiểm điểm kéo nằm trên chính ảnh đó. Trang mod
        // tải ảnh chậm nên đợi tới khi có ảnh kéo được.
        async function pickDraggableThumb() {
            const srcs = await waitFor(async () => {
                try {
                    const list = await gjs(`(function () {
                        return [...document.querySelectorAll('img')].filter((im) => {
                            const r = im.getBoundingClientRect();
                            const src = im.currentSrc || im.src || '';
                            // Chỉ cần ĐIỂM GIỮA trong khung nhìn (ảnh xem
                            // trước trên trang mod hay bị cắt nửa dưới) —
                            // scrollIntoView sau sẽ đưa cả ảnh vào khung.
                            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                            return r.width >= 150 && r.width <= 600 && r.height >= 80 && r.height <= 400 &&
                                cx >= 0 && cx <= window.innerWidth && cy >= 0 && cy <= window.innerHeight &&
                                src.includes('images.gamebanana.com') && !src.includes('background') &&
                                im.complete && im.naturalWidth > 0;
                        }).map((im) => (im.currentSrc || im.src).slice(0, 200));
                    })()`);
                    return list && list.length > 0 ? list : null;
                } catch (_e) { return null; }
            }, 30000, 'draggable image candidates');
            if (!srcs) return null;
            for (const src of srcs.slice(0, 5)) {
                await gjs(`(function () {
                    const im = [...document.querySelectorAll('img')].find((e) =>
                        (e.currentSrc || e.src || '') === ${JSON.stringify(src)});
                    if (im) im.scrollIntoView({ block: 'center' });
                })()`);
                await sleep(900);
                const verified = await gjs(`(function () {
                    const im = [...document.querySelectorAll('img')].find((e) =>
                        (e.currentSrc || e.src || '') === ${JSON.stringify(src)});
                    if (!im) return null;
                    const r = im.getBoundingClientRect();
                    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
                    const el = document.elementFromPoint(x, y);
                    if (!el || !el.closest || !el.closest('img')) return null;
                    return { x, y, w: Math.round(r.width), h: Math.round(r.height) };
                })()`);
                if (verified) return verified;
            }
            return null;
        }
        async function swapImg(url) {
            const picked = await pickDraggableThumb();
            if (!picked) return null;
            await gjs(`(function () {
                const el = document.elementFromPoint(${picked.x}, ${picked.y});
                const im = el && el.closest ? el.closest('img') : null;
                if (!im) return;
                im.removeAttribute('srcset');
                im.src = ${JSON.stringify(url)};
            })()`);
            return waitFor(async () => {
                try {
                    return await gjs(`(function () {
                        const im = [...document.querySelectorAll('img')].find((e) =>
                            (e.currentSrc || '') === ${JSON.stringify(url)} &&
                            e.complete && e.naturalWidth > 0);
                        if (!im) return null;
                        const r = im.getBoundingClientRect();
                        if (r.width < 100) return null;
                        const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
                        const el = document.elementFromPoint(x, y);
                        if (!el || !el.closest || !el.closest('img')) return null;
                        return { x, y, w: Math.round(r.width), h: Math.round(r.height) };
                    })()`);
                } catch (_e) { return null; }
            }, 15000, 'swapped image loaded ' + url);
        }

        const primePt = await gjs(`(function () {
            for (let y = 100; y < window.innerHeight; y += 60) {
                const el = document.elementFromPoint(20, y);
                if (el && (el.tagName === 'BODY' || el.tagName === 'HTML')) return { x: 20, y };
            }
            return { x: 20, y: 100 };
        })()`);
        await cdpClick(primePt.x, primePt.y);

        // ---- A. Hồi quy: thumbnail GameBanana thật vẫn tới gbStartDragImage ----
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
                        cand[0].scrollIntoView({ block: 'center' });
                        return { src: (cand[0].currentSrc || cand[0].src).slice(0, 120) };
                    }
                    window.scrollBy(0, 600);
                    return null;
                })()`);
            } catch (_e) { return null; }
        }, 60000, 'grid thumbnail visible');
        await sleep(1200);
        const gridPos = gridThumb ? await gjs(`(function () {
            const im = [...document.querySelectorAll('a[href*="/mods/"] img')].find((e) =>
                (e.currentSrc || e.src || '') === ${JSON.stringify(gridThumb.src)});
            if (!im) return null;
            const r = im.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`) : null;
        check('grid-thumb-picked', !!(gridThumb && gridPos), JSON.stringify(gridPos));
        if (gridPos) {
            const snacksBefore = snacks.length;
            const r = await realDragAt(gridPos.x, gridPos.y, 'real-drag-grid', 'gamebanana');
            check('grid-dragstart-fires', !!(r.probe && r.probe.dragstart),
                JSON.stringify(r.probe && r.probe.dragstart));
            check('grid-preload-prevents', r.probe && r.probe.dragstartDefaultPrevented === true,
                'prevented=' + (r.probe && r.probe.dragstartDefaultPrevented));
            check('grid-gbStartDragImage-called', r.outcome === 'fetch-called',
                'outcome=' + r.outcome);
            // Tải https lỗi trong máy ảo -> phải có thông báo lỗi cho anh thấy.
            const toast = await waitForSnack(snacksBefore, 8000);
            check('grid-failed-download-toasts', !!toast, JSON.stringify(snacks.slice(snacksBefore)));
        }

        // ---- B. Ảnh webp: icon kéo phải là ô vàng dự phòng 64x64 ----
        check('list-reload-webp', await loadListPage());
        const webpPos = await swapImg(LOCAL_WEBP);
        console.log('INFO webp-pos: ' + JSON.stringify(webpPos));
        check('webp-swapped', !!webpPos, JSON.stringify(webpPos));
        if (webpPos) {
            const r = await realDragAt(webpPos.x, webpPos.y, 'real-drag-webp', '127.0.0.1');
            check('webp-dragstart-fires', !!(r.probe && r.probe.dragstart));
            check('webp-startdrag-called', r.outcome === 'stub', 'outcome=' + r.outcome);
            const icon = dragStubs.length > 0 ? dragStubs[0].icon : null;
            check('webp-icon-fallback-64', icon === '{"width":64,"height":64}', 'icon=' + icon);
            check('webp-temp-file-webp', dragStubs.length > 0 && dragStubs[0].file.endsWith('.webp'),
                dragStubs.length > 0 ? dragStubs[0].file : 'none');
        }

        // ---- C. Ảnh png: icon kéo là chính tấm ảnh 200x200 ----
        check('list-reload-png', await loadListPage());
        const pngPos = await swapImg(LOCAL_PNG);
        console.log('INFO png-pos: ' + JSON.stringify(pngPos));
        check('png-swapped', !!pngPos, JSON.stringify(pngPos));
        if (pngPos) {
            const r = await realDragAt(pngPos.x, pngPos.y, 'real-drag-png', '127.0.0.1');
            check('png-startdrag-called', r.outcome === 'stub', 'outcome=' + r.outcome);
            const icon = dragStubs.length > 0 ? dragStubs[0].icon : null;
            check('png-icon-real-image', icon === '{"width":200,"height":200}', 'icon=' + icon);
        }

        // (Ảnh tải lỗi đã kiểm ở mục A: tải lỗi -> thông báo lỗi hiện lên
        // và startDrag không được gọi — cùng đường code với địa chỉ chết.)

        try { dbg.detach(); } catch (_e) { /* ignore */ }
        await shot('shot-drag-icon-end.png');
        finish(results.every((r) => r.ok) ? 0 : 1, 'probe-drag-icon done');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'probe error');
    }
});
