#!/usr/bin/env node
'use strict';
/*
 * A value and its unit, separated by a flex gap and nothing else.
 *
 * This fault shipped past review three times in one day, in three files,
 * and looked perfect on screen every time:
 *
 *   worker card      8pc                  (quantity and unit)
 *   admin lifecycle  PINV-0042Hima Cement (invoice and supplier)
 *   catalogue chip   Roofing3             (aisle and count)
 *
 * The shape is always the same. A flex container sets `gap`, and the
 * markup puts an interpolated value straight against a <span> holding its
 * unit with no whitespace between them. The gap separates them visually,
 * so nothing looks wrong -- but the text node reads as one token, and that
 * is what a screen reader announces and what a copy-paste produces.
 *
 * Whitespace-only nodes collapse in a flex container, so the fix is a
 * single space and costs nothing on screen. There is no reason to ever
 * take the other option, which is what makes this worth a rule.
 *
 * WHY IT ONLY FIRES ON FLEX+GAP: `${qty}<span>%</span>` is correct and
 * common -- "50%" wants no space. The defect exists specifically when a
 * gap is doing separation the text does not have. Checking the parent's
 * own CSS is what keeps this from crying wolf, which several checks in
 * this suite have had to learn the hard way.
 *
 * Run: node test/flex-gap-spacing.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('flex gap spacing');

const FILES = ['index.html', 'agent.html', 'worker.html', 'catalogue.html', 'shared-worker.js'];

// Classes whose rule sets both display:flex (or inline-flex) and a gap.
// Classes that put a horizontal margin on THEMSELVES.
//
// Added after the rule walked past "Ongoing4" on the order-history tabs.
// The parent was display:flex with no gap; the separation came from a
// margin-left on the count span instead. Same defect, same invisible-on-
// screen symptom, different CSS property -- so keying only on the parent's
// gap was checking one spelling of the mistake.
//
// Narrower than it looks: it still requires the `${value}<span>` adjacency,
// and a span holding only punctuation is still excused. What it adds is a
// second answer to "is CSS doing separation the text does not have".
// A 1px margin is optical kerning, not separation: .ag-price-unit sets one
// so that "4,200/bag" breathes by a hair, and that pair genuinely wants no
// space. Only a margin big enough to read as a gap counts.
const MARGIN_READS_AS_A_GAP = 4;
function marginSeparatedClasses(css) {
  const out = new Set();
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const decl = /(^|[;\s])margin-(left|right):\s*([\d.]+)px/.exec(m[2]);
    if (!decl || Number(decl[3]) < MARGIN_READS_AS_A_GAP) continue;
    for (const sel of m[1].split(',')) {
      for (const cls of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) out.add(cls[1]);
    }
  }
  return out;
}

function flexGapClasses(css) {
  const out = new Set();
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const body = m[2];
    if (!/display:\s*(inline-)?flex/.test(body)) continue;
    if (!/(^|[;\s])gap:\s*[^;]*[1-9]/.test(body)) continue;
    for (const sel of m[1].split(',')) {
      for (const cls of sel.matchAll(/\.([A-Za-z][\w-]*)/g)) out.add(cls[1]);
    }
  }
  return out;
}

// `<div class="X">${value}<span ...>` with nothing between the two.
//
// The first version of this rule matched that shape alone and produced
// five hits, every one of them wrong -- which is worth recording, because
// a rule that cries wolf is one you switch off. Two exclusions carry the
// difference between the shape and the defect:
//
//   - An interpolation that yields MARKUP is not a value. `${ICON_PREP}`
//     followed by a <span> contributes no text node, so there is nothing
//     for the span's text to run into.
//   - A span holding only punctuation is a SEPARATOR, not a unit.
//     `${a}<span>/</span>${b}` reads "4,200/3,900", which is correct.
const LOOKS_LIKE_MARKUP = /icon|svg|html|\bICON_/i;
const PUNCTUATION_ONLY = /^[\s/|·•,;:.\-–—]*$/;
// Arrows and the like are decoration, not a unit. A sorted column header
// renders `${esc(c.label)}<span class="sort-arrow">${dir===1?'▲':'▼'}</span>`
// -- the span interpolates, so the punctuation test above never sees the
// glyph, and every sorted table in the admin got reported. (Its real defect
// is a missing aria-hidden, which is a different rule than this one.)
const DECORATION_ONLY = /^[\s/|·•,;:.\-–—▲▼◀▶←→↑↓✓✗×]*$/;
// Everything the span will actually render as text: the parts outside any
// interpolation, plus the string literals inside them.
function spanLiteralText(spanInner) {
  const literals = [...spanInner.matchAll(/'([^']*)'|"([^"]*)"/g)].map(m => m[1] ?? m[2]).join('');
  return literals + spanInner.replace(/\$\{[^}]*\}/g, '');
}

function unspacedUnits(src, flexClasses, marginClasses = new Set()) {
  const hits = [];
  // The `<span` does not always sit directly against the value's closing
  // brace. The worker card wraps it in a conditional that opens its own
  // template literal:
  //
  //   ${esc(qty)}${unit ? `<span class="u">${esc(unit)}</span>` : ''}
  //
  // An earlier version of this pattern required `}<span` and so missed the
  // very case that prompted the rule -- it passed only because the fixture
  // below was a simplified version of the real markup. The optional group
  // steps over such a wrapper.
  //   ${esc(qty)}${unit ? `<span class="u">…      (opens a literal)
  //   ${label}${pi.voided?' (voided)':''}<span…   (does not)
  //
  // Either way there is no whitespace anywhere between the value and the
  // span, which is the whole point. So: the value, then any run of further
  // interpolations, then the span.
  const re = /class="([^"]*)"[^>]*>\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}(?:\$\{[^{}]*\}|\$\{[^`{}]*`)*<span\b([^>]*)>([\s\S]{0,60}?)<\/span>/g;
  for (const m of src.matchAll(re)) {
    const [, classAttr, interpolation, spanAttrs, spanInner] = m;
    // A class attribute is often part-interpolated:
    //   class="cat-chip${c.name===activeCategory?' on':''}"
    // Splitting that on whitespace yields "cat-chip${c.name===activeCategory?'"
    // and never matches anything. Interpolations become separators.
    const classes = (attr) => (attr.match(/class="([^"]*)"/) || ['', ''])[1]
      .replace(/\$\{[^}]*\}/g, ' ').split(/\s+/).filter(Boolean);
    const parent = classAttr
      .replace(/\$\{[^}]*\}/g, ' ')
      .split(/\s+/).filter(Boolean)
      .find(c => flexClasses.has(c));
    // Either the parent's gap or the span's own margin is doing the
    // separating. Both leave the text node with nothing between the value
    // and its unit.
    const margined = classes(spanAttrs).find(c => marginClasses.has(c));
    if (!parent && !margined) continue;
    if (LOOKS_LIKE_MARKUP.test(interpolation)) continue;
    // A span that interpolates something is carrying a value, so it is a
    // unit and not a separator. Only a span whose entire content is
    // literal punctuation gets excused.
    const carriesAValue = /\$\{/.test(spanInner);
    if (!carriesAValue && PUNCTUATION_ONLY.test(spanInner)) continue;
    // An interpolating span whose every literal character is decoration is
    // a separator too. Guarded on there BEING literal characters -- `${n}`
    // has none, and a vacuous "all of nothing is punctuation" would excuse
    // exactly the bare-count case this rule exists for.
    const literal = spanLiteralText(spanInner);
    if (carriesAValue && literal.trim() && DECORATION_ONLY.test(literal)) continue;
    hits.push({ parent: parent || margined, snippet: src.slice(m.index, m.index + 90).replace(/\s+/g, ' ') });
  }

  return hits;
}

/*
 * KNOWN GAP, stated rather than hidden.
 *
 * The same fault occurs with a LITERAL where this rule expects an
 * interpolation:
 *
 *   <div class="ag-cat-head"><b>Browse</b><span class="all">All 7</span>
 *
 * which reads "BrowseAll 7". That shipped in the category header while I
 * was writing this very file, and the rule walked past it.
 *
 * I tried to extend the pattern to any two abutting children and it
 * returned 24 hits in index.html, nearly all false: <b> and <span> nested
 * inside an inner <div> are not siblings of the flex gap, and a regex
 * cannot see that they are a level down. A rule reporting 24 false alarms
 * is one you switch off, which is worse than a narrow rule that is right.
 *
 * So this covers the interpolation form only. Catching the literal form
 * needs a real DOM parse of the rendered output rather than a text scan,
 * which is a different tool than this suite currently has.
 *
 * SECOND KNOWN GAP: the value inside a span of its own.
 *
 *   <span class="ag-receipt-name">${esc(it.name)}</span>${it.variantLabel
 *     ? `<span class="ag-grid-variant">${esc(it.variantLabel)}</span>` : ''}
 *
 * which reads "Roofing sheetGauge 30" on the quotation a customer is
 * handed, separated only by a 6px margin-left. The pattern below steps
 * over interpolations sitting between the value and the span, but not over
 * a closing tag, so it walks past this one.
 *
 * Widening it to step over `</\w+>` would also make it match two adjacent
 * sibling spans -- which section 2 currently excuses on the grounds that
 * they are "already separate text nodes". That excuse is wrong (textContent
 * concatenates them identically), but reversing it is a judgement about
 * four files' worth of markup rather than a regex tweak, and this rule has
 * already cost two rounds of false positives. Recorded rather than guessed
 * at, and the two live instances are pinned in section 4 instead.
 */

/* ---------- 1. the rule catches the three real cases ----------------- */
/*
 * Fed the markup exactly as it shipped, against the real stylesheets.
 * If the detector cannot see these it is not worth running.
 */
{
  // These are the markup as it ACTUALLY shipped, copied from the files
  // rather than paraphrased. A simplified fixture is how the first version
  // of this rule passed its own tests while missing the worker case in the
  // real file -- the one that has a conditional wrapper around the span.
  const cases = [
    ['worker quantity', '.wv-carousel-qty{display:flex;align-items:baseline;gap:6px;}',
      '<div class="wv-carousel-qty">${esc(qty)}${unit ? `<span class="u">${esc(unit)}</span>` : \'\'}</div>'],
    ['admin lifecycle link', '.lc-link{display:inline-flex;align-items:baseline;gap:6px;}',
      '<button class="lc-link" data-pi="${pi.id}">${esc(purchaseInvoiceNumberLabel(pi))}${pi.voided?\' (voided)\':\'\'}<span class="lc-sup">${esc(pi.supplierName)}</span></button>'],
    ['catalogue chip', '.cat-chip{display:inline-flex;align-items:center;gap:6px;}',
      '<button type="button" class="cat-chip" data-cat="${esc(c.name)}">${esc(c.label)}<span class="cat-n">${c.count}</span></button>'],
  ];
  cases.forEach(([name, css, markup]) => {
    const hits = unspacedUnits(markup, flexGapClasses(css));
    t.check(hits.length === 1, `it catches the ${name} case as it shipped`);
  });

  // And clears each once the space is added. The space goes immediately
  // before the span wherever that lands -- inside the conditional's
  // template literal for the worker case, which is exactly the real fix.
  cases.forEach(([name, css, markup]) => {
    const fixed = markup.replace('<span', ' <span');
    t.check(unspacedUnits(fixed, flexGapClasses(css)).length === 0,
      `and passes the ${name} case once a space is added`);
  });
}

/* ---------- 2. it does not cry wolf ---------------------------------- */
{
  const flex = flexGapClasses('.row{display:flex;gap:8px;}');
  const noGap = flexGapClasses('.tight{display:flex;}');
  const zeroGap = flexGapClasses('.zero{display:flex;gap:0;}');

  t.check(unspacedUnits('<div class="tight">${pct}<span>%</span></div>', noGap).length === 0,
    'a percentage in a flex container with NO gap is left alone -- "50%" is correct');
  t.check(unspacedUnits('<div class="zero">${pct}<span>%</span></div>', zeroGap).length === 0,
    'and so is one whose gap is zero, since nothing is separating them visually');
  t.check(unspacedUnits('<div class="plain">${qty}<span>pc</span></div>', flex).length === 0,
    'a container that is not flex is not this bug');
  t.check(unspacedUnits('<div class="row">${qty} <span>pc</span></div>', flex).length === 0,
    'an existing space passes');
  t.check(unspacedUnits('<div class="row">${a}<b>x</b></div>', flex).length === 0,
    'only a <span> suffix is considered, not every adjacent tag');
  t.check(unspacedUnits('<div class="row"><span>${qty}</span><span>pc</span></div>', flex).length === 0,
    'two spans are already separate text nodes and are not flagged');

  // Nested braces in the interpolation must not break the match.
  const nested = unspacedUnits(
    '<div class="row">${fmt(a?{x:1}:{y:2})}<span>u</span></div>', flex);
  t.check(nested.length === 1, 'an interpolation containing braces is still seen');
}

/* ---------- 2b. the margin spelling of the same mistake -------------- */
/*
 * "Ongoing4" on the order-history tabs, as it shipped into the working
 * file. The parent was display:flex with NO gap; a margin-left on the count
 * span did the separating instead, so the gap-only rule walked straight
 * past it.
 */
{
  const CSS = '.ag-seg-btn{display:flex;align-items:center;justify-content:center;}'
    + '.ag-seg-count{margin-left:6px;font-size:11.5px;}';
  const flex = flexGapClasses(CSS);
  const margins = marginSeparatedClasses(CSS);
  const shipped = '<button class="ag-seg-btn" data-seg="ongoing">${label}<span class="ag-seg-count">${n}</span></button>';

  t.check(flex.size === 0, 'the parent has no gap, so the original rule had nothing to key on');
  t.check(unspacedUnits(shipped, flex).length === 0, 'and indeed it caught nothing');
  t.check(unspacedUnits(shipped, flex, margins).length === 1,
    'the margin signal catches it');
  t.check(unspacedUnits(shipped.replace('<span', ' <span'), flex, margins).length === 0,
    'and clears once the space is added');

  // Still no wolf-crying: a margin does not make punctuation a unit, and a
  // span with no margin of its own is left alone.
  t.check(unspacedUnits('<div class="x">${a}<span class="ag-seg-count">/</span>${b}</div>', flex, margins).length === 0,
    'a punctuation-only span is still a separator, margin or not');
  t.check(unspacedUnits('<div class="x">${a}<span class="plain">u</span></div>', flex, margins).length === 0,
    'and a span with no margin of its own is not this bug');
  t.check(unspacedUnits('<div class="x">${a}<span class="zero">u</span></div>',
    flex, marginSeparatedClasses('.zero{margin-left:0;}')).length === 0,
    'nor is a zero margin, which separates nothing');

  // The two real false positives the margin signal produced on its first
  // run, both from the shipped files. Kept as cases because each cost a
  // round to diagnose and either would have made the rule not worth having.
  const kerning = marginSeparatedClasses('.ag-price-unit{font-size:12px;margin-left:1px;}');
  t.check(kerning.size === 0,
    'a 1px margin is kerning, not a gap -- "UGX 4,200/bag" wants no space and must not be reported');
  t.check(unspacedUnits('<div class="ag-tl-price">${fmtUGX(row.price)}<span class="ag-price-unit">/${esc(row.priceUnit)}</span></div>',
    flex, kerning).length === 0, 'so the price/unit pair passes');

  const arrows = marginSeparatedClasses('.sort-arrow{margin-left:4px;font-size:9px;}');
  t.check(arrows.has('sort-arrow'), 'a 4px margin does count as a gap');
  t.check(unspacedUnits('<th class="sortable" data-key="${c.key}">${esc(c.label)}<span class="sort-arrow">${sort.dir===1?\'▲\':\'▼\'}</span></th>',
    flex, arrows).length === 0,
    'but a span whose only literals are arrows is decoration, not a unit -- every sorted admin table was being reported');
  t.check(unspacedUnits('<div class="x">${label}<span class="sort-arrow">${n}</span></div>', flex, arrows).length === 1,
    'while the same span carrying a bare number is still caught, so the decoration excuse is not a hole');
}

/* ---------- 3. the apps are clean ------------------------------------ */
{
  const css = FILES.map(f => read(f)).join('\n');
  const flexClasses = flexGapClasses(css);
  const marginClasses = marginSeparatedClasses(css);
  t.check(flexClasses.size > 10, `the stylesheets yield flex-gap classes to check against (${flexClasses.size})`);
  t.check(marginClasses.size > 10, `and margin-separated ones (${marginClasses.size})`);

  let total = 0;
  FILES.forEach(f => {
    const hits = unspacedUnits(read(f), flexClasses, marginClasses);
    total += hits.length;
    t.check(hits.length === 0,
      hits.length
        ? `${f} has a value abutting its unit inside .${hits[0].parent} — ${hits[0].snippet}`
        : `${f} separates every value from its unit`);
  });
  t.check(total === 0, `no unspaced value/unit pair anywhere (${total})`);
}

/* ---------- 4. the two the rule cannot see, pinned by hand ----------- */
/*
 * Both quote tables put a product name in one span and its variant in the
 * next, separated by .ag-grid-variant's 6px margin-left and nothing else,
 * so the text read "Roofing sheetGauge 30" -- on the agent's editing view
 * and on the receipt a customer is shown and can download.
 *
 * The sweep above cannot reach this shape (see SECOND KNOWN GAP), so it is
 * asserted directly against the two call sites. Checked as markup rather
 * than behaviour because there is no DOM here; the rendered output was
 * verified in the browser.
 */
{
  // Two things moved under this check, and neither changes what it is
  // for. The two quote TABLES are lists of rows now -- four columns did
  // not fit across a 390px phone -- so the CSS that supplies the margin
  // is selected through .fx-qlist rather than .ag-receipt-table. And the
  // agent's own row, which clips its name to one line, carries a title
  // attribute with the full name, so the opening tag is no longer bare.
  //
  // The hazard is unchanged: two sibling spans in one text flow, with a
  // 6px margin doing the separating and nothing in the text to match it.
  // Both call sites are still found, and both still carry the real space.
  const agent = read('agent.html');
  const hits = [...agent.matchAll(/<span class="ag-receipt-name"[^>]*>\$\{esc\(it\.name\)\}<\/span>\$\{it\.variantLabel \? (.)/g)]
    .map(m => m[1]);
  t.check(hits.length === 2, `both quote views are found (${hits.length})`);
  t.check(hits.every(c => c === '`'), 'each opens its conditional with a template literal, as expected');

  const spaced = [...agent.matchAll(/<\/span>\$\{it\.variantLabel \? ` <span class="ag-grid-variant">/g)].length;
  t.check(spaced === 2,
    `both put a real space between the product name and its variant (${spaced} of ${hits.length})`);

  // And the margin that hid it is still there, which is why the space has
  // to be: remove the margin and this would be a different conversation.
  t.check(/\.fx-qlist \.ag-grid-variant\{[^}]*margin:0 0 0 6px/.test(agent),
    'the variant is still separated visually by a margin, with nothing in the text to match it');
  t.check(!/\.ag-receipt-table/.test(agent),
    'and the table it used to be selected through is gone, not merely bypassed');
}

process.exit(t.done() ? 1 : 0);
