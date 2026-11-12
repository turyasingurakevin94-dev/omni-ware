/*
 * The Team tab's rules (Team p1–p4; spec 04-screens-manager §6 "Pace", D-29, D-31). The pace
 * itself is watch.ts `pace` / `onPace`; these are what the Team pages draw from it and from
 * who holds what. One rule each; the screens never work one out again.
 */
import { oldestDays } from './credit.ts';
import type { Ask, Cust, Day, ManagerBooks, MOrder, Ms, Person, Stage, TeamRole, UGX } from './types.ts';
import { limitsOf, onTheMove, pace, stuck } from './watch.ts';
import { inStage, STAGE } from './words.ts';

/** The team the Team tab counts: everyone but the Manager herself. */
export function others(b: Pick<ManagerBooks, 'team' | 'me'>): Person[] {
  return b.team.filter((p) => p.id !== b.me.id && p.role !== 'manager' && p.role !== 'owner');
}

/** Everyone else (not Sales), in the board's order: Store, Buyer, Sourcing, Accounts, drivers, agents. */
const ORDER: TeamRole[] = ['store', 'buyer', 'sourcing', 'accounts', 'driver', 'agent'];
export function everyoneElse(b: Pick<ManagerBooks, 'team' | 'me'>): Person[] {
  return others(b).filter((p) => p.role !== 'sales').map((p, i) => ({ p, i }))
    .sort((x, y) => ORDER.indexOf(x.p.role) - ORDER.indexOf(y.p.role) || x.i - y.i).map((x) => x.p);
}

/** The live orders a person holds (packing them, buying them, driving them), oldest in its stage first. */
export function held(b: Pick<ManagerBooks, 'orders'>, staffId: string): MOrder[] {
  return onTheMove(b).filter((o) => o.holderId === staffId).sort((x, y) => x.stageAt - y.stageAt);
}

/** A salesperson's live orders (the ones they took), oldest first. */
export function taken(b: Pick<ManagerBooks, 'orders'>, staffId: string): MOrder[] {
  return onTheMove(b).filter((o) => o.sellerId === staffId).sort((x, y) => x.stageAt - y.stageAt);
}

/** What a person holds now (Team p2 "Holds now"): a salesperson's orders, else what they hold. */
export function holdsNow(b: Pick<ManagerBooks, 'orders'>, p: Pick<Person, 'id' | 'role'>): MOrder[] {
  return p.role === 'sales' || p.role === 'agent' ? taken(b, p.id) : held(b, p.id);
}

/** The open decision on an order, if one waits on the Manager. */
export function askOn(b: Pick<ManagerBooks, 'asks'>, orderId: number): Ask | null {
  return b.asks.find((a) => a.orderId === orderId) || null;
}

/** Their orders over the stage limit (the tile's need badge, "one over its limit"). */
export function overLimit(b: Pick<ManagerBooks, 'orders' | 'shop'>, staffId: string, now: Ms): number {
  return stuck(b, now).filter((x) => x.o.holderId === staffId).length;
}

/**
 * The move on the row (Team p1 "Joy is free · #0551 · Musa has 2"): someone in, holding nothing,
 * and a workmate of the same role holding two or more: the newest of those goes to the free one.
 */
export function freeMove(b: Pick<ManagerBooks, 'team' | 'me' | 'orders'>): { to: Person; from: Person; order: MOrder; fromHas: number } | null {
  const team = others(b).filter((p) => !p.off && p.userId && (p.role === 'store' || p.role === 'buyer' || p.role === 'driver'));
  for (const to of team) {
    if (held(b, to.id).length) continue;
    const from = team.filter((p) => p.role === to.role && p.id !== to.id).map((p) => ({ p, h: held(b, p.id) }))
      .filter((x) => x.h.length >= 2).sort((x, y) => y.h.length - x.h.length)[0];
    if (from) return { to, from: from.p, order: from.h.slice().sort((x, y) => y.stageAt - x.stageAt)[0], fromHas: from.h.length };
  }
  return null;
}

/** Who the "Give it to" goes to: someone in with the same role, holding least; null when only they do it. */
export function peerOf(b: Pick<ManagerBooks, 'team' | 'me' | 'orders'>, p: Person): Person | null {
  const peers = others(b).filter((x) => x.id !== p.id && x.role === p.role && !x.off && x.userId);
  return peers.map((x) => ({ x, n: held(b, x.id).length })).sort((u, v) => u.n - v.n)[0]?.x || null;
}

/** Why "Give it to" is off: "only Denis buys". */
const DOES: Partial<Record<TeamRole, string>> = { buyer: 'buys', store: 'packs', sales: 'sells', driver: 'drives', accounts: 'keeps the books', sourcing: 'sources', agent: 'sells' };
export function onlyWord(p: Pick<Person, 'name' | 'role'>): string {
  return `only ${p.name.split(' ')[0]} ${DOES[p.role] || 'does it'}`;
}

/** The line under an order on the nudge sheet: stuck says it; a line not found names it; else its stage clock. */
export function orderLine(b: Pick<ManagerBooks, 'shop'>, o: MOrder, now: Ms): { text: string; late: boolean } {
  const mins = Math.max(0, (now - o.stageAt) / 60000), limit = Number(limitsOf(b.shop)[o.stage]) || 0;
  if (limit > 0 && mins > limit) return { text: `${STAGE[o.stage]} ${inStage(mins)} · ${inStage(mins - limit)} over`, late: true };
  const nf = o.lines.find((l) => l.buying === 'notfound');
  if (nf) return { text: `${nf.name.split(' ')[0]} not found · ${nf.supplierName.split(' ')[0]}`, late: false };
  return { text: `${STAGE[o.stage]} ${inStage(mins)}`, late: false };
}

/** What a nudge can be about: their orders that do not wait on the Manager, stuck first. */
export function aboutOf(b: Pick<ManagerBooks, 'orders' | 'asks' | 'shop'>, p: Pick<Person, 'id' | 'role'>, now: Ms): MOrder[] {
  const list = holdsNow(b, p).filter((o) => !askOn(b, o.id));
  return list.map((o) => ({ o, late: orderLine(b, o, now).late })).sort((x, y) => Number(y.late) - Number(x.late)).map((x) => x.o);
}

/** Her pace a day (Team p2): so far, what she needs, and where the "so far" pace ends the month. */
export function dayRate(sold: UGX, goal: UGX | null, now: Ms): { soFar: UGX; needs: UGX; ends: UGX } {
  const p = pace(now), left = Math.max(1, p.of - p.day), soFar = Math.round(sold / Math.max(1, p.day));
  return { soFar, needs: goal ? Math.max(0, Math.round((goal - sold) / left)) : 0, ends: sold + soFar * left };
}

/** Her customers who owe (Team p2): the ones she sells to (she sold to them last). */
export function custOf(b: Pick<ManagerBooks, 'customers'>, staffId: string, today: Day): { c: Cust; days: number }[] {
  return b.customers.filter((c) => !c.qa && c.owes > 0 && c.sellers[0] === staffId)
    .map((c) => ({ c, days: oldestDays(c, today) })).sort((x, y) => y.days - x.days);
}

/** Customers past the credit hold line (Team p3: "Lubowa 25 d · Kyaligonza 38 d"), and all who owe by days. */
export function holdLine(b: Pick<ManagerBooks, 'customers'>, today: Day, days: number): { all: { c: Cust; days: number }[]; past: { c: Cust; days: number }[] } {
  const all = b.customers.filter((c) => !c.qa && c.owes > 0).map((c) => ({ c, days: oldestDays(c, today) })).sort((x, y) => x.days - y.days);
  return { all, past: all.filter((x) => x.days > days) };
}

/** The shop's goal split: each salesperson, then the counter and agents. */
export const COUNTER = 'counter';
export function goalSplit(b: Pick<ManagerBooks, 'team' | 'me' | 'shop'>): { id: string; p: Person | null; goal: UGX; sold: UGX }[] {
  const sales = others(b).filter((p) => p.role === 'sales');
  return [...sales.map((p) => ({ id: p.id, p, goal: p.goal || 0, sold: p.sold })), { id: COUNTER, p: null, goal: b.shop.counterGoal, sold: b.shop.counterSold }];
}

/** Next month's goals (spec §7 Q3): this month's, as they stand. */
export function nextMonthGoals(split: { id: string; goal: UGX }[]): { staffId: string; amount: UGX }[] {
  return split.map((x) => ({ staffId: x.id, amount: x.goal }));
}

/** The four stages with a limit, in order (Team p3). */
export const LIMIT_STAGES: Stage[] = ['draft', 'awaiting_goods', 'preparing', 'pending_delivery'];
/** The limits a tile steps through, minutes (each tap: the next; the last goes back to the first). */
export const LIMIT_STEPS: Record<string, number[]> = {
  draft: [60, 120, 180, 240], awaiting_goods: [240, 720, 1440, 2880], preparing: [60, 120, 180, 240], pending_delivery: [120, 240, 360, 480],
};
export function nextLimit(stage: Stage, mins: number): number {
  const s = LIMIT_STEPS[stage] || [mins];
  const i = s.indexOf(mins);
  return s[(i + 1) % s.length] ?? s[0];
}
