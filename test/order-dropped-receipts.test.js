#!/usr/bin/env node
'use strict';
/*
 * Re-sourcing a line whose goods already arrived.
 *
 * A line only comes off the shelf when it is the shop's own stock or has
 * been RECEIVED. So replacing a received line — re-sourcing it to another
 * supplier, or removing it — hands the order a fresh line carrying no
 * receipt, and invoicing that order then deducts nothing. The goods that
 * were received stay on the shelf.
 *
 * Which is right if the shop really has them: a delivery received is a
 * delivery owned, whoever the customer's order was finally filled from.
 * It is wrong, and silently so, when the goods on the shelf and the goods
 * the customer took were the same twenty boxes all along.
 *
 * That is exactly what happened. Black Screws: sourced from one supplier,
 * received, invoiced and un-invoiced twice, then re-sourced to another
 * supplier and invoiced. Twenty boxes the customer had walked out with sat
 * on the shelf, and the only trace was a movement log nobody reads until
 * something already looks wrong.
 *
 * Run: node test/order-dropped-receipts.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('order dropped receipts');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['orderReceiptsBeingDropped', 'orderDroppedReceiptWarning'];
let fns = null, err = null;
try {
  fns = compileScope(
    [extractFunction(read('shared-worker.js'), 'quoteLineReceived', 'shared-worker.js'),
      ...NAMES.map(n => extractFunction(src, n, 'index.html'))],
    { supplierName: (id) => ({ S1: 'Haidery Building Materials', S2: 'Jjaja Walu' }[id] || '') },
    NAMES);
} catch (e) { err = e; }
t.check(!!fns, `the routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { orderReceiptsBeingDropped, orderDroppedReceiptWarning } = fns;

  const received = (over) => Object.assign({
    productId: 'P1', variantIdx: null, productName: 'Black Screws — 8∗ / Coarse',
    supplierId: 'S1', qty: 20, receivedQty: 20, receivedAt: '2026-08-20T09:00:00Z',
  }, over);
  const fresh = (over) => Object.assign({
    productId: 'P1', variantIdx: null, productName: 'Black Screws — 8∗ / Coarse',
    supplierId: 'S2', qty: 20,
  }, over);

  /* ---------- 1. the reported case ---------------------------------- */
  {
    const existing = { items: [received()] };
    const dropped = orderReceiptsBeingDropped(existing, [fresh()]);
    t.check(dropped.length === 1 && Number(dropped[0].receivedQty) === 20,
      `re-sourcing a received line is caught (${dropped.length})`);
    const w = orderDroppedReceiptWarning(dropped);
    t.check(/20 x Black Screws/.test(w), `naming what was received (${String(w).split('\n')[2]})`);
    t.check(/Haidery Building Materials/.test(w), 'and who it came from');
    t.check(/leaves those goods ON THE SHELF/.test(w), 'saying plainly where the goods end up');
    t.check(/count that product afterwards/.test(w),
      'and what to do if they are the same goods the customer is taking');
    t.check(/Save anyway\?/.test(w), 'asked, not refused — a delivery received is a delivery owned');
  }

  /* ---------- 2. removing the line outright is the same thing ------- */
  {
    const dropped = orderReceiptsBeingDropped({ items: [received()] }, []);
    t.check(dropped.length === 1, 'removing a received line drops its receipt just as re-sourcing does');
  }

  /* ---------- 3. what must NOT warn --------------------------------- */
  {
    t.check(orderReceiptsBeingDropped({ items: [received()] }, [received()]).length === 0,
      'a line kept with its receipt intact is not a drop');
    // Only the supplier changed, and the receipt travelled with the line.
    t.check(orderReceiptsBeingDropped({ items: [received()] }, [received({ supplierId: 'S2' })]).length === 0,
      'nor is a line whose supplier changed while its receipt stayed with it');
    // The line's quantity changed but the goods are still received.
    t.check(orderReceiptsBeingDropped({ items: [received()] }, [received({ qty: 10 })]).length === 0,
      'nor a line whose quantity was edited');
    t.check(orderReceiptsBeingDropped({ items: [fresh()] }, []).length === 0,
      'a line that never received anything drops nothing');
    t.check(orderReceiptsBeingDropped(null, [fresh()]).length === 0,
      'and a brand new order has no receipts to lose');
    t.check(orderDroppedReceiptWarning([]) === null, 'nothing dropped asks nothing');
  }

  /* ---------- 4. matched on the product, not the line id ------------ */
  /*
   * Loading an order for editing renumbers every line, so the ids in hand
   * are never the ids on file. Matching on lineId would have reported
   * every edited line as a dropped receipt.
   */
  {
    const existing = { items: [received({ lineId: 3 })] };
    t.check(orderReceiptsBeingDropped(existing, [received({ lineId: 91 })]).length === 0,
      'the same product with a renumbered line id is the same line');
    // A variant is its own product, though.
    t.check(orderReceiptsBeingDropped({ items: [received({ variantIdx: 1 })] }, [received({ variantIdx: 2 })]).length === 1,
      'while another variant of it is not');
  }

  /* ---------- 5. several at once ------------------------------------ */
  {
    const existing = { items: [received(), received({ productId: 'P2', productName: 'Runners' })] };
    const w = orderDroppedReceiptWarning(orderReceiptsBeingDropped(existing, []));
    t.check(/These lines have/.test(w) && /Black Screws/.test(w) && /Runners/.test(w),
      'every dropped receipt is named, not just the first');
  }
}

/* ---------- 6. asked before anything is written ---------------------- */
{
  const save = code.slice(code.indexOf("__btn_q_save_btn.addEventListener"));
  const head = save.slice(0, save.indexOf('const record ='));
  t.check(/const droppedWarning = orderDroppedReceiptWarning\(/.test(head), 'the save asks');
  t.check(/if\(droppedWarning && !confirm\(droppedWarning\)\) return;/.test(head),
    'and stops there if the answer is no');
  /* Before the id is issued: a save the shop backs out of must not burn
     an INV- number out of the shop's own paperwork sequence. */
  t.check(head.indexOf('droppedWarning') < head.indexOf("await issueRowId('savedQuote')"),
    'asked before an invoice number is issued, so backing out costs nothing');
}

process.exit(t.done() ? 1 : 0);
