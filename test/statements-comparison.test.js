#!/usr/bin/env node
'use strict';
/*
 * What a period is measured against.
 *
 * Every comparison on the statements was "the same span of days
 * immediately before". For a building-materials shop that mostly
 * measures THE SEASON: August against July says the rains came, not
 * that the business changed. August against last August is the
 * comparison that says whether the shop is growing.
 *
 * Both are kept, because both are real questions -- last month is the
 * right frame for a cost that was just cut -- and the page names which
 * one it is showing rather than leaving a delta chip to be read against
 * an assumption.
 *
 * TWO TRAPS.
 *
 *   the leap year   a year back is YEAR arithmetic, not 365 days.
 *                   Subtracting 365 across a leap year lands a day out
 *                   and quietly compares Monday's trade with Sunday's.
 *                   And 29 February has no counterpart in an ordinary
 *                   year, so it must clamp rather than roll into March.
 *   the empty year  a shop six months old has nothing a year back.
 *                   stDeltaChip withholds a chip when the base is zero,
 *                   so the page would simply show no comparisons at all
 *                   and give no reason. It has to say so.
 *
 * Run: node test/statements-comparison.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('statements comparison');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { savedQuotes: [], cashTxns: [] };
let basis = '';
const NAMES = ['stShiftYear', 'stComparisonWindow', 'stWindowHasActivity', 'stResolvedBasis',
  'periodDays', 'monthsBetween', 'anShiftDate'];
const scope = compileScope([
  extractDeclaration(src, 'stComparisonBasis', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
  'function setBasis(v){ stComparisonBasis = v; }',
], {
  data,
  anInvoicesInRange: (from, to) => data.savedQuotes.filter((q) => q.invoicedAt >= from && q.invoicedAt <= to),
  dashCashTxnsInRange: (from, to) => data.cashTxns.filter((x) => x.date >= from && x.date <= to),
}, [...NAMES, 'setBasis']);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const win = (from, to, b) => { const w = scope.stComparisonWindow(from, to, b); return `${w.from} to ${w.to}`; };

/* ---------- 1. a year back is a year, not 365 days ------------------ */
{
  eq(scope.stShiftYear('2026-08-05'), '2025-08-05', 'the same date a year earlier');
  eq(scope.stShiftYear('2026-01-01'), '2025-01-01', 'across a new year');
  eq(scope.stShiftYear('2026-12-31'), '2025-12-31', 'and at the end of one');

  /* Subtracting 365 days lands a day out whenever a 29 February falls in
     between, which would compare a Monday's trade with a Sunday's --
     and in a shop that closes one day a week, that is the whole
     difference. */
  const byDays = new Date(Date.parse('2028-06-01T00:00:00Z') - 365 * 86400000).toISOString().slice(0, 10);
  eq(scope.stShiftYear('2028-06-01'), '2027-06-01', 'a year before a date after a leap day');
  t.check(byDays !== scope.stShiftYear('2028-06-01'),
    'which is NOT what subtracting 365 days gives, so the distinction is doing work');

  /* 29 February has no counterpart in an ordinary year. Clamped to the
     28th rather than rolled forward into March, which would compare
     February against the start of the next month. */
  eq(scope.stShiftYear('2028-02-29'), '2027-02-28', 'a leap day lands on the 28th');
  t.check(!scope.stShiftYear('2028-02-29').startsWith('2027-03'), 'and never rolls into March');
  eq(scope.stShiftYear('2029-02-28'), '2028-02-28', 'while an ordinary 28th stays the 28th');
}

/* ---------- 2. the two windows --------------------------------------- */
{
  eq(win('2026-08-01', '2026-08-31', 'lastyear'), '2025-08-01 to 2025-08-31',
    'last year is the same dates, a year earlier');
  eq(win('2026-08-01', '2026-08-31', 'previous'), '2026-07-01 to 2026-07-31',
    'the period before is the same span of days immediately before');

  // Same length either way, so a month is never set against a fortnight.
  const p = scope.stComparisonWindow('2026-08-06', '2026-08-20', 'previous');
  eq(scope.periodDays(p.from, p.to), scope.periodDays('2026-08-06', '2026-08-20'),
    'the previous window is exactly as long as the period it is set against');

  /* A month compared to last year keeps its OWN dates rather than being
     forced to the same day count. Pinned on a LEAP February against an
     ordinary one, because that is the only case where the two rules
     disagree: 29 days counted back from 28 February 2027 starts on 31
     January, sliding the whole comparison off the month. Checking a
     28-day February against a 28-day February proved nothing. */
  eq(win('2028-02-01', '2028-02-29', 'lastyear'), '2027-02-01 to 2027-02-28',
    'a 29-day February is compared against the whole of a 28-day one');
  eq(win('2026-02-01', '2026-02-28', 'lastyear'), '2025-02-01 to 2025-02-28',
    'and February against February in ordinary years');
}

/* ---------- 3. choosing when told nothing ---------------------------- *
 * Left to itself the page shows the better comparison where there is one
 * and falls back where there is not -- rather than defaulting to last
 * year and showing a shop six months old a column of nothing.
 */
{
  scope.setBasis('');
  data.savedQuotes = []; data.cashTxns = [];
  eq(scope.stResolvedBasis('2026-08-01', '2026-08-31'), 'previous',
    'with nothing on file a year back it falls back to the period before');

  data.cashTxns = [{ date: '2025-08-10' }];
  eq(scope.stResolvedBasis('2026-08-01', '2026-08-31'), 'lastyear',
    'and takes last year the moment there is something there to compare with');

  // Even a single cash entry counts as having traded: the shop existed.
  data.savedQuotes = [{ invoicedAt: '2025-08-12' }]; data.cashTxns = [];
  eq(scope.stResolvedBasis('2026-08-01', '2026-08-31'), 'lastyear',
    'an invoice alone is enough, as is a cash entry alone');

  // An explicit choice always wins over the automatic one.
  scope.setBasis('previous');
  eq(scope.stResolvedBasis('2026-08-01', '2026-08-31'), 'previous',
    'choosing the period before is honoured even when last year has data');
  scope.setBasis('lastyear');
  data.savedQuotes = []; data.cashTxns = [];
  eq(scope.stResolvedBasis('2026-08-01', '2026-08-31'), 'lastyear',
    'and choosing last year is honoured even when it is empty — the note is what says so');
  scope.setBasis('');
}

/* ---------- 4. an empty comparison says so --------------------------- */
{
  data.savedQuotes = []; data.cashTxns = [];
  t.check(scope.stWindowHasActivity('2025-08-01', '2025-08-31') === false,
    'a window the shop was not trading in has no activity');
  data.cashTxns = [{ date: '2025-08-10' }];
  t.check(scope.stWindowHasActivity('2025-08-01', '2025-08-31') === true, 'and one it was, does');
  t.check(scope.stWindowHasActivity('2025-09-01', '2025-09-30') === false,
    'measured inside the window rather than anywhere on file');

  /* This is the part that matters. stDeltaChip already withholds a chip
     when the base is zero, so an empty comparison window makes every
     comparison on the page silently vanish. Without a sentence the
     reader sees a page with no deltas and no reason given. */
  const ctx = (/function statementsContext[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const prevHasActivity = stWindowHasActivity\(prevFrom, prevTo\);/.test(ctx),
    'the context works out whether there is anything to compare against');
  const note = (/function stComparisonNote[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(!ctx\.prevHasActivity\)/.test(note) && /There is nothing on file for/.test(note),
    'and says so rather than leaving a page of missing chips unexplained');
  t.check(/measured against zero/.test(note),
    'naming what the missing figures would otherwise have been measured against');

  // Each basis explains itself in its own terms.
  t.check(/the comparison that survives a season/.test(note),
    'last year says why it is the better frame');
  t.check(/so the two are the same length/.test(note),
    'and the period before says what makes it fair');
}

/* ---------- 5. on the page ------------------------------------------- */
{
  /* It moved from the toolbar into the page header with the rest of the
     period, and out of a <label> into a <div>: a label forwards its
     click to the select it wraps, which opens the native list and shuts
     it again in the same gesture. Mouse only; the keyboard always
     worked, which is why it took three rounds to find the first time. */
  /* The dropdown became two segmented buttons on the period card, as the
     canvas draws it: both choices in view, the one in force lit. The
     rules the select carried still hold -- it lives on the period
     control, wears the layer's segmented control, sets the basis and
     redraws -- and nothing wraps it in a <label>, so the old
     open-and-shut-in-one-click fault cannot come back. */
  t.check(/<div class="ow-seg" id="st_basis" role="group"[^>]*>[\s\S]{0,300}?data-basis="previous"[\s\S]{0,200}?data-basis="lastyear"/.test(src),
    'the choice is on the period control, wearing the layer\'s segmented control');
  t.check(!/<label[^>]*>[^<]*<div class="ow-seg" id="st_basis"/.test(src),
    'and it is never inside a label');
  t.check(/stComparisonBasis = d\.basis; renderStatements\(\);/.test(code), 'and drives the render');
  /* Left on "automatically", the lit button is the comparison automatic
     settled on, and its title says so, rather than leaving the reader to
     infer it from the note. */
  t.check(/b\.dataset\.basis === ctx\.basis/.test(code)
    && /Automatic — \$\{ST_BASES\[ctx\.basis\]\.toLowerCase\(\)\}/.test(code),
    'and reports which comparison automatic settled on');
  t.check(/stComparisonNote\(ctx\)/.test(code), 'with the note built from the same context');
  t.check(!/days immediately before this period \(\$\{esc\(prevFrom\)\}/.test(code),
    'and the old hard-coded sentence, which named a comparison that may not be the one shown, is gone');
}

/* ---------- the period control says which period ----------------------
   Month, Quarter and Year were three loose buttons that set the dates and
   then said nothing. Whichever period the figures on screen covered, the
   control looked identical -- so the one thing a statement must be clear
   about, what dates it covers, was only in two date boxes. */
{
  const src = read('index.html');

  /* The LAYER's segmented control now, not the roster's. Same rule --
     the three periods are one control that says which of them the
     figures cover -- and one fewer opinion in the file about what
     "pick one of these" looks like. */
  /* Attributes allowed after the id: the group now carries
     role="group" and an aria-label, so a screen reader hears what the
     four buttons choose between. Still one control. */
  t.check(/<div class="ow-seg" id="st_presets"[^>]*>[\s\S]{0,400}?class="ow-seg-b st-preset" data-preset="year"/.test(src),
    'the three periods are one segmented control, not three separate buttons');
  t.check(!/class="rost-per st-preset"/.test(src),
    'and it is the layer\'s, so this screen no longer borrows the roster\'s');
  t.check(!/class="btn btn-ghost st-preset"/.test(src),
    'and no longer plain buttons with no selected state at all');

  /* Derived from the dates, never remembered from the last click -- so
     it cannot disagree with the boxes beside it, and it survives a
     reload because the dates are what the screen is built from. */
  const sync = extractFunction(src, 'stSyncPresetButtons', 'index.html');
  t.check(/const d = stDefaultRange\(b\.dataset\.preset\);/.test(sync)
    && /b\.classList\.toggle\('ow-on', !!from && d\.from === from && d\.to === to\)/.test(sync),
    'the lit button is worked out from the dates on screen, not stored');
  t.check(/!!from &&/.test(sync),
    'and empty dates light nothing rather than matching a preset by accident');

  /* A hand-typed range is not the month, the quarter or the year, and
     lighting one would misdescribe the figures underneath. */
  const render = extractFunction(src, 'renderStatements', 'index.html');
  const syncAt = render.indexOf('stSyncPresetButtons()');
  const guardAt = render.indexOf('if(!ctx)');
  t.check(syncAt > -1 && guardAt > -1 && syncAt < guardAt,
    'it runs before the backwards-range early return, so an error clears the buttons rather than leaving one lit');
  t.check(render.indexOf('statementsContext()') < syncAt,
    'and after the context, which seeds the dates on a first open — otherwise the screen it opens showing would light nothing');
}

/* ---------- a chip that says nothing changed, when nothing did --------
 *
 * Surfaced by the rent fix: a one-day statement beside the day before it
 * showed the same rent, the same wages and the same loss, and the loss
 * wore "changed". The only test was `now >= before`, which equal passes,
 * and the negative branch has no percentage to fall back on -- so two
 * identical figures were reported as movement.
 */
{
  const src2 = read('index.html');
  const chip = extractFunction(src2, 'stDeltaChip', 'index.html');
  t.check(/Math\.round\(now\) === Math\.round\(before\)/.test(chip),
    'two figures that print the same wear no chip at all');
  t.check(chip.indexOf('Math.round(now) === Math.round(before)') < chip.indexOf('const up ='),
    'and the check comes before the direction, which is what read equal as a rise');
}

process.exit(t.done() ? 1 : 0);
