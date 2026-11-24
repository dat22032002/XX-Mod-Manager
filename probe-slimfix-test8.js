// Probe chép gọn + tiến độ + thư mục tạm cạnh Mods (1.5.25-test8).
// Fixture: seed-fixture-slimfix.py (gieo TRƯỚC khi chạy probe).
// Kiểm:
//  A. Khởi động dọn thư mục tạm cũ còn sót (cạnh Mods + trong /tmp),
//     không đụng thư mục mồi xxmm-other-keep.
//  B. Bấm Tự sửa hết: thư mục tạm tạo CẠNH thư mục Mods (không nằm
//     trong Mods, không nằm trong /tmp); tiến độ chép ra + chép về
//     hiện từng mod (ghi lại bằng MutationObserver + chụp ảnh).
//  C. Thư mục tạm CHỈ có .ini/.buf (danh sách do stub ghi lại).
//  D. Sau khi sửa: hình nặng nguyên vẹn từng byte; Anby .ini đổi đúng,
//     .buf đổi đúng, có .zzz-fixer-state.json + extra.ini mới;
//     Ellen bị xóa file .ini lồng; Grace không đổi gì.
//  E. Bản dự phòng CHỈ có .ini/.buf, khôi phục được về mã cũ.
//  F. Thư mục tạm đã dọn; lưới vẫn 6 thẻ (tạm không bị nhận thành mod).
// Chạy (cwd = repo root):
//   xvfb-run -a -s "-screen 0 1400x1000x24" ./node_modules/.bin/electron \
//     --no-sandbox --disable-gpu --ignore-certificate-errors \
//     --user-data-dir=/tmp/xxmm-shot-tags6/userdata probe-slimfix-test8.js
const { app, BrowserWindow, ipcMain } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = '/tmp/xxmm-shot-tags6';
const MODS = path.join(BASE, 'mods');
const TOOLS = path.join(BASE, 'userdata', 'tools', 'ZZZ-Mod-Fixer');
const SHOTS = '/home/hatch/workspace/xxmm-test';
const HARD_TIMEOUT_MS = 900000; // 15 phút

const results = [];
const consoleErrors = [];
const snacks = [];
function check(name, ok, detail) {
    results.push({ name, ok: !!ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' :: ' + detail : ''));
}

function sha1File(p) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha1');
        const stream = fs.createReadStream(p);
        stream.on('error', reject);
        stream.on('data', (d) => hash.update(d));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

function listFilesRecursive(dir, base) {
    const out = [];
    const walk = (d) => {
        let entries;
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
        for (const e of entries) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (e.isFile()) out.push(path.relative(base || dir, p));
        }
    };
    walk(dir);
    return out.sort();
}

ipcMain.on('snack', (_e, message, type) => {
    snacks.push({ message: String(message), type, t: Date.now() });
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
    const tabRect = (label) => `(function () {
        const tab = [...document.querySelectorAll('.left-menu .tab')].find((e) =>
            (e.querySelector('p') || {}).textContent.trim() === ${JSON.stringify(label)});
        if (!tab) return null;
        const r = tab.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const btnRect = (label) => `(function () {
        const b = [...document.querySelectorAll('.fixer-block s-button')]
            .find((e) => e.textContent.trim() === ${JSON.stringify(label)});
        if (!b) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`;
    const fixerText = (re) => js(`(function () {
        const ps = [...document.querySelectorAll('.fixer-block p, .fixer-block h3')];
        const s = ps.find((e) => ${re}.test(e.textContent));
        return s ? s.textContent.trim() : null;
    })()`);
    const suspectRows = () => js(`[...document.querySelectorAll('.fixer-suspect-row')].map((r) => ({
        name: ((r.querySelector('.fixer-suspect-name') || {}).textContent || '').trim(),
    }))`);
    const tmpDirsIn = (parent, prefix) => {
        try {
            return fs.readdirSync(parent, { withFileTypes: true })
                .filter((e) => e.isDirectory() && e.name.startsWith(prefix)).map((e) => e.name);
        } catch (_e) { return []; }
    };

    // Vòng lặp chụp dòng tiến độ: dò mỗi 50ms, thấy dòng tiến độ của
    // PHA CHÉP VỀ thì đợi 300ms rồi chụp (pha chép về băm file bất
    // đồng bộ nên giao diện vẽ được; pha chép ra chặn cứng luồng chính
    // nên capturePage chỉ lấy được khung hình cũ từ lúc quét).
    // pollBusy để các lần dò không chồng lên nhau.
    let progressShotTaken = false;
    let pollBusy = false;
    let progressPoll = null;
    function startProgressPoll() {
        progressPoll = setInterval(async () => {
            if (progressShotTaken || pollBusy) return;
            pollBusy = true;
            try {
                const t = await js(`(function () {
                    const el = [...document.querySelectorAll('.fixer-flow p')]
                        .find((e) => /Copying mod \\d+ of \\d+ back/.test(e.textContent));
                    return el ? el.textContent.trim() : null;
                })()`);
                if (t) {
                    progressShotTaken = true;
                    console.log('progress seen: ' + t);
                    // Dòng tiến độ nằm dưới phần lăn (sau danh sách mod)
                    // nên phải cuộn nó vào giữa khung nhìn rồi mới chụp.
                    await js(`(function () {
                        const el = [...document.querySelectorAll('.fixer-flow p')]
                            .find((e) => /Copying mod \\d+ of \\d+ back/.test(e.textContent));
                        if (el) el.scrollIntoView({ block: 'center' });
                        return true;
                    })()`);
                    await sleep(400);
                    await shot('shot-slimfix-progress.png');
                }
            } catch (_e) { /* thử lại */ }
            finally { pollBusy = false; }
        }, 50);
    }

    try {
        // ---- A. Khởi động dọn thư mục tạm cũ ----
        const cards0 = await js(`document.querySelectorAll('.mod-item').length`);
        check('boot-6-cards', cards0 === 6, 'cards=' + cards0);
        check('startup-cleaned-stale-sibling',
            !fs.existsSync(path.join(BASE, 'xxmm-fixer-temp-1111111111111')));
        check('startup-cleaned-stale-tmpdir',
            !fs.existsSync('/tmp/xxmm-fixer-2222222222222'));
        check('startup-kept-decoy',
            fs.existsSync(path.join(BASE, 'xxmm-other-keep', 'dummy.txt')));

        // Băm file gốc trước khi sửa (để so nguyên vẹn sau).
        const beforeHashes = {};
        const hashTargets = [
            'Anby Bikini/big-image.dds', 'Anby Bikini/texture.buf', 'Anby Bikini/mod.ini',
            'Ellen Charm/big-image.dds', 'Ellen Charm/mod.ini', 'Ellen Charm/sub/extra.ini',
            'Grace Misc/big-image.dds', 'Grace Misc/big.buf', 'Grace Misc/mod.ini',
            'Anby Bikini/preview.webp', 'Anby Bikini/mod.json',
        ];
        for (const rel of hashTargets) beforeHashes[rel] = await sha1File(path.join(MODS, rel));
        check('hashes-recorded', Object.keys(beforeHashes).length === hashTargets.length);

        // ---- Mở Settings + tab Fixer ----
        await clickEl(sectionRect('settings'));
        await sleep(800);
        await clickEl(tabRect('Mod Fixer'));
        await sleep(800);
        const fixerTitle = await fixerText(/Mod Fixer/);
        check('fixer-tab-opens', !!fixerTitle, fixerTitle);

        // Ghi lại mọi dòng tiến độ hiện lên (MutationObserver trong trang).
        await js(`(function () {
            window.__progressSeen = [];
            new MutationObserver(() => {
                document.querySelectorAll('.fixer-flow p').forEach((p) => {
                    const t = p.textContent.trim();
                    if (/Copying mod \\d+ of \\d+/.test(t) && !window.__progressSeen.includes(t)) {
                        window.__progressSeen.push(t);
                    }
                });
            }).observe(document.body, { childList: true, subtree: true, characterData: true });
            return true;
        })()`);
        startProgressPoll();

        // ---- B. Bấm Tự sửa hết ----
        const tClick = Date.now();
        const clickedAuto = await clickEl(btnRect('Auto-Fix All'));
        check('autofix-clicked', clickedAuto);
        const tempPath = await waitFor(async () => {
            const ps = await js(`[...document.querySelectorAll('.fixer-flow .fixer-path')].map((e) => e.textContent.trim())`);
            const t = ps.find((p) => p.includes('xxmm-fixer-'));
            return t || null;
        }, 120000, 'temp path visible');
        const prepareMs = Date.now() - tClick;
        console.log(`prepare wall time: ${prepareMs} ms`);
        check('temp-path-shown', !!tempPath, tempPath);
        check('temp-next-to-mods', !!tempPath && tempPath.startsWith(path.join(BASE, 'xxmm-fixer-temp-')),
            tempPath);
        check('temp-not-inside-mods', !!tempPath && !tempPath.startsWith(MODS + path.sep), tempPath);
        check('temp-not-in-tmpdir', !!tempPath && !tempPath.startsWith('/tmp/xxmm-fixer-'), tempPath);
        check('no-new-tmpdir-temps', tmpDirsIn('/tmp', 'xxmm-fixer-').length === 0,
            'found=' + tmpDirsIn('/tmp', 'xxmm-fixer-').join(', '));

        const tApplyStart = Date.now();
        const doneText = await waitFor(async () => {
            const s = await fixerText(/Fixed \d+ mod/);
            return s;
        }, 120000, 'fix done');
        const applyMs = Date.now() - tApplyStart;
        console.log(`apply wall time (incl. stub 2s): ${applyMs} ms`);
        check('autofix-done-2-fixed', doneText === 'Fixed 2 mod(s)', doneText);
        const unchangedText = await fixerText(/\d+ mod\(s\) unchanged/);
        check('autofix-unchanged-1', !!(unchangedText && unchangedText.includes('1 mod(s)')), unchangedText);
        if (progressPoll) clearInterval(progressPoll);

        // Tiến độ đã hiện: cả 2 pha, đúng tổng 3 mod.
        const progressSeen = await js(`window.__progressSeen || []`);
        console.log('progress seen: ' + JSON.stringify(progressSeen));
        const outSeen = progressSeen.filter((t) => t.includes('to the temporary folder'));
        const backSeen = progressSeen.filter((t) => t.includes('back'));
        check('progress-out-seen', outSeen.length > 0 && outSeen.every((t) => t.includes('of 3')),
            JSON.stringify(outSeen));
        check('progress-back-seen', backSeen.length > 0 && backSeen.every((t) => t.includes('of 3')),
            JSON.stringify(backSeen));
        check('progress-shot-taken', progressShotTaken);
        // Đợi thêm 1s cho khung hình kết quả hiện ra rồi mới chụp
        // (không thì capturePage lấy khung hình tiến độ cuối cùng).
        await sleep(1000);
        await shot('shot-slimfix-done.png');

        // ---- C. Thư mục tạm CHỈ có .ini/.buf (stub ghi lại) ----
        let listing = [];
        try {
            listing = fs.readFileSync('/tmp/xxmm-slimfix-temp-listing.txt', 'utf8')
                .split('\n').map((s) => s.trim()).filter(Boolean);
        } catch (_e) { /* no */ }
        const relListing = listing.map((p) => {
            const i = p.indexOf('xxmm-fixer-temp-');
            const rest = p.slice(p.indexOf('/', i));
            return rest.replace(/^\//, '');
        });
        console.log('temp listing: ' + JSON.stringify(relListing));
        const onlyIniBuf = relListing.length > 0 &&
            relListing.every((r) => /\.ini$/i.test(r) || /\.buf$/i.test(r));
        check('temp-only-ini-buf', onlyIniBuf, 'n=' + relListing.length);
        const expected = ['Anby Bikini/mod.ini', 'Anby Bikini/texture.buf',
            'Ellen Charm/mod.ini', 'Ellen Charm/sub/extra.ini',
            'Grace Misc/big.buf', 'Grace Misc/mod.ini'].sort();
        check('temp-has-expected-files', JSON.stringify([...relListing].sort()) === JSON.stringify(expected),
            JSON.stringify([...relListing].sort()));
        check('temp-no-images', !relListing.some((r) => /dds|webp|json/i.test(r)));

        // ---- D. Sau khi sửa: hình nguyên vẹn, .ini/.buf đổi đúng ----
        const afterHashes = {};
        for (const rel of hashTargets) {
            const p = path.join(MODS, rel);
            afterHashes[rel] = fs.existsSync(p) ? await sha1File(p) : '<missing>';
        }
        check('anby-image-intact', afterHashes['Anby Bikini/big-image.dds'] === beforeHashes['Anby Bikini/big-image.dds']);
        check('ellen-image-intact', afterHashes['Ellen Charm/big-image.dds'] === beforeHashes['Ellen Charm/big-image.dds']);
        check('grace-image-intact', afterHashes['Grace Misc/big-image.dds'] === beforeHashes['Grace Misc/big-image.dds']);
        check('anby-preview-json-intact',
            afterHashes['Anby Bikini/preview.webp'] === beforeHashes['Anby Bikini/preview.webp'] &&
            afterHashes['Anby Bikini/mod.json'] === beforeHashes['Anby Bikini/mod.json']);
        const anbyIni = fs.readFileSync(path.join(MODS, 'Anby Bikini', 'mod.ini'), 'utf8');
        check('anby-ini-fixed', anbyIni.includes('4cbe7fbe') && !anbyIni.includes('00487185'), anbyIni.trim());
        const anbyBufTail = fs.readFileSync(path.join(MODS, 'Anby Bikini', 'texture.buf'));
        check('anby-buf-fixed', anbyBufTail.toString('utf8', anbyBufTail.length - 16) === 'FIXER-BUF-APPEND');
        check('anby-state-file-copied-back',
            fs.existsSync(path.join(MODS, 'Anby Bikini', '.zzz-fixer-state.json')));
        const anbyExtra = path.join(MODS, 'Anby Bikini', 'extra.ini');
        check('anby-new-ini-copied-back',
            fs.existsSync(anbyExtra) && fs.readFileSync(anbyExtra, 'utf8').includes('12345678'));
        check('ellen-nested-ini-deleted', !fs.existsSync(path.join(MODS, 'Ellen Charm', 'sub', 'extra.ini')));
        const ellenIni = fs.readFileSync(path.join(MODS, 'Ellen Charm', 'mod.ini'), 'utf8');
        check('ellen-ini-unchanged', ellenIni.includes('00f11ea6'));
        check('grace-fully-unchanged',
            afterHashes['Grace Misc/mod.ini'] === beforeHashes['Grace Misc/mod.ini'] &&
            afterHashes['Grace Misc/big.buf'] === beforeHashes['Grace Misc/big.buf'] &&
            afterHashes['Grace Misc/big-image.dds'] === beforeHashes['Grace Misc/big-image.dds']);

        // ---- E. Bản dự phòng CHỈ có .ini/.buf, khôi phục được ----
        let anbyBackup = null; let ellenBackup = null;
        try {
            const backups = fs.readdirSync(path.join(TOOLS, 'backup'));
            anbyBackup = backups.find((d) => d.startsWith('Anby Bikini-'));
            ellenBackup = backups.find((d) => d.startsWith('Ellen Charm-'));
        } catch (_e) { /* no */ }
        check('backups-exist', !!(anbyBackup && ellenBackup), `${anbyBackup} / ${ellenBackup}`);
        if (anbyBackup) {
            const files = listFilesRecursive(path.join(TOOLS, 'backup', anbyBackup));
            check('anby-backup-only-ini-buf',
                files.length > 0 && files.every((f) => /\.ini$/i.test(f) || /\.buf$/i.test(f)),
                JSON.stringify(files));
            const bIni = fs.readFileSync(path.join(TOOLS, 'backup', anbyBackup, 'mod.ini'), 'utf8');
            check('anby-backup-has-old-hash', bIni.includes('00487185'));
        }
        if (ellenBackup) {
            const files = listFilesRecursive(path.join(TOOLS, 'backup', ellenBackup));
            check('ellen-backup-only-ini-buf',
                files.length > 0 && files.every((f) => /\.ini$/i.test(f) || /\.buf$/i.test(f)),
                JSON.stringify(files));
            check('ellen-backup-has-deleted-ini',
                fs.existsSync(path.join(TOOLS, 'backup', ellenBackup, 'sub', 'extra.ini')));
        }

        // Danh sách nghi hỏng còn lại: chỉ Grace (Anby + Ellen đã sửa).
        const rowsAfter = await suspectRows();
        const namesAfter = rowsAfter.map((r) => r.name).sort();
        check('scan-list-updated', JSON.stringify(namesAfter) === JSON.stringify(['Grace Misc']),
            'got=' + namesAfter.join(', '));

        // Khôi phục thử từ bản dự phòng: Anby phải về lại mã cũ + .buf gốc.
        if (anbyBackup) {
            const bDir = path.join(TOOLS, 'backup', anbyBackup);
            const bFiles = listFilesRecursive(bDir);
            for (const rel of bFiles) {
                const dest = path.join(MODS, 'Anby Bikini', rel);
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(path.join(bDir, rel), dest);
            }
            const restoredIni = fs.readFileSync(path.join(MODS, 'Anby Bikini', 'mod.ini'), 'utf8');
            const restoredBufHash = await sha1File(path.join(MODS, 'Anby Bikini', 'texture.buf'));
            check('restore-works',
                restoredIni.includes('00487185') &&
                restoredBufHash === beforeHashes['Anby Bikini/texture.buf']);
        }

        // ---- F. Thư mục tạm đã dọn; lưới vẫn 6 thẻ ----
        check('temp-cleaned-sibling', tmpDirsIn(BASE, 'xxmm-fixer-').length === 0,
            'leftover=' + tmpDirsIn(BASE, 'xxmm-fixer-').join(', '));
        check('temp-cleaned-tmpdir', tmpDirsIn('/tmp', 'xxmm-fixer-').length === 0,
            'leftover=' + tmpDirsIn('/tmp', 'xxmm-fixer-').join(', '));
        await clickEl(sectionRect('mod'));
        await sleep(1500);
        const cardsAfter = await js(`document.querySelectorAll('.mod-item').length`);
        check('grid-still-6-cards', cardsAfter === 6, 'cards=' + cardsAfter);
    } catch (e) {
        console.log('PROBE EXCEPTION: ' + (e && e.stack || e));
    }
    if (progressPoll) clearInterval(progressPoll);
    finish(results.every((r) => r.ok) ? 0 : 1, 'probe finished');
}, 500);
