'use strict';
/*
 * THREE DEMANDS, ONE GREY. Under every customer's picture sat up to
 * eight paragraphs in the same 12px ink -- the word count, a price that
 * went up, and a product missing from the list because nobody has ever
 * typed its price. The owner had to read all eight to find out which
 * one was work.
 *
 * They are sorted now by what they ask of the owner:
 *
 *   LEFT OFF -- AND WHERE TO FIX IT   not on the picture, and a named
 *                                     screen puts it back. Crimson.
 *   BEFORE YOU SEND                   on the picture, and there is a
 *                                     judgement to make in the moment
 *                                     of sending. Amber.
 *   NOT ON THE PICTURE                said rather than dropped, with
 *                                     nothing to do about it.
 *
 * briefWhyHTML itself is run here against a fixture carrying all three
 * at once, so a sentence that moved between blocks cannot pass.
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('brief note kinds');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const env = {
  esc: (x)=> String(x == null ? '' : x),
  productVariantLabel: (p)=> p.name,
  briefFrames: ()=> [{ items: [{ kind: 'row' }, { kind: 'row' }] }],
  briefWordCount: ()=> 84,
  briefRowCount: ()=> 3,          // one more row than the frames can carry
  briefAlsoWords: ()=> '',
  briefOwnEvidence: ()=> null,
  pairEvidence: ()=> null,
  customerOrdersFor: ()=> [],
  BRIEF_MAX_LIST_FRAMES: 4,
};
const NAMES = ['briefWhyHTML', 'briefNoteBody', 'briefLeftOffHTML', 'briefLeftOffLines'];
const fns = compileScope([
  extractDeclaration(src, 'BRIEF_LEFT_OFF', 'index.html'),
  ...NAMES.map((n)=> extractFunction(src, n, 'index.html')),
], env, NAMES);

const row = (o)=> Object.assign({ productId: 'X', name: 'X', price: 1000, toOrder: false }, o);
const brief = {
  customer: { id: 'C1' }, product: { id: 'P-F', name: 'Flat Head' }, pickVariant: null,
  also: [], reason: { key: 'price', why: 'The price fell for them.' },
  sameAsTheirs: false, cheaperThanTheirs: false,
  groups: [{ key: 'usual', rows: [
    row({ productId: 'P-F', name: 'Flat Head', toOrder: true, lead: 3 }),
    row({ productId: 'P-A', name: 'ABC Screws', upFrom: 10500, price: 11500 }),
  ] }],
  dropped: [{ name: 'Ridge Cap', why: 'nobody can supply it' }],
  pricing: { rows: [{ id: 'P-W', variantIdx: 0, name: 'Washer', why: 'noRow' }] },
};

/* The three blocks, and what fell into each. */
const html = fns.briefWhyHTML(brief);
const block = (cls)=>{
  const i = html.indexOf(`<div class="ow-bn ow-bn-${cls}">`);
  if(i < 0) return null;
  return html.slice(i, html.indexOf('</div>', i));
};

/* ---- 1. every block is there, and headed ---------------------------- */
{
  ['fix', 'watch', 'note'].forEach(k=> t.check(!!block(k), `the ${k} block is drawn`));
  t.check(/Left off \u2014 and where to fix it/.test(block('fix')), 'the fix block says where to go');
  t.check(/Before you send/.test(block('watch')), 'the watch block says when it matters');
  t.check(/Not on the picture/.test(block('note')), 'the third says what it is');
  eq((html.match(/class="ow-bn-l"/g) || []).length, 3, 'one heading each, and no fourth kind');
}

/* ---- 2. an errand is never filed as a nuance ------------------------ */
{
  t.check(/Washer/.test(block('fix')), 'a product with no price on file is an errand');
  t.check(/Price Registry/.test(block('fix')), 'and the block names the screen that fixes it');
  t.check(!/Washer/.test(block('watch')) && !/Washer/.test(block('note')),
    'and it is in no other block');
}

/* ---- 3. what is ON the picture but wants judgement ------------------ */
{
  const w = block('watch');
  t.check(/not on the shelf and would be ordered in/.test(w), 'a to-order line is weighed, not fixed');
  t.check(/about 3 days/.test(w), 'with the wait said');
  t.check(/quoted ABOVE what they last paid/.test(w), 'so is a price that went up');
  t.check(/10,500 &rarr; 11,500/.test(w), 'with both figures');
  t.check(!/would be ordered in/.test(block('fix')), 'neither is an errand on another screen');
}

/* ---- 4. said rather than dropped, with nothing to do ---------------- */
{
  const n = block('note');
  t.check(/Ridge Cap/.test(n), 'a thing nobody can supply is named');
  t.check(/would not fit/.test(n), 'so is a line the four pictures had no room for');
  t.check(!/Ridge Cap/.test(block('fix')), 'and neither is an errand');
}

/* ---- 5. the picture's own measure closes the stack ------------------ */
{
  t.check(/<p class="ow-bn-f">The customer sees/.test(html),
    'the word count is not a note at all, and is set apart under a rule');
  t.check(!/ow-q-note/.test(html), 'nothing here is left in the old undifferentiated grey');
}

/* ---- 6. the empty panel uses the same fix block --------------------- */
{
  const only = fns.briefLeftOffHTML(brief.pricing);
  t.check(/^<div class="ow-bn ow-bn-fix">/.test(only),
    'a customer whose whole list is unpriceable gets the same heading');
  eq(fns.briefLeftOffHTML({ rows: [] }), '', 'and nothing at all where there is nothing to fix');
}

/* ---- 7. the colours mean what the palette says they mean ------------ */
{
  const css = src.slice(src.indexOf('.ow-bn{'), src.indexOf('.ow-q-un{'));
  t.check(/\.ow-bn-fix\{background:var\(--ow-crimson-soft\)/.test(css), 'a fault is crimson');
  t.check(/\.ow-bn-fix \.ow-bn-l\{color:var\(--ow-crimson\)/.test(css), 'heading included');
  t.check(/\.ow-bn-watch\{background:var\(--ow-amber-faint\)/.test(css), 'a caution is amber');
  t.check(/\.ow-bn-watch \.ow-bn-l\{color:var\(--ow-amber-ink\)/.test(css), 'on amber ink, which is what it is for');
  t.check(!/--ow-oxide/.test(css), 'and the accent is left to the one action on the screen');
}

process.exit(t.done() ? 1 : 0);
