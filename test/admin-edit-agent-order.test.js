#!/usr/bin/env node
'use strict';
/*
 * Editing an agent's order did nothing at all.
 *
 * Every per-line control in the quote editor resolves its row through
 * lineId: the remove button, the quantity, the price, the supplier picker.
 * renderQuoteItems() writes it as data-line and the handlers read it back.
 *
 * Only the admin's own quote builder issues one -- data.nextQuoteLineId++
 * as the line is added. agent-submit-order writes a line without it, and
 * loadSavedQuote() copied the lines through verbatim. So an agent's order
 * opened for editing rendered every row with data-line="undefined": one key
 * shared by all of them.
 *
 * The screen looked completely normal. Removing a line removed nothing,
 * changing a quantity changed nothing. Found while checking the variant
 * that was missing from the same orders -- the report was "I tried to edit
 * the order", and the editing itself was inert.
 *
 * Run: node test/admin-edit-agent-order.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin edit agent order');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { savedQuotes: [], quote: { client: {}, items: [], savedId: null }, nextQuoteLineId: 1 };
let loadSavedQuote = null, err = null;
try {
  ({ loadSavedQuote } = compileScope(
    [extractFunction(src, 'orderCharges', 'index.html'),
     extractFunction(src, 'loadSavedQuote', 'index.html')],
    { data: store, toast: () => {}, saveData: () => {}, renderQuoteAll: () => {} },
    ['loadSavedQuote'],
  ));
} catch (e) { err = e; }
t.check(typeof loadSavedQuote === 'function', `loadSavedQuote compiles${err ? ` (${err.message})` : ''}`);

const agentLine = (name, qty) => ({
  productId: 'P1', variantIdx: null, productName: name, unit: 'bag',
  packUnit: '', packQty: 0, qty, supplierId: 'S1', supplierName: 'K',
  price: 100, sellPrice: 120, agentSellPrice: 140, bonusCommission: 0,
});
const order = (id, items, over = {}) => ({
  id, client: { name: 'Moses', phone: '' }, date: '2026-08-01', items,
  status: 'preparing', invoiced: false, amountPaid: 0, payments: [], voided: false, ...over,
});

if (loadSavedQuote) {
  const ids = () => store.quote.items.map(i => i.lineId);
  const distinct = () => new Set(ids()).size;

  /* ---------- 1. an agent order becomes editable -------------------- */
  {
    store.nextQuoteLineId = 1;
    store.savedQuotes = [order(1, [agentLine('Cement', 5), agentLine('Hinge', 3)])];
    // As submitted: no lineId anywhere.
    t.check(store.savedQuotes[0].items.every(i => i.lineId === undefined),
      'an agent line arrives without a lineId, which is the whole cause');

    loadSavedQuote(1);
    t.check(ids().every(x => typeof x === 'number'), `every loaded line gets one (${ids().join(', ')})`);
    t.check(distinct() === 2, 'and they differ -- one key per row, which is what the handlers need');
    t.check(store.quote.savedId === 1, 'the editor knows which order it is editing');
    t.check(store.nextQuoteLineId > Math.max(...ids()),
      'and the counter moves past them, so a line added next cannot collide');
  }

  /* ---------- 2. the state that made it inert ----------------------- */
  /*
   * Transcribed: the handlers match a row by lineId, so a shared key means
   * a filter removes nothing and a lookup finds the wrong row.
   */
  {
    const undefinedKeyed = [agentLine('Cement', 5), agentLine('Hinge', 3)];
    const removeBy = (items, lineId) => items.filter(x => x.lineId !== lineId);
    t.check(removeBy(undefinedKeyed, undefined).length === 0,
      'with every lineId undefined, removing one row matches them all');
    t.check(removeBy(undefinedKeyed, Number('undefined')).length === 2,
      'and reading the key back off the DOM gives NaN, which matches none -- either way the button does nothing useful');

    loadSavedQuote(1);
    const [first] = ids();
    t.check(removeBy(store.quote.items, first).length === 1,
      'once numbered, removing one row removes exactly one');
    t.check(removeBy(store.quote.items, first)[0].productName === 'Hinge',
      'and it is the other one that survives');
  }

  /* ---------- 3. quotes that already had ids ------------------------ */
  {
    store.nextQuoteLineId = 1;
    store.savedQuotes = [order(2, [
      { ...agentLine('A', 1), lineId: 7 },
      { ...agentLine('B', 1), lineId: 8 },
    ], { status: 'draft' })];
    loadSavedQuote(2);
    t.check(distinct() === 2, 'an admin-built quote still loads with one key per row');

    // Renumbering rather than filling gaps also repairs a duplicate, which
    // is the same failure with a different origin -- and one this file has
    // already had once, when nextQuoteLineId was read off the wrong field.
    store.nextQuoteLineId = 1;
    store.savedQuotes = [order(3, [
      { ...agentLine('A', 1), lineId: 4 },
      { ...agentLine('B', 1), lineId: 4 },
    ], { status: 'draft' })];
    loadSavedQuote(3);
    t.check(distinct() === 2, `two lines sharing an id are separated (${ids().join(', ')})`);
  }

  /* ---------- 4. the guard that was already there ------------------- */
  {
    store.savedQuotes = [order(4, [agentLine('Cement', 1)], { invoiced: true })];
    const before = JSON.stringify(store.quote);
    loadSavedQuote(4);
    t.check(JSON.stringify(store.quote) === before,
      'an invoiced order still refuses to load -- its stock and payments are already committed');
  }
}

/* ---------- 5. the shape of the fix --------------------------------- */
{
  t.check(/const items = JSON\.parse\(JSON\.stringify\(q\.items\)\);\s*\n\s*let nextLineId = Math\.max\(Number\(data\.nextQuoteLineId\) \|\| 1, 1\);\s*\n\s*items\.forEach\(it=>\{ it\.lineId = nextLineId\+\+; \}\);/.test(code),
    'every line is numbered on the way in, not only the ones missing an id');
  t.check(/data\.nextQuoteLineId = nextLineId;/.test(code),
    'and the counter carries on from there');
  t.check(!/data\.nextQuoteLineId = Math\.max\(data\.nextQuoteLineId\|\|1, \.\.\.q\.items\.map\(i=>\(i\.lineId\|\|0\)\+1\), 1\);/.test(code),
    'the old counter line, which advanced the counter but never numbered the lines, is gone');
}

process.exit(t.done() ? 1 : 0);
