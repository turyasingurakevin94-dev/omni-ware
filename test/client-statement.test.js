#!/usr/bin/env node
'use strict';
/*
 * The statement a customer reads.
 *
 * The whole requirement is one sentence: it must be the same document the
 * shop's own screen shows. A statement that disagrees with the one behind
 * the counter is worse than no statement, because it turns the portal
 * from evidence into an argument. So the arithmetic here is not merely
 * tested against fixtures -- it is run side by side with index.html's
 * customerStatementRows over the same ledger, and every figure compared.
 *
 * The other question this screen raises is what a customer may read of
 * what the shop wrote. customer_debt_log.note is free text typed into a
 * box nobody ever told the shop a customer would see, so what crosses is
 * the invoice reference out of the app's OWN generated note and nothing
 * else -- recognised by the same test index.html uses for it.
 *
 * Run: node test/client-statement.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client statement');
const fn = read('supabase/functions/client-portal/index.ts');
const page = read('client.html');
const app = read('index.html');
const noComments = fn.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const { buildStatement } = compileScope(
  [extractFunction(fn, 'buildStatement', 'client-portal'), extractFunction(fn, 'statementRef', 'client-portal')],
  {}, ['buildStatement'], { typescript: true });

const LOG = [
  { id: 1, date: '2026-05-10', type: 'charge', amount: 318000, note: 'Auto-sync — INV-2200' },
  { id: 2, date: '2026-08-21', type: 'charge', amount: 880000, note: 'Auto-sync — INV-2291' },
  { id: 3, date: '2026-08-28', type: 'payment', amount: 868000, note: 'Mobile money, thank you' },
  { id: 4, date: '2026-09-02', type: 'charge', amount: 430000, note: 'Auto-sync — INV-2314' },
  { id: 5, date: '2026-09-05', type: 'payment', amount: 760000, note: 'Cash at the shop' },
  { id: 6, date: '2026-09-11', type: 'charge', amount: 1240000, note: 'Auto-sync — INV-2336' },
];
const FROM = '2026-06-01', TO = '2026-09-14';

/* ---------- 1. the same document the shop sees ------------------------ */
{
  const adminRows = (log, debt) => compileScope(
    [extractFunction(app, 'customerStatementRows', 'index.html'), extractFunction(app, 'customerLogQuoteResolver', 'index.html'), extractFunction(app, 'invoiceNumberLabel', 'index.html')],
    { data: { customers: [{ id: 'C1', debt, debtLog: log }] } },
    ['customerStatementRows'],
  ).customerStatementRows('C1', FROM, TO);

  const cases = [
    ['the ordinary ledger', LOG, 1240000],
    ['a ledger that disagrees with the balance', LOG, 1500000],
    ['nothing at all', [], 0],
    ['nothing inside the period', [LOG[0]], 318000],
    ['two entries on one day', [
      { id: 9, date: '2026-07-01', type: 'charge', amount: 100, note: '' },
      { id: 8, date: '2026-07-01', type: 'payment', amount: 40, note: '' },
    ], 60],
    ['a payment before any charge', [
      { id: 1, date: '2026-07-01', type: 'payment', amount: 500, note: '' },
    ], -500],
  ];
  cases.forEach(([label, log, debt]) => {
    const mine = buildStatement(log, FROM, TO, debt);
    const theirs = adminRows(log, debt);
    const shape = (r) => r.rows.map(x => [x.date, x.charge, x.payment, x.balance]);
    t.check(mine.opening === theirs.opening && mine.closing === theirs.closing
      && mine.charged === theirs.charged && mine.paid === theirs.paid
      && mine.agrees === theirs.agrees
      && JSON.stringify(shape(mine)) === JSON.stringify(shape(theirs)),
      `${label}: every figure matches the shop's own screen`);
  });

  /* Two entries on one day have no other way to be ordered, and a running
     balance that reorders them shows a customer a sequence that never
     happened. Written second means second, whatever the ids sort to. */
  const sameDay = buildStatement([
    { id: 9, date: '2026-07-01', type: 'charge', amount: 100, note: '' },
    { id: 8, date: '2026-07-01', type: 'payment', amount: 40, note: '' },
  ], FROM, TO, 60);
  t.check(JSON.stringify(sameDay.rows.map(r => r.balance)) === JSON.stringify([-40, 60]),
    `same-day entries run in the order they were written (${sameDay.rows.map(r => r.balance).join(', ')})`);
}

/* ---------- 2. the opening, and the running balance ------------------- */
{
  const s = buildStatement(LOG, FROM, TO, 1240000);
  t.check(s.opening === 318000,
    `everything before the period collapses into one figure (${s.opening})`);
  t.check(s.rows.length === 5, `and is not reprinted as rows (${s.rows.length})`);
  t.check(JSON.stringify(s.rows.map(r => r.balance)) === JSON.stringify([1198000, 330000, 760000, 0, 1240000]),
    `the balance runs from the opening, not from nought (${s.rows.map(r => r.balance).join(', ')})`);
  t.check(s.closing === 1240000 && s.agrees === true, 'and reaches the balance the shop is carrying');
  t.check(s.charged === 2550000 && s.paid === 1628000, 'with the period totalled both ways');

  const off = buildStatement(LOG, FROM, TO, 1500000);
  t.check(off.agrees === false, 'a ledger that does not reach the balance says so');
  t.check(off.closing === 1240000, 'and still reports what it does reach, rather than the balance');
}

/* ---------- 3. what of the note crosses ------------------------------- */
/*
 * customer_debt_log.note is free text in a box whose placeholder is "e.g.
 * Goods on credit / part payment" -- but nobody ever told the shop a
 * customer would read it, and publishing what is in there today would
 * publish remarks made in private. What crosses is the invoice reference
 * out of the note the APP wrote, recognised by the same prefix
 * index.html's debtLogIsInvoiceOwned uses.
 */
{
  const s = buildStatement(LOG, FROM, TO, 1240000);
  t.check(JSON.stringify(s.rows.map(r => r.ref)) === JSON.stringify(['INV-2291', '', 'INV-2314', '', 'INV-2336']),
    `the app's own invoice reference crosses (${s.rows.map(r => r.ref || '-').join(', ')})`);
  t.check(s.rows.every(r => !('note' in r)),
    'and the note itself is not on the row at all');

  const typed = buildStatement([
    { id: 1, date: '2026-07-01', type: 'charge', amount: 100, note: 'Chased twice, promised Friday' },
  ], FROM, TO, 100);
  t.check(typed.rows[0] && typed.rows[0].ref === '',
    `a note the shop typed never reaches the customer (${JSON.stringify(typed.rows[0] && typed.rows[0].ref)})`);
  const sneaky = buildStatement([
    { id: 1, date: '2026-07-01', type: 'charge', amount: 100, note: 'Auto-sync — he always pays late' },
  ], FROM, TO, 100);
  t.check(sneaky.rows[0] && sneaky.rows[0].ref === '',
    'and neither does something merely shaped like the app\'s note');

  // The same recogniser the app uses, so the two cannot drift apart on
  // what counts as the app's own note.
  t.check(/Auto-sync — INV-/.test(app) && /\/\^Auto-sync — INV-\/\.test/.test(app),
    'index.html recognises its own note by that prefix');
  t.check(/Auto-sync — \(INV-\\d\+\)/.test(fn),
    'and this reads the same prefix');

  // Nothing else off the row travels either.
  const block = noComments.slice(noComments.indexOf('function buildStatement'));
  const rowObj = /return \{\s*date: e\.date[\s\S]*?\};/.exec(block);
  t.check(!!rowObj, 'the statement row is built in one place');
  if (rowObj) {
    ['note', 'id', 'cashTxnId', 'quoteId'].forEach((bad) => {
      t.check(!new RegExp(`\\b${bad}\\s*:`).test(rowObj[0]), `and carries no ${bad}`);
    });
  }
  /* EVERY read of the ledger, not the first one found. There are two in
     this file -- the account action reads it for the age of a debt -- and
     an exec() picked that one up, because the regex's \s* happily spans
     the newline its select sits on. So a star on the statement's own read
     went unnoticed while this check stayed green against the other. */
  const ledgerReads = [...noComments.matchAll(/from\("customer_debt_log"\)\s*\.select\("([^"]+)"\)/g)]
    .map(m => m[1]);
  t.check(ledgerReads.length >= 2, `every read of the ledger is found (${ledgerReads.length})`);
  t.check(ledgerReads.every(c => !c.includes('*')),
    `and each names its columns rather than starring them (${ledgerReads.join(' | ')})`);
  t.check(ledgerReads.some(c => c.includes('note')),
    'the statement reads the note, because the invoice reference is inside it');
}

/* ---------- 4. the period --------------------------------------------- */
{
  t.check(/const STATEMENT_MONTHS = 6;/.test(fn), 'the period is six months');
  const admin = /const CUSTOMER_STATEMENT_MONTHS = (\d+);/.exec(app);
  t.check(admin && admin[1] === '6',
    `the same six the shop's own screen uses (${admin && admin[1]})`);
  /* Built from the year and month, never by subtracting months from the
     date: standing on the 31st, month - 6 asks for the 31st of a 30-day
     month and rolls into the next one. */
  t.check(/Date\.UTC\(d\.getUTCFullYear\(\), d\.getUTCMonth\(\) - STATEMENT_MONTHS, 1\)/.test(noComments),
    'and starts at the first of a month, not by subtracting from today');
}

/* ---------- 5. the screen --------------------------------------------- */
const N = ['esc', 'money', 'plural', 'periodLabel', 'shortDate', 'stmtRowHTML', 'renderStatement'];
function render(d) {
  const nodes = { stmtBody: { innerHTML: '' }, stmtWho: { textContent: '' } };
  compileScope(N.map(n => extractFunction(page, n, 'client.html')),
    { document: { getElementById: (id) => nodes[id] || null }, MONTHS }, N).renderStatement(d);
  return { body: nodes.stmtBody.innerHTML, who: nodes.stmtWho.textContent };
}
const words = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

{
  const full = render({ name: 'Nakato Grace', from: FROM, to: TO, owed: 1240000,
    ...buildStatement(LOG, FROM, TO, 1240000) });
  const seen = words(full.body);
  t.check(full.who === 'Nakato Grace · 1 June to 14 September 2026',
    `the head names who and over what period (${full.who})`);
  t.check(/Balance brought forward 318,000/.test(seen), 'the opening is labelled and shown');
  t.check(/Date and item Charge Balance/.test(seen), 'the columns are headed');
  t.check(/21 Aug · Charge INV-2291 880,000 1,198,000/.test(seen),
    `a charge reads date, kind, reference, money, balance (${(seen.match(/21 Aug[^·]*·[^0-9]*[\d,]+ [\d,]+/) || [])[0]})`);
  /* A payment is a negative in the one money column, the way a ledger
     reads. Two columns would put an empty cell on every line and make the
     eye do the subtraction. */
  t.check(/28 Aug · Payment −868,000 330,000/.test(seen),
    'a payment is a minus in the same column, not a second one');
  t.check(/Balance now due 1,240,000/.test(seen), 'and it closes on what is due');
  t.check(/var\(--owe\)/.test(full.body), 'in oxide, because it is money owed');
  t.check(/dispute/.test(seen), 'with the invitation to argue with it before it becomes one');

  /* No accent on this screen. A statement is read, not acted on -- and a
     verdigris anything here would be the one action on a screen that has
     none. */
  t.check(!/var\(--go\)|#14594A/.test(full.body),
    'nothing on the statement is verdigris');

  // The balance column is as wide as the charge column it accumulates.
  // Narrower, it clips the larger of the two figures.
  const widths = (full.body.match(/width:(\d+)px;flex-shrink:0;text-align:right/g) || []);
  t.check(widths.length >= 2 && new Set(widths).size === 1,
    `the charge and balance columns are the same width (${[...new Set(widths)].join(', ')})`);
}

{
  const off = render({ name: 'X', from: FROM, to: TO, owed: 1500000, ...buildStatement(LOG, FROM, TO, 1500000) });
  const seen = words(off.body);
  t.check(/These entries come to 1,240,000/.test(seen) && /carrying is 1,500,000/.test(seen),
    `a disagreement is admitted, with both figures (${(seen.match(/These entries[^.]*\./) || [])[0]})`);
  t.check(/tell us what your own book says/.test(seen), 'and asks rather than asserts');
  t.check(/Balance now due 1,500,000/.test(seen),
    'the headline stays the figure the shop will actually chase for');

  const ok = words(render({ name: 'X', from: FROM, to: TO, owed: 1240000, ...buildStatement(LOG, FROM, TO, 1240000) }).body);
  t.check(!/These entries come to/.test(ok), 'and nothing is said when they agree');
}

{
  const none = words(render({ name: 'New', from: FROM, to: TO, owed: 0, ...buildStatement([], FROM, TO, 0) }).body);
  t.check(/Nothing on your account/.test(none), 'an account with no history says so');
  t.check(!/Balance brought forward|Balance now due/.test(none),
    'rather than drawing an empty ledger with a row of noughts');

  const quiet = words(render({ name: 'Old', from: FROM, to: TO, owed: 318000, ...buildStatement([LOG[0]], FROM, TO, 318000) }).body);
  t.check(/Nothing charged or paid in this period/.test(quiet),
    'a quiet period inside a live account says THAT instead');
  t.check(/Balance brought forward 318,000/.test(quiet) && /Balance now due 318,000/.test(quiet),
    'and still shows where the account stands');

  const paid = words(render({ name: 'Paid', from: FROM, to: TO, owed: 0,
    ...buildStatement([{ id: 1, date: '2026-07-01', type: 'charge', amount: 100, note: '' },
      { id: 2, date: '2026-07-02', type: 'payment', amount: 100, note: '' }], FROM, TO, 0) }).body);
  t.check(/Balance now due Nothing/.test(paid),
    'nothing due is a word, not a nought -- a balance screen reading 0 looks like a broken app');
}

/* ---------- 6. dates -------------------------------------------------- */
{
  const P = compileScope(N.map(n => extractFunction(page, n, 'client.html')),
    { document: { getElementById: () => ({}) }, MONTHS }, N);
  t.check(P.periodLabel('2026-06-01', '2026-09-14') === '1 June to 14 September 2026',
    `one year is named once, at the end (${P.periodLabel('2026-06-01', '2026-09-14')})`);
  t.check(P.periodLabel('2025-11-01', '2026-09-14') === '1 November 2025 to 14 September 2026',
    `two years are both named (${P.periodLabel('2025-11-01', '2026-09-14')})`);
  t.check(P.periodLabel('', '') === '', 'and a missing period says nothing rather than NaN');
  t.check(P.shortDate('2026-08-21') === '21 Aug', `a row date is short (${P.shortDate('2026-08-21')})`);
  t.check(P.shortDate('') === '', 'and an absent one is blank');
}

/* ---------- 7. the way in --------------------------------------------- */
{
  t.check(/id="toStatement"/.test(page), 'the account screen offers the statement');
  t.check(/statementSince/.test(page) && /Every charge and payment we have recorded/.test(page),
    'saying what is in it');
  const block = noComments.slice(noComments.indexOf('action === "statement"'));
  t.check(/sessionAccount\(shopId, String\(body\.token \?\? ""\)\)/.test(block.slice(0, 400)),
    'and it needs a session like everything else that carries money');
  t.check(block.indexOf('sessionAccount') < block.indexOf('customer_debt_log'),
    'proved before the ledger is read');
  t.check(/\.eq\("customer_id", customerId\)/.test(block),
    'and the ledger read is scoped to this customer, never to a name');
}

process.exit(t.done() ? 1 : 0);
