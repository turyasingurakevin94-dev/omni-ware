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
const wsFixture = new Map();         // 'P1' -> {price} on the WHOLESALE rule, at the pack qty
const companionFixture = new Map();  // 'P1' or 'P1::0' -> [{label, price, unit, ...}]
const env = {
  data: { products: [], presetWaAliases: [], presetWaAliasNo: [] },
  WA_QUOTE_STOPWORDS_SRC: null,
  catalogueSellAtQty: (p, idx, qty, basis) => {
    basisAsked.push(basis);
    const k = p.id + (idx==null ? '' : '::'+idx);
    if (basis === 'wholesale') return wsFixture.get(k) || null;
    return sellFixture.get(k) || null;
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
  'waQuoteProductTokens', 'waQuoteHit', 'waQuoteStem', 'waQuoteNear', 'waQuoteRank', 'waAskedQty'];
let scope = null; let err = null;
try {
  scope = compileScope([
    extractFunction(src, 'waQuoteTokens', 'index.html'),
    extractFunction(src, 'waQuoteCandidates', 'index.html'),
    extractFunction(src, 'waQuoteMatch', 'index.html'),
    extractFunction(src, 'waQuoteProductTokens', 'index.html'),
    extractFunction(src, 'waQuoteHit', 'index.html'),
    extractFunction(src, 'waQuoteStem', 'index.html'),
    extractFunction(src, 'waQuoteNear', 'index.html'),
    extractFunction(src, 'waQuoteRank', 'index.html'),
    extractFunction(src, 'waQuoteEach', 'index.html'),
    extractFunction(src, 'waQuoteCompanion', 'index.html'),
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
let SECTION2_PRODUCTS = null;
{
  env.data.products = SECTION2_PRODUCTS = [
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
  /* The list price is the retail one; the ONLY other side ever read is
     the wholesale rule at the pack quantity, for the customer who takes
     a pack's worth -- the same two reads the assistant's own tool makes. */
  t.check(basisAsked.every((b) => b === 'retail' || b === 'wholesale'), 'the assistant reads the two customer sides of the price book and nothing else');
  t.check(basisAsked.filter((b) => b === 'retail').length > basisAsked.filter((b) => b === 'wholesale').length,
    'and the list price is the retail one');
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
  eq(scope.waQuoteMatch('do you have tiles?', cands), null, 'an unknown product suggests nothing');
  /* "do you have wheelbarrows?" used to be the unknown-product case
     above, and it was passing for the wrong reason: the shop DOES sell a
     wheelbarrow, and the assertion held only because "wheelbarrows" was
     not the same string as "wheelbarrow". A plural is not an unknown
     product. */
  const plural = scope.waQuoteMatch('do you have wheelbarrows?', cands);
  eq(plural && plural.name, 'Heavy Duty Steel Wheelbarrow', 'a plural finds the thing it is the plural of');
  eq(scope.waQuoteMatch('leg', cands), null,
    'one generic word that six variants share is a scatter, and a scatter stays silent');
  /* THE FLOOR IS GONE, AND THIS IS WHY. "wheelbarrow price?" against
     "Heavy Duty Steel Wheelbarrow" is a quarter of the name, and used
     to be refused on that fraction alone -- an unrivalled, unambiguous
     question, answered with silence, and the owner sent to the
     assistant to have one word read for them. The fraction was never
     what protected anyone: the SCATTER above is what stops a common
     word matching everything, and the autonomy gate below is what
     stops a quarter of a name being sent unattended. Both still hold.
     What changed is that the owner now sees the draft. */
  const quarter = scope.waQuoteMatch('wheelbarrow price?', cands);
  eq(quarter && quarter.name, 'Heavy Duty Steel Wheelbarrow',
    'a quarter of a long name, UNRIVALLED, is a match the owner is shown');
  eq(quarter && quarter.auto, false, 'and is never one that sends itself');
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
     Now the product that explains MORE of the message ranks first, and
     neither answers by itself: it is a two-product question, and a
     two-product question is a person's to read. */
  const both = scope.waQuoteMatch('do you have cement and iron sheets', cands);
  eq(both && both.name, 'Iron Sheets 28 Gauge Plain',
    'the product that explains more of what they said is what the owner is shown');
  eq(both && both.auto, false,
    'and nothing answers by itself while words belonging to another product are left over');
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

/* ---------- 3c. READING THE WAY THE ASSISTANT READS --------------------
 *
 * Measured, not assumed: on the seeded shop, thirteen real-shaped
 * questions were put to the matcher and to the search the assistant is
 * handed. The matcher lost five of them and won none. Every loss was a
 * way of READING, not of reasoning -- a plural, a category, a typo, and
 * a floor that refused a third of a name. None needed a model. These
 * pin each one.
 */
{
  eq(scope.waQuoteStem('nails'), 'nail', 'a plural is the word');
  eq(scope.waQuoteStem('cements'), 'cement', 'and so is an over-eager one');
  eq(scope.waQuoteStem('boxes'), 'box', '-es comes off after a hiss');
  eq(scope.waQuoteStem('gloss'), 'gloss', 'but -ss is not a plural');
  eq(scope.waQuoteStem('glass'), 'glass', 'nor is glass');
  eq(scope.waQuoteStem('pcs'), 'pcs', 'and three letters are left alone');

  t.check(scope.waQuoteNear('cement (tororo 50kg)', 'cemnt'), 'a dropped letter still finds the word');
  t.check(scope.waQuoteNear('sandpaper', 'sndppr'), 'and so does a trader\'s abbreviation');
  t.check(!scope.waQuoteNear('truss head screws', 'rdr'), 'but it cannot wander into the middle of other words');
  t.check(!scope.waQuoteNear('cement', 'cem'), 'and three letters are a coincidence, not a spelling');
  /* Found by measuring, not by reasoning: on a realistic catalogue,
     "do you have tiles?" drafted a PADLOCK, because t-i-l-e is a
     subsequence of "tri-circle" once the anchor is on the t. */
  t.check(!scope.waQuoteNear('padlock 50mm (tri-circle)', 'tile'), 'and letters may skip, but not six letters far');

  env.data.products = [
    { id: 'R1', name: 'Iron Sheets 28 Gauge', type: 'simple', image: null, category: 'Roofing' },
    { id: 'R2', name: 'Ridge Caps', type: 'simple', image: null, category: 'Roofing' },
    { id: 'R3', name: 'Cement Tororo 50kg', type: 'simple', image: null, category: 'Cement' },
    { id: 'R4', name: 'Gloss Paint White', type: 'simple', image: null, category: 'Paint' },
  ];
  const keptSell = new Map(sellFixture); sellFixture.clear();
  ['R1','R2','R3','R4'].forEach((k, i) => sellFixture.set(k, { price: 10000 * (i + 1), unit: 'pc' }));
  const cands = scope.waQuoteCandidates();

  /* THE FLOOR. One word of three, and it is the only cement. */
  const one = scope.waQuoteMatch('cement price', cands);
  eq(one && one.name, 'Cement Tororo 50kg', 'one word of a three-word name finds the only thing it can mean');
  eq(one && one.auto, false, 'and is drafted for the owner, not sent');
  eq(one && one.via, 'named', 'because they NAMED it');

  /* THE PLURAL, on the customer's side. */
  eq((scope.waQuoteMatch('price of cements', cands) || {}).name, 'Cement Tororo 50kg', 'their plural finds the shop\'s singular');
  eq((scope.waQuoteMatch('iron sheet 28 gauge', cands) || {}).exact, true, 'and their singular finds the shop\'s plural, wholly');

  /* THE CATEGORY: the kind of thing, not the thing. */
  const kind = scope.waQuoteMatch('anything for roofing?', cands);
  eq(kind && kind.ambiguous, true, 'asking for a category with two things in it is a question');
  eq(kind && kind.options.length, 2, 'with both offered');
  eq(kind && kind.options[0].via, 'category', 'and the screen can say they were found by kind, not by name');
  t.check(kind && kind.options.every((o) => !o.auto), 'nothing found by category may ever send itself');
  /* A category word that is ALSO in a name is a naming, and a naming
     outranks everything found by kind. */
  env.data.products.push({ id: 'R6', name: 'Roofing Nails', type: 'simple', image: null, category: 'Roofing' });
  sellFixture.set('R6', { price: 12000, unit: 'kg' });
  eq((scope.waQuoteMatch('anything for roofing?', scope.waQuoteCandidates()) || {}).via, 'named',
    'a message that names a product is never answered with its category');
  env.data.products.pop();

  /* THE TYPO. */
  const typo = scope.waQuoteMatch('do you have cemnt', cands);
  eq(typo && typo.name, 'Cement Tororo 50kg', 'a misspelling finds the product');
  eq(typo && typo.via, 'spelling', 'and says it was a spelling');
  eq(typo && typo.auto, false, 'and is never sent on a guess at what they typed');

  /* NAMED BEATS FOUND, always. */
  env.data.products.push({ id: 'R5', name: 'Cemnt Board', type: 'simple', image: null, category: 'Boards' });
  sellFixture.set('R5', { price: 50000, unit: 'pc' });
  eq((scope.waQuoteMatch('cemnt', scope.waQuoteCandidates()) || {}).name, 'Cemnt Board',
    'a product actually called that outranks one it might be a misspelling of');

  sellFixture.clear(); keptSell.forEach((v, k) => sellFixture.set(k, v));
}

/* ---------- 4. what leaves the building ------------------------------ */
{
  env.data.products = SECTION2_PRODUCTS;
  const cands = scope.waQuoteCandidates();
  const reply = scope.waQuoteReply(scope.waQuoteMatch('cement price', cands));
  t.check(reply.includes('Simba Cement: UGX 45,000 per bag.'), 'the reply names the product and its retail price');
  t.check(reply.includes('Buy 10+ at UGX 43,500.'), 'and the volume break');
  t.check(reply.includes('Reply here to order'), 'and invites the order');
  t.check(!/[Mm]argin|[Cc]ost/.test(reply), 'no cost, no margin — the third surface held to the same line');
  t.check(!/[Uu]sually taken with/.test(reply), 'and nothing is claimed to go with it where nothing is written down');

  /* WHAT THE SHOP WROTE DOWN reaches the customer's reply, said as a
     fact about the shop's own orders rather than as availability: only
     the shop can say what is on the shelf, and it says that itself.

     The pairing is now read when the CANDIDATE is built rather than
     when the reply is written, which is why the fixture goes in before
     the pool: waQuoteReply had to become a pure function of its match
     for the server to be able to run the identical source against the
     published pack. Setting the fixture and re-reading a match made
     earlier would now, correctly, find nothing. */
  companionFixture.set('P1',
    [{ verbId: 'needs', label: 'River Sand', price: 30000, unit: 'trip', available: true, why: null }]);
  const m = scope.waQuoteMatch('cement price', scope.waQuoteCandidates());
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
      extractFunction(hookSrc, 'waQuoteStem', 'wa-webhook'),
      extractFunction(hookSrc, 'waExactMatch', 'wa-webhook'),
      /* The WORDS are a mirror too now, not only the match. The server
         used to compose its own one-liner out of Meta's price string,
         so the shop had two voices -- one when the owner tapped Send
         and another at midnight. */
      extractFunction(hookSrc, 'waAskedQty', 'wa-webhook'),
      extractFunction(hookSrc, 'waQuoteEach', 'wa-webhook'),
      extractFunction(hookSrc, 'waQuoteReply', 'wa-webhook'),
      (hookSrc.match(/const WA_QUOTE_STOPWORDS = new Set\([\s\S]*?\);/) || [''])[0],
    ], {}, ['waQuoteTokens', 'waExactMatch', 'waAskedQty', 'waQuoteReply', 'waQuoteEach'], { typescript: true });
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
      'wheelbarrow price?',              // a quarter of a name -> drafted, never sent
      'do you have wheelbarrows?',       // plural -> the same
      'price of simba cements',          // plural of the whole name -> exact -> auto
      'do you have tiles?',              // unknown -> nothing
    ];
    fixtures.forEach((text) => {
      const client = scope.waQuoteMatch(text, cands);
      const server = hook.waExactMatch(text, cands);
      const clientAuto = client && !client.ambiguous && client.auto ? client : null;
      const serverName = server ? server.name : null;
      eq(serverName, clientAuto && clientAuto.name,
        `both matchers agree on ${JSON.stringify(text)} — the server answers only what the client would answer alone`);
      /* AND THEY SAY THE SAME THING. Same source, same match, same
         quantity — so a customer cannot tell from the words whether a
         person was awake. */
      if (server && clientAuto) {
        eq(hook.waQuoteReply(server, hook.waAskedQty(text, server)),
          scope.waQuoteReply(clientAuto, scope.waAskedQty(text, clientAuto)),
          `and word for word on ${JSON.stringify(text)}`);
      }
    });
    /* THE PACK BUYER. Simba Cement has a retail break at 10+ (43,500)
       and a wholesale side at the pallet of 10 (41,000). Twenty bags is
       a wholesale customer, and the counter would give the cheaper
       side -- the assistant already did, through waCustomerPriceAt,
       while this reply quoted the retail rung to everyone. */
    sellFixture.set('P1', { price: 45000, unit: 'bag', packQty: 10, packUnit: 'pallet' });
    wsFixture.set('P1', { price: 41000, unit: 'bag' });
    const packCands = scope.waQuoteCandidates();
    const twenty = 'simba cement, 20 bags';
    const cm = scope.waQuoteMatch(twenty, packCands); const sm2 = hook.waExactMatch(twenty, packCands);
    t.check(cm && cm.auto && sm2, 'a pack buyer who names the product is answerable on both sides');
    const want = '20 bags comes to UGX 820,000 at UGX 41,000 each (wholesale, 10+)';
    t.check(cm && scope.waQuoteReply(cm, scope.waAskedQty(twenty, cm)).includes(want),
      'the client quotes the wholesale side to a pack buyer, and says which side it is');
    t.check(sm2 && hook.waQuoteReply(sm2, hook.waAskedQty(twenty, sm2)).includes(want),
      'and so does the server, word for word');
    t.check(cm && /5 bags comes to UGX 225,000\./.test(scope.waQuoteReply(cm, 5)),
      'while five bags — under the pack — stay at the list price with no side named');
    /* The break alone, when there is no wholesale rule: the old answer, unchanged. */
    wsFixture.clear();
    const noWs = scope.waQuoteMatch(twenty, scope.waQuoteCandidates());
    t.check(noWs && /20 bags comes to UGX 870,000 at UGX 43,500 each \(10\+\)/.test(scope.waQuoteReply(noWs, 20)),
      'with no wholesale rule the retail break is the answer, as before');
    sellFixture.set('P1', { price: 45000, unit: 'bag' });

    /* The quantity is the case that used to differ most: the client did
       the arithmetic and the server quoted one unit. */
    const thirty = 'price of sofa leg gold 4 — i need 30';
    const sm = hook.waExactMatch(thirty, cands);
    t.check(!!sm && /30 ctns comes to UGX 6,090,000/.test(hook.waQuoteReply(sm, hook.waAskedQty(thirty, sm))),
      'the server does the arithmetic the customer asked for, exactly as the composer would');
  }

  /* The autonomy contract, held in the source. */
  /* EXACT AND ALONE, and now also UNSHARED: scoring recall alone let a
     one-word product answer a question that was mostly about something
     else, so "cement and iron sheets" came back as a cement quote. The
     server holds the identical contract to the client. */
  t.check(/if \(winners\.length !== 1\) return null;/.test(hookSrc)
    && /if \(w\.recall === 1 && precision === 1\) return w\.c;/.test(hookSrc),
    'the server sends only on EXACT AND ALONE — anything less returns nothing');
  /* THE CATALOG ID IS NO LONGER A GATE. It used to be, because the
     Meta catalog WAS the list -- which meant a shop that had not
     finished Commerce Manager answered nobody, and a shop that had
     could only answer about the products it had photographed. The
     opt-in is the gate; the pack is the list. */
  t.check(/if \(!numRow \|\| !numRow\.auto_quote \|\| !ACCESS_TOKEN\) return;/.test(hookSrc),
    'and only when the shop has OPTED IN');
  t.check(!/catalog_id/.test(hookSrc.slice(hookSrc.indexOf('async function maybeAutoQuote'))),
    'a shop can answer questions without running a storefront');
  t.check(/ev\.type === "text" && ev\.body && \(landed \?\? \[\]\)\.length > 0/.test(hookSrc),
    'auto-quote rides the freshly-landed gate — a webhook retry cannot answer twice');
  /* The lookup existing is not the guard working -- the RETURN is. */
  t.check(/if \(recent && recent\.length\) return;/.test(hookSrc),
    'the parrot guard: the same answer twice in an hour is noise, not service');
  t.check(/payload: \{ auto: true \},/.test(hookSrc),
    'every automatic reply is marked as the system speaking');
  t.check(!/catalogueSellAtQty|suggestedSellingPrice/.test(hookSrc),
    'the server never re-prices — it quotes the pack the browser published, priced by the chain the printed catalogue proves');
  t.check(!/GRAPH_BASE\}\/\$\{catalogId\}\/products/.test(hookSrc),
    'and it no longer reads the Meta catalog to decide what it can talk about');

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
