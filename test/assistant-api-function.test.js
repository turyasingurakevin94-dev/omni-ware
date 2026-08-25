#!/usr/bin/env node
'use strict';
/*
 * The assistant's server half, held to its one job.
 *
 * api/assistant.js exists for exactly one reason: the Anthropic API key
 * must never ship inside a public static file, so the secret lives in a
 * Vercel environment variable and every request is signed by a real
 * logged-in user before a shilling of credit is spent. Everything else —
 * the tools, the data, the confirmations — happens in the browser.
 *
 * These checks are STATIC: they read the source and assert its shape.
 * CI has no node_modules (the workflow deliberately runs no install), so
 * this file never require()s the function — but a dry-run harness below
 * exercises the handler's ORDER by stubbing the two globals it touches,
 * because the order is the security property: method, then auth, then
 * the dark check, and only then anything that costs money.
 *
 * Run: node test/assistant-api-function.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('assistant api function');
const src = read('api/assistant.js');
const vercel = read('vercel.json');
const pkg = read('package.json');

/* ---------- 1. the secret stays a secret ----------------------------- */
{
  t.check(/process\.env\.ANTHROPIC_API_KEY/.test(src),
    'the key is read from the environment');
  /* The setup card is allowed to SAY what a key looks like ("sk-ant-…");
     what must never appear is a real one — the prefix followed by the
     long body an actual key carries. */
  const keyish = /sk-ant-[A-Za-z0-9_-]{20,}/;
  t.check(!keyish.test(src), 'and no key literal appears in the source');
  t.check(!keyish.test(read('index.html')),
    'nor anywhere in the app the browser downloads');
  t.check(/if \(!process\.env\.ANTHROPIC_API_KEY\) \{\s*\n\s*return res\.status\(200\)\.json\(\{ not_configured: true \}\)/.test(src),
    'with no key the function answers not_configured — the feature ships dark and spends nothing');
  t.check(src.indexOf('new Anthropic()') > src.indexOf('not_configured'),
    'and the SDK client is only constructed after that check');
}

/* ---------- 2. auth before anything that costs money ------------------ */
{
  const authAt = src.indexOf("/auth/v1/user");
  const spendAt = src.indexOf('client.beta.messages.create');
  t.check(authAt > 0 && spendAt > 0 && authAt < spendAt,
    'the Supabase login check happens before the Anthropic call');
  t.check(src.indexOf("authz.startsWith('Bearer ')") < authAt,
    'and a missing token is rejected before even that round-trip');
  t.check(/status\(401\)/.test(src), 'strangers get 401');
  t.check(/apikey: SUPABASE_PUBLISHABLE_KEY/.test(src),
    'verification uses the public publishable key — the same literal the app already ships');
}

/* ---------- 3. the call is shaped for this model, this year ----------- */
{
  t.check((src.match(/claude-opus-5/g) || []).length === 1,
    'model named exactly once');
  t.check(/betas: \['server-side-fallback-2026-07-01'\]/.test(src)
    && /fallbacks: 'default'/.test(src),
    'refusal fallbacks are on, in the current scalar form');
  t.check(!/thinking/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
    'no thinking parameter — adaptive is this model’s default and a budget would 400');
  t.check(!/temperature|top_p|top_k/.test(src),
    'no sampling parameters — removed on this model');
  t.check(/max_tokens: 2000/.test(src), 'output is capped');
  const sys = /system: \[\{ type: 'text', text: SYSTEM_PROMPT, cache_control: \{ type: 'ephemeral' \} \}\]/.test(src);
  t.check(sys, 'the system prompt carries a cache breakpoint');
  const lastTool = src.lastIndexOf("name: 'add_sourcing_lead'");
  const cacheAfter = src.indexOf('cache_control', lastTool);
  const toolsEnd = src.indexOf('];', lastTool);
  t.check(lastTool > 0 && cacheAfter > 0 && cacheAfter < toolsEnd,
    'and so does the LAST tool, closing the cached prefix over all seventeen');
}

/* ---------- 4. the prefix must be byte-stable ------------------------- */
/*
 * The whole caching story rests on the system prompt and tools never
 * varying per request. A date in either would silently re-bill the
 * prefix on every question, all day, forever.
 */
{
  const promptBlock = src.slice(src.indexOf('const SYSTEM_PROMPT'), src.indexOf('const ACCOUNT_ENUM'));
  t.check(!/new Date|Date\.now|toISOString/.test(promptBlock),
    'no date reaches the system prompt — the client injects today inside its own user turns');
  t.check(/\[Today is YYYY-MM-DD\]/.test(promptBlock),
    'and the prompt tells the model to read it from there');
  t.check(!/currentShopId|shopId/.test(src), 'no shop identity in the prefix either');
  t.check(/all_names or product_names/.test(src)
    && /say the resolved name inside your answer/.test(src),
    'the prompt teaches the terrain: a miss hands the model the real names, and its pick is said back inside the answer');
  t.check(/ask the owner to spell the name/.test(src),
    'with spelling out the name as the stated last resort');
}

/* ---------- 5. seventeen tools, writes distinguishable ---------------- */
{
  const names = [...src.matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map(m => m[1]);
  t.check(names.length === 17, `seventeen tools defined (got ${names.length})`);
  const writes = ['create_quote', 'record_customer_payment', 'pay_supplier',
    'pay_staff_or_rent', 'add_expense', 'record_other_income', 'add_sourcing_lead'];
  writes.forEach(w => t.check(names.includes(w), `${w} is offered`));
  ['find_customer', 'find_product', 'customer_statement', 'list_debtors', 'cash_on_hand',
    'suppliers_owed', 'dues_owed', 'recent_invoices', 'financial_summary', 'recommended_price']
    .forEach(r => t.check(names.includes(r), `${r} is offered`));
  t.check((src.match(/additionalProperties: false/g) || []).length >= 18,
    'every schema (and the quote item) closes itself — a drifted call fails loudly');
}

/* ---------- 6. bounds, and errors in plain words ---------------------- */
{
  t.check(/messages\.length > 40/.test(src) && /200000/.test(src),
    'oversized threads are refused, with the New-chat message');
  t.check(/press New chat/.test(src), 'in words the owner can act on');
  ['AuthenticationError', 'RateLimitError', 'APIConnectionError', 'APIError'].forEach(k =>
    t.check(src.includes('Anthropic.' + k), `${k} is caught by type`));
  const order = ['AuthenticationError', 'RateLimitError', 'APIConnectionError', 'APIError']
    .map(k => src.indexOf('Anthropic.' + k));
  t.check(order.every((v, i) => i === 0 || v > order[i - 1]),
    'most specific first, so the generic branch cannot shadow the useful ones');
  t.check(!/err\.message.*json|JSON\.stringify\(err/.test(src),
    'raw error internals never reach the chat — every branch is its own sentence');
}

/* ---------- 7. deploy wiring ------------------------------------------ */
{
  t.check(/"api\/assistant\.js": \{ "maxDuration": 60 \}/.test(vercel),
    'vercel.json lifts the 10s default that would cut off a tool-heavy turn');
  t.check(/"@anthropic-ai\/sdk"/.test(pkg), 'the SDK is a declared dependency');
  t.check(!/"type": "module"/.test(pkg), 'and the function’s CommonJS shape matches the package');
}

/* ---------- 8. dry-run: the handler's order is the security ----------- */
/*
 * Executed, not just read. The require() of the SDK is stubbed through
 * Module._load (CI has no node_modules), fetch is stubbed, and the
 * handler is driven through its gates: wrong method, no token, bad
 * token, good token with no key. No path constructs a real client, so
 * the stub throwing on construction PROVES no money path was reached.
 */
{
  const Module = require('module');
  const path = require('path');
  const realLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === '@anthropic-ai/sdk') {
      const boom = function () { throw new Error('SDK constructed on a path that must not spend'); };
      boom.AuthenticationError = class extends Error {};
      boom.RateLimitError = class extends Error {};
      boom.APIConnectionError = class extends Error {};
      boom.APIError = class extends Error {};
      return boom;
    }
    return realLoad.apply(this, arguments);
  };
  const handler = require(path.join(__dirname, '..', 'api', 'assistant.js'));
  Module._load = realLoad;

  const res = () => {
    const r = { code: null, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
  };
  const g = globalThis;
  const realFetch = g.fetch;
  delete process.env.ANTHROPIC_API_KEY;

  (async () => {
    let r = res();
    await handler({ method: 'GET', headers: {} }, r);
    t.check(r.code === 405, 'a GET is turned away');

    r = res();
    g.fetch = () => { throw new Error('fetch reached before the token check'); };
    await handler({ method: 'POST', headers: {} }, r);
    t.check(r.code === 401, 'no token: 401 before any network call');

    r = res();
    g.fetch = async () => ({ ok: false });
    await handler({ method: 'POST', headers: { authorization: 'Bearer stale' } }, r);
    t.check(r.code === 401 && /expired/.test(r.body.error.message),
      'a stale token: 401, in words that say what to do');

    r = res();
    g.fetch = async () => ({ ok: true });
    await handler({ method: 'POST', headers: { authorization: 'Bearer good' },
      body: { messages: [{ role: 'user', content: 'hi' }] } }, r);
    t.check(r.code === 200 && r.body.not_configured === true,
      'a real user with no key configured gets the dark answer, and the throwing SDK stub proves nothing was spent');

    g.fetch = realFetch;
    process.exit(t.done() ? 1 : 0);
  })();
}
