#!/usr/bin/env node
'use strict';
/*
 * The Manager's two pictures: an eight-week trend beside two of the
 * verdict figures, and a pace chart in place of a running target's bar.
 *
 * Pinned: what each draws from, that a week with nothing advised is a
 * gap and not a zero, that a LEVEL target draws no path the books do
 * not hold, that "at this rate" never goes below nothing, and that the
 * figures it shows are the ones the text under it already says.
 *
 * Run: node test/manager-charts.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager charts');
const src = read('index.html');
/* The Manager screen is renderManager and the seven bed painters it hands
   every reading to (mgrPaint<Bed>), so a pin on "the render" reads all
   eight: what used to sit in one function is drawn by the bed it belongs to. */
const MGR_RENDER = ['renderManager', 'mgrPaintBrief', 'mgrPaintSim', 'mgrPaintTargets', 'mgrPaintPlays',
  'mgrPaintUnusual', 'mgrPaintAsk', 'mgrPaintRecord'];
const mgrRender = () => MGR_RENDER.map((n) => extractFunction(src, n, 'index.html')).join('\n');
const TODAY = '2026-09-24';
const day = (n) => new Date(Date.parse(TODAY) + n * 86400000).toISOString().slice(0, 10);
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtUGX = (n) => Number(n).toLocaleString('en-US') + ' UGX';

/* ---------- 1. the weekly reading ------------------------------------- */
(async () => {
  {
    const rows = [
      { date: day(0), status: 'done', body: { title: 'a', mkind: 'chase', subject: { customerId: 1 } } },
      { date: day(-1), status: 'open', body: { title: 'b', mkind: 'other' } },
      { date: day(-9), status: 'done', body: { title: 'c', mkind: 'buy', subject: { key: 'P1' } } },
      { date: day(-9), status: 'skipped', body: { title: '' } },          // untitled: not advice
      { date: day(-80), status: 'done', body: { title: 'old' } },         // outside the eight weeks
    ];
    const { managerAdviceWeeks } = compileScope([
      extractFunction(src, 'managerAdviceWeeks', 'index.html'),
      extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
      extractFunction(src, 'anShiftDate', 'index.html'),
      extractDeclaration(src, 'MGR_TREND_WEEKS', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
    ], {
      managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
      deriveMoveOutcome: (row) => ({ happened: row.body.mkind === 'chase' }),
      sb: { from: () => { const q = { select: () => q, eq: () => q, gte: () => q, order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }) }; return q; } },
      Date, String, Number, Math,
    }, ['managerAdviceWeeks']);
    const w = (await managerAdviceWeeks(TODAY)).weeks;
    t.check(w.length === 8 && w[7].current && w[7].to === TODAY, 'eight weeks, the last ending today and marked as still running');
    t.check(w[7].proposed === 2 && w[7].done === 1, 'this week: two advised, one done (got ' + w[7].proposed + '/' + w[7].done + ')');
    t.check(w[7].scored === 1 && w[7].followed === 1, 'and only the kinds with a dated answer are weighed for what followed');
    t.check(w[6].proposed === 1 && w[6].scored === 1 && w[6].followed === 0, 'last week: the untitled row is not advice');
    t.check(w.reduce((n, x) => n + x.proposed, 0) === 3, 'and nothing older than eight weeks is counted');
  }

  /* ---------- 2. the sparkline ----------------------------------------- */
  {
    const { mgrSparkHTML } = compileScope([extractFunction(src, 'mgrSparkHTML', 'index.html')],
      { esc, fmtShortDate: (d) => d.slice(5), Math }, ['mgrSparkHTML']);
    const weeks = Array.from({ length: 8 }, (_, i) => ({ from: day(-7 * (7 - i) - 6), current: i === 7,
      proposed: i === 2 ? 0 : 4, done: i === 2 ? 0 : i % 4 }));
    const svg = mgrSparkHTML(weeks, 'done', 'proposed', 'done');
    t.check((svg.match(/mgr-spark-track/g) || []).length === 7 && (svg.match(/mgr-spark-gap/g) || []).length === 1,
      'one column per week: a full-height track for each week with advice, a baseline tick for the one without');
    const zero = svg.split('<g>').find((g) => /Week of [\d-]+: 0 of 4 done/.test(g)) || '';
    t.check(/mgr-spark-track/.test(zero) && !/mgr-spark-bar|mgr-spark-now/.test(zero),
      'a week where nothing advised was done is an EMPTY track — not the same mark as a week with nothing advised');
    t.check(/class="mgr-spark-gap"><title>Week of [\d-]+: nothing advised<\/title>/.test(svg),
      'a week with nothing advised is a gap that says so, not a zero');
    t.check((svg.match(/mgr-spark-now/g) || []).length === 1 && /This week so far: 3 of 4 done/.test(svg),
      'the running week is drawn apart and called "so far"');
    t.check(/aria-label="Last 8 weeks, done: /.test(svg), 'and the whole trend is read out for a screen reader');
    t.check(mgrSparkHTML(weeks.map((x) => ({ ...x, proposed: 0 })), 'done', 'proposed', 'done') === '',
      'eight empty weeks draw nothing at all');
  }

  /* ---------- 3. the running target's track ---------------------------- */
  /* WAS: a pace chart per running target (managerTargetSeries, mgrPaceHTML),
     a line per recorded day with a hover. NOW (the Targets canvas): one
     track per running target, on one scale from where it started to its
     aim -- the fill where it is, the tick where the road has it today, the
     ring where it lands at this rate, the dot where the plan lands it by
     the Manager's sizing -- and the same said in words for a screen
     reader. */
  {
    const T = ['mgrTgRowHTML', 'mgrTgName', 'mgrTgFig', 'mgrTgGap', 'mgrTgAvHTML', 'mgrTgTrack'];
    const s = compileScope([
      ...T.map((n) => extractFunction(src, n, 'index.html')),
      ...['mgrTgDay', 'mgrTgBetter', 'MGR_TG_GLYPH', 'MGR_TG_STATE_WORD', 'MGR_TG_STATE_TONE'].map((n) => extractDeclaration(src, n, 'index.html')),
    ], { MANAGER_METRICS: { collections: { label: 'Collect', unit: 'ugx', kind: 'flow', direction: 'up' } },
      esc, todayISO: () => TODAY, waDaysBetween: (a, b2) => Math.round((Date.parse(b2) - Date.parse(a)) / 86400000), Math, Number, String, Date },
    ['mgrTgRowHTML', 'mgrTgTrack']);
    /* Collect 8.0m by 2 Oct, 5.2m in, the road at 4.8m today: 65% there, the
       road at 60%; 8.3m at this rate and 9.0m with the plan both run off the
       end of the scale and sit on it. */
    const x = { id: 41, metric: 'collections', measure_kind: 'flow', direction: 'up', aim: 8000000, baseline: 0, actual: 5200000,
      from: day(-14), to: day(8), days_left: 8, finished: false, pace: { expected: 4800000, on_course: true, behind_by: 0, total_days: 23 } };
    const track = s.mgrTgTrack(x, 8300000, 9000000);
    const html = s.mgrTgRowHTML({ x, m: { unit: 'ugx', kind: 'flow', direction: 'up' }, state: { key: 'on', behind: 0, toGo: 2800000, share: 0 },
      key: 'on', brk: null, links: [{ id: 107, num: '01', title: 'Keep chasing — Kato first' }], land: 8300000, planLand: 9000000,
      past: { len: 23 }, odds: { k: 9, n: 11, pct: 82 }, oddsPlan: { k: 10, n: 11, pct: 91 }, landsAlone: true, wrongWay: false, two: false,
      track, person: { key: 'you', name: 'You' } });
    t.check(/<i class="mgr-tg-f mgr-tg-t-vg" style="width:65\.0%">/.test(html), 'where it is: 5.2m of 8.0m is 65% of the way, in the colour of its state');
    t.check(/<em class="mgr-tg-pc" style="left:60\.0%"/.test(html), 'where the road has it today: 4.8m is 60%');
    t.check(/class="mgr-tg-rg" style="left:100\.0%"/.test(html) && /class="mgr-tg-pl" style="left:100\.0%"/.test(html),
      'where it lands at this rate and with the plan — past the aim, drawn at the end');
    t.check(/role="img" aria-label="Collect 8\.00m: 5\.20m now; the road has it at 4\.80m today; 8\.30m at this rate; 9\.00m if the moves deliver my sizing\."/.test(html),
      'and the track says in words what it shows');
    t.check(/>82%<\/span><small class="mgr-tg-plan">91% with my sizing<\/small>/.test(html) && /Reached in 9 of 11 past 23-day periods before it began/.test(html),
      'the odds are a count of past periods, beside the same count if the moves deliver the Manager\u2019s sizing');
    t.check(/data-tg-move="107">Decision 01 →<\/button>/.test(html), 'the move that closes the gap links to its decision');
    t.check(/aria-expanded="false" data-tg-rule="41">On track<\/button>/.test(html) && /less than a third of what is still to go/.test(html),
      'and the state is a tap that says the rule it was called by');
  }

  /* ---------- 3b. one proposal per measure ----------------------------- */
  {
    const rows = [
      { id: 9, status: 'proposed', date: '2026-09-20', body: { metric: 'gross_profit', aim: 1400000, why: 'newest' } },
      { id: 7, status: 'proposed', date: '2026-09-19', body: { metric: 'gross_profit', aim: 1400000, why: 'older copy' } },
      { id: 6, status: 'proposed', date: '2026-09-19', body: { metric: 'collections', aim: 2500000, why: 'c' } },
      { id: 5, status: 'proposed', date: '2026-09-18', body: { metric: 'sales', aim: 9, why: 's' } },
      { id: 4, status: 'open', date: '2026-09-21', body: { metric: 'sales', aim: 9, from: '2026-09-21', to: '2026-09-27' } },
    ];
    const { managerScoreboard } = compileScope([
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'anShiftDate', 'index.html'),
    ], {
      managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
      MANAGER_METRICS: { gross_profit: { label: 'Gross profit' }, collections: { label: 'Collect' }, sales: { label: 'Sales' } },
      managerScoreProgress: (x) => ({ metric: x.body.metric }),
      sb: { from: () => { const q = { select: () => q, eq: () => q, order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }) }; return q; } },
      Date, String, Number, Map, Set,
    }, ['managerScoreboard']);
    const sb2 = await managerScoreboard();
    const gp = sb2.proposed.filter((x) => x.metric === 'gross_profit');
    t.check(gp.length === 1 && gp[0].id === 9 && gp[0].dupIds.join() === '7',
      'two copies of one proposal show as one, the newest, carrying the older as a duplicate');
    t.check(!sb2.proposed.some((x) => x.metric === 'sales'), 'a measure already running is not proposed again');
    t.check(sb2.proposed.length === 2, 'and the rest are untouched');
    /* The Targets section draws through mgrTgDraw, which wires the cards. */
    const render = mgrRender() + extractFunction(src, 'mgrTgDraw', 'index.html');
    t.check(/managerAdoptTarget\(id, dups\)/.test(render) && /managerDeclineTarget\(id, dups\)/.test(render)
      && /await managerRetireDuplicates\(dupIds\);/.test(extractFunction(src, 'managerAdoptTarget', 'index.html'))
      && /await managerRetireDuplicates\(dupIds\);/.test(extractFunction(src, 'managerDeclineTarget', 'index.html')),
      'answering the newest retires its older copies, whichever way it was answered');
  }

  /* ---------- 3c. a cut-off meeting carries on by itself, once --------- */
  {
    const meet = extractFunction(src, 'runManagerMeeting', 'index.html');
    t.check(/apAutoResume = true;\s*await apRunLoop\(\);\s*apAutoResume = false;\s*if\(apWasCutOff && !apLastPlan\)\{ apPushResume\('\[plan: …\]'\); await apRunLoop\(\); \}/.test(meet),
      'a meeting cut off before its plan resumes once, and a second cut-off falls back to asking');
    const rev = extractFunction(src, 'runManagerReview', 'index.html');
    t.check(/if\(apWasCutOff && !apLastReview\)\{ apPushResume\('\[review: …\]'\); await apRunLoop\(\); \}/.test(rev),
      'and so does a review cut off before its verdict');
    const loop = extractFunction(src, 'apRunLoop', 'index.html');
    t.check(/if\(apAutoResume\)\{\s*apBubble\('bot', esc\('I ran out of room mid-answer — picking up where I stopped/.test(loop),
      'while it carries on, the panel says so instead of asking for "continue"');
    const push = extractFunction(src, 'apPushResume', 'index.html');
    t.check(/Resume from where it stopped/.test(push) && /apWasCutOff = false;/.test(push),
      'the resume turn is the same sentence the owner\'s own "continue" sends');
  }

  /* ---------- 3d. one proposal per play ------------------------------ */
  {
    const rows = [
      { id: 30, status: 'proposed', date: '2026-09-20', body: { name: 'Retire the stale fixed markups on the top sellers', treats: 'margin' } },
      { id: 28, status: 'proposed', date: '2026-09-19', body: { name: 'Retire the stale fixed markups on the top sellers.', treats: 'margin' } },
      { id: 27, status: 'proposed', date: '2026-09-19', body: { name: 'Buy Masasi at the rung', treats: 'supplier_cost' } },
      { id: 26, status: 'proposed', date: '2026-09-18', body: { name: 'Charge for cutting', treats: 'margin' } },
      { id: 20, status: 'running', date: '2026-09-10', body: { name: 'Charge for cutting', treats: 'margin', startedOn: '2026-09-11' } },
    ];
    const { managerPlaybook } = compileScope([extractFunction(src, 'managerPlaybook', 'index.html')], {
      managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
      MANAGER_PROBLEMS: { margin: 'Margin', supplier_cost: 'Supplier cost' },
      managerPlayProgress: () => null, managerPlayClock: () => null,
      sb: { from: () => { const q = { select: () => q, eq: () => q, order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }) }; return q; } },
      console, String, Number, Math, Map, Set,
    }, ['managerPlaybook']);
    const book = await managerPlaybook();
    const retire = book.proposed.filter((p) => /Retire the stale/.test(p.name));
    t.check(retire.length === 1 && retire[0].id === 30 && retire[0].dupIds.join() === '28',
      'a play proposed twice shows once, the newest, with the older copy carried to be retired (a trailing full stop is the same play)');
    t.check(!book.proposed.some((p) => p.name === 'Charge for cutting'), 'a play already running is not proposed again beside itself');
    t.check(book.proposed.length === 2 && book.running.length === 1, 'and the rest are untouched');
    const status = extractFunction(src, 'managerPlayStatus', 'index.html');
    t.check(/async function managerPlayStatus\(rowId, status, dupIds\)/.test(status)
      && /if\(status === 'running' \|\| status === 'dropped'\) await managerRetireDuplicates\(dupIds\);/.test(status),
      'trying it or setting it aside retires the older copies too');
    t.check(/managerPlayStatus\(id, status, dups\)/.test(mgrRender()),
      'and the row hands its copies to that answer');
  }

  /* ---------- 3e. a meeting that stopped short says so ------------------ */
  {
    const render = mgrRender();
    t.check(/const cutShort = \(\)=> apMode === 'manager' && apWasCutOff && !managerCommittedPlan && !assistantBusy;/.test(render),
      'a manager sitting cut off before any plan was kept is told apart from no meeting at all');
    t.check(/const notHeldHTML = \(weekMeetings, last\)=> cutShort\(\) \? unfinishedHTML\(\) :/.test(render)
      && /ran out of room before its plan/.test(render) && /<span class="ow-pan-n">unfinished<\/span>/.test(render),
      'and the plan panel says the meeting is unfinished instead of "not held"');
    t.check(/id="mgrFinishBtn">Finish the meeting<\/button>/.test(render)
      && /finBtn\.addEventListener\('click', \(\)=>\{ apOpenPanel\(\); apSend\('continue'\); \}\);/.test(render),
      'with one button that finishes it — "continue", sent for the owner');
  }

  /* ---------- 4. wiring ------------------------------------------------ */
  {
    const render = mgrRender() + ['mgrTgDraw', 'mgrTgRunningHTML', 'mgrTgClick'].map((n) => extractFunction(src, n, 'index.html')).join('\n');
    /* WAS: a running target's pace chart, a finished one's bar. NOW: every
       running target is a row on the track; the finished ones are history. */
    t.check(/runs\.map\(mgrTgRowHTML\)/.test(render) && /mgrTgFinishedHTML\(finished\)/.test(render),
      'every running target is drawn on its track; the finished ones as history');
    t.check(/managerAdviceWeeks\(todayISO\(\)\)\.then/.test(render), 'the weeks are read beside the other verdict readings');
    const paint = extractFunction(src, 'mgrPaintVerdict', 'index.html');
    /* Advice done became a square per piece of advice (a share of a
       whole); the trend stays with the figure that is about change. */
    t.check(/if\(wk && !cells\[2\]\.wait\) cells\[2\]\.spark/.test(paint)
      && /cells\[0\]\.viz = mgrWaffleHTML\(/.test(paint),
      'the trend rides beside a figure only once that figure is read, and advice done is drawn as its whole');
    t.check(!/cells\[1\]\.spark|cells\[3\]\.spark|cells\[0\]\.spark/.test(paint), 'and no other figure carries a weekly line — there it would be noise');
    /* WAS: one hover for every pace chart. NOW: the state chip opens the
       rule it was called by, in place. */
    t.check(/if\(d\.tgRule\)\{/.test(render) && /why\.hidden = !why\.hidden;/.test(render),
      'the state chip opens the rule it was called by');
  }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
