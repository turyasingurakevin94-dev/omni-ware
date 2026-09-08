#!/usr/bin/env node
'use strict';
/*
 * A bill already spoken for is not a bill to adopt.
 *
 * ELEPHANT King — Long / Single Lock, on the real books:
 *
 *   19 Aug  +2   Jeff Kenyos @ 310,000/Ctn   → PINV-0102, 620,000, PAID
 *   22 Aug  -1   sold
 *   28 Aug  +16  Shafik Katwe @ 310,000/Ctn  → no bill of its own
 *
 * The 28 Aug delivery was then corrected, and the screen offered it
 * PINV-0102 — a settled bill for a different delivery, of a different
 * size, from a different supplier, three weeks earlier — because the
 * only test applied was "an unvoided single-line bill mentioning this
 * item". Adopting rewrites that bill's only line, so a paid 620,000
 * invoice for 2 Ctn silently became a bill for 0.85 at 15,500. The shop
 * owed the wrong supplier the wrong money for the wrong goods, and the
 * delivery that really arrived had no bill at all.
 *
 * A purchase's own correction chain is not "another delivery": a
 * purchase corrected twice is three rows describing one delivery, every
 * one of which may carry its piId, and excluding only the row in hand
 * would hide the very bill the correction exists to repair.
 *
 * Run: node test/purchase-bill-already-claimed.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('a bill another delivery already carries');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const src = read('index.html');

const data = { stockLog: [], purchaseInvoices: [] };
const N = ['stockPurchaseChainIds', 'purchaseInvoiceClaimedByOther'];
const fns = compileScope(N.map((n) => extractFunction(src, n, 'index.html')), { data }, N);

/* The two deliveries, as the movements screen shows them. */
const reset = () => {
  data.stockLog = [
    { id: 1, key: 'P-EL::1', productId: 'P-EL', variantIdx: 1, type: 'restock', delta: 2,
      supplierId: 'S-JEFF', piId: 102, source: 'inv-purchase', date: '2026-08-19' },
    { id: 2, key: 'P-EL::1', productId: 'P-EL', variantIdx: 1, type: 'sale', delta: -1, date: '2026-08-22' },
    { id: 3, key: 'P-EL::1', productId: 'P-EL', variantIdx: 1, type: 'restock', delta: 16,
      supplierId: 'S-SHAFIK', piId: null, source: 'inv-purchase', date: '2026-08-28' },
  ];
  data.purchaseInvoices = [{ id: 102, supplierId: 'S-JEFF', voided: false,
    items: [{ productId: 'P-EL', variantIdx: 1, qty: 2, price: 310000 }] }];
};
const rowById = (id) => data.stockLog.find((l) => l.id === id);

/* ---------- 1. the fault, named ---------------------------------------- */
{
  reset();
  const chain = fns.stockPurchaseChainIds(rowById(3));
  eq(fns.purchaseInvoiceClaimedByOther(102, chain), true,
    'PINV-0102 belongs to the 19 Aug delivery, so the 28 Aug one may not adopt it');

  const own = fns.stockPurchaseChainIds(rowById(1));
  eq(fns.purchaseInvoiceClaimedByOther(102, own), false,
    'while the delivery that really raised it may of course still correct it');
}

/* ---------- 2. a purchase's own chain is not "another delivery" -------- */
{
  reset();
  /* The 19 Aug purchase, corrected once: two rows, one delivery, and the
     correction carries the piId forward. Correcting it AGAIN must still
     be able to reach its own bill. */
  rowById(1).correctedBy = 4;
  data.stockLog.push({ id: 4, key: 'P-EL::1', productId: 'P-EL', variantIdx: 1, type: 'correction',
    delta: 0, corrects: 1, purchaseQty: 2, piId: 102, source: 'inv-purchase', date: '2026-08-20' });

  const chain = fns.stockPurchaseChainIds(rowById(1));
  eq(chain.size, 2, 'the chain is every row this one delivery has ever been');
  eq(fns.purchaseInvoiceClaimedByOther(102, chain), false,
    'so its own bill is still its own to repair, however many times it has been corrected');

  // And the other delivery still cannot have it.
  eq(fns.purchaseInvoiceClaimedByOther(102, fns.stockPurchaseChainIds(rowById(3))), true,
    'while the 28 Aug delivery still cannot');
}

/* ---------- 3. an unclaimed bill is free to adopt ---------------------- */
{
  reset();
  data.purchaseInvoices.push({ id: 108, supplierId: 'S-SHAFIK', voided: false,
    items: [{ productId: 'P-EL', variantIdx: 1, qty: 16, price: 310000 }] });
  eq(fns.purchaseInvoiceClaimedByOther(108, fns.stockPurchaseChainIds(rowById(3))), false,
    'a bill nothing else carries is exactly what this delivery should be linked to');
  eq(fns.purchaseInvoiceClaimedByOther(null, fns.stockPurchaseChainIds(rowById(3))), false,
    'and "no bill" is not a claim on anything');
}

/* ---------- 4. both the list and the save hold the line --------------- */
{
  const fill = extractFunction(src, 'ipeFillBillOptions', 'index.html');
  t.check(/!purchaseInvoiceClaimedByOther\(pi\.id, chainIds\)/.test(fill),
    'a bill another delivery carries is not offered in the list');

  const edit = extractFunction(src, 'applyStockPurchaseEdit', 'index.html');
  t.check(/if\(billAdopted && purchaseInvoiceClaimedByOther\(pi\.id, stockPurchaseChainIds\(e\)\)\) return \{ok: false/.test(edit),
    'and refused at the save too — a dropdown is a convenience, this is the rule');
  t.check(/already belongs to another delivery of/.test(edit),
    'with an error that says whose bill it is rather than just refusing');

  /* The refusal must come BEFORE anything is written, like every other
     check on this screen -- a refusal after the shelf has moved is the
     fault its own comment already warns about. */
  const iGuard = edit.indexOf('already belongs to another delivery');
  const iShelf = edit.indexOf('data.stock[e.key] =');
  const iBill = edit.indexOf('billItem.qty = newQty');
  t.check(iGuard > -1 && iShelf > iGuard && iBill > iGuard,
    'and before the first write, so nothing is half-done');
}

process.exit(t.done() ? 1 : 0);
