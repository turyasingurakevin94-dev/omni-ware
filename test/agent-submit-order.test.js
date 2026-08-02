#!/usr/bin/env node
'use strict';
/*
 * agent-submit-order -- the only path that creates an agent's order, and
 * the largest function that had never been reviewed as a whole (its only
 * prior coverage was one pricing-parity slice).
 *
 * Most of it holds up, and two things I expected to be bugs were not:
 *
 *   - It sets payload.originAgentId but never the agent_id COLUMN. That is
 *     correct: 0027's saved_quotes_sync_agent_id trigger fires BEFORE
 *     INSERT and derives the column from the payload. Setting it here
 *     would be the duplicate.
 *   - Promotion and cluster keys are built with `variant_idx || ""` while
 *     the lookup uses `variantIdx == null ? "" : variantIdx`. That is the
 *     classic falsy-zero trap and would silently deny every bonus on the
 *     first variant of a variable product -- except variant_idx is a TEXT
 *     column everywhere, so the value is "0", which is truthy. It works,
 *     and it works for a reason worth pinning down.
 *
 * What was missing: nothing stopped the same order being created twice.
 * agent.html disables its button during submit, which covers a double tap
 * on a working connection -- but a submit that lands while the connection
 * drops looks like a failure to the agent, the finally block re-enables the
 * button, and a retry creates a second identical order for the shop to
 * prepare and invoice.
 *
 * Run: node test/agent-submit-order.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent submit order');
const src = read('supabase/functions/agent-submit-order/index.ts');
const strip = (s) => s.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const code = strip(src);

/* ---------- 1. the fingerprint identifies the same order -------------- */
{
  let orderFingerprint = null, err = null;
  try {
    ({ orderFingerprint } = compileScope(
      [extractFunction(src, 'orderFingerprint', 'agent-submit-order')],
      {}, ['orderFingerprint'], { typescript: true },
    ));
  } catch (e) { err = e; }
  t.check(typeof orderFingerprint === 'function',
    `agent-submit-order defines orderFingerprint${err ? ` (${err.message})` : ''}`);

  if (typeof orderFingerprint === 'function') {
    const A = [{ productId: 'p1', variantIdx: 0, qty: 2, agentSellPrice: 5000 },
               { productId: 'p2', variantIdx: null, qty: 1, agentSellPrice: 900 }];

    t.check(orderFingerprint('c1', A) === orderFingerprint('c1', A.slice().reverse()),
      'the same items in a different order fingerprint alike');

    // The retry carries exactly what the first attempt carried.
    t.check(orderFingerprint('c1', A) === orderFingerprint('c1', JSON.parse(JSON.stringify(A))),
      'a re-sent request matches its own first attempt');

    // A stored line carries derived fields the request never had. Those
    // must not enter the fingerprint, or a price moving between the two
    // attempts would hide the duplicate.
    const stored = A.map(it => ({ ...it, price: 3000, sellPrice: 4200, bonusCommission: 120, supplierId: 's1', productName: 'x' }));
    t.check(orderFingerprint('c1', A) === orderFingerprint('c1', stored),
      'a stored line still matches the request that produced it');
    const storedRepriced = stored.map(it => ({ ...it, sellPrice: 9999, price: 8888, bonusCommission: 0 }));
    t.check(orderFingerprint('c1', A) === orderFingerprint('c1', storedRepriced),
      'and still matches if the floor price moved in between');

    // Genuinely different orders must not collide.
    const diffQty = [{ ...A[0], qty: 3 }, A[1]];
    t.check(orderFingerprint('c1', A) !== orderFingerprint('c1', diffQty),
      'a different quantity is a different order');
    const diffPrice = [{ ...A[0], agentSellPrice: 5001 }, A[1]];
    t.check(orderFingerprint('c1', A) !== orderFingerprint('c1', diffPrice),
      "a different price to the agent's client is a different order");
    t.check(orderFingerprint('c1', A) !== orderFingerprint('c2', A),
      'the same basket for a different client is a different order');
    const diffVariant = [{ ...A[0], variantIdx: 1 }, A[1]];
    t.check(orderFingerprint('c1', A) !== orderFingerprint('c1', diffVariant),
      'a different variant is a different order');

    // Variant 0 must not collapse into "no variant" -- the falsy-zero trap
    // in the shape it would actually take here.
    const v0 = [{ productId: 'p1', variantIdx: 0, qty: 1, agentSellPrice: 10 }];
    const vNull = [{ productId: 'p1', variantIdx: null, qty: 1, agentSellPrice: 10 }];
    t.check(orderFingerprint('c1', v0) !== orderFingerprint('c1', vNull),
      'variant 0 is distinguished from no variant at all');

    t.check(orderFingerprint('c1', []) === orderFingerprint('c1', []),
      'an empty basket does not throw');
  }
}

/* ---------- 2. the guard is wired in, and before the work ------------- */
{
  t.check(/\.gte\("payload->>savedAt", cutoff\)/.test(code),
    'the lookup is bounded to recent orders by the timestamp the payload carries');
  t.check(/\.eq\("agent_id", agentId\)/.test(code) && /\.eq\("voided", false\)/.test(code),
    "and scoped to this agent's own live orders");
  t.check(/duplicate: true/.test(code),
    'a repeat submission hands back the original rather than making another');

  // Cheap short-circuit: it must run before the product/price fan-out.
  const iDedupe = code.indexOf('dedupe_lookup');
  const iProducts = code.indexOf('products_lookup');
  const iInsert = code.indexOf('stage: "insert"');
  t.check(iDedupe > 0 && iDedupe < iProducts && iProducts < iInsert,
    'the duplicate check runs before the pricing work and the insert');

  // A short window, deliberately. Guarded: an absent declaration has to
  // report, not throw and take the checks below with it.
  let ms = 0;
  try {
    ms = Function(`return ${(extractDeclaration(src, 'SUBMIT_DEDUPE_MS', 'agent-submit-order').match(/=\s*([^;]+);/) || [])[1]}`)();
  } catch (e) { ms = 0; }
  t.check(ms >= 30 * 1000 && ms <= 5 * 60 * 1000,
    `the window is long enough to cover a retry, short enough not to swallow a real repeat order (${ms || 'not declared'})`);
}

/* ---------- 3. the two things that only LOOK like bugs ---------------- */
{
  // agent_id comes from the trigger, not from this insert.
  t.check(!/agent_id: /.test(code),
    'the insert does not set agent_id itself');
  t.check(/originAgentId: agentId/.test(code),
    'it sets payload.originAgentId, which is what the trigger reads');
  const mig = read('supabase/migrations/0027_saved_quotes_agent_id_hardening.sql');
  t.check(/new\.agent_id := new\.payload->>'originAgentId';/.test(mig)
    && /before insert or update on saved_quotes/.test(mig),
    'and 0027 derives the column from that payload field before insert');

  // The falsy-zero keys are safe only because variant_idx is text. If that
  // column ever becomes an integer, "0" becomes 0, `0 || ""` becomes "",
  // and every first-variant bonus silently disappears.
  t.check(/variant_idx text not null default ''/.test(read('supabase/migrations/0012_sales_agents.sql')),
    'agent_clusters/agent_promotions keep variant_idx as TEXT, which is what makes `variant_idx || ""` safe');
  const zeroAsText = `${'p1'}::${'0' || ''}`;
  const zeroAsInt = `${'p1'}::${0 || ''}`;
  t.check(zeroAsText === 'p1::0' && zeroAsInt === 'p1::',
    'the trap being avoided: "0" survives that idiom and 0 does not');
}

/* ---------- 4. the pricing is still server-side ----------------------- */
/*
 * The whole reason this is a function and not a client insert.
 */
{
  t.check(/sellPrice: priced\.floorPrice/.test(code),
    'what the shop is owed is the floor price computed here');
  t.check(/agentSellPrice: Number\(it\.agentSellPrice\)/.test(code),
    "and the agent's own price to their client is carried separately");
  t.check(!/sellPrice: Number\(it\.sellPrice\)/.test(code),
    'no price from the request body is ever used as what the shop is owed');
  t.check(/if \(payload\.originAgentId !== agentId\)|client\.agent_id !== agentId/.test(code),
    'the client the order is for must belong to the submitting agent');
  t.check(code.indexOf('current_agent_id') < code.indexOf('SERVICE_ROLE_KEY)'),
    'the agent is identified before the service-role client exists');
}

process.exit(t.done() ? 1 : 0);
