#!/usr/bin/env node
'use strict';
/*
 * Stock on hand, as a list with the money on it.
 *
 * The cards showed a quantity and a cost per unit and never the two
 * multiplied. Cost each does not tell you whether a line is 40,000 of
 * stock or 4,000,000 of it, and that is the figure that decides what to
 * count first and what is tying up the cash. The shelf could not be
 * totalled either, though the balance sheet has carried that number all
 * along.
 *
 * The judgements pinned below:
 *
 *   null, not zero      "worth nothing" and "nobody wrote down what it
 *                       cost" are different facts. The balance sheet
 *                       already declares the second as UNDERSTATING
 *                       stock rather than valuing it at zero, and this
 *                       screen must not contradict it.
 *   uncosted needs      a line with nothing on the shelf has no cost for
 *   stock               an ordinary reason. Only stock that is there and
 *                       unpriced is a gap worth flagging.
 *   counts follow       a strip that ignored the filters would
 *   the filters         contradict the rows underneath it.
 *
 * Run: node test/inventory-layout.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('inventory layout');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const data = { stock: {}, stockLots: {}, products: [] };

const scope = compileScope([
  extractDeclaration(src, 'INVENTORY_SORTS', 'index.html'),
  extractFunction(src, 'stockKey', 'index.html'),
  extractFunction(src, 'stockOnHand', 'index.html'),
  extractFunction(src, 'getStockQty', 'index.html'),
  // The card now shows the shop's own restock level, so the rule that
  // reads it comes with the line builder.
  extractFunction(src, 'reorderRuleFor', 'index.html'),
  /* The card no longer works out its own value: it reads the same
     per-shelf function the balance sheet does, and says whose the goods
     are beside it. Both come with the line builder. */
  extractFunction(src, 'shelfValueForKey', 'index.html'),
  extractFunction(src, 'consignTally', 'index.html'),
  extractFunction(src, 'consignedOnShelf', 'index.html'),
  extractFunction(src, 'stockKey', 'index.html'),
  extractFunction(src, 'inventoryLineFor', 'index.html'),
  extractFunction(src, 'inventoryLineStats', 'index.html'),
  extractFunction(src, 'sortInventoryLines', 'index.html'),
], {
  data,
  getFIFOUnitCost: (id, vidx) => {
    const lots = data.stockLots[vidx == null ? id : `${id}::${vidx}`] || [];
    const costed = lots.find((l) => l.cost != null);
    return costed ? costed.cost : null;
  },
  productUnitLabel: () => 'pcs',
  productPackInfo: () => null,
}, ['inventoryLineFor', 'inventoryLineStats', 'sortInventoryLines']);

const p = (id, name) => ({ id, name, category: 'X', variants: [] });
const line = (id, name, qty, cost) => {
  data.stock[id] = qty;
  data.stockLots[id] = cost == null ? [{ qty, cost: null }] : [{ qty, cost }];
  return scope.inventoryLineFor(p(id, name), null);
};
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => { data.stock = {}; data.stockLots = {}; };

/* ---------- 1. what a line is worth ---------------------------------- */
{
  reset();
  const l = line('P1', 'Cement', 140, 31000);
  eq(l.qty, 140, 'the quantity on the shelf');
  eq(l.unitCost, 31000, 'and what one of them cost');
  eq(l.value, 140 * 31000, 'multiplied into what the line is worth — the figure the cards never showed');
  eq(l.uncosted, false, 'and it is costed');
}

/* ---------- 2. null, not zero ---------------------------------------- */
{
  reset();
  /* Stock on the shelf that nobody recorded a cost for. Valuing it at 0
     would say the shop owns nothing there; the balance sheet already
     calls this understated rather than worthless, and these two screens
     must not disagree. */
  const l = line('P4', 'Odd item', 50, null);
  eq(l.qty, 50, 'there are fifty of them');
  t.check(l.unitCost === null, 'with no cost on file');
  t.check(l.value === null, 'so the line cannot be valued, rather than being valued at nothing');
  eq(l.uncosted, true, 'and it is flagged as a gap');

  /* A line with nothing on the shelf also has no cost, and that is not a
     gap -- it is an empty shelf. Flagging it would bury the real gaps in
     noise from every product the shop has ever run out of. */
  reset();
  const empty = line('P2', 'Iron sheets', 0, null);
  eq(empty.qty, 0, 'nothing on the shelf');
  eq(empty.uncosted, false, 'is not a missing cost');
  t.check(empty.value === null, 'though it still cannot be valued');
}

/* ---------- 3. the shelf, totalled ----------------------------------- */
{
  reset();
  const lines = [
    line('P1', 'Cement', 140, 31000),      // 4,340,000
    line('P3', 'Wire', 8, 9000),           //    72,000
    line('P4', 'Odd item', 50, null),      // uncosted
    line('P2', 'Iron sheets', 0, null),    // empty
  ];
  const s = scope.inventoryLineStats(lines);
  eq(s.lines, 4, 'every listed line is counted');
  eq(s.value, 4340000 + 72000,
    'the shelf is worth what its COSTED lines come to — an uncosted line adds nothing rather than a guess');
  eq(s.zero, 1, 'one line has nothing left');
  eq(s.uncosted, 1, 'and one has stock but no cost, which is the one worth chasing');

  const none = scope.inventoryLineStats([]);
  eq(none.value, 0, 'an empty list is worth nothing');
  eq(none.lines, 0, 'with no lines');
}

/* ---------- 4. the three sorts --------------------------------------- */
{
  reset();
  const lines = [
    line('P1', 'Cement', 140, 31000),    // 4,340,000
    line('P3', 'Wire', 8, 9000),         //    72,000
    line('P2', 'Anvil', 22, 45000),      //   990,000
    line('P4', 'Odd item', 50, null),    // no value
  ];
  const names = (mode) => scope.sortInventoryLines(lines, mode).map((l) => l.p.name).join(' > ');

  eq(names('name'), 'Anvil > Cement > Odd item > Wire', 'by name, alphabetically');
  eq(names('value'), 'Cement > Anvil > Wire > Odd item',
    'most money tied up first — the list of what to count and watch');
  eq(names('low'), 'Wire > Anvil > Odd item > Cement',
    'least stock first, which is the list of what may be about to run out');

  /* An uncosted line has no value to rank by. It sorts LAST rather than
     as worthless, which is what treating its null as 0 would have
     claimed -- and it would have buried it among the cheap lines instead
     of leaving it visible at the end. */
  eq(scope.sortInventoryLines(lines, 'value').slice(-1)[0].p.name, 'Odd item',
    'a line that cannot be valued sorts last, not as though it were worth nothing');

  /* The case that separates "cannot be valued" from "worth zero": a
     product whose cost IS on file but which has nothing on the shelf is
     worth exactly 0, and that is a known fact. It must rank above the
     one whose worth is unknown -- treating the unknown as 0 would tie
     them and lose the distinction the whole null-not-zero rule exists
     for. Without this fixture the two are indistinguishable. */
  /* Named so the ALPHABETICAL fallback would put them the other way
     round. With names that happened to agree with the value order, a
     comparator treating null as 0 tied the two and the name tiebreak
     produced the right answer anyway -- the mutation survived. */
  reset();
  const edge = [
    line('PC', 'Zinc, costed but empty', 0, 31000),   // value 0, and known to be
    line('PD', 'Anvil, worth unknown', 50, null),     // value null
  ];
  eq(scope.sortInventoryLines(edge, 'value').map((l) => l.p.name).join(' > '),
    'Zinc, costed but empty > Anvil, worth unknown',
    'a line known to be worth nothing outranks one whose worth is unknown, against the alphabet');

  // Ties fall back to the name, or the order shuffles between renders.
  reset();
  const tied = [line('PB', 'Zinc', 5, 1000), line('PA', 'Anvil', 5, 1000)];
  eq(scope.sortInventoryLines(tied, 'low').map((l) => l.p.name).join(','), 'Anvil,Zinc',
    'two lines with the same stock fall back to the name');
  eq(scope.sortInventoryLines(tied, 'value').map((l) => l.p.name).join(','), 'Anvil,Zinc',
    'and so do two worth the same');
}

/* ---------- 5. the screen itself ------------------------------------- */
{
  /* THE CARDS ARE GONE, AND THIS ASSERTION IS THE REVERSE OF WHAT IT
     USED TO SAY. It read "Cards, kept. A list was tried and pulled back:
     the grid is how this screen is meant to read, and the figures that
     were missing did not need a new shape to be added."

     WHAT THAT MEANT, and why it was right at the time: the only
     complaint against the screen then was that it never multiplied
     quantity by cost. That is a missing figure, not a missing shape, and
     adding "Value here" as a third stat on a card fixed it without
     touching anything else. Reshaping a screen to add a number would
     have been the larger change made for the smaller reason.

     WHY IT STOPPED BEING TRUE: the complaint is now a different one.
     Four columns of cards mean no two figures ever line up, and a column
     of money that does not line up cannot be compared at a glance --
     which is the only way a stock list is ever read. At 192 lines the
     grid also ranked nothing, carried thirty-two unlabelled icon buttons
     and no accent at all, and stacked two crimson repair banners over
     every figure on the screen. None of that is a missing figure and
     none of it can be fixed by adding one.

     WHAT THE NEW ASSERTION MEANS: this screen is on the layer now, so it
     uses the layer's queue -- .ow-q rows that open in place and emit
     their own phone cards from the SAME call, which is what stops the
     desk and the phone drifting apart -- and it may not grow a private
     card grid again. Six columns rather than the layer's four, because
     this screen answers three questions per line. */
  t.check(!/class="inv-card"/.test(code) && !/class="inv-grid"/.test(code),
    'the private card grid is gone from the screen');
  /* THE SCREEN WAS DRAWN AGAIN FROM A CANVAS, and every assertion below
     this line that read the old queue, strip and bar was rewritten, not
     deleted. Each says what its predecessor meant, in the new shapes.

     "The desk row and the phone card are emitted from one call" meant
     there is one function whose output is both, so the two can never say
     different things. invRowHTML still returns both -- a table row and a
     card -- and the render takes both from the same call. */
  const rowFn = (/function invRowHTML\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const tr = `/.test(rowFn) && /const card = `/.test(rowFn) && /return \{ tr, card \};/.test(rowFn),
    'and the desk row and the phone card are emitted from one call, so they cannot say different things');
  const render = (/function renderInventory\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/invRowHTML\(m\.zByKey\.get\(invKeyOf\(l\)\), dk\)/.test(render)
       && /rows\.map\(r=> r\.tr\)/.test(render) && /rows\.map\(r=> r\.card\)/.test(render),
    'and the render reads both halves of that one call');
  const parts = (/function invLineParts\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/Value<\/th>/.test(render) && /const valueTxt = l\.value != null \? esc\(invFig\(l\.value\)\) : '—';/.test(parts),
    'the line value survived the reshape — it is a column, and a line that cannot be valued says so with a dash, never a nought');
  t.check(/\.ow-iv-num\{[^}]*IBM Plex Mono/.test(src) && /\.ow-iv-num\{[^}]*tabular-nums/.test(src),
    'and the figures are mono and tabular, so a column of money lines up — which is the whole reason for the reshape');
  t.check(/\.ow-iv-tb\{[^}]*table-layout:fixed/.test(src)
       && /\.ow-iv-w2\{width:100px;\}/.test(src) && /\.ow-iv-w5\{width:150px;\}/.test(src) && /\.ow-iv-w6\{width:28px;\}/.test(src),
    'the figure columns are fixed and only the name column flexes, so a name is cut before a figure ever is');

  /* THE TILES ARE THE WHOLE SHELF AND THE FOOTER IS WHAT IS LISTED. This
     used to be checked as `listN.textContent = lines.length` beside a
     `const all = inventoryLineStats(allLines)` strip, under the rule that
     two figures on one screen only contradict each other if both claim
     to be the same figure. That rule is unchanged: the tiles are built
     from the model of the WHOLE shelf and never move with a filter, and
     the footer under the table says "Showing a–b of N lines" for what is
     listed. Each says which of the two it is. */
  t.check(/const m = invModel\(\);/.test(render) && /strip\.innerHTML = invTilesHTML\(m\);/.test(render),
    'the tiles are counted over the WHOLE shelf, unfiltered');
  t.check(/Showing <b class="ow-iv-tf-b">\$\{from \+ 1\}&ndash;\$\{from \+ pageLines\.length\}<\/b> of <b class="ow-iv-tf-b">\$\{lines\.length\}<\/b>/.test(render),
    'while what is LISTED is counted after the filters have run, and said so under the list it describes');
  const model = (/function invModel\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/allProductVariantEntries\(\[\]\)\.map\(\(\{p, variantIdx\}\)=> inventoryLineFor\(p, variantIdx\)\)/.test(model),
    'and the whole shelf is read through the same line builder the balance sheet uses');
  const tiles = (/function invTilesHTML\([\s\S]*?\n\}/.exec(code) || [''])[0];
  /* "Sold, 30 days" became "30 days ago" when the shelf-value tile was made
     to match the canvas: the value a month back, next to the change since.
     It is derived (value now less the month's receipts and sales at cost),
     and the cell's tooltip says counts and write-offs are not in it. */
  t.check(/yours, at cost/.test(tiles) && /30 days ago/.test(tiles) && /close estimate/.test(tiles),
    'and the money tiles say what they are the money OF, and that the month-ago figure is an estimate');

  /* THE HEALTH BAR BECAME FOUR COUNTS, each a filter. What the bar's
     assertions meant: a state with no lines is not drawn (no nought on
     screen), and every line is counted in exactly one state so the parts
     can never add up to more than the shelf. Both still hold; the shape
     they hold in is four cells instead of one bar. */
  t.check(/n > 0 \? `<button type="button" class="ow-iv-hq-c/.test(tiles),
    'a state with no lines in it is not drawn, so the tile never shows a nought');
  t.check(/m\.lines\.forEach\(l=>\{ const k = invHealthOf\(l\); counts\[k\] = \(counts\[k\] \|\| 0\) \+ 1; \}\);/.test(tiles),
    'and every line on the WHOLE shelf is counted into exactly one state, so the four counts add up to the shelf');
  t.check(/No line has a restock floor yet/.test(tiles) && /\$\{withFloor \? '' :/.test(tiles),
    'the warning the zero-floors tile carried survives — a shelf with no floors is told nothing but pace can warn it');
  {
    const h = compileScope([extractFunction(src, 'invHealthOf', 'index.html')], {}, ['invHealthOf']).invHealthOf;
    eq(h({ belowFloor: true, uncosted: true, qty: 2 }), 'floor', 'under the floor wins over a missing cost — running out is what costs a sale');
    eq(h({ belowFloor: true, uncosted: false, qty: 0 }), 'floor', 'an empty shelf WITH a floor is under it, not merely empty');
    eq(h({ belowFloor: false, uncosted: true, qty: 5 }), 'nocost', 'stock nobody costed is its own state');
    eq(h({ belowFloor: false, uncosted: false, qty: 0 }), 'empty', 'nothing on the shelf and no floor is empty');
    eq(h({ belowFloor: false, uncosted: false, qty: 5 }), 'ok', 'and everything else is healthy');
  }
  /* The cell is the filter, and pressing a state must be able to list
     empty lines -- so while one is pressed, the empty shelves stay in
     rather than emptying the very list that was asked for. */
  t.check(/const emptyHeld = noState && !invShowEmpty \? lines\.filter\(l=> !\(l\.qty > 0\)\)\.length : 0;/.test(render)
       && /if\(invHealth\) return invHealthOf\(l\) === invHealth;/.test(render),
    'a pressed state is the filter, and hiding empty shelves gives way to it');

  // Every option offered is one the sort understands.
  const sorts = (/const INVENTORY_SORTS = \[([\s\S]*?)\];/.exec(code) || ['', ''])[1];
  const keys = [...sorts.matchAll(/key:'([a-z]+)'/g)].map((m) => m[1]);
  eq(keys.join(','), 'name,value,low', 'three sorts are offered');
  t.check(/INVENTORY_SORTS\.map/.test(code),
    'and the dropdown is built from that list rather than written out twice');
}

/* ---------- 5a. twenty to a page -------------------------------------- */
{
  /* A shelf of two hundred lines was two hundred rows. The answer to
     "what is on the shelf" is not something you scroll past: you search
     for a line, or you work down the ranking from the top, and both of
     those want a first page rather than a whole one. */
  const win = compileScope(
    [extractFunction(src, 'invPageWindow', 'index.html')], {}, ['invPageWindow']
  ).invPageWindow;

  eq(win(1, 1).join(','), '1', 'one page is one number');
  eq(win(3, 7).join(','), '1,2,3,4,5,6,7', 'seven or fewer are all drawn, with no gaps');

  /* Beyond that the row must not grow with the shelf: first, last, and
     where you are. A pager that draws three hundred numbers is the
     problem it was added to solve, wearing different clothes. */
  const far = win(10, 300);
  t.check(far.length <= 9, `a 300-page shelf still draws a short row (${far.length})`);
  t.check(far[0] === 1 && far[far.length - 1] === 300,
    'with the first and last page always reachable in one press');
  t.check(far.includes(9) && far.includes(10) && far.includes(11),
    'and the pages either side of where you are');

  /* The ends are where an off-by-one shows: at page 1 there is nothing
     to the left to elide, and a gap drawn there would be a lie about
     pages that do not exist. */
  eq(win(1, 20).filter((x) => x === 'gap').length, 1, 'at the start there is one gap, on the right only');
  eq(win(20, 20).filter((x) => x === 'gap').length, 1, 'and at the end, on the left only');
  t.check(win(1, 20)[0] === 1 && win(20, 20)[0] === 1, 'page one is never elided');

  [1, 2, 3, 8, 17, 18, 19, 20].forEach((n) => {
    const w = win(n, 20);
    t.check(w.includes(n), `page ${n} is always in its own window`);
    t.check(!w.some((x, i) => x === 'gap' && w[i + 1] === 'gap'), `and ${n} never draws two gaps running`);
    t.check(w[0] !== 'gap' && w[w.length - 1] !== 'gap', `nor a gap at either end (${n})`);
    const nums = w.filter((x) => x !== 'gap');
    t.check(nums.every((x, i) => i === 0 || x > nums[i - 1]), `and the numbers only ever count up (${n})`);
  });

  /* The three rules that make paging safe, read off the source. */
  const render = (/function renderInventory\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(invPage > pageCount\) invPage = pageCount;/.test(render),
    'the page is CLAMPED, because a filter can shrink the list under the page you are on');
  t.check(/const pageLines = lines\.slice\(from, from \+ invPageSize\);/.test(render)
       && /pageLines\.map\(l=> invRowHTML\(/.test(render),
    'only the page is drawn');
  /* This used to pin the header counting "the whole filtered list and its
     whole value -- money that moved as you paged would be the worst kind
     of wrong". The footer still counts the whole filtered list, and the
     tiles above are built from the whole shelf and never from the page;
     the list no longer carries a total of its own to move. */
  t.check(/of <b class="ow-iv-tf-b">\$\{lines\.length\}<\/b>/.test(render) && !/pageLines\.reduce/.test(render),
    'while the footer still counts the whole filtered list — and no money is summed over the page, which would move as you paged');

  /* Every control that changes WHAT is listed goes back to page one.
     Without it, narrowing 166 lines to 3 while on page 5 leaves an empty
     list that is not empty, which reads as the search having failed. */
  t.check(/function invRefilter\(\)\{ invPage = 1; renderInventory\(\); \}/.test(code),
    'there is one way back to the first page');
  t.check(/invTableSearchEl\.addEventListener\('input', invRefilter\)/.test(code), 'inv_table_search takes it');
  t.check(/getElementById\('inv_category_filter'\)\.addEventListener\('change', invRefilter\)/.test(code), 'inv_category_filter takes it');
  t.check(/data-invzone/.test(code) && /invRefilter\(\); return; \}/.test(code), 'and so does every press on the state segment');
  t.check(/sel\.addEventListener\('change', invRefilter\);/.test(code), 'and so does the sort');
}

/* ---------- 5b. what is wrong with a line ----------------------------- */
{
  /* THE REPAIR DRAWER IS RETIRED, and these assertions moved with what it
     held. It read: "the repair line exists", "and it is GONE when there is
     nothing in it, rather than showing zeros", "the drawer says why its
     sections are in the order they are", and three about the below-floor
     queue's rate and ordering.

     WHAT THEY MEANT: the two shelf repairs (the cost record that no
     longer matches the shelf, and stock nobody put a cost on) lived in
     one amber drawer above the list, and a drawer with nothing in it must
     not be drawn. The below-floor queue ranked lines by how soon each
     RUNS OUT at the rate it has actually sold, never by how far under it
     is, and never invented a day count for a line with no rate.

     WHY THEY STOPPED BEING TRUE: a repair is about ONE line, so it now
     stands inside that line's open panel, said only when that line has it,
     and the queue is the "Buy now" tile and the "Runs out" date on every
     row. A drawer above forty rows was the same fact said away from the
     row it belonged to.

     WHAT THE NEW ASSERTIONS MEAN: the warnings are drawn only for the
     line that has them (so there is never a zero to show), they still
     carry their one-press repair, the crimson banner is still gone from
     this screen, and the ranking still reads the shop's own thirty days
     and still refuses to guess. */
  const detail = (/function invDetailHTML\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const drift = stockLotDrift\(\)\.find\(r=> r\.key === key\);\s*\r?\n\s*if\(drift\)\{/.test(detail)
       && /const unc = uncostedStockRows\(\)\.find\(r=> r\.key === key && r\.qty > 0\);\s*\r?\n\s*if\(unc\)\{/.test(detail),
    'the repair warnings are drawn only for the line that has them, so there is never a zero to show');
  t.check(/data-lotfix=/.test(detail) && /data-lotcount=/.test(detail) && /data-costfix=/.test(detail),
    'and each carries its one-press repair, or sends you to count first when the shelf says empty');
  t.check(!/cb-chain-break/.test(detail) && !/cb-chain-break/.test(render5b()),
    'the crimson banners are gone from the inventory repairs');
  function render5b(){ return (/function renderInventory\(\)[\s\S]*?\n\}/.exec(code) || [''])[0]; }
  t.check(/Matching changes no count and no money/.test(detail) && /The shelf says empty, so count before you match/.test(detail),
    'and the order is still said in words: an empty shelf is counted before its cost record is matched, because matching can leave new units with no cost behind them');

  const zones = (/function invZoneRows\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/restockRiskRows\(\)/.test(zones) || /restockRiskRows\(/.test(zones),
    'the below-floor queue reads the shop’s own thirty days of sales for its rate');
  const buyRows = (/function invBuyRows\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(a\.daysLeft == null\) return b\.daysLeft == null \? 0 : 1;/.test(buyRows),
    'and a line with no rate sorts LAST rather than being given a guessed day count');
  t.check(/no sales to pace it/.test(code) && /below floor/.test(code),
    'saying so in words where the day count would have been');
}

/* ---------- searching without finishing the words -------------------- */
/*
 * Asked for: find things without typing them out in full. Substring
 * matching already handled a prefix ("cem" finds Cement), so what was
 * missing was the letters somebody actually leaves out under pressure --
 * "sndppr", "rdr", "slfdrl".
 *
 * TWO PASSES, STRICT FIRST, and the order is the whole design. A
 * subsequence match is generous enough to be useless on its own: it puts
 * half the catalogue behind every query and buries the exact hit. Run
 * only when the strict pass finds NOTHING, it costs precision nothing
 * and appears exactly when the alternative was "no products match".
 *
 * And it is anchored to a word start. Free-floating, "rdr" is a
 * subsequence of "t-r-uss hea-d sc-r-ews", so the first version of this
 * offered Truss Head Screws to somebody hunting RIDER.
 */
{
  const sub = compileScope(
    [extractFunction(src, 'matchesSubsequence', 'index.html')], {}, ['matchesSubsequence']
  ).matchesSubsequence;

  t.check(sub('rider self drilling screws', 'rdr'), 'dropped letters still find the product');
  t.check(sub('indasa rhynolite sandpaper rolls', 'sndppr'), 'and so do heavily dropped ones');
  t.check(sub('rider self drilling screws', 'slfdrl'), 'a word run together with the next one matches');
  t.check(sub('cement hima', 'cement'), 'and the whole word obviously does');

  /* The anchor, pinned by the case that broke it. */
  t.check(!sub('truss head screws', 'rdr'),
    'but letters picked out of the MIDDLE of three different words do not — that is not an abbreviation, it is a coincidence');
  t.check(sub('window rollers big', 'wrb'),
    'while letters taken from the START of each word are exactly what an abbreviation is');

  /* Too short to mean anything. "ae" is a subsequence of most of the
     catalogue, and a search that returns everything is worse than one
     that returns nothing. */
  t.check(!sub('cement hima', 'ce'), 'two letters is not a search');
  t.check(!sub('cement hima', 'c'), 'nor is one');

  /* EVERY letter has to land. Anchoring the first one and then giving up
     would match any word beginning with the right letter -- "cxyz" would
     find Cement. The short-token guard hides this: a two-letter probe
     never reaches the loop, so the case has to be long enough to anchor
     and still fail. */
  t.check(!sub('cement hima', 'cxyz'),
    'a word that starts right but continues wrong is not a match');
  t.check(!sub('rider self drilling screws', 'rdrz'),
    'and one trailing letter that is not there is enough to rule it out');

  // Order and wiring, read off the source: strict must be tried first
  // and the loose pass must only run on an empty result.
  const fn = (/function allProductVariantEntries\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const strict = collect\(\(hay\)=> matchesAllTokens\(hay, tokens\)\);/.test(fn),
    'the strict pass runs first');
  t.check(/if\(strict\.length \|\| !tokens\.length[\s\S]*?\) return strict;/.test(fn),
    'and wins outright whenever it found anything at all');
  t.check(/return collect\(\(hay\)=> tokens\.every\(tk=> matchesSubsequence\(hay, tk\)\)\);/.test(fn),
    'the loose pass is the fallback, and every word typed must still match');

  /* EMPTY SHELVES ARE HIDDEN UNTIL ASKED FOR, and the footer says how
     many are held back. This used to be a checkbox that started on, with
     the count taken BEFORE the filter ("what the search found is counted
     before the shelf filter takes a view") so that a search for
     something out of stock could say "N lines match -- they have nothing
     on the shelf" instead of "no products match", which is a lie: the
     product matched perfectly well.

     The checkbox became a link in the footer, so the order is now carried
     by one expression: the empties are COUNTED from the lines that
     survived the search, state and category, and only then removed. The
     empty state reports that count and offers them back. */
  const render = (/function renderInventory\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  const heldAt = render.indexOf('const emptyHeld = noState && !invShowEmpty');
  const cutAt = render.indexOf('if(noState && !invShowEmpty) lines = lines.filter(l=> l.qty > 0);');
  t.check(heldAt > -1 && cutAt > -1 && heldAt < cutAt,
    `what the search found is counted BEFORE the empty shelves are taken out (${heldAt} < ${cutAt})`);
  t.check(/let invShowEmpty = false;/.test(code),
    'the empty shelves start hidden, so the screen opens on what is actually there');
  t.check(/emptyHeld > 0/.test(render) && /nothing on the shelf/.test(render),
    'and an empty result names the filter that emptied it rather than denying the match');
  /* Through invRefilter rather than renderInventory: lifting the filter
     changes WHAT is listed, and every such change returns to the first
     page, or lifting it while on page 5 of a 1-page result shows an
     empty list that is not empty. */
  t.check(/data-invempty="show"/.test(render) && /invShowEmpty = empty\.dataset\.invempty === 'show'; invRefilter\(\); return;/.test(code),
    'with one press to lift it, and that press goes back to the first page');
}

process.exit(t.done() ? 1 : 0);
