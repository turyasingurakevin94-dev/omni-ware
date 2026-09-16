#!/usr/bin/env node
'use strict';
/*
 * The ratchet.
 *
 * This app is being redesigned screen by screen, and some of that work
 * will be done by people and agents who did not sit through the year of
 * decisions behind it. A document explaining the house style is a
 * document; this is a gate. Anything that widens the palette, the type
 * ramp, the radii or the shadows fails here, and `npm test` fails with
 * it.
 *
 * TWO HALVES, and the split matters.
 *
 *   THE CEILINGS. The stylesheet grew for a year and carries real
 *   disease: 32 font sizes in half-pixel steps, 28 radii, 62 shadows,
 *   119 distinct colours. Those numbers cannot be fixed today and
 *   testing against zero would fail on line one. So they are frozen as
 *   CEILINGS. The count may fall — lower the number here when it does —
 *   and it may never rise. A 33rd font size or a 31st radius fails.
 *   That makes the redesign monotonic: every session leaves the file
 *   cleaner than it found it, whoever does the session.
 *
 *   THE LAYER. New work lives in the .ow- layer and is held to the
 *   actual system: the ramp, four weights, three families, four radii,
 *   one elevation, the ten-step space scale — and contrast.
 *
 * WHY CONTRAST IS IN A TEST. This app once painted amber ink on an
 * oxide fill: dark olive on red, 1.26:1, the worst pairing available in
 * its own palette, on a phone used outdoors in Uganda. Nobody caught it
 * by looking. The arithmetic catches it every time.
 *
 * Run: node test/design-system.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('design system');
const src = read('index.html');

const styleStart = src.indexOf('<style>');
const styleEnd = src.indexOf('\n</style>\n');

/* THE FILE IS TWO SYSTEMS NOW, and the split has to happen before a
 * single thing is counted.
 *
 * The .om- layer at the end of the stylesheet is the 2026 card system
 * from the design handoffs: IBM Plex, navy, coral, warm ground. It
 * shares not one hex value with the console above it — that is what
 * makes it a replacement rather than a revision — so counting its 66
 * colours against a ceiling measured on the old palette would say
 * "something new was introduced" about a system that was introduced
 * deliberately, and say nothing at all about the old file rotting.
 *
 * So the ceilings and the .ow- checks below run on the stylesheet WITH
 * THE OM LAYER REMOVED. They keep measuring exactly what they always
 * measured: the legacy CSS and the console layer, both of which still
 * dress the screens the redesign has not reached. Their numbers can
 * now only fall, and every one that falls gets locked in here.
 *
 * The OM layer answers to its own gate at the foot of this file, which
 * is stricter than this one has ever been: not a hex literal anywhere
 * in a component rule.
 */
const omMarkAt = src.indexOf('THE OM LAYER');
const omStart = omMarkAt === -1 ? styleEnd : src.lastIndexOf('/*', omMarkAt);
const omRaw = src.slice(omStart, styleEnd);
const om = omRaw.replace(/\/\*[\s\S]*?\*\//g, ' ');

const cssRaw = src.slice(styleStart, omStart);
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, ' ');

const markAt = src.indexOf('THE OW LAYER');
const layerRaw = src.slice(src.lastIndexOf('/*', markAt), omStart);
const layer = layerRaw.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ---------- the ceilings ---------- */
{
  /* Measured on the day this file was written. Every one of these is a
     ceiling, never a target: lower it when the count falls, and the
     next person cannot quietly raise it back. */
  const CEILING = {
    /* 31, not 32: the statements' half-pixel ramp -- 9, 9.5, 10.5,
       11.5, 12.5, 15.5 and 29px across sixteen sizes in one block --
       came onto the 11/12/13/14/16/20 ramp when that screen was drawn
       as a console. */
    'font sizes': [31, /font-size:\s*([\d.]+)px/g],
    /* 26, not 27: Compare Prices went the same way. Its verdict slab and
       phone cards carried 12px and 11px, its rival chips 20px, and its
       notes 9px -- four bespoke radii on one screen, replaced by the
       layer's 4 / 6 / 8 when it was drawn as a console.

       27, not 28 before that: the WhatsApp desk's bespoke radii went
       with the screen they clothed -- 11px stat cards, 12px picks and
       bubbles, 14px on the inbox shell and 21px on the round composer. */
    'radii': [26, /border-radius:\s*([^;}]+)/g],
    /* 56, not 62, and this number is MEASURED rather than argued from
       one side: two screens lost their bespoke depth in the same week
       and the merge had to be counted, not reasoned about.

       Four went with the sourcing lane board -- the card at rest and on
       hover, the lane's flash ring, and the count bubble's ring on the
       step rail; a board of thirty floating cards was the largest
       single argument in the file against depth being hairlines.

       Two went with the WhatsApp inbox -- the shell's own drop shadow
       and the shadow under every chat bubble.

       (62, not 63, was the cash book's two floating + / - buttons: they
       duplicated Money in and Money out from the top of the page, and
       the entry line that replaced them is permanently on screen.) */
    /* 56, not 55, and this one goes UP -- the only entry in this table
       that ever has, so it is argued rather than nudged.

       Media's phone screen ends in a camera bar fixed above the tab bar,
       and the photographs scroll underneath it. That is the one thing
       --ow-lift is FOR: "things that genuinely float -- a menu, a search
       result". Every alternative was worse. A top hairline cannot edge a
       bar inset 16px from both sides. Running the bar edge to edge to
       earn a hairline would put a second full-width chrome band directly
       above the tab bar, which reads as two tab bars. Leaving it flat
       lets a card slide flush under an oxide stripe with nothing to say
       the stripe is in front.

       It is the layer's own value, used once, on the one element in the
       app that is fixed over its own scrolling content.

       (55, not 56, was a second elevation on a tab: the statements'
       active document tab lifted itself off the tray it sat in; it is
       underscored now, and depth on this app is hairlines.) */
    /* 57, not 56, and this one goes up too -- but it is not an
       elevation. Follow-ups' metric strip became the filter: press Money
       and the queue below shows the fifteen clients past your terms. The
       chosen tile needed the layer's own mark for "this one is chosen",
       and the layer already has one -- .ow-lr.ow-on wears the quiet
       paper and a 3px steel bar down its left edge, drawn as a border.

       A tile cannot use that border: .ow-mt's left border is the strip's
       own hairline divider, so overwriting it would move the divider
       rather than mark the tile. So the same bar, on top, as an INSET
       shadow -- which is what the elevation rule allows beside
       var(--ow-lift) and none, and what .tl-x and .pr-tbl .tl-on already
       use for exactly this mark. It paints inside the box; nothing
       floats. */
    /* 56, not 57: the quote's sticky bar floated on a shadow of its own.
       It is a bar, not a menu -- a hairline above it is the depth. */
    /* 54, not 56, and both went with the same removal. The three
       sideways run tracks are gone -- the buying round, the delivery
       runs and the pickup clusters are hairline rows in the board's one
       dialog now -- and with them went .dr-nav's floating arrow and
       .bl-send's filled button, each of which carried an elevation of
       its own. Depth on this app is hairlines; two fewer shadows is the
       gain, and this is where it is locked in. */
    'shadows': [54, /box-shadow:\s*([^;}]+)/g],
    /* 103, not 104: the product form's type cards carried #FFF9EF -- a
       cream that existed only to tint the selected option, and that made
       the selection one of four things on that form wearing a warm colour
       while claiming to be the one thing to do next. The selection is
       steel now (a dark border, a paper-2 ground and a filled dot), and
       the cream went with it.
       (104, not 105: the statements' verdict slab carried #C4DED6, a
       verdigris keyline that was in no palette and existed only to edge
       a tinted banner. The banner is a row in ink now and the colour
       went with it. (105 was Follow-ups' card wall: its own hover
       border, its own two near-whites for a card and a settled row, and
       its own hover fill -- all four gone when that screen became a
       console on the layer.)) */
    'distinct colours': [103, /#[0-9A-Fa-f]{6}\b/g],
  };
  /* RESOLVE THE TOKENS BEFORE COUNTING.
   *
   * This gate counts distinct declaration TEXT, and that was wrong in a
   * way it took a real commit to notice: adopting `var(--ow-r-pill)` in
   * place of a hand-written `999px` raised the radius count by one and
   * failed the check — the gate punishing the exact move it exists to
   * encourage, while the browser rendered the identical corner.
   *
   * So every --ow-* value declared in :root is substituted first. A
   * token now counts as the value it stands for: adopting one is free,
   * inventing a thirty-first radius still fails. */
  const tokens = new Map([...css.matchAll(/(--ow-[a-z0-9-]+):\s*([^;{}]+);/g)]
    .map((m) => [m[1], m[2].trim()]));
  const resolve = (v) => {
    let out = v, guard = 0;
    while (/var\(--ow-/.test(out) && guard++ < 5) {
      out = out.replace(/var\((--ow-[a-z0-9-]+)(?:,[^)]*)?\)/g,
        (whole, name) => (tokens.has(name) ? tokens.get(name) : whole));
    }
    return out;
  };
  Object.entries(CEILING).forEach(([name, [max, re]]) => {
    const found = new Set([...css.matchAll(re)].map(m => resolve((m[1] || m[0]).trim()).toUpperCase()));
    t.check(found.size <= max,
      `${name}: ${found.size} (ceiling ${max})${found.size > max ? ' — something new was introduced' : ''}`);
    if (found.size < max) {
      t.check(false, `${name} fell to ${found.size} — lower the ceiling in this file to lock the gain in`);
    }
  });

  /* Two weights the @import does not load. The browser synthesises them,
     which is why some headings in the old screens look thick and muddy.
     They may not spread. */
  [['650', 8], ['800', 12]].forEach(([w, max]) => {
    const n = (css.match(new RegExp(`font-weight:\\s*${w}`, 'g')) || []).length;
    t.check(n <= max, `weight ${w} is used ${n} times (ceiling ${max}) — it is not loaded and is faked by the browser`);
  });
}

/* ---------- contrast ---------- */
{
  const hex = (name) => (new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css) || [])[1];
  const lum = (h) => {
    const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b);
    return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
  };

  const PAPER = hex('--ow-paper'), GROUND = hex('--ow-steel-050'), NAVY = hex('--ow-steel-950');
  t.check(!!PAPER && !!GROUND && !!NAVY, 'the grounds are declared and readable');

  /* Every pairing the system actually asserts, with the floor that
     applies to it. 4.5 is the small-text floor; 3 is allowed only where
     the type is genuinely large. */
  const PAIRS = [
    ['--ow-ink-900', PAPER, 4.5, 'body text on a panel'],
    ['--ow-ink-900', GROUND, 4.5, 'body text on the page'],
    ['--ow-ink-600', PAPER, 4.5, 'secondary text on a panel'],
    ['--ow-ink-600', GROUND, 4.5, 'secondary text on the page — this is the caption colour'],
    ['--ow-oxide', PAPER, 4.5, 'the accent as text'],
    ['--ow-verdigris', PAPER, 4.5, 'good, as text'],
    ['--ow-crimson', PAPER, 4.5, 'bad, as text'],
    ['--ow-amber-ink', hex('--ow-amber-soft'), 4.5, 'caution ink on its own ground'],
    ['--ow-oxide-deep', hex('--ow-oxide-soft'), 4.5, 'chip ink on chip ground'],
  ];
  PAIRS.forEach(([tok, ground, floor, why]) => {
    const c = hex(tok);
    const r = c && ground ? ratio(c, ground) : 0;
    t.check(r >= floor, `${r}:1 — ${tok} on ${ground} (needs ${floor}) · ${why}`);
  });

  t.check(ratio(PAPER, hex('--ow-oxide')) >= 4.5,
    `${ratio(PAPER, hex('--ow-oxide'))}:1 — white on an oxide fill, which is what every accent button is`);

  /* THE PAIRING THAT MUST NEVER RETURN. --ow-amber-ink is dark ink FOR
     amber grounds. On the oxide fill it is 1.26:1. The app shipped it
     once, on the phone's tab bar, and it took a screenshot from the
     owner to find. */
  t.check(ratio(hex('--ow-amber-ink'), hex('--ow-oxide')) < 2,
    'amber ink on oxide really is as bad as the comment says (this asserts the arithmetic, not the usage)');
  t.check(!/background:\s*var\(--ow-oxide\)[^}]*color:\s*var\(--ow-amber-ink\)/.test(layer)
       && !/color:\s*var\(--ow-amber-ink\)[^}]*background:\s*var\(--ow-oxide\)/.test(layer),
    'and nothing in the layer puts them together');

  /* --ow-ink-400 is 3.12:1 on paper and 2.61:1 on the page ground. It
     is a LARGE-TEXT colour and there is no room for a third grey: the
     next value that clears 4.5 on the ground is --ow-ink-600 itself.
     So small text uses ink-600, and this is where that is enforced. */
  const small = [];
  [...layer.matchAll(/([^{}]+)\{([^}]*)\}/g)].forEach((m) => {
    const sel = m[1].trim(), body = m[2];
    if (!/--ow-ink-400/.test(body)) return;
    const fs = /font-size:\s*(?:var\(--ow-t-(\d+)\)|([\d.]+)px)/.exec(body);
    if (!fs) return;                       // inherits; judged by its parent
    const px = Number(fs[1] || fs[2]);
    if (px < 14) small.push(`${sel} (${px}px)`);
  });
  t.check(small.length === 0,
    `no rule in the layer puts text under 14px in --ow-ink-400${small.length ? ' — ' + small.slice(0, 6).join(', ') : ''}`);
}

/* ---------- the layer keeps to the system ---------- */
{
  const RAMP = new Set([11, 12, 13, 14, 16, 20, 28, 19, 26, 15, 22, 21, 23]);
  const sizes = [...layer.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
  const off = [...new Set(sizes.filter((n) => !RAMP.has(n)))];
  t.check(off.length <= 3,
    `at most three sizes sit off the ramp inside components (${off.join(', ') || 'none'})`);

  const weights = [...layer.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => m[1]);
  t.check(weights.every((w) => ['400', '500', '600', '700'].includes(w)),
    'every weight in the layer is one of the four that are loaded');

  const fams = [...layer.matchAll(/font-family:\s*([^;}]+)/g)].map((m) => m[1]);
  t.check(fams.every((f) => /IBM Plex Mono|Archivo Black|Inter|inherit|ui-monospace/.test(f)),
    'and every family is one of the three the app loads');

  const radii = [...new Set([...layer.matchAll(/border-radius:\s*([^;}]+)/g)].map((m) => m[1].trim()))];
  const bad = radii.filter((r) => !/var\(--ow-r/.test(r) && !/^(0|50%|999px|inherit)$/.test(r));
  t.check(bad.length === 0, `every radius is a token${bad.length ? ' — ' + bad.join(' | ') : ''}`);

  const shadows = [...new Set([...layer.matchAll(/box-shadow:\s*([^;}]+)/g)].map((m) => m[1].trim()))];
  t.check(shadows.every((s) => /var\(--ow-lift\)|none|inset/.test(s)),
    `depth is hairlines and one elevation${shadows.length ? ' (' + shadows.join(' | ') + ')' : ''}`);

  t.check(!/\.ow-btn/.test(layer),
    'no fourteenth button family — the layer uses .btn and adds one size modifier to it');
}

/* ---------- money is a component ---------- */
{
  /* Every figure the shop can act on is mono AND tabular. A column of
     money whose digits do not line up cannot be read at a glance, which
     is the only way money is ever read. */
  const monoRules = [...layer.matchAll(/([^{}]+)\{([^}]*IBM Plex Mono[^}]*)\}/g)];
  t.check(monoRules.length >= 3, `the layer sets the figure face in ${monoRules.length} places`);
  const untabular = monoRules
    .filter((m) => !/font-variant-numeric:\s*tabular-nums/.test(m[2]))
    .map((m) => m[1].trim());
  t.check(untabular.length === 0,
    `and every one of them is tabular${untabular.length ? ' — ' + untabular.join(', ') : ''}`);
}

/* ---------- text that will not fit ---------- */
{
  /* Truncation is THREE declarations. `nowrap` plus `hidden` without
     `ellipsis` is a hard cut with no sign that anything was removed --
     and a clipped supplier name reads as a different supplier, not as a
     shortened one. A fan-out over five screen groups produced this same
     fault three times, which makes it a missing rule rather than three
     mistakes. */
  const half = [];
  [...layer.matchAll(/([^{}]+)\{([^}]*)\}/g)].forEach((m) => {
    const sel = m[1].trim(), b = m[2];
    const nowrap = /white-space:\s*nowrap/.test(b);
    const hidden = /overflow:\s*hidden/.test(b);
    const ell = /text-overflow:\s*ellipsis/.test(b);
    if (ell && !(nowrap && hidden)) half.push(sel + ' (ellipsis without the other two)');
    if (nowrap && hidden && !ell) half.push(sel + ' (a hard cut, no ellipsis)');
  });
  t.check(half.length === 0,
    `truncation is all three declarations or none${half.length ? ' — ' + half.slice(0, 5).join(', ') : ''}`);

  /* A truncating element that cannot shrink pushes its neighbours out of
     the box instead of ellipsising. This is a FLEX/GRID ITEM problem
     only: such an item's min-width defaults to its content, so it
     refuses to go narrower than the longest word. A display:block
     element has no such floor -- it truncates against its containing
     block correctly on its own -- so it is exempt, and saying otherwise
     would have had me "fix" .ow-q-b, which sits in a fixed 128px grid
     track and was already right. */
  const noMin = [];
  [...layer.matchAll(/([^{}]+)\{([^}]*)\}/g)].forEach((m) => {
    const sel = m[1].trim(), b = m[2];
    if (!/text-overflow:\s*ellipsis/.test(b)) return;
    if (/display:\s*block/.test(b)) return;
    if (!/min-width:\s*0/.test(b) && !/flex:\s*1 1 auto/.test(b)) noMin.push(sel);
  });
  t.check(noMin.length === 0,
    `and every truncating FLEX or GRID item can actually shrink${noMin.length ? ' — ' + noMin.slice(0, 5).join(', ') : ''}`);
}

/* ---------- the phone ---------- */
{
  const phone = (/@media \(max-width:820px\)\{([\s\S]*)$/.exec(layer) || ['', ''])[1];
  t.check(phone.length > 200, 'the layer has a phone block');
  t.check(/--ow-tap:\s*44px/.test(layer), 'a tap target is declared, and it is 44px');
  t.check(/min-height:var\(--ow-tap\)/.test(phone),
    'and the phone block actually applies it — a 30px button is not a phone button');
}

/* ---------- icons ---------- */
{
  /* Emoji do not scale, do not recolour, and render differently on
     every device the shop owns. */
  const icons = [...src.matchAll(/<svg[^>]*class="(?:nav-icon|icon|mbn-icon|ow-[a-z-]*)"[^>]*>/g)];
  t.check(icons.length > 20, `the app draws its marks (${icons.length} inline svg)`);
  const layerEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(layer);
  t.check(!layerEmoji, 'and there is no emoji in the layer');
}

/* ---------- one component, one behaviour ---------- */
{
  /* .ow-thumb is the app's 28px picture frame and TWO screens now let you
     press it to enlarge the picture. That is opt-in -- .ow-zoom -- and the
     opt-in is the whole point: a frame that zooms on one screen and does
     nothing on another is the same square teaching two different lessons,
     which is worse than either rule applied twice.

     So this holds the pair together. Adding .ow-zoom to a third screen is
     fine; adding it without the guard, or letting one of these two drop
     out, is what this catches. */
  const src2 = src;
  const zoomers = ['invRowThumbHTML', 'sourcingThumbHTML'];
  zoomers.forEach((name) => {
    const fn = new RegExp(`\\nfunction ${name}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`).exec(src2);
    t.check(!!fn, `${name} is found`);
    /* Resolve the named glyph constant, so a screen that keeps its mark in
       one place reads the same as one that inlines it. */
    let body = (fn || [''])[0];
    [...src2.matchAll(/const (IV_ZOOM_GLYPH)\s*=\s*'([^']*)'/g)]
      .forEach((m) => { body = body.split(m[1]).join(m[2]); });
    t.check(/ow-thumb ow-zoom/.test(body),
      `${name}: a line WITH a photo gets the enlarged target`);
    /* And a line without one is not a target at all. There is nothing
       behind it to open, so a press that appeared to do something and
       then did nothing is worse than a frame that never invited it. */
    t.check(/ow-thumb ow-none/.test(body),
      `${name}: a line WITHOUT one is not a target`);
    t.check(/ow-th-z/.test(body),
      `${name}: and the zoomable one carries the glyph that says so at rest`);
  });

  /* The 44px extender takes the press, so the target is the FRAME and has
     no .src of its own -- the document listener has to read the image out
     of it, or an enlarged target silently opens nothing. */
  t.check(/const frame = e\.target\.closest\('\.ow-thumb\.ow-zoom'\);/.test(src2)
       && /const im = frame\.querySelector\('img'\);/.test(src2),
    'the lightbox opens from the frame, not only from the image inside it');

  /* And every row that carries one steps over it, or the row toggles
     underneath the lightbox and the picture appears and vanishes.

     Counted against the screens that actually emit a frame, not against
     every .img-zoomable guard in the file: two other screens guard a
     photo that is not in a pressable row, and there is nothing there for
     .ow-zoom to cover. This is what keeps the two counts moving together
     when a third screen opts in. */
  const emitters = zoomers.length;
  const zoomGuards = [...src2.matchAll(/if\(e\.target\.closest\('\.img-zoomable, \.ow-zoom'\)\) return;/g)].length;
  t.check(zoomGuards === emitters,
    `every screen that draws a pressable frame steps over it (${zoomGuards} guards for ${emitters} screens)`);
}

/* ---------- the converted screens ---------- */
{
  /* THE RATCHET'S OTHER HALF. A screen joins this list when it has been
     rebuilt on the layer, and once on it, its own <section> and the
     function that fills it may never again contain the class families
     it replaced. Adding a screen here IS the definition of done for its
     redesign; without it, nothing stops a later session hand-rolling a
     seventeenth table onto a screen that already has the layer's. */
  const CONVERTED = {
    /* New quote. The client band replaced .qp-client-inline's .field
       boxes; the document replaced .panel.qp-panel; the items <table>
       and its phone twin (.qp-items-table-wrap / .qp-items-cards /
       .qc-card) became one .ow-tbl drawn by renderQuoteItems. */
    quote: {
      retired: ['qp-client-inline', 'qp-panel', 'quote-layout', 'q-client-history',
                'qp-items-table-wrap', 'qp-items-cards', 'qc-card'],
      uses: ['ow-cb', 'ow-grid', 'ow-pan', 'ow-side'],
      renders: 'renderQuoteItems',
      /* No ow-tbl-f: the document has no foot any more. The arithmetic
         is stated once, on the sticky bar (renderQuoteFinbar), which is
         the one surface that cannot scroll away. */
      rendersUses: ['ow-tbl', 'ow-tbl-r', 'ow-tbl-n', 'ow-gi'],
    },
    /* The Price registry. The form panel became fields in the layer's
       toolbar, the summary the strip, the card grid the layer's cards
       with the rail beside them. .price-card and .price-grid are not
       retired from the FILE -- promotions, claims and the catalogue wear
       them -- only from this screen, which is what this list means. */
    /* Supplier prices joined it as the Paid side: its form panel became
       one of the layer's fields, its private rows the layer's cards.
       .pw-account* and .pw-empty stay in the FILE for Margin, Rival
       prices, Cash ahead and The day; only the two the side still draws
       (.pw-account, .pw-account-row) may appear here, restyled.
       Rival prices joined it as the Rivals side: its verdict rows and
       grouped record became the layer's cards and table; the modal's
       .rv-side chip stays, worn on the layer's chip. */
    prices: {
      retired: ['page-head', 'panel', 'panel-head-row', 'p-toolbar', 'p-toolbar-search', 'p-toolbar-filter', 'field',
                'sum-strip', 'sum-cell', 'price-grid', 'price-card', 'prc-head', 'prc-prices', 'prc-source-pill',
                'prc-oos-pill', 'empty', 'reg-group', 'reg-row',
                'form-panel', 'form-panel-head', 'fp-icon', 'form-grid', 'pw-controls', 'pw-tail', 'pw-list', 'pw-row', 'pw-empty',
                'btn-row', 'rv-group', 'rv-vrow', 'rv-mrow', 'rv-entry', 'rv-in', 'pp-facts', 'pp-why', 'pp-more'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-seg', 'ow-seg-b', 'ow-tb', 'ow-f', 'ow-f-l', 'ow-f-in'],
      renders: ['renderPrices', 'priceCardHTML', 'priceRailHTML', 'renderPriceWatch', 'renderMarket'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-grid', 'ow-cards', 'ow-card', 'ow-fig', 'ow-sigs', 'ow-sig', 'ow-cp',
                    'ow-pan', 'ow-sr', 'ow-empty'],
    },
    /* Follow-ups. A wall of cards -- one white block per client, each
       with its own avatar, its own coloured item stripes, its own flag
       and its own action bar carrying the brand accent -- became a queue
       and the one client being worked. The borrowed .dir-summary-card
       strip, the .st-tabs switch and the .panel wrapper went with it:
       the layer has a strip, a segmented switch and a bordered region of
       its own, and a fourth opinion about what a summary tile looks like
       is exactly what makes a screen read as bolted on. .fup-row and
       .fup-link stay in the FILE -- the follow-up list MODAL still wears
       them, and it is a list to edit rather than a queue to work -- but
       this screen may not emit the card families again. */
    /* FOLLOW-UPS IS MESSAGES NOW, and WhatsApp came with it.

       Neither was usable alone. Follow-ups is the list of people the shop
       owes a word, already tagged with a reason, and its only action was
       to open the box; WhatsApp is the box, and its only content came
       from the list. The nav index had already recorded the confusion:
       the obvious search for Follow-ups is "broadcast", which belonged
       to WhatsApp. One screen, one rail row, one badge.

       The queue above is the card system's -- Money and Telling are one
       list read two ways, and Posting is the daily product post, which
       already lived here as the WhatsApp screen's post desk. What stays
       on the console, and is why the console families are still in
       rendersUses below: the chase timing, the held-back reasons, the
       register, the inbox, and the post desk itself. None of those is in
       the frame, and every one of them is live.

       The retired list is UNCHANGED and still enforced -- moving systems
       is not an amnesty for the families the console retired. */
    messages: {
      retired: ['panel', 'dir-summary-row', 'dir-summary-card', 'st-bar', 'st-tabs', 'st-tab', 'search-bar',
                'fup-card', 'fup-card-head', 'fup-avatar', 'fup-flag', 'fup-item', 'fup-item-head', 'fup-item-name',
                'fup-reason', 'fup-acts', 'fup-warn', 'fup-group', 'fup-group-head', 'fup-empty', 'fup-pill',
                'chase-card', 'chase-list', 'chase-acts', 'chase-facts', 'sum-strip', 'sum-cell'],
      uses: ['om-screen', 'om-qtitle', 'om-qtitle-t', 'om-qtitle-s', 'om-lensgroup', 'om-lens',
             'om-lenschip', 'om-kpis', 'om-body', 'om-list', 'om-card', 'om-card-h', 'om-card-t',
             'om-cols', 'om-cols-m', 'om-col', 'om-scroll', 'om-side', 'om-find', 'om-find-i',
             'om-ph-head', 'om-ph-only'],
      renders: ['renderMessages', 'msgRowHTML', 'renderMessageKpis', 'renderMessagePhoneHead',
                'renderMessageSide', 'msgDraftFor', 'msgLastWord',
                'renderFollowUpsContact', 'renderFollowUpSummary', 'renderFollowUpsAll',
                'renderWhatsApp'],
      rendersUses: [
                    /* the queue, on the card system */
                    'om-mrow', 'om-mrow-ph', 'om-av', 'om-chip', 'om-fig', 'om-lbl', 'om-t', 'om-n',
                    'om-kpi', 'om-kpi-f', 'om-kpi-s', 'om-pan', 'om-pan-t', 'om-pan-m', 'om-blk',
                    'om-read', 'om-box', 'om-btn', 'om-btn-s', 'om-btn-w',
                    'om-ph-t', 'om-ph-figs', 'om-ph-fig', 'om-ph-fig-l', 'om-ph-fig-v',
                    'om-ph-tabs', 'om-ph-tab',
                    /* the hub and the post desk, still the console's */
                    /* ow-u, ow-q, ow-q-r and ow-q-x went with the contact
                       queue's card list: the queue is .om-mrow now and the
                       hub's remaining panes are the strip, the register and
                       the held-back reasons. */
                    'ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s',
                    'ow-cp', 'ow-empty', 'ow-mini', 'ow-pan',
                    'ow-pan-h', 'ow-pan-t', 'ow-pan-n'],
    },
    /* Consignment. A card per consignor, each one always fully open --
       an avatar, a title, a private four-tile stat strip and their whole
       shelf under it. That is the shape for looking AT one party, and
       this screen is a standing watch across all of them: at ten to
       thirty consignors the one figure it exists for was off the top of
       the window by the third card.

       So the private card, its stat strip and its hand-rolled goods
       table became the layer's strip, one .ow-q queue whose rows open in
       place, .ow-tbl for the goods and .ow-sr for the rail -- and the
       phone stopped being that table with two columns hidden by a media
       query. .sc-avatar, .sc-stats and .sc-stat are NOT retired from the
       file: the supplier and staff directories are card screens and
       still wear them properly. Only this screen may not emit them
       again. .cons-mark* stay: the marking form is a form, and the layer
       has no opinion about forms. */
    consignment: {
      retired: ['page-head', 'panel', 'sum-strip', 'sum-cell', 'sum-value', 'sum-label',
                'cons-card', 'cons-card-head', 'cons-card-sub', 'cons-card-foot', 'cons-foot-note',
                'cons-owed', 'cons-list', 'cons-basis', 'cons-goods', 'cons-goods-head',
                'cons-goods-table', 'cons-goods-name', 'cons-goods-act',
                'sc-avatar', 'sc-title', 'sc-name', 'sc-stats', 'sc-stat', 'chase-row'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp'],
      renders: 'renderConsignment',
      rendersUses: ['ow-strip', 'ow-mt', 'ow-grid', 'ow-side', 'ow-pan', 'ow-pan-h', 'ow-pan-t',
                    'ow-q', 'ow-q-r', 'ow-q-card', 'ow-q-x', 'ow-q-why', 'ow-q-note', 'ow-q-a',
                    'ow-q-un', 'ow-cp', 'ow-tbl', 'ow-tbl-h', 'ow-tbl-r', 'ow-tbl-n', 'ow-tbl-a',
                    'ow-sr', 'ow-sr-k', 'ow-sr-v', 'ow-mini'],
    },
    /* INVENTORY. A grid of cards, four columns wide -- so no two figures
       on the shelf ever lined up, and a column of money that does not
       line up cannot be compared at a glance, which is the only way a
       stock list is ever read. At 192 lines it also ranked nothing,
       carried thirty-two unlabelled icon buttons and no accent at all,
       and stacked two crimson repair banners over every figure on the
       screen on an ordinary Tuesday.

       So the private grid became the layer's queue -- .ow-q rows that
       open in place and emit their own phone cards from the SAME call --
       with the strip above it and the rail beside it. The two banners
       became one amber line that is not there at all when there is
       nothing in it. .pack-pill, .pc-icon-btn and the .cb-chain-break
       banner are NOT retired from the FILE: the catalogue and the
       product cards still wear the first two properly, and the cash
       book's broken chain and the Manager's missing notes are genuinely
       bad and still wear the third. Only this screen may not emit them
       again.

       AND THE MOVEMENTS LOG IS THIS SCREEN'S AGAIN. It sat under here as
       a second console with its own three filters, was split out to a
       door of its own, and is a LENS now -- one view at a time. Its own
       entry stood below this one and named the families its console
       replaced: the .pi-* card deck it emitted for the phone from a
       second template (the last pair in the app that could say
       different things about one movement) and the borrowed .sc-*,
       .an-* and .cmp-* bits. The ratchet follows the markup, and the
       markup is here, so this screen may never wear them again either.
       Its renderers come with it for the same reason. */
    inventory: {
      retired: ['page-head', 'panel', 'panel-head-row', 'p-toolbar', 'p-toolbar-search',
                'p-toolbar-filter', 'p-toolbar-checkbox', 'search-bar', 'field',
                'inv-grid', 'inv-card', 'inv-card-head', 'inv-card-title', 'inv-card-name',
                'inv-card-sub', 'inv-card-meta', 'inv-card-foot', 'inv-card-stats',
                'inv-qty-wrap', 'inv-qty-label', 'inv-qty', 'inv-cost', 'pack-pill',
                'pc-actions', 'pc-icon-btn', 'inv-action-btn', 'inv-reorder-btn', 'inv-price-rule-btn',
                'sum-strip', 'sum-cell', 'sum-value', 'sum-label', 'cb-chain-break', 'empty',
                'pi-table-wrap', 'pi-cards', 'pi-card', 'pi-card-top', 'pi-card-title',
                'pi-card-meta', 'pi-card-foot', 'sc-stats', 'sc-stat', 'an-scroll',
                'an-rank', 'cmp-card-supplier'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp',
             'ow-seg', 'ow-seg-b', 'ow-seg-n',
             'ow-f', 'ow-f-l', 'ow-f-in', 'ow-grid', 'ow-stack', 'ow-side', 'ow-pan'],
      renders: ['renderInventory', 'invLineHTML', 'invOpenHTML', 'invRowThumbHTML', 'renderInvFix',
                'renderInvRail', 'renderInventoryFloors',
                'renderStockLog', 'stockLogPutRightButtonHTML'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-q', 'ow-q-r', 'ow-q-card', 'ow-q-x', 'ow-q-t',
                    'ow-q-why', 'ow-q-a', 'ow-cp', 'ow-thumb', 'ow-sr', 'ow-pan', 'ow-mini', 'ow-empty',
                    'ow-tbl', 'ow-tbl-h', 'ow-tbl-r', 'ow-tbl-c', 'ow-tbl-p', 'ow-tbl-s',
                    'ow-tbl-n', 'ow-tbl-a', 'ow-fig', 'ow-sm'],
    },
    /* DEBTORS IS GONE, and its entry with it. The screen was a second
       list over the same people: every one of its ten call sites already
       called renderCustomers on the line directly above, so the two could
       only ever disagree about the same money. It is the Customers
       screen's Owing lens now -- ranked by age then amount rather than by
       amount alone, with the aging bar on the strip and the drift check
       on the customer's panel -- and resolveTab('debtors') opens it with
       that lens armed. Nothing this entry guarded is unguarded: the
       customers entry above now carries it. */
    /* CREDITORS -- "Who you owe" until it was drawn as a console, and
       now named the word the shop already uses, like its twin.

       NOT that twin mirrored. The sell side ranks by age because the
       only question there is who has been owing longest; this ranks by
       what to pay today against what is actually in the drawer. Three
       stacked .panel blocks became one strip, one borrowed age bar and
       one queue: the position panel whose headline figure was set in
       Archivo Black at 34px and buried the cash figure under two
       coloured verdict blocks; the whole second console, "When you said
       you would pay", with three headed sub-lists driven by prompt()
       and confirm(); and a seven-column <table> in which the one fact
       that decides who to pay appeared nowhere.

       It borrows .ow-db-ag and .ow-db-lp WHOLE from Debtors rather than
       growing lookalikes -- the same reason Chase debts borrows the bar,
       so two screens drawing one profile cannot contradict each other --
       which is why those appear in rendersUses here as well. */
    'analytics-creditors': {
      retired: ['page-head', 'panel', 'panel-head-row', 'an-toolbar', 'btn-row', 'field',
                'sq-select-all-label', 'empty', 'ah-sub', 'chase-tail', 'chase-mini', 'pp-more',
                'age-pos', 'age-pos-head', 'age-pos-total', 'age-pos-aside', 'age-bar', 'age-seg',
                'age-bands', 'age-band', 'age-verdict', 'age-filter-note', 'age-table', 'age-pill',
                'age-name', 'age-where', 'age-amt', 'age-paid', 'age-never', 'age-act', 'age-card',
                'pi-card', 'pi-cards', 'pi-table-wrap', 'inv-total-row'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp', 'ow-grid', 'ow-side', 'ow-cr'],
      renders: ['renderCreditorsList', 'renderCreditorsPosition', 'renderCreditorsRail', 'renderCredFilterNote'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s',
                    'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n',
                    'ow-tb', 'ow-tb-s', 'ow-tb-n', 'ow-f', 'ow-f-l', 'ow-f-in', 'ow-f-sel',
                    'ow-q', 'ow-q-r', 'ow-q-card', 'ow-q-x', 'ow-q-t', 'ow-q-who', 'ow-q-v',
                    'ow-q-f', 'ow-q-b', 'ow-q-note', 'ow-q-a', 'ow-cp',
                    'ow-tbl', 'ow-tbl-h', 'ow-tbl-r', 'ow-tbl-n',
                    /* the two borrowed whole from Debtors */
                    'ow-db-ag', 'ow-db-lp',
                    /* and the three this screen owns: why a supplier is
                       ranked where it is, how far today's cash reaches,
                       and naming a day on the bill it belongs to */
                    'ow-cr-rz', 'ow-cr-wl', 'ow-cr-dy',
                    'ow-sr', 'ow-sr-k', 'ow-sr-v', 'ow-mini', 'ow-empty'],
    },
    /* Payroll and rent. The screen answered "what did the month cost?"
       when the question you open it with is "can I pay them?", and it
       carried no cash figure at all. Three .panel blocks became a strip,
       one queue and a rail: the position panel whose headline was set in
       Archivo Black at 34px above five bordered .pr-cell tiles and up to
       five stacked .age-verdict paragraphs; a nine-column .age-table
       with a bare <input> in one cell and a .pr-state pill repeating
       what the balance column had already said; and the co-equal Rent
       agreements panel with the screen's second oxide button. Paying
       went through prompt() and then a second dialog for the account;
       both are one panel inside the month's own row now.

       .pr-name, .pr-quiet, .age-table and .age-amt are NOT retired from
       the FILE -- renderRentAgreements still wears them behind the
       rail's door, and that table is unconverted on purpose -- only from
       this screen's markup and from what the four renderers below emit,
       which is what this list means. */
    payroll: {
      retired: ['page-head', 'panel', 'panel-head-row', 'btn-row', 'btn-icon', 'field', 'empty',
                'age-pos', 'age-pos-head', 'age-pos-total', 'age-pos-label', 'age-pos-meta',
                'age-pos-clear', 'age-verdict', 'age-table', 'age-amt', 'age-act',
                'pr-cells', 'pr-cell', 'pr-cell-label', 'pr-cell-note', 'pr-table', 'pr-settled',
                'pr-state', 'pr-miss', 'pr-miss-off', 'pr-days', 'pr-name', 'pr-sub', 'pr-quiet',
                'pr-gross', 'pr-accrued', 'row-actions', 'an-scroll', 'pi-table-wrap', 'price'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp', 'ow-py', 'ow-py-ms',
             'ow-grid', 'ow-side', 'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-py-rent'],
      renders: ['renderPayrollPosition', 'renderPayrollDues', 'renderPayrollRail', 'payrollGroups'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s',
                    'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n',
                    'ow-q', 'ow-q-r', 'ow-q-card', 'ow-q-x', 'ow-q-t', 'ow-q-who', 'ow-q-v',
                    'ow-q-f', 'ow-q-b', 'ow-q-note', 'ow-q-a', 'ow-cp',
                    'ow-tbl', 'ow-tbl-h', 'ow-tbl-r', 'ow-tbl-f', 'ow-tbl-c', 'ow-tbl-n',
                    /* the six this screen owns: why a month is where it
                       is, how far today's cash reaches, the days box and
                       the days themselves, paying without a dialog, and
                       the decisions that were five stacked paragraphs */
                    'ow-py-rz', 'ow-py-wl', 'ow-py-dy', 'ow-py-dl', 'ow-py-pp', 'ow-py-at',
                    'ow-sr', 'ow-sr-k', 'ow-sr-v', 'ow-mini', 'ow-empty', 'ow-db-go', 'ow-db-rl'],
    },
    /* Order tracking. The lane board -- the step rail, the lanes, the
       cards with six controls, the select-all/print row -- became a
       console: a strip, a queue of what needs the owner, one table
       grouped by stage with rows that open in place, and a rail.
       Sourcing was the last screen wearing .sq-board/.sq-col/.sq-card
       and it has now converted too, so the ~330 lines of lane CSS are
       out of the file entirely rather than kept alive for one caller. */
    /* Sourcing. Five lanes for a question that crosses all five: a thing
       priced and ready to list and a thing nobody has touched in three
       weeks are the same work -- the owner's -- and they sat two columns
       apart. Listed had already been special-cased into a searchable
       list INSIDE a lane, because it grows without bound and nothing
       leaves it, which is the layout saying the shape was wrong.

       A queue banded by what needs doing, with the stage carried on the
       row as five segments of ink. The board's own five colours went
       with it: they were outside the palette and read as one dark green
       at a glance (see SOURCING_STATUSES for what replaced them). The
       archive is one folded line that opens on its search, because
       browsing a hundred listed items is what Products is for. */
    'sourcing': {
      retired: ['page-head', 'panel', 'qp-panel', 'sq-board-tools', 'sq-select-all-label',
                'sq-board', 'sq-col', 'sq-card', 'sq-stepper', 'sf-card', 'sf-facts', 'sf-fact',
                'sf-listed', 'sf-dropped', 'sf-meta-row', 'sf-days', 'sf-ask-count', 'empty'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp'],
      renders: ['renderSourcing', 'sourcingRowHTML', 'sourcingStageHTML', 'sourcingStripHTML',
                'sourcingRailHTML', 'sourcingOpenBodyHTML', 'sourcingArchiveHTML', 'listedRowHTML', 'renderSourcingListedBody', 'sourcingPhotoHTML', 'sourcingThumbHTML'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s',
                    'ow-grid', 'ow-side', 'ow-stack', 'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n',
                    'ow-q', 'ow-q-r', 'ow-q-card', 'ow-q-x', 'ow-q-t', 'ow-q-who', 'ow-q-v',
                    'ow-q-f', 'ow-q-b', 'ow-q-note', 'ow-q-why', 'ow-q-a', 'ow-cp',
                    'ow-tbl', 'ow-tbl-h', 'ow-tbl-r', 'ow-tbl-n', 'ow-tbl-c',
                    'ow-sr', 'ow-sr-k', 'ow-sr-v', 'ow-av', 'ow-mini', 'ow-empty',
                    /* the seven this screen owns: the column heads, the
                       stage as segments rather than as a colour, the
                       band that is the one thing to do next, who is on
                       it in the action column, and the archive's fold
                       and its rows */
                    'ow-sf', 'ow-sf-h', 'ow-sf-st', 'ow-sf-sg', 'ow-sf-need', 'ow-sf-who',
                    'ow-sf-a', 'ow-sf-arc', 'ow-sf-lr', 'ow-sf-more', 'ow-sf-say', 'ow-sf-x', 'ow-sf-ph', 'ow-thumb'],
    },
    /* Assets & loans. Two screens for one question: the van on Assets,
       the loan that bought the van on Loans, neither page mentioning the
       other -- so "what is this thing worth to me" could not be asked
       anywhere, though the app already computed it three clicks inside a
       modal. One register now, one row per thing, ranked behind-first,
       opening in place. The two modals it replaced are gone from the
       file, so their families are retired from the screen AND from what
       the renderers emit. */
    'assets': {
      retired: ['page-head', 'panel', 'panel-head', 'sc-stats', 'fa-summary', 'pi-table-wrap',
                'fa-name', 'fa-sub', 'fa-tag', 'fa-gone', 'empty', 'ln-due-banner', 'sp-lead'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp', 'ow-stack', 'ow-grid', 'ow-side'],
      renders: ['renderAssetsLoans', 'alRows', 'alRowHTML', 'alFig', 'alTbl', 'alLoanBody', 'alAssetBody'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-pan', 'ow-pan-h', 'ow-pan-t',
                    'ow-q', 'ow-q-r', 'ow-q-card', 'ow-q-x', 'ow-q-why', 'ow-q-un', 'ow-q-a', 'ow-cp',
                    'ow-ev', 'ow-ev-h', 'ow-ev-t', 'ow-ev-row', 'ow-tbl', 'ow-tbl-r', 'ow-tbl-n',
                    'ow-ar', 'ow-ar-k', 'ow-ar-v', 'ow-sr', 'ow-sr-k', 'ow-sr-v', 'ow-mini', 'ow-empty',
                    /* the five this screen owns: the fifth column and its
                       names, the crest and two-line title beside it, the
                       dash that is not a nought, the band under which
                       settled and sold things live, and the repayment
                       form that is the one place it takes typing */
                    'ow-al', 'ow-al-h', 'ow-al-nm', 'ow-al-none', 'ow-al-sect', 'ow-al-pay'],
    },
    /* STATEMENTS. Five documents over one period, and a page that had
       grown a wrapper around itself: one .panel holding a tab tray, a
       seven-control period row and the figures, so nothing said which
       control chose the period, which chose the document and which
       acted on the choice.

       The period rides in the page header now, where Payroll carries
       its month; the five documents are names on a hairline; and the
       Overview leads with the verdict, then the layer's strip, then two
       columns -- this period on the left, the trustworthiness of the
       figures on the right, where the checks sit BESIDE the verdict
       they are the evidence for instead of 880px below it.

       .st-vitals survives as a marker on the layer's strip, because two
       test files read the order the Overview emits its parts in and the
       rule they pin -- the verdict before the numbers -- is the point
       of the screen. .st-doc, .st-check, .st-lean, .st-be-* and the
       whole drill-down family stay: they are this screen's own, and the
       records rail was kept deliberately, on the shop's instruction.
       .st-bar, .st-period and .st-to went with the box they lived in. */
    'statements': {
      retired: ['page-head', 'panel', 'st-bar', 'st-period', 'st-to', 'st-two', 'st-vital',
                'st-vital-label', 'st-vital-note', 'rost-period', 'rost-per', 'empty'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp',
             'ow-seg', 'ow-seg-b', 'ow-f', 'ow-f-l', 'ow-f-in', 'ow-f-v', 'ow-f-sel'],
      renders: ['stOverview', 'stBreakevenHTML', 'stTrendChartHTML'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-u',
                    'ow-grid', 'ow-side', 'ow-stack', 'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n'],
    },
    'quote-saved': {
      retired: ['sq-board-tools', 'sq-select-all-label', 'panel', 'qp-panel', 'sq-board', 'sq-col', 'sq-stepper',
                'sq-card', 'sq-goods-row', 'sq-cash', 'sq-assignee-row', 'sq-meta', 'empty'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-f', 'ow-f-in', 'ow-strip', 'ow-grid', 'ow-sec', 'ow-seg', 'ow-pan',
             'ow-tbl', 'ow-side'],
      renders: ['renderSavedQuotes', 'orderRowHTML', 'orderTrackHTML', 'orderWhoHTML', 'orderActHTML', 'orderRowBodyHTML',
                'otQueueRowHTML', 'orderTripPanelHTML', 'orderOutPanelHTML', 'orderLatePanelHTML',
                /* The Loaded form, in the open row -- the one place this
                   screen takes typing rather than only reading, so its
                   fields are held to the layer's like everything else. */
                'orderLoadFormHTML'],
      rendersUses: ['ow-mt', 'ow-cp', 'ow-tbl-g', 'ow-tbl-r', 'ow-tbl-n', 'ow-tbl-a', 'ow-tbl-x', 'ow-trk', 'ow-sr',
                    'ow-empty', 'ow-seg-b'],
      /* The Loaded form's own field classes are not named here on purpose:
         orderLoadFormHTML hands them to carrierFormHTML (shared-worker.js)
         as a set, so the phone and the console ask the same question from
         one template. What this list can see is what the screen writes
         itself, and that is what it holds to. */
    },
    /* FORECASTS — the three screens that answer "what is coming".

       It was three entries in this list: What to buy, The day, and a
       What's coming that never earned one. They were three screens in
       three groups of the rail asking one question at three horizons,
       and the dependency between them was only ever in the code --
       renderPurchasePlanPanel reads cashAhead().safeToSpend on its first
       line, because the plan a shop can afford IS the low point of the
       cash line. So they are one screen with three lenses now, and this
       is one entry: the union of what both screens had retired, the
       union of what they were held to, and every function that draws
       into any of the three panes.

       TWO SCREENS GAVE UP THEIR OWN STRIPS to the one above all three
       lenses, which is why fcRenderRoof is named here. It is the
       function that emits .ow-strip and .ow-mt now; renderAhead and
       renderPurchasePlanPanel no longer do, and this list would have
       been satisfied by either of them alone before. Naming the roof
       keeps the claim true rather than quietly weakening it.

       AND renderAhead IS NAMED FOR THE FIRST TIME. What's coming was
       never in this list -- it was drawn as a console without being
       written down as one. Folding it in is the moment to hold it to
       the same rule as the two beside it.

       .ah-* and .pw-* stay in the FILE -- Margin still wears them, and
       the cash runway's own classes are .ow-ah-*, which are different
       tokens -- and .mgr-move stays because renderDayMeeting draws the
       Manager's real move cards rather than a second set of its own.
       Only this screen may not emit the retired families again, which
       is what this list means. */
    forecasts: {
      retired: ['page-head', 'panel', 'form-panel', 'an-toolbar', 'field',
                'pp-controls', 'pp-list', 'pp-row', 'pp-top', 'pp-when',
                'pp-empty', 'pp-ord', 'pp-basket', 'pp-more',
                'sum-strip', 'sum-cell', 'sum-value', 'sum-label',
                'pw-tail', 'pw-empty',
                'ah-sub', 'ah-rows', 'ah-row', 'ah-when', 'ah-what', 'ah-amt', 'ah-left', 'ah-kind',
                'mgr-sec-title', 'mgr-keyline', 'mgr-objective', 'mgr-why'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp', 'ow-f',
             'ow-seg', 'ow-seg-b', 'ow-seg-n',
             'ow-dy-nav', 'ow-dy-b', 'ow-dy-d',
             'ow-fc-pane', 'ow-fc-acts', 'ow-fc-roof'],
      /* THE DAY BECAME A SPINE, and two names left this list with it.
         dayTile drew the day's own four-figure strip with a verdict
         line (.ow-mt-d) under each figure; the Today lens now reads as
         one timeline of the day's movements, and its only comparison
         is the cumulative line against a typical same-weekday, drawn
         on the runway's own .ow-ah-* classes -- so there is no tile and
         no verdict line to hold to. .ow-tbl-g went the same way: it was
         the till table's band ("In and out, by account"), and the till
         is now the spine's closing node and the closing checks. What
         the lens still emits -- .ow-pan, .ow-ck, .ow-tbl on Who paid,
         .ow-cp, .ow-mini, .ow-empty -- stays pinned. */
      renders: ['fcRenderRoof', 'renderAhead', 'renderPurchasePlanPanel',
                'renderDay', 'renderDayMeeting'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-v', 'ow-grid', 'ow-pan', 'ow-pan-h', 'ow-pan-t',
                    'ow-side', 'ow-stack', 'ow-tbl', 'ow-tbl-r', 'ow-tbl-n', 'ow-tbl-note',
                    'ow-ck', 'ow-cp', 'ow-mini', 'ow-empty', 'ow-bk'],
    },
    /* Invoices. A filing cabinet became a register. The .panel.qp-panel
       wrapper and its .an-toolbar of .field boxes became the layer's
       header and its fields; the hand-built <table> (.pi-table-wrap,
       .sortable, .sort-arrow, .an-rank, .inv-status-cell,
       .inv-total-row) and its phone twin (.pi-cards, .pi-card and the
       .sc-stats inside it) became ONE .ow-tbl, which is a lined-up grid
       on the console and a card per document on the phone from the same
       call -- the two templates had already drifted, the card carrying a
       rank the table numbered differently. The four .pc-icon-btn acts on
       every row became the existing .btn family sized down, so the one
       accent on the screen is the only oxide on it.

       .inv-doc-link, .inv-status, .inv-row-voided, .inv-total-row and
       .pc-icon-btn stay in the FILE -- Purchase invoices is still the
       old screen and wears every one of them -- but this screen may not
       emit them again. .deb-prog is NOT retired: the payment bar is
       deliberately the same component the debtors and creditors lists
       use, because it is the same question at a different level.

       .ow-tbl-s is deliberately not in rendersUses: the second line
       under the customer carries the age AND the purchase invoices the
       order raised, so it is a flex row rather than the layer's single
       truncating block. Those links used to be a full-width row of
       their own beneath every fourth invoice, which made the register's
       rows two different heights -- and a register whose rows are not
       the same height cannot be scanned, which is the only thing it is
       for. */
    /* INVOICES HAS CHANGED SYSTEMS, and this entry is the argument for
       it rather than a patch that made two checks go quiet.

       WHAT THE OLD ASSERTION MEANT. Invoices was the console's: .ow-ph
       for the header, .ow-strip for the position, .ow-pan around an
       .ow-tbl that renderInvoices filled. Listing those here is what
       stopped a later session hand-rolling a seventeenth table onto a
       screen that already had the layer's.

       WHY IT STOPPED BEING TRUE. The owner commissioned a design pass
       from outside this repo, chose to adopt it rather than translate it,
       and Invoices is one of the four screens it clothes. The screen is
       on the .om- card system now: a 58px top bar, the title block with
       its lens group, a four-card KPI strip, and the register as
       .om-lrow rows grouped by what needs attention. So the old list is
       not a weaker claim about this screen, it is a claim about a screen
       that no longer exists.

       WHAT THE NEW ASSERTION MEANS. The same guarantee, one system over:
       the sales register may not be hand-rolled back onto the console's
       families, and it must be built out of the card system's named
       components. 'retired' is UNCHANGED and still enforced -- every one
       of those families is still forbidden here, and moving systems is
       not an amnesty for the ones the console retired.

       WHAT IS DELIBERATELY NOT RETIRED, and this is the part to read
       before assuming this screen is finished. The section still wears
       ow-grid, ow-side, ow-strip, ow-seg, ow-seg-b, ow-seg-n, ow-tb and
       ow-on, for two reasons, both recorded in
       docs/design-suggestions-sell-section.md:

         1. THE PURCHASES PANE IS STILL THE CONSOLE SCREEN. The handoff
            does not draw it. Its frame replaces the Sales/Purchases lens
            pair with Needs attention / All / Voided and shows purchases
            only as PINV pills, which would take the buying side's four
            checks with it -- the same delivery billed twice, a line
            priced above anything ever paid that supplier, a bill with no
            delivery behind it, money paid beyond what was billed. Those
            checks are real and are not being deleted on the strength of
            a frame that does not mention them. The pills open the bill
            in that pane, so it is reachable rather than orphaned.

         2. FOUR CONTROLS HAVE NO HOME IN THE NEW DESIGN and are kept
            hidden rather than removed, because their handlers are live:
            the seven date presets, the select-all and its bulk
            operations, Hide voided (the Voided lens does that job, and
            the hidden checkbox is kept in step with it), and Print list.
            A hidden control is a debt; that file is the ledger of it.

       So this screen is HALF converted on purpose, and the half that is
       converted is held to the card system here. */
    invoices: {
      retired: ['panel', 'qp-panel', 'an-toolbar', 'field', 'panel-head-row', 'btn-row',
                'sq-select-all-label', 'empty',
                'pi-table-wrap', 'pi-cards', 'pi-cards-select-all', 'pi-cards-summary',
                'pi-card', 'pi-card-top', 'pi-card-title', 'pi-card-meta', 'pi-card-foot',
                'sc-stats', 'sc-stat', 'an-rank', 'sortable', 'sort-arrow',
                'pc-icon-btn', 'inv-row-actions', 'inv-doc-link', 'inv-status',
                'inv-status-cell', 'inv-row-voided', 'inv-total-row', 'inv-total-label',
                'deb-card-prog',
                /* And the console families the SALES side has now left.
                   ow-tbl in particular: the register is .om-lrow, and a
                   second table idiom appearing here would be the exact
                   fault the console's own entry was written to stop. */
                'ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-tbl', 'ow-tbl-h',
                'ow-tbl-r', 'ow-tbl-g', 'ow-mt', 'ow-cp'],
      /* No om-top here, and that is deliberate rather than unfinished: the
         handoff draws its 58px bar as part of the screen, but the app
         already draws one above every screen, and a second stacks two
         breadcrumbs and two search boxes. Converting the global bar is
         shared chrome for all four Sell screens at once. The screen's own
         search sits in the register's header instead, on .om-find. */
      uses: ['om-screen', 'om-find', 'om-find-i',
             'om-qtitle', 'om-qtitle-t', 'om-qtitle-s', 'om-lensgroup', 'om-lens', 'om-lenschip',
             'om-kpis', 'om-body', 'om-list', 'om-card', 'om-card-h', 'om-card-t',
             'om-cols', 'om-cols-l', 'om-col', 'om-scroll', 'om-side', 'om-ph-head', 'om-ph-only'],
      /* Seven builders, because the register, its rows, the strip, the
         phone's own header and the panel are five different questions and
         one function answering all of them is how a row and its subtotal
         come to disagree. */
      renders: ['renderInvoices', 'invRegisterRowHTML', 'renderInvoiceKpis',
                'renderInvoicePhoneHead', 'renderInvoiceSide', 'invChipHTML', 'invPinvPillsHTML'],
      /* om-done and om-on are NOT listed, and the reason is the
         tokeniser rather than the screen: both are applied through a
         template expression (class="om-lrow${dim}${on}"), and this check
         reads only the literal head of a class attribute -- by design,
         since that is what stopped a renamed band passing on the strength
         of its own cells. Listing them would assert something this
         mechanism cannot see. The dimming of settled rows is real and is
         pinned by the register's own test instead. */
      rendersUses: ['om-lrow', 'om-grow', 'om-chip', 'om-fig', 'om-lbl', 'om-t', 'om-n',
                    'om-pill', 'om-p-paid', 'om-p-owed', 'om-p-void',
                    'om-kpi', 'om-kpi-f', 'om-kpi-s',
                    'om-pan', 'om-pan-t', 'om-pan-m', 'om-figs', 'om-figs-f', 'om-blk', 'om-acts',
                    'om-drow', 'om-read', 'om-btn', 'om-btn-p', 'om-btn-s', 'om-btn-g',
                    'om-ph-t', 'om-ph-figs', 'om-ph-fig', 'om-ph-fig-l', 'om-ph-fig-v',
                    'om-ph-tabs', 'om-ph-tab'],
    },
    /* Customers. The screen was a second debt book -- a grid of cards
       whose largest figure was a debt balance, on a question Debtors
       and Chase debts already answer better. .customer-grid and
       .customer-card went for the layer's table, .dir-summary-row and
       its three bordered tiles for the strip, and the four controls per
       card -- edit, delete, "+ Charge", "Payment", ninety of them on a
       45-customer screen -- for the existing .btn family inside the one
       row that is open.

       .cc-debt-btn was a fourteenth button family that existed nowhere
       else in the app and posted to the debt ledger from a contact
       list; it is gone from the FILE, not only from this screen.
       .cc-history* stay in the file -- four payment modals wear them --
       but this screen may not draw them again. .dir-summary-row and
       .dir-summary-card stay too: the suppliers directory is still a
       grid and still carries the strip.

       Six renderers rather than one, and they are listed together for
       one reason: this screen draws the same customer three times over
       -- as a row in the register, as the account that opens under that
       row, and as the account screen behind it. The band and the row
       read their chip from custAttentionReason; the open row and the
       account screen read their four figures from customerFiguresHTML.
       Anything that drew a second copy of either would be free to
       disagree with the first, which is the drift this list exists to
       stop. */
    customers: {
      retired: ['panel', 'panel-head-row', 'search-bar', 'dir-summary-row', 'dir-summary-card',
                'customer-grid', 'customer-card', 'cc-head', 'cc-avatar', 'cc-title', 'cc-name',
                'cc-id', 'cc-meta', 'cc-actions', 'cc-details', 'cc-row', 'cc-notes', 'cc-both',
                'cc-debt-row', 'cc-debt-label', 'cc-debt-value', 'cc-debt-actions', 'cc-debt-btn',
                'cc-last-activity', 'pc-icon-btn', 'btn-icon', 'empty', 'field'],
      /* THE BOOK IS THE CARD SYSTEM'S; THE ACCOUNT IS STILL THE CONSOLE'S,
         and that split is deliberate, the same shape as Invoices' two
         registers.

         What changed and why: Debtors was deleted into this screen's
         Owing lens. It was a second renderer over the same people, and
         the evidence is stronger than the argument -- every one of its
         ten call sites already called renderCustomers on the line
         directly above it, so the two lists could only ever disagree,
         never add anything. The lens ranks by age THEN amount (the order
         a shop asks in, where Debtors ranked by amount alone), keeps the
         aging bar on the strip, and carries the drift check onto the
         customer's panel where it can be seen rather than onto a screen
         of its own.

         The account view -- the full record with the statement of
         account the counter hands across -- is NOT converted. It steps in
         place of the book as it always did, and it is reached from the
         panel now rather than from the row, because the row fills the
         panel. Its builders still draw the console, which is why the
         console families stay in rendersUses below. */
      uses: ['om-screen', 'om-qtitle', 'om-qtitle-t', 'om-qtitle-s', 'om-lensgroup', 'om-lens',
             'om-lenschip', 'om-kpis', 'om-body', 'om-list', 'om-card', 'om-card-h', 'om-card-t',
             'om-cols', 'om-cols-c', 'om-col', 'om-scroll', 'om-side', 'om-find', 'om-find-i',
             'om-ph-head', 'om-ph-only'],
      renders: ['renderCustomers', 'custRegisterRowHTML', 'renderCustomerKpis',
                'renderCustomerPhoneHead', 'renderCustomerSide', 'custAvatarHTML',
                'custPayBarHTML', 'custAskChipHTML',
                'customerAttentionHTML', 'customerAccountHTML', 'customerFiguresHTML',
                'renderCustomerAccount', 'customerAccountRailHTML', 'customerStatsHTML'],
      rendersUses: [
                    /* the book, on the card system */
                    'om-crow', 'om-crow-ph', 'om-grow', 'om-orow', 'om-av', 'om-bar', 'om-bar-s',
                    'om-chip', 'om-fig', 'om-lbl', 'om-t', 'om-n', 'om-kpi', 'om-kpi-f', 'om-kpi-s',
                    'om-pan', 'om-pan-t', 'om-pan-m', 'om-figs', 'om-figs-f', 'om-blk', 'om-acts',
                    'om-drow', 'om-read', 'om-note', 'om-btn', 'om-btn-p', 'om-btn-s', 'om-wa',
                    'om-ph-t', 'om-ph-tabs', 'om-ph-tab',
                    /* the account, still on the console */
                    'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-tbl', 'ow-tbl-h',
                    'ow-tbl-r', 'ow-tbl-c', 'ow-tbl-p', 'ow-tbl-n', 'ow-tbl-a',
                    /* ow-tbl-s went with customerRegisterRowHTML, the console row
                       builder this screen's book replaced. It was the register's
                       truncating second line; the card row carries that as its own
                       element, and the function is deleted rather than left to be
                       found and called by mistake. */
                    'ow-fig', 'ow-fig-b', 'ow-cp', 'ow-cp-d', 'ow-empty', 'ow-mini', 'ow-q-why',
                    'ow-q-note', 'ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-sp', 'ow-grid',
                    'ow-stack', 'ow-side', 'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-sr',
                    'ow-sr-k', 'ow-sr-v'],
    },
    /* Suppliers. The last Buy screen on the legacy shell, and the shell
       was the smaller half of it: the headline was an instruction about
       an ID field, the three tiles were Creditors' three figures with
       one of them painting ordinary trade credit crimson, and the list
       was alphabetical and paged at 24 -- so twenty of forty-four sat
       behind a button and the best one's place on screen was decided by
       the alphabet.

       .supplier-card and .supplier-grid went for the layer's table.
       They stay in the FILE, because the agent roster and the staff
       list wear them; this screen may not draw them again.
       .dir-summary-row and .dir-summary-card do NOT stay: Customers
       stopped drawing them on conversion and this was the last screen
       carrying them, so they are gone from the file along with
       .dir-summary-card.owed, which painted trade credit in --danger.
       .sc-matches went with the card that held it.

       Six renderers rather than one, listed together for the reason the
       customers entry gives: this screen draws the same supplier three
       times over -- as a row in the register, as the band's reason for
       listing them, and as the account that replaces the register. The
       row and the band both read their chip from supAttentionReason;
       the account reads its figures from supplierFiguresHTML. Anything
       drawing a second copy of either would be free to disagree with
       the first, which is the drift this list exists to stop. */
    suppliers: {
      retired: ['page-head', 'panel', 'panel-head-row', 'search-bar', 'dir-summary-row',
                'dir-summary-card', 'supplier-grid', 'supplier-card', 'sc-head', 'sc-avatar',
                'sc-title', 'sc-name', 'sc-id', 'sc-meta', 'sc-actions', 'sc-details', 'sc-row',
                'sc-notes', 'sc-stats', 'sc-stat', 'sc-matches', 'sc-match-row', 'sc-match-name',
                'sc-match-price', 'both-tag', 'pc-icon-btn', 'btn-icon', 'empty', 'field'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-f', 'ow-f-l', 'ow-f-in',
             'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-seg', 'ow-seg-b', 'ow-seg-n', 'ow-tb'],
      renders: ['renderSuppliers', 'supplierRegisterRowHTML', 'supplierAttentionHTML',
                'supplierFiguresHTML', 'renderSupplierAccount', 'supplierAccountRailHTML',
                'supplierAskBlockHTML', 'supplierBuysHTML', 'supplierBillsHTML'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-tbl', 'ow-tbl-h',
                    'ow-tbl-r', 'ow-tbl-c', 'ow-tbl-p', 'ow-tbl-s', 'ow-tbl-n', 'ow-tbl-a',
                    'ow-fig', 'ow-fig-b', 'ow-cp', 'ow-cp-d', 'ow-empty', 'ow-mini',
                    'ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-sp', 'ow-grid', 'ow-stack',
                    'ow-side', 'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-sr',
                    'ow-sr-k', 'ow-sr-v'],
    },
    /* What goes with what. New as well, and the one screen in the app
       whose register is a SENTENCE -- product, verb, product, in one
       cell, because three columns of truncated product names say
       nothing. The editor is listed beside the row for the reason the
       whole file exists: the row states the pairing and the editor
       changes it, and a second opinion about what the five verbs are
       would be a second grammar. */
    pairings: {
      retired: [],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp', 'ow-sm'],
      /* Two panes now: the product list and the product's rules are
         drawn by their own builders beside the screen builder, and the
         size grid and the draft by theirs. */
      renders: ['renderPairings', 'pairListHTML', 'pairProductHTML', 'pairRowHTML',
                'pairEditorHTML', 'pairGridHTML', 'pairDraftHTML',
                'pairObservedHTML', 'pairOffHTML'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-u',
                    'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-tbl', 'ow-tbl-h',
                    'ow-tbl-r', 'ow-tbl-n', 'ow-tbl-a', 'ow-fig', 'ow-fig-b',
                    'ow-cp', 'ow-cp-d', 'ow-sr', 'ow-sr-k', 'ow-sr-v', 'ow-msg',
                    'ow-empty', 'ow-mini'],
    },
  };
  /* EXACT NAMES, NOT WORD BOUNDARIES. \b matches before a hyphen, so
     \bow-cb\b is satisfied by ow-cb-f -- and a bite test that renamed
     the band itself still passed on the strength of its own cells. The
     class attributes are tokenised instead; a template's ${...} tail is
     stripped from a token so "q-line${rowMarginClass}" reads as q-line. */
  const classesOf = (html) => new Set([...html.matchAll(/class="([^"]*)"/g)]
    .flatMap((m) => m[1].split(/\s+/)).map((c) => c.replace(/\$\{[\s\S]*$/, '')).filter(Boolean));
  Object.entries(CONVERTED).forEach(([tab, spec]) => {
    const m = new RegExp(`<section id="tab-${tab}"[\\s\\S]*?</section>`).exec(src);
    t.check(!!m, `${tab}: its section is found`);
    const sec = classesOf((m || [''])[0].replace(/<!--[\s\S]*?-->/g, ' '));
    const back = spec.retired.filter((c) => sec.has(c));
    t.check(back.length === 0,
      `${tab}: none of the families it replaced is back in its markup${back.length ? ' — ' + back.join(', ') : ''}`);
    const missing = spec.uses.filter((c) => !sec.has(c));
    t.check(missing.length === 0,
      `${tab}: built on the layer${missing.length ? ' — missing ' + missing.join(', ') : ''}`);
    /* A renderer may take parameters (renderPrices takes six), and a
       screen may draw through more than one named function -- the card
       builder beside the screen builder. The first three screens
       happened to be zero-argument and inline; the rule is the same. */
    const renders = Array.isArray(spec.renders) ? spec.renders : spec.renders ? [spec.renders] : [];
    if (renders.length) {
      const bodies = renders.map((name) => {
        /* `async function` too. A renderer that waits on the journal is
           still the function that draws the screen, and a finder that
           could not see one would have quietly policed nothing while
           reporting a pass. */
        const fn = new RegExp(`\\n(?:async )?function ${name}\\([^)]*\\)\\{[\\s\\S]*?\\n\\}`).exec(src);
        t.check(!!fn, `${tab}: ${name} is found`);
        return (fn || [''])[0];
      });
      const label = renders.join(' + ');
      const body = classesOf(bodies.join('\n').replace(/\/\*[\s\S]*?\*\//g, ' '));
      const rback = spec.retired.filter((c) => body.has(c));
      t.check(rback.length === 0,
        `${tab}: nor in what ${label} emits${rback.length ? ' — ' + rback.join(', ') : ''}`);
      const rmiss = (spec.rendersUses || []).filter((c) => !body.has(c));
      t.check(rmiss.length === 0,
        `${tab}: and ${label} draws the layer's table${rmiss.length ? ' — missing ' + rmiss.join(', ') : ''}`);
    }
  });
}

/* ---------- a dropdown is never inside its label ---------------------- */
/*
 * Reported from the shop, and it took three rounds to find because every
 * mechanical check passed: the dropdowns could not be used with a mouse.
 * The list opened on the click and shut again before a finger could reach
 * an option. The keyboard worked. Other websites worked. Every browser on
 * the owner's machine failed, which is what finally said "this is ours".
 *
 * The cause was `.ow-f`, the field component: it wrapped its control in a
 * <label>. That is right for a text box — clicking the caption focuses it
 * — and exactly wrong for a <select>, because a label forwards a click to
 * the control it wraps. The first click opens the native list; the label's
 * forwarded activation lands on the same select and closes it. Mouse only:
 * keyboard selection never goes through label activation, which is why the
 * arrow keys always worked.
 *
 * `.ow-f` is the field every converted screen uses, so this would have
 * spread to each new screen as it landed. Hence a rule rather than seven
 * edits: no select inside a label, in the markup or in anything rendered.
 */
{
  const labelBlocks = (src) => {
    const out = [];
    const re = /<label\b[^>]*>/g;
    let m;
    while ((m = re.exec(src))) {
      let i = m.index, depth = 0;
      for (;;) {
        const nl = src.indexOf('<label', i + 1), cl = src.indexOf('</label>', i + 1);
        if (cl === -1) break;
        if (nl !== -1 && nl < cl) { depth++; i = nl; } else {
          if (depth === 0) { out.push({ at: src.slice(0, m.index).split('\n').length, html: src.slice(m.index, cl + 8) }); break; }
          depth--; i = cl;
        }
      }
    }
    return out;
  };

  const offenders = labelBlocks(src).filter((b) => /<select\b/.test(b.html))
    .map((b) => `index.html line ${b.at}`);
  t.check(offenders.length === 0,
    offenders.length
      ? `a dropdown inside its own label cannot be opened with a mouse: ${offenders.slice(0, 6).join(', ')}`
      : 'no dropdown in the markup sits inside its own label');

  // And the shared field builder, which both apps render carrier fields
  // through, decides the same way rather than always reaching for a label.
  const shared = read('shared-worker.js');
  const form = extractFunction(shared, 'carrierFormHTML', 'shared-worker.js');
  t.check(/const tag = inner\.indexOf\('<select'\) >= 0 \? 'div' : 'label';/.test(form),
    'and a rendered field holding a dropdown is built as a div, keeping the label for boxes that are typed into');
}

/* ==========================================================================
   THE OM GATE — the 2026 system holds to itself.

   The ceilings above exist because the old stylesheet grew for a year
   before anyone counted it, and the best that could be done was to stop
   it growing. This layer is being written from a specification, so it
   gets the gate that one should have had from line one: every colour in
   a component rule is a token, and the token block is the whole palette.

   A 67th colour does not fail on a count here. It fails because it is a
   hex literal where a var() belongs, and it is named.
   ========================================================================== */
{
  /* The token block and the component rules are judged differently: the
     first is the only place a hex value may appear, the second may only
     refer to it. Splitting them is the whole mechanism. */
  const tokenBlock = (/:root\{([\s\S]*?)\}/.exec(om) || [])[1] || '';
  const rules = [...om.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ sel: m[1].trim(), body: m[2] }))
    .filter((r) => r.sel !== ':root');

  t.check(tokenBlock.length > 0, 'the OM layer declares its tokens on :root');
  /* And :root earns its exemption from the namespace rule by painting
     nothing. The moment it carries one ordinary declaration it is a rule
     on every element in 34 screens, which is the thing the rule forbids. */
  t.check(tokenBlock.split(';').map((d) => d.trim()).filter(Boolean)
    .every((d) => d.startsWith('--om-')),
    'and that block declares custom properties and nothing else, so it paints nothing');

  const tokens = new Map([...tokenBlock.matchAll(/(--om-[a-z0-9-]+):\s*([^;]+);/g)]
    .map((m) => [m[1], m[2].trim()]));
  const colours = [...tokens].filter(([, v]) => /^#[0-9A-Fa-f]{6}$/.test(v));

  /* ---- law 3: not one hex literal outside the token block ---- */
  {
    const offenders = rules
      .filter((r) => /#[0-9A-Fa-f]{3,8}\b/.test(r.body))
      .map((r) => r.sel);
    t.check(offenders.length === 0,
      offenders.length
        ? `a colour is written as a hex literal instead of a token: ${offenders.slice(0, 6).join(', ')}`
        : `every colour in the ${rules.length} OM component rules comes from a token`);
  }

  /* ---- and every token a rule reaches for is one that exists.
     A var(--om-typo) silently renders as nothing, which on a background
     means transparent and on ink means inherited — both of which look
     plausible enough to ship. ---- */
  {
    const used = new Set([...om.matchAll(/var\((--om-[a-z0-9-]+)/g)].map((m) => m[1]));
    const missing = [...used].filter((n) => !tokens.has(n));
    t.check(missing.length === 0,
      missing.length ? `undeclared token(s): ${missing.join(', ')}`
                     : `all ${used.size} tokens referenced are declared`);
    /* The other direction is a warning about dead weight, not a fault:
       a token declared for a screen not yet built is legitimate. */
  }

  /* ---- the palette is closed ----
     66 values, taken from the handoff's token table. The number is a
     CEILING, exactly like the ones above, and it may only fall. */
  /* 67, not 66, and this goes UP — so it is argued rather than nudged.
     The rail's six group tiles are the one place in this system where
     colour identifies rather than states: the heading beside a tile is
     four grey letters, and the tile is what the eye actually lands on
     when the map is twenty-three rows long. Half the twelve values it
     needs were already here — Buy wears the agent tint, Catalogue's ink
     is the pressed green, Money's fill the studied card, Setup the track
     over ink-3 — so six are new, and they are a closed set: there are
     six groups and there is no seventh. */
  /* 70, not 67: the quote table brings three, and each is a surface
     rather than a state. #fbfaf8 is the ground a charge row sits on --
     charges and credit terms are document rows inside the same table as
     the goods, and the tint is what says "this one is not a good"
     without moving it out of the money column. The other two are the
     suggestion chip's border at rest and under the pointer; a chip that
     adds a line in one press is not a button and should not wear one's
     weight. */
  /* 73, not 70: the quote's Cheaper-elsewhere card is the one place the
     caution TINT is the card's own ground rather than a chip on white.
     That needs three values the tinted-chip pair cannot supply -- a
     border that reads against the tint, a tile one step deeper for the
     icon, and an ink that clears 4.5:1 on the tint itself rather than
     on the softer card fill. It is the only card in the system that
     asks for a decision instead of stating a fact, which is why it is
     the only one that wears its state. */
  t.check(colours.length <= 73,
    `the palette holds ${colours.length} colours (ceiling 73)`);

  /* ---- THE CORAL RULE, which is the one a reviewer cannot see ----
     #ef4b39 under white is 3.1:1 and fails at every size this app uses.
     It is a FILL: the logo tile, the active tab's underline, an aging
     bar. Anything carrying a word uses --om-coral-text at 5.3:1. The two
     are one hue apart and the wrong one is invisible in review, which is
     precisely why it is arithmetic here. */
  {
    const asText = rules.filter((r) => /(?:^|[;{\s])color:\s*var\(--om-coral\)/.test(r.body))
      .map((r) => r.sel);
    t.check(asText.length === 0,
      asText.length ? `--om-coral is carrying text in ${asText.join(', ')} — use --om-coral-text`
                    : '--om-coral is fill and icon only; nothing writes text in it');
  }

  /* ---- contrast, on the pairings the system actually asserts ---- */
  {
    const lum = (h) => {
      const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255)
        .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const la = lum(a), lb = lum(b);
      return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
    };
    const v = (n) => tokens.get(n);

    /* Every ground this system paints, against every ink it puts on it.
       The handoff's claim is "every ink clears 4.5:1 on its ground";
       this is that claim, enumerated. */
    const GROUNDS = ['--om-surface', '--om-ground', '--om-sunken', '--om-inset'];
    const INKS = ['--om-ink', '--om-ink-2', '--om-ink-3'];
    GROUNDS.forEach((g) => INKS.forEach((i) => {
      const r = ratio(v(i), v(g));
      t.check(r >= 4.5, `${r}:1 — ${i} on ${g} (needs 4.5)`);
    }));

    /* The tinted pairs. Each is a state chip: a fill and the one ink
       that is allowed on it. */
    [['--om-good-ink', '--om-good'], ['--om-caution-ink', '--om-caution'],
     ['--om-bad-ink', '--om-bad'], ['--om-studied-ink', '--om-studied'],
     ['--om-agent-ink', '--om-agent'], ['--om-neutral-ink', '--om-neutral'],
     ['--om-good-card-ink', '--om-good-card'],
     ['--om-caution-card-ink', '--om-caution-card'],
     ['--om-bad-card-ink', '--om-bad-card'],
    ].forEach(([i, g]) => {
      const r = ratio(v(i), v(g));
      t.check(r >= 4.5, `${r}:1 — ${i} on ${g} (needs 4.5)`);
    });

    /* The rail's six group tiles: two letters at 9.5px/700, which is the
       smallest type in the system, on a tint. Small and bold is exactly
       where a pairing that "looks fine" is 3:1, so all six are counted. */
    [['--om-tile-se-ink', '--om-tile-se'], ['--om-agent-ink', '--om-agent'],
     ['--om-good-pressed', '--om-tile-ca'], ['--om-tile-mo-ink', '--om-studied-card'],
     ['--om-tile-in-ink', '--om-tile-in'], ['--om-ink-3', '--om-track'],
     /* and the quote's caution card, where the tint is the ground */
     ['--om-caution-tint-ink', '--om-caution'], ['--om-caution-ink', '--om-caution-tile'],
    ].forEach(([i, g]) => {
      const r = ratio(v(i), v(g));
      t.check(r >= 4.5, `${r}:1 — rail tile ${i} on ${g} (needs 4.5)`);
    });

    /* White on the fills that carry white. */
    [['--om-coral-text', 'the primary button and every avatar'],
     ['--om-navy', 'the rail, the panel headers and the price card'],
     ['--om-good-ink', 'the WhatsApp hand-off'],
    ].forEach(([fill, why]) => {
      const r = ratio(v('--om-on-navy'), v(fill));
      t.check(r >= 4.5, `${r}:1 — white on ${fill} · ${why}`);
    });

    /* And on navy, the two quieter greys, which carry meta rather than
       body text and are held to the same floor because a phone in a
       yard in daylight does not care what we called the text. */
    ['--om-on-navy-2', '--om-on-navy-3', '--om-on-navy-4'].forEach((i) => {
      const r = ratio(v(i), v('--om-navy'));
      t.check(r >= 4.5, `${r}:1 — ${i} on --om-navy (needs 4.5)`);
    });

    /* THE PAIRING THAT MUST NEVER SHIP, asserted as arithmetic so it
       cannot be argued back in: the coral fill cannot carry white. */
    t.check(ratio(v('--om-on-navy'), v('--om-coral')) < 4.5,
      `white on --om-coral really is ${ratio(v('--om-on-navy'), v('--om-coral'))}:1 — which is why --om-coral-text exists`);
  }

  /* ---- type: two families, and only the two the @import loads ---- */
  {
    const fams = [...om.matchAll(/font-family:\s*([^;}]+)/g)].map((m) => m[1]);
    const bad = fams.filter((f) => !/IBM Plex (Sans|Mono)/.test(f));
    t.check(bad.length === 0,
      bad.length ? `the OM layer loads only IBM Plex; found ${bad.join(' | ')}`
                 : 'every family in the OM layer is IBM Plex Sans or IBM Plex Mono');
    t.check(!/Inter|Archivo/.test(om),
      'and it never reaches back into the console layer’s faces');
    const imported = /@import url\('([^']+)'\)/.exec(src)[1];
    t.check(/IBM\+Plex\+Sans:wght@400;500;600;700/.test(imported),
      'IBM Plex Sans is loaded at all four weights the system uses');
    t.check(/IBM\+Plex\+Mono:wght@400;500;600/.test(imported),
      'and Mono at 400 too — the message boxes are the one place weight 400 mono appears');
  }

  /* ---- weights: four, as everywhere else in this app ---- */
  {
    const w = new Set([...om.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1]));
    const bad = [...w].filter((x) => !['400', '500', '600', '700'].includes(x));
    t.check(bad.length === 0, bad.length ? `unloaded weight(s) ${bad.join(', ')} — the browser fakes them` : 'four weights, all loaded');
  }

  /* ---- the ramp ----
     It carries half-pixel steps, which the console layer's ramp forbids.
     That is deliberate and it is the difference between a ramp and a
     habit: these sixteen are specified in the handoff to the value, and
     a seventeenth fails here. 9.5 is the floor and it belongs to two
     things only — the tab-bar label and the price card's eyebrow. */
    /* 14.5 is the seventeenth, and it belongs to one element: the shop's
       own name in the rail's brand block, which the rail artboards set
       to the half-step between the 14px of a list row and the 15px of a
       panel figure. It is a name rather than a heading — it wants to sit
       above the rows without reading as one — and it appears once. */
    /* 22 is the eighteenth, and it is the quote dock's total -- the one
       figure on that screen a shop says out loud on a call. It is
       larger than a panel figure (15-17) and smaller than a screen
       title (24) on purpose: it is a number, not a heading, and it is
       the only thing in the dock anyone reads first. 20px on the phone,
       which is already on the ramp. */
    const RAMP = new Set([9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 17, 19, 20, 22, 24, 26]);
  {
    const sizes = [...om.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    const off = [...new Set(sizes)].filter((s) => !RAMP.has(s));
    t.check(off.length === 0, off.length ? `off the ramp: ${off.join(', ')}px` : `${new Set(sizes).size} sizes, every one on the ramp`);
    const tiny = [...new Set(sizes)].filter((s) => s < 9.5);
    t.check(tiny.length === 0, tiny.length ? `below the 9.5px floor: ${tiny.join(', ')}px` : 'nothing is set below 9.5px');
  }

  /* ---- radii and elevation ---- */
  {
    /* 7px joins for the quote's typed figures and its steppers: a box
       that appears under the pointer around a number inside a table
       row, which wants a softer corner than the 9px of a button that
       is always drawn. Specified as "steppers 7" in the quote handoff. */
    /* 0 belongs in the set. On a 390px screen the document card runs to
       both edges -- there is no ground beside it to round against -- so
       the phone takes the corners off rather than drawing a 14px radius
       against the screen edge. "No radius" is a decision the system
       makes, and a set that cannot express it pushes the rule outside
       the layer where nothing checks it. */
    const RADII = new Set(['0', '2px', '3px', '6px', '7px', '8px', '9px', '10px', '11px', '14px', '18px', '26px', '999px']);
    const r = new Set([...om.matchAll(/border-radius:\s*([^;}]+)/g)].map((m) => m[1].trim()));
    const bad = [...r].filter((x) => !RADII.has(x));
    t.check(bad.length === 0, bad.length ? `radii off the system: ${bad.join(' | ')}` : `${r.size} radii, all from the system`);

    /* ONE elevation, and it is the hairline's shadow rather than a lift:
       a card in this system does not float. The lens pill's is the same
       geometry at a higher alpha because it sits on a tinted track. */
    const sh = new Set([...om.matchAll(/box-shadow:\s*([^;}]+)/g)].map((m) => m[1].trim()));
    const allowed = new Set(['var(--om-shadow)', 'var(--om-shadow-lens)', 'none']);
    const badSh = [...sh].filter((x) => !allowed.has(x));
    t.check(badSh.length === 0, badSh.length ? `depth is one elevation: ${badSh.join(' | ')}` : 'one elevation, referenced as a token');
  }

  /* ---- money is a component ---- */
  {
    const fig = (/\.om-fig\{([^}]*)\}/.exec(om) || [])[1] || '';
    t.check(/font-variant-numeric:\s*tabular-nums/.test(fig),
      'figures are tabular — a column of money that does not line up is unreadable at the only speed it is read');
    t.check(/letter-spacing:\s*-0\.02em/.test(fig), 'and tracked in, as specified');
    t.check(/IBM Plex Mono/.test(fig), 'and mono');
  }

  /* ---- truncation is three declarations and a min-width, never two ----
     `nowrap` with `hidden` and no `ellipsis` is a hard cut with no sign
     that anything was removed, and a truncating cell in a grid without
     min-width:0 pushes its neighbours out of the box instead of
     shrinking. Both faults look fine until the data is real. */
  {
    const trunc = (/\.om-t\{([^}]*)\}/.exec(om) || [])[1] || '';
    ['overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap', 'min-width:0']
      .forEach((d) => t.check(trunc.includes(d), `.om-t declares ${d}`));
    /* And the figures never truncate: "1,240,00" is a tenth of
       "1,240,000" and entirely plausible. */
    const n = (/\.om-n\{([^}]*)\}/.exec(om) || [])[1] || '';
    t.check(/white-space:nowrap/.test(n) && !/text-overflow/.test(n),
      '.om-n holds a figure on one line and never puts an ellipsis in it');
  }

  /* ---- law 1: the layer never reaches outside its own namespace ----
     The app sets no base font-size, so every unstyled element in 34
     screens inherits the UA default. One bare element selector here
     restyles all of them in a commit. */
  {
    const escapees = rules.map((r) => r.sel)
      .filter((sel) => sel.split(',').some((s) => !/^\s*\.om-/.test(s)));
    t.check(escapees.length === 0,
      escapees.length ? `a selector starts outside the namespace: ${escapees.slice(0, 5).join(' | ')}`
                      : 'every selector in the layer starts .om- and stays there');
  }

  /* ---- 820px is a switch, and the rail is on one side of it ----
     The rail is a desktop object: 236px of navy on a 390px screen covers
     three fifths of it. The app already hides .sidebar inside the
     breakpoint, but a media query adds NO specificity -- so the OM
     layer's own display declaration, being later in the file, won, and
     the rail sat on top of the day's figures at phone width. A layer
     that sets display on the rail has to re-state the hiding. */
  {
    /* The layer has more than one phone block now -- the quote brought
       its own -- so the rule is looked for across all of them rather
       than in whichever one happens to come first. */
    const phone = [...om.matchAll(/@media\s*\(max-width:\s*820px\)\s*\{([\s\S]*?)\n  \}/g)]
      .map((m) => m[1]).join('\n');
    t.check(/\.om-rail\{[^}]*display:\s*none/.test(phone),
      'the OM layer hides the rail at the 820px switch, where the phone has its own chrome');
  }

  /* ---- and the two systems do not touch ----
     The whole point of a replacement is that it replaces. A rule that
     reaches for an --ow- token is a screen being improved rather than
     redrawn, which is the one thing this pass is not. */
  t.check(!/--ow-/.test(om), 'no OM rule borrows a token from the console layer');
  t.check(!/\.ow-/.test(om), 'and none of them styles a console component');
}

process.exit(t.done() ? 1 : 0);
