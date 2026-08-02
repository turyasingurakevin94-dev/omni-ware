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

function unspacedUnits(src, flexClasses) {
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
  const re = /class="([^"]*)"[^>]*>\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}(?:\$\{[^{}]*\}|\$\{[^`{}]*`)*<span\b[^>]*>([\s\S]{0,60}?)<\/span>/g;
  for (const m of src.matchAll(re)) {
    const [, classAttr, interpolation, spanInner] = m;
    // A class attribute is often part-interpolated:
    //   class="cat-chip${c.name===activeCategory?' on':''}"
    // Splitting that on whitespace yields "cat-chip${c.name===activeCategory?'"
    // and never matches anything. Interpolations become separators.
    const parent = classAttr
      .replace(/\$\{[^}]*\}/g, ' ')
      .split(/\s+/).filter(Boolean)
      .find(c => flexClasses.has(c));
    if (!parent) continue;
    if (LOOKS_LIKE_MARKUP.test(interpolation)) continue;
    // A span that interpolates something is carrying a value, so it is a
    // unit and not a separator. Only a span whose entire content is
    // literal punctuation gets excused.
    const carriesAValue = /\$\{/.test(spanInner);
    if (!carriesAValue && PUNCTUATION_ONLY.test(spanInner)) continue;
    hits.push({ parent, snippet: src.slice(m.index, m.index + 90).replace(/\s+/g, ' ') });
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

/* ---------- 3. the apps are clean ------------------------------------ */
{
  const css = FILES.map(f => read(f)).join('\n');
  const flexClasses = flexGapClasses(css);
  t.check(flexClasses.size > 10, `the stylesheets yield flex-gap classes to check against (${flexClasses.size})`);

  let total = 0;
  FILES.forEach(f => {
    const hits = unspacedUnits(read(f), flexClasses);
    total += hits.length;
    t.check(hits.length === 0,
      hits.length
        ? `${f} has a value abutting its unit inside .${hits[0].parent} — ${hits[0].snippet}`
        : `${f} separates every value from its unit`);
  });
  t.check(total === 0, `no unspaced value/unit pair anywhere (${total})`);
}

process.exit(t.done() ? 1 : 0);
