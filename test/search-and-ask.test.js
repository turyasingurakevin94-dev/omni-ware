#!/usr/bin/env node
'use strict';
/*
 * One box, two kinds of answer, and no guessing between them.
 *
 * Type "cement" and you want a screen. Type "what did Joan take on
 * Tuesday" and you want the Manager. A box that decided which by
 * sniffing at the words would be wrong sometimes -- and being wrong
 * here means either a screen that will not open or, worse, a question
 * about the shop's money that silently became a search and returned
 * nothing.
 *
 * So it does not decide. The screens are listed; the Manager is offered
 * underneath them; the owner picks. The ORDER is the whole design:
 *
 *   screens first, cursor on the first one, so typing "invo" and
 *   pressing Enter still lands on Invoices exactly as it always has.
 *   Nothing anyone already does with this box changes.
 *
 *   the Manager last -- and first only where this box used to be a dead
 *   end. "Nothing called that" was the end of the road; now it is the
 *   reason the next row exists.
 *
 * Below three characters nothing is offered, because at two characters
 * what is in this box is somebody part-way through the name of a
 * screen, and asking the shop about "in" on every keystroke is noise.
 *
 * This file RUNS renderNavSearch rather than reading it. The defect it
 * is built to catch is an off-by-one between the buttons drawn and the
 * hits they stand for: moveNavSearchCursor pairs them BY POSITION, so a
 * mismatch means the arrow keys highlight one row and Enter opens
 * another. Nothing about the source text of this function would show
 * that.
 *
 * Run: node test/search-and-ask.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('search and ask');
const src = read('index.html');

const NAV_INDEX = [
  { tab: 'invoices', group: 'Sell', label: 'Invoices', terms: 'invoices sell bills receipts', icon: '<svg class="nav-icon"></svg>', el: { style: {} } },
  { tab: 'purchase-invoices', group: 'Buy', label: 'Purchase invoices', terms: 'purchase invoices buy', icon: '<svg class="nav-icon"></svg>', el: { style: {} } },
  { tab: 'inventory', group: 'Catalogue', label: 'Inventory', terms: 'inventory catalogue stock', icon: '<svg class="nav-icon"></svg>', el: { style: {} } },
];

const input = { value: '', blur(){}, setAttribute(){}, };
const results = { innerHTML: '', classList: { add(){}, remove(){} }, setAttribute(){} };
let opened = 0, sentText = null, wentTo = null, closed = 0;

const scope = compileScope([
  'let navSearchHits = [], navSearchCursor = -1;',
  extractDeclaration(src, 'NAV_ASK_MIN', 'index.html'),
  extractDeclaration(src, 'NAV_ASK_ICON', 'index.html'),
  extractFunction(src, 'navSearchMatches', 'index.html'),
  extractFunction(src, 'escRegExp', 'index.html'),
  extractFunction(src, 'highlightTokens', 'index.html'),
  extractFunction(src, 'renderNavSearch', 'index.html'),
  extractFunction(src, 'goToNavSearchHit', 'index.html'),
  'function state(){ return { hits: navSearchHits, cursor: navSearchCursor, html: navSearchResults.innerHTML }; }',
], {
  NAV_INDEX,
  navSearchInput: input,
  navSearchResults: results,
  esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  closeNavSearch: () => { closed++; },
  goToTab: (tab) => { wentTo = tab; },
  apOpenPanel: () => { opened++; },
  apSend: (txt) => { sentText = txt; },
}, ['renderNavSearch', 'goToNavSearchHit', 'state']);

const { renderNavSearch, goToNavSearchHit, state } = scope;
const type = (q) => { input.value = q; results.innerHTML = ''; renderNavSearch(); return state(); };
const buttons = (html) => (html.match(/<button /g) || []).length;

/* ---------- 1. a screen search is untouched ---------- */
{
  const s = type('invo');
  t.check(s.hits.length === 3 && s.hits[0].tab === 'invoices',
    'the screens come first, best match first');
  t.check(s.cursor === 0, 'and the cursor starts on that screen, not on the Manager');
  t.check(/class="cursor"/.test(s.html) && !/tbr-ask cursor/.test(s.html),
    'so Enter still opens the screen somebody was reaching for');
  t.check(s.hits[s.hits.length - 1].ask === true, 'the Manager is offered under them');

  wentTo = null; opened = 0; sentText = null;
  goToNavSearchHit(0);
  t.check(wentTo === 'invoices', 'choosing it navigates');
  t.check(opened === 0 && sentText === null, 'and asks nobody anything');
}

/* ---------- 2. the buttons and the hits cannot drift apart ---------- */
{
  /* moveNavSearchCursor walks querySelectorAll('button') and pairs it
     with navSearchHits BY POSITION. One row drawn that is not a hit --
     or one hit not drawn -- and the arrows highlight one thing while
     Enter opens another. The "nothing called that" line is deliberately
     a div for exactly this reason. */
  ['invo', 'what did Joan take on Tuesday', 'inventory', 'zzzzz'].forEach(q => {
    const s = type(q);
    t.check(buttons(s.html) === s.hits.length,
      `"${q}": ${s.hits.length} hits and ${buttons(s.html)} buttons — the arrow keys and Enter agree`);
  });
  const s = type('zzzzz');
  t.check(/tbr-empty/.test(s.html) && !/<button [^>]*tbr-empty/.test(s.html),
    'and the "no screen by that name" line is not one of them');
}

/* ---------- 3. the dead end becomes the door ---------- */
{
  const s = type('what did Joan take on Tuesday');
  t.check(s.hits.length === 1 && s.hits[0].ask === true,
    'a question matches no screen, so the Manager is the only thing offered');
  t.check(s.cursor === 0 && /tbr-ask cursor/.test(s.html),
    'and it is what Enter does');
  t.check(/No screen by that name\./.test(s.html),
    'the box still says there is no such screen — why there is nothing is worth knowing');
  t.check(!/what did Joan take on Tuesday[\s\S]*what did Joan take on Tuesday/.test(s.html),
    'but it does not repeat the question back twice on top of the box that already shows it');

  opened = 0; sentText = null; wentTo = null; closed = 0;
  goToNavSearchHit(0);
  t.check(opened === 1, 'choosing it opens the panel');
  t.check(sentText === 'what did Joan take on Tuesday',
    'and sends what was typed, whole');
  t.check(wentTo === null, 'without navigating anywhere');
  t.check(input.value === '' && closed === 1, 'and clears the box behind it');

  /* The question is read off the HIT, not off the box: closeNavSearch
     empties the hits and the box is cleared before the send. Read from
     the wrong place, this sends an empty string and the Manager is
     asked nothing at all. */
  t.check(/const ask = hit\.ask \? String\(hit\.q \|\| ''\) : '';/.test(
    extractFunction(src, 'goToNavSearchHit', 'index.html')),
    'taken from the hit before anything is cleared');
}

/* ---------- 4. two characters is not a question ---------- */
{
  const s = type('in');
  t.check(s.hits.every(h => !h.ask),
    'nothing is offered to the Manager at two characters — that is somebody typing a screen name');
  t.check(buttons(s.html) === s.hits.length, 'and the count still lines up');
  t.check(type('inv').hits.some(h => h.ask), 'three is where it starts');
}

/* ---------- 5. it is a question, not an occasion ---------- */
{
  const go = extractFunction(src, 'goToNavSearchHit', 'index.html');
  /* Comments stripped: the code says why it does not set apMode, and
     that explanation is the reason to keep the comment, not a reason to
     fail the check it describes. */
  const goCode = go.replace(/\/\*[\s\S]*?\*\//g, ' ');
  t.check(!/apMode/.test(goCode),
    'apMode is never set here: "manager" is a MEETING, and the run loop commits a plan to the journal when one ends — a question typed into a search box must not write a plan');
  t.check(/apOpenPanel\(\);\s*\n\s*apSend\(ask\);/.test(go),
    'the panel opens and the question goes straight into it, rather than leaving it sitting in the composer');
}

/* ---------- 6. the box says what it is for ---------- */
{
  const topbar = (/<header class="topbar"[\s\S]*?<\/header>/.exec(src) || [''])[0];
  t.check(/placeholder="Search screens, or ask the Manager"/.test(topbar),
    'the placeholder names both jobs — a box that quietly gained a second one nobody would find');
  t.check(/aria-label="Search screens, or ask the Manager"/.test(topbar),
    'and so does its label');
}

process.exit(t.done() ? 1 : 0);
