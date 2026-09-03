#!/usr/bin/env node
'use strict';
/*
 * A customer's balance and their own history must agree.
 *
 * The admin already knows they can drift: customerDebtDrift() compares the
 * stored balance against the sum of the debt log, and a banner on the
 * Debtors List names every customer where the two disagree and tells the
 * shopkeeper to go and look.
 *
 * applyInvoiceDebtCharge() was creating exactly that discrepancy itself.
 * Debt is clamped at zero -- a customer cannot owe less than nothing -- but
 * the log entry recorded the full intended delta regardless. So this
 * ordinary sequence:
 *
 *     raise an invoice for 3,000        debt 3,000   ledger 3,000
 *     customer pays cash, recorded      debt 0       ledger 0
 *     void the invoice (order was wrong) debt 0      ledger -3,000
 *
 * wrote a second 3,000 payment that never happened, against a balance with
 * no room to move. The banner then fired for a discrepancy the app had
 * just manufactured, and pointed the blame at the user's records.
 *
 * It now applies the clamp first and logs what actually moved.
 *
 * Run: node test/admin-customer-debt.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin customer debt');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { customers: [], savedQuotes: [], products: [] };
let nextId = 1;
const env = {
  data: store,
  allocRowId: () => nextId++,
  todayISO: () => '2026-08-02',
  invoiceNumberLabel: (q) => `INV-${String(q.id).padStart(4, '0')}`,
  generateCustomerId: () => 'C' + (nextId++),
  quoteSuggestedPrice: () => null,
  quoteSuggestedStockPrice: () => null,
};
const NAMES = [
  'savedQuoteTotal', 'quoteItemSellPrice', 'invoiceBalanceDue', 'invoiceDebtDesired',
  'resolveInvoiceCustomer', 'applyInvoiceDebtCharge', 'syncInvoiceDebtCharge',
  'customerLedgerTotal', 'customerDebtDrift',
];
let fns = null, err = null;
try { fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), env, NAMES); }
catch (e) { err = e; }
t.check(!!fns, `the debt routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { syncInvoiceDebtCharge, customerLedgerTotal, customerDebtDrift } = fns;

  const setup = (price) => {
    store.customers = [{ id: 'C1', name: 'Nakato', phone: '', location: '', debt: 0, notes: '', debtLog: [] }];
    const q = {
      id: 1, client: { name: 'Nakato', phone: '' }, date: '2026-08-02', customerId: 'C1',
      items: [{ id: 11, productId: 'P001', variantIdx: null, qty: 1, sellPrice: price, supplierId: 'S1' }],
      status: 'completed', invoiced: true, invoicedAt: '2026-08-02',
      amountPaid: 0, payments: [], voided: false, debtCharged: 0,
    };
    store.savedQuotes = [q];
    return { c: store.customers[0], q };
  };
  // Mirrors recordCustomerPayment's unallocated branch: clamp first, log
  // what the balance actually moved by. Written the same way deliberately
  // -- the first version of this helper logged the full amount regardless,
  // which is precisely the bug, and section 4 duly reported 1,500 of drift
  // against a fix that was working.
  const payByHand = (c, amount) => {
    const before = c.debt;
    const after = Math.max(0, before - amount);
    c.debt = after;
    if (before !== after) {
      c.debtLog.push({ id: nextId++, date: '2026-08-02', type: 'payment', amount: before - after, note: 'Paid cash' });
    }
  };

  /* ---------- 1. the sequence that manufactured a discrepancy ------- */
  {
    const { c, q } = setup(3000);
    syncInvoiceDebtCharge(q);
    t.check(c.debt === 3000 && customerDebtDrift(c) === 0, 'raising the invoice charges 3,000 and agrees with the ledger');

    payByHand(c, 3000);
    t.check(c.debt === 0 && customerDebtDrift(c) === 0, 'the customer settles it and the two still agree');

    q.voided = true;
    syncInvoiceDebtCharge(q);
    t.check(c.debt === 0, 'voiding leaves the balance at zero, which is right -- debt cannot go negative');
    t.check(customerLedgerTotal(c) === 0,
      `and the history does not invent a payment that never happened (ledger ${customerLedgerTotal(c)})`);
    t.check(customerDebtDrift(c) === 0, 'so there is nothing for the drift banner to report');
    t.check(c.debtLog.length === 2, `only the two real movements are logged (${c.debtLog.map(l => l.type + ' ' + l.amount).join(', ')})`);
  }

  /* ---------- 2. a clamp that only partly bites -------------------- */
  /*
   * The general case: the reversal is larger than the balance can absorb,
   * so part of it lands and part cannot. The part that landed is what gets
   * written down.
   */
  {
    const { c, q } = setup(3000);
    syncInvoiceDebtCharge(q);
    payByHand(c, 2000);
    q.voided = true;
    syncInvoiceDebtCharge(q);
    t.check(c.debt === 0, 'the balance goes to zero and no further');
    const last = c.debtLog[c.debtLog.length - 1];
    t.check(last.type === 'payment' && last.amount === 1000,
      `and the entry records the 1,000 that actually moved, not the 3,000 intended (${last.type} ${last.amount})`);
    t.check(customerDebtDrift(c) === 0, 'leaving no drift');
  }

  /* ---------- 3. the ordinary paths are untouched ------------------ */
  {
    let { c, q } = setup(5000);
    syncInvoiceDebtCharge(q);
    t.check(c.debt === 5000 && c.debtLog.length === 1 && c.debtLog[0].type === 'charge',
      'an invoice still charges its balance');

    q.voided = true; syncInvoiceDebtCharge(q);
    t.check(c.debt === 0 && customerDebtDrift(c) === 0, 'voiding an unpaid invoice still reverses it in full');

    ({ c, q } = setup(5000));
    syncInvoiceDebtCharge(q);
    q.items[0].sellPrice = 8000;
    syncInvoiceDebtCharge(q);
    t.check(c.debt === 8000, 'an invoice that grows charges the difference');
    t.check(c.debtLog.length === 2 && c.debtLog[1].amount === 3000,
      `logging only the 3,000 delta, not the new total (${c.debtLog[1].amount})`);
    t.check(customerDebtDrift(c) === 0, 'and stays in agreement');

    // A sync that changes nothing must write nothing.
    const before = c.debtLog.length;
    syncInvoiceDebtCharge(q);
    t.check(c.debtLog.length === before, 'a sync with no change adds no entry');
  }

  /* ---------- 4. the invariant, stated once ------------------------- */
  {
    const { c, q } = setup(4000);
    const seq = [
      () => syncInvoiceDebtCharge(q),
      () => payByHand(c, 1500),
      () => { q.items[0].sellPrice = 9000; syncInvoiceDebtCharge(q); },
      () => payByHand(c, 9000),
      () => { q.voided = true; syncInvoiceDebtCharge(q); },
      () => { q.voided = false; syncInvoiceDebtCharge(q); },
    ];
    let worst = 0;
    seq.forEach(step => { step(); worst = Math.max(worst, Math.abs(customerDebtDrift(c))); });
    t.check(worst === 0, `balance and history agree at every step of a full lifecycle (worst drift ${worst})`);
    t.check(c.debt >= 0, 'and the balance never goes negative');
  }
}

/* ---------- 5. the shape of the fix --------------------------------- */
{
  t.check(/const before = Number\(c\.debt\)\|\|0;\s*\n\s*const after = Math\.max\(0, before \+ delta\);\s*\n\s*const applied = after - before;/.test(code),
    'the clamp is applied before anything is written down');
  t.check(/if\(applied === 0\)\{ q\.debtCharged = desired; q\.customerId = c\.id; return; \}/.test(code),
    'a movement of nothing logs nothing, and still records the baseline');
  t.check(/type: applied>0\?'charge':'payment', amount: Math\.abs\(applied\)/.test(code),
    'and the entry carries what moved');
  t.check(!/amount: Math\.abs\(delta\)/.test(code), 'the intended delta is no longer what gets logged');

  // The same fault lived in the manual/overpayment path.
  t.check(/const before = Number\(c\.debt\)\|\|0;\s*\n\s*const after = Math\.max\(0, before - unapplied\);/.test(code),
    'recordCustomerPayment clamps before it logs too');
  t.check(/if\(before !== after\)\{\s*\n\s*c\.debtLog\.push\(\{id: allocRowId\('debtLog'\), date: date \|\| todayISO\(\), type:'payment', amount: before - after/.test(code),
    'logging what the balance moved by, so paying 5,000 against a 1,000 debt does not write a 5,000 payment');
  t.check(/const cashTxnId = addCashReceipt\(account, unapplied, category \|\| 'Debt Payment'/.test(code),
    'while the cash receipt stays at the amount actually handed over -- the cash book records cash, not debt');

  // The third place the same fault lived, found from a real shop's drift
  // banner. Removing an entry takes its full amount out of the history
  // while the balance is clamped, so deleting an 800,000 charge from a
  // 200,000 balance left the two 600,000 apart. It cannot be trimmed to
  // fit the way the other two were -- the entry is being removed, not
  // written -- so it is refused, as this function already does for an
  // invoice-owned entry.
  t.check(/const before = Number\(c\.debt\)\|\|0;\s*\n\s*if\(before \+ delta < -0\.000001\)\{/.test(code),
    'deleting a ledger entry checks the balance can absorb it');
  t.check(/leaving their history unexplainable/.test(code),
    'and says why it will not, rather than doing half of it');
  t.check(/  c\.debt = before \+ delta;/.test(code),
    'so the balance change is applied whole, with no clamp left to diverge from the history');
  t.check(!/c\.debt = Math\.max\(0, \(Number\(c\.debt\)\|\|0\) \+ delta\);/.test(code),
    'the clamped form is gone from this path');

  // The arithmetic, stated independently.
  const canAbsorb = (balance, entry) => {
    const delta = entry.type === 'charge' ? -entry.amount : entry.amount;
    return balance + delta >= 0;
  };
  t.check(canAbsorb(800000, { type: 'charge', amount: 800000 }) === true,
    'a charge can be removed when the balance still carries it');
  t.check(canAbsorb(200000, { type: 'charge', amount: 800000 }) === false,
    'and cannot when it does not -- the case that was silently half-applied');
  t.check(canAbsorb(0, { type: 'payment', amount: 500 }) === true,
    'removing a payment raises the balance, so it is always absorbable');
}

/* ---------- 7. repairing a history that already drifted ------------- */
/*
 * The fixes above stop new drift; they do not repair what earlier versions
 * left behind. A real shop's Debtors List showed three customers adrift by
 * 2,021,700 in total, and there was no way to close it: adding a charge or
 * a payment moves the balance AND the history by the same amount, so the
 * gap survives every tool the screen offered.
 */
{
  /* Per customer, not in bulk. The first version corrected every drifted
     customer from one button -- which, once the banner started saying
     which record the evidence pointed to PER customer, could write off a
     real debt for the second person while correcting a stale figure for
     the first. */
  t.check(/function explainDebtDrift\(customerId\)/.test(code), 'the drift banner can now write the missing entry, for one named customer');
  t.check(/const at = debtDriftTargetNow\(customerId\);/.test(code), 'resolved by id rather than from an object the banner closed over');
  t.check(/type: drift>0 \? 'charge' : 'payment',\s*\n\s*amount: Math\.abs\(drift\),/.test(code),
    'in the direction and size that closes the gap');
  t.check(/note: 'Balance correction — history did not add up to the balance shown'/.test(code),
    'labelled, so a year from now the history says where the figure came from');
  t.check(/cashTxnId: null,/.test(code),
    'and with no Cash Book entry -- nothing happened to the money, only to the record of it');
  t.check(!/c\.debt =/.test((/function explainDebtDrift[\s\S]*?\n\}/.exec(code) || [''])[0]),
    'no balance is touched: the balance is the figure being explained, not the one being changed');
  t.check(/if\(!confirm\(msg\)\) return;/.test(code), 'and it asks first, naming the total');

  /* Reachable however the list rendered -- drift can sit on a customer
     the current filter hides, so the repair must not be behind the
     populated path.
     ------------------------------------------------------------------
     It used to be wired TWICE, once on each of renderDebtorsList's two
     exits. The list has one exit now: the banner is emitted and the fix
     wired unconditionally, before the rows-or-empty choice, which is
     why one call is the right number and two would mean the old
     early-return had come back. */
  t.check((code.match(/wireDebtDriftFix\(wrap\);/g) || []).length === 1,
    'wired once, on the single render path that cannot skip it');
  const render = (/function renderDebtorsList[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(!/return;[\s\S]*wireDebtDriftFix/.test(render.replace(/if\(!wrap\) return;/, '')),
    'and no early return gets out of the function ahead of it');
}

process.exit(t.done() ? 1 : 0);
