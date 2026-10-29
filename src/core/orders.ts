/*
 * The rules for placing an order, once, for both data sources.
 *
 *   where it starts   all from our shelf with nothing to decide → Packing; else Checking
 *                     (decision-rights "Orders that need nothing from a supplier"; sales.html:8758
 *                     nwShelfOnly; the server judges it as a move out of Checking, 0173)
 *   the price tag     a line the Manager decides carries who set it and why (decision-rights
 *                     "The price decision"; sales.html:4428-4440 priceNoteFor, placedPriceTag)
 *   the payload       the order as sales.html writes it (8722-8738), so every other app reads it
 */
import type { OrderDraft } from './datasource.ts';
import { creditHold, linePriced } from './money.ts';
import type { Customer, Day, Item, Line, Stage } from './types.ts';

/** Why the Manager decides a line's price, or null (sales.html:4423 priceNoteFor). */
export function priceNote(l: Line): 'under' | 'nomargin' | 'nocost' | null {
  if (!(l.cost && l.cost > 0)) return 'nocost';
  if (l.shopPrice == null) return 'nomargin';
  return l.price != null && l.price < l.shopPrice ? 'under' : null;
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
