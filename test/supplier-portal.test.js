#!/usr/bin/env node
'use strict';
/*
 * supplier-portal -- what a supplier is allowed to see, and how a
 * supplier's PIN behaves.
 *
 * Suppliers are the fourth identity (0132): not shop_members, not
 * agents, not customers, and not auth.users rows, so they have no
 * row-level access to anything. supplier-portal reads with the
 * service-role key and builds every response key by key;
 * supplier-accounts is the admin-only door that issues the PIN.
 *
 * The boundary (docs/supplier-platform.md, C3): a supplier never sees
 * the buyer, the sell price or margin, another supplier or their lines,
 * or the shop's own stock. This file pins it as rules rather than as a
 * screen-by-screen list, so a column added tomorrow cannot walk out.
 *
 * Run: node test/supplier-portal.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, read, extractFunction, createReporter } = require('./_extract');
const { stripTypeScriptTypes } = require('module');

const t = createReporter('supplier portal');

const portal = read('supabase/functions/supplier-portal/index.ts');
const accounts = read('supabase/functions/supplier-accounts/index.ts');
const clientPortal = read('supabase/functions/client-portal/index.ts');
const page = read('supplier.html');
const index = read('index.html');
const migration = read('supabase/migrations/0132_supplier_accounts.sql');

// Comments name every forbidden column on purpose; the code must not.
function codeOnly(src) {
  return src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}
const portalCode = codeOnly(portal);
const accountsCode = codeOnly(accounts);

/* ---------- 1. both functions parse ---------------------------------- */
[['supplier-portal', portal], ['supplier-accounts', accounts]].forEach(([name, src]) => {
  let ok = true;
  try { stripTypeScriptTypes(src, { mode: 'strip' }); } catch (e) { ok = false; }
  t.check(ok, `${name} parses as TypeScript`);
});

/* ---------- 2. the boundary, as a rule rather than a list ------------ */
{
  t.check(!/\.\.\.(row|r|q|p|quote|payload|item|it|line|bill|price|priceRow|lot|trip|supplier|account|session|acct|data)\b/.test(portalCode),
    'no row read from the database is ever spread into a response');
  t.check(!/select\(\s*["']\*["']/.test(portalCode) && !/\.select\(\s*\)/.test(portalCode),
    'every read names its columns -- nothing is fetched with select("*")');

  ['sellPrice', 'client_name', 'client_phone', 'customerName', 'customerId', 'customer_id',
   'margin', 'markup', 'rival_prices', 'sourcing_leads'].forEach((word) => {
    t.check(!new RegExp(`\\b${word}\\b`).test(portalCode.replace(extractFunction(portalCode, 'hashPin', 'supplier-portal'), '')),
      `supplier-portal never names ${word}`);
  });

  // The saved_quotes reads: only the columns a supplier's own lines need.
  const quoteSelects = [...portalCode.matchAll(/from\("saved_quotes"\)\.select\("([^"]+)"\)/g)].map(m => m[1]);
  t.check(quoteSelects.length > 0, `saved_quotes is read with named columns (${quoteSelects.length} reads)`);
  quoteSelects.forEach((cols) => {
    t.check(!/client|customer|agent/.test(cols), `saved_quotes select "${cols}" carries nothing about the buyer`);
  });

  // The suppliers table is read for THIS supplier only, never listed.
  const supplierReads = [...portalCode.matchAll(/from\("suppliers"\)[\s\S]{0,200}?;/g)].map(m => m[0]);
  t.check(supplierReads.length === 1 && /\.eq\("id", supplierId\)/.test(supplierReads[0]),
    'the suppliers table is read once, filtered to the signed-in supplier');

  // Their own price rows, their own consigned lots -- never the shop's stock.
  t.check(/from\("stock_lots"\)[\s\S]{0,120}\.eq\("consign", supplierId\)/.test(portalCode),
    'stock lots are read only where they are this supplier\'s consignment');
  [...portalCode.matchAll(/from\("prices"\)[\s\S]{0,260}?;/g)].forEach((m, i) => {
    const scoped = /\.eq\("supplier_id", supplierId\)/.test(m[0]);
    t.check(scoped, `prices read #${i + 1} is filtered to this supplier`);
  });
}

/* ---------- 3. an order line, as the supplier sees it ---------------- */
{
  const lineView = extractFunction(portal, 'lineView', 'supplier-portal');
  t.check(!/sellPrice|client|customer/.test(lineView), 'lineView reads neither the sell price nor the buyer');
  const keys = [...lineView.matchAll(/^\s+([a-zA-Z]+):/gm)].map(m => m[1]);
  t.check(keys.length > 0 && keys.indexOf('sellPrice') === -1,
    `an order line carries ${keys.join(', ')} and nothing else`);
}

/* ---------- 4. supplierTerms agrees with the owner app --------------- */
{
  const tsFree = stripTypeScriptTypes(
    portal.replace(/^import[^\n]*\n/m, '').replace(/^export function /gm, 'function '), { mode: 'strip' });
  const lines = extractFunction(tsFree, 'supplierLines', 'supplier-portal');
  const terms = extractFunction(tsFree, 'supplierTerms', 'supplier-portal');
  const portalTerms = new Function(`${lines}\n${terms}\nreturn supplierTerms;`)();

  const groups = extractFunction(index, 'orderSupplierGroups', 'index.html');
  const owner = extractFunction(index, 'orderSupplierTerms', 'index.html');
  const ownerTerms = new Function(`${groups}\n${owner}\nreturn orderSupplierTerms;`)();

  const q = { items: [
    { productId: 'cem', variantIdx: null, qty: 20, price: 37000.4, supplierId: 'S1', sellPrice: 41000 },
    { productId: 'nail', variantIdx: 2, qty: '30', price: 7800, supplierId: 'S2' },
    { productId: 'wire', qty: 3, price: 64999.6, supplierId: 'S1' },
    { productId: 'own', qty: 5, price: 100, supplierId: '__stock__' },
    { productId: 'loose', qty: 1, price: 1 },
  ] };
  ['S1', 'S2', 'S3'].forEach((sid) => {
    t.check(portalTerms(q, sid) === ownerTerms(q, sid),
      `supplierTerms matches orderSupplierTerms for ${sid} ("${portalTerms(q, sid)}")`);
  });
  t.check(portalTerms(q, 'S1').indexOf('41000') === -1, 'the sell price is not part of the terms');
}

/* ---------- 5. identity helpers are verbatim copies ------------------ */
{
  [['normalisePhone', [portal, accounts]], ['hashPin', [portal, accounts]],
   ['mintPin', [accounts]], ['mintToken', [portal]], ['sha256Hex', [portal]], ['safeEqual', [portal]]]
    .forEach(([name, copies]) => {
      let ref = null;
      try { ref = extractFunction(clientPortal, name, 'client-portal'); } catch (e) {
        try { ref = extractFunction(read('supabase/functions/client-accounts/index.ts'), name, 'client-accounts'); } catch (e2) { ref = null; }
      }
      t.check(!!ref, `${name}() exists in the customer functions to copy from`);
      copies.forEach((src) => {
        const where = src === portal ? 'supplier-portal' : 'supplier-accounts';
        const mine = extractFunction(src, name, where).replace(/^export /, '');
        t.check(ref && mine === ref.replace(/^export /, ''), `${where}'s ${name}() is a verbatim copy`);
      });
    });
}

/* ---------- 6. the PIN ------------------------------------------------ */
{
  const n = (src, name) => { const m = new RegExp(`const ${name} = ([^;]+);`).exec(src); return m && m[1]; };
  t.check(n(portal, 'PIN_MAX_ATTEMPTS') === '5' && n(accounts, 'PIN_MAX_ATTEMPTS') === '5',
    'five tries, in both functions');
  t.check(n(accounts, 'INVITE_PIN_TTL_MS') === '7 * 24 * 60 * 60 * 1000', 'a PIN lasts seven days');
  t.check(/padStart\(4, "0"\)/.test(extractFunction(accounts, 'mintPin', 'supplier-accounts')), 'a PIN is four digits');
  t.check(/`supplier:\$\{supplierId\}`/.test(accountsCode),
    'the PIN is salted as supplier:<id>, so it never collides with a customer\'s');
  t.check(/hashPin\([^)]*`supplier:\$\{/.test(portalCode) || /hashPin\([^)]*pinSubject\(/.test(portalCode) || /"supplier:" \+/.test(portalCode),
    'supplier-portal checks the PIN under the same salt');

  // Accounts are made by the shop: the portal never mints or stores a PIN.
  t.check(!/mintPin|pin_hash:\s*await/.test(portalCode), 'supplier-portal has no way to mint a PIN');
  t.check((accountsCode.match(/^\s+pin,$/gm) || []).length === 1,
    'a PIN leaves supplier-accounts in exactly one reply, open/reissue');
  t.check(/is_shop_admin/.test(accountsCode) &&
    accountsCode.indexOf('is_shop_admin') < accountsCode.indexOf('createClient(SUPABASE_URL, SERVICE_ROLE_KEY)'),
    'supplier-accounts checks the caller is an admin before the service-role client exists');
  t.check(!/^\s+(pin_hash|pinHash|pin):/m.test(extractFunction(accountsCode, 'accountView', 'supplier-accounts')),
    'list never returns a PIN or its hash');
}

/* ---------- 7. answers and proposals never write the shop's records --- */
{
  t.check(!/from\("saved_quotes"\)[\s\S]{0,80}\.(update|insert|upsert)\(/.test(portalCode),
    'an answer never writes saved_quotes -- the owner app folds it in');
  t.check(!/from\("prices"\)\s*\.(insert|upsert)\(/.test(portalCode),
    'a price is proposed, never inserted');
  const priceUpdates = [...portalCode.matchAll(/from\("prices"\)\s*\.update\(([^)]*)\)/g)].map(m => m[1]);
  t.check(priceUpdates.every(u => !/retail|wholesale|tiers|date/.test(u)),
    'the only write to prices is the out-of-stock flag');
  t.check(/supplier_answers/.test(migration) && /supplier_proposals/.test(migration),
    'answers and proposals have their own tables');
  t.check(!/create policy[^;]*supplier_(accounts|sessions|answers|proposals)[^;]*\bto anon\b/i.test(migration),
    'no policy grants anon anything on the supplier tables');
}

/* ---------- 8. the page ---------------------------------------------- */
{
  const script = (page.match(/<script>([\s\S]*?)<\/script>/g) || []).join('\n');
  t.check(!/sellPrice|client_name|client_phone|customerName/.test(page), 'supplier.html never names the buyer or the sell price');
  t.check(!/sb_publishable|eyJhbGci/.test(page), 'supplier.html ships no Supabase key');
  t.check(/\/supplier-portal'/.test(script) && !/supplier-accounts/.test(script),
    'supplier.html talks to supplier-portal only');
  t.check(!/sign ?up|create (an )?account|register/i.test(page.replace(/serviceWorker\.register/g, '')),
    'there is no sign-up anywhere on the page');
  t.check(/maxlength="4"|length === 4|\.length >= 4|PIN_LEN = 4/.test(script), 'the PIN pad takes four digits');
  t.check(fs.existsSync(path.join(ROOT, 'manifest-supplier.json')) && /manifest-supplier\.json/.test(page),
    'the page installs as its own app');
  let ok = true;
  try { new Function(script.replace(/<\/?script>/g, '')); } catch (e) { ok = false; t.check(false, 'inline script parses: ' + e.message); }
  if (ok) t.check(true, 'the inline script parses');
}

process.exit(t.done() ? 1 : 0);
