#!/usr/bin/env node
'use strict';
/*
 * THE BOUNDARY, WALKED.
 *
 * Every other boundary test in this project reads the source: it checks
 * that a column is not in a select, that a key is not in an object
 * literal, that a row is never spread. Those are good tests and they have
 * caught real leaks -- but all of them share one weakness, which is that
 * they only catch a leak through a path somebody thought of. A response
 * assembled by a route nobody anticipated passes every one of them.
 *
 * So this one does not read the source. It RUNS it. The real Edge
 * Function is loaded with its types stripped in-process, handed a stubbed
 * Supabase client over a fixture shop, and asked every question a
 * customer can ask. Then every reply is serialised and walked, key by key
 * and value by value, against a database deliberately stuffed with the
 * things that must never cross: a supplier's name and id, a supplier SKU,
 * a price source, raw wholesale and retail, markup rules, a rival's
 * price, an importer's name, and an entire second customer with their own
 * debt, their own orders and their own private notes.
 *
 * Every poisoned value is a marker that cannot arise by arithmetic. If
 * one appears anywhere in any reply, it came out of the database and
 * across the boundary, and this fails naming the exact path it took.
 *
 * Run: node test/client-boundary-walk.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { stripTypeScriptTypes } = require('module');
const { createReporter } = require('./_extract');

const t = createReporter('boundary walk');
const ROOT = path.join(__dirname, '..');

/* ---------- running the real function ---------------------------------- */
/*
 * Node strips the types; nothing is re-implemented here. The only edits
 * to the source are removing the Deno npm: import, which Node cannot
 * resolve, and the `export` keywords, which exist for the other tests.
 */
function loadHandler(rel, db, opts) {
  let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  src = src.replace(/^import[^\n]*\n/m, '').replace(/^export function /gm, 'function ');
  const js = stripTypeScriptTypes(src, { mode: 'strip' });
  let handler = null;
  const Deno = { env: { get: (k) => 'stub-' + k }, serve: (h) => { handler = h; } };
  const quiet = { log() {}, error() {}, warn() {} };
  new Function('Deno', 'createClient', 'crypto', 'console', js)(
    Deno, () => makeClient(db, opts || {}), globalThis.crypto, quiet);
  if (!handler) throw new Error(`Deno.serve was never called in ${rel}`);
  return handler;
}

// Enough of a Supabase query builder for the shapes these functions use.
function makeClient(db, opts) {
  return {
    from: (table) => builder(db, table),
    rpc: () => Promise.resolve({ data: opts.isAdmin === true, error: null }),
  };
}
function builder(db, table) {
  const st = { filters: [], head: false, single: false, limit: null, op: 'select', payload: null, cols: null };
  const rows = () => (db[table] || []).filter((r) => st.filters.every((f) => f(r)));
  const b = {
    select(cols, o) { if (o && o.head) st.head = true; else st.cols = cols; return b; },
    eq(c, v) { st.filters.push((r) => String(r[c]) === String(v)); return b; },
    is(c, v) { st.filters.push((r) => (r[c] === undefined ? null : r[c]) === v); return b; },
    gte(c, v) { st.filters.push((r) => String(r[c] ?? '') >= String(v)); return b; },
    in(c, vs) { st.filters.push((r) => vs.map(String).includes(String(r[c]))); return b; },
    order() { return b; },
    limit(n) { st.limit = n; return b; },
    maybeSingle() { st.single = true; return b; },
    single() { st.single = true; return b; },
    update(p) { st.op = 'update'; st.payload = p; return b; },
    insert(p) { st.op = 'insert'; st.payload = p; return b; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  /* PostgREST hands back the columns you ASKED FOR and nothing else, and
     a stub that hands back the whole row hides the one mistake this
     shape invites: selecting three columns and then reading a fourth.
     In the stub that reads fine; in production it is undefined, silently,
     with no error anywhere. That is exactly how `start` came to re-mint a
     live PIN -- it selected customer_id, status and pin_expires_at, then
     tested account.pin_hash. So the stub projects. */
  function project(row) {
    if (!row || !st.cols || /\*/.test(st.cols)) return row;
    const keep = st.cols.split(',').map((c) => c.trim()).filter(Boolean);
    const out = {};
    for (const k of keep) if (k in row) out[k] = row[k];
    return out;
  }
  function run() {
    if (st.op === 'update') { rows().forEach((r) => Object.assign(r, st.payload)); return { data: rows().map(project), error: null }; }
    if (st.op === 'insert') {
      const row = Object.assign({ id: (db[table] || []).length + 9000 }, st.payload);
      (db[table] = db[table] || []).push(row);
      return { data: st.single ? project(row) : [project(row)], error: null };
    }
    let out = rows();
    if (st.limit != null) out = out.slice(0, st.limit);
    if (st.head) return { data: null, count: out.length, error: null };
    if (st.single) return { data: out[0] ? project(out[0]) : null, error: null };
    return { data: out.map(project), count: out.length, error: null };
  }
  return b;
}
/* client-accounts refuses anything with no Authorization header, before
   it looks at anything else — so the admin calls carry one. The portal
   and the submit endpoint are reachable without one on purpose: a
   customer has no Supabase identity at all. */
const post = (handler, body, auth) => handler(new Request('http://x/', {
  method: 'POST',
  headers: Object.assign({ 'content-type': 'application/json' }, auth ? { Authorization: 'Bearer stub' } : {}),
  body: JSON.stringify(body) }));

/* ---------- the poison ------------------------------------------------- */
/*
 * Markers, not plausible values. Nothing here can be arrived at by
 * multiplying a cost by a markup, so an appearance is proof it was read
 * out of a row rather than computed.
 */
const P = {
  supplierName: 'KIKUUBO_SECRET_SUPPLIER',
  supplierId: 'SUP_SECRET_ID',
  supplierSku: 'SKU_SECRET_7731',
  priceSource: 'SOURCE_SECRET_WALKIN',
  wholesale: 41111,
  retail: 43333,
  tierCost: 40111,
  rivalShop: 'RIVAL_SECRET_SHOP',
  rivalPrice: 99111,
  importer: 'IMPORTER_SECRET_NAME',
  otherName: 'OTHER_CUSTOMER_SECRET',
  otherPhone: '0700111222',
  otherDebt: 777111,
  otherSell: 88111,
  otherNote: 'OTHER_PRIVATE_NOTE',
  myNote: 'MY_PRIVATE_NOTE_CHASED_TWICE',
  linkNote: 'LINK_PRIVATE_NOTE',
  markupValue: 37,
};
/* Numbers and words are matched differently, and the difference is not
   fussiness. A session token is 64 random hex characters, and a plain
   substring test on a five-digit marker finds one inside a token often
   enough to make this test flap — it failed at baseline on the first run
   for exactly that reason. A number must therefore match as a value, or
   inside text with word boundaries around it: hex digits are word
   characters, so a run buried in a token has none. Words stay on
   substring, because they are distinctive and a leak may well wrap one
   in a sentence. */
const MARKERS = Object.values(P);
const NUMERIC = MARKERS.filter((m) => typeof m === 'number');
const WORDS = MARKERS.filter((m) => typeof m === 'string');
function marked(value) {
  if (typeof value === 'number') return NUMERIC.includes(value) ? String(value) : null;
  const s = String(value);
  const word = WORDS.find((w) => s.includes(w));
  if (word) return word;
  const num = NUMERIC.find((n) => new RegExp(`\\b${n}\\b`).test(s));
  return num == null ? null : String(num);
}

const SHOP = 'S1';
const MY_PHONE = '0772418903';
function freshDb() {
  return {
    customers: [
      { shop_id: SHOP, id: 'C1', name: 'Nakato Grace', phone: MY_PHONE, debt: 1240000, terms_days: 30, credit_limit: 2000000 },
      { shop_id: SHOP, id: 'C2', name: P.otherName, phone: P.otherPhone, debt: P.otherDebt, terms_days: 7, credit_limit: 50000 },
    ],
    client_accounts: [
      { shop_id: SHOP, customer_id: 'C1', phone: '772418903', status: 'active', pin_hash: null, pin_expires_at: null, pin_attempts: 0 },
      { shop_id: SHOP, customer_id: 'C2', phone: '700111222', status: 'active', pin_hash: null, pin_expires_at: null, pin_attempts: 0 },
    ],
    client_sessions: [
      { shop_id: SHOP, customer_id: 'C1', token_hash: null, device_id: 'd1',
        expires_at: new Date(Date.now() + 864e5).toISOString(), revoked_at: null },
    ],
    suppliers: [{ shop_id: SHOP, id: P.supplierId, name: P.supplierName }],
    products: [
      { shop_id: SHOP, id: 'P1', name: 'Iron sheets', image: null, category: 'Roofing', subcategory: '',
        short_description: '', variants: null,
        wholesale_markup_type: 'percent', wholesale_markup_value: P.markupValue,
        retail_markup_type: 'percent', retail_markup_value: P.markupValue },
      { shop_id: SHOP, id: 'P2', name: 'Roofing nails', image: null, category: 'Roofing', subcategory: '',
        short_description: '', variants: null,
        wholesale_markup_type: 'percent', wholesale_markup_value: P.markupValue,
        retail_markup_type: 'percent', retail_markup_value: P.markupValue },
    ],
    prices: [{
      shop_id: SHOP, product_id: 'P1', variant_idx: null, supplier_id: P.supplierId,
      supplier_sku: P.supplierSku, price_source: P.priceSource,
      wholesale: P.wholesale, retail: P.retail, pack_qty: 12, unit: 'sheet', pack_unit: 'bundle',
      tiers: [{ minQty: 12, price: P.tierCost }], out_of_stock: false,
    }, {
      shop_id: SHOP, product_id: 'P2', variant_idx: null, supplier_id: P.supplierId,
      supplier_sku: P.supplierSku, price_source: P.priceSource,
      wholesale: P.wholesale, retail: P.retail, pack_qty: 0, unit: 'kg', pack_unit: '',
      tiers: null, out_of_stock: false,
    }],
    stock: [{ shop_id: SHOP, key: 'P1', qty: 5 }],
    app_settings: [{ shop_id: SHOP, presets: {
      defaultMarkup: { retailType: 'percent', retailValue: P.markupValue },
      agentDiscountWholesalePct: 55, agentDiscountRetailPct: 55 } }],
    rival_prices: [{ shop_id: SHOP, product_id: 'P1', shop: P.rivalShop, price: P.rivalPrice }],
    sourcing_leads: [{ shop_id: SHOP, id: 1, candidates: [{ name: P.importer, price: 1 }] }],
    product_links: [{ shop_id: SHOP, id: 1, from_id: 'P1', verb: 'needs', to_id: 'P2',
      qty: 8, per: 'sheet', active: true, note: P.linkNote, from_variant_idx: null, to_variant_idx: null }],
    customer_debt_log: [
      { shop_id: SHOP, customer_id: 'C1', id: 1, date: '2026-08-21', type: 'charge', amount: 880000, note: P.myNote },
      { shop_id: SHOP, customer_id: 'C1', id: 2, date: '2026-09-01', type: 'charge', amount: 360000, note: 'Auto-sync — INV-2291' },
      { shop_id: SHOP, customer_id: 'C2', id: 3, date: '2026-08-22', type: 'charge', amount: P.otherDebt, note: P.otherNote },
    ],
    saved_quotes: [
      { shop_id: SHOP, id: 2291, client_name: 'Nakato Grace', client_phone: MY_PHONE, date: '2026-08-21',
        status: 'completed', invoiced: true, invoiced_at: '2026-08-22', voided: false, amount_paid: 0,
        payload: { client: { name: 'Nakato Grace', phone: MY_PHONE }, savedAt: '2026-08-21T10:00:00Z',
          items: [{ productId: 'P1', productName: 'Iron sheets', variantIdx: null, qty: 10, unit: 'sheet',
            sellPrice: 56000, price: P.wholesale, supplierId: P.supplierId, supplierName: P.supplierName }] } },
      { shop_id: SHOP, id: 2292, client_name: P.otherName, client_phone: P.otherPhone, date: '2026-08-22',
        status: 'completed', invoiced: true, invoiced_at: '2026-08-23', voided: false, amount_paid: 0,
        payload: { client: { name: P.otherName, phone: P.otherPhone }, savedAt: '2026-08-22T10:00:00Z',
          items: [{ productId: 'P1', productName: 'Iron sheets', variantIdx: null, qty: 3, unit: 'sheet',
            sellPrice: P.otherSell, price: P.wholesale, supplierId: P.supplierId }] } },
    ],
  };
}

/* ---------- the walk ---------------------------------------------------- */
const BANNED_KEYS = /^(cost|wholesale|retail|price|supplierId|supplier_id|supplierName|supplier_sku|priceSource|price_source|markup|margin|floorPrice|ourPrice|note|debt|candidates|tiers_raw)$/i;

function walk(value, seen, at) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) { value.forEach((v, i) => walk(v, seen, `${at}[${i}]`)); return; }
  if (typeof value === 'object') {
    Object.keys(value).forEach((k) => {
      if (BANNED_KEYS.test(k)) seen.keys.push(`${at}.${k}`);
      walk(value[k], seen, `${at}.${k}`);
    });
    return;
  }
  const hit = marked(value);
  if (hit) seen.values.push(`${at} = ${String(value).slice(0, 60)} (${hit})`);
}

async function gather() {
  const db = freshDb();
  const portal = loadHandler('supabase/functions/client-portal/index.ts', db);
  const accounts = loadHandler('supabase/functions/client-accounts/index.ts', db, { isAdmin: true });
  const submit = loadHandler('supabase/functions/client-submit-order/index.ts', db);
  const out = [];
  const say = async (label, res) => { out.push({ label, status: res.status, body: await res.json() }); };

  // A real sign-in, end to end through all three functions: the shop
  // issues a PIN, the customer spends it, and the session it mints is
  // what every later call is made with.
  await say('accounts.open', await post(accounts, { shopId: SHOP, action: 'open', customerId: 'C1' }, true));
  const pin = out[0].body.pin;
  await say('portal.start', await post(portal, { shopId: SHOP, action: 'start', phone: MY_PHONE }));
  await say('portal.start (no such number)', await post(portal, { shopId: SHOP, action: 'start', phone: '0777000000' }));
  await say('portal.verify (wrong)', await post(portal, { shopId: SHOP, action: 'verify', phone: MY_PHONE, pin: '0000', deviceId: 'd1' }));
  await say('accounts.reissue', await post(accounts, { shopId: SHOP, action: 'reissue', customerId: 'C1' }, true));
  const pin2 = out[out.length - 1].body.pin;
  await say('portal.verify', await post(portal, { shopId: SHOP, action: 'verify', phone: MY_PHONE, pin: pin2, deviceId: 'd1' }));
  const token = out[out.length - 1].body.token;
  if (!token) {
    throw new Error('sign-in did not mint a token; the walk would prove nothing. '
      + out.map(r => `${r.label}=${r.status}`).join(' '));
  }

  const T = { shopId: SHOP, token };
  await say('portal.account', await post(portal, { ...T, action: 'account' }));
  await say('portal.catalogue', await post(portal, { ...T, action: 'catalogue' }));
  await say('portal.price', await post(portal, { ...T, action: 'price', productId: 'P1', qty: 1 }));
  await say('portal.price (bundle)', await post(portal, { ...T, action: 'price', productId: 'P1', qty: 140 }));
  await say('portal.advice', await post(portal, { ...T, action: 'advice', items: [{ productId: 'P1', variantIdx: null, qty: 140 }] }));
  await say('portal.statement', await post(portal, { ...T, action: 'statement' }));
  await say('portal.orders', await post(portal, { ...T, action: 'orders' }));
  await say('portal.order (mine)', await post(portal, { ...T, action: 'order', orderId: 2291 }));
  await say('portal.order (theirs)', await post(portal, { ...T, action: 'order', orderId: 2292 }));
  await say('submit', await post(submit, { ...T, items: [{ productId: 'P1', variantIdx: null, qty: 140 }], deliverTo: 'Kyanja' }));
  await say('accounts.list', await post(accounts, { shopId: SHOP, action: 'list' }, true));
  await say('portal.signout', await post(portal, { ...T, action: 'signout' }));

  /* THE ORDER A REAL SIGN-IN HAPPENS IN, on a shop of its own.
     Above, the shop reissues AFTER the customer has already tapped
     Continue, and that is the one ordering which cannot catch what this
     scenario exists for. In a shop it goes the other way round: an admin
     opens the account, reads the PIN out over the counter or the phone,
     and the customer types their number afterwards. If `start` mints a
     second PIN at that moment, the figures the customer is holding are
     already dead and no customer can ever sign in. That is not a corner:
     it is every sign-in there will ever be. */
  const db2 = freshDb();
  const portal2 = loadHandler('supabase/functions/client-portal/index.ts', db2);
  const accounts2 = loadHandler('supabase/functions/client-accounts/index.ts', db2, { isAdmin: true });
  const rowOf = () => db2.client_accounts.find((a) => a.customer_id === 'C1');
  const issued = await (await post(accounts2, { shopId: SHOP, action: 'reissue', customerId: 'C1' }, true)).json();
  const hashAtCounter = rowOf().pin_hash;
  await post(portal2, { shopId: SHOP, action: 'start', phone: MY_PHONE });
  const hashAfterTap = rowOf().pin_hash;
  const signedIn = await (await post(portal2,
    { shopId: SHOP, action: 'verify', phone: MY_PHONE, pin: issued.pin, deviceId: 'd9' })).json();

  return { out, db, pin, pin2, counter: { issued, hashAtCounter, hashAfterTap, signedIn } };
}

(async () => {
  let gathered;
  try { gathered = await gather(); }
  catch (e) { t.fail(`the fixture shop could not be driven: ${e.message}`); process.exit(t.done() ? 1 : 0); }
  const { out, db, pin2, counter } = gathered;

  /* ---------- 0. the walk is walking something -------------------------- */
  t.check(out.length >= 16, `every customer-facing reply was gathered (${out.length})`);
  const answered = out.filter(r => r.status === 200);
  t.check(answered.length >= 12, `and most of them answered rather than refusing (${answered.length} of ${out.length})`);
  const customerReplies = out.filter(r => !r.label.startsWith('accounts.'));
  t.check(customerReplies.some(r => JSON.stringify(r.body).length > 200),
    'at least one carries a real payload, so a clean walk means something');

  /* ---------- 1. nothing poisoned crossed ------------------------------- */
  customerReplies.forEach((r) => {
    const seen = { keys: [], values: [] };
    walk(r.body, seen, r.label);
    t.check(seen.values.length === 0,
      `${r.label}: no value from a forbidden column${seen.values.length ? ` -- ${seen.values.slice(0, 3).join('; ')}` : ''}`);
    t.check(seen.keys.length === 0,
      `${r.label}: no forbidden key${seen.keys.length ? ` -- ${seen.keys.slice(0, 3).join('; ')}` : ''}`);
  });

  /* ---------- 2. the walk would notice ---------------------------------- */
  /*
   * A test that can only pass is not a test. Every marker is planted into
   * a reply-shaped object and the walk asked to find it.
   */
  MARKERS.forEach((m) => {
    const seen = { keys: [], values: [] };
    walk({ ok: true, items: [{ name: 'x', deep: { field: m } }] }, seen, '$');
    t.check(seen.values.length === 1, `the walk finds ${m} however deep it is buried`);
  });
  // ...and in a sentence, which is how a leak that got past review would
  // most likely read.
  NUMERIC.forEach((n) => {
    const seen = { keys: [], values: [] };
    walk({ why: `we costed it at ${n} a sheet` }, seen, '$');
    t.check(seen.values.length === 1, `and finds ${n} wrapped in words`);
  });
  // But not inside a random token, which is what made this flap.
  {
    const seen = { keys: [], values: [] };
    NUMERIC.forEach((n) => walk({ token: `bb23${n}ab7f949bb5816779eb0825582c1a81c85e87` }, seen, '$'));
    t.check(seen.values.length === 0,
      `a run of digits inside a hex token is not a leak (${seen.values.join('; ') || 'none found'})`);
  }
  {
    const seen = { keys: [], values: [] };
    walk({ ok: true, lines: [{ cost: 1 }] }, seen, '$');
    t.check(seen.keys.length === 1, 'and finds a forbidden KEY even when its value is innocent');
  }

  /* ---------- 3. the other customer is not in there --------------------- */
  const all = JSON.stringify(customerReplies);
  t.check(!all.includes('C2'), 'the other customer\'s id appears nowhere');
  t.check(!all.includes(P.otherName) && !all.includes(P.otherPhone),
    'nor their name or number');
  t.check(!all.includes(String(P.otherDebt)) && !all.includes(String(P.otherSell)),
    'nor what they owe or what they were charged');
  const theirs = out.find(r => r.label === 'portal.order (theirs)');
  t.check(theirs && theirs.status === 404, `their order is refused (${theirs && theirs.status})`);
  const mine = out.find(r => r.label === 'portal.order (mine)');
  t.check(mine && mine.status === 200, 'while mine is not');
  t.check(theirs && mine && theirs.body.error === 'We cannot find that order',
    'and refused in words that do not say whose it is');

  /* ---------- 4. the PIN, and the redaction doing work ------------------ */
  const starts = out.filter(r => r.label.startsWith('portal.start'));
  t.check(starts.length === 2 && JSON.stringify(starts[0].body) === JSON.stringify(starts[1].body),
    `a number with an account and one without get the same reply (${starts.map(s => JSON.stringify(s.body)).join(' vs ')})`);
  t.check(!all.includes(pin2), 'the PIN the shop issued is in no customer-facing reply');
  const acct = db.client_accounts.find(a => a.customer_id === 'C1');
  t.check(acct && acct.pin_hash === null,
    'and a spent PIN is cleared from the row, not left usable');

  /* ---------- 4b. the PIN the shop read out is the one that works ------- */
  t.check(!!counter.issued.pin, `the shop issued a PIN at the counter (${counter.issued.pin ? 'yes' : 'no'})`);
  t.check(!!counter.hashAtCounter, 'and the row is holding it');
  t.check(counter.hashAfterTap === counter.hashAtCounter,
    'the customer tapping Continue does not replace it');
  t.check(!!counter.signedIn.token,
    `so the PIN the customer was given signs them in (${counter.signedIn.token ? 'signed in' : counter.signedIn.error})`);

  /* The point of all of it: the cost really is in the fixture, and the
     price really is computed from it. A walk over a shop with no cost in
     it would pass while proving nothing. */
  const priced = out.find(r => r.label === 'portal.price');
  t.check(priced && priced.body.available === true && priced.body.unitPrice > 0,
    `a price was actually computed (${priced && priced.body.unitPrice})`);
  t.check(priced && priced.body.unitPrice !== P.retail && priced.body.unitPrice !== P.wholesale,
    'from the cost in the fixture, and is not that cost');
  t.check(db.prices.some(p => p.wholesale === P.wholesale && p.supplier_id === P.supplierId),
    'which was there to leak the whole time');

  const advice = out.find(r => r.label === 'portal.advice');
  t.check(advice && Array.isArray(advice.body.advice) && advice.body.advice.length === 1,
    `the advice action answered with a suggestion (${advice && JSON.stringify(advice.body.advice && advice.body.advice.length)})`);
  t.check(advice && advice.body.advice[0] && advice.body.advice[0].qty === 1120,
    `140 sheets at 8 a sheet came to 1,120 (${advice && advice.body.advice[0] && advice.body.advice[0].qty})`);

  const submitted = out.find(r => r.label === 'submit');
  t.check(submitted && submitted.status === 200 && submitted.body.orderId,
    `an order really was written (${submitted && submitted.status})`);
  const written = db.saved_quotes.find(q => q.id === (submitted && submitted.body.orderId));
  /* The tier price, not the flat one: 140 clears the pack of 12, so the
     cost this line was priced from is the tier's. Either is a cost and
     both are the shop's business; what matters is that A cost is stored
     and none of them is in the reply. */
  const storedCost = written && written.payload.items[0].price;
  t.check([P.wholesale, P.retail, P.tierCost].includes(storedCost),
    `and the stored line DOES carry the cost, which is the shop's business (${storedCost})`);
  t.check(written && written.payload.items[0].supplierId === P.supplierId,
    'and the supplier, so the shop knows where to buy');
  t.check(submitted && !JSON.stringify(submitted.body).includes(String(storedCost))
    && !JSON.stringify(submitted.body).includes(P.supplierId),
    'while the reply to the customer carries neither');

  /* ---------- 5. the statement's private note --------------------------- */
  const stmt = out.find(r => r.label === 'portal.statement');
  t.check(stmt && stmt.status === 200 && stmt.body.rows.length === 2,
    `the statement was built (${stmt && stmt.body.rows && stmt.body.rows.length} rows)`);
  t.check(stmt && !JSON.stringify(stmt.body).includes(P.myNote),
    'and the note the shop typed on a charge did not cross');
  t.check(stmt && JSON.stringify(stmt.body).includes('INV-2291'),
    'while the reference the app itself wrote did');

  process.exit(t.done() ? 1 : 0);
})();
