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

  t.check(/const icon = ACHIEVEMENT_ICONS\[a\.id\] \|\| ACHIEVEMENT_ICONS\.first_sale;/.test(code),
    'the card looks its icon up by achievement id');

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
  t.check(/\.ag-badge-ring > svg\{[^}]*transform:rotate\(-90deg\)/.test(src),
    'the quarter turn is scoped to the ring itself, not to every svg inside it');
  t.check(!/\.ag-badge-ring svg\{/.test(src),
    'so the icon is never turned on its side with it');
  t.check(/\.ag-badge-ring > svg circle\{/.test(src),
    'and the ring stroke reaches only the ring, not circles drawn inside an icon');
  t.check(!/\.ag-badge-ring circle\{/.test(src),
    'which four of the nine icons have');
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
  t.check(dotted.length >= 2,
    'and the sweep sees the call sites outside the card itself, which is where the break was');
  t.check(!/family:/.test(code) || !/ACHIEVEMENT_ICONS\[a\.family\]/.test(code),
    'and the family field it replaced is gone rather than left dangling');
}

/* ---------- 2. the quick actions ------------------------------------ */
{
  const home = (/<div class="ag-quick-actions">[\s\S]*?<\/div>\s*<\/div>/.exec(
    src.slice(src.indexOf('id="ag_homeView"'))) || [''])[0];
  t.check(home.length > 0, 'the Home quick-action row is found');

  const labels = [...home.matchAll(/<span class="ag-qa-label">([^<]+)<\/span>/g)].map(m => m[1]);
  t.check(labels.length === 3,
    `all three labels are wrapped in .ag-qa-label (${labels.length} of 3) -- bare text meant the style never applied`);
  t.check(labels.join(',') === 'New quote,Customers,Order history',
    `and they name where they go (${labels.join(', ')})`);
  t.check(labels.includes('Order history'),
    '"Orders" became "Order history" -- the screen\'s own heading, and what the same button on Earnings says');

  // The component this was supposed to match.
  t.check(/\.ag-qa-label\{font-size:11\.5px;font-weight:700/.test(src),
    'the label style exists, which is why the mismatch was invisible in the CSS');
}

/* ---------- 3. the account button ----------------------------------- */
/*
 * position:fixed, so it is over Sell, Customers, Earnings and Quote as
 * well as Home -- the single most-present control in the app.
 */
{
  t.check(/aria-label="Your account"/.test(src),
    'it says what it opens -- its only content is an initial, which a screen reader reads as a letter');

  t.check(/\.ag-avatar-fab::after\{content:'';position:absolute;inset:-5px;border-radius:50%;\}/.test(src),
    'the tap target is extended to 44px by an invisible ring');
  t.check(/\.ag-avatar-fab\{[\s\S]{0,200}?width:34px;height:34px/.test(src),
    'while the disc itself stays 34px, since a bigger overlay covers content');
  // 34 + 5 + 5 = 44. Stated so a change to either number has to face it.
  const disc = 34, ring = 5;
  t.check(disc + ring * 2 === 44, `the two numbers add up to the minimum (${disc} + ${ring}x2)`);

  t.check(/function agentInitials\(\)/.test(code), 'the initials are computed once');
  t.check(/document\.getElementById\('ag_home_avatar_btn'\)\.textContent = agentInitials\(\);/.test(code),
    'and written on every tab change -- the button outlives any one screen, so no single render owns it');
  t.check(/const initials = agentInitials\(\);/.test(code),
    'the Account card uses the same helper, so the two cannot disagree');

  /* The behaviour that was missing entirely -- the letter never changed.

     Compiled WITH nameInitials, because agentInitials is a wrapper over
     it now rather than a fourth private copy. It used to take character
     zero of each word, which is how "Reagan - Stuart" was lettered
     "R-": punctuation where an initial belongs, on the one mark whose
     job is telling two people apart. The cases below cover both the old
     behaviour and the names that broke it. */
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
  /* The four that shipped wrong, and the reason this stopped being a
     private copy. */
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
