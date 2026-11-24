// Probe Zone phase 1: kiểm tra các chi tiết RIÊNG của giao diện Zone
// (probe-1526/statsback/counts đã kiểm tính năng — 76/76 đậu).
//  - Class Zone có mặt đúng chỗ (nút, viên trượt, công tắc, chip, khung).
//  - Đồng hồ accent chạy (màu nhấn đổi theo thời gian).
//  - 3 cột thẳng đáy nhau (sau khi bỏ viền 3px + bù +6px).
//  - Chữ Inpin Hongmeng tải được (alias của zzz-chs.ttf).
//  - Viền thẻ mod: xám #404040 lúc thường, nhấn khi chọn.
//  - Không dùng .zzz-theme ở gốc (adapter chỉ khoác lên phần tử Zone).
//  - Không có lỗi console.
// Fixture: python3 ~/workspace/xxmm-test/build-fixture-48.py (46 mod).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-grid48/userdata probe-zone-phase1.js
const { app, BrowserWindow } = require('electron');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => {
    if (ok) { passed++; console.log(`PASS ${name}${extra ? ' :: ' + extra : ''}`); }
    else { failed++; console.log(`FAIL ${name}${extra ? ' :: ' + extra : ''}`); }
};
setTimeout(() => { console.log('HARD TIMEOUT'); process.exit(1); }, 300000);
require('./electron/main.js');

const timer = setInterval(async () => {
    const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
    if (wins.length === 0) return;
    const win = wins[0];
    if (win.webContents.isLoading()) return;
    clearInterval(timer);
    const wc = win.webContents;
    const js = (code) => wc.executeJavaScript(code);
    const errs = [];
    wc.on('console-message', (_e, level, msg) => {
        if (level === 3) errs.push(msg);
    });
    // Đợi tải xong.
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
        const n = await js(`document.querySelectorAll('.mod-item').length`);
        const prog = await js(`!!document.querySelector('.apply-progress')`);
        if (n > 0 && !prog) break;
        await sleep(300);
    }
    await sleep(1500);

    // ---- Z1. Class Zone có mặt ----
    const classes = await js(`(function () {
        const q = (s) => document.querySelectorAll(s).length;
        return {
            applyBtn: q('#apply-button.zzz-button.zzz-mat-pill.zzz-pressable.zzz-accent-fill'),
            refreshBtn: q('#refresh-button.zzz-button.zzz-button--capped'),
            undoBtn: q('#undo-button.zzz-button.zzz-button--capped'),
            chevBtn: q('#batch-trigger-button.zzz-icon-button.zzz-icon-button--md'),
            trigBtn: q('#view-panel-trigger.zzz-icon-button.zzz-icon-button--md'),
            segTabs: q('.zzz-segmented-tabs.zzz-mat-pill'),
            segIndicators: q('.zzz-segmented-tabs__indicator'),
            viewPanel: q('.view-panel.zzz-mat-panel'),
            frames: q('.zzz-frame.zzz-mat-panel'),
            presetZone: q('.left-menu.zzz-frame.zzz-mat-panel'),
            charListZone: q('.character-list.zzz-frame.zzz-mat-panel'),
            gridZone: q('#mod-card-manager.zzz-frame.zzz-mat-panel'),
            rightTop: q('.mod-panel-top.zzz-frame.zzz-mat-panel'),
            rightBottom: q('.mod-panel-bottom.zzz-frame.zzz-mat-panel'),
            windowCapsule: q('.window-controls.zzz-mat-pill'),
            presetIconBtns: q('.left-menu .zzz-icon-button--sm'),
            noThemeRoot: !document.querySelector('.zzz-theme'),
            noSoberBottomBtns: [...document.querySelectorAll('.bottom s-button, .bottom s-icon-button, .bottom s-switch')].filter((el) => !el.closest('s-popup')).length,
        };
    })()`);
    check('Z1a nut Apply la Zone accent-fill', classes.applyBtn === 1, String(classes.applyBtn));
    check('Z1b Refresh/Undo la Zone capped', classes.refreshBtn === 1 && classes.undoBtn === 1, `${classes.refreshBtn}/${classes.undoBtn}`);
    check('Z1c chevron + nut mo bang la IconButton md', classes.chevBtn === 1 && classes.trigBtn === 1, `${classes.chevBtn}/${classes.trigBtn}`);
    check('Z1d 3 thanh SegmentedTabs + vien nhan', classes.segTabs === 3 && classes.segIndicators >= 2, `tabs=${classes.segTabs} ind=${classes.segIndicators}`);
    check('Z1e 5 khung Zone (preset/cot trai/luoi/phai tren/phai duoi)', classes.frames === 5 && classes.presetZone === 1 && classes.charListZone === 1 && classes.gridZone === 1 && classes.rightTop === 1 && classes.rightBottom === 1, `frames=${classes.frames}`);
    check('Z1f vien nhong cua so la Zone pill', classes.windowCapsule === 1, String(classes.windowCapsule));
    check('Z1g 3 nut preset la IconButton sm', classes.presetIconBtns === 3, String(classes.presetIconBtns));
    check('Z1h khong co .zzz-theme o goc', classes.noThemeRoot === true, String(classes.noThemeRoot));
    check('Z1i thanh duoi het nut Sober', classes.noSoberBottomBtns === 0, String(classes.noSoberBottomBtns));

    // ---- Z2. Đồng hồ accent chạy ----
    const accent1 = await js(`getComputedStyle(document.documentElement).getPropertyValue('--zzz-accent').trim()`);
    await sleep(450);
    const accent2 = await js(`getComputedStyle(document.documentElement).getPropertyValue('--zzz-accent').trim()`);
    check('Z2 dong ho accent chay (mau doi theo thoi gian)', accent1 !== accent2, `${accent1} -> ${accent2}`);

    // ---- Z3. 3 cột thẳng đáy ----
    const align = await js(`(function () {
        const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), w: Math.round(b.width), bottom: Math.round(b.bottom), top: Math.round(b.top) }; };
        return { left: r('.left-column'), grid: r('#mod-card-manager'), right: r('.mod-info-panel') };
    })()`);
    const bottoms = [align.left.bottom, align.grid.bottom, align.right.bottom];
    check('Z3a 3 cot thang day nhau (sai nhau <= 1px)', Math.max(...bottoms) - Math.min(...bottoms) <= 1, JSON.stringify(bottoms));
    check('Z3b rong cot dung (226 / 764 / 250)', align.left.w === 226 && align.grid.w === 764 && align.right.w === 250, `${align.left.w}/${align.grid.w}/${align.right.w}`);
    check('Z3c day cot = 730 (len 6px so voi 736 cu)', bottoms[0] === 730, `bottom=${bottoms[0]}`);

    // ---- Z4. Chữ Inpin Hongmeng ----
    const fontOk = await js(`document.fonts.check('900 18px "Inpin Hongmeng"')`);
    check('Z4 font Inpin Hongmeng tai duoc', fontOk === true, String(fontOk));
    const btnFont = await js(`(function () {
        const el = document.querySelector('#apply-button .zzz-button__text');
        return el ? getComputedStyle(el).fontFamily : null;
    })()`);
    check('Z4b chu nut Apply dung stack Zone', !!btnFont && btnFont.includes('Inpin Hongmeng'), String(btnFont));

    // ---- Z5. Viền thẻ mod ----
    const ring = await js(`(function () {
        const el = document.querySelector('.mod-item');
        if (!el) return null;
        const before = getComputedStyle(el, '::before');
        const cs = getComputedStyle(el);
        return { borderColor: before.borderColor, borderWidth: before.borderWidth, bg: cs.backgroundColor, radius: cs.borderRadius };
    })()`);
    check('Z5a the co vien xam #404040 (ItemCard)', !!ring && ring.borderColor === 'rgb(64, 64, 64)', ring ? `${ring.borderColor} ${ring.borderWidth}` : 'khong thay the');
    check('Z5b nen the den Zone', !!ring && ring.bg === 'rgb(0, 0, 0)', ring ? ring.bg : '');
    check('Z5c bo goc 14u (~9.8px)', !!ring && Math.abs(parseFloat(ring.radius) - 9.8) < 0.5, ring ? ring.radius : '');

    // ---- Z6. Chọn thẻ -> viền nhấn ----
    await js(`(function () {
        const el = document.querySelector('.mod-item');
        if (el) el.scrollIntoView({ block: 'center' });
    })()`);
    await sleep(300);
    // App khôi phục lựa chọn từ preset lúc mở app — kiểm trạng thái
    // clicked trước khi bấm, không bấm mù (bấm mù sẽ bỏ chọn).
    const cardCenter = await js(`(function () {
        const el = document.querySelector('.mod-item');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), already: el.getAttribute('clicked') === 'true' };
    })()`);
    if (cardCenter && !cardCenter.already) {
        wc.sendInputEvent({ type: 'mouseDown', x: cardCenter.x, y: cardCenter.y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x: cardCenter.x, y: cardCenter.y, button: 'left', clickCount: 1 });
        await sleep(700);
    }
    const selRing = await js(`(function () {
        const el = document.querySelector('.mod-item[clicked="true"]');
        if (!el) return null;
        const after = getComputedStyle(el, '::after');
        return { borderColor: after.borderColor, borderWidth: after.borderWidth };
    })()`);
    check('Z6a bam the thi the duoc chon', !!selRing, selRing ? JSON.stringify(selRing) : 'khong co the clicked=true');
    // Viền nhấn là màu accent đang chạy (nằm giữa lime #93BA00 và yellow
    // #FCDC00): R 147-252, G 186-220, B 0.
    const accentOk = selRing && (() => {
        const m = selRing.borderColor.match(/rgb\((\d+), (\d+), (\d+)\)/);
        if (!m) return false;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        return b === 0 && r >= 140 && r <= 252 && g >= 180 && g <= 225;
    })();
    check('Z6b vien chon la mau accent dang chay', !!accentOk, selRing ? selRing.borderColor : '');
    // Blink làm tròn XUỐNG border-width trong getComputedStyle (đã kiểm:
    // cả border: 2.8px viết thẳng cũng báo "2px") — 7u = 4.9px báo "4px"
    // là đúng, độ dày vẽ thật vẫn là 4.9px.
    check('Z6c vien chon day 7u (bao 4px do Blink lam tron xuong)', !!selRing && selRing.borderWidth === '4px', selRing ? selRing.borderWidth : '');

    // ---- Z7. Viên trượt preset dùng accent, không còn tween JS ----
    const presetSlider = await js(`(function () {
        const el = document.querySelector('.left-menu.zzz-frame .slider');
        if (!el) return null;
        return { hasTweenClass: el.classList.contains('OO-color-gradient'), bg: getComputedStyle(el).backgroundColor };
    })()`);
    check('Z7 vien preset tach khoi tween JS', !!presetSlider && presetSlider.hasTweenClass === false, presetSlider ? `tween=${presetSlider.hasTweenClass} bg=${presetSlider.bg}` : 'khong thay vien');

    // ---- Z8. Thanh dưới trong suốt + nút Apply đúng cỡ ----
    const bar = await js(`(function () {
        const b = document.querySelector('.bottom');
        const a = document.querySelector('#apply-button');
        const ar = a.getBoundingClientRect();
        return { bg: getComputedStyle(b).backgroundColor, applyW: Math.round(ar.width), applyH: Math.round(ar.height) };
    })()`);
    check('Z8a thanh duoi trong suot', bar.bg === 'rgba(0, 0, 0, 0)', bar.bg);
    check('Z8b nut Apply rong w-wide ~197px, cao ~40px', Math.abs(bar.applyW - 197) <= 2 && Math.abs(bar.applyH - 40) <= 1, `${bar.applyW}x${bar.applyH}`);

    // ---- Z9. Bảng lọc Zone (mở bảng, kiểm chip + công tắc) ----
    const filterCenter = await js(`(function () {
        const el = document.querySelector('#filter-toggle-chip');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (filterCenter) {
        wc.sendInputEvent({ type: 'mouseDown', x: filterCenter.x, y: filterCenter.y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x: filterCenter.x, y: filterCenter.y, button: 'left', clickCount: 1 });
        await sleep(700);
    }
    const filterPanel = await js(`(function () {
        const p = document.querySelector('.filter-panel');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return { visible: r.width > 0 && r.height > 0, w: Math.round(r.width), h: Math.round(r.height),
            left: Math.round(r.left), panelClass: p.classList.contains('zzz-mat-panel'),
            chips: document.querySelectorAll('.filter-panel .zzz-chip').length,
            switches: document.querySelectorAll('.filter-panel .zzz-switch').length,
            selectedChips: document.querySelectorAll('.filter-panel .zzz-chip[data-selected]').length };
    })()`);
    check('Z9a bang loc mo duoc, la panel Zone', !!filterPanel && filterPanel.visible && filterPanel.panelClass, filterPanel ? JSON.stringify(filterPanel) : 'khong thay bang');
    check('Z9b bang loc co 14 chip Zone + 2 cong tac', !!filterPanel && filterPanel.chips === 14 && filterPanel.switches === 2, filterPanel ? `chips=${filterPanel.chips} sw=${filterPanel.switches}` : '');
    check('Z9c 2 chip dang chon (All types + Default)', !!filterPanel && filterPanel.selectedChips === 2, filterPanel ? String(filterPanel.selectedChips) : '');
    check('Z9d bang loc rong 226px, mep trai thang cot', !!filterPanel && filterPanel.w === 226 && filterPanel.left === 10, filterPanel ? `w=${filterPanel.w} left=${filterPanel.left}` : '');

    // ---- Z10. Công tắc gọn trong bảng nổi ----
    const trigCenter = await js(`(function () {
        const el = document.querySelector('#view-panel-trigger');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (trigCenter) {
        wc.sendInputEvent({ type: 'mouseDown', x: trigCenter.x, y: trigCenter.y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x: trigCenter.x, y: trigCenter.y, button: 'left', clickCount: 1 });
        await sleep(700);
    }
    const compactSwitch = await js(`(function () {
        const s = document.querySelector('.view-panel .zzz-switch');
        if (!s) return null;
        const r = s.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), checked: s.getAttribute('aria-checked') };
    })()`);
    check('Z10a cong tac gon la Zone Switch 76x45u (~53x32px)', !!compactSwitch && Math.abs(compactSwitch.w - 53) <= 1 && Math.abs(compactSwitch.h - 32) <= 1, compactSwitch ? `${compactSwitch.w}x${compactSwitch.h}` : 'khong thay');
    const steppers = await js(`(function () {
        const b = [...document.querySelectorAll('.view-panel .zzz-icon-button--stepper')];
        return b.map((el) => { const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); });
    })()`);
    check('Z10b 2 nut zoom la stepper 47u (~33px)', steppers.length === 2 && steppers.every((s) => s === '33x33'), JSON.stringify(steppers));

    // ---- Z11. Không có lỗi console ----
    check('Z11 khong co loi console', errs.length === 0, errs.slice(0, 3).join(' | '));

    console.log(`=== RESULT ${passed}/${passed + failed} passed ===`);
    try { app.quit(); } catch {}
    setTimeout(() => process.exit(failed === 0 ? 0 : 1), 800);
}, 50);
