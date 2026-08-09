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
  const heads = src.match(/<div class="page-head">/g) || [];
  t.check(heads.length >= 20, `the app has ${heads.length} screens carrying a page head`);

  // The paragraphs are still IN the markup -- this is a fold, not a
  // deletion. If the copy had been retyped into JS, editing the visible
  // sentence would leave the original behind, unreachable and wrong.
  const paras = src.match(/<div class="page-head">[\s\S]{0,900}?<p>[^<]{20,}<\/p>/g) || [];
  t.check(paras.length >= 18,
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

process.exit(t.done() ? 1 : 0);
