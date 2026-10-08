#!/usr/bin/env node
'use strict';
/*
 * What pays the agent more: bonus items.
 *
 * There were three shelves on the Sell hub. They became three quick views
 * in Find (Bonus, New, Sold before) and the bonus cards in Today's Next
 * move, because an agent asks "what should I be pushing?" either while
 * planning the day or while standing in an aisle -- never while scrolling
 * a hub.
 *
 * The judgement calls are what this file pins:
 *
 *   - a bonus flag is short enough for a tile corner, and a percentage
 *     keeps its sign, or "+3" and "+900" read as the same kind of thing
 *   - a countdown appears only in a bonus's last week; marking everything
 *     urgent teaches an agent to ignore the mark
 *   - a bonus only pays on an item in the agent's cluster, so an item card
 *     offers the star before it offers the sale
 *
 * Run: node test/agent-shelves.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent shelves');
const src = read('agent.html');

/* ---------- 1. what a bonus flag says ------------------------------- */
{
  let f = null;
  try { f = compileScope([extractFunction(src, 'bonusFlagLabel', 'agent.html')], {}, ['bonusFlagLabel']); } catch (e) { /* below */ }
  t.check(!!f, 'bonusFlagLabel compiles');
  if (f) {
    t.check(f.bonusFlagLabel({ bonusType: 'fixed', bonusValue: 900 }) === '+900', 'a fixed bonus is just the number');
    t.check(f.bonusFlagLabel({ bonusType: 'fixed', bonusValue: 12500 }) === '+12,500',
      'grouped, so a four-figure bonus is still readable at badge size');
    t.check(f.bonusFlagLabel({ bonusType: 'percent', bonusValue: 3 }) === '+3%',
      'and a percentage keeps its sign, or it cannot be told from money');
    t.check(f.bonusFlagLabel(null) === '', 'no promotion, no flag');
  }
}

/* ---------- 2. where bonus items show up ------------------------------ */
{
  const tile = extractFunction(src, 'findTileHTML', 'agent.html');
  t.check(/promo \? `<span class="ax-pt-tag bonus">\$\{esc\(bonusFlagLabel\(promo\)\)\} each<\/span>`/.test(tile),
    'a bonus item says so on its tile, in the corner, with what it pays');
  t.check(/\$\{promo \? `<button type="button" class="ax-pt-star/.test(tile),
    'and only a bonus item carries the star -- starring anything else would earn nothing');
  t.check(/aria-pressed="\$\{!!inCluster\}"/.test(tile), 'the star says whether it is on, to a screen reader too');
  const items = extractFunction(src, 'findItems', 'agent.html');
  t.check(/if\(findFilter\.bonus\)\{ const p = promotedMap\(\); items = items\.filter/.test(items),
    'the Bonus view is every item a bonus is running on today');
  const sheet = extractFunction(src, 'openCategorySheet', 'agent.html');
  t.check(/k:'bonus', n: promoted\.size/.test(sheet) && /\.filter\(x=> x\.n > 0\)/.test(sheet),
    'and its tile shows how many there are, and only when there are any');
}

/* ---------- 3. the bonus card on Today ------------------------------- */
{
  const card = extractFunction(src, 'nextCardHTML', 'agent.html');
  t.check(/c\.daysLeft != null && c\.daysLeft <= 7/.test(card),
    'a countdown only in the last week -- a month out is not urgent');
  t.check(/const starNeeded = c\.kind === 'bonus' && !c\.inCluster;/.test(card) && /data-nx-act="star"/.test(card),
    'an item outside the cluster offers the star first, because the bonus only pays on starred items');
  t.check(/Bought before by/.test(card), 'and names the clients who have bought it before -- the people worth telling');
}

process.exit(t.done() ? 1 : 0);
