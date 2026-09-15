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

const { stripTypeScriptTypes } = require('module');
const t = createReporter('client portal');
const src = read('supabase/functions/client-portal/index.ts');
/* Node strips the file's types in one pass. _extract's stripTypes is
   confined to a function's signature by design, and these helpers carry
   inline arrow annotations in their bodies. */
const tsFree = stripTypeScriptTypes(
  src.replace(/^import[^\n]*\n/m, '').replace(/^export function /gm, 'function '), { mode: 'strip' });
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
                     'rival_prices', 'candidates', 'margin'];
  forbidden.forEach((word) => {
    t.check(!new RegExp(`\\b${word}\\b`).test(noComments),
      `the code never names ${word} -- the bypass vector and the cost columns stay out`);
  });
  t.check(!/\bfrom\(["'](suppliers|rival_prices|sourcing_leads)["']\)/.test(noComments),
    'the supplier list, the market record and the sourcing leads are never read at all');

  /* `prices` USED to be on that list, and the pricing actions took it off.
     It has to come off: a portal that quotes a price reads the price
     table, and no amount of wishing changes that. What replaces the ban
     is stricter than the ban was.

     REDACTION BY QUERY. agent-catalog reads prices with select("*") and
     picks fields on the way out, so every supplier column is in memory
     and one careless spread would ship it. Here the supplier columns are
     never fetched, so there is nothing in memory to leak and no
     destructure to get right. That is the claim, and this is what
     enforces it. */
  const cols = /const PRICE_COLS = "([^"]+)"/.exec(noComments);
  t.check(!!cols, 'the price columns are named in one place');
  if (cols) {
    const named = cols[1].split(',').map(c => c.trim());
    ['supplier_id', 'supplier_sku', 'price_source', 'cost'].forEach((c) => {
      t.check(!named.includes(c), `the price query never asks for ${c}`);
    });
    t.check(named.includes('wholesale') && named.includes('retail'),
      'it does ask for the two cost columns, which is what a price is computed FROM');
    t.check(!/\bfrom\("prices"\)\.select\((?!PRICE_COLS)/.test(noComments)
      && !/from\("prices"\)[\s\S]{0,40}select\("\*"\)/.test(noComments),
      'and every read of prices goes through that one list, never a star');
  }

  /* Markup columns ARE read now — a price is cost plus the shop's rule —
     so the old blanket ban on the word would have to go. It was passing
     by accident anyway: \bmarkup\b never matched wholesale_markup_value,
     because an underscore is a word character. The real rule was always
     about what LEAVES, so that is what is checked. */
  const bodies = [];
  for (let i = noComments.indexOf('return json('); i >= 0; i = noComments.indexOf('return json(', i + 1)) {
    let d = 0, j = i + 'return json('.length - 1;
    for (; j < noComments.length; j++) {
      if (noComments[j] === '(') d++;
      else if (noComments[j] === ')' && --d === 0) break;
    }
    bodies.push(noComments.slice(i, j + 1));
  }
  t.check(bodies.length > 10, `every response was found (${bodies.length})`);
  const leaky = bodies.filter(b => /\b(cost|markup|wholesale|retail|floorPrice|ourPrice)\b/i.test(b));
  t.check(leaky.length === 0,
    `no response names a cost, a markup or a raw tier${leaky.length ? `:\n${leaky[0].slice(0, 200)}` : ''}`);

  /* The catalogue's rows are built inside a .map() and reach the browser
     as `items`, so they are NOT inside any return json(...) and the scan
     above walks straight past them. Planting `wholesale: row.wholesale`
     on a catalogue row proved it: eight leaks planted, seven caught, and
     the one that got through was a raw cost column on every item in the
     shop. Keys, not call sites, is the check that covers both. */
  [['cost', /\bcost:\s/], ['wholesale', /\bwholesale:\s/], ['retail', /\bretail:\s/],
   ['ourPrice', /\bourPrice:/], ['floorPrice', /\bfloorPrice:/], ['margin', /\bmargin:/]]
    .forEach(([name, re]) => {
      t.check(!re.test(noComments), `no object anywhere in the file carries a ${name} key`);
    });

  /* `tiers` is the one word that means two opposite things. On a prices
     row it is the shop's COST ladder; on a response it is the customer's
     price ladder. Sending the first under the name of the second would
     hand over every breakpoint the shop buys at, and would read as
     perfectly ordinary in review. */
  const tierAssigns = noComments.match(/tiers:\s*[^,\n]+/g) || [];
  t.check(tierAssigns.length > 0 && tierAssigns.every(a => /customerPriceLadder/.test(a)),
    `every tiers field sent out is a computed price ladder, never a row's own (${tierAssigns.join(' | ') || 'none'})`);
}

/* ---------- 3. a quote line gives up sellPrice, never price ----------- */
/*
 * On a saved_quotes line, `sellPrice` is what we charged THEM and `price`
 * is what we paid the supplier. They differ by one word and by the whole
 * business. goodsTotal is the only thing that reads a line.
 *
 * orderTotal grew collaborators when index.html grew charges and a price
 * for the credit — it is goods + charges + credit now, and the three
 * functions under it come along. The claim being made here did not
 * change: whatever else an order carries, a LINE gives up sellPrice and
 * never price.
 */
{
  const NEEDS = ['goodsTotal', 'chargeAmount', 'chargeLines', 'creditLine', 'orderTotal'];
  const { orderTotal, goodsTotal } = compileScope(
    NEEDS.map((n) => extractFunction(tsFree, n, 'client-portal')), {}, NEEDS);
  const line = { qty: 10, sellPrice: 7000, price: 6250, supplierId: 'S1' };
  t.check(orderTotal({ items: [line] }) === 70000,
    'a line totals at the price the customer was charged (70,000)');
  t.check(orderTotal({ items: [line] }) !== 62500,
    'and never at the price the shop paid');
  t.check(orderTotal({ items: [{ qty: 2, sellPrice: 500 }, { qty: 3, sellPrice: 1000 }] }) === 4000,
    'several lines add up');
  t.check(orderTotal(null) === 0 && orderTotal({}) === 0 && orderTotal({ items: 'x' }) === 0,
    'a payload with no items is 0 rather than a crash');
  t.check(!/\bit\.price\b|\['price'\]|\.price\b/.test(extractFunction(src, 'goodsTotal', 'client-portal')),
    'goodsTotal does not mention a line price at all');
  t.check(goodsTotal({ items: [line] }) === 70000,
    'and the goods alone still total at what the customer was charged');
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

/* ---------- 9. the order filter agrees with the shop's own ------------ */
/*
 * This read carried .eq("status", "order") for three commits. There is no
 * such status in this app -- the ladder is draft / awaiting_goods /
 * preparing / pending_delivery / completed -- so it matched zero rows, and
 * every customer saw "Nothing here yet" however much they had bought. The
 * same filter sat on the pricing read, so no remembered price was ever
 * found either. Two features dead on arrival, both of which read
 * perfectly well in review and passed every test in this file.
 *
 * Nothing pinning client-portal against itself could have caught it, so
 * this reads the status ladder out of index.html and insists the two
 * files agree about what a status is.
 */
{
  const app = read('index.html');
  const block = /const SQ_STATUSES = \{([\s\S]*?)\n\};/.exec(app);
  t.check(!!block, 'the order status ladder is found in index.html');
  const known = block ? (block[1].match(/^\s*(\w+):/gm) || []).map(x => x.replace(/[\s:]/g, '')) : [];
  t.check(known.length >= 5, `and carries its statuses (${known.join(', ')})`);

  const reads = [...noComments.matchAll(/from\("saved_quotes"\)[\s\S]{0,400}?;/g)].map(m => m[0]);
  t.check(reads.length >= 2, `every read of saved_quotes is found (${reads.length})`);
  const filtered = reads.flatMap(r => [...r.matchAll(/\.eq\("status", "([^"]+)"\)/g)].map(x => x[1]));
  const unknown = filtered.filter(f => !known.includes(f));
  t.check(unknown.length === 0,
    `and every status it filters on is one the app actually writes (${unknown.join(', ') || 'it filters on none'})`);

  /* `voided` IS the real rule: the admin app's own customerPurchaseHistory
     and lastPriceToClient filter on that and nothing else, and a portal
     showing a different history from the shop's own screen is worse than
     one showing none. */
  /* Every read of a customer's orders drops the voided ones, with ONE
     deliberate exception: the full orders list is the record rather than
     the reckoning, and a customer wondering where an order went is owed
     the answer "we cancelled it". That read marks them instead, and
     client-orders.test.js pins both halves — that it keeps them, and
     that no other read does.

     This assertion was a blanket "every one of them", and it went stale
     the moment that list was built. It did not fail, because a crash
     earlier in this file was stopping the run before it. A test that
     throws reports nothing, and what it hid here was a real assertion
     that had stopped being true. */
  const keepsVoided = reads.filter(r => !/\.eq\("voided", false\)/.test(r));
  t.check(keepsVoided.length === 1,
    `exactly one read keeps the voided ones (${keepsVoided.length})`);
  t.check(keepsVoided.length === 1 && /invoiced_at/.test(keepsVoided[0]),
    'and it is the orders list, which shows them as cancelled');
  t.check(reads.length - keepsVoided.length >= 2,
    `while the balance, the price memory and the recent five all drop them (${reads.length - keepsVoided.length})`);
  t.check(/function customerPurchaseHistory/.test(app) && /!q\.voided/.test(app),
    'and that is verifiably what it uses');
}

t.done();
