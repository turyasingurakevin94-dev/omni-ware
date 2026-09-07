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
    /* The strip's headline figure is now WHO IS WAITING rather than who
       is unread, so the stats lean on the queue's own definition. */
    extractFunction(src, 'waWaitingConvs', 'index.html'),
    extractFunction(src, 'waConvTitle', 'index.html'),
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

/* ---------- 4. the strip is REACHED, and the rooms are gone ----------

   THREE ROOMS BEHIND A TAB STRIP is what this section used to hold:
   Inbox, Today's post, Broadcasts, each a pane, switched by waSetView.
   That strip was a THIRD level of navigation under the rail and the
   page header, and two of its three rooms answered one question each
   -- has today's post gone out; who can we broadcast to and what did
   the last one cost. Questions that size are rail panels, not rooms.
   So the tab strip is gone, the panes are gone with it, and this
   section now pins that the two demoted rooms are still DRAWN and
   still reachable, which is the thing that would actually be lost. */
{
  t.check(/if\(tab==='whatsapp'\)\{ waInboxEnter\(\); \}/.test(src),
    'entering the tab starts the desk');
  t.check(/waFetchInsightMsgs\(\);/.test(src) && /order\('sent_at', \{ ascending: false \}\)\.limit\(500\)/.test(src),
    'one aggregate read feeds the strip — the per-thread fetches only know the open thread');
  const entry = (/async function waInboxEnter\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/await waFetchInsightMsgs\(\);/.test(entry) && /renderWaInsights\(\);/.test(entry),
    'and the strip renders once real data arrives');
  t.check(/renderWhatsApp\(\);/.test(entry) && /waRenderChannel\(\);/.test(entry)
    && /waRenderBroadcasts\(\);/.test(entry),
    'the daily post and broadcasts are still drawn — as rail panels, not as rooms');
  t.check(!/data-waview|wa_pane_inbox|wa_pane_post|wa_pane_bc|function waSetView/.test(src),
    'and the tab strip that made them rooms is gone, panes and switcher with it');

  /* The unread badge moved to the rail, where it is one of many and
     reads against the other screens competing for the same attention.
     A badge on a tab inside the screen you are already looking at was
     telling you something you could already see. */
  t.check(/refreshNavBadges\(\);/.test(src.slice(src.indexOf('function renderWaInsights'),
    src.indexOf('function waRenderHeadline'))),
    'and the count the tab badge carried now rides the rail, where it competes with the other screens');

  /* The post outcomes are HANDED IN rather than read off `data` inside
     the function, so the strip's fifth tile leans on exactly the same
     measure of lift the picker ranks on -- one definition in the file,
     not two -- while waInsightStats stays a function of its arguments
     and can still be compiled alone by this suite. */
  t.check(/waInsightStats\(waInbox\.convs, waInbox\.allMsgs, data\.savedQuotes, now,\s*\n\s*waPostOutcomes\(data\.waPosts, data\.savedQuotes, todayISO\(\)\)\)/.test(src),
    'the strip is computed from live records at render time — derived, never stored');

  /* THE FIGURES THEMSELVES CHANGED, and the two that went are worth
     naming. "Answered by the system: 100%" read as a score for a
     number that is the share of replies the shop did NOT write; it is
     "2 of 4" now, which cannot be mistaken for a grade. And "WhatsApp
     sales this month: —" over "0 orders all time · 0 UGX" was three
     ways of saying nothing; it is a figure with one honest sentence
     under it. The tile that replaced them is the one the screen exists
     for: how long the person waiting longest has waited. */
  const strip = (/function renderWaInsights\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/tile\('Waiting for an answer', String\(st\.waitingCount\)/.test(strip)
    && /longest \$\{esc\(waFmtWait\(st\.longestWaitMins\)\)\} · \$\{esc\(st\.longestWaitName\)\}/.test(strip),
    'the strip leads with who is waiting and how long the worst of them has waited');
  t.check(/st\.waitingCount \? 'ow-warn' : ''/.test(strip),
    'and it is amber only when somebody actually is');
  /* THE FIFTH TILE CHANGED HANDS, and the argument is worth keeping.
     "Answered by the system" is a TRUST fact -- how much of the talking
     a machine does in the shop's name -- and it survives in two places
     that are closer to it than a strip: an amber chip on every queue
     row it applies to, and the Answered panel's own header ("6 by you,
     3 by the system"). What took the slot is the thing this screen now
     exists to argue, and the thing the picker was missing entirely: a
     post record that says whether posting moves stock at all.

     It is UNITS, deliberately, not money. Money would need the caveat
     chain that lives under the learning panel, and a strip sub is no
     place for it -- so the tile reports what was counted and says the
     span it was counted over. */
  t.check(/tile\('Moved after posting'/.test(strip)
    && /st\.postLift/.test(strip) && /st\.postRipe/.test(strip),
    'the fifth tile is what posting moved, counted the week after each post');
  t.check(/no post has a week of trading behind it yet/.test(strip),
    'and it says so plainly rather than showing a zero, when nothing is ripe');
  t.check(!/100%|autoShare\*100/.test(strip),
    'the percentage that read as a score is gone, not merely relabelled');
  /* Gone from the strip, still on the screen. */
  t.check(/class="ow-cp wa-cp-auto">Answered by the system/.test(src)
    && /by you, \$\{autoN\} by the system/.test(src),
    'and the system\'s share survives on the rows and in the Answered panel it describes');
}

process.exit(t.done() ? 1 : 0);
