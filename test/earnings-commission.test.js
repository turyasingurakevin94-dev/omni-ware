#!/usr/bin/env node
'use strict';
/*
 * Earnings and commission math.
 *
 * Two agent-facing numbers are computed in more than one place:
 *
 *   orderEarnings()  -- agent.html (the Earnings screen) and
 *                       agent-leaderboard (the agent's rank). If these
 *                       disagree, an agent is ranked on figures that don't
 *                       match the ones they're shown.
 *
 *   the month's bonus -- agent.html shows it on the "Claim UGX X" button,
 *                        agent-claim-commission recomputes it server-side
 *                        and inserts THAT as the payout. If those differ,
 *                        an agent is offered one amount and paid another.
 *
 * The second is the expensive one, and it's deliberately recomputed on the
 * server (the comment there says as much: never trust a client-sent
 * amount). That's right, and it's exactly why the two rules have to be kept
 * saying the same thing.
 *
 * Run: node test/earnings-commission.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('earnings/commission');
const agentSrc = read('agent.html');
const boardSrc = read('supabase/functions/agent-leaderboard/index.ts');
const claimSrc = read('supabase/functions/agent-claim-commission/index.ts');

// monthEarnings() reads the myOrders global, so it has to be a live binding
// the test can refill in place (reassigning wouldn't reach the compiled code).
const myOrders = [];
const setOrders = (rows) => { myOrders.length = 0; rows.forEach((r) => myOrders.push(r)); };

const agent = compileScope(
  [extractFunction(agentSrc, 'orderEarnings', 'agent.html'),
   extractFunction(agentSrc, 'monthEarnings', 'agent.html')],
  { myOrders }, ['orderEarnings', 'monthEarnings'],
);
const board = compileScope(
  [extractFunction(boardSrc, 'orderEarnings', 'agent-leaderboard')],
  {}, ['orderEarnings'], { typescript: true },
);

const item = (agentSellPrice, sellPrice, qty, bonusCommission) =>
  ({ agentSellPrice, sellPrice, qty, bonusCommission });

/* ---------- 1. the two orderEarnings agree on the total ---------------- */
/*
 * Different shapes -- agent.html splits margin and bonus, the leaderboard
 * returns one number -- so the comparable thing is the total.
 */
const ORDERS = [
  { name: 'single line, margin only',   items: [item(1200, 1000, 3, 0)] },
  { name: 'margin plus bonus',          items: [item(1200, 1000, 3, 500)] },
  { name: 'several lines',              items: [item(1200, 1000, 3, 500), item(800, 700, 10, 250), item(5000, 4800, 1, 0)] },
  { name: 'sold at cost (no margin)',   items: [item(1000, 1000, 4, 0)] },
  { name: 'sold below cost',            items: [item(900, 1000, 4, 0)] },
  { name: 'bonus with zero margin',     items: [item(1000, 1000, 2, 750)] },
  { name: 'fractional quantity',        items: [item(1500, 1200, 2.5, 0)] },
  { name: 'no items at all',            items: [] },
  // Fields absent or non-numeric must coerce to 0, never NaN -- a single
  // NaN would poison the month total and the leaderboard rank alike.
  { name: 'missing fields',             items: [{ qty: 3 }, { agentSellPrice: 500 }, {}] },
  { name: 'null bonus',                 items: [item(1200, 1000, 2, null)] },
  { name: 'numeric strings',            items: [item('1200', '1000', '3', '500')] },
];

let disagreements = 0;
for (const o of ORDERS) {
  const a = agent.orderEarnings(o);      // { margin, bonus, total }
  const b = board.orderEarnings(o.items); // a bare total
  if (!Number.isFinite(a.total) || !Number.isFinite(b)) {
    disagreements++;
    t.fail(`orderEarnings produced a non-finite total — "${o.name}": agent.html=${a.total}, leaderboard=${b}`);
  } else if (a.total !== b) {
    disagreements++;
    t.fail(`orderEarnings disagrees — "${o.name}": agent.html=${a.total} (margin ${a.margin} + bonus ${a.bonus}), leaderboard=${b}`);
  }
}
if (!disagreements) t.pass(`orderEarnings total identical in agent.html and agent-leaderboard (${ORDERS.length} order shapes)`);

/* ---------- 2. margin and bonus are separated correctly ---------------- */
{
  const e = agent.orderEarnings({ items: [item(1200, 1000, 3, 500), item(800, 700, 10, 250)] });
  const expectedMargin = (1200 - 1000) * 3 + (800 - 700) * 10; // 600 + 1000
  const expectedBonus = 500 + 250;
  t.check(e.margin === expectedMargin && e.bonus === expectedBonus && e.total === expectedMargin + expectedBonus,
    `margin and bonus are summed independently (margin ${e.margin}/${expectedMargin}, bonus ${e.bonus}/${expectedBonus})`);
}

/* ---------- 3. monthEarnings scopes to the right orders ---------------- */
/*
 * The month total has to exclude voided orders and orders from other
 * months, and must not depend on order status -- an agent's bonus is earned
 * when the sale is made, and the Earnings screen shows every non-voided
 * order for the month with its status alongside.
 */
setOrders([
  { savedAt: '2026-07-04T10:00:00Z', voided: false, status: 'completed', items: [item(1200, 1000, 1, 100)] },
  { savedAt: '2026-07-20T10:00:00Z', voided: false, status: 'draft',     items: [item(1200, 1000, 1, 200)] },
  { savedAt: '2026-07-28T10:00:00Z', voided: true,  status: 'completed', items: [item(9999, 1000, 9, 9999)] }, // voided
  { savedAt: '2026-06-30T10:00:00Z', voided: false, status: 'completed', items: [item(1200, 1000, 1, 400)] }, // prior month
  { savedAt: '2026-08-01T10:00:00Z', voided: false, status: 'completed', items: [item(1200, 1000, 1, 800)] }, // next month
  { savedAt: null,                   voided: false, status: 'completed', items: [item(1200, 1000, 1, 1600)] }, // undated
]);
{
  const july = agent.monthEarnings('2026-07');
  t.check(july.bonus === 300, `month bonus counts only that month's unvoided orders (got ${july.bonus}, expected 300)`);
  t.check(july.margin === 400, `month margin likewise (got ${july.margin}, expected 400)`);
  t.check(july.orders.length === 2, `month order list matches (got ${july.orders.length}, expected 2)`);
  t.check(agent.monthEarnings('2026-09').total === 0, 'a month with no orders earns nothing');
}

/* ---------- 4. shown bonus == the amount the server would pay ---------- */
/*
 * agent-claim-commission recomputes the payout from the agent's own order
 * history rather than trusting anything sent to it, so the two rules are
 * separate code. This runs the agent-side rule and the server's rule over
 * the same orders and requires the same number.
 *
 * The server's version is inline in the request handler rather than a named
 * function, so it can't be extracted and run the way orderEarnings can --
 * it's mirrored here, with check 5 below guarding that the mirror still
 * matches the real thing.
 */
function serverClaimAmount(orders, month) {
  let bonusAmount = 0;
  for (const row of orders || []) {
    const payload = row.payload || {};
    if (!payload.savedAt || !String(payload.savedAt).startsWith(month)) continue;
    for (const it of payload.items || []) bonusAmount += Number(it.bonusCommission) || 0;
  }
  return bonusAmount;
}
{
  // The server reads rows straight from the table (payload-shaped, already
  // filtered to voided=false), so present the same orders that way.
  const asRows = myOrders.filter((o) => !o.voided)
    .map((o) => ({ payload: { savedAt: o.savedAt, items: o.items } }));
  const shown = agent.monthEarnings('2026-07').bonus;
  const paid = serverClaimAmount(asRows, '2026-07');
  t.check(shown === paid,
    `the bonus shown on the claim button equals what the server would pay (shown ${shown}, server ${paid})`);
}

/* ---------- 5. the server's claim rule still looks like the mirror ----- */
/*
 * Guards check 4's transcription. If the server-side filter or summation
 * changes, the mirror above silently stops representing it and check 4
 * would keep passing while the two rules had actually diverged.
 */
{
  const m = /let bonusAmount = 0;([\s\S]*?)if \(!\(bonusAmount > 0\)\)/.exec(claimSrc);
  if (!m) {
    t.fail('could not find the claim summation in agent-claim-commission (has it been restructured?)');
  } else {
    const body = m[1];
    const has = (s) => body.includes(s);
    t.check(has('payload.savedAt') && has('.startsWith(month)') && has('Number(it.bonusCommission) || 0'),
      'the server still sums bonusCommission over that month\'s orders, as mirrored above');
  }
}
{
  // The voided exclusion is part of the query rather than the loop, and it
  // is what stops a cancelled order still paying a bonus.
  t.check(/\.eq\("voided",\s*false\)/.test(claimSrc),
    'the claim query still excludes voided orders');
  // Neither side filters on status, and they must agree about that: if the
  // server started paying only for completed orders, the button would keep
  // offering the larger figure.
  t.check(!/\.eq\("status"/.test(claimSrc),
    'the claim query still ignores order status, matching what the agent is shown');
}

/* ---------- 6. a claimed month can't be double-paid ------------------- */
{
  t.check(/if \(existing\) return json\(\{ ok: true, claim: existing \}\)/.test(claimSrc),
    'an already-claimed month returns the existing claim instead of inserting a second one');
  t.check(/month >= currentMonthKey\(\)/.test(claimSrc),
    'the current month cannot be claimed before it has ended');
}

process.exit(t.done() ? 1 : 0);
