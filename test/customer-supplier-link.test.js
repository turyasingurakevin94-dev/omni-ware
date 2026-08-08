#!/usr/bin/env node
'use strict';
/*
 * One person who is both a client and a supplier.
 *
 * A hardware shop buys from people it also sells to. That person had to
 * be entered twice, once in each list, and the two records never met:
 * what they owed the shop sat in Debtors, what the shop owed them sat in
 * Creditors, and nobody could see that the two largely cancelled.
 *
 * A LINK, NOT A MERGE. A quote references a customer id and a purchase
 * invoice references a supplier id. Folding the two records into one
 * would rewrite both halves of the books to fix what is really a display
 * problem, so each side keeps its own id and its own history and simply
 * knows who the other one is.
 *
 * THE LINK IS SYMMETRIC OR IT IS NOTHING. A half-written link is a
 * person who is their own supplier seen from the customer screen and
 * nobody at all seen from the supplier screen -- worse than no link,
 * because it looks right from wherever you happen to be standing.
 *
 * AND IT IS EXCLUSIVE. A counterpart claimed by two customers would have
 * its balance netted twice, against two different people.
 *
 * Run: node test/customer-supplier-link.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer supplier link');
const src = read('index.html');

const data = { customers: [], suppliers: [] };
const owedBySupplier = new Map();
const NAMES = ['linkedSupplierOf', 'linkedCustomerOf', 'linkCustomerSupplier', 'bothSidesPosition'];
const scope = compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html')),
  { data, creditorTotalOwed: (id) => owedBySupplier.get(id) || 0 },
  NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => {
  data.customers = [
    { id: 'C1', name: 'Fundi Musa', debt: 400000 },
    { id: 'C2', name: 'Other Customer', debt: 0 },
  ];
  data.suppliers = [
    { id: 'S1', name: 'Musa Hardware' },
    { id: 'S2', name: 'Someone Else' },
  ];
  owedBySupplier.clear();
};

/* ---------- 1. tying the knot writes BOTH sides ---------------------- */
{
  reset();
  eq(scope.linkCustomerSupplier('C1', 'S1'), true, 'a customer can be tied to a supplier');
  eq(data.customers[0].linkedSupplierId, 'S1', 'the customer points at the supplier');
  eq(data.suppliers[0].linkedCustomerId, 'C1', 'AND the supplier points back');
  eq(scope.linkedSupplierOf(data.customers[0]).id, 'S1', 'so each side can find the other');
  eq(scope.linkedCustomerOf(data.suppliers[0]).id, 'C1', 'from either direction');

  /* Untying is the same operation with nothing on the other end, and it
     has to clear BOTH sides too. */
  scope.linkCustomerSupplier('C1', null);
  eq(data.customers[0].linkedSupplierId, null, 'untying clears the customer');
  eq(data.suppliers[0].linkedCustomerId, null, 'and releases the supplier, not just the customer');
  eq(scope.linkedSupplierOf(data.customers[0]), null, 'after which neither side finds the other');
  eq(scope.linkedCustomerOf(data.suppliers[0]), null, 'in either direction');
}

/* ---------- 2. a counterpart can only be claimed once ---------------- *
 * THE TRAP. Re-pointing a link without releasing the old partner leaves
 * that partner still claiming this record, so one supplier is netted
 * against two customers -- and the same money is counted twice.
 */
{
  reset();
  scope.linkCustomerSupplier('C1', 'S1');
  // The same customer changes their mind about which supplier it is.
  scope.linkCustomerSupplier('C1', 'S2');
  eq(data.customers[0].linkedSupplierId, 'S2', 'the customer follows the change');
  eq(data.suppliers[1].linkedCustomerId, 'C1', 'the new supplier points back');
  eq(data.suppliers[0].linkedCustomerId, null,
    'and the supplier that was dropped stops claiming them');

  reset();
  scope.linkCustomerSupplier('C1', 'S1');
  // A DIFFERENT customer claims the supplier that C1 already holds.
  scope.linkCustomerSupplier('C2', 'S1');
  eq(data.suppliers[0].linkedCustomerId, 'C2', 'the supplier follows the newer claim');
  eq(data.customers[1].linkedSupplierId, 'S1', 'which is written on that customer');
  eq(data.customers[0].linkedSupplierId, null,
    'and the customer who held it before is released — never two claims on one record');
}

/* ---------- 3. a link to nobody is refused, not half-written --------- */
{
  reset();
  eq(scope.linkCustomerSupplier('NOPE', 'S1'), false, 'a customer that does not exist links nothing');
  eq(data.suppliers[0].linkedCustomerId, undefined, 'and the supplier is left untouched');
  /* A supplier id that matches nothing is an UNLINK, not a crash: the
     customer ends up pointing at nobody, which is the truth. */
  scope.linkCustomerSupplier('C1', 'GONE');
  eq(data.customers[0].linkedSupplierId, null, 'a supplier that does not exist unlinks rather than dangles');
}

/* ---------- 4. what the two of them owe each other ------------------- */
{
  reset();
  owedBySupplier.set('S1', 150000);
  scope.linkCustomerSupplier('C1', 'S1');

  const both = scope.bothSidesPosition(data.customers[0]);
  eq(both.owed, 400000, 'what they owe the shop comes from the customer record');
  eq(both.owing, 150000, 'what the shop owes them comes from the supplier ledger');
  eq(both.net, 250000, 'and the net is the difference, their debt first');
  eq(both.supplier.id, 'S1', 'with the supplier record carried along for naming');

  owedBySupplier.set('S1', 900000);
  eq(scope.bothSidesPosition(data.customers[0]).net, -500000,
    'owing them more than they owe flips the sign rather than clamping at zero');

  /* Null, not zero. A person with only one side has no net position, and
     printing a reassuring zero would invent one -- the same rule the
     rest of the app follows about unknown against nothing. */
  eq(scope.bothSidesPosition(data.customers[1]), null,
    'an unlinked customer has NO net position, which is not the same as a net of zero');
  eq(scope.bothSidesPosition(null), null, 'and no customer at all makes no claim either');

  /* A negative debt (a credit balance) must not be read as the shop
     owing them twice over. */
  reset();
  owedBySupplier.set('S1', 100000);
  data.customers[0].debt = -50000;
  scope.linkCustomerSupplier('C1', 'S1');
  eq(scope.bothSidesPosition(data.customers[0]).owed, 0,
    'a customer in credit owes nothing, rather than a negative amount');
}

/* ---------- 5. reached from both forms, and it survives a save ------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

  t.check(/id="c_link_supplier"/.test(src) && /id="s_link_customer"/.test(src),
    'either side of the relationship can tie the knot');
  t.check(/cfFillLinkPicker\(c\);/.test(code) && /sfFillLinkPicker\(s\);/.test(code),
    'and opening either form shows who they are already tied to');
  t.check(/cfFillLinkPicker\(null\);/.test(code) && /sfFillLinkPicker\(null\);/.test(code),
    'while a fresh form starts untied rather than inheriting the last one');

  /* Both saves must go through the one function that writes both sides.
     A save that set only its own field is exactly the half-link this
     file exists to prevent. */
  /* Anchored to the EDIT branch specifically. A bare search for the call
     is satisfied by the new-customer line below it, so deleting this one
     left the test green while editing a customer silently stopped
     writing the link at all. */
  t.check(/linkCustomerSupplier\(id, linkSupplierId\);\s*\r?\n\s*\} else \{/.test(code),
    'editing a customer writes the link through the symmetric writer');
  t.check(/if\(!editingCustomerId\) linkCustomerSupplier\(id, linkSupplierId\);/.test(code),
    'including a brand new customer, once the record exists to point at');
  t.check(/linkCustomerSupplier\(document\.getElementById\('s_link_customer'\)\.value \|\| null, id\);/.test(code),
    'and saving a supplier writes it through the same one');

  /* Only free counterparts are offered: showing a taken one produces a
     save that silently steals it from whoever held it. */
  const fill = extractFunction(src, 'cfFillLinkPicker', 'index.html');
  t.check(/!sup\.linkedCustomerId \|\| \(customer && sup\.linkedCustomerId === customer\.id\)/.test(fill),
    'the picker offers unclaimed counterparts, plus the one already held');

  // Both directions of the sync, or the link empties itself on reload.
  t.check(/linkedSupplierId:c\.linked_supplier_id\|\|null/.test(code)
    && /linked_supplier_id:c\.linkedSupplierId\|\|null/.test(code),
    'the customer half round-trips to the server, both ways');
  t.check(/linkedCustomerId:s\.linked_customer_id\|\|null/.test(code)
    && /linked_customer_id:s\.linkedCustomerId\|\|null/.test(code),
    'and so does the supplier half');

  /* WHOSE WAY THE BALANCE FALLS, said the same way in both places.
     Found live: the form's hint read "400,000 their way" about a customer
     who owed the shop 400,000, while the card on the same facts read
     "your way". Two screens contradicting each other about which
     direction money moves is how a shopkeeper pays somebody who owes
     them. `owed` is what THEY owe the shop, so more of it is the shop's
     way -- in both. */
  const hint = extractFunction(src, 'cfShowLinkHint', 'index.html');
  t.check(/owed > owing[\s\S]{0,500}?your way on balance/.test(hint),
    'the form says the balance is YOUR way when they owe you more');
  t.check(/owing-owed[\s\S]{0,60}?their way on balance/.test(hint),
    'and their way when you owe them more');
  t.check(/both\.net > 0 \? fmtUGX\(Math\.round\(both\.net\)\) \+ ' your way'/.test(src),
    'and the card agrees with it, rather than reading the sign the other way round');

  // Visible without opening anything.
  t.check(/Also a supplier/.test(src) && /Also a customer/.test(src),
    'both lists say when somebody is on the other one too');
  t.check(/const both = bothSidesPosition\(c\);/.test(src) && /if\(!both\) return '';/.test(src),
    'and the card nets them only when there IS another side');

  const mig = read('supabase/migrations/0063_customer_supplier_link.sql');
  /* Each constraint asserted on its own. A bare search for the clause is
     satisfied by whichever of the two still has it, so dropping it from
     one FK left the test green while deleting that side stranded the
     other pointing at a row that no longer exists. */
  t.check(/references suppliers\(shop_id, id\)\s*\r?\n\s*on delete set null;/.test(mig),
    'deleting a supplier leaves its customer a normal record, not a dangling pointer');
  t.check(/references customers\(shop_id, id\)\s*\r?\n\s*on delete set null;/.test(mig),
    'and deleting a customer does the same for its supplier');
  t.check(/create unique index if not exists customers_linked_supplier_uniq/.test(mig)
    && /where linked_supplier_id is not null/.test(mig),
    'and the database refuses two customers claiming one supplier');
}

process.exit(t.done() ? 1 : 0);
