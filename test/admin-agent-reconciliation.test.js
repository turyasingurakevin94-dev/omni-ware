#!/usr/bin/env node
'use strict';
/*
 * The admin and the agent app read the same order row and report different
 * figures. They are SUPPOSED to.
 *
 * An agent order line (agent-submit-order) carries four numbers:
 *
 *   price           what the shop paid its supplier
 *   sellPrice       what the shop is owed for the line
 *   agentSellPrice  what the agent charges their own client
 *   bonusCommission supplier-funded bonus, snapshotted at submit time
 *
 * The admin totals sellPrice -- the shop's books. The agent app totals
 * agentSellPrice -- what their customer pays them. Neither is wrong, and
 * they must differ by exactly the agent's margin. Nothing enforces that:
 * the two totals are computed in different files, from different fields,
 * by code that has never been compared.
 *
 * This runs both real implementations over one matrix of orders and checks
 * the identity holds:
 *
 *   what the client pays  -  what the shop is owed  =  the agent's margin
 *
 * Run: node test/admin-agent-reconciliation.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin/agent reconciliation');

const adminSrc = read('index.html');
const agentSrc = read('agent.html');

/* ---------- both sides, from their real source ---------------------- */
const products = [];
let admin = null, agent = null, adminErr = null, agentErr = null;
try {
  admin = compileScope(
    ['quoteItemSellPrice', 'savedQuoteTotal', 'invoiceBalanceDue']
      .map(n => extractFunction(adminSrc, n, 'index.html')),
    { data: { products }, quoteSuggestedPrice: () => null, quoteSuggestedStockPrice: () => null },
    ['savedQuoteTotal', 'quoteItemSellPrice', 'invoiceBalanceDue'],
  );
} catch (e) { adminErr = e; }
try {
  agent = compileScope(
    ['orderTotal', 'agentLinePriced', 'orderEarnings'].map(n => extractFunction(agentSrc, n, 'agent.html')),
    {}, ['orderTotal', 'orderEarnings'],
  );
} catch (e) { agentErr = e; }
t.check(!!admin, `the admin's totals compile${adminErr ? ` (${adminErr.message})` : ''}`);
t.check(!!agent, `the agent app's totals compile${agentErr ? ` (${agentErr.message})` : ''}`);

/* ---------- the fixtures -------------------------------------------- */
// Shaped exactly as agent-submit-order writes them.
const line = (over = {}) => ({
  productId: 'P1', variantIdx: null, productName: 'Cement',
  unit: 'bag', packUnit: '', packQty: 0, qty: 10,
  supplierId: 'S1', supplierName: 'Kirinya',
  price: 28000,           // supplier cost
  sellPrice: 32000,       // what the shop is owed
  agentSellPrice: 40000,  // what the agent charges their client
  bonusCommission: 0,
  ...over,
});
const order = (items, over = {}) => ({ id: 1, status: 'completed', voided: false, amountPaid: 0, items, ...over });

const CASES = [
  ['a single line with a healthy margin', order([line()])],
  ['several lines at different margins', order([
    line(), line({ qty: 3, sellPrice: 12000, agentSellPrice: 15000 }), line({ qty: 1, sellPrice: 90000, agentSellPrice: 99000 }),
  ])],
  ['an agent selling at exactly the shop price', order([line({ agentSellPrice: 32000 })])],
  ['an agent selling BELOW the shop price', order([line({ agentSellPrice: 30000 })])],
  ['a line carrying a bonus', order([line({ bonusCommission: 5000 })])],
  ['fractional quantities', order([line({ qty: 2.5, sellPrice: 3333, agentSellPrice: 4444 })])],
  ['a zero-quantity line', order([line({ qty: 0 })])],
  ['an empty order', order([])],
];

if (admin && agent) {
  /* ---------- 1. the identity ---------------------------------------- */
  /*
   * client pays - shop is owed = agent's margin.
   */
  {
    const broken = [];
    CASES.forEach(([name, o]) => {
      const clientPays = agent.orderTotal(o);
      const shopIsOwed = admin.savedQuoteTotal(o);
      const margin = agent.orderEarnings(o).margin;
      if (Math.abs((clientPays - shopIsOwed) - margin) > 0.000001) {
        broken.push(`${name}: ${clientPays} - ${shopIsOwed} != ${margin}`);
      }
    });
    t.check(broken.length === 0,
      `the two apps reconcile on every shape${broken.length ? `:\n         ${broken.join('\n         ')}` : ` (${CASES.length} cases)`}`);
  }

  /* ---------- 2. each side reads its own field ----------------------- */
  {
    const o = order([line()]);
    t.check(admin.savedQuoteTotal(o) === 320000, 'the admin bills the shop price (10 x 32,000)');
    t.check(agent.orderTotal(o) === 400000, 'the agent app shows their client price (10 x 40,000)');
    t.check(agent.orderEarnings(o).margin === 80000, 'and the difference is the agent\'s (10 x 8,000)');
    t.check(agent.orderTotal(o) - admin.savedQuoteTotal(o) === agent.orderEarnings(o).margin,
      'which is the identity, on the plainest possible case');
  }

  /* ---------- 3. what the agent owes the shop ------------------------ */
  /*
   * A prepay agent settles the SHOP's figure, not their own. Charging them
   * their client price would take their margin off them at the counter.
   */
  {
    const o = order([line()]);
    t.check(admin.invoiceBalanceDue(o) === 320000,
      'an unpaid agent order owes the shop 320,000, not the 400,000 their client pays');
    t.check(admin.invoiceBalanceDue(order([line()], { amountPaid: 120000 })) === 200000,
      'less whatever has already been paid');
    t.check(admin.invoiceBalanceDue(order([line()], { amountPaid: 999999 })) === 0,
      'and never negative');
  }

  /* ---------- 4. the shop's own margin is a separate thing ----------- */
  {
    const o = order([line()]);
    const shopCost = o.items.reduce((s, it) => s + it.qty * it.price, 0);
    const shopMargin = admin.savedQuoteTotal(o) - shopCost;
    t.check(shopCost === 280000 && shopMargin === 40000,
      `the shop makes 40,000 on this line, the agent 80,000 -- different money from the same row`);
    t.check(shopMargin + agent.orderEarnings(o).margin === agent.orderTotal(o) - shopCost,
      'and together they account for everything between supplier cost and what the client pays');
  }

  /* ---------- 5. a bonus belongs to the agent, not the shop ---------- */
  {
    const o = order([line({ bonusCommission: 5000 })]);
    t.check(agent.orderEarnings(o).bonus === 5000, 'the agent app counts the bonus');
    t.check(admin.savedQuoteTotal(o) === 320000,
      'while the shop is owed the same 320,000 -- a supplier-funded bonus is not shop revenue');
    t.check(agent.orderEarnings(o).total === agent.orderEarnings(o).margin + 5000,
      'and it lands on top of the agent\'s margin');
  }

  /* ---------- 6. the field that would break it ----------------------- */
  /*
   * quoteItemSellPrice() falls back to a computed markup price when a line
   * carries no sellPrice, while the agent app's margin reads
   * Number(it.sellPrice)||0 and treats a missing one as zero. A line like
   * that would make the two disagree, so the reconciliation only holds
   * while agent-submit-order always writes the field.
   */
  {
    const missing = order([line({ sellPrice: null })]);
    const clientPays = agent.orderTotal(missing);
    const shopIsOwed = admin.savedQuoteTotal(missing);
    const margin = agent.orderEarnings(missing).margin;
    t.check((clientPays - shopIsOwed) !== margin || shopIsOwed === 0,
      'a line with no sellPrice is exactly where the two would part company');

    const fn = read('supabase/functions/agent-submit-order/index.ts');
    t.check(/sellPrice: priced\.floorPrice,/.test(fn),
      'which is why agent-submit-order always writes sellPrice onto every line');
    t.check(/agentSellPrice: Number\(it\.agentSellPrice\),/.test(fn), 'and agentSellPrice');
    t.check(/price: priced\.cost,/.test(fn), 'and the supplier cost the floor was computed from');
  }

  /* ---------- 7. shown as earned vs actually payable ----------------- */
  /*
   * The reconciliation an agent cares about most: the bonus their Earnings
   * screen credits them for a month, against the figure
   * agent-claim-commission will actually pay out for it. Those live in two
   * languages -- one is a client-side reduce over myOrders, the other a
   * PostgREST filter plus a loop in Deno -- and a disagreement is money the
   * agent was promised and did not get.
   */
  // The server's rule, transcribed from agent-claim-commission: voided
  // false, status completed, row.date in the month, sum bonusCommission.
  const claimable = (orders, month) => orders
    .filter(o => !o.voided && o.status === 'completed' && o.date && String(o.date).startsWith(month))
    .reduce((s, o) => s + (o.items || []).reduce((a, it) => a + (Number(it.bonusCommission) || 0), 0), 0);

  const ord = (over) => order([line({ bonusCommission: 4000 })], { date: '2026-07-10', status: 'completed', ...over });
  const rows = [
    ord({ id: 1 }),
    ord({ id: 2, date: '2026-07-28' }),
    ord({ id: 3, status: 'pending_delivery' }),           // not finished -- no bonus either side
    ord({ id: 4, voided: true }),                          // cancelled -- no bonus either side
    ord({ id: 5, date: '2026-08-02' }),                    // a different month
    ord({ id: 6, items: [line({ bonusCommission: 0 })] }), // finished, no bonus on it
  ];

  // Bound at compile time: monthEarnings reads the bare identifier
  // myOrders, so the rows have to be in the scope object BEFORE this runs.
  // Setting them afterwards leaves the function looking at the empty array
  // it was compiled against, which reported the agent earning nothing and
  // the shop owing 8,000 -- a fixture fault dressed as a reconciliation
  // failure.
  let monthEarnings = null, meErr = null;
  try {
    ({ monthEarnings } = compileScope(
      ['agentLinePriced', 'orderEarnings', 'monthEarnings'].map(n => extractFunction(agentSrc, n, 'agent.html')),
      { myOrders: rows }, ['monthEarnings'],
    ));
  } catch (e) { meErr = e; }
  t.check(typeof monthEarnings === 'function', `monthEarnings compiles${meErr ? ` (${meErr.message})` : ''}`);

  if (monthEarnings) {
    const MONTHS = ['2026-06', '2026-07', '2026-08'];
    const off = MONTHS.filter(m => monthEarnings(m).bonus !== claimable(rows, m))
      .map(m => `${m}: screen ${monthEarnings(m).bonus} vs payable ${claimable(rows, m)}`);
    t.check(off.length === 0,
      `every month agrees between the Earnings screen and the claim${off.length ? `: ${off.join('; ')}` : ` (${MONTHS.join(', ')})`}`);
    t.check(monthEarnings('2026-07').bonus === 8000,
      `July credits the two finished orders only (${monthEarnings('2026-07').bonus})`);
    t.check(monthEarnings('2026-06').bonus === 0, 'a month with nothing in it credits nothing');

    // Both sides bucket on the order's own date. savedAt is rewritten on
    // every save, so keying on it would move a July order into August --
    // and a claim is a fixed snapshot, so that month would be paid twice.
    t.check(/o\.date && String\(o\.date\)\.startsWith\(monthKey\)/.test(
      read('agent.html').split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n')),
      'the agent app buckets on the order date');
    t.check(/if \(!row\.date \|\| !String\(row\.date\)\.startsWith\(month\)\) continue;/.test(
      read('supabase/functions/agent-claim-commission/index.ts')),
      'and so does the claim');

    // The server half of this reconciliation is a PostgREST query, which
    // cannot be executed here -- it is transcribed into claimable() above.
    // These pin the transcription to the real filters, so a change to
    // either one fails rather than quietly drifting from what is asserted.
    const claim = read('supabase/functions/agent-claim-commission/index.ts');
    t.check(/\.eq\("voided", false\)/.test(claim), 'the claim excludes voided orders');
    t.check(/\.eq\("status", "completed"\)/.test(claim), 'and counts only completed ones');
    t.check(/bonusAmount \+= Number\(it\.bonusCommission\) \|\| 0;/.test(claim),
      'summing the same bonusCommission field the agent app reads');
    t.check(/\.eq\("agent_id", agentId\)/.test(claim),
      'for that agent only, off the FK column rather than the payload');

    // And the agent app's own two halves of the same rule.
    const agentCode = read('agent.html').split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
    t.check(/if\(o\.status === 'completed'\) bonus \+= e\.bonus;/.test(agentCode),
      'the Earnings screen credits a bonus only once the order is completed');
    t.check(/myOrders\.filter\(o=>!o\.voided && o\.date/.test(agentCode),
      'and skips voided orders, as the claim does');
  }
}

process.exit(t.done() ? 1 : 0);
