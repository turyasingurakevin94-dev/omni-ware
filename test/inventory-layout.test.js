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
  /* Cards, kept. A list was tried and pulled back: the grid is how this
     screen is meant to read, and the figures that were missing did not
     need a new shape to be added -- "Value here" is one more stat beside
     In stock and Cost/unit. */
  t.check(/class="inv-card"/.test(code) && /class="inv-grid"/.test(code),
    'the cards are the layout');
  t.check(!/class="inv-row"/.test(code), 'and the row list is gone');
  t.check(/Value here/.test(code) && /fmtUGX\(Math\.round\(l\.value\)\)/.test(code),
    'with the line value on the card, which is what was actually missing');
  t.check(/\.inv-qty-wrap\{font-variant-numeric:tabular-nums;\}/.test(src),
    'and the figures set in tabular numerals so they align card to card');

  // Counted over the filtered lines, so the strip cannot contradict the
  // rows under it.
  const render = (/function renderInventory[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const s = inventoryLineStats\(lines\);/.test(render),
    'the summary counts what is listed, after the filters have run');
  t.check(/strip\.innerHTML = lines\.length \?/.test(render),
    'and shows nothing when nothing matched');

  // Every option offered is one the sort understands.
  const sorts = (/const INVENTORY_SORTS = \[([\s\S]*?)\];/.exec(code) || ['', ''])[1];
  const keys = [...sorts.matchAll(/key:'([a-z]+)'/g)].map((m) => m[1]);
  eq(keys.join(','), 'name,value,low', 'three sorts are offered');
  t.check(/INVENTORY_SORTS\.map/.test(code),
    'and the dropdown is built from that list rather than written out twice');
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
  t.check(/id="inv_show_zero"/.test(code) && /checked = false;\s*\r?\n\s*renderInventory\(\);/.test(code),
    'with one press to lift it');
}

process.exit(t.done() ? 1 : 0);
