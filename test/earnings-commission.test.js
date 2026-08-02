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
 * Voided orders and other months are excluded, and the two figures qualify
 * DIFFERENTLY, which this used to get wrong:
 *
 *   margin -- the agent's own money, collected straight from their client
 *             and never touching the shop's books. An order still out for
 *             delivery counts; their customer owes them either way.
 *
 *   bonus  -- the SHOP's money, paid out on a claim, and only owed on a
 *             sale that completed. Counting it earlier made the claim
 *             button offer a figure agent-claim-commission would decline
 *             to pay.
 *
 * Both keyed on the order's own date. payload.savedAt is rewritten by every
 * save, so it moved orders between months -- and since a claim is a fixed
 * snapshot, a month already claimed would pay again from the new month.
 */
setOrders([
  { date: '2026-07-04', savedAt: '2026-07-04T10:00:00Z', voided: false, status: 'completed', items: [item(1200, 1000, 1, 100)] },
  { date: '2026-07-20', savedAt: '2026-07-20T10:00:00Z', voided: false, status: 'draft',     items: [item(1200, 1000, 1, 200)] },
  { date: '2026-07-28', savedAt: '2026-07-28T10:00:00Z', voided: true,  status: 'completed', items: [item(9999, 1000, 9, 9999)] }, // voided
  { date: '2026-06-30', savedAt: '2026-06-30T10:00:00Z', voided: false, status: 'completed', items: [item(1200, 1000, 1, 400)] }, // prior month
  { date: '2026-08-01', savedAt: '2026-08-01T10:00:00Z', voided: false, status: 'completed', items: [item(1200, 1000, 1, 800)] }, // next month
  { date: null, savedAt: null,                   voided: false, status: 'completed', items: [item(1200, 1000, 1, 1600)] }, // undated
]);
{
  const july = agent.monthEarnings('2026-07');
  // 100 from the completed order only. The July draft carries 200 of bonus
  // and contributes none of it — that is the whole point.
  t.check(july.bonus === 100, `month bonus counts only completed orders (got ${july.bonus}, expected 100)`);
  // 200 + 200: margin from BOTH July orders, the draft included.
  t.check(july.margin === 400, `month margin counts every unvoided order for the month (got ${july.margin}, expected 400)`);
  t.check(july.orders.length === 2, `month order list matches (got ${july.orders.length}, expected 2)`);
  t.check(agent.monthEarnings('2026-09').total === 0, 'a month with no orders earns nothing');
  // An order dated July but re-saved in August stays July's. Run on its own
  // fixture, then the shared one is put back for the checks below.
  const shared = myOrders.slice();
  setOrders([{ date: '2026-07-04', savedAt: '2026-08-15T10:00:00Z', voided: false, status: 'completed', items: [item(1200, 1000, 1, 100)] }]);
  t.check(agent.monthEarnings('2026-07').bonus === 100 && agent.monthEarnings('2026-08').bonus === 0,
    'a July order re-saved in August is still July\'s, so it cannot be claimed twice');
  setOrders(shared);
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
    if (!row.date || !String(row.date).startsWith(month)) continue;
    for (const it of payload.items || []) bonusAmount += Number(it.bonusCommission) || 0;
  }
  return bonusAmount;
}
{
  // The server reads rows straight from the table, already filtered by the
  // query to voided=false AND status=completed, so present the same set.
  const asRows = myOrders.filter((o) => !o.voided && o.status === 'completed')
    .map((o) => ({ date: o.date, payload: { items: o.items } }));
  const shown = agent.monthEarnings('2026-07').bonus;
  const paid = serverClaimAmount(asRows, '2026-07');
  t.check(shown === paid,
    `the bonus shown on the claim button equals what the server would pay (shown ${shown}, server ${paid})`);
}
{
  // The property behind that equality, stated directly: an order that has
  // not completed contributes nothing to the claimable bonus, however much
  // bonus its items carry. This is what the claim query's status filter
  // buys, and the agent screen has to agree or the button overstates.
  const draftOnly = myOrders.filter((o) => !o.voided && o.status !== 'completed');
  const carried = draftOnly.reduce((s, o) =>
    s + (o.items || []).reduce((n, it) => n + (Number(it.bonusCommission) || 0), 0), 0);
  t.check(draftOnly.length > 0 && carried > 0,
    `the fixture has unfinished orders carrying bonus to test with (${draftOnly.length} orders, ${carried} bonus)`);
  const shownForThose = draftOnly.reduce((s, o) => s + agent.orderEarnings(o).bonus, 0);
  t.check(shownForThose === carried,
    'orderEarnings still reports what those orders would be worth');
  t.check(agent.monthEarnings('2026-07').bonus === serverClaimAmount(
    myOrders.filter((o) => !o.voided && o.status === 'completed').map((o) => ({ date: o.date, payload: { items: o.items } })), '2026-07'),
    'but the month total counts none of it, because the shop only owes bonus on a completed sale');
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
    // Comments stripped: the loop carries a note about why payload.savedAt
    // was abandoned, and matching that would report the old basis still in
    // use in the very place it was removed from.
    const body = m[1].split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
    const has = (s) => body.includes(s);
    t.check(has('row.date') && has('.startsWith(month)') && has('Number(it.bonusCommission) || 0'),
      'the server still sums bonusCommission over that month\'s orders, as mirrored above');
    t.check(!has('payload.savedAt'),
      'and no longer keys the month on a timestamp that every save rewrites');
  }
}
{
  // The voided exclusion is part of the query rather than the loop, and it
  // is what stops a cancelled order still paying a bonus.
  t.check(/\.eq\("voided",\s*false\)/.test(claimSrc),
    'the claim query still excludes voided orders');
  // This previously asserted the OPPOSITE -- that neither side filtered on
  // status -- on the reasoning that the two agreed and so were consistent.
  // They were consistent and both wrong: agent-submit-order creates orders
  // at 'draft', so a bonus was claimable on an order that was submitted and
  // never prepared, delivered or paid for. The fix moved both sides to
  // completed-only rather than leaving them agreeing on the wrong rule.
  t.check(/\.eq\("status", "completed"\)/.test(claimSrc),
    'the claim query pays only for completed orders');
  t.check(/o\.status === 'completed'/.test(agentSrc),
    'and the agent screen only counts bonus on those, so the button cannot overstate what will be paid');
}

/* ---------- 6. a claimed month can't be double-paid ------------------- */
{
  t.check(/if \(existing\) return json\(\{ ok: true, claim: existing \}\)/.test(claimSrc),
    'an already-claimed month returns the existing claim instead of inserting a second one');
  t.check(/month >= currentMonthKey\(\)/.test(claimSrc),
    'the current month cannot be claimed before it has ended');
}

process.exit(t.done() ? 1 : 0);
