/*
 * FACTS §5 and §3: the cash book this month (money in), promises to pay,
 * asks to the Manager and to Accounts, the goal and the shop's settings.
 *
 * Money in today (Grace's): 1,044,000 · 3 payments — 8:50 Walk-in Cash 96,000 #0543 ·
 * 8:52 Nansana Mobile 560,000 · 10:40 Kyaligonza Bank 388,000 #0533. The counter's 6 sales
 * (412,000) are the counter team's.
 */
import type { BillAsk, Goal, Method, Ms, PayPromise, Payment, PaymentAsk, ShopSettings } from '../../types.ts';
import { dayOf } from '../../time.ts';
import { d, t } from './clock.ts';
import { GGABA, KATO, KYALIGONZA, LUBOWA, MUKONO, NANSANA } from './orders-live.ts';
import { BRIAN, COUNTER, GRACE } from './people.ts';

const p = (id: number, at: Ms, amount: number, method: Method, customerId: string | null, orderId: number | null, by: string, ref = ''): Payment =>
  ({ id, at, day: dayOf(at), amount, method, customerId, orderId, by, ref, qa: false });

export function payments(): Payment[] {
  return [
    // today
    p(9001, t('8:50'), 96000, 'cash', null, 543, GRACE),
    p(9002, t('8:52'), 560000, 'momo', NANSANA, 538, GRACE, '1204479331'),
    p(9003, t('10:40'), 388000, 'bank', KYALIGONZA, 533, GRACE, 'STB 88120'),
    // the counter's 6 sales (orders-past.ts #0516-#0520, #0554)
    p(9101, t('8:40'), 67000, 'cash', null, 516, COUNTER),
    p(9102, t('9:05'), 38500, 'cash', null, 517, COUNTER),
    p(9103, t('9:20'), 50000, 'cash', null, 518, COUNTER),
    p(9104, t('9:48'), 84000, 'cash', null, 519, COUNTER),
    p(9105, t('10:10'), 37000, 'cash', null, 520, COUNTER),
    p(9106, t('10:25'), 135500, 'cash', null, 554, COUNTER),
    // Friday 16 Oct
    p(8000, d('2026-10-16', '12:20'), 1000000, 'momo', KATO, 545, GRACE, '1203317764'),
    p(8001, d('2026-10-16', '12:20'), 240000, 'cash', KATO, 545, GRACE),
    p(8002, d('2026-10-16', '12:45'), 380000, 'cash', LUBOWA, 540, GRACE),
    p(8003, d('2026-10-16', '13:30'), 119000, 'cash', GGABA, 548, GRACE),
    p(8004, d('2026-10-16', '16:00'), 85500, 'cash', NANSANA, 536, GRACE),
    p(8005, d('2026-10-16', '15:10'), 1990000, 'momo', NANSANA, 538, GRACE, '1203490118'),
    p(8006, d('2026-10-16', '16:30'), 1000000, 'momo', MUKONO, 526, GRACE, '1203512240'),
    p(8007, d('2026-10-16', '17:10'), 409000, 'cash', NANSANA, 527, GRACE),
    // earlier in October
    p(7000, d('2026-10-02', '11:00'), 980000, 'momo', KATO, 511, BRIAN, '1188120456'),
    p(7001, d('2026-10-08', '10:00'), 3620000, 'bank', KATO, 529, GRACE, 'STB 87702'),
    p(7002, d('2026-10-09', '11:20'), 160000, 'momo', KYALIGONZA, 533, BRIAN, '1193442087'),
    p(7003, d('2026-10-11', '15:00'), 1210000, 'momo', MUKONO, 541, GRACE, '1196024411'),
    p(7004, d('2026-10-12', '11:05'), 865000, 'bank', KYALIGONZA, 535, GRACE, 'STB 87915'),
    // Lubowa's payment that names no bill: the one Esther is checking (FACTS §3.1).
    p(7006, d('2026-10-13', '9:40'), 349000, 'momo', LUBOWA, null, GRACE, '1197730052'),
    // Kyaligonza, Wed 14 Oct 10:02: recorded Cash 142,000; it should be Mobile 124,000 (FACTS §4.4).
    p(7005, d('2026-10-14', '10:02'), 142000, 'cash', KYALIGONZA, 533, GRACE),
  ];
}

export function promises(): PayPromise[] {
  return [
    { id: 1, customerId: MUKONO, on: '2026-10-17', madeOn: '2026-10-14', amount: 310000 },
    { id: 2, customerId: GGABA, on: '2026-10-20', madeOn: '2026-10-16', amount: 165000 },
  ];
}

export function billAsks(): BillAsk[] {
  return [
    // #0548: 2 of the 3 bags came back torn → credit 67,000 of 119,000; asked Ruth Fri 15:40 (FACTS §4.4).
    { id: 'ba1', orderId: 548, customerId: GGABA, kind: 'credit', amount: 67000, reason: 'Torn bags', status: 'sent', by: GRACE, at: d('2026-10-16', '15:40') },
    // #0550: cancel asked (FACTS §4.1); on the books, a cancel_asks row (0181).
    { id: 'ba2', orderId: 550, customerId: null, kind: 'cancel', amount: 52000, reason: 'They changed their mind', status: 'sent', by: GRACE, at: t('9:30') },
  ];
}

export function paymentAsks(): PaymentAsk[] {
  return [
    // Kyaligonza's 14 Oct payment: Mobile 124,000, not Cash 142,000; Esther is checking (CH01 "Esther is checking it").
    { id: 'pa1', paymentId: 7005, customerId: KYALIGONZA, orderId: 533, what: 'method', amount: 142000, status: 'sent', by: GRACE, at: t('10:12') },
    { id: 'pa2', paymentId: 7005, customerId: KYALIGONZA, orderId: 533, what: 'amount', amount: 142000, status: 'sent', by: GRACE, at: t('10:12') },
  ];
}

/** Grace's October goal: 35,000,000 (docs/canvas-cast.md; set by Ruth, goal.set). */
export function goal(): Goal {
  return { from: '2026-10-01', to: '2026-10-31', target: 35000000 };
}

export function settings(): ShopSettings {
  return {
    creditPct: 3,          // FACTS §6: ONE "Credit charge" line, 3% of the order
    holdDays: 21,
    chaseAfterDays: 7,
    services: [
      { id: 'delivery-ntinda', label: 'Delivery · Ntinda', type: 'fixed', value: 20000 },
      // FACTS §6 "Loading for 20 bags is 10,000": 500 a bag (spec 04 Q3, the default being built).
      { id: 'loading', label: 'Loading', type: 'fixed', value: 500 },
    ],
    shopPhone: '0772 400 100',
    shopAddress: 'Kampala Road, Kampala',
  };
}
