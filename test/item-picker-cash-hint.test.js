#!/usr/bin/env node
'use strict';
/*
 * Whether the line can actually be paid for, and who could fill it if not.
 *
 * The picker ranks by unit price, which answers "who is cheapest" and
 * not "what can I buy today". WISEUP Tape Measure 7.5M/Plastic is the
 * case that separated them: one dozen wanted, 6 Dozen to a Ctn.
 *
 *   Shafik Katwe   470,000/Ctn, no retail  -> 78,333/dozen, cheapest
 *   Annet Lak      102,000/Dozen, no wholesale
 *
 * Shafik is genuinely cheaper per dozen and cannot sell one. Filling the
 * order through him means 470,000 on the counter and five dozen left
 * over; Annet, dearer per dozen, wants 102,000. When the drawer will not
 * cover the first, the second is not a worse deal -- it is the only one.
 *
 * The money it is judged against is cashPositionForBuying().after: cash
 * on hand less what the orders already being prepared still have to buy.
 * The same figure the buying screen shows, so the two cannot disagree
 * about how much money there is.
 *
 * Run: node test/item-picker-cash-hint.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('item picker cash hint');
const src = read('index.html');
const stage = extractFunction(src, 'renderIpStage', 'index.html');

const NAMES = ['tiersForKind', 'tieredUnitPrice', 'ipLineOutlay', 'ipCashHint'];
let fn = null, err = null;
try {
  fn = compileScope(
    NAMES.map((n) => extractFunction(src, n, 'index.html')),
    { fmtUGX: (n) => `${Number(n).toLocaleString('en-UG')} UGX` },
    NAMES,
  );
} catch (e) { err = e; }
t.check(!!fn, `the outlay and hint helpers compile${err ? ` (${err.message})` : ''}`);

// The reported shape, to the shilling.
const SHAFIK = { supplierId: 'S096', sname: 'Shafik Katwe', wholesale: 470000 / 6, retail: null, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
const ANNET = { supplierId: 'S038', sname: 'Annet Lak', wholesale: null, retail: 102000, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
const ROWS = [SHAFIK, ANNET];
const hint = (o) => fn.ipCashHint({ rows: ROWS, unit: 'Dozen', ...o });

/* ---------- 1. what the till actually has to give up ----------------- */
{
  const s1 = fn.ipLineOutlay(SHAFIK, 1);
  t.check(s1.cash === 470000, `one dozen from a carton-only supplier costs a carton (${s1.cash})`);
  t.check(s1.units === 6 && s1.forcedPack === true,
    `and buys six, five more than the order needs (${s1.units})`);

  const a1 = fn.ipLineOutlay(ANNET, 1);
  t.check(a1.cash === 102000 && a1.units === 1 && a1.forcedPack === false,
    `a supplier who sells loose is asked for exactly what is wanted (${a1.cash} for ${a1.units})`);

  /* Dearer per unit, cheaper to acquire. This is the whole point: the
     ranking and the cash question have different answers here. */
  t.check(a1.cash < s1.cash && fn.ipLineOutlay(ANNET, 1).cash / 1 > 470000 / 6,
    'the dearer supplier per dozen is the cheaper one to buy from today');

  // Once a full carton is wanted there is nothing forced about it.
  const s6 = fn.ipLineOutlay(SHAFIK, 6);
  t.check(s6.cash === 470000 && s6.units === 6 && s6.forcedPack === false,
    `at a full carton the outlay is just the order (${s6.cash} for ${s6.units})`);
  // Seven dozen is two cartons' money from a supplier who sells no less.
  const s7 = fn.ipLineOutlay(SHAFIK, 7);
  t.check(s7.units === 12 && s7.cash === 940000,
    `and seven dozen means two cartons (${s7.units} for ${s7.cash})`);

  /* The other direction does NOT force anything: buying a pack's worth
     from someone who only quotes loose buys exactly that, at the loose
     rate. Falling back is not always a pack. */
  const a12 = fn.ipLineOutlay(ANNET, 12);
  t.check(a12.units === 12 && a12.forcedPack === false && a12.cash === 12 * 102000,
    `a loose-only supplier at pack quantity is still bought loose (${a12.units})`);

  t.check(fn.ipLineOutlay(null, 1) === null && fn.ipLineOutlay(SHAFIK, 0) === null,
    'nothing to buy, or nobody to buy from, has no outlay');
  t.check(fn.ipLineOutlay({ ...SHAFIK, wholesale: null }, 1) === null,
    'and neither does a supplier with no price on either side');
}

/* ---------- 2. it says so when the money is not there ---------------- */
{
  const short = hint({ selectedId: 'S096', qty: 1, available: 200000, cashKnown: true });
  t.check(short && short.level === 'warn', `not enough money is a warning (${short && short.level})`);
  t.check(/470,000 UGX for 6 Dozen/.test(short.text), 'naming what it would actually take');
  t.check(/one Ctn being the least sold/.test(short.text), 'and why it is more than the order needs');
  t.check(/200,000 UGX free after the orders in progress/.test(short.text),
    'against what is free once the orders already being prepared are paid for');
  /* The point of the whole thing: not "you cannot have it" but "here is
     who can". */
  t.check(/Annet Lak can fill this order for 102,000 UGX/.test(short.text),
    'and it names the supplier who can fill the order instead');

  const none = hint({ selectedId: 'S096', qty: 1, available: 50000, cashKnown: true });
  t.check(none.level === 'warn' && /No other supplier on file is within it either/.test(none.text),
    'when nobody is affordable it says that rather than naming one who is not');
  t.check(!/Annet Lak can fill/.test(none.text), 'and does not offer an alternative it has just ruled out');

  // Exactly enough is enough: the boundary is affordable, one shilling
  // under it is not.
  t.check(hint({ selectedId: 'S096', qty: 1, available: 470000, cashKnown: true }).level !== 'warn',
    'the last shilling still buys it');
  t.check(hint({ selectedId: 'S096', qty: 1, available: 469999, cashKnown: true }).level === 'warn',
    'and one short does not');
}

/* ---------- 3. affordable, but more money than the order needs ------- */
{
  const note = hint({ selectedId: 'S096', qty: 1, available: 900000, cashKnown: true });
  t.check(note.level === 'note', `a forced carton is worth noticing even when affordable (${note.level})`);
  t.check(/ties up 470,000 UGX/.test(note.text) && /leaves 5 Dozen spare/.test(note.text),
    'saying what it ties up and what is left over');
  /* Left over is STOCK, not a loss -- the wording has to be a note about
     cash, not a telling-off about waste. */
  t.check(/430,000 UGX would still be free/.test(note.text), 'and what would still be free after it');
  t.check(/Annet Lak would need only 102,000 UGX/.test(note.text),
    'with the smaller outlay named, so the choice is a choice');

  const plain = hint({ selectedId: 'S038', qty: 1, available: 900000, cashKnown: true });
  t.check(plain.level === 'ok' && /102,000 UGX now, 798,000 UGX still free/.test(plain.text),
    `buying exactly what is wanted is a quiet line (${plain.text})`);
  const full = hint({ selectedId: 'S096', qty: 6, available: 900000, cashKnown: true });
  t.check(full.level === 'ok', 'and so is a full carton when a full carton is what was asked for');
}

/* ---------- 3b. rounding up buys the rate it rounds up to ------------ */
/*
 * A supplier who will not break a carton and discounts at two of them:
 * asking for seven means buying twelve, and twelve is what earns the
 * cheaper rate. Pricing the twelve at the seven-dozen rate would quote a
 * figure nobody would be charged.
 */
{
  const TIERED = { supplierId: 'T', sname: 'Tiered', wholesale: 80000, retail: null,
    packQty: 6, packUnit: 'Ctn', unit: 'Dozen',
    tiers: [{ minQty: 6, price: 80000 }, { minQty: 12, price: 70000 }] };
  const seven = fn.ipLineOutlay(TIERED, 7);
  t.check(seven.units === 12, `seven dozen is two cartons (${seven.units})`);
  t.check(seven.rate === 70000, `charged at the two-carton rate it just earned (${seven.rate})`);
  t.check(seven.cash === 840000, `so the cash down is 12 x 70,000 (${seven.cash})`);
  const five = fn.ipLineOutlay(TIERED, 5);
  t.check(five.units === 6 && five.rate === 80000 && five.cash === 480000,
    `while five is one carton at the one-carton rate (${five.cash})`);
}

/* ---------- 3c. the alternative is the cheapest to BUY --------------- */
/*
 * The distinction the whole feature turns on, applied to the suggestion
 * as well as the verdict: the supplier who is cheapest per unit may be
 * the one you cannot pay for.
 */
{
  const CHOSEN = { supplierId: 'C', sname: 'Chosen', wholesale: 100000, retail: null, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
  // Dearest per dozen, cheapest to buy one of.
  const LOOSE = { supplierId: 'L', sname: 'Loose Trader', wholesale: null, retail: 120000, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
  // Cheapest per dozen, and only sells cartons -- 360,000 down.
  const BULK = { supplierId: 'B', sname: 'Bulk House', wholesale: 60000, retail: null, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
  const rows = [CHOSEN, BULK, LOOSE];

  const short = fn.ipCashHint({ rows, selectedId: 'C', qty: 1, unit: 'Dozen', available: 200000, cashKnown: true });
  t.check(short.level === 'warn', 'the chosen supplier is out of reach');
  t.check(/Loose Trader can fill this order for 120,000 UGX/.test(short.text),
    `the one who can be paid is named, not the one who is cheapest per dozen (${short.text})`);
  t.check(!/Bulk House/.test(short.text),
    'and the cheapest per dozen is not offered, since 360,000 cannot be paid either');

  const note = fn.ipCashHint({ rows, selectedId: 'C', qty: 1, unit: 'Dozen', available: 900000, cashKnown: true });
  t.check(/Loose Trader would need only 120,000 UGX/.test(note.text),
    `and when it is only about tying money up, the smallest outlay is named (${note.text})`);

  /* Nothing to suggest is better than suggesting something worse. */
  const onlyDearer = fn.ipCashHint({ rows: [CHOSEN, LOOSE], selectedId: 'L', qty: 1, unit: 'Dozen', available: 900000, cashKnown: true });
  t.check(onlyDearer.level === 'ok', 'a supplier who sells exactly what is wanted needs no note');
  // 100,000 free: the chosen one at 120,000 is out of reach, and the only
  // other on file is dearer still.
  const dearerAlt = fn.ipCashHint({
    rows: [{ ...LOOSE, supplierId: 'C', sname: 'Chosen' }, { ...LOOSE, supplierId: 'D', sname: 'Dearer', retail: 300000 }],
    selectedId: 'C', qty: 1, unit: 'Dozen', available: 100000, cashKnown: true });
  t.check(/No other supplier on file is within it either/.test(dearerAlt.text),
    'and a dearer alternative is not dressed up as a way out');

  /* Two price entries for one supplier is a shape this function is
     handed rows in, and it must not answer "you cannot afford Chosen --
     try Chosen". The second entry is deliberately the CHEAPEST thing on
     the list, so answering with it is the easy mistake. */
  const twice = fn.ipCashHint({
    rows: [CHOSEN, { ...CHOSEN, retail: 110000 }, LOOSE],
    selectedId: 'C', qty: 1, unit: 'Dozen', available: 200000, cashKnown: true });
  t.check(!/Chosen can fill this order/.test(twice.text),
    `the chosen supplier is never offered as its own alternative (${twice.text})`);
  t.check(/Loose Trader can fill this order for 120,000 UGX/.test(twice.text),
    'the next real supplier is, even though it is dearer than the row just skipped');

  /* And when the forced carton is itself the cheapest thing available,
     there is nothing to suggest -- naming the next one along would
     recommend spending MORE to avoid tying money up. */
  const CHEAP_BULK = { supplierId: 'K', sname: 'Cheap Bulk', wholesale: 20000, retail: null, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
  const DEAR_LOOSE = { supplierId: 'M', sname: 'Dear Loose', wholesale: null, retail: 200000, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
  const noSuggestion = fn.ipCashHint({ rows: [CHEAP_BULK, DEAR_LOOSE], selectedId: 'K', qty: 1, unit: 'Dozen', available: 900000, cashKnown: true });
  t.check(noSuggestion.level === 'note' && /ties up 120,000 UGX/.test(noSuggestion.text),
    `the carton is still flagged as more money than the order needs (${noSuggestion.text})`);
  t.check(!/Dear Loose/.test(noSuggestion.text),
    'but the dearer supplier is not named as if it were the smaller outlay');
}

/* ---------- 4. what it will not claim -------------------------------- */
{
  /* A shop that has opened the Cash Book and typed nothing into it has
     an opening of 0/0/0 and no transactions. Reading that as a balance
     would put "you cannot afford this" under every line in the shop on
     no evidence at all. */
  const unknown = hint({ selectedId: 'S096', qty: 1, available: 0, cashKnown: false });
  t.check(unknown.level === 'info', `an unrecorded balance is not a balance of nothing (${unknown.level})`);
  t.check(/Nothing is recorded in the Cash Book yet/.test(unknown.text), 'and says which it is');
  t.check(!/free after the orders in progress/.test(unknown.text),
    'without quoting a figure it does not have');
  // The useful half survives: what the supplier would want is still said.
  t.check(/470,000 UGX for 6 Dozen/.test(unknown.text),
    'while still saying what buying this way would take');

  t.check(hint({ selectedId: '__stock__', qty: 1, available: 900000, cashKnown: true }) === null,
    'selling off our own shelf costs no cash, so there is nothing to warn about');
  t.check(hint({ selectedId: 'S999', qty: 1, available: 900000, cashKnown: true }) === null,
    'and a supplier with no price row has no outlay to judge');
  t.check(fn.ipCashHint({ rows: [], selectedId: 'S096', qty: 1, available: 0, cashKnown: true }) === null,
    'nor does an item nobody has priced');
}

/* ---------- 4b. the quote being built is money already spent --------- */
/*
 * Reported on a four-line quote: the hint kept saying the money was
 * there, because the only figure being weighed was the line in the
 * popup. Every line already added is as spoken for as the orders on the
 * board are -- 600,000 in the drawer against a quote costing 520,000
 * leaves 80,000, not 600,000.
 */
{
  // A loose-selling supplier and a carton-only one, so the difference
  // between "what the line costs" and "what it takes out of the till"
  // shows up in the sum.
  const PRICE_ROWS = {
    'P1::': [{ supplierId: 'S1', sname: 'Loose', wholesale: null, retail: 120000, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] }],
    'P2::': [{ supplierId: 'S2', sname: 'Cartons', wholesale: 75000, retail: null, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] }],
  };
  const committed = (items) => compileScope(
    ['tiersForKind', 'tieredUnitPrice', 'ipLineOutlay', 'quoteCommittedCash']
      .map((n) => extractFunction(src, n, 'index.html')),
    {
      data: { quote: { items } },
      productPriceRows: (pid, vi) => PRICE_ROWS[`${pid}::${vi == null ? '' : vi}`] || [],
    },
    ['quoteCommittedCash'],
  ).quoteCommittedCash();

  t.check(committed([{ productId: 'P1', variantIdx: null, qty: 1, supplierId: 'S1', price: 120000 }]) === 120000,
    'a line bought loose commits what the line costs');
  t.check(committed([{ productId: 'P1', variantIdx: null, qty: 2, supplierId: 'S1', price: 120000 }]) === 240000,
    'counted per unit, so two is two lots of money');

  /* THE POINT. A carton bought to fill a one-dozen line takes the whole
     carton out of the drawer; the other five dozen become stock. This is
     deliberately NOT the "Costs you" total on the same screen -- that is
     the cost of the goods on the order, which is right for the margin
     and wrong for the till. Counting the share instead would have the
     hint warn "this ties up 450,000" and then forget all but 75,000 of
     it against the next line. */
  t.check(committed([{ productId: 'P2', variantIdx: null, qty: 1, supplierId: 'S2', price: 75000 }]) === 450000,
    'a line filled from a carton commits the carton, not its share of one');

  /* Goods already on our own shelf are already paid for. This is the
     rule orderLineIsBoughtIn() applies to a saved order, so the draft
     and the board agree about what still has to be bought. */
  t.check(committed([
    { productId: 'P2', variantIdx: null, qty: 1, supplierId: '__stock__', price: 400000 },
    { productId: 'P1', variantIdx: null, qty: 1, supplierId: 'S1', price: 120000 },
  ]) === 120000, 'a line sold off our own shelf commits no cash');

  // A supplier whose price has since come off file still leaves the
  // quote costing what the line recorded, rather than nothing.
  t.check(committed([{ productId: 'GONE', variantIdx: null, qty: 2, supplierId: 'S9', price: 60000 }]) === 120000,
    'a line whose price is no longer on file falls back to what it recorded');

  t.check(committed([]) === 0 && committed([{ productId: 'P1', qty: 1, price: 5000 }]) === 0,
    'an empty quote, or a line with no supplier yet, commits nothing');
  t.check(committed(undefined) === 0, 'and neither does a quote that does not exist yet');

  // The reported case, end to end.
  const AVAILABLE = 600000, COMMITTED = 520000;
  const blind = hint({ selectedId: 'S096', qty: 1, available: AVAILABLE, committed: 0, cashKnown: true });
  const seeing = hint({ selectedId: 'S096', qty: 1, available: AVAILABLE, committed: COMMITTED, cashKnown: true });
  t.check(blind.level === 'note',
    'with the quote uncounted, 470,000 against 600,000 looks affordable — the reported bug');
  t.check(seeing.level === 'warn',
    'counting it, 470,000 against the 80,000 actually left does not');
  t.check(/You have 80,000 UGX free after the orders in progress and the 520,000 UGX this quote has to buy/.test(seeing.text),
    `and the money is named for what it is net of (${seeing.text})`);
  t.check(/free after the orders in progress\./.test(
    hint({ selectedId: 'S038', qty: 1, available: AVAILABLE, committed: 0, cashKnown: true }).text),
    'while an empty quote is not mentioned, there being nothing to mention');

  /* The alternative has to fit what is ACTUALLY left, not the balance
     before the quote -- offering a supplier who is also out of reach is
     worse than offering none. */
  const tight = hint({ selectedId: 'S096', qty: 1, available: AVAILABLE, committed: 550000, cashKnown: true });
  t.check(!/Annet Lak can fill/.test(tight.text),
    `with 50,000 left, the 102,000 alternative is not offered (${tight.text})`);
  const roomy = hint({ selectedId: 'S096', qty: 1, available: AVAILABLE, committed: 400000, cashKnown: true });
  t.check(/Annet Lak can fill this order for 102,000 UGX/.test(roomy.text),
    'with 200,000 left, it is');

  /* Overspent already. "You have -100,000 free" is not a sentence
     anybody says out loud. */
  const over = hint({ selectedId: 'S096', qty: 1, available: AVAILABLE, committed: 700000, cashKnown: true });
  t.check(over.level === 'warn' && /This quote is already 100,000 UGX beyond what you have/.test(over.text),
    `being past the balance is said as being past it (${over.text})`);
  t.check(!/-100,000/.test(over.text), 'not as a negative amount of money free');

  // Read from the basket on screen, at the moment the popup is drawn.
  t.check(/committed: quoteCommittedCash\(\), cashKnown \}\);/.test(stage),
    'the picker passes what the quote has committed');
}

/* ---------- 5. one definition of how much money there is ------------- */
{
  t.check(/available: cashKnown \? cashPositionForBuying\(\)\.after : 0/.test(stage),
    'the money is cashPositionForBuying().after, the buying screen\'s own figure');
  /* Which is cash on hand less what the orders being prepared still have
     to buy -- the "money left from orders currently being processed"
     this was asked for. A second definition here would be free to drift
     from the one the buying screen shows. */
  const pos = extractFunction(src, 'cashPositionForBuying', 'index.html');
  t.check(/const list = orders \|\| beingPreparedOrders\(\);/.test(pos)
    && /const needed = list\.reduce\(\(s,q\)=> s \+ orderCashToBuy\(q\), 0\);/.test(pos)
    && /const after = held\.total - needed;/.test(pos),
    'and that figure is on-hand less what the orders in progress still need');
  t.check(!/cashOnHandByAccount\(\)\.total/.test(stage),
    'the picker does not compute a second balance of its own');

  // Read once per render, not once per candidate supplier: it walks
  // every order on the board and every line on each.
  t.check((stage.match(/cashPositionForBuying\(\)/g) || []).length === 1,
    'and is read once per render rather than per supplier');

  t.check(/const cashKnown = \(data\.cashTxns\|\|\[\]\)\.length > 0/.test(stage)
    && /Object\.values\(m\)\.some\(v=> Number\(v\) > 0\)/.test(stage),
    'a balance counts as known only once some figure has actually been recorded');
}

/* ---------- 6. it is actually on the screen -------------------------- */
{
  t.check(/const cashHint = ipCashHint\(\{/.test(stage), 'the hint is computed for the stage');
  t.check(/\$\{cashHint \? `<div class="q-cash-hint \$\{cashHint\.level\}">/.test(stage),
    'and drawn, carrying its own weight as a class');
  // Above "Buying from", which is the line it is about.
  t.check(stage.indexOf('q-cash-hint') < stage.indexOf('class="q-chosen-line"'),
    'next to the supplier it is talking about');
  t.check(/<span>\$\{esc\(cashHint\.text\)\}<\/span>/.test(stage),
    'with the text escaped -- it carries supplier names, which are typed in');

  ['ok', 'info', 'note', 'warn'].forEach((lvl) => {
    t.check(new RegExp(`\\.q-cash-hint\\.${lvl}\\{`).test(src), `.${lvl} has a look of its own`);
  });
  t.check(/\.q-cash-hint\.warn\{[^}]*font-weight:600/.test(src),
    'and the one that should stop you reads heavier than the ones that should not');
}

process.exit(t.done() ? 1 : 0);
