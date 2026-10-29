/*
 * The sale at the counter (KC01–KC19): what is picked, who it is for, how they pay, and the one
 * write that sells it (counter_sale, through act). Kept here, not in a screen, so it lives while
 * the salesperson goes to the Who sheet, the count sheet or the wait, and comes back.
 *
 *   sale       the lines (in the order picked), the open line, the customer, the method, what they
 *              gave, the transaction ID, and `quote` when the sale is already in the books (it
 *              waited for the Manager's price: KC11, KC12)
 *   q          the search ("2 paint": KC02)
 *   busy       the slide went: "Sending…" until the server answers (KC13)
 *   failed     the last slide did not sell: nothing taken (KC19)
 *   sold       the last sale's answer, for the Sold screen before the books are read again (KC14, KC15)
 */
import { signal } from '@preact/signals';
import { dataError, isDataError, type CounterResult, type OrderDraft } from '../../../core/datasource.ts';
import { cashTotal } from '../../../core/money.ts';
import { priceNote } from '../../../core/orders.ts';
import type { Item, Line, Method, Order } from '../../../core/types.ts';
import { act, books, discardKept, isDemo, session } from '../shell/store.ts';

export interface Sale {
  lines: Line[];
  /** The line being changed (stepper, price), by lineId. */
  open: number | null;
  /** The line whose price field is open. */
  pricing: number | null;
  customerId: string | null;
  method: Method;
  /** Cash handed over: 'exact', one of the likely notes, or `counted` (KC06). */
  given: number | 'exact';
  /** What was counted or typed in "Other amount" (the fourth tile), when it was. */
  counted: number | null;
  ref: string;
  /** The sale already in the books (it waited for the Manager): sold with counter_sale p_quote_id. */
  quote: number | null;
}

const fresh = (): Sale => ({ lines: [], open: null, pricing: null, customerId: null, method: 'cash', given: 'exact', counted: null, ref: '', quote: null });

export const sale = signal<Sale>(fresh());
export const q = signal('');
export const busy = signal(false);
export const failed = signal(false);
export const sold = signal<(CounterResult & { given: number; ref: string }) | null>(null);
/** When this phone asked the Manager about each waiting sale (the demo's clock stands still: KC11 "2 m"). */
export const askedAt = new Map<number, number>();

/* ---------------- kept on this phone (KC17: "your lines are kept on this phone") ---------------- */

function key(): string | null {
  const s = session.value;
  return s && !isDemo ? 'ow-counter:' + s.userId : null;
}
function load(): Sale | null {
  try { const k = key(); return k ? (JSON.parse(localStorage.getItem(k) || 'null') as Sale | null) : null; } catch (_e) { return null; }
}
function keep(s: Sale): void {
  const k = key();
  if (!k) return;
  try { if (s.lines.length) localStorage.setItem(k, JSON.stringify(s)); else localStorage.removeItem(k); } catch (_e) { /* storage full: kept in memory */ }
}

/** The lines kept on this phone come back when the counter opens (signed in by then). */
export function restore(): void {
  if (sale.value.lines.length) return;
  const k = load();
  if (k && k.lines && k.lines.length) sale.value = { ...fresh(), ...k, open: null, pricing: null };
}

export function set(patch: Partial<Sale>): void {
  sale.value = { ...sale.value, ...patch };
  failed.value = false;
  keep(sale.value);
}

/** A new walk-in: nothing picked (Sell again, Serve the next walk-in). */
export function reset(): void {
  sale.value = fresh();
  q.value = ''; busy.value = false; failed.value = false;
  keep(sale.value);
}

/* ---------------- lines ---------------- */

export function lineOf(it: Item, qty: number, lineId: number): Line {
  return {
    lineId, itemId: it.id, variantIdx: it.variantIdx, name: it.name, unit: it.unit, packUnit: it.packUnit, packQty: it.packQty, qty,
    price: it.price, cost: it.cost, shopPrice: it.price, from: 'shelf', supplierId: '__stock__',
    priceBy: null, priceNote: null, priceReview: null, priceToldAt: null, state: null, stateAt: null,
  };
}

/** Add `qty` of an item: onto its line if it is picked already, else a new line at the end. */
export function add(it: Item, qty: number): void {
  const s = sale.value, have = s.lines.find((l) => l.itemId === it.id && l.variantIdx === it.variantIdx);
  const lines = have ? s.lines.map((l) => (l === have ? { ...l, qty: l.qty + qty } : l))
    : [...s.lines, lineOf(it, qty, s.lines.reduce((m, l) => Math.max(m, l.lineId), 0) + 1)];
  set({ lines, given: 'exact', counted: null });
}

export function setQty(lineId: number, qty: number): void {
  const s = sale.value;
  if (qty <= 0) { set({ lines: s.lines.filter((l) => l.lineId !== lineId), open: null, pricing: null, given: 'exact', counted: null }); return; }
  set({ lines: s.lines.map((l) => (l.lineId === lineId ? { ...l, qty } : l)), given: 'exact', counted: null });
}

/** Their price for each (KC10). At or above the shop's, the line is the shop's again; under it, Ruth decides. */
export function setPrice(lineId: number, price: number): void {
  const me = books.value ? books.value.me.id : null;
  const lines = sale.value.lines.map((l) => {
    if (l.lineId !== lineId) return l;
    const n = { ...l, price };
    const note = priceNote(n);
    return { ...n, priceNote: note === 'under' ? note : null, priceBy: note === 'under' ? me : null };
  });
  set({ lines, given: 'exact', counted: null });
}

/** Tap a line: it opens (one at a time); tap the open one's head and it closes. */
export function toggle(lineId: number): void {
  const s = sale.value;
  set({ open: s.open === lineId ? null : lineId, pricing: null });
}

export const totalOf = (lines: Line[]): number => cashTotal({ lines, charges: [], discount: 0 });

/** Lines under the shop's price that the Manager has not answered for that figure. */
export const waitingLines = (lines: Line[]): Line[] =>
  lines.filter((l) => l.shopPrice != null && l.price != null && l.price < l.shopPrice && !(l.priceReview && l.priceReview.price === l.price));

/** The draft as the server takes it. */
export function draftOf(s: Sale): OrderDraft {
  const b = books.value, c = b && s.customerId ? b.customers.find((x) => x.id === s.customerId) : null;
  return { customerId: s.customerId, client: { name: c ? c.name : 'Walk-in', phone: c ? c.phone : '' }, lines: s.lines, charges: [], credit: null, deliverTo: null, chatId: null };
}

/* ---------------- selling ---------------- */

const sameLines = (a: Line[], b: Line[]) => a.length === b.length && a.every((l, i) => l.itemId === b[i].itemId && l.qty === b[i].qty && l.price === b[i].price);

/**
 * Slide to sell (or Ask Ruth: the same write places it and asks, KC10). Resolves with the answer;
 * the screen goes to Sold, or to the wait when a price waits. Nothing is taken when it fails (KC19).
 */
export async function sell(given: number): Promise<CounterResult | null> {
  const s = sale.value, b = books.value;
  if (!b || busy.value || !s.lines.length) return null;
  busy.value = true; failed.value = false;
  try {
    if (s.quote != null) {
      const held = b.orders.find((o) => o.id === s.quote);
      if (held && !sameLines(held.lines, s.lines)) await act('counterLines', s.quote, s.lines);
    }
    const r = await act<CounterResult>('counterSale', draftOf(s), { method: s.method, given: s.method === 'cash' ? given : 0, ref: s.method === 'cash' ? '' : s.ref.trim(), quote: s.quote });
    // A sale is never kept to send later: money changes hands now (KC13 "nothing can double-sell").
    if (r.kept) { await discardKept(r.id); throw dataError('offline', 'No signal'); }
    const res = r.value;
    if (res.waiting) {
      askedAt.set(res.order.id, Date.now());
      reset();
      return res;
    }
    sold.value = { ...res, given: s.method === 'cash' ? given : 0, ref: s.method === 'cash' ? '' : s.ref.trim() };
    reset();
    return res;
  } catch (e) {
    busy.value = false;
    failed.value = true;
    if (!isDataError(e)) throw e;
    return null;
  }
}

/** Ruth's yes came: the sale comes back to the counter, to be paid (KC12). */
export function bringBack(o: Order): void {
  sale.value = { ...fresh(), lines: o.lines.map((l) => ({ ...l })), customerId: o.customerId, quote: o.id };
  q.value = ''; busy.value = false; failed.value = false;
}
