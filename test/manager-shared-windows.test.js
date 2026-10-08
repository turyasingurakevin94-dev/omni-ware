#!/usr/bin/env node
'use strict';
/*
 * THE SHARED MODELS READ THE SAME DAYS AS THE SCREENS BESIDE THEM.
 *
 *  1. mgrHealthFacts' margin and lines sold below cost read the 30 whole
 *     days to yesterday -- MANAGER_METRICS.margin_pct's and the
 *     Simulator's window -- never today's unfinished day.
 *  2. A charge exactly 60 days old is in "60 days or more", as the
 *     Debtors aging (AGING_BANDS) bands it; the Finance tile says so.
 *  3. Dead stock's share of the shelf is a share of the Inventory
 *     register's value at cost (mgrDaysOfStock().value).
 *  4. managerTrackRecord judges a done move from the done day, that day
 *     counted, as the Brief's hit rate and the chase record do.
 *
 * Every expectation is worked out by hand in the comment above it.
 * Run: node test/manager-shared-windows.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager shared windows');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- 1 and 3. the health facts' windows and the shelf ---------- */
{
  /* Three invoices: 6 Sep (31 days back: outside), 7 Sep (inside, the
     first of the 30 whole days), and today 7 Oct (today is not over:
     outside).
       7 Sep: sales 2,000,000, profit 400,000 on one line (Cement).
       7 Oct: sales 1,000,000, profit -500,000 on one line (Tiles).
       6 Sep: sales 9,000,000, profit 9,000,000.
     The 30 days to yesterday (7 Sep .. 6 Oct): 400,000 / 2,000,000 = 20%,
     and nothing sold below cost (1 line sold). The old window (8 Sep ..
     today) read -50% and Tiles below cost.
     The shelf: the Inventory register (mgrDaysOfStock) values the shelf
     at 10,000,000, and values the two dead lines at 1,000,000 and
     500,000 (mgrDeadStockLines -- the same valuation). Share 1,500,000
     / 10,000,000 = 15%: not 50% (the ageing rows' own 3,000,000 shelf),
     and not 14% (dashInventoryHealth's 1,400,000, a second valuation
     of the same lines). */
  const invoices = [
    { date: '2026-09-06', sales: 9000000, profit: 9000000, name: 'Sand' },
    { date: '2026-09-07', sales: 2000000, profit: 400000, name: 'Cement' },
    { date: '2026-10-07', sales: 1000000, profit: -500000, name: 'Tiles' },
  ];
  const asked = [];
  const S = compileScope([fn('mgrHealthFactsBuild'), fn('anShiftDate')], {
    data: { customers: [], suppliers: [], loans: [] },
    todayISO: () => TODAY,
    anInvoicesInRange: (from, to) => { asked.push([from, to]); return invoices.filter((q) => q.date >= from && q.date <= to); },
    anOverallTotals: (qs) => ({ sales: qs.reduce((n, q) => n + q.sales, 0), profit: qs.reduce((n, q) => n + q.profit, 0) }),
    anRowsByItem: (qs) => qs.map((q) => ({ name: q.name, variant: '', sales: q.sales, profit: q.profit })),
    targetMarginPct: () => 12,
    dashInventoryHealth: () => ({ deadValue: 1400000, totalValue: 3000000 }),
    stockAgeRows: () => [{ dead: true }, { dead: true }, { dead: false }],
    mgrDeadStockLines: () => [{ key: 'P1', value: 1000000 }, { key: 'P2', value: 500000 }],
    deadStockQuietDays: () => 60,
    mgrDaysOfStock: () => ({ days: 120, value: 10000000, cogsPerDay: 83333 }),
    console: { warn() {} },
  }, ['mgrHealthFactsBuild']);
  const f = S.mgrHealthFactsBuild({ today: TODAY, walk: { tightest: null, opening: 0 } });
  eq(asked.slice(0, 2), [['2026-09-07', '2026-10-06'], ['2026-09-07', '2026-10-06']],
    'margin and below-cost read 7 Sep .. 6 Oct: the 30 whole days to yesterday');
  eq([f.margin.pct, f.margin.sales], [20, 2000000], 'margin 400,000 / 2,000,000 = 20%, today\'s unfinished day left out');
  eq([f.belowCost.lines, f.belowCost.count], [1, 0], 'one line sold in the window, none below cost');
  eq([f.deadStock.value, f.deadStock.total, f.deadStock.share, f.deadStock.lines], [1500000, 10000000, 0.15, 2],
    'dead stock 1,500,000 on the register\'s valuation, 15% of the shelf the register values at 10,000,000, 2 lines');

  /* The register unreadable: no share, never the ageing rows' own sum. */
  const S2 = compileScope([fn('mgrHealthFactsBuild'), fn('anShiftDate')], {
    data: { customers: [] }, todayISO: () => TODAY,
    dashInventoryHealth: () => ({ deadValue: 1400000, totalValue: 3000000 }), stockAgeRows: () => [{ dead: true }],
    mgrDeadStockLines: () => [{ key: 'P1', value: 1500000 }],
    deadStockQuietDays: () => 60, mgrDaysOfStock: () => { throw new Error('the shelf is away'); }, console: { warn() {} },
  }, ['mgrHealthFactsBuild']);
  const f2 = S2.mgrHealthFactsBuild({ today: TODAY, walk: { tightest: null, opening: 0 } });
  eq([f2.deadStock.total, f2.deadStock.share, f2.errors.includes('daysOfStock')], [null, null, true],
    'the register unreadable: the share is not known, and the failed read is named');
  const H = compileScope([fn('mgrHealthChecks'), fn('mgrShortUGX'), fn('fmtShortDate'), fn('mgrPossessive'), fn('anShiftDate'),
    fn('mgrDeadWindow'), fn('deadStockQuietDays'), decl('MGR_HEALTH_CHECKS'), decl('MGR_DEPTS')],
  { mgrHealthFacts: () => ({ errors: [], deadStock: f2.deadStock }), todayISO: () => TODAY, DASH_COST_RISE_PCT: 5, data: { presetDeadStockDays: 60 },
    console: { warn() {} } }, ['mgrHealthChecks']);
  const dc = H.mgrHealthChecks().checks.find((c) => c.id === 'dead_stock');
  eq([dc.pass, dc.line], [false, '1.5m of dead stock — no sale in 60 days — 1 line'], 'and the check still fails on the dead stock, without a share it cannot know');
}

/* ---------- 3b. dead stock on one valuation -------------------------- */
{
  /* The quiet window's two dead lines, as deadStockRows lists them, worst
     money first: floor tiles 5,390,000 and wood primer 910,000 by the
     age table. The Inventory register (inventoryLineFor) values the
     tiles at 5,410,000 -- the shop's own units at cost -- and cannot
     price the primer (value null). So the lines read 5,410,000 and
     910,000 (the primer keeps the age table's figure, never 0): 6,320,000
     in all, and that one figure is the health check's, the Brief's, the
     Simulator's and the Targets measure's. */
  const rows = [{ key: 'P1', line: 'Floor tiles', value: 5390000, qty: 100 }, { key: 'P2', line: 'Wood primer', value: 910000, qty: 10 }];
  const reg = { P1: { value: 5410000 }, P2: { value: null } };
  const D = compileScope([fn('mgrDeadStockLines'), fn('mgrDeadStockValue')], {
    todayISO: () => TODAY, mgrMemo: (name, f) => f(), deadStockRows: () => rows,
    buyKeyParts: (k) => ({ product: { id: k }, variantIdx: null }), inventoryLineFor: (p) => reg[p.id],
  }, ['mgrDeadStockLines', 'mgrDeadStockValue']);
  eq(D.mgrDeadStockLines(TODAY).map((r) => [r.key, r.value, r.ageValue, r.qty]), [['P1', 5410000, 5390000, 100], ['P2', 910000, 910000, 10]],
    'each dead line at the register\'s value; a line it cannot price keeps the age table\'s figure, never 0');
  eq(D.mgrDeadStockValue(TODAY), 6320000, 'dead stock 5,410,000 + 910,000 = 6,320,000');
  const brief = fn('mgrBriefRead'), sim = fn('mgrSimBooksBuild'), metrics = decl('MANAGER_METRICS'), plays = fn('mgrPlayPresets');
  t.check(/mgrDeadStockLines\(today\)\.map\(r=> \(\{ key: r\.key, line: r\.line, value: r\.value \}\)\)/.test(brief) && !/deadStockRows\(/.test(brief),
    'the Brief\'s Cash to free reads the same lines');
  t.check(/const rows = mgrDeadStockLines\(day\);/.test(sim) && !/deadStockRows\(/.test(sim), 'the Simulator\'s clearance reads the same lines');
  t.check(/dead_stock_value:[^]*?measure: \(\)=> typeof mgrDeadStockValue === 'function' \? mgrDeadStockValue\(\)/.test(metrics), 'the Targets measure reads the same figure');
  t.check(/mgrDeadStockLines\(today\)/.test(plays), 'and a play\'s "dead stock less" line comes off the same figure');
}

/* ---------- 2. 60 days or more, as the aging bands it ---------------- */
{
  /* 8 Aug is 60 days before 7 Oct: the aging's "60 to 90 days" (d >= 60).
     9 Aug is 59 days: not yet. So of 500,000 (8 Aug) + 300,000 (9 Aug),
     500,000 is 60 days or more, oldest 8 Aug. */
  const S = compileScope([fn('mgrChargesOver60'), fn('daysBetweenISO')], { todayISO: () => TODAY }, ['mgrChargesOver60']);
  eq(S.mgrChargesOver60([{ date: '2026-08-08', remaining: 500000 }, { date: '2026-08-09', remaining: 300000 }], TODAY),
    { amount: 500000, oldest: '2026-08-08' }, 'a charge exactly 60 days old is counted; 59 days is not');
  const band = compileScope([decl('AGING_BANDS'), 'function bandOf(d){ return AGING_BANDS.find(b=> b.test(d)).key; }'], {}, ['bandOf']);
  eq([band.bandOf(60), band.bandOf(59)], ['b90', 'b60'], 'the Debtors aging puts 60 days in "60 to 90" and 59 in "30 to 60" -- the same line');
  const checks = decl('MGR_HEALTH_CHECKS');
  t.check(/' owed for 60 days or more, by '/.test(checks) && /label: 'No customer debt 60 days or more'/.test(checks) && !/more than 60 days/.test(checks),
    'the Finance tile says "60 days or more"');
}

/* ---------- 4. the track record counts the done day ------------------ */
(async () => {
  /* Kato chased three times: 1 Sep (done 3 Sep), 10 Sep (done the same
     day), 20 Sep (open). He paid on 3 Sep and on 10 Sep -- each on the
     day the chase was done.
       1 Sep's: from 3 Sep, before 10 Sep: the 3 Sep payment -> followed.
         (From the day after, 4 Sep: nothing in [4 Sep, 10 Sep), and only
         6 days had -- not even judged.)
       10 Sep's: from 10 Sep, before 20 Sep: the 10 Sep payment -> followed.
         (From 11 Sep: nothing in 9 days -- a miss.)
     So 2 judged, 2 followed. The old reading: 1 judged, 0 followed. */
  const paid = ['2026-09-03', '2026-09-10'];
  const rows = [
    { date: '2026-09-20', status: 'open', meeting_id: 3, body: { title: 'Chase Kato', mkind: 'chase', subject: { customerId: 'C1' } } },
    { date: '2026-09-10', status: 'done', meeting_id: 2, body: { title: 'Chase Kato', mkind: 'chase', subject: { customerId: 'C1' }, doneOn: '2026-09-10' } },
    { date: '2026-09-01', status: 'done', meeting_id: 1, body: { title: 'Chase Kato', mkind: 'chase', subject: { customerId: 'C1' }, doneOn: '2026-09-03' } },
  ];
  const sb = { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
    q.limit = () => Promise.resolve({ data: rows, error: null }); return q; } };
  const S = compileScope([fn('managerTrackRecord'), fn('mgrLiveMoveRows'), decl('TRACK_MOVES_READ'), decl('TRACK_MIN_TIMES'),
    decl('TRACK_WINDOWED'), decl('CHASE_WINDOW')], {
    managerNotesTable: true, currentShopId: 1, sb, todayISO: () => TODAY,
    deriveMoveOutcome: (row, until) => ({ happened: paid.some((d) => d >= row.date && (!until || d < until)), money: 0, derived: '' }),
    supplierLeadTimes: () => [], mgrLineSupplier: () => null, console: { warn() {} },
  }, ['managerTrackRecord']);
  const tr = await S.managerTrackRecord(TODAY);
  const k = tr.rows[0];
  eq([k.times, k.done, k.completedScored, k.completedObserved], [3, 2, 2, 2],
    'Kato: chased 3 times, 2 done, both followed by a payment on the done day itself');
  t.check(!/86400000\)\.toISOString\(\)\.slice\(0,10\)/.test(fn('managerTrackRecord')), 'no day-after start left in the track record');
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
