// Chẩn đoán: vì sao background-color #FF9800 không ăn lên nút Apply.
// In: số lượng #apply-button, attribute data-v, selector có khớp không,
// rule nào đang thắng background-color, shadowRoot bên trong ra sao.
const { app, BrowserWindow } = require('electron');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let done = false;
function finish(code, msg) {
    if (done) return;
    done = true;
    console.log(msg);
    try { app.quit(); } catch { /* ignore */ }
    setTimeout(() => process.exit(code), 800);
}
setTimeout(() => finish(1, 'HARD TIMEOUT'), 300000);
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
            try { const v = await fn(); if (v) return v; } catch (e) { /* retry */ }
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
    // Bấm 1 thẻ để tạo has-unapplied.
    await js(`(function () {
        const card = document.querySelector('.mod-item');
        if (card) { card.scrollIntoView({ block: 'center' }); card.click(); }
        return true;
    })()`);
    await sleep(1500);
    const diag = await js(`(function () {
        const out = {};
        const btns = document.querySelectorAll('#apply-button');
        out.count = btns.length;
        out.btns = [];
        btns.forEach((b, i) => {
            const r = b.getBoundingClientRect();
            out.btns.push({
                i: i,
                rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
                classes: b.className,
                attrs: Array.from(b.attributes).map(a => a.name + '=' + a.value),
                bg: getComputedStyle(b).backgroundColor,
                anim: getComputedStyle(b).animationName,
                matchesScoped: b.matches('#apply-button.has-unapplied[data-v-c41b7a03]'),
                hasShadow: !!b.shadowRoot,
            });
        });
        // Rule nào đặt background-color mà khớp nút đầu tiên?
        const btn = btns[0];
        out.matchingBgRules = [];
        try {
            for (const sheet of document.styleSheets) {
                let rules;
                try { rules = sheet.cssRules; } catch (e) { continue; }
                if (!rules) continue;
                for (const rule of rules) {
                    if (!rule.selectorText || !rule.style) continue;
                    if (!rule.style.getPropertyValue('background-color')) continue;
                    let m = false;
                    try { m = btn.matches(rule.selectorText); } catch (e) { /* selector lạ */ }
                    if (m) out.matchingBgRules.push(rule.selectorText + ' { background-color: ' + rule.style.getPropertyValue('background-color') + ' } @ ' + (sheet.href || 'inline'));
                }
            }
        } catch (e) { out.matchingBgRules.push('ERR ' + e.message); }
        // Bên trong shadowRoot (nếu mở): nền của phần tử trong cùng?
        if (btn && btn.shadowRoot) {
            const inner = btn.shadowRoot.querySelector('.container, .button, button, [part="container"]');
            out.shadowInfo = {
                childTags: Array.from(btn.shadowRoot.children).map(c => c.tagName + '.' + c.className),
                innerBg: inner ? getComputedStyle(inner).backgroundColor : null,
            };
        }
        return out;
    })()`);
    console.log('DIAG: ' + JSON.stringify(diag, null, 1));
    finish(0, 'diag xong');
}
