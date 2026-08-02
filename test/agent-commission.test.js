#!/usr/bin/env node
'use strict';
/*
 * Agent commission claims -- the shop paying money OUT to an agent.
 *
 * The bonus is supplier-funded but settled from the shop's own till, so it
 * is the only path in the system where the business hands over cash on the
 * strength of a computation. Two things therefore matter: that the amount
 * is right, and that handing it over leaves a record.
 *
 * Both were wrong. The claim counted every non-voided order including
 * DRAFTS, and marking one paid wrote nothing but a status.
 *
 * Run: node test/agent-commission.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent commission');
const claimSrc = read('supabase/functions/agent-claim-commission/index.ts');
const boardSrc = read('supabase/functions/agent-leaderboard/index.ts');
const adminSrc = read('index.html');
const migSrc = read('supabase/migrations/0038_commission_claim_cash_link.sql');

/* ---------- 1. only a real, finished sale earns a bonus --------------- */
/*
 * agent-submit-order creates orders at status 'draft'. With no status
 * filter, an order that was submitted and then never prepared, delivered
 * or paid for still earned the agent a payout -- and one the shop's own
 * screens never showed as earned, since the leaderboard has always
 * filtered on completed.
 */
{
  t.check(/\.eq\("status", "completed"\)/.test(claimSrc),
    'a claim only counts completed orders');
  t.check(/\.eq\("voided", false\)/.test(claimSrc),
    'and never a voided one');
  t.check(/\.eq\("agent_id", agentId\)/.test(claimSrc),
    'matched on the FK\'d column, like the order policy since 0035');
  t.check(!/payload->>originAgentId/.test(claimSrc),
    'and no longer on the payload field the order carries');
}

/* ---------- 2. the claim and the agent's own screen agree ------------- */
/*
 * agent-leaderboard is what the agent sees as earned. If the payout is
 * computed from a different set of orders, the two disagree about money
 * the agent is owed -- and the agent has no way to tell which is right.
 */
{
  // Comments stripped first: both files carry a note explaining why
  // payload.savedAt was abandoned, and scanning that as code reports it
  // still in use in the very place it was removed from.
  const codeOnly = (src) => src.split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const filtersOf = (raw) => {
    const src = codeOnly(raw);
    return {
      completed: /\.eq\("status", "completed"\)/.test(src),
      notVoided: /\.eq\("voided", false\)/.test(src),
      byDate: /startsWith\(month(Key)?\)/.test(src) && /row\.date/.test(src),
      byAgentIdColumn: /row\.agent_id/.test(src) || /\.eq\("agent_id", agentId\)/.test(src),
      usesSavedAt: /payload\.savedAt/.test(src),
    };
  };
  const claim = filtersOf(claimSrc);
  const board = filtersOf(boardSrc);
  t.check(JSON.stringify(claim) === JSON.stringify(board),
    `the payout and the agent's earnings screen select the same orders (claim ${JSON.stringify(claim)}, board ${JSON.stringify(board)})`);
  t.check(!claim.usesSavedAt && !board.usesSavedAt,
    'neither keys the month on payload.savedAt');
  t.check(claim.byDate && board.byDate,
    'both key it on the order\'s own date');
}

/* ---------- 3. why savedAt was the wrong basis ------------------------ */
/*
 * savedAt is rewritten on every save, so re-opening a July order in August
 * moved it out of July and into August. A claim is a fixed snapshot, so a
 * July claim already made would have paid it once -- and August would pay
 * it again.
 */
{
  const inMonth = (value, month) => !!value && String(value).startsWith(month);
  const order = { date: '2026-07-15', savedAt: '2026-07-15T09:00:00.000Z' };
  t.check(inMonth(order.date, '2026-07') && inMonth(order.savedAt, '2026-07'),
    'before any edit, both bases agree the order is July\'s');
  order.savedAt = '2026-08-03T11:20:00.000Z';   // admin re-saves it
  t.check(inMonth(order.date, '2026-07') && !inMonth(order.savedAt, '2026-07'),
    'after an August edit, savedAt drops it out of July while the order date holds');
  t.check(!inMonth(order.date, '2026-08') && inMonth(order.savedAt, '2026-08'),
    'and savedAt puts it into August, where a second claim would pay it again');

  // The admin form rewrites savedAt unconditionally; date it takes as given.
  t.check(/savedAt: new Date\(\)\.toISOString\(\)/.test(adminSrc) && /date: data\.quote\.date/.test(adminSrc),
    'the quote form still stamps savedAt on every save and leaves date alone, which is what makes date the stable one');
}

/* ---------- 4. a claim is a snapshot, not a live figure --------------- */
{
  t.check(/if \(existing\) return json\(\{ ok: true, claim: existing \}\)/.test(claimSrc),
    'an existing claim is returned as-is rather than recomputed');
  t.check(/if \(month >= currentMonthKey\(\)\) return json/.test(claimSrc),
    'and a month can only be claimed once it has ended');
  t.check(/if \(!\(bonusAmount > 0\)\) return json/.test(claimSrc),
    'a month that earned nothing does not create a zero claim to chase');
}

/* ---------- 5. paying one leaves a record ----------------------------- */
{
  const cash = [];
  const claims = [{ id: 7, agent_id: 'AG0003', month: '2026-07', bonus_amount: 85000, status: 'requested' }];
  const data = { agents: [{ id: 'AG0003', name: 'Agnes Musiimenta' }] };
  let updateArgs = null, updateError = null;

  const env = {
    data, commissionClaims: claims, currentShopId: 'shop-1',
    ACCOUNTS: [{ key: 'cash', label: 'Cash' }, { key: 'momo', label: 'Mobile Money' }],
    fmtUGX: (n) => `UGX ${n}`,
    esc: (s) => String(s == null ? '' : s),
    claimMonthLabel: (m) => m,
    confirm: () => true,
    toast: (m) => { env.__toast = m; },
    saveData: () => {},
    renderCommissionClaims: () => {},
    renderCbTransactions: () => {}, renderCbSummary: () => {}, renderCbTriggers: () => {},
    document: { getElementById: () => null },
    addCashPayment: (account, amount, category, description) => {
      cash.push({ id: cash.length + 1, account, amount, category, description });
      return cash.length;
    },
    removeCashTxnsByIds: (ids) => {
      const set = new Set(ids || []);
      for (let i = cash.length - 1; i >= 0; i--) if (set.has(cash[i].id)) cash.splice(i, 1);
    },
    // The account picker builds a DOM overlay; short-circuited to a choice.
    promptCashAccount: async () => env.__pick,
    sb: { from: () => ({ update: (v) => { updateArgs = v; return { eq: () => ({ eq: () => Promise.resolve({ error: updateError }) }) }; } }) },
  };
  const { markClaimPaid, agentNameById } = compileScope(
    [extractFunction(adminSrc, 'agentNameById', 'index.html'),
     extractFunction(adminSrc, 'markClaimPaid', 'index.html')],
    env, ['markClaimPaid', 'agentNameById'],
  );

  return (async () => {
    t.check(agentNameById('AG0003') === 'Agnes Musiimenta' && agentNameById('GONE') === 'GONE',
      'the payee is named, falling back to the id for an agent since retired');

    // Backing out of the account picker must change nothing at all.
    env.__pick = null;
    await markClaimPaid(7);
    t.check(cash.length === 0 && claims[0].status === 'requested' && updateArgs === null,
      'backing out of the account picker writes neither a cash entry nor a status');

    // The real thing.
    env.__pick = 'momo';
    await markClaimPaid(7);
    t.check(cash.length === 1,
      `paying a claim records a Cash Book payment (${cash.length} entries)`);
    t.check(cash[0].amount === 85000 && cash[0].account === 'momo',
      `for the claimed amount, from the account chosen (${cash[0].amount} via ${cash[0].account})`);
    t.check(cash[0].category === 'Agent Commission' && /Agnes Musiimenta/.test(cash[0].description),
      `categorised and described so it is findable later ("${cash[0].description}")`);
    t.check(claims[0].status === 'paid' && claims[0].cash_txn_id === 1,
      'and the claim records which entry settled it');
    t.check(updateArgs && updateArgs.cash_txn_id === 1 && updateArgs.status === 'paid',
      'which is persisted, not just held locally');

    /* ---------- 6. a failed update does not leave phantom cash --------- */
    claims.push({ id: 8, agent_id: 'AG0003', month: '2026-06', bonus_amount: 40000, status: 'requested' });
    cash.length = 0;
    updateError = { message: 'network' };
    env.__pick = 'cash';
    await markClaimPaid(8);
    t.check(cash.length === 0,
      `when the claim cannot be marked paid the cash entry is taken back out (${cash.length} left)`);
    t.check(claims[1].status === 'requested',
      'and the claim stays outstanding, so the shop still knows it owes it');

    /* ---------- 7. the link is stored, and stored loosely -------------- */
    t.check(/add column cash_txn_id bigint/.test(migSrc),
      'the claim carries the id of the entry that paid it');
    t.check(!/references cash_txns/.test(migSrc),
      'deliberately not a foreign key — cash_txns is client-owned and rows get deleted, and a blocked deletion would be worse than a dangling id');

    process.exit(t.done() ? 1 : 0);
  })();
}
