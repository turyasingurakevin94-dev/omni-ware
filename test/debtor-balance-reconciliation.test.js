#!/usr/bin/env node
'use strict';
/*
 * A paid invoice must not go on being chased.
 *
 * From a real shop: INV-0195 (370,000) showed Settled on the invoice list,
 * the customer's own history added up to 0 -- charges and payments all
 * present -- and the Debtors List still demanded 370,000, with the drift
 * banner reporting the balance "overstated by 370,000".
 *
 * The cause is the shape of the sync, not any one flow: every local
 * mutation moves c.debt and writes the matching ledger entry in the same
 * breath, but c.debt then travels as a bare column on the customers row,
 * last write wins. A stale device upserting that row (or the customers op
 * of a save failing while the debt-log and saved_quotes ops land) reverts
 * the balance to an earlier value while the ledger rows and the invoices
 * -- which sync row by row and cannot be un-written by staleness -- keep
 * the truth.
 *
 * The banner's own repair is the wrong tool here: it trusts the balance
 * and writes a charge into the history to match it, turning a stale figure
 * into a permanent one.
 *
 * reconcileCustomerDebts() heals exactly this case on load: when the
 * ledger and the invoices corroborate each other and the stored balance is
 * a running total the ledger once passed through, the balance is re-read
 * from the ledger. Everything short of that standard of evidence is left
 * for the banner and its human.
 *
 * Run: node test/debtor-balance-reconciliation.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('debtor balance reconciliation');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = [
  'debtLogIsInvoiceOwned', 'customerLedgerTotal', 'customerDebtDrift',
  'customerInvoiceOwnedLedgerTotal', 'reconcileCustomerDebts',
];
let fns = null, err = null;
try { fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), {}, NAMES); }
catch (e) { err = e; }
t.check(!!fns, `the reconciliation routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { customerDebtDrift, reconcileCustomerDebts } = fns;

  // The shop above, reconstructed. Yesterday's invoice charged 425,000,
  // today's charged 370,000, and one 795,000 payment settled both -- so
  // both invoices carry a baseline of 0 and the ledger nets to 0. The
  // stored balance is whatever the last write to the customers row said.
  const shop = (storedDebt) => ({
    customers: [{ id: 'C1', name: 'Onora Peter', debt: storedDebt, debtLog: [
      { id: 1, date: '2026-08-20', type: 'charge',  amount: 425000, note: 'Auto-sync — INV-0179', quoteId: 179 },
      { id: 2, date: '2026-08-21', type: 'charge',  amount: 370000, note: 'Auto-sync — INV-0195', quoteId: 195 },
      { id: 3, date: '2026-08-21', type: 'payment', amount: 425000, note: 'Auto-sync — INV-0179', quoteId: 179 },
      { id: 4, date: '2026-08-21', type: 'payment', amount: 370000, note: 'Auto-sync — INV-0195', quoteId: 195 },
    ] }],
    savedQuotes: [
      { id: 179, customerId: 'C1', invoiced: true, voided: false, debtCharged: 0 },
      { id: 195, customerId: 'C1', invoiced: true, voided: false, debtCharged: 0 },
    ],
  });

  /* ---------- 1. the reported case heals ---------------------------- */
  {
    const d = shop(370000);
    const healed = reconcileCustomerDebts(d);
    t.check(healed.length === 1 && healed[0].from === 370000 && healed[0].to === 0,
      `the stale 370,000 is re-read as the 0 the records agree on (${healed.map(h => h.from + '->' + h.to).join(', ') || 'nothing healed'})`);
    t.check(d.customers[0].debt === 0, 'so the Debtors List stops chasing a settled invoice');
    t.check(customerDebtDrift(d.customers[0]) === 0, 'and the drift banner has nothing left to report');
  }

  /* ---------- 2. a healthy balance is left alone -------------------- */
  {
    const d = shop(0);
    const healed = reconcileCustomerDebts(d);
    t.check(healed.length === 0 && d.customers[0].debt === 0, 'a balance that already agrees is not touched');
  }

  /* ---------- 3. a balance clobbered DOWN heals back up ------------- */
  /* The same staleness in the other direction: the payment device's row
     lost to one from before today's charge. Money really owed must come
     back, not only money already paid go away. */
  {
    const d = shop(425000);
    d.customers[0].debtLog = d.customers[0].debtLog.slice(0, 2); // both charges, no payments yet
    d.savedQuotes[0].debtCharged = 425000;
    d.savedQuotes[1].debtCharged = 370000;
    d.customers[0].debt = 425000; // yesterday's snapshot won the last write
    const healed = reconcileCustomerDebts(d);
    t.check(healed.length === 1 && d.customers[0].debt === 795000,
      `a stale low balance is restored to the 795,000 the records support (now ${d.customers[0].debt})`);
  }

  /* ---------- 4. no invoice evidence, no verdict -------------------- */
  /* A hand-typed balance has no witness: the ledger and the balance are
     one voice against another, which is the banner's question to ask. */
  {
    const d = {
      customers: [{ id: 'C2', name: 'Mulongo', debt: 500000, debtLog: [
        { id: 1, date: '2026-07-01', type: 'charge', amount: 300000, note: 'Opening balance', cashTxnId: null },
      ] }],
      savedQuotes: [],
    };
    const healed = reconcileCustomerDebts(d);
    t.check(healed.length === 0 && d.customers[0].debt === 500000,
      'a drifted balance with no invoice-owned history is left for the banner');
  }

  /* ---------- 5. invoices that disagree with the ledger say stop ---- */
  /* Here the ledger itself lost a row (the payment landed on the invoice
     but its ledger entry did not): the invoice baseline says 0, the
     ledger's invoice entries say 370,000. Two records in conflict is not
     evidence against the third. */
  {
    const d = shop(370000);
    d.customers[0].debtLog = d.customers[0].debtLog.filter(l => l.id !== 4); // INV-0195's payment row lost
    const healed = reconcileCustomerDebts(d);
    t.check(healed.length === 0 && d.customers[0].debt === 370000,
      'a ledger the invoices contradict heals nothing');
  }

  /* ---------- 6. a balance the ledger never reached is not "stale" -- */
  /* The other way histories break: a manual charge's ledger row was lost,
     so the balance carries 50,000 no surviving entry explains. That is
     not a past running total -- it is a missing entry, and the banner's
     correction (which rebuilds the entry) is the right repair. Healing
     here would write the 50,000 off. */
  {
    const d = shop(50000);
    const healed = reconcileCustomerDebts(d);
    t.check(healed.length === 0 && d.customers[0].debt === 50000,
      'a balance that matches no running total of its ledger is left for the banner');
  }

  /* ---------- 7. only the customer with the problem is touched ------ */
  {
    const d = shop(370000);
    d.customers.push({ id: 'C3', name: 'Healthy', debt: 40000, debtLog: [
      { id: 9, date: '2026-08-01', type: 'charge', amount: 40000, note: 'Auto-sync — INV-0100', quoteId: 100 },
    ] });
    d.savedQuotes.push({ id: 100, customerId: 'C3', invoiced: true, voided: false, debtCharged: 40000 });
    const healed = reconcileCustomerDebts(d);
    t.check(healed.length === 1 && healed[0].c.id === 'C1' && d.customers[1].debt === 40000,
      'a customer whose records already agree is not caught in the sweep');
  }
}

/* ---------- 8. the shape of the wiring ------------------------------- */
{
  t.check(/initLastSynced\(data, currentShopId\);[\s\S]{0,400}?reportDebtReconciliation\(reconcileCustomerDebts\(data\)\);/.test(code),
    'boot reconciles AFTER the sync snapshot, so the correction pushes to the server as an edit');
  t.check(/const freshSynced = buildLastSynced\(fresh, currentShopId\);[\s\S]{0,300}?reportDebtReconciliation\(reconcileCustomerDebts\(fresh\)\);[\s\S]{0,100}?data = fresh;/.test(code),
    'and the background refresh does the same, between the snapshot and the swap');
  t.check(!/c\.debtLog\.push/.test((/function reconcileCustomerDebts[\s\S]*?\n\}/.exec(code) || [''])[0]),
    'the heal writes no ledger rows -- every device runs it on every load, and rows would double');
  t.check(/const corrected = Math\.max\(0, ledger\);/.test(code),
    'and the balance it sets is read from the ledger, never below zero');
}

process.exit(t.done() ? 1 : 0);
