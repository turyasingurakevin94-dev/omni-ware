#!/usr/bin/env node
'use strict';
/*
 * Doors on the rail, and the law they had to be argued past.
 *
 * Forty-one destinations in one column is taller than any screen, so
 * finding a rare one meant scrolling a list you had already read. Each
 * section heading now folds its own section.
 *
 * That is a dangerous thing to build here. This app tore its hover
 * menus out once for hiding twenty-one destinations behind a pointer,
 * and admin-nav.test.js still carries the law that came out of it:
 * nothing that is a place to go goes behind a click. A fold is a click.
 *
 * Three things make it a different bargain, and all three are checked
 * below, because without them this is just the flyouts again:
 *
 *   THE DAILY WORK      does not fold on its own. Sell, Buy, Money and
 *   STAYS OPEN          Insight -- which is where the Manager lives --
 *                       are open at rest and stay open unless the owner
 *                       shuts them. Only reference and settings start
 *                       folded. Which of their own work is rare is the
 *                       owner's call, so the CONTROL is offered on all
 *                       six; the DEFAULT is the design decision.
 *
 *   A SHUT DOOR SAYS    "Catalogue 5" is a section. "Catalogue" alone
 *   WHAT IS BEHIND IT   is a place things went. The flyouts said
 *                       nothing, which is how twenty-one screens got
 *                       lost in them.
 *
 *   YOU NEVER LOSE      a folded section still shows the row you are
 *   YOUR PLACE          on. Navigate into a folded section from search
 *                       or the phone and the rail still says where you
 *                       are -- without silently reopening a section the
 *                       owner shut on purpose.
 *
 * And one thing that must NOT happen: none of this may reach the three
 * things that read this rail as their source of truth -- buildNavIndex,
 * mmsRenderDestinations and the badges. A folded row keeps its own
 * inline style untouched, so the phone's More sheet still lists every
 * destination there is.
 *
 * Run: node test/nav-fold.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('nav fold');
const src = read('index.html');

/* ---------- 1. the saved state, run rather than read ---------- */
{
  let store = null;
  const scope = compileScope([
    extractDeclaration(src, 'NAV_FOLD_KEY', 'index.html'),
    extractDeclaration(src, 'NAV_FOLD_DEFAULT', 'index.html'),
    extractFunction(src, 'navFoldedSet', 'index.html'),
    'function names(){ return {NAV_FOLD_KEY, NAV_FOLD_DEFAULT}; }',
  ], { lsGet: () => store }, ['navFoldedSet', 'names']);

  const { navFoldedSet, names } = scope;
  const { NAV_FOLD_DEFAULT } = names();

  t.check(Array.isArray(NAV_FOLD_DEFAULT) && NAV_FOLD_DEFAULT.length === 2,
    `two sections start folded (${NAV_FOLD_DEFAULT.join(', ')})`);
  ['Sell', 'Buy', 'Money', 'Insight'].forEach(g => {
    t.check(!NAV_FOLD_DEFAULT.includes(g), `${g} is not one of them — it is opened every day`);
  });

  store = null;
  t.check([...navFoldedSet()].sort().join() === NAV_FOLD_DEFAULT.slice().sort().join(),
    'a shop that has never touched the control gets the default');

  store = '["Money","Setup"]';
  const saved = navFoldedSet();
  t.check(saved.has('Money') && saved.has('Setup') && !saved.has('Catalogue'),
    'and one that has gets exactly what it chose — including folding a section the default leaves open');

  store = '[]';
  t.check(navFoldedSet().size === 0,
    'unfolding everything is a real choice and survives, rather than falling back to the default');

  /* The failure that matters: this value comes out of a store the app
     does not control. Anything unreadable must land on the default, not
     throw -- a throw here is inside the rail's own setup, and the rail
     is drawn before anything the owner could use to fix it. */
  store = '{not json';
  t.check(navFoldedSet().size === NAV_FOLD_DEFAULT.length, 'unparseable storage falls back to the default');
  store = '"Money"';
  t.check([...navFoldedSet()].join() === NAV_FOLD_DEFAULT.join(),
    'and so does a value that parses but is not a list — a string would otherwise fold one letter per section');
  store = 'null';
  t.check(navFoldedSet().size === NAV_FOLD_DEFAULT.length, 'and so does null');
}

/* ---------- 2. the heading is a real control ---------- */
{
  const rail = (/<aside class="sidebar[^"]*"[\s\S]*?<\/aside>/.exec(src) || [''])[0];
  const heads = rail.match(/<button type="button" class="nav-section-label"[^>]*>/g) || [];
  t.check(heads.length === 6, `all six headings are buttons (${heads.length})`);
  t.check(heads.every(h => /aria-expanded="true"/.test(h)),
    'each reporting whether its section is open, so this is not a div wearing a click handler');

  const apply = extractFunction(src, 'navApplyFolds', 'index.html');
  t.check(/head\.setAttribute\('aria-expanded', shut \? 'false' : 'true'\)/.test(apply),
    'and that report is kept true as the state changes');
  t.check(/g\.classList\.toggle\('folded', shut\)/.test(apply),
    'the fold is a class on the section');
  t.check(/#sidebar \.nav-group\[data-group\]/.test(apply),
    'found by the name it carries rather than by its position in the list');

  /* Delegated, for the reason the rows are delegated: this rail is
     about to be built at runtime, and a listener bound at parse time
     would be bound to nothing. */
  t.check(/closest\('#sidebar \.nav-section-label'\)/.test(src),
    'the toggle is delegated from the document, like every other nav click');
  t.check(/lsSet\(NAV_FOLD_KEY, JSON\.stringify\(\[\.\.\.folded\]\)\)/.test(src),
    'and what the owner chose is written down');
}

/* ---------- 3. the name survives the decoration ---------- */
{
  /* buildNavIndex takes the section's name from this heading's
     textContent. A caret or a count written as an ELEMENT would rename
     "Catalogue" to "Catalogue5" for the search index and the phone's
     sheet at once -- so the caret is an SVG and the count is CSS
     generated content. Neither is text. */
  const build = extractFunction(src, 'buildNavIndex', 'index.html');
  t.check(/group = el\.textContent\.trim\(\)/.test(build),
    'the section name is still read as the heading\'s text');
  const rail = (/<nav>([\s\S]*?)<\/nav>/.exec(/<aside class="sidebar[^"]*"[\s\S]*?<\/aside>/.exec(src)[0]) || ['', ''])[1];
  const heads = [...rail.matchAll(/<button type="button" class="nav-section-label"[^>]*>([\s\S]*?)<\/button>/g)];
  t.check(heads.length === 6, 'six headings to read');
  heads.forEach(h => {
    /* Tags come out, TEXT stays in -- including any text inside the
       two-letter tile, which is the fault this is here to catch. A
       strip that only matched bare <span> would skip the tile because
       it carries a class, and the check would pass on "SeSell". */
    const text = h[1].replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<\/?span[^>]*>/g, '').trim();
    t.check(/^[A-Z][a-z]+$/.test(text), `"${text}" is the whole of the heading's text — nothing decorative is written into it`);
  });
  t.check(/content:attr\(data-n\)/.test(src),
    'the count behind a shut door is generated content, which textContent cannot see');
}

/* ---------- 4. it does not reach the things that read the rail ---------- */
{
  const mms = extractFunction(src, 'mmsRenderDestinations', 'index.html');
  t.check(/entry\.el\.style\.display === 'none'/.test(mms),
    'the phone\'s sheet skips a row hidden by its OWN inline style — the worker row before a worker signs in');
  t.check(!/folded/.test(mms),
    'and knows nothing about folding: the phone has its own sheet and never inherits the rail\'s doors');

  const build = extractFunction(src, 'buildNavIndex', 'index.html');
  t.check(!/folded/.test(build),
    'the search index is built from every row, so a folded section is still searchable — which is what makes folding safe at all');

  const go = extractFunction(src, 'goToTab', 'index.html');
  t.check(!/folded/.test(go),
    'and arriving somewhere never reopens a section the owner shut — the active row shows through instead');
}

process.exit(t.done() ? 1 : 0);
