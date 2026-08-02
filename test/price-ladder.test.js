#!/usr/bin/env node
'use strict';
/*
 * The price ladder in the agent app -- the volume curve drawn as a shape,
 * above the table that already spelled out each band.
 *
 * The table answers "what does each band cost". The chart answers "where
 * am I on the curve and how far is the next drop", which is the question
 * an agent standing in front of a customer is actually asking, and the one
 * a list of rows cannot answer at a glance.
 *
 * It makes a claim about money -- "worth N on this line" -- so the
 * arithmetic is checked here rather than trusted. The rules it must not
 * break:
 *
 *   - never advertise a saving on a rung that is not cheaper
 *   - never state a gap in packs unless it lands on whole packs, the same
 *     honesty rule buildTierDisplayRows() already follows
 *   - never show a nudge once the top rung is reached
 *
 * Run: node test/price-ladder.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('price ladder');
const src = read('agent.html');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtUGX = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

let fns = null, err = null;
try {
  fns = compileScope(
    [
      extractFunction(src, 'tierGapLabel', 'agent.html'),
      extractFunction(src, 'tierLadderChartHTML', 'agent.html'),
      extractFunction(src, 'tierForQty', 'agent.html'),
    ],
    { esc, fmtUGX }, ['tierGapLabel', 'tierLadderChartHTML', 'tierForQty'],
  );
} catch (e) { err = e; }
t.check(!!fns, `the ladder compiles${err ? ` (${err.message})` : ''}`);

const LADDER = [
  { minQty: 1, unitPrice: 4500, tier: 'retail' },
  { minQty: 12, unitPrice: 4200, tier: 'wholesale' },
  { minQty: 60, unitPrice: 3900, tier: 'wholesale' },
  { minQty: 120, unitPrice: 3700, tier: 'wholesale' },
];

if (fns) {
  const { tierGapLabel, tierLadderChartHTML, tierForQty } = fns;
  const chart = (qty, viewUnit) =>
    tierLadderChartHTML(LADDER, tierForQty(LADDER, qty), qty, 'pc', 'box', 12, viewUnit || 'unit');

  /* ---------- 1. the saving figure ---------------------------------- */
  {
    // At 24 the agent is on the 4,200 rung. Next is 60 at 3,900.
    // Gap 36. Saving is the 300 drop across the 60 they would then buy.
    const h = chart(24);
    t.check(/36 more pc/.test(h), 'the gap to the next breakpoint is stated');
    t.check(/3,900/.test(h), 'so is the price it unlocks');
    t.check(/18,000/.test(h), 'and the saving is drop x next breakpoint (300 x 60 = 18,000)');

    // Arithmetic held separately from the markup, so a formatting change
    // cannot quietly alter what is being claimed.
    const worth = (cur, next) => Math.round((cur.unitPrice - next.unitPrice) * next.minQty);
    t.check(worth(LADDER[1], LADDER[2]) === 18000, 'saving from the 12 rung to the 60 rung');
    t.check(worth(LADDER[2], LADDER[3]) === 24000, 'saving from the 60 rung to the 120 rung');
  }

  /* ---------- 2. it stays quiet when there is nothing to offer ------- */
  {
    const top = chart(140);
    t.check(/Best price on this item/.test(top), 'the top rung says so rather than inventing a next step');
    t.check(!/more pc/.test(top), 'and offers no gap to close');

    // A ladder that does not fall must not advertise a saving.
    const flat = [
      { minQty: 1, unitPrice: 4500, tier: 'retail' },
      { minQty: 12, unitPrice: 4500, tier: 'wholesale' },
    ];
    const h = tierLadderChartHTML(flat, tierForQty(flat, 4), 4, 'pc', 'box', 12, 'unit');
    t.check(!/worth/.test(h), 'a flat ladder promises nothing');

    // Neither must one that rises -- a real possibility once a floor price
    // is max(cost, discounted) and cost moves between bands.
    const rising = [
      { minQty: 1, unitPrice: 4000, tier: 'retail' },
      { minQty: 12, unitPrice: 4300, tier: 'wholesale' },
    ];
    const r = tierLadderChartHTML(rising, tierForQty(rising, 4), 4, 'pc', 'box', 12, 'unit');
    t.check(!/worth/.test(r), 'a rising ladder promises nothing either');
  }

  /* ---------- 3. the gap is said in a unit that can be bought -------- */
  {
    t.check(tierGapLabel(24, 'pc', 'box', 12, 'pack') === '2 more box',
      'a gap landing on whole packs is stated in packs');
    t.check(tierGapLabel(25, 'pc', 'box', 12, 'pack') === '25 more pc',
      'one that does not falls back to the base unit rather than inventing 2.08 boxes');
    t.check(tierGapLabel(24, 'pc', 'box', 12, 'unit') === '24 more pc',
      'and it follows whichever unit the agent is actually typing in');
    t.check(tierGapLabel(5, 'pc', 'box', 0, 'pack') === '5 more pc',
      'an item with no pack size never claims packs');
  }

  /* ---------- 4. the bars encode the curve --------------------------- */
  {
    const h = chart(24);
    const heights = (h.match(/height:(\d+)%/g) || []).map(s => Number(s.match(/\d+/)[0]));
    t.check(heights.length === LADDER.length, `one bar per rung (${heights.length})`);
    t.check(heights[0] === 100, 'the dearest rung is full height');
    t.check(heights[heights.length - 1] === 44, 'the cheapest is still a visible bar, not a sliver');
    t.check(heights.every((v, i) => i === 0 || v <= heights[i - 1]),
      'and they descend, because the price does');

    // Relative, not absolute: the same curve shape at a different scale
    // must produce the same bars.
    const scaled = LADDER.map(x => ({ ...x, unitPrice: x.unitPrice * 20 }));
    const hs = (tierLadderChartHTML(scaled, tierForQty(scaled, 24), 24, 'pc', 'box', 12, 'unit')
      .match(/height:(\d+)%/g) || []).map(s => Number(s.match(/\d+/)[0]));
    t.check(JSON.stringify(hs) === JSON.stringify(heights),
      'a ladder twenty times the price draws the same shape');
  }

  /* ---------- 5. current and next rung are marked apart -------------- */
  {
    const h = chart(24);
    t.check((h.match(/class="b on"/g) || []).length === 1, 'exactly one rung is marked as reached');
    t.check((h.match(/class="b next"/g) || []).length === 1, 'and exactly one as the next step');
    t.check(h.indexOf('class="b on"') < h.indexOf('class="b next"'),
      'with the next step to the right of the current one');

    const low = chart(1);
    t.check(/class="b on"/.test(low), 'quantity 1 sits on a real rung');
  }

  /* ---------- 6. it never renders for a ladder with nothing to show -- */
  {
    t.check(tierLadderChartHTML([{ minQty: 1, unitPrice: 4500 }], null, 1, 'pc', 'box', 12, 'unit') === '',
      'a single-band item draws no chart');
    t.check(tierLadderChartHTML([], null, 1, 'pc', 'box', 12, 'unit') === '', 'nor does an empty ladder');
    t.check(tierLadderChartHTML(null, null, 1, 'pc', 'box', 12, 'unit') === '', 'nor a missing one');
  }

  /* ---------- 7. it is escaped ---------------------------------------- */
  {
    const h = tierLadderChartHTML(LADDER, tierForQty(LADDER, 24), 24, '<img src=x onerror=alert(1)>', 'box', 12, 'unit');
    t.check(!/<img src=x/.test(h), 'a unit carrying markup is escaped, not rendered');
    t.check(/&lt;img/.test(h), 'and survives as text');
  }
}

/* ---------- 8. wired into the render, chart before table ------------- */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/ladderWrap\.innerHTML = tierLadderChartHTML\(/.test(code),
    'the chart is rendered into the ladder mount');
  t.check(code.indexOf('tierLadderChartHTML(tiers, earnedRow') < code.indexOf('<div class="ag-tier-ladder">'),
    'above the table rather than below it');
  t.check(/rerender\(\)/.test(code) && /qtyEl\.addEventListener\('change', rerender\)/.test(code),
    'and redraws whenever the quantity changes');
}

process.exit(t.done() ? 1 : 0);
