#!/usr/bin/env node
'use strict';
/*
 * A quantity is said in the unit it was chosen in.
 *
 * The picker offers the quantity box in the base unit or in the pack --
 * 100 Pair, or 1 Ctn. Which one the rep picks is a decision, not a
 * rounding: they say "a carton" because the client asked for a carton
 * and will remember a carton. The app used to take the choice, multiply
 * it away into pairs, and hand the quote a line reading "10 Pair = 1
 * Ctn" under a price box that counted per pair while the card above it
 * said 240,000/Ctn. Every reader then did the sum the picker had just
 * thrown away.
 *
 * What this file pins:
 *
 *   1. quoteLinePack honours qtyIn. 'unit' never folds into a pack,
 *      whole or not; 'pack' is said in packs, a pack and a half as 1.5;
 *      a line written before the choice was recorded reads as before.
 *   2. The picker's price box counts in the chosen unit, a card "used"
 *      into it lands in that unit, the line is written back per base
 *      unit, and the line records the choice.
 *   3. The quote row counts in the chosen unit -- the box, Price each
 *      and Buy @ -- and an edit in that box is converted back before it
 *      is kept, and makes the choice explicit on the line.
 *   4. A habit remembers the pack the last line was counted in.
 *   5. The customer's price list says a habit the way it was bought:
 *      the PER column names the pack, and the price, what they paid and
 *      what they take are all in it. Nothing is rounded to a whole pack.
 *
 * Run: node test/quote-line-as-chosen.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('a line is said in the unit it was chosen in');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(Number(got) - want) < 1e-6, `${msg} (got ${JSON.stringify(got)}, want ${want})`);

/* ---- 1. the pack reader honours the choice --------------------------- */
{
  const NAMES = ['quoteLinePack', 'quoteLineQtyText', 'quoteLineEach', 'quoteLineCountPer'];
  const fns = compileScope(NAMES.map((n)=> extractFunction(src, n, 'index.html')), {}, NAMES);
  const base = { unit: 'Pair', packUnit: 'Ctn', packQty: 100 };
  eq(fns.quoteLineCountPer(Object.assign({ qty: 100, qtyIn: 'pack' }, base)), 100,
    'the row counts a carton line through the pack size');
  eq(fns.quoteLineCountPer(Object.assign({ qty: 100, qtyIn: 'unit' }, base)), 1,
    'and a loose line through 1');

  const loose = fns.quoteLinePack(Object.assign({ qty: 100, qtyIn: 'unit' }, base));
  eq(loose, null, 'chosen in pairs: a hundred pairs is a hundred pairs, even though it is exactly a carton');
  eq(fns.quoteLineQtyText(Object.assign({ qty: 100, qtyIn: 'unit' }, base)).text, '100 Pair',
    'and the document says so');
  eq(fns.quoteLineEach(Object.assign({ qty: 100, qtyIn: 'unit' }, base), 2400).unit, 'Pair',
    'with the rate per pair');

  const ctn = fns.quoteLinePack(Object.assign({ qty: 100, qtyIn: 'pack' }, base));
  eq(ctn && ctn.packs, 1, 'chosen in cartons: one carton');
  eq(ctn && ctn.whole, true, 'which is whole');
  eq(ctn && ctn.text, '1 Ctn', 'said as a carton');
  eq(fns.quoteLineEach(Object.assign({ qty: 100, qtyIn: 'pack' }, base), 2400).price, 240000,
    'at the carton rate');
  eq(fns.quoteLineQtyText(Object.assign({ qty: 200, qtyIn: 'pack' }, base)).text, '2 Ctn',
    'the quotation, invoice, receipt and supplier message all say "2 Ctn"');
  eq(fns.quoteLineQtyText(Object.assign({ qty: 200, qtyIn: 'pack' }, base)).base, '',
    'with no "(200 Pair)" after it');
  eq(fns.quoteLineQtyText(Object.assign({ qty: 250 }, base)).base, '250 Pair',
    'only an old line with a remainder, folded by the document itself, shows its working');
  eq(fns.quoteLineQtyText(Object.assign({ qty: 200 }, base)).base, '',
    'and an old line of whole cartons does not');

  const half = fns.quoteLinePack(Object.assign({ qty: 150, qtyIn: 'pack' }, base));
  near(half && half.packs, 1.5, 'a carton and a half typed as 1.5 stays 1.5');
  eq(half && half.text, '1.5 Ctn', 'and is said so, not forced back into 50 loose pairs');
  eq(half && half.whole, true, 'it is still counted in cartons');

  const old = fns.quoteLinePack(Object.assign({ qty: 250 }, base));
  eq(old && old.packs, 2, 'a line written before the choice was recorded still reads as before');
  eq(old && old.loose, 50, 'remainder and all');
  eq(old && old.chosen, false, 'and says it was not chosen');
  eq(fns.quoteLinePack(Object.assign({ qty: 50 }, base)), null,
    'under a carton it is loose, as before');
}

/* ---- 1b. the packing list and the invoice check say it the same way --- */
{
  /* The check prints the whole bill, so the whole bill chain comes
     along -- charges and the price of credit both. Extracted, never
     stubbed: a copy of the arithmetic here would go on passing after
     the real one changed. */
  const NAMES = ['orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderChargesTotal', 'orderChargeLines',
    'savedQuoteCashTotal', 'shopCreditPct', 'custTermsDays', 'orderTakesCredit', 'orderCreditTerms',
    'orderCreditCharge', 'creditTermLabel', 'orderCreditOffer', 'orderBillLines', 'orderCreditCheckHTML',
    'quoteLinePack', 'quoteLineCountPer', 'quoteLineCount', 'orderInvoiceCheckHTML'];
  const fns = compileScope(NAMES.map((n)=> extractFunction(src, n, 'index.html')), {
    data: { customers: [], suppliers: [] },
    esc: (x)=> String(x == null ? '' : x),
    fmtUGX: (n)=> Number(n || 0).toLocaleString('en-US') + ' UGX',
    itemDisplayName: (it)=> it.productName,
    itemPickedQty: (it)=> (it.pickedQty == null ? null : Number(it.pickedQty)),
    savedQuoteTotal: ()=> 0,
    quoteItemSellPrice: (it)=> Number(it.sellPrice) || 0,
    supplierName: ()=> 'Jin Zhuang Le Ju',
    shopIdentity: ()=> ({ name: 'Omni-Ware' }),
    quoteClientName: ()=> 'Jackson',
    staffName: (id)=> id,
    orderCustomerLocation: ()=> '',
    fmtShortDate: (d)=> d,
    todayISO: ()=> '2026-09-07',
    savedAgoLabel: ()=> '',
  }, NAMES);
  const ctn = { productName: 'Soft Close', unit: 'Pair', packUnit: 'Ctn', packQty: 100, qtyIn: 'pack', qty: 200, supplierId: 'S1', price: 2150, sellPrice: 2400 };
  const c = fns.quoteLineCount(ctn, 200);
  eq(`${c.n} ${c.unit}`, '2 Ctn', 'a base count is said in the unit the line was chosen in');
  eq(fns.quoteLineCount(ctn, 150).n, '1.5', 'and a part of it is a part of a carton');
  const loose = fns.quoteLineCount({ unit: 'Pair', packUnit: 'Ctn', packQty: 100, qtyIn: 'unit', qty: 200 }, 200);
  eq(`${loose.n} ${loose.unit}`, '200 Pair', 'a line chosen in pairs stays in pairs');

  const order = { id: 1, status: 'completed', invoiced: false, customerId: null, amountPaid: 0, client: { name: 'Jackson' },
    items: [Object.assign({ pickStatus: 'short', pickedQty: 150 }, ctn)] };
  const check = fns.orderInvoiceCheckHTML(order);
  t.check(/1\.5 of 2 Ctn/.test(check) && !/200 Pair/.test(check),
    `the invoice check says "1.5 of 2 Ctn", not "150 of 200 Pair" (${(check.match(/ow-ot-ck-q[^<]*>([^<]*)</) || [])[1]})`);
  /* The packing list is pinned beside its own fixtures, in
     order-preview.test.js. The board card's one-line label counts the
     same way. */
  const worker = read('shared-worker.js');
  const LN = ['pickShortfallLabel', 'pickShortfallLines', 'itemOrderedQty', 'itemPickedQty', 'quoteLinePack', 'quoteLineCountPer', 'quoteLineCount'];
  const L = compileScope([
    extractFunction(src, 'pickShortfallLabel', 'index.html'),
    extractFunction(worker, 'pickShortfallLines', 'shared-worker.js'),
    extractFunction(worker, 'itemOrderedQty', 'shared-worker.js'),
    extractFunction(worker, 'itemPickedQty', 'shared-worker.js'),
    extractDeclaration(worker, 'PICK_ANSWERED', 'shared-worker.js'),
    extractFunction(worker, 'itemPickAnswered', 'shared-worker.js'),
    extractFunction(src, 'quoteLinePack', 'index.html'),
    extractFunction(src, 'quoteLineCountPer', 'index.html'),
    extractFunction(src, 'quoteLineCount', 'index.html'),
  ], {}, LN);
  eq(L.pickShortfallLabel(order), 'Picked short — 1.5 of 2 found',
    'the board card says the short pick in cartons too');
}

/* ---- 2. the picker counts in the chosen unit -------------------------- */
{
  const stage = extractFunction(src, 'renderIpStage', 'index.html');
  t.check(/const chosenIsPack = ipQtyUnitMode==='pack' && hasPack;\s*const perChosen = chosenIsPack \? packQty : 1;/.test(stage),
    'the factor between the chosen unit and the base unit is the pack size in pack mode, else 1');
  t.check(/id="ip_price"[^>]*value="\$\{Math\.round\(sellStart \* perChosen\)\}"/.test(stage),
    'the price box counts in the chosen unit — 240,000 under a card saying 240,000/Ctn, not 2,400');
  t.check(/<label>Sell price \$\{chosenIsPack \? `per \$\{esc\(packUnit\)\}` : 'each'\} \(UGX\)<\/label>/.test(stage),
    'and its label says which unit');
  t.check(/getElementById\('ip_price'\)\.value = Math\.round\(val \* perChosen\);/.test(stage),
    'a recommended-price card "used" into the box lands in that unit too');
  t.check(/const sellPrice = \(Number\(document\.getElementById\('ip_price'\)\.value\) \|\| 0\) \/ \(inPacks \? packQty : 1\);/.test(stage),
    'the line is still written per base unit — the carton figure is divided back down');
  t.check(/qtyIn: inPacks \? 'pack' : 'unit',/.test(stage),
    'and the line records which unit it was chosen in');
  t.check(/ipCashHint\(\{ rows: ranked, selectedId: ipSelectedSupplierId, qty, unit: chosenUnit, per: perChosen,/.test(stage),
    'the cash hint is told the chosen unit, so it says "for 2 Bag" under a box that says 2 Bag');
  const hint = compileScope([extractFunction(src, 'ipCashHint', 'index.html'), extractFunction(src, 'ipLineOutlay', 'index.html')], {
    fmtUGX: (n)=> Number(n).toLocaleString('en-UG') + ' UGX',
    tieredUnitPrice: (row, units, side)=> row[side],
  }, ['ipCashHint']);
  const row = { supplierId: 'S1', sname: 'Nakawa', wholesale: 6000, retail: 7200, packQty: 25, packUnit: 'Bag', unit: 'Kg' };
  const inBags = hint.ipCashHint({ rows: [row], selectedId: 'S1', qty: 50, unit: 'Bag', per: 25, cashKnown: false });
  t.check(/wants 300,000 UGX for 2 Bag\./.test(inBags.text), `the hint counts in bags when the box does (${inBags.text})`);
  const inKg = hint.ipCashHint({ rows: [row], selectedId: 'S1', qty: 50, unit: 'Kg', cashKnown: false });
  t.check(/wants 300,000 UGX for 50 Kg\./.test(inKg.text), `and in kilos when the box does (${inKg.text})`);
}

/* ---- 3. the quote row counts in the chosen unit ----------------------- */
{
  const rows = extractFunction(src, 'renderQuoteItems', 'index.html');
  t.check(/const asPack = !!\(packView && packView\.whole\);\s*const per = asPack \? packView\.packQty : 1;/.test(rows),
    'the row is drawn in packs exactly when the line is counted in packs');
  /* WAS: value="${qtyShown}" raw. The four editable boxes carry
     thousands separators now, so what goes IN is qFigShow(qtyShown) and
     what comes out is read back through qFigParse. The assertion is
     unchanged in substance -- the box shows the count in the unit the
     line is counted in -- and qtyShown is still the value it shows. */
  t.check(/class="ow-gi qty-input q-qty"[^>]*value="\$\{qFigShow\(qtyShown\)\}"/.test(rows),
    'the quantity box shows the count in that unit — 1, not 100');
  t.check(/<span class="q-qty-unit"[^>]*>\$\{esc\(countUnit\)\}<\/span>/.test(rows),
    'with the unit beside it, so "1" reads as "1 Ctn"');
  t.check(/class="ow-tbl-s q-item-unit"[^>]*>\$\{esc\(countUnit\)\}<\/span>/.test(rows),
    'the unit under the product name is the one the line is counted in — "Ctn" under a carton line, not "Pair"');
  t.check(!/value="\$\{it\.qty\}"/.test(rows),
    'the base count is no longer what the box shows');
  t.check(/q-sell[^>]*value="\$\{qFigShow\(Math\.round\(sell \* per\)\)\}"/.test(rows),
    'Price each is per that unit — the carton price beside a carton count');
  t.check(/q-price"[^>]*value="\$\{qFigShow\(Math\.round\(it\.price \* per\)\)\}"/.test(rows),
    'and so is Buy @');
  t.check(/const per = quoteLineCountPer\(item\);/.test(rows),
    'the edit handlers read the same factor off the line');
  /* Through qFigParse, not Number. This is the load-bearing half of the
     separator change: Number("100,000") is NaN and `NaN || 0` is 0, so a
     price typed exactly the way the box displays it would have been
     saved as nothing. Every read of these four boxes goes through the
     parser, and a slice that used Number would be testing code that does
     not ship. */
  t.check(/item\.price = \(qFigParse\(e\.target\.value\) \|\| 0\) \/ quoteLineCountPer\(item\);/.test(rows)
    && /item\.sellPrice = \(qFigParse\(e\.target\.value\) \|\| 0\) \/ quoteLineCountPer\(item\);/.test(rows),
    'a price typed per carton is kept per base unit');
  t.check(!/Number\(e\.target\.value\)/.test(rows),
    'and no box on the row is still read with a bare Number(), which a separated figure reads as NaN');
  t.check(/item\.qtyIn = per > 1 \? 'pack' : 'unit';/.test(rows),
    'an edited count makes the choice explicit on the line');
  t.check(/const typed = qFigParse\(e\.target\.value\) \|\| 1;\s*const newQty = Math\.max\(1, Math\.round\(typed \* per \* 1e6\) \/ 1e6\);/.test(rows),
    'and a count typed in cartons is multiplied back to the base unit before it is kept');
  /* No caption under a carton count. "2 Ctn" with "= 200 Pair" under
     it is the sum the rep did not ask for; the pack size lives in the
     unit's tooltip instead. */
  t.check(/\(!asPack && packView\) \? `<span class="q-qty-pack"/.test(rows)
    && !/asPack \? `<span class="q-qty-pack"/.test(rows),
    'a carton count carries no "= 200 Pair" caption under it');
  /* WAS: `30px minmax(0,1fr) 88px 116px` -- Qty at 88 because the unit
     rode inside the quantity cell, and Price each at 116.

     The unit is a COLUMN now (the document's own "Ctn" heading), so Qty
     no longer has to be wide enough to hold a count AND a word: it is 74
     for the count and its steppers, 58 for the unit beside it, and Price
     each gained the difference at 118. What is being asserted is the
     same thing -- that a six-digit carton price and its reset arrow fit
     without the cell clipping -- measured against the tracks that exist. */
  /* The item track's flex FACTOR is no longer 1: it and Buy from share
     the surplus 1.3 to 1, because item alone taking every spare pixel
     left a 721px cell holding a 200px name on a wide screen while the
     supplier's name truncated. None of that touches what this assertion
     is about, which is the three fixed tracks after it -- so it pins
     those, and pins that item is still a flexible minmax rather than
     being nailed to a width. */
  t.check(/--ow-tbl-cols:26px minmax\(0,[\d.]+fr\) 74px 58px 118px/.test(src),
    'and the Qty track holds the count, Unit the word beside it, Price each a six-digit carton price and its reset arrow');
}

/* ---- 4 & 5. the habit, and the list, say it the way it was bought ------ */
const RUNNERS = { id: 'P-RUN', name: 'Runners', type: 'simple', unit: 'Pair' };
const CEMENT = { id: 'P-CEM', name: 'Cement', type: 'simple', unit: 'Bag' };
const data = {
  products: [RUNNERS, CEMENT],
  prices: [
    { productId: 'P-RUN', variantIdx: null, supplierId: 'S1', unit: 'Pair', packUnit: 'Ctn', packQty: 100, wholesale: 2150, retail: 2400 },
    { productId: 'P-CEM', variantIdx: null, supplierId: 'S1', unit: 'Bag', wholesale: 30000, retail: 32000 },
  ],
  savedQuotes: [],
};
const env = {
  data,
  cmpUnitKey: (s)=> String(s || '').trim().toLowerCase(),
  productById: (id)=> data.products.find(p=> p.id === id) || null,
  productPriceRows: (productId, variantIdx=null)=> data.prices.filter(p=> p.productId === productId
    && (p.variantIdx == null ? null : p.variantIdx) === variantIdx),
  quoteItemSellPrice: (it)=> Number(it.sellPrice) || 0,
  customerOrdersFor: ()=> data.savedQuotes,
  todayISO: ()=> '2026-09-07',
  daysBetweenISO: (a, b)=> Math.round((Date.parse(b) - Date.parse(a)) / 86400000),
  pairLastsDays: ()=> 0,
};
const HN = ['stockUnitFor', 'stockMoveOnRowUnit', 'habitLineOnRowUnit', 'customerProductHabits', 'quoteLinePack'];
const H = compileScope([
  extractDeclaration(src, 'TELL_MIN_ORDERS', 'index.html'),
  ...HN.map((n)=> extractFunction(src, n, 'index.html')),
], env, HN);
{
  data.savedQuotes = [
    { id: 1, invoiced: true, invoicedAt: '2026-08-20', items: [
      { productId: 'P-RUN', variantIdx: null, unit: 'Pair', packUnit: 'Ctn', packQty: 100, qty: 200, qtyIn: 'pack', sellPrice: 2400 },
      { productId: 'P-CEM', variantIdx: null, unit: 'Bag', qty: 10, qtyIn: 'unit', sellPrice: 32000 }] },
    { id: 2, invoiced: true, invoicedAt: '2026-09-01', items: [
      { productId: 'P-RUN', variantIdx: null, unit: 'Pair', packUnit: 'Ctn', packQty: 100, qty: 200, qtyIn: 'pack', sellPrice: 2400 }] },
  ];
  const habits = H.customerProductHabits('C1');
  const run = habits.find(h=> h.productId === 'P-RUN');
  const cem = habits.find(h=> h.productId === 'P-CEM');
  eq(run.typicalQty, 200, 'the habit is still measured in the base unit — every comparison runs on it');
  eq(run.asPack && run.asPack.packUnit, 'Ctn', 'but it remembers that the last line was counted in cartons');
  eq(run.asPack && run.asPack.packQty, 100, 'and how many pairs that carton holds');
  eq(cem.asPack, null, 'a line counted loose leaves no pack behind');

  /* The way they bought it LAST is what they will ask for next. */
  data.savedQuotes.push({ id: 3, invoiced: true, invoicedAt: '2026-09-05', items: [
    { productId: 'P-RUN', variantIdx: null, unit: 'Pair', packUnit: 'Ctn', packQty: 100, qty: 100, qtyIn: 'unit', sellPrice: 2400 }] });
  const later = H.customerProductHabits('C1').find(h=> h.productId === 'P-RUN');
  eq(later.asPack, null, 'a customer who last took 100 Pair by the pair is said in pairs, whatever they took before');

  /* An older line written in the pack unit itself, before the choice
     was recorded, was bought by the carton just as plainly. */
  data.savedQuotes = [{ id: 4, invoiced: true, invoicedAt: '2026-09-01', items: [
    { productId: 'P-RUN', variantIdx: null, unit: 'Ctn', qty: 2, sellPrice: 240000 }] }];
  const old = H.customerProductHabits('C1').find(h=> h.productId === 'P-RUN');
  eq(old.typicalQty, 200, 'converted onto the row, as before');
  eq(old.asPack && old.asPack.packUnit, 'Ctn', 'and remembered as bought by the carton');
}

{
  const genv = {
    briefPriceFor: (id)=> id === 'P-RUN'
      ? { price: 2400, cost: 2150, unit: 'Pair', kind: 'wholesale', packQty: 100, packUnit: 'Ctn' }
      : { price: 32000, cost: 30000, unit: 'Bag', kind: 'retail', packQty: 0, packUnit: '' },
    briefMarkedOutWords: ()=> '',
    briefPriceRows: (id)=> data.prices.filter(p=> p.productId === id),
    briefInStock: ()=> 0,
    supplierLeadDays: ()=> 3,
    briefPackText: (px)=> px.packQty ? `${px.packQty} Pairs/${px.packUnit}` : 'Sold loose',
    briefPaidFigure: ()=> null,
    briefVariantForLine: ()=> ({ variantIdx: null, why: 'noVariants' }),
    briefStageProducts: ()=> [],
    customerSiteStage: ()=> ({ fresh: false, stage: { label: '', buys: [] } }),
    pairCompanionsFor: ()=> [],
    pairSubstitutesFor: ()=> [],
    productById: env.productById,
    productVariantLabel: (p)=> p.name,
    variantLabel: (combo)=> Object.values(combo).join(' / '),
    invoiceNumberLabel: ()=> 'INV-1',
  };
  const GN = ['briefGroups', 'pairVerb', 'briefSupply'];
  const G = compileScope([
    extractDeclaration(src, 'PAIR_VERBS', 'index.html'),
    extractDeclaration(src, 'TELL_PRICE_FALL_CEILING_PCT', 'index.html'),
    extractDeclaration(src, 'TELL_PRICE_DROP_PCT', 'index.html'),
    extractDeclaration(src, 'BRIEF_PACK_FIGURE_PCT', 'index.html'),
    extractDeclaration(src, 'TELL_PRICE_MEMORY_DAYS', 'index.html'),
    extractDeclaration(src, 'BRIEF_ROWS_PER_GROUP', 'index.html'),
    ...GN.map((n)=> extractFunction(src, n, 'index.html')),
  ], genv, GN);

  const byCtn = { productId: 'P-RUN', variantIdx: null, typicalQty: 200, lastPrice: 2500, sinceLast: 6, orders: 2,
    asPack: { packQty: 100, packUnit: 'Ctn' } };
  const loose = { productId: 'P-CEM', variantIdx: null, typicalQty: 10, lastPrice: 32000, sinceLast: 6, orders: 2, asPack: null };
  const groups = G.briefGroups({ id: 'C1' }, [byCtn, loose]);
  const usual = groups.find(g=> g.key === 'usual');
  const run = usual && usual.rows.find(r=> r.productId === 'P-RUN');
  const cem = usual && usual.rows.find(r=> r.productId === 'P-CEM');
  t.check(!!run && !!cem, 'both habits reach the list');
  eq(run && run.unit, 'Ctn', 'a habit bought by the carton is said PER carton');
  eq(run && run.price, 240000, 'at the carton price — 100 × 2,400');
  eq(run && run.theirQty, 2, 'and they take 2, not 200');
  eq(run && run.wasPaid, 250000, 'what they paid is in the same unit, so the two figures can be read together');
  eq(run && run.perUnit && run.perUnit.price, 2400, 'the per-pair reading is kept beside it');
  eq(run && run.packing, '100 Pairs/Ctn', 'and the packing column still says what a carton holds');
  eq(cem && cem.unit, 'Bag', 'a habit bought loose is left in its unit');
  eq(cem && cem.theirQty, 10, 'at its count');

  /* A pack and a half is a pack and a half. */
  const odd = G.briefGroups({ id: 'C1' }, [Object.assign({}, byCtn, { typicalQty: 250 })]);
  const oddRun = odd.find(g=> g.key === 'usual').rows[0];
  near(oddRun.theirQty, 2.5, 'two and a half cartons is said as 2.5, never rounded to 3');

  /* PRICE DOWN: a fall is a fall per carton once the row is per carton. */
  const fell = G.briefGroups({ id: 'C1' }, [Object.assign({}, byCtn, { lastPrice: 3000 })]);
  const down = fell.find(g=> g.key === 'price');
  const dr = down && down.rows[0];
  eq(dr && dr.was, 300000, 'what they paid, per carton');
  eq(dr && dr.price, 240000, 'what it is now, per carton');
  eq(dr && dr.fall, 60000, 'and the saving between them is in the same unit');

  /* Not through f(): the picture prints the count as it is. */
  const paint = extractFunction(src, 'briefPaintList', 'index.html');
  t.check(/ctx\.fillText\(Number\(it\.theirQty\)\.toLocaleString\('en-UG'\), cellR\(4\)/.test(paint),
    'the picture prints YOU TAKE without rounding it');
  const html = extractFunction(src, 'briefStripHTML', 'index.html');
  t.check(/it\.theirQty != null \? Number\(it\.theirQty\)\.toLocaleString\('en-UG'\)/.test(html),
    'and so does its HTML twin');
}

/* Non-zero on a failure, or run-all.js reads the exit status of a
   file that failed as a file that passed. */
process.exit(t.done() ? 1 : 0);
