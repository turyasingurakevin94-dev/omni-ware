#!/usr/bin/env node
'use strict';
/*
 * Nothing on a phone may run off the edge of its panel.
 *
 * Reported with four photographs of a real handset: Loans lost
 * "916,667 BEHIND SCHEDULE", Assets lost "CHARGED THIS YEAR", every
 * Staff row lost its last action button, and the profit-and-loss column
 * lost the "changed" badge off every line. Four screens, four different
 * layouts, and the same failure in each -- content sized for a desktop
 * column, placed in 342 pixels, and simply allowed to hang over the
 * side where nothing can scroll to it.
 *
 * THE SHAPE OF THE MISTAKE IS ALWAYS THE SAME: a flex or grid track
 * given a minimum it cannot honour. `flex:1` will not shrink an item
 * below its own content; `minmax(300px, 1fr)` is a floor the grid keeps
 * even when the screen is 294px wide. Neither clips, neither scrolls --
 * they overflow in silence, and the figure somebody opened the screen
 * to read is the one that falls off the end.
 *
 * These are CSS checks rather than measurements because the suite has no
 * browser; the measuring was done in one, at 375px, walking every tab
 * and comparing every element against its panel. What is pinned here is
 * the rule that made each measurement come out right.
 *
 * Run: node test/phone-overflow.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('phone overflow');
const src = read('index.html');
/* Anchored to the start of a line. Unanchored, `.sc-stats{` matched
   inside `.cmp-card .sc-stats{padding-top:0}` -- a modifier for one card
   type -- and reported that the base rule lacked the wrapping it had
   just been given. A selector is only that selector when nothing
   precedes it on the line. */
const rule = (sel) => {
  const m = new RegExp('(?:^|\\n)\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}').exec(src);
  return m ? m[0].trim() : '';
};

/* ---------- 1. the figure strip every card uses ----------------------- */
/*
 * Four stats splitting a 342px phone panel get 78px each, and
 * "21,597,253 UGX" at 16px monospace needs about 120. flex:1 with no
 * basis cannot shrink below its content, so the fourth figure hung off
 * the panel -- on Loans that was the arrears, on Assets the year's
 * charge. Shared by every card in the app that carries a figure strip,
 * so one rule fixed all of them.
 */
{
  const stats = rule('.sc-stats');
  const stat = rule('.sc-stat');
  t.check(/flex-wrap:wrap/.test(stats),
    `the figure strip wraps rather than overflowing (${stats})`);
  t.check(/flex:1 1 \d+px/.test(stat),
    `and each figure claims a readable minimum, not an equal share of nothing (${stat})`);
  t.check(/min-width:0/.test(stat),
    'while still being allowed to shrink inside its own row');
  const basis = Number((/flex:1 1 (\d+)px/.exec(stat) || [])[1]);
  t.check(basis >= 110 && basis <= 160,
    `the basis fits two to a phone row and four to a desktop one (${basis}px)`);
}

/* ---------- 2. the staff roster row ----------------------------------- */
/*
 * minmax(180px,1fr) + minmax(130px,1fr) is 310px of minimums plus a 16px
 * gap, inside a phone panel with 280px to give. Every row hung 48px off
 * the right and took its last action button with it.
 */
/*
 * THE FIX CHANGED SHAPE, so the assertions did too.
 *
 * Squeezing four columns into two kept the row on the screen and made it
 * unreadable a different way: name beside status, so "Wasswa
 * Ssekitoleko" rendered as "Wass..." under its own chip while the
 * status sentence took the width the name needed. The house rule is that
 * 820px is a SWITCH BETWEEN TWO DESIGNS, not a reflow of one -- so the
 * phone gets a card, stacked in reading order, and the check now asks
 * for that rather than for a narrower version of the desktop row.
 *
 * The two assertions that survive unchanged are about the controls above
 * the list, which are the same controls on both designs.
 *
 * AND THEN THE CARD BECAME ITS OWN MARKUP. On the owner's canvas the phone
 * is a different design outright: staffPersonHTML emits the desktop row
 * (.sx-r) and the phone card (.sx-pc) in one call, from the same figures,
 * and the phone block hides the table and shows the cards. So the checks
 * ask that the TABLE never reaches the phone, that the card stacks, and
 * that its buttons are thumb-sized -- the same three faults this section
 * was written against, asked of the shape that now has to avoid them.
 */
{
  const at = src.indexOf('Staff on the phone: its own design');
  const phone = (/@media \(max-width:820px\)\{[\s\S]*?\n  \}/.exec(src.slice(at)) || [''])[0];
  t.check(at > 0 && /\.sx-board,\.sx-side,\.sx-reg,\.sx-tbl,/.test(phone),
    'the desktop table never reaches the phone, so no row is squeezed into two columns');
  t.check(/\.sx-pc\{[^}]*flex-direction:column;/.test(phone),
    'the card stacks in reading order rather than putting the name beside the status');
  t.check(/\.sx-pc-w\{flex:1;min-width:0;\}/.test(phone),
    'and the name has the width left beside its face to be read in');
  t.check(/#tab-staff \.sx-filters\{[^}]*overflow-x:auto;/.test(phone),
    'the filter chips scroll rather than being cut off at "Can\u2019t be sent"');
  t.check(/\.sx-pbtn\{min-height:var\(--ow-tap\);/.test(phone),
    'with every button on the card a thumb-sized target, not a 26px pointer one');
  t.check(/\.sx-pbtn-i\{flex:0 0 44px;width:44px;/.test(phone),
    'icon buttons included');
  t.check(/#tab-staff \.sx-srch/.test(phone),
    'while the search box, which has no room on a phone, steps aside instead of insisting on width it has not got');
}

/* ---------- 3. the statements column ---------------------------------- */
/*
 * A bare minmax(300px,1fr) is a floor the grid honours even when it
 * overflows, which is how the profit-and-loss column ran past its panel
 * and clipped the "changed" badge off every row.
 *
 * .st-two was that grid, and it is gone: the Overview's two columns are
 * the layer's own .ow-grid now -- a flexible track and a fixed 304px
 * rail that collapses to one column at 820. So what is pinned here is
 * the same rule one level up, on the grid every converted screen uses:
 * the flexible track's floor is ZERO, not its content, or the whole
 * console inherits the bug this file was opened for.
 */
{
  const grid = rule('.ow-grid');
  t.check(/minmax\(0,\s*1fr\)/.test(grid),
    `the flexible track may go below its content when the screen has less (${grid})`);
  t.check(!/\.st-two\{/.test(src),
    'and the statements grid it replaced is gone rather than left behind as dead rules');
}

/* ---------- 4. the rule behind all three ------------------------------ */
/*
 * Stated once, so the next person adding a stat strip or a two-column
 * grid has the reason rather than three separate precedents.
 */
{
  t.check(/will not shrink an item|cannot shrink below its content|will not shrink below its content/i.test(src),
    'the file says why a minimum a screen cannot honour is the shape of this bug');
}

process.exit(t.done() ? 1 : 0);
