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
  'waStockIdle', 'waLastRestock', 'waAskersByProduct', 'waCustomerPriceAt',
  'waPostCandidates', 'waDailyPicks', 'waCaption', 'waPostDeskStats',
  /* The picker is priced in shillings now, so what a post is expected
     to move comes in with it: the outcome of every recorded post, the
     table those outcomes are filed into, and the estimate read back
     out of it. */
  'waUnitsByKeyDate', 'waPostOutcomes', 'waLiftTable', 'waExpectedLift', 'waMedian',
  'waInboxAsksByKey', 'waChannelOrdersByKey', 'waBroadcastCase'];

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
    stock: {}, stockLog: [], waPosts: [], followUps: [], sourcingLeads: [],
    rivalPrices: [], presetWaNeverPost: [] },
  WA_ROTATION_DAYS: 14, WA_SITTING_DAYS: 30, WA_PICK_COUNT: 3,
  WA_JUSTIN_DAYS: 7, WA_DEPTH_DAYS: 5,
  WA_LIFT_DAYS: 7, WA_LIFT_MIN_POSTS: 10, WA_LIFT_MIN_KIND: 4,
  esc: (x) => String(x == null ? '' : x),
  WA_DAY_NAMES: ['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'],
  /* The demand record also carries what each line earned and where it
     came from, for the buying copilot. That arithmetic is proven
     against the REAL costing chain in purchase-plan.test.js; here it
     is stubbed like the rest of pricing, because these cases are about
     which orders count as demand, not what they were worth. */
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  invoiceLineCost: (it) => ({ cost: (Number(it.qty)||0) * (Number(it.price)||0), estimatedQty: 0 }),
  catalogueSellAtQty: (p, idx, qty, basis) => {
    basisAsked.push(basis);
    const v = sellFixture.get(p.id + (idx==null ? '' : '::'+idx));
    /* A fixture may price ONE side ({wholesale: {...}}) or, plainly,
       both the same ({price, unit}) — the shop's book has both kinds. */
    const side = v && (v.retail !== undefined || v.wholesale !== undefined) ? v[basis] : v;
    return side ? { price: side.price, unit: side.unit || '', packQty: 0, packUnit: '' } : null;
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
  /* Retail leads; wholesale is asked only where retail had no answer —
     this shop wholesales first and half the book has no retail rule. */
  t.check(basisAsked[0] === 'retail' && basisAsked.every((b) => b === 'retail' || b === 'wholesale'),
    'retail is asked first, wholesale only as the fallback');

  const p5 = candidates.find((c) => c.key === 'P5');
  t.check(!!p5 && p5.needsPhoto === true && p5.image === null,
    'the photo-less product IS a candidate, flagged so the board can say so');
  has(p5.reasons, /No photo yet — posts as a text card/, 'with the chip that says a post is still one tap away');
  eq(kindOf(p5.reasons, /No photo yet/), 'nophoto', 'typed nophoto');

  const p1 = candidates.find((c) => c.key === 'P1');
  has(p1.reasons, /12 bag.* sitting 47 days/, 'the sitting claim carries quantity and days');
  /* MARGIN AND EARNER ARE NOT CHIPS ANY MORE, and that is the whole
     rewrite in one line. Both used to be REASONS carrying scores --
     "Margin 23%" for +1.2, "Earns about UGX 103,500 a month" for up to
     +4 -- and both are now the quantity everything is ranked ON. A
     chip saying "Margin 23%" beside a figure that IS the margin is the
     screen telling the owner the same thing twice.

     The earner term went further than being promoted: margin x THIS
     MONTH'S PACE measured what a product already sells, which is the
     opposite of what a post is for. It is margin x the extra units a
     post is expected to move now. */
  eq(p1.marginUnit, 10350, 'the margin is a FIGURE on the candidate, not a chip beside it');
  t.check(!p1.reasons.some((r) => r.kind === 'margin' || r.kind === 'earner'),
    'and neither margin nor the old earner term survives as a reason');
  has(p1.reasons, /Costs the shop 10% less than last time/,
    'the price drop is noticed, and says how far it fell');
  has(p1.reasons, /Never been posted/, 'and a fresh product says so');
  hasNot(p1.reasons, /Thursdays/, 'no weekday claim on a day the item does not favour');

  /* each claim wears its kind, because the kind is what this shop's own
     posting record is filed under */
  eq(kindOf(p1.reasons, /sitting/), 'sitting', 'the sitting claim is typed sitting');
  eq(kindOf(p1.reasons, /Costs the shop/), 'drop', 'the drop claim is typed drop');
  eq(kindOf(p1.reasons, /Never been posted/), 'fresh', 'the freshness claim is typed fresh');

  const p2 = candidates.find((c) => c.key === 'P2');
  eq(p2.dropped, false, 'a price that went UP is not a drop');
  hasNot(p2.reasons, /Costs the shop less/, 'and earns no lower-price line');

  /* THE WEEKDAY CLAIM NEEDS A SAMPLE NOW, not a coincidence. It used to
     fire on five lifetime units and a 25% share -- and with seven
     weekdays, two Monday sales out of five cleared that bar and printed
     "Sells on Mondays" as though it were a pattern. Twelve units and a
     share well clear of an even split is a claim worth making out loud;
     this fixture's ten sit under the new floor and say nothing, which
     is the correct answer to a small sample. */
  const mon = scope.waPostCandidates(MON, []).candidates.find((c) => c.key === 'P1');
  hasNot(mon.reasons, /Sells on/, 'ten lifetime units is not enough to claim a weekday pattern');
  env.data.savedQuotes = env.data.savedQuotes.concat([
    { invoiced: true, voided: false, date: '2026-07-27', items: [{ productId: 'P1', variantIdx: null, qty: 6 }] },
  ]);
  const mon2 = scope.waPostCandidates(MON, []).candidates.find((c) => c.key === 'P1');
  has(mon2.reasons, /Sells on Mondays \(\d+% of its sales\)/,
    'past the floor it appears, with its share');
  eq(kindOf(mon2.reasons, /Sells on/), 'weekday', 'and it is typed weekday');
  env.data.savedQuotes = env.data.savedQuotes.slice(0, -1);

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

/* ---------- 5b. a wholesale-only product is postable ------------------- */
/*
 * The Half Bend law reaches the picker too: this shop wholesales first,
 * and a product with only a wholesale rule was landing in "no price"
 * and could never be advertised. Its price list is just the trade one.
 */
{
  env.data.products.push({ id: 'W1', name: 'Trade-only tube', type: 'simple', category: 'Plumbing', image: 'u9' });
  sellFixture.set('W1', { wholesale: { price: 30000, unit: 'Pc' } });
  const { candidates, gaps } = scope.waPostCandidates(THU, []);
  const w = candidates.find((c) => c.key === 'W1');
  t.check(!!w && w.price === 30000,
    'a wholesale-only product IS a candidate, carrying the wholesale sell price');
  t.check(!gaps.noPrice.includes('Trade-only tube') && gaps.noPrice.includes('Priceless nail'),
    'gaps.noPrice keeps only what NEITHER side can price');
  t.check(basisAsked.includes('wholesale'), 'reached through the wholesale fallback, not a lucky retail row');
  env.data.products = env.data.products.filter((p) => p.id !== 'W1');
  sellFixture.delete('W1');
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
  /* The money still wins; it is just no longer a sentence in a chip.
     With no posting record to learn from, the ranking is margin
     weighted by what has been asked for -- 4,000 a unit against 1,500
     -- and `cold` says which regime decided it, so no screen has to
     guess whether the figure beside a name is money or an estimate. */
  eq(candidates[0].marginUnit, 4000, 'because the margin says so');
  eq(candidates[0].cold, true, 'and with no posts behind it, it says it is ranking cold');
  eq(candidates[0].expectedProfit, null, 'offering no expected figure it cannot stand behind');
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

  /* THE DECAY IS GONE WITH THE SCORE IT SHADED. A restock five days
     old used to be worth fractionally less than one two days old --
     +3 x (1 - days/7) -- a curve nobody chose and nothing measured. A
     restock is now a KIND, and how much a post saying "just restocked"
     actually moves is read off this shop's own record instead of off a
     constant. What survives is the thing that was always true: after a
     week it is not news, and the claim stops. */
  env.data.stockLog = [{ key: 'J1', type: 'restock', delta: 50, date: '2026-07-31' }];
  const older = scope.waPostCandidates(THU, []).candidates.find((x) => x.key === 'J1');
  has(older.reasons, /Restocked 6 days ago/, 'six days on it is still news, and says how old');
  t.check(older.score === undefined,
    'and no candidate carries a score any more — the ranking is money, not points');
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

/* ---------- 6f. the guest slot, and why it went ----------------------
 *
 * WHAT THIS USED TO ASSERT: that a day with a fresh arrival always
 * SHOWED the fresh arrival -- the mix rule swapped the strongest
 * candidate wearing 'justin' or 'sitting' into the board over the
 * weakest plain pick, by KIND, overriding rank.
 *
 * It made sense for a grid of six cards, where variety was the point
 * and the owner chose among them. There is one post a day now, and the
 * shop has said what it is for: earning. A kind may inform the estimate
 * -- that is exactly what the lift table is -- but it may not override
 * the answer, or the ranking the screen shows is not the ranking it
 * used.
 *
 * What survives, and is asserted here instead: the ranking is the
 * ranking, and the swap pool still has taste about shelves so that
 * pressing "Pick another" twice does not offer three sizes of the same
 * clamp.
 */
{
  env.data.products = [
    { id: 'S1', name: 'Star A', type: 'simple', category: 'C1', image: 'u' },
    { id: 'S2', name: 'Star B', type: 'simple', category: 'C1', image: 'u' },
    { id: 'S3', name: 'Star C', type: 'simple', category: 'C2', image: 'u' },
    { id: 'S4', name: 'Fresh box', type: 'simple', category: 'C3', image: 'u' },
  ];
  env.data.stock = { S4: 30 }; env.data.savedQuotes = []; env.data.waPosts = [];
  env.data.stockLog = [{ key: 'S4', type: 'restock', delta: 30, date: '2026-08-01' }];
  sellFixture.clear(); costFixture.clear();
  sellFixture.set('S1', { price: 100 }); costFixture.set('S1', 40);
  sellFixture.set('S2', { price: 100 }); costFixture.set('S2', 45);
  sellFixture.set('S3', { price: 100 }); costFixture.set('S3', 50);
  sellFixture.set('S4', { price: 100 }); costFixture.set('S4', 90);
  const { picks, ranked } = scope.waDailyPicks(THU, []);
  eq(ranked[0].key, 'S1', 'the ranking leads with the best margin, restock or no restock');
  eq(ranked[3].key, 'S4', 'and the fresh arrival sits where its money puts it');
  t.check(!picks.some((p, i) => i === 0 && p.key === 'S4'),
    'no kind gets to jump the queue any more');
  /* The taste that survives: S1 and S2 share a shelf, so the second
     offer skips to another one rather than serving the same aisle. */
  eq(picks[0].key, 'S1', 'the swap pool still opens on the true lead');
  t.check(picks[1] && picks[1].category !== 'C1',
    'and its second offer comes off a different shelf');
  env.data.stockLog = [];
}

/* ---------- 6g. WHAT A POST DID: the loop that was missing ------------
 *
 * The picker was open-loop. waPosts was read for exactly two purposes
 * -- blocking a repeat for fourteen days and drawing the history list
 * -- so a shop could post for a year and the algorithm would know
 * nothing about what any of it achieved. Every weight was a constant
 * somebody chose.
 *
 * Lift is units sold in the seven days after a post against the seven
 * before, on invoiced orders. It is an ASSOCIATION on a small sample
 * with no control, which the screens say out loud; what it is not is
 * invented.
 */
{
  const quotes = [
    // P1 posted on the 10th: 2 sold in the week before, 9 in the week after
    { invoiced: true, voided: false, date: '2026-08-06', items: [{ productId: 'P1', qty: 2 }] },
    { invoiced: true, voided: false, date: '2026-08-10', items: [{ productId: 'P1', qty: 5 }] },  // the day itself
    { invoiced: true, voided: false, date: '2026-08-12', items: [{ productId: 'P1', qty: 9 }] },
    { invoiced: true, voided: false, date: '2026-08-25', items: [{ productId: 'P1', qty: 40 }] }, // outside both
    { invoiced: false, voided: false, date: '2026-08-12', items: [{ productId: 'P1', qty: 99 }] }, // a draft is not a sale
  ];
  const posts = [{ id: 1, date: '2026-08-10', productId: 'P1', variantIdx: null, name: 'x', kinds: ['asked'] }];
  const o = scope.waPostOutcomes(posts, quotes, '2026-08-30')[0];
  eq(o.before, 2, 'the week before is counted');
  eq(o.after, 9, 'the week after is counted');
  eq(o.lift, 7, 'and lift is the difference');
  /* The post's own day belongs to NEITHER window: a sale on the morning
     before the picture went up is not an effect of it, and a date
     cannot say which side of the post a sale fell on. */
  t.check(o.after !== 14 && o.before !== 7, 'the post day itself counts on neither side');

  /* A post younger than the window is not evidence yet. Counting it as
     a zero would quietly drag every median down as the shop posts. */
  const young = scope.waPostOutcomes(posts, quotes, '2026-08-13')[0];
  eq(young.ripe, false, 'a post with less than a week behind it is not ripe');
  eq(young.lift, undefined, 'and carries no lift at all, rather than a zero');

  /* the table */
  const many = [];
  for (let i = 0; i < 6; i++) many.push({ id: 10 + i, date: '2026-07-0' + (i + 1),
    productId: 'P1', variantIdx: null, name: 'x', kinds: ['asked', 'fresh'] });
  many.push({ id: 99, date: '2026-07-08', productId: 'P1', variantIdx: null, name: 'x' }); // pre-kinds row
  const table = scope.waLiftTable(scope.waPostOutcomes(many, [], '2026-08-30'));
  eq(table.ripe, 7, 'every post with a week behind it counts');
  eq(table.kindless, 1, 'and a row recorded before kinds were kept is NAMED, not dropped');
  eq(table.kinds.asked.n, 6, 'a kind carries how many posts it rests on');

  /* THE ESTIMATE. Null below the floor -- never a zero, never a guess. */
  eq(scope.waExpectedLift(['asked'], { ripe: 3, kinds: {}, pooled: 1 }), null,
    'under ten ripe posts there is no estimate at all');
  eq(scope.waExpectedLift(['asked'], { ripe: 20, kinds: { asked: { n: 2, lift: 9 } }, pooled: 1 }).pooled, true,
    'a kind with too few posts behind it does not get to speak; the pooled figure answers instead');
  /* The MEDIAN of the reasons a post carries, not the best of them: a
     post saying three things is not entitled to the strongest, and
     taking the maximum would make every estimate optimistic by
     construction. */
  const est = scope.waExpectedLift(['asked', 'fresh', 'sitting'], { ripe: 20, pooled: 1, kinds: {
    asked: { n: 6, lift: 9 }, fresh: { n: 8, lift: 1 }, sitting: { n: 5, lift: 5 } } });
  eq(est.lift, 5, 'three reasons of 9, 1 and 5 estimate 5 — the middle, not the best');
  eq(est.from.length, 3, 'and it says which reasons it used');
}

/* ---------- 6h. the shelf is the ceiling, and the shop has a veto ----- */
{
  env.data.products = [
    { id: 'C1', name: 'Deep shelf', type: 'simple', category: 'A', image: 'u' },
    { id: 'C2', name: 'Thin shelf', type: 'simple', category: 'B', image: 'u' },
  ];
  env.data.stock = { C1: 100, C2: 3 };
  env.data.savedQuotes = []; env.data.stockLog = []; env.data.waPosts = [];
  env.data.followUps = []; env.data.sourcingLeads = [];
  sellFixture.clear(); costFixture.clear();
  sellFixture.set('C1', { price: 1000, unit: 'pc' }); costFixture.set('C1', 500);
  sellFixture.set('C2', { price: 1000, unit: 'pc' }); costFixture.set('C2', 500);
  const table = { ripe: 20, pooled: 8, kinds: { fresh: { n: 12, lift: 8 } } };
  const { candidates } = scope.waPostCandidates(THU, [], { liftTable: table });
  const deep = candidates.find((c) => c.key === 'C1');
  const thin = candidates.find((c) => c.key === 'C2');
  eq(deep.expectedUnits, 8, 'a deep shelf carries the whole estimate');
  eq(deep.expectedProfit, 4000, 'and 500 a unit times eight units is the money');
  /* A post cannot sell what is not there, and an estimate that ignores
     the yard is arithmetic on a wish. */
  eq(thin.expectedUnits, 3, 'a thin shelf caps the estimate at what is actually on it');
  eq(thin.cappedBy, 3, 'and says so, so the screen can show the ceiling');
  eq(candidates[0].key, 'C1', 'so the deep shelf outranks the thin one on identical margins');

  /* The shop's own veto: a loss-leader, a line being run down, goods
     promised to one contract. None of these are in the books. */
  const barred = scope.waPostCandidates(THU, [], { liftTable: table, neverPost: ['C1'] });
  t.check(!barred.candidates.some((c) => c.key === 'C1'), 'a barred product is never offered');
  eq(barred.barred[0].name, 'Deep shelf', 'and it is NAMED, so the veto can be undone');

  /* The paid channel has to clear its own cost. This is the only place
     money leaves the shop, so it is arithmetic, not a recommendation. */
  eq(scope.waBroadcastCase(4000, 100, 10).worth, true, '4,000 expected against 1,000 to send: worth it');
  eq(scope.waBroadcastCase(400, 100, 10).worth, false, '400 against 1,000: not worth it');
  eq(scope.waBroadcastCase(null, 100, 10).worth, null,
    'and with no estimate there is no verdict — the cost is still named');
  eq(scope.waBroadcastCase(4000, 0, 10), null, 'no audience is no case at all');
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

  /* worn by the render.
     The desk head used to be a room of its own behind a tab: a kicker,
     the date at 19px/800, a status pill, a lead card at 42% width, a
     grid of alternates and three side panels. It answers ONE question
     -- has today's gone out, and what should it be -- so it is one
     304px rail panel now, and the machinery above it is untouched. */
  t.check(/waPostDeskStats\(data\.waPosts, today\)/.test(src)
    && /id="wa_post_pan"/.test(src),
    'the post panel is derived at render, from the same rows as the rotation');
  t.check(/\$\{desk\.postedTodayName \? 'sent' : 'not sent'\}/.test(src),
    'and its header states the fact rather than colouring a pill');
}

/* ---------- 9. the pick wears the evidence, and its arithmetic -------
   WHAT THIS SECTION USED TO ASSERT, twice over. First a two-column
   board: the lead rendered large with a rank in words, every reason
   worn as a chip in one of TEN colours. Then, after that board became
   a 304px rail panel, that the reasons still reached the owner as a
   sentence.

   Both are gone because the panel is a co-lead now and the reasons are
   no longer decoration on a recommendation -- they are the EVIDENCE
   under it, each one carrying where it was read from. A shop owner who
   cannot trace a claim about money has to take it on faith, and this
   screen does not ask for faith about money.
*/
{
  t.check(/waPostDeskStats\(data\.waPosts, today\)/.test(src) && /id="wa_post_pan"/.test(src),
    'the post panel is derived at render, from the same rows as the rotation');
  t.check(/\$\{desk\.postedTodayName \? 'sent' : 'not sent'\}/.test(src),
    'and its header states the fact rather than colouring a pill');

  /* Every reason, with its source. */
  t.check(/lead\.reasons\.map\(r=> `<div class="po-ev">/.test(src)
    && /WA_EVIDENCE_SOURCE\[r\.kind\]/.test(src),
    'each reason reaches the owner with where it was read from');
  const sources = (/const WA_EVIDENCE_SOURCE = \{[\s\S]*?\n\};/.exec(src) || [''])[0];
  ['asked', 'inbox', 'justin', 'drop', 'rival', 'catalogue', 'waseller', 'sitting', 'fast',
    'weekday', 'fresh', 'nophoto'].forEach((k) =>
    t.check(new RegExp(`\\b${k}:`).test(sources), `the ${k} claim can be traced to its record`));

  t.check(/\$\{others\.length \? '<button[^']*id="wa_swap"/.test(src),
    'the alternates are one press away');
  /* A missing photo is a FACT about the post, so the placeholder says
     "no photo" rather than spelling the first two letters of the name
     -- which produced "AD" for Adjustable Stands and read as an advert. */
  t.check(/title="No photo — it posts as a text card"/.test(src)
    && /<rect x="3" y="4" width="18" height="16" rx="2"\/>/.test(src),
    'a photo-less pick draws a picture mark, not a broken image and not its own initials');

  /* The gaps moved to the panel that already reports the catalogue
     count -- one fact, one place -- and kept the way to fix them. */
  t.check(/go: 'media'/.test(src) && /go: 'products'/.test(src) && /go: 'inventory'/.test(src)
    && /data-go="\$\{esc\(g\.go\)\}"/.test(src) && /goToTab\(btn\.dataset\.go\)/.test(src),
    'the gaps still walk straight to Media, Products and Inventory');
  t.check(/still pickable, better with one/.test(src),
    'the photo gap says plainly that a photo is wanted, not required');
  t.check(/selling too fast to advertise/.test(src),
    'the depth skips are shown with the way to fix them');
  t.check(/resting after a recent post/.test(src) && /back in \$\{WA_ROTATION_DAYS - e\.daysAgo\}d/.test(src),
    'and the rotation bench is still visible — what is resting, and when it returns');

  /* The record has to stay correctable: a post entered by mistake now
     skews every median it touches, which it never did before. */
  t.check(/class="wa-rl-x wa-hist-del"/.test(src)
    && /stops counting towards what posting has taught the shop/.test(src),
    'a record can still be removed, and the warning says what removing it costs');
  t.check(/\.po-n\{[^}]*text-overflow:ellipsis/.test(src)
    && /class="po-n" title="\$\{esc\(lead\.name\)\}"/.test(src),
    'and a name too long for the column is cut with a mark, not clipped mid-word');
}

/* ---------- 10. all of it is REACHED ---------------------------------- */
{
  /* waInboxEnter draws every panel once it knows whether the number is
     linked. Drawing the rail before that answer arrives showed a shop
     its daily post above a desk it had not connected. */
  t.check(/if\(tab==='whatsapp'\)\{ waInboxEnter\(\); \}/.test(src), 'the tab renders on entry')
  t.check(/waRenderInbox\(\);\n  renderWaInsights\(\);\n  waRenderHeadline\(\);\n  renderWhatsApp\(\);\n  waRenderChannel\(\);\n  waRenderBroadcasts\(\);/.test(src),
    'and entry draws the queue, the strip, the headline and all three rail panels');
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
