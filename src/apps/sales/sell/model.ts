/*
 * The order being built (SL03–SL27): who it is for, its lines, how it goes,
 * how it is paid, and the picture to the customer. One order at a time; an
 * order not placed is kept on this phone as a draft ("Still open", the red
 * +'s count) through the shell's drafts (store.ts saveDrafts).
 *
 * Money is never worked out here: totals, the credit charge, prices coming
 * and the credit hold are src/core/money.ts; where a price waits for the
 * Manager is src/core/orders.ts. Placing is act('placeOrder') (place_order,
 * 0180), with the draft's own key so a retry is the same order.
 */
import { computed, signal } from '@preact/signals';
import { cashTotal, creditCharge, creditHold, orderTotal, pricesComing } from '../../../core/money.ts';
import { lineWaits } from '../../../core/orders.ts';
import { followCount } from '../../../core/services.ts';
import { inPack, packEach, sellsByPack, switchQty } from '../../../core/units.ts';
import { dayOf } from '../../../core/time.ts';
import type { Books, Charge, Customer, Item, Line } from '../../../core/types.ts';
import { books, chats, drafts, now, saveDrafts, type Draft } from '../shell/store.ts';

export type Mode = 'pickup' | 'delivery';
export type When = 'today-pm' | 'tomorrow-am' | 'tomorrow-pm';
export const WHEN_WORD: Record<When, string> = { 'today-pm': 'today afternoon', 'tomorrow-am': 'tomorrow morning', 'tomorrow-pm': 'tomorrow afternoon' };

export interface Delivery { where: string; phone: string; when: When }

export interface Build {
  key: string;
  at: number;
  customerId: string | null;
  client: { name: string; phone: string };
  chatId: number | null;
  /**
   * Oldest first. Drawn newest first as they are added (SL05–SL07, SL13–SL15); an order resumed from
   * "Still open" keeps the lines it was kept with (lineId up to `kept`) in their own order under them (SL25).
   */
  lines: Line[];
  kept?: number;
  /**
   * A line part on our shelf and the rest ordered in (SL13 "Order in 8", SL40): lineId → how many come
   * from the shelf. Drawn as one line; written as two (the shelf's, supplierId '__stock__', and the rest
   * with no supplier yet, for the Buyer), as place_order takes lines (0180).
   */
  split?: Record<number, number>;
  charges: Charge[];
  credit: boolean;
  mode: Mode;
  delivery: Delivery | null;
  /** Send the order's picture on WhatsApp as it is placed. */
  pic: boolean;
}

export const cur = signal<Build | null>(null);
/** The line open for editing (lineId), and the count being typed on it. */
export const openId = signal<number | null>(null);
/** What is typed in "Add an item". */
export const query = signal('');

export const shop = (): Books => books.value as Books;
export const itemOf = (b: Books, id: string, vi: number | null = null): Item | undefined => b.items.find((i) => i.id === id && i.variantIdx === vi);
export const customerOf = (b: Books, id: string | null): Customer | null => (id ? b.customers.find((c) => c.id === id) || null : null);

let keyN = 0;
const newKey = () => `d-${Date.now().toString(36)}-${++keyN}`;

/**
 * A line of `qty` of an item at the shop's price: from our shelf when the shelf has any (more than it
 * holds is "short" until Grace makes it fit or orders the rest in: SL13), else bought in ("Order in").
 */
export function lineFor(it: Item, qty: number, lineId: number): Line {
  const shelf = (it.onShelf || 0) > 0;
  return {
    lineId, itemId: it.id, variantIdx: it.variantIdx, name: it.name, unit: it.unit, packUnit: it.packUnit, packQty: it.packQty, qty,
    price: it.price, cost: it.cost, shopPrice: it.price, from: shelf ? 'shelf' : 'none', supplierId: shelf ? '__stock__' : '',
    priceBy: null, priceNote: null, priceReview: null, priceToldAt: null, state: null, stateAt: null,
  };
}


/* ---------------- starting, keeping, switching ---------------- */

export function start(customerId: string | null, o: { chatId?: number | null; client?: { name: string; phone: string } } = {}): Build {
  const b = shop(), c = customerOf(b, customerId);
  const chat = o.chatId ?? chatOf(customerId);
  const build: Build = {
    key: newKey(), at: now.value, customerId, client: o.client || (c ? { name: c.name, phone: c.phone } : { name: 'Walk-in', phone: '' }),
    chatId: chat, lines: [], charges: [], credit: false, mode: 'pickup', delivery: null, pic: true,
  };
  cur.value = build; openId.value = null; query.value = '';
  return build;
}

const SEP = ' · ';
function fromDraft(d: Draft): Build {
  const parts = d.deliverTo ? d.deliverTo.split(SEP) : [];
  const when = (Object.keys(WHEN_WORD) as When[]).find((w) => WHEN_WORD[w] === parts[1]) || 'today-pm';
  return {
    key: d.key, at: d.at, customerId: d.customerId, client: d.client, chatId: d.chatId ?? chatOf(d.customerId), lines: d.lines.slice(),
    kept: d.lines.reduce((m, l) => Math.max(m, l.lineId), 0), charges: d.charges.slice(),
    credit: !!d.credit, mode: d.deliverTo ? 'delivery' : 'pickup', delivery: d.deliverTo ? { where: parts[0], phone: parts[2] || '', when } : null, pic: true,
  };
}

/** Resume an order kept for later ("Still open"). */
export function resume(key: string): Build | null {
  const d = drafts.value.find((x) => x.key === key);
  if (!d) return null;
  cur.value = fromDraft(d); openId.value = null; query.value = '';
  return cur.value;
}

/** The order as place_order takes it (OrderDraft), and as the drafts keep it. */
export function toDraft(x: Build): Draft {
  const b = shop();
  return {
    key: x.key, at: x.at, customerId: x.customerId, client: x.client, lines: written(x), charges: x.charges,
    credit: x.credit ? { pct: b.settings.creditPct, days: b.settings.chaseAfterDays } : null,
    deliverTo: x.mode === 'delivery' && x.delivery ? [x.delivery.where, WHEN_WORD[x.delivery.when], x.delivery.phone].join(SEP) : null,
    chatId: x.chatId,
  };
}

/** Keep it under "Still open" (or drop it when it holds nothing). */
export function keep(x: Build | null = cur.value): void {
  if (!x) return;
  const rest = drafts.value.filter((d) => d.key !== x.key);
  saveDrafts(x.lines.length ? [...rest, toDraft(x)] : rest);
}

export function forget(key: string): void {
  saveDrafts(drafts.value.filter((d) => d.key !== key));
}

/** The lines go along to another customer (SL26 "Change · 3 items"). */
export function moveTo(customerId: string): void {
  const x = cur.value, b = shop(), c = customerOf(b, customerId);
  if (!x || !c) return;
  forget(x.key);
  const chat = chatOf(customerId);
  cur.value = { ...x, key: newKey(), customerId, client: { name: c.name, phone: c.phone }, chatId: chat, delivery: null, mode: 'pickup', charges: x.charges.filter((ch) => !/^Delivery/.test(ch.label)), credit: false };
}

/** The customer's WhatsApp chat, when they have one (for the picture). */
export function chatOf(customerId: string | null): number | null {
  const cb = chats.value, c = cb && customerId ? cb.chats.find((x) => x.customerId === customerId) : null;
  return c ? c.id : null;
}

/* ---------------- lines ---------------- */

function edit(fn: (x: Build) => Build): void {
  const x = cur.value, b = books.value;
  if (!x) return;
  const y = fn(x);
  // A charge at the shop's rate a bag follows the count (SL39, services.ts followCount).
  cur.value = b && y.lines !== x.lines ? { ...y, charges: followCount(b.settings.services, y.charges, x.lines, y.lines) } : y;
}
const nextId = (x: Build) => x.lines.reduce((m, l) => Math.max(m, l.lineId), 0) + 1;

/**
 * Add an item (or more of a line already in). Returns the line. `by: 'pack'` adds that many of its pack (SL43, the
 * card's Pcs | Bundle): 1 bundle of 10 is 10 pcs at 10,500, counted in bundles (core/units.ts).
 */
export function add(it: Item, qty: number, by: 'unit' | 'pack' = 'unit'): Line {
  const pack = by === 'pack' && sellsByPack(it), n = pack ? qty * it.packQty : qty;
  let out: Line | null = null;
  edit((x) => {
    const had = x.lines.find((l) => l.itemId === it.id && l.variantIdx === it.variantIdx);
    if (had) {
      // Counted in bundles, it stays so: more of it, at its own price (SL42).
      out = { ...lineFor(it, had.qty + n, had.lineId), price: had.price, priceBy: had.priceBy, ...(inPack(had) ? { qtyIn: 'pack' as const, shopPrice: had.shopPrice } : {}) };
      return { ...x, lines: x.lines.map((l) => (l === had ? (out as Line) : l)) };
    }
    out = { ...lineFor(it, n, nextId(x)), ...(pack ? { qtyIn: 'pack' as const } : {}) };
    return { ...x, lines: [...x.lines, out] };
  });
  return out as unknown as Line;
}

export function setQty(lineId: number, qty: number): void {
  edit((x) => ({ ...x, lines: x.lines.map((l) => (l.lineId === lineId ? { ...l, qty } : l)) }));
}

/** "Order in 8": the line stays at what they asked; what the shelf lacks is bought in. */
/** Order in the rest (SL13 → SL40): what the shelf holds comes from it, the rest is bought. */
export function orderInRest(lineId: number, shelf: number): void {
  edit((x) => ({ ...x, split: { ...(x.split || {}), [lineId]: shelf } }));
}

/** How many of a line are ordered in (0 when none). */
export function restOf(x: Build, l: Line): number {
  const s = x.split && x.split[l.lineId];
  return s != null && l.qty > s ? l.qty - s : 0;
}

/** The lines as they are written: a split line as its shelf part and the part ordered in. */
function written(x: Build): Line[] {
  const top = x.lines.reduce((m, l) => Math.max(m, l.lineId), 0);
  let n = top;
  return x.lines.flatMap((l) => {
    const rest = restOf(x, l);
    if (!rest) return [l];
    return [{ ...l, qty: l.qty - rest, from: 'shelf' as const, supplierId: '__stock__' }, { ...l, lineId: ++n, qty: rest, from: 'none' as const, supplierId: '' }];
  });
}

/**
 * SL42 · count a line in the item's unit or its pack (core/units.ts). The count becomes whole ones of the new unit,
 * rounding up (12 pcs → 2 bundles), at the shop's price (10,500 a pcs; 105,000 a bundle of 10): a price typed for
 * the other unit does not carry over. The seller takes it down with − (Kevin, 10 Nov: "keep unit simple").
 */
export function setUnit(lineId: number, to: 'unit' | 'pack'): void {
  const b = books.value;
  if (!b) return;
  edit((x) => ({ ...x, lines: x.lines.map((l) => {
    const it = itemOf(b, l.itemId, l.variantIdx), each = it ? packEach(it) : null;
    if (l.lineId !== lineId || !it || each == null || inPack(l) === (to === 'pack')) return l;
    const qty = switchQty(l.qty, it.packQty, to), price = to === 'pack' ? each : it.price;
    const { qtyIn: _was, ...rest } = l;
    return { ...rest, ...(to === 'pack' ? { qtyIn: 'pack' as const } : {}), packUnit: it.packUnit, packQty: it.packQty, qty, price, shopPrice: price, priceBy: null, priceNote: null };
  }), split: x.split && x.split[lineId] != null ? Object.fromEntries(Object.entries(x.split).filter(([k]) => Number(k) !== lineId)) : x.split }));
}

/** A price typed for them (SL18): under the shop's, the Manager decides it (decision-rights "The price decision"). */
export function setPrice(lineId: number, price: number, by: string): void {
  edit((x) => ({ ...x, lines: x.lines.map((l) => (l.lineId === lineId
    ? { ...l, price, priceBy: l.shopPrice != null && price === l.shopPrice ? null : by, priceNote: l.shopPrice != null && price < l.shopPrice ? 'under' : null }
    : l)) }));
}

export function remove(lineId: number): Line | null {
  const x = cur.value, l = x ? x.lines.find((y) => y.lineId === lineId) || null : null;
  edit((y) => ({ ...y, lines: y.lines.filter((z) => z.lineId !== lineId) }));
  if (openId.value === lineId) openId.value = null;
  return l;
}

/** Put a removed line back where it was (Undo). */
export function restore(l: Line): void {
  edit((x) => ({ ...x, lines: [...x.lines, l].sort((a, b) => a.lineId - b.lineId) }));
}

/* ---------------- how it goes, how it is paid ---------------- */

/** Pickup takes the delivery fee off; Delivery puts it back through its sheet (SL17, setDelivery). */
export function setMode(m: Mode): void {
  edit((x) => ({ ...x, mode: m, ...(m === 'pickup' ? { charges: x.charges.filter((c) => !/^Delivery/.test(c.label)) } : {}) }));
}
export function setDelivery(d: Delivery, fee: number, area: string): void {
  edit((x) => ({
    ...x, mode: 'delivery', delivery: d,
    charges: [...x.charges.filter((c) => !/^Delivery/.test(c.label)), ...(fee > 0 ? [{ id: 1, label: `Delivery · ${area}`, type: 'fixed' as const, value: fee }] : [])],
  }));
}
export function setCredit(on: boolean): void {
  edit((x) => ({ ...x, credit: on }));
}
export function setPic(on: boolean): void {
  edit((x) => ({ ...x, pic: on }));
}
/** A charge on the order, one of each: adding Loading again replaces it, never doubles it (SL39). */
export function addCharge(label: string, value: number): void {
  edit((x) => ({ ...x, charges: [...x.charges.filter((c) => c.label !== label), { id: x.charges.reduce((m, c) => Math.max(m, c.id), 1) + 1, label, type: 'fixed', value }] }));
}
export function removeCharge(id: number): void {
  edit((x) => ({ ...x, charges: x.charges.filter((c) => c.id !== id) }));
}

/* ---------------- what it comes to ---------------- */

/** The order's figures, by money.ts. */
export const sums = computed(() => {
  const x = cur.value, b = books.value;
  if (!x || !b) return null;
  const o = { lines: x.lines, charges: x.charges, discount: 0, credit: x.credit ? { pct: b.settings.creditPct, days: b.settings.chaseAfterDays } : null };
  const c = customerOf(b, x.customerId), total = orderTotal(o);
  return {
    cash: cashTotal(o), credit: creditCharge(o), total, coming: pricesComing(x.lines),
    /** Lines whose price the Manager decides (under the shop's price, until they answer). */
    forRuth: x.lines.filter((l) => l.price != null && lineWaits(l)).length,
    hold: x.credit && c ? creditHold(c, total, true, dayOf(now.value), b.settings.holdDays) : null,
    allShelf: x.lines.length > 0 && x.lines.every((l) => { const it = itemOf(b, l.itemId, l.variantIdx); return l.from === 'shelf' && !!it && (it.onShelf || 0) >= l.qty; }),
  };
});

/** The order is still being filled: picked up, cash, no charges (the foot waits below the fold). */
export const plain = computed(() => {
  const x = cur.value;
  return !!x && !x.credit && x.mode === 'pickup' && x.charges.length === 0;
});
