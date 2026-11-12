/*
 * Report a loss (docs/spec/04-screens-store.md §4.5; store.html:5491 REASONS, 5559–5561 rpFits, rpMax; DATA-03, Pre 3).
 *
 *   REASONS              Damaged · Lost · Stolen: one item, one reason
 *   canReport(shelf)     no loss off an empty shelf: "Count it now" (DATA-03)
 *   reportMax(shelf)     a report is capped at the shelf
 *   asPieces(n, per)     a loss is kept in the books' unit; switching pc | bundle never multiplies it (Pre 3)
 *   lossOf(...)          the W17 write, in the books' unit
 *
 * Ruth decides (stock.writeoff): write it off, or keep it on the shelf. Nothing moves until she does.
 */
import type { Loss } from './source.ts';
import type { ShelfItem } from './types.ts';

export type Why = 'damaged' | 'lost' | 'stolen';
export const REASONS: { why: Why; word: string; sub: string }[] = [
  { why: 'damaged', word: 'Damaged', sub: 'bent, broken' },
  { why: 'lost', word: 'Lost', sub: 'can’t find it' },
  { why: 'stolen', word: 'Stolen', sub: 'taken' },
];

/** No loss off an empty shelf (DATA-03). */
export const canReport = (shelf: number): boolean => shelf > 0;

/** Never more than the shelf holds. */
export const reportMax = (shelf: number): number => Math.max(0, Math.floor(shelf));

/** How many, in the books' unit, from what was typed in the unit shown (a bundle of 20 is 20 pc). */
export function asPieces(n: number, per: number): number {
  return Math.max(0, Math.round(n * (per || 1)));
}

/** The stepper's number when the unit shown changes: the same pieces, never more (Pre 3). A part bundle shows as pieces. */
export function shownIn(pieces: number, per: number): number {
  return per > 1 ? Math.floor(pieces / per) : pieces;
}

/** The W17 write. `pieces` is already capped and in the books' unit. */
export function lossOf(it: ShelfItem, pieces: number, why: Why, photo: Blob | null, note: string): Loss {
  return { key: it.key, productId: it.productId, variantIdx: it.variantIdx, name: it.name, qty: pieces, why, photo, note: note.trim() };
}
