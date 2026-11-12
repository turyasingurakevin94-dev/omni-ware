#!/usr/bin/env node
'use strict';
/*
 * Buyer round 1 (docs/audit/buyer/ROUND-1.md), the rules behind BUY-02 · BUY-05 · BUY-07 · BUY-08:
 *
 *   BUY-02  the order's figure is Client pays (Σ qty × sell); a new price moves the Cost, never Client pays;
 *           no Buyer write touches items[].sellPrice
 *   BUY-05  one hold rule: On hold, counted in the On hold filter and in "{Manager} decides", lines "On hold"
 *   BUY-07  farFromList: more than 50% above or below the list warns (2,700 vs 24,000; 15 vs 145,000)
 *   BUY-08  a line with no selling price is Price coming: never over the selling price, never "Price up"
 *
 * Run: node test/buyer-round1-core.test.js
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('buyer round 1 core');
const R = require(path.join(ROOT, 'src/core/buyer/rules.ts'));
const O = require(path.join(ROOT, 'src/apps/buyer/orders/rules.ts'));
const { buyerDemo } = require(path.join(ROOT, 'src/core/buyer/demo/index.ts'));

(async () => {
  /* ---- BUY-07: far from the list ---- */
  t.check(R.farFromList(2700, 24000) === true, 'BUY-07: 2,700 against a list of 24,000 is far');
  t.check(R.farFromList(27000, 24000) === false, 'BUY-07: 27,000 against 24,000 is not');
  t.check(R.farFromList(15, 145000) === true, 'BUY-07: 15 against 145,000 is far');
  t.check(R.farFromList(140000, 145000) === false, 'BUY-07: 140,000 against 145,000 is not');
  t.check(R.farFromList(36001, 24000) === true && R.farFromList(36000, 24000) === false, 'BUY-07: the line is 50% above');
  t.check(R.farFromList(11999, 24000) === true && R.farFromList(12000, 24000) === false, 'BUY-07: and 50% below');
  t.check(R.farFromList(2700, 0) === false && R.farFromList(2700, null) === false, 'BUY-07: no list price, never far');

  /* ---- BUY-02: Client pays stays when a new price moves the cost ---- */
  let d = buyerDemo('?demo', { instant: true });
  let b = await d.books(), now = d.now();
  const v0 = O.orderView(b.orders.find((o) => o.id === 552), b, now);
  t.check(v0.pays === 20 * 47500 + 10 * 26000, `BUY-02: #0552 Client pays is Σ qty × sell (got ${v0.pays})`);
  t.check(v0.cost === 20 * 38000 + 10 * 24000, `BUY-02: its Cost is Σ qty × cost (got ${v0.cost})`);
  await d.ask('s-namanve', 'whatsapp');
  await d.answerPrice('s-namanve', [{ orderId: 552, key: 'L1', cost: 27000 }]);
  b = await d.books();
  const v1 = O.orderView(b.orders.find((o) => o.id === 552), b, now);
  t.check(v1.pays === v0.pays, `BUY-02: after a new price Client pays is unchanged (${v1.pays})`);
  t.check(v1.cost === v0.cost + 30000, `BUY-02: the Cost moves by 10 × 3,000 (${v1.cost})`);

  // No Buyer write in the books touches what the client pays.
  const dir = path.join(ROOT, 'src/core/buyer/supabase');
  const writes = fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]);
  const sets = writes.flatMap(([f, src]) => (src.match(/\.sellPrice\s*=(?!=)|sellPrice\s*:(?!\s*Number\(it\.sellPrice\))/g) || []).map((m) => `${f}: ${m}`));
  t.check(sets.length === 0, `BUY-02: no write in src/core/buyer/supabase sets sellPrice${sets.length ? ' (' + sets.join(', ') + ')' : ''}`);

  /* ---- BUY-08: Price coming ---- */
  d = buyerDemo('?demo&state=midday', { instant: true });
  b = await d.books(); now = d.now();
  const o550 = b.orders.find((o) => o.id === 550), cem = o550.lines[1];
  cem.sell = 0; cem.priceComing = true; cem.ruthDecides = true;
  t.check(O.priceComing(cem) && !O.overSell(cem, 34000), 'BUY-08: no selling price is Price coming, never over it');
  t.check(R.lineState(o550, cem) !== 'priceup', 'BUY-08: its cost never makes it Price up');
  const v550 = O.orderView(o550, b, now);
  t.check(v550.coming === 1 && v550.pays === 40 * 47500, `BUY-08: Client pays leaves it out and counts 1 price coming (${v550.pays}, ${v550.coming})`);
  t.check(!O.matches(v550, 'ruth'), 'BUY-08: not in "Ruth decides"');
  t.check(O.switchOptions(b, cem, 'cement').every((r) => !r.ruth), 'BUY-08: a switch never says Ruth decides for it');

  /* ---- BUY-05: one hold ---- */
  const o554 = b.orders.find((o) => o.id === 554);
  o554.hold = 'cancel';
  const h = O.holdOf(o554), v554 = O.orderView(o554, b, now);
  t.check(h && h.word === 'On hold' && h.why === 'Cancel asked', 'BUY-05: holdOf says On hold · Cancel asked');
  t.check(O.matches(v554, 'hold') && O.matches(v554, 'ruth') && !O.matches(v554, 'asked'), 'BUY-05: in On hold, counted in Ruth decides, not in Asked');
  t.check(O.lineSees(o554, 'asked') === 'On hold' && O.lineSees(o550, 'found') === 'Found', 'BUY-05: its lines read On hold; others their own word');
  t.check(O.holdOf(o550) === null, 'BUY-05: an order not held has no hold');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
