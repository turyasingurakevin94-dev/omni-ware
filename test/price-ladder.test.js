#!/usr/bin/env node
'use strict';
/*
 * The price ladder in the agent app -- now one pill on an order line:
 * "↓ 80 cheaper".
 *
 * The ladder used to be a chart and a table in an add sheet. The order
 * line carries the only part of it an agent acts on standing in front of
 * a customer: the next quantity that makes the line cheaper. Tapping it
 * sets that quantity, and the line re-reads what the shop charges.
 *
 * It makes a claim about money, so the rules are checked here rather than
 * trusted:
 *
 *   - never offer a rung that is not cheaper
 *   - never offer a leap: past three times what is on the line it stops
 *     being "a few more" and becomes a different customer
 *   - never state a rung in packs unless it lands on whole packs
 *   - once the line reaches a rung, it is priced at it -- the same rule the
 *     server applies again on submit (tieredUnitPrice)
 *
 * Run: node test/price-ladder.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('price ladder');
const src = read('agent.html');

let fns = null, err = null;
const saved = [];
try {
  fns = compileScope(
    ['tierForQty', 'lineUsesPack', 'lineMult', 'nextTierHint', 'setLineQty'].map((n) => extractFunction(src, n, 'agent.html')),
    { saveQuoteDraft: () => saved.push(1) },
    ['tierForQty', 'nextTierHint', 'setLineQty', 'lineMult'],
  );
} catch (e) { err = e; }
t.check(!!fns, `the ladder helpers compile${err ? ` (${err.message})` : ''}`);

const LADDER = [
  { minQty: 1, unitPrice: 4500, tier: 'retail' },
  { minQty: 12, unitPrice: 4200, tier: 'wholesale' },
  { minQty: 60, unitPrice: 3900, tier: 'wholesale' },
  { minQty: 120, unitPrice: 3700, tier: 'wholesale' },
];
const line = (qty, over) => Object.assign({
  qty, displayQty: qty, unit: 'pc', displayUnit: 'pc', packUnit: 'box', packQty: 12,
  tiers: LADDER, floorPrice: fns ? fns.tierForQty(LADDER, qty).unitPrice : 0, agentSellPrice: 5000,
}, over || {});

if (fns) {
  const { tierForQty, nextTierHint, setLineQty } = fns;

  /* ---------- 1. the rung a quantity earns ---------------------------- */
  {
    t.check(tierForQty(LADDER, 1).unitPrice === 4500, 'one is retail');
    t.check(tierForQty(LADDER, 11).unitPrice === 4500 && tierForQty(LADDER, 12).unitPrice === 4200,
      'the breakpoint is inclusive -- twelve is the first wholesale piece');
    t.check(tierForQty(LADDER, 500).unitPrice === 3700, 'and the top rung holds above it');
  }

  /* ---------- 2. the hint is a step, and cheaper ---------------------- */
  {
    const h = nextTierHint(line(24));
    t.check(h && h.baseQty === 60 && h.unitPrice === 3900, 'at 24 the next rung is 60 at 3,900');
    t.check(nextTierHint(line(10)).baseQty === 12, 'at 10, two more reach the first wholesale rung');
    t.check(nextTierHint(line(3)) === null,
      'at 3 the next rung (12) is four times the line -- a leap, not a nudge, so nothing is offered');
    t.check(nextTierHint(line(130)) === null, 'at the top rung there is nothing cheaper to offer');
    const flat = [{ minQty: 1, unitPrice: 4500 }, { minQty: 12, unitPrice: 4500 }];
    t.check(nextTierHint(line(10, { tiers: flat, floorPrice: 4500 })) === null,
      'a rung that is not cheaper is never offered -- a saving the agent cannot deliver is worse than silence');
    t.check(nextTierHint(line(10, { tiers: null })) === null, 'and a line with no ladder offers nothing');
  }

  /* ---------- 3. said in the unit on the line, when it divides --------- */
  {
    const boxes = line(24, { displayQty: 2, displayUnit: 'box' });
    const h = nextTierHint(boxes);
    t.check(h.baseQty === 60 && h.displayQty === 5, 'a line in boxes is told "5" -- sixty pieces is five whole boxes');
    const odd = [{ minQty: 1, unitPrice: 4500 }, { minQty: 50, unitPrice: 3900 }];
    const h2 = nextTierHint(line(24, { displayQty: 2, displayUnit: 'box', tiers: odd, floorPrice: 4500 }));
    t.check(h2.baseQty === 50 && h2.displayQty === null,
      'a rung that does not land on whole boxes is stated in pieces, never as a fraction of a box');
  }

  /* ---------- 4. reaching it reprices the line ------------------------ */
  {
    const it = line(24);
    setLineQty(it, 60);
    t.check(it.qty === 60 && it.floorPrice === 3900 && it.tier === 'wholesale',
      'sixty pieces is priced at the sixty rung, and the line says which tier it is on');
    t.check(it.agentSellPrice === 5000, 'while the price the agent charges their client is left as they set it');
    const b = line(24, { displayQty: 2, displayUnit: 'box' });
    setLineQty(b, 5);
    t.check(b.qty === 60 && b.floorPrice === 3900, 'five boxes is sixty pieces, and priced as sixty');
    t.check(saved.length === 2, 'and every change is kept, so a reload does not undo it');
  }
}

/* ---------- 5. wired into the line ---------------------------------- */
{
  const render = extractFunction(src, 'renderCart', 'agent.html');
  t.check(/const hint = nextTierHint\(it\);/.test(render) && /data-tier="\$\{hint\.baseQty\}"/.test(render),
    'the open line shows the hint, carrying the rung it would reach');
  t.check(/aria-label="Make it \$\{hint\.displayQty \|\| hint\.baseQty\} for a cheaper price"/.test(render),
    'and says what tapping it does, since its face is only a number and an arrow');
  const click = (/const tier = e\.target\.closest\('\[data-tier\]'\);[\s\S]*?return;\s*\}/.exec(src) || [''])[0];
  t.check(/it\.displayUnit = it\.unit;/.test(click) && /setLineQty\(it, base \/ mult\)/.test(click),
    'tapping it sets the quantity, switching the line to pieces only when the rung is not whole boxes');
}

process.exit(t.done() ? 1 : 0);
