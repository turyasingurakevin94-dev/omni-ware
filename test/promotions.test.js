#!/usr/bin/env node
'use strict';
/*
 * Supplier-funded promotions.
 *
 * starts_at and ends_at were saved by this form, edited by this form, and
 * rendered NOWHERE. The card had one signal -- the `active` flag -- and
 * treated it as the whole answer, so a promotion that ended in June and
 * one running today were the same green card.
 *
 * They are not the same thing. `active` is the admin's own switch; the
 * window is the schedule, and agent-submit-order enforces it:
 *
 *   (!p.starts_at || p.starts_at <= today) && (!p.ends_at || p.ends_at >= today)
 *
 * Measured on the running app with today at 2026-08-05, four promotions
 * all showing as on:
 *
 *   P002  1 Apr – 30 Jun   ENDED 36 days ago      server paid nothing
 *   P003  starts 1 Nov     NOT STARTED, 88 days   server paid nothing
 *   P001  1 Jul – 30 Sep   running
 *   P001  no window        running -- ON THE SAME PRODUCT as the one above
 *
 * Half of them were dead and the shop had no way to tell. And the last
 * pair is worse than dead: agent-submit-order keys promotions into a Map,
 * so the second row for a product silently replaces the first, and its
 * query carries no ORDER BY -- which one pays is whatever Postgres
 * returns first.
 *
 * Run: node test/promotions.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('promotions');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const submitSrc = read('supabase/functions/agent-submit-order/index.ts');

const TODAY = '2026-08-05';
const data = { savedQuotes: [], products: [], suppliers: [] };
const NAMES = ['promotionRunsOn', 'promotionState', 'promotionKey', 'promotionEarnings',
  'promotionClashes', 'promotionPosition', 'promotionWhenLabel', 'daysBetweenPromo',
  'daysSinceDate', 'agingDaysLabel'];
let scope = null; let err = null;
try {
  scope = compileScope([
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'PROMO_STATES', 'index.html'),
  ], { data, todayISO: () => TODAY, fmtShortDate: (s) => String(s) }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the promotion helpers compile${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
/* THE CARD BECAME A ROW, and the fetch left the renderer.
 *
 * Promotions were a sub-tab of the agents screen, read the first time
 * somebody opened that tab. They are now part of the screen itself -- a
 * clash between two live promotions is money, and it was invisible from
 * the roster anybody actually opens -- so the read moved into
 * loadAgentSideTables() and renderAgentPromotions draws from whatever
 * has arrived, which is why it is no longer async.
 *
 * `card` is kept as the name: promotionRowHTML emits a row that .ow-tbl
 * turns back into a card on a phone, from the same call. */
const card = (/function promotionRowHTML\(promo\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const render = (/function renderAgentPromotions\(\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const posHTML = (/function promotionPositionHTML\(\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const save = (/promo_save'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
const del = (/async function deletePromotion\(id\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];

const promo = (id, over) => Object.assign({ id, product_id: 'P001', variant_idx: '',
  supplier_id: null, bonus_type: 'fixed', bonus_value: 1000,
  starts_at: null, ends_at: null, active: true }, over || {});

/* ---------- 1. the window decides, and the same way it does live ------ */
if (scope) {
  eq(scope.promotionRunsOn(promo(1, { starts_at: '2026-07-01', ends_at: '2026-09-30' }), TODAY), true,
    'a promotion inside its window runs');
  eq(scope.promotionRunsOn(promo(2, { starts_at: '2026-04-01', ends_at: '2026-06-30' }), TODAY), false,
    'one that finished does not');
  eq(scope.promotionRunsOn(promo(3, { starts_at: '2026-11-01' }), TODAY), false,
    'nor does one that has not started');
  eq(scope.promotionRunsOn(promo(4), TODAY), true, 'and one with no window always does');
  /* The boundaries are inclusive on BOTH sides, because the server's are:
     `starts_at <= today` and `ends_at >= today`. An exclusive test here
     would make the first and last day of every promotion disagree with
     what agents were actually paid. */
  eq(scope.promotionRunsOn(promo(5, { starts_at: TODAY }), TODAY), true, 'the first day counts');
  eq(scope.promotionRunsOn(promo(6, { ends_at: TODAY }), TODAY), true, 'and so does the last');

  /* Four states, not two. "Not paying" covered three quite different
     situations, and they need three different actions: switch it on,
     wait, or renew it. */
  eq(scope.promotionState(promo(7, { active: false }), TODAY), 'off', 'switched off is its own state');
  eq(scope.promotionState(promo(8, { starts_at: '2026-11-01' }), TODAY), 'scheduled', 'as is not started');
  eq(scope.promotionState(promo(9, { ends_at: '2026-06-30' }), TODAY), 'ended', 'as is finished');
  eq(scope.promotionState(promo(10), TODAY), 'running', 'and running is the only one that pays');
  /* Switched off wins over the window: it is the admin's own decision and
     the more useful thing to say. A promotion both off and expired needs
     the same action either way. */
  eq(scope.promotionState(promo(11, { active: false, ends_at: '2026-06-30' }), TODAY), 'off',
    'a promotion switched off says so rather than reporting its window');
  /* A window that closes before it opens satisfies neither of the
     server's tests on any day there will ever be. Neither of the other
     answers is true about it -- "starts in 88 days" promises a run that
     will not happen, "ended 36 days ago" claims one that never did -- so
     it needs a state of its own. Saving one is refused now, but rows
     predating that check exist. */
  eq(scope.promotionState(promo(12, { starts_at: '2026-11-01', ends_at: '2026-06-30' }), TODAY), 'never',
    'and a window that closes before it opens is neither scheduled nor ended');
  eq(scope.promotionRunsOn(promo(13, { starts_at: '2026-11-01', ends_at: '2026-06-30' }), TODAY), false,
    'because there is no day on which it pays');
}

/* ---------- 2. said the way somebody would say it -------------------- */
if (scope) {
  eq(scope.promotionWhenLabel(promo(1, { ends_at: '2026-09-30' }), 'running', TODAY), 'Ends in 56 days',
    'a running promotion says how long is left');
  eq(scope.promotionWhenLabel(promo(2, { starts_at: '2026-11-01' }), 'scheduled', TODAY), 'Starts in 88 days',
    'a scheduled one says how long until it starts');
  eq(scope.promotionWhenLabel(promo(3, { ends_at: '2026-06-30' }), 'ended', TODAY), 'Ended 36 days ago',
    'and a finished one how long ago it stopped paying');
  eq(scope.promotionWhenLabel(promo(4), 'running', TODAY), 'No end date — runs until switched off',
    'while one with no end says that rather than inventing a date');
  /* agingDaysLabel(0) is "Today", which reads as "Ends in Today". The last
     day is worth saying plainly: it is the one needing a decision before
     the shop closes. */
  eq(scope.promotionWhenLabel(promo(5, { ends_at: TODAY }), 'running', TODAY), 'Ends today',
    'and the last day is said as the last day');
  eq(scope.promotionWhenLabel(promo(6, { starts_at: TODAY }), 'scheduled', TODAY), 'Starts today',
    'as is the first');
}

/* ---------- 3. what it actually produced ----------------------------- *
 * bonusCommission is snapshotted onto the order line at submit time --
 * the amount really granted, not a recomputation -- so this is what the
 * promotion has cost its funder, rather than what it would pay today.
 */
if (scope) {
  const line = (pid, qty, bonus, over) => Object.assign({ productId: pid, variantIdx: null, qty, bonusCommission: bonus }, over || {});
  const order = (id, agentId, items, over) => Object.assign({ id, originAgentId: agentId, voided: false, items }, over || {});
  data.savedQuotes = [
    order(1, 'AG001', [line('P001', 40, 80000)]),
    order(2, 'AG001', [line('P001', 10, 20000)]),
    // Same product, no bonus: an agent who never added it to their cluster
    // earns nothing on it, and counting that would credit the promotion
    // with business it did not cause.
    order(3, 'AG001', [line('P001', 5, 0)]),
    // A different product, a voided order, and a shop order with no agent.
    order(4, 'AG001', [line('P002', 25, 60000)]),
    order(5, 'AG001', [line('P001', 100, 200000)], { voided: true }),
    order(6, null, [line('P001', 100, 200000)]),
  ];
  const e = scope.promotionEarnings(promo(1, { product_id: 'P001' }));
  eq(e.units, 50, 'units are counted only where a bonus was actually paid');
  eq(e.bonus, 100000, 'and the bonus is what was granted at the time');
  eq(e.orders, 2, 'across the orders that earned it');
  eq(scope.promotionEarnings(promo(2, { product_id: 'P999' })).bonus, 0,
    'a promotion nobody has sold on reports nothing rather than nothing at all');

  /* A variant is part of the identity. Keyed on the product alone, a
     promotion on one variant would collect every other variant's sales. */
  eq(scope.promotionKey('P001', ''), 'P001::', 'a product with no variant keys bare');
  eq(scope.promotionKey('P001', '0'), 'P001::0',
    'and variant zero keys as zero rather than falling back to the bare key');
  /* As a NUMBER too. Every caller happens to pass a string today, so
     `variantIdx || ''` gives the same answer and the guard looks
     decorative -- until something passes the index itself, when variant
     zero silently becomes the bare product and collects every other
     variant's sales. */
  eq(scope.promotionKey('P001', 0), 'P001::0', 'including when it arrives as a number rather than a string');
  eq(scope.promotionKey('P001', null), 'P001::', 'while no variant at all is still bare');
  data.savedQuotes = [order(7, 'AG001', [line('P001', 4, 8000, { variantIdx: 1 })])];
  eq(scope.promotionEarnings(promo(3, { product_id: 'P001', variant_idx: '' })).bonus, 0,
    'so a promotion on the plain product does not collect a variant’s sales');
  eq(scope.promotionEarnings(promo(4, { product_id: 'P001', variant_idx: '1' })).bonus, 8000,
    'and the one on that variant does');
}

/* ---------- 4. two promotions on one product ------------------------- *
 * Not a richer offer -- an ambiguous one. The server keys them into a
 * Map, so the second silently replaces the first.
 */
if (scope) {
  t.check(/new Map\(\s*\(promoRows \|\| \[\]\)/.test(submitSrc.replace(/\n\s*/g, ' ')),
    'the server really does key promotions into a Map, which is what makes two of them ambiguous');

  const all = [
    promo(1, { product_id: 'P001' }),
    promo(2, { product_id: 'P001' }),
    promo(3, { product_id: 'P002' }),
    promo(4, { product_id: 'P001', active: false }),
    promo(5, { product_id: 'P001', ends_at: '2026-06-30' }),
  ];
  eq(scope.promotionClashes(all[0], all, TODAY).length, 1, 'two running promotions on one product see each other');
  eq(scope.promotionClashes(all[2], all, TODAY).length, 0, 'a product with only one does not');
  /* Neither a switched-off one nor an expired one can pay, so neither
     competes -- flagging them would make the warning noise and teach
     people to ignore the real one. */
  t.check(!scope.promotionClashes(all[0], all, TODAY).some((p) => p.id === 4),
    'a switched-off promotion is not a clash, because it cannot pay');
  t.check(!scope.promotionClashes(all[0], all, TODAY).some((p) => p.id === 5),
    'nor is one whose window has closed');
  eq(scope.promotionClashes(all[3], all, TODAY).length, 0,
    'and a switched-off promotion is not itself in a clash');

  t.check(/Only one of them pays, and which is not decided anywhere/.test(card),
    'and the card says the ambiguity is unresolved, not merely that there are two');
  /* Pinned on the guard, not the words inside it: `if(false && ...)`
     leaves every string present and unreachable. */
  t.check(/if\(clashing\.length && !confirm\(/.test(save),
    'while creating a second asks first');
  t.check(/This product already has/.test(save) && /Add this one anyway\?/.test(save),
    'naming how many are already running');
  t.check(/Add this one anyway\?`\)\) return;/.test(save), 'and saying no adds nothing');
}

/* ---------- 5. the total cannot be larger than what was paid --------- *
 * A line records the bonus AMOUNT, never which promotion produced it.
 * Summed per promotion, two on one product both reported the same
 * figure and the shop's total came out larger than its actual bill.
 */
if (scope) {
  const line = (pid, qty, bonus) => ({ productId: pid, variantIdx: null, qty, bonusCommission: bonus });
  data.savedQuotes = [
    { id: 1, originAgentId: 'AG001', voided: false, items: [line('P001', 40, 100000)] },
    { id: 2, originAgentId: 'AG001', voided: false, items: [line('P002', 25, 60000)] },
  ];
  const all = [promo(1, { product_id: 'P001' }), promo(2, { product_id: 'P001' }), promo(3, { product_id: 'P002' })];
  const p = scope.promotionPosition(all, TODAY);
  eq(p.bonus, 160000, 'the bonus is totalled once per product, not once per promotion');
  eq(p.total, 3, 'while the promotions are still all counted');
  eq(p.running, 3, 'and all three are running');
  eq(p.clashes, 2, 'with both halves of the clashing pair flagged');
  t.check(/The figures above cover the product, not this promotion alone/.test(card),
    'and the card says whose figures they are when two share a product');
}

/* ---------- 6. the roster of promotions at a glance ------------------ */
if (scope) {
  data.savedQuotes = [];
  const all = [
    promo(1, { ends_at: '2026-09-30' }),
    promo(2, { product_id: 'P002', ends_at: '2026-06-30' }),
    promo(3, { product_id: 'P003', starts_at: '2026-11-01' }),
    promo(4, { product_id: 'P004', active: false }),
  ];
  const p = scope.promotionPosition(all, TODAY);
  eq(p.running, 1, 'the header counts what is actually paying');
  eq(p.ended, 1, 'keeping the finished ones apart');
  eq(p.scheduled, 1, 'from the ones not started');
  eq(p.off, 1, 'and from the ones switched off');
  /* A live promotion nobody has sold under is the one worth chasing: it
     is agreed, funded, and earning its supplier nothing. */
  eq(p.runningUnsold, 1, 'and a running promotion nobody has sold on is singled out');

  /* It was a figure in a bordered box floating above a grid of cards; it
     is now the first clause of the note under the table, because it is a
     sentence about the table rather than a heading over it. Same claim,
     same lead: how many are paying, not how many exist. */
  t.check(/are actually paying today/.test(posHTML),
    'the note leads with how many are paying rather than how many exist');
  t.check(/never been sold on/.test(posHTML), 'and names the ones producing nothing');
}

/* ---------- 7. ordered by what needs doing --------------------------- */
{
  t.check(/const rank = \{ never: 0, ended: 1, running: 2, scheduled: 3, off: 4 \};/.test(render),
    'a promotion that has stopped paying comes first, because it is the one needing a decision');
  /* Pinned on the comparison, not the table above it: replacing the
     branch with `if(false)` left the ranks sitting in the file unread
     while the check went on passing. */
  t.check(/if\(sa !== sb\) return rank\[sa\] - rank\[sb\];/.test(render),
    'and the ranking is actually applied');
  t.check(/if\(sa === 'running' && ea !== eb\) return ea - eb;/.test(render),
    'and among the live ones the least productive rises, rather than the busiest');
  t.check(!/agentPromotions\.map\(promotionCardHTML\)/.test(render),
    'so the order is no longer whichever was typed last');
}

/* ---------- 8. a window that could never pay ------------------------- */
{
  t.check(/if\(startsAt && endsAt && endsAt < startsAt\)\{[\s\S]{0,260}?return;\s*\}/.test(save),
    'an end before a start is refused outright, since no day satisfies the server’s test');
  /* Backdating an end is legitimate -- closing one off, or recording one
     that already finished -- so this asks rather than refuses. What it
     must not do is stay silent. */
  t.check(/endsAt && endsAt < todayISO\(\)/.test(save) && /will not pay anybody from the moment you save it/.test(save),
    'while an end already in the past asks, because backdating one is a real thing to want');
  t.check(/Save it anyway\?`\)\) return;/.test(save), 'and saying no saves nothing');
}

/* ---------- 9. deleting one that has already paid out ---------------- */
{
  t.check(/const earned = promo \? promotionEarnings\(promo\)/.test(del),
    'deleting looks at what has been earned under it first');
  t.check(/of bonus has already been earned under it across/.test(del),
    'and names it at the moment of the decision');
  /* Not a refusal: the bonuses are snapshotted onto the order lines and
     survive the row going. The difference worth stating is between
     deleting a promotion nobody used and deleting the record of an
     arrangement a supplier has been billed for. */
  t.check(/stays on those orders and stays claimable/.test(del),
    'saying what survives, so the warning is not read as losing the money');
  t.check(/earned\.bonus > 0[\s\S]{0,400}?: ''/.test(del),
    'while one nobody has earned on is deleted without the extra warning');
}

/* ---------- drawn, and said once ---------------------------------------
   Live, two running promotions nobody had sold on carried the same
   sentence as a banner under each row and again in the footnote, and
   the product led with its stock code. */
{
  t.check(/const pname = product \? productVariantLabel\(product, variantIdx\)/.test(card),
    'the product is named as the shop says it, not code-first');
  t.check(!/Running, and no agent has sold one yet\. Nobody is earning from it and its funder is getting nothing\.<\/div>'/.test(card),
    'a running promotion nobody has sold on is no longer a banner under its row');
  t.check(/const unsold = running && !clash\.length && earned\.units === 0;/.test(card) && /class="agv-chip0"/.test(card),
    'it is a "0 sold" chip in the units column instead');
  t.check(/running && !promo\.ends_at \? 'no end date' : when/.test(card) && /class="agv-open"/.test(card),
    'an open-ended window is drawn as running, not cut off mid-sentence');
  t.check(/never been sold on/.test(posHTML), 'and the footnote still counts them, once');
  const claims = (/function renderCommissionClaims\(\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/Nothing waiting on you/.test(claims) && /You settle it into the Cash Book/.test(claims),
    'with no claim waiting, the panel says so first and draws how a claim arrives');
}

process.exit(t.done() ? 1 : 0);
