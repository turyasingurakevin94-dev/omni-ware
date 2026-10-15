#!/usr/bin/env node
'use strict';
/*
 * The feed, full screen.
 *
 * Next move's ranked plays, one screen at a time, swipe up for the next.
 * No tab of its own: a floating button on Today while plays are waiting
 * (gone once you are caught up), "Play all" / "Replay feed" beside Next
 * move, and the top card opens the feed at that play.
 *
 * Run: node test/agent-feed-swipe.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent feed swipe');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');

/* ---------- 1. what an ask is asking for -------------------------------- */
{
  const S = compileScope([fn('feedAskQty')], {}, ['feedAskQty']);
  const q = (m) => S.feedAskQty({ message: m });
  t.check(q('G28 iron sheets, 60 pcs?') === 60, 'a gauge stuck to a letter (G28) is part of the name; 60 is the count');
  t.check(q('40 bags of cement') === 40, 'a plain number is the count');
  t.check(q('need 3m sheets x 20') === 20, 'a length (3m) is a size, not a count');
  t.check(q('hello, do you deliver?') === 1, 'no number asks for one');
}

/* ---------- 2. a day's run remembers what was done ---------------------- */
{
  const store = {};
  const env = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    agentLocalKey: (k) => k,
    feedEarnEach: () => ({ margin: 1000, bonus: 0, total: 1000 }),
  };
  const S = compileScope(['feedToday', 'feedRun', 'saveFeedRun', 'feedPlayEarn', 'feedAskQty', 'feedOutcome'].map(fn), env,
    ['feedRun', 'feedOutcome']);
  const card = { kind: 'due', key: 'due:1', earn: { total: 22000 } };
  S.feedOutcome(card, 'skipped');
  t.check(S.feedRun().out['due:1'] === 'skipped', 'a play scrolled past is a skip');
  S.feedOutcome(card, 'acted');
  t.check(S.feedRun().out['due:1'] === 'acted' && S.feedRun().earn['due:1'] === 22000, 'acting on it later counts, with what it earns');
  S.feedOutcome(card, 'skipped');
  t.check(S.feedRun().out['due:1'] === 'acted', 'and scrolling past it again never undoes what was done');
}

/* ---------- 3. one screen per kind of play ------------------------------ */
{
  const slide = fn('feedSlideHTML');
  ['feedDueHTML', 'feedAskHTML', 'feedBonusHTML', 'feedAddonHTML', 'feedBulkHTML', 'feedWaitingHTML', 'feedWinHTML', 'feedAboutHTML', 'feedLessonHTML']
    .forEach((n) => t.check(slide.includes(n + '(c)'), `${n.replace(/^feed|HTML$/g, '')} has its own screen`));
  t.check(/scroll-snap-type:y mandatory/.test(src) && /\.ax-fs-s\{[^}]*scroll-snap-align:start;scroll-snap-stop:always/.test(src),
    'one play per screen: the scroll snaps and stops on each');
  const deck = fn('feedDeck');
  t.check(/picks\.slice\(0, 1\)\.concat\(asks, waiting, picks\.slice\(1\)\)/.test(deck), 'the same order as Next move: best play, asks, money waiting, the rest');
  t.check(/sn\[c\.key\] > now/.test(deck), 'a play put off ("Tomorrow", "Not right now") stays out until its day');
}

/* ---------- 4. "Not for me" teaches it ---------------------------------- */
{
  const nm = fn('feedOpenNotMe');
  t.check(/prefs\.notMe\[c\.itemKey \|\| c\.key\] = Date\.now\(\)/.test(nm) && /saveFeedPrefs\(prefs\)/.test(nm),
    'hiding writes to the same preferences the ranking reads');
  t.check(/prefs\.acted\[cat\] = 0/.test(nm), 'and "fewer of this aisle" drops what lifted that aisle');
  t.check(/feedLog\(c, 'notme'\)/.test(nm), 'the shop\'s Feed studio hears about it');
  t.check(/feedTuneHTML\(c, pick\)/.test(nm), 'and the sheet shows the feed re-tuned before you confirm');
}

/* ---------- 5. no tab: the doors on Today -------------------------------- */
{
  const fab = fn('feedFabRender');
  t.check(/const hide = !left\.length \|\| feedCaughtUp\(deck\);/.test(fab) && /fab\.hidden = hide;/.test(fab),
    'the floating button shows only while plays are waiting, and goes once you are caught up');
  const doors = fn('feedDecorateNext');
  t.check(/Replay feed/.test(doors) && /Play all \$\{plays\.length\}/.test(doors), 'Next move carries Play all, then Replay feed');
  t.check(/All caught up for today/.test(doors) && /You skipped \$\{nextCards\.length\}/.test(doors),
    'caught up, Today says so, with what you skipped still there to act on');
  t.check(/renderNext = function\(\)\{ feedBaseRenderNext\(\);/.test(src), 'every redraw of Next move redraws the doors');
  t.check(!/data-tab="feed"/.test(src), 'and there is no Feed tab');
}

process.exit(t.done() ? 1 : 0);
