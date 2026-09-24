#!/usr/bin/env node
'use strict';
/*
 * Pace: the scoreboard watches itself between meetings.
 *
 * A target was only ever looked at when a meeting was held, so a week
 * could be half gone with a third of the aim collected and nothing
 * anywhere said so. Progress alone says "900,000 of 3,000,000". Pace
 * says "900,000 where 1,300,000 would be level, with 3 days left" --
 * the difference between a warning and a verdict.
 *
 * Three things this file exists to hold:
 *
 *   AGAINST THE CALENDAR  expected is measured for the DAYS ELAPSED. A
 *       version that compares against the whole period is progress
 *       wearing pace's name, and would call every target behind on day
 *       one and none of them behind on day six.
 *   IN THE METRIC'S OWN DIRECTION  a debt target is on course when it
 *       is at or BELOW the line. Getting this backwards congratulates a
 *       shop for owing more.
 *   PACE OUTLIVES THE MEETING  the dashboard row must survive today's
 *       meeting being held -- that is exactly when it matters, and the
 *       card used to empty its whole slot.
 *
 * "At this rate" is the observed rate carried to the end of the period:
 * arithmetic on the past, which this app allows and labels, never a
 * forecast.
 *
 * Run: node test/manager-pace.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the target pace');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* Monday 24th to Sunday 30th; today is Wednesday the 26th, so three of
   the seven days are gone. */
const TODAY = '2026-08-26';
const data = { customers: [{ id: 1, debt: 7100000 }] };
const env = {
  data,
  todayISO: () => TODAY, anShiftDate: shift,
  apRound: (n) => Math.round(Number(n) || 0),
  debtCollectionsOn: (d) => ({ total: d <= TODAY ? 300000 : 0 }),
  anInvoicesInRange: () => [{}], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0, estimatedQty: 0 }),
  dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0 }),
  cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
  Date, JSON, Math, Number, String, Array, Object,
};
const scope = compileScope([
  extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
  extractFunction(src, 'managerScoreProgress', 'index.html'),
  'function names(){ return { managerScoreProgress }; }',
], env, ['names']);
const { managerScoreProgress } = scope.names();

const row = (body) => ({ date: '2026-08-24', body: { from: '2026-08-24', to: '2026-08-30', ...body } });

/* ---------- 1. a flow, measured against the days elapsed ------------- */
{
  /* 24th, 25th, 26th collected 300,000 each = 900,000 of a 3,000,000 aim
     with three of seven days gone. Level would be 1,285,714. */
  const p = managerScoreProgress(row({ metric: 'collections', aim: 3000000, baseline: 0 })).pace;
  eq(p.elapsed_days, 3, 'three days of the week are gone');
  eq(p.total_days, 7, 'out of seven');
  eq(p.expected, 1285714, 'level today is the aim shared over the days elapsed, not the whole week');
  eq(p.on_course, false, 'so 900,000 is behind');
  eq(p.behind_by, 385714, 'by the distance to level, in shillings the owner can act on');
  eq(p.at_this_rate, 2100000,
    'and the observed rate carried to Sunday lands at 2,100,000 — arithmetic on the past, said as "at this rate"');
}

/* ---------- 2. ahead of the line ------------------------------------- */
{
  const p = managerScoreProgress(row({ metric: 'collections', aim: 1500000, baseline: 0 })).pace;
  t.check(p.on_course === true, 'a smaller aim on the same collections is on course');
  eq(p.behind_by, 0, 'nothing behind is nothing to report');
  eq(p.at_this_rate, 2100000, 'the projection is the same rate whatever the aim — it describes the shop, not the target');
}

/* ---------- 3. a level target travels from where it started ---------- */
{
  /* Owed 8,000,000 when taken on, aiming for 5,000,000; three days in,
     level is 8,000,000 - 3,000,000 * 3/7 = 6,714,286. It stands at
     7,100,000, so it is behind. */
  const p = managerScoreProgress(row({ metric: 'debtors_total', aim: 5000000, baseline: 8000000 })).pace;
  eq(p.expected, 6714286, 'level on a LEVEL target is the journey from the baseline, not a share of the aim');
  eq(p.on_course, false, 'above the line on a target aimed DOWN is behind');
  eq(p.behind_by, 385714, 'by the distance back to the line');
  eq(p.at_this_rate, 5900000, 'and the rate of reduction carried forward lands at 5,900,000');

  data.customers[0].debt = 6500000;
  const better = managerScoreProgress(row({ metric: 'debtors_total', aim: 5000000, baseline: 8000000 })).pace;
  t.check(better.on_course === true,
    'BELOW the line on a down target is on course — getting this backwards congratulates a shop for owing more');
  eq(better.behind_by, 0, 'and nothing is behind');
  data.customers[0].debt = 7100000;
}

/* ---------- 4. the edges ---------------------------------------------- */
{
  const done = managerScoreProgress({ date: '2026-08-10',
    body: { metric: 'collections', aim: 100000, baseline: 0, from: '2026-08-10', to: '2026-08-16' } });
  t.check(done.finished === true, 'a period that has ended is finished');
  eq(done.pace.elapsed_days, 7, 'its elapsed days stop at the end of the period, never past it');
  const same = managerScoreProgress({ date: TODAY,
    body: { metric: 'collections', aim: 700000, baseline: 0, from: TODAY, to: TODAY } });
  eq(same.pace.total_days, 1, 'a one-day period is one day, never zero — nothing here divides by nothing');
  eq(same.pace.expected, 700000, 'and its whole aim is due today');
  eq(managerScoreProgress({ body: { metric: 'collections', aim: 1 } }).pace, null,
    'a target with no period has no pace, rather than a fabricated one');
  eq(managerScoreProgress({ body: { metric: 'nonsense', aim: 1 } }), null, 'and an unmeasurable metric still scores nothing');
}

/* ---------- 5. pace outlives the meeting ------------------------------ */
{
  /* RENDER it, twice. Reading the source for the right shape let a
     mutation through that simply returned early and emptied the slot —
     every assertion still matched the code that never ran. */
  const drawCard = (heldOn, opts) => {
    const o = opts || {};
    const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    let paceCalls = 0, asked = 0, stamped = null;
    compileScope([extractFunction(src, 'renderManagerCard', 'index.html')], {
      document: { getElementById: (id) => (id === 'dash_managerCard' ? el : null) },
      lsGet: () => heldOn, lsSet: (k, v) => { stamped = v; }, todayISO: () => TODAY,
      MANAGER_MEETING_KEY: 'k', renderManagerPace: () => { paceCalls++; },
      managerNotesTable: o.table !== false,
      /* Answers in the caller's own turn -- the sb mock's trick, so the
         journal's correction can be asserted without making this block
         async and the assertions below reordering themselves. */
      managerHeldToday: () => { asked += 1; return { then: (res) => res(!!o.journal) }; },
      goToTab: () => {}, runManagerMeeting: () => {}, String,
    }, ['renderManagerCard']).renderManagerCard();
    return { html: el.innerHTML, paceCalls, asked, stamped };
  };

  const before = drawCard('2026-08-01');
  t.check(/mgr-invite/.test(before.html), 'with no meeting held today the invite is offered');

  const after = drawCard(TODAY);
  t.check(!/mgr-invite/.test(after.html), 'once today’s meeting is held the invite goes');
  eq(after.paceCalls, 1, 'and the pace is filled either way, held meeting or not');

  /* THE OTHER TABLET. The stamp is per device, so a meeting held on the
     owner's other tablet leaves it saying no while the journal says
     yes. The Manager screen has corrected for that since the stamp was
     introduced; the front door read the stamp and stopped, and offered
     to hold a meeting whose plan was sitting one tab away. */
  const elsewhere = drawCard('2026-08-01', { journal: true });
  eq(elsewhere.asked, 1, 'a stamp saying no is put to the journal');
  t.check(!/mgr-invite/.test(elsewhere.html),
    'and a meeting held on another device takes the invite away, as it does on the Manager screen');
  eq(elsewhere.stamped, TODAY, 'the stamp is brought up to date, so the next render costs no query');

  /* ONLY WHEN THE STAMP SAYS NO. A stamp reading today can only have
     been written by a meeting committed on this device today, so a yes
     needs no confirming -- and that is every dashboard render for the
     rest of the day. */
  eq(drawCard(TODAY, { journal: true }).asked, 0,
    'a stamp saying yes is believed, and costs no query');
  eq(drawCard('2026-08-01', { table: false }).asked, 0,
    'and a shop with no journal yet is never asked at all');

  /* TWO THINGS, TWO SLOTS — AND THE SECOND SLOT WAS A DUPLICATE ID.
   *
   * The pace matters MOST after the meeting, all week, without another
   * one being held — so it must survive this card's rewrite. This test
   * used to say the card proves that by emitting `id="dash_managerPace"`
   * at the end of its own innerHTML, in both states.
   *
   * It did emit it, and it did nothing. There is already a
   * #dash_managerPace in the markup, a SIBLING of #dash_managerCard, and
   * getElementById returns the first in document order — so
   * renderManagerPace always wrote to the markup's one and the emitted
   * copy was unreachable by construction. An invalid duplicate id, and a
   * permanently empty div charging a stack gap on Today's front door.
   *
   * What actually keeps the pace safe is that it lives OUTSIDE this
   * card, where the rewrite cannot reach it. So that is what is checked,
   * and the id is checked to be unique — which is the thing that was
   * silently untrue. */
  t.check(!/dash_managerPace/.test(before.html) && !/dash_managerPace/.test(after.html),
    'the card does not emit a pace slot of its own — a second element with that id is unreachable by construction');
  /* Counted in the MARKUP, between the stylesheet and the script, not
     across the whole file: the note in renderManagerCard quotes the tag
     it stopped emitting, and that explanation is the reason to keep the
     comment rather than a reason to fail the check it describes.
     (Stripping /* *​/ across 66,000 lines is not the answer either — one
     stray sequence inside a string re-pairs every comment after it.) */
  const markup = src.slice(src.indexOf('</style>'), src.indexOf('<script>'));
  t.check(markup.length > 1000, 'the markup region is found');
  t.check((markup.match(/id="dash_managerPace"/g) || []).length === 1,
    'there is exactly one #dash_managerPace element');
  const stack = (/<div class="ow-stack">[\s\S]*?<div class="ow-grid">/.exec(src) || [''])[0];
  t.check(/id="dash_managerCard"[\s\S]{0,120}?id="dash_managerPace"/.test(stack),
    'and it sits beside the card, not inside it, which is what the rewrite cannot reach');

  /* An empty slot must cost nothing. Both of these are silent by design
     a lot of the time — the invite goes once the meeting is held, the
     pace stays quiet unless a target is live — and a gapped stack
     charges 16px for a child with nothing in it. Two of them left a
     hole on the phone's front door that read as a screen half-loaded. */
  t.check(/\.ow-stack > :empty\{display:none;\}/.test(src),
    'and an empty slot takes no room at all');

  /* FORTY-FOUR WORDS IS ONE ROW ON A CONSOLE AND FOUR LINES ON A PHONE.
   *
   * This card is the first thing under the figures on Today, so on a
   * phone the full sentence pushed the work itself below the fold — on
   * the screen the owner opens every morning to find out what needs
   * them.
   *
   * The clause that goes is the one explaining HOW a meeting works,
   * which somebody who has held one every morning for months already
   * knows. What must NOT go is the last sentence: a meeting spends the
   * shop's money, and a cost is never a detail to trim for layout. Both
   * readings have to be grammatical, which is why the clause carries its
   * own colon.
   */
  const invite = (/<div class="mgr-invite">[\s\S]*?<\/div>/.exec(src) || [''])[0];
  t.check(/One tap holds the morning meeting<span class="ow-hide-sm">:/.test(invite),
    'the phone drops the clause that explains how a meeting works, not the offer itself');
  /* The PROSE, not the whole card — the button's own four words are a
     label, not something to read. */
  const prose = (/<p>[\s\S]*?<\/p>/.exec(invite) || [''])[0];
  const phone = prose.replace(/<span class="ow-hide-sm">[\s\S]*?<\/span>/, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  t.check(/A meeting spends a little AI credit\./.test(phone),
    'and never the cost — that sentence survives on both');
  t.check(/morning meeting\. A meeting/.test(phone),
    'what is left still reads as a sentence, colon and all');
  t.check(phone.split(' ').length <= 20,
    `which leaves the phone about two lines (${phone.split(' ').length} words)`);

  const pace = extractFunction(src, 'renderManagerPace', 'index.html');
  t.check(/if\(!el \|\| !managerNotesTable\) return;/.test(pace),
    'probe-guarded like every other journal read');
  t.check(/const behind = live\.filter\(x=> !x\.pace\.on_course\);/.test(pace)
    && /behind\.concat\(live\.filter\(x=> x\.pace\.on_course\)\)\.slice\(0, 2\)/.test(pace),
    'behind first, and at most two — a dashboard that always speaks teaches the eye to skip it');
  t.check(/if\(!live\.length\)\{ el\.innerHTML = ''; return; \}/.test(pace),
    'and silent when nothing is live');
  t.check(/x\.pace\.at_this_rate/.test(pace) && /At this rate/.test(pace),
    'the projection is shown as the rate carried forward, in those words');
  t.check(/managerScoreboard\(\)/.test(pace),
    'read from the one scoreboard derivation, so the dashboard and the Manager screen cannot disagree');
}

/* ---------- 6. the mind judges by pace, not by the raw figure --------- */
{
  const ext = api.slice(api.indexOf('const MANAGER_COMMON'), api.indexOf('function managerExtension'));
  t.check(/judged by PACE and never by the raw figure/.test(ext), 'the meeting is told to judge by pace');
  t.check(/where a target on course would stand TODAY for the days elapsed/.test(ext),
    'with what expected means spelled out');
  ['expected', 'on_course', 'behind_by', 'at_this_rate'].forEach((k) =>
    t.check(ext.includes(k), `${k} is named for the mind that reads it`));
  t.check(/MUST leave the meeting with either a move against it TODAY or an honest re-plan/.test(ext),
    'and a target behind pace cannot leave the meeting untouched — the whole point of watching');
  t.check(/Each live target carries its pace/.test(api),
    'the tool’s own description says pace rides along');
}

/* ---------- 7. pace reaches the tool, not just the code -------------- */
(async () => {
  const rows = [{ id: 1, date: '2026-08-24', status: 'open',
    body: { metric: 'collections', aim: 3000000, baseline: 0, from: '2026-08-24', to: '2026-08-30' } }];
  const journal = { meeting: [{ id: 9, date: '2026-08-25', body: { keyline: 'k' } }], move: [], question: [], target: rows };
  const tools = compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    extractFunction(src, 'buyHoldsStanding', 'index.html'),
    extractFunction(src, 'buyHoldFor', 'index.html'),
    extractFunction(src, 'buyKeyLabel', 'index.html'),
    extractFunction(src, 'managerAdviceTally', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
    extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
    extractFunction(src, 'managerScoreboard', 'index.html'),
    extractFunction(src, 'managerRecentReviews', 'index.html'),
    extractFunction(src, 'managerReviewBrief', 'index.html'),
    extractFunction(src, 'managerScoreProgress', 'index.html'),
    extractFunction(src, 'deriveMoveOutcome', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], { ...env, managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1',
    data: { ...data, stockLog: [], savedQuotes: [], purchaseInvoices: [] },
    daysSinceDate: () => 2, fmtUGX: (n) => String(n), Promise,
    sb: { from: () => { const q = { _kind: null };
      q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
      q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
      q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
      q.then = (res) => res({ data: journal[q._kind] || [], error: null });
      return q; } },
  }, ['names']).names().ASSISTANT_TOOLS;

  const hist = await tools.manager_history.run({ limit: 3 });
  const target = (hist.scoreboard || [])[0];
  t.check(!!(target && target.pace), 'the meeting is HANDED the pace, not merely near the code that computes it');
  eq(target.pace.expected, 1285714, 'the same level the screen shows');
  eq(target.pace.on_course, false, 'and the same verdict');
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
