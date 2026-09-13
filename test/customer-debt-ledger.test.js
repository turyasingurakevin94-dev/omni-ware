#!/usr/bin/env node
'use strict';
/*
 * The customer debt ledger.
 *
 * Three things represent the same money and nothing forces them to agree:
 * c.debt (a stored running total), c.debtLog[] (the ledger meant to explain
 * it), and invoiceBalanceDue() on the invoices themselves. Every mutation
 * of c.debt is clamped with Math.max(0, ...), which silently absorbs
 * anything that would go negative.
 *
 * Creditors have no equivalent exposure -- creditorTotalOwed() is DERIVED
 * live from the purchase invoices, so it physically cannot drift. This side
 * is stored, so the checks are about keeping the three in step and noticing
 * when they aren't.
 *
 * Run: node test/customer-debt-ledger.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer debt');
const src = read('index.html');

const data = { customers: [], savedQuotes: [], nextCustomerDebtLogId: 1 };
const NAMES = [
  'orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderChargesTotal',
  'savedQuoteTotal', 'invoiceBalanceDue', 'invoiceDebtDesired',
  'resolveInvoiceCustomer', 'applyInvoiceDebtCharge', 'syncInvoiceDebtCharge',
  'debtLogIsInvoiceOwned', 'customerLedgerTotal', 'customerDebtDrift', 'customersWithDebtDrift',
];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
  data,
  todayISO: () => '2026-08-02',
  allocRowId: () => data.nextCustomerDebtLogId++,
  invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
  generateCustomerId: () => 'C999',
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
}, NAMES);

const reset = () => {
  data.customers = [{ id: 'C001', name: 'Kato Construction', debt: 0, debtLog: [] }];
  data.savedQuotes = [];
  data.nextCustomerDebtLogId = 1;
  return data.customers[0];
};
const invoice = (id, total, paid) => {
  const q = { id, customerId: 'C001', client: { name: 'Kato Construction' }, invoiced: true,
    voided: false, amountPaid: paid || 0, debtCharged: 0, items: [{ qty: 1, sellPrice: total }] };
  data.savedQuotes.push(q);
  return q;
};

/* ---------- 1. the invoice sync applies a delta, not a total ---------- */
/*
 * q.debtCharged records what this invoice has already put on the customer,
 * so syncing repeatedly is a no-op rather than charging again. That is the
 * design working; it is also exactly what makes the baseline load-bearing.
 */
{
  const c = reset();
  const q = invoice(1, 100000);
  fn.syncInvoiceDebtCharge(q);
  t.check(c.debt === 100000 && q.debtCharged === 100000,
    `invoicing charges the customer once (debt ${c.debt})`);
  fn.syncInvoiceDebtCharge(q);
  fn.syncInvoiceDebtCharge(q);
  t.check(c.debt === 100000 && c.debtLog.length === 1,
    `syncing again changes nothing (debt ${c.debt}, ${c.debtLog.length} log entries)`);
}
{
  const c = reset();
  const q = invoice(1, 100000);
  fn.syncInvoiceDebtCharge(q);
  q.amountPaid = 40000;
  fn.syncInvoiceDebtCharge(q);
  t.check(c.debt === 60000 && q.debtCharged === 60000,
    `a part payment reduces the debt by what was paid (debt ${c.debt})`);
  q.voided = true;
  fn.syncInvoiceDebtCharge(q);
  t.check(c.debt === 0 && q.debtCharged === 0,
    `voiding the invoice removes its charge entirely (debt ${c.debt})`);
}

/* ---------- 2. an invoice-owned entry is not the user's to delete ----- */
/*
 * The bug. These rows mirror q.debtCharged, so deleting one by hand drops
 * the debt while leaving the baseline untouched -- and every later sync
 * then computes a delta of zero and corrects nothing. The customer owes the
 * money on the invoice forever while their balance reads clear.
 */
{
  const c = reset();
  const q = invoice(1, 100000);
  fn.syncInvoiceDebtCharge(q);
  const entry = c.debtLog[0];
  t.check(fn.debtLogIsInvoiceOwned(entry),
    'the entry an invoice creates is marked as belonging to that invoice');
  t.check(entry.quoteId === 1,
    `and carries the invoice it came from (${entry.quoteId})`);

  // Simulate the deletion the UI used to allow, to show why it must not.
  c.debtLog.splice(0, 1);
  c.debt = Math.max(0, c.debt - 100000);
  fn.syncInvoiceDebtCharge(q);
  t.check(c.debt === 0 && fn.invoiceBalanceDue(q) === 100000,
    'deleting one silently detaches the debt from the invoice, and no later sync repairs it — which is why it is now refused');
}
{
  // Legacy rows predate the quoteId tag and are recognised by their note.
  t.check(fn.debtLogIsInvoiceOwned({ note: 'Auto-sync — INV-0007' }),
    'an older auto-sync entry is still recognised by the note it was written with');
  t.check(!fn.debtLogIsInvoiceOwned({ note: 'Materials on credit' })
    && !fn.debtLogIsInvoiceOwned({ note: '' })
    && !fn.debtLogIsInvoiceOwned(null),
    'a manual entry, a blank note and a missing row are all still the user\'s to remove');
  t.check(!fn.debtLogIsInvoiceOwned({ note: 'Paid off Auto-sync — INV-0007 by hand' }),
    'and the note has to START that way, so a manual note mentioning one is not locked by accident');
}
{
  const hist = extractFunction(src, 'customerDebtHistoryHTML', 'index.html');
  t.check(/debtLogIsInvoiceOwned\(l\)/.test(hist) && /debt-log-locked/.test(hist),
    'the history shows a lock instead of a delete button on those rows');
  const del = extractFunction(src, 'deleteCustomerDebtLog', 'index.html');
  const iGuard = del.indexOf('debtLogIsInvoiceOwned');
  const iSplice = del.indexOf('c.debtLog.splice');
  t.check(iGuard > -1 && iGuard < iSplice,
    'and the delete path refuses them itself, before removing anything — the hidden button is not the gate');
}

/* ---------- 3. the total and the ledger agree ------------------------- */
{
  const c = reset();
  const q = invoice(1, 100000);
  fn.syncInvoiceDebtCharge(q);
  c.debtLog.push({ id: 99, date: '2026-08-02', type: 'charge', amount: 50000, note: 'Materials on credit' });
  c.debt += 50000;
  t.check(fn.customerLedgerTotal(c) === 150000 && fn.customerDebtDrift(c) === 0,
    `charges and payments in the ledger add up to the stored total (${fn.customerLedgerTotal(c)})`);

  q.amountPaid = 100000;
  fn.syncInvoiceDebtCharge(q);
  t.check(fn.customerDebtDrift(c) === 0,
    `and still agree after the invoice is settled (debt ${c.debt}, ledger ${fn.customerLedgerTotal(c)})`);
}
{
  const c = reset();
  c.debt = 250000;                       // stored
  c.debtLog = [];                        // but nothing explains it
  t.check(fn.customerDebtDrift(c) === 250000,
    `a balance with no history behind it is reported as drift (${fn.customerDebtDrift(c)})`);
  t.check(fn.customersWithDebtDrift().length === 1,
    'and the customer is listed');
}
{
  const c = reset();
  // What the Math.max(0, ...) clamp does: reverse more than is there and
  // the excess vanishes from the total but not from the ledger.
  c.debtLog = [{ id: 1, type: 'charge', amount: 30000 }, { id: 2, type: 'payment', amount: 100000 }];
  c.debt = Math.max(0, 30000 - 100000);
  t.check(fn.customerDebtDrift(c) === 70000,
    `a reversal larger than the balance leaves a gap the clamp hides (${fn.customerDebtDrift(c)})`);
}
{
  const c = reset();
  t.check(fn.customerDebtDrift(c) === 0 && fn.customersWithDebtDrift().length === 0,
    'a customer who owes nothing and has no history is not a finding');
  c.debt = 100000.4;
  c.debtLog = [{ id: 1, type: 'charge', amount: 100000 }];
  t.check(fn.customerDebtDrift(c) === 0,
    'and a fractional shilling is rounded away rather than reported');
}

/* ---------- 4. an opening balance is in the ledger -------------------- */
/*
 * It used to be written straight onto c.debt with an empty debtLog, so
 * every customer created with one started out unreconcilable.
 */
{
  const save = /getElementById\('c_save'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/.exec(src)
    || [null, src.slice(src.indexOf('const openingDebt'), src.indexOf('const openingDebt') + 700)];
  const body = save[1] || '';
  /* Read through cfOpeningBalanceCheck now, not straight off the box.
     `Number(box)||0` took -500,000 happily, and since the ledger entry
     is only written above zero it saved a balance with an EMPTY
     history -- drift, manufactured by the form meant to prevent it. */
  t.check(/const chk = cfOpeningBalanceCheck\(document\.getElementById\('c_debt'\)\.value,/.test(body),
    'the opening balance is read once, through the check that decides whether it is writable');
  t.check(/const openingDebt = chk\.amount;/.test(body),
    'and only what that check returns is written');
  t.check(/openingDebt > 0[\s\S]{0,200}type:'charge', amount: openingDebt/.test(body),
    'and a matching ledger entry is written for it, so the two start in step');
  t.check(/note:'Opening balance'/.test(body),
    'labelled as an opening balance rather than looking like a sale');
}

/* ---------- 5. the drift is surfaced, not just computable ------------- */
{
  const banner = extractFunction(src, 'debtDriftBannerHTML', 'index.html');
  t.check(/customersWithDebtDrift\(\)/.test(banner) && /if\(!drifted\.length\) return ''/.test(banner),
    'the debtors list says nothing at all when everything reconciles');
  t.check(/overstated|understated/.test(banner),
    'and names the direction rather than just flagging a mismatch');
  /* IT USED TO BE COUNTED: the banner had to appear at least three
     times in renderDebtorsList, because the function had an early
     return for the empty list and a separate populated path, and the
     banner had to be pasted onto every one of them. Forget one and a
     drifted balance became invisible exactly when the filter hid its
     customer.
     ------------------------------------------------------------------
     There is one path now. The banner is emitted UNCONDITIONALLY, above
     the point where the rows-or-empty choice is made, so there is no
     longer a path it can be left off -- which is a stronger guarantee
     than three copies that have to agree. What is pinned is that
     structure: emitted once, and not inside the branch. */
  const render = extractFunction(src, 'renderDebtorsList', 'index.html');
  const uses = (render.match(/debtDriftBannerHTML\(\)/g) || []).length;
  t.check(uses === 1, `the banner is emitted from one place (${uses} references)`);
  const shell = (/wrap\.innerHTML = `[\s\S]*?`;/.exec(render) || [''])[0];
  t.check(/\$\{debtDriftBannerHTML\(\)\}[\s\S]*\$\{rows\.length \?/.test(shell),
    'and above the rows-or-empty choice, so there is no path it can be left off');
}

process.exit(t.done() ? 1 : 0);
