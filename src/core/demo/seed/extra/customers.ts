/*
 * The customers tab's own additions to the demo, owned by the customers builder (no other tab edits it).
 * Change the seeded state here when a customers board needs something FACTS.md states and the shared
 * seed does not have yet; keep it true to FACTS.md, and say which board needs it.
 */
import { d, t } from '../clock.ts';
import { orderTotal } from '../../../money.ts';
import { GGABA, LUBOWA, MUKONO, NANSANA, liveOrders } from '../orders-live.ts';
import { ESTHER, GRACE } from '../people.ts';
import type { DemoFlags } from '../../flags.ts';
import type { DemoState } from '../index.ts';

export function extra(s: DemoState, f: DemoFlags): void {
  const b = s.books;
  if (f.state === 'empty') {
    // CU06: nobody owes, but who is due still reads FACTS §3.2 (Kyaligonza 4 days late, Lubowa 1): their last
    // orders (#0530, #0546) stay in the books, delivered and paid, from before this week.
    liveOrders().filter((o) => o.id === 530 || o.id === 546).forEach((o) => {
      const done = o.placedAt + 3600 * 1000;
      b.orders.push({ ...o, stage: 'delivered', stageAt: done, deliveredAt: done, invoiced: true, invoicedAt: done, paid: orderTotal(o), holderId: null });
    });
    b.orders.sort((x, y) => x.id - y.id);
  }
  if (f.state === 'empty' || f.state === 'first-day') return;
  // CU11 "Order usual": Ggaba's usual, from their own orders (wood glue in #0547 and #0548). FACTS gives no list.
  const gs = b.customers.find((c) => c.id === GGABA);
  if (gs && !gs.usual.length) gs.usual = [{ itemId: 'wood-glue-1l', variantIdx: null, qty: 1, seen: 2, of: 3 }];
  // CU12: #0264, 125,000 paid in cash on 17 Aug: the payment Ggaba's #0528 may be (FACTS §3.1, §4.5).
  if (!b.payments.some((p) => p.id === 6264)) {
    b.payments.push({ id: 6264, at: d('2026-08-17', '9:30'), day: '2026-08-17', amount: 125000, method: 'cash', customerId: GGABA, orderId: 264, by: GRACE, ref: '', qa: false });
  }
  // CU02, CU11, CU12: Esther is checking Ggaba's #0528 (125,000, inside the 290,000 owed).
  b.paymentAsks.push({ id: 'pa-cu1', paymentId: 6264, customerId: GGABA, orderId: 528, what: 'bill', amount: 125000, status: 'sent', want: { bill: 528 }, by: ESTHER, at: d('2026-10-16', '16:40') });
  // CU02, CU13: Lubowa's two open bills say 349,000, the balance 0; Grace asked Esther today 9:12 (FACTS §3.1).
  b.paymentAsks.push({ id: 'pa-cu2', paymentId: 7006, customerId: LUBOWA, orderId: null, what: 'balance', amount: 349000, status: 'sent', want: { amount: 349000 }, by: GRACE, at: t('9:12') });
  // CU05 "Opened lately": the pages Grace opened on her phone this morning and yesterday. On the real phone this list
  // is the phone's own (customers/opened.ts, localStorage); the demo carries it beside the books.
  (b as typeof b & { openedLately: { customerId: string; at: number }[] }).openedLately = [
    { customerId: LUBOWA, at: t('9:12') }, { customerId: GGABA, at: t('9:10') }, { customerId: MUKONO, at: t('8:31') }, { customerId: NANSANA, at: d('2026-10-16', '16:05') },
  ];
}
