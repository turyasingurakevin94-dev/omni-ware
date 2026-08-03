#!/usr/bin/env node
'use strict';
/*
 * The admin navigation: a top bar holding the map, a rail holding the day.
 *
 * Twenty destinations in one vertical column had two costs. Finding
 * anything meant reading past everything. And -- the reason this was
 * urgent rather than untidy -- .sidebar-scroll is a column flex
 * container, so once the list outgrew the viewport every child with the
 * default flex-shrink:1 was squeezed. .brand is 34px of logo inside
 * overflow:hidden; it was crushed to 18px and the mark was CLIPPED, navy
 * showing through where the shop's own logo should have been.
 *
 * So the logo moved to a bar with room for it, the top bar took the whole
 * map, and the sidebar kept the six screens a shop opens every day.
 *
 * Two things this must not become:
 *
 *   a flyout again   the hover submenus were removed from this app for
 *                    hiding six destinations. A click-menu whose HEADING
 *                    is permanently on screen is a different thing, and
 *                    the difference is the heading. Checked below.
 *   a place to lose  every destination that existed before must still be
 *   things           reachable, and the rail's items must also appear in
 *                    the top bar -- otherwise collapsing the rail would
 *                    strand them.
 *
 * Run: node test/admin-nav.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('admin nav');
const src = read('index.html');

// Anchored on the elements themselves, not on the first `<nav>` in the
// file. There are several, and one is a literal `<nav>` written inside a
// CSS comment -- the same prose-matching-as-code trap that has caught
// other checks in this suite.
const topbar = (/<header class="topbar"[\s\S]*?<\/header>/.exec(src) || [''])[0];
const sidebar = (/<aside class="sidebar"[\s\S]*?<\/aside>/.exec(src) || [''])[0];
const rail = (/<nav>([\s\S]*?)<\/nav>/.exec(sidebar) || ['', ''])[1];

const tabsIn = (s) => [...s.matchAll(/data-tab="([a-z-]+)"/g)].map((m) => m[1]);

/* ---------- 1. nothing was lost ------------------------------------- */
{
  const EVERY_TAB = [
    'dashboard', 'quote', 'quote-saved', 'invoices', 'customers', 'agents',
    'compare', 'suppliers', 'purchase-invoices',
    'cashbook', 'analytics-debtors', 'analytics-creditors',
    'statements', 'assets', 'loans',
    'products', 'prices', 'inventory',
    'analytics-sales', 'analytics-purchase',
    'staff', 'worker', 'presets',
  ];
  const present = tabsIn(topbar);
  const missing = EVERY_TAB.filter((x) => !present.includes(x));
  t.check(missing.length === 0,
    `the top bar is the complete map${missing.length ? ` (missing ${missing.join(', ')})` : ` (${present.length} destinations)`}`);
  t.check(new Set(present).size === present.length, 'and none of it is listed twice');

  // The three non-tab actions are actions, not destinations, and keep the
  // ids their handlers bind to. Renaming them in the move would throw on
  // boot at getElementById(...).addEventListener, which no check that
  // only counted destinations would notice.
  ['exportBtn', 'importBtn', 'clearBtn'].forEach((id) => {
    t.check(new RegExp(`id="${id}"`).test(topbar), `${id} kept its id, so its handler still finds it`);
  });
  t.check(/id="importFile"/.test(src), 'and the hidden file input the import opens still exists');
}

/* ---------- 2. grouped by job, headings always visible --------------- */
{
  const headings = [...topbar.matchAll(/class="tb-top"[^>]*>\s*([A-Za-z ]+?)\s*</g)].map((m) => m[1].trim());
  ['Dashboard', 'Sell', 'Buy', 'Money', 'Price book', 'Insight', 'Setup'].forEach((h) => {
    t.check(headings.includes(h), `"${h}" is a heading on the bar itself`);
  });

  // Which group a destination sits under, by reading the bar in order.
  const order = [...topbar.matchAll(/data-menu="([a-z]+)"|data-tab="([a-z-]+)"/g)];
  const groupOf = {};
  let cur = '(bar)';
  order.forEach((m) => { if (m[1]) cur = m[1]; else groupOf[m[2]] = cur; });

  t.check(groupOf['dashboard'] === '(bar)',
    'the dashboard is on the bar itself, not inside a menu -- it is where a day starts');

  // The groupings that carry meaning rather than tidiness.
  t.check(groupOf['analytics-debtors'] === 'money' && groupOf['analytics-creditors'] === 'money',
    'who owes you and who you owe are money, not analytics -- they are acted on, not studied');
  t.check(groupOf['cashbook'] === 'money' && groupOf['statements'] === 'money'
    && groupOf['assets'] === 'money' && groupOf['loans'] === 'money',
    'and they sit with the cash book, the statements, what the shop owns and what it owes');
  t.check(groupOf['compare'] === 'buy' && groupOf['suppliers'] === 'buy'
    && groupOf['purchase-invoices'] === 'buy',
    'buying stock is one job across three screens');
  t.check(groupOf['quote'] === 'sell' && groupOf['invoices'] === 'sell'
    && groupOf['customers'] === 'sell' && groupOf['agents'] === 'sell',
    'selling holds the quote, the invoice, the customer and the agent');
  t.check(groupOf['products'] === 'pricebook' && groupOf['prices'] === 'pricebook'
    && groupOf['inventory'] === 'pricebook',
    'what you sell and what it costs sit together');
}

/* ---------- 3. the rail is the day, and strands nothing -------------- */
{
  const railTabs = tabsIn(rail);
  const barTabs = tabsIn(topbar);

  t.check(railTabs.length <= 8,
    `the rail is short enough not to need scrolling (${railTabs.length} items)`);
  // The bug that started this: a rail long enough to overflow squeezed
  // the brand block to nothing. Nothing about the fix works if the rail
  // grows back.
  ['dashboard', 'quote', 'quote-saved', 'cashbook'].forEach((x) => {
    t.check(railTabs.includes(x), `${x} is on the rail -- it is opened every day`);
  });

  const stranded = railTabs.filter((x) => !barTabs.includes(x));
  t.check(stranded.length === 0,
    `everything on the rail is also in the top bar, so collapsing the rail loses nothing${stranded.length ? ` (stranded: ${stranded.join(', ')})` : ''}`);

  t.check(!/nav-section-label/.test(rail),
    'and it is short enough to need no section headings of its own');
}

/* ---------- 4. the logo is out of the squeeze ------------------------ */
{
  t.check(/<header class="topbar"[\s\S]*?class="brand"/.test(topbar),
    'the brand sits in the top bar');
  t.check(!/class="brand"/.test(sidebar),
    'and no longer in the flex column that crushed it');

  // Belt and braces on the mechanism itself: the top bar is also a flex
  // container, so the same shrink applies if the row ever runs out of
  // width. Pinned in CSS rather than left to the row never being full.
  const brandRule = (/\.topbar \.brand\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/flex-shrink:\s*0/.test(brandRule),
    'the brand cannot be shrunk by its container -- the exact failure that clipped it before');
  t.check(!/overflow:\s*hidden/.test(brandRule),
    'and nothing clips it even if something does squeeze it');
}

/* ---------- 5. nothing hides ----------------------------------------- */
{
  t.check(!/nav-submenu/.test(topbar) && !/nav-submenu/.test(sidebar),
    'the old hover flyouts are not back');
  t.check(/tb-group/.test(topbar) && /class="tb-top"/.test(topbar),
    'the menus open from a heading that is on screen whether they are open or not');

  // A menu that opened on hover would reappear under a pointer merely
  // crossing the bar. Pinned as a source check because the difference
  // between :hover and a click listener is the whole design decision.
  t.check(!/\.tb-group:hover\s*>?\s*\.tb-menu/.test(src),
    'and they open on a click, not on a pointer passing over them');

  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  ['quotesNavItem', 'analyticsNavItem', 'supplierNavItem', 'productsNavItem', 'settingsNavItem', 'wireNavFlyout']
    .forEach((ref) => {
      t.check(!new RegExp(`\\b${ref}\\b`).test(code), `${ref} is not referenced anywhere`);
    });
}

/* ---------- 6. the labels name the question, not the table ----------- */
{
  t.check(/nav-label">Who owes you</.test(topbar), 'the debtors list is named for what it answers');
  t.check(/nav-label">Who you owe</.test(topbar), 'and so is the creditors list');
  t.check(!/nav-label">Debtors List</.test(topbar) && !/nav-label">Creditors List</.test(topbar),
    'the table-shaped names are gone');
}

/* ---------- 7. every button the JS reaches for is really there ------- */
{
  // Rearranging markup breaks navigation by removing an id, and the
  // failure is a throw on boot rather than anything visible in a diff.
  ['workerNavItem', 'workerTopbarItem', 'mmsWorkerViewBtn', 'adminSignoutBtn', 'tbSignoutBtn', 'orderStatusBar']
    .forEach((id) => {
      t.check(new RegExp(`id="${id}"`).test(src), `#${id} exists in the markup`);
      // Not every one is fetched by a literal getElementById: the two
      // order-status widgets are looped over by id, so match the name
      // anywhere it is quoted in the script rather than one call shape.
      t.check(new RegExp(`getElementById\\('${id}'\\)|'${id}'`).test(src),
        `and the script reaches for #${id}`);
    });

  // Worker view is revealed in three places now. Missing one leaves a
  // worker-enabled shop with the destination hidden in that surface only.
  const reveal = (/workerNavItem'\)\.style\.display[\s\S]{0,320}?mmsWorkerViewBtn'\)\.style\.display/.exec(src) || [''])[0];
  t.check(/workerTopbarItem'\)\.style\.display/.test(reveal),
    'and the top bar is revealed alongside the rail and the phone sheet');
}

/* ---------- 8. the counts survive a normal screen -------------------- */
{
  /* The order counts were hidden below 1320px -- which is exactly the
     width the widget needs WITH its labels. So the rule fired precisely
     when the thing would not have fitted, and the widget was invisible on
     every ordinary laptop at 100% zoom. Zooming OUT was the only way to
     see it, which is backwards for the one figure on the bar that is
     meant to be caught at a glance.

     The fix is that it sheds width instead of disappearing, so what is
     pinned here is the absence of a desktop-width hide, not a number. Any
     future `display:none` above the phone breakpoint brings the bug back
     whatever threshold it picks. */
  const MOBILE_BREAKPOINT = 820;
  const blocks = [...src.matchAll(/@media\s*\(max-width:\s*(\d+)px\)\s*\{([\s\S]*?)\n\s*\}/g)];
  const offenders = blocks.filter(([, px, body]) =>
    Number(px) > MOBILE_BREAKPOINT
    && /\.topbar\s+\.order-status-bar\s*\{[^}]*display:\s*none/.test(body));
  t.check(offenders.length === 0,
    `nothing hides the order counts on a desktop screen${offenders.length ? ` (hidden at ${offenders.map((o) => o[1]).join('px, ')}px)` : ''}`);

  // What it is allowed to shed, and the order it sheds in: the label
  // first, because the dot carries the stage and the number carries the
  // news. Dropping the count instead would leave a widget that says
  // nothing.
  t.check(/@media \(max-width:1400px\)\{[^}]*\.topbar \.osb-label\{display:none;\}/.test(src),
    'the labels are what give way first, well before the row runs out of room');
  t.check(!/\.topbar \.osb-count\{[^}]*display:\s*none/.test(src),
    'and the counts themselves are never dropped');

  // Without labels the stages are four coloured dots. Each item names
  // itself so the colours never have to be learnt.
  const render = (/function updateOrderStatusBar\(\)[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/title="\$\{name\}: \$\{count\}"/.test(render),
    'each count names its own stage, so the widget still reads when the labels are gone');
}

process.exit(t.done() ? 1 : 0);
