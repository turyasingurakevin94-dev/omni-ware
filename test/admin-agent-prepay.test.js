#!/usr/bin/env node
'use strict';
/*
 * The cash an agent is asked for, and the cash the system records.
 *
 * A prepay agent's order will not move to preparing until it is paid for.
 * When the shopkeeper steps it forward, a modal asks them to confirm they
 * have received the money, and confirming books a Cash Book receipt, a
 * payments entry and an amountPaid.
 *
 * The prompt and the handler worked the figure out separately, and
 * differently. The prompt totalled the lines itself from raw it.sellPrice
 * and ignored amountPaid entirely; the handler used savedQuoteTotal() minus
 * what had already been paid.
 *
 * That matters because an agent's mobile-money payment can land SHORT --
 * check-momo-payment-status banks and credits it deliberately without
 * unlocking the order. On a 500,000 order with 200,000 already in, the
 * shopkeeper was told to collect 500,000 while the system stood ready to
 * record 300,000. Either the agent is overcharged by 200,000, or the money
 * taken and the money booked disagree by that much.
 *
 * Run: node test/admin-agent-prepay.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin agent prepay');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { products: [] };
let fns = null, err = null;
try {
  fns = compileScope(
    ['savedQuoteTotal', 'quoteItemSellPrice', 'invoiceBalanceDue', 'agentPrepayOutstanding']
      .map(n => extractFunction(src, n, 'index.html')),
    { data: store, quoteSuggestedPrice: () => null, quoteSuggestedStockPrice: () => null },
    ['savedQuoteTotal', 'invoiceBalanceDue', 'agentPrepayOutstanding'],
  );
} catch (e) { err = e; }
t.check(!!fns, `the prepay figure compiles${err ? ` (${err.message})` : ''}`);

const order = (amountPaid, over = {}) => ({
  id: 7, client: { name: 'Moses' }, amountPaid,
  items: [{ id: 1, productId: 'P1', variantIdx: null, qty: 10, sellPrice: 50000, price: 45000, supplierId: 'S1' }],
  ...over,
});

if (fns) {
  const { agentPrepayOutstanding, savedQuoteTotal } = fns;

  /* ---------- 1. what is actually outstanding ---------------------- */
  {
    t.check(savedQuoteTotal(order(0)) === 500000, 'the order is worth 500,000');
    t.check(agentPrepayOutstanding(order(0)) === 500000, 'with nothing paid, all of it is outstanding');
    t.check(agentPrepayOutstanding(order(200000)) === 300000,
      'a short mobile-money payment of 200,000 leaves 300,000 -- this is the case that was wrong');
    t.check(agentPrepayOutstanding(order(500000)) === 0, 'a settled order needs nothing');
    t.check(agentPrepayOutstanding(order(600000)) === 0,
      'and an overpaid one is clamped, never negative -- the modal would otherwise ask for a negative sum');
  }

  /* ---------- 2. one expression, so they cannot drift -------------- */
  /*
   * The point of the fix is not the arithmetic, it is that there is only
   * one of it. Both the sentence the shopkeeper reads and the amount that
   * gets booked come from here.
   */
  {
    const q = order(200000);
    const shown = agentPrepayOutstanding(q);
    const recorded = agentPrepayOutstanding(q);
    t.check(shown === recorded, 'the figure shown and the figure recorded are the same call');

    // The old prompt's own arithmetic, kept so the difference is on record.
    const oldPromptFigure = (q.items || []).reduce((s, it) => s + (Number(it.sellPrice) || 0) * (Number(it.qty) || 0), 0);
    t.check(oldPromptFigure === 500000 && shown === 300000,
      `the old prompt said ${oldPromptFigure} where ${shown} was due`);
    t.check(oldPromptFigure - shown === 200000, 'a 200,000 gap, exactly the payment already banked');
  }

  /* ---------- 3. it totals lines the same way as everything else --- */
  /*
   * The second half of the old divergence: raw it.sellPrice, rather than
   * quoteItemSellPrice(), which falls back to a computed price when a line
   * carries none. A line with no sell price counted as zero in the prompt
   * and as its computed price everywhere else.
   */
  {
    const noSellPrice = order(0, {
      items: [{ id: 1, productId: 'P1', variantIdx: null, qty: 4, price: 1000, supplierId: 'S1' }],
    });
    const raw = noSellPrice.items.reduce((s, it) => s + (Number(it.sellPrice) || 0) * (Number(it.qty) || 0), 0);
    t.check(raw === 0, 'a line with no sellPrice totalled zero under the old arithmetic');
    t.check(agentPrepayOutstanding(noSellPrice) === savedQuoteTotal(noSellPrice),
      'while the outstanding figure agrees with savedQuoteTotal, whatever that line resolves to');
  }
}

/* ---------- 4. both call sites use it ------------------------------- */
{
  t.check(/function agentPrepayOutstanding\(q\)\{\s*\n\s*return invoiceBalanceDue\(q\);\s*\n\}/.test(code),
    'the helper defers to invoiceBalanceDue rather than restating its arithmetic');
  t.check((code.match(/return Math\.max\(0, savedQuoteTotal\(q\) - \(Number\(q\.amountPaid\)\|\|0\)\);/g) || []).length === 1,
    'so that sum is written down exactly once in the file');
  t.check(/const agent = data\.agents\.find\(a=>a\.id===q\.originAgentId\);\s*\n\s*const owed = agentPrepayOutstanding\(q\);/.test(code),
    'the prompt uses it');
  t.check(/const owed = agentPrepayOutstanding\(q\);\s*\n\s*if\(owed > 0\)\{/.test(code),
    'and so does the handler that books the money');
  t.check((code.match(/agentPrepayOutstanding\(q\)/g) || []).length === 3,
    'three references in all -- the definition and the two callers');

  // The prompt's own arithmetic must be gone, not merely bypassed.
  t.check(!/const owed = \(q\.items\|\|\[\]\)\.reduce\(\(s,it\)=> s \+ \(Number\(it\.sellPrice\)\|\|0\)\*\(Number\(it\.qty\)\|\|0\), 0\);/.test(code),
    'and the prompt no longer totals the lines itself');

  // What the handler does with the figure, unchanged.
  t.check(/addCashReceipt\('cash', owed, 'Agent Payment'/.test(code),
    'the receipt is booked for the same figure that was confirmed');
  t.check(/q\.amountPaid = \(Number\(q\.amountPaid\)\|\|0\) \+ owed;/.test(code),
    'and added to what was already paid rather than replacing it');
}

process.exit(t.done() ? 1 : 0);
