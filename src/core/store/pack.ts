/*
 * Packing one order, line by line (docs/spec/04-screens-store.md §4.1 "Cancelled", "The copy";
 * §4.2 Packing). Pure rules over YardOrder: the screens in src/apps/store/pack read these and
 * never work a line's state out for themselves.
 *
 *   notPicked(o, l)      a line the yard never picks: dropped, the client waits, Ruth settled it to nothing
 *   packLines(o)         the lines to pack, in their order
 *   progress(o)          "1 of 2" packed (dropped lines left out)
 *   currentLine(o, want) the line on screen: the one asked for if it is open, else the next open one
 *   lineMark(o, l, now)  done · short · now · open · dropped, for the strip under the head
 *   isLastOpen(o, idx)   answering it finishes the order (the pack is held 10 s with Undo)
 *   shortNow(o, l)       short until Ruth settles it
 *   putBack(o)           a cancelled order's picked lines, what goes back to the shelf
 *   canUnpack(o)         packed and still in the yard: Unpack frees its bay (W5)
 *   shortName(name)      "Iron sheet G28 · 3m" → "Iron sheet", for the strip's labels
 *   aisleOf(b, l)        the line's aisle: its name and letter ("G", "Tools")
 *   whereOf(o, b)        where · when · phone, the order's own (deliverTo first), or "They collect"
 *   unitWord(unit, n)    "cartons", "pieces": the short count's question
 *
 * No money (types.ts head).
 */
import { destinationOf, isCancelled, isPickup } from './yard.ts';
import type { YardBooks, YardLine, YardOrder } from './types.ts';

/** A line Ruth settled to nothing ("Bill what went" on none). */
function settledToNothing(o: YardOrder, l: YardLine): boolean {
  const s = o.pickSettle && o.pickSettle.lines.find((x) => x.idx === l.idx);
  return !!s && s.picked === 0;
}

/** A line the yard never picks (store.html:1540 lineNotPicked): not a short pick. */
export function notPicked(o: YardOrder, l: YardLine): boolean {
  if (l.dropped) return true;
  if (l.clientWaits && (!l.supplierId || l.supplierId === '__stock__')) return true;
  return settledToNothing(o, l);
}

export const packLines = (o: YardOrder): YardLine[] => o.lines.filter((l) => !notPicked(o, l));
export const isAnswered = (l: YardLine): boolean => l.pickStatus === 'done' || l.pickStatus === 'short';
export const dropped = (o: YardOrder): YardLine[] => o.lines.filter((l) => l.dropped);

/** How far the pack is: lines answered of the lines to pack. */
export function progress(o: YardOrder): { done: number; of: number; short: number } {
  const ls = packLines(o);
  return { done: ls.filter(isAnswered).length, of: ls.length, short: ls.filter((l) => l.pickStatus === 'short').length };
}

/** The line on screen: the one asked for while it is open, else the cursor's, else the first open one; null when all are answered. */
export function currentLine(o: YardOrder, want?: number | null): YardLine | null {
  const open = packLines(o).filter((l) => !isAnswered(l));
  if (!open.length) return null;
  if (want != null) { const w = open.find((l) => l.idx === want); if (w) return w; }
  return open.find((l) => l.idx >= o.pickCursor) || open[0];
}

export type LineMark = 'done' | 'short' | 'now' | 'open' | 'dropped';

/** Each line's mark on the strip under the head (PK02: A · Iron sheet ✓ · G · Wheelbarrow · ✕ Hinge dropped). */
export function lineMark(o: YardOrder, l: YardLine, now: YardLine | null): LineMark {
  if (notPicked(o, l)) return 'dropped';
  if (l.pickStatus === 'done') return 'done';
  if (l.pickStatus === 'short') return 'short';
  return now && now.idx === l.idx ? 'now' : 'open';
}

/** Answering this line answers the last open one: the order is packed. */
export function isLastOpen(o: YardOrder, idx: number): boolean {
  const open = packLines(o).filter((l) => !isAnswered(l));
  return open.length === 1 && open[0].idx === idx;
}

/** A short is short until Ruth settles it (store.html:1549 lineShortNow): under what the line bills, not settled as the full quantity. */
export function shortNow(o: YardOrder, l: YardLine): boolean {
  return l.pickStatus === 'short' && (l.pickedQty ?? 0) < l.qty && o.pickShortfallAckAt == null;
}

/** A cancelled order's lines already picked, and how many of each go back (store.html:4349 putBacksNow). None: "Stop packing · nothing was picked yet". */
export function putBack(o: YardOrder): { line: YardLine; qty: number }[] {
  if (!isCancelled(o)) return [];
  return o.lines.filter((l) => !l.dropped && isAnswered(l) && (l.pickedQty ?? 0) > 0).map((line) => ({ line, qty: line.pickedQty as number }));
}

/** W5's own rule (store.html:2396 canUnpack; spec §4.2 "Unpack"): packed, still in the yard, no carrier, not called off. */
export function canUnpack(o: YardOrder): boolean {
  return !isCancelled(o) && o.status === 'preparing' && o.pickingStatus === 'done' && !o.carrier;
}

/** The strip's label: the name before its size and kind, two words at most ("Soft close hinge" → "Hinge"). */
export function shortName(name: string): string {
  const head = String(name || '').split(/\s*[·,(]\s*/)[0];
  const words = head.split(/\s+/).filter((w) => w && !/\d/.test(w) && !/["”″]/.test(w));
  if (!words.length) return head.trim();
  if (words.length <= 2) return words.join(' ');
  const last = words[words.length - 1];
  return last[0].toUpperCase() + last.slice(1);
}

/** The line's aisle on the shelf: its name (the item's category) and its letter in the shop's order (A Roofing … L Sanitary). */
export function aisleOf(b: Pick<YardBooks, 'items' | 'aisles'>, l: Pick<YardLine, 'key' | 'productId'>): { name: string; letter: string } | null {
  const it = b.items.find((x) => x.key === l.key) || b.items.find((x) => x.productId === l.productId);
  if (!it || !it.category) return null;
  const i = b.aisles.indexOf(it.category);
  return { name: it.category, letter: i >= 0 && i < 26 ? String.fromCharCode(65 + i) : '·' };
}

export interface Where {
  pickup: boolean;
  /** "Ntinda site" (the drop's first part), or "They collect". */
  to: string;
  when: string | null;
  phone: string;
}

/** Where · when · phone (IM-01, IM-02): the order's own deliverTo, deliverWhen, deliverPhone; the client's phone as a fallback. */
export function whereOf(o: YardOrder, b: Pick<YardBooks, 'customers'>): Where {
  const pickup = isPickup(o, b.customers), dest = destinationOf(o, b.customers);
  return {
    pickup,
    to: pickup ? 'They collect' : String(dest || '').split(',')[0].trim(),
    when: o.deliverWhen ? o.deliverWhen.trim() || null : null,
    phone: (o.deliverPhone || o.client.phone || '').trim(),
  };
}

const UNIT_WORDS: Record<string, [string, string]> = {
  pc: ['piece', 'pieces'], pcs: ['piece', 'pieces'], ctn: ['carton', 'cartons'], bag: ['bag', 'bags'], box: ['box', 'boxes'], tin: ['tin', 'tins'],
  pair: ['pair', 'pairs'], bundle: ['bundle', 'bundles'], roll: ['roll', 'rolls'], dozen: ['dozen', 'dozen'], sheet: ['sheet', 'sheets'], set: ['set', 'sets'],
};

/** A unit said in words for the short count's question: "How many cartons are here?". A weight or length stays as it is. */
export function unitWord(unit: string, n = 2): string {
  const w = UNIT_WORDS[String(unit || '').trim().toLowerCase()];
  return w ? w[n === 1 ? 0 : 1] : String(unit || '').trim();
}

