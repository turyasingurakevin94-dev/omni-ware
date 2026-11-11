/*
 * When a count is due (docs/spec/04-screens-store.md §4.5 "The blind count", screens Q10).
 * One rule, read by the Shelf (an item's "Count due" in place of its figure, the aisle's
 * ring) and by Today (the "Count · aisle C" job and the red button's badge).
 *
 *   countDue(item, b, now)   Ruth asked a recount of it, or it is on the shelf and not
 *                            counted for more than COUNT_DUE_DAYS (store.html:5148 countDue)
 *   aislesDue(b, now)        the aisles with an item due, oldest count first, none of them
 *                            with a count already waiting on Ruth (one waiting count per place)
 *   countAge(at, now)        whole days since a count, by the calendar ("30 days")
 *   aisleLetter(b, aisle)    A–L in the shop's aisle order (FACTS §5); '' for no aisle
 *
 * OPEN (screens Q10, for Kevin): a count is due after 21 days here (store.html:5148), but the
 * Shelf's "counted every 14 days" and an aisle's freshness ring use 14 (COUNT_DUE_DAYS in
 * store.html:5120). The boards agree with either: FACTS' only due aisle (C, 30 days) is past
 * both, and every other aisle was counted 8 days ago or less. Until Kevin picks one number,
 * due is 21 and the ring's freshness is FRESH_DAYS, 14.
 */
import { dayOf, daysApart } from '../time.ts';
import type { Ms } from '../types.ts';
import { countPlace } from './keys.ts';
import type { ShelfItem, StockCount, YardBooks } from './types.ts';

/** Due after this many days without a count (store.html:5148; screens Q10). */
export const COUNT_DUE_DAYS = 21;
/** The aisle ring is fresh within this many days (store.html:5120 COUNT_DUE_DAYS = 14; screens Q10, open). */
export const FRESH_DAYS = 14;

/** Whole days since `at`, by the calendar (Thu 17 Sep → Sat 17 Oct is 30). */
export function countAge(at: Ms | null, now: Ms): number | null {
  return at == null ? null : daysApart(dayOf(at), dayOf(now));
}

const placeOf = (c: StockCount): string | null => c.place || countPlace(c.aisle, c.lines.map((l) => l.key));

/** Ruth asked for this item (or its aisle) to be counted again, and nothing newer has gone since. */
export function recountAsked(it: Pick<ShelfItem, 'key' | 'category'>, counts: StockCount[]): boolean {
  const mine = (c: StockCount) => {
    const p = placeOf(c);
    return p === 'item:' + it.key || (!!it.category && p === 'aisle:' + it.category.toLowerCase()) || c.lines.some((l) => l.key === it.key);
  };
  const last = counts.filter(mine).sort((a, b) => b.createdAt - a.createdAt)[0];
  return !!last && last.status === 'recount';
}

/** A count for this item's place is with Ruth now (one waiting count per place, 0161). */
export function countWaiting(it: Pick<ShelfItem, 'key' | 'category'>, counts: StockCount[]): boolean {
  return counts.some((c) => c.status === 'sent' && (placeOf(c) === 'item:' + it.key || (!!it.category && placeOf(c) === 'aisle:' + it.category.toLowerCase())));
}

/**
 * Due: a recount asked, or on the shelf and not counted for more than COUNT_DUE_DAYS. `onShelf` is
 * the shelf figure when the caller has it (shelf.ts); else the books' figure says whether any is there.
 */
export function countDue(it: ShelfItem, b: Pick<YardBooks, 'counts'>, now: Ms, onShelf: number = it.books): boolean {
  if (recountAsked(it, b.counts)) return true;
  if (onShelf <= 0) return false;
  const age = countAge(it.countedAt, now);
  return age == null || age > COUNT_DUE_DAYS;
}

export function aisleLetter(b: Pick<YardBooks, 'aisles'>, aisle: string | null): string {
  const i = aisle ? b.aisles.indexOf(aisle) : -1;
  return i >= 0 ? String.fromCharCode(65 + i) : '';
}

export interface AisleDue { aisle: string; letter: string; days: number | null; items: number }

/** The aisles to count: any item due, no count of the aisle waiting on Ruth; the oldest first. */
export function aislesDue(b: Pick<YardBooks, 'items' | 'counts' | 'aisles'>, now: Ms): AisleDue[] {
  const by = new Map<string, ShelfItem[]>();
  b.items.forEach((it) => { if (it.category && countDue(it, b, now)) by.set(it.category, [...(by.get(it.category) || []), it]); });
  const out: AisleDue[] = [];
  by.forEach((list, aisle) => {
    if (countWaiting({ key: '', category: aisle }, b.counts)) return;
    const oldest = list.reduce<number | null>((m, it) => (it.countedAt == null ? m : m == null ? it.countedAt : Math.min(m, it.countedAt)), null);
    out.push({ aisle, letter: aisleLetter(b, aisle), days: countAge(oldest, now), items: list.length });
  });
  return out.sort((x, y) => (y.days ?? 1e9) - (x.days ?? 1e9) || x.letter.localeCompare(y.letter));
}

/* ---- the Shelf's counting (blind spot and aisle counts, SH10–SH25; FLOW-01, DATA-01) ---- */

/** The aisle ring's freshness, by the Shelf's name for it (= FRESH_DAYS). */
export const AISLE_FRESH_DAYS = FRESH_DAYS;

/** Whole days between two moments, by the Kampala calendar (Thu 16:10 → Sat 10:41 is 2). */
export function daysSince(at: Ms, now: Ms): number {
  return countAge(at, now) as number;
}

/** The count Ruth sent back for this item ("count it again"), the newest, or null: when, and which count it replaces. */
export function recountOf(b: Pick<YardBooks, 'counts'>, key: string): StockCount | null {
  return b.counts.filter((c) => c.status === 'recount' && c.lines.some((l) => l.key === key))
    .sort((x, y) => (y.decidedAt || 0) - (x.decidedAt || 0))[0] || null;
}

/** The count waiting with Ruth for a place, or null (one per place, 0161). */
export function waitingFor(b: Pick<YardBooks, 'counts'>, place: string | null): StockCount | null {
  if (!place) return null;
  return b.counts.find((c) => c.status === 'sent' && placeOf(c) === place) || null;
}

/** stock_counts.aisle: "Spot count · Wire nails 4\" · 25kg ctn", "Aisle C · Fasteners"; and their places (keys.ts countPlace). */
export const spotName = (it: Pick<ShelfItem, 'name'>): string => `Spot count · ${it.name}`;
export const aisleName = (letter: string, aisle: string): string => `Aisle ${letter} · ${aisle}`;
export const spotPlace = (it: Pick<ShelfItem, 'key' | 'name'>): string => countPlace(spotName(it), [it.key]) as string;
export const aislePlace = (letter: string, aisle: string): string => countPlace(aisleName(letter, aisle)) as string;

/** One level the yard counts in: its unit, and how many of the books' unit one of it is. */
export interface Level { unit: string; per: number }

/** Bundles of 20 then pieces; cartons then loose kg (store.html:5299 levelsFor). */
export function levelsOf(it: Pick<ShelfItem, 'unit' | 'packUnit' | 'packQty' | 'loose'>): Level[] {
  const unit = (it.unit || 'pc').toLowerCase(), pack = (it.packUnit || '').toLowerCase();
  const L: Level[] = [];
  if (it.packQty > 1 && pack && pack !== unit) L.push({ unit: pack, per: it.packQty });
  L.push({ unit, per: 1 });
  if (it.loose && it.loose.per > 1 && it.loose.unit.toLowerCase() !== unit) L.push({ unit: it.loose.unit.toLowerCase(), per: 1 / it.loose.per });
  return L;
}

/** What was counted, in the books' unit, rounded to two places ("17 ctn + 12 kg" → 17.48 ctn). */
export function inLineUnit(levels: Level[], values: (number | null)[]): number {
  const n = levels.reduce((s, l, i) => s + (values[i] || 0) * l.per, 0);
  return Math.round(n * 100) / 100;
}

/** One line of a count. `shelf` (shelf.ts onShelf) goes as `system`, what has left for orders as `held`: Ruth sees them, the yard never does. */
export function countLine(it: ShelfItem, counted: number, shelf: number): StockCount['lines'][number] {
  return { key: it.key, productId: it.productId, variantIdx: it.variantIdx, name: it.name, counted, system: shelf, held: Math.max(0, it.books - shelf) };
}

/** The item's counts, newest first (SH25 "Counts of this item"). */
export function countsOf(b: Pick<YardBooks, 'counts'>, key: string): StockCount[] {
  return b.counts.filter((c) => c.lines.some((l) => l.key === key) || c.missing.some((l) => l.key === key)).sort((x, y) => y.createdAt - x.createdAt);
}
