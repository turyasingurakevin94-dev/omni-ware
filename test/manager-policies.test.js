#!/usr/bin/env node
'use strict';
/*
 * Standing policies: the Manager's repeated advice becomes standing
 * rules the app then watches daily without AI credit.
 *
 * The owner asked for a mind that "implements strategies, plans". A
 * strategy that has to be repeated every morning is not implemented --
 * it is nagging. Stage 3 lets the Manager propose turning recurring
 * advice into the shop's own dials (chase timing, per-line restock
 * rules, order-stage limits), each behind the same confirm card as
 * every other write. The laws guarded here:
 *
 *   ONE READING     standingPoliciesData feeds the tool and the Manager
 *                   screen alike -- they can never disagree.
 *   NEVER ERASES    a policy call that mentions one side of a rule
 *                   KEEPS the other side -- half-said is not half-gone.
 *   CARDS ALWAYS    all three policy writes confirm, none executes
 *                   until the owner taps.
 *   GROUNDED        the mind is told: read what stands first, at most
 *                   one proposal per occasion, numbers from derived
 *                   figures only.
 *
 * Run: node test/manager-policies.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the standing policies');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* One scope serves every behavioural section: the real registry with
   the real policy helpers, over a shared data fixture. */
const data = {
  products: [
    { id: 'P1', name: 'Cement', type: 'simple' },
    { id: 'P2', name: 'Hoe', type: 'variable', variants: [{ name: 'Small' }, { name: 'Big' }] },
  ],
  presetReorderRules: {},
  presetOrderStageLimits: {},
  presetChaseAfterDays: 7,
  presetChaseRestDays: 3,
  presetRestockCoverDays: 14,
  presetStageAlerts: false,
};
const calls = { saveData: 0 };
const env = {
  data,
  saveData: () => { calls.saveData++; },
  renderChaseScreen: () => {}, renderChaseBadge: () => {}, renderSavedQuotes: () => {},
  debtChaseRows: () => ({ due: [{ id: 1 }, { id: 2 }], resting: [{ id: 3 }], blocked: [] }),
  productVariantLabel: (p, vi) => p.name + (vi != null ? ' — ' + p.variants[vi].name : ''),
  fmtUGX: (n) => `${Math.round(n).toLocaleString('en-US')} UGX`,
  Math, Number, String, Array, Object, JSON,
};
const scope = compileScope([
  extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
  extractDeclaration(src, 'SQ_STATUSES', 'index.html'),
  extractDeclaration(src, 'SQ_STATUS_ORDER', 'index.html'),
  extractFunction(src, 'standingPoliciesData', 'index.html'),
  extractFunction(src, 'reorderRuleFor', 'index.html'),
  extractFunction(src, 'setReorderRule', 'index.html'),
  extractFunction(src, 'stockKey', 'index.html'),
  extractFunction(src, 'deriveMoveOutcome', 'index.html'),
  'function names(){ return { ASSISTANT_TOOLS, standingPoliciesData, deriveMoveOutcome }; }',
], env, ['names']);
const { ASSISTANT_TOOLS: T, standingPoliciesData, deriveMoveOutcome } = scope.names();

/* ---------- 1. one reading, and the tool answers with it ------------- */
{
  data.presetReorderRules = { 'P1': { minUnits: 10, coverDays: 0 }, 'P2::1': { minUnits: 0, coverDays: 21 } };
  data.presetOrderStageLimits = { preparing: 90, completed: 0 };
  const pol = standingPoliciesData();
  eq(pol.chase.after_days, 7, 'the chase grace is read from the shop dial');
  eq(pol.chase.rest_days, 3, 'and so is the rest');
  eq(pol.restock.rules_count, 2, 'every standing restock rule is found, product or variant');
  const byKey = {};
  pol.restock.rules.forEach((r) => { byKey[r.key] = r; });
  eq(byKey['P1'].min_units, 10, 'a simple product rule under its bare key');
  eq(byKey['P2::1'].cover_days, 21, 'a variant rule under its composite key');
  eq(byKey['P2::1'].item, 'Hoe — Big', 'named for a person, not keyed for a machine');
  eq(pol.stages.limits.length, 1, 'a zero minutes limit is no limit — only real limits are listed');
  eq(pol.stages.limits[0].label, 'Step 3. Being Prepared', 'with the board’s own label');

  t.check(T.standing_policies && T.standing_policies.confirm === false,
    'standing_policies answers freely — it reads and nothing more');
  const answered = T.standing_policies.run();
  eq(answered.chase.after_days, 7, 'and the tool answers from the same reading');

  /* Cap without concealment. */
  for (let i = 0; i < 13; i++) {
    data.products.push({ id: 'X' + i, name: 'Item' + i, type: 'simple' });
    data.presetReorderRules['X' + i] = { minUnits: 5, coverDays: 0 };
  }
  const capped = T.standing_policies.run();
  eq(capped.restock.rules.length, 12, 'the tool caps the rule list');
  eq(capped.restock.rules_count, 15, 'while the true count still travels — capped is not concealed');
  data.products.length = 2;
  Object.keys(data.presetReorderRules).forEach((k) => { if (k.startsWith('X')) delete data.presetReorderRules[k]; });

  /* The screen reads the SAME derivation -- never a second hand-built
     copy of the dials. */
  const render = extractFunction(src, 'renderManager', 'index.html');
  t.check(/standingPoliciesData\(\)/.test(render),
    'the Manager screen’s standing-rules list comes from standingPoliciesData');
  t.check(/The standing rules/.test(render), 'and the screen names the section for what it is');
}

/* ---------- 2. chase timing: one dial said, the other kept ----------- */
{
  const before = calls.saveData;
  const out = T.set_chase_timing.run({ after_days: 10 });
  eq(data.presetChaseAfterDays, 10, 'the said dial moves');
  eq(data.presetChaseRestDays, 3, 'the unsaid dial stays exactly where it was');
  t.check(calls.saveData > before, 'and the change is saved, not just held in memory');
  eq(out.queue_now.to_chase, 2, 'the answer carries what the queue looks like under the new policy');

  t.check(T.set_chase_timing.confirm === true, 'chase policy goes through a card');
  t.check(/rest 5 days between chases of one customer \(now 3\)/.test(T.set_chase_timing.summary({ rest_days: 5 })),
    'the card says what stands today beside what is proposed');
  let threw = null;
  try { T.set_chase_timing.run({}); } catch (e) { threw = e.message; }
  t.check(/at least one/.test(threw || ''), 'a call that says nothing sets nothing');
  threw = null;
  try { T.set_chase_timing.run({ after_days: 5000 }); } catch (e) { threw = e.message; }
  t.check(/between 0 and 90/.test(threw || ''), 'an absurd number of days is refused, not obeyed');
  data.presetChaseAfterDays = 7;
}

/* ---------- 3. restock rule: the merge law --------------------------- */
{
  data.presetReorderRules = { 'P2::1': { minUnits: 0, coverDays: 21 } };
  T.set_restock_rule.run({ product_id: 'P2', variant_index: 1, min_units: 6 });
  eq(data.presetReorderRules['P2::1'].minUnits, 6, 'the said side is set');
  eq(data.presetReorderRules['P2::1'].coverDays, 21,
    'and the UNSAID side survives — a policy call never silently erases the half it did not mention');

  t.check(/replaces never below 6 units, 21 days of cover/.test(T.set_restock_rule.summary({ product_id: 'P2', variant_index: 1, min_units: 8 })),
    'the card names the whole rule it replaces, both sides');
  T.set_restock_rule.run({ product_id: 'P2', variant_index: 1, min_units: 0, cover_days: 0 });
  eq(data.presetReorderRules['P2::1'], undefined,
    'both zero removes the rule entirely — the setReorderRule law, a rule that says nothing is not stored as zeroes');

  let threw = null;
  try { T.set_restock_rule.run({ product_id: 'NOPE', min_units: 5 }); } catch (e) { threw = e.message; }
  t.check(/find_product first/.test(threw || ''), 'an unknown product is refused with the way to resolve it');
  threw = null;
  try { T.set_restock_rule.run({ product_id: 'P1' }); } catch (e) { threw = e.message; }
  t.check(/at least one/.test(threw || ''), 'a call that says nothing sets nothing');
  t.check(T.set_restock_rule.confirm === true, 'restock policy goes through a card');
}

/* ---------- 4. stage limits: the board's own dial -------------------- */
{
  let threw = null;
  try { T.set_stage_limit.run({ stage: 'shipped', minutes: 60 }); } catch (e) { threw = e.message; }
  t.check(/stage must be one of/.test(threw || ''), 'an invented stage is refused with the real ones listed');
  const out = T.set_stage_limit.run({ stage: 'preparing', minutes: 120 });
  eq(data.presetOrderStageLimits.preparing, 120, 'the limit lands on the board’s own preset');
  eq(out.stage, 'Step 3. Being Prepared', 'answered with the human label');
  t.check(/alerts are OFF/i.test(out.note || ''),
    'and with alerts off the answer says the board flags on screen only — never a claim of pushes that will not come');
  t.check(T.set_stage_limit.confirm === true, 'stage policy goes through a card');
  t.check(/now 120/.test(T.set_stage_limit.summary({ stage: 'preparing', minutes: 60 })),
    'the card says what stands today beside what is proposed');
}

/* ---------- 5. a policy move is answered by the presets -------------- */
{
  data.presetReorderRules = { 'P1': { minUnits: 10, coverDays: 0 } };
  const move = (key) => ({ date: '2026-08-25', status: 'open', body: { mkind: 'policy', subject: key ? { key } : {} } });
  eq(deriveMoveOutcome(move('P1')).derived, 'a standing rule now covers it',
    'an adopted rule is derived from the presets themselves, never from a stored claim');
  eq(deriveMoveOutcome(move('P9')).derived, 'no standing rule yet', 'and honestly when nothing stands');
  eq(deriveMoveOutcome(move(null)).derived, null,
    'a policy move with no line to check says nothing — named, not guessed');
}

/* ---------- 6. the mind's discipline, and the server's offer --------- */
{
  t.check(/STANDING POLICIES\./.test(api), 'the policy discipline lives in the manager extension');
  t.check(/Read standing_policies before you propose one/.test(api),
    'what stands is read before anything is proposed — no longer claiming to be the first thing read, which collided with the meeting’s own first call');
  t.check(/At most ONE policy proposal per meeting or review/.test(api),
    'one proposal per occasion — a constitution is not rewritten daily');
  t.check(/never taste/.test(api), 'every number grounded in a derived figure, never taste');
  t.check(/executes nothing until the owner approves/.test(api),
    'and the card law is restated where the policies are taught');
  t.check(/kind is one of: chase, buy, invoice, settle, price, policy, other/.test(api),
    'the plan block admits a policy move');
  t.check(/cashbook, payroll, presets\./.test(api), 'and the presets door is offered');
  const doors = extractDeclaration(src, 'MANAGER_DOORS', 'index.html');
  t.check(/presets: \{ tab: 'presets'/.test(doors), 'a door that actually opens the Presets screen');

  ['standing_policies', 'set_chase_timing', 'set_restock_rule', 'set_stage_limit'].forEach((n) =>
    t.check(new RegExp(`name: '${n}',`).test(api), `${n} is offered to the model`));
  t.check(api.indexOf("name: 'set_stage_limit'") < api.indexOf("name: 'add_sourcing_lead'"),
    'the new tools sit INSIDE the cached prefix — add_sourcing_lead still closes it');
  t.check(/KEEPS its current value/.test(api),
    'the merge law is stated in the schema the model reads, not just enforced after it guesses wrong');
}

process.exit(t.done() ? 1 : 0);
