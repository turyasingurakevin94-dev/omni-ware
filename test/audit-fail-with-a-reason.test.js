#!/usr/bin/env node
'use strict';
/*
 * The audit of 19 October 2026, part three: things must fail WITH a reason.
 *
 * supabase-js never throws: a write's { error } has to be read, or the
 * failure is silent. The audit found 23 places where it was not, or where a
 * failure after an earlier write had landed was reported as "Nothing was
 * changed". The worst are pinned here:
 *
 *   accounts  a payroll, loan, agent, trip-cash or asset action writes the
 *             cash line first (addCash) and then another row; when the
 *             second write failed the screen said nothing was changed while
 *             the money was in the book.
 *   store     a pick that did not reach the books stayed drawn as done, with
 *             the write's failure swallowed twice; the phone's alerts sign-up
 *             never read its result.
 *   buyer     a phone confirmation that did not update the price list said so
 *             without the reason; a restock write's failure was swallowed.
 *   supplier  asking for a PIN that failed still showed "Asked · watch
 *             WhatsApp".
 *   owner     a decision_log line that did not save was dropped without a
 *             word, under a chip saying "logged as yours".
 *   manager   a void's supplier-bill reversal was console.warn'd and the
 *             void marked done (pinned in audit-0136.test.js).
 *   sales/manager  "Stopped part-way … Tell Accounts" carried no reason.
 *
 * Run: node test/audit-fail-with-a-reason.test.js
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('the audit\'s failures with a reason');
const accounts = read('accounts.html'), store = read('store.html'), buyer = read('buyer.html'), supplier = read('supplier.html'), owner = read('owner.html'), sales = read('sales.html'), manager = read('manager.html');

// accounts
t.check(/S\.landed = \{ id, amount: row\.amount, category: row\.category, account: row\.account, at: Date\.now\(\) \};/.test(accounts), 'accounts: addCash remembers the line it landed');
t.check(/function booksChanged\(\)\{ S\.loadedAt = Date\.now\(\); S\.landed = null; saveSnapshot\(\); \}/.test(accounts), 'accounts: a finished action forgets it');
t.check(/async function afterFail\(e\)\{\n  const l = S\.landed; S\.landed = null;\n  if \(l && Date\.now\(\) - l\.at < 120000\) toast\(`\$\{l\.category\} of \$\{n0\(l\.amount\)\} is in the \$\{ACCT_WORD\[l\.account\] \|\| l\.account\} book \(line \$\{l\.id\}\), but the rest did not save — \$\{\(e && e\.message\) \|\| e\}/.test(accounts), 'accounts: a failure after the cash line landed names the line, the amount and the reason, never "nothing was changed"');
t.check(/else toast\(failWord\(e\), 7000\);/.test(accounts), 'accounts: and says nothing was changed only when nothing was');

// store
t.check(/setPick\.t = setTimeout\(\(\) => flushPicks\(q\.id\)\.catch\(e => toast\(pickKeptWords\(e\), 6000\)\), 900\);/.test(store) && /if \(q\) flushPicks\(q\.id\)\.catch\(e => toast\(pickKeptWords\(e\), 6000\)\);/.test(store), 'store: a pick that did not save is said, on the debounce and on closing the pick');
t.check(/function pickKeptWords\(e\)\{ return isNetworkError\(e\) \? 'No signal — your picks are kept on this phone and go when it is back\.' : 'Your picks are kept on this phone but not saved yet — '/.test(store), 'store: the words say the picks are kept on the phone and why they did not go');
t.check(/const \{ error \} = await sb\.from\('push_subscriptions'\)\.upsert\(/.test(store) && /if \(error\) toast\('This phone could not be signed up for alerts — ' \+ error\.message, 6000\);/.test(store), 'store: the alerts sign-up reads its result and says when it failed');

// buyer
t.check(/\.catch\(e => \{ a\.listedWhy = \(e && e\.message\) \|\| String\(e\); return false; \}\);/.test(buyer) && /the price list could not be updated \(' \+ \(a\.listedWhy \|\| 'no reason given'\) \+ '\)'/.test(buyer), 'buyer: a phone confirmation that did not reach the list says why');
t.check(/restockOnTrip\(trip\)\.catch\(e => toast\('The trip started, but the shelf lines on it were not marked — '/.test(buyer) && /restockCollected\(t\)\.catch\(e => toast\('Handed in, but the shelf lines were not marked collected — '/.test(buyer), 'buyer: a restock write that fails is said, with what did land');

// supplier
t.check(/try\{ await api\('ask_pin', \{ phone: ph \}\); SI\.requested = true; SI\.msg = ''; \}catch\(e\)\{ SI\.requested = false; SI\.msg = \(e && e\.message\) \|\| 'The shop could not be reached'; \}/.test(supplier), 'supplier: a PIN request that fails shows the reason, not "Asked"');

// owner
t.check(/const \{ error \} = await sb\.from\('decision_log'\)\.insert\(/.test(owner) && /toast\('Done — but the line for your log did not save: ' \+ \(\(e && e\.message\) \|\| e\), 6000\);/.test(owner), 'owner: a log line that did not save is said');

// sales and manager payments: one write since 0139, so a failure is whole and names its reason
for (const [name, src] of [['sales', sales], ['manager', manager]]) {
  t.check(!/Stopped part-way/.test(src) && /toast\(isNetworkError\(e\) \? 'No connection — nothing was recorded\. Try again\.' : 'Nothing was recorded: ' \+ \(e\.message \|\| e\), 6000\);/.test(src), `${name}: a payment that fails says nothing was recorded, and why`);
}
t.check(!/Stopped part-way/.test(accounts), 'accounts: the same');

// the rule itself, mechanically: no write whose result is thrown away with an empty catch in the seven role apps
for (const [name, src] of Object.entries({ sales, buyer, store, manager, accounts, owner, supplier })) {
  const empties = [...src.matchAll(/await sb\.from\('[a-z_]+'\)\.(insert|update|upsert|delete)\([^\n]*\n?[^\n]*catch \(_e\) \{\}/g)].length;
  t.check(empties === 0, `${name}: no database write is awaited into an empty catch${empties ? ' (' + empties + ' found)' : ''}`);
}

process.exit(t.done() ? 1 : 0);
