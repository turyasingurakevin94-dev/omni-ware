#!/usr/bin/env node
'use strict';
/*
 * It needs to know -- the Manager's questions, drawn as the approved
 * canvas draws them (Phase 2, the Ask board).
 *
 * Every figure on the section is derived from the books or said by the
 * meeting, and says which. These checks run the section's own pure
 * readings on small hand-made books whose answers are worked out by hand
 * in the comments beside them:
 *
 *   WHERE        the five places an answer is found (only you, at a
 *                rival, a supplier or the bank, your staff, customers
 *                and their sites), from the meeting's place or what the
 *                question carries.
 *   AT STAKE     the meeting's sizing, or the books': thirty days' units
 *                times the gap to the cheapest rival, what a line with
 *                no rival on file earned, a supplier's open bills, the
 *                buy plan -- and "not sized", never 0.
 *   HOW OLD      the age of what is on file, not of the question.
 *   HOW SURE     the meeting's judgement, labelled so; else counted.
 *   ANSWERS      each likely answer beside the effect the meeting wrote
 *                for it -- none invented.
 *   SUPPLIER TERMS (Q9)  asked from the books for suppliers owed or
 *                bought from, only while unknown; an answer writes the
 *                supplier's own record, and a shop without 0107 is told
 *                so while the answer is still kept.
 *   WHO FOUND IT (Q23)   recorded on the answer; "Send to" opens the
 *                owner's own WhatsApp, and says why when it cannot.
 *   THE ROUTE    the visits for the person most were given to, nearest
 *                first by the places' pins, unpinned named and last.
 *   CHANGED THE ADVICE (ASK.7)  k of n of last month's answers that a
 *                later move or target points back at.
 *
 * Run: node test/manager-ask-section.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('It needs to know');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg}${JSON.stringify(got) === JSON.stringify(want) ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);

const BEGIN = '/* ═══ MGR BED: Ask — begin ═══ */', END = '/* ═══ MGR BED: Ask — end ═══ */';
const at = src.lastIndexOf(BEGIN);
const block = src.slice(at, src.indexOf(END, at) + END.length);
const TODAY = '2026-10-07';
const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* The section's whole block, compiled once per book, with the app's own
   small helpers and stubs for the readings that walk the whole book. */
function scope(data, over) {
  const env = {
    data, esc, todayISO: () => TODAY,
    mgrMemo: (n, f) => f(),
    marketVerdict: () => ({ under: [], lift: [] }), rivalNeverChecked: () => [], waSalesByKey: () => new Map(),
    credOpenInvoices: () => [], purchasePlan: () => ({ lines: [] }), supplierLeadTimes: () => [],
    rivalPriceLatest: () => [], rivalMarketRows: () => [], invCountRecords: () => [],
    mgrConfidence: () => ({ pips: null, source: null, basis: null, evidence: [] }),
    ourCostFor: () => null, ourPriceFor: () => null,
    placePin: () => null, mapHomePin: () => null, mapCentrePin: () => null, mapPlaceRows: () => [],
    fmtUGX: (n) => Number(n).toLocaleString('en-UG') + ' UGX',
    managerNotesTable: true, currentShopId: 'shop-1', supplierTermsColumns: true,
    MGR_MIGRATION_0107: 'supabase/migrations/0107_manager_intelligence.sql',
    toast: () => {}, renderManager: () => {}, saveData: () => Promise.resolve(true),
    managerAnswerQuestion: () => Promise.resolve({ ok: true }),
    sb: null, document: null, mgrRenderGen: 0,
    MANAGER_METRICS: { collections: { label: 'Collect' } },
    Map, Set, Math, Number, String, Array, Object, JSON, Date, Promise,
    ...(over || {}),
  };
  return compileScope([
    block,
    ['mgrDept', 'mgrPossessive', 'mgrShortUGX', 'mgrNum', 'managerPips', 'stockKey', 'daysSinceDate', 'fmtDayMonth',
      'anShiftDate', 'waComposeUrl', 'pinDistanceKm', 'purchaseInvoiceNumberLabel', 'productVariantLabel', 'variantLabel']
      .map((n) => extractFunction(src, n, 'index.html')).join('\n'),
    ['MGR_DEPTS', 'MGR_WHOLE_SHOP', 'MANAGER_ASK_PLACES'].map((n) => extractDeclaration(src, n, 'index.html')).join('\n'),
    'function __kept(){ return mgrAskKept; } function __sent(){ return mgrAskSent; }',
  ], env, ['mgrNavCountAsk', 'mgrAskPlace', 'mgrAskDeptOf', 'mgrAskStake', 'mgrAskKnown', 'mgrAskSure', 'mgrAskChoices',
    'mgrAskDelegate', 'mgrAskTermsAsks', 'mgrAskTermsEffect', 'mgrAskTermsClean', 'mgrAskTermsWords', 'mgrAskItem',
    'mgrAskModel', 'mgrAskHeadline', 'mgrAskRoute', 'mgrAskMonth', 'mgrAskHistory', 'mgrAskRangeOf', 'mgrAskScale',
    'mgrAskMessage', 'mgrAsksHTML', 'mgrAskCardHTML', 'mgrAskWriteTerms', 'mgrAskAnswerTerms', 'mgrAskKeep', '__kept', '__sent']);
}
const STAFF = [
  { id: 'ST001', name: 'Joan Nakato', phone: '0700 555 111' },
  { id: 'ST002', name: 'Moses Kibirige', phone: '0700 555 222' },
  { id: 'ST003', name: 'Peter Wandera', phone: '' },
];
const SUPPLIERS = [
  { id: 'S1', name: 'Roto Hardware', location: 'Nakawa', stopAtDays: null, creditDays: null, deliveryDays: null },
  { id: 'S2', name: 'Cash Co', location: 'Kasubi', stopAtDays: null, creditDays: 0, deliveryDays: null },
  { id: 'S3', name: 'Full Terms Ltd', location: '', stopAtDays: 90, creditDays: 30, deliveryDays: 3 },
  { id: 'S4', name: 'Quiet Ltd', location: '', stopAtDays: null, creditDays: null, deliveryDays: null },
];
const CUSTOMERS = [{ id: 'C4', name: 'Nalubega Estates', location: 'Namugongo', siteStage: 'walling', siteStageAt: '2026-09-27' },
  { id: 'C5', name: 'Ssali Builders', location: 'Seeta' }];
const PRODUCTS = [{ id: 'P1', name: 'Iron sheet G28' }, { id: 'P2', name: 'Wire nails' }, { id: 'P3', name: 'Primer' }, { id: 'P4', name: 'Hinge' }];
const book = () => ({ staff: STAFF.map((x) => ({ ...x })), agents: [], suppliers: SUPPLIERS.map((x) => ({ ...x })),
  customers: CUSTOMERS.map((x) => ({ ...x })), products: PRODUCTS, prices: [], purchaseInvoices: [] });

(async () => {
/* ---------- 1. the nav counts the journal and the books ---------- */
{
  const S = scope(book());
  eq(S.mgrNavCountAsk({}), null, 'nothing until the journal is counted');
  eq(S.mgrNavCountAsk({ openAsks: null, askTerms: 3 }), null, 'an unread journal count is no chip — never the terms alone passed off as all of it');
  eq(S.mgrNavCountAsk({ openAsks: 11, askTerms: 3 }), { n: 14, note: '<b>14 questions</b> only you can find out' },
    '11 open in the journal + 3 supplier terms the books cannot supply = 14');
  eq(S.mgrNavCountAsk({ openAsks: 0, askTerms: 0 }), { n: 0, note: null }, 'none is a counted zero, with no line');
  eq(S.mgrNavCountAsk({ openAsks: 1 }), { n: 1, note: '<b>1 question</b> only you can find out' }, 'one is one question');
}

/* ---------- 2. where the answer is found ---------- */
{
  const S = scope(book());
  const p = (b) => { const x = S.mgrAskPlace(b); return [x.kind, x.where, x.label]; };
  eq(p({ place: { kind: 'bank', name: 'Centenary Bank' } }), ['bank', 'supp', 'Ask Centenary Bank'], 'the bank is found among suppliers & bank');
  eq(p({ productId: 'P1', rival: 'Mengo Stores' }), ['rival', 'rival', 'At Mengo Stores\' counter'],
    'an old price ask (a line and a shop) is at that rival\'s counter');
  eq(p({ supplierId: 'S1' }), ['supplier', 'supp', 'Ask Roto Hardware'], 'a supplier the books hold is that supplier');
  eq(p({ supplierId: 'S404' }), ['you', 'you', 'Only you know'], 'one the books do not hold is not a place');
  eq(p({ place: { kind: 'customer', id: 'C4' } }), ['customer', 'cust', 'Nalubega Estates, Namugongo'], 'a customer, at their place');
  eq(p({ place: { kind: 'staff', staffId: 'ST003', name: 'Peter' } }), ['staff', 'staff', 'Ask Peter Wandera'], 'staff by id, named from the staff list');
  eq(p({ question: 'Is Mulongo still trading?' }), ['you', 'you', 'Only you know'], 'and anything else only the owner can find out');
  eq(S.mgrAskDeptOf({ dept: 'people' }, S.mgrAskPlace({})), 'people', 'the meeting\'s department wins');
  eq(S.mgrAskDeptOf({}, S.mgrAskPlace({ productId: 'P1', rival: 'X' })), 'sales', 'a rival\'s price is Sales');
  eq(S.mgrAskDeptOf({}, S.mgrAskPlace({ place: { kind: 'bank', name: 'B' } })), 'finance', 'the bank is Finance');
  eq(S.mgrAskDeptOf({ productId: 'P1' }, S.mgrAskPlace({ place: { kind: 'staff', staffId: 'ST003' } })), 'store', 'a count by staff is the Store');
  eq(S.mgrAskDeptOf({}, S.mgrAskPlace({})), null, 'and a question about nothing in particular is the whole shop, not a guess');
}

/* ---------- 3. the money at stake, and its arithmetic ---------- */
{
  const S = scope(book(), {
    /* P1: 40 units in 30 days × a 3,000 gap to Mengo = 120,000 a month. */
    marketVerdict: () => ({ under: [{ key: 'P1', atStake: 120000, units30: 40, gap: -3000, shop: 'Mengo' }], lift: [] }),
    rivalNeverChecked: () => [{ key: 'P2', earned30: 84000 }],
    waSalesByKey: () => new Map([['P3', { profit30: 5000.4 }]]),
    /* S1 owes 300,000 + 200,000 = 500,000 on two bills. */
    credOpenInvoices: () => [{ supplierId: 'S1', due: 300000, ageDays: 40, invoice: { id: 7, date: '2026-08-28' } },
      { supplierId: 'S1', due: 200000, ageDays: 10, invoice: { id: 9, date: '2026-09-27' } }],
    purchasePlan: () => ({ lines: [{ supplierId: 'S2', key: 'P4', cost: 70000 }, { supplierId: 'S2', key: 'P3', cost: 30000 }] }),
  });
  const st = (b) => { const pl = S.mgrAskPlace(b); const pr = b.productId && b.rival ? { productId: b.productId, variantIdx: null, rival: b.rival } : null;
    const x = S.mgrAskStake(b, pl, pr, TODAY); return x && [x.amount, x.unit, x.basis]; };
  eq(st({ stake: 250000, productId: 'P1', rival: 'Mengo' }), [250000, '', 'sized at the meeting'], 'the meeting\'s sizing comes first, and says it is the meeting\'s');
  eq(st({ productId: 'P1', rival: 'Mengo' }), [120000, 'a month', '40 sold in 30 days × the 3,000 gap to Mengo'],
    'a price ask: 40 × 3,000 = 120,000 a month, with its working');
  eq(st({ productId: 'P2', rival: 'Mengo' }), [84000, 'earned in 30 days', 'what the line earned in 30 days, with no rival price on file'],
    'a line nobody has checked: what it earned');
  eq(st({ productId: 'P3', rival: 'Mengo' }), [5000, 'earned in 30 days', 'what the line earned in 30 days'], 'else the sales reading, rounded');
  eq(st({ productId: 'P4', rival: 'Mengo' }), null, 'nothing sells it: not sized — null, never 0');
  eq(st({ supplierId: 'S1' }), [500000, 'owed', 'owed to Roto Hardware on 2 open bills'], 'a supplier: 300,000 + 200,000 owed');
  eq(st({ supplierId: 'S2' }), [100000, 'to buy', '2 lines on the buy plan from Cash Co'], 'nothing owed: the buy plan, 70,000 + 30,000');
  eq(st({ supplierId: 'S1', productId: 'P4' }), [70000, 'to buy', 'what the buy plan would spend on Hinge'],
    'a supplier\'s price for one line is sized by what the plan would spend on that line, whoever it is planned from — not by their open bills');
  eq(st({ place: { kind: 'supplier', id: 'S2' }, productId: 'P1' }), null, 'and a line the plan does not buy is not sized');
  eq(st({ question: 'Should Okello move to a weekly wage?' }), null, 'a question only you can answer is not sized');
}

/* ---------- 4. how old what is on file is ---------- */
{
  const S = scope({ ...book(), prices: [{ supplierId: 'S1', productId: 'P2', variantIdx: null, date: '2026-09-30' },
    { supplierId: 'S1', productId: 'P3', variantIdx: null, date: '', lastAskedAt: '2026-10-05T09:00:00Z' }] }, {
    rivalPriceLatest: () => [{ rival: 'Mengo', daysOld: 12 }, { rival: 'mengo', daysOld: 3 }, { rival: 'Other', daysOld: 1 }],
    invCountRecords: () => [{ key: 'P1', date: '2026-10-03' }],
  });
  const k = (b, asked) => { const pl = S.mgrAskPlace(b); const pr = b.productId && b.rival ? { productId: b.productId, variantIdx: null, rival: b.rival } : null;
    return S.mgrAskKnown(b, pl, pr, asked, TODAY).text; };
  eq(k({ productId: 'P1', rival: 'Mengo ' }), 'their price is 3 days old', 'the asked rival\'s freshest price, whatever the case of its name');
  eq(k({ productId: 'P1', rival: 'Nyanzi' }), 'no price of theirs on file', 'a rival never seen says so');
  eq(k({ place: { kind: 'supplier', id: 'S1' }, productId: 'P2' }), 'their price is 7 days old', 'the supplier\'s registry price: 30 Sep to 7 Oct = 7 days');
  eq(k({ place: { kind: 'supplier', id: 'S1' }, productId: 'P3' }), 'last asked 2 days ago', 'no dated price: when it was last asked for (5 Oct)');
  eq(k({ place: { kind: 'staff', staffId: 'ST003' }, productId: 'P1' }), 'last counted 4 days ago', 'a line on the shelf: its last count, 3 Oct');
  eq(k({ productId: 'P2' }), 'never counted', 'a line never counted says so');
  eq(k({ place: { kind: 'customer', id: 'C4' } }), 'site at walling, said 10 days ago', 'a customer\'s site stage: 27 Sep to 7 Oct');
  eq(k({}, '2026-10-02'), 'asked 5 days ago', 'with nothing on file, how long the question has waited');
  eq(k({}, TODAY), 'asked today', 'down to today');
}

/* ---------- 5. how sure, and what each answer would change ---------- */
{
  const S = scope(book(), { mgrConfidence: (m) => m.mkind === 'price' ? { pips: 3, source: 'counted', basis: 'from a rival price 3 days old' }
    : { pips: null, source: null, basis: null } });
  const sure = (b) => { const pl = S.mgrAskPlace(b); const pr = b.productId && b.rival ? { productId: b.productId, variantIdx: null, rival: b.rival } : null;
    const x = S.mgrAskSure(b, pl, pr); return [x.pips, x.source, x.basis]; };
  eq(sure({ confidence: 4, productId: 'P1', rival: 'Mengo' }), [4, 'judged', 'judged'], 'the meeting\'s 1-5, labelled judged');
  eq(sure({ productId: 'P1', rival: 'Mengo' }), [3, 'counted', 'from a rival price 3 days old'], 'else counted, saying what it counted');
  eq(sure({}), [null, null, 'not known'], 'else not known — never a made-up middle');
  const ch = S.mgrAskChoices({ choices: ['A', 'B', 'C', 'D'], choiceEffects: [{ label: 'A', effect: 'Hold the price.', confidenceAfter: 2 },
    { label: 'Z', effect: 'misaligned' }, { label: 'C', confidenceAfter: 5 }] }, 4);
  eq(ch.map((c) => [c.label, c.effect, c.after, c.tone]), [['A', 'Hold the price.', 2, 'down'], ['B', '', null, null], ['C', '', 5, 'up']],
    'three at most; each beside its own effect — a misaligned effect is dropped, never moved onto another answer');
  eq(S.mgrAskChoices({ choices: ['Only one'] }, 3), [], 'one answer is not a choice');
}

/* ---------- 6. who could find out, and the message they get ---------- */
{
  const S = scope(book());
  const d = (b) => { const x = S.mgrAskDelegate(b, S.mgrAskPlace(b)); return x && [x.first, x.phone, x.why]; };
  eq(d({ delegate: { staffId: 'ST002', name: 'Moses' } }), ['Moses', '0700 555 222', null], 'a delegate on the staff list, with their number');
  eq(d({ delegate: { staffId: 'ST003', name: 'Peter' } }), ['Peter', null, 'no phone number for Peter on file'], 'no number: it says why it cannot send');
  eq(d({ delegate: { name: 'Kizza' } }), ['Kizza', null, 'Kizza is not on your staff list, so there is no number to send to'],
    'a name the books do not hold is a name and nothing more');
  eq(d({ place: { kind: 'staff', staffId: 'ST001' } }), ['Joan', '0700 555 111', null], 'a question for a member of staff can be sent to them');
  eq(d({}), null, 'and a question for the owner has nobody to send it to');
  const it = S.mgrAskItem({ id: 5, date: TODAY, body: { question: 'Is the estate paying in stages?', why: 'it decides their credit.',
    choices: ['Yes', 'No'], place: { kind: 'customer', id: 'C4' }, delegate: { staffId: 'ST002', name: 'Moses Kibirige' } } }, TODAY);
  eq(S.mgrAskMessage(it), 'Is the estate paying in stages?\n\nWhy: it decides their credit.\n\nPlease bring back which it is: Yes / No.',
    'the message: the question, why, and what to bring back');
  const html = S.mgrAskCardHTML({ ...it, rank: 1, rk: '01', today: TODAY });
  t.check(/href="https:\/\/wa\.me\/256700555222\?text=Is%20the%20estate/.test(html) && /target="_blank"/.test(html) && />Send to Moses</.test(html),
    'Send to opens the owner\'s own WhatsApp to Moses with it written — a link the owner taps, nothing sent');
  const peter = S.mgrAskCardHTML({ ...S.mgrAskItem({ id: 6, date: TODAY, body: { question: 'Count it?', delegate: { staffId: 'ST003', name: 'Peter' } } }, TODAY),
    rank: 2, rk: '02', today: TODAY });
  t.check(/<button type="button" class="btn btn-ghost ow-sm mgr-k-send" disabled title="no phone number for Peter on file">No number for Peter<\/button>/.test(peter),
    'and with no number the button says why it cannot send');
}

/* ---------- 7. supplier terms the books cannot supply (Q9) ---------- */
{
  const bills = [{ supplierId: 'S1', due: 300000, ageDays: 40, invoice: { id: 7, date: '2026-08-28' } },
    { supplierId: 'S1', due: 200000, ageDays: 10, invoice: { id: 9, date: '2026-09-27' } },
    { supplierId: 'S3', due: 50000, ageDays: 5, invoice: { id: 11, date: '2026-10-02' } }];
  const data = { ...book(), purchaseInvoices: [{ supplierId: 'S2', date: '2026-09-01' }, { supplierId: 'S4', date: '2026-06-01' },
    { supplierId: 'S4', date: '2026-09-20', voided: true }] };
  const S = scope(data, { credOpenInvoices: () => bills,
    supplierLeadTimes: () => [{ supplierId: 'S2', typical: true, days: 2, deliveries: 5 }] });
  const asks = S.mgrAskTermsAsks(TODAY, {});
  /* S1 is owed and knows nothing: all three. S2 gives no credit (0 days),
     so has no age it stops at, and its delivery is measured: nothing.
     S3 knows all three. S4's only purchase in 90 days was voided, and its
     other is from June (90 days back from 7 Oct is 10 Jul): not asked. */
  eq(asks.map((a) => [a.key, a.terms.missing]), [['terms:S1', ['stopAtDays', 'creditDays', 'deliveryDays']]],
    'only the supplier owed or bought from, and only what is unknown');
  const a = asks[0];
  eq(a.question, 'What are Roto Hardware\'s terms with you?', 'asked in the Manager\'s words');
  eq(a.why, 'You owe them 500k on 2 bills, the oldest 40 days old. Without them I can’t warn you before a bill reaches the age they stop supplying at, tell a bill that is late from one that is on time or date the last day to order before a line runs out.',
    'with its own reason, from the books');
  eq([a.stake.amount, a.stake.unit], [500000, 'owed'], 'at stake: what is owed to them');
  eq([a.place.where, a.dept, a.known.text], ['supp', 'procurement', 'never recorded'], 'found from the supplier, Procurement, never recorded');
  const told = S.mgrAskTermsAsks(TODAY, { journalTerms: new Map([['S1', { stopAtDays: 90, creditDays: 30 }]]) });
  eq([told[0].terms.missing, told[0].question], [['deliveryDays'], 'How many days does Roto Hardware take to deliver?'],
    'what the owner already told the journal is known, even where the supplier list cannot hold it yet');
  eq(S.mgrAskTermsAsks(TODAY, { openTerms: new Set(['S1']) }).length, 0, 'a terms question open in the journal stands in for this one');
  /* Typed: 60 days from the oldest bill (28 Aug) is 27 Oct; at 30 days it
     is already 40 − 30 = 10 days past; 21 days' credit: the 40-day bill
     is past it, the 10-day one is not — 1 of 2. */
  eq(S.mgrAskTermsEffect(a, { stopAtDays: 60 }), ['PINV-0007 reaches 60 days on 27 Oct.'], 'what the age they stop at would date');
  eq(S.mgrAskTermsEffect(a, { stopAtDays: 30, creditDays: 21 }), ['PINV-0007 is already 10 days past it.', '1 of 2 open bills are past 21 days’ credit.'],
    'and what the credit would say about the open bills');
  eq(S.mgrAskTermsEffect(a, { deliveryDays: 3 }), [], 'a delivery time changes nothing on the books yet, so nothing is said');
  eq(S.mgrAskTermsClean({ stopAtDays: '90', creditDays: '', deliveryDays: '-2' }), { stopAtDays: 90 }, 'only whole, non-negative days are kept');
  eq(S.mgrAskTermsWords({ stopAtDays: 90, creditDays: 0 }), 'Stops supplying at 90 days, cash on delivery', 'and the answer is said in words');
}

/* ---------- 8. answering terms writes the supplier, and names 0107 ---------- */
{
  const data = book();
  let saved = 0;
  const S = scope(data, { saveData: () => { saved++; return Promise.resolve(true); } });
  let w = await S.mgrAskWriteTerms('S1', { stopAtDays: 90, deliveryDays: 3 });
  eq([w.ok, data.suppliers[0].stopAtDays, data.suppliers[0].deliveryDays, data.suppliers[0].creditDays, saved], [true, 90, 3, null, 1],
    'the days go onto the supplier\'s own record through the one save, and an unanswered field stays unknown');
  const old = scope(book(), { supplierTermsColumns: false });
  w = await old.mgrAskWriteTerms('S1', { stopAtDays: 90 });
  t.check(!w.ok && /0107_manager_intelligence\.sql/.test(w.why), 'a shop without 0107 is told the one paste that fixes it');
  const inserts = [], answered = [];
  const sb = { from: () => ({ insert: (row) => { inserts.push(row); return { select: () => ({ single: () => Promise.resolve({ data: { id: 42 }, error: null }) }) }; } }) };
  const A = scope(book(), { sb, credOpenInvoices: () => [{ supplierId: 'S1', due: 5, ageDays: 1, invoice: { id: 1, date: TODAY } }],
    managerAnswerQuestion: (id, text, opts) => { answered.push([id, text, opts]); return Promise.resolve({ ok: true }); } });
  const it = A.mgrAskTermsAsks(TODAY, {})[0];
  await A.mgrAskAnswerTerms(it, { terms: { stopAtDays: '90', creditDays: '30' }, by: { staffId: 'ST001', name: 'Joan Nakato' } });
  eq([inserts[0].kind, inserts[0].status, inserts[0].body.source, inserts[0].body.supplierId, inserts[0].body.place],
    ['question', 'open', 'terms', 'S1', { kind: 'supplier', id: 'S1' }], 'the question is written into the journal as it is answered');
  eq(answered[0], [42, 'Stops supplying at 90 days, 30 days’ credit', { by: { staffId: 'ST001', name: 'Joan Nakato' }, terms: { stopAtDays: 90, creditDays: 30 } }],
    'and answered through the one writer, with the days and who found them');
  t.check(A.__kept().has('terms:S1'), 'its card stays, done, for the session');
}

/* ---------- 9. who found it, and the terms, on the answer itself ---------- */
{
  const mk = (row, over) => {
    const seen = { updates: [], toasts: [], wrote: [] };
    const fn = compileScope([extractFunction(src, 'managerAnswerQuestion', 'index.html'),
      extractFunction(src, 'mgrPossessive', 'index.html')], {
      managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
      toast: (m) => seen.toasts.push(m), renderManager: () => {}, fmtUGX: String,
      buyKeyParts: () => null, stockKey: (p) => p,
      mgrAskWriteTerms: (sid, days) => { seen.wrote.push([sid, days]); return Promise.resolve({ ok: true, name: 'Roto Hardware' }); },
      sb: { from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { body: { ...row } } }) }) }) }),
        update: (patch) => { seen.updates.push(patch); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; },
      }) },
      String, Number, Math, Promise, JSON, Object, Array,
      ...over,
    }, ['managerAnswerQuestion']).managerAnswerQuestion;
    return { fn, seen };
  };
  let { fn, seen } = mk({ question: 'Is the estate paying in stages?' });
  let r = await fn(5, 'Yes, in stages', { by: { staffId: 'ST002', name: 'Moses Kibirige', phone: 'x' } });
  eq(seen.updates[0].body.answeredBy, { staffId: 'ST002', name: 'Moses Kibirige' }, 'Moses found it — recorded by id, nothing else carried');
  eq(r.ok, true, 'and the writer says it landed');
  ({ fn, seen } = mk({ question: 'q' }));
  await fn(5, 'yes');
  eq(seen.updates[0].body.answeredBy, 'you', 'with nobody named, it is the owner\'s own');
  ({ fn, seen } = mk({ question: 'Terms?', supplierId: 'S1', source: 'terms' }));
  await fn(9, 'Stops supplying at 90 days', { terms: { stopAtDays: '90', creditDays: '', deliveryDays: 3 } });
  eq(seen.wrote, [['S1', { stopAtDays: 90, deliveryDays: 3 }]], 'a terms answer writes the supplier\'s days — an empty box is not a 0');
  eq(seen.updates[0].body.terms, { stopAtDays: 90, deliveryDays: 3 }, 'and the journal keeps them beside the words');
  t.check(/Roto Hardware's terms are on their record/.test(seen.toasts[0]), 'the toast says where they went');
  ({ fn, seen } = mk({ question: 'Terms?', supplierId: 'S1' }, {
    mgrAskWriteTerms: () => Promise.resolve({ ok: false, why: 'paste supabase/migrations/0107_manager_intelligence.sql' }) }));
  r = await fn(9, 'x', { terms: { stopAtDays: 90 } });
  t.check(seen.updates.length === 1 && r.ok && /^Kept in the journal, but paste .*0107/.test(seen.toasts[0]),
    'without 0107 the answer is still kept in the journal, and the missing update is named');
}

/* ---------- 10. the band's sentence and figures ---------- */
{
  const S = scope(book());
  const items = [null, null, 1230000, 2600000, 5000].map((amount, i) => ({ key: 'q' + i, done: null,
    stake: amount ? { amount } : null, choices: i === 2 ? [{ label: 'a', effect: 'x' }, { label: 'b', effect: '' }] : [] }));
  /* The top four: two not sized, 1,230,000 + 2,600,000 = 3,830,000 = 3.83m. */
  eq(S.mgrAskHeadline(items), 'Five things I can’t read in your books. The top four decide advice worth 3.83m — two are not sized. A tap each — and I’ll show you what your answer changed.',
    'five open; the top four carry 3.83m; and the promise to show what an answer changed only where the meeting said so');
  eq(S.mgrAskHeadline(items.map((x) => ({ ...x, choices: [] })).slice(0, 1)), 'One thing I can’t read in your books. A line each, and I read it at the next meeting.',
    'one unsized question: nothing claimed about money');
  eq(S.mgrAskHeadline([]), 'Nothing I can’t read in your books right now. When a meeting needs what the books can’t say, I’ll ask it here.', 'and none');
  const model = S.mgrAskModel([
    { id: 3, date: TODAY, body: { question: 'Second asked today', stake: 100000 } },
    { id: 2, date: TODAY, body: { question: 'First asked today', place: { kind: 'bank', name: 'Centenary' } } },
    { id: 1, date: '2026-10-01', body: { question: 'Asked last week', place: { kind: 'staff', staffId: 'ST001' } } },
  ], null, TODAY);
  eq(model.items.map((x) => [x.rk, x.question]), [['01', 'First asked today'], ['02', 'Second asked today'], ['03', 'Asked last week']],
    'the Manager\'s own order: the newest meeting first, each meeting in the order it asked');
  eq([model.open, model.riding, model.sized, model.counts], [3, 100000, 1, { all: 3, you: 1, rival: 0, supp: 1, staff: 1, cust: 0 }],
    'still open 3, riding 100,000 on the 1 sized, and the five places counted');
  t.check(model.reading && model.hist === null, 'the answered side reads as being read until it lands — never as zero');
}

/* ---------- 11. the field route ---------- */
{
  /* Pins on the equator so the arithmetic is plain: 0.05° and 0.1° of
     longitude from the shop at (0,0) are 6371 × 0.05π/180 = 5.56 km and
     11.12 km -- 5.6 and 11.1 rounded. */
  const pins = { Namugongo: { lat: 0, lng: 0.1 }, Seeta: { lat: 0, lng: 0.05 }, Nakawa: { lat: 0, lng: 0.02 } };
  const S = scope(book(), { placePin: (n) => pins[n] || null });
  const q = (id, body) => ({ id, date: TODAY, body: { question: 'Q' + id, ...body } });
  const model = S.mgrAskModel([
    q(1, { productId: 'P1', rival: 'Mengo', delegate: { staffId: 'ST002', name: 'Moses' } }),
    q(2, { place: { kind: 'customer', id: 'C4' }, delegate: { staffId: 'ST002' } }),
    q(3, { place: { kind: 'customer', id: 'C5' }, delegate: { staffId: 'ST002' } }),
    q(4, { place: { kind: 'supplier', id: 'S1' }, delegate: { staffId: 'ST001' } }),
    q(5, { productId: 'P1', rival: 'Kikuubo' }),
    q(6, { place: { kind: 'staff', staffId: 'ST003' }, delegate: { staffId: 'ST002' } }),
  ], null, TODAY);
  const r = S.mgrAskRoute(model.items, { pin: { lat: 0, lng: 0 }, from: 'from the shop' });
  eq([r.person.first, r.questions, r.visits], ['Moses', 3, 5],
    'Moses has three of the five visits (a member of staff\'s question is not a visit); the route is his');
  eq(r.stops.map((s) => [s.n, s.name, s.km, s.pinned]), [[1, 'Ssali Builders', 5.6, true], [2, 'Nalubega Estates', 11.1, true], [3, 'Mengo', null, false]],
    'nearest first by the pins, and a rival\'s counter with no pin named and last');
  eq(r.from, 'from the shop', 'and it says what the distances are from');
  const none = S.mgrAskRoute(model.items.map((x) => ({ ...x, delegate: null })), null);
  eq([none.person, none.stops.length, none.stops.every((s) => s.km == null)], [null, 5, true],
    'with nobody named, the visits are listed and no route is offered to send');
}

/* ---------- 12. answers that changed the advice (ASK.7) ---------- */
{
  const S = scope(book());
  eq(S.mgrAskMonth(TODAY), { from: '2026-09-01', to: '2026-09-30', name: 'September' }, 'the band counts the last whole month, as the canvas does');
  const rows = [
    { id: 1, status: 'answered', body: { question: 'Until when?', answer: 'Until March', answeredOn: '2026-09-21' } },
    { id: 2, status: 'answered', body: { question: 'Kasubi?', answer: 'At our cost', answeredOn: '2026-09-18', answeredBy: { staffId: 'ST002', name: 'Moses Kibirige' } } },
    { id: 3, status: 'answered', body: { question: 'Simba?', answer: 'No', answeredOn: '2026-09-08' } },
    { id: 4, status: 'answered', body: { question: 'What happened?', answer: 'A big order', answeredOn: '2026-09-18', unusualDay: '2026-09-17' } },
    { id: 5, status: 'answered', body: { question: 'Ndeeba Y12?', answer: '47800', answeredOn: '2026-10-04' } },
    { id: 6, status: 'answered', body: { question: 'Late?', answer: 'Yes', answeredOn: '2026-09-25' } },
  ];
  const pointers = [{ id: 82, kind: 'move', date: '2026-09-24', fromQuestion: 1, title: 'Order 200 bags of Simba' },
    { id: 66, kind: 'move', date: '2026-09-21', fromQuestion: 2, title: 'Reprice Tororo' },
    { id: 110, kind: 'move', date: '2026-10-07', fromQuestion: 5, title: 'Bring Y12 to within 2%' },
    { id: 70, kind: 'move', date: '2026-09-20', fromQuestion: 6, title: 'Made before the answer' },
    { id: 9, kind: 'target', date: '2026-09-25', fromQuestion: 1, metric: 'collections' }];
  /* September's answers: 1, 2, 3 and 6 (4 is the Out of the ordinary
     section's) = 4. Changed: 1 and 2 have a move made on or after the
     day they were answered; 6's only pointer came before it = 2 of 4. */
  const h = S.mgrAskHistory(rows, pointers, TODAY);
  eq([h.answered, h.changed], [4, 2], '2 of 4 of September\'s answers changed the advice');
  eq(h.rows.map((r) => [r.id, r.who, r.said, r.did, r.more, r.when]), [
    [5, 'You told me', '47800', 'I proposed: Bring Y12 to within 2%', 0, '2026-10-04'],
    [1, 'You told me', 'Until March', 'I proposed: Order 200 bags of Simba', 1, '2026-09-21'],
    [2, 'Moses found', 'At our cost', 'I proposed: Reprice Tororo', 0, '2026-09-18'],
  ], 'listed newest first, with who found it and the first thing the advice did with it');
}

/* ---------- 13. a price on one scale ---------- */
{
  const S = scope(book(), { ourCostFor: () => ({ cost: 38200 }), ourPriceFor: () => 44000,
    rivalMarketRows: () => [{ key: 'P1', comparable: true, side: 'wholesale', theirs: 47500, shop: 'Nakasero Stores', daysOld: 4 },
      { key: 'P1', comparable: true, side: 'retail', theirs: 52000, shop: 'Retail Only', daysOld: 1 },
      { key: 'P1', comparable: false, side: 'wholesale', theirs: 900000, shop: 'By the carton', daysOld: 1 }] });
  /* 38,200 to 47,500 is 9,300 wide; the pad is the larger of 12% of it
     (1,116) and 2% of the top (950), so the scale runs 37,084 to 48,616
     (11,532). Your cost sits at 1,116/11,532 = 9.7%, yours at
     6,916/11,532 = 60.0%, Nakasero at 10,416/11,532 = 90.3%. */
  const sc = S.mgrAskScale({ productId: 'P1', variantIdx: null, rival: 'Nakasero Stores' }, TODAY);
  eq(sc.marks.map((m) => [m.l, m.v, m.x, m.tone]), [['your cost', 38200, 9.7, 'cost'], ['yours', 44000, 60, 'ours'], ['Nakasero', 47500, 90.3, 'asked']],
    'your cost, your price and each comparable wholesale price on one scale — the retail side and an unconverted pack price stay off it');
  /* Label widths at 6.4px a letter on ~240px: "your cost 38,200" is 23.0%
     either side, "yours 44,000" 17.7%, "Nakasero 47,500" 21.7%. The cost
     goes above (ends at 32.7%); yours below; Nakasero (from 68.6%) fits
     above again -- one row each side, nothing printed over anything. */
  eq([sc.marks.map((m) => m.pos), sc.tall], [['up', 'dn', 'up'], false], 'labels alternate, a second row only when two would collide');
  eq(S.mgrAskScale({ productId: 'P9', variantIdx: null, rival: 'X' }, TODAY) && S.mgrAskScale({ productId: 'P9', variantIdx: null, rival: 'X' }, TODAY).marks.length, 2,
    'two marks still make a scale');
  const lone = scope(book(), { ourPriceFor: () => 44000 });
  eq(lone.mgrAskScale({ productId: 'P1', variantIdx: null, rival: 'X' }, TODAY), null, 'one mark says nothing and draws nothing');
  eq(S.mgrAskRangeOf('Under 45,000'), { lo: null, hi: 45000 }, 'a likely answer\'s range: under');
  eq(S.mgrAskRangeOf('45,000–46,500'), { lo: 45000, hi: 46500 }, 'between');
  eq(S.mgrAskRangeOf('Still 47,000 or more'), { lo: 47000, hi: null }, 'or more');
  eq([S.mgrAskRangeOf('Yes'), S.mgrAskRangeOf('a 2nd supplier')], [null, null], 'and words, or a 2 in "2nd", are no range');
}

/* ---------- 14. the section, drawn ---------- */
{
  const S = scope(book(), { mgrConfidence: () => ({ pips: 3, source: 'counted', basis: 'from a rival price 3 days old' }),
    marketVerdict: () => ({ under: [{ key: 'P1', atStake: 120000, units30: 40, gap: -3000, shop: 'Mengo' }], lift: [] }),
    credOpenInvoices: () => [{ supplierId: 'S1', due: 500000, ageDays: 40, invoice: { id: 7, date: '2026-08-28' } }] });
  const model = S.mgrAskModel([
    { id: 9, date: TODAY, body: { question: 'What is Mengo charging for G28?', productId: 'P1', rival: 'Mengo', why: 'it decides the price.',
      dept: 'sales', choices: ['Under 40,000', 'More'], choiceEffects: [{ label: 'Under 40,000', effect: 'Hold the price.', confidenceAfter: 2 }],
      delegate: { staffId: 'ST002', name: 'Moses' } } },
    { id: 8, date: '2026-10-01', body: { question: 'Should Okello move to a weekly wage?', choices: ['Yes', 'No'] } },
  ], { rows: [], pointers: [], error: null }, TODAY);
  const html = S.mgrAsksHTML(model);
  t.check(/<section class="mgr-k-hd"/.test(html) && /<span>Still open<\/span><b class="mgr-k-fig">3<\/b>/.test(html)
    && /<span>Answered in September<\/span><b class="mgr-k-fig">0<\/b>/.test(html) && /<span>Changed my advice<\/span><b class="mgr-k-fig mgr-k-good">—<\/b>/.test(html),
    'the band: still open (two asked + one supplier\'s terms), answered last month, and "—" where nothing was answered to change anything');
  t.check(['all', 'you', 'rival', 'supp', 'staff', 'cust'].every((k) => new RegExp(`class="mgr-k-wf" data-place="${k}"`).test(html))
    && /Suppliers &amp; bank<span class="mgr-k-n">1<\/span>/.test(html), 'where you are now: everywhere and the five places, each counted');
  t.check(/<span class="mgr-k-rk mgr-k-rk1">01<\/span><span class="mgr-k-dp" style="background:var\(--ow-oxide-soft\);color:var\(--ow-oxide-deep\)">Sales<\/span>/.test(html),
    'a card: its rank, the top one filled, and its department in the category tint');
  t.check(/120k <small>a month<\/small>/.test(html) && /not sized<\/span>/.test(html), 'the money at stake, or "not sized"');
  t.check(/<b>Why I’m asking:<\/b> it decides the price\./.test(html) && /not recorded — asked before the Manager kept its reasons/.test(html),
    'why it asks — and an old question says its reason was not recorded');
  t.check(/data-place="rival" aria-label="What is Mengo/.test(html) && /At Mengo's counter/.test(html), 'where to find out, filterable');
  t.check(/class="mgr-k-an" data-pick="0" aria-pressed="false">Under 40,000<\/button>/.test(html) && /data-pick="own"/.test(html),
    'the likely answers to tap, and one in the owner\'s own words');
  t.check(/inputmode="decimal"/.test(html) && /What Mengo charges — just the figure/.test(html), 'a price is asked for as a figure, on a phone keypad');
  t.check(/<span>Sure without it<\/span><span class="mgr-k-pips"[^>]*>(<i class="mgr-k-on"><\/i>){3}(<i><\/i>){2}<\/span><span class="mgr-k-fig">3\/5<\/span><span class="mgr-k-src" title="from a rival price 3 days old">from a rival price 3 days old<\/span>/.test(html),
    'how sure without it: counted pips, the figure, and what was counted');
  t.check(/<select class="mgr-k-sel" aria-label="Who found it out"><option value="you" selected>You<\/option><option value="st:ST002">Moses Kibirige<\/option>/.test(html),
    'found by: the owner, then the person it was given to first');
  t.check(/What are Roto Hardware's terms with you\?/.test(html) && /data-term="stopAtDays"/.test(html) && /data-term="creditDays"/.test(html),
    'a supplier\'s terms are asked as days, one box each');
  t.check(/class="ow-mini mgr-ask-cut" hidden/.test(html), 'the line that names what was not shown is there for the count to fill');
  const oxide = html.match(/class="btn btn-accent[^"]*"[^>]*>[^<]*</g) || [];
  t.check(oxide.length === 2 && oxide.every((b) => />Draft the route for Moses</.test(b)) && /<div class="mgr-k-dock">/.test(html),
    'one oxide action, drafting the route — drawn in the route panel for the console and in the thumb dock for the phone');
  const wire = extractFunction(src, 'mgrWireAsks', 'index.html');
  t.check(/querySelectorAll\('\.mgr-k-q\[data-qkey\]'\)/.test(wire) && /mgrAskKeep\(it, \{ text,/.test(wire),
    'each card is wired by its key, and keeps what is in the box');
  t.check(/input\.value = pick == null \? '' : it\.choices\[pick\]\.label/.test(wire), 'a tapped answer fills the box, so it can still be added to');
}

/* ---------- 15. kept this session: the card stays, done ---------- */
{
  const S = scope(book());
  const it = { ...S.mgrAskItem({ id: 4, date: TODAY, body: { question: 'Paid in stages?', choices: ['Yes', 'No'],
    choiceEffects: [{ label: 'Yes', effect: 'Keep the cap.', confidenceAfter: 4 }], confidence: 2 } }, TODAY), today: TODAY };
  S.__kept().set('q:4', { item: it, pick: 0, text: 'Yes', by: { staffId: 'ST002', name: 'Moses Kibirige' }, on: TODAY });
  const model = S.mgrAskModel([], { rows: [], pointers: [], error: null }, TODAY);
  eq([model.items.length, model.open, !!model.items[0].done], [1, 0, true], 'an answer kept this session stays on the screen, done, and is not open');
  const html = S.mgrAsksHTML(model);
  t.check(/mgr-k-q mgr-k-done/.test(html) && /aria-pressed="true" disabled>Yes</.test(html), 'its answer pressed');
  t.check(/<b>What that changes:<\/b> Keep the cap\./.test(html) && /<span class="mgr-k-fig">2 → 4<\/span>/.test(html),
    'with what it changes and how sure it leaves the Manager, before → after');
  t.check(/Kept — Moses' answer: Yes/.test(html), 'and who found it');
}

/* ---------- 16. the painter and the journal reading ---------- */
{
  const paint = extractFunction(src, 'mgrPaintAsk', 'index.html');
  t.check(/mgrAskReadAnswered\(\)\.then\(r=>\{\s*if\(gen !== mgrRenderGen\) return;/.test(paint),
    'the answered side is read beside the journal and lands only while its render is current');
  t.check(/ctx\.askTerms = mgrAskTermsAsks\(todayISO\(\), \{\}\)\.length;/.test(paint) && /ctx\.askTerms = model\.items\.filter/.test(paint),
    'the supplier terms are counted for the nav from the books, then from the drawing');
  t.check(/if\(why === 'read' && root && root\.dataset\.terms === model\.termsKey\)/.test(paint),
    'a reading that lands after the cards only redraws the band and the memory — never what the owner is typing');
  const read = extractFunction(src, 'mgrAskReadAnswered', 'index.html');
  t.check(!/'play'/.test(read) && /\.in\('kind', \['move', 'target'\]\)/.test(read), 'it reads moves and targets — a play is the playbook\'s alone to read');
  const load = extractFunction(src, 'managerLoadState', 'index.html');
  t.check(/\.eq\('kind', 'question'\)\.eq\('status', 'open'\)\s*\.order\('id', \{ ascending: false \}\)\.limit\(200\)/.test(load)
    && (load.match(/\bawait\b/g) || []).length === 2, 'every open question is read now, not the newest six — and the reading still waits only twice');
}
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
