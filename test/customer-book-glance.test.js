#!/usr/bin/env node
'use strict';
/*
 * The customer book at a glance: six months of spend on every row, the
 * Needs you today panel beside the map, and the rhythm track.
 *
 * The screen used to say all of this in sentences -- a paragraph per
 * flagged customer, a paragraph under the register, "last bought" and
 * "every" as two columns the reader had to compare in their head. It
 * now draws it. What is pinned here is that every drawing is the SAME
 * arithmetic the figures beside it use, because a picture that disagrees
 * with its own number is worse than no picture:
 *
 *   months         the row's sparkline is six calendar months of spend,
 *                  oldest first, summed in the same loop that totals the
 *                  90-day windows -- so it cannot describe other sales.
 *   today          the panel beside the map: worst first, four shown and
 *                  the rest counted, and totals over the WHOLE book.
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
  CUST_TODAY_SHOWN: 4,
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
  extractFunction(src, 'customerNeedsTodayHTML', 'index.html'),
  extractFunction(src, 'custRhythmTrackHTML', 'index.html'),
], env, ['customerBookRow', 'customerNeedsTodayHTML', 'custRhythmTrackHTML']);

/* ---------- 1. six months of spend, from the same sums ----------------- */
{
  data.customers = [{ id: 'C1', name: 'Kato', debt: 0 }];
  data.savedQuotes = [
    { customerId: 'C1', invoiced: true, invoicedAt: '2026-09-02', sales: 100 },
    { customerId: 'C1', invoiced: true, invoicedAt: '2026-09-20', sales: 50 },
    { customerId: 'C1', invoiced: true, invoicedAt: '2026-06-10', sales: 30 },
    { customerId: 'C1', invoiced: true, invoicedAt: '2026-04-30', sales: 20 },
    { customerId: 'C1', invoiced: true, invoicedAt: '2026-03-31', sales: 999 },   // seven months back
  ];
  const r = scope.customerBookRow(data.customers[0]);
  eq(r.months6, [20, 0, 30, 0, 0, 150], 'April to September, oldest first, each month its own sales');
  t.check(!r.months6.includes(999), 'a month outside the six is left off, not folded into the first');
  eq(r.spend, 150, 'and the 90-day figure beside it, read in the same loop, holds only September (10 June is 107 days back)');
}

/* ---------- 2. needs you today: worst first, the book's totals --------- */
{
  const reason = { terms: { key: 'terms', tone: 'ow-bad', weight: 900, chip: 'late', act: { act: 'chase' } },
    quiet: { key: 'quiet', tone: 'ow-warn', weight: 50, chip: 'quiet', act: { act: 'tel', tel: '0700' } },
    first: { key: 'first_order', tone: '', weight: 5, chip: 'once', act: { act: 'follow' } } };
  const row = (id, key, extra) => Object.assign({ id, name: id, debt: 0, spend: 0, kept: 0, ageDays: -1, daysSinceLast: 40, everyDays: 10, __k: key }, extra);
  const scoped = compileScope([extractFunction(src, 'customerNeedsTodayHTML', 'index.html')],
    Object.assign({}, env, { custAttentionReason: (r) => reason[r.__k] || null }), ['customerNeedsTodayHTML']);
  const all = [row('Q1', 'quiet'), row('T1', 'terms', { debt: 900, ageDays: 70 }), row('F1', 'first'), row('Q2', 'quiet'),
    row('Q3', 'quiet'), row('OK', null, { spend: 1000, kept: 100 })];
  const html = scoped.customerNeedsTodayHTML(all);
  const names = [...html.matchAll(/class="cu-td-n"[^>]*>([^<]+)</g)].map((m) => m[1]);
  eq(names, ['T1', 'Q1', 'Q2', 'Q3'], 'money past terms first, then the quiet, four shown');
  t.check(/1 more in the book below/.test(html), 'and the one not shown is counted, not dropped');
  t.check(/worst first &middot; 5/.test(html), 'the head counts everybody flagged');
  t.check(/Paid 90d<\/p><b class="ow-fig">1,000/.test(html) && /Owed<\/p><b class="ow-fig ow-bad">900/.test(html),
    'the totals underneath are the whole book, not the four shown');
  t.check(/href="tel:0700">Call</.test(html) && /data-cact="chase"[^>]*>Chase</.test(html),
    'each carries the one move that answers it -- a ring is the owner\'s own thumb, a chase opens the chase page');
}

/* ---------- 3. no band of "needs you" -------------------------------
   The three-lane band repeated the map and the register as columns of
   cards; the owner asked for it gone, and it stays gone. What the design
   board asked for in its place is the compact Needs you today panel
   beside the map (section 2), drawn into the map's own container. */
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
  t.check(/customerMapHTML\(all, health\)/.test(render) && /customerNeedsTodayHTML\(all\)/.test(render),
    'the map and the panel beside it are drawn over the whole book, never the page');
}

process.exit(t.done() ? 1 : 0);
