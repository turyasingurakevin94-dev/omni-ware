#!/usr/bin/env node
'use strict';
/*
 * The price form's instructions, folded behind an "i" per section.
 *
 * Measured at 375x812 before this: the modal body is a 614px box holding
 * 1727px of form, of which 747px -- 43% -- was explanatory prose. Six
 * paragraphs telling a shopkeeper who has entered a hundred prices what
 * a pack unit is, scrolled past every time. Folded into five bubbles,
 * the same form is 980px.
 *
 * The same mechanism the page screens use (foldInstruction, see
 * page-instructions.test.js), so this file tests only what is particular
 * to the price form:
 *
 *   the notes are MOVED. Two of them -- pr_pack_note and
 *   pr_tiers_tip_text -- are rewritten live by setPrBulkMode() as the
 *   form switches between one entry and a whole variant list. Copying
 *   their text into a bubble would have frozen whichever wording happened
 *   to be showing when the form was folded.
 *
 *   the badge follows the text. pr_tiers_tip_text is empty in the markup
 *   until setPrBulkMode() runs, and an "i" that opens an empty box is
 *   worse than no "i".
 *
 *   the bubble stays inside the modal. A page has the rest of itself to
 *   grow into; a 614px scroll box does not, and the last step's bubble
 *   hung 108px past the bottom of it.
 *
 * Run: node test/price-form-instructions.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('price form instructions');
const src = read('index.html');
const modal = (/<div class="modal-overlay" id="priceModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0];

/* ---------- 1. nothing is left sitting on the form ------------------- */
{
  t.check(modal.length > 0, 'the price modal is found in the markup');

  /* Counted, not sampled: leaving one paragraph behind while folding the
     other four is the failure that would look tidy in a screenshot of
     the top of the form and not in the form. */
  const notes = (modal.match(/class="pfx-note/g) || []).length;
  const hints = (modal.match(/class="field-hint"/g) || []).length;
  t.check(notes === 5, `the five step notes are still written in the markup (${notes})`);
  t.check(hints === 1, `along with the one field hint (${hints})`);

  const fn = extractFunction(src, 'foldPriceFormInstructions', 'index.html');
  t.check(fn.length > 0, 'and something folds them');
  // A fold nothing calls is a form with every paragraph still on it.
  t.check(/^foldPriceFormInstructions\(\);$/m.test(src),
    'which actually runs, rather than only being defined');
  /* Six nodes, five bubbles -- step 2's two notes share one. A fold that
     quietly covers five of six leaves the sixth as the only prose left
     standing in the form, which is worse than not having started. */
  t.check((fn.match(/foldInstruction\(/g) || []).length === 5,
    'each of the five sections folds, not most of them');
}

/* ---------- 2. moved, so what rewrites them still works -------------- */
/*
 * setPrBulkMode() rewrites two of these notes by id every time the form
 * switches mode. They keep their ids and their nodes; only where they sit
 * has changed.
 */
{
  const fn = extractFunction(src, 'foldPriceFormInstructions', 'index.html');
  const bulk = extractFunction(src, 'setPrBulkMode', 'index.html');

  ['pr_pack_note', 'pr_tiers_tip_text'].forEach((id) => {
    t.check(new RegExp(`getElementById\\('${id}'\\)`).test(fn),
      `${id} is handed to the fold as the node it already is`);
    t.check(new RegExp(`getElementById\\('${id}'\\)\\.textContent =`).test(bulk),
      `and setPrBulkMode still writes to it directly`);
  });

  t.check(/id="pr_pack_note"/.test(modal) && /id="pr_tiers_tip_text"/.test(modal),
    'both still exist in the markup, where their wording is written');

  /* The fixed half of step 2's explanation and the half setPrBulkMode
     rewrites were one continuous thought split across the fields. One
     bubble carries both. */
  t.check(/\[s2\.querySelector\('\.pfx-note:not\(\.pfx-quiet\)'\), document\.getElementById\('pr_pack_note'\)\]/.test(fn),
    'step 2 folds both of its notes into a single bubble rather than growing a second badge');
}

/* ---------- 3. an "i" with nothing behind it ------------------------- */
{
  const refresh = extractFunction(src, 'refreshPriceFormTips', 'index.html');
  t.check(/bubble\.textContent\.trim\(\)/.test(refresh),
    'the badge is shown or hidden by what its bubble actually holds');
  t.check(/info\.style\.display = \(bubble && bubble\.textContent\.trim\(\)\) \? '' : 'none';/.test(refresh),
    'hiding the badge, not just the bubble — a hoverable "i" that opens nothing is the thing being avoided');

  /* Called from both ends: once when the form is folded at load, and
     again every time setPrBulkMode rewrites the text underneath it.
     Without the second, the pricing badge would be decided once against
     an empty paragraph and never appear. */
  t.check(/refreshPriceFormTips\(\);/.test(extractFunction(src, 'foldPriceFormInstructions', 'index.html')),
    'checked when the form is folded');
  t.check(/refreshPriceFormTips\(\);/.test(extractFunction(src, 'setPrBulkMode', 'index.html')),
    'and again whenever the wording is rewritten');
}

/* ---------- 4. the bubble stays inside the modal --------------------- */
/*
 * Both directions are reachable and both were seen: step 3's bubble ran
 * 108px past the bottom of the scroll box, and in bulk mode the badge
 * after "Volume pricing (default for every variant)" sits far enough
 * right that a 380px bubble ran off the side.
 */
{
  const place = extractFunction(src, 'placeInfoBubble', 'index.html');
  t.check(place.length > 0, 'there is a placement pass');

  t.check(/const box = info\.closest\('\.modal-body'\);/.test(place)
    && /if\(!bubble \|\| !box\) return;/.test(place),
    'it only acts inside a scrolling container, leaving page headings exactly as they were');

  t.check(/info\.classList\.add\('flip'\)/.test(place)
    && /\.page-info\.flip \.page-info-bubble\{top:auto;bottom:calc\(100% \+ 8px\);\}/.test(src),
    'a bubble with no room below opens upward');
  t.check(/\.page-info\.flip \.page-info-bubble::before\{top:auto;bottom:-5px;\}/.test(src),
    'and its arrow moves to the other edge with it');
  /* Flipping into a top edge is not a fix. */
  t.check(/roomAbove > b\.height \+ 12/.test(place),
    'but only when there is actually room above, rather than trading one clipped edge for the other');

  t.check(/setProperty\('--tip-left'/.test(place) && /left:var\(--tip-left, -6px\)/.test(src),
    'a bubble that would run off the side slides back inside');
  t.check(/setProperty\('--tip-arrow'/.test(place) && /left:var\(--tip-arrow, 11px\)/.test(src),
    'taking its arrow with it, so it still points at the badge it belongs to');
  t.check(/Math\.max\(8, Math\.min\(b\.width - 18,/.test(place),
    'and the arrow is held inside the bubble\'s own corners rather than sliding off the end');

  /* Measured before it is shown, which only works because the bubble is
     hidden by visibility. Removing the previous placement first matters
     as much: a bubble measured while still carrying the last badge's
     offset places the next one against the wrong number. */
  t.check(/bubble\.style\.removeProperty\('--tip-left'\);/.test(place)
    && /bubble\.style\.removeProperty\('--tip-arrow'\);/.test(place)
    && /info\.classList\.remove\('flip'\);/.test(place),
    'each placement starts from the default rather than from wherever the last one ended');

  // Hover and focus reveal the bubble in CSS alone, so the side it opens
  // on has to be decided before that happens -- not on the click only a
  // tap performs.
  const fold = extractFunction(src, 'foldInstruction', 'index.html');
  ['mouseenter', 'focus'].forEach((ev) => {
    t.check(new RegExp(`addEventListener\\('${ev}', \\(\\)=> placeInfoBubble\\(info\\)\\)`).test(fold),
      `placed before ${ev} reveals it`);
  });
  t.check(/if\(!wasOpen\)\{ placeInfoBubble\(info\); info\.classList\.add\('open'\); \}/.test(fold),
    'and before a tap opens it');
}

/* ---------- 5. a folded heading still looks like its own heading ----- */
{
  t.check(/\.page-title-row h1, \.page-title-row h3\{margin-bottom:0;\}/.test(src),
    'a step heading keeps its own type in the row');
  /* A section label draws a dashed rule above itself. As a flex item that
     rule would have been drawn under its own words only. */
  t.check(/\.page-title-row\.ptr-section\{margin:18px 0 8px;padding-top:16px;border-top:1px dashed var\(--line\);\}/.test(src)
    && /\.page-title-row\.ptr-section > \.form-section-label\{margin:0;padding-top:0;border-top:none;\}/.test(src),
    'and a section label hands its dashed rule to the row, which is as wide as the section');
  t.check(/title\.classList\.contains\('form-section-label'\) \? ' ptr-section' : ''/.test(extractFunction(src, 'foldInstruction', 'index.html')),
    'which the fold decides from the heading it was given');

  /* The moved copy has to read on a navy bubble. A .field-hint is a div
     and a .pfx-note carries its own colour, 66ch width and margins --
     a rule written for <p> alone left one of them grey-on-navy. */
  t.check(/\.page-info-bubble > \*\{/.test(src) && !/\.page-info-bubble p\{/.test(src),
    'anything folded in is restyled for the bubble, not just paragraphs');
  t.check(/\.page-info-bubble > \* \+ \*\{margin-top:9px;\}/.test(src),
    'and two notes in one bubble read as two paragraphs');
}

/* ---------- 6. icons where a glyph was standing in for one ----------- */
{
  t.check(/<button type="button" class="btn-icon" id="pr_tier_add">\s*<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"\/><\/svg>/.test(modal),
    'Add tier carries the same plus icon the rest of the app uses');
  t.check(!/\+ Add tier/.test(modal),
    'rather than a plus typed into the label');
  t.check(/\.btn-icon\{display:inline-flex;align-items:center;gap:8px;\}/.test(src),
    'reusing the existing icon-button rule rather than a second one');
}

/* ---------- 7. the placement, actually run --------------------------- */
/*
 * Section 4 reads the source. This runs it, because the arithmetic is
 * where the bug would be and reading it cannot tell an offset that is
 * applied from one that is computed and thrown away.
 *
 * The stub returns the bubble where CSS would put it by default -- 6px
 * left of the badge, 8px below it -- so the function is measuring the
 * same starting point it measures in the browser.
 */
{
  const { placeInfoBubble } = compileScope(
    [extractFunction(src, 'placeInfoBubble', 'index.html')],
    { TIP_EDGE_GAP: 8 }, ['placeInfoBubble'],
  );

  const BOX = { top: 100, bottom: 700, left: 0, right: 760 };
  const stub = ({ badgeLeft, badgeTop, w = 380, h = 200, box = BOX }) => {
    const badge = { left: badgeLeft, top: badgeTop, bottom: badgeTop + 19, width: 19 };
    const props = {};
    const classes = new Set();
    const bubble = {
      style: {
        setProperty: (k, v) => { props[k] = v; },
        removeProperty: (k) => { delete props[k]; },
      },
      // Where the default rule puts it: left:-6px, top:calc(100% + 8px).
      getBoundingClientRect: () => {
        const left = badge.left - 6, top = badge.bottom + 8;
        return { left, right: left + w, top, bottom: top + h, width: w, height: h };
      },
    };
    return {
      info: {
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
        querySelector: () => bubble,
        closest: (sel) => (sel === '.modal-body' ? { getBoundingClientRect: () => box } : null),
        getBoundingClientRect: () => badge,
      },
      props, classes, badge, w,
    };
  };
  const num = (v) => (v == null ? null : parseFloat(v));

  // Room on every side: left exactly as written, nothing touched.
  {
    const s = stub({ badgeLeft: 40, badgeTop: 200 });
    placeInfoBubble(s.info);
    t.check(Object.keys(s.props).length === 0 && !s.classes.has('flip'),
      'a bubble with room around it is left exactly where the stylesheet puts it');
  }

  // Off the right edge -- the long-heading case.
  {
    const s = stub({ badgeLeft: 600, badgeTop: 200 });
    placeInfoBubble(s.info);
    const left = num(s.props['--tip-left']);
    t.check(left != null && s.badge.left + left + s.w === BOX.right - 8,
      `it is slid back until its right edge clears the box (${left})`);
    const arrow = num(s.props['--tip-arrow']);
    t.check(arrow != null && arrow >= 8 && arrow <= s.w - 18,
      `and the arrow moves with it, inside the bubble's own corners (${arrow})`);
    /* The arrow has to land over the badge, or it points at whatever
       heading happens to sit where the bubble now starts. */
    t.check(Math.round(s.badge.left + left + arrow) === Math.round(s.badge.left + s.badge.width / 2 - 5),
      'landing over the badge it belongs to rather than wherever the bubble now begins');
  }

  // Far enough right that keeping the arrow over the badge would push it
  // off the bubble's own end.
  {
    const s = stub({ badgeLeft: 745, badgeTop: 200 });
    placeInfoBubble(s.info);
    const arrow = num(s.props['--tip-arrow']);
    t.check(arrow != null && arrow <= s.w - 18,
      `the arrow stops at the bubble's corner rather than sliding off it (${arrow})`);
  }

  // Off the left edge.
  {
    const s = stub({ badgeLeft: 2, badgeTop: 200 });
    placeInfoBubble(s.info);
    const left = num(s.props['--tip-left']);
    t.check(left != null && s.badge.left + left === BOX.left + 8,
      `and a bubble pushed off the left edge comes back the same way (${left})`);
  }

  // Low in the box, with room above: opens upward.
  {
    const s = stub({ badgeLeft: 40, badgeTop: 600 });
    placeInfoBubble(s.info);
    t.check(s.classes.has('flip'), 'a bubble with no room below opens upward instead');
  }

  // Low in the box with nothing above it either: left as written, since
  // flipping would only move the clipped edge to the top.
  {
    const s = stub({ badgeLeft: 40, badgeTop: 600, h: 560 });
    placeInfoBubble(s.info);
    t.check(!s.classes.has('flip'),
      'but a bubble too tall for either side is not flipped into the opposite edge');
  }

  // Reused across badges: the second placement must not inherit the first.
  {
    const s = stub({ badgeLeft: 600, badgeTop: 600 });
    placeInfoBubble(s.info);
    t.check(s.classes.has('flip') && s.props['--tip-left'] != null, 'a badge that needs both gets both');
    const again = stub({ badgeLeft: 40, badgeTop: 200 });
    // Same element, now sitting somewhere comfortable.
    again.classes.add('flip'); again.props['--tip-left'] = '-99px';
    placeInfoBubble(again.info);
    t.check(!again.classes.has('flip') && again.props['--tip-left'] == null,
      'and the next one starts from the default rather than from where the last one ended');
  }

  // A page heading has the document to grow into; nothing is moved there.
  {
    const s = stub({ badgeLeft: 600, badgeTop: 600 });
    s.info.closest = () => null;
    placeInfoBubble(s.info);
    t.check(Object.keys(s.props).length === 0 && !s.classes.has('flip'),
      'a badge outside a scrolling box is left alone entirely');
  }
}

process.exit(t.done() ? 1 : 0);
