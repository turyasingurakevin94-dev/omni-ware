#!/usr/bin/env node
'use strict';
/*
 * When the Manager says "not yet", the buy screen must hear it.
 *
 * The owner caught the app arguing with itself in one glance. The
 * Manager had written, that morning: "I rejected refilling Runners
 * Masasi 12 inch today, 800,000 UGX from Roto Industry with one carton
 * left. Buying your thinnest-margin line before you have repriced it is
 * buying work." And What to buy had the same line at number one — buy 8
 * Ctn from Roto at 100,000 each — with no warning at all.
 *
 * Neither half was wrong. The buy plan ranks on thirty-day gross
 * profit, which is honest arithmetic: a line can turn over hard at a
 * thin percentage and still be the shop's best earner in shillings. The
 * fault was that a decision lived as prose in a meeting card that
 * nothing ever read again, and the screen had no place to put one.
 *
 * Four laws, each of them the shop's own, applied again:
 *
 *   A JUDGEMENT MUST REACH THE SCREEN THAT ACTS  a manager whose
 *       decisions cannot leave its own card is giving opinions.
 *   NAMED RATHER THAN DROPPED  a hold argues, it never blocks. The line
 *       keeps its rank and its Buy it button; quietly hiding a fast
 *       line that is running out is the suppression this app refuses.
 *   DERIVED, NEVER INVENTED  nothing records when a price changed, so
 *       the hold carries its own before-picture and the comparison is
 *       made fresh. It compares the RULE, because a supplier raising
 *       its cost moves the price without anybody repricing anything.
 *   A FIGURE THE BOOKS CANNOT SUPPORT IS WITHHELD  the kept share is
 *       absent where the costing rests on estimates, never guessed.
 *
 * RUN IT, DON'T READ IT: these checks call the functions, render the
 * card and run both tools. Three times in this suite a value was
 * computed and then dropped before the return while source-shaped
 * assertions all passed.
 *
 * Run: node test/buy-holds.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('buy holds');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* Runners Masasi, as the shop actually holds it: one carton left, 2.1 a
   day off the shelf, and a five per cent rule that is the whole
   argument. P2 is the comfortable line beside it. */
const makeData = () => ({
  presetRestockCoverDays: 14,
  presetDefaultMarkup: {},
  presetBuyHolds: {},
  products: [
    { id: 'P1', name: 'Runners Masasi', variants: [{ combo: { Size: '12' }, stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 5 }] },
    { id: 'P2', name: 'Self Drilling Screws', variants: [], stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 30 },
  ],
  stock: { 'P1::0': 1, P2: 0 },
  savedQuotes: [
    { id: 1, invoiced: true, voided: false, date: '2026-08-20', items: [
      { productId: 'P1', variantIdx: 0, qty: 60, supplierId: '__stock__', sellPrice: 105000, _stockLots: [{ qty: 60, cost: 100000 }] },
      { productId: 'P2', variantIdx: null, qty: 10, supplierId: '__stock__', sellPrice: 5000, _stockLots: [{ qty: 10, cost: 3500 }] },
    ] },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: 0, supplierId: 'S1', wholesale: 100000, retail: 106000,
      unit: 'Ctn', packQty: 1, packUnit: 'Ctn', tiers: [], outOfStock: false },
    { id: 2, productId: 'P2', variantIdx: null, supplierId: 'S1', wholesale: 3500, retail: 3800,
      unit: 'Box', packQty: 1, packUnit: 'Box', tiers: [], outOfStock: false },
  ],
  purchaseInvoices: [],
});

let saves = 0;
const makeEnv = (data) => ({
  data,
  todayISO: () => TODAY,
  daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
  saveData: () => { saves += 1; },
  supplierName: (id) => ({ S1: 'Roto Industry' })[id] || String(id),
  productDisplayLabel: (p, vi) => (vi == null ? p.name : `${p.name} (${vi})`),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
  allProductVariantEntries: () => data.products.flatMap((p) => (p.variants && p.variants.length)
    ? p.variants.map((_v, i) => ({ p, variantIdx: i }))
    : [{ p, variantIdx: null }]),
  console, Date, JSON, Math, Number, String, Array, Object, Boolean,
});

const CHAIN = [
  'waSalesByKey', 'waDaysBetween', 'waWeekday', 'stockKey', 'getStockQty',
  'productPriceRows', 'rankedPriceRows', 'rankedPurchaseRowsAtQty',
  'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind',
  'quoteItemSellPrice', 'invoiceLineCost', 'quoteSuggestedPrice', 'quoteSuggestedStockPrice',
  'suggestedSellingPrice', 'suggestedStockSellingPrice',
  'effectiveMarkupRule', 'effectiveStockMarkupRule',
  'buyKeyParts', 'buyKeyLabel', 'buyPriceStamp', 'buyPriceNow', 'buyKeptPct',
  'buyHoldFor', 'setBuyHold', 'liftBuyHold', 'buyHoldsStanding', 'buyHoldsSweep',
  'restockRiskRows', 'stockingCandidates', 'buyLineFor', 'buyLineReason',
  'buyLineFacts', 'buyLineWhy', 'reorderRuleFor', 'supplierLeadTimes', 'supplierLeadDays',
  'purchasePlan',
];
const CONSTS = ['REPEAT_BUYIN_ORDERS', 'LEAD_TIME_WINDOW_DAYS', 'LEAD_TIME_MIN_DELIVERIES',
  'THIN_MARGIN_PCT', 'BUY_HOLD_MAX_DAYS', 'BUY_HOLD_KEEP_DAYS'];

const build = (data, extraSrc, extraNames, extraEnv) => compileScope(
  CHAIN.map((n) => extractFunction(src, n, 'index.html'))
    .concat(CONSTS.map((n) => extractDeclaration(src, n, 'index.html')))
    .concat(extraSrc || []),
  { ...makeEnv(data), ...(extraEnv || {}) },
  ['waSalesByKey', 'buyKeptPct', 'buyKeyLabel', 'buyPriceStamp', 'buyPriceNow',
    'buyHoldFor', 'setBuyHold', 'liftBuyHold', 'buyHoldsStanding', 'buyHoldsSweep',
    'buyLineFacts', 'purchasePlan', 'restockRiskRows'].concat(extraNames || []));

/* ---------- 1. the share the shop keeps ----------------------------- */
{
  const s = build(makeData());
  eq(s.buyKeptPct({ sales30: 6300000, profit30: 300000, soldTotal30: 60, estQty30: 0 }), 5,
    'the kept share is what stuck, out of what was sold — the figure the manager objected to and the card never showed');
  eq(s.buyKeptPct({ sales30: 50000, profit30: 15000, soldTotal30: 10, estQty30: 0 }), 30,
    'a comfortable line reads comfortable');
  eq(s.buyKeptPct({ sales30: 0, profit30: 0, soldTotal30: 0, estQty30: 0 }), null,
    'nothing sold is no share at all, not nought per cent');
  eq(s.buyKeptPct({ sales30: 90000, profit30: -4000, soldTotal30: 3, estQty30: 0 }), null,
    'a loss is left to the money figure — a percentage of a negative reads as arithmetic, not as trouble');
  eq(s.buyKeptPct({ sales30: 6300000, profit30: 300000, soldTotal30: 60, estQty30: 31 }), null,
    'and where more than half the month was costed by GUESS the share is withheld: a margin over estimated costs is a lie with a decimal point');
  eq(s.buyKeptPct({ sales30: 6300000, profit30: 300000, soldTotal30: 60, estQty30: 30 }), 5,
    'exactly half still stands — the line is drawn at more than half, not at any estimate at all');

  /* And it reaches the card, in words, flagged when it is thin. */
  const facts = s.buyLineFacts({ kind: 'refill', units30: 60, profit30: 300000, keptPct: 5, held: 1, leadDays: 1 });
  const kept = facts.find((x) => x.label === 'kept');
  t.check(!!kept, 'the fact row CARRIES the share, beside what the line earned');
  eq(kept.v, '5%', 'as a share');
  eq(kept.cls, 'bad', 'and a thin one is marked, so the owner can see it down the whole list without a meeting');
  eq(s.buyLineFacts({ kind: 'refill', units30: 10, profit30: 15000, keptPct: 30, held: 0 })
    .find((x) => x.label === 'kept').cls, '', 'a healthy share is not shouted about');
  t.check(!s.buyLineFacts({ kind: 'refill', units30: 10, profit30: 15000, keptPct: null, held: 0 })
    .some((x) => x.label === 'kept'), 'and where it cannot be said honestly the card simply does not say it');
}

/* ---------- 2. placing one, and refusing to ------------------------- */
{
  const data = makeData();
  const s = build(data);
  saves = 0;

  eq(s.setBuyHold('P1::0', 'Lift the price first — 5% kept is buying work', 'manager'), true,
    'a hold on a real line is kept');
  eq(saves, 1, 'and written to the shop’s settings at once');
  const h = data.presetBuyHolds['P1::0'];
  eq(h.by, 'manager', 'stamped with whose decision it was');
  eq(h.placedOn, TODAY, 'and the day it was made');
  eq(h.rule.wholesale, 'percent:5',
    'carrying the RULE that prices the line — the before-picture that makes "have you repriced it" answerable at all');
  eq(h.price, 105000, 'and the price that rule produced, for the message when it lifts');

  eq(s.setBuyHold('P9::4', 'a line nobody has', 'manager'), false,
    'a key that resolves to no product is refused — a warning band over nothing is worse than none');
  eq(s.setBuyHold('P1::7', 'a variant nobody has', 'manager'), false, 'and so is a variant that does not exist');
  eq(s.setBuyHold('P2', '  ', 'manager'), false, 'a hold with no reason is not a judgement, it is a blank');
  eq(Object.keys(data.presetBuyHolds).length, 1, 'none of the three reached the settings');
}

/* ---------- 3. it lifts when you REPRICE, not when costs move ------- */
{
  /* The distinction the whole design turns on. */
  const data = makeData();
  const s = build(data);
  s.setBuyHold('P1::0', 'Reprice before you refill', 'manager');

  let h = s.buyHoldFor('P1::0');
  eq(h.over, false, 'the day it is placed, the hold stands');
  eq(h.days, 0, 'nought days old');
  eq(h.reason, 'Reprice before you refill', 'in the words it was made in');

  /* Roto puts its cost up 15%. The derived selling price rises with it
     and the shop has kept exactly the same thin share. */
  data.prices[0].wholesale = 115000;
  h = s.buyHoldFor('P1::0');
  eq(h.over, false,
    'a SUPPLIER raising its cost is not a repricing — the price moved, the share did not, and a price-only test would lift the hold on the strength of the very problem it was placed for');

  /* Now the owner actually acts: 5% becomes 18%. */
  data.products[0].variants[0].stockWholesaleMarkupValue = 18;
  h = s.buyHoldFor('P1::0');
  eq(h.over, true, 'changing the rule that prices the line ends the hold');
  eq(h.endedBecause, 'repriced', 'and says which of the three endings it met');
  t.check(/Lifted when you moved the price/.test(h.note),
    'telling the owner their advice was taken, in shillings they recognise');
  t.check(h.note.includes('105,000'), 'the price it was held at');

  /* A rule the owner never set at all, then sets: also a repricing. */
  const d2 = makeData();
  delete d2.products[1].stockWholesaleMarkupType;
  delete d2.products[1].stockWholesaleMarkupValue;
  const s2 = build(d2);
  s2.setBuyHold('P2', 'No rule on this line at all', 'manager');
  eq(d2.presetBuyHolds.P2.rule.wholesale, 'none', 'a line with no rule is held as having none');
  eq(s2.buyHoldFor('P2').over, false, 'and stands while that is still true');
  d2.products[1].stockWholesaleMarkupType = 'percent';
  d2.products[1].stockWholesaleMarkupValue = 25;
  eq(s2.buyHoldFor('P2').endedBecause, 'repriced', 'giving a line its first rule is a repricing too');
}

/* ---------- 4. and it runs out rather than standing for ever -------- */
{
  const data = makeData();
  const s = build(data);
  s.setBuyHold('P1::0', 'Reprice first', 'manager');
  data.presetBuyHolds['P1::0'].placedOn = shift(TODAY, -31);
  const h = s.buyHoldFor('P1::0');
  eq(h.over, true, 'a hold older than thirty days has run out');
  eq(h.endedBecause, 'ran_out', 'and says so');
  t.check(/without a repricing/.test(h.note), 'naming what did not happen');

  data.presetBuyHolds['P1::0'].placedOn = shift(TODAY, -30);
  eq(s.buyHoldFor('P1::0').over, false, 'thirty days exactly still stands');

  /* Why it matters: a line that drops off the plan takes its hold out of
     sight, and an unliftable hold in the settings for ever is a bug
     nobody can see. */
  eq(s.buyHoldsStanding(TODAY).length, 1, 'a standing hold is listed');
  data.presetBuyHolds['P1::0'].placedOn = shift(TODAY, -40);
  eq(s.buyHoldsStanding(TODAY).length, 0, 'one that has run out is not');
  eq(Object.keys(data.presetBuyHolds).length, 1,
    'and listing them WRITES NOTHING — the reading is pure, so the tool and the screen can call it freely');
}

/* ---------- 5. an ending is news for a week, then forgotten --------- */
{
  const data = makeData();
  const s = build(data);
  s.setBuyHold('P1::0', 'Reprice first', 'manager');
  data.products[0].variants[0].stockWholesaleMarkupValue = 18;

  saves = 0;
  s.buyHoldsSweep(TODAY);
  const raw = data.presetBuyHolds['P1::0'];
  t.check(!!raw, 'a hold the owner has answered is NOT deleted on the spot');
  eq(raw.endedOn, TODAY, 'its ending is written down');
  eq(raw.endedBecause, 'repriced', 'with the reason');
  eq(saves, 1, 'and saved once');

  /* Quoted from the record thereafter: the price it lifted at is the
     price it lifted at, however far the books move afterwards. */
  data.products[0].variants[0].stockWholesaleMarkupValue = 44;
  const after = s.buyHoldFor('P1::0');
  eq(after.over, true, 'it stays ended');
  eq(after.note, raw.note, 'and its message never gets rewritten by later changes');

  raw.endedOn = shift(TODAY, -8);
  s.buyHoldsSweep(TODAY);
  eq(data.presetBuyHolds['P1::0'], undefined, 'after a week the ending stops being news and is forgotten');

  /* A hold whose product was deleted cannot be shown or lifted. */
  const d3 = makeData();
  const s3 = build(d3);
  s3.setBuyHold('P1::0', 'Reprice first', 'manager');
  d3.products.splice(0, 1);
  s3.buyHoldsSweep(TODAY);
  eq(d3.presetBuyHolds['P1::0'], undefined, 'and a hold on a line that no longer exists is swept away');
}

/* ---------- 6. the plan carries it, and never hides the line -------- */
{
  const data = makeData();
  const s = build(data);
  s.setBuyHold('P1::0', 'Lift the price first, then buy it this week', 'manager');
  const plan = s.purchasePlan(null, null, TODAY);

  const masasi = plan.lines.find((l) => l.key === 'P1::0');
  t.check(!!masasi, 'THE HELD LINE IS STILL ON THE PLAN — a hold argues, it never hides');
  eq(plan.lines[0].key, 'P1::0', 'and keeps its rank: it is still what the shop earns most on');
  t.check(!!masasi.hold && !masasi.hold.over, 'the line CARRIES its hold');
  eq(masasi.hold.reason, 'Lift the price first, then buy it this week', 'in the manager’s own words');
  eq(masasi.keptPct, 5, 'beside the thin share that is the argument for it');
  const free = plan.lines.find((l) => l.key === 'P2');
  eq(free ? free.hold : null, null, 'an unheld line carries nothing');
}

/* ---------- 7. and the card shows it, above the recommendation ------ */
{
  const data = makeData();
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const scope = build(data, ['let buyBudget = null; let buyPlanLast = null;',
    extractFunction(src, 'renderPurchasePlanPanel', 'index.html')],
    ['renderPurchasePlanPanel'], {
      document: { getElementById: (id) => (id === 'buy_plan' ? el : null), activeElement: null },
      cashOnHandByAccount: () => ({ total: 5000000, byAccount: [] }),
      esc: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      listPageSlice: (_k, rows) => rows,
      listMoreButtonHTML: () => '',
    });

  scope.setBuyHold('P1::0', 'Buying your thinnest-margin line before repricing is buying work', 'manager');
  scope.renderPurchasePlanPanel();
  const html = el.innerHTML;

  t.check(/pp-hold/.test(html), 'the hold is DRAWN, not merely computed and dropped on the way to the screen');
  t.check(/On hold/.test(html), 'saying plainly that this one is on hold');
  t.check(html.includes('Buying your thinnest-margin line before repricing is buying work'),
    'in the manager’s own sentence — the thing the owner could not see anywhere on this screen');
  t.check(/The Manager · today/.test(html), 'whose decision it was, and how fresh');
  t.check(/pp-hold-fix/.test(html) && /Fix the price/.test(html),
    'with the door to the very thing that would answer it');
  t.check(/pp-hold-lift/.test(html) && /Lift it/.test(html),
    'and a way to overrule it, because the shop may know something the books do not');
  t.check(/Buy it/.test(html) && /Buy <b>/.test(html),
    'THE BUY IT BUTTON SURVIVES — the hold is an argument, never a lock');
  t.check(html.indexOf('pp-hold') < html.indexOf('pp-do'),
    'and it sits ABOVE the instruction: underneath, it would read as a footnote to a decision already taken');
  t.check(/5% <\/span>|<b>5%<\/b> kept/.test(html), 'the thin share is on the card too');

  /* The ending shows where the owner is looking. */
  data.products[0].variants[0].stockWholesaleMarkupValue = 18;
  scope.renderPurchasePlanPanel();
  t.check(/pp-hold-done/.test(el.innerHTML) && /Was held/.test(el.innerHTML),
    'and once answered, the card says so where the owner will see it');
  t.check(!/On hold/.test(el.innerHTML), 'and stops holding it');
}

/* ---------- 8. both minds are handed it ----------------------------- */
(async () => {
  {
    const data = makeData();
    const scope = compileScope(
      CHAIN.map((n) => extractFunction(src, n, 'index.html'))
        .concat(CONSTS.map((n) => extractDeclaration(src, n, 'index.html')))
        .concat([extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
          'function names(){ return { ASSISTANT_TOOLS, setBuyHold }; }']),
      { ...makeEnv(data), apRound: (n) => Math.round(Number(n) || 0),
        cashOnHandByAccount: () => ({ total: 5000000, byAccount: [] }) },
      ['names']);
    const N = scope.names();
    N.setBuyHold('P1::0', 'Lift the price first', 'manager');

    const out = N.ASSISTANT_TOOLS.purchase_plan.run({});
    const line = out.lines.find((l) => l.key === 'P1::0');
    t.check(!!line, 'the tool gives every line its KEY — without one, a mind could name a line in prose and never point at it, which is how a rejection stayed a sentence');
    eq(line.kept_pct, 5, 'and the share kept, so it can see a thin line for itself');
    t.check(!!line.on_hold, 'a held line says it is held');
    eq(line.on_hold.reason, 'Lift the price first', 'with the reason');
    eq(line.on_hold.placed_by, 'manager', 'and whose it was');
    const other = out.lines.find((l) => l.key === 'P2');
    eq(other ? other.on_hold : undefined, undefined, 'an unheld line says nothing at all rather than "not held"');
  }

  /* ---------- 9. the meeting knows what it is already holding ------- */
  {
    const data = makeData();
    const journal = { meeting: [{ id: 1, date: '2026-08-28', body: { keyline: 'k' } }],
      move: [], question: [], target: [], review: [], play: [] };
    const scope = compileScope(
      CHAIN.map((n) => extractFunction(src, n, 'index.html'))
        .concat(CONSTS.map((n) => extractDeclaration(src, n, 'index.html')))
        .concat([
          extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
          extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
          extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
          extractFunction(src, 'managerPlaybook', 'index.html'),
          extractFunction(src, 'managerScoreboard', 'index.html'),
          extractFunction(src, 'managerScoreProgress', 'index.html'),
          extractFunction(src, 'managerRecentReviews', 'index.html'),
          extractFunction(src, 'managerReviewBrief', 'index.html'),
          extractFunction(src, 'deriveMoveOutcome', 'index.html'),
          'function names(){ return { ASSISTANT_TOOLS, setBuyHold }; }']),
      { ...makeEnv(data), apRound: (n) => Math.round(Number(n) || 0),
        managerNotesTable: true, currentShopId: 'shop-1', Promise,
        anShiftDate: shift, anInvoicesInRange: () => [],
        anOverallTotals: () => ({ sales: 0, profit: 0, count: 0, estimatedQty: 0 }),
        debtCollectionsOn: () => ({ total: 0 }),
        dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0 }),
        cashOnHandByAccount: () => ({ total: 5000000, byAccount: [] }),
        sb: { from: () => { const q = { _kind: null };
          q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
          q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
          q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
          q.then = (res) => res({ data: journal[q._kind] || [], error: null });
          return q; } },
      }, ['names']);
    const N = scope.names();

    let hist = await N.ASSISTANT_TOOLS.manager_history.run({ limit: 3 });
    eq(hist.holds_you_placed, undefined, 'a shop holding nothing is handed no holds at all, not an empty list');

    N.setBuyHold('P1::0', 'Lift the price first', 'manager');
    data.presetBuyHolds['P1::0'].placedOn = shift(TODAY, -9);
    hist = await N.ASSISTANT_TOOLS.manager_history.run({ limit: 3 });
    t.check(Array.isArray(hist.holds_you_placed) && hist.holds_you_placed.length === 1,
      'the meeting is HANDED what it is already holding — without this it holds a line on Monday and recommends it again on Tuesday');
    eq(hist.holds_you_placed[0].key, 'P1::0', 'by key, so it can argue about the same line');
    eq(hist.holds_you_placed[0].name, 'Runners Masasi (0)', 'and by name, so it can speak about it');
    eq(hist.holds_you_placed[0].reason, 'Lift the price first', 'with what it said');
    eq(hist.holds_you_placed[0].held_for_days, 9,
      'and how long it has stood — an old hold with nothing repriced is the manager’s own business to raise');
  }

  /* ---------- 10. a meeting places them, bounded and validated ------ */
  {
    const data = makeData();
    const inserted = [];
    const save = compileScope(
      CHAIN.map((n) => extractFunction(src, n, 'index.html'))
        .concat(CONSTS.map((n) => extractDeclaration(src, n, 'index.html')))
        .concat([
          extractFunction(src, 'managerSaveMeeting', 'index.html'),
          extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
          extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
          extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
          extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
          extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
        ]),
      { ...makeEnv(data), managerNotesTable: true, currentShopId: 'shop-1', Promise,
        apRound: (n) => Math.round(Number(n) || 0),
        sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
          select: () => ({ single: () => Promise.resolve({ data: { id: 77 }, error: null }) }) }; } }) },
      }, ['managerSaveMeeting']).managerSaveMeeting;

    await save({ keyline: 'k', moves: [],
      rejected: 'I rejected refilling Runners Masasi 12 inch today.',
      holds: [
        { key: 'P1::0', reason: 'Buying your thinnest-margin line before repricing is buying work' },
        { key: 'P9::9', reason: 'a line that does not exist' },
        { key: 'P2', reason: 'the second real one' },
        { key: 'P2', reason: 'a third, over the cap' },
      ] });

    eq(Object.keys(data.presetBuyHolds).length, 2,
      'at most two holds a meeting — a manager that holds five lines has closed the buying screen');
    t.check(!!data.presetBuyHolds['P1::0'], 'the line it argued about is held');
    eq(data.presetBuyHolds['P1::0'].by, 'manager', 'as the manager’s decision');
    eq(data.presetBuyHolds['P9::9'], undefined,
      'and a key that resolves to no product becomes nothing — the same discipline a move’s subject ids keep');

    /* The hold goes to the settings, NOT the journal: the buy chain is
       synchronous and reads it on every render. */
    t.check(!inserted.some((r) => Array.isArray(r) && r[0] && r[0].kind === 'hold'),
      'no hold row reaches the journal — the buy plan is synchronous and could not read one there');
    const meeting = inserted.find((r) => r && r.kind === 'meeting');
    t.check(/Runners Masasi/.test(meeting.body.rejected),
      'while the prose rejection is still written, for the options that are not a buy-plan line');
  }

  /* ---------- 11. one reading, and the discipline the mind is held to */
  {
    const panel = extractFunction(src, 'renderPurchasePlanPanel', 'index.html');
    t.check(/buyHoldsSweep\(todayISO\(\)\)/.test(panel),
      'the endings are settled before the plan is drawn, so a repricing shows on THIS render and not the next');
    t.check(/openPriceRuleEditor\(btn\.dataset\.pid, vi\)/.test(panel),
      'and Fix the price opens the editor that already argues shelf cost against the cheapest quote');
    const line = extractFunction(src, 'buyLineFor', 'index.html');
    t.check(/hold: buyHoldFor\(r\.key\)/.test(line),
      'every buy line takes its hold from the one reading the tool and the screen share');
    t.check(/buyHolds:d\.presetBuyHolds\|\|\{\}/.test(src)
      && /presetBuyHolds: \(presets\.buyHolds/.test(src),
      'holds load and persist with the shop’s other settings — no migration, and nothing for the owner to paste');

    const ext = api.slice(api.indexOf('const MANAGER_EXTENSION'), api.indexOf('].join', api.indexOf('const MANAGER_EXTENSION')));
    t.check(/A SENTENCE IS NOT ENOUGH/.test(ext),
      'the rule that closes the whole complaint: rejecting a buy in prose leaves the screen recommending it tomorrow');
    t.check(/put it in holds with its key copied exactly from the tool/.test(ext),
      'the key comes from the tool, never from the model’s memory');
    t.check(/A hold is an argument, never a lock/.test(ext),
      'and the mind is told it does not block the buying');
    t.check(/the rule is compared, not the price, so a supplier putting its cost up does not count as a repricing/.test(ext),
      'including WHY the lifting test is what it is — so it never tells the owner a cost rise settled their margin problem');
    t.check(/NEVER hold a line that is already held and never recommend one either/.test(ext),
      'never holding or recommending what it is already holding');
    t.check(/AT MOST TWO holds in a meeting/.test(ext), 'bounded to two');
    t.check(/Keep rejected for options that are NOT a buy-plan line/.test(ext),
      'and the prose rejection keeps its own job');
    t.check(/"holds":\[\{"key":/.test(ext), 'the plan block carries holds in its stated shape');
    t.check(/holds\[\]\.key is copied EXACTLY from a purchase_plan line/.test(ext),
      'with the warning that an invented key resolves to nothing');
    t.check(/And holds_you_placed: the buy-plan lines you told this shop not to refill yet/.test(api),
      'manager_history says in its own description that the holds travel with it');
    t.check(/Each line also carries `key`/.test(api) && /`kept_pct`/.test(api) && /`on_hold`/.test(api),
      'and purchase_plan says it carries the key, the share and the hold');
  }
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
