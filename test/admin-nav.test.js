#!/usr/bin/env node
'use strict';
/*
 * The admin sidebar, grouped by the job being done.
 *
 * Twenty destinations were filed under "Main", "Records" and "System".
 * "Records" held Customers, Staff, Sales Agents, Suppliers, Purchase
 * invoices AND the Cash Book -- a drawer, not a category. Six of the
 * twenty were additionally hidden behind hover flyouts.
 *
 * Two regroupings carry real meaning rather than tidiness:
 *
 *   - Debtors and Creditors came out of Analytics. Who owes you money is
 *     something you act on, not something you analyse, and it belongs
 *     beside the cash book. They are named for the question now.
 *   - Purchase invoices sit with Suppliers and Compare Prices, because
 *     buying stock is one job spread across three screens.
 *
 * The flyouts are gone with them. Nothing hides.
 *
 * Run: node test/admin-nav.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('admin nav');
const src = read('index.html');
// Anchored inside the sidebar, not on the first `<nav>` in the file. There
// are three, and the first is a literal `<nav>` written inside a CSS
// comment -- the same prose-matching-as-code trap that has caught several
// checks in this suite.
const sidebar = (/<aside class="sidebar"[\s\S]*?<\/aside>/.exec(src) || [''])[0];
const nav = (/<nav>([\s\S]*?)<\/nav>/.exec(sidebar) || ['', ''])[1];

/* ---------- 1. nothing was lost in the move ------------------------- */
{
  const EVERY_TAB = [
    'dashboard', 'quote', 'quote-saved', 'invoices', 'customers', 'agents',
    'compare', 'suppliers', 'purchase-invoices',
    'cashbook', 'analytics-debtors', 'analytics-creditors',
    'products', 'prices', 'inventory',
    'analytics-sales', 'analytics-purchase',
    'staff', 'worker', 'presets',
  ];
  const present = [...nav.matchAll(/data-tab="([a-z-]+)"/g)].map(m => m[1]);
  const missing = EVERY_TAB.filter(x => !present.includes(x));
  t.check(missing.length === 0, `every destination survived the regroup${missing.length ? ` (missing ${missing.join(', ')})` : ` (${present.length})`}`);
  t.check(new Set(present).size === present.length, 'and none is listed twice');

  // The three non-tab actions have no data-tab and used to rely on the
  // flyout closing itself; they must still be in the nav.
  ['exportBtn', 'importBtn', 'clearBtn'].forEach(id => {
    t.check(new RegExp(`id="${id}"`).test(nav), `${id} still has a home in the nav`);
  });
}

/* ---------- 2. grouped by job ---------------------------------------- */
{
  const labels = [...nav.matchAll(/nav-section-label">([^<]+)</g)].map(m => m[1].trim());
  t.check(!labels.includes('Main') && !labels.includes('Records') && !labels.includes('System'),
    'the drawer headings are gone');
  ['Selling', 'Buying', 'Money', 'Price book', 'Insight'].forEach(g => {
    t.check(labels.includes(g), `"${g}" is a section`);
  });

  // Which section a destination sits under, by reading the nav in order.
  const order = [...nav.matchAll(/nav-section-label">([^<]+)<|data-tab="([a-z-]+)"/g)];
  const sectionOf = {};
  let cur = '(top)';
  order.forEach(m => { if (m[1]) cur = m[1].trim(); else sectionOf[m[2]] = cur; });

  t.check(sectionOf['dashboard'] === '(top)', 'the dashboard sits above the sections, as the landing screen');

  // The two moves that are the point of the exercise.
  t.check(sectionOf['analytics-debtors'] === 'Money' && sectionOf['analytics-creditors'] === 'Money',
    'who owes you and who you owe are filed under Money, not Analytics');
  t.check(sectionOf['cashbook'] === 'Money', 'beside the cash book');
  t.check(sectionOf['purchase-invoices'] === 'Buying' && sectionOf['suppliers'] === 'Buying'
    && sectionOf['compare'] === 'Buying',
    'buying stock is one section: compare, suppliers, purchase invoices');

  t.check(sectionOf['quote'] === 'Selling' && sectionOf['invoices'] === 'Selling'
    && sectionOf['customers'] === 'Selling' && sectionOf['agents'] === 'Selling',
    'and selling holds the quote, the invoice, the customer and the agent');
  t.check(sectionOf['products'] === 'Price book' && sectionOf['prices'] === 'Price book'
    && sectionOf['inventory'] === 'Price book',
    'what you sell and what it costs sit together');
}

/* ---------- 3. nothing hides ----------------------------------------- */
{
  t.check(!/nav-submenu/.test(nav), 'no destination is behind a flyout');
  t.check(!/nav-parent-btn/.test(nav), 'and there are no parent buttons left to open one');

  // The machinery that drove them, and every reference to it, must be gone
  // -- a leftover getElementById would return null and throw on boot,
  // which no source-parsing check would notice.
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  ['quotesNavItem', 'analyticsNavItem', 'supplierNavItem', 'productsNavItem', 'settingsNavItem', 'wireNavFlyout']
    .forEach(ref => {
      t.check(!new RegExp(`\\b${ref}\\b`).test(code), `${ref} is not referenced anywhere`);
    });
}

/* ---------- 4. the labels name the question, not the table ----------- */
{
  t.check(/nav-label">Who owes you</.test(nav), 'the debtors list is named for what it answers');
  t.check(/nav-label">Who you owe</.test(nav), 'and so is the creditors list');
  t.check(!/nav-label">Debtors List</.test(nav) && !/nav-label">Creditors List</.test(nav),
    'the table-shaped names are gone');
}

process.exit(t.done() ? 1 : 0);
