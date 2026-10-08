#!/usr/bin/env node
'use strict';
/*
 * The agent Home screen: achievement icons, the quick actions, and the
 * account button that floats over every screen in the app.
 *
 * The achievement cards carried one icon per METRIC FAMILY -- four marks
 * across nine achievements -- on the reasoning that repeated glyphs read as
 * a scale being climbed. In practice three different order milestones
 * showed the same carton, so the icon said nothing about which achievement
 * it was. Each has its own now, in one drawing language.
 *
 * The three quick actions were bare text inside the button: .ag-qa-label
 * never applied, so they rendered at 16px/400 while the identical component
 * on Earnings rendered at 11.5px/700.
 *
 * And the account button had three faults at once. Its letter was the
 * literal "A" in the markup with nothing ever replacing it, so every agent
 * saw someone else's initial forever.
 *
 * Run: node test/agent-home.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent home');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. one icon per achievement ----------------------------- */
{
  const ids = [...code.matchAll(/\{ id:'([a-z0-9_]+)', title:/g)].map(m => m[1]);
  t.check(ids.length === 9, `all nine achievements are declared (${ids.length})`);

  const iconBlock = (/const ACHIEVEMENT_ICONS = \{[\s\S]*?\n\};/.exec(code) || [''])[0];
  t.check(iconBlock.length > 0, 'the icon table is found');

  const keyed = [...iconBlock.matchAll(/^\s{2}([a-z0-9_]+):/gm)].map(m => m[1]);
  t.check(keyed.length === 9, `it holds nine icons (${keyed.length})`);
  const missing = ids.filter(id => !keyed.includes(id));
  t.check(missing.length === 0,
    `every achievement has an icon of its own${missing.length ? ` (missing ${missing.join(', ')})` : ''}`);
  const orphan = keyed.filter(k => !ids.includes(k));
  t.check(orphan.length === 0,
    `and no icon is left behind for an achievement that no longer exists${orphan.length ? ` (${orphan.join(', ')})` : ''}`);

  // Nine DISTINCT drawings -- the whole point. The family scheme drew the
  // same carton for First Sale, Selling Machine and Half Century.
  const svgs = [...iconBlock.matchAll(/'(<svg[\s\S]*?<\/svg>)'/g)].map(m => m[1]);
  t.check(svgs.length === 9, `nine drawings (${svgs.length})`);
  t.check(new Set(svgs).size === 9,
    `all nine are different (${new Set(svgs).size} distinct)`);

  // One language, not a sticker sheet: same box, no fills of their own.
  t.check(svgs.every(s => /viewBox="0 0 24 24"/.test(s)), 'drawn in the same 24-unit box');
  t.check(svgs.every(s => !/fill="(?!none)/.test(s)),
    'and none carries a fill of its own -- the stylesheet sets stroke and fill for all of them');

  t.check(/ACHIEVEMENT_ICONS\[next\.id\] \|\| ACHIEVEMENT_ICONS\.first_sale/.test(code),
    'the milestone card looks its icon up by achievement id');

  /* THE ICON SITS INSIDE THE RING.
   *
   * The progress ring is turned a quarter over so its arc starts at the
   * top, and its track is stroked at 3. The icon is a second <svg> nested
   * inside the same .ag-badge-ring, so a DESCENDANT selector reaches it
   * too -- which is how every achievement mark ended up drawn on its side,
   * with the circles inside four of them (the medal, the two heads, the
   * coin) fattened to the ring's stroke while the paths beside them in the
   * same icon stayed at 1.9.
   *
   * The ring's own svg is a direct child; the icon's is not. Nothing in a
   * unit test renders, so this is pinned on the selector itself. */
  /* WHAT THESE USED TO SAY. Each achievement was a card with a progress
     RING drawn around its mark, and the four assertions here pinned the
     scoping of two rules -- `.ag-badge-ring > svg` for the quarter turn
     and `> svg circle` for the ring stroke -- because dropping the child
     combinator reached the icon's own svg too, turning every mark on its
     side and fattening the circles inside the medal, the two heads and
     the two coins to the ring's stroke width.

     WHY THEY STOPPED BEING TRUE. There is no ring. The milestones moved
     off Home onto Standing and are a grid of tiles now: the mark, the
     number the milestone is counted in, and a straight progress bar. No
     rotation and no stroke override, so there is nothing to mis-scope.

     WHAT IS PINNED INSTEAD. That the rules really are gone -- if a ring
     ever comes back it must come back with its scoping argued again,
     rather than inheriting a pass from a test that stopped looking. The
     round-icon guard below stays exactly as it was: it protects the
     nine-distinct-marks claim, which is unaffected. */
  /* The next milestone on the Money sheet is a ring again -- drawn by
     ringSVG, which turns its own circles with an SVG transform ATTRIBUTE
     on each arc, and the icon sits beside it in its own .ic span with its
     own stroke rule. Nothing reaches from one to the other, so the
     mis-scoping the old rules invited cannot happen. */
  t.check(!/ag-badge-ring/.test(src),
    'the old ring and its descendant rules are gone');
  t.check(/\.ax-mile \.ring \.ic svg\{[^}]*stroke-width:1\.8/.test(src),
    'and the milestone icon carries its own stroke, outside the ring\'s svg');
  t.check(!/transform:rotate\(-90deg\)/.test(src),
    'and with it the quarter turn that had to be kept off the icons');
  /* Guards the two assertions above: if the icons stopped drawing circles
     the scoping would be pinned for no reason, and nobody could tell
     whether it still mattered. Named rather than counted, so redrawing an
     icon reports WHICH claim above went stale. */
  const byKey = Object.fromEntries([...iconBlock.matchAll(/^\s{2}([a-z0-9_]+): '(<svg[\s\S]*?<\/svg>)'/gm)]
    .map((m) => [m[1], m[2]]));
  const roundIcons = keyed.filter((k) => /<circle|<ellipse/.test(byKey[k] || '')).sort();
  t.check(roundIcons.join(',') === 'earn_100k,earn_1m,orders_50,repeat_10,repeat_3',
    `the medal, the two heads and the two coins really do draw a round shape of their own (${roundIcons.join(',') || 'none'})`);

  // Every dotted reference must resolve to a key that exists.
  //
  // Rekeying this table from metric family to achievement id broke the
  // streak chip on the Business health card, which reached for
  // ACHIEVEMENT_ICONS.streak and got undefined -- rendering the literal
  // word "undefined" next to "3-week streak" on the Home screen. Nothing
  // threw; an undefined interpolated into a template just prints. Swept
  // rather than listed, because the whole failure was a call site nobody
  // thought to look at.
  const dotted = [...code.matchAll(/ACHIEVEMENT_ICONS\.([a-z0-9_]+)/g)].map(m => m[1]);
  const dangling = [...new Set(dotted)].filter(k => !keyed.includes(k));
  t.check(dangling.length === 0,
    `every ACHIEVEMENT_ICONS.<key> reference resolves${dangling.length ? ` (dangling: ${dangling.join(', ')})` : ` (${new Set(dotted).size} checked)`}`);
  /* Was >= 2, when achievementCardHTML and the shelf renderer each held a
     fallback. The card is gone with the ring and the milestone tile is
     the only place left that names a key directly, so the threshold is
     the number of call sites there actually are. The check still does its
     job: it proves the dangling sweep above looked at real code and not
     just at the table. */
  t.check(dotted.length >= 1,
    'and the sweep sees the call site outside the table, which is where the break was');
  t.check(!/family:/.test(code) || !/ACHIEVEMENT_ICONS\[a\.family\]/.test(code),
    'and the family field it replaced is gone rather than left dangling');
}

/* ---------- 2. no menu of other screens ---------------------------- */
/*
 * Home once carried a quick-action row, then Earnings did: buttons that
 * only named other screens. There is no such row now. Your money opens
 * from your initials on Today, the ring opens your goal, and clients are
 * a tab.
 */
{
  t.check(!/ag-quick-actions|ag-qa-label/.test(src), 'no quick-action menu anywhere');
  t.check(/getElementById\('ag_meBtn'\)\.addEventListener\('click', \(\)=> openMoneySheet\(\)\)/.test(code),
    'the initials open the Money sheet');
  t.check(/getElementById\('ag_ringBtn'\)\.addEventListener\('click', \(\)=> openGoalSheet\(\)\)/.test(code),
    'the ring is the goal, so it opens the goal');
}

/* ---------- 3. the account button ----------------------------------- */
/*
 * It sits in Today's navy header: 44px of actual button, carrying your
 * initials, and it opens the Money sheet -- whose foot is the account.
 */
{
  t.check(/id="ag_meBtn" aria-label="Your money and account"/.test(src),
    'it says what it opens -- its only content is an initial, which a screen reader reads as a letter');
  const av = (/\.ax-me\{([^}]*)\}/.exec(src) || ['',''])[1];
  const w = /width:(\d+)px/.exec(av), h = /height:(\d+)px/.exec(av);
  t.check(w && Number(w[1]) >= 44 && h && Number(h[1]) >= 44,
    `the account button is a 44px target in its own right (${w ? w[1] : '?'}x${h ? h[1] : '?'})`);
  t.check(!/\.ag-avatar-fab/.test(src), 'and the old floating disc is gone');

  t.check(/function agentInitials\(\)/.test(code), 'the initials are computed once');
  t.check(/document\.getElementById\('ag_meBtn'\)\.textContent = agentInitials\(\);/.test(code),
    'and written every time Today draws');
  t.check(/esc\(agentInitials\(\)\)/.test(extractFunction(src, 'openMoneySheet', 'agent.html')),
    'the account card uses the same helper, so the two cannot disagree');

  const initialsFor = (name) => {
    let f = null;
    try { ({ agentInitials: f } = compileScope(
      [extractFunction(src, 'nameInitials', 'agent.html'),
       extractFunction(src, 'agentInitials', 'agent.html')],
      { myAgent: name === undefined ? null : { name } }, ['agentInitials'])); }
    catch (e) { return `THREW: ${e.message}`; }
    return f();
  };
  t.check(initialsFor('Kevin Turyasingura') === 'KT', 'two names give two letters');
  t.check(initialsFor('Grace') === 'G', 'one name gives one');
  t.check(initialsFor('moses ssebunya') === 'MS', 'and they are upper-cased');
  t.check(initialsFor('Ann Marie Nakato') === 'AM', 'a third name is dropped rather than crowding the disc');
  t.check(initialsFor('  Grace  ') === 'G', 'padding does not become the initial');
  t.check(initialsFor(undefined) === '?', 'and no agent yet shows a placeholder instead of throwing');
  t.check(initialsFor('') === '?', 'as does a nameless one');
  t.check(initialsFor('Reagan - Stuart') === 'RS',
    'a hyphen-qualified name gives two letters, not a letter and a hyphen');
  t.check(initialsFor('Feko (Ambrose)') === 'FA',
    'and a bracket-qualified one two letters, not a letter and a bracket');
  t.check(initialsFor('Ronald - 7th Street') === 'R7',
    'a digit counts as a letter, because the 7 is what says which Ronald');
  t.check(initialsFor('Feko (Ambrose)') !== initialsFor('Feko (Rebbeca)'),
    'so the two Fekos are told apart by the mark that exists to tell them apart');
}

process.exit(t.done() ? 1 : 0);
