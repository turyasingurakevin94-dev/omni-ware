/*
 * What a line of an order says to the Manager, read off the order's own payload, as
 * manager.html reads it: whether its price waits on her (lineWaitsPrice 4518), a line at 0
 * with no why (lineFreeOpen 4517), a short pick (pickShortfallLinesOf 5034), an agent's
 * ask (agentAsks 5578). The price of a line is the shared rule (src/core/supabase/rows.ts
 * lineOf, src/core/price.ts); nothing here prices a line a second way.
 *
 * Used by asks.ts (to build the asks) and write.ts (to refuse an answer to an ask that
 * is no longer open: §4a "the re-read").
 *
 * Open question for Kevin (CLAUDE.md "one rule, one place"): the Buyer's app has its own,
 * simpler test of "the price waits on Ruth" (src/core/buyer/supabase/order.ts priceWaits:
 * the line's priceNote and no priceReview state). manager.html's (here) also waits a line
 * under its cost, an untagged line with no price, and a review gone stale (price or qty
 * changed since). The two disagree; neither is picked silently.
 */
import { orderTotal, whole } from '../../money.ts';
import type { Row } from '../../supabase/client.ts';
import { lineOf, type PriceBook } from '../../supabase/rows.ts';
import type { Order } from '../../types.ts';
import type { Ms } from '../types.ts';
import type { Ctx } from './rows.ts';

export const ms = (v: unknown): Ms | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Date.parse(String(v));
  return Number.isNaN(n) ? Number(v) || null : n;
};


/** The order as manager.html holds it: the payload spread over the row's columns (rowToQuote 1153). */
export type Q = Row;
export function quoteOf(r: Row): Q {
  return {
    id: Number(r.id), status: r.status || 'draft', invoiced: !!r.invoiced, voided: !!r.voided, amountPaid: Number(r.amount_paid) || 0,
    client: { name: r.client_name || '', phone: r.client_phone || '' }, items: [], customerId: null, charges: [], credit: null,
    ...(r.payload || {}), qa: !!r.qa,
  };
}

/** Called off: voided, cancelled, or stamped so (manager.html liveOrders 1623). */
export const isLive = (q: Q): boolean => !q.voided && !q.cancelledAt && q.status !== 'cancelled';

const num = (v: unknown): number => Number(v) || 0;
const typed = (it: Row): number | null => (it.sellPrice != null && it.sellPrice !== '' && Number(it.sellPrice) > 0 ? whole(it.sellPrice) : null);

/** The line's cost each, or null (lineCost 4498). */
export const lineCost = (it: Row): number | null => (num(it.price) > 0 ? num(it.price) : null);

/** The shop's price for the line (cost × its markup), or null with no cost or no rule. */
export function shopPriceOf(it: Row, pb: PriceBook): number | null {
  return lineOf({ ...it, sellPrice: null, givenAway: null }, pb).shopPrice;
}

/** What the line sells at now: its typed price, else the shop's (linePriceNow 4500). */
export function priceNow(it: Row, pb: PriceBook): number {
  const t = typed(it);
  return t != null ? t : shopPriceOf(it, pb) || 0;
}

/** A line typed at 0 with no "given away" why (lineFreeOpen 4517). */
export const atZero = (it: Row): boolean => !!it && num(it.qty) > 0 && it.sellPrice != null && it.sellPrice !== '' && Number(it.sellPrice) === 0;
const givenWhy = (it: Row): string => String((it && it.givenAway && it.givenAway.why) || '').trim();
export const freeOpen = (it: Row): boolean => atZero(it) && !givenWhy(it);

/** Below cost however it got there (lineBelowCost 4508). */
export function belowCost(it: Row, pb: PriceBook): boolean {
  const c = lineCost(it), p = priceNow(it, pb);
  return !!c && p > 0 && num(it.qty) > 0 && p < c;
}

/** The Manager's answer still holds: same price, same quantity (reviewFresh 4501). */
function reviewFresh(it: Row, pb: PriceBook): boolean {
  const r = it && it.priceReview;
  return !!r && Number(r.price) === priceNow(it, pb) && Number(r.qty) === Number(it.qty);
}

/** lineWaitsPrice (4518): the line's price waits on the Manager. */
export function waitsPrice(it: Row, pb: PriceBook): boolean {
  if (!it || reviewFresh(it, pb)) return false;
  if (atZero(it) && givenWhy(it)) return false;
  if (belowCost(it, pb)) return true;
  if (it.priceBy) return ['under', 'nomargin', 'nocost'].includes(it.priceNote);
  return num(it.qty) > 0 && typed(it) == null && (lineCost(it) == null || shopPriceOf(it, pb) == null);
}

/** lineKind (4525): no cost · no margin · under the shop's price. */
export function kindOf(it: Row, pb: PriceBook): 'nocost' | 'nomargin' | 'under' {
  if (!lineCost(it)) return 'nocost';
  if (belowCost(it, pb) || it.priceNote === 'nomargin' || shopPriceOf(it, pb) == null) return 'nomargin';
  return 'under';
}

/** The cost went up under it (lineCostUp 4558): the cost it had. */
export const costWas = (it: Row): number | null => (it && it.priceWas != null && num(it.priceWas) > 0 && num(it.price) > num(it.priceWas) ? num(it.priceWas) : null);

/** The short lines (pickShortfallLinesOf 5034): what was ordered and what was packed. */
export function shortLines(q: Q): { idx: number; ordered: number; picked: number }[] {
  return (Array.isArray(q.items) ? q.items : []).map((it: Row, idx: number) => {
    const ordered = Math.max(0, num(it.qty));
    let picked: number | null = null;
    if (it.pickStatus === 'done') picked = ordered;
    else if (it.pickStatus === 'short') { const n = Number(it.pickedQty); picked = Number.isFinite(n) && n >= 0 ? Math.min(ordered, n) : 0; }
    return { idx, ordered, picked };
  }).filter((r: { picked: number | null; ordered: number }) => r.picked != null && r.picked < r.ordered) as { idx: number; ordered: number; picked: number }[];
}

/** A short pick waits: packed, short, not settled (hasShortfall 5040; the Store's pickingStatus done). */
export const shortWaits = (q: Q): boolean => isLive(q) && !q.invoiced && q.pickingStatus === 'done' && !q.pickShortfallAckAt && !q.pickSettle && shortLines(q).length > 0;

/** The Store's "on credit?" still open (creditAskOf 4103). */
export const creditAskOpen = (q: Q): Row | null => { const a = q && q.creditAsk; return a && typeof a === 'object' && a.at && !a.answer ? a : null; };

/** An agent's line key (agentKey 5584). */
export const agentKey = (x: Row | null | undefined): string => String(x && x.productId) + '::' + (x == null || x.variantIdx == null ? '' : String(x.variantIdx));

/** An agent's ask still open (agentAsks 5578): the lines not yet answered, and whether it is a cancel. */
export function agentOpen(q: Q): { cancel: boolean; lines: Row[] } | null {
  if (!isLive(q) || q.invoiced) return null;
  const c = q.agentChange, x = q.agentCancel;
  const lines = c && c.state === 'asked' ? (Array.isArray(c.lines) ? c.lines : []).filter((l: Row) => l && !l.decision) : [];
  if (!(x && !x.closed) && !lines.length) return null;
  return { cancel: !!x && !x.closed && !x.agreed, lines };
}

/** The live filter's twin on the phone: an order whose decisions can still change. */
export const inPlay = (q: Q): boolean => isLive(q) && (q.status !== 'completed' || !q.invoiced);

/**
 * Why the 24-hour run could not bill it (MOrder.heldCode). The row does not say: the run only pushes
 * invoice.held with the code (0169:833, to a task, which push_outbox's RLS does not let the Manager read).
 * Default: worked out on the phone from what the run checks, in its order: under 1,000 (OWSML), a short
 * pick (OWSHP), a price waiting (OWPRC), a line with no price (OWTPC), a 0 with no why (OWGIV).
 */
export function heldCodeOf(x: Ctx, q: Q, o: Order): string | null {
  if (!isLive(q) || q.invoiced || q.status !== 'completed') return null;
  const at = ms(q.deliveredAt) || ms(q.stageEnteredAt);
  if (!at || x.now - at < 24 * 3600e3) return null;
  const items: Row[] = Array.isArray(q.items) ? q.items : [];
  if (orderTotal(o) < 1000) return 'OWSML';
  if (!q.pickShortfallAckAt && shortLines(q).length) return 'OWSHP';
  if (items.some((it) => waitsPrice(it, x.pb))) return 'OWPRC';
  if (o.lines.some((l) => l.qty > 0 && l.state !== 'dropped' && l.price == null)) return 'OWTPC';
  if (items.some(freeOpen)) return 'OWGIV';
  return null;
}
