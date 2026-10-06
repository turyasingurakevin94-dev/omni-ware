#!/usr/bin/env node
'use strict';
/*
 * A function that borrows its caller's scope, and the morning it took
 * the whole shop down.
 *
 * The seven analysis panels used to be the bottom half of
 * renderDashboard. Splitting them into renderAnalysis() left three
 * references behind -- itemRows, goingQuiet and breadth -- destructured
 * from a dashboardContext that belonged to the OTHER function. Nothing
 * complained: node --check parses it, 263 test files passed it, and the
 * screen it was built for rendered fine, because nobody had opened it
 * yet on the path that mattered.
 *
 * The path that mattered was the first one every morning:
 *
 *     boot -> goToTab('dashboard') -> renderDashboard -> renderAnalysis
 *
 * The ReferenceError surfaced inside boot's own promise, BEFORE
 * `document.body.classList.remove('app-loading')`. That class hides the
 * app shell until boot says it is safe to show it -- so an error one
 * line earlier does not produce a broken screen, it produces NO screen.
 * The owner opened the shop to a white page.
 *
 * One undefined name. The whole app.
 *
 * So this file does the thing the rest of the suite does not: it RUNS
 * the screen, against a stubbed DOM and a context shaped like the real
 * one. A missing identifier is a ReferenceError at call time and cannot
 * hide behind a screen nobody opened.
 *
 * WHAT CHANGED, AND WHY THIS FILE GOT STRICTER.
 *
 * Analysis is no longer seven panels. It leads with what the books
 * FOUND, ranked by what fixing each is worth over a year, and each of
 * those seven panels now lives on as the EVIDENCE inside a finding. So
 * the assertions that read dash_quadrant_note, dash_topPerformers,
 * dash_goingQuiet, dash_demandBreadth and dash_leakage are gone: those
 * ids no longer exist, and a test asserting on them would be pinning a
 * screen the app does not have. What they MEANT -- that the panels are
 * really filled, so a stub that silently did nothing could not pass --
 * is kept, and now reads the one container they were merged into.
 *
 * The scope hazard this file exists for got BIGGER, not smaller: one
 * function became seven, and every one of them is a fresh chance to
 * reach for a name that is not there. So all seven are extracted and
 * compiled together, and the two call paths run the whole set.
 *
 * AND AGAIN, AS A WORKLIST. The owner read the ranked findings with a
 * chart inside every one as "graphs everywhere, no clear information",
 * and the screen was redrawn on the design canvas: a sentence and four
 * figures, the findings as a paged list beside the one that is open,
 * cash as a statement. Twelve functions draw it now instead of seven,
 * so the scope hazard grew again -- and every one of them is compiled
 * and run below, down both call paths, as before.
 *
 * Run: node test/analysis-render.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('analysis render');
const src = read('index.html');

/* ---------- the stubbed world ---------- */
const written = {};
const el = (id) => ({
  set textContent(v) { written[id] = String(v); },
  get textContent() { return written[id] || ''; },
  set innerHTML(v) { written[id] = String(v); },
  get innerHTML() { return written[id] || ''; },
  /* renderAnalysis wires the doors on the rows it just drew, and hides
     the position strip when no tile earned its place. A stub that threw
     on either would fail the run for the wrong reason. */
  querySelectorAll: () => [],
  style: {},
});
const nodes = {};
const document = { getElementById: (id) => (nodes[id] || (nodes[id] = el(id))) };
/* The screen opens a finding beside the list and inside the phone's card
   at once; the list, the open finding and the sentence each have a node. */
const drawn = () => written.dash_findings || '';

/* A context shaped like dashboardContext's, carrying the fields the
   findings read off it. The point is the WIRING, not the arithmetic --
   dashboard-alerts.test.js owns what these figures mean. */
const dctx = {
  from: '2026-08-01', to: '2026-08-30',
  invoices: [{}, {}],
  totals: { sales: 1740000, cost: 1532000, profit: 208000 },
  grossProfit: 208000,
  inv: { deadValue: 950000 },
  itemRows: [
    { key: 'a', name: 'Cement OPC', qty: 40, sales: 1440000, cost: 1280000, profit: 160000, margin: 11.1 },
    { key: 'b', name: 'Iron sheets G28', qty: 12, sales: 300000, cost: 252000, profit: 48000, margin: 16 },
  ],
  goingQuiet: [{ name: 'Mulongo', avgGapDays: 12, sinceLastDays: 41 }],
  breadth: [
    { name: 'Cement OPC', qty: 40, buyers: 3, topBuyerName: 'Joan JEZONA' },
    { name: 'Barbed wire', qty: 18, buyers: 1, topBuyerName: 'Nsambya Builders' },
  ],
  debtors: [
    { id: 1, name: 'Mulongo', debt: 3330000, ageDays: 96 },
    { id: 2, name: 'Dad', debt: 1436000, ageDays: 12 },
  ],
};

const data = {
  customers: [{ name: 'Mulongo', debt: 3330000 }, { name: 'Dad', debt: 1436000 }, { name: 'Paid up', debt: 0 }],
  prices: [{}, {}, {}],
  presetAnalysisMarks: {},
};

const marginRows = () => {
  const rows = [
    { key: 'b', line: 'Iron sheets G28', units30: 12, sold30: 300000, earned30: 48000,
      keptPct: 16, target: 22, cost: 21000, price: 25000, targetPrice: 26923, atStake: 23076, thin: true },
    { key: 'a', line: 'Cement OPC', units30: 40, sold30: 1440000, earned30: 160000,
      keptPct: 11.1, target: 22, cost: 32000, price: 36000, targetPrice: 41025, atStake: 201000, thin: true },
  ];
  rows.skipped = { noCost: 7, noSales: 3 };
  return rows;
};

let rangeAsked = 0, contextBuilt = 0;
const env = {
  document, data, marginRows,
  /* extractFunction takes functions, not the constants beside them, so
     the clock the ranking runs on is supplied here -- and asserted
     against the source below, or a change to it would pass unnoticed. */
  ANALYSIS_MONTHS_AHEAD: 12,
  esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  fmtShortDate: (d) => String(d),
  todayISO: () => '2026-08-30',
  goToTab: () => {},
  OW_CARET: '<svg/>', OW_CARET_C: '<svg/>',
  deadStockQuietDays: () => 60,
  targetMarginPct: () => 22,
  deadStockRows: () => [{ line: 'Wheelbarrows (heavy)', value: 830000, daysQuiet: 214 }],
  priceReviewStaleDays: () => 60,
  priceReviewProgress: () => ({ done: 6, target: 20 }),
  priceReviewCandidates: () => [
    { row: { pname: 'Iron sheets G28', sname: 'Kirinya Steel' }, unit: 41200, volume: 19,
      moneyAtRisk: 780000, reasons: ['94 days'] },
  ],
  /* THE REAL SHAPE, because a stub is a claim about the app.
     The first build read r.in / r.out; dashCashBridgeData returns
     {label, inAmt, outAmt}. Every week came out zero, the screen
     reported "0 of 8 weeks went out" on a book it had not read, and
     this file passed — because the stub was wrong in the same way. */
  dashCashBridgeData: () => [{ label: 'W1', inAmt: 8000, outAmt: 7000 },
    { label: 'W2', inAmt: 6000, outAmt: 9000 }],
  dashGetRange: () => { rangeAsked++; return { from: '2026-08-01', to: '2026-08-30' }; },
  dashboardContext: () => { contextBuilt++; return dctx; },
  /* The worklist's own world: the marks the owner puts on findings, the
     bills the shop owes, and the Cash Book entries the statement splits
     by category. */
  AN_AREAS: ['Pricing', 'Stock', 'Money', 'Customers'],
  AN_SNOOZE_DAYS: 7, AN_HANDLED_DAYS: 30,
  lsGet: () => null,
  anShiftDate: (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
  credDueRows: () => ({ undated: [], ahead: [{ dueOn: '2026-09-02', due: 400000 }],
    missed: [{ dueOn: '2026-08-20', due: 250000 }], total: 650000, count: 2 }),
  dashWeeklyBuckets: () => [{ from: '2026-08-03', to: '2026-08-09', label: 'W1' }, { from: '2026-08-10', to: '2026-08-16', label: 'W2' }],
  dashCashTxnsInRange: () => [
    { type: 'receipt', category: 'Sales Revenue', amount: 14000 },
    { type: 'payment', category: 'Supplier payments', amount: 12000 },
    { type: 'expense', category: 'Wages', amount: 4000 }],
};

/* EVERY function the screen is built from, compiled together. One of
   them reaching for a name that is not there is the whole point of
   this file, and seven functions is seven chances to do it. */
const NAMES = ['analysisWorth', 'anN', 'axShort', 'analysisFindings', 'anCashCategories', 'anMarks', 'anMarkOf',
  'anState', 'anLists', 'anStatusOf', 'anTagHTML', 'anFigOf', 'anRowHTML', 'anDetailBodyHTML', 'anActionsHTML',
  'anDetailHTML', 'anKpisHTML', 'anCashHTML', 'anBasisHTML', 'renderAnalysis', 'anDraw'];
const scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), env, NAMES);

/* ---------- 1. called with a context, as renderDashboard calls it ---------- */
{
  let err = null;
  try { scope.renderAnalysis(dctx); } catch (e) { err = e; }
  t.check(!err, `it runs when the dashboard hands it the context it already built${err ? ` — ${err.name}: ${err.message}` : ''}`);
  t.check(contextBuilt === 0 && rangeAsked === 0,
    'and it does not read the same window a second time — the caller already paid for that pass');
  /* What the five old panel assertions meant, kept: the screen is
     really filled, so a stub that silently did nothing cannot pass. */
  t.check(/Cement OPC/.test(drawn()), 'the margin finding reads the lines that sold');
  t.check(/Mulongo/.test(drawn()), 'the debt and quiet findings read the customers');
  t.check(/Barbed wire/.test(drawn()), 'and breadth reads its own list');
  t.check(/Iron sheets G28/.test(drawn()), 'and the stale-price finding reads the registry');
  t.check(!/Paid up/.test(drawn()),
    'the debt finding shows only those who owe — a customer at zero is not a finding');
  /* The sentence states the two kinds of money as two figures. */
  t.check(/a year/.test(written.ax_summary || '') && /once/.test(written.ax_summary || ''),
    'the sentence above the list states what fixing it is worth, a year and once, as two figures');
  t.check(/Below your rule|At or above your rule/.test(written.dash_position || ''),
    'and every figure under it carries its verdict in words');
}

/* ---------- 2. the ranking, and the rule it runs on ---------- */
{
  const html = drawn();
  /* TWO KINDS OF MONEY, NEVER ADDED. A margin comes back every month;
     cash owed or locked in stock comes back once. The ranking counts
     everything over a year so the two can be ORDERED, and every row
     states its own kind so the order can be argued with. */
  t.check(/a year, if you lift it/.test(html), 'money that repeats says so on its row');
  t.check(/owed, once/.test(html) && /locked up, once/.test(html), 'and money that arrives once says so too');
  t.check(scope.analysisWorth(1000, 'monthly') === 12000,
    'a month of money is worth twelve of itself over the year the ranking uses');
  t.check(scope.analysisWorth(1000, 'once') === 1000, 'and a one-off is worth itself, once');
  t.check(scope.analysisWorth(0, 'monthly') === null,
    'nothing is worth nothing — a zero cannot be ranked, and is not');

  /* The rows come out in descending order of what a fix is worth. */
  /* A kind can now be more than one finding -- three lines under their
     rule are three prices to change -- so the ids carry a number. */
  const order = [...html.matchAll(/data-fid="([a-z0-9-]+)"/g)].map((m) => m[1]);
  const found = scope.analysisFindings(dctx);
  const worths = new Map(found.map((f) => [f.id, f.worth]));
  const ranked = order.filter((id) => worths.get(id) != null);
  t.check(ranked.every((id, i) => i === 0 || worths.get(ranked[i - 1]) >= worths.get(id)),
    'and the ranked findings are drawn in descending order of what fixing them is worth');

  /* A FINDING THE BOOKS CANNOT PRICE STILL APPEARS, AND SAYS SO.
     Derived, never invented: the app holds a quiet customer's rhythm
     but not what they would have spent. A figure there would be a
     guess, and the law of this app is that it does not guess. */
  const quiet = found.find((f) => f.id === 'quiet');
  t.check(quiet && quiet.worth === null && quiet.unpriced === true,
    'a finding the books cannot price carries no figure rather than a guessed one');
  t.check(/the books cannot price these/i.test(html),
    'and it is drawn under a band that says why, rather than dropped');

  /* Net cash over eight weeks is neither a month twelve times nor a
     one-off, so it has no honest place on the ranking's clock. */
  const cash = found.find((f) => f.id === 'cash');
  t.check(cash && cash.worth === null && cash.position === true,
    'net cash is a position, not a fix, so it is not ranked');
  /* WHERE IT IS DRAWN MOVED AGAIN. It was a chart in the rail with a
     chip saying "Position, not a fix". The redesign drew it as what it
     is -- a statement, in and out by category and the net under a rule,
     below the worklist -- and the chip went with the chart. The claim
     is unchanged: cash is drawn, never ranked. So the list must not
     carry it, and the statement must, with its net. */
  t.check(/Net/.test(written.dash_cash || '') && /Supplier payments/.test(written.dash_cash || ''),
    'it is drawn as a statement below the list, split by the category each entry was filed under');
  t.check(!/data-fid="cash"/.test(html), 'and it is not drawn in the ranked list at all');

  /* THE ACCENT APPEARS ONCE, AND ON THE RIGHT ROW.
     It was first hard-coded onto the margin finding, so a shop whose
     worst problem was a debt opened a screen with no accent on it at
     all. The list is ranked; the top of it is the one thing to do next,
     so the lead row's action wears it and everything else is a ghost. */
  const accents = (html.match(/btn-accent/g) || []).length;
  t.check(accents <= 1, `at most one accent on the screen (found ${accents})`);
  const lead = html.slice(0, html.indexOf('data-fid', html.indexOf('data-fid') + 1));
  t.check(accents === 0 || /btn-accent/.test(lead),
    'and it is on the top-ranked finding, whichever finding that turns out to be');
  /* The desk opens the finding beside the list instead of inside it, and
     it opens the top one: the same single accent, on the same finding. */
  const det = written.ax_detail || '';
  const detAccents = (det.match(/btn-accent/g) || []).length;
  t.check(detAccents === 1, `the open finding beside the list carries the one accent (found ${detAccents})`);
  const top = order.find((id) => worths.get(id) != null);
  const topF = found.find((f) => f.id === top);
  t.check(!!topF && det.indexOf(topF.title.replace(/&/g, '&amp;')) >= 0,
    'and the finding open by default is the top-ranked one');
}

/* ---------- 3. the account, which has to partition ---------- */
{
  /* The one device that lets a reader trust a list for what it does NOT
     say. It is worthless unless it adds up: 2 lines read + 7 with no
     cost = 9, split into 2 under their rule, 0 at or above, 7 unjudged. */
  const acct = written.dash_account;
  t.check(/Lines sold<\/dt><dd[^>]*><span class="ow-acct-n">9<\/span>/.test(acct),
    'the account counts every line it read, costed or not');
  t.check(/7<\/span> lines sold have no cost on file/.test(acct),
    'and names the ones nothing can judge rather than leaving them out of the total');
}

/* ---------- 4. called bare, as goToTab('analysis') calls it ---------- */
{
  let err = null;
  try { scope.renderAnalysis(); } catch (e) { err = e; }
  t.check(!err, `it runs when Analysis is opened directly, with no context to inherit${err ? ` — ${err.name}: ${err.message}` : ''}`);
  t.check(contextBuilt === 1 && rangeAsked === 1,
    'making its own reading exactly once, over the range the screen is showing');
  /* The two callers must not diverge: a screen that shows one thing
     when reached through the dashboard and another when opened
     directly is worse than one that is simply wrong. */
  t.check(/Cement OPC/.test(drawn()),
    'and it fills the same screen the same way down both paths');
}

/* ---------- 5. the shape of the failure, stated ---------- */
{
  const fn = extractFunction(src, 'renderAnalysis', 'index.html');
  t.check(/^function renderAnalysis\(dctx\)/.test(fn),
    'the context is a parameter — the thing it reads is passed to it, not left lying in a scope it hopes it is inside');
  t.check(/analysisFindings\(dctx\)/.test(fn),
    'and the parameter is handed on to the function that reads it, rather than reached for again');

  const finds = extractFunction(src, 'analysisFindings', 'index.html');
  t.check(/^function analysisFindings\(dctx\)/.test(finds),
    'the findings take the context as a parameter too — the same hazard, one level down');
  t.check(/dctx\.goingQuiet/.test(finds) && /dctx\.breadth/.test(finds) && /dctx\.debtors/.test(finds),
    'and the names it once borrowed are taken off that parameter');

  const dash = extractFunction(src, 'renderDashboard', 'index.html');
  t.check(/renderAnalysis\(dctx\);/.test(dash),
    'the dashboard hands its own context over rather than letting Analysis guess');

  /* Why this file runs the functions instead of reading them. A missing
     identifier is invisible to node --check and to every test that
     matches source text; it exists only at call time. */
  /* A STUB IS A CLAIM ABOUT THE APP, AND CAN BE WRONG.
     The first build of this screen called fmtDate(), which does not
     exist in index.html -- and because THIS file stubbed a function of
     that name, it passed while the real screen threw on the real page.
     A stub can only stand in for something the app actually has, so
     every name stubbed above is checked against the source -- both
     files, because esc() and the other shared helpers live in
     shared-worker.js and the page loads them together. */
  const app = src + read('shared-worker.js');
  const stubbed = ['marginRows', 'deadStockRows', 'deadStockQuietDays', 'priceReviewCandidates',
    'priceReviewProgress', 'priceReviewStaleDays', 'dashCashBridgeData', 'dashGetRange',
    'dashboardContext', 'fmtShortDate', 'fmtUGX', 'todayISO', 'goToTab', 'esc', 'targetMarginPct',
    'lsGet', 'anShiftDate', 'credDueRows', 'dashWeeklyBuckets', 'dashCashTxnsInRange'];
  const missing = stubbed.filter((n) => !new RegExp('function ' + n + '\\s*\\(').test(app));
  t.check(missing.length === 0,
    `every function this file stubs really exists in the app${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);

  /* AND THE FIELD NAMES, which is the half a stub cannot check by
     existing. Four of these were wrong on the first build and every one
     of them passed this file: r.in/r.out for the cash bridge (every
     week read zero), t.revenue for the window totals (an em dash where
     the margin should be), r.label for dead stock (a table of six
     figures with the item column blank). A stub is a claim about the
     app, and a stub that is wrong in the same way as the code hides
     exactly the bug it was written to catch.

     So every field the screen reads off a helper is checked against the
     function that really produces it. This is the whole class, not the
     four that were found by looking. */
  const READS = {
    dashCashBridgeData: ['label', 'inAmt', 'outAmt'],
    anOverallTotals: ['sales'],
    stockAgeRows: ['line', 'value', 'daysQuiet', 'qty', 'clearance'],
    dashWeeklyBuckets: ['from', 'to'],
    credDueRows: ['undated', 'ahead', 'missed'],
    marginRows: ['line', 'units30', 'earned30', 'keptPct', 'target', 'cost',
      'price', 'targetPrice', 'atStake', 'thin'],
    dashGoingQuietCustomers: ['name', 'avgGapDays', 'sinceLastDays'],
    dashDemandBreadth: ['name', 'qty', 'buyers', 'topBuyerName'],
    priceReviewFacts: ['moneyAtRisk', 'unit', 'volume', 'reasons'],
    dashboardContext: ['debtors', 'goingQuiet', 'breadth', 'invoices', 'totals',
      'grossProfit', 'inv'],
  };
  const wrong = [];
  for (const [fn, fields] of Object.entries(READS)) {
    const body = extractFunction(src, fn, 'index.html');
    for (const f of fields) {
      if (!new RegExp('\\b' + f + '\\s*[:,)}]').test(body)) wrong.push(`${fn}.${f}`);
    }
  }
  t.check(wrong.length === 0,
    `every field this screen reads is really produced by the function it reads it from${wrong.length ? ' — missing: ' + wrong.join(', ') : ''}`);

  /* AN ID IS A NAME, AND TWO THINGS CANNOT SHARE ONE.
     Analysis first called its reading-time line dash_asof -- the id
     Today's page header already had. getElementById returns the first
     match, so Analysis wrote its line into Today's header and left its
     own blank, and Today wrote over it on the next render. Neither
     screen showed anything wrong; the sub was simply always empty. */
  const ids = [...src.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
  const dupes = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
  const section = src.slice(src.indexOf('<section id="tab-analysis"'),
    src.indexOf('</section>', src.indexOf('<section id="tab-analysis"')));
  const mine = [...section.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
  const clashes = mine.filter((n) => dupes.includes(n));
  t.check(clashes.length === 0,
    `no id on this screen is a name another screen already uses${clashes.length ? ' — ' + clashes.join(', ') : ''}`);

  t.check(/const ANALYSIS_MONTHS_AHEAD = 12;/.test(src),
    'the ranking counts a month of money twelve times, and says so in one named place');

  t.check(/if\(!dctx\)\{/.test(fn),
    'and a caller with nothing to give is served rather than crashing — goToTab(\'analysis\') passes nothing');
}

process.exit(t.done() ? 1 : 0);
