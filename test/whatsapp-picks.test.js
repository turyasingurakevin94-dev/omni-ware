#!/usr/bin/env node
'use strict';
/*
 * WhatsApp: today's post.
 *
 * The picker recommends what the shop should show people today, and the
 * whole feature stands on four promises:
 *
 *   EVERY PICK CARRIES ITS REASONS, and every reason is a claim about
 *   the shop's own data -- what it EARNS in a month (margin times
 *   pace, the backbone), a fresh restock, customers who asked, stock
 *   that is sitting, margin, a price that fell, a weekday it sells on.
 *   A recommendation that cannot be interrogated stops being trusted.
 *
 *   A PHOTO IS INFORMATION, NEVER A GATE. The photo-gated picker only
 *   ever saw the photographed shelf and recommended the leftovers; the
 *   most lucrative lines were exactly the ones without photos. A
 *   photo-less pick posts as a text card.
 *
 *   ROTATION IS REAL. "Not shown recently" is backed by wa_posts rows,
 *   not by hope. A product posted 5 days ago is not offered again; one
 *   posted 3 weeks ago is.
 *
 *   NOTHING THAT LEAVES THE BUILDING CARRIES A COST PRICE. The caption
 *   and the status image show SELL prices only -- the same rule the
 *   printed catalogue enforces, held by the same kind of test.
 *
 * Sitting-stock honesty: a key with stock but no dated movement makes NO
 * sitting claim -- unknown age is not old age. Price-drop honesty: the
 * registry replaces a supplier's row in place, so the drop is read from
 * dated purchase invoices, the only place history survives.
 *
 * Run: node test/whatsapp-picks.test.js   (or: npm test)
 */
/* Pinned to UTC-11 before any Date is constructed: 2026-08-06T00:00Z is
   still Wednesday the 5th in Pago Pago, so a weekday computed in LOCAL
   time comes out one day early. The correct implementation (getUTCDay)
   answers Thursday from anywhere on Earth. */
process.env.TZ = 'Pacific/Pago_Pago';

const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp picks');
const src = read('index.html');
const workerSrc = read('shared-worker.js');

const NAMES = ['waDaysBetween', 'waWeekday', 'waSalesByKey', 'waPriceTrail',
  'waStockIdle', 'waLastRestock', 'waAskersByProduct',
  'waPostCandidates', 'waDailyPicks', 'waCaption', 'waPostDeskStats'];

// The pricing chain (catalogueSellAtQty, catalogueBreaks, ranked rows) is
// already mutation-proven by the printed-catalogue suite; here it is
// stubbed with fixtures, and the stub RECORDS the basis it was asked for
// so "the picks quietly switched to wholesale" cannot pass.
const sellFixture = new Map();   // 'P1' or 'P1::0' -> {price, unit}
const costFixture = new Map();   // key -> purchase price
const breaksFixture = new Map(); // key -> [{qty, price}]
const basisAsked = [];
const env = {
  data: { products: [], presetCategories: [], savedQuotes: [], purchaseInvoices: [],
    stock: {}, stockLog: [], waPosts: [], followUps: [], sourcingLeads: [] },
  WA_ROTATION_DAYS: 14, WA_SITTING_DAYS: 30, WA_PICK_COUNT: 3,
  WA_JUSTIN_DAYS: 7, WA_DEPTH_DAYS: 5,
  WA_DAY_NAMES: ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'],
  catalogueSellAtQty: (p, idx, qty, basis) => {
    basisAsked.push(basis);
    const v = sellFixture.get(p.id + (idx==null ? '' : '::'+idx));
    return v ? { price: v.price, unit: v.unit || '', packQty: 0, packUnit: '' } : null;
  },
  catalogueBreaks: (p, idx) => breaksFixture.get(p.id + (idx==null ? '' : '::'+idx)) || [],
  rankedPurchaseRowsAtQty: (pid, idx, qty) => {
    const c = costFixture.get(pid + (idx==null ? '' : '::'+idx));
    return c == null ? [] : [{ purchasePrice: c, unit: '' }];
  },
  productVariantLabel: (p, idx) => idx==null ? p.name : `${p.name} — v${idx}`,
};
let scope = null; let err = null;
try {
  scope = compileScope([
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
    extractFunction(src, 'stockKey', 'index.html'),
    extractFunction(src, 'leadDistinctAskers', 'index.html'),
    extractFunction(src, 'sourcingPhoneKey', 'index.html'),
    extractFunction(workerSrc, 'resolveProductImage', 'shared-worker.js'),
  ], env, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the pick helpers compile${err ? ` (${err.message})` : ''}`);
if (!scope) { process.exit(1); }

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
/* A reason is typed evidence — {kind, text} — so the desk can wear it as
   a coloured chip. The helpers read the text; the kinds get their own checks. */
const has = (arr, rx, msg) => t.check(arr.some((r) => rx.test(r.text)), `${msg} (reasons: ${JSON.stringify(arr)})`);
const hasNot = (arr, rx, msg) => t.check(!arr.some((r) => rx.test(r.text)), `${msg} (reasons: ${JSON.stringify(arr)})`);
const kindOf = (arr, rx) => (arr.find((r) => rx.test(r.text)) || {}).kind;

// 2026-08-06 is a Thursday; 2026-08-03 a Monday.
const THU = '2026-08-06', MON = '2026-08-03';

/* ---------- 1. the clock ------------------------------------------- */
{
  eq(scope.waDaysBetween('2026-08-01', '2026-08-06'), 5, 'five days is five days');
  eq(scope.waWeekday(THU), 4, 'the 6th of August 2026 is a Thursday');
  eq(scope.waWeekday(MON), 1, 'and the 3rd a Monday');
}

/* ---------- 2. sitting stock: measured, or silent ------------------- */
{
  env.data.stock = { P1: 12, P2: 8, P3: 0 };
  env.data.stockLog = [
    { key: 'P1', delta: +20, date: '2026-05-01' },
    { key: 'P1', delta: -8, date: '2026-06-20' },   // last movement out
    { key: 'P2', delta: +8, date: '2026-07-30' },    // arrived last week
    { key: 'P3', delta: -5, date: '2026-05-01' },    // sold out long ago
  ];
  const idle = scope.waStockIdle('P1', THU);
  eq(idle.days, 47, 'sitting is counted from the last time anyone touched it');
  eq(idle.qty, 12, 'with the quantity that is actually sitting');
  /* P3 HAS old dated movement -- only the qty guard stands between an
     empty shelf and a "sitting 97 days" claim. */
  eq(scope.waStockIdle('P3', THU), null, 'no stock, no claim, however old the last movement');
  env.data.stock.P4 = 5;
  eq(scope.waStockIdle('P4', THU), null,
    'stock with no dated movement makes NO sitting claim — unknown age is not old age');
}

/* ---------- 3. what sells on this weekday --------------------------- */
{
  env.data.savedQuotes = [
    { invoiced: true, voided: false, date: MON, items: [{ productId: 'P1', variantIdx: null, qty: 4 }] },
    { invoiced: true, voided: false, date: '2026-07-27', items: [{ productId: 'P1', variantIdx: null, qty: 4 }] }, // also a Monday
    { invoiced: true, voided: false, date: THU, items: [{ productId: 'P1', variantIdx: null, qty: 2 }] },
    { invoiced: false, voided: false, date: MON, items: [{ productId: 'P1', variantIdx: null, qty: 90 }] }, // a draft is not a sale
    { invoiced: true, voided: true, date: MON, items: [{ productId: 'P1', variantIdx: null, qty: 90 }] },  // neither is a voided one
  ];
  const s = scope.waSalesByKey(THU).get('P1');
  eq(s.units, 10, 'only invoiced, unvoided orders count as sales');
  eq(s.byWeekday[1], 8, 'and the Monday units land on Monday');
  eq(s.units30, 10, 'the 30-day window carries the velocity the scorer runs on');
  env.data.savedQuotes.push(
    { invoiced: true, voided: false, date: '2026-06-01', items: [{ productId: 'P1', variantIdx: null, qty: 50 }] });
  const s2 = scope.waSalesByKey(THU).get('P1');
  eq(s2.units, 60, 'lifetime units still count everything');
  eq(s2.units30, 10, 'but a sale from June is not this month\'s pace');
  env.data.savedQuotes.pop();
}

/* ---------- 4. the price drop reads history, not the registry -------- */
{
  /* Deliberately loaded newest-first: "latest" must mean latest by DATE,
     not whatever order Postgres returned the rows in. */
  env.data.purchaseInvoices = [
    { voided: false, date: '2026-08-01', items: [{ productId: 'P1', variantIdx: null, price: 27000, qty: 10 }] },
    { voided: false, date: '2026-07-01', items: [{ productId: 'P1', variantIdx: null, price: 30000, qty: 10 }] },
    { voided: true,  date: '2026-08-01', items: [{ productId: 'P2', variantIdx: null, price: 5000, qty: 5 }] },
    { voided: false, date: '2026-07-01', items: [{ productId: 'P2', variantIdx: null, price: 10000, qty: 5 }] },
  ];
  const trail = scope.waPriceTrail();
  eq(trail.get('P1').last, 27000, 'the latest price paid is the latest by DATE');
  eq(trail.get('P1').prev, 30000, 'against the one before it');
  eq(trail.get('P2').prev, null, 'a voided invoice is not a price the shop paid');
}

/* ---------- 5. candidates, gaps, rotation --------------------------- */
{
  env.data.products = [
    { id: 'P1', name: 'Simba Cement', type: 'simple', category: 'Cement', image: 'u1' },
    { id: 'P2', name: 'Iron sheet', type: 'simple', category: 'Roofing', image: 'u2' },
    { id: 'P5', name: 'Faceless hinge', type: 'simple', category: 'Fittings', image: null },
    { id: 'P6', name: 'Priceless nail', type: 'simple', category: 'Fittings', image: 'u6' },
  ];
  env.data.presetCategories = [];
  sellFixture.set('P1', { price: 45000, unit: 'bag' });
  sellFixture.set('P2', { price: 52000, unit: 'sheet' });
  // Priceable on purpose: if the photo guard slips, nothing else stops it.
  sellFixture.set('P5', { price: 9000, unit: 'pc' });
  costFixture.set('P1', 34650);   // margin 23%
  costFixture.set('P2', 49400);   // margin 5% -- too thin to brag about
  // P2's price went UP (10,000 -> 10,100): a change is not a drop.
  env.data.purchaseInvoices.push(
    { voided: false, date: '2026-08-02', items: [{ productId: 'P2', variantIdx: null, price: 10100, qty: 5 }] });
  env.data.waPosts = [];

  const { candidates, gaps } = scope.waPostCandidates(THU, []);
  eq(candidates.length, 3, 'a candidate needs a retail price — a photo is NOT a gate any more');
  t.check(gaps.noPhoto.includes('Faceless hinge'), 'the missing photo is still NAMED for the photos-wanted rail');
  t.check(gaps.noPrice.includes('Priceless nail'), 'and so is the missing price');
  t.check(basisAsked.every((b) => b === 'retail'), 'every price the picker asks for is the RETAIL one');

  const p5 = candidates.find((c) => c.key === 'P5');
  t.check(!!p5 && p5.needsPhoto === true && p5.image === null,
    'the photo-less product IS a candidate, flagged so the board can say so');
  has(p5.reasons, /No photo yet — posts as a text card/, 'with the chip that says a post is still one tap away');
  eq(kindOf(p5.reasons, /No photo yet/), 'nophoto', 'typed nophoto');

  const p1 = candidates.find((c) => c.key === 'P1');
  has(p1.reasons, /12 bag.* sitting 47 days/, 'the sitting claim carries quantity and days');
  has(p1.reasons, /Margin 23%/, 'the margin claim is computed, for the shop’s eyes');
  has(p1.reasons, /Costs the shop less/, 'the price drop is noticed');
  has(p1.reasons, /Never been posted/, 'and a fresh product says so');
  hasNot(p1.reasons, /Thursdays/, 'no weekday claim on a day the item does not favour');
  /* The backbone: 10,350 margin × 10 sold this month = the money it earns. */
  has(p1.reasons, /Earns about UGX 103,500 profit a month/,
    'the earner claim multiplies margin by this month\'s pace');
  eq(kindOf(p1.reasons, /Earns about/), 'earner', 'typed earner');
  eq(p1.reasons[0].kind, 'earner', 'and it leads the chips — the backbone speaks first');

  /* each claim wears its kind, so the board can colour it */
  eq(kindOf(p1.reasons, /sitting/), 'sitting', 'the sitting claim is typed sitting');
  eq(kindOf(p1.reasons, /Margin/), 'margin', 'the margin claim is typed margin');
  eq(kindOf(p1.reasons, /Costs the shop less/), 'drop', 'the drop claim is typed drop');
  eq(kindOf(p1.reasons, /Never been posted/), 'fresh', 'the freshness claim is typed fresh');

  const p2 = candidates.find((c) => c.key === 'P2');
  hasNot(p2.reasons, /Margin/, 'a 5% margin is not worth bragging about');
  eq(p2.dropped, false, 'a price that went UP is not a drop');
  hasNot(p2.reasons, /Costs the shop less/, 'and earns no lower-price line');

  const mon = scope.waPostCandidates(MON, []).candidates.find((c) => c.key === 'P1');
  has(mon.reasons, /Sells on Mondays \(80% of its sales\)/, 'on Monday the weekday claim appears, with its share');
  eq(kindOf(mon.reasons, /Sells on/), 'weekday', 'and it is typed weekday');

  /* rotation */
  env.data.waPosts = [{ id: 1, date: '2026-08-01', productId: 'P1', variantIdx: null, name: 'x' }];
  const r1 = scope.waPostCandidates(THU, []);
  t.check(!r1.candidates.some((c) => c.key === 'P1'), 'posted 5 days ago: not offered again');
  eq(r1.excluded[0] && r1.excluded[0].daysAgo, 5, 'and the exclusion says how recently');
  env.data.waPosts = [{ id: 1, date: '2026-07-10', productId: 'P1', variantIdx: null, name: 'x' }];
  const r2 = scope.waPostCandidates(THU, []).candidates.find((c) => c.key === 'P1');
  t.check(!!r2, 'posted 27 days ago: back in the pool');
  hasNot(r2.reasons, /Never been posted/, 'but no longer claiming to be new');
  env.data.waPosts = [];
}

/* ---------- 6. picks: ranked, diverse, swappable --------------------- */
{
  /* Typed weakest-first: rank must come from the SCORES. */
  env.data.products = [
    { id: 'B1', name: 'Sheet', type: 'simple', category: 'Roofing', image: 'u' },
    { id: 'A3', name: 'Cement C', type: 'simple', category: 'Cement', image: 'u' },
    { id: 'A1', name: 'Cement A', type: 'simple', category: 'Cement', image: 'u' },
    { id: 'A2', name: 'Cement B', type: 'simple', category: 'Cement', image: 'u' },
  ];
  env.data.stock = {}; env.data.stockLog = []; env.data.savedQuotes = [];
  env.data.purchaseInvoices = []; env.data.waPosts = [];
  sellFixture.clear(); costFixture.clear();
  sellFixture.set('A1', { price: 100 }); costFixture.set('A1', 50);  // margin 50% -> score 5
  sellFixture.set('A2', { price: 100 }); costFixture.set('A2', 60);  // 40% -> 4
  sellFixture.set('A3', { price: 100 }); costFixture.set('A3', 70);  // 30% -> 3
  sellFixture.set('B1', { price: 100 }); costFixture.set('B1', 85);  // 15% -> 1.5

  const { picks, others } = scope.waDailyPicks(THU, []);
  eq(picks[0].key, 'A1', 'the strongest candidate leads');
  eq(picks[1].key, 'B1', 'slot two goes to a different shelf while one exists, even a weaker one');
  eq(picks[2].key, 'A2', 'then back to score order');
  eq(others[0].key, 'A3', 'what was not picked waits as the swap pool');

  const swapped = scope.waDailyPicks(THU, ['A1']);
  t.check(!swapped.picks.some((p) => p.key === 'A1'), '"pick something else" really excludes it');
}

/* ---------- 6b. the owner's case: lucrative beats photographed -------- */
/*
 * The complaint, verbatim: the photo-gated picker "leaves out the vast
 * majority of the more lucrative items". Here is that item — no photo,
 * strong margin, forty sold this month — against a photographed line
 * that neither sells nor earns. The money must win.
 */
{
  env.data.products = [
    { id: 'L1', name: 'Lucrative hinge', type: 'simple', category: 'Fittings', image: null },
    { id: 'L2', name: 'Photographed mat', type: 'simple', category: 'Mats', image: 'u' },
  ];
  env.data.stock = { L1: 100 }; env.data.stockLog = []; env.data.waPosts = [];
  env.data.purchaseInvoices = []; env.data.followUps = []; env.data.sourcingLeads = [];
  env.data.savedQuotes = [
    { invoiced: true, voided: false, date: '2026-08-01', items: [{ productId: 'L1', variantIdx: null, qty: 40 }] },
  ];
  sellFixture.clear(); costFixture.clear();
  sellFixture.set('L1', { price: 10000, unit: 'pc' }); costFixture.set('L1', 6000);
  sellFixture.set('L2', { price: 10000, unit: 'pc' }); costFixture.set('L2', 8500);
  const { candidates } = scope.waPostCandidates(THU, []);
  eq(candidates[0].key, 'L1', 'the photo-less lucrative line OUTRANKS the photographed slow one');
  t.check(candidates[0].needsPhoto === true, 'wearing its missing photo as information, not a sentence');
  has(candidates[0].reasons, /Earns about UGX 160,000 profit a month/, 'because the money says so, out loud');
}

/* ---------- 6c. depth: an ad for an empty shelf costs trust ----------- */
{
  env.data.products = [{ id: 'F1', name: 'Flying cement', type: 'simple', category: 'Cement', image: 'u' }];
  env.data.stock = { F1: 3 };
  env.data.savedQuotes = [
    { invoiced: true, voided: false, date: '2026-08-01', items: [{ productId: 'F1', variantIdx: null, qty: 60 }] },
  ];
  sellFixture.clear(); costFixture.clear();
  sellFixture.set('F1', { price: 45000, unit: 'bag' }); costFixture.set('F1', 30000);
  const { candidates, gaps } = scope.waPostCandidates(THU, []);
  t.check(!candidates.some((c) => c.key === 'F1'), 'three bags cannot cover a two-a-day pace — not advertised');
  t.check(gaps.lowStock.includes('Flying cement'), 'and the skip is NAMED: restock first');
  env.data.stock.F1 = 40;
  t.check(scope.waPostCandidates(THU, []).candidates.some((c) => c.key === 'F1'),
    'restocked deep enough, it is back');
  /* Zero stock with zero pace is a to-order line, not a gap: a sourcing
     graduate starts exactly there and still deserves its announcement. */
  env.data.stock = {}; env.data.savedQuotes = [];
  t.check(scope.waPostCandidates(THU, []).candidates.some((c) => c.key === 'F1'),
    'no stock and no pace is to-order, still announceable');
}

/* ---------- 6d. just in: new stock is news, for a week ---------------- */
{
  env.data.products = [{ id: 'J1', name: 'New arrival', type: 'simple', category: 'Tools', image: 'u' }];
  env.data.savedQuotes = []; env.data.stock = { J1: 50 };
  env.data.stockLog = [{ key: 'J1', type: 'restock', delta: 50, date: '2026-08-04' }];
  sellFixture.clear(); costFixture.clear();
  sellFixture.set('J1', { price: 5000, unit: 'pc' });
  const c = scope.waPostCandidates(THU, []).candidates.find((x) => x.key === 'J1');
  has(c.reasons, /Restocked 2 days ago — new stock is news/, 'a fresh restock is news, dated');
  eq(kindOf(c.reasons, /Restocked/), 'justin', 'typed justin');
  const scoreFresh = c.score;
  env.data.stockLog = [{ key: 'J1', type: 'restock', delta: 50, date: '2026-07-31' }];
  const older = scope.waPostCandidates(THU, []).candidates.find((x) => x.key === 'J1');
  t.check(older.score < scoreFresh, 'and the news decays by the day');
  env.data.stockLog = [{ key: 'J1', type: 'restock', delta: 50, date: '2026-07-20' }];
  const stale = scope.waPostCandidates(THU, []).candidates.find((x) => x.key === 'J1');
  hasNot(stale.reasons, /Restocked/, 'until it is not news at all');
  env.data.stockLog = [];
}

/* ---------- 6e. asked for: demand said out loud ----------------------- */
{
  env.data.products = [{ id: 'K1', name: 'Asked-for lock', type: 'simple', category: 'Locks', image: 'u' }];
  env.data.stock = { K1: 10 }; env.data.stockLog = []; env.data.savedQuotes = [];
  sellFixture.clear(); costFixture.clear();
  sellFixture.set('K1', { price: 20000, unit: 'pc' });
  env.data.followUps = [
    { id: 1, productId: 'K1', closedAt: null, customerId: 1 },
    { id: 2, productId: 'K1', closedAt: '2026-08-01', customerId: 2 },  // answered: not open demand
  ];
  env.data.sourcingLeads = [
    { id: 'SRC-1', productId: 'K1', voided: false, requests: [
      { customerName: 'A', phone: '0700' }, { customerName: 'B', phone: '0711' }] },
  ];
  const c = scope.waPostCandidates(THU, []).candidates.find((x) => x.key === 'K1');
  has(c.reasons, /3 customers asked for this/,
    'one open follow-up plus the lead\'s two distinct askers — a closed follow-up is answered, not demand');
  eq(kindOf(c.reasons, /asked for this/), 'asked', 'typed asked');
  env.data.followUps = []; env.data.sourcingLeads = [];
}

/* ---------- 6f. the mix rule: a fresh arrival makes the board --------- */
{
  env.data.products = [
    { id: 'S1', name: 'Star A', type: 'simple', category: 'C1', image: 'u' },
    { id: 'S2', name: 'Star B', type: 'simple', category: 'C2', image: 'u' },
    { id: 'S3', name: 'Star C', type: 'simple', category: 'C3', image: 'u' },
    { id: 'S4', name: 'Fresh box', type: 'simple', category: 'C4', image: 'u' },
  ];
  env.data.stock = { S4: 30 }; env.data.savedQuotes = []; env.data.waPosts = [];
  env.data.stockLog = [{ key: 'S4', type: 'restock', delta: 30, date: '2026-08-01' }];
  sellFixture.clear(); costFixture.clear();
  sellFixture.set('S1', { price: 100 }); costFixture.set('S1', 40);
  sellFixture.set('S2', { price: 100 }); costFixture.set('S2', 45);
  sellFixture.set('S3', { price: 100 }); costFixture.set('S3', 50);
  sellFixture.set('S4', { price: 100 });
  const { picks } = scope.waDailyPicks(THU, []);
  t.check(picks.some((p) => p.key === 'S4'),
    'a day with a fresh arrival SHOWS the fresh arrival — the mix rule swaps it in over a stronger plain pick');
  eq(picks[0].key, 'S1', 'without touching the top pick');
  t.check(!picks.some((p) => p.key === 'S3'), 'the weakest plain pick made the room');
  env.data.stockLog = [];
}

/* ---------- 7. what leaves the building ------------------------------ */
{
  const pick = { name: 'Simba Cement', price: 45000, unit: 'bag', dropped: true,
    breaks: [{ qty: 10, price: 43500 }], reasons: [{ kind: 'margin', text: 'Margin 23%' }] };
  const cap = scope.waCaption(pick, 'Omni Hardware', '0772 123 456');
  t.check(cap.includes('Simba Cement'), 'the caption names the product');
  t.check(cap.includes('UGX 45,000 per bag'), 'and the retail price');
  t.check(cap.includes('Buy 10+ at UGX 43,500'), 'and the volume break');
  t.check(cap.includes('New lower price'), 'a real drop earns its line');
  t.check(cap.includes('Omni Hardware · 0772 123 456'), 'and the shop signs it');
  /* The rule that cannot bend: cost and margin stay inside. */
  t.check(!cap.includes('34,650') && !/[Mm]argin/.test(cap), 'no cost, no margin, ever, in a caption');
  const noDrop = scope.waCaption({ ...pick, dropped: false }, 'S', '');
  t.check(!noDrop.includes('New lower price'), 'no drop, no claim');

  const draw = extractFunction(src, 'waDrawStatus', 'index.html');
  t.check(!/purchasePrice|margin|cost/i.test(draw),
    'the status image is drawn from sell prices only — no cost variable in reach');
}

/* ---------- 8. the desk head: status before recommendations ---------- */
{
  eq(scope.waPostDeskStats([], THU).postedTodayName, null, 'no posts: nothing claimed for today');
  eq(scope.waPostDeskStats([], THU).lastDaysAgo, null, 'never posted is null, not zero days ago');
  eq(scope.waPostDeskStats([], THU).last30, 0, 'and the month count is honestly zero');

  const posts = [
    { id: 1, date: '2026-08-01', name: 'Old pick' },
    { id: 2, date: THU, name: 'First today' },
    { id: 3, date: THU, name: 'Second today' },
    { id: 4, date: '2026-06-01', name: 'Ancient' },      // 66 days ago: outside the month
  ];
  const d = scope.waPostDeskStats(posts, THU);
  eq(d.postedTodayName, 'Second today', 'today is done, named by the LATEST post');
  eq(d.lastDaysAgo, 0, 'the last post was today');
  eq(d.last30, 3, 'the month counts 30 days back, no further');

  eq(scope.waPostDeskStats([{ id: 1, date: '2026-08-03', name: 'Mon' }], THU).lastDaysAgo, 3,
    'quiet since Monday reads as 3 days ago');

  /* worn by the render */
  t.check(/waPostDeskStats\(data\.waPosts, today\)/.test(src)
    && /id="wa_desk_head"/.test(src),
    'the desk head is derived at render, from the same rows as the rotation');
  t.check(/wa-desk-state \$\{desk\.postedTodayName \? 'done' : 'due'\}/.test(src),
    'and the status pill changes state with the fact');
}

/* ---------- 9. the board wears the evidence -------------------------- */
{
  t.check(/class="wa-pick\$\{i===0\?' lead':''\}"/.test(src),
    'the first pick leads the board, larger than its alternates');
  t.check(/\$\{i===0 \? "Today's pick" : 'Alternate ' \+ i\}/.test(src),
    'and every card names its rank in words');
  t.check(/class="wap-chip \$\{esc\(r\.kind\)\}"/.test(src)
    && /\$\{esc\(r\.text\)\}/.test(src),
    'each reason renders as a chip coloured by its kind');
  ['sitting', 'margin', 'drop', 'weekday', 'fresh', 'earner', 'justin', 'asked', 'fast', 'nophoto'].forEach((k) =>
    t.check(new RegExp(`\\.wap-chip\\.${k}\\{`).test(src), `the ${k} chip has its own colour`));
  t.check(/wap-thumb wap-noimg/.test(src) && /\.wap-thumb\.wap-noimg\{/.test(src),
    'a photo-less pick renders a lettered tile, not a broken image');
  t.check(/data-go="media"/.test(src) && /data-go="products"/.test(src)
    && /goToTab\(btn\.dataset\.go\)/.test(src),
    'the unlock rail walks straight to Media and Products');
  t.check(/still pickable, better with one/.test(src),
    'the photo rail says plainly that a photo is wanted, not required');
  t.check(/selling too fast to advertise — restock first/.test(src) && /data-go="inventory"/.test(src),
    'the depth skips are shown with the way to fix them');
  t.check(/resting after a recent post/.test(src) && /back in \$\{WA_ROTATION_DAYS - e\.daysAgo\}d/.test(src),
    'and the rotation bench is visible — what is resting, and when it returns');
  t.check(/class="btn btn-ghost wa-hist-del"/.test(src) && /class="wa-rec-sub"/.test(src),
    'the record list still lets a row be removed, and shows why it was picked');
}

/* ---------- 10. all of it is REACHED ---------------------------------- */
{
  t.check(/if\(tab==='whatsapp'\)\{ renderWhatsApp\(\); renderWaInsights\(\); waInboxEnter\(\); \}/.test(src), 'the tab renders on entry');
  /* One rail entry is enough now: the phone sheet is generated from the
     rail, so a screen listed once is reachable on both. Counting two
     copies was counting the duplicate that has since been removed. */
  t.check((src.match(/data-tab="whatsapp"/g) || []).length >= 1,
    'on the rail, which is what the phone sheet is built from');

  const posted = (/wp_posted'\)\.addEventListener\('click', \(\)=>\{[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/allocRowId\('waPost'\)/.test(posted) && /date: todayISO\(\)/.test(posted),
    '"Mark as posted" writes a dated row with a real id');
  t.check(/reason: p\.reasons\.map\(r=> r\.text\)\.join\(' · '\)/.test(posted),
    'and keeps the reasons it was picked for, for the history to show');
  t.check(/variantIdx: p\.variantIdx==null \? null : p\.variantIdx,/.test(posted),
    'a simple product posts as null, not as variant zero');

  const openFn = extractFunction(src, 'openWaPost', 'index.html');
  t.check(/waCaption\(pick, printedShopName\(\), data\.presetWaPhone \|\| ''\)/.test(openFn),
    'the modal caption comes from the guarded caption builder');
  t.check(/crossOrigin = 'anonymous'/.test(openFn),
    'the photo is loaded CORS-clean so the canvas can actually export');

  /* sync plumbing, the same six joints as media */
  t.check(/mediaFoldersR, waPostsR,\s*\n\s*rentAgreementsR/.test(src)
    && /sel\('media_folders'\), sel\('wa_posts'\),\s*\n\s*sel\('rent_agreements'\)/.test(src),
    'the load destructuring and the select list agree on where wa_posts sits');
  const lastSyncedFn = extractFunction(src, 'buildLastSynced', 'index.html');
  t.check(/waPosts: keyRowsById\(rows\.waPosts, 'id'\)/.test(lastSyncedFn),
    'lastSynced is seeded, so deleting a history record before the first save still deletes');
  t.check(/addDiffOps\(ops, 'waPosts', 'wa_posts', 'id', shopId, rows\.waPosts\);/.test(src),
    'and the collection is in the diff-sync');
  t.check(/'media','mediaFolders','waPosts','stock','stockLots','cashDays'\]\.filter\(k=> !data\[k\]\);/.test(src),
    'an absent waPosts collection is refused from the sync, not read as empty');
  t.check(/waPost:\s*\{kind:'row:wa_post',\s*counter:'nextWaPostId'\}/.test(src),
    'with an id kind named the way every other kind is');
}

process.exit(t.done() ? 1 : 0);
