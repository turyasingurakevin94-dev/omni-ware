#!/usr/bin/env node
'use strict';
/*
 * Does chasing work here, and on whom.
 *
 * The track record could only say "an event followed 3 of 4 chases",
 * and rightly said that proves nothing: a customer who pays every
 * Friday pays after a chase too. chaseResponse compares each customer's
 * weeks after a chase with the weeks nobody chased them, and only
 * gives a verdict once there are enough of both.
 *
 * Also pinned here: the chase history that makes it possible (kept after
 * the debt clears, undone only for today), and the chase outcome now
 * counting invoice payments and refusing the invoice sync's echo rows.
 *
 * Run: node test/chase-response.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('chase response');
const src = read('index.html');
const api = read('api/assistant.js');
const TODAY = '2026-09-24';

const day = (n) => new Date(Date.parse(TODAY) + n * 86400000).toISOString().slice(0, 10);

function build(data) {
  return compileScope([
    'chaseResponse', 'chaseDayAdd', 'chaseRate', 'chaseResponseLine', 'customerCollectionDays',
    'collectionInvoiceTxn', 'collectionLedgerRow', 'debtLogIsInvoiceOwned', 'cashIsMoneyIn',
  ].map((n) => extractFunction(src, n, 'index.html')).concat([
    'CHASE_WINDOW', 'CHASE_LOOKBACK', 'CHASE_QUIET', 'CHASE_MIN_CHASED', 'CHASE_MIN_QUIET',
    'CHASE_MERGE', 'CHASE_VERDICT_WORDS',
  ].map((n) => extractDeclaration(src, n, 'index.html'))),
  { data, todayISO: () => TODAY, Math, Date, Number, String, Map, Set, Array },
  ['chaseResponse', 'chaseResponseLine', 'chaseRate']);
}

/* A ledger payment the owner wrote, with its receipt. */
let txn = 0;
const pay = (d, amount) => ({ type: 'payment', date: d, amount, cashTxnId: 'T' + (++txn) });
const txns = () => Array.from({ length: txn }, (_, i) => ({ id: 'T' + (i + 1), type: 'receipt' }));

/* ---------- 1. a customer who pays when chased ------------------------- */
{
  // Owes all along (one old charge), chased five times, paid within the
  // week after each; paid in no week nobody chased them.
  const chaseDays = [-170, -140, -110, -80, -50];
  const log = chaseDays.map((n) => pay(day(n + 3), 10000));
  const chaseLog = chaseDays.map((n) => ({ c: 'C1', d: day(n) }));
  const data = { customers: [{ id: 'C1', name: 'Mulongo', debt: 500000,
      debtLog: [{ type: 'charge', date: day(-200), amount: 550000 }].concat(log) }],
    savedQuotes: [], presetChaseLog: chaseLog, cashTxns: [] };
  data.cashTxns = txns();
  const s = build(data);
  const r = s.chaseResponse(TODAY);
  const c = r.customers[0];
  t.check(c.chased.k === 5 && c.chased.n === 5, 'paid within the week after 5 of 5 chases (got ' + c.chased.k + '/' + c.chased.n + ')');
  t.check(c.quiet.n >= 6 && c.quiet.k === 0, 'and in none of the ' + c.quiet.n + ' weeks nobody chased them');
  t.check(c.verdict === 'pays_when_chased', 'so: pays when chased (got ' + c.verdict + ')');
  t.check(/^Pays when chased — paid within a week after 5 of 5 chases; 0 of \d+ weeks nobody chased$/.test(s.chaseResponseLine(c)),
    'said with its counts, not a bare percentage: ' + s.chaseResponseLine(c));
}

/* ---------- 2. a customer who pays anyway ------------------------------ */
{
  txn = 0;
  // Pays every week regardless; chased three times.
  const log = [{ type: 'charge', date: day(-200), amount: 5000000 }];
  for (let n = -180; n <= -1; n += 7) log.push(pay(day(n), 10000));
  const chaseLog = [-150, -100, -60].map((n) => ({ c: 'C2', d: day(n) }));
  const data = { customers: [{ id: 'C2', name: 'Kato', debt: 4000000, debtLog: log }],
    savedQuotes: [], presetChaseLog: chaseLog };
  data.cashTxns = txns();
  const c = build(data).chaseResponse(TODAY).customers[0];
  t.check(c.verdict === 'pays_without_chasing', 'a weekly payer chased three times: pays without being chased (got ' + c.verdict + ', ' + c.chased.k + '/' + c.chased.n + ' vs ' + c.quiet.k + '/' + c.quiet.n + ')');
}

/* ---------- 3. one who ignores chases, and one too early to read ------- */
{
  txn = 0;
  const data = { customers: [
      { id: 'C3', name: 'Ssekitoleko', debt: 900000, debtLog: [{ type: 'charge', date: day(-200), amount: 900000 }] },
      { id: 'C4', name: 'New one', debt: 100000, debtLog: [{ type: 'charge', date: day(-30), amount: 100000 }] },
    ],
    savedQuotes: [], cashTxns: [],
    presetChaseLog: [-120, -90, -60, -30].map((n) => ({ c: 'C3', d: day(n) })).concat([{ c: 'C4', d: day(-20) }]) };
  const r = build(data).chaseResponse(TODAY);
  const by = Object.fromEntries(r.customers.map((x) => [x.customerId, x]));
  t.check(by.C3.verdict === 'ignores_chases', 'four chases and nothing paid: chasing has not worked');
  t.check(by.C4.verdict === 'too_early', 'one chase is too early to say anything (got ' + by.C4.verdict + ')');
}

/* ---------- 4. the fair comparison ------------------------------------ */
{
  txn = 0;
  // Owes nothing until 60 days ago: the months before cannot count as
  // weeks they failed to pay. And chases a day apart are one occasion.
  const data = { customers: [{ id: 'C5', name: 'Late', debt: 200000,
      debtLog: [{ type: 'charge', date: day(-60), amount: 200000 }] }],
    savedQuotes: [], cashTxns: [],
    presetChaseLog: [{ c: 'C5', d: day(-40) }, { c: 'C5', d: day(-39) }] };
  const c = build(data).chaseResponse(TODAY).customers[0];
  t.check(c.quiet.n <= 9, 'a week with nothing owed is not a week they failed to pay (got ' + c.quiet.n + ' weeks)');
  t.check(c.chased.n === 1, 'and a reminder the day after a chase is the same chase (got ' + c.chased.n + ')');
}

/* ---------- 5. money is counted through the collection gates ---------- */
{
  txn = 0;
  const data = { customers: [{ id: 'C6', name: 'Invoice payer', debt: 300000,
      debtLog: [{ type: 'charge', date: day(-200), amount: 900000 },
        // the invoice sync's echo: not money
        { type: 'payment', date: day(-99), amount: 50000, cashTxnId: 'TX', quoteId: 9 }] }],
    savedQuotes: [{ id: 9, customerId: 'C6', payments: [{ date: day(-68), amount: 100000, cashTxnId: 'TQ' },
      { date: day(-38), amount: 100000, cashTxnId: 'TA' }] }],
    cashTxns: [{ id: 'TX', type: 'receipt' }, { id: 'TQ', type: 'receipt' }, { id: 'TA', type: 'receipt', category: 'Agent Payment' }],
    presetChaseLog: [-100, -70, -40].map((n) => ({ c: 'C6', d: day(n) })) };
  const c = build(data).chaseResponse(TODAY).customers[0];
  t.check(c.chased.k === 1 && c.chased.n === 3,
    'an invoice payment counts, the sync\'s echo row and an agent settling do not (got ' + c.chased.k + ' of ' + c.chased.n + ')');
}

/* ---------- 6. the shop's pooled verdict needs a clear gap ------------- */
{
  const s = build({ customers: [], savedQuotes: [], cashTxns: [] });
  const r = s.chaseRate(4, 5);
  t.check(r.low > 0.3 && r.high < 1.01 && r.low < 0.8, 'four of five carries a wide range, not a certainty (' + r.low.toFixed(2) + '–' + r.high.toFixed(2) + ')');
  const shop = s.chaseResponse(TODAY).shop;
  t.check(shop.verdict === 'too_early', 'with nothing on record the shop is too early to judge');
}

/* ---------- 7. the history the reading depends on ---------------------- */
{
  const data = { customers: [{ id: 'C1', debt: 0 }], presetDebtChases: {}, presetChaseLog: [] };
  const s = compileScope(['markDebtChased', 'unmarkDebtChased', 'pruneDebtChases', 'logDebtChase', 'unlogDebtChase']
    .map((n) => extractFunction(src, n, 'index.html'))
    .concat(['CHASE_LOG_DAYS', 'CHASE_LOG_MAX'].map((n) => extractDeclaration(src, n, 'index.html'))),
  { data, todayISO: () => TODAY, saveData: () => {}, Date, String, Number, Array, Object, Set },
  ['markDebtChased', 'unmarkDebtChased']);
  data.presetChaseLog.push({ c: 'C1', d: day(-500) });
  s.markDebtChased('C1');
  s.markDebtChased('C1');
  t.check(data.presetChaseLog.filter((r) => r.d === TODAY).length === 1, 'a chase is logged once a day, however many times it is marked');
  t.check(!data.presetChaseLog.some((r) => r.d === day(-500)), 'and history older than the log keeps is trimmed by age');
  t.check(!data.presetDebtChases.C1 && data.presetChaseLog.length === 1,
    'a customer who owes nothing loses the latest stamp but KEEPS the history — the case that shows a chase worked');
  data.presetChaseLog.push({ c: 'C1', d: day(-10) });
  s.unmarkDebtChased('C1');
  t.check(data.presetChaseLog.length === 1 && data.presetChaseLog[0].d === day(-10),
    'an undo takes back today\'s chase, never an older, real one');
  t.check(/debtChases:d\.presetDebtChases\|\|\{\}, chaseLog:d\.presetChaseLog\|\|\[\]/.test(src)
    && /presetChaseLog: Array\.isArray\(presets\.chaseLog\) \? presets\.chaseLog : \[\]/.test(src),
    'and it is saved with the shop\'s settings and read back');
}

/* ---------- 8. the outcome of a chase move counts invoice payments ------ */
{
  const data = { customers: [{ id: 7, debtLog: [{ type: 'payment', date: '2026-09-02', amount: 40000, cashTxnId: 'E', quoteId: 1 }] }],
    savedQuotes: [{ id: 1, customerId: 7, payments: [{ date: '2026-09-03', amount: 250000, cashTxnId: 'R' }] }],
    cashTxns: [{ id: 'R', type: 'receipt' }, { id: 'E', type: 'receipt' }] };
  const { deriveMoveOutcome } = compileScope(['deriveMoveOutcome', 'collectionInvoiceTxn', 'collectionLedgerRow', 'debtLogIsInvoiceOwned', 'cashIsMoneyIn']
    .map((n) => extractFunction(src, n, 'index.html')),
  { data, fmtUGX: (n) => n + ' UGX' }, ['deriveMoveOutcome']);
  const out = deriveMoveOutcome({ date: '2026-09-01', status: 'done', body: { mkind: 'chase', subject: { customerId: 7 } } });
  t.check(out.money === 250000 && out.happened === true,
    'a customer who paid the invoice itself paid — and the echo row is not money (got ' + out.money + ')');
}

/* ---------- 9. the Manager is handed it, and told how to use it -------- */
{
  const hist = src.slice(src.indexOf('  manager_history: { confirm: false'));
  t.check(/const chasing = await managerChaseEvidence\(todayISO\(\)\);/.test(hist), 'manager_history reads the chase evidence');
  t.check(/chase_response: \{/.test(hist) && /kind: 'chasing_has_not_worked'/.test(hist),
    'returns it as evidence, and raises the biggest debt chasing has not moved');
  t.check(/AND chase_response:/.test(api) && /never another reminder/.test(api) && /when the verdict is too_early say nothing about it/.test(api),
    'and the tool description tells the mind to choose WHOM to chase from it');
  const row = extractFunction(src, 'mgrQueueRowHTML', 'index.html');
  t.check(/mgrChaseRowFor\(b\.subject\.customerId\)/.test(row) && /chaseEv\.chased\.n/.test(row),
    'a chase card shows the same reading, once there is a chase to read it from');
}

process.exit(t.done() ? 1 : 0);
