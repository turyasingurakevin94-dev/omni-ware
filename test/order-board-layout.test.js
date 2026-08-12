#!/usr/bin/env node
'use strict';
/*
 * The Order Tracking board: a step rail driving a scroll-snap strip.
 *
 * The board was written as grid-template-columns:repeat(4,...) when there
 * were four stages. Awaiting Goods made it five, and the count was baked
 * into three separate places:
 *
 *   - the grid, so the fifth column wrapped to a row below the whole board
 *   - the phone filter, four hand-written [data-active-step] rules, so
 *     tapping the new step showed every column stacked
 *   - the stepper's connector line, inset 12.5% a side -- half of a quarter
 *
 * Everything here asserts the shape that cannot break that way again: the
 * strip takes its column count from the markup, the filter is one class
 * the renderer sets from SQ_STATUS_ORDER, and the connector is drawn per
 * step. A sixth stage should require NO layout change at all.
 *
 * Run: node test/order-board-layout.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order board layout');
const src = read('index.html');

/* ---------- 1. the strip cannot wrap --------------------------------- */
{
  const board = (/\.sq-board\{[\s\S]*?\}/.exec(src) || [''])[0];
  t.check(/grid-auto-flow:column/.test(board),
    'columns flow sideways from the markup — the track count is not declared anywhere');
  t.check(/grid-auto-columns:minmax\(270px,1fr\)/.test(board),
    '1fr expands them on a wide screen, 270px holds the floor on a narrow one');
  t.check(/overflow-x:auto/.test(board) && /scroll-snap-type:x proximity/.test(board),
    'and past the floor the strip scrolls with snap rather than wrapping');
  t.check(!/grid-template-columns:repeat\(\d/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').split('.sq-board')[1] || ''),
    'no fixed track count survives anywhere near the board');
  /* The regression itself, by name -- scoped to the board's own rule,
     because .cs-stats legitimately uses the same four-track pattern for
     a row of four stat boxes that really is four boxes. */
  t.check(!/\.sq-board\{[^}]*repeat\(/.test(src),
    'the four-track grid that wrapped Step 5 is gone');
}

/* ---------- 2. the phone filter cannot forget a stage ---------------- */
{
  t.check(!/data-active-step="draft"/.test(src) && !/data-active-step="preparing"/.test(src),
    'no CSS rule names an individual status — the list that forgot awaiting_goods is gone');
  t.check(/\.sq-board \.sq-col:not\(\.is-active-step\)\{display:none;\}/.test(src),
    'one class hides the inactive columns, whatever statuses exist');
  t.check(/class="sq-col\$\{status===sqActiveMobileStep\?' is-active-step':''\}"/.test(src),
    'and the renderer sets it from the same array that builds the columns');
  const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
  t.check((render.match(/SQ_STATUS_ORDER\.map\(/g) || []).length >= 2,
    'both the rail and the board are driven off SQ_STATUS_ORDER, never a literal list');
}

/* ---------- 3. the connector follows the step count ------------------ */
{
  t.check(/\.sq-stepper-step \+ \.sq-stepper-step::before\{/.test(src),
    'each step after the first draws its own segment back to the previous node');
  // Checked against the CODE, not the comment that explains the history.
  const uncommented = src.replace(/\/\*[\s\S]*?\*\//g, '');
  t.check(!/12\.5%/.test(uncommented),
    'the 12.5% insets — four steps baked into a line — are gone');
}

/* ---------- 4. the rail is the board's own top row ------------------- */
{
  /* The rail owns the panel's full width; Select all / Print live on a
     slim toolbar row OUTSIDE the panel. The first cut put them on the
     rail's own row, which squeezed five steps into whatever the print
     button left over. */
  t.check(/<div id="sqStepperMount"><\/div>\s*<div id="savedQuotesWrap">/.test(src),
    'the rail mounts inside the panel, full width, directly above the board');
  t.check(/class="sq-board-tools">\s*<label class="sq-select-all-label">/.test(src),
    'with Select all and Print on their own row outside the panel');
  t.check(!/<h2 style="margin-bottom:0;">Order tracking<\/h2>/.test(src),
    'and the third restatement of the page title inside the panel is gone');
  // Sticky at every width, below whichever topbar the width shows.
  const stepper = (/\.sq-stepper\{[\s\S]*?\}/.exec(src) || [''])[0];
  t.check(/position:sticky/.test(stepper) && /top:var\(--topbar-h\)/.test(stepper),
    'the rail sticks below the desktop topbar');
  t.check(/\.sq-stepper\{top:var\(--mobile-topbar-h\);\}/.test(src),
    'and below the mobile one on a phone');
  /* The column heads must NOT be sticky, and the constraint is physical:
     overflow-x:auto makes .sq-board a scroll container, and sticky pins
     against the NEAREST scrolling ancestor -- so a sticky head answers
     to the board, which never scrolls vertically, and simply sat
     displaced over the first card of every column. The rail lives
     outside the strip and carries the same names and counts. */
  const colHead = (/\.sq-col-head\{[\s\S]*?\}/.exec(src) || [''])[0];
  t.check(!/position:sticky/.test(colHead) && !/--sq-rail-h/.test(colHead),
    'column heads stay in flow — sticky cannot work inside the scroll container');
  const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
  t.check(!/--sq-rail-h/.test(render),
    'and nothing measures a rail height nothing reads');
  /* The connector segments span between node EDGES. Centre-to-centre
     they crossed the neighbouring circle -- and no z-index can fix that,
     because each step is its own stacking context, so a later step's
     ::before paints over the whole of an earlier sibling, node and all. */
  t.check(/right:calc\(50% \+ 16px\);width:calc\(100% - 32px\)/.test(src),
    'the connector stops at the node edges instead of running through the circles');
}

/* ---------- 5. what needs chasing, from the rail --------------------- */
{
  const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
  t.check(/const orderIsOverdue = \(q\)=>\{/.test(render),
    'the overdue rule is one helper');
  t.check(/const overdue = orderIsOverdue\(q\);/.test(render),
    'read by the card flag');
  t.check(/group\.filter\(q=> orderIsOverdue\(q\) \|\| orderNeedsSomebody\(q\)\)\.length/.test(render),
    'and by the rail roll-up, so the two can never disagree');
  t.check(/orderNeedsWorker\(q\) \|\| orderNeedsDelivery\(q\)/.test(render),
    'with an order waiting on a person counted alongside one past its limit');
  t.check(/sq-stepper-warn/.test(render) && /need\$\{warn===1\?'s':''\} chasing/.test(render),
    'shown as the amber marker with a title that says what it means');
}

/* ---------- 6. a move says where it went ----------------------------- */
/*
 * Run, not read: the whole point is behaviour the admin sees.
 * setSavedQuoteStatus gave no feedback at all -- the card vanished from
 * one column and reappeared in another that could be off-screen.
 */
{
  const makeAnnounce = (reduced, phone) => {
    const calls = { toasts: [], pulses: [], scrolls: [] };
    const stepEl = {
      classList: { add: (c) => calls.pulses.push(c), remove: () => {} },
      offsetWidth: 26,
    };
    const colEl = { scrollIntoView: (o) => calls.scrolls.push(o) };
    const scope = compileScope([
      extractDeclaration(src, 'SQ_STATUSES', 'index.html'),
      extractFunction(src, 'announceOrderMove', 'index.html'),
    ], {
      toast: (m) => calls.toasts.push(m),
      matchMedia: (q) => ({ matches: /reduce/.test(q) ? reduced : phone }),
      document: { querySelector: (sel) => /sq-stepper-step/.test(sel) ? stepEl : colEl },
    }, ['announceOrderMove']);
    return { scope, calls };
  };

  const { scope, calls } = makeAnnounce(false, false);
  scope.announceOrderMove({ client: { name: 'Musa Hardware' } }, 'preparing');
  t.check(calls.toasts[0] === 'Musa Hardware → Being Prepared',
    `the toast names the order and the destination, without the "Step 3." prefix (${calls.toasts[0]})`);
  t.check(calls.pulses.includes('pulse'), 'the destination rail node pulses');
  t.check(calls.scrolls.length === 1 && calls.scrolls[0].behavior === 'smooth',
    'and the strip slides the destination column into view');

  const anon = makeAnnounce(false, false);
  anon.scope.announceOrderMove({ client: {} }, 'completed');
  t.check(anon.calls.toasts[0] === 'Order → Completed',
    'an order with no client name is still announced, not skipped');

  /* Reduced motion gets the same information without the motion: the
     toast still fires, the pulse does not, the scroll jumps. */
  const rm = makeAnnounce(true, false);
  rm.scope.announceOrderMove({ client: { name: 'A' } }, 'preparing');
  t.check(rm.calls.toasts.length === 1 && !rm.calls.pulses.includes('pulse')
    && rm.calls.scrolls[0].behavior === 'auto',
    'reduced motion keeps the toast, drops the pulse, and jumps instead of sliding');

  // On a phone the rail filters rather than scrolls, so no scrollIntoView.
  const ph = makeAnnounce(false, true);
  ph.scope.announceOrderMove({ client: { name: 'A' } }, 'preparing');
  t.check(ph.calls.scrolls.length === 0, 'and a phone board is never scrolled sideways by a move');

  // Wired where the status actually changes, so every path announces.
  const setter = extractFunction(src, 'setSavedQuoteStatus', 'index.html');
  t.check(/const moved = q\.status!==status;/.test(setter) && /if\(moved\) announceOrderMove\(q, status\);/.test(setter),
    'called from setSavedQuoteStatus when the status really changed — the assign modal and prepay paths land there too');
  t.check(!/announceOrderMove/.test(extractFunction(src, 'stepSavedQuoteStatus', 'index.html')),
    'and not duplicated in the arrow handler on top of it');
}

/* ---------- 7. the strip's affordances ------------------------------- */
{
  const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
  // Edge fades only where something is clipped.
  t.check(/classList\.toggle\('can-left', boardEl\.scrollLeft > 4\)/.test(render)
    && /classList\.toggle\('can-right',/.test(render),
    'the fades follow which edge is clipping');
  t.check(/\.sq-board\.can-right\{[^}]*mask-image/.test(src),
    'drawn as a mask, so a board that fits whole carries none');
  /* Drag-to-pan must never eat a click on something clickable. */
  t.check(/closest\('\.sq-card'\) \|\| e\.target\.closest\('button'\) \|\| e\.target\.closest\('input'\) \|\| e\.target\.closest\('label'\)/.test(render),
    'panning never starts from a card, a button, a checkbox or its label');
  t.check(/Math\.abs\(dx\) > 4/.test(render),
    'and a 4px threshold keeps an ordinary click an ordinary click');
  // The rail scrubs the strip on desktop and filters on the phone.
  t.check(/const isPhoneBoard = \(\)=> matchMedia\('\(max-width: 820px\)'\)\.matches;/.test(render),
    'one predicate decides which, at the same 820px the stylesheet uses');
  t.check(/if\(!isPhoneBoard\(\)\)\{\s*const col = boardEl\.querySelector/.test(render),
    'clicking a step slides the strip only when it is a strip');
  // Roving arrows across the rail.
  t.check(/e\.key!=='ArrowRight' && e\.key!=='ArrowLeft'/.test(render),
    'arrow keys walk the rail');
  /* The rail is cleared with the board on the empty branches. Run, not
     read: a mutant hollowed clearRail out to a no-op and the previous
     assertion — "it exists and is called twice" — was satisfied by the
     empty shell. */
  {
    const mount = { innerHTML: 'stale rail from the last render' };
    const emptied = compileScope([
      'const clearRail = ' + (/const clearRail = \(\)=>\{[^\n]*\};/.exec(render) || [''])[0].slice('const clearRail = '.length),
    ], { document: { getElementById: (id) => id === 'sqStepperMount' ? mount : null } }, ['clearRail']);
    emptied.clearRail();
    t.check(mount.innerHTML === '',
      `an emptied board empties the rail rather than keeping stale counts (${JSON.stringify(mount.innerHTML)})`);
    t.check((render.match(/clearRail\(\);/g) || []).length === 2,
      'from both empty branches — no orders at all, and none still active');
  }
}

/* ---------- 8. the strip keeps its place --------------------------- */
/*
 * The 60s poll re-renders the board by replacing its HTML, and a fresh
 * element starts at scrollLeft 0 -- so an admin reading Completed was
 * yanked back to Drafts every minute, which was reported from the
 * running shop within hours of the strip landing.
 */
{
  const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
  t.check(/let sqBoardScrollLeft = 0;/.test(src),
    'the scroll position lives outside the render, like the active step does');
  t.check(/sqBoardScrollLeft = boardEl\.scrollLeft; updateEdgeFades\(\);/.test(render),
    'written by the scroll listener as the admin moves');
  t.check(/if\(sqBoardScrollLeft\) boardEl\.scrollLeft = sqBoardScrollLeft;/.test(render),
    'and put back after every render, so the poll stops teleporting the board');
  /* lastIndexOf: the string also appears inside the scroll listener,
     which sits earlier in the source than the restore. The call that
     matters is the immediate one at the end of the wiring. */
  t.check(render.indexOf('boardEl.scrollLeft = sqBoardScrollLeft') < render.lastIndexOf('updateEdgeFades();'),
    'restored before the fades are computed, so they describe the restored position');
}

/* ---------- 9. one number, said once --------------------------------- */
{
  const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
  t.check(/sq-col-title">\$\{esc\(ORDER_STATUS_SHORT_LABELS\[status\]\)\}/.test(render),
    'the column head carries the short name — the rail directly above already numbers it');
  t.check(!/sq-col-title">\$\{esc\(SQ_STATUSES\[status\]\.label\)\}/.test(render),
    'not the "Step N." long label that restated the rail in caps');
  /* The sell total moved from mid-meta-row to the name row: who and how
     much are the two facts a board is scanned for. */
  t.check(/sq-client-total" title="What the client pays">\$\{fmtUGX\(savedQuoteTotal\(q\)\)\}/.test(render),
    'the total sits right-aligned on the name row');
  t.check(!/ICON_MONEY\}\$\{fmtUGX\(savedQuoteTotal\(q\)\)/.test(extractFunction(src, 'orderMetaRowHTML', 'index.html')),
    'and is gone from the meta row, where it read like a timestamp');
}

process.exit(t.done() ? 1 : 0);
