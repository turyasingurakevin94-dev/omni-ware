#!/usr/bin/env node
'use strict';
/*
 * Selling over the counter.
 *
 * A walk-in sale was a cash receipt and nothing else. No invoice, so no
 * revenue and no cost of sales. No stock movement, so the goods stayed
 * on the shelf for ever. The statements reported a loss equal to the
 * shop's whole running costs every month while its inventory grew by
 * everything it had ever sold -- and the trust panel said "nothing
 * outstanding".
 *
 * Picking the items in the till now writes a REAL SALE: a completed,
 * invoiced quote whose lines come off our own shelf, with the receipt
 * linked to it. Revenue, cost of sales, stock and margin all become true
 * at once, because every one of them reads records that already existed.
 *
 * TWO THINGS THIS FILE GUARDS.
 *
 *   the link      both halves are true and both stay -- the receipt
 *                 belongs in the cash flow, the sale in the profit and
 *                 loss. Without the link the statements cannot tell a
 *                 counter sale that WAS recorded from takings that were
 *                 never recorded at all, and the basis warning would
 *                 fire on exactly the sales just done properly.
 *   the agreement the receipt and the items must come to the same
 *                 figure, or the money says one thing and the sale
 *                 behind it another, and every margin drawn from the
 *                 pair is wrong.
 *
 * Run: node test/counter-sale.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('counter sale');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { products: [], prices: [], savedQuotes: [], cashTxns: [], nextQuoteLineId: 1 };
let tillSaleLines = [];
let nextId = 100;

const NAMES = ['tillSaleTotal', 'tillBuildSaleQuote', 'tillCommitSale'];
const scope = compileScope([
  extractDeclaration(src, 'tillSaleLines', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
  // Test-side reach into the module's own basket.
  'function setLines(v){ tillSaleLines = v; }',
  'function getLines(){ return tillSaleLines; }',
], {
  data,
  allocRowId: () => nextId++,
  issueRowId: async () => nextId++,
  applyQuoteStockDeduction: (q) => {
    // Stands in for the real one: takes what the shelf has, records the
    // lots it consumed, and reports a shortfall the same way.
    let short = false;
    q.items.forEach((it) => {
      if (it.supplierId !== '__stock__') return;
      const have = data.stockFor ? (data.stockFor[it.productId] || 0) : 0;
      const take = Math.min(have, Number(it.qty) || 0);
      if (take < (Number(it.qty) || 0)) short = true;
      it._stockTaken = take;
      if (take > 0) it._stockLots = [{ qty: take, cost: 28000 }];
    });
    return short;
  },
  document: { getElementById: () => ({ value: '10:30' }) },
}, [...NAMES, 'setLines', 'getLines']);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const line = (productId, qty, price, name) => ({ productId, variantIdx: null, name: name || 'Cement 50kg', qty, price, unit: 'Bag' });

/* ---------- 1. what the basket comes to ------------------------------ */
{
  scope.setLines([line('P1', 5, 35000), line('P2', 2, 12000)]);
  eq(scope.tillSaleTotal(), 5 * 35000 + 2 * 12000, 'the basket is quantity times price, added up');

  // A line with no price yet contributes nothing rather than throwing --
  // the save path is what refuses to record it.
  scope.setLines([line('P1', 5, '')]);
  eq(scope.tillSaleTotal(), 0, 'a line with no price on it adds nothing to the total');
  scope.setLines([]);
  eq(scope.tillSaleTotal(), 0, 'and an empty basket comes to nothing');
}

/* ---------- 2. the sale it writes ------------------------------------ */
{
  (async () => {
    data.savedQuotes = []; data.cashTxns = []; data.stockFor = { P1: 100 };
    scope.setLines([line('P1', 5, 35000)]);
    const res = await scope.tillCommitSale('', '2026-08-05', 'cash', 175000, 'Walk-in');

    const q = data.savedQuotes[0];
    t.check(!!q, 'a sale is written, not just a receipt');
    eq(q.status, 'completed', 'completed, because it happened');
    eq(q.invoiced, true, 'and invoiced, which is what puts it into revenue');
    eq(q.invoicedAt, '2026-08-05', 'dated to the day it was rung up');
    eq(q.counterSale, true, 'marked as a counter sale, so it can be told from a quoted order');
    eq(q.client.name, 'Counter sale', 'and named when nobody was named');

    /* __stock__ is the marker that takes the goods off OUR shelf and
       keeps generatePurchaseInvoicesForQuote out of it -- nothing is
       being bought in for a sale from stock. */
    eq(q.items[0].supplierId, '__stock__', 'the line comes off our own shelf');
    eq(q.items[0].sellPrice, 35000, 'at the price it was sold for');
    eq(q.items[0].qty, 5, 'for the quantity that left');
    t.check(q.items[0].lineId != null, 'and carries a line id like any other quote line');

    /* The lots are what make cost of sales REAL rather than an estimate:
       invoiceLineCost reads them for what the goods actually cost. */
    t.check(Array.isArray(q.items[0]._stockLots) && q.items[0]._stockLots[0].cost === 28000,
      'the FIFO lots consumed are recorded on the line, so cost of sales is what was paid');
    t.check(res.shortfall === false, 'and a shelf that had enough reports no shortfall');

    const txn = data.cashTxns[0];
    eq(txn.type, 'receipt', 'the money is a receipt');
    eq(txn.category, 'Sales Revenue', 'under the category it has always used');
    eq(txn.amount, 175000, 'for what was taken');
    eq(txn.quoteId, q.id, 'AND LINKED TO THE SALE, which is what stops the basis warning firing on it');
    eq(q.amountPaid, 175000, 'the sale is recorded as paid, because it was');

    /* Selling more than the shelf says is there is recorded, not
       refused: the stock figure can itself be behind, and an app that
       will not record what already happened just hides the error. */
    data.savedQuotes = []; data.cashTxns = []; data.stockFor = { P1: 3 };
    scope.setLines([line('P1', 10, 35000)]);
    const short = await scope.tillCommitSale('', '2026-08-05', 'cash', 350000, 'Big one');
    t.check(short.shortfall === true, 'selling more than the shelf holds reports a shortfall');
    eq(data.savedQuotes[0].items[0].qty, 10, 'but the sale is still for what was actually sold');
    eq(data.savedQuotes[0].items[0]._stockTaken, 3, 'with only what was there taken off the shelf');
    t.check(data.cashTxns.length === 1, 'and the money is still recorded');

    process.exit(t.done() ? 1 : 0);
  })();
}

/* ---------- 3. the guards on the way in ------------------------------ */
{
  const save = (/async function saveCashTxn[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  /* The basket is resolved once, at the top, so the price check can run
     BEFORE the amount guard -- see below for why that ordering matters.
     What is pinned is unchanged: items turn the entry into a sale, and
     only on a fresh cash-in, never on an edit. */
  t.check(/const saleLines = \(column==='in' && !editingCashTxnId\) \? tillSaleLines : \[\];/.test(save),
    'picking items is what turns the till entry into a sale');
  t.check(/if\(saleLines\.length\)\{/.test(save),
    'and a till entry with no items takes none of this path');

  /* The receipt and the items have to agree. Letting them differ would
     put a margin on the books drawn from two numbers that describe
     different transactions. */
  t.check(/Math\.abs\(lineTotal - amount\) >= 1/.test(save),
    'the amount and the items must come to the same figure');
  t.check(/The items come to \$\{fmtUGX\(lineTotal\)\}/.test(save),
    'and the refusal shows both figures rather than just saying no');

  /* A line with no price is not a giveaway. Recording it at zero would
     understate the sale and quietly wreck the margin. */
  t.check(/saleLines\.filter\(l=> !\(Number\(l\.price\) > 0\)\)/.test(save),
    'a line with no price is refused rather than sold for nothing');
  t.check(/l=> Number\(l\.qty\) > 0/.test(save), 'and so is a line with no quantity');

  /* AND IT IS CHECKED BEFORE THE AMOUNT. A priceless line makes the
     basket total zero, so the generic guard fired first and refused with
     "enter a valid amount" -- naming the one thing that was never wrong
     while the missing price went unmentioned. Found by driving the form,
     not by reading it, and it is the same mistake the payroll reminder
     made with its days. */
  t.check(save.indexOf('Put a price on') < save.indexOf("toast('Enter a valid amount')"),
    'and refused before the amount is judged, so the message names the price and not the amount');

  // Stock moved, so the screens that show it are stale.
  t.check(/triggerProductsRender\(\);/.test(save) && /renderInventory\(\);/.test(save),
    'the shelf having changed, the screens that show it are redrawn');

  const add = (/function tillAddSaleLine[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/price==null \? '' : price/.test(add),
    'a product with no price on file starts empty, not at zero');
  /* The CONDITION, not just the statement under it. Pinning the line
     alone passed with `if(false)` in front of it — the text was present
     and unreachable, the same trap the retained-earnings hint fell
     into. */
  t.check(/if\(existing\)\{ existing\.qty = \(Number\(existing\.qty\)\|\|0\) \+ 1; \}/.test(add),
    'and picking the same thing twice adds one more rather than a second identical line');

  const reset = (/function resetCashTxnForms[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/tillSaleLines = \[\]/.test(reset),
    'the basket is cleared, or the next sale inherits the last one\'s items');

  const sync = (/function tillSyncAmountFromSale[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* The amount following the items is what makes recording the sale
     FASTER than not recording it -- which is the whole reason anybody
     will do it while a customer waits. */
  t.check(/if\(!tillSaleLines\.length\) return;/.test(sync),
    'an empty basket leaves a typed amount alone rather than zeroing it');
  t.check(/amount\.value = tillGroup\(String\(Math\.round\(tillSaleTotal\(\)\)\)\)/.test(sync),
    'and the amount fills itself from the items, grouped like anything else typed there');
}

/* ---------- 4. wired through to the record --------------------------- */
{
  /* A saved quote is a DENSE id kind: the number is printed on the
     shop's paperwork, so a gap in the sequence is a gap in their invoice
     book. allocRowId refuses dense kinds by design — but both issuers
     are stubbed in this file, so only the source can say which is used. */
  const build = (/async function tillBuildSaleQuote[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/id: await issueRowId\('savedQuote'\),/.test(build),
    'the invoice number is issued densely, from the server counter');
  t.check(!/allocRowId\('savedQuote'\)/.test(code),
    'and never from a local block, which would gap the shop\'s invoice numbers');

  t.check(/quote_id: t\.quoteId==null \? null : t\.quoteId/.test(code), 'the link is saved');
  t.check(/quoteId: t\.quote_id==null \? null : Number\(t\.quote_id\)/.test(code), 'and loaded');
  t.check(/add column quote_id bigint/.test(read('supabase/migrations/0047_counter_sales.sql')),
    'with a migration behind it');
}
