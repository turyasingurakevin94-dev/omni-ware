#!/usr/bin/env node
'use strict';
/*
 * Looking inside an order on the board.
 *
 * The card said "7" behind an items icon. Seven of WHAT is the question
 * anybody actually has about an order moving through the steps -- what
 * the picker is being sent for, what the driver is carrying, whether the
 * shop already holds it, and what has to be bought before it can go.
 *
 * One line per item, carrying everything true about it at this moment.
 *
 * The distinctions that matter, each pinned below:
 *
 *   null vs 0 picked   nobody has picked this line yet is a different
 *                      fact from the shelf was empty. Showing one for
 *                      the other either invents a shortfall or hides one.
 *   priced vs not      a line with no supplier price is reported as a
 *                      gap, never costed at zero -- a cash-to-buy figure
 *                      that quietly omits a line is worse than one that
 *                      says it is incomplete.
 *   stock vs bought    what is on the shelf costs nothing to fulfil
 *                      today; what is not has to be paid for first.
 *
 * Run: node test/order-preview.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order preview');
const src = read('index.html');
const worker = read('shared-worker.js');
const data = { savedQuotes: [], suppliers: [{ id: 'S1', name: 'Katwe Steel' }] };

const scope = compileScope([
  extractDeclaration(src, 'SQ_STATUSES', 'index.html'),
  extractDeclaration(src, 'SQ_STATUS_ORDER', 'index.html'),
  extractDeclaration(src, 'ORDER_STATUS_SHORT_LABELS', 'index.html'),
  extractFunction(read('shared-worker.js'), 'orderLineIsBoughtIn', 'shared-worker.js'),
  extractDeclaration(worker, 'PICK_ANSWERED', 'shared-worker.js'),
  extractFunction(worker, 'itemPickAnswered', 'shared-worker.js'),
  extractFunction(worker, 'itemOrderedQty', 'shared-worker.js'),
  extractFunction(worker, 'itemPickedQty', 'shared-worker.js'),
  /* The row now says whose the goods are as well as where they are, so
     the reading behind that comes with it. */
  extractFunction(src, 'stockKey', 'index.html'),
  extractFunction(src, 'peekStockLots', 'index.html'),
  extractFunction(src, 'consignTally', 'index.html'),
  extractFunction(src, 'consignedForLine', 'index.html'),
  extractFunction(src, 'consignTagLabel', 'index.html'),
  extractFunction(src, 'consignTagTitle', 'index.html'),
  extractFunction(src, 'consignTagHTML', 'index.html'),
  extractFunction(src, 'orderPreviewLines', 'index.html'),
  extractFunction(src, 'orderPreviewSummary', 'index.html'),
  /* The rail itself is shared with the sourcing funnel -- one stepper,
     two pipelines -- so orderPreviewStepsHTML is now the thin call that
     hands it this pipeline's constants. The assertions below are on the
     OUTPUT and are unchanged by that; only the collaborator had to join
     the scope. */
  extractFunction(src, 'stageStepsHTML', 'index.html'),
  extractFunction(src, 'orderPreviewStepsHTML', 'index.html'),
  extractFunction(src, 'buildPackingChitHTML', 'index.html'),
  /* The chit says the count in the unit the line was chosen in, through
     the same reader every document uses. Compiled in, not stubbed. */
  extractFunction(src, 'quoteLinePack', 'index.html'),
  extractFunction(src, 'quoteLineCountPer', 'index.html'),
  extractFunction(src, 'quoteLineCount', 'index.html'),
], {
  data,
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || 'Unknown supplier',
  esc: (s) => String(s == null ? '' : s),
  savedAgoLabel: () => '2h ago',
  shopIdentity: () => ({ name: 'Telagon Hardware' }),
  quoteClientName: (q) => (q.client && q.client.name) || 'Unnamed',
  staffName: (id) => (id === 'W1' ? 'Kevin Moses' : id),
  orderCustomerLocation: (q) => q._where || '',
  fmtShortDate: (d) => d,
  todayISO: () => '2026-08-15',
}, ['orderPreviewLines', 'orderPreviewSummary', 'orderPreviewStepsHTML', 'buildPackingChitHTML']);

const stockLine = (over) => Object.assign({
  productName: 'Iron sheets', qty: 10, unit: 'pcs', supplierId: '__stock__', sellPrice: 45000, price: 0,
}, over);
const buyLine = (over) => Object.assign({
  productName: 'Cement', qty: 40, unit: 'bags', supplierId: 'S1', sellPrice: 38000, price: 31000,
}, over);
const order = (items, over) => Object.assign({
  id: 1, status: 'preparing', client: { name: 'Okello' }, items, savedAt: '2026-08-01', stageEnteredAt: 1,
}, over);
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. what is actually on it -------------------------------- */
{
  const s = scope.orderPreviewSummary(order([stockLine(), buyLine()]));
  eq(s.lines.length, 2, 'a line each, not a count');
  eq(s.lines[0].name, 'Iron sheets', 'named, which is the entire point of the screen');
  eq(s.lines[0].qty, 10, 'with what was ordered');
  eq(s.lines[0].unit, 'pcs', 'and the unit it was ordered in');
  eq(s.lines[0].lineTotal, 450000, 'costed at what the client pays, not what it cost us');
  eq(s.total, 450000 + 1520000, 'and the total is the lines added up');

  eq(s.lines[0].fromStock, true, 'a stock line is already on the shelf');
  eq(s.lines[0].source, 'From stock', 'and says so rather than naming a supplier');
  eq(s.lines[0].buyCost, null, 'nothing has to be bought for it');
  eq(s.lines[1].fromStock, false, 'a supplier line is not on the shelf');
  eq(s.lines[1].source, 'Katwe Steel', 'and names who it is coming from');
  eq(s.lines[1].buyCost, 40 * 31000, 'with what it will cost to buy');

  eq(s.fromStock, 1, 'one line off the shelf');
  eq(s.toBuy, 1, 'one to buy');
  eq(s.buyTotal, 1240000, 'and the cash needed is only for what is not held');
}

/* ---------- 2. a line with no price is a gap, not a zero ------------- */
{
  const s = scope.orderPreviewSummary(order([buyLine(), buyLine({ productName: 'Nails', price: 0 })]));
  eq(s.unpriced, 1, 'a bought-in line with no purchase price is counted as unpriced');
  eq(s.lines[1].unpriced, true, 'and flagged on the line itself');
  eq(s.buyTotal, 1240000,
    'it is left OUT of the cash figure rather than costed at nothing — a total that quietly swallows a line reads as complete when it is not');

  // A stock line has no purchase price either, and that is not a gap:
  // it is already paid for. Treating the two the same would report a
  // fully stocked order as full of unpriced lines.
  const stocked = scope.orderPreviewSummary(order([stockLine()]));
  eq(stocked.unpriced, 0, 'a stock line is not unpriced — there is nothing left to buy for it');
}

/* ---------- 3. picking: not yet, versus none found ------------------- */
{
  const none = scope.orderPreviewSummary(order([stockLine(), buyLine()]));
  eq(none.picking, false, 'before anybody picks, the picked column has no reason to exist');
  eq(none.lines[0].picked, null, 'and no line claims a picked quantity');
  eq(none.shortLines, 0, 'nothing is short when nothing has been picked');

  const started = scope.orderPreviewSummary(order([
    stockLine({ pickStatus: 'done' }),
    buyLine({ pickStatus: 'short', pickedQty: 25 }),
    stockLine({ productName: 'Wire', pickStatus: 'short', pickedQty: 0 }),
  ]));
  eq(started.picking, true, 'once a line is picked the column appears');
  eq(started.lines[0].short, false, 'a line picked in full is not short');
  eq(started.lines[1].short, true, '25 of 40 is short');
  eq(started.lines[2].picked, 0, 'and nothing found on the shelf is ZERO picked');
  eq(started.lines[2].short, true, 'which is a shortfall');
  eq(started.shortLines, 2, 'counted across the order');

  /* The distinction the whole section exists for. A line nobody has
     reached yet reads as null; a line where the shelf was empty reads as
     0. Collapsing them either invents a shortfall on every unpicked line
     or hides a real one. */
  const mixed = scope.orderPreviewSummary(order([stockLine({ pickStatus: 'done' }), buyLine()]));
  eq(mixed.lines[1].picked, null, 'an unreached line stays null even once picking has started');
  eq(mixed.lines[1].short, false, 'so it is not reported as short');
  eq(mixed.shortLines, 0, 'and the order is not flagged for a line nobody has looked at yet');
}

/* ---------- 4. where it has got to ----------------------------------- */
{
  const html = scope.orderPreviewStepsHTML(order([stockLine()], { status: 'pending_delivery' }));
  const states = [...html.matchAll(/class="op-step (\w+)"/g)].map((m) => m[1]);
  // Five steps since Awaiting Goods was inserted after Draft.
  t.check(states.join(',') === 'done,done,done,now,todo',
    `the steps behind it are done, the one it is in is now, the rest to come (got ${states.join(',')})`);

  const first = scope.orderPreviewStepsHTML(order([stockLine()], { status: 'draft' }));
  t.check([...first.matchAll(/class="op-step (\w+)"/g)].map((m) => m[1]).join(',') === 'now,todo,todo,todo,todo',
    'a draft has nothing behind it');

  const last = scope.orderPreviewStepsHTML(order([stockLine()], { status: 'completed' }));
  t.check([...last.matchAll(/class="op-step (\w+)"/g)].map((m) => m[1]).join(',') === 'done,done,done,done,now',
    'and a completed order has nothing left');

  // Only the step it is in says how long it has been there; the others
  // would be claiming a duration nothing records.
  eq((html.match(/op-step-since/g) || []).length, 1,
    'exactly one step carries the time it has been sitting');
}

/* ---------- 5. an empty order does not throw ------------------------- */
{
  const s = scope.orderPreviewSummary(order([]));
  eq(s.lines.length, 0, 'no lines');
  eq(s.total, 0, 'no total');
  eq(s.picking, false, 'nothing being picked');
  const nothing = scope.orderPreviewSummary({});
  eq(nothing.lines.length, 0, 'and an order with no items array at all is empty rather than broken');
}

/* ---------- 6. the eye opens it, and only the eye -------------------- */
{
  const body = extractFunction(src, 'orderRowBodyHTML', 'index.html');
  t.check(/data-act="\$\{act\}"/.test(body) && /ghost\('preview', 'Preview'\)/.test(body),
    'there is a Preview act in the open row, so the preview is a visible control rather than a hidden gesture');
  t.check(/case 'preview': openOrderPreview\(id\); break;/.test(src),
    'and it opens the panel');

  /* The card body opened it too for a while. On a board that is dragged,
     selected and stepped through, that meant the panel appearing on
     clicks nobody meant as a request to read the order. Asking for it
     explicitly does not have that problem.

     Pinned as an absence, since the failure is a listener coming back
     rather than one going missing. */
  t.check(!/wrap\.querySelectorAll\('\.sq-card'\)\.forEach\(card=>\{[\s\S]{0,200}openOrderPreview/.test(src),
    'the card body itself is not a second way in');
  const cardCss = (/\.sq-card\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(!/cursor:pointer/.test(cardCss),
    'and the card does not claim to be clickable when it is not');
}

/* ---------- 7. the columns do not run together ----------------------- */
{
  /* "5 Ctn(unknown supplier)". The quantity column is right-aligned, so
     it carries no right padding, and every cell carries no left padding
     -- which left the figure touching the supplier beside it and reading
     as one word.

     The gap goes on the FOLLOWING cell rather than by restoring right
     padding, so the right-aligned figures still line up flush under
     their own heading. */
  t.check(/\.op-table th \+ th, \.op-table td \+ td\{padding-left:\d+px;\}/.test(src),
    'every pair of columns is separated, whichever way the first one is aligned');

  const rightCell = (/\.op-table \.r\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/padding-right:0/.test(rightCell),
    'and the figures stay flush right rather than being nudged in to make the gap');
}

/* ---------- 8. the panel ends on the table --------------------------- */
{
  // The closing sentence restated the two figures already in the footer
  // and the warnings already above it, in prose, at the point the reader
  // had finished.
  const fn = (/function orderPreviewHTML[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(!/op-read/.test(fn),
    'no summary paragraph after the lines — the totals row already says it');
  t.check(/<\/table>`;/.test(fn), 'the panel ends on the table itself');

  // The figure it used is still computed: the cash-flow of a trip is
  // real, it is just shown where it belongs rather than narrated here.
  t.check(/buyTotal:/.test(src), 'buyTotal survives for the callers that do show it');
}

/* ---------- the packing chit -----------------------------------------
   The worker app is the normal way to pick an order. A shop where the
   only copy of what to gather lives on one battery is a shop that stops
   when that battery does -- so the same order goes on 80mm roll, for a
   picker working from paper.
 */
{
  const chit = scope.buildPackingChitHTML(order([stockLine(), buyLine()],
    { assignedWorkerId: 'W1', _where: 'Ndeeba' }));

  /* NO MONEY ON IT, unlike the preview screen behind the button. The
     picker gathers goods; line totals are the shop's cost position, are
     not something they act on, and this paper walks round the yard and
     gets left on benches. */
  t.check(!/UGX/.test(chit) && !/45,?000|38,?000|31,?000/.test(chit),
    'the chit carries no prices at all');

  // What it must carry instead.
  t.check(/Iron sheets/.test(chit) && /Cement/.test(chit), 'every line is named');
  t.check(/10 pcs/.test(chit) && /40 bags/.test(chit), 'with the quantity and its unit');
  t.check(/stock/.test(chit) && /Katwe Steel/.test(chit),
    'and where it comes from — the shelf, or which supplier');
  t.check(/PACKING LIST/.test(chit), 'the paper says what it is');
  t.check(/Telagon Hardware/.test(chit), 'and who it came from');
  t.check(/Okello/.test(chit), 'naming the order it belongs to');
  t.check(/Ndeeba/.test(chit), 'and where it is going');

  /* A box to tick on every line. The whole reason this exists is that
     nobody has a screen to tap. */
  const boxes = (chit.match(/class="pk-box"/g) || []).length;
  t.check(boxes === 2, `a box to tick on each line (${boxes})`);

  /* IN THE WORDS THE ORDER WAS WRITTEN IN. A line chosen as 2 Ctn is
     gathered as 2 Ctn, with what is already in said in cartons too --
     not counted out as 200 Pair for the picker to fold back. */
  const ctnChit = scope.buildPackingChitHTML(order([stockLine({ productName: 'Soft Close',
    unit: 'Pair', packUnit: 'Ctn', packQty: 100, qtyIn: 'pack', qty: 200, pickStatus: 'short', pickedQty: 150 })]));
  t.check(/2 Ctn/.test(ctnChit) && /1\.5 already in/.test(ctnChit) && !/200 Pair/.test(ctnChit),
    'a carton line is listed as 2 Ctn, with 1.5 already in');
  t.check(/Picked by/.test(chit), 'and somewhere to sign at the end');

  /* Nothing truncated. The trip message learned this: two 14-character
     columns rendered "Chrome Pipe — 19mm" and "Chrome Pipe — 25mm" as
     the same row, and somebody fetched the wrong pipe. */
  const longName = scope.buildPackingChitHTML(order([
    buyLine({ productName: 'Chrome Pipe — 19mm - Light' }),
    buyLine({ productName: 'Chrome Pipe — 25mm - Light' }),
  ]));
  t.check(/19mm/.test(longName) && /25mm/.test(longName),
    'two products differing late in the name are still told apart');
  t.check(!/…/.test(longName), 'nothing on the list is cut');

  /* Optional rows cost no line when absent, the same rule the sales
     receipt follows -- a blank "Picker" on a roll is wasted paper and
     reads as a missing answer. */
  const noWorker = scope.buildPackingChitHTML(order([stockLine()]));
  t.check(!/Picker/.test(noWorker), 'an unassigned order prints no picker line');
  t.check(!/Deliver to/.test(noWorker), 'and no delivery line where there is no address');

  // Already-picked quantities show, so a chit printed mid-pick is honest
  // about what is left rather than starting the job again.
  const midPick = scope.buildPackingChitHTML(order([
    buyLine({ pickedQty: 12, pickStatus: 'short' }),
  ]));
  t.check(/12 already in/.test(midPick),
    `a part-picked line says how much is already gathered (${(midPick.match(/<div class="pk-detail">[\s\S]*?<\/div>/) || [''])[0].replace(/<[^>]+>/g, ' ').trim()})`);
  // An untouched line says nothing rather than "0 already in", which
  // reads as an empty shelf instead of a job not started.
  t.check(!/already in/.test(chit),
    'while a line nobody has answered yet claims nothing about what is gathered');

  // The footer answers "how much of this is a walk to the shelf".
  t.check(/1 stock/.test(chit) && /1 to buy/.test(chit),
    'and the foot splits what is on the shelf from what has to be fetched');
}

/* ---------- and the roll it prints on --------------------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  const fn = (/function printPackingChit[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(fn.length > 0, 'there is a print path');

  /* Measured, not guessed. A page even a fraction short of its content
     spills a second almost-empty sheet, which costs more roll than the
     millimetre saves. */
  t.check(/receiptPageHeightMM\(area\)/.test(fn),
    'the page is sized to what was actually rendered');
  t.check(/size:80mm \$\{receiptPageHeightMM\(area\)\}mm;margin:0;/.test(fn),
    'on 80mm with no page margin — a margin offsets the content past a head that cannot reach it');

  /* A statement's A4 left over from another printout would set the page
     size for this roll. */
  t.check(/clearInjectedPrintStyles\(\);/.test(fn),
    'a stale page size from another printout is cleared first');
  t.check(/area\.innerHTML = '';/.test(fn),
    'and the print area is emptied afterwards, so the next receipt does not carry a picking list');

  // Offered where the order is being looked at, and only with lines on it.
  t.check(/id="opChitBtn"/.test(src) && /printPackingChit\(chit\.dataset\.id\)/.test(src),
    'the order preview carries the button, wired to the order it is showing');
  t.check(/\$\{s\.lines\.length \? `<div class="op-actions">/.test(src),
    'and offers nothing on an order with no lines to pick');
}

process.exit(t.done() ? 1 : 0);
