#!/usr/bin/env node
'use strict';
/*
 * The customer book at a glance: the strip, the share of the 90 days,
 * and the rhythm track on every row.
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
 *   no band        the three lanes of "needs you" are gone, at the
 *                  owner's word: they listed the late, the quiet and the
 *                  bought-once a third time, after the map and the
 *                  register. What is pinned now is that they stay gone.
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
  esc: (s) => String(s),
};
const scope = compileScope([
  extractFunction(src, 'customerBookRow', 'index.html'),
  extractFunction(src, 'customerPulseHTML', 'index.html'),
  extractFunction(src, 'customerShareHTML', 'index.html'),
  extractFunction(src, 'custRhythmTrackHTML', 'index.html'),
], env, ['customerBookRow', 'customerPulseHTML', 'customerShareHTML', 'custRhythmTrackHTML']);

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

/* ---------- 3. no band of "needs you" -------------------------------
   It repeated the map and the register as three columns of cards; the
   owner asked for it gone. Its container, its builder and its drawing
   call all went, so it cannot come back half-wired. */
{
  const render = extractFunction(src, 'renderCustomers', 'index.html');
  t.check(!/customerAttentionHTML/.test(src), 'the band builder is gone from the file');
  t.check(!/id="custAttentionWrap"/.test(src), 'and so is the place it was drawn');
  t.check(!/custAttentionWrap/.test(render), 'and the screen no longer shows or hides it');
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
