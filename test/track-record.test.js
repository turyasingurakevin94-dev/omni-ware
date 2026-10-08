#!/usr/bin/env node
'use strict';
/*
 * WHAT THIS MANAGER HAS LEARNED.
 *
 * It read three to five meetings and thirty-five days of its own moves.
 * Everything older sat in the journal and nothing looked at it. So it
 * could not say the one kind of thing a manager who has run a shop for
 * a year says:
 *
 *   "Every time you have chased Mulongo he has paid inside the week —
 *    five times out of seven. Chase him."
 *   "You have advised chasing David nine times and the books have never
 *    once shown money after it. Chasing is not the lever here."
 *
 * Both are derivable. Neither was derived. That is not a manager that
 * forgets a detail; it is a manager that cannot learn.
 *
 * Four laws:
 *
 *   THE WINDOW IS THE WHOLE OF IT. Ask "what happened since this chase"
 *   seven times about one customer and each answer counts every payment
 *   since its own date — the seven sum to the same money counted seven
 *   times. week_review_data escapes that by taking only the EARLIEST
 *   move per customer, which is honest and can never say WHICH chases
 *   worked. Closing each occasion at the next move about the same thing
 *   asks the question that can.
 *
 *   ONLY WHAT WAS NAMED. A relationship claim built on matching titles
 *   would put two customers' histories in one row. No id, no row — and
 *   how many were left out is counted rather than hidden.
 *
 *   THREE TIMES, NOT TWO. Twice is a coincidence.
 *
 *   AND A STATE IS NOT AN EVENT. An order is invoiced or it is not, and
 *   it stays invoiced. Scoring that per occasion would read as the same
 *   thing happening every time it was advised.
 *
 * Run: node test/track-record.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('what the manager has learned');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-31';

/* Mulongo pays after four of the five chases. David never pays after
   any of his three. The payments are placed so that a reading which
   counts "everything since" would give wildly different, much larger
   figures — which is the whole point of the fixture. */
const data = {
  customers: [
    { id: 7, name: 'Mulongo', debt: 400000, debtLog: [
      { type: 'payment', amount: 100000, date: '2026-03-03', cashTxnId: 'T1' },
      { type: 'payment', amount: 200000, date: '2026-04-02', cashTxnId: 'T2' },
      { type: 'payment', amount: 300000, date: '2026-05-02', cashTxnId: 'T3' },
      /* Nothing after the chase on 1 June. */
      { type: 'payment', amount: 400000, date: '2026-07-02', cashTxnId: 'T4' },
    ] },
    { id: 9, name: 'David', debt: 900000, debtLog: [
      /* Paid BEFORE the first chase, and never after one. */
      { type: 'payment', amount: 500000, date: '2026-02-01', cashTxnId: 'T9' },
    ] },
  ],
  stockLog: [], savedQuotes: [], purchaseInvoices: [], presetReorderRules: {},
  suppliers: [],
};

const MOVES = [
  { date: '2026-03-01', status: 'done', body: { title: 'Chase Mulongo', mkind: 'chase', subject: { customerId: 7 } } },
  { date: '2026-04-01', status: 'done', body: { title: 'Chase Mulongo', mkind: 'chase', subject: { customerId: 7 } } },
  { date: '2026-05-01', status: 'skipped', body: { title: 'Chase Mulongo', mkind: 'chase', subject: { customerId: 7 } } },
  { date: '2026-06-01', status: 'open', body: { title: 'Chase Mulongo', mkind: 'chase', subject: { customerId: 7 } } },
  { date: '2026-07-01', status: 'done', body: { title: 'Chase Mulongo again', mkind: 'chase', subject: { customerId: 7 } } },
  { date: '2026-03-10', status: 'open', body: { title: 'Chase David', mkind: 'chase', subject: { customerId: 9 } } },
  { date: '2026-04-10', status: 'open', body: { title: 'Chase David', mkind: 'chase', subject: { customerId: 9 } } },
  { date: '2026-05-10', status: 'open', body: { title: 'Chase David', mkind: 'chase', subject: { customerId: 9 } } },
  /* Twice only: a coincidence, not a pattern. */
  { date: '2026-06-11', status: 'open', body: { title: 'Restock cement', mkind: 'buy', subject: { key: 'P1' } } },
  { date: '2026-07-11', status: 'open', body: { title: 'Restock cement', mkind: 'buy', subject: { key: 'P1' } } },
  /* Named nobody, three times: nothing can be learned from it. */
  { date: '2026-05-20', status: 'open', body: { title: 'Tidy the shelves', mkind: 'other' } },
  { date: '2026-06-20', status: 'open', body: { title: 'Tidy the shelves', mkind: 'other' } },
  { date: '2026-07-20', status: 'open', body: { title: 'Tidy the shelves', mkind: 'other' } },
];

const NAMES = ['deriveMoveOutcome', 'managerTrackRecord', 'mgrLiveMoveRows', 'trackRecordName',
  'trackRecordLine', 'trackRecordDeadLevers',
  'collectionInvoiceTxn', 'collectionLedgerRow', 'debtLogIsInvoiceOwned', 'cashIsMoneyIn'];
const build = (rows, over) => compileScope(
  NAMES.map((n) => extractFunction(src, n, 'index.html'))
    .concat([extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
      extractDeclaration(src, 'CHASE_WINDOW', 'index.html')]),
  Object.assign({
    data, managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
    fmtShortDate: (d) => String(d),
    supplierName: (id) => String(id), buyKeyLabel: (k) => 'Cement',
    supplierLeadTimes: () => [], mgrLineSupplier: () => null,
    console,
    sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
      q.limit = () => Promise.resolve({ data: rows, error: null }); return q; } },
    Date, JSON, Math, Number, String, Array, Object, Boolean, Promise, Map, Set,
  }, over || {}), NAMES);

/* ---------- 1. one occasion, one window ------------------------------ */
{
  const s = build([]);
  const move = { date: '2026-03-01', body: { mkind: 'chase', subject: { customerId: 7 } } };
  eq(s.deriveMoveOutcome(move).money, 1000000,
    'without a window, a chase counts EVERY payment since — right for one move, and the trap for seven');
  eq(s.deriveMoveOutcome(move, '2026-04-01').money, 100000,
    'CLOSED AT THE NEXT CHASE, it counts only what came before that one — which is the only way to say which chases worked');
  eq(s.deriveMoveOutcome(move, '2026-04-01').happened, true, 'and says so as a fact, not a sentence');
  eq(s.deriveMoveOutcome({ date: '2026-06-01', body: { mkind: 'chase', subject: { customerId: 7 } } }, '2026-07-01').happened, false,
    'a window with nothing in it is a no');
  eq(s.deriveMoveOutcome(move, 'not a date').money, 1000000,
    'and a window that is not a date is no window at all — every existing caller keeps the reading it had');
}

(async () => {
  /* ---------- 2. the record itself ----------------------------------- */
  {
    const s = build(MOVES);
    const tr = await s.managerTrackRecord(TODAY);
    eq(tr.rows.length, 2,
      'TWICE IS A COINCIDENCE — the two-occasion restock is not a pattern and does not appear');
    eq(tr.minTimes, 3, 'and the threshold travels with the rows, so a claim cannot be quoted without it');
    eq(tr.unnamed, 3,
      'MOVES THAT NAMED NOBODY ARE COUNTED, NOT HIDDEN — a relationship claim built on matching titles would put two customers in one row');
    eq(tr.since, '2026-03-01', 'and how far back the reading reaches is said');

    const m = tr.rows.find((x) => String(x.id) === '7');
    eq(m.times, 5, 'Mulongo was chased five times');
    eq(m.scored, 5, 'every one of them weighed');
    eq(m.worked, 4,
      'AND FOUR OF THEM WORKED — five separate occasions, each closed at the next, never five readings of one figure');
    eq(m.money, 1000000,
      'the money is the sum of what followed each occasion, counted ONCE: a reading that summed "everything since" would give 3,300,000 for the same four payments');
    eq(m.done, 3, 'with what the owner actually did');
    eq(m.skipped, 1, 'and what they turned down');
    eq(m.firstOn, '2026-03-01', 'from the first time it was advised');
    eq(m.lastOn, '2026-07-01', 'to the last');

    const d = tr.rows.find((x) => String(x.id) === '9');
    eq(d.times, 3, 'David was chased three times');
    eq(d.worked, 0, 'and nothing followed any of them');
    eq(d.money, 0, 'the payment BEFORE the first chase belongs to nobody’s window');
  }

  /* ---------- 3. what it reads as ------------------------------------ */
  {
    const s = build(MOVES);
    const tr = await s.managerTrackRecord(TODAY);
    const m = tr.rows.find((x) => String(x.id) === '7');
    const d = tr.rows.find((x) => String(x.id) === '9');
    eq(s.trackRecordName(m), 'Mulongo', 'named as the shop names them');
    t.check(/Advised chasing 5 times since 2026-03-01/.test(s.trackRecordLine(m)), 'the record reads as a sentence');
    t.check(/an event followed 4 of 5 recommendations/.test(s.trackRecordLine(m)), 'with what it earned the shop');
    t.check(/1,000,000 in all/.test(s.trackRecordLine(m)), 'and the money');
    t.check(/the books show nothing after any of them/.test(s.trackRecordLine(d)),
      'and a lever that has never worked says exactly that');
  }

  /* ---------- 4. a lever that has never worked ----------------------- */
  {
    const s = build(MOVES);
    const tr = await s.managerTrackRecord(TODAY);
    const dead = s.trackRecordDeadLevers(tr);
    eq(dead.length, 0, 'open advice is not a failed executed tactic');
    eq(tr.rows.find(x=> String(x.id) === '7').completedScored, 0, 'legacy done records have no execution date');
    const dated = MOVES.map(m=> String((m.body.subject||{}).customerId) === '9'
      ? {...m, status:'done', body:{...m.body, doneOn:m.date}} : m);
    const withDates = build(dated);
    const datedTrack = await withDates.managerTrackRecord(TODAY);
    eq(withDates.trackRecordDeadLevers(datedTrack).length, 1, 'three dated completions with no events warrant a review');
    const oneDone = build(dated.map((m,i)=> i===5 || i===6 ? {...m,status:'open'} : m));
    eq(oneDone.trackRecordDeadLevers(await oneDone.managerTrackRecord(TODAY)).length, 0, 'one completed occasion is too little evidence');
    t.check(!dead.some((x) => String(x.id) === '7'),
      'NOT Mulongo — four of five is not a dead lever, and a reading that lumped them together would be worse than none');

    /* THE INVARIANT A REMOVED GUARD RESTED ON.

       trackRecordDeadLevers once also asked scored >= minTimes, and no
       mutation could tell it from the row filter.
       WAS: every windowed occasion was scored, so scored === times.
       NOW: an occasion whose answer window has not run is not judged
       (still waiting, or cut short by the same advice coming round), so
       scored + waiting + cutShort === times. The dead-lever rule did
       not need the old guard back: it asks completedScored >=
       TRACK_MIN_TIMES, and completedScored counts only completions
       judged after their WHOLE window -- three of those is its own
       threshold, whatever `scored` says. */
    tr.rows.filter((x) => x.windowed).forEach((x) => {
      eq(x.scored + x.waiting + x.cutShort, x.times,
        `a windowed kind weighs every occasion it has, or names it as waiting or cut short (${x.kind})`);
    });
    t.check(!/scored >= \(track\.minTimes/.test(src),
      'and the guard that rested on it is gone rather than sitting there unfalsifiable');
  }

  /* ---------- 5. nothing weighed is not nothing earned --------------- */
  {
    /* Three chases at a customer who is no longer on file. The books
       can weigh none of them, and reading that as failure is exactly
       the lie the accounting repair was built to stop. */
    const s = build([
      { date: '2026-03-01', status: 'open', body: { title: 'Chase Gone', mkind: 'chase', subject: { customerId: 99 } } },
      { date: '2026-04-01', status: 'open', body: { title: 'Chase Gone', mkind: 'chase', subject: { customerId: 99 } } },
      { date: '2026-05-01', status: 'open', body: { title: 'Chase Gone', mkind: 'chase', subject: { customerId: 99 } } },
    ]);
    const tr = await s.managerTrackRecord(TODAY);
    const g = tr.rows[0];
    eq(g.times, 3, 'the three occasions are counted');
    eq(g.worked, 0, 'and none of them worked');
    /* deriveMoveOutcome answers a missing customer with 0 paid, which
       IS an answer — so this is scored, and reads as a dead lever. It
       is a dead lever: chasing a customer who is off the books earns
       nothing, and the sentence says so in the owner's words. */
    t.check(/nothing in the books can weigh/.test(s.trackRecordLine(g)),
      'and the sentence says what happened, not what it means');
  }

  /* ---------- 6. a state is not an event ----------------------------- */
  {
    const s = build([
      { date: '2026-03-01', status: 'open', body: { title: 'Invoice order 4', mkind: 'invoice', subject: { orderId: 4 } } },
      { date: '2026-04-01', status: 'open', body: { title: 'Invoice order 4', mkind: 'invoice', subject: { orderId: 4 } } },
      { date: '2026-05-01', status: 'open', body: { title: 'Invoice order 4', mkind: 'invoice', subject: { orderId: 4 } } },
    ], { data: Object.assign({}, data, { savedQuotes: [{ id: 4, invoiced: true }] }) });
    const tr = await s.managerTrackRecord(TODAY);
    const r = tr.rows[0];
    eq(r.windowed, false,
      'AN ORDER IS INVOICED OR IT IS NOT — scoring a state per occasion would read as the same thing happening every time it was advised');
    eq(r.scored, 0, 'so no occasion is scored');
    eq(r.standsNow, 'invoiced', 'and where it stands NOW is said once');
    t.check(/Told to invoice 3 times/.test(s.trackRecordLine(r)) && /invoiced/.test(s.trackRecordLine(r)),
      'in one sentence, without a score it has not earned');
    eq(s.trackRecordDeadLevers(tr).length, 0,
      'and a state kind can never be called a dead lever — nothing weighed it');
  }

  /* ---------- 6b. a miss needs a whole answer window ---------------- */
  {
    /* The Brief's hit rate's rule (mgrBriefHitRate), so the Brief, the
       Record and this record agree: a chase is given a week; a restock
       its supplier's lead time and two days. Today is 31 August.

       Okello (11) owes and never pays. Chased and marked done on 1, 4
       and 28 August:
         1 Aug  closed by the 4th: 3 days < 7, nothing followed -> cut short
         4 Aug  closed by the 28th: 24 days -> a miss, scored
         28 Aug runs to today: 3 days < 7 -> still waiting
       Completions judged from the day after: 2 Aug (2 days to the 4th,
       not judged), 5 Aug (23 days, judged, nothing), 29 Aug (2 days, not
       judged) -> 1 completed and judged. Before the rule this row read
       3 scored, 3 completed, nothing after any: a "dead lever" built on
       two chases that never had their week. */
    const book = Object.assign({}, data, { customers: data.customers.concat([
      { id: 11, name: 'Okello', debt: 500000, debtLog: [] },
      { id: 12, name: 'Nambi', debt: 500000, debtLog: [
        { type: 'payment', amount: 150000, date: '2026-08-02', cashTxnId: 'T12' } ] },
    ]) });
    const chase = (id, d) => ({ date: d, status: 'done', body: { title: 'Chase ' + id, mkind: 'chase', subject: { customerId: id }, doneOn: d } });
    const s = build([chase(11, '2026-08-01'), chase(11, '2026-08-04'), chase(11, '2026-08-28'),
      chase(12, '2026-08-01'), chase(12, '2026-08-04'), chase(12, '2026-08-20')], { data: book });
    const tr = await s.managerTrackRecord(TODAY);
    const o = tr.rows.find((x) => String(x.id) === '11');
    eq(JSON.stringify([o.times, o.scored, o.worked, o.cutShort, o.waiting, o.completedScored, o.completedObserved]),
      JSON.stringify([3, 1, 0, 1, 1, 1, 0]), 'Okello: one miss judged, one cut short, one still waiting; one completion judged');
    eq(s.trackRecordDeadLevers(tr).some((x) => String(x.id) === '11'), false,
      'and not a dead lever: one judged completion is not three');
    /* Nambi (12) paid 150,000 on 2 August, a day after the 1 August
       chase that the 4th cut short: an event inside a short window still
       counts. 4 Aug -> 20 Aug (16 days, nothing): a miss. 20 Aug -> today
       (11 days, nothing): a miss. */
    const n = tr.rows.find((x) => String(x.id) === '12');
    eq(JSON.stringify([n.scored, n.worked, n.cutShort, n.waiting, n.money]), JSON.stringify([3, 1, 0, 0, 150000]),
      'Nambi: a payment inside a short window counts as followed; the two full weeks are misses');

    /* A restock of P2 from S1, whose measured lead is 10 days: each is
       given 12. Advised 1, 12 and 20 August, nothing restocked:
         1 Aug -> 12th: 11 < 12, cut short; 12th -> 20th: 8, cut short;
         20th -> today: 11, waiting. Nothing judged.
       With no measured lead the week stands, and all three are misses. */
    const buy = (d) => ({ date: d, status: 'open', body: { title: 'Restock P2', mkind: 'buy', subject: { key: 'P2' } } });
    const moves = [buy('2026-08-01'), buy('2026-08-12'), buy('2026-08-20')];
    const lead = { supplierLeadTimes: () => [{ supplierId: 'S1', typical: true, days: 10 }],
      mgrLineSupplier: (k) => (k === 'P2' ? { supplierId: 'S1' } : null) };
    const led = (await build(moves, lead).managerTrackRecord(TODAY)).rows[0];
    eq(JSON.stringify([led.scored, led.cutShort, led.waiting]), JSON.stringify([0, 2, 1]), 'a 10-day lead: each restock is given 12 days');
    const unled = (await build(moves, { ...lead, supplierLeadTimes: () => [{ supplierId: 'S1', typical: false, days: 10 }] })
      .managerTrackRecord(TODAY)).rows[0];
    eq(JSON.stringify([unled.scored, unled.cutShort, unled.waiting]), JSON.stringify([3, 0, 0]), 'a lead from one delivery is not measured: the week stands');
    /* NOT JUDGED YET IS NOT UNWEIGHABLE. Every occasion of the P2 row is
       cut short or waiting: the books CAN weigh them, their windows have
       not run. The sentence says that, never "nothing in the books can
       weigh any of them". */
    eq(s.trackRecordLine(led), 'Told to restock 3 times since 2026-08-01 · 0 marked done — none has had its whole answer window yet: '
      + '1 still in its answer window, 2 cut short by the next advice',
      'a row with nothing judged yet says why, and never that the books cannot weigh it');
    /* Okello: 1 judged miss, 1 cut short, 1 waiting -- the gap between
       advised (3) and weighed (1) is named in the sentence. */
    eq(s.trackRecordLine(o), 'Advised chasing 3 times since 2026-08-01 · 3 marked done — and the books show nothing after the one judged; '
      + 'not judged yet: 1 still in its answer window, 1 cut short by the next advice',
      'a partly judged row names what was not judged yet');
    eq(s.trackRecordLine(n).includes('not judged yet'), false, 'and a row judged in full adds nothing');
    /* A row with some occasions the books cannot answer at all keeps them apart. */
    t.check(/none judged yet: 1 still in its answer window; the books cannot weigh the other 2$/.test(
      s.trackRecordLine({ kind: 'chase', times: 3, firstOn: '2026-08-01', done: 0, windowed: true, scored: 0, worked: 0, waiting: 1, cutShort: 0 })),
      'waiting and unweighable are two different things, and both are named');
    const broke = await build(moves, { ...lead, supplierLeadTimes: () => { throw new Error('no deliveries read'); } }).managerTrackRecord(TODAY);
    t.check(/supplier lead times could not be read — no deliveries read; a restock was given a week/.test(broke.windowError || ''),
      'a lead time that cannot be read is named, and the week is used (got ' + broke.windowError + ')');
    t.check(!('windowError' in tr), 'and a record that needed no lead time carries no such error');
  }

  /* ---------- 7. without the table, an empty record ------------------ */
  {
    const s = build([], { managerNotesTable: false,
      sb: { from(){ throw new Error('reached for a table that is not there'); } } });
    const tr = await s.managerTrackRecord(TODAY);
    eq(tr.rows.length, 0, 'no memory table, no record — and no crash');
    const err = build([], { sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q;
      q.order = () => q; q.limit = () => Promise.resolve({ data: null, error: { message: 'no' } }); return q; } } });
    const refused = await err.managerTrackRecord(TODAY);
    eq(refused.rows.length, 0, 'and a refused read is an empty record, never a crashed screen');
    /* AND IT SAYS WHICH. An empty record and a record that could not be
       read look identical, and the screen drew the first from the
       second: "nothing advised often enough to judge yet", about a shop
       whose journal was never reached. */
    eq(refused.error, 'no', 'and carries the failure home, so the screen can say so instead of counting zero');
  }

  /* ---------- 8. and it reaches the Manager, and the screen ---------- */
  {
    /* THE SHELF MATTERS. It sat inside do_not_repeat for one build,
       which means "never mention this" — the exact opposite of what a
       record is for. */
    const hist = api.slice(api.indexOf("name: 'manager_history'"), api.indexOf("name: 'week_review_data'"));
    t.check(/separates advice, recorded completion and events observed afterward/.test(hist),
      'the tool separates execution from observation');
    t.check(/not evidence of execution or causation/.test(hist), 'the legacy field cannot imply causal credit');
    t.check(/Undated legacy done records cannot establish execution timing/.test(hist),
      'legacy missing dates remain unknown');

    const tool = src.slice(src.indexOf("manager_history: { confirm: false"));
    /* A window over the tool's source, not a claim about its size: it
       grew past 20,000 when the brief learned to name advice already
       done, and the return it looks for did not move. */
    /* WAS 24,000: the Manager's readings handed to the meeting (offers,
       normals, decisions, the pulse, the playbook's weekly reads) moved
       the return further in. Where it sits is not the point; that the
       record reaches the meeting is. */
    t.check(tool.slice(0, 40000).includes('{ track_record: trackOut }'),
      'the record is returned');
    const doNot = tool.slice(tool.indexOf('const doNot = {'), tool.indexOf('const passedOn') + 200);
    t.check(doNot.length > 100 && !doNot.includes('track_record'),
      'and NOT inside do_not_repeat, which means "never mention this" — the exact opposite of what a record is for');

    t.check(/id="managerTrackWrap"/.test(src), 'the screen has a place for it');
    t.check(src.includes('managerTrackRecord(todayISO()).then'),
      'AND FILLS IT — a memory the owner cannot see is one they can only be told about');
    /* THE HEADING CHANGED BECAUSE THE SECTION ABSORBED TWO OTHERS.
       "What has worked, and what has not" sat beside "Advice you have
       passed on" and "Advice that is not landing" -- three headings,
       three row formats, and the source comment beside them already
       said they were the same question asked three ways. They are one
       table now, and its heading names what the rows ARE while the
       filter names which of the three questions you are asking. */
    t.check(/Advice and observed outcomes/.test(src), 'under a heading that says what the rows are');
    ['Event followed', 'No event recorded', 'Not landing', 'You passed on'].forEach(q=>
      t.check(new RegExp(`label: '${q}'`).test(src),
        `and a filter for "${q}" \u2014 the three old sections are three questions of one list`));
    t.check(/no event recorded/.test(src), 'and marks the levers that never have');
  }
})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
