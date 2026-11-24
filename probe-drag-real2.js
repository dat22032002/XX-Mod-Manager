// Probe kéo-thật v2 (1.5.25-test5): kiểm từng khâu đường kéo ảnh từ
// trang Banana bằng cử chỉ chuột thật. V1 phát hiện 2 vấn đề về probe:
//  (a) tải https trong máy ảo lỗi TLS EPROTO (proxy máy ảo) nên chuỗi
//      kéo https không bao giờ tới được startDrag ở đây — v2 phân biệt
//      "gbStartDragImage ĐÃ ĐƯỢC GỌI" (bắt qua thông báo lỗi tải) với
//      "chuỗi chạy tới startDrag" (chỉ kiểm bằng ảnh máy chủ nội bộ
//      http://127.0.0.1:8902/test.png, không qua TLS);
//  (b) chọn nhầm ảnh nền trang + link liệt kê mod thay vì trang mod —
//      v2 lọc đúng link /mods/<số> và loại ảnh nền hồ sơ.
// Chạy (cwd = repo root; máy chủ nội bộ phải đang chạy):
//   python3 -m http.server 8902 --bind 127.0.0.1  (thư mục drag-server)
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-drag-real2.js
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
    if (guestConsole.length > 0) {
        console.log('GUEST CONSOLE (' + guestConsole.length + '):');
        guestConsole.slice(0, 10).forEach((e) => console.log('  ' + e));
    }
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}

setTimeout(() => finish(1, 'HARD TIMEOUT'), HARD_TIMEOUT_MS);

require('./electron/main.js');

// Nghe lén dragstart/mousedown trong khung (đăng ký lại sau mỗi lần
// sang trang vì điều hướng làm mất listener).
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
    // gbStartDragImage có được gọi không — trong máy ảo tải https lỗi
    // TLS nên chỉ bắt được qua thông báo lỗi "failed for <url>".
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
        // ---- A. Khởi động + mở trang Banana ----
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
        console.log('INFO guest-url: ' + await gjs(`location.href`));
        await gjs(LISTENER_CODE);

        // Kéo thật tại 1 điểm: chuột xuống + rê từng bước qua ngưỡng kéo.
        // Trả về kết quả nghe lén + trạng thái chuỗi xử lý.
        async function realDragAt(x, y, label, expectUrlPart) {
            dragIpc.length = 0;
            dragStubs.length = 0;
            const beforeErrs = consoleErrors.length;
            await gjs(`window.__dragProbe = { mousedown: null, dragstart: null, dragstartDefaultPrevented: null };`);
            // Điểm bấm thực tế là thẻ gì (kiểm tra tọa độ đúng ảnh)?
            const hit = await gjs(`(function () {
                const el = document.elementFromPoint(${x}, ${y});
                if (!el) return null;
                return { tag: el.tagName, inImg: !!(el.closest && el.closest('img')),
                    imgSrc: (el.closest && el.closest('img') ? (el.closest('img').currentSrc || el.closest('img').src || '') : '').slice(0, 100) };
            })()`);
            console.log(`INFO ${label} elementFromPoint=${JSON.stringify(hit)}`);
            guest.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
            await sleep(150);
            for (let i = 1; i <= 10; i++) {
                guest.sendInputEvent({ type: 'mouseMove', x: x + i * 12, y: y + i * 6, button: 'left' });
                await sleep(50);
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
            guest.sendInputEvent({ type: 'mouseUp', x: x + 120, y: y + 60, button: 'left', clickCount: 1 });
            await sleep(300);
            return { outcome, probe, hit };
        }

        // ---- B. Kéo thật 1 thumbnail mod trên trang danh sách ----
        const thumb = await gjs(`(function () {
            const imgs = [...document.querySelectorAll('img')];
            const cand = imgs.filter((im) => {
                const r = im.getBoundingClientRect();
                return r.width >= 100 && r.width <= 400 && r.height >= 60 &&
                    r.top >= 0 && r.bottom <= window.innerHeight &&
                    (im.currentSrc || im.src || '').includes('images.gamebanana.com') &&
                    im.complete && im.naturalWidth > 0;
            });
            if (!cand.length) return null;
            const im = cand[0];
            im.scrollIntoView({ block: 'center' });
            const r = im.getBoundingClientRect();
            return { src: (im.currentSrc || im.src).slice(0, 120),
                x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                w: Math.round(r.width), h: Math.round(r.height) };
        })()`);
        console.log('INFO thumb: ' + JSON.stringify(thumb));
        check('thumb-picked', !!thumb, thumb ? thumb.src : 'none');
        if (thumb) {
            const r = await realDragAt(thumb.x, thumb.y, 'real-drag-thumb', 'gamebanana');
            check('thumb-mousedown-hits-img', !!(r.probe && r.probe.mousedown && r.probe.mousedown.inImg),
                JSON.stringify(r.probe && r.probe.mousedown));
            check('thumb-dragstart-fires', !!(r.probe && r.probe.dragstart),
                JSON.stringify(r.probe && r.probe.dragstart));
            check('thumb-preload-prevents', r.probe && r.probe.dragstartDefaultPrevented === true,
                'prevented=' + (r.probe && r.probe.dragstartDefaultPrevented));
            check('thumb-gbStartDragImage-called', r.outcome === 'fetch-called' || r.outcome === 'tmpfile' || r.outcome === 'ipc' || r.outcome === 'stub',
                'outcome=' + r.outcome);
        }
        await shot('shot-drag-real2-list.png');

        // ---- C. Đối chứng chuỗi đầy đủ: ảnh máy chủ nội bộ (không TLS) ----
        // Chèn ảnh nội bộ vào đúng trang Banana đang mở (preload vẫn nghe
        // trên document này) rồi kéo thật — chuỗi phải chạy tới startDrag.
        await gjs(`(function () {
            const old = document.getElementById('xxmm-drag-test-img');
            if (old) old.remove();
            const im = document.createElement('img');
            im.id = 'xxmm-drag-test-img';
            im.src = ${JSON.stringify(LOCAL_IMG)};
            im.style.cssText = 'position:fixed;left:60px;top:60px;width:200px;height:200px;z-index:2147483647;border:3px solid red;';
            document.body.appendChild(im);
        })()`);
        await sleep(1500);
        const localReady = await gjs(`(function () {
            const im = document.getElementById('xxmm-drag-test-img');
            if (!im) return null;
            const r = im.getBoundingClientRect();
            return { loaded: im.complete && im.naturalWidth > 0,
                x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
        console.log('INFO local-img: ' + JSON.stringify(localReady));
        check('local-img-ready', !!(localReady && localReady.loaded), JSON.stringify(localReady));
        if (localReady) {
            const r = await realDragAt(localReady.x, localReady.y, 'real-drag-local', '127.0.0.1');
            check('local-dragstart-fires', !!(r.probe && r.probe.dragstart),
                JSON.stringify(r.probe && r.probe.dragstart));
            check('local-preload-prevents', r.probe && r.probe.dragstartDefaultPrevented === true,
                'prevented=' + (r.probe && r.probe.dragstartDefaultPrevented));
            check('local-temp-file', listTmp().length > 0, JSON.stringify(listTmp()));
            check('local-ipc-sent', dragIpc.length > 0, JSON.stringify(dragIpc));
            check('local-startdrag-called', dragStubs.length > 0, JSON.stringify(dragStubs));
        }
        await shot('shot-drag-real2-local.png');

        // ---- D. Kéo thật ảnh lớn trên 1 trang mod thật ----
        const modHref = await gjs(`(function () {
            const as = [...document.querySelectorAll('a[href*="/mods/"]')];
            const a = as.find((e) => /\\/mods\\/\\d+/.test(e.getAttribute('href') || ''));
            return a ? a.href : null;
        })()`);
        console.log('INFO mod-href: ' + modHref);
        if (modHref) {
            await js(`(function () {
                const wv = document.querySelector('webview');
                if (wv) wv.loadURL(${JSON.stringify(modHref)});
            })()`);
            const modLoaded = await waitFor(async () => {
                try {
                    const st = await gjs(`document.readyState`);
                    const n = await gjs(`document.querySelectorAll('img').length`);
                    return st === 'complete' && n > 3 ? ('imgs=' + n) : null;
                } catch (_e) { return null; }
            }, 60000, 'mod page loaded');
            check('mod-page-loaded', !!modLoaded, modLoaded);
            console.log('INFO mod-url: ' + await gjs(`location.href`));
            await gjs(LISTENER_CODE);
            await shot('shot-drag-real2-modpage.png');
            const big = await gjs(`(function () {
                const imgs = [...document.querySelectorAll('img')];
                const cand = imgs.filter((im) => {
                    const r = im.getBoundingClientRect();
                    const src = im.currentSrc || im.src || '';
                    return r.width >= 200 && r.height >= 100 &&
                        r.top >= 0 && r.bottom <= window.innerHeight &&
                        src.includes('images.gamebanana.com') &&
                        !src.includes('/Profile/Background/') &&
                        im.complete && im.naturalWidth > 0;
                });
                cand.sort((a, b) => {
                    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
                    return (rb.width * rb.height) - (ra.width * ra.height);
                });
                if (!cand.length) return null;
                const im = cand[0];
                im.scrollIntoView({ block: 'center' });
                const r = im.getBoundingClientRect();
                return { src: (im.currentSrc || im.src).slice(0, 120),
                    x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                    w: Math.round(r.width), h: Math.round(r.height) };
            })()`);
            console.log('INFO modpage-img: ' + JSON.stringify(big));
            check('modpage-img-picked', !!big, big ? big.src : 'none');
            if (big) {
                const r = await realDragAt(big.x, big.y, 'real-drag-modpage', 'gamebanana');
                check('modpage-mousedown-hits-img', !!(r.probe && r.probe.mousedown && r.probe.mousedown.inImg),
                    JSON.stringify(r.probe && r.probe.mousedown));
                check('modpage-dragstart-fires', !!(r.probe && r.probe.dragstart),
                    JSON.stringify(r.probe && r.probe.dragstart));
                check('modpage-preload-prevents', r.probe && r.probe.dragstartDefaultPrevented === true,
                    'prevented=' + (r.probe && r.probe.dragstartDefaultPrevented));
                check('modpage-gbStartDragImage-called', r.outcome === 'fetch-called' || r.outcome === 'tmpfile' || r.outcome === 'ipc' || r.outcome === 'stub',
                    'outcome=' + r.outcome);
            }
        } else {
            check('mod-page-loaded', false, 'no /mods/<id> link found');
        }

        await shot('shot-drag-real2-end.png');
        finish(results.every((r) => r.ok) ? 0 : 1, 'probe-drag-real2 done');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'probe error');
    }
});
