#!/usr/bin/env node
'use strict';
/*
 * The customer book at a glance: the strip, the share of the 90 days,
 * the three lanes of "needs you", and the rhythm track on every row.
 *
 * The screen used to say all of this in sentences -- a paragraph per
 * flagged customer, a paragraph under the register, "last bought" and
 * "every" as two columns the reader had to compare in their head. It
 * now draws it. What is pinned here is that every drawing is the SAME
 * arithmetic the figures beside it use, because a picture that disagrees
 * with its own number is worse than no picture:
 *
 *   weeks          the weekly columns are the 90-day spend, split by
 *                  week in the same loop that totals it -- so they sum
 *                  to the figure printed above them, exactly.
 *   share          only drawn once there are four buyers: with three,
 *                  "the top three" is the whole list, not a finding.
 *   lanes          each reason goes to the lane for its job -- money to
 *                  chase, going quiet, bought once -- and nothing is
 *                  listed twice or dropped.
 *   rhythm         the dot sits at how long it has been against three
 *                  times their own gap, green within the gap and amber
 *                  past twice it: the same line custAttentionReason
 *                  already calls quiet.
 *
 * Run: node test/customer-book-glance.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer book at a glance');
const src = read('index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-09-25';
const data = { customers: [], savedQuotes: [], presetChaseAfterDays: 30 };
const ago = (d) => new Date(Date.parse(TODAY + 'T00:00:00Z') - d * 864e5).toISOString().slice(0, 10);
const env = {
  data,
  CUST_WINDOW_DAYS: 90,
  CUST_ATTENTION_SHOWN: 5,
  CUST_DOTS_MAX: 48,
  todayISO: () => TODAY,
  daysBetweenISO: (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5),
  daysSinceDate: (d) => d ? Math.round((Date.parse(TODAY + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 864e5) : -1,
  customerOrdersFor: (id) => data.savedQuotes.filter((q) => q.customerId === id),
  anInvoiceTotals: (q) => ({ sales: q.sales, profit: q.sales * 0.1, estimatedQty: 0 }),
  customerStats: () => ({ everyDays: null, daysSinceLast: null, last: null, overdue: false, orderCount: 1, openCount: 0 }),
  contactPhones: (c) => c.phone ? [c.phone] : [],
  bothSidesPosition: () => null,
  customerOldestOpenChargeDate: () => null,
  custTermsPhrase: () => 'past your 30-day terms',
  custTermsDays: () => 30,
  custActionHTML: (r, act) => act ? `<button data-cact="${act.act}">${act.label}</button>` : '',
  esc: (s) => String(s),
};
const scope = compileScope([
  extractFunction(src, 'customerBookRow', 'index.html'),
  extractFunction(src, 'customerPulseHTML', 'index.html'),
  extractFunction(src, 'customerShareHTML', 'index.html'),
  extractFunction(src, 'customerAttentionHTML', 'index.html'),
  extractFunction(src, 'custAttentionRank', 'index.html'),
  extractFunction(src, 'custRhythmTrackHTML', 'index.html'),
], env, ['customerBookRow', 'customerPulseHTML', 'customerShareHTML', 'customerAttentionHTML', 'custRhythmTrackHTML']);

/* ---------- 1. the weeks add up to the figure --------------------------- */
{
  data.customers = [{ id: 'C1', name: 'Kato', debt: 0 }, { id: 'C2', name: 'Nakato', debt: 0 }];
  data.savedQuotes = [
    { customerId: 'C1', invoiced: true, invoicedAt: ago(0), sales: 100 },
    { customerId: 'C1', invoiced: true, invoicedAt: ago(6), sales: 50 },
    { customerId: 'C1', invoiced: true, invoicedAt: ago(7), sales: 30 },
    { customerId: 'C2', invoiced: true, invoicedAt: ago(89), sales: 20 },
    { customerId: 'C2', invoiced: true, invoicedAt: ago(90), sales: 999 },   // outside the window
  ];
  const rows = data.customers.map(scope.customerBookRow);
  eq(rows[0].weeks.slice(0, 2), [150, 30], 'this week and last week, newest first');
  eq(rows[1].weeks[12], 20, 'day 89 lands in the thirteenth week, not off the end');
  const weekly = rows.reduce((n, r) => n + r.weeks.reduce((a, b) => a + b, 0), 0);
  const paid = rows.reduce((n, r) => n + r.spend, 0);
  eq(weekly, paid, 'the columns sum to exactly what the strip prints as paid');
  eq(rows[1].spendPrev, 999, 'and the day-90 invoice goes to the window before, as it always did');
}

/* ---------- 2. the share bar needs a finding to show -------------------- */
{
  const r = (name, spend) => ({ name, spend });
  eq(scope.customerShareHTML([r('A', 5), r('B', 3), r('C', 2)], 10), '',
    'three buyers: the top three is the whole list, so nothing is drawn');
  const html = scope.customerShareHTML([r('A', 50), r('B', 30), r('C', 15), r('D', 5), r('E', 0)], 100);
  t.check(/3 customers pay you 95%/.test(html), 'four buyers: the top three and their share are said');
  t.check(/cu-sh-r/.test(html) && /1 other/.test(html), 'and the rest is one segment, counted, never dropped');
}

/* ---------- 3. every reason in its lane, once --------------------------- */
{
  const row = (id, key, extra) => ({ id, name: id, phones: ['0700'], debt: 0, ageDays: -1, spend: 0, spendPrev: 0,
    daysSinceLast: 10, everyDays: 4, stats: { average: 0, sales: 0 }, __key: key, ...extra });
  const reason = (r) => ({
    terms: { key: 'terms', tone: 'ow-bad', fig: '1,000', weight: 1000, act: { act: 'chase', label: 'Draft the chase' } },
    nophone: { key: 'nophone', tone: 'ow-bad', fig: '500', weight: 500, act: { act: 'edit', label: 'Add a number' } },
    quiet: { key: 'quiet', tone: 'ow-warn', fig: '40', weight: 90, act: { act: 'tel', label: 'Ring them' } },
    spend_down: { key: 'spend_down', tone: 'ow-warn', fig: '−40%', weight: 80, act: { act: 'open', label: 'Open' } },
    first_order: { key: 'first_order', tone: '', fig: '9', weight: 9, act: { act: 'follow', label: 'Add a follow-up' } },
  })[r.__key] || null;
  const scoped = compileScope([extractFunction(src, 'customerAttentionHTML', 'index.html'),
    extractFunction(src, 'custAttentionRank', 'index.html'), extractFunction(src, 'custRhythmTrackHTML', 'index.html')],
    { ...env, custAttentionReason: reason }, ['customerAttentionHTML']);
  const rows = [row('T', 'terms', { debt: 1000, ageDays: 52 }), row('N', 'nophone', { debt: 500, phones: [] }),
    row('Q', 'quiet'), row('S', 'spend_down'), row('F', 'first_order'), row('OK', 'none')];
  const html = scoped.customerAttentionHTML(rows);
  const lanes = html.split('class="ow-pan cu-lane').slice(1);
  eq(lanes.length, 3, 'three lanes');
  const names = (lane) => [...lane.matchAll(/class="cu-lr-n"[^>]*>([^<]+)</g)].map((m) => m[1]);
  eq(names(lanes[0]), ['T', 'N'], 'money to chase holds the late and the unreachable, worst first');
  eq(names(lanes[1]), ['Q', 'S'], 'going quiet holds the quiet and the shrinking');
  eq(names(lanes[2]), ['F'], 'and the first buyers who did not come back have their own');
  t.check(/Money to chase[\s\S]*1,500 UGX/.test(lanes[0]), 'the chase lane says how much money it holds');
  t.check(/cu-age-t/.test(lanes[0]) && /left:33\.3%/.test(lanes[0]), 'the age bar marks the shop\'s own terms');
  t.check(!/>OK</.test(html), 'a customer with no reason is not in any lane');
  eq((html.match(/class="cu-lr-n"/g) || []).length, 5, 'nobody listed twice');
  t.check(/cu-lanes cu-lanes-3/.test(html), 'and the layout knows how many lanes it is laying out');
  const one = scoped.customerAttentionHTML([row('F', 'first_order')]);
  t.check(/cu-lanes-1/.test(one) && !/Money to chase/.test(one), 'an empty lane is not drawn');
}

/* ---------- 4. the rhythm track ----------------------------------------- */
{
  const at = (html) => Number((/left:([\d.]+)%/.exec(html) || [])[1]);
  const within = scope.custRhythmTrackHTML({ everyDays: 10, daysSinceLast: 5 });
  t.check(/cu-rh-ok/.test(within) && at(within) === 16.7, 'within their gap: green, a sixth of the way along');
  const between = scope.custRhythmTrackHTML({ everyDays: 10, daysSinceLast: 15 });
  t.check(!/cu-rh-ok|cu-rh-late/.test(between), 'between one and two gaps: plain ink, neither good nor bad');
  const late = scope.custRhythmTrackHTML({ everyDays: 10, daysSinceLast: 21 });
  t.check(/cu-rh-late/.test(late), 'past twice their gap: amber -- the line the band already calls quiet');
  eq(at(scope.custRhythmTrackHTML({ everyDays: 10, daysSinceLast: 400 })), 100, 'and a long silence pins to the end rather than running off it');
  eq(scope.custRhythmTrackHTML({ everyDays: null, daysSinceLast: 12 }), '', 'one order is not a rhythm, so no track is drawn');
}

/* ---------- 5. the register draws it ------------------------------------ */
{
  const row = extractFunction(src, 'customerRegisterRowHTML', 'index.html');
  t.check(/custRhythmTrackHTML\(r\)/.test(row), 'every row with a rhythm draws the track');
  t.check(!/data-l="Last bought"/.test(row) && !/data-l="Every"/.test(row),
    'and "last bought" and "every" are no longer two columns to compare in your head');
  const render = extractFunction(src, 'renderCustomers', 'index.html');
  t.check(/customerPulseHTML\(all,/.test(render), 'the strip is drawn over the whole book, never the page');
}

process.exit(t.done() ? 1 : 0);
