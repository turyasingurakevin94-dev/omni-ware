/*
 * customers/paid { payment }: a payment already in the books, opened from the day's money (TD17's rows), its
 * Paid screen rebuilt from the cash book as the old app's "Send the receipt" did (sales.html paidFromTxn): who
 * paid, how much and how, the bills it paid (the payments taken with it: same customer, time and way), and
 * what they owe. What they owed then is what they owe now with what came in and went out since put back.
 */
import { orderOwes, orderTotal } from '../../../core/money.ts';
import { initials } from '../../../core/names.ts';
import { DEBT, owingOf } from '../../../core/owing.ts';
import { dayOf } from '../../../core/time.ts';
import type { Books, Ms } from '../../../core/types.ts';
import type { Paid } from './paid-store.ts';

export const bookKey = (id: number): string => `pay:${id}`;

export function paidFromBooks(b: Books, id: number, now: Ms): Paid | null {
  const t = b.payments.find((x) => x.id === id);
  if (!t) return null;
  const c = t.customerId ? b.customers.find((x) => x.id === t.customerId) || null : null;
  const o0 = t.orderId != null ? b.orders.find((o) => o.id === t.orderId) || null : null;
  const group = b.payments.filter((x) => !x.qa && x.at === t.at && x.method === t.method && x.customerId === t.customerId && (c || x.orderId === t.orderId));
  const amount = group.reduce((s, x) => s + x.amount, 0);
  const lines = group.map((x) => {
    const o = x.orderId != null ? b.orders.find((y) => y.id === x.orderId) : null;
    return { id: o ? o.id : DEBT, day: o ? dayOf(o.invoicedAt || o.placedAt) : t.day, amount: x.amount };
  });
  // What they owe now, then what they owed just after this payment: what came in since back on, bills since off.
  const later = b.payments.filter((x) => !x.qa && x.at > t.at && (c ? x.customerId === c.id : x.orderId === t.orderId)).reduce((s, x) => s + x.amount, 0);
  const billedSince = c ? b.orders.filter((o) => o.customerId === c.id && o.invoicedAt != null && o.invoicedAt > t.at && !o.voided).reduce((s, o) => s + orderTotal(o), 0) : 0;
  const owesNow = c ? owingOf(b, c, dayOf(now)).owes : o0 ? orderOwes(o0) : 0;
  const after = Math.max(0, owesNow + later - billedSince);
  const name = c ? c.name : o0 && o0.client.name ? o0.client.name : 'Walk-in';
  return {
    key: bookKey(id), customerId: c ? c.id : null, name, initials: c ? c.initials : initials(name), tint: c ? c.tint : 't4',
    phone: c ? c.phone : o0 ? o0.client.phone : '', amount, method: t.method, ref: t.ref, lines, before: after + amount, after,
    change: 0, given: amount, deposit: 0, at: t.at, kept: false, keptId: null, refused: null, discarded: false,
    receipt: { state: 'off', at: null, chatId: null }, fromBooks: true,
  };
}
