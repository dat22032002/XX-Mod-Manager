// Kiểm + chụp 2 đổi 24/11:
//   1. Đổi vị trí tag/dung lượng trên thẻ mod: "Skin · 2 KB" (tag trước).
//   2. Chấm bi hàng nhân vật nhạt như nút Apply: độ mờ 0.1 (was 0.18).
// Kèm kiểm đo: dòng dung lượng thẻ đầu có tag thì tag đứng đầu dòng +
// có dấu "·" + có dung lượng sau tag; ::before hàng nhân vật đúng
// họa tiết gốc ở độ mờ 0.1 ở cả hàng thường lẫn hàng đang chọn.
// Ảnh: shot-tagswap-full.png (mặc định), shot-tagswap-active.png
// (đã bấm chọn hàng đầu, hàng vàng).
// Fixture: /tmp/xxmm-shot-grid48/userdata (46 mod, đã dựng từ trước).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 600000;

const results = [];
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
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}

setTimeout(() => finish(1, 'HARD TIMEOUT'), HARD_TIMEOUT_MS);

require('./electron/main.js');

let win = null;
let wc = null;
let bootStarted = false;

async function shot(name) {
    try {
        const img = await win.capturePage();
        fs.writeFileSync(path.join(SHOTS, name), img.toPNG());
        console.log('shot ' + name);
    } catch (e) { console.log('shot failed ' + name + ': ' + e.message); }
}

const bootTimer = setInterval(() => {
    if (bootStarted) return;
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    win = wins[0];
    wc = win.webContents;
    if (wc.isLoading()) return;
    bootStarted = true;
    clearInterval(bootTimer);
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
    async function mouseMoveTo(x, y) {
        wc.sendInputEvent({ type: 'mouseMove', x: Math.round(x), y: Math.round(y) });
        await sleep(120);
    }
    async function clickAt(x, y) {
        await mouseMoveTo(x, y);
        wc.sendInputEvent({ type: 'mouseDown', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
        await sleep(60);
        wc.sendInputEvent({ type: 'mouseUp', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 });
        await sleep(1000);
    }
    // Đo ::before của 1 hàng nhân vật (theo chỉ số).
    async function measureRow(i) {
        return js(`(function () {
            const rows = document.querySelectorAll('.character-row');
            const row = rows[${i}];
            if (!row) return null;
            const cs = getComputedStyle(row, '::before');
            const csRow = getComputedStyle(row);
            return {
                name: row.querySelector('.character-name') ? row.querySelector('.character-name').textContent : null,
                active: row.classList.contains('active'),
                bgImage: cs.backgroundImage,
                bgSize: cs.backgroundSize,
                bgPos: cs.backgroundPosition,
                opacity: cs.opacity,
                bgColor: csRow.backgroundColor,
            };
        })()`);
    }
    function checkPattern(m, tag) {
        check(tag + ' co hoa tiet radial-gradient', !!m && /radial-gradient/.test(m.bgImage || ''));
        check(tag + ' o luoi 10px + lech 5px', !!m && m.bgSize.split(',').every((s) => s.trim() === '10px 10px') && m.bgPos === '0px 0px, 5px 5px', m ? (m.bgSize + ' | ' + m.bgPos) : '');
        check(tag + ' cham den', !!m && /0,\s*0,\s*0/.test(m.bgImage || ''));
        check(tag + ' do mo 0.1', !!m && m.opacity === '0.1', m ? m.opacity : '');
    }
    // Tìm thẻ đầu tiên có nhãn tag, trả dòng dung lượng + khung hình thẻ.
    async function measureSizeLine() {
        return js(`(function () {
            const cards = document.querySelectorAll('.mod-item');
            for (let i = 0; i < cards.length; i++) {
                const line = cards[i].querySelector('.mod-item-size');
                if (!line) continue;
                const tagSpan = line.querySelector('.mod-item-tag');
                if (!tagSpan || !tagSpan.textContent) continue;
                const cr = cards[i].getBoundingClientRect();
                return {
                    cardIndex: i,
                    lineText: line.textContent,
                    tagText: tagSpan.textContent,
                    rect: { x: Math.round(cr.left), y: Math.round(cr.top), w: Math.round(cr.width), h: Math.round(cr.height) },
                };
            }
            return null;
        })()`);
    }

    // Đợi tải xong: có thẻ mod + khối tiến độ biến mất + có hàng nhân vật.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const rows = await js(`document.querySelectorAll('.character-row').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n > 0 && rows > 0 && !prog;
    }, 60000, 'load done');
    check('C0 tai xong', !!loaded);
    if (!loaded) return finish(1, 'khong tai xong');
    // Đợi dung lượng quét xong: thẻ có tag hiện đủ "Tag · size".
    const sized = await waitFor(async () => {
        const m = await measureSizeLine();
        return m && m.lineText.indexOf('·') > 0 ? m : null;
    }, 60000, 'size scanned');
    check('T0 dung luong quet xong', !!sized, sized ? sized.lineText : '');
    if (sized) {
        console.log('SIZELINE: ' + JSON.stringify(sized));
        check('T1 tag dung dau dong', sized.lineText.indexOf(sized.tagText) === 0, sized.lineText);
        check('T2 co dau cham ngan cach', sized.lineText.indexOf('·') > 0, sized.lineText);
        check('T3 co dung luong sau tag', /\d+(\.\d+)?\s*(B|KB|MB|GB)/.test(sized.lineText), sized.lineText);
        check('T4 dung luong dung sau dau cham', sized.lineText.indexOf('·') < sized.lineText.search(/\d/), sized.lineText);
    } else {
        check('T1 tag dung dau dong', false, 'khong thay the co tag + size');
        check('T2 co dau cham ngan cach', false, '');
        check('T3 co dung luong sau tag', false, '');
        check('T4 dung luong dung sau dau cham', false, '');
    }

    // Đo họa tiết ở hàng thường (chưa chọn).
    const beforePlain = await measureRow(0);
    console.log('BEFORE-PLAIN: ' + JSON.stringify(beforePlain));
    check('C1 hang dau chua chon (nen toi)', !!beforePlain && !beforePlain.active, beforePlain ? beforePlain.bgColor : '');
    checkPattern(beforePlain, 'C2 hang thuong');

    // Đợi thông báo biến mất để ảnh sạch.
    await sleep(8000);
    await mouseMoveTo(700, 770);
    await sleep(500);
    await shot('shot-tagswap-full.png');

    // Bấm chọn hàng đầu tiên bằng chuột thật → hàng vàng lên.
    const c1 = await js(`(function () {
        const row = document.querySelector('.character-row');
        if (!row) return null;
        const r = row.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (c1) {
        await clickAt(c1.x, c1.y);
        await sleep(1200);
        const active = await js(`document.querySelector('.character-row').classList.contains('active')`);
        check('C6 bam chon hang dau tien', active === true, 'active=' + active);
    } else {
        check('C6 bam chon hang dau tien', false, 'khong thay hang');
    }
    // Đo lại họa tiết ở hàng đang chọn (nền vàng).
    const beforeActive = await measureRow(0);
    console.log('BEFORE-ACTIVE: ' + JSON.stringify(beforeActive));
    checkPattern(beforeActive, 'C7 hang dang chon');
    await mouseMoveTo(700, 770);
    await sleep(500);
    await shot('shot-tagswap-active.png');

    const passed = results.filter((r) => r.ok).length;
    finish(passed === results.length ? 0 : 1, 'shot-tagswap xong');
}
