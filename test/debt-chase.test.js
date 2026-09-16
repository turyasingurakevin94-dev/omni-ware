#!/usr/bin/env node
'use strict';
/*
 * Chasing what is owed.
 *
 * The Debtors list answers "who owes me"; this queue answers the
 * question after it — who do I ask today, and what do I say. Three
 * rules take rows OUT of it, and they are the whole point:
 *
 *   GRACE. Nobody is chased before the shop's own terms have run.
 *   REST. Nobody is chased twice inside the resting period.
 *   A BALANCE THAT ADDS UP. A customer whose stored balance disagrees
 *   with its own ledger is never sent a demand — the app cannot
 *   explain that figure, so it must not ask for it.
 *
 * And the message is written from that customer's own invoices: it
 * names them, says plainly what they do not cover, and never prints a
 * breakdown that outruns the balance.
 *
 * Run: node test/debt-chase.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('debt chase');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';
const ago = (days) => {
  const d = new Date(Date.parse(TODAY + 'T00:00:00Z') - days * 86400000);
  return d.toISOString().slice(0, 10);
};

/* Charges and payments, in the shape the debt ledger keeps them. */
const charge = (id, days, amount, quoteId) => ({ id, date: ago(days), type: 'charge', amount, quoteId, note: '' });
const paid = (id, days, amount) => ({ id, date: ago(days), type: 'payment', amount, note: '' });

const data = {
  presetChaseAfterDays: 7,
  presetChaseRestDays: 3,
  presetDebtChases: {},
  customers: [
    // Long overdue, two open invoices, has paid before.
    { id: 'C1', name: 'Mulongo', phone: '0772 111 222', location: 'Kireka', debt: 2450000,
      debtLog: [charge(1, 95, 1200000, 11), charge(2, 40, 1500000, 12), paid(3, 30, 250000)] },
    // Overdue, smaller, in the same band as C3 but bigger.
    { id: 'C2', name: 'Birimuye', phone: '0700 333 444', location: '', debt: 800000,
      debtLog: [charge(4, 35, 800000, 13)] },
    // Overdue, smaller still, never paid anything.
    { id: 'C3', name: 'David', phone: '', location: 'Ntinda', debt: 300000,
      debtLog: [charge(5, 33, 300000, 14)] },
    // Inside the grace period: late by nobody's reckoning.
    { id: 'C4', name: 'Fresh Buyer', phone: '0755 999 000', location: '', debt: 900000,
      debtLog: [charge(6, 3, 900000, 15)] },
    // Balance does not match its own ledger: never chased.
    { id: 'C5', name: 'Drifted', phone: '0788 555 666', location: '', debt: 500000,
      debtLog: [charge(7, 60, 200000, 16)] },
    // A balance with nothing dated behind it.
    { id: 'C6', name: 'Undated', phone: '0700 777 888', location: '', debt: 150000, debtLog: [] },
    // Owes nothing.
    { id: 'C7', name: 'Settled', phone: '0700 000 111', location: '', debt: 0, debtLog: [] },
  ],
  savedQuotes: [
    { id: 11, customerId: 'C1', invoiced: true, voided: false, invoicedAt: ago(95), amountPaid: 250000,
      items: [{ qty: 1, sellPrice: 1200000, price: 0 }] },
    { id: 12, customerId: 'C1', invoiced: true, voided: false, invoicedAt: ago(40), amountPaid: 0,
      items: [{ qty: 1, sellPrice: 1500000, price: 0 }] },
    { id: 13, customerId: 'C2', invoiced: true, voided: false, invoicedAt: ago(35), amountPaid: 0,
      items: [{ qty: 1, sellPrice: 800000, price: 0 }] },
    { id: 14, customerId: 'C3', invoiced: true, voided: false, invoicedAt: ago(33), amountPaid: 0,
      items: [{ qty: 1, sellPrice: 300000, price: 0 }] },
    // Voided and fully paid invoices are not money anybody owes.
    { id: 17, customerId: 'C1', invoiced: true, voided: true, invoicedAt: ago(20), amountPaid: 0,
      items: [{ qty: 1, sellPrice: 999000, price: 0 }] },
  ],
};

let saved = 0;
const env = {
  data,
  todayISO: () => TODAY,
  saveData: () => { saved++; },
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  fmtShortDate: (iso) => String(iso),
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
  customerLastPaymentDate: (c) => {
    const pays = (c.debtLog || []).filter((l) => l.type === 'payment');
    return pays.length ? pays[pays.length - 1].date : null;
  },
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'debtChaseRows', 'debtChaseInvoices', 'debtChaseMessage',
    'markDebtChased', 'unmarkDebtChased', 'pruneDebtChases',
    'promisesFor', 'promiseState', 'promiseLatest', 'promisesBroken',
    'debAllRows', 'customerOpenCharges', 'customerOldestOpenChargeDate',
    'customerDebtProgress', 'customerDebtDrift', 'customerLedgerTotal', 'customerOrdersFor',
    'invoiceBalanceDue', 'invoiceNumberLabel', 'agingBandFor', 'agingDaysLabel',
    'daysSinceDate',
  ].map((n) => extractFunction(src, n, 'index.html'))
    .concat([
      extractDeclaration(src, 'AGING_BANDS', 'index.html'),
      extractDeclaration(src, 'DEBT_CHASE_INVOICE_LINES', 'index.html'),
    ]),
  env, ['debtChaseRows', 'debtChaseMessage', 'markDebtChased', 'unmarkDebtChased', 'pruneDebtChases']);
} catch (e) { err = e; }
t.check(!!scope, `the chase chain compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. who is in the queue, and who is deliberately not ------- */
if (scope) {
  const q = scope.debtChaseRows();
  eq(q.due.map((r) => r.name).join(','), 'Mulongo,Birimuye,David',
    'worst-aged band first, biggest inside it');
  t.check(!q.due.some((r) => r.name === 'Fresh Buyer'),
    'nobody inside the grace period is chased — they are not late yet');

  const blocked = q.blocked.map((r) => r.name + ':' + r.why).join(',');
  eq(blocked, 'Drifted:drift,Undated:undated',
    'a balance that disagrees with its own history, and one with no dated charge, are HELD BACK and named');
  t.check(!q.due.some((r) => r.name === 'Drifted'),
    'a demand is never written for a figure the app itself cannot explain');
  t.check(!q.due.concat(q.blocked).some((r) => r.name === 'Settled'),
    'and somebody who owes nothing is not on a debt screen at all');
}

/* ---------- 2. resting between chases --------------------------------- */
if (scope) {
  data.presetDebtChases = { C2: ago(1) };
  const q = scope.debtChaseRows();
  t.check(!q.due.some((r) => r.name === 'Birimuye'),
    'somebody chased yesterday is not chased again today');
  eq(q.resting.map((r) => r.name).join(','), 'Birimuye',
    'they are named as resting, so the queue\'s silence about them is visible');
  eq(q.resting[0].chasedDaysAgo, 1, 'with how long ago it was');

  data.presetDebtChases = { C2: ago(5) };
  t.check(scope.debtChaseRows().due.some((r) => r.name === 'Birimuye'),
    'and once the resting days have run they come back into the queue');
  data.presetDebtChases = {};
}

/* ---------- 3. the message ------------------------------------------- */
if (scope) {
  const q = scope.debtChaseRows();
  const ident = { name: 'OMNI-WARE', phone: '0754 333419' };
  const msg = scope.debtChaseMessage(q.due.find((r) => r.name === 'Mulongo'), ident);

  t.check(/Hello Mulongo,/.test(msg), 'it greets them by name');
  t.check(/OMNI-WARE here/.test(msg) && /2,450,000 UGX/.test(msg),
    'says who is asking and for how much');
  t.check(/INV-0011/.test(msg) && /INV-0012/.test(msg),
    'and NAMES the invoices, so nobody has to go and work out what the total is made of');
  t.check(/950,000 UGX/.test(msg),
    'each invoice carries what is still due on it, not what it was worth new');
  t.check(/outstanding/.test(msg) && /last payment reached us on/.test(msg),
    'with how long it has run and when they last paid');
  t.check(/does not match your own records, tell us/.test(msg),
    'and it invites a correction rather than assuming the shop is never wrong');

  const never = scope.debtChaseMessage(q.due.find((r) => r.name === 'David'), ident);
  t.check(/have not received a payment on this account yet/.test(never),
    'somebody who has never paid is not told about a payment that never happened');

  /* A balance bigger than the invoices behind it: the remainder is
     named as carried, never folded in silently. */
  const carried = scope.debtChaseMessage({ name: 'Carried', debt: 500000, ageDays: 40, lastPaid: null,
    invoices: [{ no: 'INV-0031', date: '2026-08-01', due: 300000 }] }, ident);
  t.check(/200,000 UGX carried on the account from earlier/.test(carried),
    'what the invoices do not cover is said plainly');

  /* And a breakdown that outruns the balance is not printed at all. */
  const over = scope.debtChaseMessage({ name: 'Over', debt: 100000, ageDays: 40, lastPaid: null,
    invoices: [{ no: 'INV-0041', date: '2026-08-01', due: 400000 }] }, ident);
  t.check(!/INV-0041/.test(over),
    'a breakdown bigger than the balance is withheld — the shop must not ask for a figure it cannot stand behind');

  const many = scope.debtChaseMessage({ name: 'Many', debt: 900000, ageDays: 40, lastPaid: null,
    invoices: Array.from({ length: 9 }, (_, i) => ({ no: 'INV-00' + (50 + i), date: '2026-08-01', due: 100000 })) }, ident);
  t.check(/and 3 more invoices\./.test(many),
    'a long list is cut with the count said out loud, never silently');
}

/* ---------- 4. marking, undoing, pruning ------------------------------ */
if (scope) {
  const before = saved;
  scope.markDebtChased('C1');
  eq(data.presetDebtChases.C1, TODAY, 'taking the message away stamps the chase');
  t.check(saved > before, 'and saves it, so another device sees it too');
  t.check(!scope.debtChaseRows().due.some((r) => r.name === 'Mulongo'),
    'which takes them out of today\'s queue');
  scope.unmarkDebtChased('C1');
  t.check(!data.presetDebtChases.C1 && scope.debtChaseRows().due.some((r) => r.name === 'Mulongo'),
    'and "not sent" puts them straight back — the app cannot see WhatsApp, so the owner has the last word');

  data.presetDebtChases = { C7: ago(2), C1: ago(1) };
  scope.pruneDebtChases();
  t.check(!data.presetDebtChases.C7 && !!data.presetDebtChases.C1,
    'stamps for customers who have paid up are dropped — that conversation is over');
  data.presetDebtChases = {};
}

/* ---------- 5. the wiring --------------------------------------------- */
/*
 * WHERE THIS QUEUE IS NOW. It had a screen of its own until the app
 * noticed it was drawing the same rows twice: the Follow-ups hub has
 * always been built on debtChaseRows(), carried all four of its bands,
 * written the demand with debtChaseMessage and stamped it with
 * markDebtChased. Two screens were reading one engine and writing one
 * ledger, and only the hub could put the money in the same message as
 * the delivery the same client is waiting for.
 *
 * So everything above this line is untouched -- the engine is the
 * subject of sections 1 to 4 and it did not move. What changed is which
 * screen draws it, and these checks follow it there. The door that said
 * "chase" still opens, on the lens it meant.
 */
{
  /* Anchored on the rail itself, not on the whole file. A door
     ELSEWHERE may still carry the old key -- Analysis offers one, and
     the Manager's own door is keyed 'chase' -- and that is the point of
     the alias below rather than something to stamp out: every goToTab
     call already written goes on working. What must not exist is a
     second home for this work in the map. */
  const sidebar = (/<aside class="sidebar[^"]*"[\s\S]*?<\/aside>/.exec(src) || [''])[0];
  t.check(!/id="tab-chase"/.test(src) && !/data-tab="chase"/.test(sidebar),
    'Chase debts is not a destination of its own any more');
  const alias = extractFunction(src, 'resolveTab', 'index.html');
  /* msgFocus, not msgLens: the lenses are the STATES of a message now --
     to send, waiting on a reply, sent -- and the outbox is grouped by
     reason inside them. Chase debts WAS one of those groups, so its door
     opens the outbox focused on it. Same address, same slice. */
  t.check(/if\(tab === 'chase'\)\{[^}]*msgLens = 'send'; msgFocus = 'money'; return 'messages'; \}/.test(alias),
    'but the old door still opens it, on the money lens it meant — resolved once at the top of goToTab, '
    + 'so a saved last-tab cannot boot into a section that is gone');
  t.check(!/function renderChaseScreen/.test(src) && !/renderChaseBadge/.test(src),
    'and the screen and the badge that served it are gone rather than left unreachable');

  /* THE FOUR ACTS THAT MADE IT A SCREEN, each still performed, each on
     the hub. These were checked against renderChaseScreen; they are
     checked against the functions that do the same work now. */
  const contact = extractFunction(src, 'renderFollowUpsContact', 'index.html');
  const digest = extractFunction(src, 'followUpHubDigest', 'index.html');
  const record = extractFunction(src, 'recordFollowUpClient', 'index.html');
  const wire = extractFunction(src, 'wireFollowUpsScreen', 'index.html');
  t.check(/debtChaseMessage\(row\.chase, shopIdentity\(\), \{bare:true\}\)/.test(digest),
    'the demand is still written from the customer’s own invoices — the same builder, dropping only the '
    + 'greeting and sign-off the hub’s message already has');
  t.check(/followUpWaUrl\(row, draftOf\(cid\)/.test(wire),
    'sending opens WhatsApp with the message written — the same door the quote sender uses');
  t.check(/if\(row\.chase\)\{ markDebtChased\(String\(customerId\)\); told\.chased = true; \}/.test(record),
    'and saying it went records the chase');
  t.check(/unrecordFollowUpClient/.test(src)
    && /if\(told\.chased\) unmarkDebtChased\(told\.customerId\);/.test(extractFunction(src, 'unrecordFollowUpClient', 'index.html')),
    'while "It did not go" takes that stamp back — the undo the old footer offered, now covering every '
    + 'engine the one message spoke for');
  t.check(/fup-pay/.test(contact) && /openCustomerDebtModal\(btn\.dataset\.cust, 'payment'\)/.test(wire),
    'a customer who pays is received through the same door as the Debtors list');
  t.check(/class="ow-msg fup-msg"/.test(contact) && /draftOf\(cid\) \|\| followUpHubDigest/.test(wire),
    'the message is editable, and what SENDS is what the owner sees — not a copy of it');

  /* The badge did not go dark, it went to the row that now owns the
     work: a debtor the money lens would ask today is a hub row, so the
     count on the rail did not change when the screen went. */
  const badge = extractFunction(src, 'renderFollowUpBadge', 'index.html');
  t.check(/followUpHubRows\(Date\.now\(\)\)\.length/.test(badge),
    'the rail count comes off the hub’s own rows, which are built from this derivation among others');
  t.check(/renderFollowUpBadge\(\);/.test(extractFunction(src, 'refreshNavBadges', 'index.html')),
    'and refreshes with every other badge');
  t.check(/chaseAfterDays:d\.presetChaseAfterDays/.test(src) && /debtChases:d\.presetDebtChases\|\|\{\}/.test(src)
    && /presetChaseAfterDays: presets\.chaseAfterDays != null/.test(src),
    'the terms and the chase stamps load and persist with the shop settings');
}

/* ---------- 6. a queue, and one debtor being worked ------------------ */
/*
 * Three shapes before this one. First the spare parts: .buy-controls
 * with the queue's state in a hint, .buy-tail/.buy-row as shopping rows,
 * a dashed line between debtors. Then a card per debtor -- which put
 * five editable messages on one screen, four of which nobody was about
 * to send. Then its own console: the queue left, one debtor's work
 * right.
 *
 * Now it is a LENS on a queue that was already drawing these same rows.
 * The shape is the one that console arrived at -- a queue of .ow-lr rows
 * and one client's work beside it -- because that is the shape the hub
 * already had. What this section checks is that folding it in dropped
 * nothing: the four things the old screen could say that the card could
 * not, each with a home.
 */
{
  const contact = extractFunction(src, 'renderFollowUpsContact', 'index.html');
  const held = extractFunction(src, 'fupHeldPanelHTML', 'index.html');
  const heldRows = extractFunction(src, 'followUpHeldBack', 'index.html');
  const summary = extractFunction(src, 'renderFollowUpSummary', 'index.html');

  /* 1. THE LENS ITSELF. 'money' is one of the six reasons the queue
        narrows by, and it is the one the retired door lands on. */
  t.check(/\['money','Money'\]/.test(extractDeclaration(src, 'FUP_WHY', 'index.html')),
    'the money queue is a named lens on the hub, not a filter somebody has to construct');

  /* 2. WHAT THE MESSAGE QUOTES. The invoice-by-invoice table was the one
        instrument the old screen had that the card did not: the owner
        checks the lines add to the balance BEFORE the demand goes. It is
        drawn from row.chase.invoices -- debtChaseInvoices, the same
        reading the message itself is written from. */
  t.check(/What the message quotes/.test(contact)
    && /ch\.invoices\.slice\(0, DEBT_CHASE_INVOICE_LINES\)/.test(contact),
    'the invoices behind the demand are on the client’s card, so the arithmetic can be read before it is sent');
  t.check(/class="ow-tbl-f"><div class="ow-tbl-c">Balance/.test(contact),
    'ending with the balance they add to, which is what makes it a check rather than a list');
  t.check(/The invoices on file add up to more than this balance/.test(contact)
    && /No invoice stands behind this balance/.test(contact),
    'and where they do NOT stand behind the balance it says which of the two reasons it is — the same two '
    + 'the message itself distinguishes, rather than printing a breakdown the shop cannot stand behind');

  /* 3. THE ONES DELIBERATELY NOT ASKED. Three groups in a panel of their
        own on the old screen; the hub's Held back panel, which already
        named them in Chase's own words, now carries their acts too. A
        held-back client is by definition not in the queue, so there is
        no card of theirs to put these on. */
  t.check(/chase\.promised\.forEach/.test(heldRows) && /chase\.resting\.forEach/.test(heldRows)
    && /chase\.blocked\.forEach/.test(heldRows),
    'the promised, resting and held-back accounts are all still named rather than dropped');
  t.check(/fup-held-promise/.test(held) && /fup-held-unpromise/.test(held) && /fup-held-again/.test(held),
    'with the acts they need: a different day, a day they never named, and a chase that can be repeated');
  t.check(/promiseId: r\.promise\.id/.test(heldRows),
    'the promise carries its own id, so "They did not say that" removes the row it is standing on');

  /* 4. THE POSITION IS DEBTORS', AND STAYS THERE. "To chase", "Between
        them" and "Oldest" were three tiles on the retired screen, and
        two of them are a reading of the whole book. That screen knew it:
        it borrowed the Debtors aging bar and labelled it "the whole
        book, not just this queue", with a note saying the age filter
        belongs on the screen that owns the book. This queue is
        deliberately a subset -- it is who is past your terms TODAY,
        rested and de-duplicated -- so a total computed over it describes
        a slice of the shop rather than the shop.

        So the fold does not move those figures, it declines to draw them
        twice. The count keeps the tile it always had; the sub stays the
        short label the approved canvas gives all five; and the help says
        where the book is, so the division the app states in three other
        places is readable and not merely true. */
  t.check(/tile\('Money', 'money', n\('money'\) \? 'past your terms'/.test(summary),
    'the Money tile keeps the canvas’s own sub, in the shape the other four wear');
  t.check(!/moneyOwed|moneyNote/.test(contact) && !/moneyOwed/.test(summary),
    'and no total is worked out over this queue — a position over a subset is a position nobody can trust');
  /* THE SAME CLAIM AT TWO NEW ADDRESSES, and both moved for a reason.
     The SECTION is tab-messages: Follow-ups and WhatsApp were merged, so
     there is no tab-followups to look in and this lookup found nothing
     rather than finding a line that had gone. And the reading it points
     at is no longer called Debtors -- Debtors was cut and is the Owing
     lens on Customers now, so a note still sending the owner to Debtors
     would name a screen the rail does not have. What the assertion
     means is unchanged and is the only thing that matters: this queue is
     a SUBSET, it says so, and it says where the whole book is read. */
  const sect = (/<section id="tab-messages"[\s\S]*?<\/section>/.exec(src) || [''])[0];
  t.check(/What the whole book comes to, and how much of it is old, is <b>Customers &rarr; Owing<\/b>/.test(sect),
    'the money lens names where that reading does live, rather than leaving the owner to wonder why it is not here');
  /* And it is the MONEY lens's alone. Under Telling there is no book of
     news for it to point at, so a note that stayed up would be a
     pointer to nothing. */
  t.check(/book\.hidden = !\(msgLens === 'send' && msgFocus !== 'telling'\)/.test(extractFunction(src, 'renderMessages', 'index.html')),
    'and only under the lens it is about');

  /* 5. THE TWO RULES. They were a sentence and a fold-out form in the
        old header. They are fields in THIS screen's header now, beside
        Quiet after, which is where this screen has always kept the one
        rule it turns on -- so being fields is one tap fewer than the
        fold-out was, and the three rules of the screen are one group.
        On screen only under the lens they decide: they settle nothing
        under any other, and three rule fields do not fit a phone header.
        Read on Did it work whatever lens is open, so choosing the lens
        is never the only way to find out what the rule is. */
  /* STILL ONE GROUP, at the address the merge gave it. The header those
     fields sat in was the console header of a screen that no longer
     exists; Messages wears the card system's title block, which has no
     room for three rule fields and no "i" to fold them behind. So the
     group moved down into #msg_fup_body -- the hub's own pane, which
     also carries the held-back reasons and the register -- and the
     screen grew a door to it, because three live features behind a
     permanently hidden div is three features nobody can reach. What is
     asserted is what was always asserted: the two rules are FIELDS, not
     a fold-out form, and they are grouped with the rule that was
     already there rather than scattered. */
  const sec = (/<section id="tab-messages"[\s\S]*?<\/section>/.exec(src) || [''])[0];
  t.check(/id="fup_chase_after"/.test(sec) && /id="fup_chase_rest"/.test(sec)
    && /class="fup-rules"/.test(sec),
    'the two rules the queue obeys are fields, grouped with the rule that was already there');
  /* The door. Without it the group, the reasons and the register are in
     the file and on no screen. */
  t.check(/id="msg_hub_btn"[^>]*aria-controls="msg_fup_body"/.test(sec),
    'and the pane holding them has a door, so the rules can actually be changed');
  t.check(/hub\.hidden = onPost \|\| !msgHubOpen/.test(extractFunction(src, 'renderMessages', 'index.html')),
    'which opens and shuts it, and shuts it under Posting — there is no queue there for a rule to govern');
  const render = extractFunction(src, 'renderFollowUps', 'index.html');
  t.check(/fupTab === 'contact' && fupWhy === 'money'/.test(render) && /field\.hidden = !moneyLens/.test(render),
    'and they are on screen only while the lens they decide is the one being read');
  /* The layer's own field paints, so [hidden] alone could not hide it --
     the trap css-class-hooks exists for, and the companion it demands. */
  t.check(src.indexOf('.ow-f[hidden]{display:none;}') > src.indexOf('.ow-f{display:flex'),
    'with the [hidden] companion that lets a field actually hide, written after the rule it outranks');
  t.check(/Money is asked for after/.test(extractFunction(src, 'renderFollowUpScore', 'index.html'))
    && /And nobody is asked twice inside/.test(extractFunction(src, 'renderFollowUpScore', 'index.html')),
    'and both are written down where every other rule of this screen is');
  t.check(/\['fup_chase_after', 'presetChaseAfterDays', 7\], \['fup_chase_rest', 'presetChaseRestDays', 3\]/.test(
      extractFunction(src, 'wireFollowUpsScreen', 'index.html')),
    'bound once at parse time, as the rule beside them is — they sit in the static header, not in the '
    + 'region that redraws, so there is nothing for a delegated listener to survive');

  /* THE SPARE PARTS ARE GONE. Four screens wore them because they were
     there. A dead rule in the stylesheet is how a fifth ends up in one. */
  t.check(!/\.buy-row\{/.test(src) && !/\.buy-controls\{/.test(src) && !/\.buy-tail h4\{/.test(src)
    && !/\.chase-row\{/.test(src) && !/\.chase-head\{/.test(src)
    && !/\.chase-card\{/.test(src) && !/\.chase-list\{/.test(src) && !/\.chase-acts\{/.test(src),
    'the borrowed classes are deleted, not left in the drawer — the card-per-debtor rules with them');
  /* .chase-mini and .chase-tail outlived this screen once, because the
     creditors list wore them for its undated and missed bills. That
     panel is gone too -- a day is named on the bill it belongs to now --
     so the last wearer went with it and so did the rules. */
  t.check(!/\.chase-mini\{/.test(src) && !/\.chase-tail h4\{/.test(src),
    'and the two that outlived it are gone as well, now their last wearer has');
  /* And the console vocabulary the screen itself wore. Nothing in the
     file reaches for a .ch-* class any more, so the rules go the same
     way the families above did -- the comment where they stood says so
     and names where each part went. */
  t.check(!/\.ch-work\{/.test(src) && !/\.ch-qr\{/.test(src) && !/\.ch-strip\{/.test(src)
    && !/\.ch-rules\{/.test(src) && !/\.ch-w-body\{/.test(src),
    'and its own .ch-* console vocabulary goes with it, rather than sitting in the stylesheet unworn');
  t.check(!/class="form-panel chase-controls"/.test(src) && !/id="chase_after"/.test(src)
    && !/id="chase_rest"/.test(src) && !/id="chase_rules_btn"/.test(src),
    'the rules form and the three ids its listeners bound to at parse time are gone together — a listener '
    + 'left behind would throw on boot at getElementById(...).addEventListener');
}

process.exit(t.done() ? 1 : 0);
