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
 *   AMBIGUITY GOES TO THE HUMAN. "sofa leg 4" against both a Gold 4"
 *   and a Silver 4" is a tie, a tie is ambiguity, and the assistant
 *   suggests NOTHING -- a wrong price sent in the shop's name is the
 *   failure mode this design exists to avoid. Same for greetings,
 *   generic words, and anything scoring below half a product's name.
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
    { id: 'P17', name: 'Sofa Leg', type: 'variable', variants: [
      { combo: { Colour: 'Gold', Size: '4"' } },
      { combo: { Colour: 'Gold', Size: '5"' } },
      { combo: { Colour: 'Silver', Size: '4"' } },
    ] },
  ];
  sellFixture.set('P1', { price: 45000, unit: 'bag' });
  sellFixture.set('P9', { price: 250000, unit: 'pc' });
  sellFixture.set('P17::0', { price: 203000, unit: 'ctn' });
  sellFixture.set('P17::1', { price: 208000, unit: 'ctn' });
  sellFixture.set('P17::2', { price: 199000, unit: 'ctn' });
  breaksFixture.set('P1', [{ qty: 10, price: 43500 }]);

  const cands = scope.waQuoteCandidates();
  eq(cands.length, 5, 'a quote needs a PRICE, not a photo — the photoless cement is in, the priceless sheet is out');
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

  eq(scope.waQuoteMatch('sofa leg 4', cands), null,
    'Gold 4" and Silver 4" tie — ambiguity goes to the human, not to a coin toss');
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
  t.check(/if\(lastIn && !waInbox\.dismissed\[lastIn\.wamid\]\)/.test(src),
    'a dismissed suggestion stays dismissed');
  t.check(/if\(w\.open\)\{\s*\n\s*const lastIn/.test(src),
    'no suggestion on a closed window — it could not be sent anyway');
  t.check(/waSendReply\(replyText\);/.test(src),
    'even "Send suggestion" travels the composer road, with the server\'s window check at the end');
  t.check(!/waSendReply\((?!textOverride|replyText|\))/.test(src.slice(src.indexOf('function waQuoteMatch'))),
    'and nothing else calls the send with fabricated text');
  t.check(/waInbox\.drafts\[String\(waInbox\.active\)\] = replyText;/.test(src),
    '"Edit first" hands the text to the composer as a draft');
  t.check(/if\(taNow\) taNow\.value = replyText;/.test(src),
    'and into the LIVE textarea before the re-render, or the rebuild\'s draft-capture stomps it');
  t.check(/\(partial match, check it\)/.test(src),
    'a partial match is labelled as one on the card');
}

process.exit(t.done() ? 1 : 0);
