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
  const mine = compileScope(['phoneDigits', 'sourcingPhoneKey', 'leadDistinctAskers'].map(n => fnOf(html, n, 'sourcing.html')), {}, ['leadDistinctAskers']);
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
const BOARDS = ['Main', 'Asks', 'AsksDropped', 'NewAsk', 'HuntDropped', 'Hunts', 'Prices', 'Hunt', 'AskSuppliers', 'Quote', 'Decide', 'Sample',
  'MarketRun', 'AtShop', 'NewSupplier', 'RunDone', 'Spotted', 'Supplier', 'PriceIt', 'AddItem', 'Landed', 'Announce', 'TellAsked', 'Dropped', 'Profile',
  // Round 3: the hunt's quotes side by side moved to Quotes (Hunt is its way to the shelf).
  'Quotes', 'Suppliers', 'Item', 'Search'];
BOARDS.forEach(b => t.check(html.includes(`SCREENS.${b} = {`), `the ${b} board is a screen`));
['Main', 'Asks', 'Hunts', 'Prices'].forEach(b => {
  const start = html.indexOf(`SCREENS.${b} = {`), end = html.indexOf('SCREENS.', start + 10);
  t.check(/<nav aria-label="Sourcing"/.test(html.slice(start, end > 0 ? end : undefined)), `${b} carries the shared tab bar`);
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
  t.check(/todaysShare\(\)/.test(jobs) && /leadTold\(l\)/.test(jobs) && /quoteLeft\(c\)/.test(jobs) && /fixesOpen\(\)/.test(jobs), 'Today\'s next jobs come from the hunts, today\'s prices, clients to tell, lapsing quotes and the Buyer\'s fixes');
  const edit = extractFunction(html, 'saveProductDetails', 'sourcing.html');
  t.check(!/markup/i.test(edit.replace(/\/\/.*$/gm, '')) && /logDecision\('product\.edit'/.test(edit), 'editing an item\'s details never writes a markup, and is logged under product.edit');
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
      await page.evaluate(([n, p]) => { if (['Main', 'Asks', 'Hunts', 'Prices'].includes(n) && !p) A.tab(n); else { A.tab('Main'); A.go(n, p || {}); } }, [b, props]);
      await page.waitForTimeout(150);
      const res = await page.evaluate(() => { const h = document.getElementById('sx_screen'); return { err: h.getAttribute('data-sv-error'), screen: h.getAttribute('data-screen'), text: h.innerText.length, wide: h.scrollWidth > h.clientWidth + 1 }; });
      t.check(!res.err && res.screen === b && res.text > 20, `${b}${props ? ' ' + JSON.stringify(props) : ''} draws from the sample shop${res.err ? ' — ' + res.err : ''}`);
      t.check(!res.wide, `${b} fits the phone's width`);
    }
  }
  t.check(errors.length === 0, `no script errors while drawing (${errors.slice(0, 3).join(' | ')})`);
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
  await browser.close();
  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
