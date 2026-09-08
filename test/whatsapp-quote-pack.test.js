#!/usr/bin/env node
'use strict';
/*
 * The quote pack: one list of everything the shop can be asked about.
 *
 * THE FORK IT CLOSES. Two matchers were running against two different
 * sets of products while the screen called them mirrors of each other.
 * The browser read every product with a retail price -- hundreds. The
 * webhook read the Meta catalog, which takes only products with a photo
 * AND a price -- a few dozen. So a customer asking at 22:00 about
 * something the shop had never photographed got silence, and the same
 * question at 09:00, with the owner reading, got a price. Same shop,
 * same product, same words, two answers.
 *
 * Meta's photo rule is Meta's and it stays -- a storefront needs
 * pictures. But a TEXT REPLY needs no photo, and that is the whole
 * claim here: the browsable catalogue and the answerable list are two
 * different lists, and the answerable one is everything with a price.
 *
 * The claims that matter:
 *
 *   THE CLIENT COMPUTES, THE SERVER CARRIES. Same division as
 *   catalog-sync. The pricing chain lives in the browser and the
 *   printed catalogue proves it; the server reads the published row and
 *   quotes what it says, and must never re-derive a price.
 *
 *   NOTHING THAT LEAVES THE BUILDING CARRIES A COST PRICE. The pack is
 *   read by a service-role function and turned into customer replies,
 *   so it is the building's edge -- fourth surface held to this line.
 *
 *   A SNAPSHOT SAYS HOW OLD IT IS. The fingerprint decides whether to
 *   write at all, built_at is stored, and the webhook falls SILENT past
 *   the staleness floor rather than quoting a price the books have
 *   moved on from.
 *
 * Run: node test/whatsapp-quote-pack.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('the whatsapp quote pack');
const src = read('index.html');
const hookSrc = read('supabase/functions/wa-webhook/index.ts');
const mig = read('supabase/migrations/0094_wa_quote_pack.sql');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const sellFixture = new Map(); const breaksFixture = new Map(); const companionFixture = new Map();
const env = {
  data: { products: [], presetWaAliases: [] },
  catalogueSellAtQty: (p, idx) => sellFixture.get(p.id + (idx == null ? '' : '::' + idx)) || null,
  catalogueBreaks: (p, idx) => breaksFixture.get(p.id + (idx == null ? '' : '::' + idx)) || [],
  pairCompanionsFor: (id, idx) => companionFixture.get(id + (idx == null ? '' : '::' + idx)) || [],
  productVariantLabel: (p, idx) => {
    if (idx == null) return p.name;
    const v = (p.variants || [])[idx];
    return v ? `${p.name} — ${Object.values(v.combo).join(' / ')}` : p.name;
  },
};
const NAMES = ['waQuotePack', 'waQuotePackPrint', 'waQuoteCandidates', 'waQuoteReply', 'waQuoteMatch', 'waQuoteMatchSet'];
let scope = null; let err = null;
try {
  scope = compileScope([
    ...['waQuoteTokens', 'waQuoteCandidates', 'waQuoteCompanion', 'waQuoteMatch', 'waQuoteMatchSet', 'waQuoteProductTokens',
      'waQuoteHit', 'waQuoteStem', 'waQuoteNear', 'waQuoteRank', 'waQuoteEach', 'waAskedQty', 'waQuoteReply', 'waQuotePack', 'waQuotePackPrint', 'stockKey',
    ].map((n) => extractFunction(src, n, 'index.html')),
    (src.match(/const WA_QUOTE_STOPWORDS = new Set\([\s\S]*?\);/) || [''])[0],
  ], env, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the pack builder compiles${err ? ` (${err.message})` : ''}`);
if (!scope) process.exit(1);

/* ---------- 1. everything with a PRICE, photo or no photo ------------ */
{
  env.data.products = [
    { id: 'P1', name: 'Cement Tororo', type: 'simple', image: null },   // NO photo, has price
    { id: 'P2', name: 'Iron Sheet', type: 'simple', image: 'u2' },      // photo, NO price
    { id: 'P3', name: 'Roofing Nails', type: 'simple', image: 'u3' },   // both
  ];
  sellFixture.set('P1', { price: 32000, unit: 'bag' });
  sellFixture.set('P3', { price: 12000, unit: 'kg' });
  const pack = scope.waQuotePack();
  eq(pack.length, 2, 'two of the three can be quoted');
  t.check(pack.some((x) => x.name === 'Cement Tororo'),
    'THE POINT: a product with no photograph of it is still something the shop can be asked the price of');
  t.check(!pack.some((x) => x.name === 'Iron Sheet'),
    'and a product with no price is not — there is nothing to say');

  /* WHAT RIDES, AND NOTHING ELSE. Each field is here because a sentence
     the customer reads needs it. */
  const cement = pack.find((x) => x.name === 'Cement Tororo');
  /* pack and wholesale ride so the server can switch sides for a pack
     buyer the way the counter does -- still nothing about cost. */
  eq(Object.keys(cement).sort().join(','), 'aliases,breaks,companion,key,name,pack,price,tokens,unit,wholesale',
    'the pack carries exactly what a reply needs to be written');
  eq(cement.key, 'P1', 'keyed by the app\'s own stock key, so a match can walk back to the product');
  eq(JSON.stringify(cement.tokens), '["cement","tororo"]', 'with the words that match it');

  /* NO COST, NO MARGIN, NO SUPPLIER. This row is read by a service-role
     function and turned into what a customer reads. */
  const json = JSON.stringify(pack);
  t.check(!/cost|margin|supplier|purchase/i.test(json),
    'and nothing about what the shop paid — the pack is the building\'s edge');
}

/* ---------- 2. their words ride with it ------------------------------ */
{
  /* The words panel promises that saying yes "teaches the suggestion
     here and the automatic reply together". Until the pack, only the
     first half was true: a confirmed word never reached the server at
     all. */
  env.data.presetWaAliases = [{ word: 'simenti', key: 'P1', name: 'Cement Tororo' }];
  const cement = scope.waQuotePack().find((x) => x.key === 'P1');
  eq(JSON.stringify(cement.aliases), '["simenti"]',
    'a word the owner confirmed reaches the server, which is what makes the promise on the screen true');
  env.data.presetWaAliases = [];
}

/* ---------- 3. the companion, resolved once -------------------------- */
{
  companionFixture.set('P1', [{ verbId: 'needs', label: 'River Sand', price: 30000, unit: 'trip', available: true, why: null }]);
  const cement = scope.waQuotePack().find((x) => x.key === 'P1');
  eq(cement.companion.label, 'River Sand', 'the one companion rides in the pack');
  /* WHICH IS WHAT MAKES ONE VOICE POSSIBLE. waQuoteReply is now a pure
     function of its match, so the identical source can run on the
     server against the published row. */
  t.check(scope.waQuoteReply(cement, null).includes('Usually taken with River Sand: UGX 30,000 per trip.'),
    'and the reply is written from the match alone, with no second lookup');
  companionFixture.set('P1', [{ verbId: 'instead', label: 'Hima', price: 31000, unit: 'bag', available: true, why: null }]);
  eq(scope.waQuotePack().find((x) => x.key === 'P1').companion, null,
    'a SUBSTITUTE is not a companion — offering the rival unasked is not the shop\'s voice');
  companionFixture.set('P1', [{ verbId: 'needs', label: 'River Sand', price: null, unit: 'trip', available: true, why: null }]);
  eq(scope.waQuotePack().find((x) => x.key === 'P1').companion, null,
    'and neither is something the shop cannot price');
  companionFixture.clear();
}

/* ---------- 4. the fingerprint: read twice, write once --------------- */
{
  const a = scope.waQuotePack();
  eq(scope.waQuotePackPrint(a), scope.waQuotePackPrint(scope.waQuotePack()),
    'an unchanged pack prints the same, so opening the screen twice is one read and no write');
  sellFixture.set('P1', { price: 33000, unit: 'bag' });
  t.check(scope.waQuotePackPrint(a) !== scope.waQuotePackPrint(scope.waQuotePack()),
    'a price the owner moved prints differently, and gets published');
  sellFixture.set('P1', { price: 32000, unit: 'bag' });
  eq(scope.waQuotePackPrint(scope.waQuotePack()), scope.waQuotePackPrint(a),
    'and moving it back is the same list again');
  t.check(/^\d+-[0-9a-f]+$/.test(scope.waQuotePackPrint(a)),
    'the count leads the print, so a truncated pack can never collide with a whole one');
}

/* ---------- 5. published on entry, and a failure names itself -------- */
{
  t.check(/await waPublishQuotePack\(\);/.test(src) &&
    src.indexOf('await waPublishQuotePack();') < src.indexOf('waRenderChannel();\n  waRenderBroadcasts();'),
    'the pack publishes on entering the screen, BEFORE the panel draws the count it reports');
  t.check(/if\(row && row\.fingerprint === print\)\{/.test(src),
    'and writes only when the contents actually changed');
  t.check(/\.upsert\(\{\s*\n?\s*shop_id: currentShopId, items, item_count: items\.length, fingerprint: print, built_at: at \}\)/.test(src),
    'the row carries the items, the count and when it was built');
  t.check(/waInbox\.pack = \{ count: \(waInbox\.pack && waInbox\.pack\.count\) \|\| 0,/.test(src),
    'a failed publish keeps the LAST GOOD count rather than claiming zero');
  t.check(/The list the system answers from did not refresh\./.test(src),
    'and says so on the screen — a failure names itself');
  /* THE OLD LINE SAID THE CATALOGUE WAS THE LIMIT, and it was, and that
     was the bug. Two counts now, because they are two lists. */
  t.check(/Answerable by the system/.test(src) && /Browsable inside WhatsApp/.test(src),
    'the panel reports both lists rather than one number that meant neither');
  t.check(/anything with a price<\/b>, photo or no\s*\n?\s*photo/.test(src),
    'and says plainly that a photo is not what decides whether a question can be answered');

  /* THE OPT-IN HAS TO DESCRIBE WHAT IT TURNS ON. It said "EXACT
     catalogue matches only, at the published price", which was true of
     the Meta catalogue and is the very limit being removed -- a shop
     reading it would still believe the machine can only speak about
     what it has photographed. */
  t.check(/anything you can sell<\/b>, photo\s*\n?\s*or no photo, not just what is in the browsable catalogue/.test(src),
    'and so does the switch that turns automatic answering on');
  t.check(!/an exact catalogue match/.test(src),
    'nothing on the screen still calls the browsable catalogue the limit of what can be answered');
}

/* ---------- 6. the server reads the pack, and only a fresh one ------- */
{
  t.check(/from\("wa_quote_pack"\)\s*\n?\s*\.select\("items, built_at"\)\.eq\("shop_id", shopId\)/.test(hookSrc),
    'the webhook reads the published pack');
  t.check(/const WA_PACK_STALE_DAYS = 30;/.test(hookSrc),
    'a pack has a shelf life');
  t.check(/if \(!\(age >= 0\) \|\| age > WA_PACK_STALE_DAYS\) \{[\s\S]*?return null;/.test(hookSrc),
    'and past it the server falls SILENT rather than quoting a price the books have moved on from');
  t.check(/console\.log\("wa-webhook: no quote pack published for shop"/.test(hookSrc),
    'a shop opted in with nothing published is named in the log, not silently ignored');
  t.check(/packCache && packCache\.shopId === shopId && Date\.now\(\) - packCache\.at < 5 \* 60 \* 1000/.test(hookSrc),
    'and a burst of questions is not a burst of database reads');
  t.check(!/catalogQuoteItems/.test(hookSrc),
    'the Meta catalog is no longer what decides which questions can be answered');
}

/* ---------- 7. the row is locked like the books --------------------- */
{
  t.check(/create policy "shop members full access" on wa_quote_pack/.test(mig),
    'members can read and refresh it');
  t.check(/create policy "owner writes only" on wa_quote_pack\s*\n\s*as restrictive for insert with check \(is_shop_admin\(shop_id\)\)/.test(mig)
    && /create policy "owner updates only" on wa_quote_pack\s*\n\s*as restrictive for update using \(is_shop_admin\(shop_id\)\) with check \(is_shop_admin\(shop_id\)\)/.test(mig),
    'but only an owner or admin may CHANGE what the machine quotes — the same lock the books carry');
  t.check(/create policy "owner only deletes" on wa_quote_pack\s*\n\s*as restrictive for delete using \(is_shop_owner\(shop_id\)\)/.test(mig),
    'and only the owner may empty it');
  t.check(/create table if not exists wa_quote_pack/.test(mig) && (mig.match(/drop policy if exists/g) || []).length >= 4,
    'safe to run twice, like every migration since 0089');
  t.check(/drop table if exists wa_quote_pack;/.test(mig),
    'with a rollback that restores today in one paste');
}

process.exit(t.done() ? 1 : 0);
