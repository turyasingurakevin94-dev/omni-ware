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
    'font sizes': [32, /font-size:\s*([\d.]+)px/g],
    'radii': [28, /border-radius:\s*([^;}]+)/g],
    /* 62, not 63: the cash book's two floating + / - buttons are gone --
       they duplicated Money in and Money out from the top of the page,
       and the entry line that replaced them is permanently on screen, so
       their drop shadow and its hover went with them. */
    'shadows': [62, /box-shadow:\s*([^;}]+)/g],
    /* 105, not 106: Follow-ups' card wall carried its own hover border,
       its own two near-whites for a card and a settled row, and its own
       hover fill. All four went when that screen became a console on the
       layer, and the one that survives is the layer's --ow-paper-2. */
    'distinct colours': [105, /#[0-9A-Fa-f]{6}\b/g],
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
      rendersUses: ['ow-tbl', 'ow-tbl-r', 'ow-tbl-f', 'ow-tbl-n', 'ow-gi'],
    },
    /* Chase debts. The page head and the .panel wrapper went; the
       card-per-debtor (.chase-card, .chase-list) and the private strip
       (.sum-strip) became the layer's strip, list rows, panels and the
       message box. .chase-mini outlived this screen for a while because
       the creditors list wore it; that screen is a console now too, so
       the rules are gone from the file entirely. */
    chase: {
      retired: ['page-head', 'panel', 'chase-card', 'chase-list', 'chase-acts', 'chase-facts', 'sum-strip', 'sum-cell'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub'],
      renders: 'renderChaseScreen',
      rendersUses: ['ow-strip', 'ow-mt', 'ow-grid-l', 'ow-pan', 'ow-lr', 'ow-msg', 'ow-tbl', 'ow-cp'],
    },
    /* What to buy. The form above the list became two fields in the
       header; the private list, row, chip, order card and basket became
       the layer's table, chip, panels and basket bar. .pp-facts and
       .pp-why were Rival prices' verdict facts, and went with that
       screen when it became the registry's Rivals side. */
    buying: {
      retired: ['page-head', 'panel', 'form-panel', 'pp-controls', 'pp-list', 'pp-row', 'pp-top', 'pp-when',
                'pp-empty', 'pp-ord', 'pp-basket', 'sum-strip', 'sum-cell'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-f'],
      renders: 'renderPurchasePlanPanel',
      rendersUses: ['ow-strip', 'ow-mt', 'ow-grid', 'ow-pan', 'ow-tbl', 'ow-tbl-r', 'ow-tbl-note', 'ow-cp', 'ow-bk'],
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
    followups: {
      retired: ['panel', 'dir-summary-row', 'dir-summary-card', 'st-bar', 'st-tabs', 'st-tab', 'search-bar',
                'fup-card', 'fup-card-head', 'fup-avatar', 'fup-flag', 'fup-item', 'fup-item-head', 'fup-item-name',
                'fup-reason', 'fup-acts', 'fup-warn', 'fup-group', 'fup-group-head', 'fup-empty', 'fup-pill'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-seg', 'ow-seg-b', 'ow-f', 'ow-f-l', 'ow-f-in'],
      renders: ['renderFollowUpsContact', 'renderFollowUpSummary', 'renderFollowUpsAll', 'fupCp'],
      rendersUses: ['ow-strip', 'ow-mt', 'ow-grid-l', 'ow-pan', 'ow-lr', 'ow-msg', 'ow-cp', 'ow-av',
                    'ow-tbl', 'ow-tbl-g', 'ow-tbl-r', 'ow-fig', 'ow-empty'],
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
       grouped by stage with rows that open in place, and a rail. The
       sourcing funnel still wears .sq-board/.sq-col/.sq-card by design,
       so those stay in the FILE; only this screen may not emit them. */
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
    /* THE DAY. The last screen in the app still emitting .sum-strip and
       .ah-row -- families this file's own source marks "not to be
       reached for again" -- and 2,620px of one column on a 1,440px
       screen, with four headline figures and nothing to measure them
       against.

       The eight lists survive with the same derivations; they are
       arranged rather than rewritten. .sum-strip became .ow-strip
       carrying a comparison line, the eight .pw-tail sections became
       .ow-tbl with .ow-tbl-g bands -- so the phone gets that component's
       own card skin for nothing -- and the day picker left its 82px
       bordered region for the page header, because the day is what the
       screen is about rather than a filter on it.

       .mgr-sec-title, .mgr-keyline and .mgr-objective went with them:
       the Manager's own section title, worn on a screen that is not the
       Manager, was a fourth opinion about what a heading looks like.
       .ah-* and .pw-* stay in the FILE -- Cash ahead and Margin still
       wear them -- and .mgr-move stays because renderDayMeeting draws
       the Manager's real move cards rather than a second set of its own.
       Only this screen may not emit the families again, which is what
       this list means. */
    day: {
      retired: ['page-head', 'panel', 'an-toolbar', 'field',
                'sum-strip', 'sum-cell', 'sum-value', 'sum-label',
                'pw-tail', 'pw-empty', 'pp-more',
                'ah-sub', 'ah-rows', 'ah-row', 'ah-when', 'ah-what', 'ah-amt', 'ah-left', 'ah-kind',
                'mgr-sec-title', 'mgr-keyline', 'mgr-objective', 'mgr-why'],
      uses: ['ow-ph', 'ow-ph-t', 'ow-ph-sub', 'ow-ph-help', 'ow-ph-sp', 'ow-dy-nav', 'ow-dy-b', 'ow-dy-d'],
      renders: ['renderDay', 'renderDayMeeting', 'dayTile'],
      rendersUses: ['ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-strip', 'ow-mt', 'ow-mt-v', 'ow-mt-d',
                    'ow-grid', 'ow-side', 'ow-stack', 'ow-tbl', 'ow-tbl-r', 'ow-tbl-n', 'ow-tbl-g',
                    'ow-ck', 'ow-cp', 'ow-mini', 'ow-empty'],
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
             'ow-strip', 'ow-pan', 'ow-pan-h', 'ow-pan-t', 'ow-pan-n', 'ow-seg', 'ow-seg-b', 'ow-tb'],
      renders: 'renderInvoices',
      rendersUses: ['ow-mt', 'ow-mt-l', 'ow-mt-v', 'ow-mt-s', 'ow-tbl', 'ow-tbl-h', 'ow-tbl-r',
                    'ow-tbl-g', 'ow-tbl-f', 'ow-tbl-c', 'ow-tbl-n', 'ow-tbl-a', 'ow-tbl-note',
                    'ow-tbl-p', 'ow-fig', 'ow-fig-b', 'ow-cp', 'ow-link', 'ow-empty'],
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
