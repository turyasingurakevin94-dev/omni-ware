#!/usr/bin/env node
'use strict';
/*
 * The agent feed from the shop's side (index.html, Sales agents): what
 * agents did with their cards, what sold after, and what a bonus would
 * likely do. These pin the two derivations the owner is told, because
 * both are easy to make flattering and wrong: a "sale that followed" must
 * be the SAME agent selling the SAME item soon after acting on it, and a
 * bonus forecast must come from this shop's own finished bonuses or say
 * it has none.
 *
 * Run: node test/agent-feed-studio.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent feed studio');
const src = read('index.html');
const fn = (name) => extractFunction(src, name, 'index.html');
const DAY = 86400000;
const now = Date.parse('2026-09-27T12:00:00Z');
const iso = (days) => new Date(now - days * DAY).toISOString();
const d = (days) => new Date(now - days * DAY).toISOString().slice(0, 10);

/* ---------- 1. what followed a card ----------------------------------- */
{
  let attr;
  try {
    ({ agentFeedAttribution: attr } = compileScope([fn('agentFeedAttribution')],
      { AGENT_FEED_ACTS: ['acted', 'shared', 'quoted', 'cluster'] }, ['agentFeedAttribution']));
  } catch (e) { /* reported below */ }
  t.check(typeof attr === 'function', 'agentFeedAttribution compiles');
  if (attr) {
    const events = [
      { agent_id: 'A1', item_key: 'g::', action: 'shown', created_at: iso(3) },
      { agent_id: 'A1', item_key: 'g::', action: 'shared', created_at: iso(3) },
      { agent_id: 'A2', item_key: 'g::', action: 'notme', created_at: iso(2) },
      { agent_id: 'A1', item_key: 'old::', action: 'quoted', created_at: iso(30) },
    ];
    const line = (pid, qty) => ({ productId: pid, variantIdx: null, qty, sellPrice: 1000 });
    const quotes = [
      { id: 'q1', originAgentId: 'A1', date: d(1), items: [line('g', 2), line('g', 1)] },
      { id: 'q2', originAgentId: 'A2', date: d(1), items: [line('g', 5)] },
      { id: 'q3', originAgentId: 'A1', date: d(1), voided: true, items: [line('g', 9)] },
      { id: 'q4', originAgentId: null, date: d(1), items: [line('g', 9)] },
      { id: 'q5', originAgentId: 'A1', date: d(29), items: [line('old', 3)] },
    ];
    const r = attr(events, quotes, now, 7, 7);
    const g = r.items.find((x) => x.key === 'g::');
    t.check(g.shown === 1 && g.acted === 1 && g.notme === 1, 'shown, acted and "not for me" are counted apart');
    t.check(g.units === 3 && g.value === 3000,
      'the acting agent\'s own order after the tap counts, every line of the item once');
    t.check(r.orders === 1, 'another agent selling the same item is not credited to this card');
    t.check(r.value === 3000, 'nor is a voided order, nor a counter sale');
    t.check(r.agents === 2 && r.taps === 1, 'agents in it and taps are this week\'s, not last month\'s');
    t.check(!r.items.some((x) => x.key === 'old::' && x.units > 0), 'an act outside the window credits nothing');
  }
}

/* ---------- 2. what a bonus would likely do --------------------------- */
{
  let fc;
  try { ({ agentBonusForecast: fc } = compileScope([fn('agentBonusForecast')], {}, ['agentBonusForecast'])); }
  catch (e) { /* reported below */ }
  t.check(typeof fc === 'function', 'agentBonusForecast compiles');
  if (fc) {
    const line = (pid, qty) => ({ productId: pid, variantIdx: null, qty });
    const Q = (days, pid, qty) => ({ originAgentId: 'A1', date: d(days), items: [line(pid, qty)] });
    const quotes = [Q(3, 'g', 4), Q(10, 'g', 4)];
    const none = fc('g::', 2000, quotes, [], now);
    t.check(none.baseline4w === 8 && none.weekWithout === 2, 'the baseline is what agents sold in the last four weeks, a week at a time');
    t.check(none.lift === null && none.weekWith === null && none.cost === null,
      'with no finished bonus in this shop there is no lift and no forecast -- never a borrowed number');

    // A past bonus on another item: 2 a week before it, 4 a week during it.
    const past = [Q(70, 'x', 2), Q(63, 'x', 2), Q(56, 'x', 2), Q(49, 'x', 2), Q(40, 'x', 4), Q(35, 'x', 4)];
    const promos = [{ product_id: 'x', variant_idx: '', starts_at: d(42), ends_at: d(29) }];
    const f = fc('g::', 2000, quotes.concat(past), promos, now);
    t.check(f.liftFrom === 1 && f.lift > 1.5 && f.lift < 3, `the lift comes from what the finished bonus did here (${f.lift && f.lift.toFixed(2)})`);
    t.check(Math.abs(f.weekWith - f.weekWithout * f.lift) < 1e-9, 'and the forecast is the baseline times that lift');
    t.check(f.cost === Math.round(f.weekWith) * 2000, 'costing the bonus on the units it expects');
    const running = fc('g::', 2000, quotes.concat(past), [{ product_id: 'x', variant_idx: '', starts_at: d(5), ends_at: d(-5) }], now);
    t.check(running.lift === null, 'a bonus still running has not finished, so it teaches nothing yet');
  }
}

/* ---------- 3. the panel is on the screen, and never acts by itself ---- */
{
  /* The studio no longer stands open on the screen: the canvas put the
     feed in the rail as a funnel, and "Open feed" there opens this
     panel. It is still in the markup and still drawn with the screen;
     it waits, hidden, for the owner to ask for it. */
  t.check(/<div class="ow-pan ow-fs" id="agFeedPan" hidden>/.test(src), 'the Sales agents screen carries the feed panel, opened from the rail');
  t.check(/function agentFeedCardHTML\(\)\{[\s\S]*?id="agFeedOpen"/.test(src) && /fp\.hidden = !fp\.hidden/.test(src),
    'and the rail\'s feed card is the door to it');
  t.check(/loadAgentFeedTables\(\);\s*renderAgentFeedStudio\(\);/.test(src), 'and it is read and drawn with the rest of the screen');
  const start = (/getElementById\('agFeedStartBonus'\)[\s\S]*?openModal\('promoModal'\);/.exec(src) || [''])[0];
  t.check(/openModal\('promoModal'\)/.test(start) && !/agent_promotions/.test(start),
    '"Set up this bonus" opens the ordinary promotion form filled in -- nothing is saved until the owner saves it');
  t.check(/A card is a nudge, not a sale/.test(src), 'and the panel says a card is a nudge, not proof of a sale');
}

process.exit(t.done() ? 1 : 0);
