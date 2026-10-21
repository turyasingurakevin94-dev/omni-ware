#!/usr/bin/env node
'use strict';
/*
 * The Sourcing app (sourcing.html): every rule it acts on must be the
 * console's rule, every board of the approved canvas must be a screen, and
 * every screen must draw from the sample shop.
 *
 *   1. Parity. sourcing.html carries its own copies of the rules it reads
 *      -- a supplier's price ladder, whether a supplier has quoted, the
 *      wholesale / retail split of a ladder, the markup rule, how many
 *      DIFFERENT people asked, the same-name match that joins an ask to a
 *      hunt. Each runs here beside the original from index.html on the
 *      same inputs and must agree exactly.
 *   2. The verdict. "Stock it?" uses the console's weights and bands
 *      (sourcing-console.js): 25 demand, 25 margin, 20 price vs rivals, 10
 *      competition, 10 supply, 10 cash payback; 70 / 55 / 40.
 *   3. Who decides. A product Sourcing lists carries no markup of its own
 *      (the Manager's, docs/decision-rights.md); today's share is oldest
 *      first and counts what was confirmed today; a confirmation is logged
 *      for the owner under price.confirm.
 *   4. The canvas. Every board is a screen (the 25, and round 3's Today,
 *      hunt path, Suppliers, One item and Search), the tab screens carry the
 *      shared tab bar, and no sample name from docs/canvas-cast.md is in
 *      the page (they live only in test/fixtures/sourcing-sample-shop.js).
 *   5. Every screen draws, in a real browser, from the sample shop -- when
 *      Playwright is installed (NODE_PATH); otherwise it says so and the
 *      text checks above still run.
 *
 * Run: node test/sourcing-app.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('sourcing app');
// A one-line helper (`function f(x){ ... }` on one line) is that line;
// extractFunction looks for a body that opens at the end of a line and
// would run on into the next function.
function fnOf(src, name, where) {
  const line = src.split('\n').find(l => new RegExp('^(?:async\\s+)?function\\s+' + name + '\\s*\\(').test(l));
  if (line && /\}\s*$/.test(line) && (line.match(/\{/g) || []).length === (line.match(/\}/g) || []).length) return line;
  return extractFunction(src, name, where);
}
const html = read('sourcing.html');
const admin = read('index.html');
const consoleSrc = read('sourcing-console.js');

/* ---------------- 1. parity with the console ---------------- */
{
  const mine = compileScope(['candidateTiers', 'candidateHasPrice', 'deriveWholesaleRetail'].map(n => fnOf(html, n, 'sourcing.html')), {}, ['candidateTiers', 'candidateHasPrice', 'deriveWholesaleRetail']);
  const theirs = compileScope(['candidateTiers', 'candidateVariantOverrides', 'candidateHasPrice', 'deriveWholesaleRetail'].map(n => fnOf(admin, n, 'index.html')), {}, ['candidateTiers', 'candidateHasPrice', 'deriveWholesaleRetail']);
  const cands = [
    { tiers: [{ minQty: 10, price: 11500 }, { minQty: 1, price: 12500 }] },
    { tiers: [{ minQty: 1, price: 0 }] },
    { quotedPrice: 15000, moq: 5 },
    { quotedPrice: 0 },
    { variantOverrides: [[{ minQty: 1, price: 900 }]] },
    {},
  ];
  cands.forEach((c, i) => {
    const a = mine.candidateTiers(c).map(x => [x.minQty, x.price]), b = theirs.candidateTiers(c).map(x => [x.minQty, x.price]);
    t.check(JSON.stringify(a) === JSON.stringify(b), `candidateTiers agrees with the console (case ${i}: ${JSON.stringify(a)})`);
    t.check(mine.candidateHasPrice(c) === theirs.candidateHasPrice(c), `candidateHasPrice agrees (case ${i})`);
  });
  [[[{ minQty: 1, price: 500 }, { minQty: 25, price: 450 }], 25], [[{ minQty: 1, price: 500 }], 0], [[{ minQty: 50, price: 4800 }], 25]].forEach(([tiers, pq], i) => {
    t.check(JSON.stringify(mine.deriveWholesaleRetail(tiers, pq)) === JSON.stringify(theirs.deriveWholesaleRetail(tiers, pq)), `deriveWholesaleRetail agrees (case ${i})`);
  });
}
{
  // The markup rule: variant, then product, then the shop's default.
  const preset = { wholesaleType: 'percent', wholesaleValue: 25, retailType: 'percent', retailValue: 35 };
  const mine = compileScope([fnOf(html, 'effectiveMarkupRule', 'sourcing.html')], { D: () => ({ presets: { defaultMarkup: preset } }) }, ['effectiveMarkupRule']);
  const theirs = compileScope([extractFunction(admin, 'effectiveMarkupRule', 'index.html')], { data: { presetDefaultMarkup: preset } }, ['effectiveMarkupRule']);
  const products = [
    { wholesaleMarkupValue: 0, retailMarkupValue: 0, variants: [] },
    { wholesaleMarkupType: 'percent', wholesaleMarkupValue: 30, variants: [] },
    { wholesaleMarkupValue: 0, variants: [{ wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 500 }] },
  ];
  products.forEach((p, i) => ['wholesale', 'retail'].forEach(kind => {
    t.check(JSON.stringify(mine.effectiveMarkupRule(p, i === 2 ? 0 : null, kind)) === JSON.stringify(theirs.effectiveMarkupRule(p, i === 2 ? 0 : null, kind)), `effectiveMarkupRule agrees (product ${i}, ${kind})`);
  }));
}
{
  // How many DIFFERENT people asked, and the same-name join.
  const customers = [{ id: 'C1', name: 'Kato' }];
  const lead = { requests: [{ customerId: 'C1' }, { customerId: 'C1' }, { phone: '0772 100 100' }, { phone: '+256772100100' }, { customerName: 'Walk-in Ann' }, {}] };
  const mine = compileScope(['phoneDigits', 'sourcingPhoneKey', 'reqIsClient', 'leadDistinctAskers'].map(n => fnOf(html, n, 'sourcing.html')), {}, ['leadDistinctAskers']);
  const theirs = compileScope(['sourcingPhoneKey', 'leadDistinctAskers'].map(n => fnOf(admin, n, 'index.html')), { data: { customers } }, ['leadDistinctAskers']);
  t.check(mine.leadDistinctAskers(lead) === theirs.leadDistinctAskers(lead), `distinct askers agree with the console (${mine.leadDistinctAskers(lead)})`);
  const leads = [{ id: 'A', name: 'Valley flashing 3m' }, { id: 'B', name: 'Gutter bracket PVC', voided: true }, { id: 'C', name: 'Gutter bracket PVC' }];
  const mineF = compileScope(['searchTokens', 'findLeadByText'].map(n => fnOf(html, n, 'sourcing.html')), { D: () => ({ leads }), leadById: id => leads.find(l => l.id === id) }, ['findLeadByText']);
  const theirsF = compileScope(['searchTokens', 'sourcingLeadsAll', 'findSourcingLeadByText'].map(n => fnOf(admin, n, 'index.html')), { data: { sourcingLeads: leads } }, ['findSourcingLeadByText']);
  ['valley flashing', 'gutter bracket', 'PVC bracket for gutter', 'cement'].forEach(q => {
    const a = mineF.findLeadByText(q), b = theirsF.findSourcingLeadByText(q);
    t.check((a && a.id) === (b && b.id), `an ask for "${q}" joins the same hunt as on the console (${a ? a.id : 'none'})`);
  });
}

/* ---------------- 2. the verdict: the console's weights and bands ---------------- */
{
  const want = ["label: 'Demand', w: 25", "label: 'Margin', w: 25", "label: 'Price vs rivals', w: 20", "label: 'Competition', w: 10", "label: 'Supply', w: 10", "label: 'Cash payback', w: 10"];
  want.forEach(w => {
    t.check(consoleSrc.includes(w), `the console still weighs ${w}`);
    t.check(html.includes(w), `the app weighs ${w} the same`);
  });
  ['total >= 70 ? [\'Stock it\'', 'total >= 55 ? [\'Stock a small first batch\'', 'total >= 40 ? [\'Special order only\''].forEach(b => {
    t.check(consoleSrc.includes(b) && html.includes(b), `the verdict band ${b.split('?')[0].trim()} is the console's`);
  });
}

/* ---------------- 3. who decides ---------------- */
{
  const list = extractFunction(html, 'listLead', 'sourcing.html');
  t.check(/wholesale_markup_value: 0, retail_markup_type: 'percent', retail_markup_value: 0/.test(list), 'a product Sourcing lists carries no markup of its own: the shop default applies until the Manager sets one');
  t.check(!/markup_value: (?!0)/.test(list), 'listing never writes a markup value');
  t.check(/logDecision\('product\.edit'/.test(list), 'listing is logged for the owner under product.edit');
  const confirm = extractFunction(html, 'confirmPrice', 'sourcing.html');
  t.check(/priceSource: 'confirmed'/.test(confirm) && /logDecision\('price\.confirm'/.test(confirm), 'a confirmation stamps the row confirmed and goes in the owner\'s log under price.confirm');
  t.check(!/markup\.set/.test(html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')) || !/logDecision\('markup\.set'/.test(html), 'the app never decides a markup (markup.set is the Manager\'s)');

  // Today's share: strictly oldest first, today's confirmations counted.
  const DAY = 86400000, now = Date.now();
  const iso = (d) => new Date(now - d * DAY).toISOString().slice(0, 10);
  const prices = [
    { id: 1, productId: 'P1', supplierId: 'S1', date: iso(20), priceSource: 'manual' },
    { id: 2, productId: 'P2', supplierId: 'S1', date: null, priceSource: 'manual' },
    { id: 3, productId: 'P3', supplierId: 'S1', date: iso(58), priceSource: 'manual' },
    { id: 4, productId: 'P4', supplierId: 'S1', date: iso(0), priceSource: 'confirmed' },
    { id: 5, productId: 'P5', supplierId: 'S1', date: iso(3), priceSource: 'manual' },
    { id: 6, productId: 'P6', supplierId: 'S1', date: iso(40), priceSource: 'manual' },
  ];
  const shop = { prices, products: prices.map(p => ({ id: p.productId, name: p.productId })), suppliers: [{ id: 'S1', name: 'S1' }], log: [], presets: { priceReview: { perDay: 3, staleDays: 14 } } };
  const names = ['todayISO', 'msOf', 'daysSince', 'isoOf', 'initials', 'stockKey', 'priceReviewPerDay', 'priceStaleDays', 'priceAgeDays', 'confirmedToday', 'todaysShare'];
  const scope = compileScope(names.map(n => fnOf(html, n, 'sourcing.html')), {
    D: () => shop, DAY, demandKeys: () => new Set(prices.map(p => p.productId)),
    productById: id => shop.products.find(p => p.id === id), supplierById: id => shop.suppliers.find(s => s.id === id),
  }, ['todaysShare']);
  const share = scope.todaysShare();
  t.check(share.perDay === 3 && share.done === 1 && share.left === 2, `the owner's number a day, with today's confirmation counted (${share.done} of ${share.perDay}, ${share.left} left)`);
  t.check(JSON.stringify(share.today.map(x => x.r.id)) === JSON.stringify([4, 2, 3]), `today's list: the done one, then the undated, then the oldest (${share.today.map(x => x.r.id)})`);
  t.check(JSON.stringify(share.next.map(x => x.r.id)) === JSON.stringify([6, 1]), `next in line keeps the order and leaves fresh prices out (${share.next.map(x => x.r.id)})`);
}

/* ---------------- 4. the canvas ---------------- */
const BOARDS = ['Main', 'Asks', 'AsksDropped', 'SearchMiss', 'NewAsk', 'HuntDropped', 'Hunts', 'Prices', 'Hunt', 'AskSuppliers', 'Quote', 'Decide', 'Sample',
  'MarketRun', 'AtShop', 'NewSupplier', 'RunDone', 'Spotted', 'Supplier', 'PriceIt', 'AddItem', 'Landed', 'Announce', 'TellAsked', 'Dropped', 'Profile',
  // Round 3: the hunt's quotes side by side moved to Quotes (Hunt is its way to the shelf).
  'Quotes', 'Suppliers', 'Item', 'Search',
  // v2: look-alike suppliers merged, and prices that look wrong.
  'Twins', 'Fix'];
BOARDS.forEach(b => t.check(html.includes(`SCREENS.${b} = {`), `the ${b} board is a screen`));
['Main', 'Hunts', 'Prices', 'Suppliers'].forEach(b => {
  const start = html.indexOf(`SCREENS.${b} = {`), end = html.indexOf('SCREENS.', start + 10);
  t.check(/<nav aria-label="Sourcing"|\$\{V2NAV\('/.test(html.slice(start, end > 0 ? end : undefined)), `${b} carries the shared tab bar`);
});
{
  const code = html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  const cast = ['Moses', 'Lubega', 'Okello', 'Ruth', 'Nakato', 'Kato', 'Mukasa', 'Nansana', 'Kiseka', 'Namanve', 'Katwe', 'Owino', 'Ndeeba', 'Nakawa', 'Lubowa', 'Kyaligonza', 'Aisha', 'Sserwadda', 'Kikuubo', 'Nakasero', 'Kisenyi'];
  const found = cast.filter(n => new RegExp('\\b' + n + '\\b').test(code));
  t.check(found.length === 0, `no sample name from the canvas cast is in the page (${found.join(', ') || 'none'})`);
}
t.check(/supabase\/functions|next_row_id_blocks/.test(html) && html.includes("sb.rpc('next_entity_id'"), 'ids come from the server allocators, as the other apps');

/* ---------------- 4b. round 3: what next, and the item page ---------------- */
{
  const steps = extractFunction(html, 'huntSteps', 'sourcing.html');
  t.check(/leadResearch\(l\)\.meta/.test(steps) && /hold/.test(steps) && /sample/.test(steps) && !/saveLead|sb\.from/.test(steps), 'a hunt\'s seven steps are read from the record (its hold and sample), never written');
  const jobs = extractFunction(html, 'nextJobs', 'sourcing.html');
  t.check(/todaysShare\(\)/.test(jobs) && /leadTold\(l\)/.test(jobs) && /bNext\(l\)/.test(jobs) && /nx\.lapsed/.test(jobs) && /fixesOpen\(\)/.test(jobs), 'Today\'s next jobs come from each hunt\'s one next move (bNext, lapsed quotes folded in), today\'s prices, clients to tell and the Buyer\'s fixes');
  t.check(!/daysSince\(l\.graduatedAt\) <= 30/.test(jobs) && !/const lapsing/.test(jobs), 'Round 6: a client still to tell reaches Today however long ago; lapsed quotes are never a second row');
  t.check(/quoteLeft\(f\.best\) < 0/.test(extractFunction(html, 'bNext', 'sourcing.html')), 'Round 6: a lapsed best quote is the hunt\'s next move everywhere');
  const edit = extractFunction(html, 'saveProductDetails', 'sourcing.html');
  t.check(!/markup/i.test(edit.replace(/\/\/.*$/gm, '')) && /logDecision\('product\.edit'/.test(edit), 'editing an item\'s details never writes a markup, and is logged under product.edit');
}

/* ---------------- 4c. the 19 Oct 2026 test: fixes 16 and 17 ---------------- */
{
  // Fix 16: Asks > From orders keeps the tab bar, its dock sits above it,
  // and a found hunt with no price is never "Found · 0 quotes".
  const start = html.indexOf('SCREENS.AsksDropped = {'), end = html.indexOf('SCREENS.AtShop = {', start);
  const scr = html.slice(start, end);
  t.check(/<nav aria-label="Sourcing"|\$\{V2NAV\('/.test(scr) && /nav: navVals\(\)/.test(scr), 'From orders carries the shared tab bar (fix 16)');
  t.check(/position: absolute; left: 0; right: 0; bottom: calc\(86px \+ var\(--safe-b\)\); z-index: 20; background: #16203C/.test(scr) && !/position: absolute; left: 0; right: 0; bottom: 0; background: #16203C/.test(scr), 'the "All being hunted" dock sits above the tab bar, never over it (fix 16)');
  const pill = (bg, ink) => bg + ink;
  const mk = (lead, quotes) => compileScope([fnOf(html, 'adState', 'sourcing.html')], {
    leadSuppliers: l => l.candidates, candidateHasPrice: c => !!c.price, leadFacts: l => ({ supplier: l.candidates.length > 0, importer: false }),
    plural: (n, w) => n + ' ' + (n === 1 ? w : w + 's'), leadDaysInStage: () => 2,
  }, ['adState']).adState;
  const adState = mk();
  const none = adState({ status: 'sourced', candidates: [{ name: 'A' }] })[0], two = adState({ status: 'sourced', candidates: [{ price: 1 }, { price: 2 }] })[0];
  t.check(!/0 quotes/.test(none) && /no price yet/.test(none) && two === 'Found · 2 quotes', `a found hunt with no price says so, not "0 quotes" ("${none}" / "${two}") (fix 16)`);

  // Fix 17: a hunt is linked to the catalogue product it names, plural or not.
  const key = compileScope([fnOf(html, 'catalogueKey', 'sourcing.html')], {}, ['catalogueKey']).catalogueKey;
  t.check(key('Bathroom Indicator Locks') === key('Bathroom indicator lock') && key('Butterfly Hinges') === key('Butterfly hinge') && key('Boxes of nails') === key('Box of nail'), 'a hunt\'s name matches its catalogue product, plural or singular (fix 17)');
  t.check(key('Ridge cap G30 · red') !== key('Ridge cap G28') && key('PPR pipe 25mm · 4m') !== key('PPR pipe 20mm · 4m') && key('Glass') === 'glass', 'a different size or gauge is never the same product (fix 17)');
  const names = ['msOf', 'isoOf', 'priceRowTiers', 'lineLanded', 'leadSuppliers', 'catalogueKey', 'leadCatalogueProduct', 'leadCatalogueEvidence'];
  const day = d => { const x = new Date(Date.now() - d * 86400000); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const shop = {
    products: [{ id: 'P7', name: 'Bathroom Indicator Lock' }, { id: 'P8', name: 'Butterfly Hinge' }, { id: 'P9', name: 'Door stopper' }],
    suppliers: [{ id: 'S9', name: 'Maria Building Materials' }, { id: 'S3', name: 'Other' }],
    prices: [{ id: 70, productId: 'P7', variantIdx: null, supplierId: 'S9', tiers: [{ minQty: 1, price: 2300 }], date: day(30) },
      { id: 71, productId: 'P9', variantIdx: null, supplierId: 'S3', tiers: [{ minQty: 1, price: 900 }], date: day(30) },
      { id: 72, productId: 'P8', variantIdx: null, supplierId: 'S3', tiers: [{ minQty: 1, price: 500 }], date: day(9), outOfStock: true }],
    quotes: [{ id: 541, items: [{ productId: 'P8', supplierId: 'S9', qty: 6, receivedQty: 6, receivedAt: new Date().toISOString(), receivedPrice: 1800 }, { productId: 'P9', supplierId: 'S3', qty: 2, receivedQty: 0 }],
      supplierConfirms: { S3: { state: 'none' } } }],
  };
  const sc = compileScope(names.map(n => fnOf(html, n, 'sourcing.html')), {
    D: () => shop, productById: id => shop.products.find(p => p.id === id), supplierById: id => shop.suppliers.find(s => s.id === id),
    adTried: q => Object.entries((q && q.supplierConfirms) || {}).filter(([, r]) => r.state !== 'confirmed').map(([sid]) => ({ sid })),
  }, ['leadCatalogueProduct', 'leadCatalogueEvidence']);
  const lock = { id: 'L1', name: 'Bathroom Indicator Locks', status: 'asked', requests: [], candidates: [] };
  const hinge = { id: 'L2', name: 'Butterfly Hinges', status: 'asked', requests: [], candidates: [] };
  const p7 = sc.leadCatalogueProduct(lock), p8 = sc.leadCatalogueProduct(hinge);
  t.check(p7 && p7.id === 'P7' && p8 && p8.id === 'P8', `the 54-day hunts link to their products (${p7 && p7.id}, ${p8 && p8.id}) (fix 17)`);
  const evL = sc.leadCatalogueEvidence(lock, p7), evH = sc.leadCatalogueEvidence(hinge, p8);
  t.check(evL.length === 1 && evL[0].sid === 'S9' && evL[0].how === 'price' && evL[0].tiers[0].price === 2300, 'a supplier price on the list is evidence: Maria has it at 2,300 (fix 17)');
  t.check(evH.length === 1 && evH[0].sid === 'S9' && evH[0].how === 'bought' && evH[0].tiers[0].price === 1800, 'a purchase that landed is evidence, and an out-of-stock row is not (fix 17)');
  const dropped = { id: 'L3', name: 'Door stopper', status: 'asked', requests: [{ source: 'dropped', orderId: 541, at: new Date(Date.now() - 86400000).toISOString(), productId: 'P9' }], candidates: [] };
  t.check(sc.leadCatalogueEvidence(dropped, sc.leadCatalogueProduct(dropped)).length === 0, 'a line dropped at Checking is not moved on by a price from before the drop, nor by a supplier who said no (fix 17)');
  const run = extractFunction(html, 'huntsFromCatalogue', 'sourcing.html');
  t.check(/hasTask\('sourcing\.lead'\)/.test(run) && /S\.busy/.test(run) && /stageGateBlock\(l, to\)/.test(run) && /logDecision\('sourcing\.lead'/.test(run), 'moving a hunt on from the books keeps the gates, waits for any save, and is logged for the owner under sourcing.lead (fix 17)');
  t.check(/huntsFromCatalogue\(\)/.test(extractFunction(html, 'boot', 'sourcing.html')) && /loadAll\(\)\.then\(\(\) => \{ A\.redraw\(\); huntsFromCatalogue\(\); \}\)/.test(html), 'it runs after every load (fix 17)');
  const list = extractFunction(html, 'listLead', 'sourcing.html');
  t.check(/l\.productId && productById\(l\.productId\)/.test(list) && /c\.priceRowId/.test(list), 'listing a linked hunt adds to that product, and leaves a price already on the list as it is (fix 17)');
}

/* ---------------- 5. every screen draws ---------------- */
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (_e) {}
if (!chromium) {
  console.log('skip   - Playwright is not installed here, so the screens were not drawn (set NODE_PATH to where it is)');
  process.exit(t.done() ? 1 : 0);
}
(async () => {
  const fake = fs.readFileSync(path.join(__dirname, 'fixtures', 'sourcing-sample-shop.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'fixtures', 'sourcing-fake-supabase.js'), 'utf8');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/supabase.js', r => r.fulfill({ contentType: 'application/javascript', body: fake }));
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  await page.goto('file://' + path.join(__dirname, '..', 'sourcing.html'));
  await page.waitForFunction(() => window.SX && window.SX.started, null, { timeout: 10000 });
  for (const b of BOARDS) {
    for (const props of [null, b === 'Hunt' || b === 'Quotes' || b === 'PriceIt' || b === 'Decide' ? { leadId: 'SRC-007' } : b === 'Search' ? { q: 'a' } : null].filter((x, i) => i === 0 || x)) {
      await page.evaluate(([n, p]) => { if (['Main', 'Hunts', 'Prices', 'Suppliers'].includes(n) && !p) A.tab(n); else { A.tab('Main'); A.go(n, p || {}); } }, [b, props]);
      await page.waitForTimeout(150);
      const res = await page.evaluate(() => { const h = document.getElementById('sx_screen'); return { err: h.getAttribute('data-sv-error'), screen: h.getAttribute('data-screen'), text: h.innerText.length, wide: h.scrollWidth > h.clientWidth + 1 }; });
      t.check(!res.err && res.screen === b && res.text > 20, `${b}${props ? ' ' + JSON.stringify(props) : ''} draws from the sample shop${res.err ? ' — ' + res.err : ''}`);
      t.check(!res.wide, `${b} fits the phone's width`);
    }
  }
  t.check(errors.length === 0, `no script errors while drawing (${errors.slice(0, 3).join(' | ')})`);
  // Round 5: the searches that missed group into one want, in Chances and on its own sheet.
  const miss = await page.evaluate(() => {
    const ws = smWants().filter(smShown);
    A.tab('Main'); A.go('SearchMiss', {});
    const h = document.getElementById('sx_screen');
    return { wants: ws.map(w => w.label + ':' + w.misses.length), text: h.innerText };
  });
  await page.waitForTimeout(150);
  const missText = await page.evaluate(() => document.getElementById('sx_screen').innerText);
  t.check(miss.wants.length === 1 && /:7$/.test(miss.wants[0]), `wall plug, rawl plug, plug 6mm and wallplug 6 are one want of 7; pvc glue (one person) and blue gloss (once) wait (${miss.wants.join(', ')})`);
  t.check(/rawl plug 6/.test(missText) && /Hunt it/.test(missText) && /Not ours/.test(missText), 'the want shows what they typed, Hunt it and Not ours');
  // Log a price: "Someone else" is a picker sheet (search, likely first), never the phone's long list.
  await page.evaluate(() => { A.tab('Hunts'); A.go('Quote', { leadId: 'SRC-007' }); });
  await page.waitForTimeout(200);
  const picker = await page.evaluate(async () => {
    const h = document.getElementById('sx_screen'), noSelect = !h.querySelector('select');
    h.querySelector('button[aria-haspopup="dialog"]').click(); await new Promise(r => setTimeout(r, 200));
    const dlg = h.querySelector('[role=dialog]'), n = dlg ? dlg.querySelectorAll('button[aria-pressed]').length : 0;
    const inp = dlg.querySelector('input'); inp.value = 'kiseka'; inp.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 200));
    const hits = [...h.querySelectorAll('[role=dialog] button[aria-pressed]')]; const one = hits.length;
    await new Promise(r => setTimeout(r, 450)); hits[0].click(); await new Promise(r => setTimeout(r, 200));
    return { noSelect, n, one, closed: !h.querySelector('[role=dialog]'), save: (h.querySelector('[data-why]') || {}).textContent };
  });
  t.check(picker.noSelect && picker.n >= 3 && picker.one === 1 && picker.closed && /Kiseka/.test(picker.save), `Log a price: Someone else opens a searchable picker and picks (${JSON.stringify(picker)})`);
  // Round 6 (the click-through review): one move per hunt, numbers that agree, nothing lost.
  const r6 = await page.evaluate(async () => {
    const out = {};
    const jobs = nextJobs().filter(j => j.lead);
    const ids = jobs.map(j => j.lead.id);
    out.onePerHunt = new Set(ids).size === ids.length;
    out.sameMove = jobs.filter(j => j.kind !== 'chase' && j.kind !== 'tell').every(j => j.verb === bNext(j.lead).word + ':');
    out.noLapseRows = !nextJobs().some(j => j.kind === 'lapse' && !j.lead);
    out.spotted = reqIsClient({ source: 'spotted' }) === false && reqIsClient({ source: 'spotted', customerName: 'Ann' }) === true && reqIsClient({ source: 'sales' }) === true;
    out.near = dNameNear('Maria Building', 'Maria Building Materials') && !dNameNear('Mariam Traders', 'Maria Building Materials');
    out.shop = (() => { const was = S.shopName; S.shopName = 'Omni-ware (old records)'; const w = publicShopName(); S.shopName = was; return w; })();
    out.comparable = priceComparable({ unit: 'ctn' }) === false && priceComparable({ unit: 'ctn', packQty: 12, packUnit: 'carton' }) && priceComparable({ unit: 'pc' });
    // A "new" price typed the same is a check: the owner's log says "still".
    const r = D().prices.find(x => priceRowTiers(x).length);
    window.SX_WRITES.length = 0;
    await confirmPrice(r, priceRowTiers(r).map(t => ({ ...t })), 'phone');
    const logw = window.SX_WRITES.find(w => w.table === 'decision_log');
    out.sameLog = logw ? String((logw.row && (logw.row.what || (Array.isArray(logw.row) && logw.row[0].what))) || '') : '';
    return out;
  });
  t.check(r6.onePerHunt && r6.sameMove, `Round 6: Today has one row per hunt, with the same move as the Pipeline and the hunt (${JSON.stringify(r6)})`);
  t.check(r6.noLapseRows, 'Round 6: a lapsed quote is never a second Today row');
  t.check(r6.spotted, 'Round 6: a hunt started from something seen counts no client');
  t.check(r6.near, 'Round 6: "Maria Building" is caught as Maria Building Materials; "Mariam Traders" is not');
  t.check(r6.shop === 'Omni-ware', `Round 6: suppliers read the shop's name without "(old records)" (${r6.shop})`);
  t.check(r6.comparable, 'Round 6: a carton price with no count is never "cheapest"');
  t.check(/still/.test(r6.sameLog) && !/→/.test(r6.sameLog), `Round 6: the same figure saved as "new" logs a check, not a change (${r6.sameLog})`);
  // Decide: no weights, one name for "per client".
  await page.evaluate(() => { A.tab('Hunts'); A.go('Decide', { leadId: 'SRC-007' }); });
  await page.waitForTimeout(200);
  const dec = await page.evaluate(() => document.getElementById('sx_screen').innerText);
  t.check(!/×\d/.test(dec) && !/Special order/.test(dec) && !/Sure: \w+ · \d/.test(dec), 'Round 6: Decide shows no weights, no "Special order", no bare "sure %"');
  // Log a price: closing after typing asks first.
  await page.evaluate(() => { A.tab('Hunts'); A.go('Hunt', { leadId: 'SRC-007' }); A.go('Quote', { leadId: 'SRC-007' }); });
  await page.waitForTimeout(200);
  const leave = await page.evaluate(async () => {
    const h = document.getElementById('sx_screen');
    mounted.comp.setState({ price: 1234 }); await new Promise(r => setTimeout(r, 100));
    h.querySelector('a[aria-label="Close"]').click(); await new Promise(r => setTimeout(r, 150));
    const asked = !!h.querySelector('[role=dialog][aria-label="Leave without saving?"]') && h.getAttribute('data-screen') === 'Quote';
    [...h.querySelectorAll('button')].find(b => /Discard it/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 150));
    return { asked, after: document.getElementById('sx_screen').getAttribute('data-screen') };
  });
  t.check(leave.asked && leave.after === 'Hunt', `Round 6: Log a price asks before throwing a typed price away, then goes back where it came from (${JSON.stringify(leave)})`);
  // ✕ goes back where it was opened from, even when drawn towards a tab.
  const backTo = await page.evaluate(async () => {
    A.tab('Main'); const sid = D().suppliers[0].id; A.go('Supplier', { supplierId: sid }); await new Promise(r => setTimeout(r, 120));
    const a = [...document.querySelectorAll('#sx_screen a[data-back]')][0]; a.click(); await new Promise(r => setTimeout(r, 120));
    return document.getElementById('sx_screen').getAttribute('data-screen');
  });
  t.check(backTo === 'Main', `Round 6: a supplier opened from Today closes back to Today (${backTo})`);
  // One write, end to end: "Still right" on today's share confirms the row and logs it.
  await page.evaluate(() => A.tab('Prices'));
  await page.waitForTimeout(200);
  const wrote = await page.evaluate(async () => {
    const share = todaysShare(); const open = share.today.find(x => !x.done);
    if (!open) return 'nothing open';
    window.SX_WRITES.length = 0;
    await confirmPrice(open.r, null, 'in person');
    return window.SX_WRITES.map(w => w.table + ':' + w.op).join(',');
  });
  t.check(/prices:upsert/.test(wrote) && /decision_log:insert/.test(wrote), `"Still right" writes the price row and the owner's log line (${wrote})`);
  // Fix 16 in the browser: From orders shows the tab bar, the dock above it.
  await page.evaluate(() => { A.tab('Asks'); A.go('AsksDropped', {}); });
  await page.waitForTimeout(200);
  const dock = await page.evaluate(() => {
    const h = document.getElementById('sx_screen'), nav = h.querySelector('nav[aria-label="Sourcing"]');
    const bar = [...h.querySelectorAll('div')].find(d => /being hunted|not hunted yet/.test(d.textContent) && getComputedStyle(d).position === 'absolute');
    if (!nav || !bar) return { nav: !!nav, bar: !!bar };
    return { nav: true, bar: true, gap: nav.getBoundingClientRect().top - bar.getBoundingClientRect().bottom, quotes0: /0 quotes/.test(h.innerText) };
  });
  t.check(dock.nav && dock.bar && dock.gap >= -1, `From orders: the tab bar shows and the dock ends where it starts (${JSON.stringify(dock)})`);
  t.check(!dock.quotes0, 'From orders never says "0 quotes"');
  // Fix 17 in the browser: a hunt for a product we sell, with a supplier
  // price on file, moves to Priced and is linked; one bought today too.
  const moved = await page.evaluate(async () => {
    const d = A.data, now = new Date().toISOString();
    d.products.push({ id: 'P077', name: 'Bathroom indicator lock', variants: [] }, { id: 'P078', name: 'Butterfly hinge', variants: [] });
    d.prices.push({ id: 7701, productId: 'P077', variantIdx: null, supplierId: 'S002', tiers: [{ minQty: 1, price: 2300 }], date: now.slice(0, 10), unit: 'pc', packUnit: '', packQty: 0 });
    d.quotes.push({ id: 2541, status: 'delivered', voided: false, items: [{ productId: 'P078', supplierId: 'S002', qty: 6, receivedQty: 6, receivedAt: now, receivedPrice: 1800 }] });
    d.leads.push({ id: 'SRC-077', name: 'Bathroom Indicator Locks', status: 'asked', stageEnteredAt: Date.now() - 54 * 86400000, createdAt: now, requests: [], candidates: [] },
      { id: 'SRC-078', name: 'Butterfly Hinges', status: 'looking', stageEnteredAt: Date.now() - 54 * 86400000, createdAt: now, requests: [], candidates: [] });
    window.SX_WRITES.length = 0;
    const n = await huntsFromCatalogue();
    const a = d.leads.find(l => l.id === 'SRC-077'), b = d.leads.find(l => l.id === 'SRC-078');
    const again = await huntsFromCatalogue();
    return { n, again, a: [a.status, a.productId], b: [b.status, b.productId], writes: window.SX_WRITES.map(w => w.table + ':' + w.op).join(','), list: addItemExisting(a) && addItemExisting(a).id };
  });
  t.check(moved.n === 2 && moved.a.join() === 'priced,P077' && moved.b.join() === 'priced,P078', `hunts for products we sell link and move to Priced from the price list and from a purchase (${JSON.stringify(moved)})`);
  t.check(/sourcing_leads:upsert/.test(moved.writes) && /decision_log:insert/.test(moved.writes) && moved.again === 0, `each move is saved and logged once (${moved.writes}; again ${moved.again})`);
  t.check(moved.list === 'P077', 'putting a linked hunt in the catalogue adds to the product we already sell');
  await browser.close();
  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
