/*
 * FACTS §4.3–§4.5: delivered this week, older bills, the orders with their
 * own boards, and the counter's 6 sales before 10:41 (FACTS §5, lead ruling:
 * rung up by the counter team, not Grace).
 *
 * Grace's October invoices add to Sold · October 12,480,000 (FACTS §5):
 *   Kato 5,280,000 (#0529, #0545, #0531, #0544) · Nansana 2,545,500 (#0538, #0536) ·
 *   Mukono 1,990,000 (#0532, #0541) · Lubowa 729,000 (#0539, #0542, #0540) · Kyaligonza 865,000 (#0535) ·
 *   Ggaba 119,000 (#0548) · Walk-in 96,000 (#0543) · three other customers 855,500 (#0512-#0514, bg.ts).
 * Delivered this week (Mon 12 – today): 8 · 6,569,000 = #0543 #0538 #0548 #0540 #0545 #0535 + #0526 Mukono
 * and #0527 Nansana (1,409,000 together; delivered Fri afternoon, paid, not yet invoiced).
 */
import type { Order } from '../../types.ts';
import { L, O, P, PAID } from './build.ts';
import { d, t } from './clock.ts';
import { GGABA, KATO, KYALIGONZA, LUBOWA, MUKONO, NANSANA } from './orders-live.ts';
import { BRIAN, COUNTER, FAITH, GRACE, RUTH } from './people.ts';

const done = (placed: number, delivered: number) => ({ stage: 'delivered' as const, placedAt: placed, stageAt: delivered, deliveredAt: delivered });

export function pastOrders(): Order[] {
  return [
    /* ---- delivered this week ---- */
    O({ id: 543, customerId: null, by: GRACE, ...done(t('8:20'), t('8:50')), invoicedAt: t('8:50'), lines: [L('nails-4-25kg', 1)], payments: [P(1, t('8:50'), 96000, 'cash', 9001)] }),
    O({ id: 538, customerId: NANSANA, by: GRACE, ...done(d('2026-10-16', '9:20'), d('2026-10-16', '15:10')), invoicedAt: d('2026-10-16', '15:30'),
      lines: [L('ridge-g28', 1), L('tile-glue-20', 1), L('emulsion-cream-20', 15)], payments: [P(1, d('2026-10-16', '15:10'), 1990000, 'momo', 8005), P(2, t('8:52'), 470000, 'momo', 9002)] }),
    // #0548 · Ggaba · 2 of the 3 bags came back torn: the return (67,000) is asked of Ruth (billAsks).
    O({ id: 548, customerId: GGABA, by: GRACE, ...done(d('2026-10-16', '9:05'), d('2026-10-16', '13:30')), invoicedAt: d('2026-10-16', '13:30'),
      log: [{ stage: 'checking', at: d('2026-10-16', '9:05'), by: GRACE }, { stage: 'buying', at: d('2026-10-16', '9:40'), by: RUTH }, { stage: 'packing', at: d('2026-10-16', '11:10'), by: null }, { stage: 'road', at: d('2026-10-16', '12:50'), by: null }, { stage: 'delivered', at: d('2026-10-16', '13:30'), by: null }],
      lines: [L('cement-hima-50', 3), L('wood-glue-1l', 1)], payments: [P(1, d('2026-10-16', '13:30'), 119000, 'cash', 8003)] }),
    O({ id: 540, customerId: LUBOWA, by: GRACE, ...done(d('2026-10-10', '10:00'), d('2026-10-16', '12:45')), invoicedAt: d('2026-10-16', '13:00'), lines: [L('iron-g28-3m', 10)], payments: [P(1, d('2026-10-16', '12:45'), 380000, 'cash', 8002)] }),
    // #0545 · Kato · placed Fri 8:40 … delivered Fri 12:20 (FACTS §4.4); paid in full (the over is Nansana's, lead ruling).
    O({ id: 545, customerId: KATO, by: GRACE, ...done(d('2026-10-16', '8:40'), d('2026-10-16', '12:20')), invoicedAt: d('2026-10-16', '12:30'),
      log: [{ stage: 'checking', at: d('2026-10-16', '8:40'), by: GRACE }, { stage: 'buying', at: d('2026-10-16', '9:30'), by: RUTH }, { stage: 'packing', at: d('2026-10-16', '10:45'), by: null }, { stage: 'road', at: d('2026-10-16', '11:40'), by: null }, { stage: 'delivered', at: d('2026-10-16', '12:20'), by: null }],
      lines: [L('iron-g28-3m', 20), L('nails-4-25kg', 5)], payments: [P(1, d('2026-10-16', '12:20'), 1000000, 'momo', 8000), P(2, d('2026-10-16', '12:20'), 240000, 'cash', 8001)] }),
    O({ id: 535, customerId: KYALIGONZA, by: GRACE, ...done(d('2026-09-28', '10:00'), d('2026-10-12', '11:05')), invoicedAt: d('2026-10-12', '11:30'),
      lines: [L('iron-g26-3m', 1), L('nails-4-25kg', 4), L('wheelbarrow-hd', 3)], payments: [P(1, d('2026-10-12', '11:05'), 865000, 'bank', 7004)] }),
    O({ id: 526, customerId: MUKONO, by: GRACE, ...done(d('2026-10-07', '10:00'), d('2026-10-16', '16:30')), paid: PAID,
      lines: [L('iron-g28-3m', 1), L('iron-g26-3m', 2), L('wheelbarrow-hd', 6)], payments: [P(1, d('2026-10-16', '16:30'), 1000000, 'momo', 8006)] }),
    O({ id: 527, customerId: NANSANA, by: GRACE, ...done(d('2026-10-14', '11:00'), d('2026-10-16', '17:10')), paid: PAID,
      lines: [L('nails-4-25kg', 4), L('pvc-half-6m', 2)], payments: [P(1, d('2026-10-16', '17:10'), 409000, 'cash', 8007)] }),

    /* ---- older bills (FACTS §4.5) ---- */
    // #0541 · Mukono · invoiced Sun 11 Oct; priced so far 1,520,000, paid 1,210,000, owes 310,000. The brackets' price is coming.
    O({ id: 541, customerId: MUKONO, by: GRACE, ...done(d('2026-10-10', '11:00'), d('2026-10-11', '15:00')), invoicedAt: d('2026-10-11', '16:00'),
      lines: [L('roof-paint-maroon-20', 6), L('ridge-maroon', 20), L('gutter-bracket', 6)], payments: [P(1, d('2026-10-11', '15:00'), 1210000, 'momo', 7003)] }),
    O({ id: 532, customerId: MUKONO, by: GRACE, ...done(d('2026-10-06', '10:00'), d('2026-10-08', '12:00')), invoicedAt: d('2026-10-08', '13:00'), lines: [L('iron-g28-3m', 10), L('ridge-g28', 5)] }),
    O({ id: 529, customerId: KATO, by: GRACE, ...done(d('2026-10-05', '9:00'), d('2026-10-06', '14:00')), invoicedAt: d('2026-10-06', '15:00'),
      lines: [L('nails-4-25kg', 5), L('wheelbarrow-hd', 4), L('emulsion-cream-20', 16)], payments: [P(1, d('2026-10-08', '10:00'), 3620000, 'bank', 7001)] }),
    O({ id: 531, customerId: KATO, by: GRACE, ...done(d('2026-10-01', '9:00'), d('2026-10-02', '12:00')), invoicedAt: d('2026-10-02', '13:00'), lines: [L('iron-g28-2m5', 2), L('nails-4-25kg', 2), L('tile-glue-20', 1)] }),
    O({ id: 544, customerId: KATO, by: GRACE, ...done(d('2026-10-08', '9:00'), d('2026-10-09', '12:00')), invoicedAt: d('2026-10-09', '13:00'), lines: [L('concrete-nails-2', 2), L('tile-glue-20', 2)] }),
    O({ id: 511, customerId: KATO, by: BRIAN, ...done(d('2026-10-01', '8:30'), d('2026-10-02', '11:00')), invoicedAt: d('2026-10-02', '12:00'),
      lines: [L('nails-4-25kg', 1), L('tile-glue-20', 2), L('emulsion-cream-20', 5)], payments: [P(1, d('2026-10-02', '11:00'), 980000, 'momo', 7000)] }),
    // #0498 · Kato · sold by Ruth before she gave Kato to Grace (Mon 12 Oct); in Kato's own list only.
    O({ id: 498, customerId: KATO, by: RUTH, ...done(d('2026-09-23', '9:00'), d('2026-09-24', '12:00')), invoicedAt: d('2026-09-24', '13:00'), lines: [L('iron-g28-3m', 30), L('wheelbarrow-hd', 2), L('ridge-g28', 6)], paid: PAID }),
    // Kato's 5 more delivered (FACTS §4.5: "and 5 more"), earlier this year.
    O({ id: 402, customerId: KATO, by: FAITH, ...done(d('2026-03-10'), d('2026-03-11')), invoicedAt: d('2026-03-12'), lines: [L('wheelbarrow-hd', 2), L('tile-glue-20', 5)], paid: PAID }),
    O({ id: 437, customerId: KATO, by: BRIAN, ...done(d('2026-05-06'), d('2026-05-07')), invoicedAt: d('2026-05-08'), lines: [L('iron-g28-3m', 1), L('tile-glue-20', 1), L('emulsion-cream-20', 3)], paid: PAID }),
    O({ id: 466, customerId: KATO, by: BRIAN, ...done(d('2026-07-14'), d('2026-07-15')), invoicedAt: d('2026-07-16'), lines: [L('emulsion-cream-20', 4)], paid: PAID }),
    O({ id: 479, customerId: KATO, by: GRACE, ...done(d('2026-08-18'), d('2026-08-19')), invoicedAt: d('2026-08-20'), lines: [L('iron-g26-3m', 4), L('nails-4-25kg', 6)], paid: PAID }),
    O({ id: 490, customerId: KATO, by: GRACE, ...done(d('2026-09-08'), d('2026-09-09')), invoicedAt: d('2026-09-10'), lines: [L('cement-hima-50', 40), L('iron-g28-3m', 30), L('nails-4-25kg', 2)], paid: PAID }),
    // #0533 · Kyaligonza · billed Mon 24 Aug, 1,110,000; paid 160,000 + 142,000 + 388,000 → owes 420,000 (FACTS §4.4).
    O({ id: 533, customerId: KYALIGONZA, by: GRACE, ...done(d('2026-08-22'), d('2026-08-24', '11:00')), invoicedAt: d('2026-08-24', '12:00'),
      lines: [L('iron-g28-2m5', 2), L('tile-glue-20', 2), L('emulsion-cream-20', 6)],
      payments: [P(1, d('2026-10-09', '11:20'), 160000, 'momo', 7002), P(2, d('2026-10-14', '10:02'), 142000, 'cash', 7005), P(3, t('10:40'), 388000, 'bank', 9003)] }),
    // Ggaba's bills past 21 days: #0521 to collect; #0528 being checked (it may be #0264, paid in cash the same day).
    O({ id: 521, customerId: GGABA, by: GRACE, ...done(d('2026-08-10'), d('2026-08-11')), invoicedAt: d('2026-08-11', '15:00'), lines: [L('iron-g28-2m5', 5)] }),
    O({ id: 528, customerId: GGABA, by: GRACE, ...done(d('2026-08-16'), d('2026-08-17')), invoicedAt: d('2026-08-17', '15:00'), lines: [L('iron-g26-3m', 2), L('iron-g28-2m5', 1)] }),
    O({ id: 264, customerId: GGABA, by: GRACE, ...done(d('2026-08-17', '9:00'), d('2026-08-17', '9:30')), invoicedAt: d('2026-08-17', '9:30'), lines: [L('iron-g26-3m', 2), L('iron-g28-2m5', 1)], paid: PAID, counter: true }),
    // Lubowa's two open bills, being checked: they say 349,000, the balance says 0 (Esther asked today 9:12).
    O({ id: 539, customerId: LUBOWA, by: GRACE, ...done(d('2026-10-05'), d('2026-10-06', '11:00')), invoicedAt: d('2026-10-06', '12:00'), lines: [L('nails-4-25kg', 1), L('tile-glue-20', 2)] }),
    O({ id: 542, customerId: LUBOWA, by: GRACE, ...done(d('2026-10-10', '9:30'), d('2026-10-11', '15:00')), invoicedAt: d('2026-10-12', '12:00'), lines: [L('iron-g28-2m5', 4), L('wood-glue-1l', 2)] }),
    // Entered twice and invoiced (OR23): #0536 / #0537, invoices Fri 16:02 / 16:03, paid once: two counter sales a minute
    // apart (so neither is in "delivered this week"). The copy is voided: Nansana owes 0 and her October is 2,545,500 without it.
    O({ id: 536, customerId: NANSANA, by: GRACE, ...done(d('2026-10-16', '16:02'), d('2026-10-16', '16:02')), invoicedAt: d('2026-10-16', '16:02'), counter: true, lines: [L('cement-hima-50', 2), L('wood-glue-1l', 1)], payments: [P(1, d('2026-10-16', '16:02'), 85500, 'cash', 8004)] }),
    O({ id: 537, customerId: NANSANA, by: GRACE, ...done(d('2026-10-16', '16:03'), d('2026-10-16', '16:03')), invoicedAt: d('2026-10-16', '16:03'), counter: true, voided: true, lines: [L('cement-hima-50', 2), L('wood-glue-1l', 1)] }),

    /* ---- the counter's 6 sales before 10:41: 412,000, first at 8:40 (not Grace's) ---- */
    ...([
      [516, '8:40', [L('cement-hima-50', 2)]],
      [517, '9:05', [L('nails-3', 10)]],
      [518, '9:20', [L('pvc-half-6m', 4)]],
      [519, '9:48', [L('tile-glue-20', 2)]],
      [520, '10:10', [L('wood-glue-1l', 2)]],
      [554, '10:25', [L('pvc-half-6m', 6), L('wood-glue-1l', 1), L('tile-glue-20', 1)]],
    ] as const).map(([id, hm, lines], i) => O({
      id, customerId: null, by: COUNTER, ...done(t(hm), t(hm)), invoicedAt: t(hm), counter: true, lines: [...lines],
      payments: [P(1, t(hm), 0, 'cash', 9101 + i)],
    })).map((o) => ({ ...o, payments: o.payments.map((p) => ({ ...p, amount: o.lines.reduce((s, l) => s + l.qty * (l.price || 0), 0) })), paid: o.lines.reduce((s, l) => s + l.qty * (l.price || 0), 0) })),
  ];
}
