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
let landOnly = null;              // [supplierId] — only these suppliers reach "the server"

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
  landOnly = null;
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
      // `landOnly` is a PARTIAL landing: one supplier of several reaches
      // the server and the rest do not. saveData really can do this --
      // it fires every op at once and commits each one on its own result
      // -- so "did they all land" is a question with a real answer.
      data.suppliers.forEach((s) => {
        if (landOnly && !landOnly.includes(String(s.id))) return;
        lastSynced.suppliers[String(s.id)] = s;
      });
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
  extractFunction(src, 'piecesPerUnitOrNull', 'index.html'),
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
  extractFunction(src, 'candidateLowestTier', 'index.html'),
  extractFunction(src, 'leadVariantAttrs', 'index.html'),
  extractFunction(src, 'leadHasVariants', 'index.html'),
  extractFunction(src, 'leadVariantCombos', 'index.html'),
  extractFunction(src, 'leadVariantChoices', 'index.html'),
  extractFunction(src, 'leadDemandByVariant', 'index.html'),
  extractFunction(src, 'leadDemandQty', 'index.html'),
  extractFunction(src, 'lowestQuotedQty', 'index.html'),
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
  extractFunction(src, 'supNormalisedName', 'index.html'),
  extractFunction(src, 'supFindDuplicate', 'index.html'),
  extractFunction(src, 'candidateSupplierNote', 'index.html'),
  extractFunction(src, 'resolveCandidateSuppliers', 'index.html'),
  extractFunction(src, 'preferredCandidate', 'index.html'),
  extractFunction(src, 'mergeCandidatesBySupplier', 'index.html'),
  extractFunction(src, 'candidateRowCount', 'index.html'),
  extractFunction(src, 'graduatePackingSeed', 'index.html'),
  extractFunction(src, 'graduateSourcingLead', 'index.html'),
  extractFunction(src, 'searchTokens', 'index.html'),
  extractFunction(src, 'matchesAllTokens', 'index.html'),
  extractDeclaration(src, 'SOURCING_LISTED_PAGE', 'index.html'),
  extractFunction(src, 'listedSupplierCount', 'index.html'),
  extractFunction(src, 'sourcingOutcomeSuppliers', 'index.html'),
  extractFunction(src, 'listedAge', 'index.html'),
  extractFunction(src, 'listedLeads', 'index.html'),
  extractFunction(src, 'sourcingBoardLeads', 'index.html'),
  extractFunction(src, 'renderSourcingBadge', 'index.html'),
  extractFunction(src, 'sourcingFindCustomerByName', 'index.html'),
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
  'candidateTiers', 'candidateHasPrice', 'candidateVariantOverrides', 'candidateUnitPriceAt', 'candidateLowestTier',
  'leadDemandQty', 'lowestQuotedQty', 'sourcingRankedAt', 'sourcingBestAt', 'sourcingDefaultGraduateCandidate',
  'leadVariantAttrs', 'leadHasVariants', 'leadVariantCombos', 'leadVariantChoices', 'leadDemandByVariant',
  'sourcingStepGuide', 'sourcingViewedStep', 'sourcingWantsPriceForm', 'sourcingWantsCompare', 'sourcingResolveAsker', 'sourcingFindCustomerByName',
  'applyCandidateFields',
  'supNormalisedName', 'supFindDuplicate', 'candidateSupplierNote',
  'resolveCandidateSuppliers', 'preferredCandidate', 'mergeCandidatesBySupplier',
  'candidateRowCount', 'listedSupplierCount', 'listedAge', 'listedLeads',
  'sourcingOutcomeSuppliers',
  'graduatePackingSeed',
]);
// compileScope only hands back functions, so the cap is read from source.
// Reading it rather than restating it means the claim below is about
// whatever the lane actually uses.
const LISTED_PAGE = Number((/const SOURCING_LISTED_PAGE = (\d+);/.exec(src) || [])[1]);

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
  /* CLAIM CHANGED, deliberately. This used to read "Priced asks only who
     to buy from", which was true when graduation banked one supplier and
     threw the rest away. It banks all of them now, so the only decision
     left on this step is whether to stock the thing at all. */
  eq(guide('priced').show.join(), 'compare', 'Priced asks only whether it is worth stocking');
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

  /* The comparison is what the stock/don't-stock decision needs: the
     money tied up at the quantity being asked for, and the spread.
     Earlier than Priced it appears only once there are two prices to
     weigh -- a one-row table tells you nothing you did not just type. */
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

  /* The quantity the panel OPENS at. Falling back to 1 when nobody said
     how many they wanted meant a lead whose only quote starts at a
     carton opened on "nobody has quoted for 1" -- a step headed "decide
     whether it is worth stocking" showing nothing to decide from. */
  const fromCarton = [cand({ id: 'A', unit: 'Dozen', packQty: 20, packUnit: 'Ctn',
    tiers: rungs([20, 1500]) })];
  eq(S.lowestQuotedQty(lead({ candidates: fromCarton })), 20,
    'the least anybody actually quotes for is known');
  eq(S.lowestQuotedQty(lead({ candidates: [cand({ tiers: [] })] })), null,
    'and is nothing when nobody has quoted at all');
  /* The lowest deliberately sits on the SECOND supplier and not on the
     first supplier's own lowest tier -- with it on the first, reading
     only that one supplier returns the same answer and the sweep across
     them is never exercised. */
  eq(S.lowestQuotedQty(lead({ candidates: [
    cand({ id: 'A', tiers: rungs([60, 900], [24, 1000]) }),
    cand({ id: 'B', tiers: rungs([12, 950]) })] })), 12,
    'across every supplier, not just the first');
  eq(S.lowestQuotedQty(lead({ candidates: [
    cand({ id: 'A', tiers: rungs([60, 900], [24, 1000]) })] })), 24,
    'and across every tier on a supplier, not just the one they listed first');

  /* Demand still wins when there is any -- "can we serve what people
     asked for" is the question the step exists to answer. */
  t.check(/const qty = sourcingCompareQty != null \? sourcingCompareQty\s*\n\s*: \(demand > 0 \? demand : \(lowestQuotedQty\(l\) \|\| 1\)\);/.test(src),
    'the panel opens at the demand, or failing that at the lowest quantity anybody quoted');

  /* And a quantity that clears nobody names the one that would, which is
     what makes "their minimum order is bigger than the demand" readable
     as a reason not to stock the thing. */
  const cmpEmpty = extractFunction(src, 'sourcingCompareHTML', 'index.html');
  t.check(/The least anybody sells is <b>\$\{esc\(String\(lowestQuotedQty\(l\)\)\)\} \$\{esc\(unit\)\}<\/b>/.test(cmpEmpty),
    'a quantity nobody clears says what the minimum actually is');
  t.check(/No prices on file yet\./.test(cmpEmpty),
    'and says so plainly when there are no prices at all rather than naming a minimum that does not exist');
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
  /* MECHANISM CHANGED, claim kept. A second accent button now lives in
     this footer -- sl_save, which creates a lead -- but the two are
     mutually exclusive, so the footer still never SHOWS two primaries.
     Counting the markup could not tell "two buttons" from "two buttons
     at once", so the exclusivity is what gets pinned instead. */
  t.check((foot.match(/btn-accent/g) || []).length === 2,
    'and the only other accent in it belongs to the other mode');
  t.check(/document\.getElementById\('sl_save'\)\.style\.display = l \? 'none' : '';/.test(src),
    'create shows only while there is no lead yet');
  t.check(/<button class="btn btn-accent" id="sl_cta" style="display:none;"><\/button>/.test(src),
    'while the step button starts hidden');
  const stepView = extractFunction(src, 'applySourcingStepView', 'index.html');
  t.check(/document\.getElementById\('sl_save'\)\.style\.display = 'none';/.test(stepView)
    && /btn\.style\.display = showCta \? '' : 'none';/.test(stepView),
    'and viewing a lead hides create in the same pass that decides the step button — never both at once');

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
  /* Even with nobody to compare against, the table still has to end in a
     sentence -- one quoted supplier IS what this quantity costs. */
  t.check(/Only <b>\$\{esc\(best\.candidate\.supplierName/.test(cmp),
    'a single quoted supplier still gets a verdict rather than silence');
  /* The whole-order saving is only worth saying when it differs from the
     per-unit one. At a quantity of one it is the same figure twice. */
  t.check(/qty > 1 \? `, \$\{fmtUGX\(best\.savesPerUnit \* qty\)\}/.test(cmp),
    'and the order-total saving is dropped at a quantity of one, where it repeats itself');

  /* The step reports who is cheapest; it does not tell the shop who to
     buy from. Once graduation banks every supplier found, an imperative
     here says the opposite of what the button does -- it reads as this
     table choosing one and discarding the others. */
  // Comments out first: the one explaining this very change quotes the
  // old wording, and would trip the check it exists to justify.
  const cmpUi = cmp.replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, '');
  t.check(/is cheapest at this quantity/.test(cmpUi),
    'the cheapest row is reported as a fact about the quantity');
  t.check(!/Buy from/.test(cmpUi),
    'and not as an instruction to buy from one of them, which is not what this step decides any more');
  const pricedStep = S.sourcingStepGuide(lead({ status: 'priced' }));
  t.check(!/who to buy it from/.test(pricedStep.need), `the step guide asks whether to stock it, not who to buy it from (${pricedStep.need})`);
  t.check(/every supplier/.test(pricedStep.ctaWhy) && !/first price/.test(pricedStep.ctaWhy),
    `the button explains that it banks every supplier, not "its first price" (${pricedStep.ctaWhy})`);

  /* The sweep, so the imperative cannot creep back in somewhere else.
     Comments are stripped with the guarded opener -- prose about buying
     from a supplier is legitimate there, and a bare opener would match
     accept="image/*" and blank the region being scanned. */
  const funnelUi = src
    .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map(l=> l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(!/Buy from <b>|Buy from \$\{/.test(funnelUi),
    'and nothing anywhere tells the shopkeeper to buy from one named supplier');

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

  /* The shared ladder is the Registry's tier row, word for word and
     control for control -- it calls these tiers, so this calls them
     tiers, and the unit dropdowns are built from the packing set above
     rather than reading "pieces / packs" whatever the goods actually
     are. A carton figure filed as a per-piece one is the cost of getting
     that wrong. */
  const tierRow = extractFunction(src, 'renderSlCandTiers', 'index.html');
  t.check(/tierUnitOptionsHTML\(unit, packUnit, packQty\)/.test(tierRow),
    'the funnel builds its unit dropdowns from the packing above, through the Registry\'s own builder');
  t.check(/prTierChipLabel\(t, unit, packUnit, packQty\)/.test(tierRow),
    'and labels its chips with the Registry\'s own label, so "1 Ctn+" means one thing in both places');
  t.check(/sel\.value = \(prev === 'pack' && hasPack\) \? 'pack' : 'unit';/.test(tierRow),
    'keeping "per pack" across a redraw only while there is still a pack');
  /* One vocabulary, checked by subtraction rather than by listing the
     phrasings I happened to think of -- the first version of this check
     listed five and missed two sentences that were on screen.

     Comments come out first. Prose about ladders legitimately says rung,
     and a comment on this codebase also says it meaning telephoned. The
     block-comment strip needs the lookbehind: a bare opener matches the
     accept="image/*" attribute, which then swallows everything to the
     next real close -- and it swallowed the very label this is about,
     so the check passed while the label said "rung".

     Then the sf-rung* CSS classes, which keep the word for a reason.
     Subtracting a bare `rungs` too was a hole: it removed the plural from
     ordinary prose as readily as from a variable, so a sentence reading
     "No rungs yet" passed. The locals were renamed instead, which is why
     only the class names are subtracted now -- whatever is left is
     English the shopkeeper can read, and there should be none. */
  const funnelSrc = src
    .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/).map(l=> l.replace(/(?<!:)\/\/.*$/, '')).join('\n')
    .replace(/sf-rungs?\b/g, '');
  t.check(!/rung/i.test(funnelSrc),
    'and nothing calls them rungs — the Registry says tiers, so the funnel says tiers');

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

/* ---------- 7. graduation banks everybody, and the second save is gated */
{
  // --- the happy path
  resetAll([lead({ status: 'priced', name: 'Sofa Legs Chrome 4"',
    candidates: [cand({ tiers: rungs([1,15000],[12,13500],[60,12000]), unit: 'Pc', packQty: 12, packUnit: 'Ctn' })] })]);
  const out = await S.graduateSourcingLead('SRC-1', {
    name: 'Sofa Legs Chrome 4"', category: 'Furniture Fittings', subcategory: 'Legs',
    candidates: data.sourcingLeads[0].candidates,
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

  /* --- EVERY supplier the research found, not the cheapest one.

     This is the whole point of the funnel: the Price Registry is where
     the shop's knowledge of who sells what lives, and Compare Prices can
     only ever compare who is in it. Banking one supplier and discarding
     the other two assumes today's cheapest is permanently cheapest --
     and the day they put their price up there is nothing on file to
     notice with, so the same three shops get rung again from scratch. */
  resetAll([lead({ status: 'priced', name: 'Padlock 50mm', candidates: [
    cand({ id: 'C1', supplierName: 'Shafik', tiers: rungs([1, 9000]), unit: 'Pc', packQty: 12, packUnit: 'Ctn' }),
    cand({ id: 'C2', supplierName: 'Meggo',  tiers: rungs([1, 8500]), unit: 'Pc', packQty: 24, packUnit: 'Ctn' }),
    cand({ id: 'C3', supplierName: 'Kabuye', tiers: rungs([1, 11000]), unit: 'Pc', packQty: 12, packUnit: 'Ctn' }),
  ] })]);
  const many = await S.graduateSourcingLead('SRC-1', {
    name: 'Padlock 50mm', candidates: data.sourcingLeads[0].candidates, unit: 'Pc',
  });
  eq(data.suppliers.length, 3, 'all three suppliers are created, not just the cheapest');
  eq(data.prices.length, 3, 'and all three get a price row');
  eq(many.suppliersPriced, 3, 'and the caller is told how many suppliers were banked');
  eq(many.rowsWritten, 3, 'and how many rows that came to');
  eq(new Set(data.prices.map(r=> r.supplierId)).size, 3, 'one row each, against their own supplier');
  eq(JSON.stringify(data.prices.map(r=> r.retail).sort((a,b)=> a-b)), JSON.stringify([8500, 9000, 11000]),
    'each carrying the figure that supplier actually quoted');
  /* Their OWN packing. Two shops sell the same padlock twelve and
     twenty-four to the carton, and costing the second against the first's
     carton is how a bulk rate comes out at nearly double what was
     agreed. */
  const meggo = data.prices.find(r=> r.supplierId === data.suppliers[1].id);
  eq(meggo.packQty, 24, 'costed against the pack size THAT supplier gave, not the form default');
  eq(data.prices.find(r=> r.supplierId === data.suppliers[0].id).packQty, 12,
    'while the first keeps their own');

  // Unticking one is the opt-out: it is simply not in the list handed over.
  resetAll([lead({ status: 'priced', name: 'Padlock 50mm', candidates: [
    cand({ id: 'C1', supplierName: 'Shafik', tiers: rungs([1, 9000]), unit: 'Pc' }),
    cand({ id: 'C2', supplierName: 'Meggo',  tiers: rungs([1, 8500]), unit: 'Pc' }),
  ] })]);
  await S.graduateSourcingLead('SRC-1', {
    name: 'Padlock 50mm', unit: 'Pc',
    candidates: data.sourcingLeads[0].candidates.filter(c=> c.id === 'C1'),
  });
  eq(data.suppliers.length, 1, 'an unticked supplier is not created');
  eq(data.prices.length, 1, 'and gets no price row');
  eq(data.suppliers[0].name, 'Shafik', 'only the one that was ticked');

  /* --- somebody who has it but never quoted.

     "Kabuye in Nakawa stocks it" is exactly the knowledge the research
     exists to produce, and it is worth nothing sealed inside a lead. So
     they become a supplier record. What they do NOT get is a price row:
     there is no price, and a figure nobody quoted is not one to invent. */
  resetAll([lead({ status: 'priced', name: 'Hinge 4"', candidates: [
    cand({ id: 'C1', supplierName: 'Shafik', tiers: rungs([1, 9000]), unit: 'Pc' }),
    cand({ id: 'C2', supplierName: 'Kabuye', tiers: [], where: 'Nakawa', role: 'importer' }),
  ] })]);
  const mixed = await S.graduateSourcingLead('SRC-1', {
    name: 'Hinge 4"', candidates: data.sourcingLeads[0].candidates, unit: 'Pc',
  });
  eq(data.suppliers.length, 2, 'the one who never quoted is still recorded — that is the knowledge');
  eq(data.prices.length, 1, 'but no price row is invented for them');
  eq(mixed.suppliersPriced, 1, 'and the count of who was priced says so');
  const quiet = data.suppliers.find(s=> s.name === 'Kabuye');
  eq(quiet.location, 'Nakawa', 'with where they were found');
  t.check(/never quoted a price/.test(quiet.notes || ''),
    `and a note saying why they have no price (${quiet.notes})`);
  t.check(/Imports it/.test(quiet.notes || ''),
    'and which side of the trade they are on — the importer sets the floor, the shop in Kikuubo is who you buy from');

  /* --- a name already on file is that supplier, not a second one.

     The supplier form has a whole warning built to stop a second
     "Kikuubo Hardware" being created, because once there are two, every
     list shows both with the prices on one and the invoices on the other.
     It would be absurd for the funnel to create the duplicate the form
     refuses -- so it asks the same question with the same function. */
  resetAll([lead({ status: 'priced', name: 'Nails 4"', candidates: [
    cand({ id: 'C1', supplierName: 'Kikuubo  Hardware', tiers: rungs([1, 6000]), unit: 'Kg' }),
  ] })]);
  data.suppliers = [{ id: 'S001', name: 'Kikuubo Hardware', notes: 'known already' }];
  await S.graduateSourcingLead('SRC-1', {
    name: 'Nails 4"', candidates: data.sourcingLeads[0].candidates, unit: 'Kg',
  });
  eq(data.suppliers.length, 1, 'a supplier already on file is reused, not duplicated');
  eq(data.prices[0].supplierId, 'S001', 'and the price row goes to the one that was there');
  eq(data.suppliers[0].notes, 'known already', 'whose own record is left alone');

  // The same name typed into two candidate rows is one business.
  resetAll([lead({ status: 'priced', name: 'Nails 4"', candidates: [
    cand({ id: 'C1', supplierName: 'Meggo', tiers: rungs([1, 6000]), unit: 'Kg', at: '2026-08-01T00:00:00.000Z' }),
    cand({ id: 'C2', supplierName: 'meggo ', tiers: rungs([1, 5500]), unit: 'Kg', at: '2026-08-09T00:00:00.000Z' }),
  ] })]);
  const dup = await S.graduateSourcingLead('SRC-1', {
    name: 'Nails 4"', candidates: data.sourcingLeads[0].candidates, unit: 'Kg',
  });
  eq(data.suppliers.length, 1, 'one supplier, however many rows named them');
  /* pr_save's rule is one row per product+variant+supplier and it
     REPLACES on save -- so writing both would have the second silently
     overwrite the first, and which one survived would come down to array
     order. Settled here instead, and the later quote is the current one. */
  eq(data.prices.length, 1, 'and one price row, not two racing to overwrite each other');
  eq(data.prices[0].retail, 5500, 'the later quote wins — a supplier changing their price replaces it');
  eq(dup.rowsWritten, 1, 'and the caller is told what was actually written');

  /* And a quote beats no quote, whichever order the two rows are in.
     Somebody recorded at Looking with no price and found again later
     with one must not have the priceless row win the merge and take the
     price down with it. Note the dates are set so the PRICELESS row is
     the later one -- otherwise "the later wins" would carry this on its
     own and the rule under test would never be reached. */
  for(const order of [['quiet', 'priced'], ['priced', 'quiet']]){
    const rows = {
      quiet: cand({ id: 'C1', supplierName: 'Meggo', tiers: [], at: '2026-08-09T00:00:00.000Z' }),
      priced: cand({ id: 'C2', supplierName: 'Meggo', tiers: rungs([1, 5500]), unit: 'Kg', at: '2026-08-01T00:00:00.000Z' }),
    };
    resetAll([lead({ status: 'priced', name: 'Nails 4"',
      candidates: order.map(k=> rows[k]) })]);
    await S.graduateSourcingLead('SRC-1', {
      name: 'Nails 4"', candidates: data.sourcingLeads[0].candidates, unit: 'Kg',
    });
    eq(data.prices.length, 1, `one row whichever way round the two were recorded (${order[0]} first)`);
    eq(data.prices[0].retail, 5500, 'and it is the row that actually has a price that survives');
  }

  // A supplier who only sells by the carton has no retail rate, and one
  // is not invented for them.
  resetAll([lead({ status: 'priced',
    candidates: [cand({ tiers: rungs([12,13500]), unit: 'Pc', packQty: 12, packUnit: 'Ctn' })] })]);
  await S.graduateSourcingLead('SRC-1', { name: 'Bulk only',
    candidates: data.sourcingLeads[0].candidates, unit: 'Pc', packQty: 12, packUnit: 'Ctn' });
  eq(data.prices[0].retail, null, 'nobody quoted a single piece, so there is no retail rate to claim');
  eq(data.prices[0].wholesale, 13500, 'only the bulk one they actually gave');

  // And graduation still refuses a ladder with nothing on it.
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1,900]) })] })]);
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X', candidates: [cand({ tiers: [] })] }), null,
    'an empty ladder is no price at all');
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X', candidates: [cand({ tiers: rungs([1,0]) })] }), null,
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
  await S.graduateSourcingLead('SRC-1', { name: 'New thing',
    candidates: data.sourcingLeads[0].candidates });
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
  await S.graduateSourcingLead('SRC-1', { name: 'New thing',
    candidates: [cand({ supplierName: 'Brand new', tiers: rungs([1, 900]) })] });
  forcedId = null;
  eq(new Set(data.products.map((p) => p.id)).size, data.products.length,
    'a re-issued product id is stepped over rather than taken, so no two products share one');
  t.check(data.products[1].id !== 'P050', `and the new product is not the old one (${data.products[1].id})`);
  eq(new Set(data.suppliers.map((s) => s.id)).size, data.suppliers.length,
    'and the same for the supplier it created');

  /* The allocator repeating itself is the NORMAL case once a graduation
     creates several suppliers in one loop: the server hands out the same
     number twice in the same breath, and two of the shop's suppliers end
     up sharing a record. Guarding only the first would put the second and
     third on top of each other. */
  resetAll([lead({ status: 'priced', candidates: [
    cand({ id: 'C1', supplierName: 'One', tiers: rungs([1, 900]) }),
    cand({ id: 'C2', supplierName: 'Two', tiers: rungs([1, 950]) }),
    cand({ id: 'C3', supplierName: 'Three', tiers: rungs([1, 990]) }),
  ] })]);
  forcedId = { S: 'S001' };
  await S.graduateSourcingLead('SRC-1', { name: 'Three shops',
    candidates: data.sourcingLeads[0].candidates });
  forcedId = null;
  eq(data.suppliers.length, 3, 'three suppliers found, three records');
  eq(new Set(data.suppliers.map(s=> s.id)).size, 3,
    'each with its own id, though the allocator proposed the same one every time');

  /* --- a lead with sizes graduates into a VARIABLE product, and every
     size is priced by every supplier who quoted it. */
  resetAll([lead({ status: 'priced', name: 'Runners',
    variantAttrs: [{ name: 'Type', values: ['Soft Close', 'Ordinary'] },
      { name: 'Size', values: ['10"', '12"', '14"'] }],
    candidates: [cand({ tiers: rungs([1, 8000]), unit: 'Pc' })] })]);
  calls.bulk = null;
  const varOut = await S.graduateSourcingLead('SRC-1', {
    name: 'Runners', candidates: data.sourcingLeads[0].candidates, unit: 'Pc',
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
  eq(varOut.rowsWritten, 6, 'and the caller is told how many');
  eq(JSON.stringify(data.prices.map((r) => r.variantIdx)), JSON.stringify([0, 1, 2, 3, 4, 5]),
    'each against its own variant, in the product\'s own order');
  t.check(data.prices.every((r) => r.supplierId === data.suppliers[0].id),
    'all from the supplier who quoted them');
  t.check(data.prices.every((r) => JSON.stringify(r.tiers) === JSON.stringify(rungs([1, 8000]))),
    'each following the shared ladder, since this supplier quoted no size separately');
  eq(varOut.priceId, null, 'there is no single price id, because there is no single price');
  eq(data.sourcingLeads[0].status, 'listed', 'the lead is listed — the product exists');
  /* The bulk form used to open every time. On a matrix where every size
     is already priced that handed the admin a form to fill in that was
     already filled in, and the honest reading of it was "this did not
     work". It now opens only for what is actually missing. */
  eq(varOut.handedOff, undefined, 'nothing was handed off — there is nothing left to fill in');
  eq(calls.bulk, null, 'so the bulk form is not opened over a product that is fully priced');

  // A size nobody priced IS a gap, and that is what the bulk form is for.
  resetAll([lead({ status: 'priced', name: 'Runners',
    variantAttrs: [{ name: 'Size', values: ['10"', '12"', '14"'] }],
    candidates: [cand({ tiers: [], unit: 'Pc',
      variantOverrides: [rungs([1, 8000]), rungs([1, 8500]), null] })] })]);
  calls.bulk = null;
  const gapOut = await S.graduateSourcingLead('SRC-1', {
    name: 'Runners', candidates: data.sourcingLeads[0].candidates, unit: 'Pc',
  });
  eq(data.prices.length, 2, 'only the sizes somebody actually quoted are written');
  eq(gapOut.unpricedSlots, 1, 'and the one nobody priced is counted');
  eq(gapOut.handedOff, true, 'which IS handed to the form built for a matrix');
  t.check(!!calls.bulk && calls.bulk.productId === data.products[0].id,
    'opened against the product just created');
  eq(calls.bulk.supplierId, data.suppliers[0].id, 'with the supplier the comparison chose');

  /* A size whose own ladder is all zeros is a size the admin deliberately
     cleared -- the same reading pr_save gives an emptied variant card --
     so it is skipped rather than quietly falling back to the shared
     ladder and being priced at a figure nobody set for it. And because
     the supplier here DOES have a shared ladder, this is the case that
     shows the handoff carrying the research across rather than opening
     an empty form. */
  resetAll([lead({ status: 'priced', name: 'Runners',
    variantAttrs: [{ name: 'Size', values: ['10"', '12"', '14"'] }],
    candidates: [cand({ tiers: rungs([1, 8000]), unit: 'Pc', packQty: 12, packUnit: 'Ctn',
      variantOverrides: [null, rungs([1, 0]), null] })] })]);
  calls.bulk = null;
  const zeroed = await S.graduateSourcingLead('SRC-1', {
    name: 'Runners', candidates: data.sourcingLeads[0].candidates, unit: 'Pc', packQty: 12, packUnit: 'Ctn',
  });
  eq(data.prices.length, 2, 'a zero is not a price, so that size gets no row');
  eq(JSON.stringify(data.prices.map(r=> r.variantIdx)), JSON.stringify([0, 2]),
    'and it is the cleared one that is missing, not a neighbour');
  eq(zeroed.unpricedSlots, 1, 'which counts as a gap');
  eq(JSON.stringify(calls.bulk.packing.tiers), JSON.stringify(rungs([1, 8000])),
    'and the form it hands to opens carrying the ladder the research found, so nothing is retyped');
  eq(calls.bulk.packing.packQty, 12, 'and that supplier\'s own pack size with it');

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
    name: 'Runners', candidates: data.sourcingLeads[0].candidates,
    unit: 'Pc', packUnit: 'Ctn', packQty: 12,
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
  await S.graduateSourcingLead('SRC-1', { name: 'One thing',
    candidates: data.sourcingLeads[0].candidates });
  eq(data.products[0].type, 'simple', 'an item with no sizes is still a simple product');
  eq(data.prices.length, 1, 'and still gets its one price written here');
  eq(data.prices[0].variantIdx, null, 'against no variant, because there are none');
  eq(calls.bulk, null, 'with no detour through the bulk form');

  /* The simple row goes through the SAME builder the variant rows do.
     It used to be assembled separately, and had already drifted: it
     hardcoded a blank supplier code, so a simple product graduated
     without what the supplier calls it -- the one thing you need to ring
     them and order. */
  resetAll([lead({ status: 'priced', candidates: [
    cand({ tiers: rungs([1, 900]), unit: 'Pc', supplierSku: 'SHF-PAD-50' })] })]);
  await S.graduateSourcingLead('SRC-1', { name: 'One thing',
    candidates: data.sourcingLeads[0].candidates, unit: 'Pc' });
  eq(data.prices[0].supplierSku, 'SHF-PAD-50',
    'a simple product carries the supplier\'s own code, exactly as a variant row does');

  // --- the gate: phase one did not reach the server
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1,15000]) })] })]);
  saveLands = false;
  const off = await S.graduateSourcingLead('SRC-1', {
    name: 'Sofa Legs', candidates: data.sourcingLeads[0].candidates, unit: 'Pc',
  });
  eq(calls.saves, 1, 'the second save never happens');
  eq(data.prices.length, 0,
    'and NO price row is pushed for a product the server has not got — that is a foreign key waiting to fail');
  eq(off.priceId, null, 'the caller is told there is no price yet');
  t.check(calls.toasts.some((m) => /Price Registry/.test(m)),
    'and the admin is told in words, rather than handed a sync failure for a row that was never valid to send');
  eq(data.sourcingLeads[0].status, 'listed',
    'the product WAS created, so the lead is honest about being listed');

  /* One supplier missing is ALL prices withheld. A half-written registry
     is worse than an empty one: nothing on screen says which half made
     it, so the admin cannot tell what still needs entering. */
  resetAll([lead({ status: 'priced', candidates: [
    cand({ id: 'C1', supplierName: 'One', tiers: rungs([1, 900]) }),
    cand({ id: 'C2', supplierName: 'Two', tiers: rungs([1, 950]) }),
  ] })]);
  await S.graduateSourcingLead('SRC-1', { name: 'Two shops',
    candidates: data.sourcingLeads[0].candidates });
  const landedBoth = data.prices.length;
  resetAll([lead({ status: 'priced', candidates: [
    cand({ id: 'C1', supplierName: 'One', tiers: rungs([1, 900]) }),
    cand({ id: 'C2', supplierName: 'Two', tiers: rungs([1, 950]) }),
  ] })]);
  landOnly = ['S001'];              // the second supplier never reaches the server
  await S.graduateSourcingLead('SRC-1', { name: 'Two shops',
    candidates: data.sourcingLeads[0].candidates });
  landOnly = null;
  eq(landedBoth, 2, 'with both suppliers landed, both are priced');
  eq(data.prices.length, 0,
    'with one of them missing, NEITHER is priced — not the one that made it and half a registry');

  // --- graduation refuses what it cannot make sense of
  resetAll([lead({ status: 'priced', candidates: [cand({ tiers: rungs([1,15000]) })] })]);
  eq(await S.graduateSourcingLead('SRC-1', { name: '  ', candidates: [cand({ tiers: rungs([1,100]) })] }), null,
    'a product with no name is refused');
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X', candidates: [cand({ tiers: [] })] }), null,
    'and one where nobody quoted — "Priced" recorded a figure, so there is one to carry');
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X', candidates: [] }), null,
    'and one with nobody ticked at all');
  eq(await S.graduateSourcingLead('SRC-1', { name: 'X',
    candidates: [cand({ supplierName: '  ', supplierId: null, tiers: rungs([1,100]) })] }), null,
    'and one where the only row does not say who has it');
  eq(data.products.length, 0, 'none of which created anything');
}

/* ---------- 7b. the Listed lane, at a hundred items ------------------ */
{
  /* Listed is the only terminal stage -- nothing ever moves out of it --
     so it is the one lane that grows without bound. Drawn as cards it was
     about 120px an item, which at a hundred listed items is a lane twelve
     thousand pixels long carrying stage arrows and a graduate button that
     mean nothing on something already listed. */
  const many = [];
  for(let i=1; i<=40; i++){
    many.push(lead({ id: 'SRC-'+i, name: 'Item '+i, status: 'listed',
      productId: 'P'+String(i).padStart(3,'0'),
      graduatedAt: new Date(Date.UTC(2026, 0, i)).toISOString() }));
  }
  resetAll(many);
  const all = S.listedLeads(S.sourcingBoardLeads(), '');
  eq(all.length, 40, 'every listed item is in the lane\'s list');
  eq(all[0].name, 'Item 40', 'newest first — the reason to look here is nearly always something recent');
  t.check(LISTED_PAGE > 0 && LISTED_PAGE < 40 && all.slice(0, LISTED_PAGE).length === LISTED_PAGE,
    `and it is capped at ${LISTED_PAGE}, so the lane is bounded however many are listed`);
  t.check(/const shown = sourcingListedShowAll \? all : all\.slice\(0, SOURCING_LISTED_PAGE\);/.test(src),
    'with the cap applied where the rows are drawn, not merely declared');

  /* The search is what answers "have we already done this one?". It is
     the app's own searchTokens/matchesAllTokens rule -- every token has
     to appear SOMEWHERE in the haystack, as a substring -- so one search
     box in this app behaves like the next. That is why "Item 7" is four
     hits and not one: 17, 27 and 37 all contain a 7, which is what a
     substring search means and what the supplier bar does too. */
  eq(S.listedLeads(S.sourcingBoardLeads(), 'Item 40').length, 1, 'searching by name finds the one');
  eq(S.listedLeads(S.sourcingBoardLeads(), 'Item 7').length, 4,
    'a substring search matches as a substring — 7, 17, 27 and 37');
  eq(S.listedLeads(S.sourcingBoardLeads(), 'P012').length, 1, 'and searching by product id finds it too');
  eq(S.listedLeads(S.sourcingBoardLeads(), 'nothing like this').length, 0, 'and a miss is a miss');
  eq(S.listedLeads(S.sourcingBoardLeads(), '  ').length, 40, 'whitespace is not a search');

  // Only listed items. The other four lanes are still work, and still cards.
  resetAll([lead({ id: 'SRC-1', status: 'listed', productId: 'P001', graduatedAt: '2026-01-01T00:00:00.000Z' }),
    lead({ id: 'SRC-2', status: 'priced' }), lead({ id: 'SRC-3', status: 'asked' })]);
  eq(S.listedLeads(S.sourcingBoardLeads(), '').length, 1, 'a lane for listed items holds only listed items');

  /* "N suppliers on file" is the knowledge graduation now banks, shown
     where the board can be scanned. Read from the registry rather than
     the lead's own candidates, because a row added by hand afterwards is
     just as true as one the funnel wrote. */
  resetAll([lead({ id: 'SRC-1', status: 'listed', productId: 'P001' })]);
  data.prices = [
    { productId: 'P001', supplierId: 'S001', variantIdx: 0 },
    { productId: 'P001', supplierId: 'S001', variantIdx: 1 },
    { productId: 'P001', supplierId: 'S002', variantIdx: 0 },
    { productId: 'P999', supplierId: 'S003', variantIdx: null },
  ];
  eq(S.listedSupplierCount(data.sourcingLeads[0]), 2,
    'two suppliers, not four rows — the question is who has it, not how many sizes they priced');
  eq(S.listedSupplierCount(lead({ productId: null })), 0, 'and nothing to count without a product');

  /* The Listed step said "2 prices on file" and stopped. A count of rows
     is the one fact on that screen nobody can act on -- the names are
     what you ring when the shelf is empty, and they are exactly what the
     research spent its time producing. */
  resetAll([]);
  data.suppliers = [{ id: 'S1', name: 'sjs' }, { id: 'S2', name: 'Stuart Star' }];
  data.prices = [
    { productId: 'P354', supplierId: 'S2', variantIdx: null, unit: 'Bundle', retail: 65000, wholesale: null },
    { productId: 'P354', supplierId: 'S1', variantIdx: null, unit: 'Bundle', retail: 50000, wholesale: null },
    { productId: 'P999', supplierId: 'S1', variantIdx: null, unit: 'Bundle', retail: 10, wholesale: null },
  ];
  const who = S.sourcingOutcomeSuppliers('P354');
  eq(who.length, 2, 'every supplier with a row for it is named');
  eq(who.map(x=> x.id).join(), 'S1,S2', 'cheapest first — that is who to ring');
  eq(who[0].from, 50000, 'with the rate they start at');
  eq(who[0].unit, 'Bundle', 'in the unit that rate is per');

  /* With sizes there is a row per size. "from 1,500" is the honest
     summary of twenty-two of them; naming one size's price as the item's
     would be picking a number out of the matrix. */
  data.prices = [0, 1, 2].map(i=> ({ productId: 'P354', supplierId: 'S1',
    variantIdx: i, unit: 'Dozen', wholesale: 1500 + i * 100, retail: null }));
  const eachSize = S.sourcingOutcomeSuppliers('P354');
  eq(eachSize.length, 1, 'a supplier pricing three sizes is one supplier, not three');
  eq(eachSize[0].from, 1500, 'shown from their lowest rate, not whichever row came first');
  eq(eachSize[0].rows, 3, 'with how many sizes that covers');

  eq(S.sourcingOutcomeSuppliers('P000').length, 0, 'a product with no rows names nobody');

  /* And the panel has to actually draw them. The list existing as data
     while the screen still printed a count would leave the step exactly
     as uninformative as before. */
  const outcome = extractFunction(src, 'sourcingOutcomeHTML', 'index.html');
  t.check(/sourcingOutcomeSuppliers\(l\.productId\)/.test(outcome),
    'the Listed step reads who can supply it');
  t.check(/Who we can buy it from/.test(outcome) && /sf-outcome-sup-name/.test(outcome),
    'and names them on screen');
  t.check(!/\$\{rows\.length\} price\$\{rows\.length===1\?'':'s'\} on file/.test(outcome),
    'rather than reporting how many rows there are, which is the one fact there nobody can act on');
  t.check(/No prices on file for it yet/.test(outcome),
    'with a plain sentence when there are none, not an empty heading');
}

/* ---------- 7c. the manifest says what the button will do ------------ */
{
  /* The count on each row and the rows actually written are worked out
     by the same rule, because a manifest that promises four rows and
     writes three is worse than no manifest: the admin has no reason to
     go and look. */
  resetAll([lead({ status: 'priced', name: 'Runners',
    variantAttrs: [{ name: 'Size', values: ['10"', '12"', '14"'] }],
    candidates: [
      cand({ id: 'C1', supplierName: 'Roto', tiers: rungs([1, 8000]), unit: 'Pc' }),
      cand({ id: 'C2', supplierName: 'Meggo', tiers: [], unit: 'Pc',
        variantOverrides: [rungs([1, 7800]), null, null] }),
      cand({ id: 'C3', supplierName: 'Kabuye', tiers: [], unit: 'Pc' }),
    ] })]);
  const l = data.sourcingLeads[0];
  eq(S.candidateRowCount(l.candidates[0], l), 3, 'a shared ladder covers every size');
  eq(S.candidateRowCount(l.candidates[1], l), 1, 'one size quoted is one row');
  eq(S.candidateRowCount(l.candidates[2], l), 0, 'and no quote at all is no rows');
  const promised = l.candidates.reduce((n, c) => n + S.candidateRowCount(c, l), 0);
  await S.graduateSourcingLead('SRC-1', { name: 'Runners', candidates: l.candidates, unit: 'Pc' });
  eq(data.prices.length, promised,
    'and the total the manifest promised is exactly what graduation wrote');
  eq(data.suppliers.length, 3, 'while all three are still recorded as having it');

  // The same rule on an item with no sizes.
  resetAll([lead({ status: 'priced', candidates: [
    cand({ id: 'C1', tiers: rungs([1, 900]) }), cand({ id: 'C2', tiers: [] })] })]);
  const flat = data.sourcingLeads[0];
  eq(S.candidateRowCount(flat.candidates[0], flat), 1, 'a quote on a sizeless item is one row');
  eq(S.candidateRowCount(flat.candidates[1], flat), 0, 'and no quote is none');

  /* --- the fallback packing has to come from somebody who actually said
     how it is sold.

     A shop can quote a figure without ever saying per what. When that
     shop was the cheapest, the fallback prefilled blank from them and
     every supplier with no packing of their own got a price row with no
     unit -- the price right and nothing saying what the money buys. Seen
     on the real chains lead: sjs's row blank, Stuart Star's "Bundle". */
  const seedLead = lead({ candidates: [
    cand({ id: 'CHEAP', supplierName: 'sjs', unit: '', packUnit: '', packQty: 0, tiers: rungs([1, 50000]) }),
    cand({ id: 'SAID', supplierName: 'Stuart Star', unit: 'Bundle', packUnit: 'Ctn', packQty: 6, tiers: rungs([1, 65000]) }),
  ]});
  eq(S.graduatePackingSeed(seedLead, 'CHEAP').id, 'SAID',
    'the cheapest said nothing about packing, so the fallback comes from the one who did');
  eq(S.graduatePackingSeed(seedLead, 'SAID').id, 'SAID',
    'and when the cheapest DID say, it is theirs — the nearest answer wins');

  /* Which needs BOTH of them to have said, and the cheapest to be second
     in the list. With only one candidate carrying a unit, "prefer the
     cheapest" and "take the first who said" return the same row and the
     rule under test is never reached -- which is exactly how the first
     version of this check passed a mutant that dropped the preference. */
  const bothSaid = lead({ candidates: [
    cand({ id: 'FIRST', unit: 'Ctn', packUnit: 'Bag', packQty: 12, tiers: rungs([1, 70000]) }),
    cand({ id: 'CHEAPEST', unit: 'Bundle', packUnit: 'Ctn', packQty: 6, tiers: rungs([1, 50000]) }),
  ]});
  eq(S.graduatePackingSeed(bothSaid, 'CHEAPEST').id, 'CHEAPEST',
    'with two of them having said, it is the cheapest one\'s packing, not whoever was recorded first');

  /* Whole triple, never field by field. A unit borrowed from one supplier
     beside a pack size borrowed from another describes a packing neither
     of them quoted, which is worse than the blank it replaces. */
  const seed = S.graduatePackingSeed(seedLead, 'CHEAP');
  eq(`${seed.unit}/${seed.packUnit}/${seed.packQty}`, 'Bundle/Ctn/6',
    'and it is one supplier\'s whole packing, not three fields gathered from wherever each was found');

  // Somebody who never quoted still told you how it is sold.
  const quietSaid = lead({ candidates: [
    cand({ id: 'CHEAP', unit: '', tiers: rungs([1, 50000]) }),
    cand({ id: 'QUIET', unit: 'Bundle', packUnit: 'Ctn', packQty: 6, tiers: [] }),
  ]});
  eq(S.graduatePackingSeed(quietSaid, 'CHEAP').id, 'QUIET',
    'a supplier who named the unit but never quoted is still who to take it from');

  // Nobody said anything: there is nothing to seed with, and it does not
  // invent one — the field is left for the admin, which is what it is for.
  const nobody = lead({ candidates: [cand({ id: 'A', unit: '' }), cand({ id: 'B', unit: '' })] });
  eq(S.graduatePackingSeed(nobody, 'A').id, 'A', 'with nobody having said, the preferred one is still returned');
  eq(S.graduatePackingSeed(lead({ candidates: [] }), 'A'), null, 'and no candidates at all seeds nothing');

  t.check(/fillGraduateFromCandidate\(graduatePackingSeed\(l, graduateCandidateId\)\)/.test(src),
    'and the form is prefilled through it, not from the cheapest candidate directly');
}

/* ---------- 7d. the screen this is all driven from ------------------- */
{
  /* Ticks, not a radio. The radio WAS the bug: it made the screen a
     contest to find the cheapest supplier, when the job is recording
     everyone who has it. */
  t.check(/<input type="checkbox" name="sg_cand"/.test(src),
    'the graduation manifest is checkboxes — every supplier found gets banked');
  t.check(!/type="radio" name="sg_cand"/.test(src),
    'and not a radio, which could only ever bank one');
  t.check(/graduatePickedIds = new Set\(\(l\.candidates\|\|\[\]\)\.map\(c=> c\.id\)\)/.test(src),
    'everybody starts ticked, priced or not — unticking is the exception');
  t.check(/candidates: \(l\.candidates\|\|\[\]\)\.filter\(c=> graduatePickedIds\.has\(c\.id\)\)/.test(src),
    'and the candidates themselves are handed over, not fields copied off one of them');

  /* The new-item screen. Its whole job is one question, and the screen
     used to give that question the same weight as four optional boxes
     beside it -- with "(optional)" written on all four, which is four
     words saying one thing and none of them saying why it is worth
     filling in. */
  // HTML comments out: the one explaining this change quotes the very
  // word the check forbids, and would fail the assertion it justifies.
  const askBlock = (/<div id="sl_first_ask">[\s\S]*?<\/div>\s*<\/div>/.exec(src) || [''])[0]
    .replace(/<!--[\s\S]*?-->/g, '');
  t.check(!/\(optional\)/.test(askBlock),
    'no label on the first-ask row says "(optional)" — it was on all four, so it distinguished nothing');
  t.check(/<label class="sf-rung-label">Who asked for it<\/label>/.test(askBlock),
    'the four are grouped under one heading instead of floating loose');
  t.check(/different<\/b> people asked/.test(askBlock),
    'and the group says WHY it is worth filling in — the count is of people, not asks');

  /* Sized by what each box holds. The shared .form-grid is auto-fit at
     minmax(160px,1fr), which gave a name, a phone, a size and a count
     four equal columns -- so the customer placeholder truncated while a
     two-digit quantity had room going spare. */
  t.check(/class="sf-ask-grid"/.test(askBlock) && !/class="form-grid"/.test(askBlock),
    'the row is its own proportioned grid, not the shared equal-column one');
  const askGridRule = (/\.sf-ask-grid\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/grid-template-columns:minmax\(0,2\.1fr\) minmax\(0,1\.5fr\) minmax\(0,1fr\) minmax\(0,0\.9fr\)/.test(askGridRule),
    'with the name column widest and the quantity narrowest');
  t.check(/@media \(max-width:560px\)\{\s*\.sf-ask-grid\{grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\);\}/.test(src),
    'and it folds to two columns on a phone rather than staying four');

  /* The primary action looked exactly like the escape hatch: both ghost,
     side by side. On a screen that exists to add one thing, the thing it
     adds gets the accent. */
  t.check(/<button class="btn btn-accent" id="sl_save">/.test(src),
    'the new-item action is the accent button, not a ghost twinned with Close');
  t.check(/<button class="btn btn-ghost" id="sl_cancel">Close<\/button>/.test(src),
    'while Close stays quiet');

  // And the question is weighted only while it IS the question.
  t.check(/nameField\.classList\.toggle\('sf-lead-q', !l\)/.test(src),
    'the item box is enlarged on a new lead and back to ordinary on an existing one');

  /* The sentence explaining the step's finish line belongs BESIDE the
     button it explains. It used to close the scrolling body while its
     button was pinned in the footer, so it landed under whatever section
     rendered last -- on Asked For that was "Somebody else asked", and the
     screen read as though moving the item to Looking was what that button
     did. */
  const leadModal = (/<div class="modal-overlay" id="sourcingLeadModal">[\s\S]*?\n<\/div>/.exec(src) || [''])[0];
  const leadFoot = (/<div class="modal-foot">[\s\S]*?<\/div>/.exec(leadModal) || [''])[0];
  const leadBody = leadModal.replace(leadFoot, '');
  t.check(/id="sl_cta_why"/.test(leadFoot),
    'the step sentence is in the footer with the button it describes');
  t.check(!/id="sl_cta_why"/.test(leadBody),
    'and not left at the bottom of the body, captioning whichever button happened to render last');
  const whyRule = (/\.sf-cta-why\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/flex:1 1 180px/.test(whyRule) && /text-align:right/.test(whyRule),
    'it takes the leftover width so the buttons stay where the eye expects them');
  t.check(/@media \(max-width:560px\)\{\s*\.modal-foot\{flex-wrap:wrap;\}\s*\.sf-cta-why\{flex-basis:100%;order:-1;text-align:left;\}/.test(src),
    'and on a phone it takes its own line above them rather than squeezing them');

  /* Only applySourcingStepView ever shows it, and that never runs for a
     new lead -- so opening "Add an item" straight after reading an
     existing one left the previous lead's finish line in the footer of a
     form that has no step. */
  t.check(/if\(!l\) document\.getElementById\('sl_cta_why'\)\.style\.display = 'none';/.test(src),
    'and a new lead clears it, rather than inheriting the last lead\'s step sentence');

  /* The app's own icon system, which this very modal already uses for its
     tier button. A typed "+" and a typed tick were doing the job here --
     and a tick on an action reads as something already done. */
  ['sl_var_add', 'sl_var_gen', 'sl_add_ask'].forEach(id=>{
    const btn = (new RegExp('<button[^>]*id="' + id + '">[\\s\\S]*?</button>').exec(src) || [''])[0];
    t.check(/<svg class="icon"/.test(btn), `${id} carries an icon rather than a typed glyph`);
  });
  t.check(!/[+✓]\s*(Add attribute|Generate variants)/.test(src),
    'and no typed + or tick is left standing in for one');

  /* ctaWhy is shown ONLY when the step is not blocked -- the render is
     `blocked || guide.ctaWhy`, and SOURCING_GATES carries the "you cannot
     yet" sentence for the other case. So a ctaWhy written as a
     precondition appears exactly when that precondition is already met:
     an item with two suppliers on file and an enabled button still read
     "Needs at least one supplier or importer on file." */
  const stepGuide = (status)=> S.sourcingStepGuide(lead({ status }));
  ['asked','looking','sourced','priced'].forEach(status=>{
    const why = stepGuide(status).ctaWhy;
    t.check(!/^Needs\b/.test(why),
      `${status} explains what the button does rather than restating a condition already met (${why})`);
  });
  t.check(/moves it to Source Found/.test(stepGuide('looking').ctaWhy)
    && /moves it to Priced/.test(stepGuide('sourced').ctaWhy),
    'and the two that were preconditions now name the stage they move it to, as the other steps do');
  /* The requirement is not lost -- it moves to where it is true. */
  const noSupplier = lead({ status: 'looking', candidates: [] });
  t.check(/Add who has it first/.test(S.sourcingGateBlock(noSupplier, 'sourced')),
    'while the gate still says what is missing when it actually is');
  eq(S.sourcingGateBlock(lead({ status: 'looking',
    candidates: [cand({ role: 'supplier', tiers: [] })] }), 'sourced'), '',
    'and says nothing once somebody is on file');

  /* Three-across rows cannot hold a sentence. Measured in the running
     app at this modal's width: the boxes are 192px of usable space and
     "Pick a customer, or type a new name" needed 244, so it truncated
     mid-word -- as did the supplier and the place. */
  ['Pick a supplier, or type a new one', 'Choose a place, or type a new one',
   'Pick a customer, or type a new name'].forEach(long=>{
    t.check(!new RegExp('id="sl_(c_|ask2_)[a-z]+"[^>]*placeholder="' + long + '"').test(src),
      `no funnel field carries the over-long "${long}"`);
  });
  t.check(/id="sl_c_name"[^>]*placeholder="Pick or type a name"/.test(src)
    && /id="sl_c_where"[^>]*placeholder="Pick or type a place"/.test(src)
    && /id="sl_ask2_name"[^>]*placeholder="Pick or type a name"/.test(src),
    'they carry the short forms that fit the column they are in');
  /* The full-width fields elsewhere keep the longer wording, which still
     fits there -- this was a width problem, not a copy preference. */
  t.check(/id="s_location"[^>]*placeholder="Choose a place, or type a new one"/.test(src),
    'while the supplier modal, where the field is full width, keeps the fuller sentence');

  /* The board ages itself on a timer. renderSourcing rebuilds the whole
     board, which destroys the Listed search input along with whatever is
     half-typed into it and the caret -- so the tick stands down while it
     has focus. A minute of staleness on a "12d here" label is worth less
     than a keystroke. */
  t.check(/const q = document\.getElementById\('sf_listed_q'\);\s*\n\s*if\(q && document\.activeElement === q\) return;\s*\n\s*renderSourcing\(\);/.test(src),
    'the 60-second tick stands down while the Listed search is being typed into');
  /* And typing repaints only the rows. Repainting the lane would replace
     the input mid-word for the same reason. */
  t.check(/sourcingListedSearch = e\.target\.value;[\s\S]{0,220}?renderSourcingListedBody\(\);/.test(src)
    && !/sourcingListedSearch = e\.target\.value;[\s\S]{0,220}?renderSourcing\(\);/.test(src),
    'and typing into it refills the rows only, never the board that contains it');
}

/* ---------- 7d2. what the shop already knows, filled in --------------- */
{
  /* Picking a supplier or a customer the shop already has left the phone
     and the place blank, two tabs away from where they were recorded. So
     the number got typed again -- which is how a second, slightly
     different number ends up against one person and nobody knows which
     of the two rings -- or, more often, not typed at all. */
  resetAll([]);
  data.suppliers = [{ id: 'S1', name: 'Shafik Katwe', phone: '0758004696', location: 'Katwe' }];
  data.customers = [{ id: 'C1', name: 'Kaweke Bwaise', phone: '0754629578', location: 'Bwaise' }];

  eq((S.sourcingFindCustomerByName('Kaweke Bwaise') || {}).phone, '0754629578',
    'a customer already on file is found by the name in the box');
  eq(S.sourcingFindCustomerByName('kaweke bwaise').id, 'C1', 'however it was capitalised');
  eq(S.sourcingFindCustomerByName('Nobody At All'), null, 'and a new name matches nobody');
  eq(S.sourcingFindCustomerByName('   '), null, 'nor does a blank one');

  /* The box that fills itself in and the save that links the record must
     agree about who was meant, so they ask the same function. */
  const asked = await S.sourcingResolveAsker('Kaweke Bwaise', '');
  eq(asked.customerId, 'C1', 'the ask links to that same customer');
  eq(asked.phone, '0754629578',
    'and takes their number from the record when the box was left empty');
  eq((await S.sourcingResolveAsker('Kaweke Bwaise', '0700111222')).phone, '0700111222',
    'while a number actually typed outranks the one on file');
  t.check(/const hit = sourcingFindCustomerByName\(name\);/.test(
    extractFunction(src, 'sourcingResolveAsker', 'index.html')),
    'both go through one lookup, so they cannot disagree about who the name meant');

  /* The autofill only ever replaces its OWN work. Something typed by
     hand is the person's answer; a value the autofill put there is
     replaced when the name changes, so correcting a mis-picked supplier
     does not leave the first one's phone number behind. */
  const fill = extractFunction(src, 'sourcingAutofillKnown', 'index.html');
  t.check(/if\(el\.value && el\.dataset\.autofilled !== '1'\) return;/.test(fill),
    'a hand-typed value is left alone');
  t.check(/if\(val\) el\.dataset\.autofilled = '1'; else delete el\.dataset\.autofilled;/.test(fill),
    'and what the autofill wrote is marked, so the next name can replace it');
  const watch = extractFunction(src, 'sourcingWatchTypedOver', 'index.html');
  t.check(/addEventListener\('input', \(\)=> delete el\.dataset\.autofilled\)/.test(watch),
    'typing over an autofilled box takes it out of the autofill\'s care');

  /* All three name boxes, not just the one that was complained about. */
  ['sl_c_name', 'sl_ask_name', 'sl_ask2_name'].forEach(id=>{
    t.check(new RegExp("\\['" + id + "',").test(src), `${id} is wired to fill from what is on file`);
  });
  t.check(/nameEl\.addEventListener\('input', \(\)=>\s*\n?\s*sourcingAutofillKnown\(lookup\(nameEl\.value\), phoneEl, whereEl\)\);/.test(src),
    'on input, so choosing from the datalist fills immediately rather than waiting for blur');
  t.check(/\['sl_c_name',\s*'sl_c_phone',\s*'sl_c_where',\s*\(n\)=> supFindDuplicate\(n, null\)\]/.test(src),
    'and the supplier box uses the supplier form\'s own matching rule');

  /* Belt and braces at the save: a blank would put a supplier on the
     research screen with no way to ring them. */
  t.check(/phone: document\.getElementById\('sl_c_phone'\)\.value\.trim\(\) \|\| \(existing && existing\.phone\) \|\| ''/.test(src)
    && /where: where \|\| \(existing && existing\.location\) \|\| ''/.test(src),
    'and saving a candidate falls back to the linked supplier\'s own phone and place');
}

/* ---------- 7d3. a photo of the thing being sourced ------------------ */
{
  /* Most of what walks into this shop is described by a picture rather
     than a name -- somebody sends a photo of a hinge and asks whether it
     can be got. "makitah" typed in a box is not that photo, and whoever
     researches it a week later is working from the word. */
  t.check(/<img id="sl_image_preview"/.test(src) && /id="sl_image_btn"/.test(src),
    'the lead screen can carry a photo of what was asked for');
  t.check(/openMediaPicker\(\{ sessionTrack: true, onPick: m=> saveSourcingLeadImage\(m\.url\) \}\)/.test(src),
    'chosen through the library\'s own picker, so it de-duplicates against every photo the shop holds');

  /* The photo the research was done against IS the product's photo. */
  const grad = extractFunction(src, 'graduateSourcingLead', 'index.html');
  t.check(/image: lead\.image \|\| null,/.test(grad),
    'and it becomes the product\'s photo, rather than being found again by hand');

  /* A new lead must not inherit the last one's picture on a screen that
     saves as you go. */
  t.check(/if\(!l\) setSourcingLeadImage\(null\);/.test(src),
    'a new lead starts blank rather than showing the photo of the one before it');
  /* Chosen before the lead exists, there is nowhere to write it until
     the lead is created -- so it is carried over at that moment. */
  t.check(/const chosen = currentSourcingLeadImage\(\);\s*\n\s*if\(chosen\)\{ res\.lead\.image = chosen; saveData\(\); \}/.test(src),
    'and a photo picked before the item was added is not dropped when it is');

  /* 0074 is applied by hand, so the app has to work before it lands. A
     missing column reads as no photo, but PostgREST rejects an ENTIRE
     upsert for one unknown column -- so the field is omitted from the
     write until the probe says it exists. Confirmed in the running app:
     with 0073 applied and 0074 not, the probe reads true and false, and
     the row sent for a lead carries variant_attrs and no image. */
  t.check(/let sourcingImageColumn = false;/.test(src),
    'the image column is probed rather than assumed');
  t.check(/sb\.from\('sourcing_leads'\)\.select\('image'\)\.limit\(1\)/.test(src),
    'by asking for it');
  t.check(/sourcingImageColumn = !\(imageColR && imageColR\.error\);/.test(src),
    'on its own, since 0073 and 0074 can land in either order');
  t.check(/\.\.\.\(sourcingImageColumn \? \{image: l\.image\|\|null\} : \{\}\),/.test(src),
    'and it is left out of the write entirely until the column is there');
  t.check(/image: r\.image \|\| null,/.test(src),
    'while the read tolerates its absence as "no photo"');

  /* The library's usage index is what stops a photo being deleted out
     from under whatever points at it. A lead left out would read as
     "used nowhere". */
  const usage = extractFunction(src, 'mediaUsageIndex', 'index.html');
  t.check(/\(data\.sourcingLeads\|\|\[\]\)\.forEach\(l=> add\(l\.image, 'sourcing', l\.name\)\);/.test(usage),
    'a lead counts as a user of its photo, so the library will not delete it away');
  t.check(/u\.kind==='sourcing' \? `Being sourced — \$\{u\.name\}`/.test(src),
    'and says so in words when it refuses');
}

/* ---------- 7e. the two boards do not wear each other's colours ------ */
{
  /* They ran the same five hues: purple, amber, blue and green were
     byte-identical and only their order differed, so a purple card meant
     "Awaiting Goods" on one board and "Source Found" on the other.
     Sourcing is a ramp now and orders keeps its rainbow. */
  /* Comments stripped first: the one above this table quotes the order
     board's own grey to explain why the ramp cannot start that light,
     and an extractor reading raw source counts it as a sixth colour of
     this board's -- which is exactly what it did. */
  const hexes = (name)=> [...(new RegExp('const ' + name + ' = \\{[\\s\\S]*?\\n\\};')
    .exec(src) || [''])[0]
    .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, '')
    .matchAll(/#[0-9A-Fa-f]{6}/g)].map(m=> m[0].toUpperCase());
  const srcHues = hexes('SOURCING_STATUSES'), ordHues = hexes('SQ_STATUSES');
  eq(srcHues.length, 5, 'the sourcing board defines five step colours');
  eq(ordHues.length, 5, 'and so does the order board');
  eq(srcHues.filter(h=> ordHues.includes(h)).join(), '',
    'with not one hex shared between them');

  /* WHAT THIS ASSERTION USED TO SAY, AND WHY IT STOPPED BEING TRUE.

     It demanded that all five descend in luminance -- a ramp that does
     not descend is five mid-tones that happen to differ in hue, which is
     what the first attempt at this board was. That held while the five
     were the board's OWN colours: #818E9B through #11402E, none of them
     in the palette, argued for as a ramp deep enough to read as one.

     On screen it did not read as one. Four of the five were the same
     dark green at a glance, so the ramp bought nothing and cost the app
     four values §2 says it may not own. The board those colours painted
     is gone (the screen is a queue banded by what needs the owner, and
     the stage is five segments of ink on the row -- see .ow-sf-sg).
     What is left of these five is the lead's own stage rail and the
     graduation screen, through the shared stageStepsHTML.

     So the rule is stronger in one direction and deliberately weaker in
     another. STRONGER: every one of the five must now be a value the
     palette actually owns -- that is the check that would have stopped
     the original five, and no check here did. WEAKER: only the first
     four have to descend. The fifth is verdigris, which is LIGHTER than
     the ink above it on purpose, because reaching Listed is the good
     outcome and verdigris is what good means on every other screen in
     this app. A meaning is not a fifth step of a gradient. */
  const PALETTE = [...(/:root\{[\s\S]*?\n  \}/.exec(read('index.html')) || [''])[0]
    .matchAll(/#[0-9A-Fa-f]{6}/g)].map(m=> m[0].toUpperCase());
  const strays = srcHues.filter(h=> !PALETTE.includes(h));
  t.check(strays.length === 0,
    `every step colour is a value the palette owns${strays.length ? ' — strays ' + strays.join(', ') : ''}`);
  const lum = (hex)=>{
    const c = [1,3,5].map(i=> parseInt(hex.substr(i,2),16)/255)
      .map(v=> v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
    return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
  };
  const L = srcHues.slice(0, 4).map(lum);
  t.check(L.slice(1).every((v,i)=> v < L[i]),
    `the four working steps darken in order (${srcHues.slice(0,4).join(' → ')})`);
  /* Every one of them, not merely the lightest: they are drawn as dots
     and 5px rings, and a step nobody can see is a step that is not
     saying where the item has got to. */
  const onWhite = (hex)=> 1.05 / (lum(hex) + 0.05);
  const faint = srcHues.filter(h=> onWhite(h) < 3);
  t.check(faint.length === 0,
    `and every one clears 3:1 on white${faint.length ? ' — ' + faint.join(', ') : ''}`);
  eq(srcHues[4], '#1C6B58',
    'with the last one the shop\'s own verdigris, because reaching it is the good outcome');
}

/* ---------- 8. the two boards do not reach into each other ----------- */
{
  /* The sourcing board emits the same .sq-* markup on purpose -- that is
     how it inherits the order board's whole visual system instead of a
     second, unpinned copy of ~330 lines of CSS. The price of that is
     three document-wide queries, and this is the sweep that keeps them
     paid: a NEW unscoped one anywhere in the file fails here too. */
  // Guarded opener: a bare one matches accept="image/*" and then eats
  // everything to the next real close, which silently blanks the region
  // these negative checks are meant to be scanning.
  const code = src.replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, '');
  t.check(!/document\.querySelectorAll\('\.sq-check/.test(code),
    'no unscoped .sq-check query — "select all" must not tick the other board\'s cards');
  /* The orders board became a console and emits none of this vocabulary
     now, so it has nothing to scope. What is pinned is that it stays
     out: a .sq-* class creeping back into its render is how the scoping
     law would start mattering again. */
  t.check(!/sq-(check|board|card|stepper|col)/.test(extractFunction(src, 'renderSavedQuotes', 'index.html')),
    'the orders board emits none of the lane vocabulary, so there is nothing of its to scope');
  t.check(!/document\.querySelector\(`\.sq-board /.test(code),
    'and no unscoped .sq-board lane lookup — both sections are in the DOM at once, hidden rather than removed');
  t.check(/#savedQuotesWrap \.ow-ot-r\[data-id=/.test(code),
    'announceOrderMove finds the moved row on the ORDERS board, never a lane of the funnel\'s');

  /* THIS USED TO PIN A LANE BOARD'S SCROLL POSITION AND ACTIVE STEP.

     It was a real rule while there were lanes: seeding either value from
     the order board's would have made opening Sourcing land wherever
     Orders was last left. There are no lanes now -- the screen is a
     queue banded by what needs the owner, because the question it is
     opened with ("what do I push on today") crosses all five stages and
     no column can answer it.

     What survives of the rule is what it was protecting: this screen
     holds its own view state and reads none of the order board's. The
     state is now which row is open. */
  t.check(/let sourcingOpenId = null;/.test(code)
    && !/sourcingActiveMobileStep|sourcingBoardScrollLeft/.test(code),
    'the sourcing screen keeps its own open-row state and no lane state at all');
  t.check(!/let sqActiveMobileStep|let sqBoardScrollLeft/.test(code) && /let otStageLens = 'all';/.test(code),
    'and the order board keeps no lane state at all now -- its filter is a lens of its own');

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

  /* These two used to check that the rail and the lanes were BOTH built
     by mapping SOURCING_STATUS_ORDER, over the same already-filtered
     set. That was the guard against a stage existing in one and missing
     from the other, and against a dropped lead surviving in one of them.

     There is one place left that draws the stages -- the segment bar on
     the row -- so there is nothing left to keep in step with anything.
     The guard that still matters is that it is generated rather than
     enumerated: a bar that lists its stages by hand is one that will be
     wrong the next time a stage is added, which is exactly how the order
     board once shipped an Awaiting Goods lane no phone rule matched. */
  const stageBar = extractFunction(src, 'sourcingStageHTML', 'index.html');
  t.check(/SOURCING_STATUS_ORDER\.map\(/.test(stageBar)
    && !/'asked'|'looking'|'sourced'|'priced'/.test(stageBar),
    'the stage bar is generated from SOURCING_STATUS_ORDER, never a hand-written list of stages');
  const render = extractFunction(src, 'renderSourcing', 'index.html');
  /* Every band starts from sourcingBoardLeads(), which is what drops the
     voided ones -- so a dropped lead cannot survive in one band by being
     filtered in a different place from the others. */
  t.check(/const leads = sourcingBoardLeads\(\);/.test(render)
    && (render.match(/leads\.filter\(/g) || []).length >= 2
    && !/sourcingLeadsAll\(\)\.filter\(/.test(render),
    'and every band is filtered out of the one already-dropped-free set');
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
  // Membership, not adjacency. This read `'savedQuotes','sourcingLeads',
  // 'purchaseInvoices'` and broke the moment another collection was added
  // between them -- which says nothing about whether sourcingLeads is
  // still guarded, and that is the whole claim.
  t.check(/const absent = \[[^\]]*'sourcingLeads'[^\]]*\]\.filter\(k=> !data\[k\]\);/.test(src),
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
