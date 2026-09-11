#!/usr/bin/env node
'use strict';
/*
 * A rounding artefact is not a fault in the books, and must not look
 * like one.
 *
 * ELEPHANT King — Long / Single Lock stood at 1.85 and one was sold. A
 * double cannot hold 1.85, so 1.85 - 1 came out 0.8500000000000001, and
 * the Movements screen printed that, in full, in the Change column. To
 * an owner reading their own stock ledger it says the app has lost its
 * grip on a count. It has not: only the last bit of a binary fraction is
 * wrong, and the shelf really holds 0.85.
 *
 * Two fixes, because there are two problems. The tail is no longer
 * CREATED -- applyStockDelta cleans what it writes, so no new movement
 * carries one -- and it is no longer SHOWN, because rows already on file
 * still hold it and the shop should not have to re-enter its history to
 * read it.
 *
 * A count is not rounded to a whole number. 3.5 Kg of wire and 2.5 m of
 * pipe are real counts, and a formatter that ate them would be a worse
 * bug than the one it replaced.
 *
 * Run: node test/stock-qty-display.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('stock quantity display');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const src = read('index.html');

/* ---------- 1. the formatter ------------------------------------------ */
{
  const F = compileScope([extractFunction(src, 'fmtStockQty', 'index.html')], {}, ['fmtStockQty']);
  const f = F.fmtStockQty;

  // The row off the real books.
  eq(f(1.85 - 1), '0.85', 'the artefact that started this reads as the count it is');
  eq(f(-(1.85 - 1)), '-0.85', 'and so does its negative, which is what the Change column shows');
  eq(f(0.8500000000000001), '0.85', 'however it arrives');

  // A count is not an integer.
  eq(f(3.5), '3.5', 'half a kilo is half a kilo — a count is not rounded to a whole number');
  eq(f(2.25), '2.25', 'nor is a quarter');
  eq(f(0.125), '0.125', 'and a real third decimal survives');

  // Whole numbers still read whole.
  eq(f(80), '80', 'eighty reads as eighty, not 80.00');
  eq(f(0), '0', 'and nothing reads as nothing');
  eq(f(-4), '-4', 'a plain decrease is plain');

  // Nonsense in is not nonsense out.
  eq(f(NaN), '0', 'a figure that is not a number reports nothing rather than NaN');
  eq(f(undefined), '0', 'as does a missing one');
  eq(f(Infinity), '0', 'and one that ran away');
}

/* ---------- 2. the tail is never created ------------------------------ */
{
  const data = { stock: {}, stockLots: {}, stockLog: [], nextStockLogId: 1, products: [{ id: 'P1', name: 'Wire' }] };
  const N = ['stockKey', 'addStockLot', 'consumeStockLots', 'restoreStockLots', 'applyStockDelta'];
  const fns = compileScope(N.map((n) => extractFunction(src, n, 'index.html')), {
    data,
    todayISO: () => '2026-09-07',
    productVariantLabel: (p) => p.name,
    allocRowId: () => data.nextStockLogId++,
  }, N);

  // The exact sequence off the Long variant: 17 in, corrected to 1.85, one sold.
  data.stock = { P1: 1.85 };
  data.stockLots = { P1: [{ qty: 1.85, cost: 15500 }] };
  fns.applyStockDelta('P1', null, -1, 'sale', 'Quote', null, null);

  eq(data.stock.P1, 0.85, 'the shelf holds a clean 0.85, not 0.8500000000000001');
  eq(data.stockLog[0].delta, -1, 'the movement records the whole one that left');
  eq(data.stockLog[0].qtyAfter, 0.85, 'and what is left is clean on the row itself');

  // And it stays clean as the shelf is worked.
  fns.applyStockDelta('P1', null, -0.85, 'correction', 'counted out', null, null);
  eq(data.stock.P1, 0, 'taking the remainder lands exactly on nothing');
  eq(data.stockLog[1].delta, -0.85, 'with a delta that reads as a count');

  /* A REAL fraction is still carried. The cleaning is at six decimals,
     past anything a shop counts in -- it must not quietly round a
     genuine 3.5 Kg to 4. */
  data.stock = { P1: 10 };
  data.stockLots = { P1: [{ qty: 10, cost: 4000 }] };
  fns.applyStockDelta('P1', null, -3.5, 'sale', 'Wire by the metre', null, null);
  eq(data.stock.P1, 6.5, 'three and a half off ten is six and a half, exactly as counted');
}

/* ---------- 3. every place a movement is shown uses it ---------------- */
{
  const log = extractFunction(src, 'renderStockLog', 'index.html');
  t.check(/\$\{e\.delta>0\?'\+':''\}\$\{fmtStockQty\(e\.delta\)\}/.test(log),
    'the Change column formats the delta');
  /* The cell moved from a <td class="price"> to the layer table's
     figure cell when the log was rebuilt on .ow-tbl. What the
     assertion was ever about is unchanged: the column beside Change
     cannot be the one that prints a raw 0.8500000000000001. */
  t.check(/data-l="Stock after">\$\{fmtStockQty\(e\.qtyAfter\)\}</.test(log),
    'and Stock after formats too — the column beside it cannot be the honest one alone');
  t.check(!/\$\{e\.delta\}/.test(log) && !/\$\{e\.qtyAfter\}/.test(log),
    'no raw quantity is left anywhere on the screen — desktop table or phone card');
  t.check(/fmtStockQty\(t\.inQty\)/.test(log) && /fmtStockQty\(t\.outQty\)/.test(log) && /fmtStockQty\(t\.net\)/.test(log),
    'the in / out / net line is formatted as well, where the tails would otherwise add up');

  const inv = extractFunction(src, 'invOpenHTML', 'index.html');
  t.check(/fmtStockQty\(Math\.abs\(d\)\)/.test(inv),
    'and "This line, lately" on the Inventory card, which shows the same movements');
}

/* ---------- 4. the pack a screen offers is the pack the ledger keeps -- */
{
  /* productPackInfo took the cheapest row carrying any packQty, which
     let a row priced per Ctn and "packed" in ctn win -- a pack of
     cartons in cartons, which stockUnitFor rejects. The purchase
     correction screen sizes its unit selector from this, so the two
     have to answer the same question. */
  const rows = [
    { supplierId: 'A', unit: 'Ctn', packQty: 12, packUnit: 'ctn', wholesale: 1000, outOfStock: false },
    { supplierId: 'B', unit: 'Dozen', packQty: 20, packUnit: 'Ctn', wholesale: 14500, outOfStock: false },
  ];
  const N = ['stockUnitFor', 'productPackInfo'];
  const f = compileScope(N.map((n) => extractFunction(src, n, 'index.html')), {
    cmpUnitKey: (s) => String(s || '').trim().toLowerCase(),
    productPriceRows: () => rows,
    rankedPriceRows: () => rows.slice().sort((a, b) => a.wholesale - b.wholesale),
  }, N);

  const pk = f.productPackInfo('P1', null);
  const shelf = f.stockUnitFor('P1', null);
  eq(pk.packQty, 20, 'the pack offered is the shelf\'s twenty, not the cheapest row\'s bogus twelve');
  eq(pk.unit, 'Dozen', 'in the unit the shelf is counted in');
  eq(pk.packQty, shelf.packQty, 'the two readers cannot disagree');
  eq(pk.packUnit, shelf.packUnit, 'about the pack either');
}

process.exit(t.done() ? 1 : 0);
