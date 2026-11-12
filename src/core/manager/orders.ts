/*
 * The Orders tab's rules (docs/spec/04-screens-manager.md §2 Orders; docs/canvas/manager/Orders.dc.html):
 * which orders the tab lists, what waits on the Manager per order and per stage, the stage clock,
 * who a stuck order can go to, and what To bill adds up. Pure: the screens draw what these say.
 *
 *   the list      live orders (not delivered, not cancelled) + delivered ones not yet billed
 *   waits on you  an order with an ask in the queue
 *   the clock     minutes in the stage against the stage's limit (a delivered one: against the 24 h bill)
 *   give it to    Checking or Buying: the Sourcing person · Packing: another store hand · On the road: another driver
 */
import { lineShopPrice } from './price.ts';
import { askerOf } from './queue.ts';
import type { Ask, ManagerBooks, MOrder, Ms, Person, Stage, TeamRole, UGX } from './types.ts';
import { BILL_AFTER_MS, limitsOf, onTheMove, stageMins, stuck, toBillThemselves, twins } from './watch.ts';
import { ANSWER, STAGES } from './words.ts';

type B = Pick<ManagerBooks, 'orders' | 'shop' | 'team' | 'asks'>;

/** Delivered and not billed yet (whether it bills itself or is held). */
export function deliveredUnbilled(o: MOrder): boolean {
  return o.stage === 'completed' && !o.invoiced;
}

/** The orders the tab lists: on the move, then delivered and not billed. */
export function listed(b: Pick<ManagerBooks, 'orders'>): MOrder[] {
  return [...onTheMove(b), ...b.orders.filter(deliveredUnbilled)];
}

/** The asks in the queue that are about this order, in queue order. */
export function asksOn(q: Ask[], orderId: number): Ask[] {
  return q.filter((a) => a.orderId === orderId);
}

/** One column of the head: its count, its faces (the salespeople's tints), how many wait on you. */
export interface StageCol { stage: Stage; orders: MOrder[]; need: number }
export function columns(b: Pick<ManagerBooks, 'orders'>, q: Ask[]): StageCol[] {
  const all = listed(b);
  return STAGES.map((stage) => {
    const orders = all.filter((o) => o.stage === stage);
    return { stage, orders, need: orders.filter((o) => q.some((a) => a.orderId === o.id)).length };
  });
}

/** The head's line: stuck · wait on you · on the move. */
export function headLine(b: B, q: Ask[], now: Ms): { stuck: number; waits: number; moving: UGX; count: number } {
  const all = listed(b);
  return {
    stuck: stuck(b, now).length,
    waits: all.filter((o) => q.some((a) => a.orderId === o.id)).length,
    moving: onTheMove(b).reduce((s, o) => s + o.total, 0),
    count: all.length,
  };
}

/**
 * The stage clock: minutes in, the limit, and where both sit on the bar. A row's bar runs to 1.5 × the
 * limit (the limit's tick at two thirds); the stuck page's runs to the minutes themselves (the limit's
 * tick where it fell). A delivered order's clock is the 24 h before it bills itself.
 */
export function clockOf(o: MOrder, shop: ManagerBooks['shop'], now: Ms, fit = false): { mins: number; limit: number; over: number; tickPct: number; fillPct: number } {
  const delivered = o.stage === 'completed';
  const mins = delivered && o.deliveredAt != null ? Math.max(0, (now - o.deliveredAt) / 60000) : stageMins(o, now);
  const limit = delivered ? BILL_AFTER_MS / 60000 : Number(limitsOf(shop)[o.stage]) || 0;
  const span = fit && mins > limit ? mins : limit * 1.5 || 1;
  return {
    mins, limit, over: limit ? Math.max(0, mins - limit) : 0,
    tickPct: limit ? Math.min(100, (limit / span) * 100) : 0,
    fillPct: Math.min(100, (mins / span) * 100),
  };
}

const GIVE_ROLES: Partial<Record<Stage, TeamRole[]>> = {
  draft: ['sourcing'], awaiting_goods: ['sourcing'], preparing: ['store'], pending_delivery: ['driver'],
};

/** Who a stuck order can be given to: the first one at work in the stage's role who does not hold it. */
export function giveTo(b: Pick<ManagerBooks, 'team'>, o: MOrder): Person | null {
  const roles = GIVE_ROLES[o.stage] || [];
  return b.team.find((p) => roles.includes(p.role) && !p.off && p.id !== o.holderId) || null;
}

/** The person who holds it, or null. */
export function holderOf(b: Pick<ManagerBooks, 'team'>, o: MOrder): Person | null {
  return o.holderId ? b.team.find((p) => p.id === o.holderId) || null : null;
}

/** The Buyer at work (the one who buys a line with no cost yet). */
export function buyer(b: Pick<ManagerBooks, 'team'>): Person | null {
  return b.team.find((p) => p.role === 'buyer' && !p.off) || null;
}

/** What a bill would come to: each line at its price, or the shop's price for a line with none yet. */
export function billAmount(o: MOrder, shopDefault: number): UGX {
  return o.lines.reduce((s, l) => s + Math.round((l.price ?? lineShopPrice(l, shopDefault) ?? 0) * l.qty), 0);
}

/** A price ask's one safe answer on the row (spec §3.4): the figure and the word the asker sees. */
export function safePrice(b: Pick<ManagerBooks, 'orders' | 'shop'>, a: Ask): { price: UGX | null; word: 'approved' | 'shop' | 'set'; say: string } | null {
  if (a.kind !== 'price' && a.kind !== 'counter') return null;
  const o = b.orders.find((x) => x.id === a.orderId);
  const l = o ? o.lines[a.idx] : null;
  if (!l) return null;
  const shop = lineShopPrice(l, b.shop.defaultMarkup);
  if (a.kind === 'counter' || a.mode === 'under') return { price: a.asked, word: 'approved', say: ANSWER.approved };
  if (a.mode === 'up') return { price: shop, word: 'shop', say: ANSWER.shopsPrice };
  return { price: l.cost != null ? shop : null, word: 'set', say: ANSWER.priceSet };
}

/** The answer word a row's told line shows for an ask (what the asker will see on the safe answer). */
export function safeWord(b: Pick<ManagerBooks, 'orders' | 'shop'>, a: Ask): string {
  const p = safePrice(b, a);
  if (p) return p.price != null ? `${p.say} · ${p.price.toLocaleString('en-US')}` : p.say;
  switch (a.kind) {
    case 'cancel': return ANSWER.cancelled;
    case 'short': return ANSWER.billWent;
    case 'storecredit': return ANSWER.loadIt;
    case 'credit': return ANSWER.onCredit;
    case 'bill': return ANSWER.billIt;
    case 'given': return ANSWER.givenAway;
    case 'return': return ANSWER.creditNote;
    case 'void': return ANSWER.voided;
    case 'agent': return ANSWER.agreed;
    default: return '';
  }
}

/** Who is told on a row: the asker (or the order's salesperson when the app spotted it). */
export function toldOn(b: Pick<ManagerBooks, 'team' | 'orders'>, a: Ask): Person | null {
  return askerOf(b, a);
}

/** To bill (Orders p4): can't bill itself (asks on delivered orders), taken twice, bills itself; the sums. */
export const CANT_BILL: Ask['kind'][] = ['bill', 'price', 'given', 'short'];
export function toBill(b: B, q: Ask[]): {
  cant: { a: Ask; o: MOrder; amount: UGX }[];
  twins: { keep: MOrder; drop: MOrder; same: boolean }[];
  itself: MOrder[];
  itselfSum: UGX; waitSum: UGX; count: number;
} {
  const cant = q.filter((a) => CANT_BILL.includes(a.kind) && a.orderId != null)
    .map((a) => ({ a, o: b.orders.find((o) => o.id === a.orderId) as MOrder }))
    .filter((x) => x.o && x.o.stage === 'completed')
    .map((x) => ({ ...x, amount: billAmount(x.o, b.shop.defaultMarkup) }));
  const tw = twins(b);
  const itself = toBillThemselves(b);
  const itselfSum = itself.reduce((s, o) => s + o.total, 0);
  const waitSum = cant.reduce((s, x) => s + x.amount, 0) + tw.reduce((s, t) => s + t.drop.total, 0);
  return { cant, twins: tw, itself, itselfSum, waitSum, count: cant.length + tw.length + itself.length };
}
