#!/usr/bin/env node
'use strict';
/*
 * When they said they'd pay.
 *
 * The chase message this app writes ends "Please let us know when we can
 * expect payment" -- and there was nowhere to write down the answer.
 * Three things followed from that hole:
 *
 *   - the queue rang again three days later whatever the customer said,
 *     so a customer who promised the 20th was chased on the 12th;
 *   - the cash forecast had only outgoings on its line, because a
 *     debtor's money carried an age and never a date;
 *   - and a broken promise left no trace, which is the one thing about
 *     promises worth keeping: the SECOND time somebody breaks one is a
 *     fact about the customer, not about the day.
 *
 * Four laws hold this together:
 *
 *   A LEDGER, NOT A STAMP  somebody who promises Friday, misses it and
 *       then promises Tuesday is telling you something no single field
 *       per customer can hold. Each promise is its own row and is never
 *       rewritten; a changed mind is a SECOND promise.
 *   THE STATE IS DERIVED, NEVER STORED  kept, broken or waiting is
 *       worked out from the debt ledger every time it is read. A stored
 *       verdict and a ledger that disagreed with it is exactly the
 *       drift this app has already had to write a repair banner for.
 *   NEWS OUTRANKS SILENCE  a broken promise goes to the FRONT of the
 *       chase queue whatever the rest period says, and a promise still
 *       waiting takes its customer out of the queue entirely.
 *   A DEBTOR'S WORD IS NOT THE SHOP'S MONEY  the forecast shows it in a
 *       band of its own and never in safe to spend. (That one is tested
 *       where the danger is, in cash-ahead.test.js.)
 *
 * Run: node test/payment-promises.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('payment promises');
const src = read('index.html');
const sql = read('supabase/migrations/0089_payment_promises.sql');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';
const ago = (days) => new Date(Date.parse(TODAY + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);
const on = (days) => new Date(Date.parse(TODAY + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);

(async () => {

/* ---------- 1. the table ---------------------------------------------- */
{
  t.check(/create table payment_promises/.test(sql), '0089 creates the table');
  t.check(/primary key \(shop_id, id\)/.test(sql),
    'keyed by shop and row id — the same block scheme every other synced table uses');
  ['customer_id', 'promised_on', 'made_on', 'amount', 'note'].forEach((c) =>
    t.check(new RegExp(`\\n  ${c}\\b`).test(sql), `it carries ${c}`));
  t.check(/promised_on date not null/.test(sql),
    'the day they named is the whole point, so it cannot be absent');
  t.check(/made_on date not null/.test(sql),
    'and the day they said it, which is what makes the promise readable later');
  t.check(/amount numeric check \(amount is null or amount > 0\)/.test(sql),
    'a named figure must be a real one, and null is allowed because it means "the balance"');
  t.check(!/references customers/.test(sql),
    'no FK to customers: deleting one must not silently erase what they promised, it should stop resolving');

  t.check(/alter table payment_promises enable row level security/.test(sql),
    'row level security is on — without it the policies below are decoration');
  t.check(/create policy "shop members full access" on payment_promises/.test(sql),
    'members of the shop can read it');
  t.check(/create policy "owner writes only" on payment_promises\s*\n\s*as restrictive for insert/.test(sql),
    'only the owner writes one — a promise decides whether a customer is chased, so it is guarded like the money it forecasts');
  t.check(/create policy "owner only deletes" on payment_promises\s*\n\s*as restrictive for delete/.test(sql),
    'and only the owner deletes one');
  t.check(/create policy "owner updates only" on payment_promises\s*\n\s*as restrictive for update/.test(sql),
    'and only the owner could amend one, though nothing in the app does');
  t.check(/'row:payment_promise'/.test(sql) && /entity_id_counters/.test(sql),
    'the id counter is seeded, or the first promise on a live shop has no id to take');
  t.check(/on conflict \(shop_id, kind\) do nothing/.test(sql),
    'and seeding twice is not an error — the file is pasted by hand and may be pasted again');
}

/* ---------- 2. kept, broken, or still waiting ------------------------- */
/*
 * The truth table, against a REAL ledger. Every one of these is a
 * question a shop asks out loud, and getting any of them wrong means
 * either chasing somebody who paid or trusting somebody who did not.
 */
const MODEL = ['promisesFor', 'promiseState', 'promiseLatest', 'promisesBroken'];
const modelData = { customers: [], paymentPromises: [] };
let model = null; let modelErr = null;
try {
  model = compileScope(MODEL.map((n) => extractFunction(src, n, 'index.html')),
    { data: modelData, todayISO: () => TODAY, Number, String, Math, Array, Object, Boolean }, MODEL);
} catch (e) { modelErr = e; }
t.check(!!model, `the promise model compiles${modelErr ? ` (${modelErr.message})` : ''}`);

if (model) {
  const cust = (debt, log) => ({ id: 'C1', name: 'Mulongo', debt, debtLog: log || [] });
  const pr = (over) => Object.assign({ id: 1, customerId: 'C1', promisedOn: ago(7), madeOn: ago(12), amount: 500000 }, over || {});
  const pay = (date, amount) => ({ type: 'payment', date, amount });
  const state = (promise, customer) => model.promiseState(promise, customer, TODAY);

  eq(state(pr({ promisedOn: on(3) }), cust(500000)), 'waiting',
    'a day that has not come is WAITING — nobody is called a liar in advance');
  eq(state(pr({ promisedOn: TODAY }), cust(500000)), 'waiting',
    'and the day itself is still waiting: nobody is called a liar at nine in the morning on the day they named');
  eq(state(pr(), cust(500000)), 'broken',
    'a day that has gone with nothing paid is BROKEN');
  eq(state(pr(), cust(0)), 'kept',
    'owing nothing keeps any promise about paying, whatever the ledger says about which shilling settled which charge');
  eq(state(pr(), cust(300000, [pay(ago(8), 500000)])), 'kept',
    'paying what they said, before the day they said it, is KEPT even while a later balance is outstanding');
  eq(state(pr(), cust(300000, [pay(ago(7), 500000)])), 'kept',
    'and paying ON the day is keeping it');

  /* THE FOUR WAYS A PAYMENT DOES NOT COUNT. Each of these read as kept
     in an earlier shape of this check, and each would have quietly
     excused somebody who never paid. */
  eq(state(pr(), cust(300000, [pay(ago(5), 500000)])), 'broken',
    'money that arrives AFTER the day they named does not keep the promise — it is a late payment, which is a different thing');
  eq(state(pr(), cust(300000, [pay(ago(20), 500000)])), 'broken',
    'nor does money paid BEFORE they even made the promise');
  eq(state(pr(), cust(300000, [pay(ago(8), 400000)])), 'broken',
    'nor short of what they said');
  eq(state(pr({ amount: null }), cust(300000, [pay(ago(8), 400000)])), 'broken',
    'and naming no figure means THE BALANCE — a part payment does not keep a promise to clear it');

  eq(state(pr(), cust(300000, [pay(ago(9), 200000), pay(ago(8), 300000)])), 'kept',
    'two payments inside the window add up, because that is what the customer did');

  /* Derived, never stored: a state written onto the row could not do
     this, and the row itself says nothing about being kept. */
  const row = pr();
  modelData.customers = [cust(500000)];
  modelData.paymentPromises = [row];
  eq(model.promiseLatest('C1', TODAY).state, 'broken', 'unpaid, the promise reads broken');
  modelData.customers = [cust(300000, [pay(ago(8), 500000)])];
  eq(model.promiseLatest('C1', TODAY).state, 'kept',
    'and the SAME row reads kept once the payment is in the ledger — nothing was rewritten, so nothing can drift');
  t.check(!('state' in row),
    'the stored row carries no state of its own, which is the only way that can be true');

  /* A LEDGER. */
  modelData.customers = [cust(500000)];
  modelData.paymentPromises = [
    pr({ id: 1, promisedOn: ago(20), madeOn: ago(25) }),
    pr({ id: 2, promisedOn: ago(7), madeOn: ago(12) }),
    pr({ id: 3, promisedOn: on(4), madeOn: ago(1) }),
  ];
  eq(model.promisesFor('C1').length, 3, 'every promise is kept, not just the last');
  eq(model.promisesFor('C1')[0].id, 3, 'newest first, so the latest word is the one read');
  eq(model.promiseLatest('C1', TODAY).state, 'waiting', 'and it is the one that decides today');
  eq(model.promisesBroken('C1', TODAY), 2,
    'while the two they broke are still counted — one is a bad week, the third is the customer');
  eq(model.promisesFor('C2').length, 0, 'a customer who has promised nothing has nothing');

  modelData.paymentPromises = [pr({ promisedOn: '' }), pr({ id: 2, promisedOn: 'soon' })];
  eq(model.promisesFor('C1').length, 0,
    'a row with no real date is not a promise — it would otherwise sort to the top and decide the queue');
}

/* ---------- 3. writing one down --------------------------------------- */
{
  const data = { customers: [{ id: 'C1', name: 'Mulongo', debt: 500000, debtLog: [] }], paymentPromises: [], nextPaymentPromiseId: 1 };
  let saved = 0; let issued = 0;
  const build = (tableThere) => compileScope(
    ['promisesFor', 'promiseState', 'promiseLatest', 'addPaymentPromise', 'deletePaymentPromise']
      .map((n) => extractFunction(src, n, 'index.html')),
    { data, todayISO: () => TODAY, saveData: () => { saved++; },
      allocRowId: () => { issued += 1; return issued; },
      paymentPromisesTable: tableThere,
      Number, String, Math, Array, Object, Boolean, Date },
    ['addPaymentPromise', 'deletePaymentPromise', 'promisesFor', 'promiseLatest']);

  const w = build(true);
  eq(w.addPaymentPromise('C1', on(6), 200000, '').ok, true, 'a day and a figure are written down');
  eq(saved, 1, 'and saved, so the other device sees it');
  eq(data.paymentPromises[0].promisedOn, on(6), 'the day they named');
  eq(data.paymentPromises[0].madeOn, TODAY, 'and the day they said it, which nobody has to type');
  eq(data.paymentPromises[0].amount, 200000, 'with the figure');

  eq(w.addPaymentPromise('C1', on(6), 0, '').ok, true, 'no figure is allowed');
  eq(data.paymentPromises[1].amount, null,
    'and is stored as null rather than nought — nought would read as a promise to pay nothing');

  /* ADDED, NEVER REPLACED. Overwriting is the whole defect this table
     exists to avoid, and it is invisible: the screen looks right. */
  eq(data.paymentPromises.length, 2, 'a second promise is a second ROW');
  eq(w.promisesFor('C1').length, 2, 'so the first is still there to be read');

  eq(w.addPaymentPromise('C9', on(6), 0, '').ok, false, 'a promise needs a customer who exists');
  const noDay = w.addPaymentPromise('C1', 'next week', 0, '');
  eq(noDay.ok, false, '"next week" is not a day');
  t.check(/needs the day they said/.test(noDay.why), 'and says why, rather than saving something useless');
  eq(data.paymentPromises.length, 2, 'neither refusal wrote anything');

  const noTable = build(false).addPaymentPromise('C1', on(6), 0, '');
  eq(noTable.ok, false, 'and a shop that has not run 0089 is told so rather than losing the promise on the next reload');
  t.check(/0089_payment_promises\.sql/.test(noTable.why), 'naming the file to paste');

  w.deletePaymentPromise(data.paymentPromises[0].id);
  eq(data.paymentPromises.length, 1, 'a promise entered against the wrong customer can be removed');
  eq(saved, 3, 'and that is saved too');
  t.check(!/function deletePaymentPromise[\s\S]{0,400}promisedOn\s*=/.test(src),
    'but nothing EDITS one — a changed mind is a new row beside the old, which is the record worth keeping');
}

/* ---------- 4. the chase queue honours it ----------------------------- */
const charge = (id, days, amount, quoteId) => ({ id, date: ago(days), type: 'charge', amount, quoteId, note: '' });
const chaseData = {
  presetChaseAfterDays: 7,
  presetChaseRestDays: 3,
  presetDebtChases: {},
  paymentPromises: [],
  customers: [
    { id: 'C1', name: 'Mulongo', phone: '0772 111 222', location: '', debt: 2450000,
      debtLog: [charge(1, 95, 2450000, 11)] },
    { id: 'C2', name: 'Birimuye', phone: '0700 333 444', location: '', debt: 800000,
      debtLog: [charge(4, 35, 800000, 13)] },
    { id: 'C3', name: 'David', phone: '', location: '', debt: 300000,
      debtLog: [charge(5, 33, 300000, 14)] },
  ],
  savedQuotes: [
    { id: 11, customerId: 'C1', invoiced: true, voided: false, invoicedAt: ago(95), amountPaid: 0, items: [{ qty: 1, sellPrice: 2450000, price: 0 }] },
    { id: 13, customerId: 'C2', invoiced: true, voided: false, invoicedAt: ago(35), amountPaid: 0, items: [{ qty: 1, sellPrice: 800000, price: 0 }] },
    { id: 14, customerId: 'C3', invoiced: true, voided: false, invoicedAt: ago(33), amountPaid: 0, items: [{ qty: 1, sellPrice: 300000, price: 0 }] },
  ],
};
let chase = null; let chaseErr = null;
try {
  chase = compileScope([
    'debtChaseRows', 'debtChaseInvoices', 'debtChaseMessage',
    'promisesFor', 'promiseState', 'promiseLatest', 'promisesBroken',
    'debAllRows', 'customerOpenCharges', 'customerOldestOpenChargeDate',
    'customerDebtProgress', 'customerDebtDrift', 'customerLedgerTotal', 'customerOrdersFor',
    'invoiceBalanceDue', 'invoiceNumberLabel', 'agingBandFor', 'agingDaysLabel', 'daysSinceDate',
  ].map((n) => extractFunction(src, n, 'index.html'))
    .concat([
      extractDeclaration(src, 'AGING_BANDS', 'index.html'),
      extractDeclaration(src, 'DEBT_CHASE_INVOICE_LINES', 'index.html'),
    ]), {
    data: chaseData,
    todayISO: () => TODAY,
    saveData: () => {},
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    fmtShortDate: (iso) => String(iso),
    savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
    customerLastPaymentDate: () => null,
  }, ['debtChaseRows', 'debtChaseMessage']);
} catch (e) { chaseErr = e; }
t.check(!!chase, `the chase queue compiles with the promise model${chaseErr ? ` (${chaseErr.message})` : ''}`);

if (chase) {
  chaseData.paymentPromises = [];
  eq(chase.debtChaseRows().due.map((r) => r.name).join(','), 'Mulongo,Birimuye,David',
    'with nothing said, the queue is oldest band first and biggest inside it');

  /* THEY SAID A DAY, AND IT HAS NOT COME. */
  chaseData.paymentPromises = [{ id: 1, customerId: 'C1', promisedOn: on(4), madeOn: TODAY, amount: null }];
  let q = chase.debtChaseRows();
  t.check(!q.due.some((r) => r.id === 'C1'),
    'a customer waiting on a day they named is NOT chased — ringing them on the 12th about money promised on the 20th teaches a shop’s customers that what they say makes no difference');
  eq(q.promised.map((r) => r.name).join(','), 'Mulongo', 'they are held in their own bucket');
  eq(q.promised[0].promise.promisedOn, on(4), 'carrying what they actually said');
  eq(q.due.length, 2, 'and the rest of the queue is untouched');

  /* NEWS OUTRANKS SILENCE. */
  chaseData.paymentPromises = [{ id: 1, customerId: 'C3', promisedOn: ago(2), madeOn: ago(9), amount: null }];
  q = chase.debtChaseRows();
  eq(q.promised.length, 0, 'a day that has gone is not still waiting');
  eq(q.due[0].name, 'David',
    'and a BROKEN promise goes to the front of the queue over debt three times older and eight times bigger — the last conversation ended in a date that has now passed, which is news, and news outranks silence');
  eq(q.due[0].promise.state, 'broken', 'the row saying so');
  eq(q.due.length, 3, 'with nobody dropped');

  /* Rest does not shelter a broken promise. */
  chaseData.presetDebtChases = { C3: ago(1) };
  q = chase.debtChaseRows();
  eq(q.due[0].name, 'David',
    'and resting does not shelter them: somebody chased yesterday who then broke their word is chased again today');
  chaseData.presetDebtChases = {};

  /* WHAT THEY THEMSELVES SAID, quoted back. */
  const msg = chase.debtChaseMessage(q.due[0], { name: 'Omni Ware', phone: '0700 000 000' });
  t.check(msg.indexOf('You told us on ' + ago(9)) >= 0,
    'the message quotes the day they said it');
  t.check(msg.indexOf('settled by *' + ago(2) + '*') >= 0, 'and the day they promised');
  t.check(/Please let us know today when it will reach us/.test(msg),
    'and stops asking a question they have already answered');
  t.check(!/Please let us know when we can expect payment/.test(msg),
    'which is the sentence that had nowhere to put its own answer');

  const plain = chase.debtChaseMessage(q.due[1], { name: 'Omni Ware', phone: '0700 000 000' });
  t.check(/Please let us know when we can expect payment/.test(plain),
    'while somebody who has said nothing is still asked');
  t.check(!/You told us on/.test(plain), 'and nothing is quoted back at them that they never said');

  /* Counted, not just noticed. */
  chaseData.paymentPromises = [
    { id: 1, customerId: 'C3', promisedOn: ago(20), madeOn: ago(25), amount: null },
    { id: 2, customerId: 'C3', promisedOn: ago(2), madeOn: ago(9), amount: null },
  ];
  eq(chase.debtChaseRows().due[0].brokenPromises, 2,
    'and the row carries how many they have broken, which is the fact worth having about a repeat');
}

/* ---------- 5. the screen --------------------------------------------- */
{
  const panel = extractFunction(src, 'renderChaseScreen', 'index.html');
  t.check(/They promised…/.test(panel),
    'the button sits on the card, beside Received payment — where the conversation just happened');
  t.check(/chase-promise/.test(panel) && /addPaymentPromise\(/.test(panel),
    'and writes a real row');
  t.check(/Said when they would pay/.test(panel),
    'the ones waiting are shown, so the queue’s silence about them is visible rather than mysterious');
  t.check(/chase-unpromise/.test(panel) && /deletePaymentPromise\(/.test(panel),
    'with a way to take back one entered by mistake');
  t.check(/has broken \$\{r\.brokenPromises\} before/.test(panel) || /broken \$\{r\.brokenPromises\}/.test(panel)
    || /r\.brokenPromises/.test(panel),
    'and a repeat offender is named as one');
  t.check(/confirm\(/.test(panel.slice(panel.indexOf('chase-unpromise'))) || /confirm\('Remove that promise/.test(panel),
    'removing one is confirmed — it is a record of something somebody said, not a scratch note');

  const ahead = extractFunction(src, 'renderAhead', 'index.html');
  t.check(/Not counted in what is safe to spend/.test(ahead),
    'and the forecast says out loud that the buying budget has not moved for any of it');
  t.check(!/there is nowhere to write it down/.test(src),
    'while the screens that used to say there was nowhere to write this down no longer say it');
}

/* ---------- 6. it survives a reload ----------------------------------- */
/*
 * A promise that lives only in the browser is a promise the shop loses.
 * The four places a synced collection has to appear, each of which has
 * been forgotten for some other table at some point in this app's life.
 */
{
  t.check(/sel\('payment_promises'\)/.test(src), 'the loader asks for the table');
  t.check(/paymentPromises: promiseRows\.map/.test(src), 'and reads its rows into the shop');
  t.check(/paymentPromises: \(d\.paymentPromises\|\|\[\]\)\.map/.test(src), 'the push writes them back');
  t.check(/addDiffOps\(ops, 'paymentPromises', 'payment_promises', 'id', shopId/.test(src),
    'row by row, so a stale device can add a promise but never unwrite one');
  t.check(/const absent = \[[^\]]*'paymentPromises'/.test(src),
    'and an absent collection is BENCHED, not read as an instruction to delete every promise on file');
  t.check(/paymentPromise:\s*\{kind:'row:payment_promise',\s*counter:'nextPaymentPromiseId'\}/.test(src),
    'ids come from the shop-wide counter, so two devices cannot issue the same one');
  t.check(/paymentPromisesTable = !\(paymentPromisesR && paymentPromisesR\.error\)/.test(src),
    'and the app knows whether the table is really there, rather than finding out by losing a write');
}

})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
