#!/usr/bin/env node
'use strict';
/*
 * The worker pick card -- what a picker reads while walking, one-handed,
 * often in warehouse glare.
 *
 * The design question here is physical rather than visual: which single
 * thing must be legible at arm's length without stopping? It is the
 * quantity. Picking 8 when the order says 3 is the error that costs money,
 * and the photo already answers "which item", so the number should carry
 * the weight the product name used to.
 *
 * Two real defects came out of reading this card properly:
 *
 *   - The quantity label was the literal string "Pack" regardless of what
 *     was shown. `unit` falls back to the base unit when an item has no
 *     packUnit, so a card announced "Pack / 3 pc" for something not sold
 *     in packs at all.
 *   - The done badge used --accent. After the shared palette landed that
 *     is oxide, the action colour, so "already picked" and "press this"
 *     were the same colour. Done is verdigris.
 *
 * Run: node test/worker-pick-card.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('worker pick card');
const js = read('shared-worker.js');
const css = read('worker.html');
const strip = (s) => s.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const code = strip(js);

/* ---------- 1. the label says what the number actually is ------------ */
{
  t.check(/const qtyLabel = it\.packUnit \? 'Pack' : 'Quantity';/.test(code),
    'the label follows whether a pack unit exists, not the fallback');
  t.check(/class="wv-carousel-qty-label">\$\{esc\(qtyLabel\)\}/.test(code),
    'and is rendered from that rather than hard-coded');
  t.check(!/wv-carousel-qty-label">Pack</.test(code),
    'the literal "Pack" label is gone');

  // The rule itself, on the case that was wrong.
  const label = (packUnit) => packUnit ? 'Pack' : 'Quantity';
  t.check(label('ctn') === 'Pack', 'an item sold in cartons is a pack');
  t.check(label(null) === 'Quantity', 'one with no pack unit is not');
  t.check(label('') === 'Quantity', 'nor is one with an empty pack unit');

  // And the unit shown still follows the existing fallback, unchanged.
  const unitFor = (it) => it.packUnit || it.unit || '';
  t.check(unitFor({ packUnit: 'ctn', unit: 'pc' }) === 'ctn', 'a pack item shows its pack unit');
  t.check(unitFor({ unit: 'pc' }) === 'pc', 'a loose item shows its base unit');
  t.check(unitFor({}) === '', 'and an item with neither shows nothing rather than "undefined"');
}

/* ---------- 2. the unit does not steal weight from the digits -------- */
{
  t.check(/\$\{esc\(qty\)\}\$\{unit \? ` <span class="u">\$\{esc\(unit\)\}<\/span>` : ''\}/.test(code),
    'the unit is its own element so it can be set smaller than the number');
  // A real space, not only the flex gap. The gap separates them on screen
  // but leaves the text node reading "8pc", which is what a screen reader
  // announces. Whitespace-only nodes collapse in a flex container, so the
  // space costs nothing visually.
  t.check(/\? ` <span class="u">/.test(code),
    'with a real space between the number and the unit, not just a gap');
  t.check(/\.wv-carousel-qty \.u\{[^}]*font-size:15px/.test(css),
    'and it is set smaller');
  t.check(!/wv-carousel-qty">\$\{esc\(qty\)\} \$\{esc\(unit\)\}/.test(code),
    'the old single-string quantity is gone');
}

/* ---------- 3. quantity outweighs the product name ------------------- */
{
  const size = (sel) => {
    const m = new RegExp(`\\.${sel}\\{[^}]*font-size:([\\d.]+)px`).exec(css);
    return m ? Number(m[1]) : null;
  };
  const qty = size('wv-carousel-qty');
  const name = size('wv-carousel-name');
  t.check(qty !== null && name !== null, `both sizes are declared (qty ${qty}, name ${name})`);
  t.check(qty > name * 2,
    `the quantity is more than twice the product name (${qty}px vs ${name}px) -- the photo already says which item`);
  t.check(/\.wv-carousel-qty\{[^}]*tabular-nums/.test(css),
    'and its digits are tabular, so the number does not reflow as it changes');
}

/* ---------- 4. green means done, and only done ----------------------- */
{
  t.check(/\.wv-carousel-badge\.done\{background:var\(--good\)/.test(css),
    'the done badge is verdigris');
  t.check(!/\.wv-carousel-badge\.done\{background:var\(--accent\)/.test(css),
    'not the action colour it used to share');
  t.check(/\.wv-carousel-badge\.pending\{[^}]*color:var\(--ink\)/.test(css),
    'and the unpicked badge reads at full ink rather than soft grey');
}

/* ---------- 5. it can be hit ----------------------------------------- */
{
  const m = /\.wv-carousel-badge\{[^}]*min-height:(\d+)px/.exec(css);
  const h = m ? Number(m[1]) : 0;
  t.check(h >= 44, `the pick button clears the 44px minimum (${h || 'not set'}px)`);
  const w = /\.wv-carousel-badge\{[^}]*min-width:(\d+)px/.exec(css);
  t.check(w && Number(w[1]) >= 44, `and is wide enough to hit without aiming (${w ? w[1] : 'not set'}px)`);
}

/* ---------- 6. the accent is spent once per card --------------------- */
/*
 * The location strip was tinted with the accent, putting a second block of
 * the action colour on every card. With oxide as the accent that left the
 * button nothing to stand against.
 */
{
  t.check(/\.wv-carousel-source\{[^}]*background:var\(--bg\)/.test(css),
    'the location strip is neutral');
  t.check(!/\.wv-carousel-source\{[^}]*background:var\(--accent-tint\)/.test(css),
    'rather than tinted with the action colour');
  t.check(/\.wv-carousel-source-value\{[^}]*color:var\(--ink\)/.test(css),
    'and the bay reads in ink, which is more legible than the tint it replaced');
}

/* ---------- 7. the dark ground stays readable ------------------------ */
/*
 * This surface runs dark for glare and battery, which changes what is
 * legible in ways that are not obvious by eye. Measuring found three AA
 * failures that reading the CSS did not:
 *
 *   - white on the lifted oxide was 3.71 for 13.5px button text. A bright
 *     accent on a dark ground wants DARK ink; white is only the right
 *     reflex when the accent itself is dark.
 *   - white on the lifted verdigris was 3.16 on the done badge.
 *   - --ink-faint was 3.80, and it sets 10px uppercase labels.
 *
 * So the ratios are asserted rather than trusted. A colour tweak that
 * looks fine and fails here is exactly the regression this catches.
 */
{
  const root = /:root\{([\s\S]*?)\n  \}/.exec(css);
  const decls = {};
  (root ? root[1] : '').split(/\r?\n/).forEach(l => {
    const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(l.replace(/\/\*[\s\S]*?\*\//g, ''));
    if (m) decls[m[1]] = m[2].trim();
  });
  const resolve = (name, depth = 0) => {
    let v = decls[name];
    if (!v || depth > 6) return null;
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    return ref ? resolve(ref[1], depth + 1) : (/^#[0-9a-f]{6}$/i.test(v) ? v : null);
  };
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const cr = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

  const bg = resolve('--bg'), panel = resolve('--panel'), ink = resolve('--ink');
  const soft = resolve('--ink-soft'), faint = resolve('--ink-faint');
  const accent = resolve('--accent'), accentInk = resolve('--accent-ink'), deep = resolve('--accent-deep');

  t.check(bg && lum(bg) < 0.05, `the ground is dark (${bg})`);
  t.check(panel && lum(panel) > lum(bg), `and the card sits above it (${panel})`);

  const AA = 4.5;
  [
    ['body text on the ground', ink, bg],
    ['secondary text on a card', soft, panel],
    ['the 10px labels on a card', faint, panel],
    ['accent-deep used as text', deep, panel],
    ['button text on the accent', accentInk, accent],
  ].forEach(([what, fg, bgc]) => {
    const ok = fg && bgc && cr(fg, bgc) >= AA;
    t.check(ok, `${what} clears AA (${fg && bgc ? cr(fg, bgc).toFixed(2) : 'unresolved'}:1)`);
  });

  // The specific reflex that was wrong: white on this accent does NOT pass,
  // which is why --accent-ink is dark. If someone "corrects" it back to
  // white, this fails loudly.
  t.check(accent && cr('#FFFFFF', accent) < AA,
    'white on the lifted accent would fail, which is why the ink is dark');
  t.check(accentInk && lum(accentInk) < 0.05,
    'and --accent-ink is a dark ink, not white');
}

/* ---------- 7b. the variant appears once ---------------------------- */
/*
 * Both writers of an order line bake the variant into productName -- the
 * admin's quote builder through productVariantLabel(), and
 * agent-submit-order the same way -- because every surface in the admin
 * prints that string and none of them resolve the variant themselves.
 *
 * This card is the exception: pickItemVariantLabel() resolves it, on its
 * own line under the name. Printing the stored name as well gave every
 * variable item its variant twice, on the one screen where a picker is
 * deciding which of two similar things to take off the shelf:
 *
 *     Cabinet Hinge — Brass
 *     Brass
 */
{
  const sw = read('shared-worker.js');
  t.check(/<div class="wv-carousel-name">\$\{esc\(\(product && product\.name\) \|\| it\.productName \|\| 'Item'\)\}<\/div>/.test(sw),
    'the card names the product, leaving the variant to the line below it');
  t.check(/\$\{variant \? `<div class="wv-carousel-variant">\$\{esc\(variant\)\}<\/div>` : ''\}/.test(sw),
    'which still renders, and only when there is one');
  t.check(!/<div class="wv-carousel-name">\$\{esc\(it\.productName\|\|'Item'\)\}/.test(sw),
    'the stored name is no longer printed as the heading');

  // What the two together produce, stated over the real shapes.
  const products = [{ id: 'P900', name: 'Cabinet Hinge', variants: [{ combo: { Finish: 'Brass' } }, { combo: { Finish: 'Steel' } }] }];
  const heading = (it) => {
    const p = products.find(x => x.id === it.productId);
    return (p && p.name) || it.productName || 'Item';
  };
  const adminLine = { productId: 'P900', variantIdx: 0, productName: 'Cabinet Hinge — Brass' };
  const agentLine = { productId: 'P900', variantIdx: 1, productName: 'Cabinet Hinge — Steel' };
  t.check(heading(adminLine) === 'Cabinet Hinge', 'an admin-built line heads with the product');
  t.check(heading(agentLine) === 'Cabinet Hinge', 'and so does an agent-submitted one');
  t.check(!heading(adminLine).includes('Brass') && !heading(agentLine).includes('Steel'),
    'neither heading repeats what the variant line is about to say');

  // The one case where the stored name is all there is.
  t.check(heading({ productId: 'GONE', variantIdx: 0, productName: 'Deleted Thing — Red' }) === 'Deleted Thing — Red',
    'a product deleted out from under an order still on the board keeps the name the line remembers');
  t.check(heading({ productId: 'GONE' }) === 'Item', 'and a line with neither still says something');
}

/* ---------- 8. the APK copy carries all of it ------------------------ */
/*
 * worker-www/ is what the Android build ships. A change that lands only in
 * the repo root reaches nobody holding a phone.
 */
{
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..');
  const a = fs.readFileSync(path.join(root, 'worker.html'), 'utf8').replace(/\r/g, '');
  const b = fs.readFileSync(path.join(root, 'worker-www', 'index.html'), 'utf8').replace(/\r/g, '');
  const diff = a.split('\n').filter((l, i) => b.split('\n')[i] !== l);
  t.check(diff.length === 1 && /manifest-worker\.json/.test(diff[0]),
    `worker-www/index.html differs from worker.html only by the manifest path (${diff.length} line(s) differ)`);

  const swa = fs.readFileSync(path.join(root, 'shared-worker.js'), 'utf8').replace(/\r/g, '');
  const swb = fs.readFileSync(path.join(root, 'worker-www', 'shared-worker.js'), 'utf8').replace(/\r/g, '');
  t.check(swa === swb, 'and the APK copy of shared-worker.js is identical');
}

process.exit(t.done() ? 1 : 0);
