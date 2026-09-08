#!/usr/bin/env node
'use strict';
/*
 * The PRICE LIST: the third document, and the road that reaches it.
 *
 * The owner asked, more than once, that product answers go out as a
 * picture with a tabular layout rather than as running text. Half of it
 * was already built and unreachable: waDrawOrderReceipt already drew a
 * table and waSendDocImage already sent it with a text twin to fall
 * back to — but only the ASSISTANT could reach that road, and only with
 * quantities in hand.
 *
 * The claims that matter:
 *
 *   THE MESSAGE DECIDES THE DOCUMENT. A quotation answers "I want
 *   thirty bags" — QTY × RATE = AMOUNT, and a TOTAL. Most of what the
 *   matcher reads asks nothing of the sort, and forcing it into the
 *   quotation invents a quantity of one and a total nobody asked for.
 *
 *   PACKING IS ITS OWN FACT, AND THE UNIT RIDES THE PRICE. "20 bx/ctn"
 *   is what a trader needs before a figure means anything, and "2,000"
 *   and "2,000/bx" are different promises. Both are derived from the
 *   purchase row the price came off — never typed.
 *
 *   A COLUMN OF NOTHING IS NOT A COLUMN. Packing and the volume break
 *   are drawn only where a row has them to say.
 *
 *   NOTHING THAT LEAVES THE BUILDING CARRIES A COST PRICE. Fifth
 *   surface held to that line, and the renderer can reach nothing but
 *   the document it is handed.
 *
 * Run: node test/whatsapp-price-list.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('the whatsapp price list');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const env = { data: { presetWaPhone: '' } };
let scope = null; let err = null;
try {
  scope = compileScope([
    extractFunction(src, 'waPriceListDoc', 'index.html'),
    (src.match(/^const WA_QUOTE_SIZE = .*$/m) || [''])[0],
  ], env, ['waPriceListDoc']);
} catch (e) { err = e; }
t.check(!!scope, `the price-list builder compiles${err ? ` (${err.message})` : ''}`);
if (!scope) process.exit(1);

const SHOP = { name: 'Omni-Ware Hardware', phone: '0772 123 456' };
const item = (o) => Object.assign({
  productId: 'H1', pname: 'Hex Bolts', vlabel: null, name: 'Hex Bolts',
  priced: true, price: 900, unit: 'pc', pack: null, breaks: [],
}, o);

/* ---------- 1. the product named once, its sizes beneath ------------- */
{
  const d = scope.waPriceListDoc([
    item({ vlabel: '6*80', name: 'Hex Bolts — 6*80', price: 900 }),
    item({ vlabel: '6*30', name: 'Hex Bolts — 6*30', price: 500 }),
    item({ productId: 'N1', pname: 'Roofing Nails 4"', name: 'Roofing Nails 4"', price: 2000, unit: 'bx' }),
  ], [], SHOP, '8 Sep 2025');
  eq(d.groups.length, 2, 'two products, two groups');
  eq(d.groups[0].name, 'Hex Bolts', 'the product is named once');
  eq(d.groups[0].rows.map((r) => r.label).join(', '), '6*80, 6*30',
    'and its sizes are the rows — the whole readability win, five long lines becoming one name and four short ones');
  eq(d.rows, 3, 'three rows in all');
  eq(d.groups[1].rows[0].label, null,
    'a product with no sizes carries no size label, so it can be drawn as ONE row rather than a heading over an empty one');
  eq(d.kind, 'prices', 'and it is its own kind of document');
  t.check(!('total' in d), 'with NO total — nothing was ordered, so nothing is totalled');
}

/* ---------- 2. packing, and the unit on the price -------------------- */
{
  const d = scope.waPriceListDoc([
    item({ vlabel: '6*80', pack: { qty: 100, unit: 'bx' }, unit: 'pc' }),
    item({ productId: 'N1', pname: 'Roofing Nails 4"', name: 'Roofing Nails 4"',
      price: 2000, unit: 'bx', pack: { qty: 20, unit: 'ctn' } }),
  ], [], SHOP, '8 Sep 2025');
  eq(d.groups[0].rows[0].packing, '100 pc/bx', 'a hundred pieces to the box');
  eq(d.groups[1].rows[0].packing, '20 bx/ctn',
    'and twenty boxes to the carton — the shop\'s own notation, read off the purchase row');
  eq(d.groups[1].rows[0].unit, 'bx',
    'the unit rides the row, because "2,000" and "2,000/bx" are different promises');
  eq(d.hasPacking, true, 'so the column has something to say');

  /* A COLUMN OF NOTHING IS NOT A COLUMN. */
  const bare = scope.waPriceListDoc([item({ vlabel: '6*80' })], [], SHOP, '8 Sep 2025');
  eq(bare.hasPacking, false, 'nothing packed, no packing column');
  eq(bare.breakQty, null, 'no volume break, no break column');
  eq(scope.waPriceListDoc([item({ breaks: [{ qty: 20, price: 820 }] }),
    item({ vlabel: 'x', breaks: [{ qty: 50, price: 800 }] })], [], SHOP, '8 Sep 2025').breakQty, 20,
    'and where several rows break at different counts the column is headed by the SMALLEST — the one the most customers reach');
}

/* ---------- 3. what the shop cannot answer, said rather than dropped - */
{
  const d = scope.waPriceListDoc([item({ vlabel: '6*80' })], ['8x25', 'cement'], SHOP, '8 Sep 2025');
  eq(JSON.stringify(d.notCarried), '["8*25"]',
    'a SIZE nobody carries is named on the paper, in the shop\'s own notation');
  t.check(!d.notCarried.includes('cement'),
    'while a word that could mean many things is the owner\'s question, not a claim to make to a customer');

  const pending = scope.waPriceListDoc([
    item({ priced: false, price: null, pname: 'BOVOS Door Handle', name: 'BOVOS Door Handle' }),
  ], [], SHOP, '8 Sep 2025');
  eq(pending.groups[0].rows[0].price, null,
    'a product the shop sells but has not priced carries no figure — never a number the book does not hold');
  eq(pending.rows, 1, 'and it is still a row, because "we have it" is the honest answer');
}

/* ---------- 4. nothing about the shop's side leaves the building ----- */
{
  const d = scope.waPriceListDoc([item({ vlabel: '6*80', pack: { qty: 100, unit: 'bx' },
    breaks: [{ qty: 20, price: 820 }] })], ['8x25'], SHOP, '8 Sep 2025');
  t.check(!/cost|margin|profit|supplier|debt|consign/i.test(JSON.stringify(d)),
    'the document carries no cost, margin, supplier or debt — it is paper a customer keeps');
  const draw = (/function waDrawPriceList\(canvas, doc\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(!!draw && !/(cost|margin|profit|supplier|debt)/i.test(draw),
    'and the renderer can reach nothing but the document it is handed — the waDrawStatus law');
  t.check(/c\.scale\(2, 2\)/.test(draw),
    'oversampled 2× like the receipt, so WhatsApp compression cannot blur the figures');
  t.check(/'PRICE LIST'/.test(draw) && /'ITEM'/.test(draw) && /'PACKING'/.test(draw) && /'PRICE'/.test(draw),
    'headed PRICE LIST, and a real table');
  t.check(/doc\.hasPacking \? packRight : /.test(draw) && /doc\.breakQty != null \? w-188 : w-64/.test(draw),
    'the columns MOVE when one is not drawn, rather than leaving a gap where nothing was said');
  t.check(/c\.fillText\('\/' \+ unit, x \+ 3, y\)/.test(draw),
    'the unit hangs after the figure in a fixed slot, so a varying suffix can never push a column of money out of true');
  t.check(!/'TOTAL'/.test(draw), 'and no total is drawn anywhere in it');
}

/* ---------- 5. the shop's paper, drawn once ------------------------- */
{
  /* Three documents carry the same letterhead now, so it is drawn in one
     place: a change to the shop's paper is one change, not three. */
  t.check(/function waDocHead\(c, w, doc, kindLabel, rightLine, rightSub\)\{/.test(src)
    && /function waDocFoot\(c, w, y, doc, promise\)\{/.test(src),
    'the letterhead and the close are one function each');
  const head = (/function waDocHead\([\s\S]*?\n\}/.exec(src) || [''])[0];
  /* THE GREY MOVED. The receipt's FAINT (#9CA3AF) is 2.54:1 on white and
     it set the column heads, the block heads and the closing line — all
     at 11px, where the floor is 4.5:1. That is the document a customer
     reads on a phone in the sun, which is the reading condition that got
     the oxide chosen over amber in the first place. */
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
    .reduce((a, v, i) => a + [0.2126, 0.7152, 0.0722][i] * v, 0);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const mute = (src.match(/WA_DOC_MUTE = '(#[0-9A-Fa-f]{6})'/) || [])[1];
  t.check(!!mute && ratio(mute, '#FFFFFF') >= 4.5,
    `every grey on the shop's paper clears 4.5:1 on white (${mute} is ${ratio(mute, '#FFFFFF').toFixed(2)}:1)`);
  const docs = src.slice(src.indexOf('function waDocHead'), src.indexOf('async function waSendDocImage'));
  t.check(!/#9CA3AF/.test(docs),
    'and the 2.54:1 grey is gone from every document the customer is handed');
  t.check(/if\(doc && doc\.kind === 'prices'\) return waDrawPriceList\(canvas, doc\);\s*\n\s*return waDrawOrderReceipt\(canvas, doc\);/.test(src)
    && /waDrawDoc\(canvas, receipt\);/.test(src),
    'one door, three documents — the kind picks the renderer');
}

/* ---------- 6. the road: a list goes as a list ----------------------- */
{
  /* Built from what the ROW just drew, never from a second read of the
     message, so the picture and the screen can never disagree. */
  t.check(/const doc = waPriceListDoc\(rows, multi \? multi\.unread : \[\], shopIdentity\(\),/.test(src)
    && /const rows = multi \? multi\.slots : options \? options : \[match\];/.test(src),
    'the document is built from the rows the owner is looking at');
  /* A TIE IS A PRICE LIST. "do you have pull handles" ties five handles
     because the matcher cannot tell which ONE was meant — and a price
     list does not have to pick one. Before this, a tie built no document
     and drafted no words, so Send did nothing at all until the owner had
     narrowed to a single size: the shop could not answer "what pull
     handles do you have" with the list of its pull handles. */
  t.check(/if\(lastIn && \(match \|\| options \|\| \(multi && multi\.settled\)\)\)\{/.test(src),
    'a tie is a price list of every option — the honest answer to "do you have pull handles"');
  t.check(/: \(options && plDoc\) \? waPriceListText\(plDoc\)/.test(src),
    'and it carries words, composed from the same document, so Send has something to post');
  t.check(/waInbox\.priceDoc\[convId\] = \{ wamid: lastIn\.wamid, doc \};/.test(src),
    'and held against the MESSAGE, so a newer question cannot be answered with an older list');

  /* This once read `pl.doc.rows > 1`: one priced row went as prose,
     because a picture of a single line costs the customer data to be
     told less. That trade was not mine to make. The owner asked for
     product answers in picture form, and under that rule almost every
     real question — "cement tororo price", "hex bolts 6*80" — still went
     as text, which reads as the feature being broken. One row is a
     quote slip on the shop's letterhead, which is the better answer
     anyway; the words are still the whole answer if the image misses. */
  t.check(/const pl = waInbox\.priceDoc\[convId\];\s*\n\s*if\(pl\)\{ waSendPriceList\(\); return; \}/.test(src),
    'EVERY priced answer goes as the shop\'s paper, one row or twenty');
  t.check(/if\(d && d\.order && \(d\.order\.lines\|\|\[\]\)\.length\)\{ waSendQuoteFromChat\(\); return; \}/.test(src),
    'behind the quotation, which still wins when a quantity was resolved');

  const send = (/async function waSendPriceList\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/const words = String\(\(ta && ta\.value\) \|\| waInbox\.drafts\[convId\] \|\| ''\)\.trim\(\);/.test(send),
    'the caption is whatever stands in the COMPOSER — the drafted words, or the owner\'s own if they rewrote them');
  t.check(/await waSendDocImage\(held\.doc, words, words\);/.test(send),
    'and those same words are the text twin, so a customer whose image never loads still reads every price');
  t.check(/if\(!words\) return;/.test(send),
    'an empty composer sends nothing — a picture with no words is the half that cannot be copied');
}

/* ---------- 7. the words for that document -------------------------- */
{
  let W = null;
  try {
    W = compileScope([extractFunction(src, 'waPriceListText', 'index.html'),
      (src.match(/^const WA_PRICE_TEXT_MAX = .*$/m) || [''])[0]], {}, ['waPriceListText']);
  } catch (e) { /* reported below */ }
  t.check(!!W, 'the words twin compiles alone — it is composed from the document, not from the screen');
  if (W) {
    const doc = {
      groups: [
        { name: 'C-Type Pull Handle 425MM', rows: [{ label: '400mm', packing: '10 pc/bx', price: 50000, unit: 'pc' }] },
        { name: 'Cement (Tororo 50kg)', rows: [{ label: null, packing: '', price: 32000, unit: 'bag' }] },
        { name: 'BOVOS Door Handle', rows: [{ label: null, packing: '', price: null, unit: 'pc' }] },
      ],
      notCarried: ['8*25'],
    };
    const lines = W.waPriceListText(doc).split('\n');
    eq(lines[0], 'C-Type Pull Handle 425MM — 400mm: UGX 50,000/pc (10 pc/bx).',
      'the same name, the same packing and the unit on the price — word for word what the picture says');
    eq(lines[1], 'Cement (Tororo 50kg): UGX 32,000/bag.',
      'a product with no size is named plainly, and with no packing to give it says none');
    eq(lines[2], 'BOVOS Door Handle: we have it — the price will be confirmed shortly.',
      'and one the shop has not priced says so — never a number the book does not hold');
    eq(lines[3], '8*25: we do not have that size.', 'what the shop does not carry is said, not dropped');
    eq(lines[4], 'Reply here to order, or ask about anything else.', 'and it closes by inviting the order');
    t.check(!/cost|margin|supplier/i.test(lines.join(' ')),
      'nothing about the shop\'s side of the book leaves in the caption either');

    /* A CAPTION IS READ IN A STREAM. Twenty lines of it is a wall — but
       the ones held back are COUNTED, never silently dropped. */
    const many = { groups: [{ name: 'Hex Bolts', rows: Array.from({ length: 12 },
      (_, i) => ({ label: 'size ' + i, packing: '', price: 900, unit: 'pc' })) }], notCarried: [] };
    const long = W.waPriceListText(many).split('\n');
    eq(long.length, 10, 'eight rows, the count of what is left, and the close');
    eq(long[8], 'And 4 more in the picture.', 'and it says how many it did not list');
  }
}

process.exit(t.done() ? 1 : 0);
