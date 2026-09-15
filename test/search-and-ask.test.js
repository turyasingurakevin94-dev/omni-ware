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
/* The phone's sheet is the same box in a different skin, and both
   functions under test now ask which one they are in. The seam is one
   predicate, so the phone can be simulated by flipping a boolean rather
   than by standing up a document. */
let onPhone = false, sheetClosed = 0;
const remembered = [];

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
  phoneSearching: () => onPhone,
  renderNavSearchStart: () => { results.innerHTML = '<div class="tbr-sec">Recent</div>'; },
  navRecentPush: (kind, value) => { remembered.push({ kind, value }); },
  closePhoneSearch: () => { sheetClosed++; },
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

/* ---------- 7. the same box, on a phone ---------- */
/*
 * The phone shows THIS box — not a second input, a second index and a
 * second results list that would disagree with these by the second
 * session that touched either. What differs is the skin and two
 * behaviours, and both of them are here.
 */
{
  /* An empty box on a computer closes the dropdown: the bar is still
     there behind it and there is nothing to say. On the phone the box
     IS the screen, so an empty one must show the way in rather than a
     blank sheet — that is the difference between a search box and a
     door to the Manager. */
  onPhone = false; closed = 0;
  type('');
  t.check(closed === 1 && !/tbr-sec/.test(state().html),
    'an empty box closes the dropdown on a computer');

  onPhone = true; closed = 0;
  type('');
  t.check(closed === 0 && /tbr-sec/.test(state().html),
    'and opens the way-in list on a phone — recents, and what is worth asking');

  /* Typing is identical either way. The divergence is the empty state
     and nothing else; if it ever reached the search itself, the two
     would start giving different answers to the same words. */
  onPhone = true;
  const p1 = type('invo');
  onPhone = false;
  const p2 = type('invo');
  t.check(p1.html === p2.html && p1.hits.length === p2.hits.length,
    'and a typed search returns exactly the same thing on both');
}

/* ---------- 8. what was reached through the box is remembered ---------- */
{
  onPhone = true; remembered.length = 0; sheetClosed = 0;
  type('invo');
  goToNavSearchHit(0);
  t.check(remembered.length === 1 && remembered[0].kind === 'tab' && remembered[0].value === 'invoices',
    'a screen opened from the box is remembered as a screen');
  t.check(sheetClosed === 1,
    'and the sheet closes behind it — otherwise the answer lands over a search field nobody is in');

  remembered.length = 0;
  const s = type('what did joan take');
  goToNavSearchHit(s.hits.length - 1);
  t.check(remembered.length === 1 && remembered[0].kind === 'ask'
    && remembered[0].value === 'what did joan take',
    'and a question is remembered as a question, so it can be asked again in one tap');

  /* Only what came through the box. A screen opened from the rail is
     not a search anybody might want back. */
  onPhone = false; remembered.length = 0; sheetClosed = 0;
  type('invo'); goToNavSearchHit(0);
  t.check(remembered.length === 1 && sheetClosed === 0,
    'the computer remembers the same way and has no sheet to close');
}

/* ---------- 9. the phone’s doors to the box ---------- */
{
  /* Two, and the owner asked for both: the magnifier for a question you
     can type, the chat bubble for one you want to talk through. */
  const barStart = src.indexOf('<div class="mobile-topbar"');
  const mobileBar = src.slice(barStart, src.indexOf('<nav class="mobile-bottomnav"', barStart));
  t.check(barStart > 0 && mobileBar.length > 0 && mobileBar.length < 3000,
    'the phone’s top bar is found');
  t.check(/id="phoneSearchBtn"/.test(mobileBar),
    'the phone’s bar carries a magnifier');
  t.check(/id="assistantOpenBtnMobile"/.test(mobileBar),
    'and keeps the chat bubble beside it — two doors to the brain, no capability lost');

  /* The load-bearing one. If either door ever reaches an input that is
     not #navSearch, there are two searches in this app. */
  const open = extractFunction(src, 'openPhoneSearch', 'index.html');
  t.check(/navSearchInput/.test(open) && !/getElementById\(['"][^'"]*[Ss]earch[^'"]*['"]\)/.test(open),
    'and opening the sheet reveals the ONE box — it does not build a second input');
  t.check(/document\.getElementById\('phoneSearchBtn'\)\.addEventListener\('click'[\s\S]{0,120}?openPhoneSearch\(\)/.test(src)
    && /document\.getElementById\('mmsSearchBtn'\)\.addEventListener\('click'[\s\S]{0,120}?openPhoneSearch\(\)/.test(src),
    'both doors — the bar’s magnifier and the sheet’s row — call the same opener');

  /* stopPropagation is not tidiness here: without it the click that
     opens the sheet reaches the document handler, which sees the class
     it just set and closes the sheet in the same tick. */
  t.check(/id="phoneSearchBtn"[\s\S]{0,4000}?e\.stopPropagation\(\); openPhoneSearch\(\);/.test(src)
    || /getElementById\('phoneSearchBtn'\)[\s\S]{0,200}?e\.stopPropagation\(\)/.test(src),
    'and stops the click, or the document handler would close the sheet in the same tick it opened');
}

/* ---------- 10. the sheet says where its answers come from ---------- */
{
  t.check(/id="phoneSearchNote"[^>]*>Answered from your own books/.test(src),
    'the sheet carries the claim at its foot — the Manager reads the shop’s books and nothing else');
  const asks = (/const NAV_START_ASKS = \[([\s\S]*?)\];/.exec(src) || ['', ''])[1];
  t.check((asks.match(/'/g) || []).length === 6,
    'three questions are offered, no more — a list is a menu, three is an invitation');
  t.check(/\?/.test(asks) && !/\bmy\b.*\bshop name\b/i.test(asks),
    'and every one of them is a question the books can actually answer');
}

/* ---------- 10b. the highlight cannot break what escaping wrote ------- *
 * Reported from the quote's own search: typing "a" turned "Nails &
 * Fasteners" into "Nails &amp; Fasteners" on screen. highlightTokens
 * escaped FIRST and then searched the escaped string, so the "a" inside
 * "&amp;" was a match, got wrapped in a mark, and the entity was split
 * down the middle. Every ampersand in the catalogue was one keystroke
 * from that, on every search row in the app.
 */
{
  const hl = extractFunction(read('index.html'), 'highlightTokens', 'index.html');
  const scope = compileScope([hl], {
    esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    escRegExp: (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  }, ['highlightTokens']);
  const out = scope.highlightTokens('Nails & Fasteners', ['a']);
  t.check(out.includes('&amp;') && !/&<mark/.test(out),
    `an ampersand survives a match on "a" (${out})`);
  t.check((out.match(/<mark class="sr-hl">a<\/mark>/g) || []).length === 2,
    'while both real "a"s in the words are still marked');
  t.check(scope.highlightTokens('3" pipe', ['pipe']) === '3&quot; pipe'.replace('pipe', '<mark class="sr-hl">pipe</mark>'),
    'and a quote in a product name is escaped once, not searched');
  t.check(scope.highlightTokens('Nails & Fasteners', []) === 'Nails &amp; Fasteners',
    'with no tokens it is simply the escaped text');
}

/* ---------- 11. the match highlight is legible on both grounds ---------- */
/*
 * A DEFECT FOUND BY LOOKING AT THE PHONE, AND IT WAS ON THE COMPUTER
 * ALL ALONG.
 *
 * highlightTokens wraps a match in <mark class="sr-hl">. Line 208 says
 * what the search's own highlight should be — no pill, white text — but
 * `mark.sr-hl`, five hundred lines below it, paints an amber pill with
 * color:inherit and has the SAME specificity, so it won on order alone.
 * Every match this box has ever highlighted was #C7CFD8 on #FBE39A:
 * 1.24 to 1, pale grey on light amber, in the app's own search results.
 *
 * The fix is to name the class in the search's own rule so the intent
 * out-specifies the general one. The check is that both rules keep
 * naming it — an unqualified `.tb-results mark` would silently lose
 * again and nothing would look broken enough to notice.
 */
{
  t.check(/\.tb-results mark\.sr-hl\{[^}]*background:transparent/.test(src),
    'the dropdown’s highlight names sr-hl, so it beats the amber pill rather than tying with it');
  t.check(/body\.phone-searching \.tb-results mark\.sr-hl[\s\S]{0,120}?background:transparent/.test(src),
    'and so does the phone’s, on white, where the same pill would have been a second accent');
  /* The pill itself is untouched: it is right everywhere else it is
     used, which is on white. */
  t.check(/mark\.sr-hl\{background:#FBE39A/.test(src),
    'and the pill still stands for every other place a match is marked on a white page');
}

process.exit(t.done() ? 1 : 0);
