/*
 * The rules for placing an order, once, for both data sources.
 *
 *   where it starts   all from our shelf with nothing to decide → Packing; else Checking
 *                     (decision-rights "Orders that need nothing from a supplier"; sales.html:8758
 *                     nwShelfOnly; the server judges it as a move out of Checking, 0173)
 *   the price tag     a line the Manager decides carries who set it and why (decision-rights
 *                     "The price decision"; sales.html:4428-4440 priceNoteFor, placedPriceTag)
 *   the payload       the order as sales.html writes it (8722-8738), so every other app reads it
 *   a return's lines  as invoice_asks keeps them, so the Manager reads which lines come back
 *   a price untold    the Manager's new price the customer has not been told yet (sales.html:6104
 *                     ordMarkTold writes priceToldAt; every Tell and Today read this one rule)
 */
import type { OrderDraft } from './datasource.ts';
import { creditHold, linePriced, orderOwes } from './money.ts';
import type { AskLine, Customer, Day, Item, Line, Ms, Order, Stage } from './types.ts';

/** Why the Manager decides a line's price, or null (sales.html:4423 priceNoteFor). */
export function priceNote(l: Line): 'under' | 'nomargin' | 'nocost' | null {
  if (!(l.cost && l.cost > 0)) return 'nocost';
  if (l.shopPrice == null) return 'nomargin';
  return l.price != null && l.price < l.shopPrice ? 'under' : null;
}

/** The Manager changed this line's price and the customer has not been told it since (items[].priceToldAt). */
export function priceUntold(l: Line): boolean {
  return !!l.priceReview && l.priceReview.state === 'changed' && !(l.priceToldAt && l.priceToldAt >= l.priceReview.at);
}

/** Below cost is refused, always (sales.html:4428 priceTooLow; server 0171 OWCST). */
export function priceTooLow(l: Line, price: number): boolean {
  return l.cost != null && l.cost > 0 && price < l.cost;
}

/**
 * A line waits for the Manager: no price yet, or a price under the shop's or with no rule, until the
 * Manager answers for that figure (sales.html:4481 priceReviewState, PRICE_DECIDES = under, nomargin).
 */
export function lineWaits(l: Line): boolean {
  if (l.priceReview && l.price != null && l.priceReview.price === l.price) return false;
  if (!linePriced(l)) return true;
  const note = priceNote(l);
  return note === 'under' || note === 'nomargin';
}

/**
 * Where a new order starts. Packing when every line is from our shelf, the shelf covers it, no price
 * waits and credit does not hold it; otherwise Checking (sales.html:8758 nwShelfOnly).
 */
export function startStage(d: OrderDraft, items: Item[], customer: Customer | null, today: Day, holdDays: number, orderTotal: number): Stage {
  if (!d.lines.length) return 'checking';
  if (d.credit && customer && creditHold(customer, orderTotal, true, today, holdDays)) return 'checking';
  if (d.credit && !customer) return 'checking';
  const ok = d.lines.every((l) => {
    if (l.from !== 'shelf' || lineWaits(l)) return false;
    const it = items.find((x) => x.id === l.itemId && x.variantIdx === l.variantIdx);
    return !!it && it.onShelf != null && it.onShelf >= l.qty;
  });
  return ok ? 'packing' : 'checking';
}

/** A line as saved_quotes.payload.items[] carries it (spec 01 §4b; sales.html:8726 + placedPriceTag). */
export function linePayload(l: Line, by: string, atIso: string): Record<string, unknown> {
  const note = priceNote(l), tagged = !!l.priceBy || l.price == null || note === 'under';
  return {
    lineId: l.lineId, productId: l.itemId, variantIdx: l.variantIdx, productName: l.name, unit: l.unit, packUnit: l.packUnit, packQty: l.packQty,
    qtyIn: 'unit', qty: l.qty, supplierId: l.from === 'shelf' ? '__stock__' : l.supplierId, supplierName: l.from === 'shelf' ? 'Our shelf' : '',
    price: l.cost ?? 0, sellPrice: l.price,
    ...(tagged ? { priceBy: l.priceBy || by, priceNote: note, priceShop: l.shopPrice, priceAt: atIso, ...(l.price == null ? { priceAsk: true } : {}) } : {}),
  };
}

/** The whole payload of a new order (sales.html:8731-8735). */
export function orderPayload(d: OrderDraft, stage: Stage, by: string, now: number): Record<string, unknown> {
  const iso = new Date(now).toISOString(), status = stage === 'packing' ? 'preparing' : 'draft';
  return {
    client: { name: d.client.name || 'Walk-in', phone: d.client.phone || '' },
    items: d.lines.map((l) => linePayload(l, by, iso)),
    charges: d.charges.map((c) => ({ id: c.id, service: null, label: c.label, type: c.type, value: Math.max(0, Number(c.value) || 0), cost: null })),
    credit: d.credit, savedAt: iso, createdAt: iso, payments: [], customerId: d.customerId, debtCharged: 0,
    stageEnteredAt: now, stageLog: [{ status, at: now }], takenBy: by,
    ...(d.deliverTo ? { deliverTo: d.deliverTo } : {}),
    ...(d.chatId != null ? { waConvId: d.chatId } : {}),
  };
}

/** A return's lines as invoice_asks keeps them (sales.html:6279): the line's place, its name, how many, at the line's price. */
export function askLines(o: Order, ls: { idx: number; qty: number }[] = []): AskLine[] {
  return ls.filter((x) => o.lines[x.idx] && x.qty > 0).map((x) => {
    const l = o.lines[x.idx], price = l.price || 0;
    return { idx: x.idx, name: l.name, qty: x.qty, price, amount: Math.round(x.qty * price) };
  });
}

/** How many minutes apart an order and its copy can be placed (open for Kevin, spec 04 §3 Q11: Orders had 10). */
export const COPY_MINUTES = 5;

/**
 * The same order entered twice (OR19, OR23; FACTS: #0557 is #0556's copy, 10:02 / 10:03): two orders of the
 * same customer, with the same lines, placed by the same person up to COPY_MINUTES apart, both invoiced or
 * both not, neither cancelled nor a test record. The later one (or, at the same minute, the higher number) is
 * the copy: it does not count (Placed today, a customer's last order). A voided order makes a pair only when
 * `voided` is asked (OR23, OR29, OR30: the struck copy beside the bill that stands). One rule for Orders,
 * Customers and Today (it was Orders' twinOf, 10 minutes, and Customers' isCopy, 5).
 */
export function twinOf(orders: Order[], o: Order, voided = false): { orig: Order; copy: Order } | null {
  if (o.cancelled || o.qa || (!voided && o.voided)) return null;
  const sig = (x: Order) => x.lines.map((l) => `${l.itemId}:${l.variantIdx ?? ''}:${l.qty}`).sort().join('|');
  const who = (x: Order) => x.customerId || x.client.name.trim().toLowerCase();
  if (!who(o)) return null;
  const t = orders.find((x) => x.id !== o.id && (voided || !x.voided) && !x.cancelled && !x.qa && x.placedBy === o.placedBy && who(x) === who(o)
    && x.invoiced === o.invoiced && Math.abs(x.placedAt - o.placedAt) <= COPY_MINUTES * 60000 && sig(x) === sig(o));
  if (!t) return null;
  const tFirst = t.placedAt < o.placedAt || (t.placedAt === o.placedAt && t.id < o.id);
  return tFirst ? { orig: t, copy: o } : { orig: o, copy: t };
}

/** The later of an order entered twice: it does not count. */
export const isCopy = (orders: Order[], o: Order): boolean => twinOf(orders, o)?.copy === o;

/** Days an order has sat in its stage, and when that is late: 2 or more (OR01's "2+ days" chip; FACTS: #0530, Packing since Thu, the 1 late). */
export const LATE_DAYS = 2;
export function daysInStage(o: Order, now: Ms): number {
  return Math.floor((now - o.stageAt) / 864e5);
}

/**
 * Held for the seller's money (Mukono's #0551, "Not paid yet"): a live order in Checking that the seller holds
 * (the gate hands it back to whoever must take the money first), not billed, not called off, with money still to
 * take. One rule for Today (the Checking tile's mark, a Take with the order) and Customers (waiting on me).
 */
/** A pickup: the customer collects it at the gate (Order.deliverTo null); it has no drive and no arrival time. */
export function isPickup(o: Pick<Order, 'deliverTo'>): boolean {
  return !o.deliverTo;
}

/** On the road with nowhere to go: ready to collect at the gate (OR38; Today's ready mark, Your day's pill). */
export function readyToCollect(o: Pick<Order, 'stage' | 'deliverTo'>): boolean {
  return o.stage === 'road' && isPickup(o);
}

export function heldFor(o: Order, me: string): boolean {
  return o.stage === 'checking' && o.holderId === me && !o.invoiced && !o.cancelled && !o.voided && !o.qa && orderOwes(o) > 0;
}
