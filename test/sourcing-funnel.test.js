#!/usr/bin/env node
'use strict';
/*
 * The sourcing funnel: an item a client asked for that the shop does not
 * sell, followed until it does.
 *
 * Three things here are worth more than the rest, and each is a place a
 * plausible simplification would quietly destroy something:
 *
 *   asks vs askers   The number the shop opens this page to read is how
 *                    many DIFFERENT people have asked. Five asks from one
 *                    customer is not the signal five customers are, and
 *                    collapsing the ledger to a counter loses the
 *                    difference permanently. Pinned in both directions.
 *
 *   the gates        A funnel whose stage names are aspirations is one
 *                    nobody trusts by month two. "Priced" must be
 *                    unreachable with no price on file, "Listed" must be
 *                    unreachable except through graduation -- and a
 *                    refused move must leave the lead WHERE IT WAS, not
 *                    merely return false.
 *
 *   the two saves    saveData() fires every op at once through
 *                    Promise.all, and prices carries a real foreign key
 *                    to products. Graduation therefore saves twice, and
 *                    only pushes the price row once lastSynced says the
 *                    product actually reached the server. A single-save
 *                    graduation races the key; a gate-free second phase
 *                    sends a price for a product that is not there.
 *
 * Run: node test/sourcing-funnel.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('sourcing funnel');
const src = read('index.html');
const eq = (a, b, m) => t.check(a === b, `${m} (${JSON.stringify(a)})`);

// ---- the shared scope -------------------------------------------------
// `data` and `lastSynced` are bound live, so the compiled code mutates the
// very objects these checks read afterwards.
const data = {};
const lastSynced = {};
const calls = { saves: 0, toasts: [], badges: [], renders: 0, opened: [] };
let saveLands = true;             // does the stubbed save reach "the server"
let nextRowId = 900;

function resetAll(leads) {
  data.sourcingLeads = leads || [];
  data.staff = [{ id: 'ST001', name: 'Musa' }];
  data.suppliers = [];
  data.products = [];
  data.prices = [];
  data.customers = [];
  data.presetCategories = [];
  data.presetSourcingStageLimits = {};
  data.idCounters = {};
  lastSynced.products = {};
  lastSynced.suppliers = {};
  calls.saves = 0; calls.toasts = []; calls.badges = []; calls.renders = 0; calls.opened = [];
  calls.snapshots = [];
  saveLands = true;
  nextRowId = 900;
}

const env = {
  data,
  lastSynced,
  // Records what the collection looked like AT each save, which is how the
  // "the price row was not in the first save" check can tell a two-phase
  // graduation from a one-phase one.
  saveData: () => {
    calls.saves++;
    calls.snapshots = calls.snapshots || [];
    calls.snapshots.push({ products: data.products.length, prices: data.prices.length });
    if (saveLands) {
      data.products.forEach((p) => { lastSynced.products[String(p.id)] = p; });
      data.suppliers.forEach((s) => { lastSynced.suppliers[String(s.id)] = s; });
    }
    return Promise.resolve();
  },
  toast: (m) => calls.toasts.push(String(m)),
  setNavBadge: (id, n) => calls.badges.push({ id, n }),
  renderSourcing: () => { calls.renders++; },
  openSourcingLead: (id) => calls.opened.push(id),
  triggerProductsRender: () => {},
  triggerPricesRender: () => {},
  renderPresets: () => {},
  allocRowId: () => nextRowId++,
  esc: (s) => String(s),
  fmtUGX: (n) => String(n),
  document: { getElementById: () => null },
  // No server here, so issueEntityId takes its documented offline fallback
  // -- the local monotonic counter, which is the path that has to be right
  // anyway when the shop is on a bad connection.
  sb: { rpc: () => Promise.resolve({ data: null, error: { message: 'offline' } }) },
  currentShopId: 'shop-test',
  console: { warn: () => {}, error: () => {} },
};

const sources = [
  extractDeclaration(src, 'SOURCING_STATUSES', 'index.html'),
  extractDeclaration(src, 'SOURCING_STATUS_ORDER', 'index.html'),
  extractDeclaration(src, 'SOURCING_SHORT_LABELS', 'index.html'),
  extractDeclaration(src, 'SOURCING_FACT_ORDER', 'index.html'),
  extractDeclaration(src, 'SOURCING_GATES', 'index.html'),
  // The real ones, not stand-ins: a graduation that derived the flat
  // wholesale/retail fields differently from the price form would be
  // exactly the bug this file exists to refuse.
  extractFunction(src, 'searchTokens', 'index.html'),
  extractFunction(src, 'todayISO', 'index.html'),
  extractFunction(src, 'nextEntityId', 'index.html'),
  extractFunction(src, 'issueEntityId', 'index.html'),
  extractFunction(src, 'ensurePresetCategory', 'index.html'),
  extractFunction(src, 'deriveWholesaleRetail', 'index.html'),
  extractFunction(src, 'supplierName', 'index.html'),
  extractFunction(src, 'sourcingLeadsAll', 'index.html'),
  extractFunction(src, 'sourcingLeadById', 'index.html'),
  extractFunction(src, 'sourcingPhoneKey', 'index.html'),
  extractFunction(src, 'leadDistinctAskers', 'index.html'),
  extractFunction(src, 'leadAskCount', 'index.html'),
  extractFunction(src, 'leadCandidateNames', 'index.html'),
  extractFunction(src, 'candidateTiers', 'index.html'),
  extractFunction(src, 'candidateHasPrice', 'index.html'),
  extractFunction(src, 'candidateUnitPriceAt', 'index.html'),
  extractFunction(src, 'candidateLowestRung', 'index.html'),
  extractFunction(src, 'leadDemandQty', 'index.html'),
  extractFunction(src, 'sourcingRankedAt', 'index.html'),
  extractFunction(src, 'sourcingBestAt', 'index.html'),
  extractFunction(src, 'sourcingDefaultGraduateCandidate', 'index.html'),
  extractFunction(src, 'leadFacts', 'index.html'),
  extractFunction(src, 'leadIsStalled', 'index.html'),
  extractFunction(src, 'leadNeedsSomebody', 'index.html'),
  extractFunction(src, 'findSourcingLeadByText', 'index.html'),
  extractFunction(src, 'captureSourcingLead', 'index.html'),
  extractFunction(src, 'sourcingGateBlock', 'index.html'),
  extractFunction(src, 'setSourcingStatus', 'index.html'),
  extractFunction(src, 'stepSourcingStatus', 'index.html'),
  extractFunction(src, 'dropSourcingLead', 'index.html'),
  extractFunction(src, 'undropSourcingLead', 'index.html'),
  extractFunction(src, 'graduateSourcingLead', 'index.html'),
  extractFunction(src, 'sourcingBoardLeads', 'index.html'),
  extractFunction(src, 'renderSourcingBadge', 'index.html'),
];
const S = compileScope(sources, env, [
  'sourcingPhoneKey', 'leadDistinctAskers', 'leadAskCount', 'leadFacts',
  'leadIsStalled', 'leadNeedsSomebody', 'findSourcingLeadByText',
  'captureSourcingLead', 'sourcingGateBlock', 'setSourcingStatus',
  'stepSourcingStatus', 'dropSourcingLead', 'undropSourcingLead',
  'graduateSourcingLead', 'sourcingBoardLeads', 'renderSourcingBadge',
  'deriveWholesaleRetail', 'sourcingLeadById',
  'candidateTiers', 'candidateHasPrice', 'candidateUnitPriceAt', 'candidateLowestRung',
  'leadDemandQty', 'sourcingRankedAt', 'sourcingBestAt', 'sourcingDefaultGraduateCandidate',
]);

const lead = (over) => Object.assign({
  id: 'SRC-1', name: 'sofa legs 4 inch chrome', notes: '', status: 'asked',
  voided: false, droppedReason: '', droppedAt: null, assignedStaffId: null,
  createdAt: '2026-08-01T00:00:00.000Z', stageEnteredAt: Date.now(),
  productId: null, graduatedAt: null, requests: [], candidates: [],
}, over || {});
const ask = (over) => Object.assign({
  at: '2026-08-01T00:00:00.000Z', source: 'sourcing', customerId: null,
  customerName: '', phone: '', qty: null, orderId: null, conversationId: null, note: '',
}, over || {});
const cand = (over) => Object.assign({
  id: 'C1', role: 'supplier', supplierId: null, supplierName: 'Shafik', phone: '',
  where: '', tiers: [], unit: 'Pc', packQty: 0, packUnit: '',
  leadTimeDays: null, note: '', at: '2026-08-01T00:00:00.000Z',
}, over || {});
const rungs = (...pairs) => pairs.map(([minQty, price]) => ({ minQty, price }));

// graduateSourcingLead is async (it awaits the first save before it will
// push the price row), and this file is CommonJS -- so the whole run sits
// inside one async main rather than reaching for top-level await.
async function main() {

/* ---------- 1. how many people asked, not how many times ------------- */
{
  resetAll();
  eq(S.sourcingPhoneKey('+256 701 234 567'), '256701234567', 'a written-out number normalises');
  eq(S.sourcingPhoneKey('0701234567'), '256701234567', 'and so does the local form of the same one');
  eq(S.sourcingPhoneKey('701234567'), '256701234567', 'and the bare nine digits');
  eq(S.sourcingPhoneKey(''), '', 'no number is no key');

  const many = lead({ requests: [
    ask({ customerId: 'C001' }), ask({ customerId: 'C001' }), ask({ customerId: 'C001' }),
    ask({ customerId: 'C001' }), ask({ customerId: 'C001' }),
  ] });
  eq(S.leadAskCount(many), 5, 'five asks are five asks');
  eq(S.leadDistinctAskers(many), 1, 'but one customer is one person, however often they ask');

  const three = lead({ requests: [
    ask({ customerId: 'C001' }),
    ask({ phone: '0782 000 111' }),
    ask({ customerName: 'Walk-in Julius' }),
  ] });
  eq(S.leadDistinctAskers(three), 3, 'a customer, a bare phone and a bare name are three people');

  const sameNumber = lead({ requests: [
    ask({ phone: '+256701234567' }), ask({ phone: '0701234567' }),
  ] });
  eq(S.leadDistinctAskers(sameNumber), 1,
    'the same number written two ways is one person, not two');

  /* An ask carrying no identity at all counts as its own person: nothing
     says it was the same one, and folding them together would UNDER-report
     the only demand the shop can see. */
  const anon = lead({ requests: [ask({}), ask({}), ask({})] });
  eq(S.leadDistinctAskers(anon), 3, 'three unattributed asks are three people, not nobody');
  eq(S.leadDistinctAskers(lead()), 0, 'and a lead nobody has asked for is zero');
}

/* ---------- 2. one lead per item, not one per ask -------------------- */
{
  resetAll();
  const a = S.captureSourcingLead({ name: '4 inch sofa legs, chrome', customerId: 'C001' });
  t.check(a && a.isNew, 'the first ask mints a lead');
  const b = S.captureSourcingLead({ name: 'sofa legs 4in chrome', customerId: 'C002' });
  t.check(b && !b.isNew, 'the same item worded differently finds the lead already open');
  eq(data.sourcingLeads.length, 1, 'so there is ONE lead, not two');
  eq(b.lead.requests.length, 2, 'and the second ask is appended to its ledger');
  eq(S.leadDistinctAskers(b.lead), 2, 'which is what makes it two people asking');

  const c = S.captureSourcingLead({ name: 'roofing nails 4 inch', customerId: 'C003' });
  t.check(c && c.isNew, 'a genuinely different item is its own lead');
  eq(data.sourcingLeads.length, 2, 'and does not get folded into the first');

  eq(S.captureSourcingLead({ name: '   ' }), null, 'a blank item captures nothing');

  /* Matching a DROPPED lead has to find it. Minting a fresh one would
     throw away both the reason it was dropped and everything already
     researched -- and treat the fourth person to ask as the first. */
  resetAll([lead({ id: 'SRC-D', name: 'brass hinges 3 inch', voided: true,
    droppedReason: 'only importer wants 40 cartons', requests: [ask({ customerId: 'C001' })] })]);
  const d = S.captureSourcingLead({ name: '3 inch brass hinges', customerId: 'C009' });
  t.check(d && !d.isNew && d.wasDropped, 'a dropped lead is found again, and says so');
  eq(data.sourcingLeads.length, 1, 'rather than a second card for the same item');
  eq(data.sourcingLeads[0].droppedReason, 'only importer wants 40 cartons',
    'and the reason it was dropped survives the new ask');
}

/* ---------- 3. the four facts ---------------------------------------- */
{
  resetAll();
  const bare = lead();
  const f0 = S.leadFacts(bare);
  t.check(!f0.importer && !f0.supplier && !f0.price && !f0.packing,
    'a lead nobody has researched knows nothing');

  eq(S.leadFacts(lead({ candidates: [cand({ role: 'supplier' })] })).importer, false,
    'a supplier is not an importer');
  eq(S.leadFacts(lead({ candidates: [cand({ role: 'importer' })] })).supplier, false,
    'and an importer is not a supplier -- they are separate facts about separate people');
  const both = S.leadFacts(lead({ candidates: [cand({ role: 'both' })] }));
  t.check(both.importer && both.supplier, 'somebody who is both counts for both');

  eq(S.leadFacts(lead({ candidates: [cand({ role: '', supplierName: 'Shafik' })] })).supplier, true,
    'a candidate with no role recorded reads as a supplier');
  eq(S.leadFacts(lead({ candidates: [cand({ supplierName: '   ', supplierId: null })] })).supplier, false,
    'but a nameless candidate names nobody');

  eq(S.leadFacts(lead({ candidates: [cand({ tiers: [] })] })).price, false,
    'no ladder is no price');
  eq(S.leadFacts(lead({ candidates: [cand({ tiers: rungs([1, 0]) })] })).price, false,
    'and a rung of zero is not a price — an empty ladder cannot tell that rule from its absence');
  eq(S.candidateHasPrice(cand({ tiers: rungs([12, 0], [1, 0]) })), false,
    'however many rungs of nothing there are');
  eq(S.leadFacts(lead({ candidates: [cand({ tiers: rungs([1,12000]) })] })).price, true, 'a figure is');
  eq(S.leadFacts(lead({ candidates: [cand({ packQty: 12, packUnit: '' })] })).packing, false,
    'a pack size with nothing to call it is not packing');
  eq(S.leadFacts(lead({ candidates: [cand({ packQty: 12, packUnit: 'Ctn' })] })).packing, true,
    'twelve to a carton is');
}

/* ---------- 3b. volume pricing: the answer depends on the quantity --- */
{
  resetAll();
  // Legacy candidates read as a one-rung ladder rather than being rewritten.
  eq(JSON.stringify(S.candidateTiers({ quotedPrice: 12000, moq: 6 })),
    JSON.stringify([{ minQty: 6, price: 12000 }]),
    'a candidate recorded before ladders existed still reads as a ladder');
  eq(S.candidateTiers({ quotedPrice: 0 }).length, 0, 'and one with no figure has no rungs');
  eq(S.candidateTiers({ tiers: rungs([12, 13500], [1, 15000]) })[0].minQty, 1,
    'rungs come back sorted, whatever order they were typed in');
  eq(S.candidateTiers({ tiers: rungs([1, 0], [12, 13500]) }).length, 1,
    'a rung with no price is not a rung');

  const ladder = cand({ tiers: rungs([1, 15000], [12, 13500], [60, 12000]) });
  eq(S.candidateUnitPriceAt(ladder, 1), 15000, 'one piece pays the by-the-piece rate');
  eq(S.candidateUnitPriceAt(ladder, 11), 15000, 'and so does eleven — a break is a break');
  eq(S.candidateUnitPriceAt(ladder, 12), 13500, 'twelve clears the carton rung');
  eq(S.candidateUnitPriceAt(ladder, 59), 13500, 'fifty-nine still sits on it');
  eq(S.candidateUnitPriceAt(ladder, 60), 12000, 'sixty clears the next');
  eq(S.candidateUnitPriceAt(ladder, 5000), 12000, 'and nothing above the top rung goes cheaper');

  /* Below the lowest rung there is NO price. A supplier who starts at a
     carton has not quoted for one piece, and inventing that figure is
     how a quote goes out under cost. */
  eq(S.candidateUnitPriceAt(cand({ tiers: rungs([12, 13500]) }), 5), null,
    'a supplier who starts at a carton has not quoted for five pieces');

  /* The whole point: who is cheapest CHANGES with the quantity. Meggo is
     dearer by the piece and cheaper by the carton, so ranking on the
     qty-1 rate would send a carton order to the wrong shop. */
  const l = lead({ candidates: [
    cand({ id: 'A', supplierName: 'Shafik', tiers: rungs([1, 15000], [12, 14800]) }),
    cand({ id: 'B', supplierName: 'Meggo', tiers: rungs([1, 16000], [12, 12000]) }),
  ] });
  eq(S.sourcingBestAt(l, 1).candidate.supplierName, 'Shafik', 'by the piece, Shafik wins');
  eq(S.sourcingBestAt(l, 12).candidate.supplierName, 'Meggo',
    'by the carton it is Meggo — which a single quoted figure per supplier could never have shown');
  eq(S.sourcingBestAt(l, 12).savesPerUnit, 2800, 'and the gap is the figure that says whether it is worth the trip');
  eq(S.sourcingBestAt(l, 12).total, 144000, 'costed at the quantity actually being bought');

  eq(S.sourcingRankedAt(l, 12).length, 2, 'both are ranked when both have quoted');
  const partial = lead({ candidates: [
    cand({ id: 'A', supplierName: 'Shafik', tiers: rungs([1, 15000]) }),
    cand({ id: 'B', supplierName: 'Bulk only', tiers: rungs([100, 9000]) }),
  ] });
  eq(S.sourcingRankedAt(partial, 10).length, 1,
    'somebody who only sells by the hundred is left out of a ten-piece comparison — not quoted is not the same as expensive');
  eq(S.sourcingRankedAt(partial, 100)[0].candidate.supplierName, 'Bulk only',
    'and wins it at a hundred');
  eq(S.sourcingBestAt(lead({ candidates: [] }), 10), null, 'nobody quoted, no answer');

  /* A tie with a THIRD, dearer supplier behind it. Two cheapest at the
     same price and one above them: choosing either of the two saves
     nothing, and measuring the saving against the next DIFFERENT price
     would announce one — a reason to prefer a supplier when the price
     gives none. Two candidates alone cannot tell the two rules apart. */
  const tie = lead({ candidates: [
    cand({ id: 'A', supplierName: 'One', tiers: rungs([1, 15000]) }),
    cand({ id: 'B', supplierName: 'Two', tiers: rungs([1, 15000]) }),
    cand({ id: 'C', supplierName: 'Three', tiers: rungs([1, 16000]) }),
  ] });
  t.check(S.sourcingBestAt(tie, 1).tied, 'a genuine tie is reported as one rather than settled by list order');
  eq(S.sourcingBestAt(tie, 1).savesPerUnit, 0,
    'and saves NOTHING, because an identical alternative is sitting beside it');
  eq(S.sourcingBestAt(tie, 1).runnerUp.supplierName, 'Two', 'the runner-up is the next one down the ranking');
  // With no tie, the saving is real and is the gap to the next one down.
  const clear = lead({ candidates: [
    cand({ id: 'A', supplierName: 'One', tiers: rungs([1, 15000]) }),
    cand({ id: 'B', supplierName: 'Two', tiers: rungs([1, 16000]) }),
    cand({ id: 'C', supplierName: 'Three', tiers: rungs([1, 20000]) }),
  ] });
  eq(S.sourcingBestAt(clear, 1).savesPerUnit, 1000,
    'a real gap is measured against the next one down, not the dearest on the list');
  t.check(!S.sourcingBestAt(clear, 1).tied, 'and nothing is called a tie that is not one');

  /* The graduation form arrives pre-picked on the same answer this screen
     gives, or the two recommend different suppliers. Pre-picking on the
     by-the-piece rate is how a carton order goes to the wrong shop. */
  const volume = lead({
    requests: [ask({ qty: 12 })],
    candidates: [
      cand({ id: 'A', supplierName: 'Shafik', tiers: rungs([1, 15000], [12, 14800]) }),
      cand({ id: 'B', supplierName: 'Meggo', tiers: rungs([1, 16000], [12, 12000]) }),
    ] });
  eq(S.sourcingDefaultGraduateCandidate(volume).supplierName, 'Meggo',
    'graduation pre-picks whoever is cheapest at the quantity asked for, not by the piece');
  eq(S.sourcingDefaultGraduateCandidate(volume).id, S.sourcingBestAt(volume, 12).candidate.id,
    'which is the same supplier the research screen names — one rule, both screens');
  const noDemand = lead({ candidates: volume.candidates });
  eq(S.sourcingDefaultGraduateCandidate(noDemand).supplierName, 'Shafik',
    'with nobody having named a quantity it falls back to one, and Shafik is cheapest there');
  eq(S.sourcingDefaultGraduateCandidate(lead()), null, 'and with nobody priced there is nothing to pick');

  /* The quantity the comparison runs at is the shop's own: the demand
     ledger already records what each person asked for. */
  eq(S.leadDemandQty(lead({ requests: [ask({ qty: 20 }), ask({ qty: 5 }), ask({ qty: null })] })), 25,
    'demand is what the people who asked said they wanted, ignoring the ones who did not say');
  eq(S.leadDemandQty(lead()), 0, 'and nobody asking for a number is no number');
}

/* ---------- 4. needs chasing: one rule, read three ways -------------- */
{
  resetAll();
  const now = Date.parse('2026-08-13T00:00:00.000Z');
  data.presetSourcingStageLimits = { looking: 7 };
  const fresh = lead({ status: 'looking', stageEnteredAt: now - 3 * 86400000 });
  const old = lead({ status: 'looking', stageEnteredAt: now - 9 * 86400000 });
  t.check(!S.leadIsStalled(fresh, now), 'three days into a seven-day limit is not stalled');
  t.check(S.leadIsStalled(old, now), 'nine days is');
  data.presetSourcingStageLimits = {};
  t.check(!S.leadIsStalled(old, now), 'and with no limit set, nothing is ever flagged');

  t.check(S.leadNeedsSomebody(lead({ status: 'looking' })),
    'a lead being LOOKED INTO by nobody is the thing this board exists to expose');
  t.check(!S.leadNeedsSomebody(lead({ status: 'asked' })),
    'but an item nobody has started on is not missing a person -- it is waiting to be started');
  t.check(!S.leadNeedsSomebody(lead({ status: 'looking', assignedStaffId: 'ST001' })),
    'somebody on it is somebody on it');
  t.check(S.leadNeedsSomebody(lead({ status: 'looking', assignedStaffId: 'ST999' })),
    'and somebody who has left the shop is nobody');
}

/* ---------- 5. the gates, run in both directions --------------------- */
{
  resetAll([lead({ status: 'looking' })]);
  t.check(!!S.sourcingGateBlock(data.sourcingLeads[0], 'sourced'),
    'nothing found yet means the lead cannot be called sourced');
  eq(S.setSourcingStatus('SRC-1', 'sourced'), false, 'so the move is refused');
  eq(data.sourcingLeads[0].status, 'looking',
    'AND the lead stays where it was — a refusal that still moved it would be worse than none');
  t.check(calls.opened.includes('SRC-1'),
    'the refusal opens the lead, so there is a route forward rather than a dead end');

  data.sourcingLeads[0].candidates = [cand({ role: 'importer', supplierName: 'Meggo' })];
  eq(S.setSourcingStatus('SRC-1', 'sourced'), true, 'an importer alone is enough to be sourced');
  eq(data.sourcingLeads[0].status, 'sourced', 'and the lead moves');

  eq(S.setSourcingStatus('SRC-1', 'priced'), false, 'with no figure on file it cannot be priced');
  eq(data.sourcingLeads[0].status, 'sourced', 'and again it does not move');
  data.sourcingLeads[0].candidates.push(cand({ id: 'C2', tiers: rungs([1,15000]) }));
  eq(S.setSourcingStatus('SRC-1', 'priced'), true, 'a quoted figure opens it');

  /* `listed` is stamped by graduation and NOWHERE else. A lead sitting in
     Listed with no product would be this board's biggest lie. */
  eq(S.setSourcingStatus('SRC-1', 'listed'), false, 'the arrow can never reach Listed');
  eq(S.stepSourcingStatus('SRC-1', 1), false, 'stepping forward from Priced does not either');
  eq(data.sourcingLeads[0].status, 'priced', 'so it stays priced');

  // Backward is always open: stepping back is CORRECTING a claim, and a
  // gate on the retreat traps a wrongly-advanced card there forever.
  resetAll();
  ['looking', 'sourced', 'priced', 'listed'].forEach((from, i) => {
    const backTo = ['asked', 'looking', 'sourced', 'priced'][i];
    data.sourcingLeads = [lead({ status: from })];
    eq(S.setSourcingStatus('SRC-1', backTo), true, `${from} can always step back to ${backTo}`);
  });

  // Leaving Listed un-claims the product but never destroys it.
  resetAll([lead({ status: 'listed', productId: 'P042', graduatedAt: 'x' })]);
  data.products = [{ id: 'P042', name: 'Sofa legs' }];
  S.setSourcingStatus('SRC-1', 'priced');
  eq(data.sourcingLeads[0].productId, null, 'stepping out of Listed un-claims the product');
  eq(data.products.length, 1, 'but the product itself is untouched — a mis-click must not delete a catalogue row');

  // stageEnteredAt is what "12d here" reads, so it must mean what it says.
  resetAll([lead({ status: 'looking', stageEnteredAt: 111 })]);
  S.setSourcingStatus('SRC-1', 'looking');
  eq(data.sourcingLeads[0].stageEnteredAt, 111, 're-applying the same status does not restart the clock');
  S.setSourcingStatus('SRC-1', 'asked');
  t.check(data.sourcingLeads[0].stageEnteredAt !== 111, 'a real move does');
}

/* ---------- 6. dropping keeps everything ----------------------------- */
{
  resetAll([lead({ status: 'looking', candidates: [cand()], requests: [ask({ customerId: 'C1' })] })]);
  eq(S.dropSourcingLead('SRC-1', 'importer wants 40 cartons'), true, 'a lead can be dropped');
  eq(data.sourcingLeads.length, 1, 'and is KEPT — the research and the ledger are the asset');
  eq(data.sourcingLeads[0].droppedReason, 'importer wants 40 cartons', 'with the reason on it');
  eq(data.sourcingLeads[0].candidates.length, 1, 'and everything already found still there');

  /* One predicate behind the lanes, the rail counts and the nav badge, so
     a dropped lead cannot be gone from one and present in another. */
  eq(S.sourcingBoardLeads().length, 0, 'a dropped lead is off the board');
  calls.badges = [];
  S.renderSourcingBadge();
  eq(calls.badges[0].n, 0, 'and out of the rail badge, which reads the same predicate');

  eq(S.undropSourcingLead('SRC-1'), true, 'it can be put back');
  eq(data.sourcingLeads[0].status, 'looking', 'at the stage it left from');
  eq(S.sourcingBoardLeads().length, 1, 'and it is on the board again');

  resetAll([lead({ status: 'listed', productId: 'P042' })]);
  eq(S.dropSourcingLead('SRC-1', 'changed my mind'), false,
    'a listed lead cannot be dropped — the product exists and would be left unaccounted for');
  eq(data.sourcingLeads[0].voided, false, 'so it is not hidden');

  resetAll([lead({ status: 'priced' })]);
  S.dropSourcingLead('SRC-1', 'too dear');
  calls.badges = [];
  S.renderSourcingBadge();
  eq(calls.badges[0].n, 0, 'the badge counts work outstanding, and a dropped lead is not that');
  resetAll([lead({ status: 'listed', productId: 'P1' }), lead({ id: 'SRC-2', status: 'asked' })]);
  calls.badges = [];
  S.renderSourcingBadge();
  eq(calls.badges[0].n, 1, 'nor is one that already became a product');
}

/* ---------- 7. graduation: two saves, and the second one is gated ---- */
{
  // --- the happy path
  resetAll([lead({ status: 'priced', name: 'Sofa Legs Chrome 4"',
    candidates: [cand({ tiers: rungs([1,15000],[12,13500],[60,12000]), unit: 'Pc', packQty: 12, packUnit: 'Ctn' })] })]);
  const out = await S.graduateSourcingLead('SRC-1', {
    name: 'Sofa Legs Chrome 4"', category: 'Furniture Fittings', subcategory: 'Legs',
    supplierId: null, supplierName: 'Shafik',
    tiers: S.candidateTiers(data.sourcingLeads[0].candidates[0]),
    unit: 'Pc', packQty: 12, packUnit: 'Ctn',
  });
  t.check(!!out && !!out.productId, 'graduation returns the product it created');
  eq(calls.saves, 2,
    'TWO saves: products and prices carry a real foreign key, and saveData fires every op at once');
  eq(calls.snapshots[0].prices, 0,
    'the price row is NOT in the first save — that is the whole point of splitting them');
  eq(calls.snapshots[0].products, 1, 'while the product already is');
  eq(data.products.length, 1, 'the product is on file');
  eq(data.suppliers.length, 1, 'and the new supplier with it');
  eq(data.prices.length, 1, 'and its first price');
  eq(data.sourcingLeads[0].status, 'listed', 'the lead is listed');
  eq(data.sourcingLeads[0].productId, data.products[0].id, 'and points at the product it became');

  const pr = data.prices[0];
  eq(pr.productId, data.products[0].id, 'the price is for that product');
  eq(pr.supplierId, data.suppliers[0].id, 'from that supplier');
  const derived = S.deriveWholesaleRetail(pr.tiers, pr.packQty);
  eq(pr.retail, derived.retail, 'retail is DERIVED from the ladder, exactly as the price form does it');
  eq(pr.wholesale, derived.wholesale, 'and so is wholesale');
  /* The whole ladder crosses over, which is what finally gives the
     product a REAL bulk rate. A single rung at qty 1 -- what graduation
     used to write -- could only ever leave wholesale null, so every item
     that came through this door arrived with no carton price at all. */
  eq(pr.tiers.length, 3, 'all three rungs cross over, not just the one somebody retyped');
  eq(pr.retail, 15000, 'the by-the-piece rate becomes retail');
  eq(pr.wholesale, 13500, 'and the carton rate becomes a real bulk rate');
  eq(JSON.stringify(pr.tiers), JSON.stringify(rungs([1,15000],[12,13500],[60,12000])),
    'in the registry\'s own {minQty, price} shape, sorted');

  // A supplier who only sells by the carton has no retail rate, and one
  // is not invented for them.
  resetAll([lead({ status: 'priced',
    candidates: [cand({ tiers: rungs([12,13500]), unit: 'Pc', packQty: 12, packUnit: 'Ctn' })] })]);
  await S.graduateSourcingLead('SRC-1', { name: 'Bulk only', supplierName: 'Meggo',
    tiers: rungs([12,13500]), unit: 'Pc', packQty: 12, packUnit: 'Ctn' });
  eq(data.prices[0].retail, null, 'nobody quoted a single piece, so there is no retail rate to claim');
  eq(data.prices[0].wholesale, 13500, 'only the bulk one they actually gave');

  // And graduation still refuses a ladder with nothing on it.
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1,900]) })] })]);
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X', supplierName: 'S', tiers: [] }), null,
    'an empty ladder is no price at all');
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X', supplierName: 'S', tiers: rungs([1,0]) }), null,
    'and a rung of zero is not a price either');
  eq(data.products.length, 0, 'neither of which created anything');

  /* --- ids. Not merely "unused right now": this shop issues them
     monotonically and never hands a retired one back, because a purchase
     invoice line or a stock log entry still pointing at a deleted P001
     would silently attach itself to whatever took the id next. The
     lowest-FREE-slot rule would do exactly that. */
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1,900]) })] })]);
  data.products = [{ id: 'P007', name: 'Something else' }];   // P001..P006 retired
  data.suppliers = [{ id: 'S004', name: 'Someone else' }];
  await S.graduateSourcingLead('SRC-1', { name: 'New thing', supplierName: 'Shafik', tiers: rungs([1,900]) });
  eq(data.products.length, 2, 'the existing product is untouched');
  eq(data.products[1].id, 'P008',
    'the new product takes the NEXT id, not the lowest free one — retired ids stay retired');
  eq(data.suppliers[1].id, 'S005', 'and so does the new supplier');
  eq(data.idCounters.product, 8, 'with the counter moved on, so the next form does not propose it again');

  // --- the gate: phase one did not reach the server
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1,15000]) })] })]);
  saveLands = false;
  const off = await S.graduateSourcingLead('SRC-1', {
    name: 'Sofa Legs', supplierName: 'Shafik', tiers: rungs([1,15000]), unit: 'Pc',
  });
  eq(calls.saves, 1, 'the second save never happens');
  eq(data.prices.length, 0,
    'and NO price row is pushed for a product the server has not got — that is a foreign key waiting to fail');
  eq(off.priceId, null, 'the caller is told there is no price yet');
  t.check(calls.toasts.some((m) => /Price Registry/.test(m)),
    'and the admin is told in words, rather than handed a sync failure for a row that was never valid to send');
  eq(data.sourcingLeads[0].status, 'listed',
    'the product WAS created, so the lead is honest about being listed');

  // --- graduation refuses what it cannot make sense of
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1,15000]) })] })]);
  eq(await S.graduateSourcingLead('SRC-1', { name: '  ', supplierName: 'S', tiers: rungs([1,100]) }), null,
    'a product with no name is refused');
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X', supplierName: 'S', tiers: [] }), null,
    'and one with no price — "Priced" recorded a figure, so there is one to carry');
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X', supplierName: '  ', tiers: rungs([1,100]) }), null,
    'and one with nobody to buy it from');
  eq(data.products.length, 0, 'none of which created anything');
}

/* ---------- 8. the two boards do not reach into each other ----------- */
{
  /* The sourcing board emits the same .sq-* markup on purpose -- that is
     how it inherits the order board's whole visual system instead of a
     second, unpinned copy of ~330 lines of CSS. The price of that is
     three document-wide queries, and this is the sweep that keeps them
     paid: a NEW unscoped one anywhere in the file fails here too. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  t.check(!/document\.querySelectorAll\('\.sq-check/.test(code),
    'no unscoped .sq-check query — "select all" must not tick the other board\'s cards');
  t.check(/document\.querySelectorAll\('#savedQuotesWrap \.sq-check'\)/.test(code)
    && /document\.querySelectorAll\('#savedQuotesWrap \.sq-check:checked'\)/.test(code),
    'both of the orders board\'s own .sq-check queries name its wrap');
  t.check(!/document\.querySelector\(`\.sq-board /.test(code),
    'and no unscoped .sq-board lane lookup — both sections are in the DOM at once, hidden rather than removed');
  t.check(/#savedQuotesWrap \.sq-board \.sq-col\[data-status=/.test(code),
    'announceOrderMove scrolls the ORDERS board to the lane, not whichever board answers first');
  /* order-board-layout.test.js section 6 stubs querySelector and
     discriminates on /sq-stepper-step/. The scoped column selector must
     still fail that test, or that file starts asserting against the
     wrong element without saying so. */
  t.check(!/sq-stepper-step/.test('#savedQuotesWrap .sq-board .sq-col[data-status="x"]'),
    'and the scoped selector still reads as the column, not the rail step');

  /* Its own state AND its own starting value: seeding either from the
     order board's would make opening Sourcing land wherever Orders was
     last left. */
  t.check(/let sourcingActiveMobileStep = 'asked';/.test(code) && /let sourcingBoardScrollLeft = 0;/.test(code),
    'the sourcing board keeps its own scroll and active-step state, starting from its own first lane');
  t.check(/let sqActiveMobileStep = 'draft';/.test(code) && /let sqBoardScrollLeft = 0;/.test(code),
    'and the order board keeps its own, untouched');

  /* No CSS rule may name a sourcing stage. A status in a selector is what
     pins a board to one set of lanes -- order-board-layout.test.js sweeps
     the whole file for exactly this on the order side. */
  ['asked', 'looking', 'sourced', 'priced', 'listed'].forEach((s) => {
    t.check(!new RegExp(`data-active-step="${s}"`).test(src),
      `no rule hard-codes the ${s} lane`);
  });

  // Both the rail and the lanes are built from the same order, so a stage
  // cannot appear in one and not the other.
  const render = extractFunction(src, 'renderSourcing', 'index.html');
  t.check((render.match(/SOURCING_STATUS_ORDER\.map\(/g) || []).length >= 2,
    'the rail and the board are both generated from SOURCING_STATUS_ORDER');
  t.check((render.match(/leads\.filter\(l=> l\.status===status\)/g) || []).length >= 2,
    'and both group the SAME already-filtered set, so a dropped lead is off both');
}

/* ---------- 9. the three doors ---------------------------------------- */
{
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  t.check(/list\.innerHTML = '<div class="suggestion-empty">No matching products\.<\/div>' \+ sourcingCaptureBlockHTML\(query\);/.test(code),
    'the quote item picker offers the funnel when it finds nothing');
  t.check(/dd\.innerHTML = '<div class="suggestion-empty">No matching products\.<\/div>' \+ sourcingCaptureBlockHTML\(q\);/.test(code),
    'and so does the quote page\'s own search bar — hooking only the modal fits half a door');
  /* Read out of ipRenderList ITSELF. invRenderList carries the same "No
     products yet" line word for word, so a file-wide match goes on
     passing with this branch wired to the funnel -- which would offer to
     source an item nobody has typed yet, every time a fresh shop opens
     the picker. */
  const ipList = extractFunction(src, 'ipRenderList', 'index.html');
  t.check(/No products yet[\s\S]*?<\/div>';/.test(ipList) && !/No products yet[^\n]*sourcingCaptureBlockHTML/.test(ipList),
    'but an EMPTY CATALOGUE gets no such offer — that is a shop with nothing on file, not an item it was asked for');
  t.check(/entries\.length===0[\s\S]*?sourcingCaptureBlockHTML\(query\)/.test(ipList),
    'while a search that found nothing does');
  t.check(/id="wa_src_add"/.test(code) && /captureSourcingLeadAndSave\(\{\s*\r?\n?\s*name, source: 'whatsapp'/.test(code),
    'and the WhatsApp branch that used to render nothing now offers it too');
  /* Sliced to THIS handler. `dismissed[wamid] = true` appears beside
     every other suggestion in the inbox, so a file-wide match would go on
     passing with the line deleted from the one place it is being claimed
     for -- and the card would sit there asking again for an ask already
     captured. */
  const waHandler = (/const srcBtn = sug\.querySelector\('#wa_src_add'\);[\s\S]*?\n    \}\);/.exec(code) || [''])[0];
  t.check(/waInbox\.dismissed\[wamid\] = true;/.test(waHandler),
    'and capturing the ask puts the card away, rather than leaving it to ask again');

  // Every door goes through the one function, or the dedupe rule drifts.
  const doors = (code.match(/captureSourcingLeadAndSave\(/g) || []).length;
  t.check(doors >= 3, `all three doors call the one capture function (${doors} call sites)`);

  /* A rung typed on the research screen and a tier typed on the price
     form have to convert identically. "2 cartons at 300,000 a carton"
     means 24 pieces at 12,500 each on BOTH screens or neither -- and a
     carton price stored as a unit price is exactly the 5x inflation this
     shop has already been bitten by once. Read from the handler, because
     it is DOM code the compiled scope cannot drive. */
  const rungHandler = (/getElementById\('sl_c_tier_add'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/pendingTierEntry\(/.test(rungHandler),
    'the candidate ladder commits through the price form\'s own converter, not a second copy of the rule');
  t.check(/invertedTierPairs\(slCandTiers\)/.test(rungHandler),
    'and warns on a rung where buying MORE costs more, while the two figures are still on screen');
}

/* ---------- 10. registered with the sync engine ---------------------- */
{
  t.check(/sel\('sourcing_leads'\)/.test(src), 'the table is loaded');
  t.check(/const sourcingLeadRows = \(sourcingLeadsR && !sourcingLeadsR\.error && sourcingLeadsR\.data\) \|\| \[\];/.test(src),
    'tolerantly — the code deploys on a push and the migration is applied by hand, so there is a window where one exists and the other does not');
  t.check(!/sourcingLeadsR[\s\S]{0,200}\.forEach\(r=>\{ if\(r\.error\) throw r\.error; \}\);/.test(src),
    'and it is not in the throw list, so a missing table cannot take the whole shop down');
  t.check(/sourcingLeads: keyRowsById\(rows\.sourcingLeads, 'id'\),/.test(src),
    'seeded into lastSynced, or the first delete of a session is undone by the next load');
  t.check(/addDiffOps\(ops, 'sourcingLeads', 'sourcing_leads', 'id', shopId, rows\.sourcingLeads\);/.test(src),
    'diffed on save');
  t.check(/'savedQuotes','sourcingLeads','purchaseInvoices'/.test(src),
    'and an absent collection is refused from the sync rather than read as an instruction to empty it');
  t.check(/sourcingLeads:\[\],/.test(src), 'named in the clear-all literal');
  t.check(/if\(!data\.sourcingLeads\) data\.sourcingLeads = \[\];/.test(src),
    'and back-filled on restore, so a backup taken before this feature does not bench it for good');

  const mig = read('supabase/migrations/0072_sourcing_leads.sql');
  t.check(/create table sourcing_leads/.test(mig), 'the migration creates the table');
  t.check(/primary key \(shop_id, id\)/.test(mig), 'keyed by shop and the client-minted id');
  t.check(/status in \('asked','looking','sourced','priced','listed'\)/.test(mig),
    'and the five stages are the database\'s rule too, not only the browser\'s');
  t.check(/alter table sourcing_leads enable row level security;/.test(mig), 'RLS is on');
  t.check(/create policy "owner only deletes" on sourcing_leads\s*\r?\n\s*as restrictive for delete/.test(mig),
    'and a stale client cannot delete the record of who asked for what');
}

}

main().then(()=> process.exit(t.done() ? 1 : 0),
  (e)=>{ console.error(e); process.exit(1); });
