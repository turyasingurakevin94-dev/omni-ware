#!/usr/bin/env node
'use strict';
/*
 * A picker finds three of the five bags.
 *
 * Until now there was nothing to record that with, and both ways out were
 * wrong:
 *
 *   tap "Pick"     toggleItemPickedAt set pickedQty = qty unconditionally, so
 *                  the order recorded five picked when five were not, went
 *                  out short, and the board showed it cleanly prepared.
 *
 *   leave it       "Mark as finished" only rendered when every item was
 *                  'done', so the order could not be completed at all. It
 *                  stayed in_progress on that worker -- and since 0f31c2c
 *                  made one open pick the rule, they could not accept
 *                  anything else either. The only way out was an admin
 *                  stepping the order back to Draft, which nothing told them
 *                  was needed.
 *
 * pickedQty had been written since the first version of this screen and read
 * by nothing. So the fix is in two halves, and the seam between them is the
 * point: the worker records what was on the shelf, the admin decides what it
 * means. That split is not stylistic -- the worker app saves from a snapshot
 * that can be hours old and is deliberately not allowed to write item
 * quantities (WORKER_OWNED_KEYS in worker.html), so it cannot be the one to
 * amend the order.
 *
 * The half that matters most is the gate. savedQuoteTotal() bills for qty and
 * applyQuoteStockDeduction() takes qty off the shelf; neither reads pickedQty
 * and neither should have to. So an unsettled shortfall must not be
 * invoiceable, or the shop bills a customer for goods that never left it.
 *
 * Run: node test/worker-short-pick.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker short pick');
const indexHtml = read('index.html');
const workerHtml = read('worker.html');
const sharedJs = read('shared-worker.js');

// The pick-state model, shared by both apps and by every section below.
const MODEL = [
  extractDeclaration(sharedJs, 'PICK_ANSWERED', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemPickAnswered', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemOrderedQty', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemPickedQty', 'shared-worker.js'),
  extractFunction(sharedJs, 'pickShortfallLines', 'shared-worker.js'),
  extractFunction(sharedJs, 'orderHasPickShortfall', 'shared-worker.js'),
];
const MODEL_NAMES = ['itemPickAnswered', 'itemOrderedQty', 'itemPickedQty',
  'pickShortfallLines', 'orderHasPickShortfall'];

/* ---------- 1. what a pick resolved to -------------------------------- */
{
  const m = compileScope(MODEL, {}, MODEL_NAMES);

  t.check(m.itemPickAnswered({ pickStatus: 'done' }) && m.itemPickAnswered({ pickStatus: 'short' }),
    'both a full pick and a short one count as answered');
  t.check(!m.itemPickAnswered({ pickStatus: 'pending' }) && !m.itemPickAnswered({}) && !m.itemPickAnswered(null),
    'pending, unset and missing do not');

  t.check(m.itemPickedQty({ qty: 5, pickStatus: 'short', pickedQty: 3 }) === 3,
    'a short pick reports what was found');
  t.check(m.itemPickedQty({ qty: 5, pickStatus: 'short', pickedQty: 0 }) === 0,
    'nothing on the shelf is zero, not "unanswered"');
  t.check(m.itemPickedQty({ qty: 5, pickStatus: 'pending' }) === null,
    'an item nobody has walked to yet reports null, which is not the same as zero');

  // The compatibility case, and the one that would have been ugly to get
  // wrong. resetPickingProgress() nulls pickedQty and acceptOrderAssignment
  // does not refill it, so every order picked before this field was read
  // carries ticks with no number behind them. Reading those as zero would
  // have reported a shop-wide shortfall that never happened -- on live rows,
  // the day this shipped.
  t.check(m.itemPickedQty({ qty: 5, pickStatus: 'done', pickedQty: null }) === 5,
    'a tick with no number behind it is the full quantity, not zero');
  t.check(m.itemPickedQty({ qty: 5, pickStatus: 'done', pickedQty: 2 }) === 5,
    'and "done" outranks a stale number, because done means done');

  // Nothing downstream should ever see a picked count above what was ordered
  // -- that would have the shop billing for goods nobody asked for.
  t.check(m.itemPickedQty({ qty: 5, pickStatus: 'short', pickedQty: 9 }) === 5,
    'a picked count above the order is clamped to it');
  t.check(m.itemPickedQty({ qty: 5, pickStatus: 'short', pickedQty: -2 }) === 0,
    'and a negative one to zero');
  t.check(m.itemPickedQty({ qty: 5, pickStatus: 'short', pickedQty: 'x' }) === 0,
    'as is a value that is not a number at all');

  const q = {
    items: [
      { productName: 'Cement', qty: 5, pickStatus: 'short', pickedQty: 3 },
      { productName: 'Nails', qty: 2, pickStatus: 'done', pickedQty: 2 },
      { productName: 'Wire', qty: 4, pickStatus: 'short', pickedQty: 0 },
    ],
  };
  const lines = m.pickShortfallLines(q);
  t.check(lines.length === 2, `only the lines that came up short are reported (${lines.length})`);
  t.check(lines[0].ordered === 5 && lines[0].picked === 3 && lines[0].idx === 0,
    'each carries both numbers and where it sits on the order');
  t.check(lines[1].picked === 0, 'an item with none found is a shortfall, not an omission');

  t.check(m.orderHasPickShortfall(q), 'so the order has one');
  t.check(!m.orderHasPickShortfall({ items: [{ qty: 2, pickStatus: 'done', pickedQty: 2 }] }),
    'a clean pick does not');
  t.check(!m.orderHasPickShortfall({ items: [{ qty: 2, pickStatus: 'pending' }] }),
    'nor does a pick still in progress -- nothing has been reported yet');
  t.check(!m.orderHasPickShortfall(null) && !m.orderHasPickShortfall({}),
    'and a missing order, or one with no items, is not a shortfall either');
}

/* ---------- 2. the stranding itself ----------------------------------- */
/*
 * The finish button is the whole bug. Gating it on all-done is what left a
 * picker holding an order they could neither complete nor put down.
 */
{
  let html = '';
  const finishEl = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const scope = compileScope([
    ...MODEL,
    extractFunction(sharedJs, 'renderWorkerFinishButton', 'shared-worker.js'),
  ], {
    document: {
      getElementById: (id) => (id === 'wv_finishWrap' ? finishEl : { addEventListener: () => {} }),
    },
    finishPreparingOrder: () => {},
  }, [...MODEL_NAMES, 'renderWorkerFinishButton']);

  const render = (items) => { html = ''; scope.renderWorkerFinishButton({ id: 1, items }); return html; };

  const short = render([
    { qty: 5, pickStatus: 'short', pickedQty: 3 },
    { qty: 2, pickStatus: 'done', pickedQty: 2 },
  ]);
  t.check(/wv_finish_btn/.test(short),
    'an order with a recorded shortfall can be finished -- this is the stranding, and it is gone');
  t.check(/1 item Short/.test(short),
    'and the button says so, because finishing one that is going out incomplete should not look identical to finishing one that is not');

  const twoShort = render([
    { qty: 5, pickStatus: 'short', pickedQty: 3 },
    { qty: 4, pickStatus: 'short', pickedQty: 0 },
  ]);
  t.check(/2 items Short/.test(twoShort), 'pluralised over the count of short lines');

  const clean = render([{ qty: 2, pickStatus: 'done', pickedQty: 2 }]);
  t.check(/wv_finish_btn/.test(clean) && /Mark as finished/.test(clean) && !/short/.test(clean),
    'a clean pick still finishes exactly as it always did');

  t.check(render([{ qty: 2, pickStatus: 'pending' }]) === '',
    'an item nobody has answered for still blocks the finish -- unanswered is not the same as short');
  t.check(render([]) === '', 'and an empty order renders no button, as before');
}

/* ---------- 3. finishing actually goes through ------------------------ */
/*
 * The render is only half of it. finishPreparingOrder carries its own guard,
 * and left reading pickStatus!=='done' it would have bounced the very click
 * the button above now offers -- a button that does nothing, which is worse
 * than no button.
 */
{
  const data = { savedQuotes: [], staff: [] };
  const scope = compileScope([
    ...MODEL,
    extractFunction(sharedJs, 'finishPreparingOrder', 'shared-worker.js'),
  ], {
    data,
    saveData: async () => {},
    promptAssignDelivery: async () => 'ST9',
    autoAssignNextOrder: () => {},
    refreshAdminOrderBoardIfOpen: () => {},
    renderWorkerView: () => {},
    toast: () => {},
  }, [...MODEL_NAMES, 'finishPreparingOrder']);

  return (async () => {
    const q = {
      id: 700, status: 'preparing', assignedWorkerId: 'ST1', deliveryMode: 'shop_delivery',
      client: { name: 'Moses' },
      items: [
        { qty: 5, pickStatus: 'short', pickedQty: 3 },
        { qty: 2, pickStatus: 'done', pickedQty: 2 },
      ],
    };
    data.savedQuotes = [q];
    await scope.finishPreparingOrder(700);
    t.check(q.status === 'pending_delivery' && q.pickingStatus === 'done',
      'a short order finishes and moves on, instead of sitting on the worker forever');
    t.check(q.assignedDeliveryId === 'ST9',
      'and still goes through the delivery-assignment gate on its way');

    const stillPicking = {
      id: 701, status: 'preparing', assignedWorkerId: 'ST1', client: { name: 'Achen' },
      items: [{ qty: 5, pickStatus: 'short', pickedQty: 3 }, { qty: 2, pickStatus: 'pending' }],
    };
    data.savedQuotes = [stillPicking];
    await scope.finishPreparingOrder(701);
    t.check(stillPicking.status === 'preparing' && !stillPicking.pickingStatus,
      'while an unanswered item still stops it, so a half-walked order cannot be signed off');

    /* ---------- 4. recording the number ------------------------------- */
    {
      const data2 = { savedQuotes: [] };
      const s2 = compileScope([
        ...MODEL,
        extractFunction(sharedJs, 'setItemPickedQty', 'shared-worker.js'),
        extractFunction(sharedJs, 'toggleItemPickedAt', 'shared-worker.js'),
      ], {
        data: data2, saveData: () => {}, renderWorkerView: () => {},
      }, [...MODEL_NAMES, 'setItemPickedQty', 'toggleItemPickedAt']);

      const line = () => data2.savedQuotes[0].items[0];
      const load = () => { data2.savedQuotes = [{ id: 5, items: [{ qty: 5, pickStatus: 'pending', pickedQty: null }] }]; };

      load(); s2.setItemPickedQty(5, 0, 3);
      t.check(line().pickedQty === 3 && line().pickStatus === 'short', 'three of five records as short');

      load(); s2.setItemPickedQty(5, 0, 0);
      t.check(line().pickedQty === 0 && line().pickStatus === 'short',
        'and none at all records as short too, rather than as untouched');

      load(); s2.setItemPickedQty(5, 0, 5);
      t.check(line().pickStatus === 'done',
        'stepping back up to the full count is plain done, leaving the admin nothing to settle');

      load(); s2.setItemPickedQty(5, 0, 99);
      t.check(line().pickedQty === 5 && line().pickStatus === 'done',
        'a number above the order is clamped rather than billed');
      load(); s2.setItemPickedQty(5, 0, -1);
      t.check(line().pickedQty === 0, 'and below zero likewise');
      load(); s2.setItemPickedQty(5, 0, 2.7);
      t.check(line().pickedQty === 2, 'a fractional count is floored, not stored as a fraction of a bag');

      t.check(data2.savedQuotes[0].pickCursor === 0,
        'the carousel stays on the card just answered, rather than jumping');
      let threw = false;
      try { s2.setItemPickedQty(999, 0, 1); s2.setItemPickedQty(5, 99, 1); } catch (e) { threw = true; }
      t.check(!threw, 'a missing order or index is ignored rather than thrown');

      // The tap has to undo a recorded number as well as a tick, or a
      // mis-entered count would be stuck on the card with no way back.
      load(); s2.setItemPickedQty(5, 0, 3); s2.toggleItemPickedAt(5, 0);
      t.check(line().pickStatus === 'pending' && line().pickedQty === null,
        'tapping a short card clears it back to unanswered, the same way a tick always cleared');
      s2.toggleItemPickedAt(5, 0);
      t.check(line().pickStatus === 'done' && line().pickedQty === 5,
        'and tapping again claims the full quantity, which is still the one-tap path for the common case');
    }

    /* ---------- 5. the money gate ------------------------------------- */
    /*
     * The reason any of this matters. savedQuoteTotal() bills for qty and
     * applyQuoteStockDeduction() takes qty off the shelf. Neither reads
     * pickedQty, so an unsettled shortfall reaching either of them charges
     * for goods that never left the shop.
     */
    {
      const data3 = { savedQuotes: [], products: [], stock: {}, purchaseInvoices: [] };
      const seen = { modalFor: null, fromInvoice: null, stockDeltas: [] };
      const s3 = compileScope([
        ...MODEL,
        extractDeclaration(indexHtml, 'togglingInvoiced', 'index.html'),
        extractFunction(indexHtml, 'toggleQuoteInvoiced', 'index.html'),
        extractFunction(indexHtml, 'savedQuoteTotal', 'index.html'),
        extractFunction(indexHtml, 'applyQuoteStockDeduction', 'index.html'),
        extractFunction(indexHtml, 'amendOrderToPickedQuantities', 'index.html'),
        extractFunction(indexHtml, 'pickShortfallLabel', 'index.html'),
      ], {
        data: data3,
        document: { getElementById: () => null },
        openPickShortfallModal: (id, from) => { seen.modalFor = id; seen.fromInvoice = from; },
        quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
        getStockQty: () => 100,
        applyStockDelta: (productId, variantIdx, delta) => { seen.stockDeltas.push({ productId, delta }); },
        generatePurchaseInvoicesForQuote: async () => {},
        reverseQuoteStockDeduction: () => {},
        removeCashTxnsByIds: () => {},
        removePurchaseInvoicesForQuote: () => {},
        uninvoiceReversalWarning: () => null,
        syncInvoiceDebtCharge: () => {},
        saveData: () => {},
        todayISO: () => '2026-08-02',
        renderSavedQuotes: () => {}, renderInvoices: () => {}, renderPurchaseInvoices: () => {},
        renderCustomers: () => {}, renderDebtorsList: () => {},
        renderCbTransactions: () => {}, renderCbSummary: () => {}, renderCbTriggers: () => {},
        toast: () => {},
      }, [...MODEL_NAMES, 'toggleQuoteInvoiced', 'savedQuoteTotal',
        'applyQuoteStockDeduction', 'amendOrderToPickedQuantities', 'pickShortfallLabel']);

      const order = () => ({
        id: 42, status: 'completed', invoiced: false, amountPaid: 0, payments: [],
        client: { name: 'Moses' }, assignedWorkerId: 'ST1',
        items: [
          { productId: 'P1', productName: 'Cement', qty: 5, sellPrice: 40000, supplierId: '__stock__', pickStatus: 'short', pickedQty: 3 },
          { productId: 'P2', productName: 'Nails', qty: 2, sellPrice: 5000, supplierId: '__stock__', pickStatus: 'done', pickedQty: 2 },
        ],
      });

      const q = order();
      data3.savedQuotes = [q];
      seen.modalFor = null;
      await s3.toggleQuoteInvoiced(42);
      t.check(q.invoiced === false,
        'an order with an unsettled shortfall cannot be invoiced -- the customer is not billed for what never left the shop');
      t.check(seen.modalFor === 42 && seen.fromInvoice === true,
        'the admin is asked to settle it instead, and told the invoice was what asked');
      t.check(seen.stockDeltas.length === 0, 'and no stock moves either');

      // Settled the other way: the shop says the full quantity went out.
      const kept = order();
      kept.pickShortfallAckAt = Date.now();
      data3.savedQuotes = [kept];
      seen.modalFor = null;
      await s3.toggleQuoteInvoiced(42);
      t.check(kept.invoiced === true && seen.modalFor === null,
        'once settled, invoicing proceeds without asking again');

      // Un-invoicing is never gated: it only ever reverses.
      const undo = order();
      undo.invoiced = true;
      data3.savedQuotes = [undo];
      seen.modalFor = null;
      await s3.toggleQuoteInvoiced(42);
      t.check(undo.invoiced === false && seen.modalFor === null,
        'and undoing an invoice is never blocked by a shortfall -- it can only ever give money back');

      /* ---------- 6. amending makes qty the truth --------------------- */
      /*
       * The amendment brings the order's own quantities down to what left
       * the shop, rather than teaching the total and the deduction to read
       * pickedQty. One number, so the two cannot disagree.
       */
      {
        const amended = order();
        t.check(s3.savedQuoteTotal(amended) === 210000, 'as picked short, the order still totals the full 210,000');

        s3.amendOrderToPickedQuantities(amended);
        t.check(amended.items[0].qty === 3, 'amending brings the line down to what was found');
        t.check(amended.items[1].qty === 2, 'and leaves a line that was picked in full alone');
        t.check(s3.savedQuoteTotal(amended) === 130000,
          `the invoice follows without touching savedQuoteTotal (${s3.savedQuoteTotal(amended)})`);
        t.check(!s3.orderHasPickShortfall(amended),
          'and the shortfall is gone by derivation, so there is no flag left to go stale');

        seen.stockDeltas = [];
        s3.applyQuoteStockDeduction(amended);
        const cement = seen.stockDeltas.find((d) => d.productId === 'P1');
        t.check(cement && cement.delta === -3,
          `the shelf gives up three, not five (${cement ? cement.delta : 'nothing deducted'})`);

        // The zero case, which is the one that would tempt a "just drop the
        // line" shortcut. Keeping it at 0 costs nothing either side and is
        // the only record the customer's copy carries that the item was
        // ordered and could not be supplied.
        const none = order();
        none.items[0].pickedQty = 0;
        s3.amendOrderToPickedQuantities(none);
        t.check(none.items.length === 2 && none.items[0].qty === 0,
          'an item with none found stays on the order at zero rather than vanishing from it');
        seen.stockDeltas = [];
        s3.applyQuoteStockDeduction(none);
        t.check(!seen.stockDeltas.some((d) => d.productId === 'P1'),
          'and takes nothing off the shelf');
        t.check(s3.savedQuoteTotal(none) === 10000, 'nor anything off the customer');
      }

      /* ---------- 7. what the board says ------------------------------ */
      {
        t.check(/3 of 5/.test(s3.pickShortfallLabel(order())),
          'the board names the numbers on the single-line case, which is usually the whole story');
        const none = order();
        none.items[0].pickedQty = 0;
        t.check(/none of the 5/.test(s3.pickShortfallLabel(none)),
          'and says "none" rather than "0 of 5", which reads as a missing figure');
        const two = order();
        two.items[1].pickStatus = 'short';
        two.items[1].pickedQty = 1;
        t.check(/2 items/.test(s3.pickShortfallLabel(two)), 'more than one line falls back to a count');
        t.check(s3.pickShortfallLabel({ items: [] }) === '', 'and a clean order says nothing at all');
      }
    }

    /* ---------- 8. the decision belongs to the pick that reported it -- */
    {
      const s4 = compileScope([
        ...MODEL,
        extractFunction(sharedJs, 'resetPickingProgress', 'shared-worker.js'),
      ], {}, [...MODEL_NAMES, 'resetPickingProgress']);

      const q4 = {
        pickShortfallAckAt: 1700000000000,
        items: [{ qty: 5, pickStatus: 'short', pickedQty: 3 }],
      };
      t.check(!s4.orderHasPickShortfall(q4), 'a settled shortfall stops flagging');
      s4.resetPickingProgress(q4);
      t.check(q4.pickShortfallAckAt === null,
        'but sending the order back for a re-pick un-settles it, so the next pick is judged on its own');
      t.check(q4.items[0].pickedQty === null && q4.items[0].pickStatus === null,
        'along with the numbers that decision was about');
    }

    /* ---------- 9. the worker records, the admin decides -------------- */
    /*
     * The seam. The worker app saves from a snapshot that can be hours old,
     * so it writes only what it owns -- and the admin's decision is not on
     * that list. If it were, a worker's stale save would revert a settlement
     * made after their app last loaded.
     */
    {
      const s5 = compileScope([
        extractDeclaration(workerHtml, 'WORKER_OWNED_KEYS', 'worker.html'),
        extractFunction(workerHtml, 'mergePickState', 'worker.html'),
        'function __owned(){ return WORKER_OWNED_KEYS.slice(); }',
      ], {}, ['mergePickState', '__owned']);

      const owned = s5.__owned();
      t.check(!owned.includes('pickShortfallAckAt'),
        'the worker app does not claim the admin\'s decision about a shortfall');
      t.check(!owned.includes('items') && !owned.includes('qty'),
        'nor the quantities themselves, which is why it cannot amend the order');

      // What it DOES have to get through: the numbers behind the decision.
      const merged = s5.mergePickState(
        [{ productName: 'Cement', qty: 5 }],
        [{ productName: 'Cement', qty: 5, pickStatus: 'short', pickedQty: 3 }]
      );
      t.check(merged[0].pickStatus === 'short' && merged[0].pickedQty === 3,
        'but a short pick does reach the server, laid onto the admin\'s own items');
      t.check(merged[0].qty === 5,
        'without the worker\'s idea of the ordered quantity coming with it');

      // And the field has to be in the payload the admin app writes, or the
      // settlement lives only in that browser tab.
      const rows = extractFunction(indexHtml, 'buildSyncRows', 'index.html');
      t.check(/pickShortfallAckAt:/.test(rows),
        'the admin app persists the decision rather than holding it in memory');
    }

    /* ---------- 10. and all of it reaches the phone ------------------- */
    {
      t.check(read('worker-www/shared-worker.js') === sharedJs,
        'the packaged copy of shared-worker.js carries this');
      const css = read('worker-www/index.html');
      t.check(/\.wv-carousel-badge\.short\{/.test(css) && /\.wv-qty-sheet\{/.test(css),
        'and so does the styling for the short badge and the quantity sheet');
      // 44px, like every other control on this screen: it is pressed at the
      // shelf, one-handed, by someone who has not put anything down.
      // Either min-height or an outright height counts -- the short-pick
      // control is a square icon button in the corner now, so it sets both
      // dimensions rather than filling the width.
      const box = (cls) => {
        const rule = new RegExp(`\\.${cls}\\{([^}]*)\\}`).exec(css);
        if (!rule) return null;
        const dim = (p) => {
          const m = new RegExp(`(?:^|;)\\s*(?:min-)?${p}:(\\d+)px`).exec(rule[1]);
          return m ? Number(m[1]) : null;
        };
        return { h: dim('height'), w: dim('width') };
      };
      [['wv-carousel-short', 'the short-pick control'],
       ['wv-qty-none', 'the "none on the shelf" button']].forEach(([cls, what]) => {
        const b = box(cls);
        t.check(b && b.h >= 44, `${what} clears the 44px minimum (${b && b.h ? b.h : 'not set'}px tall)`);
      });
      // An icon carries no text to widen it, so it owes the width too.
      const shortBox = box('wv-carousel-short');
      t.check(shortBox && shortBox.w >= 44,
        `and the icon-only one is wide enough to hit as well (${shortBox && shortBox.w ? shortBox.w : 'not set'}px)`);
      const step = /\.wv-qty-step\{[^}]*height:(\d+)px/.exec(css);
      t.check(step && Number(step[1]) >= 44, `and the − / + keys do too (${step ? step[1] : 'not set'}px)`);
    }

    /* ---------- 11. and is readable in warehouse glare ---------------- */
    /*
     * A third state needed a third colour, and picking one by eye on a dark
     * ground is how the three AA failures worker-pick-card.test.js found got
     * there in the first place. Measured, not trusted -- and measured on the
     * REAL tokens, so a palette tweak that looks fine fails here.
     */
    {
      const css = read('worker-www/index.html');
      const root = /:root\{([\s\S]*?)\n  \}/.exec(css);
      const decls = {};
      (root ? root[1] : '').split(/\r?\n/).forEach(l => {
        const m = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(l.replace(/\/\*[\s\S]*?\*\//g, ''));
        if (m) decls[m[1]] = m[2].trim();
      });
      const resolve = (name, depth = 0) => {
        const v = decls[name];
        if (!v || depth > 6) return null;
        const ref = /^var\((--[\w-]+)\)$/.exec(v);
        return ref ? resolve(ref[1], depth + 1) : (/^#[0-9a-f]{6}$/i.test(v) ? v : null);
      };
      const lum = (hex) => {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const cr = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

      const amber = resolve('--amber'), ink = resolve('--accent-ink'), panel = resolve('--panel');
      const good = resolve('--good'), accent = resolve('--accent');
      const AA = 4.5;
      t.check(amber && ink && cr(ink, amber) >= AA,
        `the digits on the short badge clear AA (${amber && ink ? cr(ink, amber).toFixed(2) : 'unresolved'}:1)`);
      t.check(amber && panel && cr(amber, panel) >= AA,
        `and the short-pick control's label on a card does too (${amber && panel ? cr(amber, panel).toFixed(2) : 'unresolved'}:1)`);
      // The same reflex this file's neighbour already pins for the accent:
      // white on a bright colour over a dark ground does not pass, which is
      // why the badge takes dark ink.
      t.check(amber && cr('#FFFFFF', amber) < AA,
        `white on the amber would fail badly (${amber ? cr('#FFFFFF', amber).toFixed(2) : 'unresolved'}:1), which is why the ink is dark`);

      // Three states need three colours. Sharing one with done or with the
      // action colour is exactly the collision that made "already picked"
      // and "press this" indistinguishable before the palette split.
      t.check(amber && good && accent && amber !== good && amber !== accent,
        'short is its own colour, not a shade of done or of the button');
    }

    process.exit(t.done() ? 1 : 0);
  })();
}
