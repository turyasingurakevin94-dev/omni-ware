#!/usr/bin/env node
'use strict';
/*
 * It needs to know -- the final review's findings, each pinned with a
 * hand-worked expectation that failed before its fix:
 *
 *   RIDING ONCE      two open questions about one supplier carry that
 *                    supplier's open bills once on the band, never twice
 *                    (law 1: the band can never show more than the shop
 *                    owes all its suppliers); a buy-plan line likewise.
 *   ASKED ONCE       a meeting question asking a supplier's stop age,
 *                    credit or delivery days takes that term off the
 *                    app's own terms card; a bare days answer to it is
 *                    filed on the supplier as a terms answer is.
 *   NOTHING ERASED   an answer whose row could not be read fresh is not
 *                    written over the row, and the failure is named.
 *   THE RIVAL'S PIN  a rival is placed at a pinned place its name
 *                    carries, and the route says so.
 *   THE DAY          a delegate's message says the day it was given for.
 *   CHIPS FIRST      a price question shows its likely answers alone
 *                    until one is tapped (Q41).
 *   THE KEPT BAND    a kept range answer stays on the price scale.
 *   ’S               possessives as the canvas writes them.
 *
 * Run: node test/manager-ask-final.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('It needs to know, final review');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg}${JSON.stringify(got) === JSON.stringify(want) ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);

const BEGIN = '/* ═══ MGR BED: Ask — begin ═══ */', END = '/* ═══ MGR BED: Ask — end ═══ */';
const at = src.lastIndexOf(BEGIN);
const block = src.slice(at, src.indexOf(END, at) + END.length);
const TODAY = '2026-10-07'; // a Wednesday
const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const has = (name) => new RegExp('function ' + name + '\\(').test(block);

function scope(data, over) {
  const env = {
    data, esc, todayISO: () => TODAY,
    mgrMemo: (n, f) => f(),
    marketVerdict: () => ({ under: [], lift: [] }), rivalNeverChecked: () => [], waSalesByKey: () => new Map(),
    credOpenInvoices: () => [], purchasePlan: () => ({ lines: [] }), supplierLeadTimes: () => [],
    rivalPriceLatest: () => [], rivalMarketRows: () => [], invCountRecords: () => [],
    mgrConfidence: () => ({ pips: null, source: null, basis: null, evidence: [] }),
    ourCostFor: () => null, ourPriceFor: () => null,
    placePin: (name) => { const p = (data.places || []).find((x) => x.name === name); return p && p.lat != null ? { lat: p.lat, lng: p.lng } : null; },
    mapHomePin: () => null, mapCentrePin: () => null, mapPlaceRows: () => [],
    fmtUGX: (n) => Number(n).toLocaleString('en-UG') + ' UGX',
    managerNotesTable: true, currentShopId: 'shop-1', supplierStopColumns: true,
    MGR_MIGRATION_0108: 'supabase/migrations/0108_manager_intelligence.sql',
    toast: () => {}, renderManager: () => {}, saveData: () => Promise.resolve(true),
    managerAnswerQuestion: () => Promise.resolve({ ok: true }),
    sb: null, document: null, mgrRenderGen: 0, MANAGER_METRICS: {},
    Map, Set, Math, Number, String, Array, Object, JSON, Date, Promise,
    ...(over || {}),
  };
  const want = ['mgrAskModel', 'mgrAskRiding', 'mgrAskHeadline', 'mgrAskTermsAsks', 'mgrAskItem', 'mgrAskKeep', 'mgrAskRoute',
    'mgrAskMessage', 'mgrAsksHTML', 'mgrAskCardHTML', 'mgrAskPlace',
    ...['mgrAskPossessive', 'mgrAskStakeTotal', 'mgrAskTermsAskedBy', 'mgrAskTermsFromAnswer', 'mgrAskRivalPlace', 'mgrAskBandAt'].filter(has)];
  return compileScope([
    block,
    ['mgrDept', 'mgrPossessive', 'mgrShortUGX', 'mgrNum', 'managerPips', 'mgrPipsFromAge', 'stockKey', 'daysSinceDate', 'fmtDayMonth',
      'anShiftDate', 'waComposeUrl', 'pinDistanceKm', 'purchaseInvoiceNumberLabel', 'productVariantLabel', 'variantLabel']
      .map((n) => extractFunction(src, n, 'index.html')).join('\n'),
    ['MGR_DEPTS', 'MGR_WHOLE_SHOP', 'MANAGER_ASK_PLACES'].map((n) => extractDeclaration(src, n, 'index.html')).join('\n'),
  ], env, want);
}
const STAFF = [{ id: 'ST002', name: 'Moses Kibirige', phone: '0700 555 222' }];
const SUPPLIERS = [
  { id: 'S1', name: 'Roto Hardware', location: 'Nakawa', stopAtDays: null, termsDays: null, deliveryDays: null },
  { id: 'S4', name: 'Quiet Ltd', location: '', stopAtDays: null, termsDays: null, deliveryDays: null },
];
const PRODUCTS = [{ id: 'P1', name: 'Iron sheet G28' }, { id: 'P2', name: 'Wire nails' }];
const book = (extra) => ({ staff: STAFF.map((x) => ({ ...x })), agents: [], suppliers: SUPPLIERS.map((x) => ({ ...x })),
  customers: [{ id: 'C4', name: 'Nalubega Estates', location: 'Namugongo' }], products: PRODUCTS, prices: [], purchaseInvoices: [], places: [],
  ...(extra || {}) });
/* Roto is owed 500,000 on two bills (300,000 + 200,000), Quiet 100,000
   on one: 600,000 owed to suppliers in all. */
const BILLS = () => [
  { supplierId: 'S1', due: 300000, ageDays: 40, invoice: { id: 1, date: '2026-08-28' } },
  { supplierId: 'S1', due: 200000, ageDays: 10, invoice: { id: 2, date: '2026-09-27' } },
  { supplierId: 'S4', due: 100000, ageDays: 5, invoice: { id: 3, date: '2026-10-02' } }];
const ROTO_STOP = { id: 7, date: TODAY, body: { question: 'How old can a Roto Hardware bill get before they stop supplying us?',
  place: { kind: 'supplier', id: 'S1' }, supplierId: 'S1', choices: ['60 days', '90 days', 'Not asked'] } };

/* Each part runs on its own, so a part that throws is one failure
   named, and the others still run. */
const sec = async (f) => { try { await f(); } catch (e) { t.check(false, 'threw: ' + ((e && e.message) || e)); } };

(async () => {
/* ---------- 1. riding: each supplier's bills once ---------- */
await sec(async () => {
  const S = scope(book(), { credOpenInvoices: BILLS });
  const m = S.mgrAskModel([ROTO_STOP], null, TODAY);
  /* Three questions ride on bills: the meeting's about Roto (500,000),
     the terms card for Roto's credit and delivery (the same 500,000),
     and the terms card for Quiet (100,000). Owed, counted once each:
     500,000 + 100,000 = 600,000 -- WAS 1,100,000, more than the shop
     owes all its suppliers. */
  eq(m.riding.map((r) => [r.kind, r.label, r.n, r.total]), [['bills', 'owed to 2 suppliers', 3, 600000]],
    'two questions about Roto carry Roto’s 500,000 once: 600,000 owed to 2 suppliers, from 3 questions');
  const owedAll = BILLS().reduce((n, b) => n + b.due, 0);
  t.check(m.riding[0].total <= owedAll, 'LAW 1: the band never shows more than the shop owes its suppliers (600,000)');
  /* A buy-plan line asked about on its own and inside its supplier's
     plan: P1 from S4 900,000 once, P2 100,000 -- 1,000,000, WAS 1,900,000. */
  const line = { amount: 900000, from: 'plan', parts: [{ id: 'l:P1|S4', amount: 900000 }] };
  const sup = { amount: 1000000, from: 'plan', parts: [{ id: 'l:P1|S4', amount: 900000 }, { id: 'l:P2|S4', amount: 100000 }] };
  eq(S.mgrAskRiding([{ stake: line }, { stake: sup }]).map((r) => [r.kind, r.n, r.total]), [['plan', 2, 1000000]],
    'a plan line counted once though two questions ride on it');
  /* Stakes that say nothing of their parts are their own: 500,000 +
     300,000 = 800,000, as before. */
  eq(S.mgrAskRiding([{ stake: { amount: 500000, from: 'bills' } }, { stake: { amount: 300000, from: 'bills' } }])[0].total, 800000,
    'stakes without parts are never merged');
  /* The headline adds one kind the same way: two Roto stakes, 500k once. */
  const roto = { amount: 500000, unit: 'owed', from: 'bills', parts: [{ id: 's:S1', amount: 500000 }] };
  const items = [{ rk: '01', stake: roto, choices: [] }, { rk: '02', stake: roto, choices: [] }];
  eq(S.mgrAskHeadline(items), 'Two things I can’t read in your books. The top two decide advice worth 500k owed. A line each, and I read it at the next meeting.',
    'the headline says 500k owed, not 1m');
});

/* ---------- 2. a supplier's terms asked once ---------- */
await sec(async () => {
  const S = scope(book(), { credOpenInvoices: BILLS });
  eq([S.mgrAskTermsAskedBy(ROTO_STOP.body, { kind: 'supplier', id: 'S1' }),
    S.mgrAskTermsAskedBy({ question: 'What are Roto’s terms?' }, { kind: 'supplier', id: 'S1' }),
    S.mgrAskTermsAskedBy({ question: 'How many days’ credit, and how long do they take to deliver?' }, { kind: 'supplier', id: 'S1' }),
    S.mgrAskTermsAskedBy({ question: 'Will Roto keep supplying past 90 days on the July bill?' }, { kind: 'supplier', id: 'S1' }),
    S.mgrAskTermsAskedBy({ question: 'What will Roto quote for G28 delivered?', productId: 'P1' }, { kind: 'supplier', id: 'S1' }),
    S.mgrAskTermsAskedBy({ question: 'When do they stop?', source: 'terms' }, { kind: 'supplier', id: 'S1' }),
    S.mgrAskTermsAskedBy({ question: 'When does the bank stop the overdraft?' }, { kind: 'bank' })],
  [['stopAtDays'], ['stopAtDays', 'termsDays', 'deliveryDays'], ['termsDays', 'deliveryDays'], ['stopAtDays'], [], [], []],
  'the terms a meeting question asks: stop age, all three for "terms", credit and delivery; never a line’s price, the app’s own, or the bank');
  const m = S.mgrAskModel([ROTO_STOP], null, TODAY);
  const roto = m.items.filter((it) => String(it.supplierId) === 'S1');
  /* WAS: the meeting's card AND "What are Roto Hardware’s terms with
     you?" asking all three -- the stop age twice. */
  eq(roto.map((it) => [it.key, it.det ? it.terms.missing : it.termsAsked]),
    [['q:7', ['stopAtDays']], ['terms:S1', ['termsDays', 'deliveryDays']]],
    'the meeting asks Roto’s stop age; the terms card asks only the credit and delivery days');
  eq(m.open, 3, 'three open: the meeting’s, Roto’s two remaining terms, Quiet’s terms');
  const all = S.mgrAskModel([{ id: 8, date: TODAY, body: { question: 'What are Roto Hardware’s terms?', place: { kind: 'supplier', id: 'S1' } } }], null, TODAY);
  eq(all.items.filter((it) => it.det).map((it) => it.key), ['terms:S4'], 'a meeting question about all their terms stands in for the terms card');

  /* A bare number of days, to a "how old" question, is the stop age. */
  eq([S.mgrAskTermsFromAnswer({ question: ROTO_STOP.body.question, termsAsked: ['stopAtDays'] }, '60 days'),
    S.mgrAskTermsFromAnswer({ question: ROTO_STOP.body.question, termsAsked: ['stopAtDays'] }, ' 75 '),
    S.mgrAskTermsFromAnswer({ question: ROTO_STOP.body.question, termsAsked: ['stopAtDays'] }, 'about 60, he thinks'),
    S.mgrAskTermsFromAnswer({ question: ROTO_STOP.body.question, termsAsked: ['stopAtDays'] }, 'Not asked'),
    S.mgrAskTermsFromAnswer({ question: 'Will Roto keep supplying past 90 days?', termsAsked: ['stopAtDays'] }, '120'),
    S.mgrAskTermsFromAnswer({ question: 'What are their terms?', termsAsked: ['stopAtDays', 'termsDays', 'deliveryDays'] }, '30')],
  [{ stopAtDays: 60 }, { stopAtDays: 75 }, null, null, null, null],
  'only the whole answer, a number of days, to a question asking one term');
  /* A meeting question about money, a date or a discount is not a term.
     WAS: "How much credit…" asked termsDays and "500" filed 500 days'
     credit on the supplier; "When will they deliver…" asked
     deliveryDays and "3" filed 3 days; "stop the 5% discount" hid the
     stop-age box on the terms card. */
  const SUP = { kind: 'supplier', id: 'S1' };
  const HOW_MUCH = 'How much credit will Roto extend us this month?';
  const WHEN = 'When will Roto deliver the 160 sheets?';
  eq([S.mgrAskTermsAskedBy({ question: HOW_MUCH }, SUP),
    S.mgrAskTermsAskedBy({ question: WHEN }, SUP),
    S.mgrAskTermsAskedBy({ question: 'Will Roto stop the 5% discount?' }, SUP),
    S.mgrAskTermsAskedBy({ question: 'How many days’ credit do they give, and when will they deliver the sheets?' }, SUP),
    S.mgrAskTermsAskedBy({ question: 'After how many days do they stop supplying us?' }, SUP)],
  [[], [], [], ['termsDays'], ['stopAtDays']],
  'only a clause naming the term and speaking of days asks it: money, a date, a discount ask none');
  eq([S.mgrAskTermsFromAnswer({ question: HOW_MUCH, termsAsked: S.mgrAskTermsAskedBy({ question: HOW_MUCH }, SUP) }, '500'),
    S.mgrAskTermsFromAnswer({ question: WHEN, termsAsked: S.mgrAskTermsAskedBy({ question: WHEN }, SUP) }, '3'),
    S.mgrAskTermsFromAnswer({ question: HOW_MUCH, termsAsked: ['termsDays'] }, '500'),
    S.mgrAskTermsFromAnswer({ question: WHEN, termsAsked: ['deliveryDays'] }, '3'),
    S.mgrAskTermsFromAnswer({ question: 'How long does Roto take to deliver?', termsAsked: ['deliveryDays'] }, '3 days')],
  [null, null, null, null, { deliveryDays: 3 }],
  '"500" to how much credit and "3" to when they deliver stay words; "3 days" to how long they take is the delivery time');
  const calls = [];
  const K = scope(book(), { credOpenInvoices: BILLS, managerAnswerQuestion: (id, text, o) => { calls.push([id, text, o]); return Promise.resolve({ ok: true }); } });
  const it = K.mgrAskModel([ROTO_STOP], null, TODAY).items.find((x) => x.key === 'q:7');
  await K.mgrAskKeep(it, { text: '60 days', pick: 0, by: 'you' });
  await K.mgrAskKeep(it, { text: 'Not asked', pick: 2, by: 'you' });
  eq(calls, [[7, '60 days', { by: 'you', terms: { stopAtDays: 60 } }], [7, 'Not asked', { by: 'you' }]],
    'tapping "60 days" keeps the words and files 60 days on Roto’s record; "Not asked" is only words');
});

/* ---------- 3. a row that could not be read is not written over ---------- */
await sec(async () => {
  const mk = (cur) => {
    const seen = { updates: [], toasts: [], wrote: [] };
    const fn = compileScope([extractFunction(src, 'managerAnswerQuestion', 'index.html'),
      has('mgrAskPossessive') ? extractFunction(src, 'mgrAskPossessive', 'index.html') : '',
      extractFunction(src, 'mgrPossessive', 'index.html')], {
      managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
      toast: (m) => seen.toasts.push(m), renderManager: () => {}, fmtUGX: String,
      buyKeyParts: () => null, stockKey: (p) => p,
      mgrAskWriteTerms: (sid, days) => { seen.wrote.push([sid, days]); return Promise.resolve({ ok: true, name: 'Roto Hardware' }); },
      sb: { from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve(cur) }) }) }),
        update: (patch) => { seen.updates.push(patch); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; },
      }) },
      String, Number, Math, Promise, JSON, Object, Array,
    }, ['managerAnswerQuestion']).managerAnswerQuestion;
    return { fn, seen };
  };
  let { fn, seen } = mk({ data: null, error: { message: 'offline' } });
  let r = await fn(9, '60 days', { terms: { stopAtDays: 60 } });
  /* WAS: body {} -- the update wrote {answer, answeredOn, answeredBy}
     over the row, erasing the question and the supplier, and the toast
     said "Kept". */
  eq([seen.updates.length, seen.wrote.length, r.ok, r.error], [0, 0, false, 'offline'], 'a failed read writes nothing — not the journal, not the supplier');
  eq(seen.toasts, ['Could not keep that answer — offline. Nothing was written to the supplier’s record.'], 'and the failure names itself');
  ({ fn, seen } = mk({ data: null, error: null }));
  r = await fn(9, 'yes');
  eq([seen.updates.length, r.ok, seen.toasts[0]], [0, false, 'Could not keep that answer — the question was not found.'], 'a row that is not there is named as such');
  ({ fn, seen } = mk({ data: { body: { question: 'Paying in stages?', why: 'the cap' } }, error: null }));
  r = await fn(9, 'Yes');
  eq([r.ok, seen.updates[0].body.question, seen.updates[0].body.why, seen.updates[0].body.answer], [true, 'Paying in stages?', 'the cap', 'Yes'],
    'a row read whole keeps its question beside the answer');
});

/* ---------- 4. the rival's pin, by its name ---------- */
await sec(async () => {
  /* The shop at 0°, 32.5°E. Kikuubo pinned 0.018° east: 6371 × 0.018 ×
     π/180 = 2.0 km. Namugongo 0.09° north: 10.0 km. */
  const places = [{ name: 'Kikuubo', lat: 0, lng: 32.518 }, { name: 'Namugongo', lat: 0.09, lng: 32.5 }, { name: 'Kasubi', lat: 0, lng: 32.6 },
    { name: 'Mengo', lat: null, lng: null }];
  const S = scope(book({ places }), { mapHomePin: () => ({ lat: 0, lng: 32.5 }) });
  eq([S.mgrAskRivalPlace('Kikuubo Building Mart'), S.mgrAskRivalPlace('Kasubiville Depot'), S.mgrAskRivalPlace('Mengo Stores'), S.mgrAskRivalPlace('')],
    ['Kikuubo', null, null, null], 'a rival at the pinned place its name carries — a whole word, and only a whole pin');
  const qs = [
    { id: 2, date: TODAY, body: { question: 'Is the estate paying in stages?', place: { kind: 'customer', id: 'C4' }, delegate: { staffId: 'ST002', name: 'Moses' } } },
    { id: 3, date: TODAY, body: { question: 'What is Kikuubo Building Mart charging for G28?', productId: 'P1', rival: 'Kikuubo Building Mart',
      place: { kind: 'rival', name: 'Kikuubo Building Mart' }, delegate: { staffId: 'ST002', name: 'Moses' } } }];
  const items = S.mgrAskModel(qs, null, TODAY).items;
  const r = S.mgrAskRoute(items, { pin: { lat: 0, lng: 32.5 }, from: 'from the shop' });
  /* WAS: Nalubega 10.0 km first, Kikuubo "no pin" last. */
  eq(r.stops.map((s) => [s.n, s.name, s.km, s.byName]), [[1, 'Kikuubo Building Mart', 2, true], [2, 'Nalubega Estates', 10, false]],
    'the rival’s counter is placed at Kikuubo, 2.0 km, and goes first; the site 10.0 km second');
  const html = S.mgrAsksHTML(S.mgrAskModel(qs, null, TODAY));
  t.check(/≈2 km<\/em>/.test(html) && /title="Measured to Kikuubo, the place in its name/.test(html), 'and the route says the distance is to the place in its name');
});

/* ---------- 5. the delegate's message says the day ---------- */
await sec(async () => {
  const S = scope(book());
  const it = { question: 'What is Kikuubo charging?', why: 'it decides the price', choices: [], today: TODAY,
    delegate: { name: 'Moses', first: 'Moses', day: '2026-10-08' } };
  eq(S.mgrAskMessage(it), 'What is Kikuubo charging?\n\nWhy: it decides the price\n\nPlease bring back the answer, in a line.\n\nFor Thursday.',
    'the message Moses is sent says Thursday, as the button does');
  eq(S.mgrAskMessage({ ...it, delegate: { ...it.delegate, day: null } }).includes('For '), false, 'no day, nothing said');
  eq(S.mgrAskMessage({ ...it, today: '2026-10-09' }).includes('For '), false, 'a day already gone, nothing said');
});

/* ---------- 6. a price question: chips first (Q41) ---------- */
await sec(async () => {
  const S = scope(book());
  const price = { id: 3, date: TODAY, body: { question: 'What is Kikuubo charging for G28?', productId: 'P1', rival: 'Kikuubo',
    choices: ['Under 45,000', '45,000–46,500', '47,000 or more'] } };
  const card = (q) => S.mgrAsksHTML(S.mgrAskModel([q], null, TODAY));
  t.check(/<div class="mgr-k-form" hidden>/.test(card(price)), 'with likely answers, the figure box waits for a tap — WAS open from the start');
  t.check(/data-pick="own" aria-pressed="false">Type the figure<\/button>/.test(card(price)), 'and "Type the figure" opens it for an exact price');
  const bare = { ...price, body: { ...price.body, choices: [] } };
  t.check(/<div class="mgr-k-form">/.test(card(bare)), 'with no likely answers, the box is the question');
});

/* ---------- 7. a kept range stays on the scale ---------- */
await sec(async () => {
  /* Marks: Kikuubo 44,000 and ours 47,000. Pad = max(3,000 × 0.12,
     47,000 × 0.02) = 940, so the scale runs 43,060–47,940 (4,880).
     45,000 at 1,940 / 4,880 = 39.8%; 46,500 at 3,440 / 4,880 = 70.5%;
     the band is 39.8% from the left, 30.7% wide. */
  const S = scope(book(), { ourPriceFor: () => 47000,
    rivalMarketRows: () => [{ key: 'P1', comparable: true, side: 'wholesale', theirs: 44000, shop: 'Kikuubo', daysOld: 4 }] });
  const it = S.mgrAskItem({ id: 3, date: TODAY, body: { question: 'What is Kikuubo charging for G28?', productId: 'P1', rival: 'Kikuubo',
    choices: ['Under 45,000', '45,000–46,500', '47,000 or more'] } }, TODAY);
  const kept = S.mgrAskCardHTML({ ...it, rk: '01', rank: 1, today: TODAY, done: { pick: 1, text: '45,000–46,500', by: 'you' } });
  t.check(/<span class="mgr-k-band" style="left:39\.8%;width:30\.7%"><\/span>/.test(kept), 'the kept answer’s range is drawn on the done card’s scale — WAS hidden');
  const open = S.mgrAskCardHTML({ ...it, rk: '01', rank: 1, today: TODAY, done: null });
  t.check(/<span class="mgr-k-band" hidden><\/span>/.test(open), 'an open card’s band waits for a tap');
});

/* ---------- 8. possessives as the canvas writes them ---------- */
await sec(async () => {
  const S = scope(book());
  eq([S.mgrAskPossessive('Moses'), S.mgrAskPossessive('Kasubi Depot'), S.mgrAskPossessive('Roofings Ltd')], ['Moses’s', 'Kasubi Depot’s', 'Roofings Ltd’s'],
    'Moses’s, Kasubi Depot’s, Roofings Ltd’s — the curly apostrophe, and ’s on every name');
  eq(S.mgrAskPlace({ productId: 'P1', rival: 'Kasubi Depot' }).label, 'At Kasubi Depot’s counter', 'the card says “At Kasubi Depot’s counter”');
});
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
