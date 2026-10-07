#!/usr/bin/env node
'use strict';
/*
 * Days out of the ordinary.
 *
 * unusualDays walks the last week and names the days whose sales,
 * margin, money out or stock counted short fell well outside THIS
 * shop's usual for that weekday -- the median and the spread of the
 * last eight of it. A day that is merely below the middle, as half of
 * all days are, is not named; a Saturday that always swings is not
 * named for swinging; a shop too new to have a usual is told so.
 *
 * Run: node test/unusual-days.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('unusual days');
const src = read('index.html');
/* The Manager screen is renderManager and the seven bed painters it hands
   every reading to (mgrPaint<Bed>), so a pin on "the render" reads all
   eight: what used to sit in one function is drawn by the bed it belongs to. */
const MGR_RENDER = ['renderManager', 'mgrPaintBrief', 'mgrPaintSim', 'mgrPaintTargets', 'mgrPaintPlays',
  'mgrPaintUnusual', 'mgrPaintAsk', 'mgrPaintRecord'];
const mgrRender = () => MGR_RENDER.map((n) => extractFunction(src, n, 'index.html')).join('\n');
const api = read('api/assistant.js');
const TODAY = '2026-09-24'; // a Thursday
const day = (n) => new Date(Date.parse(TODAY) + n * 86400000).toISOString().slice(0, 10);
const weekday = (d) => new Date(d + 'T12:00:00Z').getUTCDay(); // 0 = Sunday

/* A shop, day by day: sales, profit, invoices, cash out, counts. */
function shop(weeks, override) {
  const days = {};
  for (let i = weeks * 7; i >= 0; i--) {
    const d = day(-i);
    // Steady trade with a little wobble; Saturdays swing hard; closed Sundays.
    const wd = weekday(d);
    if (wd === 0) continue;
    const wobble = ((i * 37) % 11 - 5) * 20000;            // -100k .. +100k
    let sales = wd === 6 ? [2000000, 6000000, 3500000, 5000000, 2500000, 4500000, 3000000, 5500000, 4000000, 2200000][i % 10] : 1000000 + wobble;
    days[d] = { sales, profit: Math.round(sales * (0.2 + ((i % 5) - 2) * 0.005)), out: 50000 + ((i * 13) % 7) * 5000,
      counts: [], invoices: [{ client: { name: 'Regular' }, total: sales, profit: Math.round(sales * 0.2) }] };
  }
  (override || []).forEach((o) => { days[o.d] = Object.assign(days[o.d] || { sales: 0, profit: 0, out: 0, counts: [], invoices: [] }, o.set); });
  return days;
}

/* `books` lays the stock log and the count records on as the app really
   keeps them (section 2b); without it each day's counts are typed
   'count', the older shape a reader must still honour. */
function build(days, books) {
  const b = books || {};
  const cashTxns = [], stockLog = [];
  Object.entries(days).forEach(([d, x]) => {
    if (x.out) cashTxns.push({ date: d, type: 'payment', amount: x.out, category: x.outWhat || 'Transport' });
    (x.counts || []).forEach((c) => stockLog.push({ date: d, type: 'count', key: 'P1', label: c.label, delta: -c.qty, cost: c.cost }));
  });
  const data = { cashTxns, stockLog: stockLog.concat(b.stockLog || []), products: [],
    presetStockCounts: b.presetStockCounts || {} };
  return compileScope([
    'unusualDays', 'unusualDayReading', 'unusualSpread', 'unusualDrivers', 'unusualLine',
    'anShiftDate', 'dayWeekday',
    /* Which log rows are counts -- the Inventory screen's own answer,
       compiled for real: a stocktake is written as a 'correction'. */
    'invCountMoment', 'invCountRecords', 'stockCountIndex', 'stockLogIsCount',
  ].map((n) => extractFunction(src, n, 'index.html')).concat([
    'UNUSUAL_WEEKS', 'UNUSUAL_MIN', 'UNUSUAL_Z', 'UNUSUAL_LOOKBACK', 'UNUSUAL_WORDS', 'INV_NOT_A_COUNT',
  ].map((n) => extractDeclaration(src, n, 'index.html'))), {
    data, todayISO: () => TODAY,
    dayPulse: (d) => { const x = days[d]; return x ? { date: d, sales: x.sales, profit: x.profit, collected: 0, till: 0, any: true }
      : { date: d, sales: 0, profit: 0, collected: 0, till: 0, any: false }; },
    anInvoicesInRange: (d) => (days[d] ? days[d].invoices : []),
    savedQuoteTotal: (q) => q.total, anInvoiceTotals: (q) => ({ profit: q.profit }),
    cashIsMoneyIn: (x) => x.type === 'receipt',
    buyKeyParts: b.buyKeyParts || (() => null), getFIFOUnitCost: b.getFIFOUnitCost || (() => null),
    fmtUGX: (n) => Number(n).toLocaleString('en-US') + ' UGX', fmtShortDate: (d) => d.slice(5),
    Math, Date, Number, String, Map, Array, isFinite,
  }, ['unusualDays', 'unusualLine']);
}

/* ---------- 1. the ordinary week says nothing -------------------------- */
{
  const u = build(shop(10)).unusualDays(TODAY);
  t.check(u.judged >= 6, 'a shop with ten weeks of books is judged (' + u.judged + ' days)');
  t.check(u.items.length === 0, 'and an ordinary week names no day, however each sat against the middle (got ' + u.items.map((x) => x.date + ' ' + x.metric).join(', ') + ')');
}

/* ---------- 2. the days that are not ordinary -------------------------- */
{
  const yWed = day(-1), mon = day(-3), tue = day(-2);
  const days = shop(10, [
    { d: yWed, set: { sales: 200000, profit: 40000, invoices: [{ client: { name: 'Regular' }, total: 200000, profit: 40000 }] } },
    { d: mon, set: { sales: 3200000, profit: 640000, invoices: [{ client: { name: 'Kato Construction' }, total: 2300000, profit: 460000 }, { client: { name: 'Walk-in' }, total: 900000, profit: 180000 }] } },
    { d: tue, set: { sales: 1000000, profit: 30000, invoices: [{ client: { name: 'Mulongo' }, total: 800000, profit: 0 }, { client: { name: 'Walk-in' }, total: 200000, profit: 30000 }],
      counts: [{ label: 'Cement — Hima 50kg', qty: 10, cost: 32000 }] } },
    { d: TODAY, set: { sales: 100000, profit: 20000, out: 900000, outWhat: 'Supplier advance', invoices: [] } },
  ]);
  const s = build(days);
  const u = s.unusualDays(TODAY);
  const find = (d, m) => u.items.find((x) => x.date === d && x.metric === m);
  const low = find(yWed, 'sales');
  t.check(low && low.dir === 'low', 'yesterday at a fifth of a usual Wednesday is named, low');
  t.check(low && /^1 invoice$/.test(low.drivers[0]), 'with what drove it from the day\'s own rows: ' + (low && low.drivers[0]));
  const high = find(mon, 'sales');
  t.check(high && high.dir === 'high' && /Kato Construction/.test(high.drivers[0]), 'a big Monday is named high, with its largest invoice: ' + (high && high.drivers[0]));
  const margin = find(tue, 'margin');
  t.check(margin && /^Mulongo at 0%/.test(margin.drivers[0]), 'a day that sold at 3% is named, with the invoice that sold at cost: ' + (margin && margin.drivers[0]));
  const short = find(tue, 'stock_short');
  t.check(short && short.value === 320000 && /Cement — Hima 50kg: 10 short, 320,000 UGX/.test(short.drivers[0]),
    'a count that found ten bags short is valued at what they cost and named: ' + (short && short.drivers[0]));
  const out = find(TODAY, 'cash_out');
  t.check(out && /Supplier advance/.test(out.drivers[0]), 'money out today well past usual is named even while the day is trading');
  t.check(!find(TODAY, 'sales'), 'but today\'s sales are never judged — a day still trading is not a slow day at noon');
  t.check(/^Sales well below a usual Wednesday, 09-23: 200,000 UGX — usually .* over the last 8 Wednesdays$/.test(s.unusualLine(low)),
    'said in the owner\'s words, against the usual and how many weeks it rests on: ' + s.unusualLine(low));
}

/* ---------- 2b. a count as the count screen really writes it ----------- */
{
  /* The count screen has no 'count' type to write. The difference it
     finds goes to the log as a 'correction', and the count itself is
     kept by line in the presets, stamped with that row's own moment --
     spelled "…Z" there and "…+00:00" by the database once the log has
     been read back. Neither row carries a cost: a count that takes goods
     off is valued at what the line cost (FIFO). And a correction that is
     NOT a count -- a delivery taken back because the goods never came --
     must not be read as a stocktake that found the shelf short. */
  const tue = day(-2), mon = day(-3);
  const s = build(shop(10), {
    stockLog: [
      { id: 71, key: 'P1::0', label: 'Iron sheets — G28', type: 'correction', delta: -4, qtyAfter: 6,
        date: tue, at: tue + 'T10:15:00.250+00:00', note: '' },
      { id: 72, key: 'P2', label: 'Tiles', type: 'correction', delta: -20, qtyAfter: 0, date: tue,
        at: tue + 'T16:00:00+00:00', note: 'Delivery on PINV-0012 undone — those goods never came', source: 'buy-order' },
      { id: 73, key: 'P2', label: 'Tiles', type: 'correction', delta: -20, qtyAfter: 0, date: mon,
        at: mon + 'T16:00:00+00:00', note: 'Delivery on PINV-0011 undone — those goods never came', source: 'buy-order' },
    ],
    presetStockCounts: {
      'P1::0': [{ date: tue, at: tue + 'T10:15:00.250Z', found: 6, record: 10 }],
      // A count that matched the book: no row on the log, nothing short.
      P3: [{ date: tue, at: tue + 'T11:00:00.000Z', found: 12, record: 12 }],
    },
    buyKeyParts: (k) => (k === 'P1::0' ? { productId: 'P1', variantIdx: 0 } : k === 'P2' ? { productId: 'P2', variantIdx: null } : null),
    getFIFOUnitCost: (pid) => (pid === 'P1' ? 45000 : pid === 'P2' ? 30000 : null),
  });
  const u = s.unusualDays(TODAY);
  const short = u.items.find((x) => x.date === tue && x.metric === 'stock_short');
  t.check(!!short, 'a stocktake written as a correction is found by its record, across the two spellings of one moment');
  t.check(short && short.value === 180000,
    'valued at what the line cost — four sheets at 45,000, and not the 600,000 of tiles that never came (got ' + (short && short.value) + ')');
  t.check(short && /^Iron sheets — G28: 4 short, 180,000 UGX/.test(short.drivers[0]) && !short.drivers.some((x) => /Tiles/.test(x)),
    'and named by the line it found short: ' + (short && short.drivers.join(' | ')));
  t.check(!u.items.some((x) => x.date === mon && x.metric === 'stock_short'),
    'a day whose only correction is a delivery taken back has no stocktake on it at all');
}

/* ---------- 3. a swinging Saturday is not unusual for swinging --------- */
{
  let sat = 0; while (weekday(day(-sat)) !== 6) sat++;
  const days = shop(10, [{ d: day(-sat), set: { sales: 5800000, profit: 1160000 } }]);
  const u = build(days).unusualDays(TODAY);
  t.check(!u.items.some((x) => x.date === day(-sat)), 'a 5.8m Saturday in a shop whose Saturdays run 2m–6m is ordinary');
}

/* ---------- 4. too new to have a usual --------------------------------- */
{
  const u = build(shop(3, [{ d: day(-1), set: { sales: 10000 } }])).unusualDays(TODAY);
  t.check(u.judged === 0 && u.items.length === 0, 'three weeks of books judge nothing — there is no usual to be outside of');
}

/* ---------- 4b. what the screen draws ---------------------------------- */
{
  const tue = day(-2);
  const u = build(shop(10, [{ d: tue, set: { sales: 0, profit: 0, invoices: [] } }])).unusualDays(TODAY);
  const x = u.items.find((i) => i.date === tue && i.metric === 'sales');
  t.check(x && Array.isArray(x.past) && x.past.length === 8 && x.past[0].date < x.past[7].date && x.past[7].date === day(-9),
    'a finding keeps the same weekdays it was measured against, oldest first, a week apart');
  t.check(u.days.length === 8 && u.days[0].today && u.days.find((d) => d.date === tue).flags === 1
    && u.days.filter((d) => !d.today && d.judged && !d.flags).length === 5 && u.days.filter((d) => !d.judged).length === 1,
    'and every day looked at is kept with how many findings it had — five calm, one to look at, and the closed Sunday not judged');

  /* WAS: the week as a row of days, the open finding beside its eight
     weekdays, one-line rows for the rest -- drawn from this reading.
     NOW: the Out of the ordinary section draws the fortnight's pulse
     instead (mgrPulseBooks / mgrPulseJudge, pinned in
     test/manager-unusual-pulse.test.js); this reading stays the meeting's,
     and the two shapes above are what the meeting's tool still reads. */
}

/* ---------- 5. wiring --------------------------------------------------- */
{
  const hist = src.slice(src.indexOf('  manager_history: { confirm: false'));
  /* WAS: const unusual = unusualDays(todayISO()) -- the meeting read this
     week-long detector (sales, margin, money out, stock short) while the
     Out of the ordinary section showed the fortnight's pulse, so a day
     could be raised in the meeting that the screen could not answer.
     NOW: the meeting reads the section's own findings through
     mgrUnusualForMeeting (normals applied, answers read first), in the
     fields unusual_days always carried; the item shape is run in
     manager-unusual-pulse.test.js section 19. This detector stays for the
     Brief's own reading (mgrUnusualReading). */
  t.check(/const unusual = await mgrUnusualForMeeting\(\);/.test(hist) && !/unusualDays\(/.test(hist.slice(0, hist.indexOf('\n  standing_policies: {')))
    && /kind: 'unusual_day'/.test(hist) && /unusual_days: unusual\.items\.slice\(0, 8\)/.test(hist) && /unusual_days_not_listed/.test(hist),
    'the Manager reads the screen\'s own findings every meeting, raises the ones since the last, and names how many it did not list');
  t.check(/stock counted short is a question, not a theft/.test(hist) && /never name a cause/.test(api),
    'and is told a finding is a question, never a verdict');
  /* WAS: on the side rail, in the standing bed. Out of the ordinary is a
     section of the Manager's own now, with a painter of its own -- the
     same one an answer repaints with. */
  /* WAS: el.innerHTML = mgrUnusualHTML(mgrUnusualReading()) -- the week.
     NOW: the section draws the fortnight's pulse, mgrPulseReading(). */
  t.check(/<div class="mgr-bed mgr-bed-u"[^>]*>\s*<div id="managerUnusualWrap" class="mgr-slot"><\/div>/.test(src)
    && /el\.innerHTML = mgrUnusualHTML\(mgrPulseReading\(\)\)/.test(extractFunction(src, 'mgrPaintUnusual', 'index.html')),
    'the Manager screen draws it in a section of its own, Out of the ordinary');
  const html = extractFunction(src, 'mgrPulseListHTML', 'index.html') + extractFunction(src, 'mgrPulseVerdict', 'index.html');
  t.check(/Not enough weeks on the books yet/.test(html) && /Nothing broke from normal in the fortnight/.test(html)
    && /The books are too new for me to know a usual day here/.test(html),
    'with an honest word for too-new and for a calm fortnight, never a blank');
  t.check(/dayShown = b\.dataset\.unusualDay;\s*goToTab\('day'\);/.test(src), 'and a row opens The day on that date');
  const save = extractFunction(src, 'mgrAnswerUnusual', 'index.html');
  /* WAS: one row per finding, unusualDay: x.date (its latest day only),
     taken back with mgrUnusualAnswers.delete(key). NOW: one answered row
     per day the finding covers, each under its own unusualDay and the
     finding's metric -- the fields the meeting matches on -- and every
     day not written is taken back. The behaviour (rows written, rollback
     and toast) is run in manager-unusual-pulse.test.js section 17. */
  t.check(/kind: 'question'/.test(save) && /status: 'answered'/.test(save) && /unusualDay: d, metric: x\.metric/.test(save)
    && /x\.days\.map\(d=> d \+ '\|' \+ x\.metric\)/.test(save),
    'a tapped answer is kept as an answered question on each day it covers, so it reaches the next meeting the way every answer does');
  t.check(/mgrUnusualAnswers\.delete\(k\)/.test(save) && /toast\('Could not keep that answer/.test(save), 'and one that could not be kept is taken back and said so');
  /* WAS: owner_said: said.body.answer, from the journal's latest twenty
     question rows only. NOW: the row, or the screen's own answers when the
     row is past those twenty; a 'job' answer is a job by its kind too. */
  t.check(/owner_said: said\.answer/.test(hist) && /said\.learn === 'job'/.test(hist) && /never flag the day again/.test(hist)
    && /!answeredDay\(x\)/.test(hist) && /!!unusual\.answered\(x\.key\)/.test(hist),
    'the meeting reads the owner\'s word on the day, never raises an answered day as news, and turns unentered sales into a job');
  t.check(/unusual_answers_not_read/.test(hist) && /owner_taught: unusual\.taught/.test(hist),
    'a failed read of the answers is named to the meeting, and what the owner taught reaches it');
  t.check(/mgrUnusualAnswersLoad\(\);/.test(mgrRender()), 'and a day answered before stays answered');
}

process.exit(t.done() ? 1 : 0);
