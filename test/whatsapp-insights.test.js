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

/* ---------- 4. the rooms are gone, and so is the page ----------

   THREE ROOMS BEHIND A TAB STRIP is what this section once held:
   Inbox, Today's post, Broadcasts, each a pane, switched by waSetView.
   They became rail panels on one WhatsApp page, and that page has now
   gone the same way: it is the Chats view of Messages. Most of it was
   Messages said twice -- who is waiting and who wrote back are lanes
   there, today's post is its To post lane -- so what this section pins
   is that the rest is still DRAWN and still REACHED, and that the chats
   are fetched by the screen that reads them, which is the thing that
   would actually be lost.

   THE FIVE-FIGURE STRIP WENT WITH THE PAGE. It was argued for here at
   length; what it read has homes that do not need it. Who is waiting
   and how long is the Chats segment's count and the Waiting on you
   lane; what posting moved is To post's "What posts brought"; the
   system's share of the talking is still on every row it applies to
   and in the Answered panel's header. */
{
  t.check(/if\(tab==='followups'\)\{ renderFollowUps\(\); waInboxEnter\(\); \}/.test(src),
    'entering Messages starts the desk -- its lanes read the chats, and nothing else fetches them');
  t.check(/waFetchInsightMsgs\(\);/.test(src) && /order\('sent_at', \{ ascending: false \}\)\.limit\(500\)/.test(src),
    'one aggregate read feeds the lanes and the queue — the per-thread fetches only know the open thread');
  const entry = (/async function waInboxEnter\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/await waFetchInsightMsgs\(\);/.test(entry) && /renderFollowUps\(\);/.test(entry),
    'and Messages draws again once real data arrives, so its lanes are not left empty');
  t.check(/await waPublishQuotePack\(\);/.test(entry),
    'and the list the server answers from is republished whenever Messages is opened');
  const chats = (/function waRenderChats\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/waRenderInbox\(\);/.test(chats) && /waRenderAnswering\(\);/.test(chats)
    && /waRenderWords\(\);/.test(chats) && /waRenderChannel\(\);/.test(chats)
    && /waRenderBroadcasts\(\);/.test(chats),
    'the queue and the four panels that govern the number are still drawn — on Chats');
  t.check(/waRenderConnect\(\);/.test(chats),
    'and before the number is linked, Chats is the connection and nothing else');
  t.check(!/data-waview|wa_pane_inbox|wa_pane_post|wa_pane_bc|function waSetView/.test(src),
    'and the tab strip that made them rooms is gone, panes and switcher with it');
  t.check(!/id="wa_strip"/.test(src) && !/function renderWaInsights/.test(src),
    'the strip is gone rather than left drawing into nothing');
  t.check(/waWaitingConvs\(waInbox\.convs, waInbox\.allMsgs, Date\.now\(\)\)\.length/.test(
      (/function waRenderChatsCount\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0]),
    'and who is waiting is counted on the Chats segment by the same reading as the queue');
  t.check(!/100%|autoShare\*100/.test(src.slice(src.indexOf('function waRenderAnswered'), src.indexOf('function waRenderAnswered') + 4000)),
    'the percentage that read as a score has not come back');
  t.check(/class="ow-cp wa-cp-auto">Answered by the system/.test(src)
    && /by you, \$\{autoN\} by the system/.test(src),
    'and the system\'s share survives on the rows and in the Answered panel it describes');
}

process.exit(t.done() ? 1 : 0);
