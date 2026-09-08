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
    && /const rows = multi \? multi\.slots : \[match\];/.test(src),
    'the document is built from the rows the owner is looking at');
  t.check(/waInbox\.priceDoc\[convId\] = \{ wamid: lastIn\.wamid, doc \};/.test(src),
    'and held against the MESSAGE, so a newer question cannot be answered with an older list');

  t.check(/const pl = waInbox\.priceDoc\[convId\];\s*\n\s*if\(pl && pl\.doc\.rows > 1\)\{ waSendPriceList\(\); return; \}/.test(src),
    'Send posts the picture when there is more than one priced row — the case the picture exists for');
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

process.exit(t.done() ? 1 : 0);
