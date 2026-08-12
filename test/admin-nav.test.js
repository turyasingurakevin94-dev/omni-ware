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
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

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
   group, every button after it belongs to that group. */
function railIndex() {
  const out = [];
  let group = '';
  const re = /<div class="nav-section-label">([^<]+)<\/div>|<button([^>]*?)>([\s\S]*?)<\/button>/g;
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
    'compare', 'suppliers', 'purchase-invoices',
    'products', 'prices', 'inventory', 'media', 'fasteners',
    'cashbook', 'analytics-debtors', 'analytics-creditors', 'statements', 'payroll', 'assets', 'loans',
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
  // The measure that matters: how much of the map you can see without
  // opening something. It was 7 of 28.
  const visible = INDEX.filter((x) => !x.hidden).length;
  t.check(visible >= 26,
    `${visible} destinations are on screen at rest, none of them behind a menu`);

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
    && groupOf['assets'] === 'Money' && groupOf['loans'] === 'Money' && groupOf['payroll'] === 'Money',
    'and they sit with the cash book, the statements, what the shop owns, what it owes and what it pays');
  t.check(groupOf['compare'] === 'Buy' && groupOf['suppliers'] === 'Buy'
    && groupOf['purchase-invoices'] === 'Buy',
    'buying stock is one job across three screens');
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
{
  const railTabs = new Set(tabsIn(rail));
  const phoneTabs = new Set([...tabsIn(sheet), ...tabsIn(bottomNav)]);
  const strandedOnDesktop = [...railTabs].filter((x) => !phoneTabs.has(x));
  const strandedOnPhone = [...phoneTabs].filter((x) => !railTabs.has(x));
  t.check(strandedOnDesktop.length === 0,
    `every screen on the rail is reachable on a phone${strandedOnDesktop.length ? ` (missing: ${strandedOnDesktop.join(', ')})` : ''}`);
  t.check(strandedOnPhone.length === 0,
    `and the phone offers nothing the rail does not${strandedOnPhone.length ? ` (extra: ${strandedOnPhone.join(', ')})` : ''}`);

  /* Same names for the same groups. The sheet used to file by Sales /
     Catalog / People / Reports / Settings while the bar filed by Sell /
     Buy / Money / Price book / Insight -- so a supplier was under
     "People" on a phone and "Buy" on a desktop, and the shop had to
     learn both. */
  const sheetGroups = [...sheet.matchAll(/<div class="mms-group-label">([^<]+)<\/div>/g)].map((m) => m[1].trim());
  const railGroups = [...new Set(INDEX.map((x) => x.group))].filter(Boolean);
  const foreign = sheetGroups.filter((g) => !railGroups.includes(g));
  t.check(foreign.length === 0,
    `the phone files under the same section names${foreign.length ? ` (its own: ${foreign.join(', ')})` : ` (${sheetGroups.join(', ')})`}`);
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
  t.check((sidebar.match(/<div class="nav-group">/g) || []).length === 6,
    'and all six are wrapped');
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
  // Two surfaces to reveal it on now, not three. Missing one leaves a
  // worker-enabled shop with the screen hidden on that device only.
  const reveal = (/workerNavItem'\)\.style\.display[\s\S]{0,600}?mmsWorkerViewBtn'\)\.style\.display/.exec(src) || [''])[0];
  t.check(reveal.length > 0, 'the rail and the phone sheet are revealed together');
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

  t.check(first('debtors') === 'Who owes you',
    `the old name still finds the new one (${first('debtors')})`);
  t.check(first('creditors') === 'Who you owe', `and so does the other (${first('creditors')})`);
  t.check(first('stock') === 'Inventory', `a word the screen is not called finds it (${first('stock')})`);
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

  t.check(labels('pres').length === 1 && labels('pres')[0] === 'Presets',
    `"pres" finds Presets and nothing else, the shortcuts being out of the index (${labels('pres').join(', ')})`);

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
     throw a search away because the results were not the ones wanted. */
  t.check(/if\(navSearchInput\.value\)\{ navSearchInput\.value = ''; closeNavSearch\(\); \}\s*\n\s*else navSearchInput\.blur\(\);/.test(src),
    'Escape clears what was typed first and gives up the field only on the second press');
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
  const focuses = [...src.matchAll(/navSearchInput\.focus\(\)/g)];
  const unguarded = focuses.filter((m) =>
    !/e\.ctrlKey \|\| e\.metaKey/.test(src.slice(Math.max(0, m.index - 200), m.index)));
  t.check(focuses.length > 0 && unguarded.length === 0,
    `every shortcut that grabs the box is a chord (${focuses.length} route(s), ${unguarded.length} unguarded)`);
}

/* ---------- 9. the labels name the question, not the table ----------- */
{
  t.check(/nav-label">Who owes you</.test(rail), 'the debtors list is named for what it answers');
  t.check(/nav-label">Who you owe</.test(rail), 'and so is the creditors list');
  t.check(!/Debtors List</.test(sidebar) && !/Creditors List</.test(sidebar),
    'the table-shaped names are gone from the rail');
  t.check(!/Debtors List</.test(sheet) && !/Creditors List</.test(sheet),
    'and from the phone, which still had them');
}

/* ---------- 10. every button the JS reaches for is really there ------ */
{
  // Rearranging markup breaks navigation by removing an id, and the
  // failure is a throw on boot rather than anything visible in a diff.
  ['workerNavItem', 'mmsWorkerViewBtn', 'adminSignoutBtn', 'tbSignoutBtn', 'orderStatusBar',
    'collapseToggle', 'navSearch', 'navSearchResults', 'tbWhere']
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
  t.check(/updateDebtorsNavBadge\(\);/.test(extractFunction(src, 'renderAll', 'index.html'))
    && /updateOrderStatusBar\(\);/.test(extractFunction(src, 'renderAll', 'index.html')),
    'and both are set at load, not only once the screen they describe is opened');
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

process.exit(t.done() ? 1 : 0);
