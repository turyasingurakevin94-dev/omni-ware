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
 * app shell, the topbar, the nav and the assistant panel until boot
 * says it is safe to show them -- so an error one line earlier does not
 * produce a broken screen, it produces NO screen. The owner opened the
 * shop to a white page.
 *
 * One undefined name. The whole app.
 *
 * So this file does the thing the rest of the suite does not: it RUNS
 * renderAnalysis, against a stubbed DOM and a context shaped like the
 * real one. A missing identifier is a ReferenceError at call time and
 * cannot hide behind a screen nobody opened. If a future edit reaches
 * for another of renderDashboard's locals, this fails here rather than
 * on the owner's phone.
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
});
const nodes = {};
const document = { getElementById: (id) => (nodes[id] || (nodes[id] = el(id))) };

/* A context shaped like dashboardContext's, carrying the three fields
   the panels read off it. The point is the WIRING, not the arithmetic --
   dashboard-alerts.test.js owns what these figures mean. */
const dctx = {
  itemRows: [
    { key: 'a', name: 'Cement OPC', qty: 40, sales: 1440000, cost: 1280000, profit: 160000, margin: 11.1 },
    { key: 'b', name: 'Iron sheets G28', qty: 12, sales: 300000, cost: 252000, profit: 48000, margin: 16 },
  ],
  goingQuiet: [{ name: 'Mulongo', avgGapDays: 12, sinceLastDays: 41 }],
  breadth: [{ name: 'Cement OPC', qty: 40, buyers: 3, topBuyerName: 'Joan JEZONA' }],
};

const data = {
  customers: [
    { name: 'Mulongo', debt: 3330000 },
    { name: 'Dad', debt: 1436000 },
    { name: 'Paid up', debt: 0 },
  ],
};

let rangeAsked = 0, contextBuilt = 0;
const env = {
  document, data,
  esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  daysSinceDate: () => 45,
  customerOldestOpenChargeDate: () => '2026-07-16',
  /* The drawing helpers are somebody else's tests. Stubbed so a change
     to an SVG generator cannot fail THIS file, which is about scope. */
  dashCashBridgeData: () => [],
  dashDemandTrendData: () => [{ label: 'W1', qty: 10, sales: 200 }],
  dashGroupedBarSVG: () => '<svg/>',
  dashAreaSVG: () => '<svg/>',
  dashQuadrantSVG: () => '<svg/>',
  dashGetRange: () => { rangeAsked++; return { from: '2026-08-01', to: '2026-08-30' }; },
  dashboardContext: () => { contextBuilt++; return dctx; },
};

const scope = compileScope([extractFunction(src, 'renderAnalysis', 'index.html')], env, ['renderAnalysis']);

/* ---------- 1. called with a context, as renderDashboard calls it ---------- */
{
  let err = null;
  try { scope.renderAnalysis(dctx); } catch (e) { err = e; }
  t.check(!err, `it runs when the dashboard hands it the context it already built${err ? ` — ${err.name}: ${err.message}` : ''}`);
  t.check(contextBuilt === 0 && rangeAsked === 0,
    'and it does not read the same window a second time — the caller already paid for that pass');
  t.check(/2 items sold/.test(written.dash_quadrant_note),
    'the panels are actually filled, so a stub that silently did nothing would not pass this');
  t.check(/Cement OPC/.test(written.dash_topPerformers), 'top performers reads the item rows');
  t.check(/Mulongo/.test(written.dash_goingQuiet), 'going quiet reads its own list');
  t.check(/Cement OPC/.test(written.dash_demandBreadth), 'and breadth reads its own');
  t.check(/Mulongo/.test(written.dash_leakage) && !/Paid up/.test(written.dash_leakage),
    'and the leakage panel reads the customers, showing only those who owe');
}

/* ---------- 2. called bare, as goToTab('analysis') calls it ---------- */
{
  let err = null;
  try { scope.renderAnalysis(); } catch (e) { err = e; }
  t.check(!err, `it runs when Analysis is opened directly, with no context to inherit${err ? ` — ${err.name}: ${err.message}` : ''}`);
  t.check(contextBuilt === 1 && rangeAsked === 1,
    'making its own reading exactly once, over the range the screen is showing');

  /* The two callers must not diverge: a screen that shows one thing
     when reached through the dashboard and another when opened
     directly is worse than one that is simply wrong. */
  t.check(/2 items sold/.test(written.dash_quadrant_note),
    'and it fills the same panels the same way down both paths');
}

/* ---------- 3. the shape of the failure, stated ---------- */
{
  const fn = extractFunction(src, 'renderAnalysis', 'index.html');
  t.check(/^function renderAnalysis\(dctx\)/.test(fn),
    'the context is a parameter — the thing it reads is passed to it, not left lying in a scope it hopes it is inside');
  t.check(/const \{[^}]*itemRows[^}]*\} = dctx;/.test(fn),
    'and the three names it once borrowed are now taken off that parameter');

  const dash = extractFunction(src, 'renderDashboard', 'index.html');
  t.check(/renderAnalysis\(dctx\);/.test(dash),
    'the dashboard hands its own context over rather than letting Analysis guess');

  /* Why this file runs the function instead of reading it. A missing
     identifier is invisible to node --check and to every test that
     matches source text; it exists only at call time. */
  t.check(/if\(!dctx\)\{/.test(fn),
    'and a caller with nothing to give is served rather than crashing — goToTab(\'analysis\') passes nothing');
}

process.exit(t.done() ? 1 : 0);
