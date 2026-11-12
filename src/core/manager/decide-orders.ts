/*
 * After the order (spec 04-screens-manager §4 D-9, D-10, D-18, D-19, D-20, D-22): the figures the
 * Decide sheet draws for a cancel, a return, a void, a line given away, an agent's fewer and a small
 * bill. One rule each; pure functions over the Manager's books, so tests import them as they are.
 * The demo's writes (demo/writes.ts) move the books the same way.
 */
import type { Cust, ManagerBooks, MOrder, Person, Stage, UGX } from './types.ts';
import { AFTER_WORDS } from './words.ts';


/** The light card's stage dots (src/ui/Track StageDots) use the shared stage names. */
export const UI_STAGE: Record<Stage, 'checking' | 'buying' | 'packing' | 'road' | 'delivered'> = {
  draft: 'checking', awaiting_goods: 'buying', preparing: 'packing', pending_delivery: 'road', completed: 'delivered', cancelled: 'checking',
};

const lineTotal = (price: UGX | null, qty: number): UGX => Math.round((price || 0) * qty);

/* ---------------- D-20 cancel ---------------- */

/** How much of the order is packed (pieces): a short-packed line its packed count; from On the road on, all of it. */
export function packedOf(o: Pick<MOrder, 'lines' | 'stage'>): number {
  const past = o.stage === 'pending_delivery' || o.stage === 'completed';
  return o.lines.reduce((s, l) => s + (l.packed != null ? l.packed : past ? l.qty : 0), 0);
}

/** One person a cancel stops, and what it stops for them ("Denis off To ask", "Musa nothing to unpack"). */
export interface Stops { id: string; what: string }

/**
 * Who stops (handover P-5, M-9): the Buyer while it is in Checking or Buying with a line from a supplier
 * ("off To ask" / "off the trip"); the Store always ("nothing to unpack" before packing, else "unpack it").
 * The holder is used when they hold that role, else the first of the team in it.
 */
export function whoStops(o: Pick<MOrder, 'lines' | 'stage' | 'holderId'>, team: Person[]): Stops[] {
  const of = (role: Person['role']): Person | null => team.find((p) => p.id === o.holderId && p.role === role) || team.find((p) => p.role === role) || null;
  const out: Stops[] = [];
  const bought = o.lines.some((l) => l.supplierId && l.supplierId !== '__stock__');
  const buyer = of('buyer');
  if (buyer && bought && (o.stage === 'draft' || o.stage === 'awaiting_goods')) out.push({ id: buyer.id, what: o.stage === 'draft' ? AFTER_WORDS.offToAsk : AFTER_WORDS.offTheTrip });
  const store = of('store');
  if (store) out.push({ id: store.id, what: packedOf(o) > 0 ? AFTER_WORDS.unpackIt : AFTER_WORDS.nothingToUnpack });
  return out;
}

/* ---------------- money already paid (D-19, D-20) ---------------- */

/** What the bill of this order still has owing on the customer's books. */
export function billLeft(c: Pick<Cust, 'bills'> | null, orderId: number): UGX {
  const b = c ? c.bills.find((x) => x.orderId === orderId) : null;
  return b ? b.left : 0;
}

/**
 * The customer's owing after the order goes: its bill is dropped; as a deposit, what was paid on it
 * stays with the shop and comes off what they owe; as a refund it goes back to them.
 */
export function owesAfterVoid(c: Pick<Cust, 'owes' | 'bills'> | null, o: Pick<MOrder, 'id' | 'paid'>, how: 'refund' | 'deposit'): UGX {
  if (!c) return 0;
  return c.owes - billLeft(c, o.id) - (how === 'deposit' ? o.paid : 0);
}

/* ---------------- D-18 return ---------------- */

/** The credit for the lines coming back: qty × the price they were sold at. */
export function returnAmount(o: Pick<MOrder, 'lines'>, lines: { idx: number; qty: number }[]): UGX {
  return lines.reduce((s, l) => s + lineTotal(o.lines[l.idx] ? o.lines[l.idx].price : 0, l.qty), 0);
}

/** Off what they owe, or cash back (only up to what was paid on the order; the rest comes off what they owe). */
export function returnMoney(owes: UGX, amount: UGX, paid: UGX, cashBack: boolean): { cash: UGX; off: UGX; owesAfter: UGX } {
  const cash = cashBack ? Math.min(amount, Math.max(0, paid)) : 0;
  const off = amount - cash;
  return { cash, off, owesAfter: owes - off };
}

/* ---------------- D-22 an agent's fewer ---------------- */

/** What the order comes to with the agreed lines at their new qty; what the agent gets back of what was paid. */
export function agentChange(o: Pick<MOrder, 'lines' | 'total' | 'paid'>, lines: { idx: number; from: number; to: number }[], agreed: number[], cancel: boolean): { less: UGX; total: UGX; back: UGX; stays: UGX } {
  const less = cancel ? o.total : lines.filter((l) => agreed.includes(l.idx)).reduce((s, l) => s + lineTotal(o.lines[l.idx] ? o.lines[l.idx].price : 0, l.from - l.to), 0);
  const total = o.total - less;
  const back = Math.max(0, o.paid - total);
  return { less, total, back, stays: o.paid - back };
}

/** One line's figure before and after: Cement on #0560 850,000 → 510,000. */
export function lineBefore(o: Pick<MOrder, 'lines'>, l: { idx: number; from: number; to: number }, agreed: boolean): { was: UGX; now: UGX } {
  const p = o.lines[l.idx] ? o.lines[l.idx].price : 0;
  return { was: lineTotal(p, l.from), now: lineTotal(p, agreed ? l.to : l.from) };
}

/* ---------------- D-10 a line at 0 ---------------- */

/** The lines given away, at cost: 2 × 1,500 = 3,000. */
export function givenAtCost(o: Pick<MOrder, 'lines'>, idxs: number[]): UGX {
  return idxs.reduce((s, i) => s + lineTotal(o.lines[i] ? o.lines[i].cost : 0, o.lines[i] ? o.lines[i].qty : 0), 0);
}

/* ---------------- people ---------------- */

/** The first of the team in a role (the Accounts person told of a credit note), or null. */
export function firstIn(b: Pick<ManagerBooks, 'team'>, role: Person['role']): Person | null {
  return b.team.find((p) => p.role === role) || null;
}
