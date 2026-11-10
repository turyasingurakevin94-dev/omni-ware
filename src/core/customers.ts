/*
 * A customer's rhythm, once (docs/spec/04-screens-sales.md §4): when they last ordered, how far
 * past their usual gap they are, and so who is due and who has gone quiet. Pure functions over the
 * books' shapes; the caller passes `today` (Kampala).
 *
 *   last order   the most recent order placed, not cancelled, voided, a test record or the copy of an
 *                order entered twice (FACTS rule 1; Nansana's last is #0556 10:02, not the copy #0557)
 *   due          today is on or after last order + every N days (sales.html:4674 r.due)
 *   gone quiet   more than twice their gap since the last order (sales.html:4674 r.overdue:
 *                since > every × 2); gone quiet is its own group, never "due" (sales.html:6927)
 */
import { isCopy } from './orders.ts';
import { addDays, dayOf, daysApart } from './time.ts';
import type { Customer, Day, Order, UsualLine } from './types.ts';

export interface Rhythm {
  /** Their usual gap in days (Customer.everyDays), null when not known. */
  every: number | null;
  /** The day of their last order, null when none. */
  last: Day | null;
  /** Their last order itself, null when none. */
  lastOrder: Order | null;
  /** The day they are due next (last + every), null when not known. */
  next: Day | null;
  /** Days since the last order. */
  since: number | null;
  /** Days past the next due day: 0 = due today, below 0 = not due yet. */
  late: number | null;
  due: boolean;
  quiet: boolean;
}

/** Their last order: the most recent placed, not cancelled, voided, a test record or a copy (FACTS rule 1). */
export function lastOrderOf(customerId: string, orders: Order[]): Order | null {
  return orders.filter((o) => o.customerId === customerId && !o.cancelled && !o.voided && !o.qa && !isCopy(orders, o))
    .reduce<Order | null>((m, o) => (!m || o.placedAt > m.placedAt ? o : m), null);
}

export function rhythm(c: Customer, orders: Order[], today: Day): Rhythm {
  const lastOrder = lastOrderOf(c.id, orders);
  const last = lastOrder ? dayOf(lastOrder.placedAt) : null, every = c.everyDays && c.everyDays > 0 ? c.everyDays : null;
  const since = last ? daysApart(last, today) : null;
  const late = last && every ? daysApart(addDays(last, every), today) : null;
  const quiet = every != null && since != null && since > every * 2;
  return { every, last, lastOrder, next: last && every ? addDays(last, every) : null, since, late, due: late != null && late >= 0 && !quiet, quiet };
}

/** "Due today · every 7 days", "4 days late · every 14 days". */
export function dueWords(r: Rhythm): string {
  const every = `every ${r.every} days`, late = r.late || 0;
  return late === 0 ? `Due today · ${every}` : `${late} day${late === 1 ? '' : 's'} late · ${every}`;
}

/** Each customer's usual, counted from the orders (the books carry it so every tab reads one rule). */
export function withUsuals<B extends { customers: Customer[]; orders: Order[] }>(b: B): B {
  b.customers.forEach((c) => { c.usual = usualOf(c.id, b.orders); });
  return b;
}

/** Who is due (FACTS "Who's due 3"), the most owed first, then the latest. Test records are left out. */
export function dueCustomers(customers: Customer[], orders: Order[], today: Day): { c: Customer; r: Rhythm }[] {
  return customers.filter((c) => !c.qa).map((c) => ({ c, r: rhythm(c, orders, today) })).filter((x) => x.r.due)
    .sort((x, y) => y.c.owes - x.c.owes || (y.r.late || 0) - (x.r.late || 0));
}

/** How many of their last bills the usual is counted over (FACTS §3.2: "Iron sheet 5 of 7"). */
export const USUAL_OF = 7;

/**
 * Their usual, counted from their orders (one rule; sales.html:4659 usualLinesNow, with FACTS' window): over their
 * last USUAL_OF invoiced orders (not voided, not a test record), each item in at least a third of them and at least
 * twice (one order is not a usual), the most often first; its count is the one they take most often (a tie, the
 * larger). Kato: Cement every order, Iron sheet G28 5 of 7, Wire nails 3 of 7; 40 bag, 30 pc, 2 ctn (SL03, SL33).
 * Open for Kevin (spec 04 Q14): sales.html counts every order, needs half of them (one order's items when there is
 * one) and takes the middle count.
 */
export function usualOf(customerId: string, orders: Order[]): UsualLine[] {
  const hist = orders.filter((o) => o.customerId === customerId && o.invoiced && !o.voided && !o.qa && !o.cancelled)
    .sort((x, y) => (x.invoicedAt || x.placedAt) - (y.invoicedAt || y.placedAt) || x.id - y.id).slice(-USUAL_OF);
  const n = hist.length;
  if (n < 2) return [];
  const need = Math.max(2, Math.ceil(n / 3));
  const seen = new Map<string, { itemId: string; variantIdx: number | null; orders: number; qtys: number[]; first: number }>();
  hist.forEach((o, i) => {
    const here = new Map<string, number>();
    o.lines.forEach((l) => { if (!l.itemId) return; const k = `${l.itemId}::${l.variantIdx ?? ''}`; here.set(k, (here.get(k) || 0) + (Number(l.qty) || 0)); });
    here.forEach((q, k) => {
      const l = o.lines.find((x) => `${x.itemId}::${x.variantIdx ?? ''}` === k)!;
      const e = seen.get(k) || { itemId: l.itemId, variantIdx: l.variantIdx ?? null, orders: 0, qtys: [], first: i };
      e.orders++; e.qtys.push(q); seen.set(k, e);
    });
  });
  const mode = (qs: number[]) => {
    const c = new Map<number, number>(); qs.filter((q) => q > 0).forEach((q) => c.set(q, (c.get(q) || 0) + 1));
    return [...c].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] || 1;
  };
  return [...seen.values()].filter((e) => e.orders >= need).sort((a, b) => b.orders - a.orders || a.first - b.first)
    .map((e) => ({ itemId: e.itemId, variantIdx: e.variantIdx, qty: mode(e.qtys), seen: e.orders, of: n }));
}
