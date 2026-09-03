#!/usr/bin/env node
'use strict';
/*
 * Where the margin actually goes.
 *
 * 31,436,660 of sales returned 1,598,160 gross. Five point one per cent.
 * Cash out beat cash in by 5,125,645 in the same week. The Manager named
 * the problem and, in the same verdict, named why its own advice was not
 * landing: "the price fix that was done did not reach the high-volume
 * lines — next week's pricing work must start from the biggest-selling
 * lines." That is a tooling failure, not a listening one. There was no
 * list ordered by what a fix is worth.
 *
 * The shop's top line sells at 105,000 on a 100,000 cost. That is a
 * `+5,000 fixed` rule — a fair mark on a 10,000 item, a rounding error
 * on a 100,000 one. NOTHING IN THIS APP HAD EVER DIVIDED A RULE'S VALUE
 * BY THE COST IT IS APPLIED TO. A fixed rule that has quietly stopped
 * making sense looks exactly like a rule, right up until you do the
 * division, and nobody was doing it.
 *
 * Four laws:
 *
 *   TWO NUMBERS, NEVER CONFUSED  keptPct is what the line ACTUALLY
 *       returned, out of the books. ruleYieldPct is what the rule
 *       governing it WOULD return at today's cost. A gap between them is
 *       a line sold off its own rule; a low yield is the rule itself
 *       gone stale. Different repairs, so never quoted as each other.
 *   MARGIN IS THE SHARE OF THE PRICE  +20% on cost keeps 16.7% of what
 *       the customer paid, and that is what margin has always meant
 *       here. A rule is not its own answer.
 *   OVER THE UNITS THAT ACTUALLY SOLD  what lifting would have added is
 *       measured on real units in one window, never projected forward,
 *       and the screen says so.
 *   BOTH PRICES MOVE  a margin decision is about the line, not about
 *       which shelf it came off. The market screen writes only the stock
 *       tier and this shop found out the hard way.
 *
 * Run: node test/margin-rules.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('margin rules');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';

/* The live shop's own shape:
     P1  the top line — 63 sold, 6,615,000 taken, +5,000 fixed on a
         100,000 cost. 4.8% kept. This is the case the screen exists for.
     P2  a healthy percent rule
     P3  a thin line with no rule of its own
     P4  sold, but nothing can cost it                                  */
const products = [
  { id: 'P1', name: 'Runners Masasi 12"', wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 5000,
    stockWholesaleMarkupType: 'fixed', stockWholesaleMarkupValue: 5000 },
  { id: 'P2', name: 'Healthy', wholesaleMarkupType: 'percent', wholesaleMarkupValue: 60,
    stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 60 },
  { id: 'P3', name: 'No Rule' },
  { id: 'P4', name: 'Uncostable' },
  /* A row exists for it and carries no figure — a different absence from
     having no row at all, and the one that slips through a truthiness
     check while reading as a cost of nothing. */
  { id: 'P5', name: 'Costless Row' },
  /* A PERCENT rule that yields under the target. Without it, "is this a
     stale FIXED mark" and "is this thin" cannot be told apart. */
  { id: 'P6', name: 'Thin Percent', wholesaleMarkupType: 'percent', wholesaleMarkupValue: 5,
    stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 5 },
];
const costs = { P1: 100000, P2: 10000, P3: 8000, P4: null, P5: 'rowNoCost', P6: 10000 };
const data = { products, presetTargetMarginPct: null, presetDefaultMarkup: null };

const sales = new Map([
  ['P1', { units30: 63, sales30: 6615000, profit30: 315000, estQty30: 0, wholesaleUnits30: 63, retailUnits30: 0 }],
  /* Its rule says 37.5%; it actually returned 20%. A line sold off its
     own rule — the case that makes keptPct and ruleYieldPct two
     different questions rather than one number written twice. */
  ['P2', { units30: 20, sales30: 320000, profit30: 64000, estQty30: 0, wholesaleUnits30: 20, retailUnits30: 0 }],
  ['P3', { units30: 40, sales30: 360000, profit30: 40000, estQty30: 30, wholesaleUnits30: 40, retailUnits30: 0 }],
  ['P4', { units30: 5, sales30: 50000, profit30: 50000, estQty30: 0, wholesaleUnits30: 5, retailUnits30: 0 }],
  ['P5', { units30: 4, sales30: 40000, profit30: 40000, estQty30: 0, wholesaleUnits30: 4, retailUnits30: 0 }],
  ['P6', { units30: 30, sales30: 315000, profit30: 15000, estQty30: 0, wholesaleUnits30: 30, retailUnits30: 0 }],
  ['P9', { units30: 0, sales30: 0, profit30: 0, estQty30: 0, wholesaleUnits30: 0, retailUnits30: 0 }],
]);

const CHAIN = ['marginRows', 'marginRuleFor', 'ruleYieldPct', 'marginTargetPrice',
  'marginLiftFor', 'setLineMarginRule', 'setStockPriceRule', 'targetMarginPct',
  'effectiveMarkupRule', 'effectiveStockMarkupRule'];

let saved = 0;
let scope = null; let err = null;
try {
  scope = compileScope(CHAIN.map((n) => extractFunction(src, n, 'index.html'))
    .concat([extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html')]), {
    data,
    todayISO: () => TODAY,
    saveData: () => { saved++; },
    waSalesByKey: () => sales,
    buyKeyParts: (k) => ({ productId: String(k), variantIdx: null }),
    ourCostFor: (pid) => {
      const c = costs[pid];
      if (c == null) return null;
      const product = products.find((p) => p.id === pid);
      // A row with no figure on it: present, and useless.
      if (c === 'rowNoCost') return { product, variantIdx: null, cost: null, packQty: 0 };
      return { product, variantIdx: null, cost: c, packQty: 0 };
    },
    ourPriceFor: (pid) => {
      const c = costs[pid];
      if (c == null || c === 'rowNoCost') return null;
      const p = products.find((x) => x.id === pid);
      const v = Number(p.stockWholesaleMarkupValue) || 0;
      if (!v) return c;
      return p.stockWholesaleMarkupType === 'fixed' ? c + v : Math.round(c * (1 + v / 100));
    },
    productDisplayLabel: (p) => p.name,
    Number, String, Math, Object, Array, Boolean,
  }, CHAIN);
} catch (e) { err = e; }
t.check(!!scope, `the margin chain compiles${err ? ` (${err.message})` : ''}`);

(async () => {

/* ---------- 1. the mark is the owner's -------------------------------- */
if (scope) {
  data.presetTargetMarginPct = null;
  eq(scope.targetMarginPct(), 10,
    'ten stays the default, so nothing moves for a shop that never touches it');
  data.presetTargetMarginPct = 25;
  eq(scope.targetMarginPct(), 25,
    'and a shop that sets its own is judged against that — the market screen has been saying "your 10% mark" about a number nobody was ever asked for');
  data.presetTargetMarginPct = 120;
  eq(scope.targetMarginPct(), 10, 'a share over the whole price is not a share, and falls back');
  data.presetTargetMarginPct = null;
}

/* ---------- 2. what a rule is worth, which is the whole point --------- */
if (scope) {
  /* MARGIN IS THE SHARE OF THE PRICE. +5,000 on 100,000 makes 105,000
     and keeps 4.8% of it — the number that makes this shop's top line
     legible, and the division nothing here was doing. */
  eq(scope.ruleYieldPct({ type: 'fixed', value: 5000 }, 100000, 0, 'wholesale'), 4.8,
    'a fixed mark is worth its share of the price it makes, at TODAY’s cost');
  eq(scope.ruleYieldPct({ type: 'fixed', value: 5000 }, 10000, 0, 'wholesale'), 33.3,
    'and the very same rule is worth a third on a cheap item — which is how it stopped making sense without anybody changing it');

  eq(scope.ruleYieldPct({ type: 'percent', value: 20 }, 10000, 0, 'wholesale'), 16.7,
    'a PERCENT rule is not its own answer either: +20% on cost keeps 16.7% of what the customer pays');

  /* A fixed wholesale rule is divided by the pack when it prices, so it
     must be divided by the pack when it is judged. */
  eq(scope.ruleYieldPct({ type: 'fixed', value: 6000 }, 10000, 12, 'wholesale'), 4.8,
    'a fixed wholesale mark is spread over the pack, the same way the price is built');
  eq(scope.ruleYieldPct({ type: 'fixed', value: 6000 }, 10000, 12, 'retail'), 37.5,
    'while the retail side is not — the pack division is a wholesale rule, not a general one');

  eq(scope.ruleYieldPct(null, 100000, 0, 'wholesale'), null, 'no rule yields nothing to report');
  eq(scope.ruleYieldPct({ type: 'fixed', value: 5000 }, 0, 0, 'wholesale'), null,
    'and neither does a cost of nothing — a share of nothing is not nought, it is unknowable');
}

/* ---------- 3. the target price ---------------------------------------- */
if (scope) {
  eq(scope.marginTargetPrice(100000, 20), 125000,
    'keeping a fifth of the price means charging a quarter more than cost — the inversion, not the addition');
  eq(scope.marginTargetPrice(100000, 0), null, 'no target, no price');
  eq(scope.marginTargetPrice(0, 20), null, 'and no cost, no price');
  eq(scope.marginTargetPrice(100000, 100), null,
    'keeping the whole price would mean the goods were free, which they were not');
}

/* ---------- 4. the lines, ranked by what a fix is worth ---------------- */
if (scope) {
  data.presetTargetMarginPct = 20;
  const rows = scope.marginRows(TODAY);
  const by = (name) => rows.find((r) => r.line === name);

  eq(rows.map((r) => r.line).join(','), 'Runners Masasi 12",No Rule,Thin Percent,Healthy',
    'ranked by WHAT LIFTING WOULD ADD over the units that sold — the biggest seller first, which is exactly where the Manager said its advice was failing to reach');

  const top = by('Runners Masasi 12"');
  eq(top.units30, 63, 'carrying what actually sold');
  eq(top.sold30, 6615000, 'and what it took');
  eq(top.keptPct, 4.8, 'and what it ACTUALLY kept, out of the books — not what its rule predicts');
  eq(top.ruleYieldPct, 4.8, 'beside what its rule is worth at today’s cost');
  eq(top.staleFixed, true,
    'and a fixed mark that has stopped keeping the target is named as its own finding — the rule is not wrong about the shilling, it is wrong about the shilling NOW');
  eq(top.targetPrice, 125000, 'with the price that would keep the target');
  eq(top.atStake, (125000 - 105000) * 63,
    'and what lifting to it would have added over the sixty-three that sold — real units, one window, never a projection');

  /* TWO NUMBERS, NEVER CONFUSED. Healthy's rule says 37.5%; the books
     say it returned 20%. That gap is a line being sold off its own rule,
     which is a different repair from a rule that has gone stale — and it
     is invisible the moment one is quoted as the other. */
  eq(by('Healthy').keptPct, 20, 'what a line ACTUALLY kept comes out of the books');
  eq(by('Healthy').ruleYieldPct, 37.5, 'and what its rule would keep is a separate figure beside it');
  t.check(by('Healthy').keptPct !== by('Healthy').ruleYieldPct,
    'the two can and do differ — a line sold off its own rule is exactly what that gap means');

  /* A PERCENT RULE IS NEVER A STALE FIXED MARK, however thin it is. The
     cause is different and so is the fix: a fixed mark needs repricing
     because the cost moved under it; a thin percent was set thin. */
  eq(by('Thin Percent').ruleYieldPct, 4.8, 'a percent rule yielding under the target is still thin');
  eq(by('Thin Percent').staleFixed, false,
    'but is NOT called a stale fixed mark — the diagnosis has to match the cause, or the advice under it is wrong');
  eq(by('Runners Masasi 12"').staleFixed, true, 'while the fixed one at the same yield is');

  /* A LINE NOBODY CAN COST CANNOT BE RANKED. Its kept share reads as
     everything, and it would sit at the top of a screen about thin
     margins saying the opposite of the truth. */
  t.check(!by('Uncostable'), 'a line with no cost on file is kept OUT of the ranking');
  /* TWO WAYS TO HAVE NO COST, and a truthiness check only catches one.
     A row that exists and carries no figure reads as a cost of NOTHING —
     which would put a line claiming to keep 100% at the top of a screen
     about thin margins. */
  t.check(!by('Costless Row'),
    'and so is one whose cost row exists but carries no figure — present is not the same as known');
  eq(rows.skipped.noCost, 2, 'both are counted, so the screen accounts for them rather than dropping them');

  eq(by('No Rule').rule, null, 'a line with no rule of its own says so');
  eq(by('No Rule').estShare, 75,
    'and a profit part-costed by estimate carries the share — a good figure is not a certain one');

  data.presetTargetMarginPct = null;
}

/* ---------- 5. the lift, and that it moves BOTH prices ---------------- */
if (scope) {
  data.presetTargetMarginPct = 20;
  const top = scope.marginRows(TODAY).find((r) => r.line === 'Runners Masasi 12"');
  const lift = scope.marginLiftFor(top, 20);

  eq(lift.target, 125000, 'the lift lands on the price that keeps the target');
  eq(lift.value, 25000, 'through a rule that produces it');
  eq(lift.keptPct, 20, 'keeping exactly what was asked for');
  eq(lift.addsOverWindow, (125000 - 105000) * 63, 'and says what that is worth over what sold');

  /* BOTH PRICES. The market screen writes only the stock tier, so a line
     bought in to order kept its old price while the toast reported
     success — found on this shop's own screen. A margin decision is
     about the line, not about which shelf it came off. */
  const before = saved;
  eq(scope.setLineMarginRule('P1', null, 'wholesale', 'fixed', 25000), true, 'the lift writes');
  eq(products[0].stockWholesaleMarkupValue, 25000, 'the rule for goods off our own shelf moves');
  eq(products[0].wholesaleMarkupValue, 25000,
    'AND the rule for goods bought in to order moves — one of these alone is a price change the owner cannot see the whole of');
  eq(products[0].stockWholesaleMarkupType, 'fixed', 'both carry the type');
  eq(products[0].wholesaleMarkupType, 'fixed', 'both of them');
  t.check(saved > before, 'and it is saved');

  eq(products[0].retailMarkupValue, undefined,
    'while the other side is untouched — a shop has two prices and this moves one');

  eq(scope.setLineMarginRule('NOPE', null, 'wholesale', 'fixed', 1), false,
    'a line that does not exist is refused rather than half-written');
  data.presetTargetMarginPct = null;
}

/* ---------- 6. the screen, and the Manager ---------------------------- */
{
  /* THE SCREEN IS NOW CALLED renderPricing.
     Margin and Clearance were merged into one screen: both are a price
     decision about the same shelf, one asking for more and the other for
     less. Every assertion below is the one that was here before, and
     each still guards the same thing -- the screen reads the one margin
     reading, a price change is confirmed and says it moves BOTH prices,
     a stale fixed rule is explained rather than merely flagged, and the
     lines it could not cost are counted and named rather than dropped. */
  const panel = extractFunction(src, 'renderPricing', 'index.html');
  /* ONE HOP, because one screen now draws two readings: renderPricing
     builds its queue from pricingRows(), and that is where marginRows()
     is read. Both halves are checked, so the screen still cannot compute
     a margin of its own and disagree with what the Manager was handed. */
  const unified = extractFunction(src, 'pricingRows', 'index.html');
  t.check(/pricingRows\(\)/.test(panel) && /marginRows\(\)/.test(unified),
    'the screen reads the one margin reading');
  t.check(/confirm\(/.test(panel), 'and a price change is confirmed, like every other one in this app');
  t.check(/BOTH ways you sell it/.test(panel),
    'the confirmation says it moves both prices — the thing the market screen does not do and this shop was caught by');
  t.check(/A fixed mark does not grow with the cost/.test(panel),
    'a stale fixed rule is explained, not just flagged — the owner has to see why a rule they set is now wrong');
  t.check(/no cost on file, so nothing here can say what they kept/.test(panel),
    'and the lines it could not judge are counted and named at the bottom rather than dropped');

  const badge = extractFunction(src, 'renderPricingBadge', 'index.html');
  t.check(/marginRows\(\)/.test(badge),
    'the rail badge counts from the same reading, so the number and the list cannot disagree');

  const at = src.indexOf('margin: (()=>{');
  const pulse = src.slice(at, at + 1400);
  t.check(at > 0 && /worst_lines/.test(pulse) && /marginRows\(today\)/.test(pulse),
    'the Manager is given the LINES — it has called margin the binding problem for weeks and could only ever hand back a percentage');
  t.check(/fixed_rule_gone_stale/.test(pulse),
    'including which of them are a stale fixed mark, because that is a different diagnosis from a line simply sold too cheap');
  t.check(/could_not_cost/.test(pulse),
    'and what it could not read, so the meeting never mistakes a short list for a clean one');
}

})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
