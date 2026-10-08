#!/usr/bin/env node
'use strict';
/*
 * The Manager screen stops being a scroll and becomes a record.
 *
 * The conversation was never going to live here. Embedding a chat in
 * this screen means a second chat implementation beside the one behind
 * Ctrl+J -- two things that drift -- and it would make the brain
 * reachable from one screen instead of all forty. The panel already
 * works everywhere. So this screen keeps the part the panel cannot
 * hold: what was advised, what came of it, what never lands, and the
 * rules that grew out of it.
 *
 * Three things are pinned here, and a fourth that is not about this
 * screen at all:
 *
 *   THE DOOR       "Talk to it" opens the panel and does NOTHING else.
 *                  In particular it does not set apMode -- 'manager' is
 *                  an OCCASION, not a channel: the run loop commits a
 *                  plan to the journal when a manager turn ends, and
 *                  skips seeding the day. A question asked down that
 *                  path would write a plan out of a question.
 *
 *   THE BEDS       Every container is a flat, id-addressed div in
 *                  exactly one of seven beds -- Brief, Simulator,
 *                  Targets, Playbook, Out of the ordinary, It needs to
 *                  know, Record -- and the nav shows one by a class on
 *                  the section. Every wrap is CLASSED (.mgr-slot) rather
 *                  than reached with `> *`, because a universal selector
 *                  is a selector that has left its namespace.
 *
 *   THE HEADINGS   .mgr-sec-title was 12.5px uppercase tracked grey --
 *                  the identical treatment .field label gets. "THE
 *                  SCOREBOARD" and a form's "Amount" carried the same
 *                  weight. A heading is not a field label.
 *
 *   THE PHONE'S TITLE BAR is the fourth, and it is here because this
 *                  session is where the bill for it arrived.
 *                  updateMobileTopbarTitle reads ONE idiom -- a
 *                  .page-head with an h1 in it -- and ends `h1 ?
 *                  h1.textContent : ''`. When Today was rebuilt with
 *                  .ow-ph, no selector matched and the phone's title
 *                  bar went blank on the app's front door, silently,
 *                  for a whole release. So: every screen must resolve a
 *                  title through the selectors that function actually
 *                  uses. A new title idiom is now a failing test rather
 *                  than an empty bar nobody notices.
 *
 * Run: node test/manager-record.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('manager record');
const src = read('index.html');

/* ---------- 1. the door to the conversation ---------- */
{
  const render = extractFunction(src, 'renderManager', 'index.html');
  t.check(/id="mgrTalkBtn"/.test(src), 'the record offers a way into the conversation');
  t.check(/getElementById\('mgrTalkBtn'\)/.test(render) &&
          /talkBtn\.addEventListener\('click', apOpenPanel\)/.test(render),
    'and it opens the panel that already exists — there is no second chat on this screen');
  t.check(!/mgrTalkBtn[\s\S]{0,400}?apMode\s*=/.test(render),
    'without setting apMode: a meeting is an occasion, and a question is not one');
  t.check(/function apOpenPanel\(\)\{/.test(src),
    'and the function it calls is the app\'s own, not a new one');

  const ph = (/<div class="ow-ph">[\s\S]*?<\/div>/.exec(
    src.slice(src.indexOf('<section id="tab-manager"')))|| [''])[0];
  t.check(/ow-ph-t">The Manager</.test(ph),
    'the screen carries the name the owner chose, the same name the brain has everywhere');
  t.check(ph.indexOf('mgrTalkBtn') > ph.indexOf('ow-ph-sub'),
    'with the button on the right of the header rather than buried in the sections');
}

/* ---------- 2. seven beds, and every container still found by id ----------

   WHAT THIS BLOCK USED TO SAY, and why it stopped being true.

   It pinned fifteen wraps: three above a three-way switch (the verdict,
   the switch, the memory note) and twelve in three beds -- standing,
   the record, the map -- each wrap wearing its bed's class, the whole
   laid into one .ow-grid. That was the right test for a screen that
   asked two questions and drew one picture.

   The Manager the owner approved asks seven: the canvas's six sections
   and the record kept after them (Q26) -- Brief, Simulator, Targets,
   Playbook, Out of the ordinary, It needs to know, Record. So:

     - four wraps are GONE and nothing in them is lost: the band
       (managerHeroWrap) is the Brief's band, the verdict strip
       (managerVerdictWrap) is the Brief's situation strip, the map
       (managerMapWrap) is the Brief's department board, and the
       scoreboard (managerScoreWrap) is the Targets section.
     - ten are NEW: the Brief's band, strip, department board, chains,
       next 30 days, simulator teaser, memory and blind spots, and the
       Simulator's and the Targets' own wraps.
     - a bed is ONE container holding its wraps, rather than a class
       repeated on each, so a bed's markup is one block a later change
       can own whole; and the switch is a seven-section nav.

   WHAT IS STILL PINNED is what mattered then and still does: every
   container is a flat, id-addressed div that its painter finds by
   getElementById, so no wrapper comes between a paint and its container;
   every wrap belongs to exactly one bed, so the nav can never leave a
   container showing in two sections or in none; and every wrap that
   exists is filled, and every wrap filled exists. */
{
  const sec = src.slice(src.indexOf('<section id="tab-manager"'),
                        src.indexOf('<section id="tab-map"'));
  const kids = [...sec.matchAll(/<div id="(manager[A-Za-z]+)"([^>]*)>/g)];
  const ids = kids.map(k => k[1]);
  /* SEVEN BEDS, AND NOTHING IN TWO. The wraps each bed holds, in the
     order the canvas lays them out.
     ONE ENTRY PER BED, A LINE BETWEEN EACH. Each section is rebuilt by
     its own hand later, and two edits on touching lines are a merge
     conflict even when they mean nothing to each other: a bed that
     gains or loses a wrap edits its own entry here and nothing else --
     the count below is worked out from these entries, not typed. */
  const BEDS = {
    b: ['managerBandWrap', 'managerStripWrap', 'managerDeptWrap', 'managerChainWrap', 'managerPlanWrap',
        'managerForesightWrap', 'managerSimTeaserWrap', 'managerMemoryWrap', 'managerBlindWrap'],

    x: ['managerSimWrap'],

    t: ['managerTargetsWrap'],

    p: ['managerPlaysWrap'],

    u: ['managerUnusualWrap'],

    k: ['managerQuestionsWrap'],

    r: ['managerHistoryWrap', 'managerTrackWrap', 'managerGrowthWrap', 'managerAccountWrap', 'managerPoliciesWrap'],
  };
  /* Two above the nav (the memory note and the nav), the rest in the beds.
     WAS: a literal 21, on one line every bed's change would have had to edit. */
  const bedWraps = Object.values(BEDS).flat().length;
  t.check(ids.length === 2 + bedWraps, `every container is a flat div with an id (${ids.length} of ${2 + bedWraps})`);

  /* The retired, named rather than merely absent: a wrap that comes back
     by accident is a section that renders into nothing. */
  ['managerReviewWrap', 'managerPassedWrap', 'managerHeroWrap', 'managerVerdictWrap', 'managerMapWrap', 'managerScoreWrap']
    .forEach(id => {
      t.check(!ids.includes(id) && !new RegExp(`getElementById\\('${id}'\\)`).test(src),
        `${id} is gone from the markup AND from the render — what it held lives in a bed now`);
    });
  t.check(ids[0] === 'managerMemoryNote' && ids[1] === 'managerViewWrap',
    'the memory note and the nav stand above every bed');

  /* Every container the render fills must exist, and every container
     that exists must be filled. Either half alone is a section that
     silently does nothing. */
  const filled = [...src.matchAll(/getElementById\('(manager[A-Za-z]+)'\)/g)].map(m => m[1]);
  const orphanWrap = ids.filter(id => !filled.includes(id));
  t.check(orphanWrap.length === 0,
    `every wrap on the screen is filled by the render${orphanWrap.length ? ' — never: ' + orphanWrap.join(', ') : ''}`);
  const orphanFill = [...new Set(filled)].filter(id => !ids.includes(id) && /Wrap$|Note$/.test(id));
  t.check(orphanFill.length === 0,
    `and nothing is rendered into a container that is not there${orphanFill.length ? ' — missing: ' + orphanFill.join(', ') : ''}`);

  const opens = [...sec.matchAll(/<div class="mgr-bed mgr-bed-([a-z])"/g)];
  t.check(opens.map(m => m[1]).join('') === 'bxtpukr',
    `seven beds, in the nav's order (${opens.map(m => m[1]).join('')})`);
  const found = {};
  opens.forEach((m, i) => {
    const body = sec.slice(m.index, i + 1 < opens.length ? opens[i + 1].index : sec.length);
    found[m[1]] = [...body.matchAll(/<div id="(manager[A-Za-z]+)"/g)].map(x => x[1]);
  });
  Object.entries(BEDS).forEach(([bed, want]) => t.check(JSON.stringify(found[bed]) === JSON.stringify(want),
    `mgr-bed-${bed} holds ${want.join(', ')}${JSON.stringify(found[bed]) === JSON.stringify(want) ? '' : ' — found ' + (found[bed] || []).join(', ')}`));
  const bedded = Object.values(found).flat();
  t.check(bedded.length === ids.length - 2 && new Set(bedded).size === bedded.length,
    `every wrap but the two above the nav is in exactly one bed (${bedded.length} of ${ids.length - 2})`);
  t.check(opens.length && sec.indexOf('id="managerViewWrap"') < opens[0].index,
    'and the nav comes before every bed');
  t.check(kids.slice(2).every(k => /class="mgr-slot\b/.test(k[2])),
    'every bedded wrap is a slot, so one with nothing to say takes no room');
  /* The verdict strip moved into the Brief, where the canvas has its
     situation strip: it is painted into managerStripWrap now. */
  t.check(/function mgrPaintVerdict\(state\)\{\s*const el = document\.getElementById\('managerStripWrap'\);/.test(src),
    'the verdict strip is drawn into the Brief\'s situation strip');

  /* The nav is the ONLY thing that decides which bed shows, and it
     decides it by a class on the section rather than by re-rendering:
     a bed that had to be re-read on every tap would spend a query on a
     section the owner may only be glancing at. */
  const flat = src.replace(/\s*\n\s*/g, '');
  t.check(/#tab-manager\.mgr-on-brief \.mgr-bed-b,#tab-manager\.mgr-on-sim \.mgr-bed-x,#tab-manager\.mgr-on-targets \.mgr-bed-t,#tab-manager\.mgr-on-plays \.mgr-bed-p,#tab-manager\.mgr-on-unusual \.mgr-bed-u,#tab-manager\.mgr-on-ask \.mgr-bed-k,#tab-manager\.mgr-on-record \.mgr-bed-r\{display:flex;\}/.test(flat),
    'the nav shows a bed with one class on the section, not with a second read of the journal');
  t.check(/\.mgr-bed\{display:none;/.test(flat), 'and every bed is hidden until it does');
  t.check(/\.mgr-slot:empty\{display:none;\}/.test(flat),
    'an empty container is removed rather than left holding a gap in the stack — several are empty on an ordinary week');

  /* The record keeps the console's own two-column layout: the journal
     and the levers are the work, the account and the rules stand beside
     them. */
  const rec = sec.slice(sec.indexOf('<div class="mgr-bed mgr-bed-r"'));
  t.check(/<div class="ow-grid">[\s\S]*?<div class="ow-stack">[\s\S]*?<div class="ow-side">/.test(rec),
    'the record lays out on .ow-grid + .ow-side, the pair every other console screen uses');
}

/* ---------- 3. a heading is not a field label ----------
   WAS: the .mgr-sec-title rule was pinned (15px, not uppercase, not a
   form label's treatment).
   NOW: no screen emits .mgr-sec-title any more -- every Manager section
   is headed by the console panel's own title, .ow-pan-t -- and Phase 3
   deleted the dead rule. What the pin protected still holds: the
   heading is the console's, never a form label's. */
{
  t.check(!/\.mgr-sec-title\{/.test(src) && !/class="[^"]*\bmgr-sec-title\b/.test(src),
    'the retired .mgr-sec-title is neither emitted nor styled');
  t.check(/<span class="ow-pan-t">/.test(src), 'the Manager\'s sections are headed by the console panel title');
  t.check(!/<label[^>]*class="[^"]*ow-pan-t/.test(src), 'and never by a form label');
}

/* ---------- 4. no screen has a blank title bar on the phone ---------- */
{
  const fn = extractFunction(src, 'updateMobileTopbarTitle', 'index.html');
  const sel = (/querySelector\(([^)]*)\)/.exec(fn) || ['', ''])[1];
  t.check(/ow-ph-t/.test(sel),
    'the phone\'s title bar knows the console\'s page header — the idiom Today was rebuilt with');
  t.check(/page-head/.test(sel),
    'and still knows the old one, because thirty-nine screens still use it');

  /* Every selector the function offers, reduced to what has to be
     PRESENT in a section for it to match. Derived from the function
     rather than restated, so widening the selector widens this test. */
  /* The comma that separates the two selectors lives INSIDE a string
     literal, so the concatenation has to be resolved before the split
     or the second selector comes back wearing half of `'#tab-'+tab+'`. */
  const idioms = sel.replace(/'\s*\+\s*tab\s*\+\s*'/g, '\u0000').replace(/'/g, '')
    .split(',')
    .map(s => s.split('\u0000').pop().trim())
    .filter(Boolean)
    .map(s => s.split(/\s+/).filter(Boolean));
  t.check(idioms.length >= 2, `the function offers ${idioms.length} ways to find a title`);

  const has = (body, piece) => piece.startsWith('.')
    ? new RegExp('class="[^"]*\\b' + piece.slice(1) + '\\b').test(body)
    : new RegExp('<' + piece + '[\\s>]').test(body);

  const starts = [...src.matchAll(/<section id="tab-([a-z0-9-]+)"/g)];
  /* A floor under the walk, not a count of the app: if the regex above
     stopped matching, every check below would pass by checking nothing.
     37 -> 35 when What's coming, What to buy and The day became the
     three lenses of Forecasts. 34 -> 33 when WhatsApp became the Chats
     view of Messages, so the floor drops to 31. */
  t.check(starts.length > 31, `every screen in the app is checked (${starts.length})`);
  const blank = [];
  starts.forEach((m, i) => {
    const body = src.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : src.length);
    if (!idioms.some(parts => parts.every(p => has(body, p)))) blank.push(m[1]);
  });
  t.check(blank.length === 0,
    `and every one of them resolves a title${blank.length ? ' — blank on the phone: ' + blank.join(', ') : ''}`);

  /* RESOLVING A TITLE AND PAINTING ONE ARE NOW DIFFERENT THINGS, and the
     difference has to be written down or the check above quietly stops
     meaning anything.

     The name used to sit in the phone's bar always, which meant it
     appeared TWICE on every screen — once in 15px in the bar and again
     immediately below it as the page's own 28px heading. Taking it out
     of the bar fixes that and breaks something else: scroll a list of
     two hundred customers and nothing anywhere says which screen you
     are on.

     So the bar carries it exactly when the page's own heading does not.
     One name on screen at any moment, and always one. The blank is a
     position, never the accident this section was written for — a
     screen whose title the function cannot find, which is still what
     the check above catches. */
  t.check(/mtTitleName = mtTitleEl \?/.test(fn),
    'the name is still resolved for every screen, on every move');
  t.check(/mtTitleShown = false;/.test(fn) && /el\.textContent = '';/.test(fn),
    'and cleared on arrival, so the bar never keeps the last screen’s name');
  const sync = extractFunction(src, 'syncMobileTopbarTitle', 'index.html');
  t.check(/getBoundingClientRect\(\)\.bottom < bar\.getBoundingClientRect\(\)\.bottom/.test(sync),
    'and painted once the page’s own heading has passed under the bar, not before');
  t.check(/if\(past === mtTitleShown\) return;/.test(sync),
    'written only on the crossing — this runs on every scroll event');
  t.check(/addEventListener\('scroll', syncMobileTopbarTitle, \{ passive: true \}\)/.test(src),
    'and it is passive, because a scroll handler that can block scrolling is worse than no title');
}

/* ---------- the final review: the levers table and the account ---------- */
{
  /* LAW 5 / Q13. The table's outcome column held "4 of 5 event followed"
     under a heading that read "Worked" -- the app claiming the advice
     worked. The heading says what the cells count. No column heading or
     label anywhere in the Manager's beds reads "Worked" (the owner's own
     verdict word on a play, Q14, is a chip, not a heading). */
  const beds = [];
  const re = /\/\* ═══ MGR BED: (\w+) — begin ═══ \*\/([\s\S]*?)\/\* ═══ MGR BED: \1 — end ═══ \*\//g;
  let m;
  while ((m = re.exec(src))) beds.push(m[2]);
  t.check(beds.length >= 7, `the beds are found (${beds.length})`);
  t.check(beds.every((b) => !/<th[^>]*>\s*Worked\s*<\/th>/.test(b) && !/mgr-rf-l">\s*Worked\s*</.test(b)),
    'no column heading or account label in the Manager reads “Worked”');
  const lv = extractFunction(src, 'mgrPaintLevers', 'index.html');
  t.check(/<th class="r">Event followed<\/th>/.test(lv), 'the levers table heads its outcome column “Event followed”');
  /* MEETINGS KEPT is every meeting on the books -- the Brief's own count
     (mgrBooksCounts().meetings) -- never the journal's last few, which
     read 6 beside 69 moves over 35 days. A failed count is "not known"
     and names why; nothing reads 0 for it. */
  const rec = extractFunction(src, 'mgrPaintRecord', 'index.html');
  t.check(/mgrBooksCounts\(\)/.test(rec) && /bc\.meetings/.test(rec) && /Meetings kept<\/span>\$\{meetingsCell\}/.test(rec),
    'Meetings kept is the count of every meeting on the books, the one the Brief says');
  t.check(!/const meetings = journal\.filter/.test(rec), 'not a count of the journal window');
  t.check(/el\.textContent = 'not known'; el\.title = 'The meetings could not be counted/.test(rec) && /gen !== mgrRenderGen/.test(rec),
    'a count that fails is not known and says why, and a late one from an old render is dropped');
  t.check(/Weekly reviews in the journal/.test(rec), 'the reviews row says it counts what the journal holds');
}

process.exit(t.done() ? 1 : 0);
