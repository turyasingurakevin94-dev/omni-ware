#!/usr/bin/env node
'use strict';
/*
 * Make the Manager's questions land.
 *
 * The Manager may ask the shop for what no database holds, and the
 * market record it asks FOR could not hear the answer. It asked "What
 * does Haidery charge for Masasi 12 inch?", the owner typed 118,000,
 * and that became a sentence in a box: Rival prices still showed the
 * line as NEVER CHECKED, product_details still returned nothing, and
 * the next meeting could only read the sentence back as prose. The
 * shop had done the walk and the app had learned nothing from it.
 *
 * The cause was the same one the buy holds had: AN ASK CARRIED NO
 * IDENTITY. asks was the one member of the plan block with no shape at
 * all -- an array of bare strings -- so nothing downstream could tell
 * which line or which shop a question was about. holds had already
 * solved this by carrying a key the app resolves before it trusts it.
 *
 * Four laws here, and the third is the one that keeps it safe:
 *
 *   IDENTITY AT THE ASKING, NEVER PARSED AFTERWARDS  the line and the
 *       shop are resolved when the question is written, through the
 *       same validating reader the holds use. Nothing later guesses
 *       what a sentence was about.
 *   NAMED RATHER THAN DROPPED  an ask whose product has left the
 *       catalogue, an ask with a line but no shop, and a bare string
 *       from the old shape are all still questions. They simply cannot
 *       become sightings.
 *   ONLY A BARE FIGURE COUNTS  no price is scraped out of prose. The
 *       line and the shop come from the question; the amount must be
 *       the whole answer, or it is a note. "12 inch is 118,000" must
 *       file nothing, because a price read wrongly out of a sentence
 *       argues for the wrong shelf price.
 *   A FAILURE MUST NAME ITSELF  a refused sighting never costs the
 *       shop its answer, and the toast never claims a record that was
 *       not made.
 *
 * Run: node test/manager-asks.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('making the questions land');
const src = read('index.html');
/* The Manager screen is renderManager and the seven bed painters it hands
   every reading to (mgrPaint<Bed>), so a pin on "the render" reads all
   eight: what used to sit in one function is drawn by the bed it belongs to. */
const MGR_RENDER = ['renderManager', 'mgrPaintBrief', 'mgrPaintSim', 'mgrPaintTargets', 'mgrPaintPlays',
  'mgrPaintUnusual', 'mgrPaintAsk', 'mgrPaintRecord'];
const mgrRender = () => MGR_RENDER.map((n) => extractFunction(src, n, 'index.html')).join('\n');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const PRODUCTS = [
  { id: 'P1', name: 'Runners Masasi', type: 'variable', variants: [{ combo: { Size: '12 inch' } }, { combo: { Size: '14 inch' } }] },
  { id: 'P4', name: 'Sofa Legs' },
];

(async () => {
/* ---------- 1. the rulebook says all of it ---------------------------- */
{
  const meeting = api.slice(api.indexOf('const MANAGER_MEETING = ['), api.indexOf('\n];', api.indexOf('const MANAGER_MEETING = [')));

  t.check(/"asks":\[\{"q":/.test(meeting),
    'an ask has a SHAPE now, not a bare string — the one member of the plan block that carried no identity');
  t.check(/"asks":\[\{[^\]]*"product_id":/.test(meeting) && /"asks":\[\{[^\]]*"rival":/.test(meeting),
    'and the shape carries the line it is about and the shop it is about');
  t.check(/WHEN THE ASK IS WHAT A NAMED SHOP CHARGES FOR ONE LINE/.test(meeting),
    'the mind is told when to attach them');
  t.check(/filed as a dated sighting on that line/.test(meeting),
    'and what happens when it does — the answer stops being prose');
  t.check(/A line with no shop, or a shop with no line, is only a note/.test(meeting),
    'and that half an identity is not one: a price nobody is charging is not an observation');
  t.check(/product_id \(and variant_index, from find_product\)/.test(meeting),
    'the ids come from a tool, never from the mind — the same law subject and holds[].key already carry');
  t.check(/AT MOST THREE such questions in asks/.test(meeting),
    'and the ceiling is unchanged by any of it');

  t.check(/never_checked names those lines, with their ids/.test(meeting),
    'PRICING HAS TWO SIDES now points at where the walk is worth most, instead of demanding a rival ask with no way to choose one');

  const hist = api.slice(api.indexOf("name: 'manager_history'"), api.indexOf('input_schema', api.indexOf("name: 'manager_history'")));
  t.check(/never_checked/.test(hist) && /NOTHING at all on file about what other shops charge/.test(hist),
    'and the tool that returns it says what it is');
  t.check(/each with the product_id and variant_index to put straight into an ask/.test(hist),
    'including the ids, so an ask can be attached without a second look-up');
  t.check(/worth first/.test(hist),
    'ranked, because the line that earns most is the line where being wrongly priced costs most');
}

/* ---------- 2. an ask is born with its line and its shop -------------- */
{
  const saveMeeting = (inserted, products) => compileScope([
    extractFunction(src, 'managerSaveMeeting', 'index.html'),
    /* the optional fields of the meeting contract, through their whitelists */
    ...['managerPips', 'managerPlanText', 'managerMeetingFields', 'managerMoveFields', 'managerPlanRefs', 'managerAskFields', 'managerPlayFields']
      .map((n) => extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'MANAGER_DEPTS', 'index.html'), extractDeclaration(src, 'MANAGER_ASK_PLACES', 'index.html'),
      extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
      extractDeclaration(src, 'MANAGER_MOVE_KINDS', 'index.html'),
      extractFunction(src, 'managerResolvedSubject', 'index.html'),
    extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
    extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
    extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
    extractFunction(src, 'buyKeyParts', 'index.html'),
    extractFunction(src, 'stockKey', 'index.html'),
  ], {
    managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
    data: { products: products || PRODUCTS },
    apRound: (n) => Math.round(Number(n) || 0),
    sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
      select: () => ({ single: () => Promise.resolve({ data: { id: 11 }, error: null }) }) }; } }) },
    String, Number, Math, Array, Promise, JSON, Object, console,
  }, ['managerSaveMeeting']).managerSaveMeeting;

  const base = { objective: { name: 'margin', why: 'w' }, keyline: 'k', rejected: 'r', moves: [] };

  const a = [];
    await saveMeeting(a)({ ...base, asks: [
      { q: 'What does Haidery charge for Masasi 12 inch?', product_id: 'P1', variant_index: 0, rival: 'Haidery' },
      { q: 'What does Zauja charge for Sofa Legs?', product_id: 'P9', rival: 'Zauja' },
      'Is Mulongo still trading?',
    ] });
    const qs = a[a.length - 1];
    eq(qs.length, 3, 'all three are kept — none of the three is a question the shop cannot answer');

    eq(qs[0].body.productId, 'P1', 'the ask that named a line keeps it');
    eq(qs[0].body.variantIdx, 0, 'down to the variant, so 12 inch is not filed against 14');
    eq(qs[0].body.rival, 'Haidery', 'and the shop it is about');
    eq(qs[0].body.question, 'What does Haidery charge for Masasi 12 inch?', 'beside the question in the manager’s own words');
    eq(qs[0].kind, 'question', 'still an ordinary question row');
    eq(qs[0].status, 'open', 'open until the shop answers');
    eq(qs[0].meeting_id, 11, 'tied to the meeting that asked it');

    eq(qs[1].body.question, 'What does Zauja charge for Sofa Legs?',
      'a product that has left the catalogue is still ASKED — named rather than dropped');
    eq(qs[1].body.productId, undefined,
      'but carries no identity, because an id nothing resolves would file a sighting against nothing');
    eq(qs[1].body.rival, undefined, 'and the shop goes with it: half an identity is not one');

    eq(qs[2].body.question, 'Is Mulongo still trading?',
      'a bare string is still an ask — most questions name no line at all, and a mind emitting the old shape must not lose its question');
    eq(qs[2].body.productId, undefined, 'with nothing attached');

    const b = [];
    await saveMeeting(b)({ ...base, asks: [
      { q: 'What does anyone charge for Masasi?', product_id: 'P1', variant_index: 0 },
      { q: 'x' }, { q: '' }, 'four', 'five', 'six',
    ] });
    const qb = b[b.length - 1];
    eq(qb.length, 3, 'at most three are kept, blanks and stubs dropped before the cap');
    eq(qb[0].body.rival, undefined,
      'a line with no shop named cannot become a sighting — there is nobody charging the price');
    eq(qb[0].body.productId, 'P1',
      'but it keeps the line, so the screen can put it beside the other questions about that line');
    eq(qb[0].body.question, 'What does anyone charge for Masasi?', 'though it is still asked');
    eq(qb[1].body.question, 'four', 'and the cap counts what survived, not what was sent');

    const c = [];
    await saveMeeting(c)({ ...base, asks: [
      { q: 'Does Roto still hold 95,000 on Masasi 12 inch?', product_id: 'P1', variant_index: 0, supplier_id: 'S1',
        choices: ['Yes, still 95,000', 'No, it moved', 'Couldn’t reach them', 'a fourth'] },
      { q: 'Is Nobody still open?', supplier_id: 'S404', choices: ['Yes'] },
    ] });
    const qc = c[c.length - 1];
    eq(qc[0].body.supplierId, undefined, 'a supplier the books do not hold is not kept (this scope has no suppliers)');
    eq(JSON.stringify(qc[0].body.choices), JSON.stringify(['Yes, still 95,000', 'No, it moved', 'Couldn’t reach them']),
      'the likely answers are kept, three at most, so the owner can answer with a tap');
    eq(qc[1].body.choices, undefined, 'and one answer is not a choice');
    const saveSrc = src.slice(src.indexOf('async function managerSaveMeeting'));
    t.check(/\(data\.suppliers \|\| \[\]\)\.some\(x=> String\(x\.id\) === sup\) \? sup : null/.test(saveSrc),
      'a supplier is kept only when it is one the books hold');

    /* THE CEILING IS ONE NUMBER. The rulebook says three; so must the
       journal, or the mind is obeying a rule the app does not keep. */
    const save = src.slice(src.indexOf('async function managerSaveMeeting'));
    const m = save.match(/plan\.asks : \[\][\s\S]{0,400}?\.slice\(0, (\d+)\)/);
    t.check(m && Number(m[1]) === 3,
      'the cap is still readable where prompt-integrity looks for it, and still three');
}

/* ---------- 3-5. an answer that is a figure becomes a sighting -------- */
{
  const mk = (row, over) => {
    const seen = { updates: [], toasts: [], filed: [] };
    const fn = compileScope([
      extractFunction(src, 'managerAnswerQuestion', 'index.html'),
      extractFunction(src, 'buyKeyParts', 'index.html'),
      extractFunction(src, 'stockKey', 'index.html'),
      extractFunction(src, 'productVariantLabel', 'index.html'),
      extractFunction(src, 'variantLabel', 'index.html'),
    ], {
      managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
      data: { products: PRODUCTS },
      fmtUGX: (n) => Number(n).toLocaleString('en-UG'),
      toast: (m) => seen.toasts.push(m),
      renderManager: () => {},
      addRivalPrice: (input) => { seen.filed.push(input); return Promise.resolve({ ok: true, id: 3 }); },
      sb: { from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { body: { ...row } } }) }) }) }),
        update: (patch) => { seen.updates.push(patch); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; },
      }) },
      String, Number, Math, Promise, JSON, Object, Array,
      ...over,
    }, ['managerAnswerQuestion']).managerAnswerQuestion;
    return { fn, seen };
  };

  const PRICED = { question: 'What does Haidery charge for Masasi 12 inch?', productId: 'P1', variantIdx: 0, rival: 'Haidery' };

    /* 3. the figure alone. */
    let { fn, seen } = mk(PRICED);
    await fn(5, '  118,000  ');
    eq(seen.filed.length, 1, 'a bare figure is FILED — the walk the shop did reaches the market record');
    eq(seen.filed[0].productId, 'P1', 'against the line the question named');
    eq(seen.filed[0].variantIdx, 0, 'and its variant');
    eq(seen.filed[0].rival, 'Haidery', 'and the shop it asked about');
    eq(seen.filed[0].price, 118000, 'with the commas the owner typed read off, not choked on');
    eq(seen.filed[0].seenOn, TODAY, 'dated today, because that is when it was seen');
    t.check(/manager/i.test(String(seen.filed[0].note || '')),
      'and saying how it was seen, so the record can be read back to its own question');
    eq(seen.updates.length, 1, 'the note is still written, once');
    eq(seen.updates[0].status, 'answered', 'and the question is answered');
    eq(seen.updates[0].body.answer, '118,000', 'keeping what the owner actually typed');
    eq(seen.updates[0].body.recorded.price, 118000, 'and stamping that it landed');
    eq(seen.updates[0].body.recorded.rival, 'Haidery', 'with whose price it was');
    eq(seen.updates[0].body.question, PRICED.question, 'never losing the question — an answer with no question is not evidence');
    t.check(/Recorded/.test(seen.toasts[0]) && /Haidery/.test(seen.toasts[0])
      && /118,000/.test(seen.toasts[0]) && /Masasi/.test(seen.toasts[0]),
      'and the toast reads back the shop, the figure and the LINE, so a mistyped figure is caught in the same second');

    /* 4. a sentence stays a note, and nothing is scraped out of it. */
    ({ fn, seen } = mk(PRICED));
    await fn(5, 'they do not stock it');
    eq(seen.filed.length, 0, 'a sentence files nothing');
    eq(seen.updates[0].body.answer, 'they do not stock it',
      '"they don’t stock it" is a real answer and is kept as the note it is');
    eq(seen.updates[0].body.recorded, undefined, 'with nothing claiming it reached the market record');
    t.check(/market record is unchanged/.test(seen.toasts[0]),
      'and the toast says so rather than letting the owner believe they filed a price');

    ({ fn, seen } = mk(PRICED));
    await fn(5, '12 inch is 118,000');
    eq(seen.filed.length, 0,
      'NOTHING IS SCRAPED OUT OF PROSE — "12 inch is 118,000" would file 12, and a price read wrongly argues for the wrong shelf price');

    ({ fn, seen } = mk(PRICED));
    await fn(5, '0');
    eq(seen.filed.length, 0, 'and nought is not a price anybody charges');

    /* 5. a refused sighting names itself and costs nothing. */
    ({ fn, seen } = mk(PRICED, { addRivalPrice: () => Promise.resolve({ ok: false, why: 'paste 0087_rival_prices.sql' }) }));
    await fn(5, '118,000');
    eq(seen.updates.length, 1, 'a refused sighting still keeps the answer — the evidence is not lost because the filing failed');
    eq(seen.updates[0].body.answer, '118,000', 'in the owner’s own words');
    eq(seen.updates[0].body.recorded, undefined, 'and nothing pretends it landed');
    t.check(/0087_rival_prices\.sql/.test(seen.toasts[0]),
      'while the toast carries the reason the writer gave, by name');
    t.check(!/^Recorded/.test(seen.toasts[0]), 'and never opens by claiming a record');

    /* An ordinary question is untouched by any of it. */
    ({ fn, seen } = mk({ question: 'Is Mulongo still trading?' }));
    await fn(6, 'yes, he reopened');
    eq(seen.filed.length, 0, 'a question that named no line files nothing');
    eq(seen.updates[0].body.answer, 'yes, he reopened', 'and answers exactly as it always did');
    eq(seen.updates[0].body.answeredOn, TODAY, 'dated, so the next meeting knows how fresh it is');
    t.check(/next meeting/.test(seen.toasts[0]), 'with the words it always used');

    /* A question naming a product that has since left the catalogue. */
    ({ fn, seen } = mk({ question: 'gone', productId: 'P9', variantIdx: null, rival: 'Haidery' }));
    await fn(7, '118,000');
    eq(seen.filed.length, 0, 'an id nothing resolves files nothing — the reader validates before it trusts');
    eq(seen.updates.length, 1, 'but the answer is still kept');
}

/* ---------- 6. the panel: grouped by line, drawn, answered with a tap - */
{
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const products = [{ id: 'P1', name: 'Masasi', variants: [{ name: '12 inch' }] }];
  const scope = compileScope([
    extractFunction(src, 'mgrAsksHTML', 'index.html'),
    extractFunction(src, 'mgrAskCardHTML', 'index.html'),
    extractFunction(src, 'mgrAskLadderHTML', 'index.html'),
    extractFunction(src, 'mgrAskPlace', 'index.html'),
    extractFunction(src, 'mgrAskIni', 'index.html'),
    extractFunction(src, 'mgrAskAge', 'index.html'),
    extractFunction(src, 'mgrNum', 'index.html'),
    extractDeclaration(src, 'MGR_ASK_KINDS', 'index.html'),
    extractDeclaration(src, 'MGR_ASK_ICON', 'index.html'),
  ], {
    esc, Math, Number, String, Array, Map, JSON,
    data: { products, suppliers: [{ id: 'S1', name: 'Roto Hardware' }] },
    supplierName: (id) => id === 'S1' ? 'Roto Hardware' : '(unknown supplier)',
    stockKey: (p, v) => p + '|' + (v == null ? '' : v),
    buyKeyParts: (k) => { const [pid, v] = k.split('|'); const p = products.find(x => x.id === pid); return p ? { product: p, productId: pid, variantIdx: v === '' ? null : Number(v) } : null; },
    productVariantLabel: (p, v) => p.name + (v == null ? '' : ' ' + p.variants[v].name),
    ourPriceFor: () => 95000,
    rivalPriceLatest: () => [{ rival: 'Kasule Hardware', price: 90000, side: 'wholesale', seenOn: '2026-09-12', daysOld: 12 },
      { rival: 'Mengo', price: 91000, side: 'wholesale', seenOn: '2026-09-21', daysOld: 3 },
      { rival: 'Retail Only', price: 5000, side: 'retail', seenOn: '2026-09-21', daysOld: 3 }],
    stockOnHand: () => ({ qty: 0, counted: true }),
    daysSinceDate: (d) => d === '2026-09-24' ? 0 : 5, todayISO: () => '2026-09-24', fmtShortDate: (d) => d,
  }, ['mgrAsksHTML', 'mgrAskIni']);
  const qs = [
    { id: 1, date: '2026-09-24', body: { question: 'What does Nyanzi charge for Masasi 12 inch?', productId: 'P1', variantIdx: 0, rival: 'Nyanzi' } },
    { id: 2, date: '2026-09-19', body: { question: 'Does Roto still hold 95,000?', productId: 'P1', variantIdx: 0, supplierId: 'S1', choices: ['Yes, still 95,000', 'No, it moved'] } },
    { id: 3, date: '2026-09-19', body: { question: 'What is stopping the carton lift?' } },
  ];
  const html = scope.mgrAsksHTML(qs);
  t.check((html.match(/class="mgr-ak-g"/g) || []).length === 2,
    'questions about the same line sit together under it; one about no line stands alone');
  t.check(/class="mgr-ak-gt">Masasi 12 inch</.test(html) && /none on the shelf/.test(html),
    'the group is headed by the line, with what is on the shelf');
  t.check(/class="mgr-lad"/.test(html) && /You 95,000/.test(html) && /KH 90,000 · 12d/.test(html) && !/5,000 · 3d/.test(html),
    'a price question draws our price and every wholesale sighting on one scale — the other side stays off it');
  t.check(/mgr-lad-low/.test(html), 'two sightings close together do not print one label over the other');
  t.check(/class="mgr-lad-pin" data-for="1" hidden>NY</.test(html), 'and a pin per shop asked, waiting for its figure');
  t.check(/data-ours="95000"/.test(html) && /inputmode="decimal"/.test(html) && /charges — just the figure/.test(html),
    'the price box asks for a figure, on a phone keypad, and knows our price to judge it against');
  t.check(/<button type="button" class="mgr-ak-ch" aria-pressed="false">Yes, still 95,000<\/button> <button/.test(html)
    && /Or in your own words/.test(html), 'a question sent with its likely answers is answered with a tap, or in words');
  t.check(/What you found out — one line/.test(html), 'while an ordinary question keeps the box it always had');
  t.check(/data-place="r:nyanzi"/.test(html) && /data-place="s:S1"/.test(html) && /data-place="you"/.test(html),
    'every question knows where it is answered: a shop, a supplier the books hold, or the owner');
  t.check(/class="mgr-ak-pl"/.test(html) && /<span class="mgr-ak-pn">Roto Hardware<\/span>/.test(html),
    'and the places are a row to filter by');
  t.check(/mgr-ak-age mgr-ak-old" title="asked 2026-09-19"><svg[^>]*>.*<\/svg>5 days/.test(html) && />today</.test(html),
    'each says how long it has waited, amber once it has waited five days');
  t.check(/1 price check/.test(html) && /1 supplier/.test(html) && /1 for you/.test(html), 'and the header splits them by kind');
  t.check(scope.mgrAsksHTML([]) === '', 'no questions, no panel');
  t.check(scope.mgrAskIni('Jin Zhuang Le Ju') === 'JZ' && scope.mgrAskIni('Nyanzi') === 'NY' && scope.mgrAskIni('You') === 'You',
    'places wear their initials');

  const render = mgrRender();
  t.check(/qWrap\.innerHTML = mgrAsksHTML\(qs\);\s*mgrWireAsks\(qWrap\);/.test(render), 'the screen draws the panel and wires it');
  const wire = extractFunction(src, 'mgrWireAsks', 'index.html');
  t.check(/querySelectorAll\('\.mgr-ask\[data-qid\]'\)/.test(wire) && /managerAnswerQuestion\(id, input\.value\)/.test(wire),
    'the binding is scoped by attribute — the target cards share the class — and answers what is in the box');
  t.check(/input\.value = ch\.textContent/.test(wire), 'a tapped answer fills the box, so it can still be added to');
  t.check(/pin\.style\.left/.test(wire) && /under you/.test(wire) && /above you/.test(wire),
    'a typed figure lands on the scale and says where it sits against ours');
}

/* ---------- 7. where to walk ------------------------------------------ */
{
  const never = [
    { key: 'P1::0', productId: 'P1', variantIdx: 0, line: 'P1-1 — Runners Masasi (12 inch)', earned30: 840000, sold30: 12, ours: 125000 },
    { key: 'P4', productId: 'P4', variantIdx: null, line: 'P4 — Sofa Legs', earned30: 90000, sold30: 3, ours: null },
  ];
  const run = (over) => compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    extractFunction(src, 'managerAdviceTally', 'index.html'), extractFunction(src, 'mgrLiveMoveRows', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
      extractFunction(src, 'managerChaseEvidence', 'index.html'),
      /* The unusual-days reading has its own test; here it is quiet. */
      "function unusualDays(){ return { today: '', judged: 0, thin: 0, floor: 0, items: [] }; } function unusualLine(){ return ''; } var mgrUnusualMemo = null;",
      extractFunction(src, 'chaseResponse', 'index.html'),
      extractFunction(src, 'chaseDayAdd', 'index.html'),
      extractFunction(src, 'chaseRate', 'index.html'),
      extractFunction(src, 'chaseResponseLine', 'index.html'),
      extractFunction(src, 'customerCollectionDays', 'index.html'),
      extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
      extractFunction(src, 'collectionLedgerRow', 'index.html'),
      extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
      extractFunction(src, 'cashIsMoneyIn', 'index.html'),
      extractDeclaration(src, 'CHASE_WINDOW', 'index.html'),
      extractDeclaration(src, 'CHASE_LOOKBACK', 'index.html'),
      extractDeclaration(src, 'CHASE_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_CHASED', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MERGE', 'index.html'),
      extractDeclaration(src, 'CHASE_VERDICT_WORDS', 'index.html'),
      extractDeclaration(src, 'mgrChaseMemo', 'index.html'),
      extractDeclaration(src, 'mgrChaseExtras', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
    extractFunction(src, 'buyHoldsStanding', 'index.html'),
    extractFunction(src, 'buyHoldFor', 'index.html'),
    extractFunction(src, 'buyKeyLabel', 'index.html'),
    extractFunction(src, 'buyKeyParts', 'index.html'),
    extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    extractFunction(src, 'deriveMoveOutcome', 'index.html'),
    extractFunction(src, 'managerScoreboard', 'index.html'),
    extractFunction(src, 'managerRecentReviews', 'index.html'),
    extractFunction(src, 'managerReviewBrief', 'index.html'),
    extractFunction(src, 'managerScoreProgress', 'index.html'),
    extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], {
    data: { products: PRODUCTS, customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [] },
    managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
    rivalPricesTable: true, rivalNeverChecked: () => never,
    marketVerdict: () => ({ under: [], lift: [], notCompared: 0, atStake: 0 }),
    anShiftDate: (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    daysSinceDate: () => 9, apRound: (n) => Math.round(Number(n) || 0),
    fmtUGX: (n) => String(n),
    sb: { from: () => { const q = { _kind: null };
      q.select = () => q; q.order = () => q; q.in = () => q;
      /* The date window managerAdviceTally reads over. */
      q.gte = () => q; q.lte = () => q;
      q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
      q.limit = () => Promise.resolve({ data: [], error: null });
      q.then = (res) => res({ data: [], error: null });
      return q; } },
    Date, JSON, Math, Number, String, Array, Object, Promise,
    ...over,
  }, ['names']).names().ASSISTANT_TOOLS;

    const out = await run({}).manager_history.run({ limit: 3 });
    t.check(Array.isArray(out.never_checked), 'the meeting is told where the walk is worth most');
    eq(out.never_checked.length, 2, 'each line this shop sells with nothing at all on file');
    eq(out.never_checked[0].product_id, 'P1', 'with the id an ask must carry');
    eq(out.never_checked[0].variant_index, 0, 'down to the variant');
    eq(out.never_checked[0].line, 'P1-1 — Runners Masasi (12 inch)', 'and a name a person would recognise');
    eq(out.never_checked[0].earned_30, 840000, 'and what it earned, which is why it is first');
    t.check(out.never_checked[0].earned_30 > out.never_checked[1].earned_30,
      'the order it was given is the order it is passed on — worth first, never re-sorted into an alphabet');
    t.check(!('key' in out.never_checked[0]) && !('ours' in out.never_checked[0]),
      'and nothing else is carried: the ask needs the ids and the name, and every extra key is prose the mind will recite');

    const bare = await run({ rivalPricesTable: false, rivalNeverChecked: () => { throw new Error('walked the catalogue with no table to compare against'); } })
      .manager_history.run({ limit: 3 });
    t.check(!('never_checked' in bare),
      'a shop without the market table is not told to check lines against a record it has not got — and does not walk the catalogue to find out');
}


/* ---------- 8. an answer already filed says so ------------------------ */
{
  const rows = { meeting: [{ id: 1, date: '2026-08-28', body: { keyline: 'k' } }], move: [], question: [
    { id: 5, date: '2026-08-28', status: 'answered', body: { question: 'What does Haidery charge for Masasi 12 inch?',
      answer: '118,000', answeredOn: TODAY, productId: 'P1', variantIdx: 0, rival: 'Haidery',
      recorded: { rival: 'Haidery', price: 118000 } } },
    { id: 4, date: '2026-08-27', status: 'answered', body: { question: 'Is Mulongo still trading?', answer: 'yes', answeredOn: TODAY } },
  ] };
  const tools = compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    extractFunction(src, 'managerAdviceTally', 'index.html'), extractFunction(src, 'mgrLiveMoveRows', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
      extractFunction(src, 'managerChaseEvidence', 'index.html'),
      /* The unusual-days reading has its own test; here it is quiet. */
      "function unusualDays(){ return { today: '', judged: 0, thin: 0, floor: 0, items: [] }; } function unusualLine(){ return ''; } var mgrUnusualMemo = null;",
      extractFunction(src, 'chaseResponse', 'index.html'),
      extractFunction(src, 'chaseDayAdd', 'index.html'),
      extractFunction(src, 'chaseRate', 'index.html'),
      extractFunction(src, 'chaseResponseLine', 'index.html'),
      extractFunction(src, 'customerCollectionDays', 'index.html'),
      extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
      extractFunction(src, 'collectionLedgerRow', 'index.html'),
      extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
      extractFunction(src, 'cashIsMoneyIn', 'index.html'),
      extractDeclaration(src, 'CHASE_WINDOW', 'index.html'),
      extractDeclaration(src, 'CHASE_LOOKBACK', 'index.html'),
      extractDeclaration(src, 'CHASE_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_CHASED', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MERGE', 'index.html'),
      extractDeclaration(src, 'CHASE_VERDICT_WORDS', 'index.html'),
      extractDeclaration(src, 'mgrChaseMemo', 'index.html'),
      extractDeclaration(src, 'mgrChaseExtras', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
    extractFunction(src, 'buyHoldsStanding', 'index.html'),
    extractFunction(src, 'buyHoldFor', 'index.html'),
    extractFunction(src, 'buyKeyLabel', 'index.html'),
    extractFunction(src, 'buyKeyParts', 'index.html'),
    extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    extractFunction(src, 'deriveMoveOutcome', 'index.html'),
    extractFunction(src, 'managerScoreboard', 'index.html'),
    extractFunction(src, 'managerRecentReviews', 'index.html'),
    extractFunction(src, 'managerReviewBrief', 'index.html'),
    extractFunction(src, 'managerScoreProgress', 'index.html'),
    extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], {
    data: { products: PRODUCTS, customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [] },
    managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1', todayISO: () => TODAY,
    marketVerdict: () => ({ under: [], lift: [], notCompared: 0, atStake: 0 }),
    anShiftDate: (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    daysSinceDate: () => 1, apRound: (n) => Math.round(Number(n) || 0), fmtUGX: (n) => String(n),
    sb: { from: () => { const q = { _kind: null };
      q.select = () => q; q.order = () => q; q.in = () => q;
      /* The date window managerAdviceTally reads over. */
      q.gte = () => q; q.lte = () => q;
      q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
      q.limit = () => Promise.resolve({ data: rows[q._kind] || [], error: null });
      q.then = (res) => res({ data: rows[q._kind] || [], error: null });
      return q; } },
    Date, JSON, Math, Number, String, Array, Object, Promise,
  }, ['names']).names().ASSISTANT_TOOLS;

  const out = await tools.manager_history.run({ limit: 3 });
  const filed = out.answered_questions.find((q) => /Haidery/.test(q.asked));
  eq(filed.on_the_market_record, true,
    'an answer that became a sighting says so — otherwise the meeting reads a price already on file and asks the owner to write it down again');
  eq(filed.answer, '118,000', 'while still carrying the answer as evidence');
  const words = out.answered_questions.find((q) => /Mulongo/.test(q.asked));
  eq(words.on_the_market_record, undefined,
    'and an answer in words carries no such claim — nothing was filed, so nothing says it was');

  const hist = api.slice(api.indexOf("name: 'manager_history'"), api.indexOf('input_schema', api.indexOf("name: 'manager_history'")));
  t.check(/never ask for it to be recorded again/.test(hist),
    'and the mind is told what the mark means, or the flag is a key nobody reads');
}

})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
