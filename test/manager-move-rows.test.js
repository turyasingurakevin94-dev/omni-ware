#!/usr/bin/env node
'use strict';
/*
 * A move on the Manager's own screen: its face, its number, its kind,
 * its state, its evidence -- and buttons that actually do something.
 *
 * The plan and Today's queue draw moves as queue rows (.ow-q[data-mid]),
 * and mgrWirePlan only ever wired the old .mgr-move cards: Done and Not
 * now on the plan were buttons that recorded nothing. Pinned here, with
 * the reason for "not now" now typed in place instead of in a pop-up.
 *
 * Run: node test/manager-move-rows.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager move rows');
const src = read('index.html');
/* The Manager screen is renderManager and the seven bed painters it hands
   every reading to (mgrPaint<Bed>), so a pin on "the render" reads all
   eight: what used to sit in one function is drawn by the bed it belongs to. */
const MGR_RENDER = ['renderManager', 'mgrPaintBrief', 'mgrPaintSim', 'mgrPaintTargets', 'mgrPaintPlays',
  'mgrPaintUnusual', 'mgrPaintAsk', 'mgrPaintRecord'];
const mgrRender = () => MGR_RENDER.map((n) => extractFunction(src, n, 'index.html')).join('\n');

/* ---------- 1. the buttons reach every move --------------------------- */
{
  const wire = extractFunction(src, 'mgrWirePlan', 'index.html');
  t.check(/querySelectorAll\('\.mgr-move, \.ow-q\[data-mid\]'\)/.test(wire),
    'Done and Not now are wired on queue rows as well as on the old cards');
  t.check(/card\.querySelector\('\.mgr-skip-why'\)/.test(wire) && /if\(box && !why\)\{ box\.focus\(\);/.test(wire),
    'the reason is read from the row\'s own box, and an empty one asks rather than recording a blank');

  const calls = [];
  const els = (sel) => [];
  const listeners = {};
  const mkBtn = (name) => ({ addEventListener: (ev, fn) => { listeners[name] = fn; }, dataset: {} });
  const box = { value: '', focus: () => { calls.push('focus'); }, placeholder: '' };
  const row = { dataset: { mid: '42' }, querySelector: (sel) => ({ '.mgr-done': mkBtn('done'), '.mgr-skip': mkBtn('skip'), '.mgr-skip-why': box }[sel] || null) };
  const root = { querySelectorAll: (sel) => (sel === '.mgr-move, .ow-q[data-mid]' ? [row] : []) };
  const { mgrWirePlan } = compileScope([wire], {
    managerSetMoveStatus: (id, st, why) => calls.push([id, st, why || null]),
    goToTab: () => {}, apOpenPanel: () => {}, document: { getElementById: () => null },
    prompt: () => { calls.push('prompt'); return null; },
  }, ['mgrWirePlan']);
  mgrWirePlan(root);
  listeners.done();
  listeners.skip();
  box.value = 'waiting for Kato';
  listeners.skip();
  t.check(JSON.stringify(calls) === JSON.stringify([[42, 'done', null], 'focus', [42, 'skipped', 'waiting for Kato']]),
    'a queue row records Done, refuses a blank reason, and records Not now with its reason (got ' + JSON.stringify(calls) + ')');
  t.check(!calls.includes('prompt'), 'and a row with a box never opens the pop-up');
}

/* ---------- 2. the rich row ------------------------------------------- */
{
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const scope = compileScope([
    extractFunction(src, 'mgrRichRowHTML', 'index.html'), extractFunction(src, 'mgrMoveReach', 'index.html'),
    extractFunction(src, 'mgrMoveFace', 'index.html'),
    extractFunction(src, 'mgrAvatarHTML', 'index.html'),
    extractDeclaration(src, 'MGR_KIND_TONE', 'index.html'),
    extractDeclaration(src, 'MGR_KIND_WORD', 'index.html'),
    extractDeclaration(src, 'MGR_KIND_ICON', 'index.html'),
  ], {
    data: { customers: [{ id: 7, name: 'Kato Construction Ltd' }] },
    deriveMoveOutcome: (r) => ({ status: r.status || 'open', derived: r.status === 'done' ? 'paid 400,000 since' : null }),
    MANAGER_DOORS: { chase: { tab: 'chase', label: 'Open the money queue' } },
    MANAGER_WORTH_BASES: { cash_freed: 'cash freed' },
    mgrMoveOrder: (rows) => rows, mgrChaseRowFor: () => null, chaseResponseLine: () => '',
    supplierName: () => '', fmtUGX: (n) => n.toLocaleString('en-US') + ' UGX', fmtShortDate: (d) => d,
    OW_CARET: '', OW_CARET_C: '', esc, Math, Number, String, Array, Object,
  }, ['mgrRichRowHTML']);
  const rows = [
    { id: 1, status: 'open', body: { title: 'Collect the 13-day invoice', mkind: 'chase', door: 'chase', worth: 2515000, worthBasis: 'cash_freed', subject: { customerId: 7 }, unlocks: 'the restock' } },
    { id: 2, status: 'open', body: { title: 'Restock Masasi', mkind: 'buy', worth: 250000, after: 0 } },
    { id: 3, status: 'done', body: { title: 'Ring Sarah', mkind: 'chase', worth: 400000, doneOn: '2026-09-24' } },
    { id: 4, status: 'skipped', body: { title: 'Get a date from Peter', mkind: 'chase', skipReason: 'travelling' } },
  ];
  const open = scope.mgrRichRowHTML(rows[0], rows, { rich: true, num: 0, open: true });
  t.check(/<span class="mgr-rv-n">01<\/span><span class="mgr-av mgr-av-\d" aria-hidden="true">KC<\/span>/.test(open),
    'a move about a customer wears their initials and its number in the plan');
  t.check(/<span class="mgr-kc mgr-kt-money">Chase<\/span> /.test(open) && /Kato Construction Ltd/.test(open),
    'its kind as a chip in its door\'s colour, spaced from what follows, and the customer by name');
  t.check(/class="btn btn-accent ow-sm mgr-door"/.test(open) && /class="mgr-skip-why"/.test(open) && /class="btn btn-ghost ow-sm mgr-done"/.test(open),
    'the open move carries its door, Done, and Not now with a box for the reason');
  t.check(/aria-label="79% of the money in today's plan"/.test(open),
    'and a ring for its share of the day\'s money (2,515,000 of 3,165,000)');
  t.check(/Unlocks: the restock/.test(open), 'with what it makes possible as a chip');
  const waiting = scope.mgrRichRowHTML(rows[1], rows, { rich: true, num: 1 });
  t.check(/waiting on 01/.test(waiting) && /mgr-av-k mgr-kt-buy/.test(waiting),
    'a move that waits on another names its number, and one about no one wears its kind\'s mark');
  const done = scope.mgrRichRowHTML(rows[2], rows, { rich: true, num: 2 });
  t.check(/mgr-rv-done/.test(done) && /mgr-sc mgr-sc-done/.test(done) && /paid 400,000 since/.test(done) && !/mgr-done"/.test(done),
    'a done move says so, with what the books saw since, and offers no Done again');
  const skipped = scope.mgrRichRowHTML(rows[3], rows, { rich: true, num: 3 });
  t.check(/mgr-rv-skipped/.test(skipped) && /“travelling”/.test(skipped), 'a move set aside shows the owner\'s own reason');
  t.check(/mgrQueueRowHTML\(r, rows, \{ kindChip: true, open, rich: true, num: ordered\.indexOf\(r\) \}\)/.test(src),
    'the Manager\'s plan draws rich rows; Today\'s queue keeps its compact one');
}

/* ---------- 3. the rail, the playbook and growth, drawn ----------------- */
{
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const { mgrScoreRingsHTML, mgrAvatarHTML } = compileScope([
    extractFunction(src, 'mgrScoreRingsHTML', 'index.html'),
    extractFunction(src, 'mgrAvatarHTML', 'index.html'),
    extractFunction(src, 'mgrShortUGX', 'index.html'),
  ], { esc, Math, Number, String }, ['mgrScoreRingsHTML', 'mgrAvatarHTML']);
  const rings = mgrScoreRingsHTML([
    { label: 'Sales', pct: 25, pace: { on_course: false, behind_by: 2898857 } },
    { label: 'Gross profit', pct: 74, pace: { on_course: true } },
  ]);
  t.check((rings.match(/class="mgr-sr-bad"/g) || []).length === 1 && (rings.match(/class="mgr-sr-good"/g) || []).length === 1,
    'one ring per running target, crimson behind pace and verdigris on course');
  t.check(/25% · 2\.9m behind/.test(rings) && /74% · on course/.test(rings), 'with how far each is, and by how much it is behind');
  t.check(mgrScoreRingsHTML([]) === '', 'and nothing at all when no target is running');
  t.check(mgrAvatarHTML('Kato Construction Ltd') === mgrAvatarHTML('Kato Construction Ltd') && />KC</.test(mgrAvatarHTML('Kato Construction Ltd')),
    'a customer wears the same initials and the same tint every time');

  const render = mgrRender();
  t.check(/mgrScoreRingsHTML\(sb2\.targets\.filter\(x=> !x\.finished\)\)/.test(render), 'the scoreboard opens with its rings');
  t.check(/<div class="mgr-rt">/.test(render) && /class="mgr-av mgr-av-k mgr-kt-money"/.test(render),
    'the standing rules are rows with the mark of the door each belongs to');
  /* WAS: the playbook was one panel drawn inside mgrPaintPlays -- a span
     bar (const span), start-and-now gauges (const gauge), and a pipe of
     stages (Proposed -> Running -> Worked, Set aside). NOW: the Playbook
     section is the canvas's board, drawn by helpers in its own block --
     four lanes (Proposed, Running, Judged, Proven recipes) under three
     experiment slots; a running play wears its weeks as cells read
     against the week before it started, its overrun weeks marked, and how
     sure so far as pips. "Worked" is no longer a stage the app names: the
     Judged lane holds the owner's verdict (Q14). What these pins keep:
     the span drawn as weeks, the overrun marked, proposals ordered by what
     each would add, and overlaps flagged. */
  const plays = src.slice(src.indexOf('/* ═══ MGR BED: Plays — begin ═══ */\n/* ---- THE PLAYBOOK'),
    src.indexOf('/* ═══ MGR BED: Plays — end ═══ */\n/* ────'));
  t.check(plays.length > 20000 && /class="mgr-pl-wk"/.test(plays) && /mgr-pl-over/.test(plays) && /class="mgr-pl-pips"/.test(plays),
    'a running play wears its span as its weeks, each read against the week before it started, its overrun weeks marked, how sure so far as pips');
  t.check(/'Proposed'/.test(plays) && /'Running'/.test(plays) && /'Judged'/.test(plays) && /'Proven recipes'/.test(plays) && /class="mgr-pl-slots"/.test(plays),
    'the board is the canvas’s four lanes — proposed, running, judged, proven recipes — under its three slots');
  t.check(!/lane\('[^']*', '[a-z]+', 'Worked'/.test(plays) && /MGR_PLAY_VERDICT_WORDS = \{ worked: 'Worked', didnt: 'Didn’t work', cant_tell: 'Can’t tell' \}/.test(plays),
    'and no lane says a play worked — "Worked" is one of the three verdicts the owner chooses from, in the Judged lane');
  /* WAS: proposals sorted by their sizing (const props = proposed.slice()
     .sort(worth)), which ranked cash against profit against sales. NOW:
     the meeting's order (Q5, law 6); a pick is made only between two
     sized plays on one lever, and a lead only within one kind of money. */
  t.check(/const props = proposed\.map\(/.test(plays) && !/proposed\.slice\(\)\.sort\(/.test(plays) && /Overlaps “/.test(plays)
    && /MGR_PLAY_MONEY_KIND/.test(plays) && /kinds\.size === 1/.test(plays),
    'proposals stay in the meeting’s order, never ranked across kinds of money, and two treating the same thing are flagged as overlapping');
  const growth = extractFunction(src, 'renderManagerGrowth', 'index.html');
  t.check(/class="mgr-gg"/.test(growth) && /mgrAvatarHTML\(row\.name\)/.test(growth),
    'growth leads with its evidence as a gauge, and every customer has a face');
}

/* ---------- 4. the record and the meeting, drawn ------------------------ */
{
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const els = {};
  const scope = compileScope([
    extractFunction(src, 'mgrWeekBarsHTML', 'index.html'),
    extractFunction(src, 'mgrLeverDotsHTML', 'index.html'),
    extractFunction(src, 'mgrJournalRowHTML', 'index.html'),
    extractFunction(src, 'mgrShortUGX', 'index.html'),
    extractFunction(src, 'mgrTrailPush', 'index.html'),
    extractFunction(src, 'mgrTrailHTML', 'index.html'),
    extractDeclaration(src, 'MGR_TRAIL_WORDS', 'index.html'),
    extractDeclaration(src, 'MGR_JR_ICON', 'index.html'),
    'let mgrTrail = [];',
  ], {
    esc, Math, Number, String, Array, MGR_CARET: '', fmtShortDate: (d) => d,
    document: { getElementById: (id) => els[id] || null },
  }, ['mgrWeekBarsHTML', 'mgrLeverDotsHTML', 'mgrJournalRowHTML', 'mgrTrailPush', 'mgrTrailHTML']);

  const bars = scope.mgrWeekBarsHTML({ sales: 15694755, prior_sales: 39737000, gross_profit: 0, prior_gross_profit: 0 });
  t.check(/width:39%/.test(bars) && /width:100%/.test(bars) && /mgr-wb-down/.test(bars),
    'a week that fell draws this week against the last on one scale, marked down');
  t.check(!/Gross profit/.test(bars), 'and a figure with nothing either week draws no pair');
  t.check(scope.mgrWeekBarsHTML({}) === '', 'an empty week draws nothing');

  const dots = scope.mgrLeverDotsHTML(3, 10);
  t.check((dots.match(/<i/g) || []).length === 8 && (dots.match(/mgr-ld-on/g) || []).length === 3,
    'a lever shows one dot per time it was advised, capped at eight, filled for each that worked');
  t.check(scope.mgrLeverDotsHTML(0, 0) === '', 'and none when it was never scored');

  const jr = scope.mgrJournalRowHTML({ date: '2026-09-24', kind: 'meeting', title: 'Get Kato in', count: '1 of 3 done', dots: ['done', 'open', 'skipped'], body: '' });
  t.check(/mgr-jr-node/.test(jr) && /mgr-jd-done/.test(jr) && /mgr-jd-open/.test(jr) && /mgr-jd-skip/.test(jr),
    'a meeting in the journal is a node on the timeline, with a dot per move in its state');

  els.mgrTrail = { innerHTML: '' };
  scope.mgrTrailPush('list_debtors');
  scope.mgrTrailPush('list_debtors');
  scope.mgrTrailPush('some_new_tool');
  t.check((els.mgrTrail.innerHTML.match(/mgr-tr-done/g) || []).length === 2
    && /Read who owes you/.test(els.mgrTrail.innerHTML) && /Looked at some new tool/.test(els.mgrTrail.innerHTML),
    'a live meeting lists each thing it read once, in words, as it reads it');
  t.check(/mgr-tr-now/.test(scope.mgrTrailHTML()), 'and always ends on what it is doing now');

  t.check(/if\(managerMeetingRunning\) mgrTrailPush\(block\.name\);/.test(src), 'the trail is fed by the meeting\'s own tool calls');
  t.check((src.match(/managerMeetingRunning = true;\n  mgrTrail = \[\];/g) || []).length === 2, 'and starts empty for every meeting');
  const hero = extractFunction(src, 'mgrHeroHTML', 'index.html');
  t.check(/The meeting is on\./.test(hero) && /The meeting stopped short\./.test(hero),
    'the hero never says "no meeting yet" while one is running or after one ran out of room');
}

/* ---------- 5. the playbook's own figures ------------------------------ */
{
  const products = [{ id: 'P051', name: 'Masasi', variants: [{ name: 'a' }, { name: '12"' }] }, { id: 'P002', name: 'Cement', variants: [] }];
  const { mgrPlayWorth, mgrPlayText } = compileScope([
    extractFunction(src, 'mgrPlayWorth', 'index.html'), extractFunction(src, 'mgrPlayText', 'index.html'),
  ], {
    buyKeyParts: (k) => { const [pid, v] = String(k).split('::'); const p = products.find((x) => x.id === pid); return p ? { product: p, variantIdx: v == null ? null : Number(v) } : null; },
    productVariantLabel: (p, v) => p.name + (v == null ? '' : ' ' + p.variants[v].name),
    Number, String, RegExp,
  }, ['mgrPlayWorth', 'mgrPlayText']);
  const w1 = mgrPlayWorth('Those five lines sold 23,305,000 in 30 days; lifting them adds 1,466,051 over 30 days, and all 63 are worth 2,660,550.');
  t.check(w1 && w1.amount === 1466051 && w1.per === 'over 30 days', 'the prize is what a play ADDS, never what the lines already sell (got ' + JSON.stringify(w1) + ')');
  const w2 = mgrPlayWorth('64 cartons a month sold; 5,000 off each at 50 cartons is about 250,000 a month on volume you already sell.');
  t.check(w2 && w2.amount === 250000 && w2.per === 'a month', 'an "about … a month" sizing is read as the prize');
  t.check(mgrPlayWorth('1,108,301 UGX a month on volume already sold').amount === 1108301, 'with the currency in the way too');
  t.check(mgrPlayWorth('Keeps the shelf honest') === null, 'and a play sized in words alone shows no figure at all');
  t.check(mgrPlayText('Kept percent on P051::1 moving off 4.8%') === 'Kept percent on Masasi 12" moving off 4.8%'
    && mgrPlayText('Watch P002 and the Q3 plan') === 'Watch Cement and the Q3 plan',
    'a line code in the Manager\'s words is read back as the line\'s name, and nothing else is touched');
}

/* ---------- 6. the journal, drawn -------------------------------------- */
{
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sc = compileScope([
    extractFunction(src, 'mgrJournalRepeats', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'),
    extractFunction(src, 'mgrJournalChartHTML', 'index.html'), extractFunction(src, 'mgrDayMonth', 'index.html'),
    extractFunction(src, 'mgrJournalWeekLabel', 'index.html'), extractFunction(src, 'mgrMondayOf', 'index.html'),
    extractFunction(src, 'mgrShortUGX', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
  ], { esc, Math, Number, String, Date, Set, Array, fmtShortDate: (d) => d, fmtUGX: (n) => Math.round(n).toLocaleString('en-US') + ' UGX' }, ['mgrJournalRepeats', 'mgrJournalChartHTML', 'mgrJournalWeekLabel', 'mgrMondayOf']);
  const reps = sc.mgrJournalRepeats([
    { date: '2026-08-29', title: 'Put 5,000 shillings on the Masasi carton — that one change is worth more than every chase made last week.' },
    { date: '2026-08-31', title: 'Put 5,000 more shillings on each Masasi carton before you refill them — that one change is worth more.' },
    { date: '2026-09-06', title: 'Put 5,000 more shillings on each Masasi carton — 943,304 UGX a month on volume you already sell.' },
    { date: '2026-09-06', title: 'Put 5,000 more shillings on each Masasi carton — 943,304 UGX a month on volume you already sell.' },
    { date: '2026-09-19', title: 'Take the Masasi margin from Roto’s 50-carton rung, not from a price your customers have already refused.' },
    { date: '2026-09-24', title: 'Collect Amos’s 2,515,000 first, then refill the two shelves that are empty and earning.' },
  ]);
  t.check(JSON.stringify(reps.nth) === '[1,2,3,4,1,1]', 'the same advice in different words is counted as said again, and different advice is not (got ' + JSON.stringify(reps.nth) + ')');
  t.check(reps.top && reps.top.dates.length === 4 && /Masasi carton/.test(reps.top.title), 'and the advice said most often is named, with its dates');
  t.check(sc.mgrJournalRepeats([{ date: '2026-09-01', title: 'A' }, { date: '2026-09-02', title: 'B things here' }]).top === null, 'nothing is called repeated under three times');

  const chart = sc.mgrJournalChartHTML([
    { date: '2026-08-29', moves: ['done', 'open', 'open', 'open', 'open'], done: 1 },
    { date: '2026-09-24', moves: ['done', 'done', 'done', 'open', 'open'], done: 3 },
  ], [{ date: '2026-09-08', sales: 15694755 }], '2026-09-24');
  t.check(/<b class="mgr-jc-bad">4<\/b> of 10 moves done/.test(chart) === false && /<b class="mgr-jc-(mid|bad|good)">4<\/b> of 10 moves done/.test(chart),
    'follow-through counts every move done across the meetings shown');
  t.check((chart.slice(chart.indexOf('mgr-jc-plot')).match(/class="mgr-jc-done"/g) || []).length === 4 && /class="mgr-jc-r"/.test(chart) && /15\.69m/.test(chart),
    'each meeting is a stack of squares, done ones filled, and each review a mark with that week’s sales');
  t.check(/Today: 3 of 5\. Before it: 1 of 5\./.test(chart), 'and today is set against everything before it');
  t.check(sc.mgrMondayOf('2026-09-24') === '2026-09-21' && sc.mgrMondayOf('2026-09-06') === '2026-08-31',
    'entries are kept by the week they fall in, Monday to Sunday');
  t.check(sc.mgrJournalWeekLabel('2026-09-21', '2026-09-24') === 'This week · 21–27 Sept' && sc.mgrJournalWeekLabel('2026-08-31', '2026-09-24') === '31 Aug – 6 Sept',
    'and each week is labelled by its dates, this one named as such');
  const render = mgrRender();
  t.check(/said again — \$\{ORD\[n\] \|\| n \+ 'th'\} time/.test(render) && /Said \$\{top\.dates\.length\} times/.test(render) && /mgr-jr-wk/.test(render),
    'the journal draws the chart, the repeated advice and its weeks');
  t.check(/label: 'sales', cls: 'mgr-jr-b-s'/.test(render) && /' · was ' \+ mgrShortUGX\(wk\.prior_sales\)/.test(render),
    'and a review row carries its week as bars, sales beside the week before');
}

/* ---------- 7. a move with no figure still shows the money it touches -- */
{
  const bills = { undated: [{ supplierId: 'S1', due: 12000000, invoice: { id: 'B1' } }, { supplierId: 'S2', due: 7660000, invoice: { id: 'B2' } }],
    ahead: [], missed: [], total: 19660000, count: 35 };
  const { mgrMoveReach } = compileScope([extractFunction(src, 'mgrMoveReach', 'index.html'), extractFunction(src, 'mgrShortUGX', 'index.html')], {
    credDueRows: () => bills, debtChaseRows: () => ({ due: [{ id: 7, debt: 2515000 }], promised: [], resting: [], blocked: [] }),
    Math, Number, String, Set,
  }, ['mgrMoveReach']);
  const dating = mgrMoveReach({ mkind: 'settle', title: 'Name a day on the supplier bills', subject: {} });
  t.check(dating && dating.amount === 19660000 && /owed with no day named, of 19\.66m across 35 bills/.test(dating.basis),
    'dating the supplier bills shows the money it puts on the calendar: what is owed with no day named');
  t.check(mgrMoveReach({ mkind: 'settle', subject: { supplierId: 'S1' } }).amount === 12000000, 'a supplier move shows what that supplier is owed');
  t.check(mgrMoveReach({ mkind: 'chase', subject: { customerId: 7 } }).basis === 'owed by them', 'a customer move shows what they owe');
  t.check(mgrMoveReach({ mkind: 'price', title: 'Lift Masasi', subject: {} }) === null, 'and a move the books cannot size shows no figure rather than a guess');
  t.check(/reach\.basis \+ ' · from your books'/.test(extractFunction(src, 'mgrRichRowHTML', 'index.html')), 'marked as the books\' figure, never the Manager\'s');
}

/* ---------- 8. the scorecard, the pick, the reasoning ------------------- */
{
  const render = mgrRender();
  const tally = extractFunction(src, 'managerAdviceTally', 'index.html');
  t.check(/counts\.worthDone \+= x\.worth/.test(tally) && /counts\.waiting\.repeated\+\+/.test(tally) && /counts\.waiting\.stale\+\+/.test(tally) && /counts\.waiting\.fresh\+\+/.test(tally),
    'the tally carries the money acted on and why each waiting move is waiting: repeated, stale, or new this week');
  const verdict = extractFunction(src, 'mgrPaintVerdict', 'index.html');
  t.check(/'Money acted on'/.test(verdict) && /waiting: \$\{why\}/.test(verdict), 'and the scorecard shows money acted on against money waiting, with the reasons, not a bare count of untouched');
  /* WAS: read in mgrPaintPlays. NOW: the proposed card is the Plays
     block's mgrPlayProposedHTML; the pick is unchanged. */
  const proposedCard = extractFunction(src, 'mgrPlayProposedHTML', 'index.html');
  /* WAS: "which is worth more — try that first". NOW: "which is sized
     higher" -- the Manager's sizing, compared only when both were sized. */
  t.check(/Try this one first\./.test(proposedCard) && /which is sized higher — try that first/.test(proposedCard),
    'of two overlapping plays it recommends the one sized higher, and the other card points to it');
  t.check(/class="mgr-rv-why"/.test(extractFunction(src, 'mgrRichRowHTML', 'index.html')), 'every move carries one line of its reasoning on the card');
  t.check(/<p class="mgr-rej">/.test(render) && !/<p class="ow-mini">Considered and rejected/.test(render), 'and what was considered and rejected leads the plan instead of trailing it');
}

/* ---------- 8. what the shop's real journal broke ---------------------
   Read from the live books on 24 Sept: one Saturday held six meetings
   before noon, a Sunday held two sixteen minutes apart, and a move done
   on the earlier of those two. */
{
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sc = compileScope([
    extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
    extractFunction(src, 'mgrJrMoveFingerprint', 'index.html'),
    extractFunction(src, 'mgrJournalRepeats', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'),
    extractFunction(src, 'mgrJournalChartHTML', 'index.html'), extractFunction(src, 'mgrDayMonth', 'index.html'),
    extractFunction(src, 'mgrShortUGX', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
  ], { esc, Math, Number, String, Date, Set, Map, Array, fmtShortDate: (d) => d,
    fmtUGX: (n) => Math.round(n).toLocaleString('en-US') + ' UGX' },
  ['mgrLiveMoveRows', 'mgrJrMoveFingerprint', 'mgrJournalRepeats', 'mgrJournalChartHTML']);

  const rows = [
    { meeting_id: 59, date: '2026-09-06', status: 'open' },
    { meeting_id: 59, date: '2026-09-06', status: 'done' },
    { meeting_id: 59, date: '2026-09-06', status: 'skipped' },
    { meeting_id: 68, date: '2026-09-06', status: 'open' },
    { meeting_id: 68, date: '2026-09-06', status: 'open' },
    { meeting_id: 79, date: '2026-09-19', status: 'open' },
    { meeting_id: null, date: '2026-08-20', status: 'open' },
  ];
  const split = sc.mgrLiveMoveRows(rows);
  t.check(split.replaced.length === 1 && split.replaced[0].meeting_id === 59 && split.replaced[0].status === 'open',
    'an open move from a plan replaced the same day is replaced, not "never touched"');
  t.check(split.live.length === 6 && split.live.some((r) => r.meeting_id === 59 && r.status === 'done') && split.live.some((r) => r.meeting_id === 59 && r.status === 'skipped'),
    'but an answer given on the earlier plan stands, and a day held once is untouched');
  t.check(split.live.some((r) => r.meeting_id == null), 'and a move written before meetings were linked is always live');

  const mv = (mkind, subject) => ({ body: { mkind, subject } });
  t.check(sc.mgrJrMoveFingerprint(mv('price', { key: 'P051' })) === sc.mgrJrMoveFingerprint(mv('price', { key: 'P051::18' })),
    'a product is the same advice whatever size it names');
  t.check(sc.mgrJrMoveFingerprint(mv('chase', { customerId: 106 })) === sc.mgrJrMoveFingerprint(mv('chase', { customerId: 'C106' })),
    'and a customer is the same whether the plan wrote 106 or C106');
  t.check(sc.mgrJrMoveFingerprint(mv('chase', {})) === '' && sc.mgrJrMoveFingerprint(undefined) === '',
    'a move about nothing has no fingerprint, and matches nothing');

  const reps = sc.mgrJournalRepeats([
    { date: '2026-09-19', title: 'Take the Masasi margin from Roto’s 50-carton rung, not from a price your customers have already refused.', fp: 'chase|c1056' },
    { date: '2026-09-24', title: 'Collect Amos’s 2,515,000 first, then refill the two shelves that are empty and earning.', fp: 'chase|c1056' },
  ]);
  t.check(JSON.stringify(reps.nth) === '[1,2]',
    'two headlines with nothing in common are still the same advice when their first move acts on the same customer (got ' + JSON.stringify(reps.nth) + ')');

  const chart = sc.mgrJournalChartHTML([
    { date: '2026-08-29', moves: ['open'], done: 0 },
    { date: '2026-09-24', moves: ['done'], done: 1 },
  ], [{ date: '2026-08-29', sales: 31436660 }, { date: '2026-08-31', sales: 32696500 }, { date: '2026-09-08', sales: 15694755 }], '2026-09-24');
  const figs = chart.match(/<b>[\d.]+m<\/b>/g) || [];
  t.check(figs.length === 2 && /32\.7m/.test(chart) && /15\.69m/.test(chart) && !/<b>31\.44m<\/b>/.test(chart),
    'reviews two days apart do not write their figures on top of each other; the newer keeps its figure (got ' + figs.join(' ') + ')');
  t.check((chart.match(/class="mgr-jc-r"/g) || []).length === 3 && /Weekly review, 2026-08-29: sales 31,436,660 UGX/.test(chart),
    'and the older keeps its mark, with its figure on hover');

  const render = mgrRender();
  t.check(/held: again \? `held \$\{again \+ 1\} times`/.test(render) && /Answered on the earlier plan that day/.test(render),
    'a day held more than once is one entry, says how many times, and keeps what was answered on the earlier plan');
  const load = extractFunction(src, 'managerLoadState', 'index.html');
  t.check(/earlierAnswered/.test(load) && /if\(meetings\.length < 6\) meetings\.push\(m\)/.test(load),
    'the journal keeps six DAYS, not six rows');
}

/* ---------- 9. one row, two questions ---------------------------------
   Live: the strip said "followed by events 2 of 3" while the table said
   "Event followed 0 · Not landing 4" about the same four rows. What the
   books did and whether the owner answered are two facts. */
{
  const sc = compileScope([extractFunction(src, 'mgrLeverRows', 'index.html'), extractDeclaration(src, 'MGR_LEVER_FILTERS', 'index.html'),
    'function leverFilters(){ return MGR_LEVER_FILTERS; }'],
    { String, Map, Set, trackRecordName: (x) => x.id, trackRecordLine: () => 'line' }, ['mgrLeverRows', 'leverFilters']);
  const track = { rows: [
    { key: 'chase|C106', kind: 'chase', id: 'Mulongo', times: 5, windowed: true, scored: 5, worked: 2 },
    { key: 'chase|C1046', kind: 'chase', id: 'Dad', times: 4, windowed: true, scored: 4, worked: 0 },
    { key: 'price|P051', kind: 'price', id: 'Masasi', times: 5, windowed: false, scored: 0, worked: 0 },
  ] };
  const tally = { passedOn: [], notLanding: ['chase|C106', 'chase|C1046', 'price|P051'].map((key) => ({ key, title: key, times: 5 })) };
  const rows = sc.mgrLeverRows(track, tally);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  t.check(by['chase|C106'].verdict === 'works' && by['chase|C106'].notLanding && by['chase|C1046'].verdict === 'never' && by['chase|C1046'].notLanding,
    'the outcome is the verdict, and "not landing" rides beside it rather than hiding it');
  t.check(by['price|P051'].verdict === 'notlanding', 'advice the books cannot weigh is still called not landing');
  const n = (id) => rows.filter(sc.leverFilters().find((f) => f.id === id).has).length;
  t.check(n('works') === 1 && n('never') === 1 && n('notlanding') === 3,
    'so the filter counts agree with the strip: 1 followed, 1 not, 3 not landing (got ' + n('works') + '/' + n('never') + '/' + n('notlanding') + ')');
  const tallyFn = extractFunction(src, 'managerAdviceTally', 'index.html');
  t.check(/recentlyDone/.test(tallyFn) && /kind: 'advice_already_done'/.test(src) && /Do not put it to them again/.test(src),
    'and the meeting is told what the owner already did, so it stops proposing it as new');
}

process.exit(t.done() ? 1 : 0);
