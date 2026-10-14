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

/* ---------- 2. Sent says which step each order is on ---------- */
{
  const sheet = extractFunction(src, 'openStageSheet', 'agent.html');
  t.check(/const SENT_GROUPS = \[\s*\{ keys:\['pay','settle'\], icon:'cash', label:'Waiting for your payment', warn:true \}/.test(src),
    'an order waiting on the money is listed under that, first');
  t.check(/const lit = groups && groups\.length \? groups\.map\(x=> x\.g\.icon\) : page\.lit;/.test(sheet),
    'and only the steps an order is actually on are lit');
}

/* ---------- 3. one look per meaning ---------- */
{
  t.check(/\.ax-oc \.go\{[^}]*background:none;/.test(src) && /\.ax-oc \.go\.warn\{[^}]*background:var\(--warn\);color:#fff;\}/.test(src),
    'Pay and Collect are solid, Open is a plain link');
  t.check(/\.ax-sec \.n\{font-size:13px;font-weight:600;color:var\(--ink-soft\);\}/.test(src),
    'section counts are words, not code: the money font is for amounts');
}

process.exit(t.done() ? 1 : 0);
