/*
 * The Buyer's word on each line of an order, for Sales (Sales+Buyer cross-app round 1, SAL-1;
 * board XR1SalesLines). Read through the Buyer's own reader and rule (supabase/rows.ts orderOf,
 * rules.ts lineState), never a copy: "Asked · 9:40" in Sales is what the Buyer's phone says.
 *
 *   buyerWords(row)   one entry per items[] place: { state, at } for a line the Buyer works, null for a
 *                     shelf line (not the Buyer's) — only while the order is in Checking or Buying
 *
 * No cost and no supplier name leave this file: Sales gets the state and the time only.
 */
import type { Row } from '../supabase/client.ts';
import type { Ms } from '../types.ts';
import { lineState } from './rules.ts';
import { quoteOf } from './supabase/order.ts';
import { orderOf } from './supabase/rows.ts';
import type { BLine, BOrder, LineState } from './types.ts';

export interface BuyerWord { state: LineState; at: Ms | null }

/** When the Buyer's word happened: the answer, else the ask; a price up, when it went up. */
function atOf(o: BOrder, l: BLine, st: LineState): Ms | null {
  if (st === 'priceup') return l.repricedAt;
  const c = l.supplierId ? o.confirms[l.supplierId] : null;
  if (!c) return null;
  if (st === 'asked') return c.askedAt;
  return c.answeredAt ?? c.askedAt;
}

export function buyerWords(row: Row): (BuyerWord | null)[] {
  const items: Row[] = Array.isArray(row && row.payload && row.payload.items) ? row.payload.items : [];
  if (row.status !== 'draft' && row.status !== 'awaiting_goods') return items.map(() => null);
  const o = orderOf(quoteOf(row), [], []);
  return items.map((_it, i) => {
    const l = o.lines.find((x) => x.idx === i && !x.removed);
    if (!l) return null;
    const state = lineState(o, l);
    return { state, at: atOf(o, l, state) };
  });
}
