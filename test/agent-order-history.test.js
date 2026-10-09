#!/usr/bin/env node
'use strict';
/*
 * Where an agent finds an order.
 *
 * There used to be an Order history screen: two segments and a flat list.
 * It is gone, merged into the places an order is actually looked for --
 * every live order is on Today, tile by tile, with the ones waiting on the
 * agent named under them; a client's orders are on that client's sheet;
 * a month's are on the Money sheet for that month. What it taught still
 * holds, and is pinned here:
 *
 * Two segments and a flat list. Completed only ever grows, and scrolling
 * was the only way to reach last month's order for a particular client.
 * Every row repeated the full date including the year. And Ongoing mixed
 * the two states waiting on the AGENT -- an unpaid prepay order, and stock
 * standing ready to be collected -- in among the two waiting on the shop,
 * so the ones needing action were the hardest to pick out.
 *
 * The bug underneath it: rows displayed and sorted on payload.savedAt,
 * which is rewritten on every save. An order placed in June but touched in
 * July showed as July here while Earnings still counted it in June --
 * mapOrderRow already says as much about `date` versus `savedAt`, and
 * earnings and the claim both key on `date` for exactly this reason.
 *
 * Run: node test/agent-order-history.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent order history');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. when an order actually happened ---------------------- */
{
  let f = null;
  try { ({ orderDate: f } = compileScope([extractFunction(src, 'orderDate', 'agent.html')], {}, ['orderDate'])); }
  catch (e) { /* reported below */ }
  t.check(typeof f === 'function', 'orderDate compiles');
  if (f) {
    t.check(f({ date: '2026-06-11', savedAt: '2026-07-30T09:00:00Z' }) === '2026-06-11',
      'the order keeps its own date even when it was saved again a month later -- the whole bug in one case');
    t.check(f({ date: null, savedAt: '2026-07-30T09:00:00Z' }) === '2026-07-30',
      'and falls back to savedAt when there is no date, rather than showing nothing');
    t.check(f({}) === null && f(null) === null, 'a row with neither does not throw');
  }
  // Scoped to the function. An identical sort lives in orderAgainItems, so
  // an unscoped match is satisfied by THAT one -- a mutation putting this
  // screen back on savedAt sailed straight past the first version.
  for (const name of ['openClientSheet', 'openMoneySheet']) {
    let render = '';
    try { render = extractFunction(src, name, 'agent.html'); } catch (e) { /* reported below */ }
    t.check(/String\(orderDate\(b\)\|\|''\)\.localeCompare\(String\(orderDate\(a\)\|\|''\)\)/.test(render),
      `${name} lists orders newest first by the order's own date`);
    t.check(render.length > 0 && !/savedAt/.test(render), `and reads savedAt nowhere`);
  }

  // Swept, not listed. The same substitution was needed in six places and
  // the ones that mattered most were not on this screen at all: the reorder
  // cadence behind "usually reorders every ~14 days", the selling streak,
  // the 30-day completion rate, the recent-clients list and the client
  // stats. Editing an old order moved it to today in every one of them.
  //
  // Matched on any receiver rather than `o` alone -- the first version
  // checked `o.savedAt` and so could not see a sort written over `(a,b)`.
  // orderDate's own body is the one legitimate reader for an order; the
  // `cached` and `payload` savedAt are a different thing entirely (when the
  // offline snapshot was written, and the raw row it was mapped from).
  //
  // extractFunction hands back the text as it sits in the file, CRLF and
  // all, while `code` above has been normalised to LF. So on any working
  // copy checked out with CRLF -- which is every fresh clone on Windows --
  // this replace() matched nothing, leaving orderDate's own fallback in the
  // swept text and reporting it as a violation. It passed when written only
  // because this file happened to be LF at that moment; a `git revert`
  // rewriting the file was enough to flip it.
  const lf = (s) => s.split(/\r?\n/).join('\n');
  const outsideHelper = code.replace(lf(extractFunction(src, 'orderDate', 'agent.html')), '');
  const readers = [...outsideHelper.matchAll(/\b([A-Za-z_]\w*)\.savedAt\b/g)]
    .map(m => m[1]).filter(n => !/^(cached|payload)$/.test(n));
  t.check(readers.length === 0,
    `nothing outside orderDate() decides WHEN an order happened from savedAt (${readers.length ? [...new Set(readers)].map(n => n + '.savedAt').join(', ') : 'none left'})`);
  t.check(/o\.savedAt \? String\(o\.savedAt\)\.slice\(0,10\) : null/.test(code),
    'and inside it, savedAt is still the fallback for an order with no date');
  // The field itself stays -- it is still the honest answer to "when was
  // this record last written", which is what the offline snapshot uses it
  // for. Only the date questions moved.
  t.check(/savedAt: payload\.savedAt \|\| null,/.test(code), 'the field is still mapped');
  t.check(/cached\.savedAt/.test(code), 'and still used for when the offline snapshot was written');
}

/* ---------- 2. what needs the agent, by their own terms --------------- */
{
  const stageFor = (term) => compileScope(['const orderStaffNames = new Map();',
    ...['agentOrderTerms', 'orderShopChecked', 'staffName', 'orderOwedAmount', 'orderStage'].map((n) => extractFunction(src, n, 'agent.html'))],
    { myAgent: { paymentTerm: term }, fmtNum: (n) => String(n) }, ['orderStage', 'agentOrderTerms']);
  let pre = null, pod = null;
  try { pre = stageFor('prepay'); pod = stageFor('pay_on_delivery'); } catch (e) { /* reported below */ }
  t.check(!!pre && !!pod, 'orderStage compiles for both settlement terms');
  if (pre && pod) {
    const o = (over) => Object.assign({ status: 'draft', voided: false, deliveryMode: 'agent_pickup', agentPaymentStatus: 'unpaid', amountPaid: 0,
      items: [{ productId: 'P', variantIdx: null, qty: 2, sellPrice: 100 }] }, over);
    const checked = (over) => { const x = o(over); x.shopConfirmedAt = 1; x.shopConfirmedTerms = pre.agentOrderTerms(x); return x; };
    t.check(pre.orderStage(checked({})).needs === 'pay',
      'a checked prepay draft needs the agent -- nothing moves until they pay');
    t.check(!pod.orderStage(checked({})).needs,
      'a pay-on-delivery agent is never asked to pay a draft');
    t.check(pod.orderStage(o({ status: 'completed' })).needs === 'pay' && pod.orderStage(o({ status: 'completed' })).key === 'settle',
      'they settle once it is delivered, and that is when it waits on them');
    t.check(!pod.orderStage(o({ status: 'completed', amountPaid: 200 })).needs,
      'and a delivered order already paid for waits on nobody');
    t.check(!pre.orderStage(o({ status: 'preparing', agentPaymentStatus: 'paid' })).needs,
      'one the shop is preparing needs nothing from them');
  }
}

/* ---------- 3. every live order is on Today ------------------------ */
{
  const move = extractFunction(src, 'renderMove', 'agent.html');
  t.check(/const live = liveOrders\(\);/.test(move) && /\$\{live\.length\} live/.test(move),
    'Today counts every order still moving');
  t.check(/MOVE_GROUPS\.map/.test(move) && /x\.st\.group === g/.test(move),
    'and sorts them into Sent, Packing and Out by the same orderStage the track reads');
  const live = extractFunction(src, 'liveOrders', 'agent.html');
  /* And not cancelled by the agent either: an order they called off is
     waiting only for the shop to close it, which is not moving. */
  t.check(/!o\.voided && !o\.agentCancel && o\.status !== 'completed'/.test(live), 'a live order is any not voided, not cancelled by the agent, and not finished');
  t.check(/if\(key !== 'needs'\)\{ openStageSheet\(key\); return; \}/.test(code),
    'every stage tile opens its own page -- the orders in it and where each one is -- even with only one in it');
}

/* ---------- 4. finding an older order ------------------------------- */
{
  // An agent remembers who an order was for far more often than when it
  // was -- so the way to an old order is the client.
  const sheet = extractFunction(src, 'openClientSheet', 'agent.html');
  t.check(/data-track="\$\{esc\(o\.id\)\}"/.test(sheet), 'a client\'s orders are on their sheet, each opening its track');
  const money = extractFunction(src, 'openMoneySheet', 'agent.html');
  t.check(/data-track="\$\{esc\(o\.id\)\}"/.test(money), 'and a month\'s are on the Money sheet for that month');
}

process.exit(t.done() ? 1 : 0);
