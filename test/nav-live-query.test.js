#!/usr/bin/env node
'use strict';
/*
 * The rail is read when it is used, not when the page is parsed.
 *
 * `const tabButtons = document.querySelectorAll('nav button[data-tab]')`
 * ran once, at parse time, and querySelectorAll does not return a live
 * collection. Every nav row the app has ever had was in the markup
 * before that line, so it worked -- and would have gone on working
 * right up until the first row was built, moved or replaced at runtime.
 * Then that row would silently never highlight and silently never
 * navigate. A dead nav row does not throw; it just does nothing when
 * tapped, which is the hardest kind of fault to report and the easiest
 * to blame on the phone.
 *
 * The doors this shell is heading for rebuild the rail. So the capture
 * had to go FIRST, on its own, with the rail still exactly as it was --
 * all of the structural risk, none of the visible change. If this
 * release is wrong the nav stops working, and that is obvious in one
 * tap; if it is right, nothing whatsoever looks different.
 *
 * Two properties, and they must hold together:
 *
 *   READ LATE     goToTab queries the DOM each time it runs, so a row
 *                 that appeared a moment ago is found.
 *
 *   BIND ONCE     One delegated listener on the document, rather than a
 *                 listener bound to each button. Binding per button has
 *                 the identical defect in the other direction: the
 *                 buttons that exist at parse time get a handler and
 *                 nothing else ever does. The phone's More sheet
 *                 already worked this way and says so in its own
 *                 comment -- this is that law applied to the rail.
 *
 * The SELECTOR must not change while doing it. It deliberately matches
 * two navs -- the sidebar and the phone's bottom bar -- and narrowing
 * or widening it here would quietly change which buttons navigate.
 *
 * Run: node test/nav-live-query.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('nav live query');
const src = read('index.html');
/* The comment above the replacement quotes the line it replaced, which
   is the whole point of the comment -- so the "is it gone" check reads
   code with the block comments taken out. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ---------- 1. nothing is captured ---------- */
{
  t.check(!/const tabButtons\s*=\s*document\.querySelectorAll/.test(code),
    'the static NodeList is gone, not merely renamed');
  t.check(/const tabButtons = document\.querySelectorAll/.test(src),
    'and the comment that replaced it still quotes the line it replaced, so the next reader knows what this was for');
  t.check(/function tabButtonsNow\(\)\{ return document\.querySelectorAll\(nav button\[data-tab\]\); \}/
      .test(src.replace(/'/g, '')),
    'a function stands in its place, so the DOM is asked each time rather than remembered');
}

/* ---------- 2. goToTab asks at the moment it needs to know ---------- */
{
  const go = extractFunction(src, 'goToTab', 'index.html');
  t.check(/const navButtons = tabButtonsNow\(\);/.test(go),
    'goToTab reads the rail on entry');
  t.check(/navButtons\.forEach\(b=>b\.classList\.remove\('active'\)\)/.test(go),
    'clears the active class off whatever is there NOW');
  t.check(/\[\.\.\.navButtons\]\.filter\(b=>b\.dataset\.tab===tab\)/.test(go),
    'and lights every button for this destination — filter, not find: a screen has a row on the rail AND a tile on the phone');
  t.check(!/tabButtonsNow\(\)[\s\S]{0,200}?tabButtonsNow\(\)/.test(go),
    'asking once per call, not once per line — two queries could disagree if the rail changed between them');
}

/* ---------- 3. one listener, delegated ---------- */
{
  t.check(!/tabButtons\.forEach\(btn=>\{[\s\S]{0,120}?addEventListener/.test(src),
    'the per-button binding is gone');
  const del = /document\.addEventListener\('click', \(e\)=>\{[\s\S]{0,400}?closest\('nav button\[data-tab\]'\)[\s\S]{0,200?}?\}\);/;
  t.check(/closest\('nav button\[data-tab\]'\)/.test(src),
    'a delegated listener matches the same selector from the document');
  t.check(/if\(btn\) goToTab\(btn\.dataset\.tab\);/.test(src),
    'and navigates to whatever it hit');
  t.check(/t && t\.closest \? t\.closest/.test(src),
    'guarding a target that has no closest — a click can land on something that is not an element');
}

/* ---------- 4. the selector itself did not move ---------- */
{
  const uses = (src.match(/nav button\[data-tab\]/g) || []).length;
  t.check(uses >= 3, `the same selector text is used throughout (${uses} places)`);
  t.check(/#sidebar nav button\[data-tab="\$\{tab\}"\]/.test(src),
    'and the scroll-into-view lookup still scopes itself to the sidebar, which is the only rail that scrolls');

  /* The two navs it is meant to reach. If a future edit puts the rail
     rows outside a <nav>, or drops the bottom bar's, this is the check
     that notices. */
  const navs = [...src.matchAll(/<nav[^>]*>/g)].map(m => m[0]);
  t.check(navs.some(n => /mobile-bottomnav/.test(n)),
    'the phone\'s bottom bar is a <nav>, which is why the one selector covers it');
  const sidebar = src.slice(src.indexOf('<aside class="sidebar'), src.indexOf('</aside>', src.indexOf('<aside class="sidebar')));
  t.check(/<nav>/.test(sidebar), 'and the sidebar\'s rows live in a <nav> too');
  /* A FLOOR, so that a rail which quietly lost half its rows to a bad
     edit fails here. It is not a promise that no row ever moves: rows
     have been folded into other screens repeatedly -- Movements into
     Inventory, Chase and Worth telling into Follow-ups, Loans into
     Assets -- and each time the count fell by design and the floor with
     it. This release folds What's coming, What to buy and The day into
     Forecasts, so the rail went 37 -> 35 and the floor 35 -> 33. What
     the check still means is that every destination is ON the rail
     rather than behind a menu, which is the claim that matters. */
   /* And 33 -> 32 when Debtors left: it was a second list over the same
      people, and every one of its ten call sites already called
      renderCustomers on the line above. It is the Customers screen's
      Owing lens now, and resolveTab('debtors') opens it with that lens
      armed, so the destination is still reachable -- it is just not a
      separate destination any more. */
  /* And 32 -> 31 when WhatsApp and Follow-ups became Messages. Neither
   was usable alone: Follow-ups is the list of people you owe a word,
   already tagged with a reason, and its only action was to open the box;
   WhatsApp is the box, and its only content came from the list. The nav
   index had already recorded the confusion -- the obvious search for
   Follow-ups is "broadcast", which belonged to WhatsApp. One screen, one
   rail row, one badge. */
t.check((sidebar.match(/data-tab=/g) || []).length > 31,
    `with every destination still on it (${(sidebar.match(/data-tab=/g) || []).length}) — none of them behind a menu`);
}

process.exit(t.done() ? 1 : 0);
