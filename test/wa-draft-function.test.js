#!/usr/bin/env node
'use strict';
/*
 * The WhatsApp counter's server half, and its fence.
 *
 * api/wa-draft.js drafts words that a CUSTOMER will read. The security
 * property is the same as the assistant's (method, auth, dark check,
 * ceilings — only then anything that costs money), but the defining
 * property is the FENCE: the endpoint's two tools are executed by the
 * browser through WA_DRAFT_TOOLS, and those executors return name,
 * retail price, breaks and a yes/to-order availability — never a cost,
 * a supplier, a stock count, or anything from the books. What the model
 * cannot reach, a draft cannot leak. That is held here at RUNTIME, by
 * running the executors and reading the keys that come back.
 *
 * Run: node test/wa-draft-function.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('wa draft function');
const src = read('api/wa-draft.js');
const app = read('index.html');
const vercel = read('vercel.json');

/* ---------- 1. the secret stays a secret ----------------------------- */
{
  t.check(/process\.env\.ANTHROPIC_API_KEY/.test(src), 'the key is read from the environment');
  t.check(!/sk-ant-[A-Za-z0-9_-]{20,}/.test(src), 'and no key literal appears in the source');
  t.check(/if \(!process\.env\.ANTHROPIC_API_KEY\) \{\s*\n\s*return res\.status\(200\)\.json\(\{ not_configured: true \}\)/.test(src),
    'with no key the function ships dark and spends nothing');
  t.check(src.indexOf('new Anthropic()') > src.indexOf('not_configured'),
    'the SDK client is only constructed after that check');
}

/* ---------- 2. auth before anything that costs money ------------------ */
{
  const authAt = src.indexOf('/auth/v1/user');
  const spendAt = src.indexOf('client.beta.messages.create');
  t.check(authAt > 0 && spendAt > 0 && authAt < spendAt,
    'the Supabase login check happens before the Anthropic call');
  t.check(src.indexOf("authz.startsWith('Bearer ')") < authAt,
    'and a missing token is rejected before even that round-trip');
  t.check(/status\(401\)/.test(src), 'strangers get 401');
}

/* ---------- 3. the call is shaped for short counter replies ----------- */
{
  t.check((src.match(/claude-opus-5/g) || []).length === 1, 'model named exactly once');
  t.check(/max_tokens: 1200/.test(src), 'a counter reply is a few sentences — capped accordingly');
  t.check(/output_config: \{ effort: 'low' \}/.test(src), 'at low effort: fast, cheap, and enough');
  t.check(/betas: \['server-side-fallback-2026-07-01'\]/.test(src) && /fallbacks: 'default'/.test(src),
    'refusal fallbacks on, current scalar form');
  t.check(!/thinking/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')) && !/temperature|top_p|top_k/.test(src),
    'no thinking parameter, no sampling parameters');
  t.check(/system: \[\{ type: 'text', text: WA_SYSTEM_PROMPT, cache_control: \{ type: 'ephemeral' \} \}\]/.test(src),
    'the system prompt carries a cache breakpoint');
  const lastTool = src.lastIndexOf("name: 'wa_product_price'");
  const cacheAfter = src.indexOf('cache_control', lastTool);
  t.check(lastTool > 0 && cacheAfter > 0 && cacheAfter < src.indexOf('];', lastTool),
    'and so does the LAST tool, closing the cached prefix');
  const promptBlock = src.slice(src.indexOf('const WA_SYSTEM_PROMPT'), src.indexOf('const TOOLS'));
  t.check(!/new Date|Date\.now|toISOString/.test(promptBlock),
    'no date reaches the prompt — the client stamps it inside the customer turn');
  t.check(/\[Today is YYYY-MM-DD\]/.test(promptBlock), 'which the prompt says to read from there');
}

/* ---------- 4. the fence, stated as law ------------------------------- */
{
  t.check(/writing TO A CUSTOMER/.test(src) && /owner reads and approves every draft/.test(src),
    'the prompt knows who reads these words, and who approves them');
  t.check(/NEVER mention supplier names, what things cost the shop, margins, debts, other customers/.test(src),
    'the fence is spelled out: nothing from the books');
  t.check(/Prices come from the tools only/.test(src) && /never guess/.test(src),
    'figures come from tools, never memory, never guesses');
  t.check(/Mirror the customer’s language/.test(src),
    'English or Luganda, matching the customer');
  t.check(/in stock means they can come today; to order means/.test(src),
    'availability is yes or to-order, said plainly');
}

/* ---------- 5. two tools, and ceilings before the SDK ----------------- */
{
  const names = [...src.matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map((m) => m[1]);
  t.check(names.length === 2 && names[0] === 'wa_catalogue_names' && names[1] === 'wa_product_price',
    `exactly the two catalogue reads (got ${JSON.stringify(names)})`);
  t.check((src.match(/additionalProperties: false/g) || []).length >= 2,
    'every schema closes itself');
  t.check(/messages\.length > 30/.test(src) && /100000/.test(src),
    'thread ceilings hold before anything spends');
  t.check(/b\.type === 'image' \|\| b\.type === 'document'/.test(src) && /Drafts are text only/.test(src),
    'and a smuggled image or document is refused — this door is text only');
  t.check(/"api\/wa-draft\.js": \{ "maxDuration": 60 \}/.test(vercel),
    'vercel.json grants the duration — a new function otherwise dies at 10s');
}

/* ---------- 6. the fence, held at runtime ----------------------------- */
/*
 * The executors run here with fixture data, and the KEYS of what they
 * return are read. This is the real fence: not a promise in a prompt,
 * but fields that do not exist.
 */
{
  const data = {
    products: [
      { id: 'P1', name: 'Simba Cement', type: 'simple', category: 'Cement' },
      { id: 'P2', name: 'Secret-cost hinge', type: 'simple', category: 'Fittings' },
    ],
    stock: { P1: 40 },
  };
  const env = {
    data,
    allProductVariantEntries: (tokens) => data.products
      .filter((p) => !tokens.length || tokens.every((tk) => p.name.toLowerCase().includes(tk)))
      .map((p) => ({ p, variantIdx: null })),
    searchTokens: (s) => String(s || '').toLowerCase().split(/\s+/).filter(Boolean),
    catalogueSellAtQty: (p) => (p.id === 'P1' ? { price: 45000, unit: 'bag' } : { price: 9000, unit: 'pc' }),
    catalogueBreaks: () => [{ qty: 10, price: 43500 }],
    getStockQty: (pid) => Number(data.stock[pid]) || 0,
    productVariantLabel: (p) => p.name,
    todayISO: () => '2026-08-26',
  };
  const scope = compileScope([
    extractDeclaration(app, 'WA_DRAFT_TOOLS', 'index.html'),
    extractFunction(app, 'waDraftThreadMessages', 'index.html'),
    'let waInbox = { msgs: [] }; function setMsgs(m){ waInbox.msgs = m; }',
    'function names(){ return { WA_DRAFT_TOOLS, waDraftThreadMessages, setMsgs }; }',
  ], env, ['names']);
  const { WA_DRAFT_TOOLS: T, waDraftThreadMessages, setMsgs } = scope.names();

  const priced = T.wa_product_price.run({ query: 'simba cement' });
  t.check(priced.matches.length === 1 && priced.matches[0].name === 'Simba Cement',
    'the price tool finds the product');
  const keys = Object.keys(priced.matches[0]).sort().join(',');
  t.check(keys === 'breaks,in_stock,name,price,unit',
    `a match carries EXACTLY the customer-safe fields — nothing else exists to leak (got ${keys})`);
  t.check(priced.matches[0].in_stock === 'yes',
    'availability is a word, never a count');
  t.check(T.wa_product_price.run({ query: 'secret cost hinge' }).matches[0].in_stock === 'to order',
    'and no stock reads as to-order, not as a number');
  const miss = T.wa_product_price.run({ query: 'xyzzy' });
  t.check(miss.matches.length === 0 && miss.product_names.includes('Simba Cement'),
    'a miss hands back real names to pick from — the same law as the owner assistant');
  const cat = T.wa_catalogue_names.run();
  t.check(Array.isArray(cat.names) && typeof cat.names[0] === 'string',
    'the catalogue read is names only');
  const toolsSrc = extractDeclaration(app, 'WA_DRAFT_TOOLS', 'index.html');
  t.check(!/purchasePrice|supplierId|wholesale|debt|rankedPriceRows/.test(toolsSrc),
    'no cost-bearing function is even referenced by these executors');

  /* the thread mapper: customer is user, shop is assistant */
  setMsgs([
    { direction: 'out', msg_type: 'text', body: 'We are open' },
    { direction: 'in', msg_type: 'text', body: 'Webale' },
    { direction: 'out', msg_type: 'text', body: 'Welcome' },
    { direction: 'in', msg_type: 'text', body: 'Simba cement meka?' },
  ]);
  const th = waDraftThreadMessages();
  t.check(th[0].role === 'user', 'a leading shop message is dropped — the API wants the customer first');
  t.check(th[th.length - 1].role === 'user'
    && /^\[Today is 2026-08-26\]\nSimba cement meka\?$/.test(th[th.length - 1].content),
    'the date is stamped inside the last customer turn, keeping the server prompt byte-stable');
  setMsgs(Array.from({ length: 40 }, (_, i) => ({ direction: i % 2 ? 'out' : 'in', msg_type: 'text', body: 'm' + i })));
  t.check(waDraftThreadMessages().length <= 12, 'a long thread is trimmed to what a draft needs');
}

/* ---------- 7. the inbox wiring: nothing sends itself ----------------- */
{
  t.check(/id="wa_ai_btn"/.test(app) && /waDraftReply\(\)/.test(app),
    'the draft is one deliberate tap, never automatic');
  t.check(/waSendReply\(d\.text\)/.test(app),
    'and Send routes the draft through waSendReply — the same 24h window check as a hand-typed reply');
  t.check(/aiDrafts: \{\}/.test(app) && /waInbox\.aiDrafts\[convId\] = \{ wamid: lastIn\.wamid, text \}/.test(app),
    'the draft lives in inbox state, so the 12-second poll cannot eat it mid-read');
  t.check(/\.wa-suggest:not\(\.ai\)/.test(app),
    'the token-match card keeps its own handlers — the two suggestions coexist');
  t.check(/fetch\('\/api\/wa-draft'/.test(app) && /'Bearer ' \+ token/.test(app),
    'the client calls the endpoint with the owner\'s own session');
}

/* ---------- 8. dry-run: the handler's order is the security ----------- */
{
  const Module = require('module');
  const path = require('path');
  const realLoad = Module._load;
  Module._load = function (request) {
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
  const handler = require(path.join(__dirname, '..', 'api', 'wa-draft.js'));
  Module._load = realLoad;

  const res = () => {
    const r = { code: null, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    return r;
  };
  const g = globalThis;
  const realFetch = g.fetch;
  const hadKey = process.env.ANTHROPIC_API_KEY;
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
    g.fetch = async () => ({ ok: true });
    await handler({ method: 'POST', headers: { authorization: 'Bearer good' },
      body: { messages: [{ role: 'user', content: 'hi' }] } }, r);
    t.check(r.code === 200 && r.body.not_configured === true,
      'a real user with no key gets the dark answer, and the throwing SDK stub proves nothing was spent');

    process.env.ANTHROPIC_API_KEY = 'test-not-a-real-key';
    r = res();
    await handler({ method: 'POST', headers: { authorization: 'Bearer good' },
      body: { messages: Array.from({ length: 31 }, () => ({ role: 'user', content: 'x' })) } }, r);
    t.check(r.code === 413, 'thirty-one messages: refused before the SDK exists');

    r = res();
    await handler({ method: 'POST', headers: { authorization: 'Bearer good' },
      body: { messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'x' } },
        { type: 'text', text: 'hi' }] }] } }, r);
    t.check(r.code === 400 && /text only/.test(r.body.error.message),
      'an image through this door is refused — drafts are text only');

    delete process.env.ANTHROPIC_API_KEY;
    if (hadKey != null) process.env.ANTHROPIC_API_KEY = hadKey;
    g.fetch = realFetch;
    process.exit(t.done() ? 1 : 0);
  })();
}
