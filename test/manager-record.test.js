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
 *   THE GRID       Twelve flat sibling divs become two columns with no
 *                  restructuring, so the six test files that extract
 *                  renderManager keep matching -- every one of them
 *                  pins a function call or a string, none pins a
 *                  wrapper. Every child is CLASSED rather than reached
 *                  with `> *`, because a universal selector inside the
 *                  ow layer is a selector that has left it.
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

/* ---------- 2. two beds, and every container still found by id ----------

   WHAT THIS BLOCK USED TO SAY, and why it stopped being true.

   It pinned twelve wraps in one .ow-rec grid, six of them .ow-half.
   That assertion was the record of a cheap session: the twelve flat
   sections were dropped into two columns WITHOUT opening
   renderManager, and the test existed to prove nothing had been
   restructured. It was the right test for that change.

   The redesign is the opposite change. Twelve sections of equal weight
   were the defect, not the arrangement of them: the screen was about
   advice and never said whether the advice had been worth anything,
   and three of the twelve — advice you passed on, advice that is not
   landing, and what has worked — are the same question asked three
   ways, which the source comment already admitted. So:

     - two of the twelve are GONE. managerReviewWrap folded into the
       journal, because a weekly review and a meeting are the same kind
       of event on the same clock; managerPassedWrap folded into the
       levers table, because "you passed on this" is a verdict column,
       not a section.
     - two are NEW. managerVerdictWrap carries the four figures that
       say whether this manager has earned its credit — the thing the
       old screen could not say at all — and managerViewWrap carries
       the switch.
     - the .ow-rec half-grid is gone with them. It laid flat siblings
       into halves, so a short section left a 200px hole beside a tall
       one and the reading order zig-zagged. The console's own
       .ow-grid + .ow-side is what the rest of this app uses.

   WHAT IS PINNED NOW is the part that mattered then and still does:
   every container is a flat, classed, id-addressed div that
   renderManager finds by getElementById, so no wrapper ever comes
   between the render and its container; and every wrap belongs to
   exactly one bed, so the switch can never leave a container showing
   in both or in neither. */
{
  const sec = src.slice(src.indexOf('<section id="tab-manager"'),
                        src.indexOf('<section id="tab-map"'));
  const kids = [...sec.matchAll(/<div id="(manager[A-Za-z]+)"([^>]*)>/g)];
  const ids = kids.map(k => k[1]);
  t.check(ids.length === 12, `every container is a flat sibling div with an id (${ids.length})`);

  /* The two that were retired, and the two that replaced them. Named
     rather than merely absent: a wrap that comes back by accident is a
     section that renders into nothing. */
  ['managerReviewWrap', 'managerPassedWrap'].forEach(id => {
    t.check(!ids.includes(id) && !new RegExp(`getElementById\\('${id}'\\)`).test(src),
      `${id} is gone from the markup AND from the render — it folded into another section`);
  });
  ['managerVerdictWrap', 'managerViewWrap'].forEach(id => {
    t.check(ids.includes(id), `${id} has a place on the screen`);
  });

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

  /* TWO BEDS, AND NOTHING IN BOTH. .mgr-bed-s is what still wants an
     answer; .mgr-bed-r is the record. A wrap in neither would show on
     both views; a wrap in both would show twice. */
  const bedded = kids.filter(k => /class="mgr-bed mgr-bed-[sr]"/.test(k[2]));
  t.check(bedded.length === ids.length - 3,
    `every wrap but the three above the switch belongs to a bed (${bedded.length} of ${ids.length - 3})`);
  t.check(kids.filter(k => /mgr-bed-s/.test(k[2]) && /mgr-bed-r/.test(k[2])).length === 0,
    'and none of them is in both');
  ['managerPlanWrap', 'managerPlaysWrap', 'managerScoreWrap', 'managerQuestionsWrap', 'managerPoliciesWrap']
    .forEach(id => t.check(new RegExp(`id="${id}" class="mgr-bed mgr-bed-s"`).test(sec),
      `${id} is standing — it wants an answer from the owner`));
  ['managerHistoryWrap', 'managerTrackWrap', 'managerAccountWrap']
    .forEach(id => t.check(new RegExp(`id="${id}" class="mgr-bed mgr-bed-r"`).test(sec),
      `${id} is the record — it is what already happened`));

  /* The switch is the ONLY thing that decides which bed shows, and it
     decides it by a class on the section rather than by re-rendering:
     a bed that had to be re-read on every tap would spend a query on a
     view the owner may only be glancing at. */
  const flat = src.replace(/\s*\n\s*/g, '');
  t.check(/#tab-manager\.mgr-on-standing \.mgr-bed-s,#tab-manager\.mgr-on-record \.mgr-bed-r\{display:block;\}/.test(flat),
    'the switch shows a bed with one class on the section, not with a second read of the journal');
  t.check(/\.mgr-bed\{display:none;\}/.test(flat), 'and everything is hidden until it does');
  t.check(/\.mgr-bed:empty\{display:none;\}/.test(flat),
    'an empty container is removed rather than left holding a gap in the stack — several are empty on an ordinary week');

  /* The console's own two-column layout, not a half-grid of flat
     siblings: the main column is the work and the 304px rail is what
     stands beside it. */
  t.check(/<div class="ow-grid">[\s\S]*?<div class="ow-stack">[\s\S]*?<div class="ow-side">/.test(sec),
    'the two columns are .ow-grid + .ow-side, the pair every other console screen uses');
}

/* ---------- 3. a heading is not a field label ---------- */
{
  const rule = (/\.mgr-sec-title\{[^}]*\}/.exec(src) || [''])[0];
  t.check(!/text-transform:uppercase/.test(rule),
    'section headings are no longer shouted');
  t.check(!/letter-spacing:\.0[45]em/.test(rule),
    'nor tracked out like a caption');
  const size = (/font-size:(\d+(?:\.\d+)?)px/.exec(rule) || [0, 0])[1];
  t.check(Number(size) >= 15, `and they are bigger than the body text they head (${size}px)`);

  /* The comparison that made this worth doing. If these two ever read
     the same again, the heading has become a form label again. */
  const label = (/\.field label\{[^}]*\}/.exec(src) || [''])[0];
  t.check(!!label && rule.replace(/\s/g, '') !== label.replace(/\s/g, '').replace('.field label', '.mgr-sec-title'),
    'and they no longer wear the treatment a form label wears');
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
     three lenses of Forecasts. */
  t.check(starts.length > 33, `every screen in the app is checked (${starts.length})`);
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

process.exit(t.done() ? 1 : 0);
