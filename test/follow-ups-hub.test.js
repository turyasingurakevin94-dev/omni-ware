#!/usr/bin/env node
'use strict';
/*
 * Follow-ups, the hub: every client with a reason to hear from the shop,
 * in one queue, one message each.
 *
 * Four engines each knew one reason to contact a client and each had its
 * own page: kept-posted news (Follow-ups), a debt (Chase), a worth-telling
 * reason (Worth telling), a customer gone quiet (the Customers band). The
 * owner asked for one place. The hub joins them PER CLIENT without forking
 * any of them: every reason is read from the engine that owns it, every
 * stamp is written through the function that engine already uses, and
 * each engine's hold-backs still apply.
 *
 * What this file protects:
 *   - a day the owner PROMISED is a reason, ranked above news, and is
 *     discharged by the contact that keeps it (and restored by the undo);
 *   - the hub is keyed on the customer, ranks promised > money > news >
 *     telling > quiet, and never shows a client one engine is
 *     deliberately leaving alone without NAMING why;
 *   - the message is in sections, greets once, and carries an optional
 *     line only when the owner ticked it;
 *   - "It has gone" writes each engine's own stamp, and "It did not go"
 *     takes each back;
 *   - every sourcing door enrols a known customer, and nothing sends.
 *
 * Run: node test/follow-ups-hub.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('follow-ups hub');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const DAY = 86400000;
const NOW = Date.parse('2026-08-16T10:00:00.000Z');
const TODAY = '2026-08-16';
const ago = (days) => new Date(NOW - days * DAY).toISOString();
const day = (days) => new Date(NOW + days * DAY).toISOString().slice(0, 10);

const data = {};
const calls = { chased: [], unchased: [], briefs: [], undone: [] };
const NAMES = ['followUpsAll', 'followUpById', 'followUpIsOpen', 'openFollowUps',
  'followUpsForCustomer', 'followUpQuietDays', 'followUpSubject', 'followUpLastContact',
  'followUpSinceMs', 'followUpPriceNow', 'stockCrossingsByKey', 'stockCrossedInSince',
  'followUpBackInStock', 'followUpCompanionIn', 'followUpSourcingProgress', 'followUpPriceMoved',
  'followUpStanding', 'followUpPromised', 'followUpGoneQuiet', 'followUpReasons',
  'followUpClientsToContact', 'followUpDigest', 'findFollowUp', 'addFollowUp',
  'recordFollowUpContact', 'setFollowUpPromise', 'setFollowUpDetails', 'closeFollowUp',
  'reopenFollowUp', 'unrecordFollowUpContacts',
  'followUpHubRows', 'followUpHubDigest', 'fupHubRowsNow', 'recordFollowUpClient',
  'unrecordFollowUpClient', 'briefPlainLine', 'debtChaseMessage',
  'followUpBoughtSince', 'followUpAlreadyBought', 'hubScoreboard', 'hubScoreLabels', 'moneyWhy',
  'followUpHeldBack', 'fupChasedWords'];

let nextId = 1;
let scope = null, err = null;
try {
  scope = compileScope([
    'var fupPass = null; const fupDrafts = Object.create(null); const fupTicks = Object.create(null);',
    extractDeclaration(src, 'SOURCING_STATUS_ORDER', 'index.html'),
    extractDeclaration(src, 'SOURCING_SHORT_LABELS', 'index.html'),
    extractDeclaration(src, 'FOLLOW_UP_QUIET_DAYS_DEFAULT', 'index.html'),
    extractDeclaration(src, 'FOLLOW_UP_STAGE_WORDS', 'index.html'),
    extractDeclaration(src, 'FUP_HUB_RANK', 'index.html'),
    extractDeclaration(src, 'HUB_SCORE_LABELS', 'index.html'),
    extractDeclaration(src, 'FUP_MONEY_UNMEASURABLE', 'index.html'),
    extractDeclaration(src, 'TELL_WORKED_DAYS', 'index.html'),
    extractDeclaration(src, 'DEBT_CHASE_INVOICE_LINES', 'index.html'),
    extractDeclaration(src, 'fupDayISO', 'index.html'),
    ...NAMES.filter((n) => !['hubScoreLabels', 'moneyWhy'].includes(n)).map((n) => extractFunction(src, n, 'index.html')),
    // compileScope hands back functions only, so the label map is reached through one.
    'function hubScoreLabels(){ return HUB_SCORE_LABELS; }',
    'function moneyWhy(){ return FUP_MONEY_UNMEASURABLE; }',
  ], {
    data,
    saveData: () => {},
    toast: () => {},
    allocRowId: () => nextId++,
    stockKey: (pid, idx) => pid + '::' + (idx == null ? '' : idx),
    getStockQty: (pid, idx) => Number((data.stock || {})[pid + '::' + (idx == null ? '' : idx)]) || 0,
    productDisplayLabel: (p, idx) => p.name + (idx == null ? '' : ' ' + idx),
    catalogueSellAtQty: () => null,
    rankedPurchaseRowsAtQty: () => [{ purchasePrice: 1000, packQty: 0 }],
    pairCompanionsFor: () => [],
    sourcingLeadById: (id) => (data.sourcingLeads || []).find((l) => l.id === id) || null,
    contactPhones: (c) => [c && c.phone].map((x) => String(x || '').trim()).filter(Boolean),
    waComposeUrl: (phone, msg) => `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
    fmtUGX: (n) => Number(n).toLocaleString('en-UG') + ' UGX',
    fmtShortDate: (iso) => String(iso || '').slice(0, 10),
    agingDaysLabel: (d) => `${d} days`,
    shopIdentity: () => ({ name: 'OMNI-WARE', phone: '0700 000 000' }),
    /* The other engines, as the hub sees them: what each would say today. */
    debtChaseRows: () => data.__chase || { due: [], resting: [], blocked: [], promised: [] },
    /* The picture half of the score, as briefScoreboard would answer it. */
    briefScoreboard: () => data.__pics || { told: 0, worked: 0, worth: 0, byReason: {} },
    briefHeldList: () => data.__heldList || [],
    savedQuoteTotal: (q) => Number(q && q.total) || 0,
    briefQueue: () => data.__brief || [],
    customerBookRows: () => data.__book || [],
    custAttentionReason: (r) => r.__reason || null,
    briefHeldBack: (r) => r.__held || null,
    briefLastTold: () => null,
    markDebtChased: (id) => calls.chased.push(String(id)),
    unmarkDebtChased: (id) => calls.unchased.push(String(id)),
    recordBriefSent: (cid, key) => { calls.briefs.push([String(cid), key]); return data.__briefFails ? { ok: false, why: 'no table' } : { ok: true }; },
    undoBriefSent: (cid) => { calls.undone.push(String(cid)); return { ok: true }; },
  }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the hub compiles${err ? ` (${err.message})` : ''}`);
if (!scope) process.exit(1);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
function reset() {
  nextId = 1;
  Object.keys(data).forEach((k) => delete data[k]);
  Object.keys(calls).forEach((k) => { calls[k].length = 0; });
  Object.assign(data, {
    followUps: [],
    customers: [{ id: 'C1', name: 'Musa Kato', phone: '0700111222', debt: 0 },
      { id: 'C2', name: 'Amina Nabirye', phone: '0700222333', debt: 1240000 },
      { id: 'C3', name: 'Peter Ssebowa', phone: '0700333444', debt: 0 },
      { id: 'C4', name: 'Grace Achieng', phone: '0700444555', debt: 0 },
      { id: 'C5', name: 'Rose Nakato', phone: '0700555666', debt: 0 },
      { id: 'C6', name: 'Terms Late', phone: '0700666777', debt: 500000 },
      { id: 'C7', name: 'Held Back', phone: '0700777888', debt: 0 },
      { id: 'C8', name: 'Owes Plain', phone: '0700888999', debt: 300000 },
      { id: 'C9', name: 'News Only', phone: '0700999000', debt: 0 }],
    products: [{ id: 'P1', name: 'Cement 50kg' }, { id: 'P2', name: 'Nails 3in' }],
    stock: {}, stockLog: [], sourcingLeads: [], savedQuotes: [], presetFollowUp: {},
  });
}
const fu = (over) => {
  const f = Object.assign({
    id: nextId++, customerId: 'C1', productId: 'P1', variantIdx: null, leadId: null,
    qty: null, note: '', createdAt: ago(30), closedAt: null, closedReason: '', contacts: [], promisedOn: null,
  }, over);
  data.followUps.push(f);
  return f;
};
const chaseRow = (id, over) => Object.assign({ id, name: (data.customers.find((c) => c.id === id) || {}).name,
  debt: 1240000, ageDays: 47, band: 'b', phone: '0700', lastChased: null, chasedDaysAgo: null,
  promise: null, brokenPromises: 0, invoices: [{ no: 'INV-0011', date: '2026-07-01', due: 1240000, what: '10 bags cement' }],
  lastPaid: null }, over);
const bookRow = (id, reason, held) => ({ id, name: (data.customers.find((c) => c.id === id) || {}).name,
  phones: ['0700'], debt: 0, ageDays: -1, __reason: reason, __held: held || null });

/* ---------- 1. the day the owner promised ------------------------------ */
{
  reset();
  const f = fu({ promisedOn: TODAY });
  const rs = scope.followUpReasons(f, NOW);
  eq(rs.length && rs[0].kind, 'promised', 'a day that has come is a reason, and the first one');
  t.check(/we said we would get back to you by/.test(rs[0].text) && /still not in/.test(rs[0].text),
    'the line says what was promised and what is standing now — read from the shelf, not invented');
  data.stock['P1::'] = 12;
  t.check(/in stock now, 12 on hand/.test(scope.followUpReasons(f, NOW)[0].text),
    'and when it is in, the standing says so with the count');
  const late = fu({ customerId: 'C9', promisedOn: day(-3) });
  eq(scope.followUpReasons(late, NOW)[0].lateDays, 3, 'a day gone by counts how late');

  reset();
  const ahead = fu({ promisedOn: day(5) });
  eq(scope.followUpReasons(ahead, NOW).length, 0,
    'a day still ahead is no reason yet — and it silences gone-quiet, because a named day is not silence');
  ahead.promisedOn = null;
  eq(scope.followUpReasons(ahead, NOW)[0].kind, 'gone_quiet', 'without the day, 30 days of nothing is silence again');

  reset();
  const due = fu({ promisedOn: '2020-01-01' });
  const soon = fu({ customerId: 'C9', promisedOn: '2999-12-31' });
  scope.recordFollowUpContact(due.id, 'promised');
  scope.recordFollowUpContact(soon.id, 'gone_quiet');
  eq(due.promisedOn, null, 'the contact that keeps a promise discharges it');
  eq(soon.promisedOn, '2999-12-31', 'a promise for a day still ahead stands — they were told early');
  scope.unrecordFollowUpContacts([due.id]);
  eq(due.promisedOn, '2020-01-01', 'and "it did not go" puts the promised day back');

  eq(scope.setFollowUpPromise(due.id, 'friday'), null, 'a day in the wrong shape is refused, not stored');
  scope.setFollowUpPromise(due.id, '2026-09-04');
  eq(due.promisedOn, '2026-09-04', 'a day in the right shape is kept');
  scope.setFollowUpDetails(due.id, { qty: '24', note: 'grey' });
  t.check(due.qty === 24 && due.note === 'grey', 'quantity and note can be fixed after the fact');
}

/* ---------- 2. one row per client, across the engines ------------------ */
{
  reset();
  fu({ customerId: 'C1', promisedOn: day(-1) });                       // promised
  fu({ customerId: 'C1', productId: 'P2' });                           // and a second thing
  fu({ customerId: 'C9', promisedOn: null, createdAt: ago(30) });      // news (gone quiet)
  fu({ customerId: 'C3', productId: 'P1', createdAt: ago(2) });        // open on P1, nothing to say yet
  data.__chase = {
    due: [chaseRow('C2', { promise: { state: 'broken', promisedOn: day(-4), madeOn: day(-10) } }), chaseRow('C8', { debt: 300000 })],
    resting: [chaseRow('C1', { chasedDaysAgo: 1, debt: 90000 })],
    promised: [], blocked: [],
  };
  data.__brief = [
    { customer: data.customers[2], reason: { key: 'asked', productId: 'P1', chip: 'They asked', weight: 5, why: 'x' }, product: data.products[0] },
    { customer: data.customers[3], reason: { key: 'rhythm', productId: 'P2', chip: 'Due by rhythm', weight: 7, why: 'y' }, product: data.products[1], qty: 4, unit: 'kg', price: 9000 },
  ];
  data.__book = [
    bookRow('C5', { key: 'quiet', chip: 'Quiet 40 days', weight: 3, why: 'q', fig: '40', basis: 'days quiet' }),
    bookRow('C6', { key: 'terms', chip: '30 days past terms', weight: 9, why: 't', fig: '500,000', basis: 'UGX owed' }),
    bookRow('C7', { key: 'quiet', chip: 'Quiet 50 days', weight: 4, why: 'q', fig: '50', basis: 'days quiet' }, { key: 'chased', label: 'Chased 2d ago' }),
  ];
  const rows = scope.followUpHubRows(NOW);
  const ids = rows.map((r) => r.customerId);
  eq(ids.join(','), 'C1,C2,C8,C9,C4,C5',
    'promised, then money (broken promise first), then news, then worth telling, then quiet — one row each');
  eq(new Set(ids).size, ids.length, 'keyed on the customer: nobody is listed twice');
  const c1 = rows[0];
  t.check(c1.kinds.has('promised') && c1.kinds.has('news') && !c1.kinds.has('money'),
    'a client Chase is resting is NOT chased here');
  t.check(c1.held.some((h) => /chased 1d ago/.test(h.label)),
    'but the debt is named on their row, with why it is not in the message');
  t.check(!ids.includes('C3'), 'a worth-telling "they asked" yields to the open follow-up on the same product — that engine reports it, on its own stamp');
  t.check(!ids.includes('C6'), 'past-terms is Chase’s to raise, never a "quiet" row');
  t.check(!ids.includes('C7'), 'a quiet customer the picture would hold back (chased this week) is held back here too');
  eq(rows.find((r) => r.customerId === 'C4').telling.reason.key, 'rhythm', 'a worth-telling reason rides on the row');
  eq(rows.find((r) => r.customerId === 'C5').quiet.sub, 'quiet', 'and so does the book’s own worry');
}

/* ---------- 3. one message, in sections, greeting once ---------------- */
{
  reset();
  fu({ customerId: 'C2', promisedOn: day(-1) });
  fu({ customerId: 'C2', productId: 'P2', createdAt: ago(30) });
  data.__chase = { due: [chaseRow('C2')], resting: [], promised: [], blocked: [] };
  data.__brief = [{ customer: data.customers[1], reason: { key: 'price', productId: 'P2', chip: 'Price down 10%', weight: 7, why: 'y' }, product: data.products[1], unit: 'kg', price: 9000, lastPrice: 10000 }];
  const row = scope.followUpHubRows(NOW)[0];
  const msg = scope.followUpHubDigest(row, { telling: false, quiet: true });
  eq((msg.match(/Hello/g) || []).length, 1, 'the client is greeted once, however many engines speak');
  t.check(/here is where things stand/.test(msg) && /asked us to keep you posted/.test(msg),
    'the promised day and the news are separate sections');
  t.check(/1,240,000 UGX\* still outstanding/.test(msg) && /INV-0011/.test(msg),
    'the account section is Chase’s own words, invoices named');
  t.check(!/OMNI-WARE here/.test(msg) && (msg.match(/Thank you/g) || []).length === 1,
    'and Chase’s greeting and sign-off are dropped inside it — one sign-off for the whole message');
  t.check(!/down from the 10,000 UGX you last paid/.test(msg), 'a worth-telling line is NOT in the message unticked');
  const ticked = scope.followUpHubDigest(row, { telling: true, quiet: true });
  t.check(/Nails 3in is now 9,000 UGX per kg — down from the 10,000 UGX you last paid/.test(ticked),
    'ticked, it is one plain sentence made only of the brief’s own figures');
  t.check(!/Cement 50kg/.test(scope.briefPlainLine({ reason: { key: 'nothing' }, product: data.products[0] })),
    'a reason with no honest sentence yields nothing rather than a guess');
  const two = scope.debtChaseMessage(chaseRow('C2'), { name: 'OMNI-WARE', phone: '0700' });
  t.check(/^Hello Amina Nabirye,/.test(two) && /Thank you,/.test(two), 'the two-argument chase message is what it always was');
}

/* ---------- 4. "it has gone" stamps every engine; "it did not go" takes each back */
{
  reset();
  fu({ customerId: 'C2', promisedOn: '2020-01-01' });
  data.__chase = { due: [chaseRow('C2')], resting: [], promised: [], blocked: [] };
  data.__book = [bookRow('C2', { key: 'quiet', chip: 'Quiet 40 days', weight: 3, why: 'q', fig: '40', basis: 'days quiet' })];
  const told = scope.recordFollowUpClient('C2', { telling: false, quiet: true });
  t.check(!!told && told.ids.length === 1 && data.followUps[0].contacts.length === 1, 'the follow-up is stamped told');
  eq(calls.chased.join(','), 'C2', 'and the chase is stamped through Chase’s own record');
  eq(calls.briefs.map((b) => b[1]).join(','), 'quiet', 'and the quiet line, ticked, through the record of what was told');
  eq(data.followUps[0].promisedOn, null, 'the promised day is discharged');
  scope.unrecordFollowUpClient(told);
  eq(data.followUps[0].contacts.length, 0, '"it did not go" takes the stamp back');
  eq(calls.unchased.join(','), 'C2', 'and the chase');
  eq(calls.undone.join(','), 'C2', 'and the telling');
  eq(data.followUps[0].promisedOn, '2020-01-01', 'and restores the promised day');

  reset();
  fu({ customerId: 'C2', promisedOn: '2020-01-01' });
  data.__book = [bookRow('C2', { key: 'quiet', chip: 'Quiet 40 days', weight: 3, why: 'q', fig: '40', basis: 'days quiet' })];
  data.__briefFails = true;
  const partial = scope.recordFollowUpClient('C2', { telling: false, quiet: true });
  t.check(partial.ids.length === 1 && partial.quietKey === null && partial.notWritten.length === 1,
    'a record the brief table cannot take does not block the others, and is NAMED rather than dropped');
  eq(scope.recordFollowUpClient('C1', {}), null, 'a client not in the queue records nothing, and says so by returning null');
}

/* ---------- 4b. did any of it work, across the whole screen ----------- */
{
  reset();
  /* Two ledgers, because the shop keeps two: a picture shared is a row
     in briefsSent, a client told about a follow-up is a stamp on that
     follow-up. The score has to read both or it reports on the half of
     the screen that sends pictures. */
  data.__pics = { told: 4, worked: 1, worth: 500000, byReason: { rhythm: { told: 3, worked: 1 }, asked: { told: 1, worked: 0 } } };
  const f = fu({ customerId: 'C1', productId: 'P1' });
  f.contacts = [{ at: ago(10), reason: 'back_in_stock' }, { at: ago(3), reason: 'promised' }];
  // Bought two days after being told it was back in — inside the fortnight.
  data.savedQuotes = [{ id: 'Q1', invoiced: true, invoicedTs: NOW - 8 * DAY, invoicedAt: ago(8),
    customerId: 'C1', total: 90000, items: [{ productId: 'P1', variantIdx: null }] }];
  const sc = scope.hubScoreboard();
  eq(sc.told, 6, 'every telling counts — four pictures and two follow-up stamps');
  eq(sc.worked, 2, 'and an order inside the fortnight counts once for the picture and once for the stamp it followed');
  eq(sc.byReason.back_in_stock.worked, 1, 'credited to the reason they were actually told');
  eq(sc.byReason.promised.worked, 0, 'and not to a reason whose telling came after the order');
  eq(sc.worth, 590000, 'what those orders were worth is added to the picture half rather than replacing it');
  const labels = scope.hubScoreLabels();
  t.check(labels.needs === 'Needs it too'
    && labels['swap'] === 'Out — offered instead'
    && labels.back_in_stock === 'Back in stock',
    'every reason has a name rather than printing its key — the picture’s reasons and the queue’s alike');

  /* THE HONEST GAP. presetDebtChases holds only the latest chase per
     customer and pruneDebtChases drops it the moment a balance clears --
     exactly the case that would prove the chase worked. So the score
     reports how many stand chased and refuses to compute a rate. */
  data.presetDebtChases = { C2: '2026-08-14', C8: '2026-08-15' };
  const sc2 = scope.hubScoreboard();
  eq(sc2.chases, 2, 'the money side says how many stand chased');
  t.check(sc2.byReason.chase == null && sc2.byReason.money == null,
    'and claims no conversion for them — every rate that ledger could give is wrong in the same direction');
  t.check(/dropped the moment they owe nothing/.test(scope.moneyWhy())
    && !/presetDebtChases/.test(extractFunction(src, 'hubScoreboard', 'index.html').replace(/Object\.keys\(data\.presetDebtChases \|\| \{\}\)\.length/, '')),
    'and the reason is said in words, in one place, rather than left for the reader to wonder about');

  /* A telling about something the shop cannot sell yet cannot convert.
     Counting it in the denominator would make "sourcing moved" read as
     the worst thing this screen does. */
  reset();
  data.__pics = { told: 0, worked: 0, worth: 0, byReason: {} };
  data.sourcingLeads = [{ id: 'SRC-1', name: 'Gypsum board', status: 'priced', voided: false, productId: null }];
  const lead = fu({ customerId: 'C1', productId: null, leadId: 'SRC-1' });
  lead.contacts = [{ at: ago(5), reason: 'sourcing_progress' }];
  const sc3 = scope.hubScoreboard();
  eq(sc3.told, 0, 'a telling about goods that are still being found is not in the rate');
  eq(sc3.notYet, 1, 'it is counted on its own, and named');
}

/* ---------- 4c. one reader for "did they buy it" --------------------- */
{
  reset();
  const f = fu({ customerId: 'C1', productId: 'P1', createdAt: ago(30) });
  data.savedQuotes = [{ id: 'Q1', invoiced: true, invoicedTs: NOW - 20 * DAY, invoicedAt: ago(20),
    customerId: 'C1', total: 1000, items: [{ productId: 'P1', variantIdx: null }] }];
  t.check(!!scope.followUpAlreadyBought(f),
    'they already bought it, asked without a window — the row can be closed');
  t.check(!!scope.followUpBoughtSince(f, NOW - 25 * DAY, 14),
    'and the same reader, given a window, answers whether telling them worked');
  t.check(!scope.followUpBoughtSince(f, NOW - 25 * DAY, 2),
    'an order outside the window is not an answer to the telling');
}

/* ---------- 5. the index answers the same as the scan ----------------- */
{
  reset();
  data.stockLog = [
    { key: 'P1::', delta: 5, qtyAfter: 5, at: ago(3) },
    { key: 'P1::', delta: 2, qtyAfter: 7, at: ago(2) },
    { key: 'P2::', delta: 4, qtyAfter: 4, at: ago(1) },
  ];
  const idx = scope.stockCrossingsByKey();
  const a = scope.stockCrossedInSince('P1::', NOW - 10 * DAY);
  const b = scope.stockCrossedInSince('P1::', NOW - 10 * DAY, idx);
  t.check(a && b && a.t === b.t && a.qty === b.qty, 'with and without the one-pass index, the crossing found is the same');
  eq(scope.stockCrossedInSince('P1::', NOW - 2.5 * DAY, idx), null, 'a top-up onto stock already there is not a crossing');
}

/* ---------- 6. the doors, the screen, and what nothing sends ---------- */
{
  const cap = extractFunction(src, 'captureSourcingLeadAndSave', 'index.html');
  t.check(/addFollowUp\(cid, \{leadId: res\.lead\.id\}/.test(cap),
    'every sourcing door enrols a known customer on the lead');
  t.check(/waMatchCustomer\(req\.phone\)/.test(cap),
    'and a number that is a customer counts as that customer — the inbox’s own rule');
  t.check(!/addFollowUp/.test(extractFunction(src, 'captureSourcingLead', 'index.html')),
    'the pure capture is untouched; the write lives where the save is');
  t.check(/promisedOn: \(r\.payload && r\.payload\.promisedOn\) \|\| null/.test(code)
    && /payload: \{contacts: f\.contacts\|\|\[\], promisedOn: f\.promisedOn\|\|null\}/.test(code),
    'the promised day rides in the payload column — no migration, and a shop without it reads null');
  const contact = extractFunction(src, 'renderFollowUpsContact', 'index.html');
  t.check(/class="btn btn-ghost ow-sm fup-tel" href="tel:/.test(contact),
    'Ring is a tel: link — the owner’s own thumb, the only kind of sending allowed');
  /* THE PICTURE IS LOOKED AT BEFORE IT IS SENT. This used to pin
     `fup-picture`, a bare "Send the picture" button whose whole job was
     to call shareBrief -- a price list built from the client's own
     dealings, leaving the shop, that the owner had never seen. The claim
     the old assertion made is unchanged (the picture is reachable from
     the card); what changed is that reaching it now shows it. */
  t.check(/fup-pay/.test(contact) && /fup-promise/.test(contact) && /fup-when/.test(contact)
    && /fup-edit/.test(contact) && /fup-lead/.test(contact) && /fup-see-picture/.test(contact),
    'a payment, a promise, a day, the qty, the lead and the picture are all reachable from the card');
  /* ONE BUILDER, TWO DISPOSITIONS. The panel is still the account
     screen's -- that is the whole point, and a second copy of
     briefStripHTML would be free to show a filmstrip the picture does
     not match. What is new is the argument: an account is a place to
     READ and keeps the reasoning open, while this is a place to ACT and
     folds it behind a link, because eight lines of argument between the
     picture and Send are read once and scrolled past every morning
     after. Asserted as the option rather than the bare call, so the fold
     cannot quietly become a second panel. */
  t.check(/customerBriefPanelHTML\(cid, \{fold: true/.test(contact) && !/fup-picture"/.test(contact),
    'and the picture is the SAME panel the client’s account draws — one builder, so the filmstrip approved here and the one there can never say different things');
  const why0 = extractFunction(src, 'briefWhyHTML', 'index.html');
  t.check(/opts && opts\.fold/.test(why0) && /ow-bn-watch/.test(why0) && /fup-see-why/.test(why0),
    'and the folded form still leaves the amber weigh-before-you-send block on the surface — a warning behind a link is a warning nobody reads');
  const wire = extractFunction(src, 'wireFollowUpsScreen', 'index.html');
  t.check(/openCustomerDebtModal\(btn\.dataset\.cust, 'payment'\)/.test(wire) && /addPaymentPromise\(/.test(wire)
    && /openSourcingLead\(/.test(wire) && /shareBrief\(/.test(wire),
    'each through the door that page already uses, never a copy of it');
  t.check(/unrecordFollowUpClient\(fupLastTold\)/.test(wire), 'and "it did not go" undoes every stamp, not only ours');
  t.check(/data-tell/.test(wire) && /saveBriefGif\(/.test(wire) && /undoBriefSent\(/.test(wire),
    'the picture panel’s own Share, Save and Undo are wired on the ids it already uses, rather than a second vocabulary for one panel');
  t.check(/fupLeave\(\)/.test(extractFunction(src, 'goToTab', 'index.html')),
    'leaving the tab forgets an open chat — a stale "WhatsApp is open with these words" was greeting people a day later');
  /* THE LENS MOVED FROM A CHIP ROW TO THE STRIP. It was six .ow-seg-b
     chips under the search -- a third level of navigation in the top
     third of the screen, under three tabs and a search. The claim is
     unchanged (the queue can be narrowed by why) and now points at the
     five tiles, which were already saying those words with those
     figures. */
  const summary0 = extractFunction(src, 'renderFollowUpSummary', 'index.html');
  t.check(!/data-fupwhy/.test(contact) && /data-fupwhy=/.test(summary0),
    'the queue can be narrowed by why, from the strip rather than a chip row beneath it');
  t.check(/\$\{waiting\}/.test(extractFunction(src, 'productLineHTML', 'index.html'))
    && /pgAskers = waAskersByProduct\(\);/.test(extractFunction(src, 'renderProducts', 'index.html')),
    'the products register says who is waiting, read once per render');
  t.check(/pm_waiting_go/.test(extractFunction(src, 'editProduct', 'index.html')), 'and the product form opens the hub on them');
  t.check(!/\.send\(|wa-send/.test(extractFunction(src, 'followUpHubDigest', 'index.html')), 'nothing here sends anything');
}

/* ---------- 7. the held-back panel, and the drop it closes ----------- */
{
  reset();
  /* Chase is resting a debtor it asked two days ago. followUpHubRows
     names that on the card of somebody who is in the queue for another
     reason -- but a debtor in it for NOTHING else used to fall out of
     the app entirely: no row, no note, no mention. */
  data.__chase = { due: [], resting: [chaseRow('C8', { chasedDaysAgo: 2, debt: 300000 })],
    promised: [chaseRow('C2', { promise: { state: 'waiting', promisedOn: day(4), madeOn: day(-1) } })],
    blocked: [chaseRow('C6', { why: 'drift' })] };
  data.__brief = [{ customer: data.customers[4], reason: { key: 'rhythm', productId: 'P1', chip: 'Due by rhythm', weight: 4, why: 'y' }, product: data.products[0] }];
  data.__heldList = null;
  const rows = scope.followUpHubRows(NOW);
  const held = scope.followUpHeldBack(NOW, rows);
  const names = held.list.map((h) => h.name);
  t.check(names.includes('Owes Plain') && names.includes('Amina Nabirye') && names.includes('Terms Late'),
    'a debtor Chase is resting, one who named a day and one whose balance is being checked are all NAMED — not one of them was a row in the queue, and they used to fall out of the app entirely');
  eq(held.list.find((h) => h.name === 'Owes Plain').label, 'chased 2d ago',
    'each in the engine’s own words for why');
  eq(scope.fupChasedWords(0), 'chased today',
    'and today is called today — "chased 0d ago" is not how anybody says it');

  reset();
  /* Somebody who IS in the queue carries their hold on their own card,
     so the panel does not say it twice. */
  fu({ customerId: 'C1', createdAt: ago(30) });
  data.__chase = { due: [], resting: [chaseRow('C1', { chasedDaysAgo: 1, debt: 90000 })], promised: [], blocked: [] };
  const rows2 = scope.followUpHubRows(NOW);
  const held2 = scope.followUpHeldBack(NOW, rows2);
  t.check(!held2.list.some((h) => String(h.customerId) === 'C1'),
    'a client already in the queue is not listed again — their hold is on their own card, where the reader is already looking');
  eq(held2.alsoInQueue, 1, 'and the panel counts them instead, so the split is visible rather than a gap');
}

/* ---------- 8. the measurement, and one strip for the whole screen --- */
{
  /* TWO VIEWS, NOT THREE.

     "Did it work" was a third peer of the work, and it brought a metric
     strip of its own -- four tiles about the screen itself, shown while
     the five about today's work were hidden. So the page's own furniture
     moved as you switched views, and the reference material sat where
     the eye looks for the queue while the register beside it ran a table
     down two thirds of the width with an empty right half.

     The register IS the history and the score MEASURES it, so they are
     one view: the grouped table, and these panels in the 304px rail.
     renderFollowUpScore still exists and still owns every claim below --
     it returns the rail rather than writing a pane of its own. */
  const sec = (/<section id="tab-followups"[\s\S]*?<\/section>/.exec(src) || [''])[0];
  t.check(!/data-fuptab="score"/.test(sec) && !/id="fup_score_pane"/.test(sec),
    'the measurement is not a view of its own any more');
  /* THREE VIEWS NOW, AND THE CLAIM ABOVE STILL HOLDS. The old assertion
     meant: the measurement is not a peer of the work, because as a peer
     it brought a strip of its own and moved the page's furniture. The
     Intelligence view is a peer -- but it brings NO strip of its own
     (renderMessagesIntel draws .ow-mi-strip, a reading, not the lane
     filter), the lane strip stays on every view, and "Did it work"
     still lives in the Register's rail beside the history it measures.
     What changed is that the screen now has something to say about the
     WHOLE record -- reason bars, when customers write, the money
     ladder, the rules as days -- that is read weekly and would crowd
     the work if it sat above it. So: the work, what it all came to, and
     the register that records it. */
  /* AND FOUR: the words themselves. Templates is a view because the
     words are edited and judged away from the work -- a library, an
     editor checked against today's real list, and each template's own
     record -- and like Intelligence it brings no strip of its own. */
  /* AND FIVE: the chats. WhatsApp was a page; what it said twice (who is
     waiting, who wrote back, today's post) was already lanes here, and
     what only it had -- the thread you reply in, the connection, the
     number's settings -- came here as Chats. It brings no strip either:
     the old page's five-figure strip went, because the band on Today
     already reads the day. */
  eq((sec.match(/class="ow-seg-b/g) || []).length, 5, 'five views — the work, the chats, what it came to, the words it is said in, and the register that records it');
  t.check(/data-fuptab="chats"/.test(sec) && /id="fup_chat_pane"/.test(sec) && !/id="wa_strip"/.test(sec),
    'the chats are a view with no strip of their own');
  t.check(/data-fuptab="tpls"/.test(sec) && /id="fup_tpl_pane"/.test(sec), 'and Templates has its own pane');
  t.check(/data-fuptab="intel"/.test(sec) && /id="fup_intel_pane"/.test(sec),
    'and the middle one is Intelligence, with its own pane');
  t.check(!/btn-accent/.test(extractFunction(src, 'renderMessagesIntel', 'index.html')),
    'which carries no accent — nothing on a page of readings is the next move');
  /* STILL THE REGISTER'S RAIL, drawn beside the history it measures --
     but the rail is the SCREEN's now, not one this view builds for
     itself. The Messages console stands one .ow-grid and one .ow-side in
     the markup for both views, so the furniture cannot move when the
     view changes; renderFollowUpsAll fills the table and puts the score
     in that rail instead of nesting a second grid inside the first. The
     claim is unchanged: not a tab of its own, and beside the history. */
  const all0 = extractFunction(src, 'renderFollowUpsAll', 'index.html');
  t.check(/fup_score_pan/.test(all0) && /renderFollowUpScore\(\)/.test(all0)
    && /id="fup_score_pan"/.test(sec) && /class="ow-side"/.test(sec),
    'and it is the register’s rail, drawn beside the history it measures rather than in a tab of its own');
  const score = extractFunction(src, 'renderFollowUpScore', 'index.html');
  t.check(/briefsSentTable/.test(score) && /0091_briefs_sent\.sql/.test(score),
    'the record-keeping table is named when it is missing — that warning had no other home once Worth telling went, and without it recordBriefSent fails into a toast nobody keeps');
  t.check(/still works/.test(score),
    'and it does not take the whole screen down: the queue on Work does not need that table');
  t.check(!/btn-accent/.test(score), 'nothing in that rail is an act, so it carries no accent at all');
  t.check(/HUB_SCORE_LABELS\[k\]/.test(score),
    'every bar is named rather than printing its key — the old panel drew one labelled "spend_down"');
  t.check(!/class="ow-mt/.test(score),
    'and it carries no strip of its own — ONE strip on this screen, the same five tiles on both views, so switching does not move the page’s furniture');
  /* A withheld rate has to say so where the rate would have been. The
     three paragraphs that used to argue it read in full behind the "i";
     what stays beside the other rates is the row. */
  t.check(/Money<\/span><span class="ow-sr-v ow-warn">not counted/.test(score),
    'money is named as not counted, in the list of rates, rather than left out of it');
  const render = extractFunction(src, 'renderFollowUps', 'index.html');
  t.check(!/fupTab==='score'/.test(render) && /renderFollowUpSummary\(\);/.test(render),
    'and the strip is drawn on every render rather than hidden on one view');
  t.check(/Worth telling/.test(extractDeclaration(src, 'FUP_WHY', 'index.html')),
    'the absorbed screen’s name is still spoken, on the lens that narrows the queue by why');
}

process.exit(t.done() ? 1 : 0);
