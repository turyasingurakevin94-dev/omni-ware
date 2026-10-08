#!/usr/bin/env node
'use strict';
/*
 * agent-nudge: what an agent's phone is told, and when. A notification is
 * the one part of the feed that reaches into someone's pocket uninvited,
 * so these pin the rules that keep it worth having: quiet hours, a daily
 * cap, each moment sent once, the most urgent first, and a closed
 * endpoint. Plus the agent side: asked for only from a button, and a tap
 * lands on the Feed.
 *
 * Run: node test/agent-nudge.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent nudge');
const fnSrc = read('supabase/functions/agent-nudge/index.ts');
const fn = (name) => extractFunction(fnSrc, name, 'agent-nudge/index.ts');
const DAY = 86400000;

let api;
try {
  api = compileScope(
    ['kampalaHour', 'isQuiet', 'kampalaDate', 'linePriced', 'orderEarnings', 'fmt', 'first', 'nudgesFor', 'pickToSend', 'monthBoard'].map(fn),
    { QUIET_FROM: 20, QUIET_TO: 7, KAMPALA_OFFSET_H: 3, DAY },
    ['isQuiet', 'nudgesFor', 'pickToSend', 'monthBoard'],
    { typescript: true });
} catch (e) { t.check(false, `the nudge rules compile (${e.message})`); }

if (api) {
  /* ---------- 1. quiet hours, Kampala time ---------------------------- */
  t.check(api.isQuiet(Date.parse('2026-09-27T17:30:00Z')), '20:30 in Kampala is quiet');
  t.check(api.isQuiet(Date.parse('2026-09-27T03:30:00Z')), '06:30 in Kampala is quiet');
  t.check(!api.isQuiet(Date.parse('2026-09-27T05:00:00Z')), '08:00 in Kampala is not');

  /* ---------- 2. what is worth a nudge, most urgent first -------------- */
  const now = Date.parse('2026-09-27T07:00:00Z');      // 10:00 in Kampala
  const d = (n) => new Date(now - n * DAY).toISOString().slice(0, 10);
  const line = (price, sell, qty) => ({ sellPrice: price, agentSellPrice: sell, qty });
  const orders = [
    { agent_id: 'A1', date: d(42), status: 'completed', payload: { agentClientId: 7, items: [line(100, 120, 10)] } },
    { agent_id: 'A1', date: d(21), status: 'completed', payload: { agentClientId: 7, items: [line(100, 120, 10)] } },
    { agent_id: 'A2', date: d(3), status: 'completed', payload: { items: [line(100, 130, 12)] } },
    { agent_id: 'A1', date: d(2), status: 'completed', payload: { items: [line(100, 120, 5)] } },
  ];
  const board = api.monthBoard(orders.filter((o) => o.date >= '2026-09-01'), [{ id: 'A1' }, { id: 'A2' }], '2026-09');
  const ctx = {
    inquiries: [
      { id: 1, agent_id: 'A1', customer_name: 'Peter Mugisha', message: 'Need 2 grinders', created_at: new Date(now - 3600000).toISOString() },
      { id: 2, agent_id: 'A1', customer_name: 'Old', created_at: new Date(now - 5 * DAY).toISOString() },
      { id: 3, agent_id: 'A2', customer_name: 'Not his', created_at: new Date(now - 3600000).toISOString() },
      { id: 4, agent_id: 'A1', customer_name: 'Done', handled_at: 'x', created_at: new Date(now - 3600000).toISOString() },
    ],
    pins: [{ id: 9, product_id: 'gog', note: 'New stock', created_at: new Date(now - DAY).toISOString(), ends_on: d(-3) }],
    promos: [{ id: 5, product_id: 'g', variant_idx: '', bonus_type: 'fixed', bonus_value: 5000, active: true, ends_at: d(-1) },
             { id: 6, product_id: 'x', variant_idx: '', bonus_type: 'fixed', bonus_value: 5000, active: true, ends_at: d(-1) }],
    clusters: [{ agent_id: 'A1', product_id: 'g', variant_idx: '' }],
    orders,
    products: new Map([['gog', 'Safety goggles'], ['g', 'Angle grinder']]),
    clients: new Map([['A1|7', 'John Kasule']]),
    board,
  };
  const n = api.nudgesFor('A1', ctx, now);
  const kinds = n.map((x) => x.kind);
  t.check(JSON.stringify(kinds) === JSON.stringify(['request', 'pin', 'due', 'rank', 'bonus']),
    `a request, a pin, a client due, a place within reach and a bonus ending, in that order (${kinds.join(', ')})`);
  t.check(n.filter((x) => x.kind === 'request').length === 1,
    'only an unanswered request, from the last two days, on HIS page');
  t.check(n.find((x) => x.kind === 'due').title === 'John Kasule is due', 'the due client is named');
  t.check(n.filter((x) => x.kind === 'bonus').length === 1, 'a bonus only for an item in his cluster');
  t.check(/from #1/.test(n.find((x) => x.kind === 'rank').title), 'and the place he can reach is the one above him');

  /* ---------- 3. once, and a cap a day -------------------------------- */
  const sent = new Set(['request|1']);
  const pick = api.pickToSend(n, sent, 1, 3);
  t.check(pick.length === 2 && pick[0].kind === 'pin', 'a moment already sent is not sent again, and the day stops at three');
  t.check(api.pickToSend(n, new Set(), 3, 3).length === 0, 'three already today means none more');
}

/* ---------- 4. closed unless the shop set a secret --------------------- */
t.check(/if \(!AGENT_NUDGE_SECRET\) return json\(\{ error: "AGENT_NUDGE_SECRET is not set" \}, 503\);/.test(fnSrc),
  'the run endpoint refuses to work at all without AGENT_NUDGE_SECRET');
t.check(/x-cron-secret/.test(fnSrc) && /401/.test(fnSrc), 'and turns away a call without the right secret');
t.check(/retired_at/.test(fnSrc) && /unavailable/.test(fnSrc), 'a paused or retired agent is never nudged');
t.check(/unique index if not exists agent_push_log_once/.test(read('supabase/migrations/0103_agent_push.sql')),
  'the database itself refuses the same moment twice');

/* ---------- 5. the agent side ------------------------------------------ */
const agent = read('agent.html');
t.check(/data-p="push" role="switch"/.test(agent) && /if\(k === 'push'\)\{ if\(await enableAgentPush\(\)\)/.test(agent),
  'notifications are asked for from a button he pressed');
t.check(!/requestPermission\(\)[\s\S]{0,40}boot\(\)/.test(agent) && !/^\s*enableAgentPush\(\);/m.test(agent),
  'and never on load');
t.check(/switchTab\(openParam \? 'today'/.test(agent),
  'a tapped notification opens the app on Today, where the feed\'s best cards now live');
const sw = read('agent-sw.js');
t.check(/showNotification/.test(sw) && /notificationclick/.test(sw) && !/caches\./.test(sw),
  'the service worker shows and opens notifications, and caches nothing');

process.exit(t.done() ? 1 : 0);
