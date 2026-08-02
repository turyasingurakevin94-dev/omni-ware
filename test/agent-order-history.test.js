#!/usr/bin/env node
'use strict';
/*
 * The agent Order history screen.
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
  let render = '';
  try { render = extractFunction(src, 'renderOrderHistoryScreen', 'agent.html'); } catch (e) { /* reported below */ }
  t.check(render.length > 0, 'renderOrderHistoryScreen is found');
  t.check(/String\(orderDate\(b\)\|\|''\)\.localeCompare\(String\(orderDate\(a\)\|\|''\)\)/.test(render),
    'it sorts on the same field it groups by, or the groups would interleave');
  t.check(!/savedAt/.test(render), 'and reads savedAt nowhere');

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

/* ---------- 2. Ongoing separates what needs the agent --------------- */
{
  let f = null;
  try {
    ({ orderNeedsAgent: f } = compileScope(
      [extractFunction(src, 'orderNeedsAgent', 'agent.html')],
      { myAgent: { paymentTerm: 'prepay' } }, ['orderNeedsAgent'],
    ));
  } catch (e) { /* reported below */ }
  t.check(typeof f === 'function', 'orderNeedsAgent compiles');
  if (f) {
    t.check(f({ status: 'draft', agentPaymentStatus: 'unpaid' }) === true,
      'an unpaid prepay order needs the agent -- nothing moves until they pay');
    t.check(f({ status: 'draft', agentPaymentStatus: 'paid' }) === false,
      'once paid it does not');
    t.check(f({ status: 'pending_delivery', deliveryMode: 'agent_pickup' }) === true,
      'and stock standing ready to collect needs them to go and get it');
    t.check(f({ status: 'pending_delivery', deliveryMode: 'shop_delivery' }) === false,
      'while an order being delivered to the client needs nothing from them');
    t.check(f({ status: 'preparing' }) === false, 'nor does one the shop is still preparing');
  }

  // A pay_on_delivery agent has no unpaid-draft state at all.
  let g = null;
  try {
    ({ orderNeedsAgent: g } = compileScope(
      [extractFunction(src, 'orderNeedsAgent', 'agent.html')],
      { myAgent: { paymentTerm: 'pay_on_delivery' } }, ['orderNeedsAgent'],
    ));
  } catch (e) { /* reported below */ }
  if (g) {
    t.check(g({ status: 'draft', agentPaymentStatus: 'unpaid' }) === false,
      'a pay-on-delivery agent is never asked to pay a draft, so it never lands in Needs you');
  }

  t.check(/orderNeedsAgent\(o\) \? 'Needs you' : 'With the shop'/.test(code),
    'which is what splits the Ongoing list');
  t.check(/keys\.sort\(\(a,b\)=> \(a==='Needs you'\?0:1\) - \(b==='Needs you'\?0:1\)\)/.test(code),
    'and Needs you comes first whatever the dates say');
}

/* ---------- 3. Completed groups by period --------------------------- */
{
  let f = null;
  try {
    ({ orderPeriodLabel: f } = compileScope(
      [extractFunction(src, 'orderDate', 'agent.html'), extractFunction(src, 'orderPeriodLabel', 'agent.html')],
      {}, ['orderPeriodLabel'],
    ));
  } catch (e) { /* reported below */ }
  t.check(typeof f === 'function', 'orderPeriodLabel compiles');
  if (f) {
    const at = (days) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days);
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
    };
    t.check(f(at(0)) === 'Today', 'today says so');
    t.check(f(at(1)) === 'Yesterday', 'and yesterday');
    t.check(f(at(3)) === 'Earlier this week', 'a few days back is still this week');
    t.check(f(at(200)).length > 0 && !/^(Today|Yesterday|Earlier)/.test(f(at(200))),
      'and anything older falls back to a month');
    t.check(/\d{4}/.test(f(at(400))), 'a month in a previous year carries the year');
    t.check(!/\d{4}/.test(f(at(40))) || new Date().getMonth() < 2,
      'while one in this year does not, so "March" need not be read as "March of some year"');
    t.check(f({}) === 'Undated' && f({ date: 'not a date' }) === 'Undated',
      'an unparseable date is labelled, not rendered as Invalid Date');
  }
}

/* ---------- 4. you can find an order ------------------------------- */
{
  t.check(/id="ag_orderSearch"/.test(src), 'the screen has a search field');
  t.check(/function orderMatchesQuery\(o, q\)/.test(code), 'with a matcher');
  t.check(/\[client \? client\.name : '', \.\.\.\(o\.items\|\|\[\]\)\.map\(it=>it\.productName\|\|''\)\]/.test(code),
    'searching the client name AND the product names -- an agent remembers one or the other, rarely both');
  t.check(/document\.getElementById\('ag_orderSearch'\)\.addEventListener\('input', renderOrderHistoryScreen\)/.test(code),
    'it filters as you type');

  // Counts describe the segment, not the filtered view.
  t.check(/live\.filter\(o=>o\.status!=='completed'\)\.length \|\| ''/.test(code)
    && /live\.filter\(o=>o\.status==='completed'\)\.length \|\| ''/.test(code),
    'the tab counts come off the whole segment -- "Completed 2" during a search would be a lie about how many exist');

  t.check(/No \$\{esc\(orderHistorySegment\)\} orders match/.test(code),
    'and a search with no hits says what it searched for');
}

/* ---------- 5. arriving at the screen ------------------------------- */
{
  t.check(/document\.getElementById\('ag_orderSearch'\)\.value = '';\s*orderHistorySegment = 'ongoing';/.test(code),
    'opening the screen clears the query and returns to Ongoing');
  t.check(/b\.classList\.toggle\('active', b\.dataset\.seg === 'ongoing'\)/.test(code),
    'with the tab highlight following, so the buttons cannot disagree with the list');
}

/* ---------- 6. the group heading is one text node too --------------- */
/*
 * The heading is a flex row with a gap, label beside count. Without a real
 * space it reads "Needs you3" to a screen reader and to a copy-paste --
 * the same fault flex-gap-spacing.test.js was written for, which caught
 * this one on the way in.
 */
{
  t.check(/>\$\{esc\(k\)\} <span class="ag-hist-group-n">/.test(code),
    'the group heading separates its label from its count with a real space');
  t.check(/>Ongoing <span class="ag-seg-count"/.test(src) && /># <span class="ag-seg-count"/.test(src) === false,
    'and so does the Ongoing tab');
  t.check(/>Completed <span class="ag-seg-count"/.test(src), 'and the Completed tab');
}

process.exit(t.done() ? 1 : 0);
