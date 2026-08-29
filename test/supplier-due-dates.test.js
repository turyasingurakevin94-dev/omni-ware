#!/usr/bin/env node
'use strict';
/*
 * The supplier side: when you said you would pay.
 *
 * This shop owed 17,600,000 across 23 bills and not one of them carried
 * a day. So none of it reached cashAhead, and safeToSpend — the figure
 * the What-to-buy screen budgets from — was telling the owner they could
 * spend money they already owed. Cash out beat cash in by 5,125,645 in
 * the week that figure said the drawer was theirs.
 *
 * The app knew. The What's-coming screen printed it: "There is no such
 * record on the supplier side, so what you owe stays here. Until
 * somebody says a date, putting it on the line would mean inventing
 * one." This build gives the supplier side that record — the mirror of
 * a customer's payment promise, pointed the other way: not what a
 * debtor said, but what the OWNER said.
 *
 * The laws this file guards:
 *
 *   ONLY DATED MONEY GOES ON THE LINE   a bill nobody has named a day
 *                       for stays off it. Not because it is not owed —
 *                       it is owed for certain — but because nothing
 *                       here may invent a date, and the raised date is
 *                       not a promise to pay.
 *   THE OWNER'S OWN WORD  a day the owner named that has gone by counts
 *                       against today, exactly as a raised due does, and
 *                       is named as theirs rather than the supplier's
 *                       impatience.
 *   NEVER TWICE         what is dated is on the line AND in the total
 *                       owed. The undated pool must report only the
 *                       undated share, or the screen says the same money
 *                       twice.
 *   EVERY BILL IN ONE BUCKET  no day / dated ahead / day gone by, and
 *                       the three sum to every open bill.
 *   RUN IT, DON'T READ IT  these checks call the functions.
 *
 * Run: node test/supplier-due-dates.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('when you said you would pay');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-28';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* Four open bills, one per state the shop can be in, and a fifth that is
   settled so it never appears at all. The amounts are deliberately
   distinct: a total that is right by accident proves nothing.

   AND THE AGES CUT ACROSS THE DAYS. PINV-2 is the OLDEST bill on the
   books and has no day named; PINV-3 is one of the youngest and its
   named day has gone by. Any rule that mistakes age for a broken word
   gets both of them backwards. Written the other way round first, and
   a mutation that read `ageDays > 60` sailed straight through. */
const bills = () => [
  { id: 'PINV-1', supplierId: 'S1', date: '2026-08-01', dueDate: '2026-09-05',
    items: [{ qty: 1, price: 400000 }], amountPaid: 0, payments: [] },
  { id: 'PINV-2', supplierId: 'S2', date: '2026-01-10',
    items: [{ qty: 1, price: 900000 }], amountPaid: 0, payments: [] },
  { id: 'PINV-3', supplierId: 'S3', date: '2026-08-20', dueDate: '2026-08-25',
    items: [{ qty: 1, price: 250000 }], amountPaid: 0, payments: [] },
  /* The oldest bill on the books, and DATED — so the oldest-of-all and
     the oldest-of-the-undated are different numbers. Written with them
     equal first, and an assertion that swapped one for the other passed
     happily. */
  { id: 'PINV-4', supplierId: 'S1', date: '2025-06-01', dueDate: '2027-01-01',
    items: [{ qty: 1, price: 70000 }], amountPaid: 0, payments: [] },
  { id: 'PINV-5', supplierId: 'S2', date: '2026-08-02', dueDate: '2026-09-01',
    items: [{ qty: 1, price: 500000 }], amountPaid: 500000, payments: [] },
];

const env = (data) => ({
  data,
  todayISO: () => TODAY, anShiftDate: shift,
  daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
  daysBetweenISO: (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000),
  purchaseInvoiceTotal: (pi) => (pi.items || []).reduce((n, i) => n + i.qty * i.price, 0),
  purchaseInvoiceBalanceDue: (pi) => (pi.items || []).reduce((n, i) => n + i.qty * i.price, 0)
    - (Number(pi.amountPaid) || 0),
  agingBandFor: () => 'b30',
  supplierName: (id) => 'Supplier ' + id,
  saveData: () => {},
  CASH_AHEAD_DAYS: 30,
  cashOnHandByAccount: () => ({ total: 3000000, byAccount: [] }),
  collectableDebts: () => [],
  promiseLatest: () => null, promisesBroken: () => 0,
  periodOf: () => '2026-08', periodShift: () => '2026-08', periodEndDate: () => '2026-08-31',
  rentAgreementsFor: () => [], findDue: () => null, dueName: () => '', dueBalance: () => 0,
  loanSchedule: () => [],
  console, Date, JSON, Math, Number, String, Array, Object, Map, Set,
});

const NAMES = ['billDueDate', 'setBillDueDate', 'clearBillDueDate', 'credOpenInvoices',
  'credDueRows', 'cashCommitments', 'cashAhead'];
const build = (data) => compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html')), env(data), NAMES);

/* ---------- 1. a day is the owner's, or there is no day -------------- */
{
  const data = { purchaseInvoices: bills(), customers: [], dues: [], loans: [], staff: [] };
  const s = build(data);

  eq(s.billDueDate({ dueDate: '2026-09-05' }), '2026-09-05', 'a day typed as a day is a day');
  eq(s.billDueDate({}), null, 'a bill nobody has dated has no day');
  /* THE RAISED DATE IS NOT A PROMISE TO PAY. Falling back to it would
     have put every one of the 23 bills on the cash line at a date
     nobody ever agreed — inventing exactly what this build refuses to
     invent. */
  eq(s.billDueDate({ date: '2026-08-01' }), null,
    'and the day the bill was RAISED is not the day the shop said it would pay');
  eq(s.billDueDate({ dueDate: 'next Friday' }), null, 'nor is a phrase a day');
  eq(s.billDueDate({ dueDate: '2026-9-5' }), null, 'nor a half-written one');
}

/* ---------- 2. the three states, and they sum to the whole ----------- */
{
  const data = { purchaseInvoices: bills(), customers: [], dues: [], loans: [], staff: [] };
  const s = build(data);
  const q = s.credDueRows();

  eq(q.count, 4, 'the settled bill is not owed and does not appear');
  eq(q.total, 1620000, 'and the total is what is still open on the other four');
  eq(q.undated.length, 1, 'one bill has no day named');
  eq(q.ahead.length, 2, 'two carry a day still ahead');
  eq(q.missed.length, 1, 'one carries a day that has gone by');
  eq(q.undated.length + q.ahead.length + q.missed.length, q.count,
    'and every open bill is in exactly one of the three — a screen about money may not drop a row');
  eq(q.undated[0].invoice.id, 'PINV-2', 'the undated one is named');
  eq(q.missed[0].invoice.id, 'PINV-3', 'and so is the one whose day went by');
  eq(q.ahead[0].invoice.id, 'PINV-1', 'the dated ones come soonest first — the list answers "what is next"');

  /* MISSED IS ABOUT A DAY, NOT ABOUT AGE. PINV-2 has been on the books
     longer than PINV-3 and is not missed: nobody named a day for it, so
     there is no word to have broken. */
  const open = s.credOpenInvoices();
  t.check(open.find((b) => b.invoice.id === 'PINV-2').ageDays
    > open.find((b) => b.invoice.id === 'PINV-3').ageDays,
    'the undated bill is the OLDER of the two — so age and a broken word point opposite ways here');
  eq(open.find((b) => b.invoice.id === 'PINV-2').missedOwnWord, false,
    'the oldest bill on the books has broken no word — nobody named a day for it');
  eq(open.find((b) => b.invoice.id === 'PINV-3').missedOwnWord, true,
    'while the youngest, whose named day passed eight days ago, has');
}

/* ---------- 3. only dated money goes on the line --------------------- */
{
  const data = { purchaseInvoices: bills(), customers: [], dues: [], loans: [], staff: [] };
  const s = build(data);
  const line = s.cashCommitments(TODAY, 30);
  const billsOn = line.filter((c) => c.kind === 'bill');

  eq(billsOn.length, 2, 'two bills reach the line: the one due inside the window and the one past its day');
  t.check(!billsOn.some((c) => c.billId === 'PINV-2'),
    'the bill nobody dated is NOT on the line — putting it there would mean inventing a day');
  t.check(!billsOn.some((c) => c.billId === 'PINV-4'),
    'nor is one dated beyond the window, however certainly it is owed');

  const soon = billsOn.find((c) => c.billId === 'PINV-1');
  eq(soon.date, '2026-09-05', 'a day still ahead lands on that day');
  eq(soon.overdue, false, 'and is not overdue');
  eq(soon.amount, 400000, 'for what is still open on it');

  /* THE OWNER'S OWN WORD, GONE BY. Pinned to today exactly as a raised
     due is: they named the day, it has passed, the money is due now. */
  const late = billsOn.find((c) => c.billId === 'PINV-3');
  eq(late.date, TODAY, 'a day the owner named that has passed counts against today');
  eq(late.dueOn, '2026-08-25', 'while still saying which day that was');
  eq(late.overdue, true, 'and saying plainly that it has gone by');

  /* SAFE TO SPEND FINALLY KNOWS. 3,000,000 held, 650,000 of it already
     spoken for. Before this build the answer was the whole 3,000,000
     and the buying screen budgeted from it. */
  const a = s.cashAhead(TODAY, 30);
  eq(a.safeToSpend, 2350000, 'safe to spend is what is left after the bills the shop has dated');
  eq(a.committed, 650000, 'and the committed figure carries them');
}

/* ---------- 4. never the same money twice ---------------------------- */
{
  const data = { purchaseInvoices: bills(), customers: [], dues: [], loans: [], staff: [] };
  const s = build(data);
  const owed = s.cashAhead(TODAY, 30).owedByYou;

  eq(owed.total, 1620000, 'the whole of what is owed is still reported — a typed day changes no balance');
  eq(owed.dated, 3, 'three bills carry a day');
  eq(owed.datedTotal, 720000, 'worth this much');
  eq(owed.undated, 1, 'one does not');
  eq(owed.undatedTotal, 900000, 'worth this much');
  eq(owed.datedTotal + owed.undatedTotal, owed.total,
    'and the two shares sum to the total — the undated band on screen must draw the undated share ALONE, or the same money is said twice');
  eq(owed.missedOwnWord, 1, 'with the shop’s own broken word counted apart');

  /* AND THE AGE BESIDE THE FIGURE DESCRIBES THE SAME SET. oldestDays is
     the oldest of EVERY open bill; the undated row on screen shows only
     the undated share, so quoting the wrong one would put an age next
     to a total drawn from a different set of bills. Here they differ by
     construction: the oldest undated bill IS the oldest bill, but the
     figures must still be taken from their own pool. */
  eq(owed.oldestDays, 453, 'the oldest of every open bill — and it is a DATED one');
  eq(owed.undatedOldestDays, 230,
    'while the undated row on screen gets the oldest of the UNDATED ones, which is a different bill and a different number');

  /* The customer side is untouched: this build gave the supplier side a
     record, it did not go near what a debtor said. */
  eq(s.cashAhead(TODAY, 30).promised.length, 0, 'nothing here disturbs the promises band');
}

/* ---------- 5. naming a day, and taking it back ---------------------- */
{
  const data = { purchaseInvoices: bills(), customers: [], dues: [], loans: [], staff: [] };
  const s = build(data);

  eq(s.setBillDueDate('PINV-2', '2026-09-10').ok, true, 'the owner names a day');
  eq(s.cashAhead(TODAY, 30).safeToSpend, 1450000,
    'and safe to spend drops by exactly what they committed — which is the point of saying it');
  eq(s.credDueRows().undated.length, 0, 'nothing is left undated');

  eq(s.clearBillDueDate('PINV-2').ok, true, 'and they can take the day back');
  eq(s.cashAhead(TODAY, 30).safeToSpend, 2350000, 'safe to spend goes back up by it');
  eq(s.credDueRows().undated.length, 1, 'the bill is owed again with no day named');
  eq(s.credDueRows().total, 1620000, 'and is still owed either way — a day is a date, not a debt');

  /* A WRITE THAT REFUSES RATHER THAN GUESSES. */
  eq(s.setBillDueDate('PINV-2', '').ok, false, 'a day is required — that is the whole record');
  t.check(/A day is needed/.test(s.setBillDueDate('PINV-2', 'soon').why || ''),
    'and the refusal says why in the owner’s words');
  eq(s.setBillDueDate('PINV-99', '2026-09-10').ok, false, 'a bill that does not exist is refused');
  eq(s.clearBillDueDate('PINV-99').ok, false, 'and so is clearing one');
}

/* ---------- 6. the screen and the mind say the same thing ------------ */
{
  /* The undated band must draw undatedTotal, never total: drawing the
     whole of what is owed under a heading that says "no date on it",
     while the dated share sits on the line above, is the same money
     twice on one screen. */
  const ahead = extractFunction(src, 'renderAhead', 'index.html');
  t.check(/owed\.undatedTotal/.test(ahead) && !/f\(a\.owedByYou\.total\)/.test(ahead),
    'the undated band draws the undated share, not the whole of what is owed');
  t.check(/not counted twice/.test(ahead),
    'and says out loud that the dated bills on the line are not counted again');
  t.check(/I'll pay on…/.test(ahead) || /I&#39;ll pay on/.test(ahead) || /I'll pay on/.test(ahead),
    'and points at the door that dates them');
  t.check(!/There is no such record on the supplier side/.test(src),
    'the screen no longer says the supplier side has no such record — it has one now');

  /* The Manager reads it, with the id a settle move needs. */
  t.check(/who_you_owe: \(\(\)=>\{/.test(src), 'shop_pulse carries the supplier side');
  t.check(/supplierId: b\.supplierId/.test(src), 'and every row of it names its supplier by id');
  t.check(/who_you_owe/.test(api), 'the tool description says the supplier side travels with the reading');
  t.check(/put it in a settle move/.test(api),
    'and tells the mind what the supplierId is for — the fourth subject type, unusable until now');
  t.check(/NOT in safe_to_spend/.test(api),
    'and that the undated pile is owed for certain and outside what is safe to spend');
}

process.exit(t.done() ? 1 : 0);
