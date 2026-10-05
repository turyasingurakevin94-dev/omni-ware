#!/usr/bin/env node
'use strict';
/*
 * The ratchet.
 *
 * This app is being redesigned screen by screen, and some of that work
 * will be done by people and agents who did not sit through the year of
 * decisions behind it. A document explaining the house style is a
 * document; this is a gate. Anything that widens the type ramp, the
 * radii or the shadows fails here, and `npm test` fails with it. The
 * palette is the exception: the owner lifted its ceiling, so colours are
 * counted and reported, and held to contrast rather than to a number.
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
const cssRaw = src.slice(styleStart, styleEnd);
const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, ' ');

const markAt = src.indexOf('THE OW LAYER');
const layerRaw = src.slice(src.lastIndexOf('/*', markAt), styleEnd);
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
    /* 56, and the two are BOUGHT rather than leaked. Order tracking is
       the lane board again -- five steps and the orders standing at
       each -- and that screen spends exactly two marks that nothing
       else in the file draws:

         the lane flash    an inset ring in the lane's own colour, the
                           answer to a rail click. Without it, clicking
                           a step on a wide board slides the strip and
                           says nothing about which lane arrived.
         the badge ring    `0 0 0 2px var(--panel)`, one declaration
                           worn by both rail badges. A knockout, not a
                           lift: it punches the count and the chase
                           figure out of the node they overlap.

       Neither is depth, which is what the law above is about -- no
       elevation came back with the board. The resting `inset 0 0 0 0
       transparent` the lane used to declare, purely to transition out
       of, did NOT: that one was a distinct shadow spent on nothing
       being drawn, and it is gone for good. */

    /* 57, not 56, and this one goes UP -- the second time in this file,
       so it is argued rather than nudged.

       The owner asked for the New quote screen to be restored exactly as
       it stood before the rebuild, and explicitly authorised breaking the
       house rules to get it. The screen it brings back carries one shadow
       the rebuild had removed: 0 -4px 16px rgba(20,30,40,.06) under the
       sticky totals bar. That bar is fixed to the viewport with the
       document scrolling underneath it, which is the one case --ow-lift
       exists for ("things that genuinely float"), except that it lifts
       UPWARD and --ow-lift only casts down. A hairline cannot do the job:
       the bar's ground and the page's ground are both warm paper, so at
       the moment a row passes under it there is nothing to separate them.

       It is one shadow, on one element, on one screen, and it is the
       original's. It may not spread: anything else that wants depth still
       uses --ow-lift or a hairline. */
    /* And up again, for the board. Order tracking was restored to the
       lane board it stood on on 2 September, on the shop's instruction,
       and it came back with the four marks only it and its three run
       dialogs draw: the overdue flag's lift, the carousel card's, the
       floating arrow on the carousel's nav, and the lane's resting
       `inset 0 0 0 0 transparent` that the flash transitions out of.
       Three of the four ARE elevation, which the law above is about.
       They are here because the screen they belong to is here, not
       because depth was reconsidered, and nothing outside that board
       and its dialogs may spend one.

       Two rulings, two rises, both the owner's, both kept whole so the
       next reader can weigh each on its own. */
    /* 60, not 61: the cash book's redesign spent none and dropped
       two. The chosen account in the till wears its own colour as an
       outline now rather than a one-pixel inset shadow in ink, and the
       ledger's old account filter, with its raised "on" button, became
       the layer's .ow-seg, which marks the chosen one by fill. */
    'shadows': [60, /box-shadow:\s*([^;}]+)/g],
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
    /* 103 still, through a swap that had to pay for itself. The palette
       moved to the design handoff's own values, and that split ONE
       literal into two: #14171B was both the navy chrome and the
       darkest ink, where the handoff has a rail navy (#16203C) and a
       body ink (#1C2233) that are not the same colour. That is a real
       distinction and it costs a slot, so a slot was found rather than
       the ceiling raised: .obs-note's ground was #FEF6E7 and
       .info-banner.warn's was #FFF6E8 -- two hand-written caution
       creams one rgb unit apart, which no eye has ever told apart.
       They are one cream now. */
    /* 102, not 103: the buying list's verdict block carried #BFD9D1 and
       #E7C3BF, two hand-written keylines that existed only to edge a
       tinted panel saying the same three figures the round's own strip
       says. The panel went when the list became a set of place cards;
       one of its two keylines was already spent elsewhere, the other
       was not. */

    /* 109, not 102. TWO rises, from two unrelated decisions, and both
       are kept whole because each is an argument the next reader has to
       be able to weigh on its own.

       +6, THE CATEGORY PALETTE (the owner's ruling). A palette held to
       one accent forces every layout monochrome, and colour is a real
       instrument of hierarchy -- six rail doors told apart by hue are
       found faster than six told apart by position alone. So a fourth
       ROLE was added and it cost six literals: indigo, sky and plum,
       each a tint and its ink. Sell, Catalogue and Setup wear oxide,
       verdigris and the neutrals, which is why this is +6 and not +12.

       +1, THE RESTORED NEW QUOTE SCREEN (also the owner's, and also a
       ruling: the page was to come back exactly as it stood before the
       rebuild, house rules included). It carries #F7F9FB, the cool tint
       behind an item thumbnail's dashed placeholder in the picker and
       on a quote line -- the ground for a box standing in for a
       photograph nobody has taken. The palette has no cool near-white:
       --ow-paper-2 is warm, and on a warm ground a warm placeholder
       does not read as an absence. One value, two rules.

       What did NOT change: this is still a ceiling, it still may only
       fall, and every pair added is held to 4.5:1 in the contrast
       block. A colour is cheap to justify and expensive to add. */
    /* 108, not 109: the cash book went back to the four stacked panels
       it had before the console -- the same ruling that brought back New
       Quote above -- and the console's opening bar went with it.
       #E3B5AE was that bar's broken-chain variant: the keyline on a
       ghost button inside a warning nothing else draws. The warning
       itself is .cb-chain-break again, at the head of the closing panel,
       which is where it sat before and which spends no literal of its
       own. The bar survives for Mobile Money, the shop's unset settings
       and the duplicate-supplier band; only the crimson variant went.

       Worth noting against the +1 above: restoring a screen does not
       have to cost a colour. This one paid one back. */
    /* And up again, for the board: six hexes come back with the lane
       board -- the pickups pill's four purples, the invoice icon's own
       amber, and the buying list's verdict keyline. The purple is
       outside the palette and always was. It is carried because the
       screen was asked for as it was, not because the palette grew, and
       no new screen may spend any of the six. */
    /* NO CEILING ON COLOURS -- the owner's ruling, and the last of the
       hue quota. Everything above is the history of a count that could
       only fall; it stopped being a rule when the owner said a layout
       may carry as many colours as its information needs. The count is
       still REPORTED below, so a rise is visible in every run, but it
       no longer fails anything.

       What still guards colour is what was always the real guard: every
       pair the system sets as text is held to 4.5:1 in the contrast
       block, and a new family joins that list when it is added. More
       colours was allowed; unreadable ones never were. */
  };
  {
    const hexes = new Set([...css.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(m => m[0].toUpperCase()));
    t.check(true, `distinct colours: ${hexes.size} (no ceiling — reported, not limited)`);
  }
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

    /* THE CATEGORY PALETTE, held to exactly what the state families are
       held to. Widening the palette was the owner's call; letting a
       widened palette ship an unreadable pairing was not. Each ink is
       checked twice -- on its own tint, which is how the rail's
       monograms draw it, and on paper, because a category colour that
       cannot be set as text is half a colour. */
    ['--ow-indigo', hex('--ow-indigo-soft'), 4.5, 'Buy — its ink on its own tint'],
    ['--ow-indigo', PAPER, 4.5, 'Buy — its ink as text'],
    ['--ow-sky', hex('--ow-sky-soft'), 4.5, 'Money — its ink on its own tint'],
    ['--ow-sky', PAPER, 4.5, 'Money — its ink as text'],
    ['--ow-plum', hex('--ow-plum-soft'), 4.5, 'Insight — its ink on its own tint'],
    ['--ow-plum', PAPER, 4.5, 'Insight — its ink as text'],
    ['--ow-verdigris', hex('--ow-verdigris-soft'), 4.5, 'Catalogue — its ink on its own tint'],
    ['--ow-ink-600', hex('--ow-rule-soft'), 4.5, 'Setup — the neutral door, ink on its tint'],

    /* THE SUPPLIER HUES. Identity, like the category palette: on the
       Invoices screen each supplier keeps one colour across its bar
       segment, its join and its bill. Six families -- the three category
       inks plus teal, violet and slate -- each checked as ink on its
       tint, ink as text, and white on the ink, which is how a PAID
       segment carries its initials. */
    ['--ow-teal', hex('--ow-teal-soft'), 4.5, 'supplier teal — ink on its tint'],
    ['--ow-teal', PAPER, 4.5, 'supplier teal — ink as text'],
    ['--ow-violet', hex('--ow-violet-soft'), 4.5, 'supplier violet — ink on its tint'],
    ['--ow-violet', PAPER, 4.5, 'supplier violet — ink as text'],
    ['--ow-slate', hex('--ow-slate-soft'), 4.5, 'supplier slate — ink on its tint'],
    ['--ow-slate', PAPER, 4.5, 'supplier slate — ink as text'],
    ['--ow-sky', hex('--ow-sky-soft'), 4.5, 'Money, and a part-paid chip — ink on its tint'],
  ];
  ['--ow-indigo', '--ow-sky', '--ow-plum', '--ow-teal', '--ow-violet', '--ow-slate'].forEach((tok) => {
    const r = hex(tok) ? ratio(PAPER, hex(tok)) : 0;
    t.check(r >= 4.5, `${r}:1 — white on ${tok} · a paid supplier segment's initials`);
  });
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
  t.check(fams.every((f) => /IBM Plex Mono|Archivo Black|Figtree|inherit|ui-monospace/.test(f)),
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
      /* Redrawn on the owner's canvas: the registry is one card per LINE
         (its own .prx-card, a grid of four, not the layer's .ow-cards of
         quotes), Paid is one table and Rivals the engine's move rows, so
         priceCardHTML and priceRailHTML went and the card-grid classes
         with them. What stays is the layer's strip, chip, panel, side
         row and empty state -- the parts every converted screen shares. */
      renders: ['renderPrices', 'renderPriceWatch', 'renderMarket'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-cp', 'ow-pan', 'ow-sr', 'ow-empty'],
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
    followups: {
      /* AND CHASE DEBTS' RETIRED FAMILIES. Its own entry stood below
         this one and named .chase-card, .chase-list, .chase-acts,
         .chase-facts and the private .sum-strip -- the card-per-debtor
         and the hand-rolled strip its console replaced. That screen is
         this one's Money lens now, so the families it may never wear
         again are this screen's to refuse: the ratchet follows the
         markup, and the markup is here. Its own .ch-* vocabulary is NOT
         added to the list, because nothing in the app wears it at all
         any more -- a name belongs here when a screen could plausibly
         reach for it again, and css-class-hooks is what catches a class
         with no rule behind it. */
      retired: ['panel', 'dir-summary-row', 'dir-summary-card', 'st-bar', 'st-tabs', 'st-tab', 'search-bar',
                'fup-card', 'fup-card-head', 'fup-avatar', 'fup-flag', 'fup-item', 'fup-item-head', 'fup-item-name',
                'fup-reason', 'fup-acts', 'fup-warn', 'fup-group', 'fup-group-head', 'fup-empty', 'fup-pill',
                'chase-card', 'chase-list', 'chase-acts', 'chase-facts', 'sum-strip', 'sum-cell'],
      /* THE LAYOUT IS THE SCREEN'S SKELETON NOW, not something a renderer
         draws. One .ow-grid and one .ow-side stand in the markup on both
         views, so the furniture cannot move when a filter changes -- which
         is precisely what the three lenses this screen replaced got wrong.
         The renderers fill the two holes; they no longer decide the shape.
         .ow-stack went with the split it belonged to. */
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp',
             'ow-grid', 'ow-side', 'ow-pan', 'ow-pan-h', 'ow-pan-t',
             'ow-seg', 'ow-seg-b', 'ow-f', 'ow-f-l', 'ow-f-in', 'ow-f-v', 'ow-f-u'],
      /* AND WORTH TELLING'S BUILDERS, which outlived its screen.
         That entry said the same brief was drawn three times -- a row in
         the fortnight's queue, the reasoning under that row, and a panel
         on the client's own account -- and that a second copy of
         briefStripHTML would be free to show the owner a filmstrip the
         picture does not match. It is drawn TWICE now, here and on the
         account, and that is exactly why this screen opens
         customerBriefPanelHTML rather than laying the frames out again.
         The ratchet follows the builders, and the builders are this
         screen's now. */
      renders: ['renderFollowUpsContact', 'renderFollowUpSummary', 'renderFollowUpsAll',
                /* The console's own builders: the status line that replaced the
                   sixth tile, the rail that closes the loop, and the three lanes
                   the merge brought in. They draw markup, so the ratchet follows
                   them too. */
                'renderFollowUpQuietLine', 'renderMessagesSide', 'msgLaneHTML', 'msgLaneRow',
                'msgThreadHTML', 'fupPromiseHTML', 'msgPostOpenHTML', 'msgPostRailHTML', 'msgPostLaneHTML', 'msgPostSlotsHTML', 'msgPostRowHTML', 'msgRegTrackHTML', 'renderFollowUpScore',
                /* And the intelligence center's readings: the band over every
                   lane, a row's signal and odds, the dossier an opened row
                   carries, the lanes' own bands and the Intelligence view.
                   They draw markup on this screen, so the ratchet follows
                   them -- none of them may bring back a retired family. */
                'msgBandHTML', 'msgSignalHTML', 'msgOddsHTML', 'msgWindowHTML', 'msgDossierHTML',
                'msgHeldSummaryHTML', 'msgPromiseWeekHTML', 'msgReadsHTML', 'msgAnswerBandHTML',
                'msgReadsBandHTML', 'msgRecordHTML', 'msgPromiseCalendarHTML', 'msgPostBandHTML',
                'renderMessagesIntel', 'msgTplChipsHTML', 'msgTplFilledHTML', 'renderMessagesTemplates',
                'renderFollowUpScore', 'fupHeldPanelHTML', 'fupCp',
                'briefStripHTML', 'briefWhyHTML', 'customerBriefPanelHTML',
                'briefNoteBody', 'briefLeftOffHTML'],
      /* WHAT THE MERGE TOOK OFF THIS LIST, and why.

         'ow-grid-l' and 'ow-lr' were here because the screen was a
         narrow list of clients beside a wide card holding the draft.
         That is the shape the Messages console removed. The old
         assertion meant: this screen lays a queue out on the layer's
         split grid and draws each client as a dense side row. It
         stopped being true when the queue became the layer's own WORK
         QUEUE -- .ow-q, one 44px row per person, opening IN PLACE --
         and the split became .ow-grid's queue-plus-304px-rail.

         Two places showing one draft is how they come to disagree, so
         there is no second pane to put .ow-lr rows beside any more. The
         new names below assert the replacement rather than the absence:
         the queue is the layer's component, not a fourteenth variant of
         it, and .ow-q-x is the expansion that proves it opens in place. */
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-u',
                    'ow-q', 'ow-q-r', 'ow-q-x', 'ow-q-card', 'ow-q-v', 'ow-q-f', 'ow-q-b',
                    'ow-mq', 'ow-mq-h', 'ow-mq-n', 'ow-mq-s', 'ow-mq-band', 'ow-mq-quiet',
                    'ow-mq-chat', 'ow-mq-bub', 'ow-mq-wait', 'ow-mq-trk', 'ow-mq-tn',
                    'ow-mq-td', 'ow-mq-tl', 'ow-mq-ts', 'ow-mq-hold', 'ow-mq-ht', 'ow-mq-hp',
                    'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-msg',
                    'ow-cp', 'ow-cp-d', 'ow-av', 'ow-sr', 'ow-sr-k', 'ow-sr-v',
                    /* 'ow-tbl-g' left this list with the Register's group
                       rows. They grouped asks by thing or by customer; the
                       "Register redesign" canvas draws each thing as ONE
                       row of the layer's table (its road, who waits, its
                       worth, its act) that opens in place onto its people,
                       so there is no group header left to wear the class.
                       The table itself -- .ow-tbl, its rows and action
                       cell -- is still the layer's, and still asserted. */
                    'ow-tbl', 'ow-tbl-r', 'ow-tbl-a', 'ow-fig',
                    'ow-empty', 'ow-mini',
                    /* The reasoning under a picture makes three different
                       demands on the owner -- go and fix, weigh before
                       sending, simply know -- and they arrived in one grey.
                       Three blocks under their own heading, plus the
                       picture's own measure under a rule. */
                    'ow-bn', 'ow-bn-l', 'ow-bn-t', 'ow-bn-fix',
                    'ow-bn-watch', 'ow-bn-note', 'ow-bn-f'],
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
    /* DEBTORS -- "Who owes you" until it was drawn as a console, and now
       named the word the shop already uses. Two stacked .panel blocks
       became a strip, one age bar with a legend where there had been a
       bar AND five bordered cards saying the same five figures, and a
       six-column <table> with a phone card-wall beside it became .ow-q
       rows that open in place and emit their own cards.

       .age-* is no longer worn by either ledger screen: the creditors
       list, which was this screen's last wearer, has since been drawn
       as a console of its own. Both entries retire the same families,
       and each is pinned separately so neither conversion can be
       mistaken for the other's. */
    'analytics-debtors': {
      retired: ['page-head', 'panel', 'panel-head-row', 'an-toolbar', 'btn-row', 'field',
                'sq-select-all-label', 'empty',
                'age-pos', 'age-pos-head', 'age-pos-total', 'age-pos-aside', 'age-bar', 'age-seg',
                'age-bands', 'age-band', 'age-verdict', 'age-filter-note', 'age-table', 'age-pill',
                'age-name', 'age-where', 'age-amt', 'age-paid', 'age-never', 'age-act', 'age-card',
                'pi-card', 'pi-cards', 'pi-table-wrap', 'inv-total-row'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp', 'ow-grid', 'ow-side', 'ow-db'],
      renders: ['renderDebtorsList', 'renderDebtorsPosition', 'renderDebtorsRail', 'renderDebFilterNote'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s',
                    'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n',
                    'ow-tb', 'ow-tb-s', 'ow-tb-n', 'ow-f', 'ow-f-l', 'ow-f-in', 'ow-f-sel',
                    /* No ow-q-why: an open debtor opens straight onto its
                       invoices. The sentence that used to stand there
                       repeated the row it had just opened -- the
                       balance, the age and the paid-off share are all
                       already on that row -- and the paragraph under it
                       said the same thing about every debtor in the
                       book. The reasoning a screen genuinely owes the
                       reader is in the rail; what is left in an open
                       row is the evidence. */
                    'ow-q', 'ow-q-r', 'ow-q-card', 'ow-q-x', 'ow-q-t', 'ow-q-who', 'ow-q-v',
                    'ow-q-f', 'ow-q-note', 'ow-q-a', 'ow-cp',
                    'ow-tbl', 'ow-tbl-h', 'ow-tbl-r', 'ow-tbl-n',
                    'ow-sr', 'ow-sr-k', 'ow-sr-v', 'ow-mini', 'ow-empty'],
    },
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
      renders: ['renderCreditorsList', 'renderCreditorsPosition', 'renderCreditorsRail', 'renderCredFilterNote',
                'credWhenHTML'],
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
      renders: ['renderPayrollPosition', 'renderPayrollDues', 'renderPayrollRail', 'payrollGroups',
                'payrollMonthTrackHTML', 'payrollStripHTML', 'payrollDayGridHTML'],
      /* No .ow-strip here any more, and that is a decision, not a patch.
         The strip was four tiles -- in hand, still to pay, late, next due
         -- that left the owner to do the one sum the screen exists for.
         It is replaced by the RUNWAY (.ow-py-rw): the same figures, plus
         the bar that does the sum, today's cash marked on it, and the
         month's days (.ow-py-mt) under it. Each row carries its own month
         as ticks (.ow-py-ds), a daily month is counted by tapping
         (.ow-py-dg), and the rail's derived figures became bars
         (.ow-py-mx). Holding this list to .ow-strip would have kept the
         tiles alive beside the bar that answers them. */
      rendersUses: ['ow-py-rw', 'ow-py-mt', 'ow-py-ds', 'ow-py-dg', 'ow-py-mx', 'ow-u',
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
    /* Order tracking is NOT in this list, and that is the entry.

       It was converted to the layer when the lane board became a
       console; the shop asked for the board back -- five steps across
       the top, the orders standing at each one below, and an arrow
       either side of a card to move it a step. So the screen wears
       .sq-board/.sq-col/.sq-card/.sq-stepper again and the lane CSS is
       back in the file with it. It is the one screen left on that
       vocabulary: sourcing, which used to share it, has converted, so
       nothing here is kept alive for a second caller.

       Naming it CONVERTED would make this file assert the opposite of
       what ships. When it goes back on the layer, its entry comes back
       with it. */
    /* Sourcing. Five lanes for a question that crosses all five: a thing
       priced and ready to list and a thing nobody has touched in three
       weeks are the same work -- the owner's -- and they sat two columns
       apart. Listed had already been special-cased into a searchable
       list INSIDE a lane, because it grows without bound and nothing
       leaves it, which is the layout saying the shape was wrong.

       Then drawn rather than told. The four-tile strip became the
       pipeline: five steps with one square per item in its state's
       colour, and the three figures on one line under it -- so .ow-strip
       and .ow-mt left the screen. The "Needs you" and "Somebody is on
       it" bands became ONE list ranked by people times wait, each row
       carrying its one next move by name (.ow-sf-need went with the
       band, and .ow-sf-who with the avatar that stood in for a move),
       above it a demand map of every item, and beside it who is
       waiting as bars. The archive is still one folded line that opens
       on its search, because browsing a hundred listed items is what
       Products is for.

       Then rebuilt from the design canvas the owner signed off: capture,
       the five-step board with a popup per item, each item's verdict and
       plan, today's checklist, recommendations for every item and the
       demand map. It lives in sourcing-console.js and draws with that
       canvas's own markup (its classes renamed into ow-sv-), so the
       section is only a mount point and renderSourcing only mounts it.
       The layer entries below said "built from ow-ph and the ow-sf table"
       and that is no longer what ships; what still holds -- none of the
       families it retired may come back -- is kept. The console's own
       rules are pinned in test/sourcing-console.test.js. */
    'sourcing': {
      retired: ['page-head', 'panel', 'qp-panel', 'sq-board-tools', 'sq-select-all-label',
                'sq-board', 'sq-col', 'sq-card', 'sq-stepper', 'sf-card', 'sf-facts', 'sf-fact',
                'sf-listed', 'sf-dropped', 'sf-meta-row', 'sf-days', 'sf-ask-count', 'empty'],
      uses: [],
      renders: ['renderSourcing'],
      rendersUses: [],
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
      /* Drawn rather than listed: the four tiles and the Position list
         became one picture of who owns what the shop owns and one of
         what falls due by month, so .ow-strip/.ow-mt and the .ow-sr
         rows left the screen; the worth-less-owed sum (.ow-ar) became
         the chart it summarised. */
      renders: ['renderAssetsLoans', 'alRows', 'alRowHTML', 'alFig', 'alTbl', 'alLoanBody', 'alAssetBody',
                'alBarHTML', 'alPayFormHTML', 'alPaidListHTML', 'alPipsHTML', 'alInstalmentBarsHTML', 'alWorthChartSVG'],
      rendersUses: ['ow-pan', 'ow-pan-h', 'ow-pan-t',
                    'ow-q', 'ow-q-r', 'ow-q-card', 'ow-q-x', 'ow-q-why', 'ow-q-un', 'ow-q-a', 'ow-cp',
                    'ow-ev', 'ow-ev-h', 'ow-ev-t', 'ow-ev-row', 'ow-tbl', 'ow-tbl-r', 'ow-tbl-n',
                    'ow-mini', 'ow-empty', 'ow-al-top', 'ow-al-ob', 'ow-al-dc', 'ow-al-bar', 'ow-al-ch', 'ow-al-pips',
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
    invoices: {
      retired: ['panel', 'qp-panel', 'an-toolbar', 'field', 'panel-head-row', 'btn-row',
                'sq-select-all-label', 'empty',
                'pi-table-wrap', 'pi-cards', 'pi-cards-select-all', 'pi-cards-summary',
                'pi-card', 'pi-card-top', 'pi-card-title', 'pi-card-meta', 'pi-card-foot',
                'sc-stats', 'sc-stat', 'an-rank', 'sortable', 'sort-arrow',
                'pc-icon-btn', 'inv-row-actions', 'inv-doc-link', 'inv-status',
                'inv-status-cell', 'inv-row-voided', 'inv-total-row', 'inv-total-label',
                'deb-card-prog'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-f', 'ow-f-l', 'ow-f-in',
             'ow-strip', 'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-seg', 'ow-seg-b'],
      /* .ow-tb LEFT WITH THE "BULK OPERATION" DROPDOWN. The redesign the
         owner drew puts a selection's acts on a dark bar that appears
         only once something is ticked (.inv-selbar), and the select-all
         box moved into the table's own header -- so the always-there
         toolbar row it styled is gone from the markup, not restyled. */
      /* FIVE NAMED FUNCTIONS NOW, not one. The screen grew a third lens
         -- a sale beside the bills it raised -- and the chip, the
         progress bar, the range-and-order and the row's acts were
         lifted out of renderInvoices so the two lenses cannot disagree
         about one pile of money. A spec still naming only renderInvoices
         would have policed the register while the lens beside it, which
         draws the same table from the same helpers, went unchecked: the
         assertion's meaning ("this screen is built on the layer") is
         unchanged, and what changed is how many functions that screen
         is now spread across. */
      /* AND THE STRIP AND THE PANELS, which the redesign lifted out
         of renderInvoices into invStripHTML and invPanelsHTML so that
         they are drawn from the whole range while the table beside
         them is drawn from what its column filters let through. The
         strip still emits the same tiles (.ow-mt, -l, -v, -s); a spec
         that stopped at renderInvoices would now miss them and report
         the tiles gone when they had only moved. The meaning -- "this
         screen is built on the layer" -- is unchanged. */
      renders: ['renderInvoices', 'renderInvoicesUnified',
                'invStatusChip', 'invProgressCell', 'invStripHTML', 'invPanelsHTML'],
      /* .ow-tbl-g and .ow-fig-b WENT WITH THE OPEN / SETTLED / VOIDED
         BANDS. The owner's canvas is a flat spreadsheet ordered by any
         column -- balance first by default -- with Status and Collected
         as columns of their own, so there is no band to head and no
         "received" line to set under a figure. The row's own note for a
         document that disagrees with itself (.ow-tbl-note) stays. */
      rendersUses: ['ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-tbl', 'ow-tbl-h', 'ow-tbl-r',
                    'ow-tbl-f', 'ow-tbl-c', 'ow-tbl-n', 'ow-tbl-a', 'ow-tbl-note',
                    'ow-tbl-p', 'ow-fig', 'ow-cp', 'ow-link', 'ow-empty'],
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
    /* Rebuilt to the design board: a row opens the account (no account
       in place any more, so customerAccountHTML, its figures and its
       action row went), the account is hero, five figures, next moves,
       timeline, the statement as a ruled table and a rail, and the book
       is the map beside Needs you today over a table. The layer still
       carries the frame of all of it -- panels, the strip, chips, the
       segmented lenses, the grid -- and the table rows are this screen's
       own ruled table, drawn once for the book and once for the
       statement. */
    customers: {
      retired: ['panel', 'panel-head-row', 'search-bar', 'dir-summary-row', 'dir-summary-card',
                'customer-grid', 'customer-card', 'cc-head', 'cc-avatar', 'cc-title', 'cc-name',
                'cc-id', 'cc-meta', 'cc-actions', 'cc-details', 'cc-row', 'cc-notes', 'cc-both',
                'cc-debt-row', 'cc-debt-label', 'cc-debt-value', 'cc-debt-actions', 'cc-debt-btn',
                'cc-last-activity', 'pc-icon-btn', 'btn-icon', 'empty', 'field'],
      /* No ow-ph-help and no ow-f-l since the book was built to the design
         board: its header is the name, the count and the search, with the
         magnifier saying what the field is (its label is aria-label), and
         the paragraph that sat behind the "i" said in words what the map
         and the columns now show. */
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-f', 'ow-f-in',
             'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-seg', 'ow-seg-b', 'ow-seg-n'],
      renders: ['renderCustomers', 'customerRegisterRowHTML', 'customerNeedsTodayHTML',
                'renderCustomerAccount', 'customerHeroHTML', 'customerKpiHTML',
                'customerStatementPanelHTML', 'customerRailHTML'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-tbl-p', 'ow-tbl-s',
                    'ow-fig', 'ow-cp', 'ow-cp-d', 'ow-empty', 'ow-mini', 'ow-q-note', 'ow-ph-t',
                    'ow-grid', 'ow-stack', 'ow-side', 'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n',
                    'ow-seg', 'ow-seg-b'],
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
      /* Three columns under a strip now, and a second lens: the strip,
         the list's tabs, the rail's panel, and the Learned lens with its
         patterns are each drawn by their own builder beside the screen
         builder, and the size grid and the draft by theirs. */
      renders: ['renderPairings', 'pairStripHTML', 'pairTabsHTML', 'pairListHTML',
                'pairProductHTML', 'pairRowHTML', 'pairEditorHTML', 'pairGridHTML',
                'pairDraftHTML', 'pairObservedHTML', 'pairUsedHTML', 'pairOffHTML',
                'pairLearnedHTML', 'pairPatternsHTML'],
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

process.exit(t.done() ? 1 : 0);
