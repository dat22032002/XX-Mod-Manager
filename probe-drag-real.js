// Probe kéo-thật (1.5.25-test5): kiểm từng khâu đường kéo ảnh từ trang
// Banana bằng CỬ CHỈ CHUỘT THẬT (sendInputEvent) trên khung web thật —
// probe test3 chỉ dùng sự kiện giả (dispatchEvent) nên không bắt được
// lỗi Đạt gặp trên máy thật (12:57: không kéo được ảnh; 12:59: nút bên
// hông chuột CHẠY ĐƯỢC -> preload tải bình thường, lỗi ở khâu kéo).
// Các khâu kiểm:
//  (1) cử chỉ kéo thật có làm bật sự kiện bắt đầu kéo trên ảnh Banana
//      thật không (nghe lén dragstart/mousedown trong khung);
//  (2) preload gửi địa chỉ ảnh qua IPC có tới renderer không (file tạm);
//  (3) gbStartDragImage tải ảnh về file tạm có thành công không;
//  (4) lệnh startDrag có tới tiến trình chính không (stub ghi lại —
//      startDrag thật kẹt trên Linux, không gọi thật);
//  (5) đối chứng: sự kiện giả như test3 vẫn chạy (phân biệt "kéo thật
//      hỏng" với "cả đường kéo hỏng").
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-drag-real.js
const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const DRAG_TMP = '/tmp/xxmm-gb-drag';
const HARD_TIMEOUT_MS = 600000;

const results = [];
const consoleErrors = [];
const guestConsole = [];
const dragIpc = [];   // lệnh 'gb-start-drag' renderer gửi sang main
const dragStubs = []; // lệnh startDrag tới tiến trình chính (stub ghi lại)
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
        guestConsole.slice(0, 20).forEach((e) => console.log('  ' + e));
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

    // startDrag thật kẹt trên Linux (vòng lặp kéo lồng nhau) nên ghi lại
    // bằng stub — giống probe test3: main.js gọi sender.startDrag nên
    // vá đúng phương thức trên đối tượng webContents này là bắt được.
    const realStartDrag = wc.startDrag.bind(wc);
    wc.startDrag = (item) => {
        dragStubs.push(item && item.file ? String(item.file) : JSON.stringify(item));
        console.log('START-DRAG-STUB ' + (item && item.file));
    };
    void realStartDrag;

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

    // Lấy webContents của khung web Banana (guest) qua id của nó.
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
        const guestUrl = await gjs(`location.href`);
        console.log('INFO guest-url: ' + guestUrl);
        await shot('shot-drag-real-list.png');

        // Nghe lén trong khung: mousedown + dragstart có bật thật không,
        // và điểm bắt đầu kéo là thẻ gì (img? link? nền?).
        await gjs(`(function () {
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
        })()`);

        // Kiểm kê ảnh nhìn thấy trên trang danh sách: thẻ nào kéo được.
        const inv = await gjs(`(function () {
            const out = [];
            const imgs = [...document.querySelectorAll('img')];
            for (const im of imgs) {
                const r = im.getBoundingClientRect();
                if (r.width < 40 || r.height < 40) continue;
                if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
                const cs = getComputedStyle(im);
                out.push({
                    src: (im.currentSrc || im.src || '').slice(0, 110),
                    w: Math.round(r.width), h: Math.round(r.height),
                    x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                    draggable: im.draggable,
                    userDrag: cs.getPropertyValue('-webkit-user-drag'),
                    inLink: !!(im.closest && im.closest('a')),
                    loaded: im.complete && im.naturalWidth > 0
                });
                if (out.length >= 8) break;
            }
            return out;
        })()`);
        console.log('INFO visible-imgs: ' + JSON.stringify(inv, null, 1));
        check('has-visible-imgs', Array.isArray(inv) && inv.length > 0, 'n=' + (inv && inv.length));

        // Kéo thật 1 tấm ảnh: chuột thật xuống + rê từng bước qua ngưỡng
        // kéo của Chromium (~4px). Giữ nút trong lúc chờ chuỗi xử lý.
        async function realDragOn(img, label) {
            dragIpc.length = 0;
            dragStubs.length = 0;
            await gjs(`window.__dragProbe = { mousedown: null, dragstart: null, dragstartDefaultPrevented: null };`);
            guest.sendInputEvent({ type: 'mouseDown', x: img.x, y: img.y, button: 'left', clickCount: 1 });
            await sleep(120);
            for (let i = 1; i <= 10; i++) {
                guest.sendInputEvent({ type: 'mouseMove', x: img.x + i * 12, y: img.y + i * 6, button: 'left' });
                await sleep(50);
            }
            const outcome = await waitFor(() => {
                if (dragStubs.length > 0) return 'stub';
                if (dragIpc.length > 0) return 'ipc';
                if (listTmp().length > 0) return 'tmpfile';
                return null;
            }, 10000, 'drag chain ' + label);
            const probe = await gjs(`window.__dragProbe`);
            console.log(`INFO ${label} outcome=${outcome} mousedown=${JSON.stringify(probe && probe.mousedown)} dragstart=${JSON.stringify(probe && probe.dragstart)} prevented=${probe && probe.dragstartDefaultPrevented} tmp=${JSON.stringify(listTmp())} ipc=${JSON.stringify(dragIpc)} stub=${JSON.stringify(dragStubs)}`);
            guest.sendInputEvent({ type: 'mouseUp', x: img.x + 120, y: img.y + 60, button: 'left', clickCount: 1 });
            await sleep(300);
            return { outcome, probe };
        }

        // ---- B. Kéo thật 1 ảnh nhỏ (thumbnail) trên trang danh sách ----
        const thumb = (inv || []).find((i) => i.loaded && i.w >= 100 && i.w <= 500) || (inv || [])[0];
        check('thumb-picked', !!thumb, thumb ? thumb.src : 'none');
        let realOk = false;
        if (thumb) {
            const r = await realDragOn(thumb, 'real-drag-thumb');
            check('real-drag-mousedown-hits-img', !!(r.probe && r.probe.mousedown && r.probe.mousedown.inImg),
                JSON.stringify(r.probe && r.probe.mousedown));
            check('real-drag-dragstart-fires', !!(r.probe && r.probe.dragstart),
                JSON.stringify(r.probe && r.probe.dragstart));
            check('real-drag-preload-prevents', r.probe && r.probe.dragstartDefaultPrevented === true,
                'prevented=' + (r.probe && r.probe.dragstartDefaultPrevented));
            check('real-drag-temp-file', listTmp().length > 0, JSON.stringify(listTmp()));
            check('real-drag-startdrag-called', dragStubs.length > 0, JSON.stringify(dragStubs));
            realOk = dragStubs.length > 0;
        }

        // ---- C. Đối chứng: sự kiện giả như probe test3 ----
        dragIpc.length = 0;
        dragStubs.length = 0;
        if (thumb) {
            await gjs(`(function () {
                const imgs = [...document.querySelectorAll('img')];
                const im = imgs.find((e) => {
                    const r = e.getBoundingClientRect();
                    return r.width >= 100 && r.width <= 500 && r.top >= 0 && r.top < window.innerHeight;
                }) || imgs[0];
                if (!im) return;
                const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true });
                im.dispatchEvent(ev);
            })()`);
            const synOutcome = await waitFor(() => (dragStubs.length > 0 ? 'stub' : null), 10000, 'synthetic drag chain');
            check('synthetic-drag-startdrag-called', synOutcome === 'stub', JSON.stringify(dragStubs));
        }

        // ---- D. Kéo thật ảnh lớn trên trang mod (ảnh bìa hay kéo nhất) ----
        const modHref = await gjs(`(function () {
            const a = document.querySelector('a[href*="/mods/"]');
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
            const modUrl = await gjs(`location.href`);
            console.log('INFO mod-url: ' + modUrl);
            await shot('shot-drag-real-modpage.png');
            // Nghe lén lại sau khi sang trang (listener cũ mất khi điều hướng).
            await gjs(`(function () {
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
            })()`);
            const inv2 = await gjs(`(function () {
                const out = [];
                const imgs = [...document.querySelectorAll('img')];
                for (const im of imgs) {
                    const r = im.getBoundingClientRect();
                    if (r.width < 100 || r.height < 100) continue;
                    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
                    const cs = getComputedStyle(im);
                    out.push({
                        src: (im.currentSrc || im.src || '').slice(0, 110),
                        w: Math.round(r.width), h: Math.round(r.height),
                        x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                        draggable: im.draggable,
                        userDrag: cs.getPropertyValue('-webkit-user-drag'),
                        inLink: !!(im.closest && im.closest('a')),
                        loaded: im.complete && im.naturalWidth > 0
                    });
                }
                out.sort((a, b) => (b.w * b.h) - (a.w * a.h));
                return out.slice(0, 5);
            })()`);
            console.log('INFO modpage-imgs: ' + JSON.stringify(inv2, null, 1));
            const big = (inv2 || [])[0];
            check('modpage-big-img', !!big, big ? big.src : 'none');
            if (big) {
                const r2 = await realDragOn(big, 'real-drag-modpage');
                check('modpage-dragstart-fires', !!(r2.probe && r2.probe.dragstart),
                    JSON.stringify(r2.probe && r2.probe.dragstart));
                check('modpage-drag-temp-file', listTmp().length > 0, JSON.stringify(listTmp()));
                check('modpage-drag-startdrag-called', dragStubs.length > 0, JSON.stringify(dragStubs));
            }
        } else {
            check('mod-page-loaded', false, 'no mod link found on list page');
        }

        await shot('shot-drag-real-end.png');
        finish(results.every((r) => r.ok) ? 0 : 1, 'probe-drag-real done (realOk=' + realOk + ')');
    } catch (e) {
        console.log('PROBE ERROR: ' + (e && e.stack ? e.stack : e));
        finish(1, 'probe error');
    }
});
