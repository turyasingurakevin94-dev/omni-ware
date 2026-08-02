#!/usr/bin/env node
'use strict';
/*
 * An order line has to say WHICH variant.
 *
 * Every admin surface that shows a line prints it.productName: the order
 * tracking board, the order edit view, the A5 invoice a customer is handed,
 * the WhatsApp share, the supplier receipt, the purchase invoice generated
 * from the order, and the search haystacks. Not one of them resolves the
 * variant from it.variantIdx.
 *
 * The admin's own quote builder bakes the variant into that name --
 * productVariantLabel() gives "Cabinet Hinge — Brass". agent-submit-order
 * wrote product.name and nothing else, so a variable item ordered by an
 * agent arrived saying only "Cabinet Hinge". The data was not lost --
 * variantIdx was there the whole time -- but nothing displayed it, so the
 * shop picked, delivered and invoiced without knowing which finish.
 *
 * Fixed at the writer, and repaired on load for the orders already placed.
 *
 * Run: node test/admin-order-variant-names.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin order variant names');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. the writer now carries it ---------------------------- */
{
  const fn = read('supabase/functions/agent-submit-order/index.ts');
  t.check(/const variantCombo = variantIdx != null && Array\.isArray\(product\.variants\) && product\.variants\[variantIdx\]/.test(fn),
    'agent-submit-order resolves the variant it is ordering');
  t.check(/productName: variantCombo \? `\$\{product\.name\} — \$\{variantCombo\}` : product\.name,/.test(fn),
    'and writes it into the name, the way every reader expects');
  t.check(/Object\.values\(product\.variants\[variantIdx\]\.combo \|\| \{\}\)\.join\(" \/ "\)/.test(fn),
    'joined the same way the admin joins a combo, so the two read identically');
  t.check(!/productName: product\.name,/.test(fn), 'the bare name is gone');
}

/* ---------- 2. and old orders are repaired on the way in ------------ */
{
  const store = { products: [], savedQuotes: [], purchaseInvoices: [] };
  let fns = null, err = null;
  try {
    fns = compileScope(
      ['variantLabel', 'itemDisplayName', 'backfillOrderVariantNames'].map(n => extractFunction(src, n, 'index.html')),
      { data: store }, ['itemDisplayName', 'backfillOrderVariantNames'],
    );
  } catch (e) { err = e; }
  t.check(!!fns, `the repair compiles${err ? ` (${err.message})` : ''}`);

  if (fns) {
    const { itemDisplayName, backfillOrderVariantNames } = fns;
    const seed = () => {
      store.products = [
        { id: 'P900', name: 'Cabinet Hinge', type: 'variable',
          variants: [{ sku: 'HNG-BR', combo: { Finish: 'Brass' } }, { sku: 'HNG-ST', combo: { Finish: 'Steel' } }] },
        { id: 'P1', name: 'Cement', type: 'simple' },
      ];
    };
    seed();

    // The reported case, exactly.
    t.check(itemDisplayName({ productId: 'P900', variantIdx: 1, productName: 'Cabinet Hinge' }) === 'Cabinet Hinge — Steel',
      'an agent line for a variable item gains the variant it was always ordering');
    t.check(itemDisplayName({ productId: 'P900', variantIdx: 0, productName: 'Cabinet Hinge' }) === 'Cabinet Hinge — Brass',
      'and the right one -- keyed on the index, not the first variant');

    // An admin-built line already carries it and must not gain it twice.
    t.check(itemDisplayName({ productId: 'P900', variantIdx: 0, productName: 'Cabinet Hinge — Brass' }) === 'Cabinet Hinge — Brass',
      'a name that already carries its variant is left alone');

    // Everything that must be a no-op.
    t.check(itemDisplayName({ productId: 'P1', variantIdx: null, productName: 'Cement' }) === 'Cement',
      'a simple product is untouched');
    t.check(itemDisplayName({ productId: 'P1', variantIdx: '', productName: 'Cement' }) === 'Cement',
      'and so is a line whose variantIdx is the empty string the older rows use');
    t.check(itemDisplayName({ productId: 'P900', variantIdx: 9, productName: 'Cabinet Hinge' }) === 'Cabinet Hinge',
      'a variant that no longer exists leaves the name as it found it rather than throwing');
    t.check(itemDisplayName({ productId: 'GONE', variantIdx: 0, productName: 'Deleted thing' }) === 'Deleted thing',
      'as does a product that has since been deleted');
    t.check(itemDisplayName({}) === '' && itemDisplayName(null) === '', 'and a malformed line does not throw');

    /* ---------- 3. across both printed collections ------------------ */
    seed();
    store.savedQuotes = [{ items: [{ productId: 'P900', variantIdx: 1, productName: 'Cabinet Hinge' }] }];
    store.purchaseInvoices = [{ items: [{ productId: 'P900', variantIdx: 0, productName: 'Cabinet Hinge' }] }];
    backfillOrderVariantNames();
    t.check(store.savedQuotes[0].items[0].productName === 'Cabinet Hinge — Steel',
      'orders are repaired');
    t.check(store.purchaseInvoices[0].items[0].productName === 'Cabinet Hinge — Brass',
      'and so are the purchase invoices generated from them, which the supplier is handed');

    // Running twice must not compound -- it runs on every boot.
    backfillOrderVariantNames();
    backfillOrderVariantNames();
    t.check(store.savedQuotes[0].items[0].productName === 'Cabinet Hinge — Steel',
      'and running it again changes nothing, since it runs on every load');

    t.check(() => { store.savedQuotes = [{}]; store.purchaseInvoices = [{}]; backfillOrderVariantNames(); return true; },
      'a document with no items does not throw');
  }
}

/* ---------- 4. it runs before the sync baseline is taken ------------ */
/*
 * After it, every repaired order would read as an edit and upsert itself on
 * boot -- a write of the whole order book each time the app opens.
 */
{
  t.check(/backfillOrderVariantNames\(\);\s*\n\s*initLastSynced\(data, currentShopId\);/.test(code),
    'the repair happens before initLastSynced, so it is not mistaken for a change');
}

process.exit(t.done() ? 1 : 0);
