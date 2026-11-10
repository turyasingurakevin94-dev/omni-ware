#!/usr/bin/env node
'use strict';
/*
 * The phone's bars in the Sales app (src/apps/sales/shell/native-bars.ts, one rule: barsPlan).
 *
 *   1. Inside the bars (a Huawei: Android draws an opaque status bar and lays the WebView out below
 *      it, while Capacitor still reports the bar): --app-top is 0 and there is no strip.
 *   2. Under the bars (edge to edge): the screens keep the bar's height, and it is remembered.
 *   3. The old fallback: nothing measured on a page that fills the screen, the last good measurement
 *      (else 32) stands in; a page that does not fill the screen never gets 32.
 *   4. Typing: the keyboard takes height off the page, so nothing changes.
 *   5. The strip takes the colour under it: a navy head's navy #16203C, not its glow.
 *   6. Every part fixed to the top makes room for --app-top.
 *   7. The phone's large text: held at 130% in the app; the tab labels stay at 12 px under it.
 *
 * Node 22 runs the TypeScript as it is. Run: node test/sales-bars.test.js (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales phone bars');
const N = require(path.join(ROOT, 'src/apps/sales/shell/native-bars.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const plan = (o) => N.barsPlan({ measured: true, top: 0, bottom: 0, last: {}, gap: 0, typing: false, ...o });

/* ---------- 1. inside the bars ---------- */
{
  // Kevin's Huawei: 780 tall, the page 755 (the grey bar is Android's), Capacitor says 25.
  const p = plan({ top: 25, gap: 780 - 755 });
  t.check(p.insideTop === true, 'a page that starts below the status bar makes no room for it (--app-top 0, no strip)');
  t.check(p.insideBottom === false && !p.stand, '…no bottom bar to clear, and nothing stands in');
  const q = plan({ top: 24, bottom: 48, gap: 24 + 48 });
  t.check(q.insideTop === true && q.insideBottom === true, 'inside both bars (a phone with buttons): both are 0');
  const r = plan({ top: 24.4, gap: 24 });
  t.check(r.insideTop === true, 'a fraction of a pixel of rounding still reads as inside');
  const s = plan({ measured: false, top: 25, gap: 25, last: { top: 32 } });
  t.check(s.insideTop === true && !s.stand, 'the WebView\'s own env() inset, inside the bar: 0, and never the 32 fallback');
}

/* ---------- 2. under the bars ---------- */
{
  const p = plan({ top: 24, bottom: 16, gap: 0, last: {} });
  t.check(p.insideTop === false && p.insideBottom === false, 'edge to edge: the screens keep the bars\' size');
  t.check(p.remember && p.remember.top === 24 && p.remember.bottom === 16, '…and the measurement is kept for a page not measured yet');
  t.check(!plan({ top: 24, bottom: 16, gap: 0, last: { top: 24, bottom: 16 } }).remember, 'the same measurement is not written again');
  const nav = plan({ top: 24, bottom: 48, gap: 0 });
  t.check(nav.insideTop === false && nav.insideBottom === false, 'edge to edge on a phone with buttons: under both bars');
  t.check(plan({ top: 24, gap: 24 - 3 }).insideTop === false, 'a gap short of the bar by more than rounding is under it');
  t.check(plan({ top: 24, gap: -48 }).insideTop === false, 'a page taller than the screen\'s height is under the bars');
}

/* ---------- 3. the old fallback ---------- */
{
  const p = plan({ measured: false, top: 0, gap: 0, last: { top: 28, bottom: 20 } });
  t.check(p.stand && p.stand.top === 28 && p.stand.bottom === 20, 'not measured, filling the screen: the last good measurement stands in');
  const q = plan({ measured: false, top: 0, gap: 4, last: {} });
  t.check(q.stand && q.stand.top === 32 && q.stand.bottom === 32, '…and with none kept, 32');
  const r = plan({ measured: false, top: 0, gap: 25, last: { top: 28, bottom: 20 } });
  t.check(!r.stand && r.insideTop === false, 'a page that does not fill the screen is inside the bars: no stand-in, not even the kept one');
  t.check(!plan({ measured: true, top: 0, gap: 0, last: { top: 28 } }).stand, 'measured at zero: nothing stands in');
}

/* ---------- 4. typing ---------- */
{
  const p = plan({ top: 24, gap: 300, typing: true });
  t.check(p.insideTop === null && p.insideBottom === null && !p.stand && !p.remember, 'with the keyboard up nothing is decided (the gap is the keyboard)');
  const src = read('src/apps/sales/shell/native-bars.ts');
  t.check(/typing: editing\(document\.activeElement\)/.test(src), 'fixInsets passes whether a field has the focus');
  t.check(/gap: screen\.height - window\.innerHeight/.test(src), 'the gap is the screen\'s height less the page\'s');
}

/* ---------- 5. the strip's colour ---------- */
{
  const head = N.colourIn('radial-gradient(120% 90% at 100% 0%, rgb(36, 58, 107) 0%, rgb(22, 32, 60) 60%)');
  t.check(head && head.r === 22 && head.g === 32 && head.b === 60 && head.a === 1, 'under a navy head the strip is navy #16203C, not the glow #243A6B');
  const scrim = N.colourIn('rgba(12, 19, 38, 0.72)');
  t.check(scrim && Math.abs(scrim.a - 0.72) < 1e-9, 'a scrim keeps its alpha');
  const c = N.composite([scrim], { r: 247, g: 245, b: 242, a: 1 });
  t.check(Math.round(c.r) === 78 && Math.round(c.b) === 95, 'the scrim over the ground is what shows');
  t.check(N.isDark({ r: 22, g: 32, b: 60, a: 1 }) && !N.isDark({ r: 247, g: 245, b: 242, a: 1 }), 'light icons on navy, dark on the ground');
  t.check(N.colourIn('none') === null, 'no colour, no paint');
}

/* ---------- 6. every part fixed to the top makes room ---------- */
{
  const tokens = read('src/ui/tokens.css');
  t.check(/--app-top: var\(--bar-top\)/.test(tokens) && /--bar-top: var\(--safe-area-inset-top/.test(tokens), 'tokens: --app-top is the bar unless native-bars.ts says 0');
  const css = [];
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach((e) => {
    const rel = d + '/' + e.name;
    if (e.isDirectory()) walk(rel); else if (e.name.endsWith('.css')) css.push(rel);
  });
  walk('src');
  const bad = [];
  css.forEach((f) => {
    const src = read(f);
    for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const body = m[2];
      if (!/position:\s*(fixed|sticky)/.test(body)) continue;
      const top = body.match(/(?:^|;)\s*top:\s*([^;]+)/), inset = body.match(/(?:^|;)\s*inset:\s*([^;]+)/);
      const first = top ? top[1].trim() : inset ? inset[1].trim().split(/\s+(?![^(]*\))/)[0] : null;
      if (first && first !== 'auto' && !/var\(--app-top\)/.test(first)) bad.push(`${f}: ${m[1].trim()} (${first})`);
    }
  });
  t.check(bad.length === 0, `every fixed or sticky part with a top makes room for --app-top${bad.length ? ': ' + bad.join(' · ') : ''}`);
  t.check(/top: `calc\(\$\{p\.top\}px \+ var\(--app-top\)\)`/.test(read('src/apps/sales/chats/undo.tsx')), 'the chat\'s Undo toast, placed in code, makes room too');
}

/* ---------- 7. the phone's large text ---------- */
{
  const main = read('apps/sales/android/app/src/main/java/com/omniware/sales/MainActivity.java');
  const cap = +((main.match(/MAX_TEXT_ZOOM = (\d+)/) || [])[1]);
  const fit = read('test/e2e/flows-fit.cjs');
  const zoom = +((fit.match(/const ZOOM = ([\d.]+)/) || [])[1]);
  t.check(cap === 130 && /setTextZoom\(MAX_TEXT_ZOOM\)/.test(main), 'the phone app holds the text zoom at 130% at most');
  t.check(Math.round(zoom * 100) === cap, 'the e2e check of room runs at that same zoom');
  const T = require(path.join(ROOT, 'src/ui/tabfit.ts'));
  t.check(T.tabFontSize([33.5, 59.6], [33.5, 59.6]) === null, 'tab labels: at 100% nothing changes (the boards hold)');
  t.check(T.tabFontSize([43.5, 77.5], [33.5, 59.6]) === '9.23px', 'tab labels: at 130% they are held at 12 px (no room to grow: Customers fills its slot)');
  const css = read('src/ui/tabbar.css');
  t.check(/padding-left: 8px; padding-right: 8px/.test(css) && /padding: 8px 8px 0/.test(read('docs/canvas/sales-agent/LANGUAGE.md')), 'P16: the tab bar sits 8 px in from each edge, on the canvas and in the app');
}

process.exit(t.done() ? 1 : 0);
