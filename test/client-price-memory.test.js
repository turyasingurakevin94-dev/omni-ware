#!/usr/bin/env node
'use strict';
/*
 * What we charged THIS client for THIS item, last time.
 *
 * A shop quotes the same client the same item twice and says a different
 * number, because the supplier's price moved or a different rep took the
 * second call. The client does not see a supplier's price list -- they
 * see a shop that charged them 160,000 in July and 175,000 in August,
 * and they feel worked over. Nothing on the quote screen knew what we
 * had already told them.
 *
 * Nothing new is stored. Every saved order already holds its lines and
 * its client name; this is a lookup over the orders that exist, read
 * through quoteItemSellPrice -- the same function the printed quotation,
 * the client copy, the WhatsApp message and the invoice all use. What it
 * returns is the number on the paper the client is holding.
 *
 * The one decision that matters: the remembered price LEADS, because
 * holding a price is the whole point -- but never below today's cost. A
 * promise is worth keeping right up to where it costs the shop money,
 * and past that the card says so instead of quietly re-pricing.
 *
 * Run: node test/client-price-memory.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client price memory');
const src = read('index.html');

const order = (over) => Object.assign({
  id: 1, client: { name: 'Musa Hardware' }, savedAt: '2026-07-04T09:00:00Z',
  voided: false, items: [],
}, over);
const line = (over) => Object.assign({
  productId: 'P1', variantIdx: null, productName: 'Tape', unit: 'pc',
  qty: 10, supplierId: 'S1', price: 6250, sellPrice: 7000,
}, over);

const lookup = (savedQuotes, quote) => {
  const data = { savedQuotes, quote: quote || { savedId: null, client: { name: 'Musa Hardware' } }, products: [] };
  return compileScope([
    extractFunction(src, 'lastPriceToClient', 'index.html'),
  ], { data, quoteItemSellPrice: (it) => Number(it.sellPrice) || 0 }, ['lastPriceToClient'])
    .lastPriceToClient;
};

/* ---------- 1. it finds what this client was told -------------------- */
{
  const f = lookup([order({ items: [line()] })]);
  const hit = f('musa hardware', 'P1', null);
  t.check(hit && hit.price === 7000, `the price this client was last given (${hit && hit.price})`);
  t.check(hit && hit.qty === 10 && hit.unit === 'pc' && hit.at === '2026-07-04T09:00:00Z',
    'with how many, in what, and when — the context that makes it a promise rather than a number');

  t.check(f('somebody else', 'P1', null) === null,
    'another client’s price is never shown — this is per client, which is the whole point');
  t.check(f('musa hardware', 'P2', null) === null, 'and per item');
}

/* ---------- 2. the most recent one wins ------------------------------ */
{
  const f = lookup([
    order({ id: 1, savedAt: '2026-05-01T09:00:00Z', items: [line({ sellPrice: 6000 })] }),
    order({ id: 2, savedAt: '2026-07-04T09:00:00Z', items: [line({ sellPrice: 7000 })] }),
    order({ id: 3, savedAt: '2026-06-02T09:00:00Z', items: [line({ sellPrice: 6500 })] }),
  ]);
  t.check(f('musa hardware', 'P1', null).price === 7000,
    'the LAST price wins, whatever order the saved quotes happen to sit in');
}

/* ---------- 3. what must not count ----------------------------------- */
{
  /* A cancelled order is not a promise. The same reasoning
     customerPurchaseHistory already applies to "usually buys". */
  t.check(lookup([order({ voided: true, items: [line()] })])('musa hardware', 'P1', null) === null,
    'a voided order was never a price we gave anybody');
  /* An order is not its own history: re-opening a saved quote must not
     quote it back to itself. */
  t.check(lookup([order({ id: 55, items: [line()] })],
    { savedId: 55, client: { name: 'Musa Hardware' } })('musa hardware', 'P1', null) === null,
    'and the quote being edited is not its own history');
  t.check(lookup([order({ items: [line({ sellPrice: 0 })] })])('musa hardware', 'P1', null) === null,
    'a line with no price on it is not a promise either');
  t.check(lookup([order({ items: [line()] })])('', 'P1', null) === null,
    'and with no client named there is nobody to have promised anything');
}

/* ---------- 4. variants are separate promises ------------------------ */
{
  const f = lookup([order({ items: [
    line({ variantIdx: 0, sellPrice: 7000 }),
    line({ variantIdx: 1, sellPrice: 9000 }),
  ] })]);
  t.check(f('musa hardware', 'P1', 0).price === 7000 && f('musa hardware', 'P1', 1).price === 9000,
    'each variant carries its own price — a 3M tape is not a 5M tape');
  t.check(f('musa hardware', 'P1', null) === null,
    'and the product-level lookup does not collect a variant’s price');
}

/* ---------- 5. the stage leads with it, but never below cost --------- */
/*
 * Source-level, because this is a resolution ORDER inside renderIpStage
 * rather than a function of its own -- and the order is the feature.
 */
{
  const stage = extractFunction(src, 'renderIpStage', 'index.html');
  t.check(/const lastToClient = lastPriceToClient\(clientNameLower, ipProductId, variantIdx\);/.test(stage),
    'the stage asks what this client was last told');
  t.check(/const lastCovers = lastToClient\s*\?\s*lastToClient\.price >= ipLineBuyPrice\(/.test(stage),
    'and whether honouring it would still cover what the item costs today');
  t.check(/if\(lastToClient && lastCovers\) effectiveRecType = 'last';/.test(stage),
    'the remembered price LEADS when it covers cost — holding a price is the feature');
  /* The order matters: this line must come BEFORE the wholesale/retail
     fallbacks, or the recommendation wins and nothing is held. */
  t.check(stage.indexOf("effectiveRecType = 'last';") < stage.indexOf("effectiveRecType = 'wholesale';"),
    'ahead of the fresh recommendation, which is what it is chosen over');
  /* Below cost it is still OFFERED -- the admin may have a reason -- but
     never chosen for them, and it says why. */
  t.check(/\$\{lastCovers\?'':'q-rec-under'\}/.test(stage) && /below today’s cost/.test(stage),
    'below cost it is flagged rather than silently applied');
  t.check(/charging it would sell at a loss/.test(stage),
    'with a title that says what would happen');
  // And the click handler can actually apply it.
  t.check(/type==='last' \? \(lastToClient \? lastToClient\.price : null\)/.test(src),
    'clicking the card sets the price field, like the other two');
  t.check(/effectiveRecType==='last' \? \(lastToClient \? lastToClient\.price : null\)/.test(src),
    'and the field prefills from it when it leads');
}

process.exit(t.done() ? 1 : 0);
