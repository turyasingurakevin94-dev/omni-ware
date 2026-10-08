#!/usr/bin/env node
'use strict';
/*
 * Three ways the Manager screen was lying with its layout.
 *
 * None of them were wrong arithmetic. Every figure on that screen was
 * correct the whole time. What was wrong was what the screen SAID about
 * its own state — which is the class of defect this app keeps producing,
 * and the class no amount of checking the numbers catches.
 *
 *   THE SENTENCE     The state line ("nothing measures it — it named no
 *                    customer") was emitted INSIDE .mgr-acts, a flex
 *                    row, between the Skip and Discuss buttons, with
 *                    margin-left:auto. It was driven flush against
 *                    Discuss and crowded it — worst on a done or
 *                    skipped card, which has no Skip button for it to
 *                    push against. The owner found this in a screenshot.
 *                    A sentence is not a control and does not belong in
 *                    a row of them.
 *
 *   THE BUTTON       The meeting offer painted "Hold the meeting" in
 *                    accent red on every visit, and then — a moment
 *                    later, when the journal answered — rewrote it to
 *                    "Hold another anyway" and demoted it from red to
 *                    grey. The main action of the screen changed under
 *                    the owner's eyes every single time, which reads as
 *                    an app that cannot make up its mind. The stamp in
 *                    localStorage already knew the answer before any
 *                    query ran.
 *
 *   THE STALE PLAN   Four unawaited chains fill this page and nothing
 *                    cleared what the last render left. Until each
 *                    answered, yesterday's plan sat there looking
 *                    exactly like today's. There was no visual
 *                    difference between "this is your plan" and "this
 *                    is the plan from before you tapped Done".
 *
 * And a fourth, found later and of the same family — the screen saying
 * something about its own state that is not true:
 *
 *   THE RACE         Those same four chains, with thirteen callers,
 *                    several of which fire twice in a row right after a
 *                    write. Two renders are routinely out at once, and
 *                    the one that ANSWERED last won the screen rather
 *                    than the one that STARTED last. Tap Done on a
 *                    move, then Done on the next: if the first render's
 *                    journal read is the slower of the two it paints
 *                    over the second, and the move just marked done is
 *                    drawn open again.
 *
 *                    Beside it, the playbook's read sat in an `else`
 *                    that only ran on the FIRST render — so every
 *                    render after it announced "Reading the journal…"
 *                    and never read. Try it, Stop it and Add all end in
 *                    renderManager, so the panel the owner had just
 *                    acted on stuck on that line until a page reload.
 *
 * Run: node test/manager-screen-defects.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager screen defects');
const src = read('index.html');
const view = extractFunction(src, 'mgrMoveView', 'index.html');
/* The screen is renderManager and the seven bed painters it hands every
   reading to: a pin on "the render" reads all eight. renderManager alone
   is what sends the readings; the Brief is where the plan is drawn. */
const MGR_RENDER = ['renderManager', 'mgrPaintBrief', 'mgrPaintSim', 'mgrPaintTargets', 'mgrPaintPlays',
  'mgrPaintUnusual', 'mgrPaintAsk', 'mgrPaintRecord'];
const render = MGR_RENDER.map(n => extractFunction(src, n, 'index.html')).join('\n');
const rm = extractFunction(src, 'renderManager', 'index.html');
const brief = extractFunction(src, 'mgrPaintBrief', 'index.html');

/* ---------- 1. the sentence has its own line ---------- */
{
  const acts = view.slice(view.indexOf('<div class="mgr-acts">'));
  t.check(!/mgr-state/.test(acts),
    'the state sentence is no longer inside the button row');
  t.check(/class="mgr-move-state"/.test(view),
    'it has a line of its own above the actions');
  t.check(view.indexOf('mgr-move-state') < view.indexOf('<div class="mgr-acts">'),
    'and that line comes BEFORE the buttons, so no auto-margin can drive it into one');
  t.check(/<p class="mgr-move-state"/.test(view),
    'emitted as a paragraph rather than a span, because it is prose');

  /* A NEW class on purpose. .mgr-state is also worn by the playbook's
     "since {date}" chip inside a different .mgr-acts, where the auto
     margin is doing useful work — editing it would have fixed one card
     and quietly restyled another. */
  t.check(/\.mgr-move-state\{[^}]*display:block/.test(src),
    'the new class is a block');
  /* WAS: .mgr-state kept its auto margin for the playbook's "since"
     chip. NOW: the Playbook draws its own cards and no screen emits
     .mgr-state, so Phase 3 deleted the dead rule. */
  t.check(!/class="[^"]*\bmgr-state\b/.test(src) && !/\.mgr-state\{/.test(src),
    'and .mgr-state, which nothing wears any more, is gone from the stylesheet');
  t.check(/\.mgr-move-state\{[^}]*max-width:\d+ch/.test(src),
    'with a measure on it — it is a sentence, and a sentence needs one');
}

/* ---------- 2. the offer is born settled ----------

   THE LAW IS UNCHANGED and it is the whole reason this file exists:
   the main action of the screen must never change under the owner's
   eyes. What changed is what "the offer" is.

   It used to be one button whose COLOUR and WORDS were rewritten when
   the journal answered — red "Hold the meeting" demoted to grey "Hold
   another anyway". The fix then was to paint it from the device's own
   stamp so it was born in the right colour.

   A held morning and an un-held morning are not one control in two
   colours, though; they are two different screens. Held: the plan is
   the answer, and holding a second meeting is a rare, quiet act — a
   ghost button in the panel's footer. Not held: there is nothing on
   the panel at all, and the one thing to do next is the accent, in the
   empty state, where the eye already is. So the shell is chosen from
   the stamp BEFORE any query goes out, and the journal corrects it
   only in the one case the stamp cannot know about. */
{
  t.check(/const heldGuess = !!\(managerToday \|\| lsGet\(MANAGER_MEETING_KEY\) === todayISO\(\)\)/.test(render),
    'the offer reads this device\'s own stamp before it paints anything');

  /* Born in the right SHAPE, which is the stronger form of born in the
     right colour: the two states are drawn by two different helpers and
     neither can become the other. */
  const shell = /planWrap\.innerHTML = heldGuess\s*\?\s*planShell\([\s\S]{0,240}?heldFoot\(null, false\)\)\s*:\s*notHeldHTML\(null, null\);/.exec(brief);
  t.check(!!shell, 'and the panel is born in the shape the stamp says, before the query goes out');
  /* BEFORE it, in two steps now: the shell is the Brief's 'start' paint,
     and renderManager paints 'start' before it sends the journal read. */
  const at = rm.indexOf('managerLoadState().then');
  const startAt = brief.indexOf("if(ctx.landed === 'start'){"), stateAt = brief.indexOf("if(ctx.landed === 'state'){");
  t.check(shell && startAt > -1 && brief.indexOf(shell[0]) > startAt && brief.indexOf(shell[0]) < stateAt
    && rm.indexOf("paint('start');") > -1 && rm.indexOf("paint('start');") < at,
    'BEFORE it, not after it comes back');

  /* The accent lives in exactly one of the two, and it is the one where
     holding a meeting IS the next thing to do. */
  const notHeld = (/const notHeldHTML = [\s\S]*?<\/div>`;/.exec(render) || [''])[0];
  const heldFoot = (/const heldFoot = [\s\S]*?<\/div>`;/.exec(render) || [''])[0];
  t.check(notHeld.length > 400 && heldFoot.length > 200,
    'both shells were found, not silently skipped');
  t.check(/btn-accent[^`]*mgrRunBtn|mgrRunBtn[^`]*Hold the morning meeting/.test(notHeld)
    && /btn btn-accent/.test(notHeld),
    'an un-held morning wears the accent on "Hold the morning meeting"');
  t.check(/Hold another anyway/.test(heldFoot) && !/btn-accent/.test(heldFoot),
    'and a held one offers another as a ghost in the panel\'s footer, never as the accent');

  /* The correction must survive — a meeting held on the owner's other
     device is real, and the stamp cannot know about it. What must not
     survive is correcting a guess that was already right. */
  t.check(/if\(!!st\.today !== heldGuess\)\{/.test(render),
    'the journal only speaks when it DISAGREES with the stamp — on an ordinary morning this branch does nothing');
  t.check(!/rb\.classList\.remove\('btn-accent'\)/.test(render)
    && !/classList\.toggle\('btn-accent'/.test(render),
    'the unconditional demotion is gone, not merely moved');
  t.check(/on another device/.test(render),
    'and when it does correct, it says why rather than silently swapping the button');
}

/* ---------- 3. nothing stale is left on screen ----------

   THE LAW IS UNCHANGED: several unawaited chains fill this page, and
   until each answers, whatever the last render put there is still up —
   so on a slow morning the owner reads yesterday's plan as today's,
   with nothing on screen to say otherwise.

   TWO CONTAINERS OF THE OLD EIGHT ARE GONE, so the list is shorter:
   revWrap folded into the journal (a review and a meeting are the same
   kind of event on the same clock) and passed folded into the levers
   table (a verdict is a column, not a section). Neither exists to go
   stale.

   AND THE ONE SENTENCE MOVED. It used to be printed into whichever
   container happened to be first in the loop, which put "Reading the
   journal…" in the rail. It now sits inside the plan panel, at the top
   of the page where the eye already is, and the loop empties the rest
   in silence — which was always the part that mattered. Saying it in
   every container stacked identical grey lines down the page and the
   screen read as broken rather than as busy. */
{
  t.check(/mgr-reading/.test(render),
    'the page says it is reading rather than leaving the last answer up');
  /* The announcement is inside the plan's own shell, not in the rail. */
  const shellAt = render.indexOf("planShell(`<p class=\"mgr-reading\">");
  t.check(shellAt > -1, 'and it says so in the plan panel, where the eye already is');

  /* LAST KNOWN, NEVER SILENTLY. A box with a last good render shows it
     at once, dimmed, inert and tagged as last known; one without is
     emptied, or -- the one box of its section that should -- says it is
     reading. Either way nothing stale passes for today's.

     WAS: one clearing loop in renderManager naming the five boxes. The
     boxes live in three sections now (Targets, It needs to know, the
     Record), and a section showing alone with nothing in it would be a
     blank page -- so each painter clears its own boxes, through one
     helper, in its 'start' paint, which renderManager sends before the
     journal read goes out. */
  const lk = extractFunction(src, 'mgrLastKnown', 'index.html');
  t.check(/if\(!el \|\| mgrCachePaint\(el\)\) return;/.test(lk) && /el\.innerHTML = say \? '<p class="mgr-reading">Reading the journal…<\/p>' : '';/.test(lk),
    'one helper: last known if there is one, otherwise empty or waiting — never yesterday passed off as today');
  const startOf = (fn) => { const f = extractFunction(src, fn, 'index.html');
    const a = f.indexOf("if(ctx.landed === 'start'){"); return a < 0 ? '' : f.slice(a, f.indexOf('return;', f.indexOf('mgrLastKnown', a)) + 7); };
  [['mgrPaintTargets', 'scoreWrap'], ['mgrPaintAsk', 'qWrap'], ['mgrPaintRecord', 'hist'], ['mgrPaintRecord', 'acct'], ['mgrPaintRecord', 'trackWrap']]
    .forEach(([fn, n]) => t.check(new RegExp(`mgrLastKnown\\(${n}\\b`).test(startOf(fn)), `${n} is cleared in ${fn}'s start paint`));
  t.check(/const trackWrap = document\.getElementById\('managerTrackWrap'\);/.test(extractFunction(src, 'mgrPaintRecord', 'index.html')),
    'including the track record, which is filled by its own chain and would linger longest');
  t.check(rm.indexOf("paint('start');") > -1 && rm.indexOf("paint('start');") < rm.indexOf('managerLoadState().then'),
    'and the start paint runs BEFORE the query goes out, not after it comes back');
  t.check(!/revWrap|managerReviewWrap|\bpassed\b/.test(render),
    'and the two containers that folded into others are gone from the render entirely');
  t.check(/\.mgr-reading\{/.test(src), 'the line has a style, so it reads as a wait rather than as content');

  /* THE VERDICT WAITS OUT LOUD TOO. Four figures painted as 0 while
     the journal is still being read say the manager has done nothing,
     which is a different claim from "not counted yet" and the wrong
     one — the same lie as a stale plan, in a smaller box. */
  t.check(/mgrPaintVerdict\(\{\}\);/.test(render),
    'the verdict strip is painted in its waiting state before the readings go out');
  t.check(/const MGR_WAIT_CELLS = \[[\s\S]*?wait: true/.test(src),
    'with em-dashes rather than zeroes');
  /* WAS: .mgr-verdict .mgr-wait .ow-mt-v; NOW the situation strip's own. */
  t.check(/\.mgr-bed-b \.mgr-b-wait \.mgr-b-sitv\{color:var\(--ow-navy-mute\);\}/.test(src),
    'and in a colour that reads as a wait');
}

/* ---------- 4. the render that started last wins ---------- */
{
  t.check(/let mgrRenderGen = 0;/.test(src), 'the screen holds a render counter');
  t.check(/const gen = \+\+mgrRenderGen;/.test(render), 'and every render takes a ticket from it');
  /* AFTER the early return: a render that paints nothing has no
     business cancelling one that is still painting. */
  t.check(render.indexOf('if(!memoryNote) return;') < render.indexOf('const gen = ++mgrRenderGen;'),
    'taken after the early return, so a render that paints nothing cannot cancel one that does');

  /* Every chain checks the ticket it was issued BEFORE it writes. The
     guard is asserted against each chain by name rather than counted,
     so a fifth reading added without one fails here. */
  ['managerPlaybook().then', 'managerLoadState().then',
   'managerAdviceTally(todayISO()).then', 'managerTrackRecord(todayISO()).then'].forEach(open=>{
    const at = render.indexOf(open);
    t.check(at > -1, `${open} is still one of the screen's readings`);
    t.check(at > -1 && /^[\s\S]{0,140}?if\(gen !== mgrRenderGen\) return;/.test(render.slice(at)),
      `and it drops its answer when it has been overtaken`);
  });

  /* THE ANNOUNCEMENT IS NOT THE READING. */
  /* The read is renderManager's own now, at the top level of the render
     after the one memoryless return -- every render with a journal makes it. */
  t.check(/\n  managerPlaybook\(\)\.then\(book=>\{/.test(rm)
    && rm.indexOf('managerPlaybook().then') > rm.indexOf('if(!managerNotesTable) return;'),
    'the playbook is read on every render, not only the one that found the panel empty');
  t.check(!/else managerPlaybook\(\)/.test(render),
    'so the read no longer sits in a branch the second render cannot reach');
  /* WAS: said only when there was something on screen to replace. The
     playbook is a section of its own now, and an empty one is a blank
     page, so it says it is reading whenever it has no last-known copy. */
  t.check(/else if\(!mgrCachePaint\(playWrap\)\) playWrap\.innerHTML = '<p class="mgr-reading">/.test(render),
    'and the waiting line is said whenever there is no last-known copy to show');

  /* The pace strip on Today is the same shape with a counter of its
     own: sharing one would let a Manager render cancel a pace paint
     and leave a stale figure on the front door. */
  const pace = extractFunction(src, 'renderManagerPace', 'index.html');
  t.check(/let mgrPaceGen = 0;/.test(src) && /const gen = \+\+mgrPaceGen;/.test(pace),
    'the dashboard pace strip counts its own renders');
  t.check(/if\(gen !== mgrPaceGen\) return;/.test(pace),
    'and drops an overtaken scoreboard rather than painting it');
  t.check(!/mgrRenderGen/.test(pace),
    'on a counter of its own, so a Manager render cannot cancel a pace paint');
}

/* ---------- 5. a reading that failed is not a zero ---------- */
{
  /* Every reading on this screen answered a failed query with its own
     empty shape, so a dropped connection said: no advice has been put
     to you, no target has been taken on, no lever has ever been
     weighed, no play is running. Four claims about the shop, made on
     no evidence, on the screen whose whole discipline is never to say
     anything the books do not support. Silence was the worst of them:
     the levers table simply emptied, and the record of everything the
     manager's advice has ever produced read as never having advised
     anything.

     PAINTED, not read for shape. These are the assertions that matter
     most in this file and the easiest to satisfy with code that never
     runs, so the strip is rendered and its words are read back. */
  const esc = (v)=> String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paint = (id, names, state, extra)=>{
    const el = { innerHTML: '', querySelector: ()=> null, querySelectorAll: ()=> [] };
    const scope = compileScope(names.map(n=> n.d
      ? extractDeclaration(src, n.n, 'index.html')
      : extractFunction(src, n.n, 'index.html')), {
      document: { getElementById: (x)=> (x === id ? el : null) },
      esc, String, Number, Object, Array, Boolean, Math, JSON,
      fmtUGX: (n)=> String(n), ...(extra || {}),
    }, names.filter(n=> !n.d).map(n=> n.n));
    scope[names[0].n](state, state && state.tally);
    return el.innerHTML;
  };

  /* WAS: the verdict strip's four journal cells. NOW: the canvas's six-cell
     situation strip (A2.*): five figures from the books and the hit rate
     from the journal. The law is the same and is painted the same way: a
     reading that failed says so in its own cell, never a zero and never
     one of the sentences a count of nothing would make. */
  const VERDICT = [{ n: 'mgrPaintVerdict' }, { n: 'mgrVerdictHTML' }, { n: 'mgrStripCells' },
    { n: 'mgrBriefLamp' }, { n: 'mgrBriefLampHTML' }, { n: 'mgrBriefDay' }, { n: 'mgrShortUGX' },
    { n: 'mgrBriefPhoneCells' }, { n: 'MGR_BRIEF_PHONE_CELLS', d: true },
    { n: 'MGR_WAIT_CELLS', d: true }, { n: 'mgrOf', d: true }, { n: 'MGR_BRIEF_MONTHS', d: true }];
  const STRIP_ENV = { mgrBriefStripOpen: null, mgrBriefWireGo: ()=>{}, mgrBriefStripDetailHTML: ()=> '',
    MGR_WEEKDAYS: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    waWeekday: (d)=> new Date(d + 'T00:00:00Z').getUTCDay() };
  const failed = { message: 'network' };
  const broke = paint('managerStripWrap', VERDICT,
    { strip: { health: { error: failed.message }, walk: null, risks: null, hit: { error: failed.message },
      upside: { error: failed.message }, free: { error: failed.message } } }, STRIP_ENV);
  const lies = ['nothing found to lift', 'nothing tied up', 'nothing dated', 'nothing done can be weighed',
    'trend after 7 days', 'followed by a payment'];
  lies.forEach(lie=> t.check(!broke.includes(lie),
    `a failed reading never says "${lie}"`));
  /* WAS: one strip of six cells. NOW: two designs from the same cells --
     the desk's six and the phone's four (health, lowest cash, upside, hit
     rate; mgrBriefPhoneCells) -- so each is counted on its own. */
  const desk = (h)=> h.split('mgr-b-sit mgr-b-sit4')[0];
  const phone = (h)=> h.split('mgr-b-sit mgr-b-sit4')[1] || '';
  t.check((desk(broke).match(/could not be read/g) || []).length === 6,
    'all six cells say what happened instead of counting it');
  t.check((phone(broke).match(/could not be read/g) || []).length === 4,
    'and so do the phone\'s four');
  t.check(!/>0</.test(broke) && !/mgr-b-fig">0</.test(broke), 'and not one of them shows a zero');
  const waiting = paint('managerStripWrap', VERDICT, {}, STRIP_ENV);
  t.check((desk(waiting).match(/&mdash;/g) || []).length === 6 && (desk(waiting).match(/reading the/g) || []).length === 6 && !/>0</.test(waiting),
    'before anything is read the six cells wait with em-dashes, saying they are reading');
  t.check((phone(waiting).match(/&mdash;/g) || []).length === 4 && (phone(waiting).match(/reading the/g) || []).length === 4,
    'and the phone\'s four wait the same way');

  /* AND THE FIGURES STILL ARRIVE when the reading worked -- an error
     branch that swallows the happy path passes every check above. */
  const good = paint('managerStripWrap', VERDICT,
    { strip: { health: { score: 70, known: 10, passed: 7, checks: [] }, trend: null,
      walk: { opening: 5000000, tightest: { date: '2026-10-14', balance: 1350000 } }, floor: { amount: 2000000, source: 'set' },
      upside: { total: 2400000, parts: [] }, free: { total: 6400000, parts: [], expected: { amount: 0, list: [] } },
      risks: [{ overdue: false }, { overdue: true }], hit: { k: 11, n: 15, notMeasurable: 2, waiting: 0, misses: [] } } }, STRIP_ENV);
  t.check(/11<span class="of">of<\/span>15/.test(good) && />1\.35m</.test(good) && /Wed 14 Oct/.test(good)
    && />\+2\.4m</.test(good) && />6\.4m</.test(good) && />70</.test(good), 'a reading that worked still counts');
  t.check(/mgr-b-lamp-bad/.test(good) && /under your floor of 2m/.test(good),
    'and the lowest day under the floor lights its lamp, saying against which floor');
  t.check(!/could not be read/.test(good), 'and says nothing about a failure that did not happen');
  /* The phone's four are the canvas's: health, lowest cash, upside found,
     hit rate -- the same figures as the desk's cells, in that order. */
  const four = phone(good);
  t.check(/>70</.test(four) && />1\.35m</.test(four) && />\+2\.4m</.test(four) && /11<span class="of">of<\/span>15/.test(four)
    && !/>6\.4m</.test(four) && four.indexOf('>70<') < four.indexOf('>1.35m<') && four.indexOf('>1.35m<') < four.indexOf('>+2.4m<'),
    'the phone shows the canvas\'s four, in its order, with the desk\'s figures');
  t.check(/each in its window/.test(good), 'and the hit rate says which window it was weighed in');

  /* The account's advice half, and the levers table that used to go
     silent. */
  const acct = paint('mgrAcctAdvice', [{ n: 'mgrPaintAcctAdvice' }],
    { tally: { error: 'network' } });
  t.check(/could not be read/.test(acct) && !/Moves put to you/.test(acct),
    'the account says the advice could not be read rather than showing four zeroes');
  t.check(/counted from your books and stand/.test(acct),
    'and says which figures on the panel are still good');

  const lev = paint('managerTrackWrap', [{ n: 'mgrPaintLevers' }], { tally: { error: 'network' } });
  t.check(/could not be read/.test(lev),
    'the levers table says so rather than emptying, which read as "it has never advised anything"');
  t.check(/Nothing has been lost/.test(lev),
    'and that nothing was lost, because the table is counted afresh every time it is shown');

  /* The three readings carry the error home in the first place. The
     scoreboard has done this since it was written; these joined it. */
  ['managerPlaybook', 'managerTrackRecord', 'managerAdviceTally'].forEach(n=>{
    const fn = extractFunction(src, n, 'index.html');
    t.check(/error: r\.error\.message/.test(fn),
      `${n} hands the failure back rather than an empty shape`);
  });
  t.check(/book\.error \?/.test(render), 'and the playbook panel says it rather than "no play is running"');
}

/* ---------- last known, tagged and inert, until the fresh reading ----- */
{
  const paint = extractFunction(src, 'mgrCachePaint', 'index.html');
  t.check(/el\.classList\.add\('mgr-stale'\)/.test(paint) && /mgr-stale-tag/.test(paint) && /updating…/.test(paint),
    'a last-known box is marked as such and says it is updating');
  t.check(/if\(!el\.querySelector\('\.mgr-stale-tag'\)\) el\.classList\.remove\('mgr-stale'\)/.test(paint),
    'and the marking goes the moment the fresh reading replaces it');
  t.check(/\.mgr-stale > \*:not\(\.mgr-stale-tag\)\{opacity:\.55;pointer-events:none;/.test(src),
    'dimmed and not clickable meanwhile — a last-known button must not act on a stale row');
  const save = extractFunction(src, 'mgrCacheSave', 'index.html');
  t.check(/classList\.contains\('mgr-stale'\)/.test(save) && /querySelector\('\.mgr-reading'\)/.test(save),
    'only a fresh, finished render is kept — never a stale copy or a waiting line');
  /* WAS: mgrCacheSave() directly before the strip's waiting paint. Every
     bed repaints from the one 'start' paint now, so the save comes before
     that, and before anything at all is cleared. */
  t.check(/if\(managerNotesTable\) mgrCacheSave\(\);/.test(rm)
    && rm.indexOf('mgrCacheSave();') < rm.indexOf("paint('start');"),
    'what was on screen is kept before the next render clears it');
}

process.exit(t.done() ? 1 : 0);
