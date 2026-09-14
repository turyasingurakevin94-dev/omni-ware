#!/usr/bin/env node
'use strict';
/*
 * WHAT THE WAITING COSTS.
 *
 * The shop was already a lender and did not know it: goods left the door
 * today and the money came back in ninety days, at the same price either
 * way. That is margin handed to whoever pays last, and on the design
 * figures it is the largest single number available for the least work.
 *
 * So an order now has two prices. Taking the shop's terms adds its rate
 * as a line on the bill -- charged on the WHOLE amount being waited for,
 * goods and charges alike -- and the rate is frozen onto the order the
 * moment it is agreed.
 *
 * What this file defends, in order of how much money is behind it:
 *
 *   - the arithmetic, including what the percent resolves against
 *   - that the term is the shop's ONE term, not a second one that could
 *     disagree with the queue that chases for it
 *   - that the rate on a raised bill never moves when the shop's does
 *   - that the credit reaches every document through one list
 *   - that the books keep it apart from service income, and give it no
 *     cost of sales it cannot justify
 *   - that the debt book can say what the unpriced part is costing
 *
 * Run: node test/credit-terms.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('credit terms');
const src = read('index.html');
const eq = (got, want, msg)=> t.check(got === want, `${msg} (got ${got}, want ${want})`);

const NAMES = ['orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderChargesTotal',
  'orderChargeLines', 'shopCreditPct', 'custTermsDays', 'orderTakesCredit', 'orderCreditTerms',
  'savedQuoteCashTotal', 'orderCreditCharge', 'creditTermLabel', 'orderCreditOffer',
  'setOrderCredit', 'orderBillLines', 'savedQuoteTotal', 'invoiceBalanceDue',
  'invoiceOpenDays', 'creditBookReading', 'anInvoiceTotals'];

/* The shop's own settings and its book of paper, bound live: the rate is
   changed inside a section below and the readers must notice. */
const store = { presetCreditPct: 3, presetChaseAfterDays: 30, savedQuotes: [], cashTxns: [] };

const s = compileScope(NAMES.map((n)=> extractFunction(src, n, 'index.html')), {
  data: store,
  todayISO: ()=> '2026-09-13',
  quoteItemSellPrice: (it)=> Number(it.sellPrice) || 0,
  // What a line COST is not this file's subject; every fixture prices
  // its own goods so the arithmetic is checkable by eye.
  invoiceLineCost: (it)=> ({ cost: (Number(it.qty)||0) * (Number(it.price)||0), estimatedQty: 0 }),
}, NAMES);

// 155,000 of goods and a 5,000 delivery: 160,000 before anybody waits.
const order = (over)=> Object.assign({
  id: 1, items: [{ productId:'P1', qty:1, price:145000, sellPrice:155000 }],
  charges: [{ id:1, service:'Transport', label:'Transport', type:'fixed', value:5000 }],
  credit: null, amountPaid: 0,
}, over || {});
const onTerms = { pct: 3, days: 30, agreedAt: '2026-09-13' };

/* ---------- 1. the two prices ------------------------------------------ */
{
  const cash = order();
  eq(s.savedQuoteCashTotal(cash), 160000, 'what it comes to if they pay now is the goods and the charges');
  eq(s.savedQuoteTotal(cash), 160000, 'and with no credit on it that is the whole bill');
  eq(s.orderCreditCharge(cash), 0, 'nothing is charged for a wait nobody asked for');

  const later = order({ credit: onTerms });
  /* THE RATE RESOLVES AGAINST THE WHOLE BILL, not against the goods.
     A delivery invoiced today and paid for in ninety days is financed
     exactly like the cement that rode on the same lorry, and a percent
     that skipped it would under-charge by the charge. */
  eq(s.orderCreditCharge(later), 4800, '3% of 160,000 is 4,800 — the charges are financed too, not just the goods');
  eq(s.savedQuoteTotal(later), 164800, 'so the client pays the credit price');
  eq(s.savedQuoteCashTotal(later), 160000,
    'while the cash price is still there to be said out loud, not worked out by subtraction');
}

/* ---------- 2. the term is the shop's ONE term ------------------------- *
 * custTermsDays() already answers "who is late" for the money queue and
 * the customer book. A credit term of its own would be a second figure
 * also called "your terms", and the shop would chase money it had just
 * sold thirty days of.
 */
{
  eq(s.custTermsDays(), 30, 'the term comes from the shop’s own chase rule');
  t.check(/function custTermsDays\(\)\{ return Math\.max\(0, Number\(data\.presetChaseAfterDays\) \|\| 0\); \}/.test(src),
    'which is one figure, read in one place');
  t.check(!/presetCreditDays/.test(src),
    'and there is no second days setting anywhere for the two to disagree about');

  const offer = s.orderCreditOffer(order());
  eq(offer.days, 30, 'the offer quotes that term');
  eq(offer.amount, 4800, 'and what taking it would add');
  eq(offer.total, 164800, 'so both prices are on the screen before anybody commits');

  store.presetChaseAfterDays = 45;
  eq(s.orderCreditOffer(order()).days, 45, 'change the chase rule and the credit offered follows it');
  store.presetChaseAfterDays = 30;
}

/* ---------- 3. frozen when agreed ------------------------------------- *
 * An invoice records what was agreed. Lifting the shop's rate next month
 * must not rewrite what a customer was billed for last month.
 */
{
  const q = order();
  t.check(s.setOrderCredit(q, true), 'agreeing credit takes the shop’s rate');
  eq(q.credit.pct, 3, 'and copies it onto the order');
  eq(q.credit.days, 30, 'with the term it was agreed for');

  store.presetCreditPct = 8;
  eq(s.orderCreditCharge(q), 4800, 'the shop’s new rate does not reach a bill already agreed at the old one');
  eq(s.orderCreditOffer(order()).pct, 8, 'while a fresh order is offered the new one');
  store.presetCreditPct = 3;

  t.check(s.setOrderCredit(q, false), 'and it can be taken back off');
  eq(s.savedQuoteTotal(q), 160000, 'which puts the client back on the cash price');
}

/* ---------- 4. no rate is a decision, not a gap ------------------------ *
 * A shop that has not priced its credit must not be lobbied on every
 * quote it writes, and must never offer "credit at 0 UGX" as though that
 * were a deal it meant to make.
 */
{
  store.presetCreditPct = 0;
  t.check(s.orderCreditOffer(order()) === null, 'with no rate set there is nothing to offer');
  t.check(s.setOrderCredit(order(), true) === false, 'and credit cannot be agreed at a rate nobody has set');
  store.presetCreditPct = 3;

  /* An agent's order is refused for the reason it is refused charges:
     the agent app works out what it owes from its own line prices. */
  t.check(s.orderTakesCredit(order()) === true, 'an ordinary order takes credit');
  t.check(s.orderTakesCredit(order({ originAgentId: 'A3' })) === false,
    'an agent’s order does not, because the agent app would never see it');
  t.check(s.orderCreditOffer(order({ originAgentId: 'A3' })) === null, 'so it is not even offered');
}

/* ---------- 5. what a document prints ---------------------------------- */
{
  const later = order({ credit: onTerms });
  const lines = s.orderBillLines(later);
  eq(lines.length, 2, 'the bill carries the charge and the credit');
  eq(lines[0].label, 'Transport', 'the charges come first');
  eq(lines[1].label, 'Credit — 30 days', 'and the credit last, named with the term that was taken');
  eq(lines[1].amount, 4800, 'in shillings, not as a rate');
  t.check(lines[1].credit === true, 'marked as what it is, for anything that needs to tell them apart');

  eq(s.orderBillLines(order()).length, 1, 'an order at the cash price prints no credit line at all');

  /* Every client-facing document draws from that one list, so one cannot
     print a credit line the next leaves out. */
  ['buildQuoteA5HTML', 'buildReceiptHTML', 'orderInvoiceCheckHTML'].forEach((fn)=>{
    t.check(/orderBillLines\(q\)/.test(extractFunction(src, fn, 'index.html')),
      `${fn} draws what it prints from the one bill list`);
  });
  t.check(/const chargeLines = q \? orderBillLines\(q\) : \[\];/.test(src),
    'and so does the message the sales group reads');

  /* The COST block is deliberately not on that list: asking what a
     financing fee cost the shop to provide is a question with no
     answer, and a row inviting one would be a row that cannot be filled
     in honestly. */
  const costBlock = extractFunction(src, 'orderChargeCostHTML', 'index.html');
  t.check(/orderCharges\(q\)/.test(costBlock) && !/orderBillLines/.test(costBlock),
    'while what the charges cost still reads the charges alone, never the credit');
}

/* ---------- 6. the books keep it apart -------------------------------- *
 * Service income has a cost behind it -- a fare handed to a driver.
 * Credit has none this book can see: what it costs the shop is the use
 * of its own money, which appears here only if it was borrowed, and then
 * it is already below as loan interest. Folding the two together would
 * put a figure with no cost under a line that has one.
 */
{
  const later = order({ credit: onTerms });
  const tot = s.anInvoiceTotals(later);
  eq(tot.sales, 155000, 'the goods are the goods');
  eq(tot.services, 5000, 'the charges are service income');
  eq(tot.credit, 4800, 'and the credit is its own figure');
  eq(tot.takings, 164800, 'which together are what the invoice took');
  eq(tot.cost, 145000, 'the cost is the goods’ alone');
  t.check(/const creditIncome = trade\.credit;/.test(src)
    && /const revenue = trade\.sales \+ serviceIncome \+ creditIncome;/.test(src),
    'the statement adds it into revenue as a line of its own');
  t.check(/const grossProfit = revenue - trade\.cost - costOfService;/.test(src),
    'and gives it no cost of sales — there is none to give it that could be justified');

  const pl = (/if\(key === 'pl:credit'\)[\s\S]{0,420}?\};/.exec(src) || [''])[0];
  t.check(/expect: is\.creditIncome/.test(pl) && /invoiceRows\('credit'\)/.test(pl),
    'the line opens onto the invoices that charged it');
  t.check(/\.filter\(q=> pick !== 'credit' \|\| orderCreditCharge\(q\) > 0\)/.test(src),
    'and leaves out the ones that did not, rather than listing every bill of the month at nought');
}

/* ---------- 7. what the unpriced credit is costing --------------------- *
 * The figure the shop has never been shown. Stated as ONE TERM of the
 * unpriced money at the shop's own rate: not annualised, not compounded,
 * not summed over how many terms it has really been out. Every number in
 * it can be checked by eye against a rate the owner set themselves,
 * which is the only way a figure like this earns being believed.
 */
{
  const inv = (id, date, credit)=> ({
    id, invoiced: true, voided: false, invoicedAt: date, date, amountPaid: 0, credit,
    items: [{ productId:'P1', qty:10, price:27500, sellPrice:32000 }], charges: [],
  });
  store.savedQuotes = [
    inv(401, '2026-09-10', onTerms),   // priced, inside the terms
    inv(402, '2026-06-01', null),      // unpriced, 104 days out
    inv(403, '2026-09-12', null),      // unpriced, one day out
    Object.assign(inv(404, '2026-09-01', null), { voided: true }),
    Object.assign(inv(405, '2026-09-01', null), { amountPaid: 320000 }),
  ];
  const r = s.creditBookReading();
  eq(r.priced, 329600, 'the priced part is the balance on the bills that charged for waiting');
  eq(r.charged, 9600, 'and what those bills charged');
  eq(r.unpriced, 640000, 'the rest is out at no charge');
  eq(r.out, 969600, 'and together they are the whole book');
  eq(r.forgone, 19200, 'one term of the unpriced at 3% is 19,200');
  eq(r.over, 320000, 'the part already past the shop’s own terms is named separately');
  eq(r.overCount, 1, 'with the count of bills behind it');
  t.check(!store.savedQuotes.some((q)=> q.voided && r.out > 969600),
    'a voided bill is not money anybody owes');

  /* An age nobody knows is not an age of nought -- the rule the aging
     bands already keep. It is counted and named, never quietly filed as
     inside the terms. */
  store.savedQuotes.push(Object.assign(inv(406, null, null), { invoicedAt: null, date: null }));
  const r2 = s.creditBookReading();
  eq(r2.undated, 320000, 'a balance with no date behind it is set aside, not aged at a guess');
  eq(r2.over, 320000, 'and never counted as past the terms on the strength of nothing');

  store.presetCreditPct = 0;
  eq(s.creditBookReading().forgone, 0,
    'with no rate set the panel claims no lost income — it has no rate to claim it at');
  store.presetCreditPct = 3;
  store.savedQuotes = [];
}

/* ---------- 8. it survives a save -------------------------------------- *
 * buildSyncRows names every field it sends, key by key. A field it does
 * not name is dropped on every save, silently, and the next load would
 * put a customer back on the cash price for a bill they agreed at the
 * credit one.
 */
{
  t.check(/credit:q\.credit\|\|null, savedAt:q\.savedAt,/.test(src),
    'the terms are named in the payload the sync sends');
  t.check(/charges:\[\], credit:null,\n\s*\.\.\.\(q\.payload\|\|\{\}\)/.test(src),
    'and in the defaults, so an order saved before credit existed reads back as a cash sale');
}

/* ---------- 9. the rate is set where it can be seen to bite ------------ *
 * This app keeps a rule beside the figure it changes. The price of
 * credit lives on Debtors, next to the book it prices, and The shop
 * READS it with the other rules that are set elsewhere.
 */
{
  t.check(/id="deb_credit_pct"/.test(src), 'the box is on the Debtors screen');
  const wire = extractFunction(src, 'wireDebCreditRate', 'index.html');
  t.check(/data\.presetCreditPct = \(Number\.isFinite\(v\) && v > 0 && v <= 100\) \? v : 0;/.test(wire)
    && /renderDebtorsPosition\(\)/.test(wire),
    'typing in it changes the rate and redraws the sentence under it');
  t.check(/\{ name:'Credit costs', tab:'analytics-debtors', where:'Debtors', unit:'%',/.test(src),
    'and The shop reads it, with a door back to where it is set');

  /* THE NAME COLLISION THIS BLOCK ALREADY CAUSED ONCE. .ow-ot-cr is the
     order row's open/close chevron, declared earlier in the layer; the
     credit block took the same name and, being declared later, turned
     every chevron in Order tracking into a bordered flex box. Nothing in
     the ratchets catches a duplicate -- a class with two rules is
     ordinary -- so it is pinned here, where the fault happened. */
  t.check(/\.ow-ot-cr\{width:12px;height:12px;/.test(src),
    'the order row’s chevron still owns .ow-ot-cr');
  t.check(/\.ow-ot-cred\{display:flex;/.test(src) && !/\.ow-ot-cr\{display:flex;/.test(src),
    'and the credit block answers to its own name, not over the top of it');
}

process.exit(t.done() ? 1 : 0);
