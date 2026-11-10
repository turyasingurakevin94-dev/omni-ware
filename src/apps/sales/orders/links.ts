/*
 * Where the Orders tab's controls go: its own screens, and other tabs' only through their
 * ROUTES.md ids (src/apps/sales/shell/ROUTES.md). A tab not built yet in this checkout says so
 * in a toast instead of throwing.
 */
import type { Books, Order } from '../../../core/types.ts';
import { toast } from '../../../ui/toast.tsx';
import { nav, screen } from '../shell/nav.ts';
import type { Params } from '../shell/types.ts';

export function go(id: string, params: Params): void {
  if (screen(id)) nav.push(id, params);
  else toast.show('Not open yet', { kind: 'warn', sub: id });
}

export const openOrder = (id: number): void => nav.push('orders/order', { id });

/** Take payment: the customer's bills and this order (customers/pay), or the walk-in's order alone. */
export function payFor(_b: Books, o: Order): void {
  go('customers/pay', o.customerId ? { customer: o.customerId, order: o.id } : { customer: '', order: o.id });
}
