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
  'customerInvoiceOwnedLedgerTotal', 'customerInvoiceBaselineTotal',
  'customerStoredBalanceIsPastTotal', 'customerDriftEvidence',
  'reconcileCustomerDebts',
];
let fns = null, err = null;
try { fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), {}, NAMES); }
catch (e) { err = e; }
t.check(!!fns, `the reconciliation routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { customerDebtDrift, reconcileCustomerDebts, customerDriftEvidence, customerInvoiceBaselineTotal } = fns;

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

  /* ---------- 6b. a backdated payment does not hide a stale copy ---- */
  /* The clobbered value is a total in the order things were WRITTEN. A
     payment backdated to when the money really arrived reorders the
     statement, so the write-order walk has to be tried too or a genuine
     stale copy reads as "never a real total" and is refused. Here the
     scalar was clobbered back to 795,000 -- the total after both charges,
     which statement order (with the payment backdated between them) never
     shows. */
  {
    const d = shop(795000);
    d.customers[0].debtLog = [
      { id: 1, date: '2026-08-18', type: 'charge',  amount: 425000, note: 'Auto-sync — INV-0179' },
      { id: 2, date: '2026-08-21', type: 'charge',  amount: 370000, note: 'Auto-sync — INV-0195' },
      // Recorded today, backdated to the 19th: statement order reads it
      // between the charges, so its running totals are 425, 0, 370.
      { id: 3, date: '2026-08-19', type: 'payment', amount: 425000, note: 'Auto-sync — INV-0179' },
      { id: 4, date: '2026-08-21', type: 'payment', amount: 370000, note: 'Auto-sync — INV-0195' },
    ];
    const healed = reconcileCustomerDebts(d);
    t.check(healed.length === 1 && d.customers[0].debt === 0,
      `a stale total from write order heals even when statement order never shows it (now ${d.customers[0].debt})`);
  }

  /* ---------- 6c. the evidence, asked directly ---------------------- */
  /* The banner leans on these three answers to tell the shopkeeper which
     figure the records support, so each answer is pinned here. */
  {
    const d = shop(370000);
    const ev = customerDriftEvidence(d.customers[0], customerInvoiceBaselineTotal(d, 'C1'));
    t.check(ev.hasInvoiceEntries && ev.invoicesAgree && ev.isPastBalance,
      'a stale copy of a corroborated history answers yes to all three questions');

    const manual = { id: 'C9', name: 'Hand-typed', debt: 500000, debtLog: [
      { id: 1, date: '2026-07-01', type: 'charge', amount: 300000, note: 'Opening balance' },
    ] };
    const evManual = customerDriftEvidence(manual, 0);
    t.check(!evManual.hasInvoiceEntries,
      'a history with no invoice behind it says so, rather than posing as corroborated');

    const torn = shop(370000);
    torn.customers[0].debtLog = torn.customers[0].debtLog.filter(l => l.id !== 4);
    const evTorn = customerDriftEvidence(torn.customers[0], customerInvoiceBaselineTotal(torn, 'C1'));
    t.check(evTorn.hasInvoiceEntries && !evTorn.invoicesAgree,
      'a ledger the invoices contradict is reported as disagreement, not as proof');

    const lostManual = shop(50000);
    const evLost = customerDriftEvidence(lostManual.customers[0], customerInvoiceBaselineTotal(lostManual, 'C1'));
    t.check(evLost.invoicesAgree && !evLost.isPastBalance,
      'a balance the history never added up to is flagged as exactly that');
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

/* ---------- 7b. the banner offers both directions -------------------- */
/*
 * What the heal declines still has to be closable by a person. The banner
 * used to offer only "trust the balance" (write the missing entry into the
 * history) -- which, for a stale balance, makes the wrong figure permanent.
 * It now says which record the evidence leans toward for each customer,
 * and offers the mirror repair: set the balance to the history's total.
 */
{
  t.check(/id="deb_drift_adopt"/.test(code), 'the banner carries the trust-the-history button');
  t.check(/customerDriftEvidence\(c, customerInvoiceBaselineTotal\(data, c\.id\)\)/.test(code),
    'and asks the same three questions the heal asks, per customer, to say why it was left');
  const adopt = (/function adoptLedgerBalances[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(adopt.length > 0, 'adoptLedgerBalances() exists');
  t.check(/if\(!confirm\(msg\)\) return;/.test(adopt), 'it asks first');
  t.check(/c\.debt = Math\.max\(0, customerLedgerTotal\(c\)\);/.test(adopt),
    'the balance it sets is the history\'s own total, never below zero');
  t.check(!/debtLog\.push/.test(adopt),
    'and it writes nothing into the history -- the history already explains the corrected figure');
  t.check(!/addCashReceipt|cashTxn/.test(adopt),
    'and touches no cash -- nothing happened to the money, only to the record of it');
  t.check(/#deb_drift_adopt'\)/.test((/function wireDebtDriftFix[\s\S]*?\n\}/.exec(code) || [''])[0]),
    'wired beside the existing repair, from both render paths');
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
