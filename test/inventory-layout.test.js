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
  t.check(/class="ow-q-r" data-invopen=/.test(code) && /class="ow-q-card" data-invopen=/.test(code),
    'and the desk row and the phone card are emitted from one call, so they cannot say different things');
  /* THE REGISTER IS A TABLE NOW, the owner's canvas. These read "Value
     here" and fmtUGX(Math.round(l.value)) on the row, and pinned seven
     grid columns -- 18px 28px minmax(0,1fr) 128px 100px 100px 140px --
     with the figures at columns 5 to 7.

     WHAT THAT MEANT: the line's value is a column of its own, and every
     column but the name is fixed, so a name is cut before a figure is.

     WHY IT STOPPED BEING TRUE: the canvas the owner signed off draws
     the register as ten columns under one header -- on shelf, reorder
     at, cover, outlook, eight weeks of sales, value, GMROI, counted, and
     the one action -- because a row that answers "what do I do about
     this line" needs those side by side. The value is said in the
     column's own unit (the header says UGX), so the row carries invFig,
     the figure without the currency, rather than fmtUGX on every line.

     WHAT THE NEW CHECKS MEAN: the same two rules, on the new table --
     the value is still a column (with "no cost" where the books have
     none, never a nought), and only the product column flexes. */
  t.check(/Value \(UGX\)/.test(code) && /invFig\(l\.value\)/.test(code) && /no cost<\/span>/.test(code),
    'the line value survived the reshape — it is a column of its own, and a line with no cost says so');
  t.check(/\.iv-tbl \.iv-f\{[^}]*IBM Plex Mono/.test(src) && /\.iv-tbl \.iv-f\{[^}]*tabular-nums/.test(src),
    'and the figures are mono and tabular, so a column of money lines up');
  t.check(/36px minmax\(160px,1fr\) 88px 76px 64px 120px 112px 100px 60px 72px 112px/.test(src),
    'the figure columns are fixed and only the product column flexes, so a name is cut before a figure ever is');

  /* THE STRIP IS THE WHOLE SHELF, and this survives the canvas intact:
     what the shop HOLDS never moves when a filter does, and the panel
     header over the list says what is LISTED under it. */
  const render = (/function renderInventory\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const s = inventoryLineStats\(lines\);/.test(render),
    'what is LISTED is still counted after the filters have run');
  t.check(/listN\.textContent = lines\.length/.test(render),
    'and that total is shown on the list it describes, not above it');
  t.check(/const all = inventoryLineStats\(allLines\);/.test(render)
       && /allProductVariantEntries\(\[\]\)\.map\(\(\{p, variantIdx\}\)=> inventoryLineFor\(p, variantIdx\)\)/.test(render),
    'while the strip is counted over the WHOLE shelf, unfiltered');
  /* WAS: invBandHTML(zrAll, all, withFloor, uncostedUnits), with "at
     what you paid" and "of N on file" in the band. The band went with
     the canvas; its job -- saying which of the two figures is which --
     is the totals strip's now, four cells over the WHOLE shelf. */
  const totals = (/function invTotalsHTML\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/invTotalsHTML\(all\)/.test(render) && /of \$\{all\.lines\} on file/.test(totals) && /Value at cost/.test(totals),
    'and both figures say which of the two they are — the strip is handed the WHOLE shelf');

  /* THE BAR IS PILLS NOW, the fifth reversal on this strip. These pinned
     the band's segments: "const segs = INV_STATES.filter(h=> by[h.key].n
     > 0)", every line counted into one zone, and the no-floors warning
     under it.

     WHAT THAT MEANT: no state is drawn reading nought; every line on the
     shelf is in exactly one state; a shelf with no floors is told that
     nothing can warn it.

     WHY IT STOPPED BEING TRUE: the canvas puts the states where they
     are pressed -- a row of pills over the table, each with its count --
     and puts the state ON the row, as the outlook pill and the dot on
     the thumbnail. A bar of proportions above a table of the same lines
     was the same fact drawn twice.

     WHAT THE NEW CHECKS MEAN: the same three rules, on the pills. A pill
     with no lines is not drawn; each line's state is still read from
     the one zone row invZoneRows gives it over the WHOLE shelf; and the
     no-floors warning is said beside them. */
  const pills = (/function invRenderPills\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(h\.key && !n\) return '';/.test(pills),
    'a state with no lines in it is not drawn, so the pills never show a nought');
  t.check(/const zrAll = invZoneRows\(allLines\);/.test(render) && /invZoneByKey = new Map\(zrAll\.map\(z=> \[z\.key, z\]\)\);/.test(render)
       && /return z \? z\.zone :/.test(code),
    'and every line on the WHOLE shelf is in exactly one state, read from its own zone row');
  t.check(/No line has a restock floor yet/.test(pills) && /withFloor \? '' :/.test(pills),
    'the warning the zero-floors tile carried survives — a shelf with no floors is told nothing can warn it');
  {
    const states = (/const INV_STATES = \[([\s\S]*?)\];/.exec(code) || ['', ''])[1];
    eq([...states.matchAll(/key:'([a-z]+)'/g)].map((m) => m[1]).join(','), 'buy,ok,dead,nocost,empty',
      'five states, the same five invZoneRows assigns');
    t.check(!/INV_HEALTH|invHealthOf|invHealth\b/.test(code),
      'and the second vocabulary is gone — no line can be healthy in one view and Buy now in the other');
  }
  /* WAS: lines.filter(l=> invStateOf(l) === invZone). The pill can also
     be one of the two that cut across the states -- consigned, A-class --
     or a portfolio cell pressed on the Intelligence page, so the match
     is one function now; for a state it is still invStateOf. */
  t.check(/checked && !invZone;/.test(render) && /if\(invZone\) lines = lines\.filter\(l=> invPillMatch\(l, invZone\)\);/.test(render)
       && /return invStateOf\(l\) === k;/.test(code),
    'a pressed state is the filter, and hide-no-stock gives way to it');

  /* WAS 'name,value,low'. The canvas's register sorts by when a line
     runs out and by how long since it was counted as well -- the two
     orders the Intelligence page ranks by -- so the shop can work down
     either from the register itself. The rule pinned is unchanged:
     every option offered is one the sort understands. */
  const sorts = (/const INVENTORY_SORTS = \[([\s\S]*?)\];/.exec(code) || ['', ''])[1];
  const keys = [...sorts.matchAll(/key:'([a-z]+)'/g)].map((m) => m[1]);
  eq(keys.join(','), 'name,value,low,runout,counted', 'five sorts are offered');
  const sortFn = (/function sortInventoryLines\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(keys.every((k) => k === 'name' || new RegExp(`mode === '${k}'`).test(sortFn)),
    'and the sort understands every one of them');
  t.check(/INVENTORY_SORTS\.map/.test(code),
    'and the dropdown is built from that list rather than written out twice');
}

/* ---------- 5a. a page at a time (ten by default, 25 or 50 by choice) - */
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
  t.check(/const pageLines = lines\.slice\(from, from \+ INVENTORY_PAGE\);/.test(render)
       && /pageLines\.map\(invLineHTML\)/.test(render),
    'only the page is drawn');
  t.check(/listN\.textContent = lines\.length[\s\S]{0,120}fmtUGX\(Math\.round\(s\.value\)\)/.test(render),
    'while the header still counts the whole filtered list and its whole value — money that moved as you paged would be the worst kind of wrong');

  /* Every control that changes WHAT is listed goes back to page one.
     Without it, narrowing 166 lines to 3 while on page 5 leaves an empty
     list that is not empty, which reads as the search having failed. */
  t.check(/function invRefilter\(\)\{ invPage = 1; renderInventory\(\); \}/.test(code),
    'there is one way back to the first page');
  ['inv_table_search', 'inv_category_filter', 'inv_hide_zero'].forEach((id) => {
    t.check(new RegExp(`${id}[\\s\\S]{0,80}?addEventListener\\('(?:input|change)', invRefilter\\)`).test(code),
      `${id} takes it`);
  });
  t.check(/sel\.addEventListener\('change', invRefilter\);/.test(code), 'and so does the sort');
}

/* ---------- 5b. the repair drawer ------------------------------------ */
{
  /* Two crimson banners, about 470px of them, stood over every figure on
     this screen on an ordinary Tuesday. Crimson is the app's colour for
     the genuinely bad and none of this is bad -- it is admin. They are
     one amber line now, and when there is nothing in it there is no
     line at all rather than a line reading zero. */
  const fix = (/function renderInvFix\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(fix.length > 0, 'the repair line exists');
  t.check(/if\(!kinds\)\{ line\.innerHTML = ''; body\.hidden = true;/.test(fix),
    'and it is GONE when there is nothing in it, rather than showing zeros');
  /* Retired from THIS SCREEN, not from the file: the cash book's broken
     chain and the Manager's missing-notes warning are both genuinely
     bad and still wear it properly. Only the two inventory repairs may
     not emit it again. */
  const repairs = code.slice(code.indexOf('function renderStockLotDrift'),
                             code.indexOf('function renderInventory('));
  t.check(!/cb-chain-break/.test(repairs),
    'the crimson banners are gone from the two inventory repairs');
  /* The ORDER of the drawer is a rule, not a ranking, and it is said out
     loud: matching a cost record to the shelf can leave new units with
     no cost behind it, so matching comes before pricing. The old screen
     depended on the shop doing them in that order and never said so. */
  t.check(/matching a cost record to the shelf can leave new units/.test(fix),
    'the drawer says why its sections are in the order they are');

  /* The third repair is new. Seven lines under their floor were a red
     pill on seven cards scattered through 192; they are a queue now,
     ranked by how soon each RUNS OUT at the rate it has actually sold --
     not by how far under it is, because two short of a line that sells
     twice a year is not a problem and four days of paint is. */
  const floors = (/function invFloorRows\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/restockRiskRows\(\)\.forEach\(r=> rate\.set\(r\.key, r\)\)/.test(floors),
    'the below-floor queue reads the shop’s own thirty days of sales for its rate');
  t.check(/if\(a\.daysLeft == null\) return b\.daysLeft == null \? 0 : 1;/.test(floors),
    'and a line with no rate sorts LAST rather than being given a guessed day count');
  t.check(/nothing sold in 30 days/.test(code),
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

  /* Hide no stock is on by default -- and that turns a search for
     something out of stock into an empty screen. Saying "no matching
     products" there is a lie: the product matched perfectly well. */
  t.check(/id="inv_hide_zero" checked/.test(code),
    'the shelf filter starts on, so the screen opens on what is actually there');
  /* Checked as an ORDER, not as two lines that exist. Both survive being
     swapped, and swapped they make hiddenByZero permanently zero -- the
     count is taken from the already-filtered list, so the screen goes
     back to claiming nothing matched. */
  const render = (/function renderInventory\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  const countedAt = render.indexOf('const foundBeforeHideZero = entries.length;');
  const filteredAt = render.indexOf('if(hideZero) entries = entries.filter(');
  t.check(countedAt > -1 && filteredAt > -1 && countedAt < filteredAt,
    `what the search found is counted BEFORE the shelf filter takes a view (${countedAt} < ${filteredAt})`);
  t.check(/const hiddenByZero = foundBeforeHideZero - entries\.length;/.test(render),
    'and the difference is what the empty state reports');
  t.check(/hiddenByZero > 0/.test(code) && /nothing on the shelf/.test(code),
    'and an empty result names the filter that emptied it rather than denying the match');
  /* Through invRefilter rather than renderInventory: lifting the shelf
     filter changes WHAT is listed, and every such change returns to the
     first page. Without that, lifting it while on page 5 of a 1-page
     result shows an empty list that is not empty -- which reads as the
     press having done nothing. */
  t.check(/id="inv_show_zero"/.test(code) && /checked = false;\s*\r?\n\s*invRefilter\(\);/.test(code),
    'with one press to lift it, and that press goes back to the first page');
}

process.exit(t.done() ? 1 : 0);
