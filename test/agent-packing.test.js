#!/usr/bin/env node
'use strict';
/*
 * How it comes: packing, in the three places a client decides.
 *
 *   - Each search result says how it is packed ("25 kg a carton", "sold
 *     loose · by the kg") with the price for one and for a whole carton.
 *   - On the order line: carton or loose, what the cartons come to, a
 *     part carton's fill, and "10 short of a full carton · Make it 1 ctn".
 *   - The item's card: the carton with what is in it, one against a
 *     carton with what each earns, and the message for the client.
 *
 * All from the shop's own packQty / packUnit -- nothing is guessed.
 *
 * Run: node test/agent-packing.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent packing');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');

const esc = (v) => String(v == null ? '' : v);
const fmtNum = (n) => Math.round(n).toLocaleString('en-US');
const S = compileScope([
  src.slice(src.indexOf('const PACK_WORD = '), src.indexOf('// The item\'s pack, when it has one')),
  fn('packOf'), fn('packUnitWord'), fn('packWordN'), fn('packChipHTML'), fn('packPriceHTML'),
  'const PACK_NUDGE_SHORT = .25;', fn('packLineState'), fn('packLineSubHTML'), fn('packLineBarHTML'), fn('packMessage'),
], {
  esc, fmtNum, AX_ICON: { box: '' },
  feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`,
  shelfPrice: (it, mode) => Math.max(it.ourPrice, it.floorPrice) * (mode === 'pack' && it.packQty > 0 ? it.packQty : 1),
  lineUsesPack: (it) => Number(it.packQty) > 0 && !!it.displayUnit && it.displayUnit === it.packUnit && it.packUnit !== it.unit,
}, ['packOf', 'packChipHTML', 'packPriceHTML', 'packLineState', 'packLineSubHTML', 'packLineBarHTML', 'packMessage']);

const nails = { productId: 'n', name: 'Wire nails 4"', unit: 'kg', packUnit: 'ctn', packQty: 25, floorPrice: 3700, ourPrice: 3800 };
const screws = { productId: 's', name: 'Concrete nails 3"', unit: 'pc', packUnit: 'box', packQty: 100, floorPrice: 60, ourPrice: 65 };
const wire = { productId: 'w', name: 'Binding wire', unit: 'kg', packUnit: null, packQty: 0, floorPrice: 7000, ourPrice: 7500 };
const cement = { productId: 'c', name: 'Hima cement', unit: 'bag', packUnit: null, packQty: 0, floorPrice: 32000, ourPrice: 33500 };

/* ---------- 1. what a pack is ---------------------------------------- */
{
  const p = S.packOf(nails);
  t.check(p && p.q === 25 && p.word === 'carton' && p.short === 'ctn' && p.loose, 'ctn is a carton of 25 kg, sold loose by the kg');
  t.check(S.packOf(wire) === null && S.packOf(Object.assign({}, nails, { packQty: 1 })) === null
    && S.packOf(Object.assign({}, nails, { packUnit: 'kg' })) === null, 'no pack, a pack of one, or a pack in its own unit is not a pack');
}

/* ---------- 2. on each result ----------------------------------------- */
{
  t.check(/25 kg<\/b> a carton/.test(S.packChipHTML(nails)) && /data-pack-card="n::"/.test(S.packChipHTML(nails)),
    'a result says "25 kg a carton", and the chip opens the item\'s card');
  t.check(/100 pcs<\/b> a box/.test(S.packChipHTML(screws)), 'pieces are counted as pieces');
  t.check(/sold loose · by the kg/.test(S.packChipHTML(wire)) && /sold by the bag/.test(S.packChipHTML(cement)),
    'with no pack it says how it is sold instead');
  const pn = S.packPriceHTML(nails);
  t.check(/3,800<\/b><small>a kg/.test(pn) && /95,000 \/ctn/.test(pn), 'the price for one, then for a carton');
  const ps = S.packPriceHTML(screws);
  t.check(/6,500<\/b><small>a box/.test(ps) && /65 each/.test(ps), 'where one is a few shillings, the box is the price that leads');
}

/* ---------- 3. on the line --------------------------------------------- */
{
  const byCtn = Object.assign({}, nails, { qty: 75, displayQty: 3, displayUnit: 'ctn' });
  t.check(/3 cartons = 75 kg/.test(S.packLineSubHTML(byCtn)), 'by the carton, the line says what the cartons come to');
  const part = Object.assign({}, screws, { qty: 90, displayQty: 90, displayUnit: 'pc' });
  const s = S.packLineState(part);
  t.check(s.short === 10 && s.nudge && s.to === 1, '90 of a box of 100 is 10 short, and close enough to offer the box');
  const bar = S.packLineBarHTML(part, 2);
  t.check(/90 of 100 a box/.test(bar) && /10 short of a full box/.test(bar) && /data-make-pack="2">Make it 1 box/.test(bar),
    'the line shows the fill and offers the whole box');
  const half = S.packLineState(Object.assign({}, screws, { qty: 40, displayUnit: 'pc' }));
  t.check(!half.nudge, 'a box under three-quarters full is not pushed');
  const mix = S.packLineSubHTML(Object.assign({}, screws, { qty: 230, displayUnit: 'pc' }));
  t.check(/2 box<\/b> \+ <b class="m soft">30 pcs<\/b> = 230/.test(mix), 'over a box, it reads as whole boxes and the rest');
  t.check(S.packLineBarHTML(Object.assign({}, screws, { qty: 200, displayUnit: 'pc' }), 0) === '', 'whole boxes need nothing said');
}

/* ---------- 4. the card ------------------------------------------------- */
{
  t.check(S.packMessage(nails, S.packOf(nails)) === 'Wire nails 4": 3,800 a kg. Comes 25 kg in a carton, 95,000 a carton. How many do you need?',
    'the message for the client carries the packing, in the shop\'s numbers');
  t.check(S.packMessage(screws, S.packOf(screws)) === 'Concrete nails 3": 65 each. Comes 100 in a box, 6,500 a box. How many do you need?',
    'counted things are "each"');
  const card = fn('openPackCard');
  t.check(/HOW IT COMES/.test(card) && /you earn \+/.test(card) && /Add 1 \$\{esc\(p\.word\)\}/.test(card),
    'the card: the carton, one against a carton with what each earns, and Add 1 carton');
  t.check(/addCatalogLine\(it, \{ unit: 'pack', displayQty: 1 \}\)/.test(card), 'Add puts a whole carton on the order');
}

/* ---------- 5. wired in ------------------------------------------------- */
{
  t.check(/packChipHTML\(it\)/.test(fn('findRowHTML')) && /packPriceHTML\(it\)/.test(fn('findRowHTML')), 'every result carries it');
  const cart = fn('renderCart');
  t.check(/packLineSubHTML\(it, f\)/.test(cart) && /packLineBarHTML\(it, i\)/.test(cart) && /packLineToggleHTML\(it\)/.test(cart)
    && /packLineCountHTML\(it, f\)/.test(cart), 'every order line carries it');
}

process.exit(t.done() ? 1 : 0);
