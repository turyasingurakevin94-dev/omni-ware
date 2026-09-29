#!/usr/bin/env node
'use strict';
/*
 * THE RUNG THE PLAN WAS STOPPING ONE SHORT OF.
 *
 * A supplier's price ladder is a step function. The buying plan has
 * always walked up to a step and stopped just under it without saying
 * so: a shop buying 140 bags of something that drops in price at 200
 * pays the 140-price on all 140, and no screen in this app mentioned
 * that sixty more would have changed the price of the other hundred and
 * forty.
 *
 * This is the whole of the "buy better" half of the margin research
 * that can be had without a single new relationship -- and it is also
 * the cheap test of whether the aggregation strategy behind it is worth
 * anything at all: if the ladders in this shop's registry turn out to
 * be flat, the answer is no, found out in a week rather than a year.
 *
 * What is defended here:
 *
 *   - the arithmetic, including that the rung is priced at a quantity
 *     that can actually be ordered rather than at the tier's own minimum
 *   - that a rung the shelf cannot sell through is NOT offered, because
 *     this shop has a dead-stock screen and the buying plan must not be
 *     the thing that fills it
 *   - that the plan never quietly buys more than the shelf needs
 *   - that the band says so in ink, not in the amber this screen keeps
 *     for things that are wrong
 *
 * Run: node test/buy-plan-tiers.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('buy plan tiers');
const src = read('index.html');
const eq = (got, want, msg)=> t.check(got === want, `${msg} (got ${got}, want ${want})`);

const NAMES = ['tiersForKind', 'tieredUnitPrice', 'purchasePriceAtQty', 'cmpNextBreak',
  'buyNextTier', 'buyTierWorthIt', 'buyLineFor'];

/* The shop's own ladder, and the row the plan would buy from: cement at
   27,500 a bag in cartons of ten, dropping to 26,500 at two hundred. */
const row = (tiers, over)=> Object.assign({
  id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', sname: 'Kato Hardware Supplies',
  wholesale: 27500, retail: 29000, packQty: 10, unit: 'Bag', packUnit: 'Ctn',
  tiers: tiers || [], outOfStock: false,
}, over || {});

const taken = new Map();
const s = compileScope([extractDeclaration(src, 'BUY_TIER_MIN_PCT', 'index.html')]
  .concat(NAMES.map((n)=> extractFunction(src, n, 'index.html'))), {
  buyTierTaken: taken,
  // What the plan does with a line beyond its quantity is not this
  // file's subject; every one of these is stubbed to a known answer so
  // the quantities below are checkable by eye.
  rankedPurchaseRowsAtQty: (pid, vi, qty)=> [Object.assign({}, s.__row,
    { purchasePrice: s.purchasePriceAtQty(s.__row, qty) })],
  buyKeptPct: ()=> null,
  buyHoldFor: ()=> null,
  supplierName: ()=> 'Kato Hardware Supplies',
}, NAMES);

// A line as the plan describes one, for the worth-it test.
const line = (over)=> Object.assign({ dailyRate: 10, units30: 300, leadDays: 0, unit: 'Bag' }, over || {});

/* ---------- 1. the arithmetic --------------------------------------- */
{
  const g = s.buyNextTier(row([{ minQty: 200, price: 26500 }]), 140);
  eq(g.atQty, 200, 'the rung is where the supplier says it is');
  eq(g.more, 60, 'and the plan is told how many more it takes');
  eq(g.unitNow, 27500, 'the price it would pay now');
  eq(g.unitThen, 26500, 'the price it would pay there');
  eq(g.saved, 140000, 'what the 140 it was buying anyway stop costing');
  eq(g.costNow, 3850000, 'what the buy costs as it stands');
  eq(g.costThen, 5300000, 'and what it would cost at the rung');
  eq(g.extra, 1450000, 'so the extra spend is a figure, not a feeling');
}

/* ---------- 2. priced at a quantity somebody can order --------------- *
 * A rung at 195 on a line that ships in cartons of ten is reached by
 * ordering 200, not 195. Costing it at 195 would put a figure on the
 * screen that no order can ever produce.
 */
{
  const g = s.buyNextTier(row([{ minQty: 195, price: 26500 }]), 140);
  eq(g.atQty, 200, 'the ask is rounded up to a whole pack');
  eq(g.more, 60, 'and the "how many more" follows it');

  /* Rounding up can land on a BETTER rung than the one that was found,
     and the price is re-read at the quantity rather than taken off the
     tier that triggered it. */
  const two = s.buyNextTier(row([{ minQty: 195, price: 26500 }, { minQty: 200, price: 25900 }]), 140);
  eq(two.atQty, 200, 'a pack boundary that clears two rungs stops at the pack');
  eq(two.unitThen, 25900, 'and is priced at what 200 really costs, not at the rung that was spotted');
}

/* ---------- 3. more goods for less money ----------------------------- *
 * The case with nothing to weigh. It must never be filtered out by a
 * rule about how fast a line sells, because it is not a judgement -- the
 * shop spends less and gets more, whatever happens next.
 */
{
  const g = s.buyNextTier(row([{ minQty: 150, price: 25000 }]), 140);
  eq(g.extra, -100000, '150 at 25,000 costs less than 140 at 27,500');
  t.check(s.buyTierWorthIt(g, line(), 14) === true, 'and it is offered');
  t.check(s.buyTierWorthIt(g, line({ dailyRate: 0.5, units30: 15 }), 14) === true,
    'even on a line that barely moves — spending less is not a judgement call');
  t.check(s.buyTierWorthIt(g, line({ dailyRate: null, units30: 0 }), 14) === true,
    'and even when nobody knows how fast it sells');
}

/* ---------- 4. what is NOT offered ----------------------------------- *
 * Every ladder has rungs above every quantity. A band on every row is a
 * band nobody reads, and a plan that talks a shop into sixty cartons of
 * something that sells one a week has become the dead-stock problem
 * rather than the margin one.
 */
{
  const worthIt = s.buyNextTier(row([{ minQty: 200, price: 26500 }]), 140);
  t.check(s.buyTierWorthIt(worthIt, line(), 14) === true,
    'sixty more on a line selling ten a day is six days of stock — offered');
  t.check(s.buyTierWorthIt(worthIt, line({ dailyRate: 1, units30: 30 }), 14) === false,
    'the same sixty on a line selling one a day is two months — not offered');
  t.check(s.buyTierWorthIt(worthIt, line({ dailyRate: null, units30: 0 }), 14) === false,
    'and a line nobody can rate is offered nothing that costs more');

  const thin = s.buyNextTier(row([{ minQty: 200, price: 27400 }]), 140);
  eq(thin.perUnit, 100, 'a rung can be real and still be worth almost nothing');
  t.check(s.buyTierWorthIt(thin, line(), 14) === false,
    `and under ${s.BUY_TIER_MIN_PCT}% it is not worth interrupting the screen for`);

  t.check(s.buyNextTier(row([]), 140) === null, 'a supplier with no ladder has no rung');
  t.check(s.buyNextTier(row([{ minQty: 100, price: 26500 }]), 140) === null,
    'and a rung already passed is not ahead of anything');
  t.check(s.buyNextTier(row([{ minQty: 200, price: 28000 }]), 140) === null,
    'nor is a tier that costs MORE — a ladder only counts where it goes down');
}

/* ---------- 5. offered, never applied -------------------------------- *
 * The plan asks for what the shelf needs. The rung is named beside it
 * and the owner takes it or does not. A plan that quietly ordered the
 * bigger quantity would be spending the shop's money on an argument it
 * never made.
 */
{
  s.__row = row([{ minQty: 200, price: 26500 }]);
  taken.clear();
  const r = { key: 'P1::', productId: 'P1', variantIdx: null, name: 'Cement', qty: 5,
    units30: 300, dailyRate: 10, daysLeft: 0.5, allPriced: true };

  const plain = s.buyLineFor(r, 135, 'refill');
  eq(plain.buyQty, 140, 'the ask is the shelf’s need, rounded up to a whole pack');
  eq(plain.needQty, 140, 'and the need is remembered as its own figure');
  eq(plain.takenQty, null, 'nothing was taken');
  eq(plain.unitCost, 27500, 'so it is costed at the price that quantity earns');
  t.check(plain.tier && plain.tier.atQty === 200, 'with the next tier named beside it');

  taken.set('P1::|refill', 200);
  const bigger = s.buyLineFor(r, 135, 'refill');
  eq(bigger.buyQty, 200, 'taking the rung makes it the ask');
  eq(bigger.unitCost, 26500, 'at the price the rung buys');
  eq(bigger.cost, 5300000, 'and the line costs what the whole 200 costs');
  eq(bigger.takenQty, 200, 'said to be the owner’s number, not the plan’s');
  eq(bigger.needQty, 140, 'with what the shelf actually needs still beside it');
  t.check(bigger.tier === null, 'and no further tier on this ladder to offer');

  /* THE SHELF MOVES. A quantity taken this morning must never hold the
     line DOWN once the plan wants more than it -- that would be a stale
     decision quietly under-buying a line that has since run dry. */
  const needsMore = s.buyLineFor(r, 260, 'refill');
  eq(needsMore.buyQty, 260, 'a need above what was taken wins');
  eq(needsMore.takenQty, null, 'and the row stops claiming the number is the owner’s');
  taken.clear();
}

/* ---------- 6. the plan judges each rung once ------------------------ */
{
  t.check(/candidates\.forEach\(l=>\{\s*if\(l\.tier && !buyTierWorthIt\(l\.tier, l, l\.coverDays \|\| cover\)\) l\.tier = null;/.test(src),
    'the plan silences the tiers not worth showing, in one place, before anything is ranked');
  t.check(/tier: buyNextTier\(row, buyQty\),/.test(src),
    'and reads the tier against the quantity actually being bought, so taking one offers the next');
}

/* ---------- 7. it is not a warning ----------------------------------- *
 * .ow-tbl-note is amber, and on this screen amber means stop and think:
 * a hold, a price nobody can read. A supplier's own volume break is
 * neither a fault nor a warning, and the rule that says so has to be
 * written against BOTH classes -- .ow-tbl-note is declared further down
 * the file, so a single-class rule loses to it on order alone and the
 * band comes out amber after all.
 */
{
  t.check(/\.ow-tbl-note\.bp-tier\{background:var\(--ow-paper-2\);/.test(src),
    'the rung band is written to outrank the amber note it rides');
  /* A selector STARTING with .bp-tier -- one preceded by whitespace, a
     comma or a brace rather than by another class -- is the losing kind. */
  t.check(!/(^|[\s,{}])\.bp-tier\{/m.test(src),
    'and nowhere is there a single-class rule for it that would quietly lose');
}

/* ---------- the next price break, on its own ------------------------ *
 * cmpNextBreak was written for Compare prices and outlived it: the plan
 * reads it to decide whether a rung ahead is worth reaching. These are
 * the checks that screen's test held on it, moved here when it went.
 */
{
  const nb = s.cmpNextBreak({ packQty: 0, tiers: [{ minQty: 1, price: 35000 }, { minQty: 100, price: 29000 }] }, 80);
  t.check(!!nb, 'a cheaper rung ahead is found');
  eq(nb && nb.more, 20, 'saying how many more it takes to reach it');
  eq(nb && nb.price, 29000, 'and what it drops to');
  t.check(s.cmpNextBreak({ packQty: 0, tiers: [{ minQty: 1, price: 35000 }, { minQty: 100, price: 29000 }] }, 100) === null,
    'once reached there is nothing ahead to report');
  t.check(s.cmpNextBreak({ packQty: 0, tiers: [{ minQty: 1, price: 35000 }] }, 5) === null,
    'and a flat price has no break to reach');
  /* A rung ahead that costs MORE is not a break. */
  t.check(s.cmpNextBreak({ packQty: 0,
    tiers: [{ minQty: 1, price: 36000 }, { minQty: 50, price: 38000 }] }, 10) === null,
    'a dearer rung ahead is not offered as a saving');
  /* A rung BEHIND the quantity is not ahead of it: on an inverted ladder
     the cheaper rung sixty back must not come out as "-59 more". */
  t.check(s.cmpNextBreak({ packQty: 0,
    tiers: [{ minQty: 1, price: 30000 }, { minQty: 50, price: 35000 }] }, 60) === null,
    'and a cheaper rung already behind them is not offered as one ahead');
}

process.exit(t.done() ? 1 : 0);
