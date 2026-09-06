#!/usr/bin/env node
'use strict';
/*
 * The Shop, laid out as one page rather than twelve doors.
 *
 * WHAT THE OLD TEST PINNED, AND WHY IT STOPPED BEING TRUE.
 *
 * It pinned a left rail of twelve sub-tabs grouped by what each setting
 * affects, with a count on each of the six that were lists. That was a
 * real improvement on the eight equal pills before it, and the count was
 * the point: it answered "is anything in there" without clicking.
 *
 * But it could only ever answer that for the six settings that WERE
 * lists. The other six -- the default price rule, agent terms, order
 * timing, mobile money, signed-in devices, shop identity -- carried
 * nothing at all, because .pset-count:empty collapses. So the rail was
 * silent about exactly the settings that matter, and one of those
 * silences is a shop-stopping condition: presetDefaultMarkup defaults to
 * {}, and a product with no rule of its own and no shop default behind
 * it cannot be quoted, sold at the counter, or catalogued. The Products
 * register marks that state on every affected line. The page that causes
 * it never mentioned it.
 *
 * So the grouping-by-rail checks are gone, and what replaces them is
 * stricter: there are no doors at all, the page says out loud what is
 * unset and what depends on it, and every row of the index carries its
 * state -- which is the thing the rail could not do for half its
 * entries.
 *
 * Four decisions worth pinning:
 *
 *   nothing hidden     no sub-tab, no pane, no accordion. Everything is
 *                      on one scroll, so Ctrl-F works, which it cannot
 *                      when content lives behind a tab.
 *   derived, decomposed the band counts lines through productLineStats,
 *                      the same derivation the Products register marks
 *                      each line with -- and it is ABSENT, not empty and
 *                      not a green tick, when nothing is unset.
 *   counted once       .pset-count[data-count] is written by one pass and
 *                      appears twice per list -- on the list and on the
 *                      index -- so the two can never disagree.
 *   read, not moved    the five rules set on other screens are shown here
 *                      with a door. Two controls for one number is how
 *                      they drift apart.
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
  // Each control is bound by id at parse time. A dropped id is a
  // getElementById(...).addEventListener on null, which throws and stops
  // the rest of the script binding -- so this is not a cosmetic check.
  const IDS = [
    'preset_cat_new', 'preset_cat_add', 'presetCategoriesWrap',
    'preset_unit_new', 'preset_unit_add', 'presetUnitsWrap',
    'preset_location_new', 'preset_location_add', 'presetLocationsWrap',
    'preset_attr_name', 'preset_attr_values', 'preset_attr_add', 'presetAttrsWrap',
    'preset_income_cat_new', 'preset_income_cat_add', 'presetIncomeCatsWrap',
    'preset_expense_cat_new', 'preset_expense_cat_add', 'presetExpenseCatsWrap',
    'presetOrderLimitsWrap', 'preset_stage_alerts', 'preset_stage_alerts_state',
    'preset_price_stale_days', 'preset_price_review_target',
    'preset_agent_discount_wholesale', 'preset_agent_discount_retail',
    'preset_agent_cluster_wait_days',
    'preset_default_markup_wholesale_type', 'preset_default_markup_wholesale_value',
    'preset_default_markup_retail_type', 'preset_default_markup_retail_value',
    'preset_default_markup_caption',
    'preset_shop_name', 'preset_shop_address', 'preset_shop_phone', 'preset_shop_tin',
    'preset_receipt_footer', 'preset_auto_print_receipt',
    'momo_mtn_enabled', 'momo_mtn_environment', 'momo_mtn_subscriptionKey',
    'momo_mtn_apiUser', 'momo_mtn_apiKey', 'momo_mtn_save_btn', 'momo_mtn_provision_btn',
    'momo_airtel_enabled', 'momo_airtel_environment', 'momo_airtel_clientId',
    'momo_airtel_clientSecret', 'momo_airtel_save_btn', 'momoLedgerWrap',
    'ls_refresh', 'ls_tidy', 'ls_list', 'ls_more',
  ];
  const missing = IDS.filter((id) => !new RegExp(`id="${id}"`).test(section));
  t.check(missing.length === 0,
    `every control survived the redesign${missing.length ? ` (missing ${missing.join(', ')})` : ` (${IDS.length})`}`);
}

/* ---------- 2. there are no doors ------------------------------------ */
{
  /* The whole change. A door is a promise that what is behind it can be
     summarised on its face, and half of these could not be: the rail had
     nothing to say about the six settings that were not lists. */
  t.check(!/data-ptab=/.test(src), 'no sub-tab is left anywhere in the file');
  t.check(!/id="ppane-/.test(src), 'and no pane it would have opened');
  t.check(!/\.preset-tab\{/.test(src) && !/class="preset-tab/.test(src),
    'the rule and the class are both gone, not merely unused');
  t.check(!/pset-shell|pset-nav/.test(src),
    'and so is the two-column shell that held the rail');
  // display:none in the markup is how a pane hides. Nothing on this page
  // may start hidden except the section itself and the no-match panel,
  // which the search turns on.
  const hidden = (section.match(/style="display:none;?"/g) || []).length;
  t.check(hidden === 2,
    `nothing on the page starts hidden but the screen and the no-match note (${hidden})`);
}

/* ---------- 3. three regions, and one accent ------------------------- */
{
  const regions = [...section.matchAll(/class="pset-rgn" data-rgn="([a-z]+)"/g)].map((m) => m[1]);
  t.check(regions.join(',') === 'words,rules,shop',
    `three regions, in the order they are read (${regions.join(', ')})`);
  const heads = (section.match(/class="pset-rg-t"/g) || []).length;
  t.check(heads === regions.length, `each one names itself (${heads})`);
  // Every region carries a sentence saying what KIND of thing is in it.
  // That sentence is the whole argument for the grouping: a word list
  // costs nothing if it is wrong and a rule changes tomorrow's figures.
  t.check((section.match(/class="pset-rg-s"/g) || []).length === regions.length,
    'and says what kind of setting is in it');

  /* The accent appears ONCE per screen: it is the one thing to do next.
     The old page had the active tab, six oxide .pset-group h4s and two
     accent Save buttons. The only accent here is the band's action, and
     the band is not drawn at all when there is nothing to do. */
  const accents = (section.match(/btn-accent/g) || []).length;
  t.check(accents === 0, `no accent is baked into the markup (${accents})`);
  const band = (/function renderPresetBand\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check((band.match(/btn-accent/g) || []).length === 1,
    'the one accent on the screen is the band’s action');
  t.check(/color:var\(--ink-soft\);margin:0 0 6px;\}/.test(src.slice(src.indexOf('.pset-group h4{'))),
    'and the group headings are ink, not six more of it');
}

/* ---------- 4. the band is derived, decomposed, and goes away -------- */
{
  const causes = (/function presetUnsetCauses\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(causes.length > 0, 'what is unset is computed, not written into the markup');

  /* Derived, never invented. The count of lines falling through an unset
     default rule is the SAME derivation the Products register marks each
     line with -- productSetupFault -> 'unruled' -- so the two screens can
     never report different numbers about the same blank. */
  t.check(/productLineStats\(productRowsForList\(\)\)\.unruled/.test(causes),
    'the price-rule count comes from productLineStats, the way Products derives it');
  t.check(/shopDefaultMarkupRule\('wholesale'\)/.test(causes)
    && /shopDefaultMarkupRule\('retail'\)/.test(causes),
    'and fires only when NEITHER side has a default, which is when a line can fall through');

  /* A cause that cannot be counted is not claimed. If the read throws,
     the band still names the fault; it just does not invent a figure. */
  t.check(/catch\(e\)\{ n = -1; \}/.test(causes) && /n > 0/.test(causes),
    'a count that could not be worked out is left out rather than guessed');

  /* Not enough is an answer. A shop that has set no limits AND no alert
     has decided, not forgotten -- and a band that argues with a decision
     is a band you learn to scroll past. */
  t.check(/if\(data\.presetStageAlerts && !limitsSet\)/.test(causes),
    'no limits with the alert off is a decision, and is not reported as unset');

  const band = (/function renderPresetBand\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(!causes\.length\)\{ wrap\.innerHTML = ''; return; \}/.test(band),
    'nothing unset draws no band at all — not an empty one and not a green tick');
  t.check(/cb-openbar/.test(band),
    'and it is the band this app already ships rather than a fourteenth one');
  // One line per cause, so the sentence can be argued with rather than
  // believed.
  t.check(/causes\.map\(c=> `<p class="cb-openbar-w">/.test(band),
    'each cause gets its own line, naming what depends on it');
}

/* ---------- 5. the index says what is set, from one count ------------ */
{
  const fn = (/function renderPresetCounts\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(fn.length > 0, 'the list counts are computed');
  ['presetCategories', 'presetUnits', 'presetLocations', 'presetAttributes',
    'presetIncomeCategories', 'presetExpenseCategories'].forEach((key) => {
    t.check(new RegExp(`data\\.${key}\\|\\|\\[\\]`).test(fn), `${key} is counted`);
  });

  // Blank, not zero -- a list nobody has filled in is not the same news
  // as one deliberately emptied.
  t.check(/el\.textContent = n \? String\(n\) : '';/.test(fn),
    'an empty list shows no badge rather than a zero');
  t.check(/\.pset-count:empty\{display:none;\}/.test(src),
    'and the badge collapses rather than sitting there empty');

  /* Counted ONCE, shown twice. Every list carries .pset-count[data-count]
     on the list itself and again on its index row, and one
     querySelectorAll fills both -- so the index cannot claim a number the
     list does not show. This is what replaces "counted last". */
  ['categories', 'units', 'locations', 'income', 'expense', 'attributes'].forEach((k) => {
    const n = (section.match(new RegExp(`data-count="${k}"`, 'g')) || []).length;
    t.check(n === 2, `${k} is counted once and shown in both places (${n})`);
  });

  const render = (/function renderPresets\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* Two bands now: what is UNSET among the rules, and what is TANGLED
     in the lists. Both are drawn after the panels they describe, for
     the same reason the counts are -- a band that ran first would be
     reporting the state before the edit that prompted the redraw. */
  t.check(/renderPresetCounts\(\);\s*\n  renderPresetBand\(\);\s*\n  renderPresetWordsBand\(\);\s*\n  renderPresetIndex\(\);\s*\n\}/.test(render),
    'the counts, both bands and the index are all written after the panels they describe');
  t.check(/if\(tab==='presets'\)\{/.test(code) && /renderPresets\(\);/.test(code),
    'and the tab redraws on entry, so every claim is about current data');

  /* The six the old rail could not count. Each index row carries its
     state as words -- "not set", "none of 6", "MTN live" -- which is the
     whole reason the rail is gone. */
  const ix = (/function renderPresetIndex\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  ['Default price rule', 'Agent share of margin', 'Order step limits',
    'On paper', 'Mobile money', 'Signed-in devices'].forEach((name) => {
    t.check(ix.indexOf(name) !== -1, `the index reports ${name}, which the rail could not`);
  });
  t.check(/mk \? 'set' : 'not set'/.test(ix) && /'warn'/.test(ix),
    'and marks the unset ones, rather than showing a blank that reads as fine');

  /* null is "could not read", which is not "nothing signed in" -- the
     same distinction renderLoginSessions already draws. */
  t.check(/lsRows === null[\s\S]*?'not read'/.test(ix),
    'a device list that could not be read says so rather than counting zero');
}

/* ---------- 6. the five rules that are set elsewhere ----------------- */
{
  /* buy_cover on What to buy, pr_target and pr_days on Pricing,
     chase_after on Chase debts, pw_days on the Price registry. All five
     write to this shop's own presets blob, and not one of them has ever
     been on this page -- so there was nowhere to see what the app
     assumes. */
  const list = (/const PRESET_OUTSIDE_RULES = \[[\s\S]*?\n\];/.exec(code) || [''])[0];
  t.check(list.length > 0, 'the rules set on other screens are listed here');
  ['presetRestockCoverDays', 'presetTargetMarginPct', 'presetDeadStockDays',
    'presetChaseAfterDays', 'presetPriceWatchDays'].forEach((key) => {
    t.check(list.indexOf(key) !== -1, `${key} is read on this page`);
  });
  ['buying', 'pricing', 'chase', 'prices'].forEach((tab) => {
    t.check(new RegExp(`tab:'${tab}'`).test(list), `and names ${tab} as where it is set`);
  });

  /* Read, not moved. A number that changes what a list in front of you
     says is set beside that list; two controls for one setting is how
     they drift apart. */
  const out = (/function renderPresetOutsideRules\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(!/<input/.test(out), 'they are read-only here — no second control for the same number');
  t.check(/data-pset-tab="\$\{esc\(r\.tab\)\}"/.test(out), 'each carries a door to the screen that owns it');
  t.check(/goToTab\(door\.dataset\.psetTab\)/.test(code), 'and the door opens it');
}

/* ---------- 7. the search ------------------------------------------- */
{
  const run = (/function runPresetSearch\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(run.length > 0, 'the page can be searched');

  /* It matches what a setting DOES as well as what the app calls it:
     "receipt" has to find the shop's address, and nothing is named that.
     data-find carries the doing-words; textContent carries the names. */
  t.check(/el\.dataset\.find \+ ' ' \+ el\.textContent/.test(run),
    'matching what a setting does as well as what it is called');
  const finds = (section.match(/data-find="/g) || []).length;
  t.check(finds >= 12, `every block on the page is searchable (${finds})`);
  t.check(/data-find="[^"]*receipt/.test(section),
    'and "receipt" reaches the shop identity, which is not named that');

  // A region with nothing in it is not drawn -- and the page does not
  // report "0 results" about regions nobody asked for.
  t.check(/r\.style\.display = shown \? '' : 'none';/.test(run),
    'a region with no match is not drawn');
  t.check(/Try what the setting changes/.test(run),
    'and a search that finds nothing says what to try instead');

  // Clearing the box puts everything back. There is no separate search
  // screen to come back from.
  t.check(/if\(!q\)\{[\s\S]*?targets\.forEach\(el=> el\.style\.display = ''\);/.test(run),
    'clearing the box restores the whole page');

  // The index doubles as the way in: clicking a row searches for it.
  t.check(/box\.value = go\.dataset\.go \|\| go\.dataset\.psetGo \|\| '';/.test(code),
    'and clicking an index row searches for that setting');
}

/* ---------- 8. no prose above a control ------------------------------ */
{
  /* The old panes opened with up to 87 words before the first field, so
     on several of them the thing you came for was below the fold of its
     own pane. The page's long explanation is now in .ow-ph-help, which
     foldPageInstructions puts behind the "i"; every other paragraph sits
     below the control as .ow-mini, which is what the console does
     everywhere else. */
  t.check(/class="ow-ph-help"/.test(section), 'the long explanation is folded behind the "i"');
  t.check(!/class="pset-head"/.test(section) && !/pset-note-t/.test(section),
    'and no pane heading survives to put a paragraph above a field');
  const minis = (section.match(/class="ow-mini"/g) || []).length;
  t.check(minis >= 4, `the rest sits under what it explains (${minis} footnotes)`);
  // .pset-head is still the product form's pane heading and is untouched.
  t.check(/\.pset-head\{/.test(src) && /class="pset-head"/.test(src),
    'the shared heading class is left alone, being the product form’s');
}

/* ---------- 9. what the lists say about themselves ------------------- */
{
  /* The rules region reports what is UNSET. At this shop's real data the
     words needed the same treatment for a different fault: three words
     in two places at once, one category holding more sub-categories than
     all the others together, and eight categories holding nothing. None
     of that was visible on a screen that drew every sub-category chip at
     once and let you scroll. */
  const find = (/function presetWordsFindings\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(find.length > 0, 'what is tangled is computed, not written into the markup');

  // Case-folded, because "colour" and "Colour" are the same word to a
  // person typing into a suggestion box and two words to a filter.
  const places = (/function presetWordPlaces\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/\.trim\(\)\.toLowerCase\(\)/.test(places),
    'a word is the same word whatever its case — which is how a list reaches 58');
  t.check(/kind:'category'/.test(places) && /kind:'sub'/.test(places),
    'and both levels are indexed, since the duplicate that matters spans them');

  /* The one threshold on the page, and it is a fact about the list
     rather than an opinion about the shop: a catch-all is a name holding
     more than every other name put together. */
  t.check(/counts\[top\] > out\.subTotal - counts\[top\]/.test(find),
    'a catch-all is one name holding more than all the rest together, not "a big category"');

  // Nothing under it AND nothing filed in it. A category with no
  // sub-categories but forty products is a category that works.
  t.check(/if\(presetProductsInCategory\(c\.name\)\.length\) return;/.test(find),
    'an empty category is only idle if no product is filed in it either');

  const band = (/function renderPresetWordsBand\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(!lines\.length\)\{ wrap\.innerHTML = ''; return; \}/.test(band),
    'and nothing tangled draws no band at all');
  t.check(/cb-openbar/.test(band),
    'in the same band the unset one uses, rather than a second kind of warning');

  // Both bands are the shop's own figures. Neither counts anything the
  // other does, so they can be read one after the other.
  t.check(/presetProductsWithAttr/.test(code) && /variantAttrs/.test(code),
    'attribute use is read off the products, not typed here');
}

/* ---------- 10. the one thing that moves records --------------------- */
{
  const plan = (/function presetMergePlan\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  const commit = (/function presetMergeCommit\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(plan.length > 0 && commit.length > 0, 'a word can be moved into another');

  /* Counted before it moves, and the count depends on the destination,
     so it is recomputed rather than worked out once when the sheet
     opens. */
  t.check(/presetProductsInSub\(cat\.name, word\)/.test(plan)
    && /presetProductsInCategory\(cat\.name\)/.test(plan),
    'what would move is counted from the products themselves');
  t.check(/to\.addEventListener\('change', presetMergeRecount\)/.test(code),
    'and re-counted when the destination changes, since the answer depends on it');

  /* The direction is toward the shallower word. Merging a
     sub-category into a category OF THAT NAME drops the sub, or a
     product ends up filed under "Hinges > Hinges". */
  t.check(/const absorbs = isSub && dest\.name\.toLowerCase\(\) === String\(word\)\.toLowerCase\(\);/.test(plan),
    'a word merged into a category of its own name becomes that category');
  t.check(/p\.subcategory = absorbs \? '' : word;/.test(commit),
    'rather than being carried in as a sub-category of itself');

  /* It moves; it never removes. Deleting a word from a list stops it
     being suggested, and that is a different act with a different
     confirm. */
  t.check(!/products\.splice/.test(commit) && !/delete data\.products/.test(commit),
    'no product is deleted by a merge — only the words on it change');
  t.check(/p\.category = dest\.name;/.test(commit), 'the products are refiled under the destination');

  /* One snapshot, taken before anything is written, of exactly the two
     fields this can change plus the two lists — so a half-applied merge
     is not reachable through Undo. */
  t.check(/presetLastMerge = \{[\s\S]{0,300}?id:p\.id, category:p\.category, subcategory:p\.subcategory/.test(commit),
    'a snapshot is taken before anything is written');
  const undo = (/function presetUndoMerge\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/data\.presetCategories = snap\.categories;/.test(undo) && /p\.subcategory = was\.subcategory;/.test(undo),
    'and Undo restores the lists and the products together');
  /* In the panel, not a toast: the toast this app ships lasts 2.2
     seconds and takes no action, and a merge that refiles a hundred
     order lines deserves longer than that to be taken back. */
  t.check(/class="pset-undo"/.test(src) && /id="pset_merge_undo"/.test(code),
    'the way back sits in the panel rather than in a toast that expires');

  // Deleting a category says what happens to the products rather than
  // implying they go with it.
  t.check(/keep\$\{n===1\?'s':''\} their category text/.test(code),
    'and deleting a word says plainly that the products keep their text');
}

/* ---------- 11. a list too long to read at once ---------------------- */
{
  /* 17 categories with 64 sub-categories drew 2,100px before the second
     list began. The row now carries the one fact you decide from, and
     everything you can DO to a category is inside the opened row -- so a
     list of seventeen has no destructive control on it at all. */
  const cats = (/function renderPresetCategories\(edit\)[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/presetOpenCat === idx \? null : idx/.test(cats), 'a category opens where it sits');
  t.check(/data-cat-row=/.test(cats) && !/preset-row-remove[^]{0,80}data-idx="\$\{i\}"><\/button>/.test(cats),
    'and the row itself is the only control on a closed one');
  t.check(/id="preset_cat_find"/.test(cats),
    'seventeen is enough to need finding rather than scrolling');
  t.check(/again\.setSelectionRange\(at, at\);/.test(cats),
    'and typing in it does not lose the caret to the redraw');

  const attrs = (/function renderPresetAttrs\(edit\)[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  /* On products / on nothing. A HEADING, not an amber mark: a shop can
     add an attribute the day before it builds the variants that use it,
     so an unused attribute is not a fault -- it is just the line that
     splits 58 into two lists you can each read. */
  t.check(/On products/.test(attrs) && /On nothing/.test(attrs),
    'attributes are split by the one fact that makes 58 readable');
  t.check(/used: presetProductsWithAttr\(a\.name\)\.length/.test(attrs),
    'derived from the products, not from a flag typed here');
  t.check(!/ow-warn/.test(attrs) && !/ow-bad/.test(attrs),
    'and it is a heading rather than a mark, because an unused attribute is not a fault');
  t.check(/no values, so this attribute suggests nothing/i.test(attrs),
    'an attribute with no values says why it can never match anything');
}

process.exit(t.done() ? 1 : 0);
