#!/usr/bin/env node
'use strict';
/*
 * A voided document did not happen.
 *
 * The admin is careful about this nearly everywhere: invoiceBalanceDue()
 * returns 0 for a voided invoice, the debtor lookup skips it, the Invoices
 * tab excludes it from its own totals and strikes the row through, and the
 * A5 print carries a VOIDED banner.
 *
 * Sales Analytics did not. anInvoicesInRange() selected on status and
 * invoiced flag alone, so a cancelled sale was counted as revenue -- in the
 * KPIs, and in the by-item, by-customer and by-document tables. Its own
 * mirror image on the purchase side, panInvoicesInRange(), has always
 * dropped voided documents, which is what makes this an oversight rather
 * than a policy: the two screens are the same screen and disagreed.
 *
 * Two smaller reads had it too, both shown to a rep mid-call: the "usually
 * buys" list and the prior-order count that sits beside a client's debt
 * standing.
 *
 * Run: node test/admin-voided-documents.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin voided documents');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const INV = (over = {}) => ({
  id: 1, status: 'completed', invoiced: true, voided: false,
  invoicedAt: '2026-07-15', date: '2026-07-15',
  client: { name: 'Nakato Hardware' }, items: [], ...over,
});

/* ---------- 1. sales analytics ------------------------------------- */
{
  let f = null, err = null;
  try {
    ({ anInvoicesInRange: f } = compileScope(
      [extractFunction(src, 'anInvoicesInRange', 'index.html')],
      { data: { savedQuotes: [] } }, ['anInvoicesInRange'],
    ));
  } catch (e) { err = e; }
  t.check(typeof f === 'function', `anInvoicesInRange compiles${err ? ` (${err.message})` : ''}`);

  if (f) {
    // compileScope closes over the `data` it was given, so the rows go in
    // through that same object.
    const scope = { savedQuotes: [] };
    let g = null;
    try {
      ({ anInvoicesInRange: g } = compileScope(
        [extractFunction(src, 'anInvoicesInRange', 'index.html')], { data: scope }, ['anInvoicesInRange'],
      ));
    } catch (e) { /* covered above */ }

    scope.savedQuotes = [INV({ id: 1 }), INV({ id: 2, voided: true })];
    const rows = g('', '');
    t.check(rows.length === 1, `a voided invoice is not a sale (${rows.length} of 2)`);
    t.check(!rows.some(q => q.voided), 'and none of what comes back is voided');
    t.check(rows[0].id === 1, 'the live one survives');

    // The selection rules it must still apply.
    scope.savedQuotes = [INV({ id: 3, status: 'preparing' }), INV({ id: 4, invoiced: false }), INV({ id: 5 })];
    t.check(g('', '').length === 1, 'an unfinished or uninvoiced order is still excluded, as before');

    scope.savedQuotes = [INV({ id: 6, invoicedAt: '2026-06-01' }), INV({ id: 7, invoicedAt: '2026-07-20' })];
    t.check(g('2026-07-01', '2026-07-31').length === 1, 'and the date range still applies');

    // The date a document counts on. invoicedAt first, falling back to the
    // order's date -- unchanged, pinned because the voided check was added
    // directly above it.
    scope.savedQuotes = [INV({ id: 8, invoicedAt: null, date: '2026-07-20' })];
    t.check(g('2026-07-01', '2026-07-31').length === 1,
      'an invoice with no invoicedAt falls back to its order date');
  }
}

/* ---------- 2. the two screens must agree --------------------------- */
/*
 * This is the check that would have caught it. Sales and Purchase
 * Analytics are the same screen pointed at different documents; a rule one
 * applies and the other does not is the bug, whichever way round it is.
 */
{
  const sales = (/function anInvoicesInRange[\s\S]*?\n\}/.exec(code) || [''])[0];
  const purchase = (/function panInvoicesInRange[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(sales.length > 0 && purchase.length > 0, 'both range functions are found');
  t.check(/if\(q\.voided\) return false;/.test(sales), 'sales analytics drops voided documents');
  t.check(/if\(pi\.voided\) return false;/.test(purchase), 'and so does purchase analytics, as it always did');
}

/* ---------- 3. what a client is told to have bought ----------------- */
{
  t.check(/const orders = data\.savedQuotes\.filter\(q=>\s*\n?\s*!q\.voided && \(\(q\.client&&q\.client\.name\)\|\|''\)/.test(code),
    'the "usually buys" list is built from orders that were not cancelled');
  /* The band's order count is the length of the same filtered list the
     band's "last order" is read from, so one rule covers both. */
  const band = (/function renderClientHistoryBox\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const orders = data\.savedQuotes\.filter\(q=>\s*\n?\s*!q\.voided && \(\(q\.client&&q\.client\.name\)\|\|''\)/.test(band)
    && /const priorOrders = orders\.length;/.test(band),
    'and so is the prior-order count beside their debt standing');

  // Both also still exclude the quote being edited, or a client would be
  // shown their own in-progress order as history.
  const both = [...code.matchAll(/q\.id!==data\.quote\.savedId/g)].length;
  t.check(both >= 2, `both still exclude the quote in hand (${both} sites)`);
}

/* ---------- 4. the rules that were already right -------------------- */
/*
 * Pinned so the fix above cannot be "tidied" into a single helper that
 * quietly changes one of them.
 */
{
  t.check(/if\(!q\.invoiced \|\| q\.voided\) return 0;/.test(code),
    'a voided invoice has no balance due');
  t.check(/\.filter\(q=>q\.customerId===customerId && q\.invoiced && !q\.voided && invoiceBalanceDue\(q\)>0\)/.test(code),
    'and is not one of a customer\'s outstanding invoices');
  // Summed in its own pass since the table was paged, so that the total
  // describes the range and not the page. Same rule, different place.
  /* Same rule, kept a different way since Invoices became a card
     screen. The clamp has not gone anywhere -- it is inside
     invoiceBalanceDue(), which every figure on the screen now goes
     through, so an overpaid invoice still cannot drag a range's open
     balance below zero. What has gone is the local accumulator that
     restated the same arithmetic; there is one copy of it in the file and
     admin-agent-prepay.test.js is the test that holds it to one. */
  t.check(/function invoiceBalanceDue\(q\)\{\s*\n\s*return Math\.max\(0, savedQuoteTotal\(q\) - \(Number\(q\.amountPaid\)\|\|0\)\);/.test(code),
    'the balance every Invoices figure is summed from is clamped at zero');
  t.check(/byState\[invStateOf\(q\)\]\.push\(q\)/.test(code)
       && /voided:\s*\[\]/.test(code),
    'and a voided invoice goes to a bucket of its own, so the totals leave it out');
  /* Both ledgers, because the supplier side carried the identical
     fault and Creditors clamps the same way Debtors does. */
  t.check(!/totalDue \+= total - paid;/.test(code),
    'and neither ledger sums a balance unclamped — an overpaid document is not negative debt');
  /* Still listable, and now more plainly so. The old mechanism was a Hide
     voided checkbox, on by default, which meant a cancelled document was
     reachable only by remembering the checkbox existed. The card screen
     gives it a lens of its own with its own count in the tab, so the
     register says how many there are before you go looking. Kept, never
     deleted, remains the rule; what changed is that the screen now
     volunteers them. */
  t.check(/data-lens="voided"/.test(code),
    'while still being able to LIST it — voided has a lens of its own, with its count in the tab');
  t.check(/groups = \[\{key:'voided', rows:byState\.voided\}\]/.test(code),
    'and that lens draws the voided bucket, which is why that list is not a bug');
}

process.exit(t.done() ? 1 : 0);
