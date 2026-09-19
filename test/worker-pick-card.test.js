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
 *     was shown. That was fixed to follow packUnit, and later again --
 *     see section 1 -- when it turned out the number was never a count of
 *     packs in the first place, so no card should ever have said "Pack".
 *   - The done badge used --accent. After the shared palette landed that
 *     is oxide, the action colour, so "already picked" and "press this"
 *     were the same colour. Done is verdigris.
 *
 * Run: node test/worker-pick-card.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker pick card');
const js = read('shared-worker.js');
const css = read('worker.html');
const strip = (s) => s.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const code = strip(js);

/* ---------- 1. the number is in the unit it is counted in ------------ */
/*
 * This section used to assert the opposite, and the earlier reading was
 * wrong about the data rather than about the design.
 *
 * it.qty is ALWAYS in base units. ipComputeQty multiplies a pack entry
 * out by packQty before the line is ever written, so choosing "2
 * cartons" of something sold by the dozen stores 12, not 2. Pairing that
 * number with packUnit printed "12 Ctn" for twelve dozen, and a picker
 * reading that pulls twelve cartons -- six times the order, on the one
 * card built specifically to stop that error. The buying list had always
 * shown it.unit for the same number, so the two screens disagreed about
 * what a line was.
 *
 * With the number always a count of units, "Pack" has nothing left to
 * mean here. Pack size is a purchasing fact; it belongs on the buying
 * list, next to what has to be fetched, not on the card of somebody
 * counting goods off a shelf.
 */
/*
 * And later again, the other way for ONE case: the admin can now choose
 * the pack in the picker, and a line chosen as "2 Ctn" says so on itself
 * (qtyIn 'pack', with its pack size). That line reads as 2 Ctn here, in
 * the same words as the packing list, the invoice and the client's
 * quotation. A line that does NOT say so is still a count of base units
 * -- the reading below is unchanged for it, because that is exactly the
 * data the twelve-dozen mistake came from.
 */
const pick = compileScope([extractFunction(js, 'pickLineCount', 'shared-worker.js')], {}, ['pickLineCount']);
{
  t.check(/const count = pickLineCount\(it, itemOrderedQty\(it\)\);\s*const qty = it\.qty!=null \? count\.n : '';\s*const unit = count\.unit;/.test(code),
    'the card reads the count and its unit through pickLineCount');
  const chosen = pick.pickLineCount({ unit: 'Pair', packUnit: 'Ctn', packQty: 100, qtyIn: 'pack', qty: 200 }, 200);
  t.check(chosen.n === '2' && chosen.unit === 'Ctn' && chosen.per === 100,
    `a line chosen as cartons reads 2 Ctn, stepped a carton at a time (${JSON.stringify(chosen)})`);
  const part = pick.pickLineCount({ unit: 'Pair', packUnit: 'Ctn', packQty: 100, qtyIn: 'pack', qty: 200 }, 150);
  t.check(part.n === '1.5', `and a part of it is a part of a carton (${part.n})`);
  const twelve = pick.pickLineCount({ packUnit: 'Ctn', packQty: 12, unit: 'Dozen', qty: 12 }, 12);
  t.check(twelve.n === '12' && twelve.unit === 'Dozen',
    'twelve of something sold by the dozen, on a line that never chose the carton, still reads as twelve dozen');
  t.check(/const badgeLabel = isShort \? `\$\{pickLineCount\(it, picked\)\.n\} of \$\{count\.n\}`/.test(code),
    'a short pick’s badge counts both numbers in the same unit');
  t.check(/const unit = count\.unit, per = count\.per;/.test(code)
    && /n \+ Number\(btn\.dataset\.step\) \* per/.test(code),
    'and "How many did you find?" steps in that unit too');
  t.check(/const qtyLabel = 'Quantity';/.test(code),
    'and calls it a quantity, because that is what the number is');
  t.check(/class="wv-carousel-qty-label">\$\{esc\(qtyLabel\)\}/.test(code),
    'still rendered through the variable rather than hard-coded into the markup');

  // The rule itself, on the case that was wrong.
  const unitFor = (it) => pick.pickLineCount(it, 12).unit;
  t.check(unitFor({ packUnit: 'Ctn', unit: 'Dozen' }) === 'Dozen',
    'twelve of something sold by the dozen reads as dozens, not as cartons');
  t.check(unitFor({ unit: 'pc' }) === 'pc', 'a loose item still shows its base unit');
  /* Nothing writes a line with only a packUnit -- ipAddToQuote takes
     `unit` from the price row alongside it -- but a row from an older
     save is better read as its pack than as nothing at all. */
  t.check(unitFor({ packUnit: 'Ctn' }) === 'Ctn', 'a line with only a pack unit falls back to it');
  t.check(unitFor({}) === '', 'and one with neither shows nothing rather than "undefined"');
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
/*
 * ...but splitting them means the card only says the variant if the
 * variants column reached it, and this app is fed by two different hosts.
 * The standalone one selected 'id, name, image', so pickItemVariantLabel
 * had nothing to resolve against and returned '' -- and a brass hinge read
 * as plain "Cabinet Hinge", with nothing on the card naming the finish at
 * all. Saying it twice is untidy; not saying it sends someone to the wrong
 * shelf. So the heading falls back to the stored name, which always carries
 * the variant, whenever the variant cannot be named any other way.
 */
{
  const sw = read('shared-worker.js');
  t.check(/const canNameVariant = it\.variantIdx==null \|\| it\.variantIdx==='' \|\| !!variant;/.test(sw),
    'the card works out whether the variant can be named at all');
  t.check(/const heading = \(!canNameVariant && it\.productName\)\s*\r?\n?\s*\? it\.productName/.test(sw),
    'and keeps the stored name as the heading when it cannot');
  t.check(/<div class="wv-carousel-name">\$\{esc\(heading\)\}<\/div>/.test(sw),
    'which is what the heading renders from');
  t.check(/\$\{variant \? `<div class="wv-carousel-variant">\$\{esc\(variant\)\}<\/div>` : ''\}/.test(sw),
    'the variant line still renders, and only when there is one');

  // The rule itself, over every shape the two hosts produce. Built from the
  // real pickItemVariantLabel rather than a second copy of its logic --
  // hand-copying it here is what let the heading change slip past.
  const label = compileScope(
    [extractFunction(sw, 'pickItemVariantLabel', 'shared-worker.js')], {}, ['pickItemVariantLabel'],
  ).pickItemVariantLabel;
  const card = (it, product) => {
    const variant = label(it, product);
    const canNameVariant = it.variantIdx == null || it.variantIdx === '' || !!variant;
    const heading = (!canNameVariant && it.productName)
      ? it.productName
      : ((product && product.name) || it.productName || 'Item');
    return `${heading}${variant ? ` / ${variant}` : ''}`;
  };

  const HINGE = { id: 'P900', name: 'Cabinet Hinge', variants: [{ combo: { Finish: 'Brass' } }, { combo: { Finish: 'Steel' } }] };
  const BARE = { id: 'P900', name: 'Cabinet Hinge' };            // no variants column
  const adminLine = { productId: 'P900', variantIdx: 0, productName: 'Cabinet Hinge — Brass' };
  const agentLine = { productId: 'P900', variantIdx: 1, productName: 'Cabinet Hinge — Steel' };

  t.check(card(adminLine, HINGE) === 'Cabinet Hinge / Brass',
    'an admin-built line heads with the product and names the variant once');
  t.check(card(agentLine, HINGE) === 'Cabinet Hinge / Steel',
    'and so does an agent-submitted one');

  // The case the standalone app was actually in.
  t.check(card(adminLine, BARE) === 'Cabinet Hinge — Brass',
    'with no variants to resolve against, the heading still names the finish');
  t.check(card(adminLine, { id: 'P900', name: 'Cabinet Hinge', variants: [] }) === 'Cabinet Hinge — Brass',
    'and the same for an empty variants array');
  t.check(card({ ...adminLine, variantIdx: 7 }, HINGE) === 'Cabinet Hinge — Brass',
    'and for a variant index that is not there any more');

  // Everything that was already right.
  t.check(card({ productId: 'P900', variantIdx: null, productName: 'Cement' }, { id: 'P900', name: 'Cement' }) === 'Cement',
    'a product with no variant is named once and plainly');
  t.check(card({ productId: 'GONE', variantIdx: 0, productName: 'Deleted Thing — Red' }, null) === 'Deleted Thing — Red',
    'a product deleted out from under an order keeps the name the line remembers');
  t.check(card({ productId: 'GONE' }, null) === 'Item', 'and a line with neither still says something');

  // The property that matters, over all of it: a picker is never shown a
  // card that fails to say which one to take.
  const EVERY = [[adminLine, HINGE], [agentLine, HINGE], [adminLine, BARE],
    [adminLine, { id: 'P900', name: 'Cabinet Hinge', variants: [] }],
    [{ ...adminLine, variantIdx: 7 }, HINGE], [adminLine, null]];
  const silent = EVERY.filter(([it, p]) => !/Brass|Steel/.test(card(it, p)));
  t.check(silent.length === 0,
    silent.length
      ? `${silent.length} shape(s) show a variable item without naming its variant`
      : `every shape of a variable line names its variant somewhere on the card (${EVERY.length} checked)`);
}

/* ---------- 7c. looking at the photo is not picking the item ---------- */
/*
 * The card's photo carries .img-zoomable, and worker.html opens a lightbox
 * from a document-level listener on it. While the whole focused card was
 * the toggle, tapping the photo TO LOOK AT IT also marked the line picked --
 * the same reported bug as 0769797, reached by the one gesture a picker has
 * most reason to make: the photo is there to be examined.
 *
 * The two handlers coexist. The card's now claims only its two controls, so
 * the photo tap reaches the lightbox and nothing else.
 */
{
  const host = read('worker.html');
  t.check(/const zoomEl = e\.target\.closest\('\.img-zoomable'\);/.test(host),
    'the lightbox opens from its own document-level listener');
  /* The class is conditional now -- the quote screen's usual-buys cards
     and rows sit INSIDE a control that already acts on a tap, and a
     photo that also opened the lightbox put it on top of whatever that
     tap had just started. So the assertion moved from the literal
     string to the thing the literal string was standing for, and it
     got stricter in the move: the emitter still marks a real photo
     zoomable, it does so BY DEFAULT rather than on request, and this
     screen's own call takes that default. The old check could not have
     caught the default being flipped to off; these three can. */
  const emitter = (/function ipStageThumbHTML[\s\S]*?\n\}/.exec(read('shared-worker.js')) || [''])[0];
  t.check(/class="q-stage-thumb\$\{zoom \? ' img-zoomable' : ''\}"/.test(emitter),
    "and the pick card's photo is marked zoomable");
  t.check(/const zoom = !opts \|\| opts\.zoom !== false;/.test(emitter),
    'zoomable is what a caller gets for saying nothing — only an explicit {zoom:false} turns it off');
  t.check(/const photo = ipStageThumbHTML\(product\|\|\{\}, it\.variantIdx\);/.test(read('shared-worker.js')),
    'and the pick card asks for no such thing, so its photo stays zoomable');

  // The card handler must not claim it. Both controls are matched by
  // closest(); the photo is neither.
  const sw = read('shared-worker.js');
  const handler = sw.slice(sw.indexOf("querySelectorAll('.wv-carousel-card-inner')"), sw.indexOf('scrollend'));
  t.check(!/img-zoomable|carousel-photo/.test(handler),
    'the card handler does not mention the photo at all');
  t.check(!/else toggleItemPickedAt/.test(handler),
    'and has no catch-all branch that would take it anyway');

  // Only a real photo is zoomable -- an unphotographed line renders a
  // placeholder div, which carries no such class and opens nothing.
  t.check(/<div class="q-stage-thumb-placeholder">/.test(sw),
    'a line with no photo renders a placeholder');
  const ph = sw.slice(sw.indexOf('q-stage-thumb-placeholder'), sw.indexOf('q-stage-thumb-placeholder') + 200);
  t.check(!/img-zoomable/.test(ph), 'which is not zoomable, so tapping it opens nothing');
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
