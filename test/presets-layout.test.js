#!/usr/bin/env node
'use strict';
/*
 * Presets, laid out as a settings page.
 *
 * Eight equal pills in one row. They said nothing about which settings
 * belonged together, and they put two pages of number fields -- order
 * timing, agent terms -- beside six lists of words as though they were
 * the same kind of thing. Nothing on the screen said what was already
 * set up; you had to click each pill to find out.
 *
 * A left rail grouped by what the setting AFFECTS, with a count on each
 * list. The count is the point: it answers "is anything in there" from
 * the rail, which is the question that made people click through all
 * eight.
 *
 * Two decisions worth pinning:
 *
 *   blank, not zero   a list nobody has filled in is not the same news
 *                     as one deliberately emptied, and a column of 0s
 *                     reads as a broken screen.
 *   counted last      the counts are written after the panes render, so
 *                     the rail cannot claim a number the pane does not
 *                     show.
 *
 * Run: node test/presets-layout.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('presets layout');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const section = (/<section id="tab-presets"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];

/* ---------- 1. nothing was lost in the move -------------------------- */
{
  // Each pane's controls are bound by id at parse time. A dropped id is
  // a getElementById(...).addEventListener on null, which throws and
  // stops the rest of the script from binding -- so this is not a
  // cosmetic check.
  const IDS = [
    'preset_cat_new', 'preset_cat_add', 'presetCategoriesWrap',
    'preset_unit_new', 'preset_unit_add', 'presetUnitsWrap',
    'preset_location_new', 'preset_location_add', 'presetLocationsWrap',
    'preset_attr_name', 'preset_attr_values', 'preset_attr_add', 'presetAttrsWrap',
    'preset_income_cat_new', 'preset_income_cat_add', 'presetIncomeCatsWrap',
    'preset_expense_cat_new', 'preset_expense_cat_add', 'presetExpenseCatsWrap',
    'presetOrderLimitsWrap', 'preset_agent_discount_wholesale',
    'preset_agent_discount_retail', 'preset_agent_cluster_wait_days',
  ];
  const missing = IDS.filter((id) => !new RegExp(`id="${id}"`).test(section));
  t.check(missing.length === 0,
    `every control survived the redesign${missing.length ? ` (missing ${missing.join(', ')})` : ` (${IDS.length})`}`);

  // Every pane the rail points at has to exist, or clicking it shows
  // nothing and the previous pane stays up.
  const tabs = [...section.matchAll(/data-ptab="([a-z-]+)"/g)].map((m) => m[1]);
  /* Counted against the PANES rather than against a literal, which went
     stale the first time a setting was added (Shop identity, the ninth).
     What matters is that the rail and the body agree -- a hardcoded
     number only ever fails the person adding the next pane. */
  const panes = [...section.matchAll(/id="ppane-([a-z-]+)"/g)].map((m) => m[1]);
  t.check(tabs.length >= 8 && tabs.length === panes.length,
    `every setting is reachable, and nothing is stranded (${tabs.length} tabs, ${panes.length} panes)`);
  const orphans = tabs.filter((k) => !new RegExp(`id="ppane-${k}"`).test(section));
  t.check(orphans.length === 0,
    `each one has a pane to open${orphans.length ? ` (missing ppane-${orphans.join(', ppane-')})` : ''}`);
}

/* ---------- 2. grouped by what the setting affects ------------------- */
{
  const groups = [...section.matchAll(/class="pset-nav-group">([^<]+)</g)].map((m) => m[1].trim());
  t.check(groups.length >= 4, `the rail is grouped (${groups.length} headings)`);

  // Which group a setting sits under, by reading the rail in order.
  const order = [...section.matchAll(/class="pset-nav-group">([^<]+)<|data-ptab="([a-z-]+)"/g)];
  const groupOf = {};
  let cur = '(none)';
  order.forEach((m) => { if (m[1]) cur = m[1].trim(); else groupOf[m[2]] = cur; });

  t.check(groupOf['categories'] === groupOf['units'] && groupOf['units'] === groupOf['attributes'],
    'what you sell is one group: categories, units, attributes');
  t.check(groupOf['income-cats'] === groupOf['expense-cats'],
    'the two cash-book lists sit together');
  t.check(groupOf['income-cats'] !== groupOf['categories'],
    'and apart from the catalogue ones, which is the whole point of grouping');
  t.check(groupOf['order-tracking'] !== groupOf['categories'],
    'the board setting is not filed with a list of words');
}

/* ---------- 3. the rail says what is already set up ------------------ */
{
  const fn = (/function renderPresetCounts\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(fn.length > 0, 'the counts are computed');

  ['presetCategories', 'presetUnits', 'presetLocations', 'presetAttributes',
    'presetIncomeCategories', 'presetExpenseCategories'].forEach((key) => {
    t.check(new RegExp(`data\\.${key}\\|\\|\\[\\]`).test(fn), `${key} is counted`);
  });

  // Blank, not zero.
  t.check(/el\.textContent = n \? String\(n\) : '';/.test(fn),
    'an empty list shows no badge rather than a zero');
  t.check(/\.pset-count:empty\{display:none;\}/.test(src),
    'and the badge collapses rather than sitting there empty');

  // Counted after the panes are drawn, so the rail cannot disagree with
  // what opening it would show.
  const render = (/function renderPresets\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/renderPresetCounts\(\);\s*\n\}/.test(render),
    'the counts are written last, after every pane has rendered');

  // Presets was the only data tab that never redrew on entry.
  t.check(/if\(tab==='presets'\) renderPresets\(\);/.test(code),
    'and the tab redraws on entry, so a count is a claim about current data');
}

/* ---------- 4. a settings pane is not a list ------------------------- */
{
  // Order timing and agent terms are number fields, not chips. They were
  // presented identically to the six lists; now they carry no count and
  // agent terms is broken into named groups rather than one wall of
  // fields with two hint paragraphs.
  const agent = (/<div class="preset-pane" id="ppane-agent-discounts"[\s\S]*?\n            <\/div>/.exec(section) || [''])[0];
  const subheads = [...agent.matchAll(/<h4>([^<]+)<\/h4>/g)].map((m) => m[1]);
  t.check(subheads.length === 2, `agent terms is split into named groups (${subheads.join(', ')})`);

  /* The badge lives on the RAIL button, not in the pane -- the first
     version of this check looked in the pane, where a badge could never
     have appeared, and passed while one was sitting on the rail
     reporting the category count beside "Agent terms". */
  const nav = (/<nav class="pset-nav"[\s\S]*?<\/nav>/.exec(section) || [''])[0];
  const railItem = (key) => (new RegExp(`data-ptab="${key}"[\\s\\S]*?</button>`).exec(nav) || [''])[0];
  t.check(!/pset-count/.test(railItem('agent-discounts')),
    'and agent terms carries no count on the rail, having no list to count');
  t.check(!/pset-count/.test(railItem('order-tracking')), 'nor does order timing');
  // The six that ARE lists must each have one, or the rail is silent
  // about exactly the thing it exists to report.
  ['categories', 'units', 'attributes', 'income-cats', 'expense-cats', 'locations'].forEach((k) => {
    t.check(/pset-count/.test(railItem(k)), `${k} does carry one`);
  });

  // Every pane leads with what it is and what it feeds, rather than a
  // bare hint paragraph above an input.
  const heads = (section.match(/class="pset-head"/g) || []).length;
  const paneCount = (section.match(/id="ppane-/g) || []).length;
  t.check(heads === paneCount, `every pane introduces itself (${heads} heads, ${paneCount} panes)`);
}

/* ---------- 5. the old chrome is gone -------------------------------- */
{
  t.check(!/preset-toolbar/.test(src), 'the old toolbar rule has nothing left to style');
  t.check(!/preset-tabs/.test(src), 'nor the old pill strip');
  // .preset-hint is used all over the app and stays; the presets page
  // just no longer leans on it as a pane heading.
  t.check(/preset-hint/.test(src), 'the shared hint class is untouched, being used elsewhere');
  t.check(!/class="preset-hint"/.test(section),
    'but the presets panes head themselves properly instead of using it');
}

process.exit(t.done() ? 1 : 0);
