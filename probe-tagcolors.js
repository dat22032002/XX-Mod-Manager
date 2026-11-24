// Probe "nhãn tag nhỏ màu xám dưới tên mod" (Đạt dặn 24/11, thay
// bản tên đổi màu 6 màu 23/11 mà anh chê nhìn khó chịu).
//  - Tên mod về trắng mặc định; tag hiện chung dòng dung lượng
//    ("2 KB · Skin"), 1 màu xám nhạt duy nhất = đúng màu dòng
//    dung lượng (chung dòng vì thẻ Ngang đã chật sẵn: dòng đầu
//    mô tả chỉ còn thừa 1.3px khi thẻ được chọn).
//  - 6 mod đặt tag TRỰC TIẾP trong mod.json + 1 mod không có trường
//    tag -> app tự gán 'character' lúc tải.
//  - Đổi tag qua hộp sửa mod -> nhãn đổi theo ngay.
//  - Đổi tag hàng loạt (Ctrl+chọn) -> nhãn đổi theo ngay, không cần
//    Làm Mới (bản sửa batch 22:20: nhãn phụ thuộc modInfoVersion).
//  - Không cắt chữ: nhãn + dòng đầu mô tả nằm trong khung thẻ,
//    cả Ngang/Dọc, cả thẻ đã chọn.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-tagcolors.py
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 2000x1200x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-tagcolors/userdata probe-tagcolors.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 600000; // 10 phút

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

// [tên mod, tag kỳ vọng, chữ nhãn kỳ vọng (locale en)]
const EXPECTED = [
    ['Alexandrina Sword', 'character', 'Character'],
    ['Anby Rifle', 'skin', 'Skin'],
    ['Billy Bikini', 'weapon', 'Weapon'],
    ['Corin Charm', 'effect', 'Effect'],
    ['Ellen Fire', 'accessory', 'Accessory'],
    ['Grace Maid', 'other', 'Other'],
    ['Lucy Special', 'character', 'Character'],
];
const BATCH_NAMES = ['Alexandrina Sword', 'Billy Bikini', 'Anby Rifle'];
// 6 màu cũ (bản 23/11) — tên KHÔNG được mang màu nào trong này nữa.
const OLD_COLORS = new Set([
    'rgb(255, 213, 79)', 'rgb(244, 143, 177)', 'rgb(255, 138, 101)',
    'rgb(206, 147, 216)', 'rgb(77, 208, 225)', 'rgb(174, 213, 129)',
]);

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
                const sizeEl = card.querySelector('.mod-item-size');
                if (!nameEl) return;
                out.push({
                    name: card.getAttribute('name'),
                    nameColor: getComputedStyle(nameEl).color,
                    label: tagEl ? tagEl.textContent.trim() : '',
                    labelColor: tagEl ? getComputedStyle(tagEl).color : '',
                    labelSize: tagEl ? getComputedStyle(tagEl).fontSize : '',
                    sizeColor: sizeEl ? getComputedStyle(sizeEl).color : '',
                    sizeSize: sizeEl ? getComputedStyle(sizeEl).fontSize : '',
                    sizeLine: sizeEl ? sizeEl.textContent.trim() : '',
                    realTag: card.getAttribute('data-tag') || '',
                    batch: card.getAttribute('batch-clicked') || '',
                });
            });
            return out;
        })()`);
    }

    // Đo không-cắt-chữ trên thẻ đầu tiên: nhãn + dòng đầu mô tả phải
    // nằm trong khung nội dung thẻ (đáy thẻ trừ viền dưới).
    async function measureClip() {
        return js(`(function () {
            const card = document.querySelector('.mod-item');
            if (!card) return null;
            const cs = getComputedStyle(card);
            const cr = card.getBoundingClientRect();
            const borderBottom = parseFloat(cs.borderBottomWidth) || 0;
            const contentBottom = cr.height - borderBottom;
            const tagEl = card.querySelector('.mod-item-tag');
            const desc = card.querySelector('#mod-item-description');
            let descFirstBottom = null;
            if (desc && desc.firstChild) {
                const range = document.createRange();
                range.selectNodeContents(desc);
                const rects = range.getClientRects();
                if (rects.length > 0) descFirstBottom = +(rects[0].bottom - cr.top).toFixed(1);
            }
            const tagR = tagEl ? tagEl.getBoundingClientRect() : null;
            return {
                clicked: card.getAttribute('clicked'),
                contentBottom: +contentBottom.toFixed(1),
                tagBottom: tagR ? +(tagR.bottom - cr.top).toFixed(1) : null,
                descFirstBottom,
            };
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

    async function clickAt(x, y) {
        realClick(Math.round(x), Math.round(y));
        await sleep(1000);
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

    const triggerCenter = `(function () {
        const el = document.querySelector('#view-panel-trigger');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const layoutOptCenter = (label) => `(function () {
        const els = [...document.querySelectorAll('#layout-capsule *')];
        const el = els.find((e) => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(label)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    async function switchLayout(label) {
        const trig = await js(triggerCenter);
        if (trig) await clickAt(trig.x, trig.y);
        await sleep(600);
        const opt = await js(layoutOptCenter(label));
        if (!opt) return false;
        await clickAt(opt.x, opt.y);
        await sleep(1000);
        const trig2 = await js(triggerCenter);
        if (trig2) await clickAt(trig2.x, trig2.y);
        await sleep(600);
        return true;
    }

    async function firstCardCenter() {
        return js(`(function () {
            const c = document.querySelector('.mod-item');
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        })()`);
    }

    // Kiểm nhãn trên toàn bộ 7 thẻ (dùng chung cho cả 2 kiểu thẻ).
    async function checkLabels(prefix) {
        const rows = await readRows();
        console.log('ROWS ' + prefix + ': ' + JSON.stringify(rows, null, 0));
        check(prefix + ' doc du 7 the', rows.length === 7, 'doc duoc ' + rows.length);
        const byName = {};
        rows.forEach((r) => { byName[r.name] = r; });
        let textOk = true;
        for (const [name, tag, label] of EXPECTED) {
            const r = byName[name];
            if (!r || r.label !== '· ' + label || r.realTag !== tag) textOk = false;
        }
        check(prefix + ' 7 nhan dung chu (vd "· Skin") + dung tag',
            textOk, EXPECTED.map(([n]) => n + ':' + (byName[n] ? JSON.stringify(byName[n].label) : 'missing')).join(' | '));
        // Cùng 1 màu xám + đúng màu dòng dung lượng + cùng cỡ chữ.
        const labelColors = new Set(rows.map((r) => r.labelColor));
        const sizeMatch = rows.every((r) => r.labelColor && r.labelColor === r.sizeColor);
        const sizeFontMatch = rows.every((r) => r.labelSize && r.labelSize === r.sizeSize);
        check(prefix + ' 7 nhan cung 1 mau xam = mau dong dung luong, cung co chu',
            labelColors.size === 1 && sizeMatch && sizeFontMatch,
            'labelColors=' + [...labelColors].join(',') + ' sizeColors=' + [...new Set(rows.map((r) => r.sizeColor))].join(',') + ' font=' + [...new Set(rows.map((r) => r.labelSize + '/' + r.sizeSize))].join(','));
        // Tên trắng mặc định: 7 tên cùng 1 màu, không mang màu cũ nào.
        const nameColors = new Set(rows.map((r) => r.nameColor));
        const noOld = rows.every((r) => !OLD_COLORS.has(r.nameColor));
        const labelDiffers = rows.every((r) => r.labelColor !== r.nameColor);
        check(prefix + ' ten ve trang mac dinh (7 ten cung 1 mau, khong mau cu)',
            nameColors.size === 1 && noOld && labelDiffers,
            'nameColor=' + [...nameColors].join(','));
        // Dòng dung lượng giữ định dạng "2 KB · Skin".
        const fmtOk = rows.every((r) => /·/.test(r.sizeLine));
        check(prefix + ' dong dung luong co dang "2 KB · Tag"',
            fmtOk, rows.map((r) => JSON.stringify(r.sizeLine)).join(' | '));
        return byName;
    }

    // Kiểm không-cắt-chữ ở cả 2 trạng thái chọn của thẻ đầu tiên.
    async function checkClip(prefix) {
        const a = await measureClip();
        const c = await firstCardCenter();
        if (c) await clickAt(c.x, c.y);
        const b = await measureClip();
        const toggled = !!a && !!b && a.clicked !== b.clicked;
        const fit = (m) => !!m && m.tagBottom !== null && m.descFirstBottom !== null
            && m.tagBottom <= m.contentBottom && m.descFirstBottom <= m.contentBottom;
        check(prefix + ' khong cat chu (nhan + dong dau mo ta trong khung, ca 2 trang thai chon)',
            toggled && fit(a) && fit(b),
            'A clicked=' + (a && a.clicked) + ' tag=' + (a && a.tagBottom) + ' desc=' + (a && a.descFirstBottom) + ' bottom=' + (a && a.contentBottom)
            + ' | B clicked=' + (b && b.clicked) + ' tag=' + (b && b.tagBottom) + ' desc=' + (b && b.descFirstBottom) + ' bottom=' + (b && b.contentBottom));
    }

    // Đợi tải xong: đủ 7 thẻ + hết tiến độ tải.
    const loaded = await waitFor(async () => {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        return n === 7 && !prog;
    }, 60000, 'load done (7 cards)');
    check('L0 tai xong (7 the, het tien do)', !!loaded);
    if (!loaded) return finish(1, 'khong tai xong');
    await sleep(8000);

    // ---- Kiểu Dọc (mặc định lúc mở app) ----
    const startLayout = await js(`document.querySelector('.mod-item').getAttribute('data-layout')`);
    console.log('START LAYOUT: ' + startLayout);
    await checkLabels('V');
    await checkClip('V');
    await shot('shot-taglabel-full-v.png');

    // ---- Kiểu Ngang (kiểu chật, dễ cắt chữ nhất) ----
    const swH = await switchLayout('Horizontal');
    check('H chuyen sang the Ngang', swH);
    const layoutH = await js(`document.querySelector('.mod-item').getAttribute('data-layout')`);
    check('H dang o the Ngang', layoutH === 'horizontal', 'layout=' + layoutH);
    await sleep(500);
    await checkLabels('H');
    await checkClip('H');
    await shot('shot-taglabel-full-h.png');
    // Ảnh thẻ đã chọn (thẻ đầu đang ở trạng thái sau checkClip).
    await shot('shot-taglabel-selected-h.png');

    // Không vỡ lưới: dòng thống kê vẫn đếm đủ 7 mod.
    const stats = await js(`(document.querySelector('.mod-stats') || {}).textContent || ''`);
    check('S dong thong ke dem 7 mods', /7 mods/.test(stats), stats.trim());

    // ---- Đổi tag qua hộp sửa mod: Billy Bikini weapon -> skin ----
    await js(`(function () {
        const d = document.getElementById('edit-mod-dialog');
        window.__editShown = false;
        if (d) {
            d.addEventListener('show', () => { window.__editShown = true; });
            d.addEventListener('dismiss', () => { window.__editShown = false; });
            d.addEventListener('closed', () => { window.__editShown = false; });
        }
        return !!d;
    })()`);
    // Chuột phải vào thẻ Billy Bikini (mở hộp sửa mod).
    const rect = await js(`(function () {
        const c = document.querySelector('.mod-item[name="Billy Bikini"]');
        if (!c) return null;
        c.scrollIntoView({ block: 'center' });
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    check('E0 tim thay the Billy Bikini de chuot phai', !!rect);
    if (rect) {
        wc.sendInputEvent({ type: 'mouseDown', x: rect.x, y: rect.y, button: 'right', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x: rect.x, y: rect.y, button: 'right', clickCount: 1 });
    }
    const opened = await waitFor(async () => {
        const shown = await js(`window.__editShown === true`);
        if (shown) return true;
        const w = await js(`(function () {
            const row = document.querySelector('#edit-mod-dialog #edit-mod-tag-row');
            return row ? row.getBoundingClientRect().width : 0;
        })()`);
        return w > 0;
    }, 10000, 'edit dialog opens');
    check('E1 hop sua mod mo ra', !!opened);
    await sleep(600);

    // Bấm chip Skin trong hàng chọn tag của hộp (giới hạn trong host
    // #edit-mod-dialog vì id có thể trùng ở thẻ mod).
    const chipClicked = await js(`(function () {
        const chips = document.querySelectorAll('#edit-mod-dialog #edit-mod-tag-row s-chip');
        for (const c of chips) {
            const p = c.querySelector('p');
            if (p && p.textContent.trim() === 'Skin') { c.click(); return 'skin-clicked'; }
        }
        return 'skin-chip-missing(' + chips.length + ' chips)';
    })()`);
    check('E2 bam chip Skin trong hop', chipClicked === 'skin-clicked', chipClicked);
    await sleep(500);

    // Bấm Lưu.
    const saveClicked = await js(`(function () {
        const b = document.querySelector('#edit-mod-dialog #preset-add-confirm');
        if (!b) return 'save-button-missing';
        b.click();
        return 'save-clicked';
    })()`);
    check('E3 bam nut Luu', saveClicked === 'save-clicked', saveClicked);
    const closed = await waitFor(async () => {
        const shown = await js(`window.__editShown === true`);
        return !shown;
    }, 10000, 'edit dialog closes after save');
    check('E4 hop dong sau khi luu', !!closed);
    await sleep(1500);

    // Đọc lại thẻ: nhãn Billy Bikini phải đổi sang "· Skin" ngay.
    const rows2 = await readRows();
    const byName2 = {};
    rows2.forEach((r) => { byName2[r.name] = r; });
    const bikini2 = byName2['Billy Bikini'];
    check('E5 Billy Bikini nhan doi sang "· Skin" ngay sau khi luu',
        !!bikini2 && bikini2.label === '· Skin' && bikini2.realTag === 'skin',
        bikini2 ? `label=${JSON.stringify(bikini2.label)} data-tag=${bikini2.realTag}` : 'khong thay the');
    let diskTag = '';
    try {
        const mj = JSON.parse(fs.readFileSync('/tmp/xxmm-tagcolors/mods/Billy Bikini/mod.json', 'utf8'));
        diskTag = mj.tag || '';
    } catch (e) { diskTag = 'read-error: ' + e.message; }
    check('E6 mod.json tren dia ghi tag skin', diskTag === 'skin', 'tag=' + diskTag);
    const sword2 = byName2['Alexandrina Sword'];
    check('E7 the khac khong doi (Alexandrina Sword van "· Character")',
        !!sword2 && sword2.label === '· Character' && sword2.realTag === 'character',
        sword2 ? `label=${JSON.stringify(sword2.label)}` : 'khong thay the');

    // ---- Đổi tag hàng loạt: 3 thẻ -> Effect ----
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

    // Mở bảng thao tác hàng loạt (nút mũi tên xuống, đầu trái thanh dưới).
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

    // Bấm chip Effect trong bảng batch.
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

    // Bấm nút + của hàng tag: nút add NẰM TRONG CÙNG hàng với chip
    // Effect (không lấy theo thứ tự toàn trang — nút + thêm preset ở
    // cột trái cũng là s-icon[type="add"]).
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
    const dlg = await waitFor(async () => {
        return js(`(function () {
            const d = document.querySelector('#dialog-confirm-batch-tag');
            if (!d) return false;
            const t = d.textContent || '';
            return t.includes('Effect') && t.includes('3 selected mods');
        })()`);
    }, 8000, 'confirm dialog shows Effect x3');
    check('B7 hop xac nhan hien "Effect" cho 3 mod', !!dlg);

    // Bấm Xác nhận.
    const confirmClicked = await js(`(function () {
        const b = document.querySelector('#dialog-confirm-batch-tag #batch-tag-confirm');
        if (!b) return 'confirm-missing';
        b.click();
        return 'confirm-clicked';
    })()`);
    check('B8 bam nut Xac nhan', confirmClicked === 'confirm-clicked', confirmClicked);
    await sleep(3000);

    // Đo lại: nhãn 3 thẻ phải đổi sang "· Effect" NGAY, không cần Làm Mới.
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
    let diskOk = true;
    const diskTags = {};
    for (const n of BATCH_NAMES) {
        try {
            diskTags[n] = JSON.parse(fs.readFileSync(`/tmp/xxmm-tagcolors/mods/${n}/mod.json`, 'utf8')).tag;
            if (diskTags[n] !== 'effect') diskOk = false;
        } catch (e) { diskTags[n] = 'read-error'; diskOk = false; }
    }
    check('B10 mod.json tren dia da ghi tag effect', diskOk, JSON.stringify(diskTags));
    const ellen = byName1['Ellen Fire'];
    check('B11 the khong doi giu nguyen (Ellen Fire van "· Accessory")',
        !!ellen && ellen.label === '· Accessory' && ellen.realTag === 'accessory',
        ellen ? `label=${JSON.stringify(ellen.label)}` : 'khong thay the');
    await shot('shot-taglabel-batch-after.png');

    // Chẩn đoán: bấm Refresh thì nhãn vẫn đúng (dữ liệu vốn đúng).
    const refreshClicked = await js(`(function () {
        const b = document.querySelector('#refresh-button');
        if (!b) return 'refresh-missing';
        b.click();
        return 'refresh-clicked';
    })()`);
    check('B12 bam nut Refresh', refreshClicked === 'refresh-clicked', refreshClicked);
    await sleep(6000);
    const rows3 = await readRows();
    const byName3 = {};
    rows3.forEach((r) => { byName3[r.name] = r; });
    let afterRefreshOk = true;
    for (const n of BATCH_NAMES) {
        const r = byName3[n];
        if (!r || r.label !== '· Effect' || r.realTag !== 'effect') afterRefreshOk = false;
    }
    check('B13 sau Refresh nhan van "· Effect"', afterRefreshOk,
        BATCH_NAMES.map((n) => n + ':' + (byName3[n] ? JSON.stringify(byName3[n].label) : 'missing')).join(' | '));

    finish(results.every((r) => r.ok) ? 0 : 1, 'done');
}
