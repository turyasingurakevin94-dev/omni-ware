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

/* ---------- 2. two columns, and nothing restructured ---------- */
{
  const sec = src.slice(src.indexOf('<section id="tab-manager"'),
                        src.indexOf('<section id="tab-map"'));
  const rec = (/<div class="ow-rec">([\s\S]*?)\n      <\/div>/.exec(sec) || ['', ''])[1];
  t.check(!!rec, 'the twelve sections sit in one grid');

  const kids = [...rec.matchAll(/<div id="(manager[A-Za-z]+)"([^>]*)>/g)];
  t.check(kids.length === 12, `all twelve wraps are inside it (${kids.length})`);
  const unclassed = kids.filter(k => !/class="ow-(full|half)"/.test(k[2])).map(k => k[1]);
  t.check(unclassed.length === 0,
    `and every one of them is classed${unclassed.length ? ' — bare: ' + unclassed.join(', ') : ''}`);
  t.check(kids.filter(k => /ow-half/.test(k[2])).length === 6,
    'six of them are lists and take one column each');

  /* The wraps are STILL flat siblings and STILL carry their own ids:
     that is the whole reason this session was cheap. renderManager was
     not opened. */
  ['managerPlanWrap', 'managerScoreWrap', 'managerPlaysWrap', 'managerPoliciesWrap'].forEach(id => {
    t.check(new RegExp(`getElementById\\('${id}'\\)`).test(src),
      `${id} is still found by id — no wrapper came between the render and its container`);
  });

  t.check(/\.ow-rec\{[^}]*display:grid/.test(src.replace(/\s*\n\s*/g, '')),
    'the grid is real');
  t.check(/\.ow-rec \.ow-full:empty,\.ow-rec \.ow-half:empty\{display:none;\}/.test(src),
    'and an empty container is removed rather than left holding a row and a gap — several of these are empty on an ordinary week');
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
  t.check(starts.length > 35, `every screen in the app is checked (${starts.length})`);
  const blank = [];
  starts.forEach((m, i) => {
    const body = src.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : src.length);
    if (!idioms.some(parts => parts.every(p => has(body, p)))) blank.push(m[1]);
  });
  t.check(blank.length === 0,
    `and every one of them resolves a title${blank.length ? ' — blank on the phone: ' + blank.join(', ') : ''}`);
}

process.exit(t.done() ? 1 : 0);
