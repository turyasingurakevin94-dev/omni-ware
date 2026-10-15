#!/usr/bin/env node
'use strict';
/*
 * Things on the agent's screens that read as broken although nothing threw.
 *
 *   "every 0 days"   Two orders placed on one day were counted as a rhythm
 *                    of zero days. A rhythm is between visits.
 *   Sent             The Sent page lit three steps and listed an order
 *                    waiting on the agent's money with no word of why.
 *
 * Run: node test/agent-polish.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent polish');
const src = read('agent.html');

/* ---------- 1. a rhythm is between visits ---------- */
{
  const { clientCadence } = compileScope([extractFunction(src, 'clientCadence', 'agent.html')], {
    orderEarnings: (o) => ({ margin: o.m || 0 }),
    orderTotal: (o) => o.t || 0,
    orderDate: (o) => o.d,
  }, ['clientCadence']);
  const today = new Date('2026-10-14T12:00:00');
  const counts = (rows) => new Map([['C', rows]]);
  t.check(clientCadence({ id: 'C' }, counts([{ d: '2026-10-14', m: 10 }, { d: '2026-10-14', m: 6 }]), today) === null,
    'two orders on one day are one visit -- no rhythm yet, rather than "every 0 days"');
  const c = clientCadence({ id: 'C' }, counts([{ d: '2026-10-01', m: 10 }, { d: '2026-10-01', m: 6 }, { d: '2026-10-11', m: 4 }]), today);
  t.check(c && Math.round(c.avgGapDays) === 10, `and the gap is counted between visit days (${c && c.avgGapDays})`);
  t.check(c && c.avgMargin === 10, `what a visit usually earns is per visit, so a split order is not halved (${c && c.avgMargin})`);
}

/* ---------- 2. Sent says which part each order is in ---------- */
{
  const parts = extractFunction(src, 'busyParts', 'agent.html');
  t.check(/if\(key === 'sent'\) return \[\s*\{ id:'pay', label:'Pay the shop'/.test(parts),
    'an order waiting on the money is listed under that, first');
  t.check(/key === 'sent' && x\.st\.key === 'settle'/.test(extractFunction(src, 'openBusyStage', 'agent.html')),
    'including a finished order still owed to the shop');
}

/* ---------- 3. one look per meaning ---------- */
{
  t.check(/\.ax-oc \.go\{[^}]*background:none;/.test(src) && /\.ax-oc \.go\.warn\{[^}]*background:var\(--warn\);color:#fff;\}/.test(src),
    'Pay and Collect are solid, Open is a plain link');
  t.check(/\.ax-sec \.n\{font-size:13px;font-weight:600;color:var\(--ink-soft\);\}/.test(src),
    'section counts are words, not code: the money font is for amounts');
}

/* ---------- 4. a sheet comes down the way it went up ---------- */
{
  const open = extractFunction(src, 'openSheet', 'agent.html');
  const drag = extractFunction(src, 'sheetDrag', 'agent.html');
  t.check(/sheetDrag\(sheet\);/.test(open), 'every sheet can be pulled down to close');
  t.check(/on = t\.clientY - el\.getBoundingClientRect\(\)\.top < 72 \|\| !scrolledInside\(e\.target\);/.test(drag),
    'from its handle and header, or from anywhere once what is under the finger is at its top -- so it never steals a scroll');
  t.check(/if\(dy > el\.offsetHeight \/ 3 \|\| flick\)/.test(drag) && /el\.style\.transform = '';/.test(drag),
    'past a third, or a flick, it closes; short of that it springs back');
  t.check(/e\.target\.closest\('input, textarea, select, \[contenteditable\]'\)/.test(drag), 'and a field keeps its own drag');
}

process.exit(t.done() ? 1 : 0);
