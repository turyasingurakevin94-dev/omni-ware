#!/usr/bin/env node
'use strict';
/*
 * The admin navigation: one rail holding the whole map, one bar holding
 * the actions.
 *
 * What it was: a top bar of six drop-down menus holding twenty-one
 * screens, above a rail of six shortcuts. Twenty-eight destinations, of
 * which seven were on screen at rest. That cost twice over. Every screen
 * on the rail was ALSO in a menu, so it had two homes and neither was
 * the real one -- and the other twenty-one could only be found by
 * remembering which menu they were in and opening it.
 *
 * What it is: the rail took the map, headed by section rather than
 * hidden behind one, and the bar took the three things that are not a
 * destination -- where you are, search, and the actions that act on the
 * whole shop.
 *
 * Four things this must not become:
 *
 *   a flyout again     hover submenus were removed from this app for
 *                      hiding six destinations. Nothing may go back
 *                      behind a hover, and nothing that is a place to go
 *                      may go behind a click either.
 *   a place to lose    every destination that existed must still exist,
 *   things             and the phone must be able to reach all of them.
 *   two filing         the rail and the phone sheet must use the same
 *   systems            section names for the same screens, or the shop
 *                      learns one system per device.
 *   a squeeze          .sidebar-scroll is a column flex container. When
 *                      the rail last held a long list, every child with
 *                      the default flex-shrink:1 was squeezed -- .brand
 *                      was 34px of logo inside overflow:hidden, crushed
 *                      to 18px and CLIPPED. The list is long by design
 *                      now, so what shares that column matters again.
 *
 * Run: node test/admin-nav.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin nav');
const src = read('index.html');

// Anchored on the elements themselves, not on the first `<nav>` in the
// file. There are several, and one is a literal `<nav>` written inside a
// CSS comment -- the same prose-matching-as-code trap that has caught
// other checks in this suite.
const topbar = (/<header class="topbar"[\s\S]*?<\/header>/.exec(src) || [''])[0];
const sidebar = (/<aside class="sidebar"[\s\S]*?<\/aside>/.exec(src) || [''])[0];
const rail = (/<nav>([\s\S]*?)<\/nav>/.exec(sidebar) || ['', ''])[1];
const sheet = (/<div class="mms-body">[\s\S]*?\n  <\/div>/.exec(src) || [''])[0];
const bottomNav = (/<nav class="mobile-bottomnav"[\s\S]*?<\/nav>/.exec(src) || [''])[0];

const tabsIn = (s) => [...s.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1]);

/* Reads the rail the way buildNavIndex() does: a section label sets the
   group, every button after it belongs to that group.

   The heading is a <button> now rather than a <div>, because it folds
   its section and a thing you click and that reports its own state is a
   button, not a div wearing a click handler. It still carries the
   class buildNavIndex keys on, and its NAME is still the whole of its
   textContent -- the fold caret is an SVG and the count behind a shut
   door is CSS generated content, neither of which is text. */
function railIndex() {
  const out = [];
  let group = '';
  const re = /<button type="button" class="nav-section-label"[^>]*><span>([^<]+)<\/span>[\s\S]*?<\/button>|<button([^>]*?)>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = re.exec(rail))) {
    if (m[1]) { group = m[1].trim(); continue; }
    const attrs = m[2] || '';
    const tab = (/data-tab="([a-z-]+)"/.exec(attrs) || [])[1];
    if (!tab) continue;
    out.push({
      tab, group,
      label: ((/<span class="nav-label">([\s\S]*?)<\/span>/.exec(m[3]) || ['', ''])[1]).replace(/&amp;/g, '&').trim(),
      keywords: (/data-keywords="([^"]*)"/.exec(attrs) || ['', ''])[1],
      hidden: /style="display:none;?"/.test(attrs),
    });
  }
  return out;
}
const INDEX = railIndex();

/* ---------- 1. nothing was lost ------------------------------------- */
{
  const EVERY_TAB = [
    'dashboard', 'quote', 'quote-saved', 'invoices', 'customers', 'agents', 'whatsapp',
    'compare', 'sourcing', 'suppliers',
    /* Purchase invoices is NOT in this list, and that is deliberate. An
       order, the invoice it becomes and the bills it raises against its
       suppliers are ONE THING moving through the business --
       purchaseInvoicesForOrder() has always known it, and the sales row
       has always carried its "Raised" links. What those links could not
       do was land anywhere: the reveal had to change tab, type the
       number into the other screen's search box, widen its date range
       and drop its voided filter, and getting back meant undoing all
       four by hand. They are two LENSES on one screen now, over one
       filter bar. The ratchet that replaces this line is below, where
       the words are checked to still reach the register. */
    'products', 'prices', 'inventory',
    /* Stock movements is NOT in this list, and that is the third answer
       this app has given to one question. It began stacked under
       Inventory -- the shelf as it stands and the log of how it got
       that way, two consoles on one screen. It was split out to a door
       of its own, and this line used to hold that split done. It is a
       LENS on Inventory now: still two questions with two filter bars,
       but one view at a time, which is neither the stack nor the door.
       The ratchet that replaces this line is below, where the words are
       checked to still reach the shelf. */
    'media', 'fasteners',
    /* 'assets' is Assets & loans: ONE destination since the two
       registers were merged. Loans is not missing from this list, it no
       longer exists as a screen -- a van and the loan that bought it were
       two pages that never mentioned each other, and the reading that
       matters (what a thing is worth against what is still owed on it)
       could not be asked on either. The check below holds the merge to
       the thing a merge can quietly lose: the words people search by. */
    'cashbook', 'analytics-debtors', 'analytics-creditors', 'statements', 'payroll', 'assets',
    'analytics-sales', 'analytics-purchase', 'map',
    'staff', 'worker', 'presets',
  ];
  const present = tabsIn(rail);
  const missing = EVERY_TAB.filter((x) => !present.includes(x));
  t.check(missing.length === 0,
    `the rail is the complete map${missing.length ? ` (missing ${missing.join(', ')})` : ` (${present.length} destinations)`}`);
  t.check(new Set(present).size === present.length, 'and none of it is listed twice');

  /* The bar carries no destinations at all. This is the whole point: a
     screen with two homes had no home, and six of them used to have
     exactly that. */
  t.check(tabsIn(topbar).length === 0,
    `the bar carries no destinations, so nothing has two homes (${tabsIn(topbar).length})`);

  // The four non-tab actions are actions, not destinations, and keep the
  // ids their handlers bind to. Renaming them in the move would throw on
  // boot at getElementById(...).addEventListener, which no check that
  // only counted destinations would notice.
  ['exportBtn', 'importBtn', 'clearBtn', 'tbSignoutBtn'].forEach((id) => {
    t.check(new RegExp(`id="${id}"`).test(topbar), `${id} kept its id, so its handler still finds it`);
  });
  t.check(/id="importFile"/.test(sidebar), 'and the hidden file input the import opens still exists');
}

/* ---------- 2. nothing is behind anything ---------------------------- */
{
  /* The measure that matters: how much of the map you can see without
     opening something. It was 7 of 28.

     THIS CHECK HAD TO BE REWRITTEN, not patched. It used to read
     `style="display:none"` off the markup, and the sections now fold
     through a CLASS -- so the old count would have gone on reporting
     every destination as "on screen at rest" while five of them sat
     behind a shut door. A check that cannot see the thing it exists to
     measure is worse than no check: it reports green about a property
     nobody is testing any more.

     So it counts what is actually on screen: every row, less the rows
     in the sections that START folded. The rail offers folding on all
     six because which of their own work is rare is the owner's
     judgement -- but what it CHOOSES to fold on first use is a design
     decision, and this is where that decision is written down. */
  const FOLD_DEFAULT = (/const NAV_FOLD_DEFAULT = \[([^\]]*)\]/.exec(src) || ['', ''])[1]
    .split(',').map((x) => x.replace(/['"\s]/g, '')).filter(Boolean);
  t.check(FOLD_DEFAULT.length > 0, `the rail names which sections start folded (${FOLD_DEFAULT.join(', ')})`);

  const DAILY = ['Sell', 'Buy', 'Money', 'Insight'];
  DAILY.forEach((g) => {
    t.check(!FOLD_DEFAULT.includes(g),
      `"${g}" is open at rest — it is opened every day, and Insight is where the Manager lives`);
  });

  const visible = INDEX.filter((x) => !x.hidden && !FOLD_DEFAULT.includes(x.group)).length;
  t.check(visible >= 26,
    `${visible} destinations are on screen at rest, none of them behind a menu`);
  t.check(INDEX.filter((x) => !x.hidden).length > visible,
    'and folding actually removes something, or it is a control that does nothing');

  /* The reason a fold is allowed here at all when a hover menu was not:
     a shut section still says how many screens are inside it, and still
     shows the one you are on. Neither was true of the flyouts. */
  t.check(/\.nav-group\.folded > \.nav-section-label::after\{[\s\S]{0,200}?content:attr\(data-n\)/.test(src),
    'a shut door says how much is behind it');
  t.check(/head\.dataset\.n = g\.querySelectorAll\(':scope > button\[data-tab\]'\)\.length;/.test(src),
    'counting the destinations in that section, including one its own inline style hides — a number that jumped when a worker signed in would mean nothing');
  t.check(/\.nav-group\.folded > button\[data-tab\]\.active\{display:flex;\}/.test(src),
    'and a shut section still shows the row you are on, so the rail never loses your place');

  /* One menu is left on the bar and it holds no data-tab -- only the
     four things that act on the whole shop. A destination appearing in
     it would be a destination back behind a click. */
  const menus = topbar.match(/<div class="tb-menu"[\s\S]*?<\/div>\s*<\/div>/g) || [];
  t.check(menus.length === 1, `the bar has one menu left (${menus.length})`);
  t.check(tabsIn(menus[0] || '').length === 0, 'and it holds actions, not places to go');

  t.check(!/nav-submenu/.test(topbar) && !/nav-submenu/.test(sidebar),
    'the old hover flyouts are not back');
  // A menu that opened on hover would reappear under a pointer merely
  // crossing the bar. Pinned as a source check because the difference
  // between :hover and a click listener is the whole design decision.
  t.check(!/\.tb-group:hover\s*>?\s*\.tb-menu/.test(src),
    'and the one that is left opens on a click, not on a pointer passing over it');

  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  ['quotesNavItem', 'analyticsNavItem', 'supplierNavItem', 'productsNavItem', 'settingsNavItem',
    'wireNavFlyout', 'markTopbarGroup', 'workerTopbarItem']
    .forEach((ref) => {
      t.check(!new RegExp(`\\b${ref}\\b`).test(code), `${ref} is not referenced anywhere`);
    });
}

/* ---------- 3. grouped by job, headings always visible --------------- */
{
  const groups = [...new Set(INDEX.map((x) => x.group))];
  ['Sell', 'Buy', 'Catalogue', 'Money', 'Insight', 'Setup'].forEach((g) => {
    t.check(groups.includes(g), `"${g}" is a heading on the rail itself`);
  });
  const groupOf = Object.fromEntries(INDEX.map((x) => [x.tab, x.group]));

  t.check(groupOf['dashboard'] === '',
    'the dashboard sits above every section -- it is where a day starts, not part of a job');

  // The groupings that carry meaning rather than tidiness.
  t.check(groupOf['analytics-debtors'] === 'Money' && groupOf['analytics-creditors'] === 'Money',
    'who owes you and who you owe are money, not analytics -- they are acted on, not studied');
  t.check(groupOf['cashbook'] === 'Money' && groupOf['statements'] === 'Money'
    && groupOf['assets'] === 'Money' && groupOf['payroll'] === 'Money',
    'and they sit with the cash book, the statements, what the shop owns and owes, and what it pays');

  /* WHAT A MERGE LOSES IF NOBODY CHECKS. Two rail entries became one, and
     the entry that survived was the assets one -- so every word somebody
     used to reach Loans by ("borrowed", "debt", "repayment", "bank") had
     to be carried onto it, or the screen would still exist and simply
     stop being findable by the half of its subject that lost its row. */
  {
    const al = INDEX.find((x) => x.tab === 'assets') || { label: '', keywords: '' };
    t.check(/loan/i.test(al.label),
      `the merged entry names both halves on the rail itself ("${al.label}")`);
    const carried = ['borrowed', 'debt', 'repayment', 'bank', 'depreciation', 'equipment'];
    const lost = carried.filter((w) => !al.keywords.includes(w));
    t.check(lost.length === 0,
      `and it carries the search words of both screens it replaced${lost.length ? ' — lost ' + lost.join(', ') : ''}`);
  }
  /* AND THE SAME AGAIN, with one difference worth stating. Worth telling
     lost its row; Follow-ups kept its. The assets check above demands
     that the surviving LABEL name both halves, because "Assets" and
     "Loans" are two subjects sharing no word -- somebody looking for a
     loan would never guess "Assets".
     This merge is not that. Worth telling was never a subject: it was
     one of the six REASONS to send one client one message, and it is
     still called that inside the screen, on the row that narrows the
     queue by why. So the label stays one word, and the check holds the
     two things a merge can actually lose -- the words people search by,
     and the name still being spoken at the destination. */
  {
    const fu = INDEX.find((x) => x.tab === 'followups') || { label: '', keywords: '' };
    const carried = ['worth', 'telling', 'marketing', 'recommend', 'brief',
      'picture', 'gif', 'promote', 'campaign', 'offer', 'suggest'];
    const lost = carried.filter((w) => !fu.keywords.includes(w));
    t.check(lost.length === 0,
      `Follow-ups carries the search words of the screen it absorbed${lost.length ? ' — lost ' + lost.join(', ') : ''}`);
    /* NOT "broadcast". WhatsApp is the real answer for it, and the note
       above the Follow-ups button already records this law for the word
       "stock": claiming a word another screen owns buries that screen
       for its own most obvious search. */
    const wa = INDEX.find((x) => x.tab === 'whatsapp') || { keywords: '' };
    t.check(!/broadcast/.test(fu.keywords) && /broadcast/.test(wa.keywords),
      'and not "broadcast", which is WhatsApp\'s own most obvious search, and still its');
    t.check(!INDEX.some((x) => x.tab === 'telling') && !/id="tab-telling"/.test(src),
      'Worth telling is not a destination any more, and has no section left behind');
    const alias = extractFunction(src, 'resolveTab', 'index.html');
    t.check(/if\(tab === 'telling'\)\{[^}]*fupWhy = 'telling'[^}]*return 'followups'; \}/.test(alias),
      'but the old door still opens it, on the lens it meant — resolved once at the top of goToTab, so a saved last-tab cannot boot into a section that is gone');
    const sec = (/<section id="tab-followups"[\s\S]*?<\/section>/.exec(src) || [''])[0];
    const why = extractDeclaration(src, 'FUP_WHY', 'index.html');
    t.check(/Worth telling/.test(why) || /Worth telling/.test(sec),
      'and the name it absorbed is still spoken at the destination, on the row that narrows the queue by why');

    /* AND CHASE DEBTS, absorbed the same way and by the same reading:
       both screens were already built on debtChaseRows(). The two things
       a merge can lose are the same two, so they are checked the same
       way -- the words, and the name still being spoken where the work
       landed. */
    const chased = ['chase', 'collect', 'overdue', 'late', 'payment', 'demand', 'debt', 'owed'];
    const lostC = chased.filter((w) => !fu.keywords.includes(w));
    t.check(lostC.length === 0,
      `Follow-ups carries the search words of the chase screen too${lostC.length ? ' — lost ' + lostC.join(', ') : ''}`);
    /* NOT "owing", "who owes" or "aging". Debtors owns the whole book
       and those are its most obvious searches; this row owns the ASKING.
       Same law as "broadcast" above, applied to the other side of it. */
    const deb = INDEX.find((x) => x.tab === 'analytics-debtors') || { keywords: '' };
    t.check(!/owing/.test(fu.keywords) && /owing/.test(deb.keywords),
      'and not "owing", which is the Debtors list\'s own most obvious search, and still its');
    t.check(!INDEX.some((x) => x.tab === 'chase') && !/id="tab-chase"/.test(src),
      'Chase debts is not a destination any more, and has no section left behind');
    t.check(/if\(tab === 'chase'\)\{[^}]*fupWhy = 'money'[^}]*return 'followups'; \}/.test(alias),
      'but the old door still opens it, on the money lens it meant — same resolve, same reason');
    t.check(/'money','Money'/.test(why),
      'and the queue it brought is a named lens at the destination, not a filter somebody has to build');
    /* The badge did not go dark with the row. A debtor the money lens
       would ask today is a hub row, so the rail still carries that
       count -- under Follow-ups, where the work is. */
    t.check(!/navBadgeChase/.test(src) && /id="navBadgeFollowUps"/.test(src),
      'its rail badge went with its row, and the count lives on the badge of the row that took the work');
  }
  /* Buying stock was one job across three screens until the supplier's
     bill became the other lens of Invoices. Buy keeps the screens about
     CHOOSING what to buy and from whom; what a supplier then billed you
     is the same transaction as what you billed your customer, and lives
     with it under Sell. */
  t.check(groupOf['compare'] === 'Buy' && groupOf['suppliers'] === 'Buy'
    && groupOf['sourcing'] === 'Buy' && groupOf['buying'] === 'Buy',
    'choosing what to buy, and from whom, is one job across four screens');
  {
    t.check(!INDEX.some((x) => x.tab === 'purchase-invoices')
      && !/id="tab-purchase-invoices"/.test(src),
      'Purchase invoices is not a destination any more, and has no section left behind');
    const alias = (/function resolveTab\(tab\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
    t.check(/if\(tab === 'purchase-invoices'\)\{[^}]*invSide = 'buys'[^}]*return 'invoices'; \}/.test(alias),
      'but the old door still opens it, on the lens it meant — same resolve, same reason');
    /* A merge is only honest if what people search by still reaches the
       screen that took the work. These are the words the retired row
       carried, and they are on the row that took it. */
    const inv = INDEX.find((x) => x.tab === 'invoices') || { keywords: '' };
    ['supplier', 'payables', 'goods received', 'purchase'].forEach((w) => {
      t.check(inv.keywords.includes(w),
        `and "${w}" still reaches the register, from the row that took the work`);
    });
  }
  t.check(groupOf['quote'] === 'Sell' && groupOf['invoices'] === 'Sell'
    && groupOf['customers'] === 'Sell' && groupOf['agents'] === 'Sell',
    'selling holds the quote, the invoice, the customer and the agent');
  t.check(groupOf['products'] === 'Catalogue' && groupOf['prices'] === 'Catalogue'
    && groupOf['inventory'] === 'Catalogue' && groupOf['media'] === 'Catalogue',
    'what you sell, what it costs, how many are left and what it looks like sit together');
  /* Map answers "where are they", which is a thing you study rather than
     a figure you act on. It was filed under Money, between Loans and
     Payroll, on no principle anyone could state. */
  t.check(groupOf['map'] === 'Insight',
    'and the map is filed with the things you study, not with the money');
}

/* ---------- 4. the rail and the phone agree -------------------------- */
/*
 * This used to compare two hand-written lists and report the difference.
 * The sheet is now GENERATED from the rail -- mmsRenderDestinations
 * walks NAV_INDEX, which buildNavIndex reads off the rail -- so parity
 * is structural rather than checked, and the check is that the
 * generation is what it claims to be.
 *
 * That change is what put an icon on every phone destination: the
 * hand-kept copy carried none, because nobody was going to paste
 * twenty-four SVGs into it and keep them right.
 */
{
  const gen = extractFunction(src, 'mmsRenderDestinations', 'index.html');
  t.check(/NAV_INDEX\.forEach/.test(gen),
    'the phone sheet is built from the rail index, not from a second list');
  t.check(!/<button type="button" class="mms-item" data-tab=/.test(sheet),
    'and no hand-written destination rows survive in the markup to drift from it');
  t.check(/it\.icon/.test(gen) && /class="mms-row"/.test(gen),
    'every destination carries the rail’s own icon');
  /* The count too, and read off the rail's own badge rather than worked
     out again — every one of these numbers already has a function that
     computes it and a place it is shown, and the first time two
     reckonings disagreed the owner would have no way to know which was
     true. */
  t.check(/mmsCountHTML\(it\)/.test(gen)
    && /querySelector\('\.nav-badge'\)/.test(extractFunction(src, 'mmsCountHTML', 'index.html')),
    'and its count, read off that same rail row rather than reckoned a second time');
  t.check(/g\.name/.test(gen) && /mms-group-label/.test(gen),
    'and the rail’s own section names, so the two cannot file a screen differently');

  /* The four the bar already carries are the only exclusion, and it is
     named rather than left as a coincidence of what somebody remembered
     to leave out. */
  const barTabs = tabsIn(bottomNav);
  const excluded = (/const MMS_BAR_TABS = \[([^\]]*)\]/.exec(src) || ['', ''])[1]
    .split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  t.check(JSON.stringify(excluded.slice().sort()) === JSON.stringify(barTabs.slice().sort()),
    `the sheet leaves out exactly what the bar carries (${excluded.join(', ')} vs ${barTabs.join(', ')})`);
  t.check(/MMS_BAR_TABS\.includes\(entry\.tab\)/.test(gen),
    'and applies that list rather than repeating a screen on two surfaces');

  /* Worker view sits on the rail hidden until a login turns out to be
     staff. Generated blindly, the sheet would offer it to every shop.
     Tested on the BUTTON'S OWN inline style, not on whether it is on
     screen: on a phone the entire rail is display:none, so anything
     asking "is this visible" would drop every destination there is. */
  t.check(/entry\.el && entry\.el\.style && entry\.el\.style\.display === 'none'/.test(gen),
    'a rail row hidden until a worker signs in is not offered as a destination');
  t.check(!/offsetParent|checkVisibility|getComputedStyle\(entry\.el\)/.test(gen),
    'and it does not ask whether the rail is on screen, which on a phone it never is');

  /* Generated markup needs a delegated listener: one bound at parse time
     would be bound to nothing, and every tile would be dead. */
  t.check(/getElementById\('mobileMoreSheet'\)\.addEventListener\('click'/.test(src),
    'the tiles are wired by delegation, since they do not exist at parse time');
  t.check(/mmsRenderDestinations\(\);\s*\r?\n\s*document\.getElementById\('mobileMoreSheet'\)\.classList\.add\('show'\)/.test(src),
    'and rebuilt on every open, so a newly revealed screen appears without a reload');
}

/* ---------- 5. the column that squeezed the logo --------------------- */
{
  t.check(/<header class="topbar"[\s\S]*?class="brand"/.test(topbar),
    'the brand sits in the top bar');
  t.check(!/class="brand"/.test(sidebar),
    'and no longer in the flex column that crushed it');

  const brandRule = (/\.topbar \.brand\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/flex-shrink:\s*0/.test(brandRule),
    'the brand cannot be shrunk by its container -- the exact failure that clipped it before');
  t.check(!/overflow:\s*hidden/.test(brandRule),
    'and nothing clips it even if something does squeeze it');

  /* Signing out is now OUTSIDE the scroll box rather than at the end of
     it. With six items that made no difference; with twenty-seven it is
     the difference between a footer and a thing you scroll to find. */
  /* A sibling of the scroll box, not a child of it. Matched by checking
     nothing reopens .sidebar-scroll between the two -- a looser check
     was satisfied by a foot nested straight back inside it. */
  const betweenNavAndFoot = (/<\/nav>([\s\S]*?)<div class="sidebar-foot">/.exec(sidebar) || ['', ''])[1];
  t.check(betweenNavAndFoot.length > 0 && !/class="sidebar-scroll"/.test(betweenNavAndFoot),
    'the foot sits outside the scrolling list, so it does not move with it');
  const footRule = (/\.sidebar-foot\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/flex-shrink:\s*0/.test(footRule),
    'and cannot itself be squeezed by the list above it');

  /* The scrollbar was hidden while this rail never scrolled. It does
     now, and hiding the only thing that says "there is more below"
     would put the same problem back in a different shape. */
  const scrollRule = (/\.sidebar-scroll\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/overflow-y:auto/.test(scrollRule) && !/scrollbar-width:none/.test(scrollRule),
    'the list scrolls visibly rather than silently');
  t.check(/\.sidebar-scroll::-webkit-scrollbar\{width:8px;\}/.test(src),
    'with a bar wide enough to see');

  // A rail taller than the viewport can hold the active row off-screen,
  // which is how a nav that shows everything shows you nothing.
  t.check(/railRow\.scrollIntoView\(\{block:'nearest'\}\)/.test(extractFunction(src, 'goToTab', 'index.html')),
    'and the row you are on is brought into view when it is not');

  /* Sticky headings, so scrolling into the middle of Money still says
     Money. Each section is its own block: sticky only holds inside a
     containing block, and with all six sharing `nav` every heading that
     scrolled past stayed pinned -- six of them stacked, which is worse
     than none. */
  t.check(/\.nav-group\{display:flex;flex-direction:column;/.test(src),
    'each section is its own block, so its heading is pushed out by the next');
  t.check((sidebar.match(/<div class="nav-group" data-group="[A-Za-z]+">/g) || []).length === 6,
    'and all six are wrapped, each naming itself so the fold state can be remembered by section rather than by position');
  const labelRule = (/\.nav-section-label\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/position:sticky;top:0/.test(labelRule), 'the heading follows the list');
  t.check(/background:var\(--navy\)/.test(labelRule),
    'opaquely, or the rows slide through it on their way past');
}

/* ---------- 6. the map is read off the rail, never rewritten --------- */
{
  const build = extractFunction(src, 'buildNavIndex', 'index.html');
  t.check(/document\.querySelectorAll\('#sidebar nav [^']*'\)/.test(build),
    'the search index is read from the rail itself');
  t.check(/if\(el\.classList\.contains\('nav-section-label'\)\)\{ group = el\.textContent\.trim\(\); return; \}/.test(build)
    && /el\.dataset\.tab/.test(build),
    'walking it in order so a screen takes the section it is written under');
  /* Keyboard shortcuts live in the title attribute -- "(press Q)",
     "(press P)", "(press R)", "(press C)". Indexing titles made "pres"
     return Presets and then four screens whose only connection was a
     keystroke. */
  t.check(/terms: \[label, group, el\.dataset\.keywords\|\|''\]\.join\(' '\)\.toLowerCase\(\)/.test(build),
    'from the name, the section and the keywords -- never from the title, which carries the shortcuts');
  /* Sections are wrapped so their headings can stick, and Dashboard is
     not in one. A children-only walk saw the six wrappers and nothing
     inside them, which emptied search of everything but Dashboard. */
  t.check(!/#sidebar nav > \*/.test(build),
    'and reaches inside the section wrappers rather than stopping at them');
  /* A second list in the script would be free to drift, and the first
     symptom would be a screen search cannot find or a breadcrumb naming
     the wrong section. */
  t.check(!/const NAV_SCREENS\s*=/.test(src) && !/NAV_MAP\s*=\s*\[/.test(src),
    'and there is no second copy of the map in the script to drift from it');

  // Worker view is hidden until a login turns out to be staff, so the
  // index built at load does not have it and has to be built again.
  t.check(/NAV_INDEX = buildNavIndex\(\);/.test(src.slice(src.indexOf("workerNavItem').style.display"))),
    'the index is rebuilt when worker view is revealed, or search would never find it');
  /* ONE surface to reveal it on now. The sheet reads the rail, so
     revealing the rail row reveals the screen everywhere -- this used to
     reveal two buttons by id, and a worker-enabled shop lost the screen
     on whichever was forgotten. The second id is gone, and nothing may
     reach for it. */
  t.check(!/mmsWorkerViewBtn/.test(src),
    'the phone sheet has no second worker button to forget');
  const reveal = (/workerNavItem'\)\.style\.display[\s\S]{0,400}?NAV_INDEX = buildNavIndex\(\);/.exec(src) || [''])[0];
  t.check(reveal.length > 0,
    'revealing the rail row rebuilds the index, which is what the phone sheet reads');
}

/* ---------- 7. search, run against the real rail --------------------- */
/*
 * Several screens are deliberately named for the question they answer
 * rather than the table they draw. That reads better and scans worse,
 * and search is what makes the trade payable: the word an accountant
 * would type has to find the screen a shopkeeper would recognise.
 */
{
  /* Every row, hidden ones included, so the filter that drops them is
     doing work here rather than being written out of the fixture. Worker
     view is hidden until a login turns out to be staff. */
  const NAV_INDEX = INDEX.map((x) => ({
    ...x,
    terms: [x.label, x.group, x.keywords].join(' ').toLowerCase(),
    el: { style: { display: x.hidden ? 'none' : '' } },
  }));
  t.check(INDEX.some((x) => x.hidden), 'the fixture contains a row the rail is hiding');
  const { navSearchMatches } = compileScope(
    [extractFunction(src, 'navSearchMatches', 'index.html')],
    { NAV_INDEX }, ['navSearchMatches'],
  );
  const labels = (q) => navSearchMatches(q).map((x) => x.label);
  const first = (q) => (navSearchMatches(q)[0] || {}).label;

  /* Debtors is now called Debtors, so this pair no longer tests the
     same thing on both sides -- and the half that matters has moved.
     What has to hold is that the name somebody ALREADY HAS IN THEIR
     HEAD still opens the screen: "who owes you" was this screen's name
     until it was redrawn, and renaming a door must never make it harder
     to open. It is a keyword now. */
  t.check(first('debtors') === 'Debtors', `the table-shaped word finds it (${first('debtors')})`);
  t.check(first('who owes you') === 'Debtors',
    `and the name it used to carry still finds it (${first('who owes you')})`);
  /* And now the same on the buy side: the creditors list was "Who you
     owe" until it was drawn as a console, so the question-shaped name
     is a keyword rather than the label. Both halves of the book are
     named the words a shop, an accountant and a bank already use, and
     both keep the name they used to carry. */
  t.check(first('creditors') === 'Creditors', `and so does the other (${first('creditors')})`);
  /* Inclusion, not first place, and that is not a weaker check being
     settled for. The two screens' old names are near-anagrams of each
     other -- "who owes you" and "who you owe" share every word, and the
     match is per-term and unordered by design -- so both doors open on
     either phrase and neither can be made to win. What must hold is
     that the word already in somebody's head reaches its screen. */
  t.check(labels('who you owe').includes('Creditors'),
    `and the name IT used to carry still finds it (${labels('who you owe').join(', ')})`);
  t.check(first('stock') === 'Inventory', `a word the screen is not called finds it (${first('stock')})`);
  /* And the phrase reaches it too, now that the log is one of its two
     lenses rather than a screen beside it. This pair used to hold the
     opposite: that "stock" went to the shelf and "stock movements" went
     to a different destination, because a second screen called Stock
     movements would otherwise have taken a rank-0 label match on the
     app's most obvious search. There is no second screen to protect
     from now -- both land on the shelf, which is where the log lives --
     and what still has to hold is that the words did not fall out of
     the app with the door. */
  t.check(first('stock movements') === 'Inventory',
    `and the phrase reaches the screen that now holds the log (${first('stock movements')})`);
  t.check(first('movements') === 'Inventory',
    `as does its own name (${first('movements')})`);
  {
    const inv = INDEX.find((x) => x.tab === 'inventory') || { keywords: '' };
    const carried = ['movements', 'log', 'history', 'trail', 'correction', 'write off', 'received'];
    const lost = carried.filter((w) => !inv.keywords.includes(w));
    t.check(lost.length === 0,
      `Inventory carries the search words of the lens it absorbed${lost.length ? ' — lost ' + lost.join(', ') : ''}`);
    t.check(!INDEX.some((x) => x.tab === 'stock-movements') && !/id="tab-stock-movements"/.test(src),
      'Movements is not a destination any more, and has no section left behind');
    const alias = extractFunction(src, 'resolveTab', 'index.html');
    t.check(/if\(tab === 'stock-movements'\)\{ invLens = 'moves'; return 'inventory'; \}/.test(alias),
      'but the old door still opens it, on the lens it meant — resolved once at the top of goToTab, so a saved last-tab cannot boot into a section that is gone');
  }
  t.check(first('photos') === 'Media', `and so does what is actually in it (${first('photos')})`);

  // Every term, in any order -- typing what you remember in the order
  // you remember it.
  t.check(first('sales an') === 'Sales analytics', 'two partial words match together');
  t.check(first('an sales') === 'Sales analytics', 'in either order');

  /* A match on the name beats a match on a keyword, or typing a screen's
     own name lands you on a different screen that merely mentions it.
     "pay" is the case where the two disagree: Purchase invoices carries
     the keyword "payables" and is written FIRST, so document order and
     ranking give different answers and only one of them is right. */
  t.check(labels('pay').length > 1, `"pay" matches more than one screen (${labels('pay').join(', ')})`);
  t.check(first('pay') === 'Payroll & rent',
    `and the one actually called that comes first (${first('pay')})`);
  t.check(first('suppliers') === 'Suppliers', 'likewise for Suppliers');

  t.check(navSearchMatches('zzzz').length === 0, 'a word that names nothing returns nothing');
  t.check(navSearchMatches('').length === 0, 'and an empty box is not a search');
  t.check(navSearchMatches('e').length <= 8, 'a single letter is capped rather than listing the whole map');

  /* Presets was renamed The shop: a preset is a value that pre-fills a
     field, which described six of its twelve settings and none of the
     ones that matter. The old name is kept as a KEYWORD, so a shop that
     has typed "pres" for a year still lands on it -- which is the whole
     reason keywords exist and the reason renaming a screen is cheap. */
  t.check(labels('pres').length === 1 && labels('pres')[0] === 'The shop',
    `"pres" still finds it under its new name, and nothing else (${labels('pres').join(', ')})`);
  t.check(labels('settings').length === 1 && labels('settings')[0] === 'The shop',
    `and so does the word people actually reach for (${labels('settings').join(', ')})`);

  /* Worker view is on the rail but hidden unless this login is staff.
     Search offering it would be search offering a screen the rail is
     deliberately not showing. */
  t.check(labels('worker').every((l) => l !== 'Worker view'),
    `a screen the rail is hiding is not offered (${labels('worker').join(', ') || 'nothing'})`);
}

/* ---------- 7b. what picking a result does -------------------------- */
{
  const run = (cursor) => {
    const log = { closed: false, went: null, valueWhenNavigating: null };
    const input = { value: 'loa', blurred: false, blur() { this.blurred = true; } };
    const { goToNavSearchHit } = compileScope(
      [extractFunction(src, 'goToNavSearchHit', 'index.html')],
      {
        navSearchHits: [{ tab: 'loans' }],
        navSearchInput: input,
        closeNavSearch: () => { log.closed = true; },
        goToTab: (tab) => { log.went = tab; log.valueWhenNavigating = input.value; },
        /* Picking a result now also writes it to the recent list and, on
           the phone, closes the sheet it was picked from. Neither is
           what this block is about — it is about the box being cleared
           BEFORE the screen is shown — so both are stubbed. */
        navRecentPush: () => {},
        phoneSearching: () => false,
        closePhoneSearch: () => {},
      },
      ['goToNavSearchHit'],
    );
    goToNavSearchHit(cursor);
    return { log, input };
  };

  {
    const { log, input } = run(0);
    t.check(log.went === 'loans', `picking a result navigates to it (${log.went})`);
    /* Left holding what was typed, the box reads as a live search of a
       screen you have already left -- and the next Ctrl+K opens onto a
       stale list. */
    t.check(input.value === '' && log.closed && input.blurred,
      'and clears the box, shuts the list and gives up the field');
    t.check(log.valueWhenNavigating === '',
      'all of it before navigating, not after the screen has already changed');
  }
  {
    // The cursor sits on nothing when there were no matches at all.
    const { log } = run(-1);
    t.check(log.went === null && !log.closed, 'and a cursor on nothing does nothing');
  }

  /* Two presses, two different jobs. One Escape that did both would
     throw a search away because the results were not the ones wanted.

     The first press used to call closeNavSearch directly; it now calls
     renderNavSearch, which on a computer -- where an empty box has
     nothing to show -- closes the list by exactly that call, and on the
     phone falls back to the way-in list rather than to a blank sheet.
     Same two jobs, one path instead of two. */
  const esc = (/else if\(e\.key === 'Escape'\)\{([\s\S]*?)\n  \}/.exec(src) || ['', ''])[1]
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  t.check(/if\(navSearchInput\.value\)\{ navSearchInput\.value = ''; renderNavSearch\(\); \}/.test(esc),
    'Escape clears what was typed first');
  t.check(/navSearchInput\.blur\(\);/.test(esc) && esc.indexOf('navSearchInput.value = \'\'')
    < esc.indexOf('navSearchInput.blur()'),
    'and gives up the field only on the second press, never on the first');
}

/* ---------- 8. what the bar says instead ----------------------------- */
{
  t.check(/id="tbWhere"/.test(topbar), 'the bar says which screen you are on');
  t.check(/updateTopbarWhere\(tab\);/.test(extractFunction(src, 'goToTab', 'index.html')),
    'refreshed on every move, or it names wherever you were last');
  const where = extractFunction(src, 'updateTopbarWhere', 'index.html');
  t.check(/tbw-group">\$\{esc\(hit\.group\)\}/.test(where) && /NAV_INDEX\.find/.test(where),
    'naming its section too, from the same index the rail was read into');

  t.check(/id="navSearch"/.test(topbar), 'and carries the search box');
  t.check(/\(e\.ctrlKey \|\| e\.metaKey\) && \(e\.key === 'k' \|\| e\.key === 'K'\)/.test(src),
    'reachable by Ctrl+K');
  t.check(/id="tbSearchKbd"/.test(topbar) && /Ctrl K/.test(topbar),
    'which is printed in the box, because a shortcut nobody is told about is one nobody uses');
  /* The app binds bare Q, C, P and R to screens and guards them against
     firing while something is being typed into. A bare key for search
     would have to work from inside a field, which is where it must not
     -- so every route that focuses the box is behind a modifier. */
  /* KEYBOARD routes only, and the distinction is the whole point: the
     rule exists because a bare LETTER would have to work from inside a
     field, where it must not. A tap on the phone's magnifier competes
     with no shortcut at all and is not what this guards — so the check
     asks what kind of listener each focus call sits in rather than
     banning the call outright. */
  const focuses = [...src.matchAll(/navSearchInput\.focus\(\)/g)];
  const listenerBefore = (i) => {
    const types = [...src.slice(0, i).matchAll(/addEventListener\('(\w+)'/g)];
    return types.length ? types[types.length - 1][1] : '';
  };
  const keyRoutes = focuses.filter((m) => listenerBefore(m.index) === 'keydown');
  const unguarded = keyRoutes.filter((m) =>
    !/e\.ctrlKey \|\| e\.metaKey/.test(src.slice(Math.max(0, m.index - 200), m.index)));
  t.check(keyRoutes.length > 0 && unguarded.length === 0,
    `every KEY that grabs the box is a chord (${keyRoutes.length} key route(s) of ${focuses.length}, ${unguarded.length} unguarded)`);
}

/* ---------- 9. the labels name the question, not the table ----------- *
 * Still the rule, with ONE screen deliberately out of it.
 *
 * Debtors was "Who owes you" on the rail, "Debtors list" in its own
 * heading and "Who owes you" again in the bar above -- three names for
 * one screen, which is a defect whichever of them you prefer. Asked to
 * settle it, the owner chose Debtors. The question-shaped name was worth
 * less than it cost here: this screen is the one an accountant, a bank
 * and every other shop already has a word for, and a name being
 * evocative does not help a screen that cannot agree with itself about
 * what it is called.
 *
 * The rule is not repealed -- "What's coming" and "What to buy" still
 * answer questions, and are still checked. But the exception has now
 * been taken twice, and for the same reason both times: "Who you owe"
 * was the creditors list's third name, beside a "Creditors list"
 * heading and a "Who you owe" breadcrumb, and a screen that cannot
 * agree with itself about what it is called is a defect whichever name
 * you prefer. The two ledger screens are the ones every shop, bank and
 * accountant already has a word for. The cost is paid in keywords,
 * tested above: "who owes you" and "who you owe" both still find their
 * screen.
 */
{
  t.check(/nav-label">Debtors</.test(rail), 'the debtors list is named the word the shop already uses');
  t.check(/data-keywords="[^"]*who owes you/.test(rail),
    'and the name it used to carry is kept as a keyword rather than dropped');
  t.check(/nav-label">Creditors</.test(rail), 'and the creditors list is named the same way, for the same reason');
  t.check(/data-keywords="[^"]*who you owe/.test(rail),
    'with the name IT used to carry kept as a keyword too');
  t.check(!/Debtors List</.test(sidebar) && !/Creditors List</.test(sidebar),
    'the table-shaped names are gone from the rail');
  t.check(!/Debtors List</.test(sheet) && !/Creditors List</.test(sheet),
    'and from the phone, which still had them');
}

/* ---------- 10. every button the JS reaches for is really there ------ */
{
  // Rearranging markup breaks navigation by removing an id, and the
  // failure is a throw on boot rather than anything visible in a diff.
  /* mmsWorkerViewBtn is deliberately NOT on this list any more. The
     phone sheet is generated from the rail, so worker view has one
     reveal rather than two, and an id that no longer exists cannot be
     the one somebody forgets. */
  ['workerNavItem', 'adminSignoutBtn', 'tbSignoutBtn', 'orderStatusBar',
    'collapseToggle', 'navSearch', 'navSearchResults', 'tbWhere',
    'mms_dest', 'mmsExportBtn', 'mmsImportBtn', 'mmsClearBtn']
    .forEach((id) => {
      t.check(new RegExp(`id="${id}"`).test(src), `#${id} exists in the markup`);
      // Not every one is fetched by a literal getElementById: the two
      // order-status widgets are looped over by id, so match the name
      // anywhere it is quoted in the script rather than one call shape.
      t.check(new RegExp(`getElementById\\('${id}'\\)|'${id}'`).test(src),
        `and the script reaches for #${id}`);
    });
}

/* ---------- 11. the counts survive a normal screen ------------------- */
{
  /* The order counts were hidden below 1320px -- which is exactly the
     width the widget needs WITH its labels. So the rule fired precisely
     when the thing would not have fitted, and the widget was invisible on
     every ordinary laptop at 100% zoom. Zooming OUT was the only way to
     see it, which is backwards for the one figure on the bar that is
     meant to be caught at a glance.

     The fix is that it sheds width instead of disappearing, so what is
     pinned here is the absence of a desktop-width hide, not a number. */
  const MOBILE_BREAKPOINT = 820;
  const blocks = [...src.matchAll(/@media\s*\(max-width:\s*(\d+)px\)\s*\{([\s\S]*?)\n\s*\}/g)];
  const offenders = blocks.filter(([, px, body]) =>
    Number(px) > MOBILE_BREAKPOINT
    && /\.topbar\s+\.order-status-bar\s*\{[^}]*display:\s*none/.test(body));
  t.check(offenders.length === 0,
    `nothing hides the order counts on a desktop screen${offenders.length ? ` (hidden at ${offenders.map((o) => o[1]).join('px, ')}px)` : ''}`);

  t.check(/@media \(max-width:1400px\)\{[^}]*\.topbar \.osb-label\{display:none;\}/.test(src),
    'the labels are what give way first, well before the row runs out of room');
  t.check(!/\.topbar \.osb-count\{[^}]*display:\s*none/.test(src),
    'and the counts themselves are never dropped');

  const render = (/function updateOrderStatusBar\(\)[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/title="\$\{name\}: \$\{count\}"/.test(render),
    'each count names its own stage, so the widget still reads when the labels are gone');

  /* The same figure, carried to where the screen is chosen. Drawn only
     when it is not zero -- a row of zeroes teaches you to stop reading
     the badges, and then so does the one that is not. */
  const badge = extractFunction(src, 'setNavBadge', 'index.html');
  t.check(/const show = Number\(n\) > 0;/.test(badge) && /el\.hidden = !show;/.test(badge),
    'a rail badge is drawn only when it has something to say');
  t.check(/setNavBadge\('navBadgeOrders'/.test(render), 'the order count reaches the rail');
  t.check(/setNavBadge\('navBadgeDebtors'/.test(extractFunction(src, 'updateDebtorsNavBadge', 'index.html')),
    'and so does how many customers owe you');
  /* Counted off every row rather than the filtered list: the badge
     answers "is there anything to chase", which a search typed into that
     screen must not change. */
  t.check(/debAllRows\(\)\.filter\(r=> r\.debt > 0\)/.test(extractFunction(src, 'updateDebtorsNavBadge', 'index.html')),
    'from every debtor, not from whatever that screen is filtered to');
  /* Every count goes through refreshNavBadges(), and BOTH the full render
     and the 30-second background refresh call it. The poll used to redraw
     through goToTab() alone -- one screen, no badges -- so a debt taken on
     another device sat uncounted on this rail until the page was reloaded.
     Asserted on the helper rather than on renderAll's literal calls, so
     the claim survives the counts being grouped. */
  const navBadges = extractFunction(src, 'refreshNavBadges', 'index.html');
  t.check(/updateDebtorsNavBadge\(\);/.test(navBadges) && /updateOrderStatusBar\(\);/.test(navBadges),
    'every rail count is refreshed from one place');
  t.check(/refreshNavBadges\(\);/.test(extractFunction(src, 'renderAll', 'index.html')),
    'and both are set at load, not only once the screen they describe is opened');
  t.check(/refreshNavBadges\(\);/.test(extractFunction(src, 'pollForUpdatesNow', 'index.html')),
    'and again after a background refresh, which replaces the data every count is drawn from');
}

/* ---------- the phone bar's selected tab is readable ------------------
 *
 * The bar is a <nav> deliberately, so goToTab's `nav button[data-tab]`
 * selector finds it without a second wiring step. The cost of that is
 * that the rail's own `nav button.active{background:var(--accent);
 * color:#fff}` reaches it too, and painted an oxide-red tile behind the
 * selected tab. `.mbn-btn.active` carries two classes and so won the
 * COLOUR back -- to amber ink, which was written for text on a light
 * amber panel. Dark olive on red: reported off a phone, and the worst
 * contrast in the app.
 *
 * The tile is turned off rather than the text being made to survive it,
 * because the bar is white and a selected tab in a white bar is marked
 * by colour.
 */
{
  const activeRule = (/\.mbn-btn\.active\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/background:transparent/.test(activeRule),
    'the phone bar cancels the rail tile it inherits from the bare `nav button.active` selector');
  t.check(!/--accent-ink/.test(activeRule),
    'and does not use the ink meant for light amber, which is what made it olive-on-red');
  t.check(/color:var\(--accent\)/.test(activeRule),
    'the selected tab is marked in the accent, on the bar’s own white');

  /* The rail is the thing that rule belongs to and must be untouched:
     white on oxide there is correct and is what the sidebar has always
     looked like. */
  t.check(/nav button\.active\{background:var\(--accent\);color:#fff;font-weight:700;\}/.test(src),
    'while the rail keeps its own white-on-oxide row');

  /* Order matters: the override has to come after the rule it cancels.
     Equal specificity is decided by source order, and the same fix
     written earlier in the sheet is a fix that does nothing. */
  t.check(src.indexOf('.mbn-btn.active{') > src.indexOf('nav button.active{'),
    'and the phone override is written after the rail rule it overrides');
}

/* ---------- a header full of buttons still fits the phone -------------
 *
 * Reported from a phone: "Add product" hung 55px past the right edge of
 * its panel with its label cut in half. .btn-row was display:flex with
 * no wrap, and the Products header carries three controls -- Print list,
 * the price-mode group, Add product -- which together are wider than a
 * phone.
 *
 * A button nobody can reach is worse than a button on a second line, and
 * wrapping costs nothing at any width where they already fit.
 */
{
  const rowRule = (/\.btn-row\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/display:flex/.test(rowRule) && /flex-wrap:wrap/.test(rowRule),
    `a row of buttons wraps rather than running off the panel (${rowRule})`);
}

process.exit(t.done() ? 1 : 0);
