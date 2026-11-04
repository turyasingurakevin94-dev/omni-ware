/*
 * A live order held for the money, taken with the bills (SL30 "Take 1.1M": Mukono's #0532 and #0541, 780,000,
 * plus #0551, 320,000, Not paid yet). ROUTES lets customers/pay's `bills` name such an order. Its money goes as
 * receive_payment takes an order before its invoice (spec 02 §6, { orderId }), the way the Orders tab's Take
 * payment on an order does; the bills go as before ({ customerId, picks }).
 */
import type { PayArgs } from '../../../core/datasource.ts';
import { orderOwes } from '../../../core/money.ts';
import type { OpenBill } from '../../../core/owing.ts';
import { dayOf } from '../../../core/time.ts';
import type { Books, Customer } from '../../../core/types.ts';
import { waitingOnMe } from './data.ts';

/** The live orders the `bills` param names that wait on Sales for the money, as rows after the bills. */
export function heldBills(b: Books, c: Customer | null, ids: number[] | null): OpenBill[] {
  if (!c || !ids) return [];
  return waitingOnMe(b, c).filter((o) => ids.includes(o.id)).map((o) => ({
    id: o.id, orderId: o.id, order: o, day: dayOf(o.placedAt), left: orderOwes(o), age: 0, past: false, checked: false, named: false,
  }));
}

/**
 * The writes one payment makes: the bills first (oldest first, as ticked), then each held order with what it
 * takes. What is over (a deposit) goes with the last write; change is handed back and is not money in.
 */
export function writesFor(args: PayArgs, held: OpenBill[], applied: { id: number; applied: number }[]): PayArgs[] {
  const heldIds = held.map((x) => x.id), on = (id: number) => (applied.find((y) => y.id === id) || { applied: 0 }).applied;
  const orders = held.map((x) => ({ id: x.id, amount: on(x.id) })).filter((x) => x.amount > 0);
  if (!orders.length || !args.customerId) return [args];
  const billsPart = applied.filter((x) => !heldIds.includes(x.id)).reduce((s, x) => s + x.applied, 0);
  const extra = args.over === 'deposit' ? Math.max(0, args.amount - billsPart - orders.reduce((s, x) => s + x.amount, 0)) : 0;
  const out: PayArgs[] = [];
  if (billsPart > 0) out.push({ ...args, amount: billsPart, picks: (args.picks || []).filter((id) => !heldIds.includes(id)), over: null });
  orders.forEach((x, i) => {
    const last = i === orders.length - 1;
    out.push({ ...args, orderId: x.id, picks: null, amount: x.amount + (last ? extra : 0), over: last && extra > 0 ? 'deposit' : null });
  });
  return out;
}
