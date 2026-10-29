/*
 * The demo's writes act like the real server functions, so flows really
 * work: a placed order takes the next number (#0558 at 10:41), a counter
 * sale is placed, paid, delivered and invoiced at once, a payment clears
 * bills oldest first and refuses money over what is owed unless it is
 * change or a deposit (OWOVR), a typed price under cost is refused (OWCST).
 * Each names the server function it stands in for.
 */
import { dataError, type CounterPay, type CounterResult, type OrderDraft, type PayArgs, type PayResult } from '../datasource.ts';
import { cashTotal, orderOwes, orderTotal, payPlan } from '../money.ts';
import { initials, invoiceNo, isGenericName, tintFor } from '../names.ts';
import { startStage } from '../orders.ts';
import { dayOf } from '../time.ts';
import type { BillAsk, Customer, Order, OrderPayment, Payment } from '../types.ts';
import type { DemoState } from './seed/index.ts';

const nextOrderId = (s: DemoState) => s.books.orders.reduce((m, o) => (o.id < 1000 ? Math.max(m, o.id) : m), 0) + 1;
const nextPaymentId = (s: DemoState) => s.books.payments.reduce((m, p) => Math.max(m, p.id), 0) + 1;

/** 0171 OWCST: a typed price under the line's cost is refused. */
function checkCost(d: OrderDraft): void {
  const low = d.lines.find((l) => l.price != null && l.cost != null && l.price > 0 && l.price < l.cost);
  if (low) throw dataError('refused', `${low.name}: that price is under what it costs`, 'OWCST');
}

function newOrder(s: DemoState, d: OrderDraft, id: number, stage: Order['stage']): Order {
  const now = s.now, me = s.books.me.id;
  return {
    id, customerId: d.customerId, client: { name: d.client.name || 'Walk-in', phone: d.client.phone || '' },
    placedAt: now, placedBy: me, stage, stageAt: now, stageLog: [{ stage, at: now, by: me }], holderId: null,
    lines: d.lines.map((l, i) => ({ ...l, lineId: i + 1 })), charges: d.charges, credit: d.credit, discount: 0,
    payments: [], paid: 0, invoiced: false, invoicedAt: null, voided: false, cancelled: false, counter: false,
    deliverTo: d.deliverTo, deliveredAt: null, toldTotal: null, qa: false,
  };
}

/** The keys each demo shop has placed an order under (place_order's payload.placeKey). */
const placed = new WeakMap<DemoState, Map<string, number>>();

/**
 * place_order (0180), placed at Packing when it needs nothing (orders.ts startStage). The same key
 * again is the order it placed; a customer not in the books is refused; on credit the pct is the shop's.
 */
export function placeOrder(s: DemoState, d: OrderDraft): Order {
  const b = s.books, keys = placed.get(s) || new Map<string, number>();
  placed.set(s, keys);
  const again = d.key ? b.orders.find((o) => o.id === keys.get(d.key as string)) : undefined;
  if (again) return again;
  if (!d.lines.length) throw dataError('refused', 'Add an item to place');
  checkCost(d);
  const cust = d.customerId ? b.customers.find((c) => c.id === d.customerId) || null : null;
  if (d.customerId && !cust) throw dataError('refused', 'That customer is not in the books', 'P0002');
  const draft: OrderDraft = { ...d, credit: d.credit ? { pct: b.settings.creditPct, days: d.credit.days } : null };
  const stage = startStage(draft, b.items, cust, dayOf(s.now), b.settings.holdDays, orderTotal({ lines: draft.lines, charges: draft.charges, discount: 0, credit: draft.credit }));
  const o = newOrder(s, draft, nextOrderId(s), stage);
  b.orders.push(o);
  if (d.key) keys.set(d.key, o.id);
  return o;
}

/**
 * ask_cancel (0181): your own order, before it is invoiced or delivered, with why; asked again while
 * it waits, the same ask. The Manager answers in her app (answer_cancel_ask).
 */
export function askCancel(s: DemoState, orderId: number, why: string): BillAsk {
  const b = s.books, o = b.orders.find((x) => x.id === orderId);
  if (!o) throw dataError('refused', 'This order is no longer in the books', 'P0002');
  const no = '#' + String(o.id).padStart(4, '0');
  if (!why.trim()) throw dataError('refused', 'Say why it should be cancelled', '22023');
  if (o.placedBy !== b.me.id) throw dataError('refused', `Only the one who took ${no} asks to cancel it`, '42501');
  if (o.voided || o.cancelled) throw dataError('refused', `${no} is called off already`, '22023');
  if (o.invoiced) throw dataError('refused', `${no} is invoiced: ask for a void instead`, '22023');
  if (o.stage === 'delivered') throw dataError('refused', `${no} was delivered: ask for a void once it is invoiced`, '22023');
  const open = b.billAsks.find((a) => a.kind === 'cancel' && a.orderId === o.id && a.status === 'sent');
  if (open) return open;
  const ask: BillAsk = { id: 'ba' + (b.billAsks.length + 1), orderId: o.id, customerId: o.customerId, kind: 'cancel', amount: orderTotal(o), reason: why.trim(), status: 'sent', by: b.me.id, at: s.now };
  b.billAsks.push(ask);
  return ask;
}

/** withdraw_invoice_ask (0123) and withdraw_cancel_ask (0181): your own ask, while it waits; again is no harm. */
export function withdrawAsk(s: DemoState, id: string): void {
  const a = s.books.billAsks.find((x) => x.id === id);
  if (!a || a.by !== s.books.me.id) throw dataError('refused', 'That ask is not yours', '42501');
  if (a.status === 'withdrawn') return;
  if (a.status !== 'sent') throw dataError('refused', `That ask is ${a.status} already`, '22023');
  a.status = 'withdrawn';
}

/** counter_sale (0136/0155): placed, paid, delivered and invoiced in one write; a price under the shop's waits. */
export function counterSale(s: DemoState, d: OrderDraft, pay: CounterPay): CounterResult {
  checkCost(d);
  if (d.lines.some((l) => l.price == null)) throw dataError('refused', 'A line has no price yet', 'OWTPC');
  const b = s.books, id = nextOrderId(s);
  const waiting = d.lines.some((l) => l.shopPrice != null && l.price != null && l.price < l.shopPrice && !l.priceReview);
  if (waiting) {
    const o = newOrder(s, d, id, 'checking');
    o.counter = true; b.orders.push(o);
    return { order: o, invoice: invoiceNo(id), paid: 0, change: 0, waiting: 'price' };
  }
  const total = cashTotal({ lines: d.lines, charges: d.charges, discount: 0 });
  if (pay.method === 'cash' && pay.given > 0 && pay.given < total) throw dataError('refused', 'They gave less than the total', 'OWSHT');
  const pid = nextPaymentId(s);
  const o = newOrder(s, d, id, 'delivered');
  Object.assign(o, { counter: true, invoiced: true, invoicedAt: s.now, deliveredAt: s.now, paid: total });
  o.stageLog = [{ stage: 'checking', at: s.now, by: b.me.id }, { stage: 'delivered', at: s.now, by: b.me.id }];
  o.payments = [{ id: 1, day: dayOf(s.now), amount: total, method: pay.method, paymentId: pid }];
  b.orders.push(o);
  b.payments.push({ id: pid, at: s.now, day: dayOf(s.now), amount: total, method: pay.method, customerId: d.customerId, orderId: id, by: b.me.id, ref: pay.ref, qa: false });
  return { order: o, invoice: invoiceNo(id), paid: total, change: pay.method === 'cash' ? Math.max(0, pay.given - total) : 0, waiting: null };
}

function receipt(s: DemoState, amount: number, a: PayArgs, orderId: number | null, customerId: string | null): Payment {
  const p: Payment = { id: nextPaymentId(s), at: s.now, day: dayOf(s.now), amount, method: a.method, customerId, orderId, by: s.books.me.id, ref: a.ref, qa: false };
  s.books.payments.push(p);
  return p;
}

function onOrder(o: Order, p: Payment): void {
  const op: OrderPayment = { id: o.payments.length + 1, day: p.day, amount: p.amount, method: p.method, paymentId: p.id };
  o.payments.push(op);
  o.paid += p.amount;
}

/** receive_payment (0169): a customer's bills oldest first (or the ticked ones), or one order before its invoice. */
export function receivePayment(s: DemoState, a: PayArgs): PayResult {
  const b = s.books, amount = Math.round(a.amount);
  if (!(amount > 0)) throw dataError('refused', 'Type how much they paid');
  if (a.method !== 'cash' && !String(a.ref || '').trim()) throw dataError('refused', 'Type the transaction ID', 'OWREF');
  if (a.orderId != null) {
    const o = b.orders.find((x) => x.id === a.orderId);
    if (!o || o.voided) throw dataError('refused', 'That order is not in the books');
    const before = orderOwes(o), { toDebt, over } = payPlan(before, amount);
    if (over > 0 && !a.over) throw dataError('refused', 'That is more than they owe: give change or keep a deposit', 'OWOVR');
    if (over > 0 && a.over === 'deposit' && (!o.customerId || isGenericName(o.client.name))) throw dataError('refused', 'Name the customer to keep a deposit', 'OWDEP');
    const kept = a.over === 'deposit' ? amount : toDebt;
    const p = receipt(s, kept, a, o.id, o.customerId);
    onOrder(o, p);
    return { payments: [p], amount: kept, before, after: Math.max(0, before - kept), deposit: a.over === 'deposit' ? over : 0, change: a.over === 'change' ? over : 0 };
  }
  const c = b.customers.find((x) => x.id === a.customerId);
  if (!c) throw dataError('refused', 'Pick the customer');
  const before = c.owes, { toDebt, over } = payPlan(before, amount);
  if (over > 0 && !a.over) throw dataError('refused', 'That is more than they owe: give change or keep a deposit', 'OWOVR');
  const bills = b.orders.filter((o) => o.customerId === c.id && o.invoiced && !o.voided && orderOwes(o) > 0)
    .sort((x, y) => (x.invoicedAt || 0) - (y.invoicedAt || 0));
  const ordered = a.picks ? a.picks.map((id) => bills.find((o) => o.id === id)).filter((o): o is Order => !!o) : bills;
  let left = toDebt;
  const made: Payment[] = [];
  for (const o of ordered) {
    if (!(left > 0)) break;
    const take = Math.min(left, orderOwes(o));
    const p = receipt(s, take, a, o.id, c.id);
    onOrder(o, p); made.push(p); left -= take;
    c.debtLog.push({ id: c.debtLog.length + 1000, day: p.day, type: 'payment', amount: take, orderId: o.id, paymentId: p.id, note: 'Payment — ' + invoiceNo(o.id) });
  }
  // What is left lowers an older balance (no bill names it); a deposit keeps the rest.
  const rest = left + (a.over === 'deposit' ? over : 0);
  if (rest > 0) {
    const p = receipt(s, rest, a, null, c.id);
    made.push(p);
    c.debtLog.push({ id: c.debtLog.length + 1000, day: p.day, type: 'payment', amount: rest, orderId: null, paymentId: p.id, note: a.over === 'deposit' ? 'Deposit' : 'Payment' });
  }
  const kept = made.reduce((t, p) => t + p.amount, 0);
  c.owes = before - kept;
  return { payments: made, amount: kept, before, after: c.owes, deposit: a.over === 'deposit' ? over : 0, change: a.over === 'change' ? over : 0 };
}

/** customers insert with next_entity_id ('C', 3). */
export function addCustomer(s: DemoState, a: { name: string; phone: string; place: string; kind: Customer['kind'] }): Customer {
  const b = s.books;
  if (!a.name.trim()) throw dataError('refused', 'Type their name');
  if (isGenericName(a.name)) throw dataError('refused', 'A customer needs their own name');
  const n = b.customers.reduce((m, c) => Math.max(m, Number(c.id.replace(/[^0-9]/g, '')) || 0), 0) + 1;
  const name = a.name.trim();
  const c: Customer = {
    id: 'C' + String(n).padStart(3, '0'), name, initials: initials(name), tint: tintFor(name),
    phone: a.phone, phone2: '', place: a.place, kind: a.kind, address: a.place, owes: 0, creditLimit: null, termsDays: null, everyDays: null,
    usual: [], debtLog: [], qa: false,
  };
  b.customers.push(c);
  return c;
}
