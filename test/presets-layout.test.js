#!/usr/bin/env node
'use strict';
/*
 * The Shop, as the owner drew it on the canvas.
 *
 * WHAT THE OLD TESTS PINNED, AND WHY EACH STOPPED BEING TRUE.
 *
 * First it pinned a left rail of twelve sub-tabs. That rail could only
 * report state for the six settings that were lists; the other six --
 * the default price rule among them, whose blank stops a line being
 * quoted at all -- carried nothing. So the rail went, and this file
 * pinned "no doors at all": one scroll, every panel folded, the search
 * opening what it found.
 *
 * That fixed the doors' real fault and cost the owner a page of nearly
 * five thousand pixels, opened twice a year. The owner asked for the
 * sections back under tabs, on the canvas they signed off. So "no tab,
 * no pane, no accordion" is no longer the rule. What replaces it is the
 * thing that made the twelve doors wrong, stated directly:
 *
 *   no silent door        every tab carries its own state -- "1 unset",
 *                         "1 tangle" -- derived from the same list the
 *                         side panel's "Needs you" draws
 *   needs reach every tab the side panel lists what needs you on ANY tab,
 *                         and pressing a row opens its tab at the panel
 *   search ignores tabs   a search shows every match on every tab at
 *                         once and counts them on each tab's face --
 *                         which is what Ctrl-F over one scroll gave
 *   derived, decomposed   the band counts lines through productLineStats,
 *                         the same derivation the Products register marks
 *                         each line with -- and it is ABSENT when nothing
 *                         is unset
 *   counted once          .pset-count[data-count] is written by one pass
 *                         and appears twice per list -- on the list and on
 *                         the map -- so the two can never disagree
 *   read, not moved       the rules set on other screens are shown here
 *                         with a door. Two controls for one number is how
 *                         they drift apart.
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

/* ---------- 2. the old doors are gone -------------------------------- */
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
  /* WHAT MADE THE OLD DOORS DOORS was not that they hid things -- it
     was that the thing hiding them said nothing about what was behind.
     Six of twelve carried a count and six carried nothing at all.

     A collapsed row is not that, as long as it reports its own state:
     a category row carries its sub-category count, a provider row
     carries whether it is live and when it last did anything. So what
     is pinned is not "nothing is hidden" but "nothing is hidden behind
     something silent" -- and the only two things that start hidden in
     the markup are the two provider bodies, each with a head element
     the script fills with that provider's state. */
  const hiddenIds = [...section.matchAll(/id="([^"]+)"[^>]*style="display:none;?"/g)].map((m) => m[1]);
  const unnamed = (section.match(/style="display:none;?"/g) || []).length - hiddenIds.length;
  t.check(unnamed === 0, `everything that starts hidden is named (${unnamed} unnamed)`);
  const allowed = ['tab-presets', 'pset_no_match', 'momo_mtn_body', 'momo_airtel_body'];
  t.check(hiddenIds.every((id) => allowed.includes(id)),
    `and only these four (${hiddenIds.join(', ')})`);
  ['mtn', 'airtel'].forEach((p) => {
    t.check(new RegExp(`id="momo_${p}_head"`).test(section),
      `${p}'s collapsed body has a head to report its state`);
  });
  const rows = (/function renderMomoProviderRows\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/Live/.test(rows) && /Sandbox/.test(rows) && /Last prompt/.test(rows),
    'and that row says whether it is live and when it last did anything');
}

/* ---------- 3. three tabs, and one accent ---------------------------- */
{
  /* The order is the order of consequence: the rules change tomorrow's
     figures, the shop itself is who you are on paper and who is signed
     in, and the words only decide what a field suggests. The old order
     put the words first because they were the longest; on tabs, length
     no longer decides what you see first. */
  const regions = [...section.matchAll(/class="pset-rgn" data-rgn="([a-z]+)"/g)].map((m) => m[1]);
  t.check(regions.join(',') === 'rules,shop,words',
    `three regions, in the order of consequence (${regions.join(', ')})`);
  const tabs = [...section.matchAll(/class="pset-tab" role="tab" id="pset_tab_([a-z]+)" data-pset-rgn="\1" aria-controls="pset_rgn_\1"/g)].map((m) => m[1]);
  t.check(tabs.join(',') === regions.join(','), `one tab per region, each controlling it (${tabs.join(', ')})`);
  t.check(regions.every((r) => new RegExp(`id="pset_rgn_${r}" role="tabpanel" aria-labelledby="pset_tab_${r}"`).test(section)),
    'and each region is the panel its tab names, so a screen reader hears what it opened');
  /* A tab is only a door again if its face is silent. Each one carries a
     state element, and renderPresetTabs writes it. */
  t.check(regions.every((r) => new RegExp(`id="pset_tab_${r}_n"`).test(section)),
    'every tab carries a place for its own state');
  const tabsFn = (/function renderPresetTabs\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/getElementById\(`pset_tab_\$\{r\}_n`\)/.test(tabsFn) && /presetNeedsList\(\)/.test(tabsFn),
    'and writes it from the same list of needs the side panel draws');

  /* The accent appears ONCE per screen: it is the one thing to do next.
     The only accent here is the first chain's action, and the band is
     not drawn at all when there is nothing to do. */
  const accents = (section.match(/btn-accent/g) || []).length;
  t.check(accents === 0, `no accent is baked into the markup (${accents})`);
  const band = (/function renderPresetBand\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check((band.match(/btn-accent/g) || []).length === 1 && /i === 0 \? 'btn-accent' : 'btn-ghost'/.test(band),
    'the one accent on the screen is the first unset setting’s action; the rest are ghosts');
  t.check(/color:var\(--ink-soft\);margin:0 0 6px;\}/.test(src.slice(src.indexOf('.pset-group h4{'))),
    'and the group headings are ink, not more of it');
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
  /* WHAT THE OLD CHECK MEANT: one paragraph per cause, in the amber
     band other screens use. What it meant underneath was "each cause is
     stated so it can be argued with". The owner's canvas states it as a
     chain instead -- the setting, what waits on it, the screens it locks
     -- which can be argued with at a glance rather than by reading. */
  t.check(/causes\.map\(\(c, i\)=> `<div class="pset-ch">/.test(band),
    'each cause gets its own chain');
  t.check(/c\.locks\.map/.test(band) && /class="pset-ch-n"/.test(band),
    'naming how many things wait on it and which screens it locks');
  t.check(/data-pset-jump="\$\{c\.jump\}" data-pset-focus="\$\{c\.focus\}"/.test(band),
    'and its action goes to the field that sets it, not merely to the page');
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
  /* Two bands: what is UNSET among the rules, and what is TANGLED in
     the lists. Both are drawn after the panels they describe, for the
     same reason the counts are -- a band that ran first would be
     reporting the state before the edit that prompted the redraw. The
     index goes last because it draws the map, the tiles and the tab
     chips from what the bands have just found. (It replaced the folds
     in that slot: the folds are gone.) */
  t.check(/renderPresetCounts\(\);\s*\n  renderPresetBand\(\);\s*\n  renderPresetWordsBand\(\);\s*\n  renderPresetIndex\(\);\s*\n\}/.test(render),
    'the counts, both bands and the index are written after the panels they describe');
  const ixFn = (/function renderPresetIndex\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/renderPresetMap\(m\);\s*\n  renderPresetTiles\(\);\s*\n  renderPresetTabs\(\);/.test(ixFn),
    'and the index draws the map, the tiles and the tabs from one model');
  t.check(/if\(tab==='presets'\)\{/.test(code) && /renderPresets\(\);/.test(code),
    'and the tab redraws on entry, so every claim is about current data');

  /* The six the old rail could not count. Each index row carries its
     state as words -- "not set", "none of 6", "MTN live" -- which is the
     whole reason the rail is gone. */
  /* The rows are a model now, so the ring, the per-tab bars and the
     list all count the same rows. */
  const ix = (/function presetIndexModel\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  ['Default price rule', 'Agent share of margin', 'Order step limits',
    'On paper', 'Mobile money', 'Signed-in devices'].forEach((name) => {
    t.check(ix.indexOf(name) !== -1, `the index reports ${name}, which the rail could not`);
  });
  t.check(/mk \? 'set' : 'not set'/.test(ix) && /mk \? 'good' : 'warn'/.test(ix),
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

  /* The index doubles as the way in. It used to search for the row's
     name, which on one long scroll was the only way to bring a panel up;
     on tabs, pressing a row opens its tab at its panel. */
  t.check(/data-pset-jump="\$\{esc\(jump\)\}"/.test((/function presetIndexRow\([^)]*\)\{[\s\S]*?\n\}/.exec(code) || [''])[0]),
    'and pressing an index row goes to that setting');
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
  const minis = (section.match(/class="ow-mini[ "]/g) || []).length;
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

/* ---------- 12. taking mobile money ---------------------------------- */
{
  /* THE QUESTION is "can an agent pay me by phone right now, and is any
     money in limbo?" The keys are set once and never touched; the
     ledger changes by the hour. The panel was built the other way up --
     two credential forms, then the ledger at the bottom. */
  const sec = section.slice(section.indexOf('id="pset_momo"'), section.indexOf('id="pset_devices"'));
  t.check(sec.indexOf('id="momoActivity"') < sec.indexOf('id="momo_mtn_head"'),
    'the ledger comes before the credentials, not after them');
  t.check(sec.indexOf('id="momoAnswer"') < sec.indexOf('id="momoActivity"'),
    'and the answer comes before both');

  /* THE LEDGER WAS READ ONCE AND NEVER AGAIN. momoPayments is only
     cleared by a single re-check, so renderMomoLedger() on tab entry
     no-opped for the life of the page: a prompt that resolved minutes
     ago went on saying Pending until you reloaded. On the panel whose
     own note says a stale pending prompt is how money gets counted
     twice, the list of pending prompts was frozen. */
  const led = (/async function renderMomoLedger\(force\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(momoPayments===null \|\| force\)/.test(led),
    'the ledger can be re-read rather than only read once');
  t.check(/renderMomoLedger\(true\);/.test(code),
    'and the tab forces a fresh read on entry');
  t.check(/momoPaymentsReadAt/.test(led) && /Read \$\{esc\(momoAgo/.test(led),
    'and it says when it was read, so a stale figure cannot pass for a live one');

  // Named rather than dropped: two hundred rows and no word about the
  // rest, and the oldest is exactly where a payment goes to be forgotten.
  t.check(/momoPayments\.length >= MOMO_LEDGER_LIMIT/.test(led),
    'a truncated ledger says it is truncated');

  /* A prompt still pending a quarter of an hour later is not going to
     resolve on its own, and that is the one thing on this panel worth
     acting on. */
  const stuck = (/function momoStuckRows\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/p\.status === 'pending'/.test(stuck) && /MOMO_STUCK_MINUTES\*60000/.test(stuck),
    'a prompt pending far too long is found rather than left in the list');
  const band = (/function renderMomoBand\(\)[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/if\(!stuck\.length\)\{ wrap\.innerHTML = ''; return; \}/.test(band),
    'and nothing stuck draws no band');
  t.check(/counted twice/.test(band), 'the band says what is at stake rather than just counting');

  /* THE HEADER READ THE FORM. Unticking Enabled without saving made it
     announce that mobile money was off while it was still live, and a
     page whose read had not landed reported a live merchant account as
     off. */
  const st = (/function momoProviderState\(p\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(momoProviders === null\) return null;/.test(st),
    'not read yet is a third answer, not "off"');
  t.check(/const row = momoProviders\[p\];/.test(st) && !/getElementById/.test(st),
    'and the state is what the shop has saved, never what is sitting in the form');

  /* GOING LIVE MOVES REAL MONEY, and it was an ordinary <select>
     option with a Save button -- the only control on this page that
     debits other people's phones, and the only one with nothing in
     between. */
  const save = (/async function saveMomoProvider\(provider\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const goingLive = enabled && environment === 'production'/.test(save)
    && /!\(was && was\.enabled && was\.environment === 'production'\)/.test(save),
    'going live is confirmed, once, at the moment it becomes true');
  t.check(/if\(goingLive && !confirm\(/.test(save) && /debit a real phone/.test(save),
    'and the confirm says what it will do rather than asking "are you sure"');
  t.check(!/goingLive/.test(save.slice(save.indexOf('btn.disabled = true'))),
    'asked before the save begins, not after it has started');
}

/* ---------- 13. tabbed, but not doors again ---------------------------- */
{
  /* WHAT THIS SECTION USED TO PIN: nine folded panels, none exclusive,
     each header carrying its state, the search opening what it found,
     and the page remembering what you left open. The owner asked for the
     sections under tabs instead, and signed the canvas off. Every one of
     those protections is about one thing -- nothing hidden behind
     something silent -- and each has a tab-shaped equivalent pinned here.
     The fold machinery itself is gone, not left unused. */
  t.check(!/data-fold=/.test(section) && !/function renderPresetFolds/.test(code) && !/psetFold/.test(code),
    'the folds are gone, not merely unused');

  /* SEARCH IGNORES THE TABS. A match on a tab you are not looking at is
     a match you cannot see -- so a search shows every region that holds
     one, at once, and each tab's face says how many it holds. */
  const run = (/function runPresetSearch\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/r\.hidden = !shown;/.test(run) && /per\[r\.dataset\.rgn\]/.test(run),
    'a search shows every tab’s matches at once, counted per tab');
  t.check(/t\.dataset\.hits = String/.test(run),
    'and the tabs carry the count of what they hold');
  t.check(/if\(!q\)\{[\s\S]*?renderPresetTabs\(\);\s*\n    return;/.test(run),
    'and clearing the box puts the page back on the tab you were on');
  t.check(/!el\.querySelector\('\[data-find\]'\)/.test(run),
    'a panel and the row inside it are one result, not two');

  /* NEEDS REACH EVERY TAB. The thing that says a setting is unset takes
     you to it, whichever tab it lives on. */
  const jump = (/function psetJump\([^)]*\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/el\.closest\('\.pset-rgn'\)/.test(jump) && /psetTabSet\(rgn\.dataset\.rgn\)/.test(jump),
    'a jump opens the tab that holds its panel');
  t.check(/getElementById\(focusId\)/.test(jump),
    'and lands in the field it came to fill');
  t.check(/psetJump\('pset_w_cats', null, 'dupes'\)/.test(code),
    'and the tangle band opens the list it is about, narrowed to the tangle');
  const needs = (/function presetNeedsList\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/presetUnsetCauses\(\)/.test(needs) && /presetWordsFindings\(\)/.test(needs)
    && /momoStuckRows\(\)/.test(needs) && /lsStaleRows\(/.test(needs),
    'what needs you is derived -- unset, tangled, stuck and quiet -- not a preference');

  /* OPENS WHERE YOU ARE NEEDED, AND REMEMBERS. With nothing remembered
     the page opens on the tab of the first thing that needs you, so a
     shop with a shop-stopping blank never opens on a tab that hides it.
     A tab you chose outranks that, and must survive storage refusing. */
  const get = (/function psetTabGet\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/presetNeedsList\(\)\[0\]/.test(get), 'with nothing remembered it opens where you are needed');
  t.check(/localStorage\.setItem\(PSET_TAB_KEY/.test(code)
    && /catch\(e\)\{ \/\* storage refused/.test(code),
    'what you left open is what you find, and a refused store loses the memory, not the page');

  /* THE TILES ARE DERIVED. Each is a figure a panel below already works
     out, and a source that could not be read says so. */
  const tiles = (/function renderPresetTiles\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/productLineStats\(productRowsForList\(\)\)/.test(tiles) && /momoProviderState/.test(tiles)
    && /lsStaleRows\(lsRows/.test(tiles),
    'the tiles read the Products funnel, the saved providers and the read sessions');
  t.check((tiles.match(/could not be read/g) || []).length >= 2,
    'and a tile whose source could not be read says so rather than drawing a zero');

  /* THE RECEIPT PREVIEW INVENTS NO SALE. The shop's own lines print in
     words; the goods are bars, because a preview that printed figures
     this shop never charged would be a receipt that was made up. */
  const rc = (/function renderPresetReceipt\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(rc.length > 0 && !/fmtUGX|\d{2},\d{3}/.test(rc), 'the receipt preview prints no invented figure');
  t.check(/pset-rc-gap/.test(rc), 'and a line that is not set is a gap in the paper');

  /* THE SUM IS WORKED ON A REAL LINE, or on none. */
  const ex = (/function presetMarkupExample\(\)[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/productBestBuy\(row\.p\.id, row\.idx\)/.test(ex) && /return fallback;/.test(ex),
    'the price-rule sum is worked on one of the shop’s own priced lines, or says there is none');
}

process.exit(t.done() ? 1 : 0);
