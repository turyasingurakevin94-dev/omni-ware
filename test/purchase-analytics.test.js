#!/usr/bin/env node
'use strict';
/*
 * Purchase analytics.
 *
 * The page a buyer opens to ask "is what I'm paying going up?" -- built
 * on the purchase invoices, which are the only record of what the shop
 * pays -- and it could not answer. The item row carried the total spent
 * and the quantity bought and never the one number in between them.
 * Verified on the running app: 21,301,800 over 600 bags is 35,503 a bag,
 * one division from data already on the row, and on no screen.
 *
 * IT ADDED BAGS TO SHEETS TO KILOGRAMS. "Total stock 1,400" in the
 * largest type on the page, for a period in which the shop bought 600
 * bags of cement, 200 sheets of iron and 600 kilograms of nails. And the
 * item table REFUSED a totals row for the amount -- money, which adds up
 * perfectly and was already in the KPI beside it -- on the grounds that
 * an item-level total would be meaningless. It had it exactly backwards.
 *
 * THE COMMISSION TOTAL COUNTED A MISSING RATE AS ZERO. panRowsBySupplier
 * keeps null for a supplier with no rate, and its own comment says null
 * is "kept distinct from an honest 0 so the table can show '--'". The
 * totals row then collapsed it with `Number(r.commission)||0`. Verified:
 * 723,054 printed under 33,901,800 of purchases, 8,400,000 of which was
 * with a supplier who has no rate at all. The row was honest; the line
 * under it was not.
 *
 * Plus the same three faults the sales side had: the export wrote the
 * whole range unsorted from the button beside the search box, and the
 * KPIs ignored the search.
 *
 * Run: node test/purchase-analytics.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('purchase analytics');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['panVisibleTotals', 'panCommissionCoverage', 'panPriceMove', 'panFormatCell'];
let scope = null; let err = null;
try {
  scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {
    fmtUGX: (n) => `${Math.round(n).toLocaleString('en-US')} UGX`,
    esc: (s) => String(s),
  }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the purchase helpers compile${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(got - want) < 1e-6, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const kpis = (/function renderPanKpis\(rows\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const table = (/function renderPanTable\(\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
/* The totals row moved out of renderPanTable into a panFootRowHTML of its
   own, beside the panCellHTML that draws every other cell -- exactly the
   shape the sales side already had (anFootRowHTML / anCellHTML). The
   checks in section 4 are about what the foot DOES, so they read it where
   it now lives. Extracted by brace matching, not by a lazy regex. */
const foot = extractFunction(src, 'panFootRowHTML', 'index.html');
const cell = extractFunction(src, 'panCellHTML', 'index.html');
const byItem = (/function panRowsByItem\(invoices\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const forView = (/function panRowsForView\(\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const exportFn = (/pan_export_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
/* Extracted by brace matching rather than by a lazy regex over the whole
   file. panPreviousUnitPrices and panPreviousTotals contain the SAME
   guard line, and a `[\s\S]*?` search from the first ran straight past
   its own closing brace into the second -- so deleting the guard from
   one still matched the other and the check went on passing. */
const prevPrices = extractFunction(src, 'panPreviousUnitPrices', 'index.html');
const prevTotals = extractFunction(src, 'panPreviousTotals', 'index.html');

/* ---------- 1. what the shop is actually paying ---------------------- */
{
  t.check(/unitPrice: r\.purchased > 0 \? r\.amt \/ r\.purchased : null/.test(byItem),
    'the price paid per unit is worked out from the spend and the quantity');
  /* Null, not zero. Nothing bought is not a price of nothing, and a zero
     would sort to the top of "cheapest" and to the bottom of "dearest". */
  t.check(/: null,/.test(byItem), 'and is absent rather than zero when nothing was bought');
  t.check(/\{key:'unitPrice', label:'Price paid', numeric:true, money:true\}/.test(code),
    'with a column to show it in');
}

/* ---------- 2. and whether it is going up ---------------------------- */
if (scope) {
  const prices = new Map([['P001', 30000], ['P002', 42000]]);
  near(scope.panPriceMove({ key: 'P001', unitPrice: 35503 }, prices), (35503 - 30000) / 30000,
    'a price is compared with what the same item cost last period');
  eq(scope.panPriceMove({ key: 'P002', unitPrice: 42000 }, prices), 0, 'an unchanged price has not moved');
  /* An item bought for the first time this period has not gone up -- it
     has appeared. Reported as a rise it would sit at the top of a list
     of problems that it is not on. */
  eq(scope.panPriceMove({ key: 'P999', unitPrice: 5000 }, prices), null,
    'an item with nothing to compare against reports no move rather than a rise');
  eq(scope.panPriceMove({ key: 'P001', unitPrice: null }, prices), null,
    'nor does one nothing was bought of');
  eq(scope.panPriceMove({ key: 'P001', unitPrice: 100 }, null), null,
    'and no previous period at all means no move anywhere');
  eq(scope.panPriceMove({ key: 'P003', unitPrice: 100 }, new Map([['P003', 0]])), null,
    'while a previous price of zero is not something to divide by');

  /* Attached to the row, so "show me what has gone up most" is a sort.
     The row now carries the COST of the move as well, because that is
     what the screen ranks on: a percentage cannot be prioritised. +14.5%
     on binding wire is 345,600 and +2.4% on paint is 117,300, and
     ordering on the percentage puts the smaller bill first. */
  t.check(/priceMove: move/.test(forView) && /panPriceMove\(r, prev && prev\.prices\)/.test(forView),
    'the move is carried on the row so it sorts, filters and exports');
  t.check(/\(r\.unitPrice - before\) \* \(Number\(r\.purchased\)\|\|0\)/.test(forView),
    'and beside it, in money, what that move added to this period\u2019s bill');
  /* Null, not zero. A line first bought this period has not gone up, it
     has appeared -- and a zero would sort it into the middle of the
     ranking, among the lines whose price genuinely held. */
  t.check(/\(move == null \|\| before == null\) \? null/.test(forView),
    'which is absent, not zero, where there is nothing to compare with');
  t.check(/\{key:'priceCost'[^}]*money:true/.test(code), 'with a column to show it in');
  t.check(/item: \{key:'priceCost', dir:-1\}/.test(code),
    'and the screen opens on it, worst first, rather than on total spend');

  t.check(/<span class="an-delta \$\{pct > 0 \? 'down' : 'up'\}">/.test(scope.panFormatCell.toString()),
    'a rising cost is marked as the bad direction, since this is money going out');
  t.check(/level/.test(scope.panFormatCell({ pctMove: true }, 0.001)),
    'and a price that has barely moved says so rather than rounding to +0%');
  /* It used to print a bare em-dash here, which is indistinguishable
     from "we could not work it out". The screen now ranks on this
     column, so a row it cannot rank owes the reader the reason: the item
     was not bought in the period before. Still not a figure -- grey, and
     set in the interface face rather than the money one. */
  t.check(/not bought before/.test(scope.panFormatCell({ pctMove: true }, null)),
    'with nothing to compare against saying so, rather than printing a bare dash');
  t.check(/pan-none/.test(scope.panFormatCell({ pctMove: true }, null)),
    'and reading as a non-answer rather than as a value');
  t.check(/—/.test(scope.panFormatCell({ money: true }, null)),
    'as is a price for something nothing was bought of');
}

/* ---------- 3. bags are not sheets are not kilograms ----------------- *
 * "Total stock 1,400" was 600 Bag + 200 Sheet + 600 Kg.
 */
if (scope) {
  const mixed = scope.panVisibleTotals([
    { unit: 'Bag', amt: 21301800, purchased: 600 },
    { unit: 'Sheet', amt: 8400000, purchased: 200 },
    { unit: 'Kg', amt: 4200000, purchased: 600 },
  ]);
  eq(mixed.amt, 33901800, 'money adds up whatever it was spent on');
  eq(mixed.qty, null, 'while a quantity across three units does not');
  eq(mixed.sameUnit, null, 'because there is no one unit to report it in');
  eq(mixed.units.size, 3, 'and the units in play are known, so the screen can say which');

  const single = scope.panVisibleTotals([
    { unit: 'Bag', amt: 21301800, purchased: 600 },
    { unit: 'Bag', amt: 1000000, purchased: 40 },
  ]);
  eq(single.qty, 640, 'one unit throughout does total');
  eq(single.sameUnit, 'Bag', 'and is reported in it');
  // A row with no unit at all -- the supplier view -- is not a unit.
  eq(scope.panVisibleTotals([{ amt: 5, purchased: 1 }, { amt: 5, purchased: 1 }]).qty, null,
    'rows carrying no unit total no quantity rather than pretending to share one');

  t.check(/t\.qty != null[\s\S]{0,200}?Bought \(\$\{esc\(t\.sameUnit\)\}\)/.test(kpis),
    'the headline quantity names its unit, and only appears when there is one');
  t.check(/Items bought/.test(kpis) && /Suppliers/.test(kpis),
    'otherwise it counts something that can be counted');
  /* Pinned on the guard: `if(false) bits.push(...)` leaves the sentence
     present and unreachable, and matching the words alone passed. */
  t.check(/if\(t\.units\.size > 1\) bits\.push\(/.test(kpis)
    && /Bought in \$\{t\.units\.size\} different units/.test(kpis),
  'and the note says why there is no quantity to show');
  // Against what RENDERS, not against the source: the block comments
  // recording why it went quote the old label, and should.
  t.check(!/kpi-label">Total stock</.test(code),
    'the figure that added bags to kilograms is gone');
}

/* ---------- 4. a price does not total, and neither does a percentage -- *
 * My own first draft fell through to a generic reduce and printed
 * 35,503 + 42,000 + 7,000 = 84,503 as the "price paid" total -- the same
 * mistake as adding bags to kilograms, one column along.
 */
{
  t.check(/if\(c\.key==='unitPrice'\)\{/.test(foot), 'the price column decides its own total');
  t.check(/const avg = \(pt\.qty != null && pt\.qty > 0\) \? pt\.amt\/pt\.qty : null;/.test(foot),
    'which is the whole spend over the whole quantity — the weighted average, not the average of the prices');
  t.check(/prices in different units cannot be averaged/.test(foot),
    'and a dash with a reason when the units differ');
  /* The <td> spelling is gone -- the table is the layer's .ow-tbl grid
     now, so every "this does not total" cell goes through one
     panNoTotalHTML that carries the class AND the reason. What the check
     is about is unchanged: a percentage has no total, and the screen
     says so rather than adding them. */
  t.check(/if\(c\.pctMove\) return panNoTotalHTML\(c, 'A change is per item/.test(foot),
    'a percentage change has no total at all');
  t.check(/pan-nototal[\s\S]*?title="\$\{esc\(why\)\}"/.test(code),
    'and every column that cannot be totalled says why, rather than falling through to a sum');
  /* The item view was refused a totals row entirely. Money adds up.
     Asserted as UNCONDITIONAL rather than as the absence of one
     particular condition -- there are many ways to write "supplier
     only", and the first draft of this check only ruled out one. The
     <tfoot> is now .ow-tbl-f, the layer's own foot, and the label names
     the rows it is adding up. */
  t.check(/return `<div class="ow-tbl-f">/.test(foot)
    && /All \$\{rows\.length\} line\$\{rows\.length===1\?'':'s'\}/.test(foot),
  'and the item view is no longer refused a totals row for the money it spent');
  t.check(/c\.key==='purchased' && pt\.qty == null/.test(foot),
    'while the quantity column dashes out when its units are mixed');
  /* NEW, and the reason the foot is worth having at the top of the
     scroll: what the price changes cost DOES total, because it is money.
     It is the one figure the old screen had no way to state at all. */
  t.check(/c\.key==='priceCost' \? \(mv\.any \? mv\.cost : null\)/.test(foot),
    'while what the changes added to the bill totals, because it is money');
}

/* ---------- 5. a missing rate is not a rate of nothing --------------- */
if (scope) {
  const rows = [
    { name: 'Kirinya', amt: 21301800, commission: 639054 },
    { name: 'Mukwano', amt: 8400000, commission: null },
    { name: 'Nakawa', amt: 4200000, commission: 84000 },
  ];
  const cov = scope.panCommissionCoverage(rows);
  eq(cov.total, 723054, 'the total is what the rated suppliers actually earn');
  eq(cov.ratedSpend, 25501800, 'over the spending it covers');
  eq(cov.unratedSpend, 8400000, 'with the spending it does NOT cover named separately');
  eq(cov.unratedCount, 1, 'and how many suppliers that is');
  eq(cov.complete, false, 'so the figure can be marked as partial');

  const all = scope.panCommissionCoverage([{ name: 'A', amt: 100, commission: 3 }]);
  eq(all.complete, true, 'while a screen where everybody has a rate says nothing extra');
  eq(all.unratedSpend, 0, 'with nothing uncovered');

  t.check(/if\(cov && !cov\.complete\) bits\.push\(/.test(kpis),
    'the screen speaks up only when the figure really is partial');
  t.check(/no commission rate on file, so \$\{esc\(fmtUGX\(Math\.round\(cov\.unratedSpend\)\)\)\} of spending earns nothing here/.test(kpis),
    'saying how much spending earns nothing, in money');
  t.check(/set a rate to include/.test(kpis), 'and what to do about it');
  /* THE COMMISSION TILE HAS LEFT THE STRIP, and that is the owner's
     call, made in the design interview: commission is real money and it
     is not why this screen gets opened, so it does not get a quarter of
     the largest type on the page. The old assertion pinned the mark to
     that tile. Everything it protected is still here, one panel down,
     where the column it qualifies actually is: the total reads amber --
     this palette's word for a qualified figure -- it carries the
     asterisk, and the asterisk is explained underneath in money.

     What would still fail this section: a total that silently added the
     nulls, an unmarked total, or an asterisk with nothing behind it. */
  t.check(/if\(partial\) state = ' ow-fig ow-warn';/.test(cell),
    'marking the figure itself as partial');
  t.check(/pan-partial-mark/.test(cell) && /panPartialWhy/.test(cell),
    'and carrying the mark that says the total does not cover everything');
  t.check(/no commission rate on file<\/b>, so \$\{esc\(fmtUGX\(Math\.round\(cov\.unratedSpend\)\)\)\} of your spending earns nothing here/.test(table),
    'with the mark explained under the table it qualifies, in money');
  t.check(/panCellHTML\(c, \{commission: cov \? cov\.total : 0/.test(foot),
    'and the totals row takes the same figure rather than summing nulls as zeros');
  t.check(!/const sum = rows\.reduce\(\(s,r\)=> s \+ \(Number\(r\[c\.key\]\)\|\|0\), 0\);\n      return `<td class="price"><strong>\$\{panFormatCell\(c, sum\)\}/.test(code),
    'which is what turned a missing rate into a zero');
}

/* ---------- 6. one set of rows, four readers ------------------------- */
{
  t.check(/function panVisibleRows\(\)\{[\s\S]*?anSortRows\([\s\S]*?anFilterRows\(panRowsForView\(\)/.test(code),
    'the visible rows are the filtered rows, sorted');
  /* anFilterRows and anSortRows are the Sales Analytics ones. A second
     copy would only be somewhere for the two screens to drift apart --
     and the sales one already learned not to match on the internal key. */
  t.check(!/function panFilterRows|function panSortRows/.test(code),
    'reusing the sales side rather than keeping a second copy to drift');
  t.check(/const rows = panVisibleRows\(\);/.test(table), 'the table draws them');
  t.check(/const rows = panVisibleRows\(\);/.test(exportFn), 'the export writes THOSE');
  t.check(!/const rows = panRowsForView\(\);\n  const lines/.test(code),
    'not the whole range in another order, from the button beside the search box');
  t.check(/renderPanKpis\(rows\);/.test(table), 'and the summary is handed the same rows');
  t.check(/const cmp = filtered \? null : prev;/.test(kpis),
    'with no period comparison offered while a search narrows the figures');
  /* Empty, never 0. A missing commission rate and a rate of nothing are
     different facts, and a spreadsheet will happily total both. */
  t.check(/if\(v == null\) v = '';/.test(exportFn),
    'a missing figure is exported as blank rather than as a zero');
  t.check(/else if\(c\.pctMove\) v = \(Number\(v\)\*100\)\.toFixed\(1\);/.test(exportFn),
    'and a price move goes out as a number a spreadsheet can use');
}

/* ---------- 7. against the period before it -------------------------- */
{
  t.check(/if\(!from \|\| !to\) return null;/.test(prevTotals),
    '"all time" has no period before it, so nothing is claimed for it');
  t.check(/if\(!prev\.length\) return null;/.test(prevTotals),
    'nor does a period with nothing bought in it');
  t.check(/if\(!from \|\| !to\) return null;/.test(prevPrices),
    'and the same for prices, which are compared the same way');
  t.check(/if\(!prev\.length\) return null;/.test(prevPrices),
    'so an empty period cannot become a set of prices to measure against');
  /* SPENDING MORE IS A SIZE, NOT A WARNING -- and this reverses what
     this check used to say, so here is the argument.

     It used to read anDeltaHTML(t.amt, cmp.amt, false), which paints the
     Spent delta crimson whenever the shop bought more than last period.
     The belief behind it was "spending more is bad news". It is not: a
     shop that bought 9% more because it sold 9% more is having a good
     month, and this screen cannot tell those apart -- it has no sales in
     it. The palette's own law is that crimson is for the genuinely bad.

     And it now costs something. The strip has a figure that IS
     unambiguously bad: what the price changes added to the bill, which
     is money leaving for nothing. Two crimson figures side by side, one
     of them merely a size, is the "a device that marks everything marks
     nothing" fault the design system names. So the delta is ink, exactly
     as the sales side's delta is ink and for the same reason, and the
     one crimson on the screen is spent on the one thing that earns it.

     What this now pins: the comparison is still made and still shown,
     and the bad-direction colour is on the price move instead. */
  t.check(/anDeltaText\(t\.amt, cmp\.amt\)/.test(kpis),
    'the window is still measured against the one before it');
  t.check(/mv\.cost > 0 \? 'ow-bad' : mv\.cost < 0 \? 'ow-good' : ''/.test(kpis),
    'and the bad direction is spent on a price that rose — money leaving for nothing');
  t.check(!/anDeltaHTML\(t\.amt, cmp\.amt, false\)/.test(kpis),
    'rather than on having bought more, which is a size and not a warning');
  /* Nothing to compare with is not a rise of nothing. */
  t.check(/!mv\.any[\s\S]{0,160}?Not stated/.test(kpis),
    'and a window with no earlier period says so rather than claiming a change of zero');
}

process.exit(t.done() ? 1 : 0);
