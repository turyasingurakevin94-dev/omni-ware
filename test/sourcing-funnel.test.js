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
let forcedId = null;              // {prefix: id} — makes the allocator repeat itself

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
  openBulkPricingFor: (productId, supplierId, packing) => { calls.bulk = {productId, supplierId, packing}; },
  renderPresets: () => {},
  allocRowId: () => nextRowId++,
  esc: (s) => String(s),
  fmtUGX: (n) => String(n),
  document: { getElementById: () => null },
  // No server here, so issueEntityId takes its documented offline fallback
  // -- the local monotonic counter, which is the path that has to be right
  // anyway when the shop is on a bad connection.
  /* No server here, so issueEntityId normally takes its documented
     offline fallback -- the local monotonic counter, the path that has to
     be right anyway on a bad connection. `forcedId` makes it hand back a
     FIXED id instead, which is how the collision below is reproduced:
     the allocator repeating itself is exactly what happened live. */
  sb: { rpc: (_fn, args) => {
    const want = forcedId && forcedId[(args && args.p_prefix) || ''];
    return Promise.resolve(want
      ? { data: want, error: null }
      : { data: null, error: { message: 'offline' } });
  } },
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
  extractFunction(src, 'firstFreeEntityId', 'index.html'),
  extractFunction(src, 'nextEntityId', 'index.html'),
  extractFunction(src, 'issueEntityId', 'index.html'),
  extractFunction(src, 'ensurePresetCategory', 'index.html'),
  extractFunction(src, 'deriveWholesaleRetail', 'index.html'),
  // The real ones, so a funnel price row cannot differ from a Registry one.
  extractFunction(src, 'effectiveVariantPacking', 'index.html'),
  extractFunction(src, 'buildVariantPriceRow', 'index.html'),
  extractFunction(src, 'supplierName', 'index.html'),
  extractFunction(src, 'sourcingLeadsAll', 'index.html'),
  extractFunction(src, 'sourcingLeadById', 'index.html'),
  extractFunction(src, 'sourcingPhoneKey', 'index.html'),
  extractFunction(src, 'leadDistinctAskers', 'index.html'),
  extractFunction(src, 'leadAskCount', 'index.html'),
  extractFunction(src, 'leadCandidateNames', 'index.html'),
  extractFunction(src, 'candidateTiers', 'index.html'),
  extractFunction(src, 'candidateVariantOverrides', 'index.html'),
  extractFunction(src, 'variantLabel', 'index.html'),
  extractFunction(src, 'candidateHasPrice', 'index.html'),
  extractFunction(src, 'candidateUnitPriceAt', 'index.html'),
  extractFunction(src, 'candidateLowestRung', 'index.html'),
  extractFunction(src, 'leadVariantAttrs', 'index.html'),
  extractFunction(src, 'leadHasVariants', 'index.html'),
  extractFunction(src, 'leadVariantCombos', 'index.html'),
  extractFunction(src, 'leadVariantChoices', 'index.html'),
  extractFunction(src, 'leadDemandByVariant', 'index.html'),
  extractFunction(src, 'leadDemandQty', 'index.html'),
  extractFunction(src, 'sourcingRankedAt', 'index.html'),
  extractFunction(src, 'sourcingBestAt', 'index.html'),
  extractFunction(src, 'sourcingDefaultGraduateCandidate', 'index.html'),
  extractDeclaration(src, 'SOURCING_STEP_GUIDE', 'index.html'),
  extractDeclaration(src, 'SOURCING_DROPPED_GUIDE', 'index.html'),
  'let sourcingViewStep = null;',
  extractFunction(src, 'sourcingViewedStep', 'index.html'),
  extractFunction(src, 'sourcingStepGuide', 'index.html'),
  extractFunction(src, 'sourcingWantsPriceForm', 'index.html'),
  extractFunction(src, 'sourcingWantsCompare', 'index.html'),
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
  extractFunction(src, 'sourcingResolveAsker', 'index.html'),
  extractFunction(src, 'applyCandidateFields', 'index.html'),
];
const S = compileScope(sources, env, [
  'sourcingPhoneKey', 'leadDistinctAskers', 'leadAskCount', 'leadFacts',
  'leadIsStalled', 'leadNeedsSomebody', 'findSourcingLeadByText',
  'captureSourcingLead', 'sourcingGateBlock', 'setSourcingStatus',
  'stepSourcingStatus', 'dropSourcingLead', 'undropSourcingLead',
  'graduateSourcingLead', 'sourcingBoardLeads', 'renderSourcingBadge',
  'deriveWholesaleRetail', 'sourcingLeadById',
  'candidateTiers', 'candidateHasPrice', 'candidateVariantOverrides', 'candidateUnitPriceAt', 'candidateLowestRung',
  'leadDemandQty', 'sourcingRankedAt', 'sourcingBestAt', 'sourcingDefaultGraduateCandidate',
  'leadVariantAttrs', 'leadHasVariants', 'leadVariantCombos', 'leadVariantChoices', 'leadDemandByVariant',
  'sourcingStepGuide', 'sourcingViewedStep', 'sourcingWantsPriceForm', 'sourcingWantsCompare', 'sourcingResolveAsker',
  'applyCandidateFields',
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

/* ---------- 3c. each step asks for one thing -------------------------- */
{
  resetAll();
  const guide = (status, over) => S.sourcingStepGuide(lead(Object.assign({ status }, over || {})));

  /* Each step shows its OWN task and nothing else. Keeping the earlier
     steps' answers on screen -- dimmed or otherwise -- is a screen the
     steps were not needed for; what an earlier step recorded is reached
     by going BACK to it, which the rail does. */
  eq(guide('asked').show.join(), 'identity,demand', 'Asked For asks what it is and who wants it');
  eq(guide('looking').show.join(), 'assign,research', 'Looking asks who is on it and who has it');
  eq(guide('sourced').show.join(), 'research', 'Source Found asks only for their prices');
  eq(guide('priced').show.join(), 'compare', 'Priced asks only who to buy from');
  eq(guide('listed').show.join(), 'outcome', 'and Listed says only what it became');

  // No step carries another step's block, or the steps stop meaning anything.
  const seen = {};
  ['asked', 'looking', 'sourced', 'priced', 'listed'].forEach((s) => {
    const g = guide(s);
    t.check(!!g && !!g.need, `${s} says what it is for`);
    t.check(!('fold' in g), `${s} folds nothing — a step shows its task or does not show it`);
    g.show.forEach((k) => { (seen[k] = seen[k] || []).push(s); });
  });
  Object.keys(seen).forEach((k) => {
    // `research` is deliberately on two steps: finding who has it and
    // pricing them are two tasks against one list.
    const allowed = k === 'research' ? 2 : 1;
    t.check(seen[k].length <= allowed,
      `${k} belongs to one step, not several (${seen[k].join(', ')})`);
  });

  // Every block a step names is one the modal actually carries.
  const KNOWN = ['identity', 'assign', 'demand', 'research', 'compare', 'outcome'];
  Object.keys(seen).forEach((k) => t.check(KNOWN.includes(k), `${k} is a real block`));
  // Every block the guide can name exists in the modal, or a step would
  // silently ask for something the screen cannot draw.
  KNOWN.forEach((k) => t.check(new RegExp(`data-sec="${k}"`).test(src),
    `the modal actually carries the ${k} block`));

  /* A dropped lead is a record, not a job: nothing is asked for and
     nothing is hidden. */
  const dropped = S.sourcingStepGuide(lead({ status: 'sourced', voided: true }));
  eq(dropped.cta, '', 'a dropped lead asks for nothing');
  t.check(dropped.show.includes('identity') && dropped.show.includes('research'),
    'but keeps everything it found readable — it is a record, not a job');
  t.check(/put it back/i.test(dropped.need), 'while saying it can come back');
  eq(guide('listed').cta, '', 'and a listed one is finished, so it has no next step either');

  /* The price half of the research form belongs to Source Found. Folded
     at Looking rather than withheld -- a researcher given the price in
     the same breath should not have to come back for it. */
  eq(S.sourcingWantsPriceForm(lead({ status: 'looking' })), false,
    'Looking leads with WHO has it, not what they charge');
  eq(S.sourcingWantsPriceForm(lead({ status: 'sourced' })), true, 'Source Found opens the price half');
  eq(S.sourcingWantsPriceForm(lead({ status: 'sourced', voided: true })), false,
    'and a dropped lead is not asking for prices');

  /* The comparison is the deciding step's question. Earlier than that it
     appears only once there are two prices to weigh -- a one-row table
     tells you nothing you did not just type. */
  const one = [cand({ id: 'A', tiers: rungs([1, 15000]) })];
  const two = [cand({ id: 'A', tiers: rungs([1, 15000]) }), cand({ id: 'B', tiers: rungs([1, 16000]) })];
  eq(S.sourcingWantsCompare(lead({ status: 'sourced', candidates: one })), false,
    'one price is not a comparison');
  eq(S.sourcingWantsCompare(lead({ status: 'sourced', candidates: two })), true,
    'two are, and it appears the moment there is something to weigh');
  eq(S.sourcingWantsCompare(lead({ status: 'priced', candidates: one })), true,
    'and at Priced it is always drawn — with one supplier it still costs the order');
  eq(S.sourcingWantsCompare(lead({ status: 'listed', candidates: two })), false,
    'a listed item has already been decided');
  eq(S.sourcingWantsCompare(lead({ status: 'priced', candidates: two, voided: true })), false,
    'and so has a dropped one');
}

/* ---------- 3d. and the screen actually obeys the table -------------- */
{
  /* applySourcingStepView is the half that DOES the folding, and a right
     table applied wrongly looks exactly like a right screen until you
     open it. Driven against a fake document rather than read, so
     "folded" has to really mean present-but-quiet and not hidden. */
  const el = () => ({
    textContent: '', disabled: false, open: false,
    style: { _p: {}, setProperty(k, v) { this._p[k] = v; }, getPropertyValue(k) { return this._p[k]; } },
    classList: { _s: new Set(),
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      has(c) { return this._s.has(c); } },
  });
  const ids = ['sl_need', 'sl_cand_form', 'sl_research_head', 'sl_price_block',
    'sl_price_summary', 'sl_cta', 'sl_cta_why', 'sl_open_body', 'sl_revisit',
    'sl_add_block', 'sl_add_summary', 'sl_save'];
  // `at` is the step being looked BACK at, or undefined for "the one it is on".
  const view = (l, at) => {
    const nodes = {};
    ids.forEach((i) => { nodes[i] = el(); });
    const secs = ['identity', 'assign', 'demand', 'research', 'compare', 'outcome'].map((k) => {
      const s = el(); s.dataset = { sec: k }; return s;
    });
    const scope = compileScope([
      extractDeclaration(src, 'SOURCING_STATUS_ORDER', 'index.html'),
      extractDeclaration(src, 'SOURCING_STEP_GUIDE', 'index.html'),
      extractDeclaration(src, 'SOURCING_DROPPED_GUIDE', 'index.html'),
      extractDeclaration(src, 'SOURCING_GATES', 'index.html'),
      extractFunction(src, 'leadCandidateNames', 'index.html'),
      extractFunction(src, 'candidateTiers', 'index.html'),
      extractFunction(src, 'candidateVariantOverrides', 'index.html'),
      extractFunction(src, 'candidateHasPrice', 'index.html'),
      extractFunction(src, 'leadFacts', 'index.html'),
      extractFunction(src, 'sourcingGateBlock', 'index.html'),
      'let sourcingViewStep = null; let editingCandidateId = null;',
      extractFunction(src, 'sourcingViewedStep', 'index.html'),
      extractFunction(src, 'sourcingStepGuide', 'index.html'),
      extractDeclaration(src, 'SOURCING_STATUSES', 'index.html'),
      extractDeclaration(src, 'SOURCING_SHORT_LABELS', 'index.html'),
      extractFunction(src, 'sourcingWantsPriceForm', 'index.html'),
      extractFunction(src, 'applySourcingStepView', 'index.html'),
      'function __look(s){ sourcingViewStep = s; }',
    ], { document: { getElementById: (i) => nodes[i], querySelectorAll: () => secs },
      esc: (s) => String(s == null ? '' : s) },
    ['applySourcingStepView', '__look']);
    scope.__look(at || null);
    scope.applySourcingStepView(l);
    const state = {};
    secs.forEach((s) => {
      state[s.dataset.sec] = s.style.display === 'none' ? 'hidden' : 'shown';
    });
    return { secs: state, nodes };
  };

  /* The step's instruction wears the step's own colour, so it and the lit
     node on the rail above it read as the same subject rather than two
     notices sharing a screen. */
  const accentOf = (v) => v.nodes.sl_open_body.style.getPropertyValue('--stage-accent');
  /* Read off the app's own constant rather than a copied hex: the claim
     is WHICH STEP's colour is used, and a hex here would only break the
     next time the palette is touched. */
  const STATUS_COLOURS = JSON.parse(JSON.stringify(
    compileScope([extractDeclaration(src, 'SOURCING_STATUSES', 'index.html'),
      'function __c(){ return SOURCING_STATUSES; }'], {}, ['__c']).__c()));
  eq(accentOf(view(lead({ status: 'priced' }))), STATUS_COLOURS.priced.color,
    'the instruction wears the step\'s colour');
  eq(accentOf(view(lead({ status: 'listed' }))), STATUS_COLOURS.listed.color,
    'a different step, a different colour');
  t.check(STATUS_COLOURS.priced.color !== STATUS_COLOURS.listed.color,
    'and those really are different colours, so the check above can tell them apart');
  t.check(/ink-soft/.test(accentOf(view(lead({ status: 'priced', voided: true })))),
    'and a dropped lead wears none of them — it is not on a step any more');

  const asked = view(lead({ status: 'asked' }));
  eq(asked.secs.research, 'hidden', 'Asked For really does leave the research panel off the screen');
  eq(asked.secs.demand, 'shown', 'and really does put the ask list up');
  t.check(/who wants it/.test(asked.nodes.sl_need.textContent), 'and says what the step is for');

  const looking = view(lead({ status: 'looking' }));
  eq(looking.secs.demand, 'hidden',
    'an earlier step\'s block is GONE from this one, not parked on it — that is what makes it a step');
  eq(looking.secs.identity, 'hidden', 'and so is the one before that');
  eq(looking.secs.research, 'shown', 'while the step\'s own question is the one in front of you');
  eq(looking.nodes.sl_price_block.open, false, 'and Looking leads with who has it, not the price');
  /* The button says what is missing BEFORE it is pressed. A gate that
     only refuses afterwards leaves the step attempted, not finished. */
  eq(looking.nodes.sl_cta.disabled, true, 'with nobody found the step cannot be finished');
  t.check(/supplier, or the importer/.test(looking.nodes.sl_cta_why.textContent),
    'and the button says so instead of waiting to refuse');

  const found = view(lead({ status: 'looking', candidates: [cand({ supplierName: 'Shafik' })] }));
  eq(found.nodes.sl_cta.disabled, false, 'once somebody is found the step can be finished');
  eq(found.nodes.sl_add_block.open, true,
    'Looking stands the add-a-supplier form open — adding is that step\'s job');

  const sourced = view(lead({ status: 'sourced', candidates: [cand({ supplierName: 'Shafik' })] }));
  eq(sourced.nodes.sl_price_block.open, true, 'Source Found opens the price half');
  eq(sourced.nodes.sl_cta.disabled, true, 'and will not move on without one');
  /* By Source Found the suppliers are already on the list and the job is
     pricing THEM. A blank supplier form is the widest thing on the
     screen, so it folds -- reachable, not in the way. */
  eq(sourced.nodes.sl_add_block.open, false,
    'Source Found folds it away — the job there is pricing the people already found');

  const priced = view(lead({ status: 'priced', candidates: [cand({ tiers: rungs([1, 900]) })] }));
  eq(priced.nodes.sl_cta.disabled, false, 'Priced is never gated — its button graduates rather than steps');
  t.check(/catalogue/i.test(priced.nodes.sl_cta.textContent),
    'and says what it will do');
  /* Short enough for a phone footer, where this button sits beside Close
     and Drop this. The long form lives in the sentence above it. */
  ['asked', 'looking', 'sourced', 'priced'].forEach((s) => {
    const label = S.sourcingStepGuide(lead({ status: s })).cta;
    t.check(label.length <= 20, `the ${s} button label fits a phone footer ("${label}")`);
  });
  eq(priced.nodes.sl_save.style.display, 'none',
    'and an existing lead shows no Save — its fields write themselves as they change');

  const listed = view(lead({ status: 'listed', productId: 'P1' }));
  eq(listed.nodes.sl_cta.style.display, 'none', 'a listed item is offered no next step');
  eq(listed.nodes.sl_cand_form.style.display, 'none',
    'and its research panel becomes history, not a form to add to');
  const gone = view(lead({ status: 'sourced', voided: true }));
  eq(gone.nodes.sl_cand_form.style.display, 'none', 'nor does a dropped one take new research');
  eq(gone.nodes.sl_cta.style.display, 'none', 'and it asks for nothing');
  eq(gone.secs.research, 'shown', 'while keeping everything already found readable');

  /* Going BACK is what replaces folding: an earlier step is reached by
     asking for it, and then shows ITS task, with the finish line put
     away because that step was finished already. */
  const at = lead({ status: 'priced', candidates: [cand({ tiers: rungs([1, 900]) })] });
  const back = view(at, 'asked');
  eq(back.secs.identity, 'shown', 'stepping back shows that step\'s own work');
  eq(back.secs.compare, 'hidden', 'and puts the current step\'s away');
  eq(back.nodes.sl_cta.style.display, 'none',
    'with no finish line — an earlier step is being corrected, not completed');
  eq(back.nodes.sl_revisit.style.display, '', 'and it says plainly that this is a step being looked back at');
  eq(accentOf(back), STATUS_COLOURS.asked.color,
    'wearing the colour of the step being looked at, not the one it is on');
  t.check(STATUS_COLOURS.asked.color !== STATUS_COLOURS.priced.color,
    'which is a different colour from the step it is on, so that check means something');
  // A step it has NOT reached has nothing to show, so asking for it is refused.
  const ahead = view(lead({ status: 'asked' }), 'priced');
  eq(ahead.secs.demand, 'shown', 'a step it has not reached cannot be jumped to');
  eq(ahead.nodes.sl_revisit.style.display, 'none', 'so nothing claims to be looking back');

  /* The rail is the WAY BACK, which is what earns the right to show one
     step at a time. Three wiring facts, read from the source because the
     compiled scope cannot click a rail node.

     The middle one is a bug that shipped in this shape once already: the
     back button was bound from the rail's setup, which runs BEFORE
     applySourcingStepView creates it, so it was drawn and did nothing. */
  const nav = extractFunction(src, 'wireSourcingRailNav', 'index.html');
  t.check(/i <= at/.test(nav) && /addEventListener\('click'/.test(nav),
    'every step the lead has reached is a button back into that step');
  t.check(/const reachable = l\.voided \? true : i <= at;/.test(nav),
    'and the ones ahead are not, because there is nothing there to do yet');
  const applyFn = extractFunction(src, 'applySourcingStepView', 'index.html');
  t.check(/sl_back_to_now[\s\S]{0,400}addEventListener\('click'/.test(applyFn),
    'the way back is bound where it is made, or it is drawn and does nothing');
  t.check(!/sl_back_to_now/.test(nav),
    'and not from the rail setup, which runs before that button exists');
  t.check(/sourcingViewStep = null;/.test(extractFunction(src, 'openSourcingLead', 'index.html')),
    'opening a lead lands on the step it is ON, not wherever the last one was being read back');

  /* The one action that matters has to be reachable on a phone, where the
     body scrolls and the footer does not. It was in the body, below the
     fold, while Close and Drop this sat pinned above it. */
  const foot = (/<div class="modal-foot">[\s\S]*?<\/div>/.exec(
    (/<div class="modal-overlay" id="sourcingLeadModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0]) || [''])[0];
  t.check(/id="sl_cta"/.test(foot) && /btn-accent/.test(foot),
    'the step\'s button is in the footer, and is the one primary there');
  t.check((foot.match(/btn-accent/g) || []).length === 1,
    'the only one — two filled buttons in a footer is two primaries');

  /* Which is only safe because the fields save themselves; otherwise
     Close would silently discard what was typed. */
  const autosave = (/\['sl_name','sl_notes','sl_staff'\]\.forEach[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/addEventListener\('change'/.test(autosave) && /saveData\(\);/.test(autosave),
    'an existing lead\'s fields write themselves as they change');
  t.check(/if\(name\) l\.name = name;/.test(autosave),
    'and a name cleared to blank does not wipe the item on the way past');

  /* The role is three short exclusive answers. As a select every one of
     them truncated ("Supplier — we buy from t…"), so it is a segmented
     control -- which means it has no .value and reads through helpers. */
  t.check(/id="sl_c_role_seg"/.test(src) && !/id="sl_c_role"/.test(src),
    'the role is a segmented control, not a select that truncates all three options');
  const roleGet = extractFunction(src, 'slRoleValue', 'index.html');
  t.check(/input:checked/.test(roleGet) && /'supplier'/.test(roleGet),
    'reading it takes the checked one, falling back to supplier');
  t.check(/slRoleValue\(\)/.test(src) && /slSetRole\(/.test(src),
    'and every read and write goes through those, not through a .value that no longer exists');

  /* The comparison is the deciding step's whole content, so it has to
     read as a table and end in an answer. Unheaded, its two figures were
     unlabelled money -- and at a quantity of one they are the same
     number printed twice, which reads as a mistake. */
  const cmp = extractFunction(src, 'sourcingCompareHTML', 'index.html');
  t.check(/sf-compare-hrow/.test(cmp) && /Per \$\{esc\(unit\)\}/.test(cmp) && />Total</.test(cmp),
    'the comparison carries column headings, so a rate is not mistaken for a total');
  t.check(/sf-win-tick/.test(cmp),
    'and the cheapest row is marked, not left to be inferred from bold');
  t.check(/sf-verdict/.test(cmp) && !/class="preset-hint">\$\{esc\(best/.test(cmp),
    'the conclusion is set as the answer rather than as small print under the figures');
  const verdictRule = (/\.sf-verdict\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/color:var\(--ink\)/.test(verdictRule) && /font-size:13\.5px/.test(verdictRule),
    'and is set in full ink at reading size, not greyed and shrunk below the figures');
  /* Even with nobody to compare against, the step still has to answer
     "who do we buy from" -- one quoted supplier IS the answer. */
  t.check(/Only <b>\$\{esc\(best\.candidate\.supplierName/.test(cmp),
    'a single quoted supplier still gets a verdict rather than silence');
  /* The whole-order saving is only worth saying when it differs from the
     per-unit one. At a quantity of one it is the same figure twice. */
  t.check(/qty > 1 \? `, \$\{fmtUGX\(best\.savesPerUnit \* qty\)\}/.test(cmp),
    'and the order-total saving is dropped at a quantity of one, where it repeats itself');

  /* Red on this screen belongs to the one primary button and to Drop
     this. An ordinary edit washed in it read as an error, and a chosen
     segment filled with it read as something pressed. */
  const openRow = (/\.sf-list-row\.sf-cand\.open\{[^}]*\}/.exec(src) || [''])[0];
  t.check(openRow && !/--accent\) \d+%/.test(openRow),
    'the row being edited is marked with a neutral lift, not a wash of the danger colour');
  t.check(/inset 3px 0 0 var\(--accent\)/.test(openRow),
    'with an accent edge, so it is still obvious which one you opened');
  const segChecked = (/\.sf-seg input:checked \+ span\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/var\(--ink\)/.test(segChecked) && !/var\(--accent\)/.test(segChecked),
    'and a chosen segment reads as chosen rather than as a second red button');
  t.check(/\.sf-cand-editor \.sf-cand-form\{border:0/.test(src),
    'the inline editor has no frame of its own — the row it opens inside is the frame');
  /* And the row stops advertising the gap while the form that fills it is
     open underneath. */
  t.check(/editingCandidateId===c\.id \? ''/.test(src),
    'the "no price yet" prompt goes away while its own editor is open');

  /* A disabled button that looks pressable invites a press it will
     ignore. .btn had no disabled state at all -- the icon buttons have
     carried one for ages. */
  const btnDisabled = (/\.btn:disabled\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/opacity/.test(btnDisabled) && /not-allowed/.test(btnDisabled),
    'a disabled button looks and behaves disabled');

  /* One disclosure style for both folds on this screen. They had two --
     an accent-red one with a native triangle and a grey uppercase one --
     which read as two different controls doing one job. */
  t.check((src.match(/<details class="sf-fold"/g) || []).length === 2,
    'both folds on this screen share one style');
  const foldRule = (/\.sf-fold > summary\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/list-style:none/.test(foldRule),
    'with the native marker replaced rather than left to differ between browsers');

  /* The live step has to read as live at any hue -- both boards make
     their first stage grey, so this cannot rest on colour alone. */
  const nowRule = (/\.op-step\.now\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/box-shadow/.test(nowRule) && /background:var\(--panel\)/.test(nowRule),
    'the step it is on lifts off the page rather than relying on a hue it may not have');

  /* Opening a lead has to LAND on the rail. The overlay hides by opacity
     rather than display:none, so a field that held focus when the modal
     closed still holds it when it reopens -- and the browser scrolls that
     field back into view, overriding a scroll reset. Both halves are read
     from openSourcingLead, and the order matters: a reset applied while
     the modal is still hidden resets nothing. */
  const open = extractFunction(src, 'openSourcingLead', 'index.html');
  const iShow = open.indexOf("openModal('sourcingLeadModal')");
  const iBlur = open.indexOf('.blur()');
  const iScroll = open.indexOf('scrollTop = 0');
  t.check(iShow > -1 && iBlur > iShow && iScroll > iShow,
    'focus is released and the scroll reset AFTER the modal is shown, not before');
  t.check(/contains\(document\.activeElement\)/.test(open),
    'and only focus left inside this modal is taken away');
  t.check(/if\(!l\) setTimeout\(\(\)=> document\.getElementById\('sl_name'\)\.focus\(\)/.test(open),
    'a new lead puts the cursor in the one question it asks');

  /* Priced finishes by GRADUATING, not by stepping a stage -- `listed` is
     stamped by graduation and nowhere else. Read from the handler, which
     is DOM wiring the compiled scope cannot drive. */
  const cta = (/getElementById\('sl_cta'\)\.addEventListener[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/status === 'priced'[\s\S]{0,120}openSourcingGraduate/.test(cta),
    'the Priced button opens graduation rather than trying to step into Listed');
  t.check(/stepSourcingStatus\(l\.id, 1\)/.test(cta), 'and every other step moves one stage on');
}

/* ---------- 3e. who asked, linked to the records ---------------------- */
{
  resetAll();
  data.customers = [{ id: 'C001', name: 'Sarah Namono', phone: '0700111222' }];

  // A name already on file LINKS, so the ask joins that customer's history.
  const hit = await S.sourcingResolveAsker('sarah namono', '');
  eq(hit.customerId, 'C001', 'a name already on file is matched however it is cased');
  eq(hit.phone, '0700111222', 'and brings their number with it when none was typed');
  eq((await S.sourcingResolveAsker('Sarah Namono', '0755000111')).phone, '0755000111',
    'while a number typed now wins over the one on file');

  // A new name with no way to ring them back is NOT worth a record.
  const loose = await S.sourcingResolveAsker('Walk-in Julius', '');
  eq(loose.customerId, null, 'a walk-in who left no number is not made into a customer');
  eq(loose.customerName, 'Walk-in Julius', 'but the ask still records who it was');
  eq(data.customers.length, 1, 'and nothing was added to the records');

  // A new name WITH a number joins the records, the way a typed location does.
  const made = await S.sourcingResolveAsker('Brand New Buyer', '0700123123');
  eq(data.customers.length, 2, 'a new name with a number becomes a customer');
  eq(data.customers[1].id, made.customerId, 'and the ask points at the record it created');
  t.check(calls.toasts.some((m) => /added to your customers/i.test(m)), 'and says so rather than doing it silently');
  eq((await S.sourcingResolveAsker('brand new buyer', '')).customerId, made.customerId,
    'asked for again, it matches the record instead of making a second one');

  eq((await S.sourcingResolveAsker('   ', '0700111')).customerId, null, 'no name is nobody');

  /* THE ID COLLISION. issueEntityId can hand the same number to two
     callers that ask within a breath of each other -- it did, in live
     testing: two asks seconds apart both came back C113 and the customer
     list ended up holding two different people under one id, which is a
     customer whose debt and history belong to somebody else. The issued
     id is guarded against what is already on file, the way p_save guards
     the one its form was given. */
  resetAll();
  forcedId = { C: 'C113' };                // the allocator hands back the same id twice
  const a = await S.sourcingResolveAsker('First Person', '0700000001');
  const b = await S.sourcingResolveAsker('Second Person', '0700000002');
  forcedId = null;
  eq(a.customerId, 'C113', 'the first caller takes the id it was issued');
  t.check(b.customerId !== a.customerId,
    `and the second does NOT take it again (${a.customerId} vs ${b.customerId})`);
  eq(new Set(data.customers.map((c) => c.id)).size, data.customers.length,
    'so no two customers share an id');
  eq(data.customers.find((c) => c.id === a.customerId).name, 'First Person',
    'and each id still names the person it was created for');
}

/* ---------- 3f. pricing somebody you already found -------------------- */
{
  /* The Source Found step tells you to get their prices. Before this the
     form could only ADD, so a supplier recorded at Looking with no price
     -- exactly what that step asks you to record -- could never be given
     one, and the next step's instruction pointed at nowhere. */
  resetAll();
  const l = lead({ status: 'sourced', candidates: [
    cand({ id: 'SJS', supplierName: 'sjs', where: 'kikuubo', tiers: [] }),
  ] });
  data.sourcingLeads = [l];
  eq(S.candidateHasPrice(l.candidates[0]), false, 'sjs was found but not priced');

  const priced = { supplierName: 'sjs', role: 'supplier', where: 'kikuubo', phone: '',
    supplierId: null, unit: 'Pc', packUnit: 'Ctn', packQty: 12,
    tiers: rungs([1, 9000], [12, 8000]) };
  eq(S.applyCandidateFields(l, 'SJS', priced), true, 'saving with a candidate selected CHANGES it');
  eq(l.candidates.length, 1, 'so there is still ONE row for that shop, not two');
  eq(l.candidates[0].id, 'SJS', 'keeping its id');
  eq(l.candidates[0].at, '2026-08-01T00:00:00.000Z', 'and the date it was first found');
  eq(S.candidateHasPrice(l.candidates[0]), true, 'and now it has a price');
  eq(S.leadFacts(l).price, true, 'which is what unlocks the next step');

  eq(S.applyCandidateFields(l, null, Object.assign({}, priced, { supplierName: 'Meggo' })), false,
    'saving with nothing selected adds a new one');
  eq(l.candidates.length, 2, 'so a genuinely different supplier is its own row');
  // An id that no longer exists must not silently update the wrong row.
  eq(S.applyCandidateFields(l, 'GONE', Object.assign({}, priced, { supplierName: 'Third' })), false,
    'and an id that is no longer on the list adds rather than overwriting somebody else');
  eq(l.candidates.length, 3, 'as its own row');

  /* Two rows for one shop would let the comparison rank the same
     supplier twice, which is the practical cost of getting this wrong. */
  const twice = lead({ candidates: [
    cand({ id: 'A', supplierName: 'sjs', tiers: rungs([1, 9000]) }),
    cand({ id: 'B', supplierName: 'sjs', tiers: rungs([1, 9000]) }),
  ] });
  eq(S.sourcingRankedAt(twice, 1).length, 2,
    'two rows for one shop really would be ranked twice — which is why editing must not create one');

  /* The form has to SAY which it is about to do, or "Add what you found"
     sits above a form pointed at a row and the next press reads as a
     second supplier. Run against a fake DOM, not read. */
  const nodes = {};
  ['sl_add_cand', 'sl_cand_cancel', 'sl_cand_form'].forEach((i)=>{
    nodes[i] = { textContent: '', style: {},
      classList: { _s: new Set(), toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
        has(c) { return this._s.has(c); } } };
  });
  const mode = compileScope([
    'let editingCandidateId = null;',
    // The placement half is DOM-only; the mode half is what says which
    // job the form is doing, and that is what this checks.
    'function slCandFormPlace(){}',
    extractFunction(src, 'slCandFormMode', 'index.html'),
    'function __set(v){ editingCandidateId = v; }',
  ], { document: { getElementById: (i)=> nodes[i] } }, ['slCandFormMode', '__set']);
  mode.__set('SJS'); mode.slCandFormMode();
  eq(nodes.sl_add_cand.textContent, 'Save changes', 'with a row selected the button says it will change it');
  eq(nodes.sl_cand_cancel.style.display, '', 'and there is a way out of editing');
  t.check(nodes.sl_cand_form.classList.has('editing'), 'and the form is visibly pointed at a row');
  mode.__set(null); mode.slCandFormMode();
  eq(nodes.sl_add_cand.textContent, 'Add what you found', 'with none selected it says it will add');
  eq(nodes.sl_cand_cancel.style.display, 'none', 'and the way out is put away');
  t.check(!nodes.sl_cand_form.classList.has('editing'), 'and the form looks like a blank again');

  /* Two guards that live in click handlers, read from the handlers
     themselves because the compiled scope cannot drive a click. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // 'click' by name: sl_candidates carries an 'input' listener too (the
  // compare quantity), and slicing on the element alone takes whichever
  // comes first in the file.
  const delHandler = (/getElementById\('sl_candidates'\)\.addEventListener\('click'[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/editingCandidateId === del\.dataset\.candDel\) slCandFormClear\(\)/.test(delHandler),
    'deleting the row being edited clears the form, or its next save adds the deleted row straight back');
  const addHandler = (/getElementById\('sl_add_cand'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
  t.check(/rememberLocation\(document\.getElementById\('sl_c_where'\)/.test(addHandler),
    'a place typed on a candidate joins the shop\'s places, so "kikuubo" and "Kikuubo" stay one place');

  /* The form OPENS INSIDE the row being edited, so with a dozen
     suppliers you type under the one you clicked -- and pressing the
     same row again puts it away. */
  t.check(/editingCandidateId === edit\.dataset\.candEdit\) slCandFormClear\(\);/.test(delHandler),
    'the edit button is a toggle — pressing it on the open row closes it');
  const place = extractFunction(src, 'slCandFormPlace', 'index.html');
  t.check(/data-editor=/.test(place) && /sl_add_slot/.test(place),
    'the one form is moved to the row being edited, or to the add fold when adding');

  /* THE ORDER THAT MATTERS. The form is a live element carrying this
     screen's listeners, and while a row is open it lives inside the list.
     Rebuilding the list with innerHTML while it is in there destroys it
     and every listener with it -- the next press would do nothing at all
     -- so it is lifted out first and put back after. */
  const bodyFn = extractFunction(src, 'renderSourcingLeadBody', 'index.html');
  const iPark = bodyFn.indexOf("sl_add_slot').appendChild");
  const iWipe = bodyFn.indexOf("sl_candidates').innerHTML");
  const iBack = bodyFn.indexOf('slCandFormPlace()');
  t.check(iPark > -1 && iWipe > -1 && iBack > -1 && iPark < iWipe && iWipe < iBack,
    'the form is lifted out BEFORE the list is rebuilt and put back after, or it is destroyed mid-edit');
}

/* ---------- 3g. the sizes it comes in --------------------------------- */
{
  /* Seven products in ten in this shop are variable -- runners in six
     lengths across four types, sofa legs in three heights and three
     finishes. A funnel that could only ever make a `simple` product made
     the wrong shape most of the time. */
  resetAll();
  const sized = (attrs, reqs) => lead({ variantAttrs: attrs, requests: reqs || [] });

  eq(S.leadHasVariants(lead()), false, 'an item with no size list is one thing at one price');
  const runners = sized([{ name: 'Size', values: ['10"', '12"', '14"'] }]);
  eq(S.leadHasVariants(runners), true, 'and one with a size list is not');
  eq(S.leadVariantCombos(runners).length, 3, 'three sizes are three variants');

  // Two lists CROSS, exactly as the product form crosses them.
  const crossed = sized([
    { name: 'Type', values: ['Soft Close', 'Ordinary'] },
    { name: 'Size', values: ['10"', '12"', '14"'] },
  ]);
  eq(S.leadVariantCombos(crossed).length, 6, 'two lists cross into a matrix, not a concatenation');
  eq(JSON.stringify(S.leadVariantCombos(crossed)[0]), JSON.stringify({ Type: 'Soft Close', Size: '10"' }),
    'and each variant carries every attribute, which is what the product model reads');

  // Junk in the list is not a size.
  eq(S.leadVariantAttrs(sized([{ name: '', values: ['10"'] }])).length, 0, 'an unnamed list is not a list');
  eq(S.leadVariantAttrs(sized([{ name: 'Size', values: [] }])).length, 0, 'and a named one with nothing in it is not either');
  eq(S.leadVariantAttrs(sized([{ name: 'Size', values: ['10"', '  ', '12"'] }]))[0].values.length, 2,
    'blanks between the commas are dropped');

  /* WHICH size people asked for. Six asks for runners is a reason to
     stock runners; five of those being 14 inch is a reason to stock the
     14 inch and leave the rest -- and a count on the item cannot say so. */
  const asked = sized([{ name: 'Size', values: ['10"', '14"'] }], [
    ask({ customerId: 'C1', variant: '14"' }), ask({ customerId: 'C2', variant: '14"' }),
    ask({ customerId: 'C5', variant: '14"' }),
    ask({ customerId: 'C3', variant: '10"' }), ask({ customerId: 'C4' }),
  ]);
  const d = S.leadDemandByVariant(asked);
  eq(d.rows.length, 2, 'the breakdown has a row per size somebody named');
  eq(d.rows[0].variant, '14"', 'most-asked first, which is the one worth stocking');
  eq(d.rows[0].asks, 3, 'counted per size');
  eq(d.unspecified, 1,
    'and an ask that named no size is counted apart, not spread across the sizes as demand nobody expressed');
  eq(S.leadDemandByVariant(lead()).rows.length, 0, 'nothing asked for, nothing to break down');

  // The picker offers sizes from the list AND ones people have asked for,
  // since the second is how the first usually gets written.
  const choices = S.leadVariantChoices(sized([{ name: 'Size', values: ['10"'] }],
    [ask({ variant: '18"' }), ask({ variant: '10"' })]));
  t.check(choices.includes('10"') && choices.includes('18"'), 'the size picker offers both what is listed and what was asked for');
  eq(choices.filter((v) => v === '10"').length, 1, 'without repeating one that is on both');

  // The size has to survive CAPTURE, or every door records a sizeless ask.
  resetAll();
  const cap = S.captureSourcingLead({ name: 'drawer runners', variant: ' 14" ', customerId: 'C1' });
  eq(cap.lead.requests[0].variant, '14"', 'the size a door captured travels onto the ask, trimmed');
  eq(S.captureSourcingLead({ name: 'drawer runners', customerId: 'C2' }).lead.requests[1].variant, '',
    'and an ask that named none records none rather than undefined');

  /* The size lists use the PRODUCT MODAL's attribute editor, not a
     second one. The copy that stood here first lacked its preset
     auto-fill -- typing "Colour" filling in the colours the shop has
     used before -- which is the part that earns the control. */
  t.check(/renderVariantAttrRows\(\{[\s\S]{0,200}wrapId: 'sl_var_attrs'/.test(src),
    'the funnel drives the product modal\'s own attribute editor');
  t.check(!/class="sf-var-name"/.test(src) && !/class="sf-var-values"/.test(src),
    'and keeps no second copy of it');
  const attrEditor = extractFunction(src, 'renderVariantAttrRows', 'index.html');
  t.check(/presetAttributes/.test(attrEditor),
    'so both screens get the preset auto-fill, which is why it was worth sharing');
  t.check(/const rows = \(opts && opts\.rows\) \|\| draftVariantAttrs;/.test(attrEditor),
    'pointed at whichever list its caller passes, defaulting to the product form\'s');

  /* And the list SAVES. The footer button it used to rely on is hidden
     on an existing lead, so the sizes were typed and lost -- it writes
     through onChange now, like the name, notes and assignee beside it. */
  t.check(/onChange: saveSlVarAttrs/.test(src), 'the editor reports changes');
  const saveVar = extractFunction(src, 'saveSlVarAttrs', 'index.html');
  t.check(/l\.variantAttrs = slVarParsed\(\);/.test(saveVar) && /saveData\(\);/.test(saveVar),
    'and each change is written to the lead and saved, with no button to press');

  /* The funnel drives the Price Registry's OWN bulk editor, pointed at
     this candidate's arrays -- which is what lets a researched supplier
     carry a ladder, a packing and a code per size, exactly as a priced
     one does. A second editor would have captured less. */
  const surface = extractFunction(src, 'slCandBulkSurface', 'index.html');
  ['slCandOverrides', 'slCandPackOverrides', 'slCandSkus', 'slCandTiers'].forEach((k) =>
    t.check(new RegExp(`=> ${k},`).test(surface), `the surface reads the candidate's ${k}`));
  t.check(/getOverrides: \(\)=>/.test(surface) && /getTiers: \(\)=>/.test(surface),
    'as accessors, not references — prTiers and the override arrays are REASSIGNED, and a held reference would edit a list nothing renders');
  t.check(/leadVariantCombos\(l\)\.map\(combo=> \(\{combo\}\)\)/.test(surface),
    'against this lead\'s own sizes, in the shape the product model uses');
  t.check(/renderPrBulkVariantRows\(surface\)/.test(extractFunction(src, 'renderSlCandBulk', 'index.html')),
    'and renders through the Registry\'s editor rather than one of its own');
  /* And a bare call still means the price form, or sharing the editor
     would have cost the screen it came from its own state. */
  t.check(/const S = surface \|\| prBulkPriceSurface\(\);/
    .test(extractFunction(src, 'renderPrBulkVariantRows', 'index.html')),
    'a bare call is still the Price Registry\'s own surface');

  /* THE ORDER of the handoff. selectPrSupplier re-derives the shared
     ladder from what that supplier already has for this product -- which
     for one created seconds ago is nothing, so it clears it. Everything
     the funnel learned must go in AFTER, and the cards must be redrawn by
     the function that repaints from the current ladder rather than the
     one that works it out again. Both were wrong first time: the form
     opened with the price blank. */
  const handoff = extractFunction(src, 'openBulkPricingFor', 'index.html');
  const iSup = handoff.indexOf('selectPrSupplier(');
  const iTiers = handoff.indexOf('prTiers =');
  t.check(iSup > -1 && iTiers > iSup,
    'the researched ladder is put in AFTER the supplier is chosen, or choosing the supplier wipes it');
  t.check(/renderPrBulkVariantRows\(\)/.test(handoff) && !/renderPrBulkVariants\(\)/.test(handoff),
    'and the cards are repainted from that ladder, not rebuilt by re-deriving it');
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

  /* --- the allocator repeating itself, on graduation's two entities. A
     product sharing an id owns another product's prices and stock; a
     supplier sharing one owns their invoices. */
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1, 900]) })] })]);
  data.products = [{ id: 'P050', name: 'Already here' }];
  data.suppliers = [{ id: 'S050', name: 'Already here' }];
  forcedId = { P: 'P050', S: 'S050' };
  await S.graduateSourcingLead('SRC-1', { name: 'New thing', supplierName: 'Brand new', tiers: rungs([1, 900]) });
  forcedId = null;
  eq(new Set(data.products.map((p) => p.id)).size, data.products.length,
    'a re-issued product id is stepped over rather than taken, so no two products share one');
  t.check(data.products[1].id !== 'P050', `and the new product is not the old one (${data.products[1].id})`);
  eq(new Set(data.suppliers.map((s) => s.id)).size, data.suppliers.length,
    'and the same for the supplier it created');

  /* --- a lead with sizes graduates into a VARIABLE product, and its
     prices are a matrix the Price Registry's bulk form exists to fill.
     Writing one price row here would put a figure against one variant
     and leave the other twenty-one blank, which is worse than leaving it
     unpriced. */
  resetAll([lead({ status: 'priced', name: 'Runners',
    variantAttrs: [{ name: 'Type', values: ['Soft Close', 'Ordinary'] },
      { name: 'Size', values: ['10"', '12"', '14"'] }],
    candidates: [cand({ tiers: rungs([1, 8000]), unit: 'Pc' })] })]);
  calls.bulk = null;
  const varOut = await S.graduateSourcingLead('SRC-1', {
    name: 'Runners', supplierName: 'Roto', tiers: rungs([1, 8000]), unit: 'Pc',
  });
  const madeProduct = data.products[0];
  eq(madeProduct.type, 'variable', 'a lead with sizes makes a variable product');
  eq(madeProduct.variants.length, 6, 'with one variant per combination of its lists');
  eq(madeProduct.variantAttributes.length, 2, 'carrying the attributes the research recorded');
  t.check(!!madeProduct.variants[0].sku, 'and each variant gets a sku, as the product form gives them');
  /* Every variant is priced, not one of them. The shared ladder covers
     the ones the supplier quoted no separate figure for, so the product
     arrives usable instead of arriving empty. */
  eq(data.prices.length, 6, 'every variant gets a price row, not one of six');
  eq(varOut.variantsPriced, 6, 'and the caller is told how many');
  eq(JSON.stringify(data.prices.map((r) => r.variantIdx)), JSON.stringify([0, 1, 2, 3, 4, 5]),
    'each against its own variant, in the product\'s own order');
  t.check(data.prices.every((r) => r.supplierId === data.suppliers[0].id),
    'all from the supplier the comparison chose');
  t.check(data.prices.every((r) => JSON.stringify(r.tiers) === JSON.stringify(rungs([1, 8000]))),
    'each following the shared ladder, since this supplier quoted no size separately');
  eq(varOut.priceId, null, 'there is no single price id, because there is no single price');
  eq(varOut.handedOff, true, 'because it was handed to the form built for a matrix');
  t.check(!!calls.bulk && calls.bulk.productId === madeProduct.id,
    'which is opened against the product just created');
  eq(calls.bulk.supplierId, data.suppliers[0].id, 'with the supplier the comparison chose');
  eq(JSON.stringify(calls.bulk.packing.tiers), JSON.stringify(rungs([1, 8000])),
    'and the ladder the research found, so nothing is retyped');
  eq(data.sourcingLeads[0].status, 'listed', 'the lead is listed — the product exists');

  /* Everything the Price Registry can say about a variant, the funnel can
     say too -- its own ladder, its own packing, the supplier's own code.
     A researched supplier that captured less would graduate into a
     product missing exactly that, which is the whole point of sharing the
     editor rather than writing a lesser one. */
  resetAll([lead({ status: 'priced', name: 'Runners',
    variantAttrs: [{ name: 'Size', values: ['10"', '12"', '14"'] }],
    candidates: [cand({ tiers: rungs([1, 8000]), unit: 'Pc', packQty: 12, packUnit: 'Ctn',
      variantOverrides: [null, rungs([1, 9000]), null],
      packOverrides: [null, null, { unit: 'Pc', packUnit: 'Ctn', packQty: 6 }],
      skus: [null, null, 'RUN-14-RT'] })] })]);
  await S.graduateSourcingLead('SRC-1', {
    name: 'Runners', supplierName: 'Roto', tiers: rungs([1, 8000]),
    unit: 'Pc', packUnit: 'Ctn', packQty: 12,
    variantOverrides: [null, rungs([1, 9000]), null],
    packOverrides: [null, null, { unit: 'Pc', packUnit: 'Ctn', packQty: 6 }],
    skus: [null, null, 'RUN-14-RT'],
  });
  const byV = data.prices.slice().sort((a, b) => a.variantIdx - b.variantIdx);
  eq(byV.length, 3, 'every size is priced');
  eq(JSON.stringify(byV[0].tiers), JSON.stringify(rungs([1, 8000])),
    'a size left alone follows the shared ladder');
  eq(JSON.stringify(byV[1].tiers), JSON.stringify(rungs([1, 9000])),
    'a size given its own ladder keeps it');
  eq(byV[2].packQty, 6, 'a size packed differently keeps its own pack size');
  eq(byV[0].packQty, 12, 'while the others keep the shared one');
  eq(byV[2].supplierSku, 'RUN-14-RT', 'and the supplier\'s own code for that size survives');
  eq(byV[0].supplierSku, '', 'with none invented for the sizes that had none');
  /* Derived against the packing the row ENDS UP with. Costing the 6-per-
     carton size against the shared 12 is exactly how a bulk rate goes
     missing, and it is why both screens build rows through one function. */
  eq(byV[2].wholesale, S.deriveWholesaleRetail(byV[2].tiers, 6).wholesale,
    'and its wholesale split is derived against ITS packing, not the shared one');

  // A lead with no sizes still takes the single-price path.
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1, 900]) })] })]);
  calls.bulk = null;
  await S.graduateSourcingLead('SRC-1', { name: 'One thing', supplierName: 'S', tiers: rungs([1, 900]) });
  eq(data.products[0].type, 'simple', 'an item with no sizes is still a simple product');
  eq(data.prices.length, 1, 'and still gets its one price written here');
  eq(calls.bulk, null, 'with no detour through the bulk form');

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
  /* The lead's own screen answers "where has this got to" with the SAME
     stage rail the order preview draws -- one builder, two pipelines, so
     the two screens cannot drift into looking like different products.
     Run, not read: the rail must mark what is behind, what it is on, and
     what is still to come. */
  const steps = compileScope([
    extractDeclaration(src, 'SOURCING_STATUSES', 'index.html'),
    extractDeclaration(src, 'SOURCING_STATUS_ORDER', 'index.html'),
    extractDeclaration(src, 'SOURCING_SHORT_LABELS', 'index.html'),
    extractFunction(src, 'stageStepsHTML', 'index.html'),
    extractFunction(src, 'sourcingStepsHTML', 'index.html'),
  ], { esc: (s) => String(s == null ? '' : s), savedAgoLabel: () => '2 days ago' },
  ['sourcingStepsHTML']);
  const statesFor = (status) => [...steps.sourcingStepsHTML({ status, stageEnteredAt: 1 })
    .matchAll(/class="op-step (\w+)"/g)].map((m) => m[1]).join(',');
  eq(statesFor('asked'), 'now,todo,todo,todo,todo', 'a brand-new item has the whole funnel ahead of it');
  eq(statesFor('sourced'), 'done,done,now,todo,todo', 'a sourced one shows what is behind and what is left');
  eq(statesFor('listed'), 'done,done,done,done,now', 'and a listed one has nothing left to come');
  eq((steps.sourcingStepsHTML({ status: 'sourced', stageEnteredAt: 1 }).match(/op-step-since/g) || []).length, 1,
    'only the step it is actually on says how long it has been there');
  t.check(/stageStepsHTML\(SOURCING_STATUS_ORDER, SOURCING_STATUSES, SOURCING_SHORT_LABELS/.test(src)
    && /stageStepsHTML\(SQ_STATUS_ORDER, SQ_STATUSES, ORDER_STATUS_SHORT_LABELS/.test(src),
    'both pipelines hand their own constants to the one shared builder');
  t.check(/sl_steps'\)\.innerHTML = sourcingStepsHTML\(l\)/.test(src),
    'and the rail is redrawn with the body, so it cannot lag a change that just made the next stage reachable');

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

  /* The 30-second background refresh replaces `data` wholesale and then
     redraws through goToTab(), which renders ONE screen and no badges at
     all -- so a lead somebody else put into Sourcing sat uncounted on
     this rail until the page was reloaded. Read from the poll's own
     source, because the bug was that the call was absent from it. */
  const poll = extractFunction(src, 'pollForUpdatesNow', 'index.html');
  t.check(/refreshNavBadges\(\)/.test(poll),
    'the background refresh re-counts the rail badges, not just the visible screen');
  const badges = extractFunction(src, 'refreshNavBadges', 'index.html');
  ['updateOrderStatusBar', 'updateDebtorsNavBadge', 'renderSourcingBadge'].forEach((fn) =>
    t.check(new RegExp(`${fn}\\(\\)`).test(badges),
      `and ${fn} is one of the counts it refreshes — all three go stale the same way`));
  t.check(/refreshNavBadges\(\)/.test(extractFunction(src, 'renderAll', 'index.html')),
    'and a full render still refreshes them too');

  /* Reads survive a column that is not there yet -- the mapper sees
     undefined. WRITES do not: PostgREST rejects the whole upsert for one
     unknown column, so every sourcing lead would fail to save between
     this deploying and 0073 being applied by hand. Verified against the
     live database, which rejected it. */
  t.check(/sb\.from\('sourcing_leads'\)\.select\('variant_attrs'\)\.limit\(1\)/.test(src),
    'the sizes column is probed at load rather than assumed');
  t.check(/sourcingVariantColumn = !\(variantColR && variantColR\.error\);/.test(src),
    'and the answer recorded, re-probed by every refresh so it heals itself once the migration lands');
  t.check(/\.\.\.\(sourcingVariantColumn \? \{variant_attrs: l\.variantAttrs\|\|\[\]\} : \{\}\)/.test(src),
    'and the field is left out of the write until it exists, or one missing column fails the whole save');
  const mig73 = read('supabase/migrations/0073_sourcing_lead_variants.sql');
  t.check(/add column if not exists variant_attrs jsonb/.test(mig73),
    'the migration adds it idempotently');

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
