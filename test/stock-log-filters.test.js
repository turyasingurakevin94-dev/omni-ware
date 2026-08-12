#!/usr/bin/env node
'use strict';
/*
 * Tracking one item through the stock log.
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

const scope = compileScope([
  extractDeclaration(src, 'STOCK_TYPE_LABELS', 'index.html'),
  extractDeclaration(src, 'STOCK_LOG_LIMIT', 'index.html'),
  extractFunction(src, 'stockLogCategoryOf', 'index.html'),
  extractFunction(src, 'stockLogRowsFor', 'index.html'),
  extractFunction(src, 'stockLogTotals', 'index.html'),
], {
  data,
  searchTokens: (s) => String(s || '').toLowerCase().split(/\s+/).filter(Boolean),
  matchesAllTokens: (hay, tokens) => tokens.every((tk) => hay.includes(tk)),
}, ['stockLogRowsFor', 'stockLogTotals', 'stockLogCategoryOf']);

let nextId = 1;
const mv = (productId, label, over) => Object.assign({
  id: nextId++, key: productId, productId, variantIdx: null, label,
  type: 'restock', delta: 10, qtyAfter: 100, note: '', date: '2026-06-01', at: 1000 + nextId,
}, over);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => {
  nextId = 1;
  data.products = [
    { id: 'P1', name: 'Cement', category: 'Cement' },
    { id: 'P2', name: 'Iron sheets', category: 'Roofing' },
    { id: 'P3', name: 'Wire', category: 'Steel' },
  ];
  data.stockLog = [];
};

/* ---------- 1. the cap comes AFTER the filter ------------------------ */
{
  reset();
  /* Cement moved sixty times, all of it older than everything else.
     Under a cap-then-filter it falls outside every recent window and the
     search for it returns nothing -- the exact case somebody opens this
     screen to answer. */
  for (let i = 0; i < 60; i++) {
    data.stockLog.push(mv('P1', 'Cement Hima', { date: '2026-06-01', at: 1000 + i }));
  }
  for (let i = 0; i < 5; i++) {
    data.stockLog.push(mv('P2', 'Iron sheets', { date: '2026-08-0' + (i + 1), at: 9000 + i }));
  }

  const all = scope.stockLogRowsFor('', '', '');
  eq(all.total, 65, 'the total counts every movement, not just the page shown');
  eq(all.rows.length, scope.STOCK_LOG_LIMIT === undefined ? 50 : 50,
    'and the page itself is capped');
  t.check(all.rows.every((e) => e.productId === 'P2' || e.productId === 'P1'), 'from the whole log');

  const cement = scope.stockLogRowsFor('cement', '', '');
  eq(cement.total, 60,
    'searching for an item that has not moved lately still finds all sixty of its movements');
  eq(cement.rows.length, 50, 'capped at fifty of them');
  t.check(cement.rows.every((e) => /Cement/.test(e.label)), 'and every row shown is that item');
}

/* ---------- 2. what can be searched ---------------------------------- */
{
  reset();
  data.stockLog = [
    mv('P1', 'Cement Hima', { note: 'damaged in transit', type: 'damaged', delta: -4 }),
    mv('P2', 'Iron sheets 3m', { note: '' }),
    mv('P3', 'Wire', { note: 'counted at close' }),
  ];
  eq(scope.stockLogRowsFor('cement', '', '').total, 1, 'by the item label');
  eq(scope.stockLogRowsFor('3m', '', '').total, 1, 'including the variant in it');
  eq(scope.stockLogRowsFor('P3', '', '').total, 1, 'by the product id');
  eq(scope.stockLogRowsFor('damaged transit', '', '').total, 1,
    'and by the note — "damaged in transit" is how somebody finds that entry again');
  eq(scope.stockLogRowsFor('zzz', '', '').total, 0, 'a miss finds nothing');

  // Every typed word must appear, in any order.
  eq(scope.stockLogRowsFor('transit damaged', '', '').total, 1, 'in any order');
  eq(scope.stockLogRowsFor('cement wire', '', '').total, 0, 'and all of them must match');
}

/* ---------- 3. category, looked up on read --------------------------- */
{
  reset();
  data.stockLog = [
    mv('P1', 'Cement Hima'), mv('P2', 'Iron sheets'), mv('P3', 'Wire'), mv('P3', 'Wire'),
  ];
  eq(scope.stockLogRowsFor('', 'Steel', '').total, 2, 'two movements in Steel');
  eq(scope.stockLogRowsFor('', 'Cement', '').total, 1, 'one in Cement');
  eq(scope.stockLogRowsFor('', 'Nowhere', '').total, 0, 'and none in a category nothing is in');

  /* A log entry keeps its own label, so a movement survives its product
     being deleted. It then belongs to no category -- which must not mean
     it belongs to ALL of them. */
  data.products = [];
  eq(scope.stockLogCategoryOf(data.stockLog[0]), '',
    'a movement whose product is gone has no category');
  eq(scope.stockLogRowsFor('', 'Cement', '').total, 0, 'so no category filter claims it');
  eq(scope.stockLogRowsFor('', '', '').total, 4, 'though it is still in the unfiltered log');
}

/* ---------- 4. movement type, and filters combining ------------------ */
{
  reset();
  data.stockLog = [
    mv('P1', 'Cement Hima', { type: 'restock', delta: 50 }),
    mv('P1', 'Cement Hima', { type: 'sale', delta: -20 }),
    mv('P2', 'Iron sheets', { type: 'sale', delta: -5 }),
  ];
  eq(scope.stockLogRowsFor('', '', 'sale').total, 2, 'two sales');
  eq(scope.stockLogRowsFor('', '', 'restock').total, 1, 'one restock');

  // Filters combine rather than compete.
  eq(scope.stockLogRowsFor('', 'Cement', 'sale').total, 1,
    'category and movement narrow together');
  eq(scope.stockLogRowsFor('cement', '', 'restock').total, 1, 'and so do search and movement');
  eq(scope.stockLogRowsFor('cement', 'Roofing', '').total, 0,
    'a search and a category that disagree find nothing rather than either one alone');
}

/* ---------- 5. newest first, stably --------------------------------- */
{
  reset();
  data.stockLog = [
    mv('P1', 'A', { date: '2026-06-01', at: 100 }),
    mv('P1', 'C', { date: '2026-08-01', at: 300 }),
    mv('P1', 'B', { date: '2026-07-01', at: 200 }),
  ];
  eq(scope.stockLogRowsFor('', '', '').rows.map((e) => e.label).join(''), 'CBA',
    'newest date first');

  // Several movements share a date; `at` is what orders them within it,
  // or two entries on one day appear in whatever order they were stored.
  reset();
  data.stockLog = [
    mv('P1', 'first', { date: '2026-06-01', at: 100 }),
    mv('P1', 'third', { date: '2026-06-01', at: 300 }),
    mv('P1', 'second', { date: '2026-06-01', at: 200 }),
  ];
  eq(scope.stockLogRowsFor('', '', '').rows.map((e) => e.label).join(','), 'third,second,first',
    'and within one day, the moment recorded decides');
}

/* ---------- 6. the net effect of what is shown ----------------------- */
{
  const totals = scope.stockLogTotals([
    { delta: 50 }, { delta: -20 }, { delta: 10 }, { delta: -5 },
  ]);
  eq(totals.inQty, 60, 'what came in');
  eq(totals.outQty, 25, 'what went out, as a positive figure');
  eq(totals.net, 35, 'and the net of the two');

  const nothingOut = scope.stockLogTotals([{ delta: 10 }]);
  eq(nothingOut.outQty, 0, 'nothing out is zero');
  // "-0" reads as a figure somebody worked out rather than the absence of
  // one. The statements stopped printing "-0 UGX" for the same reason.
  t.check(/\$\{t\.outQty \? '-' : ''\}/.test(code),
    'and prints as a plain 0, never "-0"');

  eq(scope.stockLogTotals([]).net, 0, 'an empty selection nets to nothing');

  /* The totals are taken over everything that MATCHED, not over the
     fifty rows that fit on screen. Sitting beside "showing the 50 most
     recent of 60", a net figure for a different set is worse than none
     -- and filtering to one product could report more stock in than the
     unfiltered log, which is what it did before this was caught. */
  const many = [];
  for (let i = 0; i < 60; i++) many.push(mv('P1', 'Cement', { delta: 10, date: '2026-06-01', at: i }));
  data.stockLog = many;
  const res = scope.stockLogRowsFor('', '', '');
  eq(res.total, 60, 'sixty matched');
  eq(res.rows.length, 50, 'fifty are shown');
  eq(res.all.length, 60, 'and all sixty are handed back for the totals');
  eq(scope.stockLogTotals(res.all).inQty, 600,
    'so the figure covers every movement found, not the page');
  t.check(scope.stockLogTotals(res.rows).inQty === 500,
    'where the page alone would have said 500 — the number that made a filtered log outrank the whole one');

  // The renderer is DOM, so which of the two it passes is pinned on the
  // source. Returning `all` is no use if the count line still totals the
  // page.
  t.check(/const t = stockLogTotals\(all\);/.test(code),
    'and the count line totals the match rather than the page');
}

/* ---------- 7. the controls offer only what exists ------------------- */
{
  const fn = (/function populateStockLogFilters[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/log\.map\(stockLogCategoryOf\)\.filter\(Boolean\)/.test(fn),
    'the categories come from the log, not from every category the shop has');
  t.check(/log\.map\(e=> e\.type\)\.filter\(Boolean\)/.test(fn),
    'and so do the movement types');
  t.check(/if\(selectedCat && !cats\.includes\(selectedCat\)\)/.test(fn),
    'a selection that no longer matches is kept, so the empty result explains itself rather than the filter appearing to be ignored');

  t.check(/Nothing has moved that matches those filters/.test(code),
    'and an empty result says the item has not moved, not that the log is empty');
  t.check(/Showing the \$\{entries\.length\} most recent of \$\{total\}/.test(code),
    'the cap is stated, so it is never mistaken for the whole answer');
}

/* ---------- 8. a day's trading does not bury the page ---------------- */
/*
 * The fifty-row cap stops the log being unbounded. It does not stop it
 * being long, and it sits underneath the stock table that is the reason
 * anyone opened this screen -- so an ordinary day of movements pushes the
 * thing you came to read off the top. Reported as "the list is becoming so
 * prolonged, it will soon affect the view", and measured in the running
 * app at 3707px of panel for 24 movements.
 *
 * So a page inside the cap, with everything else one press away.
 */
{
  const page = Number((/const STOCK_LOG_PAGE = (\d+);/.exec(code) || [])[1]);
  t.check(page > 0 && page < 50,
    `a page smaller than the cap exists (STOCK_LOG_PAGE = ${page})`);

  // The page is applied in the RENDERER, over the capped rows -- not
  // inside stockLogRowsFor. Pushing it down into the query would make
  // `total` and the in/out/net figures describe ten movements instead of
  // every one that matched, which is the bug section 6 exists to prevent.
  const render = (/function renderStockLog\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/rows: capped/.test(render) && /capped\.slice\(0, STOCK_LOG_PAGE\)/.test(render),
    'the page is taken from the capped rows in the renderer');
  t.check(/const entries = stockLogShowAll \? capped : capped\.slice\(0, STOCK_LOG_PAGE\);/.test(render),
    'and expanding shows the capped set rather than re-querying');
  t.check(!/STOCK_LOG_PAGE/.test((/function stockLogRowsFor[\s\S]*?\n\}/.exec(code) || [''])[0]),
    'the query itself knows nothing about the page, so total and the totals still cover every match');

  // Section 6 proved the count line totals `all`. That must still hold now
  // that a second, smaller slice exists to accidentally total instead.
  t.check(/const t = stockLogTotals\(all\);/.test(render),
    'the in/out/net figures still cover everything that matched, not the ten on screen');

  // The control, and what it promises.
  const btn = (/function stockLogMoreButtonHTML[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(btn.length > 0, 'the expand control is its own function');
  t.check(/if\(available <= STOCK_LOG_PAGE\) return '';/.test(btn),
    'a list that already fits gets no button at all');
  t.check(/total > available/.test(btn) && /Show the \$\{available\} most recent/.test(btn),
    'and when more matched than the cap can reach, it offers what it can rather than promising all of them');
  t.check(/'Show fewer'/.test(btn), 'expanded, it offers the way back');
  t.check(/aria-expanded="\$\{stockLogShowAll \? 'true' : 'false'\}"/.test(btn),
    'and says which state it is in for anything not reading the label');

  /* Everything above describes a function. None of it proves the renderer
     calls it, or that pressing the result does anything -- the same gap
     that let a conversion line pass every check while nothing listened to
     the field it converted. So: rendered, wired, and acted on. */
  t.check(/\$\{stockLogMoreButtonHTML\(capped\.length, total\)\}/.test(render),
    'the renderer puts the control on the page, told what it can reach and what really matched');
  const handler = (/moreBtn\.addEventListener\('click',[\s\S]*?\n  \}\);/.exec(render) || [''])[0];
  t.check(handler.length > 0, 'and the button is wired to something');
  t.check(/stockLogShowAll = !stockLogShowAll;/.test(handler),
    'which flips the state rather than pinning it open');
  t.check(/stockLogShowAll = !stockLogShowAll;\s*\r?\n\s*renderStockLog\(\);/.test(handler),
    'and redraws, so the press has a visible effect');

  // Sticky, or the minute poll would collapse the list while it is read.
  t.check(/^let stockLogShowAll = false;$/m.test(code),
    'the expanded state is module-level, so a re-render does not fold it back up');
  t.check(!/stockLogShowAll = false;[\s\S]{0,200}renderStockLog\(\)/.test(render),
    'and nothing resets it on the way into a render');
}

process.exit(t.done() ? 1 : 0);
