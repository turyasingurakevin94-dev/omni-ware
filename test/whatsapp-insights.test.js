#!/usr/bin/env node
'use strict';
/*
 * WhatsApp: the intelligence strip.
 *
 * The header the whole page answers to -- unread, open windows,
 * WhatsApp sales, how much of the talking the system does, median time
 * to answer, the broadcast audience. Every number DERIVED at render
 * time from records the system already keeps, because a stored
 * statistic is a second copy of a fact and second copies drift (fifth
 * appearance of the rule). And every number honest about absence:
 * no replies yet is a median of NOTHING, not a median of zero.
 *
 * Run: node test/whatsapp-insights.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp insights');
const src = read('index.html');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const NAMES = ['waMedian', 'waInsightStats', 'waFmtMins'];
let scope = null; let err = null;
try {
  scope = compileScope([
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
    extractFunction(src, 'waConvUnread', 'index.html'),
    extractFunction(src, 'waWindowInfo', 'index.html'),
  ], { WA_WINDOW_MS: 24 * 60 * 60 * 1000 }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the insight helpers compile${err ? ` (${err.message})` : ''}`);
if (!scope) process.exit(1);

const NOW = Date.parse('2026-08-06T12:00:00Z');

/* ---------- 1. the middle, honestly ---------------------------------- */
{
  eq(scope.waMedian([5]), 5, 'one value is its own median');
  eq(scope.waMedian([9, 1, 5]), 5, 'odd count: the middle, after sorting');
  eq(scope.waMedian([1, 2, 8, 100]), 5, 'even count: the mean of the two middles');
  eq(scope.waMedian([]), null, 'no values is NO median, not zero');
}

/* ---------- 2. the strip's numbers ----------------------------------- */
{
  const convs = [
    // unread, window open (inbound 2h ago, never read)
    { id: 1, last_inbound_at: '2026-08-06T10:00:00Z', last_read_at: null, opt_out: false },
    // read, window closed (inbound 3 days ago)
    { id: 2, last_inbound_at: '2026-08-03T10:00:00Z', last_read_at: '2026-08-03T11:00:00Z', opt_out: false },
    // opted out, window open
    { id: 3, last_inbound_at: '2026-08-06T09:00:00Z', last_read_at: '2026-08-06T09:30:00Z', opt_out: true },
  ];
  const msgs = [
    // conv 1: question at 10:00 answered by the SYSTEM at 10:04 (4 min)
    { conversation_id: 1, direction: 'in', sent_at: '2026-08-06T10:00:00Z', payload: null },
    { conversation_id: 1, direction: 'out', sent_at: '2026-08-06T10:04:00Z', payload: { auto: true } },
    // conv 2: a two-message run answered ONCE by a human, 30 min from the FIRST ask
    { conversation_id: 2, direction: 'in', sent_at: '2026-08-03T10:00:00Z', payload: null },
    { conversation_id: 2, direction: 'in', sent_at: '2026-08-03T10:10:00Z', payload: null },
    { conversation_id: 2, direction: 'out', sent_at: '2026-08-03T10:30:00Z', payload: null },
    // conv 3: an unanswered question -- no delta, not a delta of zero
    { conversation_id: 3, direction: 'in', sent_at: '2026-08-06T09:00:00Z', payload: null },
  ];
  const quotes = [
    { originWa: true, voided: false, date: '2026-08-06',
      items: [{ qty: 3, sellPrice: 203000 }] },                       // this month: 609,000
    { originWa: true, voided: false, date: '2026-07-15',
      items: [{ qty: 1, sellPrice: 100000 }] },                       // last month
    { originWa: true, voided: true, date: '2026-08-05',
      items: [{ qty: 9, sellPrice: 999999 }] },                       // voided: not a sale
    { originWa: false, voided: false, date: '2026-08-06',
      items: [{ qty: 5, sellPrice: 50000 }] },                        // walk-in: not WhatsApp's
  ];
  const st = scope.waInsightStats(convs, msgs, quotes, NOW);

  eq(st.unread, 1, 'one conversation waits unread');
  eq(st.openWindows, 2, 'two windows are open right now — free replies on the table');
  eq(st.audience, 2, 'the broadcast audience excludes the opted-out');
  eq(st.optOuts, 1, 'and counts them honestly');

  eq(st.orders, 2, 'WhatsApp orders: origin-marked, unvoided, nothing else');
  eq(st.revenue, 709000, 'revenue at the prices the carts promised');
  eq(st.monthOrders, 1, 'this month: one');
  eq(st.monthRevenue, 609000, 'at this month\'s money');

  eq(st.autoShare, 0.5, 'the system carried half the talking');
  eq(st.autoCount, 1, 'one automatic reply');
  eq(st.outboundCount, 2, 'of two replies total');

  /* deltas: 4 min (conv 1) and 30 min (conv 2, from the FIRST message
     of the run); conv 3's unanswered question contributes NOTHING. */
  eq(st.medianReplyMins, 17, 'median time-to-answer, from the first ask of each run');
}

/* ---------- 3. absence is not zero ----------------------------------- */
{
  const st = scope.waInsightStats([], [], [], NOW);
  eq(st.autoShare, null, 'no replies yet is NOT "0% automated" — it is unknown');
  eq(st.medianReplyMins, null, 'and no answered questions is no median');
  eq(scope.waFmtMins(null), '—', 'which the strip shows as a dash, not a number');
  eq(scope.waFmtMins(0.4), '<1 min', 'under a minute says so');
  eq(scope.waFmtMins(17), '17 min', 'minutes read as minutes');
  eq(scope.waFmtMins(90), '1.5 h', 'and hours as hours');
}

/* ---------- 4. the strip is REACHED, the rooms switch ---------------- */
{
  t.check(/if\(tab==='whatsapp'\)\{ renderWhatsApp\(\); renderWaInsights\(\); waInboxEnter\(\); \}/.test(src),
    'entering the tab renders the strip immediately, before the fetches land');
  t.check(/waFetchInsightMsgs\(\);/.test(src) && /order\('sent_at', \{ ascending: false \}\)\.limit\(500\)/.test(src),
    'one aggregate read feeds the strip — the per-thread fetches only know the open thread');
  const entry = (/async function waInboxEnter\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/await waFetchInsightMsgs\(\);/.test(entry) && /renderWaInsights\(\);/.test(entry),
    'and the strip re-renders once real data arrives');
  t.check(/data-waview="inbox"/.test(src) && /data-waview="post"/.test(src) && /data-waview="broadcast"/.test(src),
    'three rooms: inbox, today\'s post, broadcasts');
  const setView = extractFunction(src, 'waSetView', 'index.html');
  t.check(/wa_pane_inbox'\)\.style\.display = v==='inbox' \? '' : 'none';/.test(setView)
    && /wa_pane_post'\)\.style\.display = v==='post' \? '' : 'none';/.test(setView)
    && /wa_pane_bc'\)\.style\.display = v==='broadcast' \? '' : 'none';/.test(setView),
    'switching a room shows exactly one pane and hides the others');
  t.check(/badge\.style\.display = st\.unread \? '' : 'none';/.test(src),
    'the inbox tab wears the unread count only when there is one');
  t.check(/waInsightStats\(waInbox\.convs, waInbox\.allMsgs, data\.savedQuotes, Date\.now\(\)\)/.test(src),
    'the strip is computed from live records at render time — derived, never stored');
}

process.exit(t.done() ? 1 : 0);
