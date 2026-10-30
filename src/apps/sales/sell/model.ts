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
    key: x.key, at: x.at, customerId: x.customerId, client: x.client, lines: x.lines, charges: x.charges,
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
  if (cur.value) cur.value = fn(cur.value);
}
const nextId = (x: Build) => x.lines.reduce((m, l) => Math.max(m, l.lineId), 0) + 1;

/** Add an item (or more of a line already in). Returns the line. */
export function add(it: Item, qty: number): Line {
  let out: Line | null = null;
  edit((x) => {
    const had = x.lines.find((l) => l.itemId === it.id && l.variantIdx === it.variantIdx);
    if (had) {
      out = { ...lineFor(it, had.qty + qty, had.lineId), price: had.price, priceBy: had.priceBy };
      return { ...x, lines: x.lines.map((l) => (l === had ? (out as Line) : l)) };
    }
    out = lineFor(it, qty, nextId(x));
    return { ...x, lines: [...x.lines, out] };
  });
  return out as unknown as Line;
}

export function setQty(lineId: number, qty: number): void {
  edit((x) => ({ ...x, lines: x.lines.map((l) => (l.lineId === lineId ? { ...l, qty } : l)) }));
}

/** "Order in 8": the line stays at what they asked; what the shelf lacks is bought in. */
export function orderInRest(lineId: number): void {
  edit((x) => ({ ...x, lines: x.lines.map((l) => (l.lineId === lineId ? { ...l, from: 'none', supplierId: '' } : l)) }));
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

export function setMode(m: Mode): void {
  edit((x) => ({ ...x, mode: m }));
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
export function addCharge(label: string, value: number): void {
  edit((x) => ({ ...x, charges: [...x.charges, { id: x.charges.reduce((m, c) => Math.max(m, c.id), 1) + 1, label, type: 'fixed', value }] }));
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
