/*
 * What waits on Ruth, the Manager (docs/spec/04-screens-store.md §2 TD11, TD30; WORD-05: every yard
 * ask with who sent it and a face). The Store proposes; Ruth decides counts, losses, returns, extras,
 * cancels and letting an unpaid order go (docs/decision-rights.md). One list, read by With Ruth, the
 * Alerts head ("1 yours first · 3 with her"), Pass the yard ("4 asks · she knows") and Close the yard
 * ("Aisle C count with Ruth").
 *
 *   withRuth(b, me, now)   each ask, its state:
 *     yours      it waits on the yard first (a return Grace asked: you check it at the gate)
 *     with-ruth  sent; Ruth looks (a count, a loss, an extra, a return checked, an unpaid order, a copy)
 *     answered   Ruth decided in the last 7 days ("Accepted", "Wrote off", "Took it back", "Declined")
 * Blind: a count shows only what was counted, never the books (DATA blind count).
 */
import type { Ms } from '../types.ts';
import type { StockCount, StockReport, StoreAsk, StoreReturn, YardBooks, YardOrder } from './types.ts';
import { moneyHeld, ordersAt } from './yard.ts';

export type RuthKind = 'return' | 'count' | 'report' | 'extra' | 'restock' | 'yard-return' | 'unpaid' | 'cancel';
export type RuthState = 'yours' | 'with-ruth' | 'answered';

export interface RuthItem {
  kind: RuthKind;
  state: RuthState;
  /** When it was sent (or asked), or when Ruth answered. */
  at: Ms;
  order?: YardOrder;
  count?: StockCount;
  report?: StockReport;
  ret?: StoreReturn;
  ask?: StoreAsk;
  /** Ruth's word once answered. */
  answer?: string;
}

const WEEK = 7 * 864e5;
const ORDER: RuthKind[] = ['return', 'count', 'report', 'extra', 'restock', 'yard-return', 'unpaid', 'cancel'];
const yardLogin = (b: YardBooks, userId: string | null): boolean => !!userId && b.people.some((p) => p.userId === userId && p.role === 'store');

const COUNT_WORD: Record<string, string> = { accepted: 'Accepted', recount: 'Count again' };
const REPORT_WORD: Record<string, string> = { written_off: 'Wrote off', dismissed: 'Kept it' };
const RETURN_WORD: Record<string, string> = { accepted: 'Took it back', declined: 'Declined' };
const ASK_WORD: Record<string, string> = { accepted: 'Accepted', declined: 'Declined' };

export function withRuth(b: YardBooks, me: string | null, now: Ms): RuthItem[] {
  const out: RuthItem[] = [];
  const recent = (at: Ms | null) => at != null && now - at <= WEEK;
  // Yours first: a return the salesperson asked, which the yard checks at the gate before Ruth decides.
  b.returns.filter((r) => r.status === 'sent' && !yardLogin(b, r.by) && !b.returns.some((y) => y.orderId === r.orderId && yardLogin(b, y.by) && y.createdAt >= r.createdAt))
    .forEach((r) => out.push({ kind: 'return', state: 'yours', at: r.createdAt, ret: r, order: b.orders.find((o) => o.id === r.orderId) }));
  b.returns.filter((r) => yardLogin(b, r.by)).forEach((r) => {
    if (r.status === 'sent') out.push({ kind: 'yard-return', state: 'with-ruth', at: r.createdAt, ret: r, order: b.orders.find((o) => o.id === r.orderId) });
    else if (RETURN_WORD[r.status] && recent(r.decidedAt)) out.push({ kind: 'yard-return', state: 'answered', at: r.decidedAt as Ms, ret: r, answer: RETURN_WORD[r.status] });
  });
  b.counts.filter((c) => yardLogin(b, c.countedBy)).forEach((c) => {
    if (c.status === 'sent') out.push({ kind: 'count', state: 'with-ruth', at: c.createdAt, count: c });
    else if (COUNT_WORD[c.status] && recent(c.decidedAt)) out.push({ kind: 'count', state: 'answered', at: c.decidedAt as Ms, count: c, answer: COUNT_WORD[c.status] });
  });
  b.reports.forEach((r) => {
    if (r.status === 'sent') out.push({ kind: 'report', state: 'with-ruth', at: r.createdAt, report: r });
    else if (REPORT_WORD[r.status] && recent(r.decidedAt)) out.push({ kind: 'report', state: 'answered', at: r.decidedAt as Ms, report: r, answer: REPORT_WORD[r.status] });
  });
  b.asks.filter((a) => a.kind === 'extra' || a.kind === 'restock').forEach((a) => {
    const kind = a.kind as RuthKind;
    if (a.status === 'sent') out.push({ kind, state: 'with-ruth', at: a.createdAt, ask: a });
    else if (ASK_WORD[a.status] && recent(a.decidedAt)) out.push({ kind, state: 'answered', at: a.decidedAt as Ms, ask: a, answer: ASK_WORD[a.status] });
  });
  // Not paid yet on a bay: Grace takes the money, or Ruth lets it go (the yard taps nothing, IM-07).
  ordersAt(b, 'packed', me, now).filter(moneyHeld).forEach((o) => out.push({ kind: 'unpaid', state: 'with-ruth', at: o.pickingDoneAt ?? o.stageEnteredAt ?? now, order: o }));
  // A copy Ruth is cancelling (#0557): the push's time is when it was found.
  ordersAt(b, 'look', me, now).filter((o) => o.copyOf != null).forEach((o) => {
    const push = b.alerts.find((a) => a.kind === 'order.copy' && Number(a.data.orderId) === o.id);
    out.push({ kind: 'cancel', state: 'with-ruth', at: push ? push.at : o.savedAt ?? now, order: o });
  });
  const st: RuthState[] = ['yours', 'with-ruth', 'answered'];
  return out.sort((x, y) => st.indexOf(x.state) - st.indexOf(y.state) || ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind) || (x.state === 'answered' ? y.at - x.at : x.at - y.at));
}
