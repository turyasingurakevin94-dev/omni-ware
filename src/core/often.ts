/*
 * "Often with" an item, said once (LANGUAGE P13; agent.html:8890 oftenWith): what came in the
 * same orders as it, across this customer's orders when they have had it twice or more, else
 * across all of mine; each with how many of those orders had it ("2/5"), most often first, less
 * what is already on the screen. Sell's order (P13) and the Chats price sheet (CH21) both read it.
 */
import type { Order } from './types.ts';

export interface OftenWith {
  /** True when counted over this customer's orders ("in Kato's orders"); false: over mine. */
  theirs: boolean;
  /** How many orders had the item. */
  of: number;
  rows: { itemId: string; variantIdx: number | null; n: number }[];
}

const key = (id: string, v: number | null) => id + '::' + (v == null ? '' : v);
const live = (o: Order) => !o.voided && !o.cancelled && !o.qa;

export function oftenWith(orders: Order[], anchor: { itemId: string; variantIdx: number | null }, o: { customerId: string | null; me: string; skip?: Set<string>; n?: number }): OftenWith {
  const k0 = key(anchor.itemId, anchor.variantIdx), skip = o.skip || new Set<string>();
  const scan = (list: Order[]) => {
    const withIt = list.filter((x) => live(x) && x.lines.some((l) => key(l.itemId, l.variantIdx) === k0));
    const by = new Map<string, { itemId: string; variantIdx: number | null; n: number }>();
    withIt.forEach((x) => {
      const seen = new Set<string>();
      x.lines.forEach((l) => {
        const k = key(l.itemId, l.variantIdx);
        if (k === k0 || seen.has(k) || skip.has(l.itemId) || skip.has(k)) return;
        seen.add(k);
        const r = by.get(k);
        if (r) r.n += 1; else by.set(k, { itemId: l.itemId, variantIdx: l.variantIdx, n: 1 });
      });
    });
    return { of: withIt.length, rows: [...by.values()].sort((a, b) => b.n - a.n) };
  };
  const theirs = o.customerId ? scan(orders.filter((x) => x.customerId === o.customerId)) : null;
  // Their own when they have had it twice or more and something came with it; else across mine.
  const got = theirs && theirs.of >= 2 && theirs.rows.length ? { ...theirs, theirs: true } : { ...scan(orders.filter((x) => x.placedBy === o.me)), theirs: false };
  return { theirs: got.theirs, of: got.of, rows: got.rows.slice(0, o.n || 3) };
}
