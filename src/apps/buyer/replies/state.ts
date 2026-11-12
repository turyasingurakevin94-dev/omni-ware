/*
 * What the Replies tab keeps between its two screens: the answer just saved
 * (the success card on the list) and the not-found lines still to open one
 * by one after a "No".
 */
import { signal } from '@preact/signals';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import type { Ms } from '../../../core/types.ts';
import { isBuying } from './rules.ts';

export interface Done {
  supplierId: string;
  supplier: string;
  at: Ms;
  /** Lines the answer touched, their cost and the orders they sit on. */
  lines: number;
  /** Lines it put over their selling price (Ruth decides). */
  priceUp?: number;
  total: number;
  orderIds: number[];
  /** Orders this answer moved to Buying. */
  moved: number[];
  /** The Found tile before the answer (for its "+1"). */
  foundBefore: number;
}

export const done = signal<Done | null>(null);

/** Not-found lines still to decide, opened one at a time while the list is on top. */
export const notFoundQueue = signal<{ orderId: number; key: string }[]>([]);

/** The orders already in Buying (or ready for it), before a write. */
export function buyingNow(b: BuyerBooks | null): Set<number> {
  return new Set((b ? b.orders : []).filter(isBuying).map((o) => o.id));
}
