#!/usr/bin/env node
'use strict';
/*
 * The end of an order: delivered, invoiced, or cancelled.
 *
 * Three acts sit at the foot of the board, and each of them moves money or
 * goods, so each is the owner's own tap and none of them happens by itself.
 *
 *   Delivered   the customer or the carrier said it arrived. One tap on the
 *               row, through the same arrow every other stage moves by --
 *               never a direct write of 'completed', which would skip the
 *               gates and the stage log with it.
 *
 *   Invoice     bills the customer, takes the goods off the shelf and
 *               raises each supplier's bill. The row shows the check
 *               first: every line as ordered against what the picker
 *               actually found, the total, and what it does to that
 *               customer's account. Six delivered orders at the end of a
 *               day can be done in one confirm -- one, naming the count
 *               and the money, and a short pick is left out of it because
 *               a shortfall is a decision, not a rounding.
 *
 *   Cancel      the order is not going to happen. This is NOT delete.
 *               Receiving already put the goods on the shelf
 *               (receiveQuoteLine), and the supplier's bill is only ever
 *               raised by invoicing -- so deleting an order with goods in
 *               would erase what the shop owes for goods it is holding.
 *               Cancelling bills what came in, and only what came in, and
 *               voids the order through the one writer of that flag.
 *
 * Run: node test/order-delivered-invoice.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order delivered/invoice');
const src = read('index.html');
const sharedJs = read('shared-worker.js');

/* ---------- 1. Delivered is the arrow, not a direct write ------------- */
{
  const act = extractFunction(src, 'orderActSpec', 'index.html');
  t.check(/return \{ act:'next', label: q\.deliveryMode === 'agent_pickup' \? 'Collected' : 'Delivered', primary:true \};/.test(act),
    "an order out for delivery carries one act, and it is named for what actually happened to it");
  const dispatch = extractFunction(src, 'otAct', 'index.html');
  t.check(/case 'next': stepSavedQuoteStatus\(id, 1\); break;/.test(dispatch),
    'which steps the order on through the arrow every other stage uses');
  /* The literal that must not appear. setSavedQuoteStatus(id,'completed')
     would jump the order to Delivered without the sequence's own gates,
     and order-board-automation.test.js has forbidden it since the
     automation work; this is the same law read from the other end. */
  const body = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(!/setSavedQuoteStatus\([^)]*,\s*'completed'/.test(body),
    "and nothing anywhere sets 'completed' directly — delivering is a step, taken by a person");

  // The open row says what the tap means, and gives the number to ring.
  const load = extractFunction(src, 'orderLoadFormHTML', 'index.html');
  t.check(/href="tel:\$\{esc\(c\.phone\)\}/.test(load),
    "the carrier's number is a link on the row, because the way you find out it arrived is to ring it");
  t.check(/is your one tap on the row/.test(load),
    'and the row says what to do when they answer');
}

/* ---------- 2. the check before invoicing ---------------------------- */
/*
 * Every figure on it is a read of something the app already answers
 * elsewhere: the picked quantities are the picker's own record, the total
 * is savedQuoteTotal, and the balance is the customer's own debt plus what
 * this order adds. Nothing here is a second opinion about any of them.
 */
{
  const data = { customers: [{ id: 'C1', name: 'Musa Hardware', debt: 400000 }] };
  const scope = compileScope([
    extractFunction(src, 'orderInvoiceCheckHTML', 'index.html'),
    /* The check says each count in the unit the line was chosen in --
       the same reader every document uses -- so it is compiled in. A
       loose line reads exactly as before. */
    extractFunction(src, 'quoteLinePack', 'index.html'),
    extractFunction(src, 'quoteLineCountPer', 'index.html'),
    extractFunction(src, 'quoteLineCount', 'index.html'),
  ], {
    data,
    esc: (s) => String(s == null ? '' : s),
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    itemDisplayName: (it) => it.productName,
    itemPickedQty: (it) => (it.pickedQty == null ? null : Number(it.pickedQty)),
    savedQuoteTotal: () => 851000,
  }, ['orderInvoiceCheckHTML']);

  const q = (over) => Object.assign({
    id: 7, status: 'completed', invoiced: false, customerId: 'C1', amountPaid: 0,
    items: [{ productName: 'Cement', qty: 30, unit: 'Bag', pickStatus: 'done', pickedQty: 30 }],
  }, over);

  const html = scope.orderInvoiceCheckHTML(q());
  t.check(/Cement/.test(html) && /30 Bag/.test(html), 'each line is named with what went out');
  t.check(/851,000 UGX/.test(html), 'the total is what the customer is billed');
  t.check(/owes 400,000 UGX now, 1,251,000 UGX after/.test(html),
    'and the account is read as it stands and as it will be, so the owner sees the consequence before the tap');

  // A short line reads as short, and the number is the picker's.
  const short = scope.orderInvoiceCheckHTML(q({ items: [{ productName: 'Cement', qty: 30, unit: 'Bag', pickStatus: 'short', pickedQty: 22 }] }));
  t.check(/22 of 30 Bag/.test(short) && /ow-warn/.test(short),
    'a line that came up short says both numbers, and is the only thing on the check that is coloured');

  // Money already taken is subtracted from what the account gains -- an
  // order paid in full adds nothing to a debt.
  const paid = scope.orderInvoiceCheckHTML(q({ amountPaid: 851000 }));
  t.check(/851,000 UGX already paid/.test(paid) && /owes 400,000 UGX now, 400,000 UGX after/.test(paid),
    'an order already paid for adds nothing to the account, and the check says so');

  // No customer record: say that, rather than printing a balance of zero
  // as though somebody owed nothing.
  const walkin = scope.orderInvoiceCheckHTML(q({ customerId: null }));
  t.check(/No customer account on this order/.test(walkin) && !/owes/.test(walkin),
    'and an order with no customer account says so rather than showing a balance nobody has');

  t.check(scope.orderInvoiceCheckHTML(q({ invoiced: true })) === '' && scope.orderInvoiceCheckHTML(q({ status: 'preparing' })) === '',
    'the check shows only where it is about to be acted on: delivered, not yet invoiced');
}

/* ---------- 3. invoicing all of them, once --------------------------- */
{
  const asked = [];
  const invoiced = [];
  const data = { savedQuotes: [] };
  const scope = compileScope([
    extractDeclaration(sharedJs, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
    extractFunction(sharedJs, 'quoteAgedOffBoard', 'shared-worker.js'),
    extractFunction(src, 'ordersReadyToInvoice', 'index.html'),
    extractFunction(src, 'invoiceAllDelivered', 'index.html'),
    extractFunction(src, 'otInvoiceAllHTML', 'index.html'),
  ], {
    data,
    orderHasPickShortfall: (q) => !!q.short,
    savedQuoteTotal: (q) => q.total || 0,
    quoteClientName: (q) => (q.client && q.client.name) || 'Unnamed client',
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    esc: (s) => String(s == null ? '' : s),
    otIco: () => '',
    ICON_CHECK: '',
    toast: () => {},
    renderSavedQuotes: () => {},
    confirm: (m) => { asked.push(m); return true; },
    toggleQuoteInvoiced: async (id) => { invoiced.push(id); const q = data.savedQuotes.find((x) => x.id === id); if (q) q.invoiced = true; },
  }, ['invoiceAllDelivered', 'ordersReadyToInvoice', 'otInvoiceAllHTML']);

  const done = (over) => Object.assign({ id: 1, status: 'completed', invoiced: false, voided: false, total: 100000, client: { name: 'Musa' } }, over);

  (async () => {
    data.savedQuotes = [done({ id: 1, total: 851000 }), done({ id: 2, total: 149000, client: { name: 'Sarah' } }),
      done({ id: 3, short: true, client: { name: 'Joan' } }), done({ id: 4, invoiced: true }), done({ id: 5, voided: true })];
    await scope.invoiceAllDelivered();

    t.check(asked.length === 1, `one confirm for the whole batch, not one per order (${asked.length})`);
    t.check(/Invoice 2 delivered orders, billing 1,000,000 UGX in total/.test(asked[0]),
      'naming how many and how much, because that is what is being agreed to');
    t.check(/Musa — 851,000 UGX/.test(asked[0]) && /Sarah — 149,000 UGX/.test(asked[0]),
      'and listing them, so an order that should not be in it can be seen before the tap');
    t.check(/takes the goods off the shelf, raises each supplier's bill/.test(asked[0]),
      'the confirm says what invoicing actually does, not just how many');
    t.check(/1 order came up short/.test(asked[0]),
      'a short pick is named as left out rather than silently skipped');

    t.check(JSON.stringify(invoiced) === '[1,2]',
      `only the ready ones are invoiced, in board order (${JSON.stringify(invoiced)})`);
    t.check(!invoiced.includes(3), 'a short pick is left for a decision — the single-order path refuses it too');
    t.check(!invoiced.includes(4) && !invoiced.includes(5), 'nor is an invoiced or cancelled order touched again');

    // Nothing to do is said, not silently ignored.
    asked.length = 0; invoiced.length = 0;
    data.savedQuotes = [done({ id: 3, short: true })];
    await scope.invoiceAllDelivered();
    t.check(asked.length === 0 && invoiced.length === 0,
      'with nothing ready, nothing is asked and nothing moves');

    // Refusing the confirm moves no money at all.
    asked.length = 0; invoiced.length = 0;
    data.savedQuotes = [done({ id: 1 }), done({ id: 2 })];
    const noScope = compileScope([
      extractDeclaration(sharedJs, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
      extractFunction(sharedJs, 'quoteAgedOffBoard', 'shared-worker.js'),
      extractFunction(src, 'ordersReadyToInvoice', 'index.html'),
      extractFunction(src, 'invoiceAllDelivered', 'index.html'),
    ], {
      data, orderHasPickShortfall: () => false, savedQuoteTotal: (q) => q.total || 0,
      quoteClientName: (q) => q.client.name, fmtUGX: (n) => String(n), esc: (s) => String(s),
      toast: () => {}, renderSavedQuotes: () => {}, confirm: () => false,
      toggleQuoteInvoiced: async (id) => { invoiced.push(id); },
    }, ['invoiceAllDelivered']);
    await noScope.invoiceAllDelivered();
    t.check(invoiced.length === 0, 'and saying no to the confirm bills nobody');

    /* The button. One delivered order already carries Invoice on its own
       row, so a header button for it would be the same tap twice. */
    data.savedQuotes = [done({ id: 1 })];
    t.check(scope.otInvoiceAllHTML() === '', 'the header offers nothing when a single row already carries the act');
    data.savedQuotes = [done({ id: 1 }), done({ id: 2 })];
    t.check(/data-act="invoiceall"/.test(scope.otInvoiceAllHTML()) && /\(2\)/.test(scope.otInvoiceAllHTML()),
      'and offers it, with the count, once there are two');

    /* ---------- 4. cancelling bills what came in, and nothing else ---- */
    {
      const seen = { billed: null, voided: null, toasts: [], asked: [] };
      const cdata = { savedQuotes: [] };
      const cscope = compileScope([
        extractFunction(sharedJs, 'orderLineIsBoughtIn', 'shared-worker.js'),
        extractFunction(sharedJs, 'quoteLineReceived', 'shared-worker.js'),
        extractFunction(src, 'cancelSavedQuote', 'index.html'),
      ], {
        data: cdata,
        supplierName: (id) => ({ S1: 'Hima', S2: 'Roofings' })[id] || String(id),
        quoteClientName: (q) => (q.client && q.client.name) || 'Unnamed client',
        fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
        otOpenRows: new Set(),
        renderSavedQuotes: () => {},
        toast: (m) => { seen.toasts.push(String(m)); },
        confirm: (m) => { seen.asked.push(m); return true; },
        generatePurchaseInvoicesForQuote: async (q, opts) => { seen.billed = { id: q.id, opts }; },
        setInvoicesVoided: (qs, v) => { seen.voided = { ids: qs.map((x) => x.id), v }; qs.forEach((x) => { x.voided = v; }); },
      }, ['cancelSavedQuote']);

      const line = (over) => Object.assign({ productName: 'Cement', qty: 30, supplierId: 'S1' }, over);
      const order = (over) => Object.assign({ id: 9, status: 'awaiting_goods', voided: false, client: { name: 'Kato' }, payments: [], items: [] }, over);

      // Goods in: the supplier is billed for exactly them.
      cdata.savedQuotes = [order({ items: [
        line({ receivedAt: 1, receivedQty: 30, receivedPrice: 32000 }),
        line({ productName: 'Nails', supplierId: 'S2' }),          // never arrived
        line({ productName: 'Sand', supplierId: '__stock__' }),    // our own shelf
      ] })];
      cscope.cancelSavedQuote(9);
      await new Promise((r) => setTimeout(r, 0));

      t.check(seen.billed && seen.billed.opts && seen.billed.opts.receivedOnly === true,
        'cancelling bills the suppliers for what actually came in, and only that');
      t.check(/120,000|960,000 UGX/.test(seen.asked[0]) || /960,000 UGX/.test(seen.asked[0]),
        `the confirm names the money the shop is taking on (${(seen.asked[0] || '').slice(0, 120)})`);
      t.check(/Hima/.test(seen.asked[0]) && !/Roofings/.test(seen.asked[0]),
        'naming the supplier whose goods are on the shelf, and not the one whose never came');
      t.check(/on the shelf/.test(seen.asked[0]) && /yours whether the order happens or not/.test(seen.asked[0]),
        'and saying why they are billed at all — the goods are here');
      t.check(seen.voided && seen.voided.v === true && seen.voided.ids.length === 1,
        'the order is voided through setInvoicesVoided, the one writer of that flag, so the debt is re-synced with it');
      t.check(typeof cdata.savedQuotes[0].cancelledAt === 'number', 'and when it was cancelled is on the record');
      t.check(cdata.savedQuotes.length === 1, 'the order is not deleted — the record stays, and so does its history');

      // Nothing in: nobody is billed, and the confirm says so.
      seen.billed = null; seen.asked.length = 0; seen.voided = null;
      cdata.savedQuotes = [order({ id: 10, items: [line({ productName: 'Nails' })] })];
      cscope.cancelSavedQuote(10);
      await new Promise((r) => setTimeout(r, 0));
      t.check(seen.billed === null, 'an order where nothing arrived raises no supplier bill at all');
      t.check(/Nothing has come in for it, so no supplier is billed/.test(seen.asked[0]),
        'and the confirm says that plainly rather than leaving it to be assumed');
      t.check(cdata.savedQuotes[0].voided === true, 'it is still cancelled');

      // Money already taken is named, because it is a loose end at the counter.
      seen.asked.length = 0;
      cdata.savedQuotes = [order({ id: 11, payments: [{ amount: 200000 }], items: [] })];
      cscope.cancelSavedQuote(11);
      await new Promise((r) => setTimeout(r, 0));
      t.check(/1 payment already taken stays on record/.test(seen.asked[0]),
        'a payment already taken is named — the app does not refund by itself');

      // Refusing changes nothing.
      const no = compileScope([
        extractFunction(sharedJs, 'orderLineIsBoughtIn', 'shared-worker.js'),
        extractFunction(sharedJs, 'quoteLineReceived', 'shared-worker.js'),
        extractFunction(src, 'cancelSavedQuote', 'index.html'),
      ], {
        data: cdata, supplierName: (id) => id, quoteClientName: () => 'X', fmtUGX: (n) => String(n),
        otOpenRows: new Set(), renderSavedQuotes: () => {}, toast: () => {}, confirm: () => false,
        generatePurchaseInvoicesForQuote: async () => { seen.billed = 'BILLED'; },
        setInvoicesVoided: () => { seen.voided = 'VOIDED'; },
      }, ['cancelSavedQuote']);
      seen.billed = null; seen.voided = null;
      cdata.savedQuotes = [order({ id: 12, items: [line({ receivedAt: 1, receivedQty: 5, receivedPrice: 1000 })] })];
      no.cancelSavedQuote(12);
      await new Promise((r) => setTimeout(r, 0));
      t.check(seen.billed === null && seen.voided === null && cdata.savedQuotes[0].voided === false,
        'saying no to the confirm bills nobody and cancels nothing');

      // And a cancelled order is not cancelled twice.
      cdata.savedQuotes = [order({ id: 13, voided: true })];
      seen.asked.length = 0;
      cscope.cancelSavedQuote(13);
      t.check(seen.asked.length === 0, 'an order already cancelled is left alone');
    }

    /* ---------- 5. the board lets go of it ---------------------------- */
    /*
     * Every derivation reads !q.voided as "not an order", which is what
     * makes cancelling one act rather than a sweep. The board's own two
     * readers had to learn it: until cancelling existed on this screen, a
     * voided order was always an invoiced one that had aged off anyway.
     */
    {
      const render = extractFunction(src, 'renderSavedQuotes', 'index.html');
      t.check(/const quotes = allQuotes\.filter\(q=>!quoteAgedOffBoard\(q\) && !q\.voided\);/.test(render),
        'the board drops a cancelled order from every list it draws');
      const bar = extractFunction(src, 'updateOrderStatusBar', 'index.html');
      t.check(/filter\(q=>!quoteAgedOffBoard\(q\) && !q\.voided\)/.test(bar),
        'and so do the stage counts in the top bar, and the rail badge that follows them');
      const body = extractFunction(src, 'orderRowBodyHTML', 'index.html');
      t.check(/ghost\('cancel', 'Cancel order', ICON_TRASH\)/.test(body) && /q\.status === 'draft' \? ghost\('delete'/.test(body),
        'the row offers Delete only in Taken, and Cancel once the order has moved — by then goods may be in');
    }

    process.exit(t.done() ? 1 : 0);
  })();
}
