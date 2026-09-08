#!/usr/bin/env node
'use strict';
/*
 * Instructions on demand, not on every screen.
 *
 * Twenty-three screens each opened with a paragraph explaining
 * themselves, above the work. Useful the first week and in the way ever
 * after -- between 23 and 39 pixels of prose the shopkeeper read months
 * ago, sitting on top of the thing they came to do.
 *
 * Folded behind an "i" beside the title. Hover it, tab to it, or tap it.
 *
 * Two decisions that are not cosmetic:
 *
 *   the paragraph is MOVED, not copied. The copy stays exactly where it
 *   was written in the markup, keeping any inline markup it carries, and
 *   there is never a second version of a sentence to drift out of step
 *   with the first.
 *
 *   the "i" goes NEXT TO the <h1>, never inside it.
 *   updateMobileTopbarTitle() reads that heading's textContent for the
 *   phone's title bar, so an icon plus a paragraph of help nested inside
 *   would have been appended to the name of every screen.
 *
 * Run: node test/page-instructions.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('page instructions');
const src = read('index.html');

/* ---------- 1. every screen that had prose still has it -------------- */
{
  // Counted from the markup, because the fold runs against whatever is
  // there: a screen whose description is added later must be folded too,
  // and a count baked into the test would not notice.
  /* A FLOOR THAT FALLS AS SCREENS CONVERT, never one that rises. Each
     screen rebuilt on the .ow- layer trades .page-head for .ow-ph and
     its <p> for .ow-ph-help, which the same fold still runs against --
     so the number here drops by one per conversion and the check keeps
     asking the only question that matters: that whatever prose is left
     in the markup is folded rather than deleted. Payroll & rent was the
     twentieth; Staff, rebuilt as a dispatch board, the twenty-first;
     Analysis, rebuilt as a ranked list of findings, the twenty-second --
     its long paragraph is now .ow-ph-help behind the same "i" bubble.
     Sales Analytics is the twenty-third: rebuilt as a ranking on the
     .ow- layer, its description is .ow-ph-help behind the "i" and its
     .ow-ph-sub carries the window and the invoice count, which is the
     one line on that screen that goes stale. */
  /* A FLOOR THAT COMES DOWN AS SCREENS CONVERT, like the ratchets in
     design-system.test.js. It was 17. Assets and Loans were two of them
     and are now one screen on the .ow- layer, which trades .page-head
     for .ow-ph and puts the description behind the "i" by construction
     -- so this file has two fewer screens to police, not two screens
     that stopped being policed. Only ever lower this to match a
     conversion; raising the count back means a screen regressed.

     15 -> 13, two screens in one round and each on its own merit. Sales
     Analytics converted, and The day with it: both traded .page-head for
     .ow-ph and their paragraph for .ow-ph-help, so both are folded BY
     CONSTRUCTION and there are two fewer screens here to police -- not
     two that stopped being policed.

     13 -> 12. Purchase analytics, the last of the three analytics
     screens still on .page-head, went the same way: .ow-ph, and its
     240-character paragraph -- which ran the full width of the panel,
     unmeasured, open on every visit -- is now .ow-ph-help behind the
     "i". One fewer screen to police, for the same reason as the two
     above.

     12 -> 11. Purchase invoices converted: .page-head became .ow-ph,
     and the paragraph it opened with -- which described how bills are
     GENERATED, the one thing on that screen the owner never does -- is
     now .ow-ph-help behind the "i", with a one-line .ow-ph-sub saying
     what the screen is. Folded by construction, so there is one fewer
     screen here to police rather than one that stopped being
     policed.

     11 -> 10. The cash book converted: .page-head became .ow-ph, and the
     paragraph it opened with -- which explained what a cash book is to
     somebody who has opened one every morning for a year -- is now
     .ow-ph-help behind the "i", with an .ow-ph-sub that says what the
     day actually holds. Folded by construction, so there is one fewer
     screen here to police rather than one that stopped being
     policed.

     10 -> 9. Sourcing converted: .page-head became .ow-ph, and the
     paragraph explaining what the funnel is -- which the owner reads
     once and never again -- is now .ow-ph-help behind the "i", with an
     .ow-ph-sub saying what the screen holds. Folded by construction, so
     there is one fewer screen here to police rather than one that
     stopped being policed.

     9 -> 8. Statements converted: .page-head became .ow-ph, and the
     paragraph describing what the five documents are -- read once, by
     somebody deciding whether to trust the screen -- is now
     .ow-ph-help behind the "i". Its .ow-ph-sub is the one thing on this
     screen that genuinely goes stale: WHICH DATES the figures cover,
     which the page never said at all before. Folded by construction, so
     there is one fewer screen here to police rather than one that
     stopped being policed. */
  /* 8 -> 7. Inventory converted: .page-head became .ow-ph and the
     paragraph about filling a quote from the shelf is .ow-ph-help behind
     the "i", where the six console screens before it put theirs. Its
     .ow-ph-sub says what the screen IS in one line, which is the part
     that must never fold. One fewer screen to police, not one that
     stopped being policed. */
  /* 7 -> 6. Compare Prices converted the same way, in the same week and
     on a branch that did not know about Inventory. Both sides lowered
     this floor to 7 and git merged both edits without a conflict, which
     left the number one HIGHER than the truth -- the failure that
     caught it is the whole reason the floor is asserted rather than
     assumed. Six is the count with both screens folded. */
  /* 6 -> 5. Map converted: its name and its one-line sub are .ow-ph, and
     the paragraph about what a marker means, what is derived and what
     the screen will never do is .ow-ph-help behind the "i", where the
     seven console screens before it put theirs. One fewer screen to
     police, not one that stopped being policed. */
  /* 5 -> 4. Suppliers converted: its name and its one-line sub are
     .ow-ph, and the paragraph about what the ranking counts, what the
     band means and what the screen deliberately does not do is
     .ow-ph-help behind the "i", where every console screen before it
     put theirs. One fewer screen to police, not one that stopped being
     policed. */
  /* 4 -> 3. Products converted: its name and its one-line sub are
     .ow-ph, and the paragraph about what "ready to sell" means, where
     "costs you" comes from and what the two print buttons do is
     .ow-ph-help behind the "i", where every console screen before it
     put theirs. One fewer screen to police, not one that stopped being
     policed. */
  /* 3 -> 2. Media converted: its name and its one-line sub are .ow-ph,
     and the paragraph about where photos are chosen from, why the same
     picture is never uploaded twice and what the screen will not do on
     its own is .ow-ph-help behind the "i", where every console screen
     before it put theirs.

     TWO AT ONCE, and this is the case the note above about Inventory
     and Compare Prices is describing. Products and Media converted on
     separate branches, each lowered this floor from 4 to 3, and each
     was right about its own screen. Taking either number would leave
     the floor one HIGHER than the truth and stop policing a screen.
     Both conversions are real, so the floor is 2. */
  /* 2 -> 1. Presets converted, and became The shop: its name and its
     one-line sub are .ow-ph, and the paragraph naming the three kinds of
     thing on the page -- the words, the rules, the shop itself -- and
     saying that everything saves on leaving a field is .ow-ph-help
     behind the "i", where every console screen before it put theirs.
     One fewer screen to police, not one that stopped being policed. */
  const heads = src.match(/<div class="page-head">/g) || [];
  t.check(heads.length >= 1, `the app has ${heads.length} screens carrying a page head`);

  // The paragraphs are still IN the markup -- this is a fold, not a
  // deletion. If the copy had been retyped into JS, editing the visible
  // sentence would leave the original behind, unreachable and wrong.
  /* 6, not 8: Inventory and Compare Prices were the seventh and eighth,
     and each is now an .ow-ph console header whose long explanation sits
     in .ow-ph-help behind the "i" -- the same fold, one layer further
     along. This floor moves DOWN as screens are converted and must never
     move up: a screen that loses its paragraph without gaining an
     .ow-ph-help has hidden its own explanation rather than folded it. */
  /* 6 -> 5, for the same conversion, and the floor still only moves
     down. Map did not lose its explanation: it gained an .ow-ph-help,
     which is the fold this file exists to police. */
  /* 5 -> 4, for the same conversion, and the floor still only moves
     down. Suppliers did not lose its explanation: what was one
     instruction about an ID field is now a full .ow-ph-help behind the
     "i", which is the fold this file exists to police. */
  /* 4 -> 3, for the same conversion. Products did not lose its
     explanation: the old page-head carried one sentence about product
     IDs, and the .ow-ph-help that replaced it says what makes a line
     ready to sell, that "costs you" is the price of buying ONE, and
     what each of the two print buttons produces. The fold this file
     polices is intact; there is simply one fewer screen left to fold. */
  /* 3 -> 2, for the same conversion and by the same two-branch merge as
     above. Media did not lose its explanation either: it gained an
     .ow-ph-help, which is the fold this file exists to police. */
  /* 2 -> 1, for the same conversion, and the floor still only moves
     down. Presets did not lose its explanation: it had none in the page
     head to lose -- what it had was a paragraph inside each of twelve
     panes, and those are folded nowhere because the panes are gone. The
     page's own explanation is new, and it is an .ow-ph-help, which is
     the fold this file exists to police. */
  const paras = src.match(/<div class="page-head">[\s\S]{0,900}?<p>[^<]{20,}<\/p>/g) || [];
  t.check(paras.length >= 1,
    `${paras.length} of them still hold their description in the markup, where it was written`);

  t.check(!/pageInstructionText\s*=/.test(src) && !/const PAGE_HELP/.test(src),
    'and none of it was copied into a second list in the script, which would be free to drift');
}

/* ---------- 2. the fold itself --------------------------------------- */
/*
 * The mechanism lives in foldInstruction() and the page screens are one
 * of its two callers -- the price form is the other. Kept as one function
 * rather than two similar ones so a fix to the badge, the bubble or the
 * tap behaviour cannot land in one place and miss the other.
 */
{
  const fn = extractFunction(src, 'foldInstruction', 'index.html');
  const pageFn = extractFunction(src, 'foldPageInstructions', 'index.html');
  t.check(fn.length > 0, 'there is one function doing the folding');
  t.check(/foldInstruction\(h1, p, 'What this screen is for'\)/.test(pageFn),
    'and the page screens go through it rather than carrying their own copy of it');

  /* PRESETS HAD A THIRD CALLER, AND IT IS GONE.

     foldPresetInstructions folded each of the twelve panes' explanatory
     paragraphs behind an "i" beside its h3. It existed because the panes
     were short -- Categories was a text box and a list of chips -- so the
     explanation was routinely taller than the thing it explained and the
     control sat below the fold.

     The shop has no panes. Each list's sentence is now ONE line saying
     where its words appear, which is the point of the list rather than an
     instruction about it; the page's own long explanation is an
     .ow-ph-help folded by foldPageInstructions above; and every other
     paragraph that used to sit above a control now sits below it as
     .ow-mini, which is what the console does everywhere else. So the
     caller was deleted rather than left binding nothing: a fold that can
     never fire is a function the next person has to read before
     discovering it does nothing.

     What is checked instead is that it went cleanly -- no orphan call,
     and no .pset-head left on that page for a future fold to reach. */
  t.check(!/foldPresetInstructions/.test(
    src.replace(/\/\*[\s\S]*?\*\//g, '')),
    'the Presets fold is gone, call and function together, outside its own gravestone comment');
  const presetSection = (/<section id="tab-presets"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];
  t.check(presetSection.length > 0 && !/class="pset-head"/.test(presetSection),
    'and that page has no pane heading left for one to have folded');
  /* .pset-head itself stays: it is the product form's pane heading, and
     foldProductFormInstructions still folds those five. The two rules
     below are what keep ITS badge on the same line as its heading. */
  t.check(/\.pset-head\{/.test(src) && /class="pset-head"/.test(src),
    'the class survives as the product form’s, which is what the rules below are for');

  /* The row centres its children, so a heading still carrying the bottom
     margin it needed while a paragraph sat under it pulls the badge up
     off the text it belongs to. The h1 rule has always existed for this;
     Presets' headings are h3. */
  t.check(/\.page-title-row h1, \.page-title-row h3\{margin-bottom:0;\}/.test(src),
    'and the h3 drops its margin inside the row, like the h1 does');
  /* Which loses on Presets without help: `.pset-head h3` has the same
     specificity and comes later in the file, so the generic rule above
     was silently doing nothing there and the badge sat 2px high on all
     eight. Scoped rather than reordered, because the price form depends
     on the rule above staying where it is. */
  t.check(/\.pset-head \.page-title-row h3\{margin-bottom:0;\}/.test(src),
    'with a more specific rule where .pset-head h3 would otherwise win');
  /* Both indexes checked for existence first: `indexOf` returns -1 for a
     rule that is not there, and -1 is less than everything, so the
     ordering check below passed happily on a stylesheet missing the very
     rule it is about. */
  const competing = src.indexOf('.pset-head h3{font-size:16px');
  const scoped = src.indexOf('.pset-head .page-title-row h3{');
  t.check(competing >= 0 && scoped >= 0 && competing < scoped,
    `declared after the rule it has to beat, so order alone would not do it (${competing}, ${scoped})`);

  t.check(/kept\.forEach\(p=> bubble\.appendChild\(p\)\)/.test(fn),
    'the original paragraph node is moved into the bubble, not read and retyped');
  t.check(!/textContent\s*=\s*p\.textContent/.test(fn) && !/innerHTML\s*=\s*p\.innerHTML/.test(fn),
    'so nothing is copied and any inline markup in the sentence survives');

  /* The trap this exists to avoid. The heading's textContent is the
     phone's title bar; putting the icon inside it renames every screen
     to "Executive Dashboardi A snapshot of profitability…". */
  t.check(!/title\.appendChild\(info\)/.test(fn) && !/h1\.appendChild\(info\)/.test(fn),
    'the "i" is never appended to the heading itself');
  t.check(/row\.appendChild\(title\)/.test(fn) && /row\.appendChild\(info\)/.test(fn),
    'they are siblings in a title row instead, leaving the heading text clean');
  t.check(/updateMobileTopbarTitle/.test(src) && /\.page-head h1/.test(src),
    'which is what the phone title bar still reads');

  t.check(/if\(!p \|\| !h1 \|\| !p\.textContent\.trim\(\)\) return;/.test(pageFn),
    'a screen with no description, or an empty one, is left alone rather than given an empty bubble');
  t.check(/if\(!title \|\| !kept\.length\) return null;/.test(fn),
    'and so is any heading handed nothing to fold');
}

/* ---------- 3. reachable by every kind of input ---------------------- */
{
  // Hover is the ask. It cannot be the only way in: a phone has no hover
  // to offer and a keyboard user never generates one.
  t.check(/\.page-info-btn:hover \+ \.page-info-bubble/.test(src), 'hover reveals it');
  t.check(/\.page-info-btn:focus-visible \+ \.page-info-bubble/.test(src),
    'and so does tabbing to it, which is the only way a keyboard reaches it');
  t.check(/\.page-info\.open \.page-info-bubble/.test(src),
    'and a tap, which is the only way a touch screen does');

  const fn = extractFunction(src, 'foldInstruction', 'index.html');
  t.check(/e\.stopPropagation\(\)/.test(fn),
    'the tap that opens it does not also reach the document handler that closes it');
  t.check(/document\.querySelectorAll\('\.page-info\.open'\)\.forEach\(x=>x\.classList\.remove\('open'\)\)/.test(fn),
    'and opening one closes any other, so two bubbles never overlap');

  t.check(/e\.key !== 'Escape'/.test(src), 'Escape closes it');
  t.check(/btn\.type = 'button'/.test(fn),
    'the control is a real button — type="button" so it cannot submit a form it sits inside');
}

/* ---------- 4. it announces itself to a screen reader ---------------- */
{
  const fn = extractFunction(src, 'foldInstruction', 'index.html');
  t.check(/setAttribute\('aria-label', label \|\| 'What this is for'\)/.test(fn)
    && /'What this screen is for'/.test(extractFunction(src, 'foldPageInstructions', 'index.html')),
    'the "i" has a name, because a lone letter is not one — and each caller says what its own is for');
  t.check(/setAttribute\('aria-describedby', id\)/.test(fn) && /bubble\.id = id/.test(fn),
    'and is tied to the text it reveals, so the description is read out rather than merely displayed');
  t.check(/setAttribute\('role', 'tooltip'\)/.test(fn), 'which is what the bubble declares itself to be');

  /* Ids have to be unique across twenty-three of them or aria-describedby
     points half the buttons at the same paragraph. Counted on a
     module-level tally rather than per call, or the price form's badges
     would have started again at pageInfo1 and pointed a page's "i" at a
     price note. */
  t.check(/'pageInfo' \+ \(\+\+foldedInstructionCount\)/.test(fn), 'each bubble gets its own id');
}

/* ---------- 5. the bubble cannot leave the screen -------------------- */
{
  // Comments stripped first. The rule carries one explaining why it does
  // NOT use display:none, and a check reading the raw block found that
  // phrase and reported the opposite of the truth.
  const rule = ((/\.page-info-bubble\{([^}]*)\}/.exec(src) || ['', ''])[1])
    .replace(/\/\*[\s\S]*?\*\//g, '');
  t.check(/max-width:min\(380px, calc\(100vw - 48px\)\)/.test(rule),
    'it is capped against the viewport, so a long description cannot push a scrollbar across the page');
  t.check(/visibility:hidden/.test(rule) && !/display:none/.test(rule),
    'hidden by visibility rather than display, so it has a measured size before it is first shown and does not jump');
  t.check(/pointer-events:none/.test(rule),
    'and cannot swallow a click meant for whatever sits underneath it');
}

/* ---------- 6. a bubble opening inside a modal ----------------------- */
/*
 * Page headings keep the plain absolute placement: they have the rest of
 * the document to grow into. A bubble inside a modal does not -- the
 * body scrolls, and `overflow-y:auto` clips whatever leaves it.
 *
 * Anchoring to the heading and choosing a side was the first attempt,
 * and it holds right up until a panel is shorter than the bubble. The
 * product form's Photo panel is 116px carrying a 100px bubble: no room
 * below, none above, and picking a side only chose which edge to be cut
 * off at. Placed against the viewport instead, the modal's scrolling
 * cannot reach it.
 *
 * Run rather than read, because reading cannot tell an offset that is
 * applied from one computed and thrown away.
 */
{
  const VW = 375, VH = 812;
  const { placeInfoBubble } = compileScope(
    [extractFunction(src, 'placeInfoBubble', 'index.html')],
    { TIP_EDGE_GAP: 8, innerWidth: VW, innerHeight: VH }, ['placeInfoBubble'],
  );

  const stub = ({ badgeLeft, badgeTop, w = 327, h = 120, inModal = true }) => {
    const badge = { left: badgeLeft, top: badgeTop, bottom: badgeTop + 19, width: 19 };
    const props = {}, classes = new Set(), bubbleClasses = new Set();
    const bubble = {
      classList: { add: (c) => bubbleClasses.add(c), remove: (c) => bubbleClasses.delete(c), contains: (c) => bubbleClasses.has(c) },
      style: { setProperty: (k, v) => { props[k] = v; }, removeProperty: (k) => { delete props[k]; } },
      getBoundingClientRect: () => ({ width: w, height: h }),
    };
    return {
      info: {
        classList: {
          add: (c) => classes.add(c), remove: (c) => classes.delete(c),
          contains: (c) => classes.has(c),
          toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
        },
        querySelector: () => bubble,
        closest: (sel) => (inModal && sel === '.modal-body' ? {} : null),
        getBoundingClientRect: () => badge,
      },
      props, classes, bubbleClasses, badge, w, h, bubble,
    };
  };
  const num = (v) => (v == null ? null : parseFloat(v));

  // Room below: sits under the badge, left-aligned to it as the CSS would.
  {
    const s = stub({ badgeLeft: 40, badgeTop: 200 });
    placeInfoBubble(s.info);
    t.check(s.bubbleClasses.has('tip-fixed'), 'a bubble inside a modal is placed against the viewport');
    t.check(num(s.props['--tip-y']) === s.badge.bottom + 8, 'below its badge when there is room');
    t.check(num(s.props['--tip-x']) === s.badge.left - 6, 'and lined up with it');
    t.check(!s.classes.has('flip'), 'without flipping');
  }

  // No room below, room above: opens upward and the arrow follows.
  {
    const s = stub({ badgeLeft: 40, badgeTop: 700 });
    placeInfoBubble(s.info);
    t.check(s.classes.has('flip') && num(s.props['--tip-y']) === s.badge.top - 8 - s.h,
      'above it when the screen has no room below');
    t.check(/\.page-info\.flip \.page-info-bubble::before\{top:auto;bottom:-5px;\}/.test(src),
      'and the arrow moves to the bottom edge to follow it');
  }

  /* Low on the screen AND taller than the room above it -- the Photo
     panel's shape. Flipping would only move which edge is cut off, so it
     stays below and hangs out of the scroll box, which being fixed it is
     allowed to do. */
  {
    const s = stub({ badgeLeft: 40, badgeTop: 700, h: 750 });
    placeInfoBubble(s.info);
    t.check(!s.classes.has('flip') && num(s.props['--tip-y']) === s.badge.bottom + 8,
      'a bubble too tall for either side is not flipped into the opposite edge');
  }

  // Off the right: a badge after a long heading.
  {
    const s = stub({ badgeLeft: 330, badgeTop: 200 });
    placeInfoBubble(s.info);
    const x = num(s.props['--tip-x']);
    t.check(x + s.w === VW - 8, `it slides back until its right edge clears the screen (${x})`);
    const arrow = num(s.props['--tip-arrow']);
    t.check(Math.round(x + arrow) === Math.round(s.badge.left + s.badge.width / 2 - 5),
      'and the arrow moves with it, landing over the badge it belongs to');
  }

  // Far enough that keeping the arrow on the badge would push it off the end.
  {
    const s = stub({ badgeLeft: 370, badgeTop: 200 });
    placeInfoBubble(s.info);
    const arrow = num(s.props['--tip-arrow']);
    t.check(arrow >= 8 && arrow <= s.w - 18,
      `the arrow stops at the bubble's own corner rather than sliding off it (${arrow})`);
  }

  // Off the left.
  {
    const s = stub({ badgeLeft: 2, badgeTop: 200 });
    placeInfoBubble(s.info);
    t.check(num(s.props['--tip-x']) === 8, 'and one pushed off the left comes back the same way');
  }

  /* A PAGE BADGE NEAR THE BOTTOM OF THE WINDOW.
   *
   * "It has the page to grow into" held while every one of these was a
   * heading at the top of a screen. The fold is used now by the footer
   * inside an open purchase invoice, which sits wherever its row does --
   * and a 370px bubble hanging off a badge near the bottom opens below
   * the fold, with only the page scroll to reach it, which is exactly
   * the failure the sideways clamp was written to stop.
   *
   * So it flips, on the same terms the modal path already used: only
   * when there is no room below AND there is room above. A heading at
   * the top of a page therefore behaves exactly as it did.
   */
  {
    const s = stub({ badgeLeft: 40, badgeTop: VH - 60, inModal: false });
    placeInfoBubble(s.info);
    t.check(s.bubbleClasses.has('tip-up'),
      'a page bubble with no room below it opens upward instead of off the screen');
  }
  {
    // No room below, and no room above either: flipping would only move
    // which edge cuts it off, so it stays where it is.
    const s = stub({ badgeLeft: 40, badgeTop: 40, h: VH, inModal: false });
    placeInfoBubble(s.info);
    t.check(!s.bubbleClasses.has('tip-up'),
      'and one too tall for either side is not flipped into the top edge');
  }

  /* ---- and a badge on the page rather than in a modal --------------
   *
   * These were excluded from placement entirely, on the reasoning that a
   * page heading has the rest of the document to grow into. True
   * vertically, and it is still left alone there. Sideways it was simply
   * wrong: the bubble hangs off the badge's left edge and is up to 380px
   * wide, so on a 375px phone every badge sitting right of about a third
   * of the way across ran its text off the screen, and the page does not
   * scroll sideways to reach it. Presets alone has nine.
   *
   * Clamped through `left` rather than a fixed coordinate, so the
   * vertical behaviour it was right about does not change.
   */
  {
    const s = stub({ badgeLeft: 330, badgeTop: 200, inModal: false });
    placeInfoBubble(s.info);
    t.check(!s.bubbleClasses.has('tip-fixed'),
      'a page bubble stays in the document flow rather than being pinned to the viewport');
    t.check(s.props['--tip-y'] === undefined && !s.classes.has('flip'),
      'and is not pinned vertically — it has the page to grow into');
    t.check(!s.bubbleClasses.has('tip-up'),
      'and with room below it, it opens downward as it always has');
    const left = num(s.bubble.style.left);
    t.check(Math.round(s.badge.left + left + s.w) === VW - 8,
      `while sideways it slides back until its right edge clears the screen (${left})`);
    const arrow = num(s.props['--tip-arrow']);
    t.check(Math.round(s.badge.left + left + arrow) === Math.round(s.badge.left + s.badge.width / 2 - 5),
      'with the arrow following, still over the badge it belongs to');
  }

  // A page badge with room to spare keeps exactly the offset the CSS gives it.
  {
    const s = stub({ badgeLeft: 40, badgeTop: 200, inModal: false });
    placeInfoBubble(s.info);
    t.check(num(s.bubble.style.left) === -6,
      `nothing is moved when it already fits (${s.bubble.style.left})`);
  }

  /* And off the left, which the same clamp has to hold. A badge at x=2
     would otherwise be given left:-6 and open four pixels off the screen
     -- the mirror of the case above, and easy to lose because every
     Presets badge in the real page sits well right of it. */
  {
    const s = stub({ badgeLeft: 2, badgeTop: 200, inModal: false });
    placeInfoBubble(s.info);
    const left = num(s.bubble.style.left);
    t.check(s.badge.left + left === 8,
      `a page bubble pushed off the left comes back too (${s.badge.left + left})`);
  }

  /* Reused across badges. Every coordinate is written on every call, so
     what has to be checked is the one thing that is a class rather than
     a value: a flip left set by a low badge would flip the next one. */
  {
    const s = stub({ badgeLeft: 40, badgeTop: 200 });
    s.classes.add('flip');
    s.props['--tip-x'] = '-999px'; s.props['--tip-y'] = '-999px'; s.props['--tip-arrow'] = '-999px';
    placeInfoBubble(s.info);
    t.check(!s.classes.has('flip'), 'a flip is undone rather than carried into the next badge');
    t.check(num(s.props['--tip-x']) === s.badge.left - 6
      && num(s.props['--tip-y']) === s.badge.bottom + 8
      && num(s.props['--tip-arrow']) !== -999,
      'and every coordinate is rewritten rather than left where the last one put it');
  }

  /* A page heading is left where the stylesheet put it VERTICALLY, even
     sitting low on the screen. This used to assert it was not touched at
     all, which was the horizontal bug above hiding behind a true
     statement about the vertical. */
  {
    const s = stub({ badgeLeft: 330, badgeTop: 700, inModal: false });
    placeInfoBubble(s.info);
    t.check(s.props['--tip-y'] === undefined && !s.classes.has('flip') && !s.bubbleClasses.has('tip-fixed'),
      'a badge outside a scrolling box is never moved up, flipped, or pinned');
    t.check(Object.keys(s.props).join() === '--tip-arrow',
      `and the only property it writes is the one the sideways clamp needs (${Object.keys(s.props).join() || 'none'})`);
  }

  t.check(/\.page-info-bubble\.tip-fixed\{position:fixed;top:var\(--tip-y, auto\);left:var\(--tip-x, auto\);\}/.test(src),
    'and the class it sets is what actually pins the bubble to those coordinates');
  /* A bare var() that resolves to nothing invalidates the whole
     declaration rather than being skipped, so both carry the fallback
     they would otherwise have taken by accident. */
  t.check(!/var\(--tip-[xy]\)/.test(src),
    'with a fallback, so a coordinate that never arrives does not invalidate the placement');
}

/* ---------- 7. placed before it is revealed, by every route ---------- */
{
  const fold = extractFunction(src, 'foldInstruction', 'index.html');
  // Hover and focus reveal it in CSS alone, so the placement cannot wait
  // for the click that only a tap performs.
  ['mouseenter', 'focus'].forEach((ev) => {
    t.check(new RegExp(`addEventListener\\('${ev}', \\(\\)=> placeInfoBubble\\(info\\)\\)`).test(fold),
      `placed before ${ev} reveals it`);
  });
  t.check(/if\(!wasOpen\)\{ placeInfoBubble\(info\); info\.classList\.add\('open'\); \}/.test(fold),
    'and before a tap opens it');
}

process.exit(t.done() ? 1 : 0);
