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
const companionFixture = new Map();  // 'P1' or 'P1::0' -> [{label, price, unit, ...}]
const env = {
  data: { products: [], presetWaAliases: [], presetWaAliasNo: [] },
  WA_QUOTE_STOPWORDS_SRC: null,
  catalogueSellAtQty: (p, idx, qty, basis) => {
    basisAsked.push(basis);
    return sellFixture.get(p.id + (idx==null ? '' : '::'+idx)) || null;
  },
  catalogueBreaks: (p, idx) => breaksFixture.get(p.id + (idx==null ? '' : '::'+idx)) || [],
  /* What the shop wrote down about a product, as the one reader returns
     it. Empty unless a check below puts something in. */
  pairCompanionsFor: (id, idx) => companionFixture.get(id + (idx==null ? '' : '::'+idx)) || [],
  productVariantLabel: (p, idx) => {
    if (idx == null) return p.name;
    const v = (p.variants || [])[idx];
    return v ? `${p.name} — ${Object.values(v.combo).join(' / ')}` : p.name;
  },
};
const NAMES = ['waQuoteTokens', 'waQuoteCandidates', 'waQuoteMatch', 'waQuoteReply',
  /* The matcher scores both ways now and the quantity is no longer
     thrown away, so the pieces those rest on come in with it. */
  'waQuoteProductTokens', 'waQuoteHit', 'waAskedQty'];
let scope = null; let err = null;
try {
  scope = compileScope([
    extractFunction(src, 'waQuoteTokens', 'index.html'),
    extractFunction(src, 'waQuoteCandidates', 'index.html'),
    extractFunction(src, 'waQuoteMatch', 'index.html'),
    extractFunction(src, 'waQuoteProductTokens', 'index.html'),
    extractFunction(src, 'waQuoteHit', 'index.html'),
    extractFunction(src, 'waAskedQty', 'index.html'),
    extractFunction(src, 'waQuoteReply', 'index.html'),
    extractFunction(src, 'stockKey', 'index.html'),
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

/* ---------- 3b. THE SCORING WAS BACKWARDS ----------------------------
 *
 * A product used to be judged by how much of ITS OWN NAME the message
 * covered, and 1.0 was the autonomy contract. So a one-word product
 * scored a perfect 1.0 on any message containing the word and answered
 * by itself, while a five-word product scored 0.8 for a customer who
 * asked precisely and got silence. Short names won; precise questions
 * lost. These are the cases that bug produced.
 */
{
  /* Sections 4 and after go on reading the pool section 2 built, so
     everything borrowed here is put back at the end of the block. */
  const keptProducts = env.data.products;
  const keptSell = new Map(sellFixture); const keptBreaks = new Map(breaksFixture);
  env.data.products = [
    { id: 'C1', name: 'Cement', type: 'simple', image: null },
    { id: 'C2', name: 'Iron Sheets 28 Gauge Plain', type: 'simple', image: null },
  ];
  sellFixture.clear(); breaksFixture.clear();
  sellFixture.set('C1', { price: 32000, unit: 'bag' });
  sellFixture.set('C2', { price: 48000, unit: 'sheet' });
  breaksFixture.set('C2', [{ qty: 20, price: 46500 }]);
  const cands = scope.waQuoteCandidates();

  /* THE BUG, exactly as it fired. Two words of theirs belong to the
     iron sheets and one to the cement, but the cement's whole name is
     that one word -- so the old rule scored it a perfect 1.0 and sent
     a cement price, unattended, to a question mostly about roofing.
     (The sheets are not the answer either: two of their five words is
     below the half-a-name floor, so they are not even a candidate. The
     right answer here is that a person reads it.) */
  const both = scope.waQuoteMatch('do you have cement and iron sheets', cands);
  eq(both && both.name, 'Cement', 'the one product named wholly is still what the owner is shown');
  eq(both && both.auto, false,
    'but it no longer answers by itself, because it explains only a third of what they said');
  const cementAlone = scope.waQuoteMatch('how much is cement', cands);
  eq(cementAlone && cementAlone.auto, true, 'cement alone is still a whole naming, and answerable');
  /* And the same word inside a bigger question is not. */
  const mixed = scope.waQuoteMatch('cement and iron sheets 28 gauge plain', cands);
  eq(mixed && mixed.auto, false,
    'nothing answers by itself while words belonging to another product are left over');

  /* THE PRECISE QUESTION that used to get silence. Four of five words is
     not a whole naming, so it still does not answer alone -- but it IS
     the match, and the owner sees it with what they missed. */
  const precise = scope.waQuoteMatch('how much for 30 iron sheets 28 gauge', cands);
  eq(precise && precise.name, 'Iron Sheets 28 Gauge Plain', 'the precise question matches');
  eq(precise && precise.hit, 4, 'on four of its five words');
  eq(precise && precise.exact, false, 'which is not a whole naming');
  eq(precise && precise.missed.join(','), 'plain', 'and it says which word they did not say');
  eq(precise && Math.round(precise.precision * 100), 100,
    'while everything they said that names a product belongs to this one');

  /* THE QUANTITY. It used to survive tokenisation as a stray number
     that matched nothing, and the reply quoted one unit to a customer
     who had asked for thirty. */
  eq(scope.waAskedQty('how much for 30 iron sheets 28 gauge', precise), 30,
    'thirty is the quantity');
  eq(scope.waAskedQty('iron sheets 28 gauge', precise), null,
    'and 28 is the product, not a quantity — its own name says so');
  eq(scope.waAskedQty('do you have one bag', null), null, 'one is not a quantity worth saying');
  eq(scope.waAskedQty('is it 250000 for a roll', null), null, 'and a figure that size is a price');

  const reply = scope.waQuoteReply(precise, 30);
  t.check(reply.includes('30 sheets comes to UGX 1,395,000 at UGX 46,500 each'),
    'the reply does the arithmetic they asked for, at the break they qualified for');
  t.check(!scope.waQuoteReply(precise, null).includes('comes to'),
    'and says nothing about a total when no quantity was asked');

  /* A WORD THIS SHOP'S CUSTOMERS USE is a whole naming: someone who
     writes "mabati" has named the product as surely as one who typed
     all five words of it. */
  env.data.presetWaAliases = [{ word: 'mabati', key: 'C2', name: 'Iron Sheets 28 Gauge Plain' }];
  const viaWord = scope.waQuoteMatch('mabati price?', scope.waQuoteCandidates());
  eq(viaWord && viaWord.name, 'Iron Sheets 28 Gauge Plain', 'a confirmed word finds its product');
  eq(viaWord && viaWord.auto, true, 'and names it wholly, so it can be answered at once');
  eq(viaWord && viaWord.viaAlias, 'mabati', 'the screen can say which word did it');
  env.data.presetWaAliases = [];

  /* WHO IS ASKING breaks a tie the message cannot. */
  env.data.products = [
    { id: 'T1', name: 'Cement Tororo', type: 'simple', image: null },
    { id: 'T2', name: 'Cement Hima', type: 'simple', image: null },
  ];
  sellFixture.clear();
  sellFixture.set('T1', { price: 32000, unit: 'bag' });
  sellFixture.set('T2', { price: 31000, unit: 'bag' });
  const two = scope.waQuoteCandidates();
  eq(scope.waQuoteMatch('cement', two).ambiguous, true, 'two cements and one word is a question');
  const settled = scope.waQuoteMatch('cement', two, { customerKeys: new Set(['T1']) });
  eq(settled && settled.name, 'Cement Tororo', 'unless the shop knows which one this customer buys');
  eq(settled && settled.viaCustomer, true, 'and it says that is what settled it');
  eq(settled && settled.auto, false,
    'a tie broken on someone\'s history is still not something to answer unattended');
  eq(scope.waQuoteMatch('cement', two, { customerKeys: new Set(['T1', 'T2']) }).ambiguous, true,
    'a customer who buys both settles nothing');

  env.data.products = keptProducts;
  sellFixture.clear(); keptSell.forEach((v, k) => sellFixture.set(k, v));
  breaksFixture.clear(); keptBreaks.forEach((v, k) => breaksFixture.set(k, v));
}

/* ---------- 4. what leaves the building ------------------------------ */
{
  const cands = scope.waQuoteCandidates();
  const reply = scope.waQuoteReply(scope.waQuoteMatch('cement price', cands));
  t.check(reply.includes('Simba Cement: UGX 45,000 per bag.'), 'the reply names the product and its retail price');
  t.check(reply.includes('Buy 10+ at UGX 43,500.'), 'and the volume break');
  t.check(reply.includes('Reply here to order'), 'and invites the order');
  t.check(!/[Mm]argin|[Cc]ost/.test(reply), 'no cost, no margin — the third surface held to the same line');
  t.check(!/[Uu]sually taken with/.test(reply), 'and nothing is claimed to go with it where nothing is written down');

  /* WHAT THE SHOP WROTE DOWN reaches the customer's reply, said as a
     fact about the shop's own orders rather than as availability: only
     the shop can say what is on the shelf, and it says that itself. */
  const m = scope.waQuoteMatch('cement price', cands);
  companionFixture.set(m.productId + (m.variantIdx == null ? '' : '::' + m.variantIdx),
    [{ verbId: 'needs', label: 'River Sand', price: 30000, unit: 'trip', available: true, why: null }]);
  const withCompanion = scope.waQuoteReply(m);
  t.check(withCompanion.includes('Usually taken with River Sand: UGX 30,000 per trip.'),
    'one companion is named, with its price');
  t.check(!/stock|available/i.test(withCompanion), 'and nothing about the shelf is claimed');
  companionFixture.clear();
}

/* ---------- 5. all of it is REACHED, and nothing sends itself -------- */
{
  /* The matcher is handed what the shop already knew about the person
     asking: a tie between two cements is settled by which one this
     customer has actually bought. */
  t.check(/const m = waQuoteMatch\(lastIn\.body \|\| '', waQuoteCandidates\(\),\s*\n\s*\{ customerKeys: waCustomerKeys\(cust && cust\.id, data\.savedQuotes\) \}\);/.test(src),
    'the last inbound text is what gets matched, and who asked breaks a tie');
  t.check(/const lastIn = \[\.\.\.waInbox\.msgs\]\.reverse\(\)\.find\(x=> x\.direction==='in' && x\.msg_type==='text'\);/.test(src),
    'and "last" means LAST — the newest inbound, not the first ever');
  // (dismissal is asserted with the unanswered-question gate in section 6)
  /* THE SUGGESTION CARD IS GONE, AND THIS IS WHY.
     It was an amber panel floating above the composer with its own
     oxide "Send suggestion" and its own "Edit first" — a second send
     button, a second copy of the reply, and the loudest thing on the
     screen even when its guess was wrong. The draft-first decision it
     existed to serve is now structural rather than a button: the match
     is written straight INTO the composer, which the owner is already
     reading and can already edit, and there is one Send.

     So "Edit first" is not a road any more — it is the resting state.

     One thing deliberately changed with it: a match is shown even when
     the free window has closed. The old card hid, because it could not
     be sent; the price is still the answer to "what did they ask for",
     and the composer beside it is disabled and says why. Blanking the
     one useful fact because a Meta deadline passed helped nobody. */
  t.check(/if\(unanswered && !waInbox\.dismissed\[lastIn\.wamid\]\)\{/.test(src),
    'a match is drawn for an unanswered question, and retired the moment anything goes back');
  const bindFn = extractFunction(src, 'waBindOpenRow', 'index.html');
  t.check(/waSendReply\(\);/.test(bindFn) && !/waSendReply\([^)]/.test(bindFn),
    'and Send sends what is IN the composer — the owner\'s own words, whoever first wrote them');
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
  t.check(/waInbox\.drafts\[convId\] = suggested;/.test(src),
    'the match lands in the composer as an editable draft, never as a sent message');
  /* The pre-fill's one real risk, and its guard: it may replace only
     what THIS screen last wrote, so a newer question refreshes a stale
     suggestion and a hand-typed reply is never touched. */
  t.check(/if\(!held \|\| \(mine && held === mine\.text\)\)\{/.test(src),
    'and it never overwrites words the owner typed themselves');
  /* The tie. Still a QUESTION rather than a guess or a silence — now
     asked as rows in the priced table, so the owner picks by reading
     the two prices side by side instead of by reading two names. */
  t.check(/\$\{options\.length\} things match — pick one/.test(src),
    'a tie renders as a question, with each option priced');
  t.check(/options\.map\(\(o,i\)=>/.test(src) && /class="btn btn-ghost ow-sm wa-suggest-opt" data-oi="\$\{i\}"/.test(src),
    'every tied option becomes a row you can take');
  const optHandler = (/wa-suggest-opt'\)\.forEach\(btn=> btn\.addEventListener\('click', \(\)=>\{[\s\S]*?\}\)\);/.exec(src) || [''])[0];
  t.check(/waInbox\.drafts\[convId\] = text;/.test(optHandler)
    && /if\(taNow\) taNow\.value = text;/.test(optHandler)
    && !/waSendReply/.test(optHandler),
    'tapping an option DRAFTS its quote — never a direct send');
  t.check(/a partial match — check it before it goes/.test(src),
    'a partial match says so, above the price it is offering');
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
  /* EXACT AND ALONE, and now also UNSHARED: scoring recall alone let a
     one-word product answer a question that was mostly about something
     else, so "cement and iron sheets" came back as a cement quote. The
     server holds the identical contract to the client. */
  t.check(/if \(winners\.length !== 1\) return null;/.test(hookSrc)
    && /if \(w\.recall === 1 && precision === 1\) return w\.c;/.test(hookSrc),
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
  t.check(/\$\{m\.payload && m\.payload\.auto \? ' · auto' : ''\}/.test(src),
    'the transcript shows which words the system said in the shop\'s name');
  /* And now on the QUEUE row too, in amber, which the thread-only mark
     could not do: a shop that never opens the chat still sees that a
     machine answered in its name. */
  t.check(/class="ow-cp wa-cp-auto">Answered by the system/.test(src)
    && /\.wa-cp-auto\{background:var\(--ow-amber-soft\);color:var\(--ow-amber-ink\);\}/.test(src),
    'and the queue says so without the chat having to be opened');
  t.check(/const unanswered = !!\(lastIn && lastMsg === lastIn\);/.test(src),
    'the match is drawn only for UNANSWERED questions — an auto-reply retires it');
}

process.exit(t.done() ? 1 : 0);
