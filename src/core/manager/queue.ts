/*
 * The queue: everything waiting on the Manager, in one order (spec 04-screens-manager §3.1).
 * It feeds the red +'s badge, Today's Needs you, the Decide sheet's "n of N", Orders'
 * "Ruth decides" filter and the queue bar's colours. One rule, here only.
 *
 *   someone standing there first (a counter sale, a truck waiting), then who has waited longest.
 */
import type { Ask, AskKind, ManagerBooks, Person, TeamRole } from './types.ts';

/** The decision ids of handover.md, by kind (a price ask by its mode). */
export function dOf(a: Ask): number {
  switch (a.kind) {
    case 'price': return a.mode === 'coming' ? 2 : a.mode === 'up' ? 3 : 1;
    case 'counter': return 4;
    case 'credit': return a.why === 'nolimit' ? 6 : 5;
    case 'storecredit': return 7;
    case 'bill': return 9;
    case 'given': return 10;
    case 'short': return 12;
    case 'checkin': return 13;
    case 'extra': return 15;
    case 'loss': return 16;
    case 'count': return 17;
    case 'return': return 18;
    case 'void': return 19;
    case 'cancel': return 20;
    case 'twins': return 21;
    case 'agent': return 22;
    case 'carton': return 24;
    case 'limit': return 32;
    case 'markup': return 33;
  }
}

/** Kinds that never sit in the queue: the app spots them and shows them where they live (Orders → To bill). */
const NOT_QUEUED: AskKind[] = ['twins'];

/** The queue, in order. */
export function queue(b: Pick<ManagerBooks, 'asks'>): Ask[] {
  return b.asks
    .filter((a) => !NOT_QUEUED.includes(a.kind))
    .slice()
    .sort((x, y) => (x.standing === y.standing ? x.at - y.at || (x.key < y.key ? -1 : 1) : x.standing ? -1 : 1));
}

/** Where in the queue a decision is: "5 of 8". Null when it has left (answered). */
export function placeOf(q: Ask[], key: string): { n: number; of: number } | null {
  const i = q.findIndex((a) => a.key === key);
  return i < 0 ? null : { n: i + 1, of: q.length };
}

/** The next decision after this one (the NEXT row; the sheet moves to it after an answer). */
export function nextAfter(q: Ask[], key: string): Ask | null {
  const i = q.findIndex((a) => a.key === key);
  if (i < 0) return q[0] || null;
  return q[i + 1] || null;
}

/** Who asked: the person, or the order's salesperson when the app spotted it (D-9, D-10, D-21). */
export function askerOf(b: Pick<ManagerBooks, 'team' | 'orders'>, a: Ask): Person | null {
  const id = a.askerId || (a.orderId != null ? (b.orders.find((o) => o.id === a.orderId) || { sellerId: null }).sellerId : null);
  return id ? b.team.find((p) => p.id === id) || null : null;
}

/** The colours of the queue bar: who asks, how many, the oldest wait (Today's hero). */
export type AskerGroup = 'sales' | 'store' | 'buyer' | 'accounts' | 'agents';
export function groupOf(role: TeamRole | null): AskerGroup {
  if (role === 'store' || role === 'driver') return 'store';
  if (role === 'buyer' || role === 'sourcing') return 'buyer';
  if (role === 'accounts') return 'accounts';
  if (role === 'agent') return 'agents';
  return 'sales';
}

export function byAsker(b: Pick<ManagerBooks, 'team' | 'orders' | 'asks'>, q: Ask[] = queue(b)): { group: AskerGroup; count: number; oldest: number }[] {
  const out = new Map<AskerGroup, { group: AskerGroup; count: number; oldest: number }>();
  for (const a of q) {
    const p = askerOf(b, a);
    const g = groupOf(p ? p.role : null);
    const x = out.get(g) || { group: g, count: 0, oldest: a.at };
    x.count++;
    x.oldest = Math.min(x.oldest, a.at);
    out.set(g, x);
  }
  return [...out.values()].sort((x, y) => y.count - x.count || x.oldest - y.oldest);
}

/** The queue filtered to one asker group (decide { asker }). */
export function ofGroup(b: Pick<ManagerBooks, 'team' | 'orders' | 'asks'>, g: AskerGroup | null): Ask[] {
  const q = queue(b);
  if (!g) return q;
  return q.filter((a) => { const p = askerOf(b, a); return groupOf(p ? p.role : null) === g; });
}

/** Decisions that are slides (money or books that can't be undone; spec §3.3). Their row pill is Open. */
export function isSlide(a: Ask, b?: Pick<ManagerBooks, 'orders'>): boolean {
  if (a.kind === 'cancel') {
    const o = b && a.orderId != null ? b.orders.find((x) => x.id === a.orderId) : null;
    return !!o && o.paid > 0;
  }
  return a.kind === 'loss' || a.kind === 'count' || a.kind === 'return' || a.kind === 'void' || a.kind === 'twins';
}
