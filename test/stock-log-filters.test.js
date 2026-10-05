#!/usr/bin/env node
'use strict';
/*
 * Tracking one item through the stock log (Inventory's Movements lens).
 *
 * The movements list was the last twenty entries, full stop. That is a
 * feed, not a record: answering "what has happened to this cement" meant
 * reading twenty lines about everything else and hoping.
 *
 * THE ONE THING THAT MATTERS HERE IS THE ORDER OF OPERATIONS. Taking the
 * most recent entries and THEN filtering them shows nothing for any item
 * that has not moved lately -- which is exactly the item somebody is
 * looking for when they go looking. Filter first, then cap, then say how
 * many were found so the cap is never mistaken for the answer.
 *
 * The rest:
 *
 *   built from the log   both dropdowns offer only categories and
 *                        movement types the log actually contains.
 *                        A filter that can only return nothing is a dead
 *                        end dressed as a choice.
 *   category on read     a log entry records the product, not its
 *                        category, so the category is looked up. An
 *                        entry whose product was deleted keeps its label
 *                        and matches no category.
 *
 * Run: node test/stock-log-filters.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('stock log filters');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const data = { stockLog: [], products: [] };

/* THE LOG'S QUERY WAS REWRITTEN WITH THE LENS, and so was this file.
   It pinned stockLogRowsFor (search + category + movement type, capped at
   fifty, with in/out/net totals in units). The lens was drawn again from a
   canvas (.design/inventory-v3): the dropdowns became a segment of KINDS
   with a count on each, a "When" window, and the totals became MONEY, not
   units, because a bag, a roll and a box do not add up. The query is one
   pure function now, invLogFilter, and the cap is "the newest week, then
   the next week on request" instead of fifty rows.

   What each section protected is kept and said again in the new shapes.
   Two things are gone on purpose and argued where they stood: the
   category dropdown (the canvas has none; a movement is found by its
   line, its note or its kind) and the unit totals (replaced by money
   tiles that read the bills and invoices, never the log rows shown). */
const scope = compileScope([
  extractFunction(src, 'invIsCount', 'index.html'),
  extractFunction(src, 'invMoveKind', 'index.html'),
  extractDeclaration(src, 'INV_KINDS', 'index.html'),
  extractFunction(src, 'invLogFilter', 'index.html'),
], {
  data,
  searchTokens: (s) => String(s || '').toLowerCase().split(/\s+/).filter(Boolean),
  matchesAllTokens: (hay, tokens) => tokens.every((tk) => hay.includes(tk)),
}, ['invLogFilter', 'invMoveKind', 'invIsCount']);

let nextId = 1;
const mv = (productId, label, over) => Object.assign({
  id: nextId++, key: productId, productId, variantIdx: null, label,
  type: 'restock', delta: 10, qtyAfter: 100, note: '', date: '2026-06-01', at: '2026-06-01T10:00:00.' + String(nextId).padStart(3, '0') + 'Z',
}, over);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => { nextId = 1; data.stockLog = []; };
const find = (q, kind, from) => scope.invLogFilter(data.stockLog, q || '', kind || '', from || '');

/* ---------- 1. the cap comes AFTER the filter ------------------------ */
{
  reset();
  /* Cement moved sixty times, all of it older than everything else. A
     cap-then-filter would show nothing for it -- the exact case somebody
     opens this screen to answer. The query returns every match; only the
     renderer cuts, by weeks, over what matched. */
  for (let i = 0; i < 60; i++) data.stockLog.push(mv('P1', 'Cement Hima', { date: '2026-06-01' }));
  for (let i = 0; i < 5; i++) data.stockLog.push(mv('P2', 'Iron sheets', { date: '2026-08-0' + (i + 1) }));
  eq(find().rows.length, 65, 'the query hands back every movement, not a page of them');
  eq(find('cement').rows.length, 60, 'searching for an item that has not moved lately still finds all sixty of its movements');
  t.check(find('cement').rows.every((e) => /Cement/.test(e.label)), 'and every row is that item');
  const render = (/function renderStockLog\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const \{ rows, counts \} = invLogRows\(\);/.test(render)
       && /const showing = rows\.filter\(e=> String\(e\.date \|\| ''\)\.slice\(0, 10\) >= cutIso\);/.test(render),
    'the weeks are cut in the renderer, over the rows that matched');
  t.check(/<b class="ow-iv-tf-b">\$\{showing\.length\}<\/b> of <b class="ow-iv-tf-b">\$\{rows\.length\}<\/b> shown/.test(render),
    'and the footer says how many of how many are shown, so the cut is never mistaken for the answer');
}

/* ---------- 2. what can be searched ---------------------------------- */
{
  reset();
  data.stockLog = [
    mv('P1', 'Cement Hima', { note: 'damaged in transit', type: 'damaged', delta: -4 }),
    mv('P2', 'Iron sheets 3m', { note: '' }),
    mv('P3', 'Wire', { note: 'counted at close', type: 'correction' }),
  ];
  eq(find('cement').rows.length, 1, 'by the item label');
  eq(find('3m').rows.length, 1, 'including the variant in it');
  eq(find('P3').rows.length, 1, 'by the product id');
  eq(find('damaged transit').rows.length, 1, 'and by the note — "damaged in transit" is how somebody finds that entry again');
  eq(find('written off').rows.length, 1, 'and by the kind, in the words the segment uses');
  eq(find('zzz').rows.length, 0, 'a miss finds nothing');
  eq(find('transit damaged').rows.length, 1, 'every typed word must appear, in any order');
  eq(find('cement wire').rows.length, 0, 'and all of them must match');
}

/* ---------- 3. no category dropdown ---------------------------------- */
{
  /* This section read "category, looked up on read": a log entry records
     the product, not its category, so the old filter looked it up, and an
     entry whose product was deleted matched no category rather than all
     of them. The canvas drops the category filter from this lens, so the
     lookup went with it. What survives of the principle: a movement whose
     product is gone still shows, under its own label, in the unfiltered
     log -- nothing here depends on the product still existing. */
  reset();
  data.products = [];
  data.stockLog = [mv('P1', 'Cement Hima'), mv('P2', 'Iron sheets')];
  eq(find().rows.length, 2, 'a movement whose product has been deleted is still in the log');
  eq(find('cement').rows.length, 1, 'and is still found by the label it kept');
  t.check(!/id="inv_log_category"|id="inv_log_type"/.test(code), 'and neither of the old dropdowns is on the screen');
}

/* ---------- 4. kinds, and filters combining -------------------------- */
{
  reset();
  data.stockLog = [
    mv('P1', 'Cement Hima', { type: 'restock', delta: 50 }),
    mv('P1', 'Cement Hima', { type: 'sale', delta: -20, note: 'Quote for Kato' }),
    mv('P2', 'Iron sheets', { type: 'sale', delta: -5 }),
    mv('P2', 'Iron sheets', { type: 'restock', delta: 25, note: 'Received on consignment from Haidery' }),
    mv('P2', 'Iron sheets', { type: 'correction', delta: -3, qtyAfter: 41 }),
    mv('P2', 'Iron sheets', { type: 'damaged', delta: -1 }),
    mv('P2', 'Iron sheets', { type: 'reversal', delta: 2 }),
  ];
  eq(scope.invMoveKind(data.stockLog[0]), 'recv', 'a restock is Received');
  eq(scope.invMoveKind(data.stockLog[1]), 'sold', 'a sale is Sold');
  eq(scope.invMoveKind(data.stockLog[3]), 'cons', 'a restock on consignment is its own kind, because the goods are not the shop’s');
  eq(scope.invMoveKind(data.stockLog[4]), 'count', 'a correction is Counted');
  eq(scope.invMoveKind(data.stockLog[5]), 'off', 'damaged or lost is Written off');
  eq(scope.invMoveKind(data.stockLog[6]), 'back', 'a reversal is Taken back, not Received');
  eq(find('', 'sold').rows.length, 2, 'two sales');
  eq(find('', 'recv').rows.length, 1, 'one receipt');
  eq(find('cement', 'sold').rows.length, 1, 'search and kind narrow together');
  eq(find('cement', 'off').rows.length, 0, 'a search and a kind that disagree find nothing rather than either one alone');
  /* The counts on the segment are taken with everything BUT the kind
     applied, so pressing one never makes the others lie. */
  const c = find('iron', 'sold').counts;
  eq(c.all, 5, 'the segment counts what the search left');
  eq(c.sold, 1, 'one of the kinds in it');
  eq(c.count, 1, 'and another, though Sold is the one pressed');
  // A kind with nothing in it is offered only where it would be a dead end otherwise.
  const render = (/function renderStockLog\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/key === 'back'\) return '';/.test(render) || /n === 0 && key === 'back'/.test(render),
    'and the rarest kind is not offered when nothing is in it');
}

/* ---------- 5. newest first, stably --------------------------------- */
{
  reset();
  data.stockLog = [
    mv('P1', 'A', { date: '2026-06-01' }), mv('P1', 'C', { date: '2026-08-01' }), mv('P1', 'B', { date: '2026-07-01' }),
  ];
  eq(find().rows.map((e) => e.label).join(''), 'CBA', 'newest date first');
  reset();
  data.stockLog = [
    mv('P1', 'first', { date: '2026-06-01', at: '2026-06-01T08:00:00Z' }),
    mv('P1', 'third', { date: '2026-06-01', at: '2026-06-01T15:00:00Z' }),
    mv('P1', 'second', { date: '2026-06-01', at: '2026-06-01T11:00:00Z' }),
  ];
  eq(find().rows.map((e) => e.label).join(','), 'third,second,first',
    'and within one day, the moment recorded decides, or two entries on one day appear in whatever order they were stored');
}

/* ---------- 6. the money comes from the bills, not the rows shown ----- */
{
  /* The units total (in, out, net over "everything that MATCHED, not the
     fifty rows that fit") is gone with the units: a bag, a roll and a box
     cannot be added, so the lens's tiles are money at cost, read off the
     supplier bills and the invoices -- records that persist -- and never
     summed over the rows that happen to be on screen. The principle the
     old section held is the same one: a figure beside a list must not be
     a figure about a different set than the list. */
  const flow = (/function invFlow\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/data\.purchaseInvoices/.test(flow) && /data\.savedQuotes/.test(flow) && !/stockLog\)\.reduce/.test(flow),
    'received and sold are read off the bills and invoices');
  const tiles = (/function invLogTilesHTML\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/invFlow\(30\)/.test(tiles) && /invWeekFlow\(5\)/.test(tiles) && !/invLogRows/.test(tiles),
    'and the tiles never read the filtered rows, so a search cannot move them');
  t.check(/Money at cost, so bags, rolls and boxes can sit in one figure/.test(tiles),
    'and the tile says why it is money');
}

/* ---------- 7. an empty result explains itself ------------------------ */
{
  const render = (/function renderStockLog\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/Nothing has moved that matches those filters/.test(render),
    'an empty result says nothing matched, not that the log is empty');
  t.check(/Nothing has moved yet\./.test(render),
    'and a log that really is empty says what to do about it');
}

/* ---------- 8. a day's trading does not bury the page ---------------- */
{
  /* "Fifty rows under a stock table" is gone with the stock table above
     it: Movements is its own lens. The cap is a week of the newest
     matching movements and one press shows the next, so the page still
     opens short and a long log is still never a long scroll. */
  const render = (/function renderStockLog\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/^let invLogWeeks = 1;$/m.test(code), 'one week is showing to begin with');
  t.check(/data-invweek="1">Show the next week/.test(render) && /const more = showing\.length < rows\.length;/.test(render),
    'a list that already fits gets no button, and the rest is one press away');
  t.check(/if\(e\.target\.closest\('\[data-invweek\]'\)\)\{ invLogWeeks\+\+; renderStockLog\(\); \}/.test(code),
    'which shows one more week and redraws');
  const wires = (/function wireMovements\(\)[\s\S]*?\n\}\)\(\);/.exec(code) || [''])[0];
  t.check((wires.match(/invLogWeeks = 1;/g) || []).length >= 3,
    'and every control that changes WHAT is listed puts it back to one week');
}

/* ---------- the lens ---------------------------------------------------
 *
 * Where this log lives: a LENS of the Inventory screen, one view at a
 * time. The engine did not move; what is drawn is.
 */
{
  const sec = (/<section id="tab-inventory"[\s\S]*?<\/section>/.exec(code) || [''])[0];

  t.check(!/id="tab-stock-movements"/.test(code), 'Movements is not a screen of its own any more');
  const alias = extractFunction(code, 'resolveTab', 'index.html');
  t.check(/if\(tab === 'stock-movements'\)\{ invLens = 'moves'; return 'inventory'; \}/.test(alias),
    'but the old door still opens it, on the lens it meant');

  t.check(/id="inv_onhand_pane"/.test(sec) && /id="inv_moves_pane"/.test(sec)
    && /id="invLogWrap"/.test(sec) && /id="inv_log_search"/.test(sec),
    'both views live on the shelf screen, and the log kept the ids its handlers bind to');

  /* ONE VIEW AT A TIME is the whole reason this is allowed to live here
     at all. */
  const lens = extractFunction(code, 'invApplyLens', 'index.html');
  t.check(/oh\.style\.display = on \? '' : 'none'/.test(lens) && /mv\.style\.display = on \? 'none' : ''/.test(lens),
    'and exactly one of them is ever on screen — the stack this screen was split up for cannot come back');
  t.check(/\.iv-act'\)\.forEach\(b=> b\.style\.display = on && data\.products\.length \? '' : 'none'\)/.test(lens),
    'the two acts belong to the shelf: nothing on the record acts, so it carries no accent');
  t.check(/Every change to the shelf, and what caused it\./.test(lens),
    'and the sub says which of the two questions is being answered');

  /* THE ID IS THIS SCREEN'S OWN. "inv" is Invoices AND Inventory in this
     file, and the first spelling of this bar collided with the Invoices
     register's, so the tabs did nothing, silently. */
  t.check((code.match(/\sid="iv_lens"/g) || []).length === 1,
    'the lens has an id of its own, not one another screen had already taken');
  t.check(/const invLensBar = document\.getElementById\('iv_lens'\);/.test(code) && /#iv_lens \.ow-seg-b/.test(code),
    'and the wiring and the paint both reach that one');

  const inv = extractFunction(code, 'renderInventory', 'index.html');
  t.check(/if\(invLens === 'moves'\) renderStockLog\(\);/.test(inv),
    'the log is drawn when its lens is open, not on every pass of the shelf');
}

process.exit(t.done() ? 1 : 0);
