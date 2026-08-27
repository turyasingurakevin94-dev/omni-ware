#!/usr/bin/env node
'use strict';
/*
 * WhatsApp: the quote assistant (phase 4). Draft-first, by decision.
 *
 * When a customer's message names a product, a reply is drafted from
 * the same retail pricing the printed catalogue proves -- and WAITS for
 * the admin's tap. The assistant's entire authority is a suggestion
 * card; nothing sends itself.
 *
 * The claims that matter:
 *
 *   AMBIGUITY GOES TO THE HUMAN -- AS A QUESTION. "sofa leg 4" against
 *   a Gold 4" and a Silver 4" is a tie; the assistant offers the
 *   OPTIONS to tap, never a guess. A bigger scatter, a greeting, a
 *   generic word, or anything scoring below half a product's name
 *   offers nothing -- a wrong price sent in the shop's name is the
 *   failure mode this design exists to avoid.
 *
 *   A QUOTE NEEDS A PRICE, NOT A PHOTO. The candidate pool is gated on
 *   a retail price only -- unlike the catalog, where a photo is the
 *   point.
 *
 *   NOTHING THAT LEAVES THE BUILDING CARRIES A COST PRICE. Third file
 *   to hold this line, same kind of test.
 *
 * Run: node test/whatsapp-quote-assistant.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp quote assistant');
const src = read('index.html');
const hookSrc = read('supabase/functions/wa-webhook/index.ts');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const sellFixture = new Map(); const breaksFixture = new Map(); const basisAsked = [];
const env = {
  data: { products: [] },
  WA_QUOTE_STOPWORDS_SRC: null,
  catalogueSellAtQty: (p, idx, qty, basis) => {
    basisAsked.push(basis);
    return sellFixture.get(p.id + (idx==null ? '' : '::'+idx)) || null;
  },
  catalogueBreaks: (p, idx) => breaksFixture.get(p.id + (idx==null ? '' : '::'+idx)) || [],
  productVariantLabel: (p, idx) => {
    if (idx == null) return p.name;
    const v = (p.variants || [])[idx];
    return v ? `${p.name} — ${Object.values(v.combo).join(' / ')}` : p.name;
  },
};
const NAMES = ['waQuoteTokens', 'waQuoteCandidates', 'waQuoteMatch', 'waQuoteReply'];
let scope = null; let err = null;
try {
  scope = compileScope([
    extractFunction(src, 'waQuoteTokens', 'index.html'),
    extractFunction(src, 'waQuoteCandidates', 'index.html'),
    extractFunction(src, 'waQuoteMatch', 'index.html'),
    extractFunction(src, 'waQuoteReply', 'index.html'),
    // the stopword set the tokenizer closes over
    (src.match(/const WA_QUOTE_STOPWORDS = new Set\([\s\S]*?\);/) || [''])[0],
  ], env, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the assistant helpers compile${err ? ` (${err.message})` : ''}`);
if (!scope) process.exit(1);

/* ---------- 1. hearing through the noise ----------------------------- */
{
  eq(JSON.stringify(scope.waQuoteTokens('How much is a bag of CEMENT?')), '["bag","cement"]',
    'question filler is stripped, the goods remain');
  eq(JSON.stringify(scope.waQuoteTokens('hello, good morning!')), '[]',
    'a greeting contains no product');
  eq(JSON.stringify(scope.waQuoteTokens('sofa-leg gold 4"')), '["sofa","leg","gold","4"]',
    'punctuation splits, it does not stick');
}

/* ---------- 2. the candidate pool ------------------------------------ */
{
  env.data.products = [
    { id: 'P1', name: 'Simba Cement', type: 'simple', image: null },   // no photo, HAS price
    { id: 'P2', name: 'Iron Sheet', type: 'simple', image: 'u2' },     // photo, NO price
    // Four tokens on purpose: one generic word scores 0.25 with no
    // rival, so ONLY the threshold stands between it and a quote.
    { id: 'P9', name: 'Heavy Duty Steel Wheelbarrow', type: 'simple', image: null },
    // Six variants: four share the size 4" (an askable tie), and all
    // six share "sofa leg" (a scatter past the cap, which stays silent).
    { id: 'P17', name: 'Sofa Leg', type: 'variable', variants: [
      { combo: { Colour: 'Gold', Size: '4"' } },
      { combo: { Colour: 'Gold', Size: '5"' } },
      { combo: { Colour: 'Silver', Size: '4"' } },
      { combo: { Colour: 'Black', Size: '4"' } },
      { combo: { Colour: 'Blue', Size: '4"' } },
      { combo: { Colour: 'Blue', Size: '5"' } },
    ] },
  ];
  sellFixture.set('P1', { price: 45000, unit: 'bag' });
  sellFixture.set('P9', { price: 250000, unit: 'pc' });
  sellFixture.set('P17::0', { price: 203000, unit: 'ctn' });
  sellFixture.set('P17::1', { price: 208000, unit: 'ctn' });
  sellFixture.set('P17::2', { price: 199000, unit: 'ctn' });
  sellFixture.set('P17::3', { price: 201000, unit: 'ctn' });
  sellFixture.set('P17::4', { price: 198000, unit: 'ctn' });
  sellFixture.set('P17::5', { price: 197000, unit: 'ctn' });
  breaksFixture.set('P1', [{ qty: 10, price: 43500 }]);

  const cands = scope.waQuoteCandidates();
  eq(cands.length, 8, 'a quote needs a PRICE, not a photo — the photoless cement is in, the priceless sheet is out');
  t.check(basisAsked.every((b) => b === 'retail'), 'every price the assistant quotes is the RETAIL one');
}

/* ---------- 3. matching, and refusing to guess ----------------------- */
{
  const cands = scope.waQuoteCandidates();
  const m1 = scope.waQuoteMatch('how much is cement?', cands);
  eq(m1 && m1.name, 'Simba Cement', 'half a product name, unrivalled, is a match');
  eq(m1 && m1.exact, false, 'flagged as partial, so the admin knows to look');

  const m2 = scope.waQuoteMatch('price of sofa leg gold 4', cands);
  eq(m2 && m2.name, 'Sofa Leg — Gold / 4"', 'a fully named variant matches exactly');
  eq(m2 && m2.exact, true, 'and says so');

  const tie = scope.waQuoteMatch('sofa leg 4', cands);
  eq(tie && tie.ambiguous, true, 'four 4" colours tie — ambiguity becomes a QUESTION, not a guess');
  eq(tie && tie.options.length, 4, 'with every tied option offered');
  t.check(tie && tie.options.every((o) => /4"/.test(o.name)), 'and only the tied ones');
  eq(scope.waQuoteMatch('sofa leg', cands), null,
    'six variants tying is a scatter, not a question — past the cap, silence');
  eq(scope.waQuoteMatch('hello, good morning!', cands), null, 'a greeting suggests nothing');
  eq(scope.waQuoteMatch('do you have wheelbarrows?', cands), null, 'an unknown product suggests nothing');
  eq(scope.waQuoteMatch('leg', cands), null,
    'one generic word covering a third of a name is below the line');
  eq(scope.waQuoteMatch('wheelbarrow price?', cands), null,
    'a quarter of a long name, even UNRIVALLED, is below the line — only the threshold holds here');
}

/* ---------- 4. what leaves the building ------------------------------ */
{
  const cands = scope.waQuoteCandidates();
  const reply = scope.waQuoteReply(scope.waQuoteMatch('cement price', cands));
  t.check(reply.includes('Simba Cement: UGX 45,000 per bag.'), 'the reply names the product and its retail price');
  t.check(reply.includes('Buy 10+ at UGX 43,500.'), 'and the volume break');
  t.check(reply.includes('Reply here to order'), 'and invites the order');
  t.check(!/[Mm]argin|[Cc]ost/.test(reply), 'no cost, no margin — the third surface held to the same line');
}

/* ---------- 5. all of it is REACHED, and nothing sends itself -------- */
{
  t.check(/const m = waQuoteMatch\(lastIn\.body\|\|'', waQuoteCandidates\(\)\);/.test(src),
    'the last inbound text is what gets matched');
  t.check(/const lastIn = \[\.\.\.waInbox\.msgs\]\.reverse\(\)\.find\(x=> x\.direction==='in' && x\.msg_type==='text'\);/.test(src),
    'and "last" means LAST — the newest inbound, not the first ever');
  // (dismissal is asserted with the unanswered-question gate in section 6)
  t.check(/if\(w\.open\)\{\s*\n\s*const lastMsg/.test(src),
    'no suggestion on a closed window — it could not be sent anyway');
  t.check(/waSendReply\(replyText\);/.test(src),
    'even "Send suggestion" travels the composer road, with the server\'s window check at the end');
  /* Four roads only, all of them through words the owner has SEEN or
     figures the owner has APPROVED: the composer (textOverride), the
     token-match card (replyText), the assistant draft (d.text —
     rendered in full before its Send button exists), and the document
     road's text twin (textTwin — always waOrderReceiptText or
     waQuoteText, composed by code from lines the owner approved by
     tapping). Anything else calling the send with text it made up is
     the bug this pin exists to catch. The slice starts at the receipt
     twins, where send-capable code now begins. */
  t.check(!/waSendReply\((?!textOverride|replyText|d\.text|textTwin|\))/.test(src.slice(src.indexOf('function waOrderReceiptText'))),
    'and nothing else calls the send with fabricated text');
  t.check(/waInbox\.drafts\[String\(waInbox\.active\)\] = replyText;/.test(src),
    '"Edit first" hands the text to the composer as a draft');
  t.check(/if\(taNow\) taNow\.value = replyText;/.test(src),
    'and into the LIVE textarea before the re-render, or the rebuild\'s draft-capture stomps it');
  /* The ambiguity card. */
  t.check(/Which one did they mean\? Tap to draft its quote/.test(src),
    'a tie renders as a question with the options on the card');
  t.check(/\$\{m\.options\.map\(\(o,i\)=>/.test(src),
    'every tied option becomes a button');
  const optHandler = (/wa-suggest-opt'\)\.forEach\(btn=> btn\.addEventListener\('click', \(\)=>\{[\s\S]*?\}\)\);/.exec(src) || [''])[0];
  t.check(/waInbox\.drafts\[String\(waInbox\.active\)\] = text;/.test(optHandler)
    && /if\(taNow\) taNow\.value = text;/.test(optHandler)
    && !/waSendReply/.test(optHandler),
    'tapping an option DRAFTS its quote — the edit-first road, never a direct send');
  t.check(/\(partial match, check it\)/.test(src),
    'a partial match is labelled as one on the card');
}

/* ---------- 6. the server mirror: autonomy is EXACT AND ALONE -------- */
{
  let hook = null; let hErr = null;
  try {
    hook = compileScope([
      extractFunction(hookSrc, 'waQuoteTokens', 'wa-webhook'),
      extractFunction(hookSrc, 'waExactMatch', 'wa-webhook'),
      (hookSrc.match(/const WA_QUOTE_STOPWORDS = new Set\([\s\S]*?\);/) || [''])[0],
    ], {}, ['waQuoteTokens', 'waExactMatch'], { typescript: true });
  } catch (e) { hErr = e; }
  t.check(!!hook, `the webhook mirror compiles${hErr ? ` (${hErr.message})` : ''}`);
  if (hook) {
    const cands = scope.waQuoteCandidates();
    /* The two implementations must AGREE: the server auto-answers
       exactly the messages the client would mark as an exact match,
       and nothing else. One fixture set, both matchers. */
    const fixtures = [
      'price of sofa leg gold 4',        // exact -> auto
      'how much is cement?',             // partial -> human
      'sofa leg 4',                      // tie -> human (question card)
      'sofa leg',                        // scatter -> nothing
      'hello, good morning!',            // greeting -> nothing
      'wheelbarrow price?',              // below threshold -> nothing
    ];
    fixtures.forEach((text) => {
      const client = scope.waQuoteMatch(text, cands);
      const server = hook.waExactMatch(text, cands);
      const clientExact = client && !client.ambiguous && client.exact ? client.name : null;
      const serverName = server ? server.name : null;
      eq(serverName, clientExact,
        `both matchers agree on ${JSON.stringify(text)} — the server answers only what the client calls exact`);
    });
  }

  /* The autonomy contract, held in the source. */
  t.check(/if \(bestScore === 1 && winners\.length === 1\) return winners\[0\];/.test(hookSrc),
    'the server sends only on EXACT AND ALONE — anything less returns nothing');
  t.check(/if \(!numRow \|\| !numRow\.auto_quote \|\| !numRow\.catalog_id \|\| !ACCESS_TOKEN\) return;/.test(hookSrc),
    'and only when the shop has OPTED IN and published a catalog');
  t.check(/ev\.type === "text" && ev\.body && \(landed \?\? \[\]\)\.length > 0/.test(hookSrc),
    'auto-quote rides the freshly-landed gate — a webhook retry cannot answer twice');
  /* The lookup existing is not the guard working -- the RETURN is. */
  t.check(/if \(recent && recent\.length\) return;/.test(hookSrc),
    'the parrot guard: the same answer twice in an hour is noise, not service');
  t.check(/payload: \{ auto: true \},/.test(hookSrc),
    'every automatic reply is marked as the system speaking');
  t.check(!/catalogueSellAtQty|suggestedSellingPrice/.test(hookSrc),
    'the server never re-prices — it quotes the PUBLISHED catalog, the shop\'s own public word');

  /* The client's side of the bargain. */
  t.check(/update\(\{ auto_quote: on \}\)\.eq\('shop_id', currentShopId\)/.test(src),
    'the toggle writes the shop\'s own opt-in row');
  t.check(/\$\{m\.payload && m\.payload\.auto \? '<span class="wm-auto">auto<\/span>' : ''\}/.test(src),
    'the thread shows which words the system said in the shop\'s name');
  t.check(/if\(lastIn && lastMsg === lastIn && !waInbox\.dismissed\[lastIn\.wamid\]\)/.test(src),
    'the suggestion card shows only for UNANSWERED questions — an auto-reply retires it');
}

process.exit(t.done() ? 1 : 0);
