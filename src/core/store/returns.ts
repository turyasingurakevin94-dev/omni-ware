/*
 * A return at the gate (docs/spec/04-screens-store.md §4.3; IN20–IN25): the salesperson asked it,
 * the yard checks what came back, line by line, and sends it to the Manager, who decides.
 *
 *   returnAt(b, order, me)   the order's lines, what was asked back (Grace's 2 of 3 bag), how many can
 *                            still come back, and this phone's own return once sent
 *   startDraft               the draft starts at what was asked: the bags and Damaged prefilled
 *   askOf                    the draft as W18 (returnAsk), in the order line's unit (DATA-02)
 *
 * Never bigger than the line has left: what was taken back before (credit notes) and other returns
 * accepted or waiting (store.html:1128 returnedQty). Damaged never goes back on the shelf (Pre 3).
 * The yard names no credit note and no money: "Ruth checks it" (screens Q6).
 */
import type { ReturnAsk } from './source.ts';
import type { StoreReturn, YardBooks, YardLine, YardOrder } from './types.ts';

export type Condition = 'good' | 'damaged';

export interface ReturnLine {
  line: YardLine;
  /** What the salesperson asked back on this line (0: not asked). */
  asked: number;
  askedCondition: Condition;
  /** The most that can still come back. */
  left: number;
}

export interface ReturnAt {
  order: YardOrder;
  /** The salesperson's ask, if any (Grace, Fri 15:40). */
  asked: StoreReturn | null;
  /** This phone's return for the order, once sent (and not taken back). */
  mine: StoreReturn | null;
  lines: ReturnLine[];
}

/** How much of a line came back before: credit notes not voided, and returns accepted (not the one being checked). */
function returnedBefore(o: YardOrder, rs: StoreReturn[], idx: number, except: string | null): number {
  const notes = o.takenBack.filter((t) => !t.voided).reduce((s, t) => s + t.lines.filter((l) => l.idx === idx).reduce((a, l) => a + l.qty, 0), 0);
  const asks = rs.filter((r) => r.id !== except && r.status === 'accepted' && !o.takenBack.some((t) => t.askId === r.id))
    .reduce((s, r) => s + r.lines.filter((l) => l.idx === idx).reduce((a, l) => a + l.qty, 0), 0);
  return notes + asks;
}

export function returnAt(b: Pick<YardBooks, 'orders' | 'returns' | 'me'>, orderId: number): ReturnAt | null {
  const o = b.orders.find((x) => x.id === orderId);
  if (!o) return null;
  const rs = b.returns.filter((r) => r.orderId === orderId);
  const mine = rs.filter((r) => r.by === b.me.userId && r.status !== 'withdrawn').sort((x, y) => y.createdAt - x.createdAt)[0] || null;
  const asked = rs.filter((r) => r.by !== b.me.userId && r.status === 'sent').sort((x, y) => y.createdAt - x.createdAt)[0] || null;
  const lines = o.lines.filter((l) => !l.dropped).map((l) => {
    const a = asked ? asked.lines.find((x) => x.idx === l.idx) : null;
    const done = returnedBefore(o, rs, l.idx, mine ? mine.id : null);
    return { line: l, asked: a ? a.qty : 0, askedCondition: (a ? a.condition : 'good') as Condition, left: Math.max(0, (l.pickedQty ?? l.qty) - done) };
  });
  return { order: o, asked, mine, lines };
}

/** The draft: per line idx, how many came back and in what state. */
export interface ReturnDraft { qty: Record<number, number>; condition: Record<number, Condition> }

/** It starts at what was asked (the bags and Damaged prefilled from Grace, IN20), capped at what is left. */
export function startDraft(r: ReturnAt): ReturnDraft {
  const d: ReturnDraft = { qty: {}, condition: {} };
  r.lines.forEach((l) => { d.qty[l.line.idx] = Math.min(l.asked, l.left); d.condition[l.line.idx] = l.askedCondition; });
  return d;
}

/** A count for a line, kept between 0 and what is left. */
export const clampBack = (l: ReturnLine, n: number): number => Math.max(0, Math.min(l.left, Math.round(n)));

/** The lines coming back. */
export const backLines = (r: ReturnAt, d: ReturnDraft): ReturnLine[] => r.lines.filter((l) => (d.qty[l.line.idx] || 0) > 0);

/** W18, in the order line's unit; a damaged line marks the reason. */
export function askOf(r: ReturnAt, d: ReturnDraft, photo: Blob | null): ReturnAsk {
  const lines = backLines(r, d).map((l) => {
    const qty = d.qty[l.line.idx] || 0, condition = d.condition[l.line.idx] || 'good';
    return { idx: l.line.idx, name: l.line.name, unit: l.line.unit, qty, shown: `${qty} ${l.line.unit}`, condition };
  });
  const damaged = lines.some((l) => l.condition === 'damaged');
  return { orderId: r.order.id, lines, reason: damaged ? 'Damaged' : 'Good', note: r.asked ? r.asked.note : '', photo };
}

/** Ready to send: at least one line back, and a photo (Ruth sees it). */
export const canSend = (r: ReturnAt, d: ReturnDraft, photo: boolean): boolean => backLines(r, d).length > 0 && photo;
