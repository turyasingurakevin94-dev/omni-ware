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
  const lastTool = src.lastIndexOf("name: 'wa_take_order'");
  const cacheAfter = src.indexOf('cache_control', lastTool);
  t.check(lastTool > 0 && cacheAfter > 0 && cacheAfter < src.indexOf('];', lastTool),
    'and so does the LAST tool, closing the cached prefix');
  const promptBlock = src.slice(src.indexOf('const WA_SYSTEM_PROMPT'), src.indexOf('const TOOLS'));
  t.check(!/new Date|Date\.now|toISOString/.test(promptBlock),
    'no date reaches the prompt — the client stamps it inside the customer turn');
  t.check(/\[Today is YYYY-MM-DD\]/.test(promptBlock), 'which the prompt says to read from there');
}

/* ---------- 4. the fence and the counter voice, stated as law --------- */
{
  t.check(/writing TO A CUSTOMER/.test(src) && /owner reads and approves every draft/.test(src),
    'the prompt knows who reads these words, and who approves them');
  t.check(/NEVER mention supplier names, what things cost the shop, margins, debts, other customers/.test(src),
    'the fence is spelled out: nothing from the books');
  t.check(/Prices come from the tools only/.test(src) && /never invented/.test(src),
    'figures come from tools, never memory, never invention');
  t.check(/BREVITY IS THE LAW/.test(src) && /one to three SHORT lines/.test(src)
    && /No closing filler/.test(src) && /one line per item/.test(src),
    'the counter voice is short by law — busy traders read one line, not paragraphs');
  t.check(/\*single asterisks\* as bold/.test(src) && /the product name, the price, and the pack size/.test(src),
    'the figures that decide are highlighted the way WhatsApp actually renders');
  t.check(/We don’t have <it>\./.test(src) && /a hedge reads as a middleman about to overcharge/.test(src),
    'not selling something is said plainly — hedging is banned, with the reason written down');
  t.check(/say we don’t have that size and list the sizes we do/.test(src),
    'a missing size offers its siblings in one line');
  t.check(/price_not_set means we DO sell it/.test(src)
    && /NEVER say we don’t have something the tool returned/.test(src),
    'a pending price is never denied existence — the Half Bend law, written into the prompt too');
  t.check(/\*5\* cartons = \*100\* pcs/.test(src) && /never guess a pack size/.test(src),
    'pack arithmetic is shown, and an unknown pack size is a question');
  t.check(/Mirror the customer’s language/.test(src),
    'English or Luganda, matching the customer');
  t.check(/in stock \(come today\) or to order \(we bring it in\)/.test(src),
    'availability is two words, said plainly');
  t.check(/NEVER claim an order already exists/.test(src)
    && /never call wa_take_order for a question that is only asking prices/.test(src),
    'and an order exists only after the owner makes it — commitment detected, never presumed');
}

/* ---------- 5. two tools, and ceilings before the SDK ----------------- */
{
  const names = [...src.matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map((m) => m[1]);
  t.check(names.length === 3 && names[0] === 'wa_catalogue_names'
    && names[1] === 'wa_product_price' && names[2] === 'wa_take_order',
    `the two catalogue reads plus the order-taker (got ${JSON.stringify(names)})`);
  t.check((src.match(/additionalProperties: false/g) || []).length >= 4,
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
      /* The live lie, kept as a fixture: a wholesale rule, no retail
         one — the first tools skipped it and told a customer we did
         not sell it. */
      { id: 'P3', name: 'Soft Close Mulper Half Bend', type: 'simple', category: 'Furniture' },
      { id: 'P4', name: 'Ruleless bracket', type: 'simple', category: 'Fittings' },
    ],
    stock: { P1: 40, P3: 0 },
  };
  const PRICEBOOK = {
    P1: { retail: { price: 45000, unit: 'bag', packQty: 12, packUnit: 'Ctn' },
      wholesale: { price: 40000, unit: 'bag', packQty: 12, packUnit: 'Ctn' } },
    P2: { retail: { price: 9000, unit: 'pc', packQty: 0, packUnit: '' } },
    P3: { wholesale: { price: 265000, unit: 'Pc', packQty: 20, packUnit: 'Ctn' } },
    P4: {},
  };
  const env = {
    data,
    allProductVariantEntries: (tokens) => data.products
      .filter((p) => !tokens.length || tokens.every((tk) => p.name.toLowerCase().includes(tk)))
      .map((p) => ({ p, variantIdx: null })),
    searchTokens: (s) => String(s || '').toLowerCase().split(/\s+/).filter(Boolean),
    catalogueSellAtQty: (p, idx, qty, basis) => (PRICEBOOK[p.id] || {})[basis] || null,
    catalogueBreaks: () => [{ qty: 10, price: 43500 }],
    getStockQty: (pid) => Number(data.stock[pid]) || 0,
    productVariantLabel: (p) => p.name,
    todayISO: () => '2026-08-26',
  };
  const scope = compileScope([
    extractDeclaration(app, 'WA_DRAFT_TOOLS', 'index.html'),
    extractFunction(app, 'waCustomerPriceAt', 'index.html'),
    extractFunction(app, 'waDraftThreadMessages', 'index.html'),
    'let waInbox = { msgs: [] }; function setMsgs(m){ waInbox.msgs = m; }',
    'function names(){ return { WA_DRAFT_TOOLS, waDraftThreadMessages, setMsgs }; }',
  ], env, ['names']);
  const { WA_DRAFT_TOOLS: T, waDraftThreadMessages, setMsgs } = scope.names();

  const priced = T.wa_product_price.run({ query: 'simba cement' });
  t.check(priced.matches.length === 1 && priced.matches[0].name === 'Simba Cement',
    'the price tool finds the product');
  const keys = Object.keys(priced.matches[0]).sort().join(',');
  t.check(keys === 'breaks,in_stock,name,pack_qty,pack_unit,price,unit',
    `a match carries EXACTLY the customer-safe fields — nothing else exists to leak (got ${keys})`);
  t.check(priced.matches[0].pack_qty === 12 && priced.matches[0].pack_unit === 'Ctn',
    'packing is public — the model can convert cartons to units');
  t.check(priced.matches[0].in_stock === 'yes',
    'availability is a word, never a count');
  t.check(T.wa_product_price.run({ query: 'secret cost hinge' }).matches[0].in_stock === 'to order',
    'and no stock reads as to-order, not as a number');

  /* THE HALF BEND LAW: a wholesale-only product answers with its
     wholesale price — a missing retail rule must never read as a
     missing product. */
  const halfBend = T.wa_product_price.run({ query: 'soft close half bend' });
  t.check(halfBend.matches.length === 1 && halfBend.matches[0].price === 265000,
    `the wholesale-only Half Bend IS found, priced from the wholesale side (got ${JSON.stringify(halfBend.matches)})`);
  const ruleless = T.wa_product_price.run({ query: 'ruleless bracket' });
  t.check(ruleless.matches.length === 1 && ruleless.matches[0].price === null
    && ruleless.matches[0].price_not_set === true,
    'a product with no rule on EITHER side is still returned — existence and price are separate facts');

  const miss = T.wa_product_price.run({ query: 'xyzzy' });
  t.check(miss.matches.length === 0 && miss.product_names.includes('Simba Cement'),
    'a miss hands back real names to pick from — the same law as the owner assistant');
  const cat = T.wa_catalogue_names.run();
  t.check(Array.isArray(cat.names) && typeof cat.names[0] === 'string',
    'the catalogue read is names only');
  const toolsSrc = extractDeclaration(app, 'WA_DRAFT_TOOLS', 'index.html');
  t.check(!/purchasePrice|supplierId|debt|rankedPriceRows/.test(toolsSrc),
    'no cost-bearing function is even referenced by these executors');

  /* the order-taker resolves and prices — and CREATES nothing */
  const before = JSON.stringify(data);
  const order = T.wa_take_order.run({ items: [
    { query: 'simba cement', qty: 5 },
    { query: 'ruleless bracket', qty: 2 },
    { query: 'flying elephant', qty: 1 },
  ] });
  t.check(order.lines.length === 1 && order.lines[0].productId === 'P1'
    && order.lines[0].qty === 5 && order.lines[0].price === 45000,
    `a commitment resolves to priced lines the app can turn into an order (got ${JSON.stringify(order.lines)})`);
  t.check(order.total === 225000, 'with the total already right');
  t.check(order.unpriced.length === 1 && order.unpriced[0] === 'Ruleless bracket',
    'a match with no price is UNPRICED — we sell it, the owner quotes it — never unmatched');
  t.check(order.unmatched.length === 1 && order.unmatched[0] === 'flying elephant',
    'and what could not be matched is NAMED, never silently dropped');
  t.check(JSON.stringify(data) === before,
    'drafting an order writes NOTHING — only the owner\'s tap creates one');

  const bulk = T.wa_take_order.run({ items: [{ query: 'simba cement', qty: 12 }] });
  t.check(bulk.lines[0].price === 40000,
    'a pack-sized order earns the wholesale side — the counter\'s own law, by arithmetic');

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
  t.check(/aiDrafts: \{\}/.test(app) && /waInbox\.aiDrafts\[convId\] = \{ wamid: lastIn\.wamid, text,/.test(app),
    'the draft lives in inbox state, so the 12-second poll cannot eat it mid-read');
  t.check(/\.wa-suggest:not\(\.ai\)/.test(app),
    'the token-match card keeps its own handlers — the two suggestions coexist');
  t.check(/fetch\('\/api\/wa-draft'/.test(app) && /'Bearer ' \+ token/.test(app),
    'the client calls the endpoint with the owner\'s own session');
  t.check(/id="wa_ai_order"/.test(app) && /waCreateOrderFromChat\(\)/.test(app)
    && /hasOrder \? `<button/.test(app),
    'the Create-order button exists only when the draft carries a resolved order');
  const createFn = (/async function waCreateOrderFromChat\(\)\{[\s\S]*?\n\}/.exec(app) || [''])[0];
  t.check(/ASSISTANT_TOOLS\.create_quote\.run\(/.test(createFn),
    'the order is created through create_quote.run — the same door the owner\'s assistant uses');
  t.check(/q\.originWa = true; q\.waConversationId = conv\.id;/.test(createFn),
    'stamped WhatsApp-born, so the insights count it like a webhook cart order');
  t.check(/waSendReply\(d\.text \+ '\\nOrder no\. ' \+ res\.invoice \+ '\.'\)/.test(createFn),
    'and the confirmation goes out with the order number, through the same send door');
  t.check(/waWaMarkupHTML/.test(app) && /replace\(\/\\\*\(\[\^\*\\n\]\+\)\\\*\/g, '<b>\$1<\/b>'\)/.test(app),
    'the preview renders *bold* the way WhatsApp will');
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
