#!/usr/bin/env node
'use strict';
/*
 * The Brief on a phone (the phone canvas) and the Brief's Phase 3
 * follow-ups, run on small hand-made inputs with the arithmetic written
 * beside each expectation.
 *
 *   - a goal's dates on the next 30 days are said in the measure's own
 *     unit (4.40m, 10.6%, 38 days), never as a raw number, and a figure
 *     the books cannot give reads "not known";
 *   - the phone's week is the next 30 days' own list, today and the six
 *     days after it, picked the same way;
 *   - the phone's four readouts are the desk strip's own cells, in the
 *     canvas's order: health, lowest cash, upside found, hit rate;
 *   - "It needs to know" counts as the nav counts: the open questions on
 *     the journal plus the supplier terms the books cannot supply;
 *   - the thumb bar carries only what the plan panel offers as its accent
 *     -- the open decision's door, or holding (or finishing) the meeting
 *     -- and runs nothing itself: a tap on it is a tap on the panel's own
 *     button;
 *   - the Simulator's teaser says "not known" for what it could not work
 *     out, with the Simulator's own shock count and its own words.
 *
 * Today is Wednesday 7 October 2026.
 *
 * Run: node test/manager-brief-phone.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager brief phone');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';

const S = compileScope([
  ...['mgrBriefGoalCheckpoints', 'mgrBriefNext7', 'mgrBriefForesightPick', 'mgrBriefForesight', 'mgrBriefPhoneCells', 'mgrBriefNeeds',
    'mgrBriefThumbPick', 'mgrBriefThumbMove', 'mgrBriefOwn', 'mgrBriefDay', 'mgrTgFig', 'mgrShortUGX', 'anShiftDate', 'waWeekday'].map(fn),
  ...['MGR_BRIEF_METRIC_DEPT', 'MGR_BRIEF_WEEK_KEEP', 'MGR_BRIEF_PHONE_CELLS', 'MGR_BRIEF_FS_ORDER', 'MGR_BRIEF_MONTHS', 'MGR_WEEKDAYS', 'MGR_BRIEF_NEEDS_SHOWN'].map(decl),
], {
  todayISO: () => TODAY,
  fmtShortDate: (d) => {
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Number(d.slice(8, 10)) + ' ' + m[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4); },
  /* A move is open unless marked done or not now; two kinds have doors. */
  deriveMoveOutcome: (r) => ({ status: r.status === 'done' ? 'done' : r.status === 'skipped' ? 'skipped' : 'open' }),
  MANAGER_DOORS: { queue: { tab: 'queue', label: 'Open the money queue' }, buy: { tab: 'buy', label: 'Open What to buy' } },
  Date, Math, Number, String, Map, Set, Array, Object, JSON,
}, ['mgrBriefGoalCheckpoints', 'mgrBriefNext7', 'mgrBriefForesight', 'mgrBriefForesightPick', 'mgrBriefPhoneCells', 'mgrBriefNeeds',
  'mgrBriefThumbPick', 'mgrBriefThumbMove', 'mgrTgFig']);

/* ---------- 1. a goal's dates, in its own unit (A6.8) ------------------ */
{
  const targets = [
    /* Gross profit to 31 Oct, 1,033,433 so far; the straight road's
       Mondays. Next checkpoint on or after today and before the end:
       Mon 12 Oct at 1,600,000 -> "1.60m". The end, 31 Oct, is inside the
       30 days (to 6 Nov), at its own checkpoint 4,400,000 -> "4.40m". */
    { metric: 'gross_profit', label: 'Gross profit', unit: 'ugx', to: '2026-10-31', aim: 4400000, actual: 1033433, finished: false,
      checkpoints: [{ on: '2026-10-05', value: 500000 }, { on: '2026-10-12', value: 1600000 }, { on: '2026-10-19', value: 2700000 },
        { on: '2026-10-31', value: 4400000 }] },
    /* Margin to 31 Dec: its next checkpoint, 10.6% on 12 Oct; its end is
       past the 30 days, so only the checkpoint is shown. Now 10.48 -> 10.5%. */
    { metric: 'margin_pct', label: 'Gross margin', unit: 'pct', to: '2026-12-31', aim: 12, actual: 10.48, finished: false,
      checkpoints: [{ on: '2026-10-12', value: 10.6 }, { on: '2026-12-31', value: 12 }] },
    /* Debtor days with no checkpoint list and no reading: its end, on
       its aim, and "not known" for now -- never 0. */
    { metric: 'debtor_days', label: 'Debtor days', unit: 'days', to: '2026-10-09', aim: 38, actual: null, finished: false },
    /* Finished, and a running one whose next date is past the 30 days:
       neither is on the list. */
    { metric: 'sales', label: 'Sales', unit: 'ugx', to: '2026-10-04', aim: 1, actual: 2, finished: true, checkpoints: [] },
    { metric: 'wa_orders', label: 'WhatsApp orders a month', unit: 'count', to: '2027-01-31', aim: 30, actual: 12, finished: false,
      checkpoints: [{ on: '2026-11-30', value: 20 }] },
  ];
  const got = S.mgrBriefGoalCheckpoints(targets, TODAY, S.mgrTgFig);
  eq(got.map((x) => [x.to, x.label, x.aimText, x.nowText, x.last, x.dept]), [
    ['2026-10-12', 'Gross profit', '1.60m', '1.03m', false, 'sales'],
    ['2026-10-31', 'Gross profit', '4.40m', '1.03m', true, 'sales'],
    ['2026-10-12', 'Gross margin', '10.6%', '10.5%', false, 'sales'],
    ['2026-10-09', 'Debtor days', '38 days', 'not known', true, 'finance'],
  ], 'the next checkpoint and the end inside 30 days, each in its own unit, and "not known" for a figure the books cannot give');
  /* Saturday load time (Q36) is the Store's; a measure the table does
     not name is the whole shop's (null), never Finance's by default. */
  const more = S.mgrBriefGoalCheckpoints([
    { metric: 'sat_load', label: 'Saturday load time', unit: 'min', to: '2026-10-10', aim: 45, actual: 62, finished: false },
    { metric: 'a_new_measure', label: 'Something new', unit: 'count', to: '2026-10-10', aim: 3, actual: 1, finished: false },
  ], TODAY, S.mgrTgFig);
  eq(more.map((x) => x.dept), ['store', null], 'a load-time goal carries the Store; an unnamed measure carries no department');
  /* Through the foresight: the canvas's words, and no raw number. */
  const fs = S.mgrBriefForesight({ today: TODAY, targets: got });
  const lines = fs.filter((x) => /goal/.test(x.text)).map((x) => x.text + ' | ' + x.tag);
  eq(lines, [
    'Debtor days goal ends · 38 days | goal · now not known',
    'Gross profit goal checkpoint · 1.60m | goal · now 1.03m',
    'Gross margin goal checkpoint · 10.6% | goal · now 10.5%',
    'Gross profit goal ends · 4.40m | goal · now 1.03m',
  ], 'the foresight says "goal checkpoint" and "goal ends" with formatted figures, in date order');
  t.check(!lines.some((l) => /\d{5,}/.test(l)), 'and not one line carries a raw figure such as 4400000 or 1033433');
  t.check(fs.filter((x) => /goal/.test(x.text)).every((x) => x.kind === 'deadline'), 'each is a deadline on the timeline');
}

/* ---------- 2. the phone's week ---------------------------------------- */
{
  const it = (date, kind, extra) => ({ date, kind, dept: 'finance', text: kind + ' ' + date, day: Number(date.slice(8)), dow: 'x', ...(extra || {}) });
  const items = [it('2026-10-07', 'risk'), it('2026-10-10', 'known', { pay: 'wage', amount: 1 }), it('2026-10-13', 'deadline'),
    it('2026-10-14', 'deadline'), it('2026-10-20', 'expected')];
  /* Today to today + 6 (13 Oct) inclusive: 7, 10, 13; 14 and 20 are the
     30 days' alone. */
  eq(S.mgrBriefNext7(items, 6, TODAY).map((x) => x.date), ['2026-10-07', '2026-10-10', '2026-10-13'], 'today and the six days after it');
  /* Eight in the week, a cap of six: the pick's own order keeps the
     lowest day, the risk and the deadlines over the known payments. */
  const busy = [it('2026-10-07', 'risk'), it('2026-10-08', 'known', { pay: 'rent', amount: 1 }), it('2026-10-08', 'known', { pay: 'other', amount: 1 }),
    it('2026-10-09', 'deadline'), it('2026-10-10', 'known', { lowest: true }), it('2026-10-11', 'deadline'),
    it('2026-10-12', 'known', { pay: 'other', amount: 1 }), it('2026-10-13', 'known', { pay: 'other', amount: 1 })];
  const wk = S.mgrBriefNext7(busy, 6, TODAY);
  t.check(wk.length === 6 && wk.some((x) => x.lowest) && wk.some((x) => x.kind === 'risk') && wk.filter((x) => x.kind === 'deadline').length === 2,
    'capped at six, chosen as the 30 days chooses: the lowest day, the risk and both deadlines kept (got ' + wk.map((x) => x.date + ':' + x.kind).join(', ') + ')');
  t.check(wk.every((x, i) => i === 0 || wk[i - 1].date <= x.date), 'and put back in date order');
  /* A week full of risks and deadlines still shows money coming in and
     a known payment going out. Nine in the week, a cap of six:
       risks 7, 10, 12; deadlines 8, 9, 11; expected 10 (Kato 1.8m);
       a known bill on 8 and a known wage on 13.
     Ranked alone, the three risks and three deadlines fill all six.
     Kept: the first expected (10) and the first known wage/rent/loan/bill
     by date (the bill, 8). Four left for the ranking: the risks 7, 10,
     12 and the earliest deadline, 8. Dropped: the deadlines 9 and 11,
     and the wage on 13. */
  const full = [it('2026-10-07', 'risk'), it('2026-10-10', 'risk'), it('2026-10-12', 'risk'),
    it('2026-10-08', 'deadline'), it('2026-10-09', 'deadline'), it('2026-10-11', 'deadline'),
    it('2026-10-10', 'expected', { amount: 1800000 }), it('2026-10-08', 'known', { pay: 'bill', amount: 1 }),
    it('2026-10-13', 'known', { pay: 'wage', amount: 1 })];
  eq(S.mgrBriefNext7(full, 6, TODAY).map((x) => x.date.slice(8) + ':' + x.kind),
    ['07:risk', '08:deadline', '08:known', '10:risk', '10:expected', '12:risk'],
    'the first money expected in and the first known payment keep a slot, the rest by rank, in date order');
  /* The desk's 30 days is picked as before: no slot is kept there. */
  eq(S.mgrBriefForesightPick(full, 6, TODAY).map((x) => x.date.slice(8) + ':' + x.kind),
    ['07:risk', '08:deadline', '09:deadline', '10:risk', '11:deadline', '12:risk'],
    'the 30 days\' own pick keeps no slot (its cap of 12 has room)');
}

/* ---------- 3. the phone's four readouts -------------------------------- */
{
  const cells = ['health', 'lowest', 'upside', 'free', 'risks', 'hit'].map((id) => ({ id }));
  eq(S.mgrBriefPhoneCells(cells).map((c) => c.id), ['health', 'lowest', 'upside', 'hit'],
    'health, lowest cash, upside found, hit rate -- the canvas\'s four, from the desk\'s own cells');
  t.check(S.mgrBriefPhoneCells(cells)[0] === cells[0], 'the same cell objects, so the same figures and the same failures');
}

/* ---------- 4. it needs to know ---------------------------------------- */
{
  const items = [
    { det: false, done: true, question: 'Answered already' },
    { det: false, question: 'What is Kasubi charging for G28 this week?', dept: 'sales', stake: { amount: 525000, from: 'market' }, place: { label: 'At Kasubi’s counter' } },
    { det: true, question: 'When does Roofings stop supplying?', dept: 'procurement', place: { label: 'Ask Roofings Ltd' } },
    { det: true, done: true, question: 'Kept this session' },
  ];
  /* The nav's count: 7 open on the journal + 1 supplier term still open = 8. */
  const m = S.mgrBriefNeeds(7, items);
  t.check(m.n === 8, 'the journal\'s open count plus the open supplier terms: 7 + 1 = 8 (got ' + m.n + ')');
  eq(m.top && [m.top.question, m.top.dept, m.top.stake.amount, m.top.where],
    ['What is Kasubi charging for G28 this week?', 'sales', 525000, 'At Kasubi’s counter'], 'the first open one, as the section orders them');
  /* WAS: before the count landed, or when it failed, the card stated
     what the list held (1 + 1 = 2) as THE count, where the nav states
     none. NOW: no count is stated as the count -- "at least 2" (the
     list's own 1 + 1), and a count that could not be read says so. */
  const pending = S.mgrBriefNeeds(undefined, items);
  t.check(pending.n === null && pending.atLeast === 2 && pending.failed === false && pending.top.dept === 'sales',
    'before the count lands: no count, at least what the list holds (1 + 1 = 2), and the first question still shown');
  const failed = S.mgrBriefNeeds(null, items);
  t.check(failed.n === null && failed.atLeast === 2 && failed.failed === true,
    'a count that could not be read (null, as managerOpenAskCount answers a failure): no count, and it says it failed');
  /* The card itself: never gone without a word. */
  const card = (ctx, extra) => compileScope([fn('mgrBriefNeedsCard'), fn('mgrBriefNeeds'), decl('MGR_BRIEF_NEEDS_SHOWN')], {
    mgrBriefCtx: ctx, mgrBriefIcon: () => '', esc: (x) => String(x), mgrBriefDeptChip: (d) => '[' + d + ']', mgrShortUGX: (v) => String(v),
    mgrAskModel: () => ({ items, today: TODAY }), mgrAskRead: null, mgrBriefWireGo() {},
    mgrAskCardHTML: (it) => '<div class="mgr-k-q" data-qkey="' + it.question + '">[' + it.dept + '] ' + it.question + ' <button class="mgr-k-an">chip</button></div>',
    mgrWireAsks() {}, managerNotesProbeError: (extra || {}).probeErr || null, Number, Math, String, Array, Object, console,
  }, ['mgrBriefNeedsCard']).mgrBriefNeedsCard();
  const txt = (c) => c.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  t.check(/It needs to know/.test(txt(card({ notes: false }))) && /does not have yet/.test(txt(card({ notes: false }))),
    'no journal: the card stays and says its questions are kept in a memory this shop does not have yet');
  /* A journal whose probe FAILED is not a shop with no memory (law 3). */
  const down = txt(card({ notes: false }, { probeErr: 'Failed to fetch' }));
  t.check(/could not be read — Failed to fetch/.test(down) && !/does not have yet/.test(down),
    'a journal the boot probe could not read: the card names that failure, never "no memory yet" (got ' + down + ')');
  t.check(/could not be read — the journal is down/.test(txt(card({ notes: true, st: { error: 'the journal is down' } }))),
    'a journal that could not be read: the card names the failure');
  t.check(/at least 2 · the count could not be read/.test(txt(card({ notes: true, st: { questions: [] }, openAsks: null }))),
    'a failed count: "at least 2", and the count named as unread');
  t.check(/at least 2 · still counting/.test(txt(card({ notes: true, st: { questions: [] } }))), 'a count not yet landed: "still counting"');
  /* THE FIRST TWO, ANSWERED HERE (review, the phone canvas's two cards):
     the open ones in the section's order -- Kasubi's price (sales), then
     Roofings' terms (procurement) -- each drawn by the Ask section's own
     card, answer chips and all; 8 open, so "All 8 questions". */
  const landed = card({ notes: true, st: { questions: [] }, openAsks: 7 });
  t.check(/8 · only you can find out/.test(txt(landed)), 'the landed count: 7 + 1 = 8');
  t.check((landed.html.match(/class="mgr-k-q"/g) || []).length === 2 && /\[sales\] What is Kasubi charging/.test(landed.html)
    && /\[procurement\] When does Roofings stop supplying\?/.test(landed.html) && (landed.html.match(/mgr-k-an/g) || []).length === 2,
    'the first two open questions, each the Ask section\'s own card with its answer chips (got ' + txt(landed) + ')');
  t.check(/All 8 questions →/.test(txt(landed)) && typeof landed.wire === 'function',
    'and the door to all 8, with the cards wired by the Ask section\'s own wiring');
  eq(S.mgrBriefNeeds(7, items).shown.map((x) => x.question), ['What is Kasubi charging for G28 this week?', 'When does Roofings stop supplying?'],
    'two shown, the answered ones passed over');
  /* Nothing is kept untapped: the card's only writer is the Ask section's
     wiring (its "Keep this answer"), and the Brief calls no write. */
  const cardSrc = fn('mgrBriefNeedsCard');
  t.check(/mgrWireAsks\(/.test(cardSrc) && !/managerAnswerQuestion|sb\.from|apSend|runManagerMeeting/.test(cardSrc),
    'the Brief writes nothing itself: answers are kept only by the Ask section\'s own "Keep this answer"');
  const none = S.mgrBriefNeeds(0, []);
  t.check(none.n === 0 && none.top === null, 'nothing open: none, and no question invented');
}

/* ---------- 5. the thumb bar carries the panel's one accent -------------- */
{
  const door = { num: '01', dept: 'Finance', pips: 4, basis: 'from 4 chases', title: 'Collect Kato’s 2.4m first', label: 'Draft the chase', mid: 'm1' };
  const d = S.mgrBriefThumbPick({ door });
  eq(d && [d.kind, d.small, d.title, d.label], ['door', '01 · Finance · sure 4/5 from 4 chases', 'Collect Kato’s 2.4m first', 'Draft the chase'],
    'the open decision: its number, department and how sure, its title, and its door');
  const h = S.mgrBriefThumbPick({ hold: true });
  t.check(h && h.kind === 'hold' && h.label === 'Hold the meeting', 'no meeting held: Hold the meeting');
  t.check(S.mgrBriefThumbPick({ hold: true, known: false }) === null,
    'a journal that is missing or could not be read cannot say no meeting is held: the bar does not promote one');
  t.check(d.mid === 'm1' && S.mgrBriefThumbPick({ door: { ...door, pips: null } }).small === '01 · Finance',
    'the move it carries is named by id; no confidence stated, none said');
  t.check(S.mgrBriefThumbPick({ finish: true, hold: true }).kind === 'finish', 'a meeting that stopped short: finish it, never a second one');
  t.check(S.mgrBriefThumbPick({ hold: true, running: true }) === null, 'a meeting in progress: nothing to carry');
  t.check(S.mgrBriefThumbPick({ door, stale: true }) === null, 'a last-known panel: nothing to carry -- its buttons are not wired');
  t.check(S.mgrBriefThumbPick({}) === null && S.mgrBriefThumbPick({ door: { title: 'x' } }) === null, 'a decision with no door: no bar');

  /* WHICH MOVE IT CARRIES: the open row's when that row has a door;
     else the first move still open, in the meeting's order, that has a
     door and is drawn -- so a plan with a door left always gives the
     screen its one action. */
  const rows = [{ id: 'a', status: 'done', body: { door: 'queue' } }, { id: 'b', body: {} },
    { id: 'c', body: { door: 'buy' } }, { id: 'd', body: { door: 'queue' } }];
  const pickId = (...a) => { const r = S.mgrBriefThumbMove(...a); return r && [r.row.id, r.n]; };
  eq(pickId(rows, 'd', true), ['d', 4], 'the open row with a door: that row, numbered in the meeting\'s order');
  eq(pickId(rows, null, false), ['c', 3], 'no row open: the first open move with a door (a is done, b has none)');
  eq(pickId(rows, 'b', false), ['c', 3], 'the open row has no door: the first open move with one');
  eq(pickId(rows, null, false, (id) => id !== 'c'), ['d', 4], 'a row the panel does not draw (another department) is passed over');
  t.check(S.mgrBriefThumbMove([{ id: 'a', status: 'done', body: { door: 'queue' } }], null, false) === null, 'nothing open with a door: nothing');

  /* NOTHING SENDS ITSELF: the bar never runs a meeting, sends to the
     assistant or marks a move -- a tap on it clicks the panel's own
     button, found when tapped. */
  const paint = fn('mgrBriefPaintThumb');
  t.check(!/runManagerMeeting|apSend|apOpenPanel|managerSetMoveStatus|goToTab|apMode\s*=/.test(paint),
    'the bar calls no meeting, no assistant, no status write and no door of its own');
  t.check(/target\.click\(\)/.test(paint) && /\.mgr-b-dc\.mgr-b-x \.mgr-door/.test(paint) && /managerBandWrap/.test(paint) && /#mgrRunBtn\.btn-accent/.test(paint) && /#mgrFinishBtn/.test(paint),
    'it clicks the panel\'s own door or Finish button, or the band\'s Hold button');
  t.check(/addEventListener\('click'/.test(paint) && !/setTimeout|setInterval/.test(paint), 'only on a click, never on a timer');
  /* The copy steps aside only while the bar carries it: the band's Hold
     (Q30, Q41) and the panel's door. */
  t.check(/\.mgr-bed-b\.mgr-b-has-thumb #managerBandWrap \.btn\.mgr-b-hold/.test(src) && /\.mgr-bed-b\.mgr-b-has-thumb \.mgr-b-dc\.mgr-b-x \.mgr-door/.test(src),
    'one accent on the phone: the band\'s Hold and the panel\'s door are hidden only while the bar shows');
  /* THE ASK BAR UNDER THE MANAGER (review: the phone canvas puts it right
     under the hero). The header's field steps aside on the Brief so there
     is one place to ask, and the bar's go square is navy so the thumb
     bar's stays the one oxide control. */
  t.check(/#tab-manager\.mgr-on-brief #mgrTalkBtn\{display:none;\}/.test(src) && /\.mgr-bed-b \.mgr-b-askbar-go\{[^}]*background:var\(--ow-steel-950\)/.test(src),
    'on the phone the Brief\'s own ask bar stands in for the header\'s field, its go square navy');
  t.check(/\.mgr-bed-b \.mgr-b-askbar\{display:none;\}/.test(src), 'and on the desk the bar is not drawn: the ask card is the desk\'s');
  const bandSrc = fn('mgrBriefPaintBand');
  t.check(/\$\{who\}\$\{mgrBriefAskBarHTML\(\)\}/.test(bandSrc) && /bar\.addEventListener\('click', \(\)=> mgrBriefAsk\(''\)\)/.test(bandSrc),
    'the bar sits right under the Manager and only a tap opens the shared panel -- with nothing typed, nothing is sent');
}

/* ---------- 6. the teaser: the Simulator's own figures, said as what they are -- */
{
  const els = {};
  const wrapEl = { id: 'managerSimTeaserWrap', innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const document = { getElementById: (id) => (id === 'managerSimTeaserWrap' ? wrapEl : (els[id] = els[id] || { id, innerHTML: '', querySelectorAll: () => [] })) };
  const make = (M, rows) => compileScope([fn('mgrBriefPaintTeaser'), fn('mgrBriefTeaserFigs'), fn('mgrShortUGX'), fn('mgrBriefDay'), fn('waWeekday'),
    fn('mgrBriefLampHTML'), decl('mgrOf'), decl('MGR_BRIEF_MONTHS'), decl('MGR_WEEKDAYS')], {
    document, mgrBriefModel: M, mgrBriefRows: rows || [], esc: (s) => String(s), mgrBriefWireGo() {},
    mgrBriefNeedsCard: () => ({ html: '', sig: '', wire: null }), mgrDeptOf: (r) => r.dept || null, mgrTouchesOf: (r) => r.touches || [],
    Date, Math, Number, String, Array, Object, Set,
  }, ['mgrBriefPaintTeaser', 'mgrBriefTeaserFigs']);
  make({ tz: null, walk: null }).mgrBriefPaintTeaser();
  const none = wrapEl.innerHTML;
  t.check((none.match(/not known/g) || []).length === 3 && !/>—</.test(none),
    'nothing worked out: profit, lowest cash and the shocks each read "not known"');
  /* THE PROFIT IS THE PLAN'S CHANGE AGAINST TODAY (the cross-section
     contract; review: "+10.17m" in verdigris for a plan that changes
     nothing). My plan: change {0, 0}, level 10,172,190 a month.
     -> "+0", "as today", the level "10.17m" unsigned, never the gain colour. */
  const floor = { amount: 3000000, source: 'set' };
  const tz0 = { profitMonth: { lo: 0, hi: 0 }, profitLevel: { lo: 10172190, hi: 10172190 }, lowest: { balance: -1060000, date: '2026-11-05' },
    shocksHeld: 0, shocksOf: 3, plan: 'my plan' };
  make({ walk: null, floor, tz: tz0 }, [{ dept: 'finance', touches: ['sales'] }, { dept: 'store' }]).mgrBriefPaintTeaser();
  const tz = wrapEl.innerHTML;
  t.check(/mgr-b-tz-v mgr-b-fig">\+0</.test(tz) && /as today · <span class="mgr-b-fig">10\.17m<\/span> a month/.test(tz)
    && !/mgr-b-good/.test(tz) && !/\+10\.17m/.test(tz),
    'a plan that changes nothing: "+0", "as today", the month\'s 10.17m as a level -- no "+10.17m", no gain colour (got ' + tz.replace(/\s+/g, ' ').slice(0, 900) + ')');
  /* The lowest: -1,060,000 on Thu 5 Nov, under the 3m floor and zero. A
     true minus, the loss's colour and the bad lamp, its title naming the
     floor. */
  t.check(/mgr-b-tz-v mgr-b-fig mgr-b-bad" title="under your floor of 3m, and below zero"><span class="mgr-b-lamp mgr-b-lamp-bad"[^>]*><\/span>−1\.06m/.test(tz)
    && /Thu 5 Nov/.test(tz) && !/-1\.06m/.test(tz),
    'lowest cash under the floor: "−1.06m" with a true minus, in the bad state, its title naming the floor');
  /* Q40: shocks held on the EXPECTED line; the committed low beside it. */
  t.check(/0<span class="of">of<\/span>3/.test(tz) && /A shock holds when the expected line stays at or above the floor; the lowest cash beside it is the committed line’s\./.test(tz)
    && /3 shocks\. My plan, played out:/.test(tz) && /Holds under shocks/.test(tz),
    'the Simulator\'s own count (0 of 3), held on the expected line (Q40), the committed low beside it');
  /* The departments, counted from the decisions: finance + sales + store = 3, never the canvas's literal six. */
  t.check(/2 decisions · 3 departments · 30 days of cash · 3 shocks/.test(tz) && !/6 departments/.test(tz),
    'the departments the decisions touch, counted (finance, sales, store = 3), never a literal "6 departments"');
  t.check(!/'6 departments'|6 departments/.test(fn('mgrBriefPaintTeaser')), 'no literal department count in the teaser\'s code');
  t.check(/A shock that could not be tested counts as not held\./.test(tz),
    'while the Simulator hands over no untestable count, the teaser says such a shock counts as not held');
  /* A gain is green only when even its low end is a gain: +2.13m -> good;
     -200k to +500k -> neither; -300k -> bad. */
  const F = (pm) => make({}).mgrBriefTeaserFigs({ profitMonth: pm, profitLevel: { lo: 6830000, hi: 6830000 }, plan: 'my plan' }, null, floor, 0).profit;
  eq([F({ lo: 2130000, hi: 2130000 }).text, F({ lo: 2130000, hi: 2130000 }).state], ['+2.13m', 'good'], 'a plan that adds 2.13m a month: "+2.13m", the gain colour');
  eq([F({ lo: -200000, hi: 500000 }).text, F({ lo: -200000, hi: 500000 }).state], ['−200k – +500k', null], 'a range that may go either way: signed both ends, no colour');
  eq([F({ lo: -300000, hi: -300000 }).text, F({ lo: -300000, hi: -300000 }).state], ['−300k', 'bad'], 'a plan that costs profit: "−300k", the loss colour');
  /* A Simulator still handing only a level (no profitLevel): the change
     is not known, and the level is said unsigned. */
  const old = make({}).mgrBriefTeaserFigs({ profitMonth: { lo: 10172190, hi: 10172190 }, plan: 'my plan' }, null, floor, 0).profit;
  eq([old.text, old.state, old.level], ['not known', null, '10.17m'], 'a level alone is never shown as a change');
  /* Above the floor: the good lamp; no floor: no lamp. */
  const L = (bal, fl) => make({}).mgrBriefTeaserFigs({ lowest: { balance: bal, date: '2026-10-20' } }, null, fl, 0).lowest;
  eq([L(3450000, floor).state, L(3450000, floor).text, L(3450000, null).state], ['good', '3.45m', 'none'], 'above the floor: good; no floor set: no lamp');
  make({ walk: null, tz: { profitMonth: null, lowest: null, shocksHeld: 1, shocksOf: 3, shocksUntestable: 2, plan: 'nothing changes' } }).mgrBriefPaintTeaser();
  const ut = wrapEl.innerHTML;
  t.check(/1<span class="of">of<\/span>3/.test(ut) && /<span class="mgr-b-fig">2<\/span> not testable/.test(ut) && !/counts as not held/.test(ut),
    'given the count: 1 of 3 and "2 not testable", as the Simulator\'s own tile says it');
}

process.exit(t.done() ? 1 : 0);
