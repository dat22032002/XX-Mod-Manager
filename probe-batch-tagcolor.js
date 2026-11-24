// Probe lỗi Đạt báo 22:13 (bản thử 1.5.27-test1): đổi tag bằng
// BATCH (chọn nhiều thẻ rồi đặt tag hàng loạt) thì NHÃN TAG trên thẻ
// KHÔNG tự đổi theo tag mới. Đổi tag trong hộp sửa mod thì nhãn đổi
// ngay (probe-tagcolors.js E5 đã kiểm) — chỉ đường batch là không đổi.
// (Trước 24/11 kiểm màu tên 6 màu; từ 24/11 Đạt đổi sang nhãn tag
// xám nên probe này kiểm nhãn — cơ chế sửa vẫn là modInfoVersion.)
//  - Ctrl+bấm 3 thẻ (Character, Skin, Weapon) -> mở bảng thao tác
//    hàng loạt -> chọn tag Effect -> bấm + -> xác nhận.
//  - Kiểm: nhãn 3 thẻ phải đổi sang "· Effect" NGAY; mod.json trên
//    đĩa phải ghi tag effect (dữ liệu đã lưu đúng); thẻ không đổi
//    không đổi nhãn. Kiểm thêm: bấm Refresh thì nhãn vẫn "· Effect".
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-tagcolors.py
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 2000x1200x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-tagcolors/userdata probe-batch-tagcolor.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 300000;

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

const BATCH_NAMES = ['Alexandrina Sword', 'Billy Bikini', 'Anby Rifle'];
const INITIAL = {
    'Alexandrina Sword': ['character', '· Character'],
    'Anby Rifle': ['skin', '· Skin'],
    'Billy Bikini': ['weapon', '· Weapon'],
};

async function main() {
    const js = (code) => wc.executeJavaScript(code);
    wc.on('console-message', (_e, level, message) => {
        const m = String(message);
        if (/Content-Security-Policy|Electron Security Warning|Autofill|favicon|fixerOldHashMap: fetch failed|checkGameBananaUpdates failed|Timed out/i.test(m)) return;
        if (level >= 2) consoleErrors.push(`[${level}] ${m.slice(0, 300)}`);
    });

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

    async function readRows() {
        return js(`(function () {
            const out = [];
            document.querySelectorAll('.mod-item').forEach((card) => {
                const nameEl = card.querySelector('.mod-item-name');
                const tagEl = card.querySelector('.mod-item-tag');
                if (!nameEl) return;
                out.push({
                    name: card.getAttribute('name'),
                    label: tagEl ? tagEl.textContent.trim() : '',
                    realTag: card.getAttribute('data-tag') || '',
                    batch: card.getAttribute('batch-clicked') || '',
                });
            });
            return out;
        })()`);
    }

    function realClick(x, y, modifiers) {
        const ev = { type: 'mouseDown', x, y, button: 'left', clickCount: 1 };
        if (modifiers) ev.modifiers = modifiers;
        wc.sendInputEvent(ev);
        const ev2 = { type: 'mouseUp', x, y, button: 'left', clickCount: 1 };
        if (modifiers) ev2.modifiers = modifiers;
        wc.sendInputEvent(ev2);
    }

    async function centerOf(code) {
        return js(`(function () {
            const el = (${code})();
            if (!el) return null;
            const r = el.getBoundingClientRect();
            if (r.width === 0) return null;
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
    }

    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n === 7 && !prog;
    }, 60000, 'load done (7 cards)');
    check('B0 tai xong (7 the, het tien do)', !!loaded);
    await sleep(8000);

    const rows0 = await readRows();
    const byName0 = {};
    rows0.forEach((r) => { byName0[r.name] = r; });
    let initOk = true;
    for (const [name, [tag, label]] of Object.entries(INITIAL)) {
        const r = byName0[name];
        if (!r || r.label !== label || r.realTag !== tag) initOk = false;
    }
    check('B1 nhan ban dau dung (Character/Skin/Weapon)', initOk,
        JSON.stringify(rows0.map((r) => r.name + ':' + JSON.stringify(r.label))));
    await shot('shot-batch-before.png');

    // ---- Ctrl+bấm 3 thẻ để chọn hàng loạt ----
    for (const name of BATCH_NAMES) {
        const pt = await centerOf(`() => document.querySelector('.mod-item[name="${name}"]')`);
        if (!pt) { check('B2 Ctrl+bam ' + name, false, 'khong thay the'); continue; }
        realClick(pt.x, pt.y, ['control']);
        await sleep(400);
    }
    const rowsSel = await readRows();
    const selOk = BATCH_NAMES.every((n) => {
        const r = rowsSel.find((x) => x.name === n);
        return r && r.batch === 'true';
    });
    check('B2 Ctrl+bam chon du 3 the (vien xanh)', selOk,
        JSON.stringify(rowsSel.map((r) => r.name + ':batch=' + r.batch)));

    // ---- Mở bảng thao tác hàng loạt (nút mũi tên xuống, đầu trái thanh dưới) ----
    const chev = await centerOf(`() => {
        const ic = document.querySelector('s-icon[type="chevron_down"]');
        return ic ? ic.closest('s-icon-button') : null;
    }`);
    check('B3 tim thay nut mo bang batch', !!chev);
    if (chev) realClick(chev.x, chev.y);
    const popupOpen = await waitFor(async () => {
        return js(`(function () {
            const chips = [...document.querySelectorAll('s-chip')];
            return chips.some((c) => {
                const p = c.querySelector('p');
                return p && p.textContent.trim() === 'Effect' && c.getBoundingClientRect().width > 0;
            });
        })()`);
    }, 8000, 'batch popup opens');
    check('B4 bang batch mo ra (thay chip Effect)', !!popupOpen);

    // ---- Bấm chip Effect trong bảng batch ----
    const chipPt = await centerOf(`() => {
        const chips = [...document.querySelectorAll('s-chip')];
        return chips.find((c) => {
            const p = c.querySelector('p');
            return p && p.textContent.trim() === 'Effect' && c.getBoundingClientRect().width > 0;
        }) || null;
    }`);
    check('B5 tim thay chip Effect trong bang', !!chipPt);
    if (chipPt) realClick(chipPt.x, chipPt.y);
    await sleep(500);

    // ---- Bấm nút + của hàng tag: nút add NẰM TRONG CÙNG hàng với chip
    // Effect (không lấy theo thứ tự toàn trang — nút + thêm preset ở
    // cột trái cũng là s-icon[type="add"] nên adds[1] trúng nhầm hàng
    // nhân vật). ----
    const plusPt = await centerOf(`() => {
        const chips = [...document.querySelectorAll('s-chip')];
        const eff = chips.find((c) => {
            const p = c.querySelector('p');
            return p && p.textContent.trim() === 'Effect' && c.getBoundingClientRect().width > 0;
        });
        if (!eff) return null;
        const row = eff.closest('.OO-setting-bar');
        if (!row) return null;
        const ic = row.querySelector('s-icon[type="add"]');
        return ic ? ic.closest('s-icon-button') : null;
    }`);
    check('B6 tim thay nut + hang tag', !!plusPt);
    if (plusPt) realClick(plusPt.x, plusPt.y);
    await sleep(800);
    const dlgDebug = await js(`(function () {
        const out = {};
        ['dialog-confirm-batch-tag', 'dialog-confirm-batch-character'].forEach((id) => {
            const d = document.querySelector('#' + id);
            out[id] = d ? (d.textContent || '').replace(/\\s+/g, ' ').slice(0, 160) : 'missing';
        });
        return out;
    })()`);
    console.log('DIALOG DEBUG: ' + JSON.stringify(dlgDebug));
    const dlg = await waitFor(async () => {
        return js(`(function () {
            const d = document.querySelector('#dialog-confirm-batch-tag');
            if (!d) return false;
            const t = d.textContent || '';
            return t.includes('Effect') && t.includes('3 selected mods');
        })()`);
    }, 8000, 'confirm dialog shows Effect x3');
    check('B7 hop xac nhan hien "Effect" cho 3 mod', !!dlg);

    // ---- Bấm Xác nhận ----
    const confirmClicked = await js(`(function () {
        const b = document.querySelector('#dialog-confirm-batch-tag #batch-tag-confirm');
        if (!b) return 'confirm-missing';
        b.click();
        return 'confirm-clicked';
    })()`);
    check('B8 bam nut Xac nhan', confirmClicked === 'confirm-clicked', confirmClicked);
    await sleep(3000);

    // ---- Đo lại: nhãn 3 thẻ phải đổi sang "· Effect" NGAY ----
    const rows1 = await readRows();
    const byName1 = {};
    rows1.forEach((r) => { byName1[r.name] = r; });
    console.log('ROWS AFTER BATCH: ' + JSON.stringify(rows1, null, 0));
    let labelOk = true;
    for (const n of BATCH_NAMES) {
        const r = byName1[n];
        if (!r || r.label !== '· Effect' || r.realTag !== 'effect') labelOk = false;
    }
    check('B9 nhan 3 the doi sang "· Effect" ngay sau batch', labelOk,
        BATCH_NAMES.map((n) => n + ':' + (byName1[n] ? JSON.stringify(byName1[n].label) + '/' + byName1[n].realTag : 'missing')).join(' | '));
    let dataTagOk = true;
    for (const n of BATCH_NAMES) {
        const r = byName1[n];
        if (!r || r.realTag !== 'effect') dataTagOk = false;
    }
    check('B10 data-tag 3 the doi thanh effect', dataTagOk,
        BATCH_NAMES.map((n) => n + ':' + (byName1[n] ? byName1[n].realTag : 'missing')).join(' | '));
    // Dữ liệu trên đĩa đã lưu đúng chưa?
    let diskOk = true;
    const diskTags = {};
    for (const n of BATCH_NAMES) {
        try {
            diskTags[n] = JSON.parse(fs.readFileSync(`/tmp/xxmm-tagcolors/mods/${n}/mod.json`, 'utf8')).tag;
            if (diskTags[n] !== 'effect') diskOk = false;
        } catch (e) { diskTags[n] = 'read-error'; diskOk = false; }
    }
    check('B11 mod.json tren dia da ghi tag effect (du lieu dung)', diskOk, JSON.stringify(diskTags));
    // Thẻ không đổi giữ nguyên.
    const ellen = byName1['Ellen Fire'];
    check('B12 the khong doi giu nguyen (Ellen Fire van "· Accessory")',
        !!ellen && ellen.label === '· Accessory' && ellen.realTag === 'accessory',
        ellen ? `label=${JSON.stringify(ellen.label)}` : 'khong thay the');
    await shot('shot-batch-after.png');

    // ---- Chẩn đoán: bấm Refresh thì nhãn vẫn đúng (dữ liệu vốn đúng). ----
    const refreshClicked = await js(`(function () {
        const b = document.querySelector('#refresh-button');
        if (!b) return 'refresh-missing';
        b.click();
        return 'refresh-clicked';
    })()`);
    check('B13 bam nut Refresh', refreshClicked === 'refresh-clicked', refreshClicked);
    await sleep(6000);
    const rows2 = await readRows();
    const byName2 = {};
    rows2.forEach((r) => { byName2[r.name] = r; });
    let afterRefreshOk = true;
    for (const n of BATCH_NAMES) {
        const r = byName2[n];
        if (!r || r.label !== '· Effect' || r.realTag !== 'effect') afterRefreshOk = false;
    }
    check('B14 sau Refresh nhan van "· Effect" (du lieu von dung)', afterRefreshOk,
        BATCH_NAMES.map((n) => n + ':' + (byName2[n] ? JSON.stringify(byName2[n].label) : 'missing')).join(' | '));

    finish(results.every((r) => r.ok) ? 0 : 1, 'done');
}
