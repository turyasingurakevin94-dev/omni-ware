#!/usr/bin/env node
'use strict';
/*
 * What was on the sale, and what we made on it.
 *
 * The assistant could read an invoice's envelope -- number, date, total,
 * paid, still due -- and nothing inside it. Asked to list the items a
 * customer took and the prices she was given, it answered that it could
 * not and sent the owner to the Invoices screen. The lines were on the
 * record the whole time; no tool handed them over. invoiceLineRows and
 * invoiceLineReading are that hand-over, and this file guards the two
 * places it can lie.
 *
 *   the price      A line with no price typed on it is priced by the
 *                  markup rule at the moment of sale. Read straight off
 *                  it.sellPrice it comes back EMPTY, and the shop is
 *                  reported to have charged nothing for goods it sold.
 *                  So the price always comes through quoteItemSellPrice,
 *                  the same function the invoice itself totals with, and
 *                  `priced` says which of the two happened -- because
 *                  "we gave her 1,300" and "the rule gave her 1,300" are
 *                  different answers and only one of them was a decision.
 *
 *   the cost       it.price is what the goods cost us and it is
 *                  genuinely absent on some lines -- stock counted in
 *                  before it was costed is the ordinary way. Read as
 *                  zero, such a line becomes pure profit: the most
 *                  flattering lie these books could tell, on the exact
 *                  question an owner asks before repeating a price. An
 *                  uncosted line therefore reports null, is COUNTED, and
 *                  withholds the invoice's profit entirely.
 *
 * Run: node test/invoice-lines.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('invoice lines');
const src = read('index.html');

const data = { customers: [], products: [], savedQuotes: [] };

const scope = compileScope([
  extractDeclaration(src, 'apRound', 'index.html'),
  extractDeclaration(src, 'AP_INVOICE_LINES_MAX', 'index.html'),
  extractFunction(src, 'orderCreditTerms', 'index.html'),
  extractFunction(src, 'orderCreditCharge', 'index.html'),
  extractFunction(src, 'savedQuoteCashTotal', 'index.html'),
  extractFunction(src, 'orderChargesTotal', 'index.html'),
  extractFunction(src, 'orderCharges', 'index.html'),
  extractFunction(src, 'chargeAmount', 'index.html'),
  extractFunction(src, 'savedQuoteGoodsTotal', 'index.html'),
  extractFunction(src, 'invoiceNumberLabel', 'index.html'),
  extractFunction(src, 'savedQuoteTotal', 'index.html'),
  extractFunction(src, 'invoiceBalanceDue', 'index.html'),
  /* The real pricing chain, not a stand-in. The whole point of `priced`
     is that it distinguishes a typed price from a rule's price, and a
     stubbed sell price cannot tell those apart. */
  /* Which side of the trade a line is sold at, and the two functions
     behind that reading. Compiled in rather than stubbed: whether the
     wholesale markup is the one that applies is the whole subject of
     this file, and a stub would answer it before the test does. */
  extractFunction(src, 'tiersForKind', 'index.html'),
  extractFunction(src, 'tieredUnitPrice', 'index.html'),
  extractFunction(src, 'purchaseSideAtQty', 'index.html'),
  extractFunction(src, 'sellSideFor', 'index.html'),
  extractFunction(src, 'effectiveMarkupRule', 'index.html'),
  extractFunction(src, 'effectiveStockMarkupRule', 'index.html'),
  extractFunction(src, 'suggestedSellingPrice', 'index.html'),
  extractFunction(src, 'suggestedStockSellingPrice', 'index.html'),
  extractFunction(src, 'quoteSuggestedPrice', 'index.html'),
  extractFunction(src, 'quoteSuggestedStockPrice', 'index.html'),
  extractFunction(src, 'quoteItemSellPrice', 'index.html'),
  extractFunction(src, 'invoiceLineRows', 'index.html'),
  extractFunction(src, 'invoiceLineReading', 'index.html'),
  'function names(){ return {AP_INVOICE_LINES_MAX}; }',
], { data }, ['invoiceLineRows', 'invoiceLineReading', 'quoteItemSellPrice', 'names']);

const { invoiceLineRows, invoiceLineReading, names } = scope;
const { AP_INVOICE_LINES_MAX } = names();

const line = (o) => Object.assign({
  productId: 1, variantIdx: null, productName: 'Item', unit: 'Pc',
  packUnit: '', packQty: 0, qty: 1, supplierId: 9, supplierName: 'Karddia',
  price: 1000, sellPrice: 1500 }, o);

const invoice = (o) => Object.assign({
  id: 230, invoiced: true, voided: false, invoicedAt: '2026-08-26',
  invoicedTs: Date.parse('2026-08-26'), date: '2026-08-26',
  client: { name: 'Joan JEZONA' }, customerId: 7, amountPaid: 0, items: [] }, o);

/* ---------- 1. the lines behind the total ----------------------------- */
{
  const q = invoice({ amountPaid: 800000, items: [
    line({ productName: 'Cement OPC', unit: 'Bag', qty: 40, price: 32000, sellPrice: 36000 }),
    line({ productName: 'Iron sheets G28', unit: 'Pc', qty: 12, price: 21000, sellPrice: 25000 }),
    line({ productName: 'Nails 4"', unit: 'Kg', qty: 10, price: 5000, sellPrice: 6000 }),
  ] });
  const r = invoiceLineReading(q);

  t.check(r.invoice === 'INV-0230', 'the sale comes back under the number the shop writes on it');
  t.check(r.customer === 'Joan JEZONA' && r.customer_id === 7, 'and under whose sale it was');
  t.check(r.line_count === 3 && r.lines.length === 3, 'three lines went out, three lines come back');

  const cement = r.lines[0];
  t.check(cement.product === 'Cement OPC' && cement.qty === 40 && cement.unit === 'Bag',
    'what she took, how many, in what unit');
  t.check(cement.price_each === 36000, 'at the price we gave her, not the price we paid');
  t.check(cement.line_total === 40 * 36000, 'and what that line came to');
  t.check(cement.cost_each === 32000 && cement.made_on_it === 40 * 4000,
    'with what it cost us beside it, and what the line made');

  const sales = 40 * 36000 + 12 * 25000 + 10 * 6000;
  const cost = 40 * 32000 + 12 * 21000 + 10 * 5000;
  t.check(r.total === sales, 'the invoice total is the lines added up');
  t.check(r.lines.reduce((s, l) => s + l.line_total, 0) === r.total,
    'and the lines add up to the invoice total — a reading that cannot disagree with the paper');
  t.check(r.cost_of_goods === cost && r.made_on_it === sales - cost,
    'what the whole sale cost and what the whole sale made');
  t.check(r.paid === 800000 && r.due === sales - 800000,
    'the money half is carried too, so one reading answers both halves of the question');
  t.check(r.lines_with_no_cost_on_record === 0, 'nothing was missing a cost');
  t.check(!('made_on_the_costed_lines' in r),
    'and no partial figure is offered when the whole one is honest');
}

/* ---------- 2. a price nobody typed still has to be reported ---------- */
{
  data.products = [{ id: 1, name: 'Cement OPC', retailMarkupType: 'percent', retailMarkupValue: 30 }];
  const q = invoice({ items: [
    line({ productName: 'Cement OPC', qty: 2, price: 1000, sellPrice: null }),
    line({ productName: 'Nails 4"', qty: 3, price: 5000, sellPrice: 7000 }),
  ] });
  const rows = invoiceLineRows(q);

  t.check(rows[0].price_each === 1300,
    'a line with no price typed on it is priced the way the invoice priced it — by the rule');
  t.check(rows[0].line_total === 2600, 'and the line total follows that same price');
  t.check(rows[0].priced === 'from the markup rule',
    'and it says the rule set that price — nobody decided it');
  t.check(rows[1].priced === 'typed in',
    'while a price somebody typed is named as somebody\'s decision');
  t.check(rows[0].made_on_it === 2 * 300, 'the rule-priced line still reports what it made');

  /* The defect this exists for: it.sellPrice read raw is null here, and
     null becomes 0, and the shop is reported to have given away cement. */
  t.check(rows[0].price_each > 0,
    'an empty sell price is never reported as a price of nothing');
  data.products = [];
}

/* ---------- 3. which side of the pack size the quantity fell on ------- */
{
  const q = invoice({ items: [
    line({ productName: 'Cement OPC', qty: 12, packQty: 12, packUnit: 'Bag', unit: 'Pc' }),
    line({ productName: 'Cement OPC', qty: 5, packQty: 12, packUnit: 'Bag', unit: 'Pc' }),
    line({ productName: 'Nails 4"', qty: 5, packQty: 0, packUnit: '' }),
  ] });
  const rows = invoiceLineRows(q);

  t.check(rows[0].pack === '12 per Bag' && rows[0].qty_side === 'wholesale',
    'a pack or more is the wholesale side of the pack size');
  t.check(rows[1].qty_side === 'retail', 'less than a pack is the retail side');
  t.check(!('qty_side' in rows[2]) && !('pack' in rows[2]),
    'and a line with no pack size on file claims no side at all — there is nothing to be a side of');
}

/* ---------- 4. a cost that is not on record is never worth zero ------- */
{
  const q = invoice({ items: [
    line({ productName: 'Cement OPC', qty: 10, price: 32000, sellPrice: 36000 }),
    /* Counted onto the shelf before anyone costed it — the ordinary way
       a live book carries an uncosted line. */
    line({ productName: 'Timber 4x2', qty: 4, price: 0, sellPrice: 25000 }),
  ] });
  const r = invoiceLineReading(q);
  const bad = r.lines[1];

  t.check(bad.cost_each === null && bad.made_on_it === null,
    'a line with no cost on record reports no cost and no margin');
  t.check(bad.no_cost_on_record === true, 'and says so on its own row');
  t.check(bad.price_each === 25000 && bad.line_total === 100000,
    'while what she was charged for it is known and still reported');
  t.check(r.lines_with_no_cost_on_record === 1,
    'the invoice counts it — named rather than dropped');

  t.check(r.made_on_it === null,
    'and the invoice withholds its profit entirely: one uncosted line and the total is not knowable');
  t.check(r.cost_of_goods === 10 * 32000,
    'the cost reported is only the cost that is on record');
  t.check(r.made_on_the_costed_lines === 10 * 4000,
    'the partial figure covers the costed lines against THEIR OWN sales — like compared with like');
  t.check(r.made_on_the_costed_lines !== (10 * 36000 + 100000) - (10 * 32000),
    'never the whole sale\'s takings against half the sale\'s costs, which would invent 100,000 of profit');
}

/* ---------- 5. a long sale is cut, and says where ---------------------- */
{
  const items = Array.from({ length: 50 }, (_, i) =>
    line({ productName: 'Item ' + (i + 1), qty: 1, price: 1000, sellPrice: 2000 }));
  const r = invoiceLineReading(invoice({ items }));

  t.check(AP_INVOICE_LINES_MAX === 40, 'forty lines is the cap — a result is re-billed on every following turn');
  t.check(r.lines.length === AP_INVOICE_LINES_MAX, 'a fifty-line sale comes back as forty rows');
  t.check(r.line_count === 50 && r.lines_not_shown === 10,
    'with the true count and what was cut, so nothing goes missing in silence');
  t.check(r.total === 50 * 2000 && r.cost_of_goods === 50 * 1000 && r.made_on_it === 50 * 1000,
    'while the money covers all fifty — a truncated list must never shrink the sale');
}

/* ---------- 6. a sale that is not an ordinary sale says so ------------- */
{
  const voided = invoiceLineReading(invoice({ voided: true, items: [line({})] }));
  t.check(voided.voided === true, 'a cancelled sale is found and flagged, never quietly reported as a sale');

  const draft = invoiceLineReading(invoice({ invoiced: false, invoicedAt: null, items: [line({})] }));
  t.check(draft.not_invoiced_yet === true,
    'and a quote that was never invoiced is named as one — the lines are real, the sale is not yet');

  const live = invoiceLineReading(invoice({ items: [line({})] }));
  t.check(!('voided' in live) && !('not_invoiced_yet' in live),
    'while an ordinary sale carries neither flag');
}

/* ---------- 7. an empty sale is an answer, not a crash ----------------- */
{
  const r = invoiceLineReading(invoice({ items: [] }));
  t.check(r.line_count === 0 && r.lines.length === 0 && r.total === 0,
    'an invoice with no lines reads as an invoice with no lines');
  t.check(r.made_on_it === 0 && r.lines_with_no_cost_on_record === 0,
    'and nothing is uncosted, because there is nothing');
}

process.exit(t.done() ? 1 : 0);
