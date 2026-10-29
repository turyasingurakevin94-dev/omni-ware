/*
 * Small builders so each seed file reads like FACTS: L('iron-g28-3m', 40)
 * is a line at the shop's price; O({...}) is an order with its stage log.
 */
import { orderTotal } from '../../money.ts';
import type { Customer, DebtEntry, Item, Line, Method, Ms, Order, OrderPayment, Stage, StageStep, Tint } from '../../types.ts';
import { dayOf } from '../../time.ts';
import { items } from './items.ts';

const ITEMS = new Map<string, Item>(items().map((i) => [i.id, i]));

/** A line of `qty` of an item, at the shop's price unless `o.price` says otherwise. */
export function L(itemId: string, qty: number, o: Partial<Line> = {}): Line {
  const it = ITEMS.get(itemId);
  if (!it) throw new Error(`demo seed: no item ${itemId}`);
  return {
    lineId: 0, itemId, variantIdx: null, name: it.name, unit: it.unit, packUnit: it.packUnit, packQty: it.packQty, qty,
    price: it.price, cost: it.cost, shopPrice: it.price,
    from: it.onShelf && it.onShelf >= qty ? 'shelf' : 'supplier', supplierId: it.onShelf && it.onShelf >= qty ? '__stock__' : 'sup-demo',
    priceBy: null, priceNote: null, priceReview: null, priceToldAt: null, state: null, stateAt: null,
    ...o,
  };
}

export interface OrderSpec {
  id: number;
  customerId: string | null;
  client?: { name: string; phone: string };
  placedAt: Ms;
  by: string | null;
  stage: Stage;
  /** When it entered the stage it is in; defaults to placedAt. */
  stageAt?: Ms;
  log?: StageStep[];
  holder?: string | null;
  lines: Line[];
  paid?: number;
  payments?: OrderPayment[];
  invoicedAt?: Ms | null;
  voided?: boolean;
  cancelled?: boolean;
  counter?: boolean;
  deliverTo?: string | null;
  deliveredAt?: Ms | null;
  toldTotal?: number | null;
  credit?: { pct: number; days: number } | null;
}

export function O(s: OrderSpec): Order {
  const lines = s.lines.map((l, i) => ({ ...l, lineId: i + 1 }));
  const stageAt = s.stageAt ?? s.placedAt;
  const log: StageStep[] = s.log ?? (s.stage === 'checking' ? [{ stage: 'checking', at: s.placedAt, by: s.by }] : [{ stage: 'checking', at: s.placedAt, by: s.by }, { stage: s.stage, at: stageAt, by: null }]);
  const o: Order = {
    id: s.id, customerId: s.customerId, client: s.client ?? { name: 'Walk-in', phone: '' },
    placedAt: s.placedAt, placedBy: s.by, stage: s.stage, stageAt, stageLog: log, holderId: s.holder ?? null,
    lines, charges: [], credit: s.credit ?? null, discount: 0,
    payments: s.payments ?? [], paid: 0,
    invoiced: s.invoicedAt != null, invoicedAt: s.invoicedAt ?? null, voided: !!s.voided, cancelled: !!s.cancelled, counter: !!s.counter,
    deliverTo: s.deliverTo ?? null, deliveredAt: s.deliveredAt ?? null, toldTotal: s.toldTotal ?? null, qa: false,
  };
  o.paid = s.paid === -1 ? orderTotal(o) : s.paid ?? o.payments.reduce((a, p) => a + p.amount, 0);
  return o;
}

/** "Paid in full" for O({ paid: PAID }). */
export const PAID = -1;

/** A payment on an order (payload.payments[]). */
export function P(id: number, at: Ms, amount: number, method: Method, paymentId: number | null = null): OrderPayment {
  return { id, day: dayOf(at), amount, method, paymentId };
}

/** A customer with the fields the canvas does not draw left empty. */
export function C(c: Partial<Customer> & { id: string; name: string; initials: string; tint: Tint }): Customer {
  return {
    phone: '', phone2: '', place: '', kind: null, address: '', owes: 0, creditLimit: null, termsDays: null, everyDays: null,
    usual: [], debtLog: [], qa: false, ...c,
  };
}

let logId = 0;
/** A debt-log line: charge(+) when a bill is raised, pay(−) when money comes in. */
export function charge(day: string, amount: number, orderId: number | null, note: string = ''): DebtEntry {
  return { id: ++logId, day, type: 'charge', amount, orderId, paymentId: null, note: note || (orderId ? `INV-${String(orderId).padStart(4, '0')}` : 'Bill') };
}
export function pay(day: string, amount: number, orderId: number | null, paymentId: number | null = null, note: string = 'Payment'): DebtEntry {
  return { id: ++logId, day, type: 'payment', amount, orderId, paymentId, note };
}
