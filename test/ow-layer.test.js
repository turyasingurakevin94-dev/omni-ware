#!/usr/bin/env node
'use strict';
/*
 * The OW layer stays in its own lane.
 *
 * The app's stylesheet grew screen by screen for a year: 33 font sizes in
 * half-pixel steps, 27 radii, ~35 shadows, 128 class prefixes, thirteen
 * competing button families. The console's new layer does not fix any of
 * that. It sits at the end, adds a vocabulary, and touches nothing —
 * which is the only way to introduce a design system into 7,591 lines of
 * CSS without a rewrite nobody asked for.
 *
 * That promise is only worth something if it is enforced. Three laws,
 * each protecting something specific:
 *
 *   nothing outside .ow-   Eight test files compare RAW declaration text
 *                          through winningDeclaration. The moment a rule
 *                          above is rewritten to use a token, or a bare
 *                          element selector lands here, those tests are
 *                          measuring something this file changed. The
 *                          namespace is the fence.
 *
 *   nothing on body        `body` sets no font-size and no line-height
 *                          today, so every unstyled element in all forty
 *                          screens inherits the browser default. Setting
 *                          a base here restyles the entire app in one
 *                          commit, which is exactly what an additive
 *                          layer must not do.
 *
 *   no fourteenth button   There are already thirteen button families.
 *                          A new one is not a fix, it is another one.
 *                          The layer gets a size modifier ON the existing
 *                          .btn family and nothing else.
 *
 * Run: node test/ow-layer.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('ow layer');
const src = read('index.html');

/* ---------- the layer, isolated ---------- */
const MARK = 'THE OW LAYER';
const markAt = src.indexOf(MARK);
const start = src.lastIndexOf('/*', markAt);   /* the banner's own opener, so the strip below terminates */
const styleEnd = src.indexOf('\n</style>\n');
t.check(markAt > 0 && start > 0, 'the layer is in the stylesheet, under its own banner');
t.check(styleEnd > start,
  'and it sits at the END of it — so adding it moved no line number above');

const layer = src.slice(start, styleEnd);
const before = src.slice(0, start);
/* Comments carry prose about selectors; stripping them first keeps the
   scan honest rather than matching an example in a sentence. */
const bare = layer.replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------- 1. every selector stays inside the namespace ---------- */
{
  const sels = [];
  bare.replace(/(^|[};])\s*([^{};@]+?)\{/g, (m, _p, sel) => { sels.push(sel.trim()); return m; });
  t.check(sels.length > 30, `the scan found the layer's rules (${sels.length})`);

  /* :root carries the tokens. .btn.ow-sm is the one deliberate reach
     outside the namespace and it is a MODIFIER on the existing family,
     never a redefinition of .btn itself. */
  const ALLOWED = /^(:root|(?:\.ow-[a-z0-9-]+)+|\.btn(?:\.ow-[a-z0-9-]+)+)$/;
  const strays = [];
  sels.forEach(s => s.split(',').forEach(part => {
    /* Reduce a compound selector to the tokens that could reach outside:
       drop combinators, pseudo-classes, pseudo-elements and attributes,
       then require every remaining piece to be ours. */
    /* Pseudo-classes go FIRST: an nth-child argument can contain a `+`,
       which the combinator split would otherwise tear in half and then
       report as a stray. */
    const clean = part.trim().replace(/::?[a-z-]+(\([^)]*\))?/g, '').replace(/\[[^\]]*\]/g, '');
    clean.split(/\s|>|\+|~/).filter(Boolean).forEach(head => {
      if (!ALLOWED.test(head)) strays.push(part.trim() + '  →  ' + head);
    });
  }));
  t.check(strays.length === 0,
    `every selector in the layer is .ow- or :root${strays.length ? ' — strays: ' + strays.slice(0, 5).join(' | ') : ''}`);

  const btnRules = sels.filter(s => /(^|[\s,])\.btn(?![.\w-])/.test(s));
  t.check(btnRules.length === 0,
    `and .btn itself is never redefined here${btnRules.length ? ' (' + btnRules.join(' | ') + ')' : ''}`);
}

/* ---------- 2. nothing touches body, html or a bare element ---------- */
{
  t.check(!/(^|[};\s])(body|html)\s*[,{]/.test(bare),
    'the layer never selects body or html — the app has no base font-size, and adding one restyles forty screens at once');
  t.check(!/font-size/.test(before.slice(before.lastIndexOf('\n  body{'), before.lastIndexOf('\n  body{') + 260)) || before.indexOf('\n  body{') < 0,
    'and body still declares no font-size, which is why that matters');
}

/* ---------- 3. no fourteenth button family ---------- */
{
  t.check(!/\.ow-btn/.test(layer),
    'there is no .ow-btn — thirteen competing button families is the disease, not the cure');
  t.check(/\.btn\.ow-sm\{/.test(bare),
    'the layer adds one SIZE MODIFIER to the existing family instead');
}

/* ---------- 4. the scales hold ---------- */
{
  /* Half-pixel sizes are how the file got to 33 of them. A handful of
     deliberate 10.5/11.5/12.5 remain inside components where the token
     scale has no step; what must not happen is a NEW ladder of them. */
  const halves = [...bare.matchAll(/font-size:\s*(\d+\.5)px/g)].map(m => m[1]);
  t.check(new Set(halves).size <= 3,
    `at most three half-pixel sizes survive in the layer (${[...new Set(halves)].join(', ') || 'none'}) — the token scale is integers`);

  const weights = [...bare.matchAll(/font-weight:\s*(\d{3})/g)].map(m => Number(m[1]));
  t.check(weights.every(w => w <= 700),
    'no weight above 700: the @import loads Inter 400/500/600/700 and anything else is synthesised');
  t.check(!/--ow-fw-(650|800)/.test(layer),
    'and no token legitimises the 650 and 800 the rest of the file uses without loading them');

  /* Every token the layer reads must be one the file declares. The
     app-wide sweep in css-custom-properties.test.js covers this too;
     naming it here makes a stray token fail in the file that owns it. */
  const roots = src.match(/--[a-z0-9-]+\s*:/gi) || [];
  const declared = new Set(roots.map(d => d.slice(0, d.indexOf(':')).trim()));
  const used = new Set([...bare.matchAll(/var\((--[a-z0-9-]+)/gi)].map(m => m[1]));
  const missing = [...used].filter(v => !declared.has(v));
  t.check(missing.length === 0,
    `every token the layer reads is declared${missing.length ? ' — missing: ' + missing.join(', ') : ` (${used.size} distinct)`}`);
}

/* ---------- 5. the one new colour replaces, it does not add ---------- */
{
  /* The audit found seventeen distinct near-white surfaces where the
     palette offers two. The layer needed a hover surface; it was taken
     from hex ALREADY in the file rather than invented, so the count of
     distinct colours in this stylesheet does not grow by one. */
  /* Was: a literal check for #F7F9FB. That hex was the value on the day
     this was written; the assertion it was standing in for is that the
     layer's hover surface is a colour the legacy sheet ALREADY paints,
     not a new near-white. The re-skin moved every near-white at once, so
     the literal went stale while the invariant did not. Read the token's
     value and hold it to the same rule. */
  const hoverHex = (/--ow-paper-2:\s*(#[0-9A-Fa-f]{6});/.exec(layer) || [])[1];
  t.check(!!hoverHex && before.toUpperCase().includes(hoverHex.toUpperCase()),
    `the hover surface (${hoverHex}) is a row hover that already existed, promoted to a token`);
  const newHex = [...new Set([...layer.matchAll(/#[0-9A-Fa-f]{6}/g)].map(m => m[0].toUpperCase()))]
    .filter(h => !before.toUpperCase().includes(h));
  t.check(newHex.length === 0,
    `and the layer introduces no colour this file did not already contain${newHex.length ? ' — new: ' + newHex.join(', ') : ''}`);
}

/* ---------- 6. the phone is a switch, not a reflow ---------- */
{
  const mq = [...bare.matchAll(/@media\s*\(([^)]+)\)/g)].map(m => m[1].replace(/\s/g, ''));
  t.check(mq.includes('max-width:820px'),
    'the layer switches at 820px — the app\'s existing phone breakpoint, not a new one');
  t.check(/\.ow-q-r\{display:none;\}/.test(bare.replace(/\s*\n\s*/g, '')) || /\.ow-q-r\{display:none/.test(bare),
    'and on the phone the desktop queue row is replaced outright by the card, rather than being squeezed');
  t.check(/--ow-tap:44px/.test(layer) && /min-height:var\(--ow-tap\)/.test(bare),
    'with a real tap target on the actions');
}

process.exit(t.done() ? 1 : 0);
