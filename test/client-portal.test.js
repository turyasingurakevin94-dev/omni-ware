#!/usr/bin/env node
'use strict';
/*
 * client-portal -- what a customer is allowed to see, and what a
 * customer's PIN is allowed to be.
 *
 * Customers are a third identity (0096): not shop_members, not agents,
 * and deliberately not auth.users rows either, so they have no row-level
 * access to anything. This function reads with the service-role key and
 * hand-picks every field. REDACTION IS THE WHOLE JOB, exactly as it is
 * for agent-catalog -- and one notch stricter, because a customer is
 * further out than an agent and because the one thing that must never
 * leak here is the thing a customer could act on: who we buy from.
 *
 * The rule this file enforces is simpler than the list of forbidden
 * columns, and deliberately so: a row read from customers, saved_quotes
 * or the debt log is NEVER spread into a response. Every response object
 * is built literally. A column added to any of those tables tomorrow
 * cannot then arrive on a customer's screen by accident.
 *
 * Run: node test/client-portal.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client portal');
const src = read('supabase/functions/client-portal/index.ts');
// Comments name every forbidden column on purpose; the code must not.
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const noComments = code.replace(/\/\*[\s\S]*?\*\//g, '');

/* ---------- 1. the boundary, as a rule rather than a list ------------- */
{
  t.check(!/\.\.\.(customer|quote|q|account|session|row|priceRow|product)\b/.test(noComments),
    'no row read from the database is ever spread into a response');
  t.check(/return json\(\{\s*\n?\s*ok: true,\s*\n?\s*account: \{/.test(noComments),
    'the account response is built literally, key by key');
}

/* ---------- 2. supplier identity never reaches a customer ------------- */
{
  const forbidden = ['supplier_id', 'supplier_sku', 'suppliers', 'price_source',
                     'rival_prices', 'candidates', 'markup', 'margin'];
  forbidden.forEach((word) => {
    t.check(!new RegExp(`\\b${word}\\b`).test(noComments),
      `the code never names ${word} -- the bypass vector and the cost columns stay out`);
  });
  t.check(!/\bfrom\(["'](prices|suppliers|rival_prices|sourcing_leads)["']\)/.test(noComments),
    'and it never reads the price registry, the supplier list or the market record at all');
}

/* ---------- 3. a quote line gives up sellPrice, never price ----------- */
/*
 * On a saved_quotes line, `sellPrice` is what we charged THEM and `price`
 * is what we paid the supplier. They differ by one word and by the whole
 * business. orderTotal is the only thing that reads a line.
 */
{
  const { orderTotal } = compileScope([extractFunction(src, 'orderTotal', 'client-portal')], {}, ['orderTotal'], { typescript: true });
  const line = { qty: 10, sellPrice: 7000, price: 6250, supplierId: 'S1' };
  t.check(orderTotal({ items: [line] }) === 70000,
    'a line totals at the price the customer was charged (70,000)');
  t.check(orderTotal({ items: [line] }) !== 62500,
    'and never at the price the shop paid');
  t.check(orderTotal({ items: [{ qty: 2, sellPrice: 500 }, { qty: 3, sellPrice: 1000 }] }) === 4000,
    'several lines add up');
  t.check(orderTotal(null) === 0 && orderTotal({}) === 0 && orderTotal({ items: 'x' }) === 0,
    'a payload with no items is 0 rather than a crash');
  t.check(!/\bit\.price\b|\['price'\]|\.price\b/.test(extractFunction(src, 'orderTotal', 'client-portal')),
    'orderTotal does not mention a line price at all');
}

/* ---------- 4. one person is one account, however they type it -------- */
{
  const { normalisePhone } = compileScope(
    [extractFunction(src, 'normalisePhone', 'client-portal')], {}, ['normalisePhone'], { typescript: true });
  const same = ['0772418903', '+256772418903', '256772418903', '0772-418-903', '0772 418 903'];
  const first = normalisePhone(same[0]);
  t.check(first === '772418903', `the last nine digits are the key (${first})`);
  same.forEach((p) => t.check(normalisePhone(p) === first, `${p} is the same account`));
  t.check(normalisePhone('12345') === '' && normalisePhone(null) === '' && normalisePhone('') === '',
    'too short, null and empty are no account rather than a partial match');
  t.check(normalisePhone('0772418904') !== first,
    'and a different number is a different account');
}

/* ---------- 5. orders are matched on the number, never the name ------- */
/*
 * saved_quotes carries client_name and client_phone as text and no
 * customer id (0001). Matching on the name would hand "Nakato Grace" the
 * orders of "Nakato Grace Ltd" -- two customers, two balances, one
 * screen. This is the worst bug this product could ship.
 */
{
  t.check(/normalisePhone\(q\.client_phone\) === mine/.test(noComments),
    'the order filter compares normalised phone numbers');
  t.check(!/client_name.*===|===.*client_name/.test(noComments),
    'and never compares a client name to anything');
}

/* ---------- 6. the PIN ------------------------------------------------ */
{
  t.check(/crypto\.getRandomValues/.test(noComments) && !/Math\.random/.test(noComments),
    'the PIN comes from the platform CSPRNG, never Math.random');
  t.check(/PBKDF2/.test(noComments) && /iterations: 100_000/.test(noComments),
    'and is stored as a PBKDF2 hash, because four figures is a 10,000-item search space');
  t.check(!/json\([^)]*\bpin\b/.test(noComments),
    'no response object ever carries a pin — the shop reads it, the browser never does');

  const { safeEqual } = compileScope([extractFunction(src, 'safeEqual', 'client-portal')], {}, ['safeEqual'], { typescript: true });
  t.check(safeEqual('abc', 'abc') === true, 'a right PIN hash compares equal');
  t.check(safeEqual('abc', 'abd') === false && safeEqual('abc', 'ab') === false,
    'a wrong one does not');
  t.check(/diff \|=/.test(extractFunction(src, 'safeEqual', 'client-portal')),
    'and the comparison is constant time -- an early return leaks how much was right');
}

/* ---------- 7. sign-in says the same thing to everybody --------------- */
/*
 * "No account on that number" tells a stranger which of this shop's
 * customers are on the portal. Not found, suspended, and asking twice in
 * a minute must be indistinguishable from outside.
 */
{
  const start = noComments.split('action === "start"')[1].split('action === "verify"')[0];
  // Past the guard on a malformed number -- which says nothing about who
  // holds an account -- every path must arrive at the same reply. A rate
  // limit is allowed to differ: it is a fact about this caller, not about
  // whether a number is on the books.
  const pastValidation = start.split('Enter the phone number you use with the shop" }, 400)')[1] || '';
  const replies = (pastValidation.match(/return json\(/g) || []).length;
  const rateLimited = (pastValidation.match(/\}, 429\)/g) || []).length;
  t.check(replies - rateLimited === 1,
    `once past validation start has exactly one reply (${replies} returns, ${rateLimited} of them a rate limit)`);
  t.check(/return json\(\{ ok: true, delivery: "shop"/.test(start),
    'and it is the same ok whether or not the number has an account');
}

/* ---------- 8. a session is a hash, and expiry is checked ------------- */
{
  t.check(/token_hash", await sha256Hex\(token\)/.test(noComments),
    'a session is found by the hash of its token, never by the token');
  t.check(/if \(!data \|\| data\.revoked_at\) return null/.test(noComments),
    'a revoked session is no session');
  t.check(/Date\.parse\(data\.expires_at\) <= Date\.now\(\)/.test(noComments),
    'and an expired one is checked rather than trusted');
  t.check(/revoked_at: new Date\(\)\.toISOString\(\)/.test(noComments),
    'signing out revokes rather than deletes, so a revoked session stays revoked');
}

/* ---------- 9. terms and a limit are null until somebody says --------- */
{
  t.check(/termsDays: customer\.terms_days == null \? null : Number/.test(noComments),
    'terms are null where nobody has said, never defaulted to 30');
  t.check(/available: limit == null \? null : Math\.max\(0, limit - debt\)/.test(noComments),
    'and what is available is derived from the limit rather than stored');
}

t.done();
