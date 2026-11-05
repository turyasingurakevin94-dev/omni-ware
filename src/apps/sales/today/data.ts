/*
 * What Today reads, said once: pure functions over the books, the chats and
 * the clock. Every figure the Today boards draw comes out of here (FACTS §5),
 * by the money rules of src/core/money.ts; screens never re-derive one.
 *
 *   mine(b)          Grace's live orders (placed by her, not delivered, not cancelled)
 *   tiles(b, now)    the four stage tiles (P07): count, faces, mark, need badge
 *   owed(b, now)     who owes: past / under the 21-day hold, being checked, to take
 *   needs(…)         Needs you, by kind (P08)
 *   moves(…)         Next move: one per customer, the best value first (P09)
 */
import { soldByAisle } from '../../../core/aisles.ts';
import { waitingChats } from '../../../core/chats.ts';
import { dueCustomers } from '../../../core/customers.ts';
import { daysInStage, heldFor, isPickup, LATE_DAYS, priceUntold } from '../../../core/orders.ts';
import { HOLD_DAYS, holdDay, orderTotal, promiseState } from '../../../core/money.ts';
import { owedBy, takeWithHeld, type Owed } from '../../../core/owing.ts';
import { addDays, dayOf } from '../../../core/time.ts';
import type { Books, ChatBooks, Customer, Day, Ms, Order, PayPromise, SourcingAsk, Stage, UGX } from '../../../core/types.ts';
import type { Face } from '../../../ui/Avatar.tsx';

export const LIVE: Stage[] = ['checking', 'buying', 'packing', 'road'];
const sum = <T>(xs: T[], f: (x: T) => number): number => xs.reduce((s, x) => s + f(x), 0);

/** A customer's face, or the walk-in's ("WI", slate). */
export function faceOf(b: Books, o: Pick<Order, 'customerId'>): Face {
  const c = o.customerId ? b.customers.find((x) => x.id === o.customerId) : null;
  return c ? { initials: c.initials, tint: c.tint } : { initials: 'WI', tint: 't4' };
}
export const custOf = (b: Books, id: string | null): Customer | null => (id ? b.customers.find((c) => c.id === id) || null : null);

const counted = (o: Order) => !o.cancelled && !o.voided && !o.qa;

/** Grace's live orders. */
export function mine(b: Books): Order[] {
  return b.orders.filter((o) => counted(o) && !o.counter && o.placedBy === b.me.id && o.stage !== 'delivered');
}

/** Monday of this week (Kampala). */
export function weekStart(today: Day): Day {
  const wd = new Date(today + 'T00:00:00Z').getUTCDay();
  return addDays(today, -((wd + 6) % 7));
}

/** Delivered this week ("8 done"). */
export function doneWeek(b: Books, now: Ms): Order[] {
  const mon = weekStart(dayOf(now));
  return b.orders.filter((o) => counted(o) && !o.counter && o.placedBy === b.me.id && o.stage === 'delivered' && o.deliveredAt != null && dayOf(o.deliveredAt) >= mon && o.deliveredAt <= now);
}

/** Sales invoiced this month by Grace (the glossary's "Sold"). */
export function soldIn(b: Books, month: string, upTo?: Day): Order[] {
  return b.orders.filter((o) => counted(o) && o.placedBy === b.me.id && o.invoiced && o.invoicedAt != null
    && dayOf(o.invoicedAt).startsWith(month) && (!upTo || dayOf(o.invoicedAt) <= upTo));
}
export const total = (os: Order[]): UGX => sum(os, orderTotal);

/** Packing for two days or more (the yard is late with it). */
export const packingLate = (o: Order, now: Ms) => o.stage === 'packing' && daysInStage(o, now) >= LATE_DAYS;
/** On the road with nowhere to go: ready to collect at the gate. */
export const readyToCollect = (o: Order) => o.stage === 'road' && isPickup(o);
/** In Checking and held for Grace: the money comes first ("Not paid yet"). */
export const heldForMe = (b: Books, o: Order) => heldFor(o, b.me.id);

export interface Tile { stage: Stage; orders: Order[]; faces: Face[]; more: number; mark?: 'money' | 'ready' | 'late'; need?: number }

/**
 * The four tiles. Faces: late first, then newest first; on the road, first out first (who arrives
 * first). Each customer once; up to three faces, past three orders two, and "+n" for the orders not shown.
 */
export function tiles(b: Books, now: Ms): Tile[] {
  const live = mine(b);
  return LIVE.map((stage) => {
    const os = live.filter((o) => o.stage === stage).sort(stage === 'road'
      ? (x, y) => x.stageAt - y.stageAt || x.id - y.id
      : (x, y) => Number(packingLate(y, now)) - Number(packingLate(x, now)) || y.id - x.id);
    const uniq: Face[] = [];
    os.forEach((o) => { const f = faceOf(b, o); if (!uniq.some((x) => x.initials === f.initials && x.tint === f.tint)) uniq.push(f); });
    const faces = uniq.slice(0, os.length > 3 ? 2 : 3);
    const t: Tile = { stage, orders: os, faces, more: os.length - faces.length };
    if (stage === 'checking') { const n = os.filter((o) => heldForMe(b, o)).length; if (n) { t.mark = 'money'; t.need = n; } }
    if (stage === 'packing') { const n = os.filter((o) => packingLate(o, now)).length; if (n) { t.mark = 'late'; if (n > 1) t.need = n; } }
    if (stage === 'road' && os.some(readyToCollect)) t.mark = 'ready';
    return t;
  });
}

/* ---------------- who owes ---------------- */

/** Who owes (core/owing.ts), with a live order of theirs held for Grace's money ("Not paid yet"). */
export interface Owing extends Owed {
  held: Order | null;
}

export function owing(b: Books, now: Ms): Owing[] {
  const live = mine(b);
  return owedBy(b, now).map((w) => ({ ...w, held: live.find((o) => o.customerId === w.c.id && heldForMe(b, o)) || null }));
}

/** The day a customer's oldest bill reaches the hold ("hold Fri 23 Oct"). */
export const holdOf = (w: Owing, b: Books): Day | null => (w.bills.length ? holdDay(w.bills[0].day, b.settings.holdDays || HOLD_DAYS) : null);

/** What taking a held order's money would ask for: what they owe plus the order (Mukono: Take 1.1M). */
export const takeHeld = (w: Owing): UGX => takeWithHeld(w, w.c.id, w.held).amount;

/**
 * What a Take opens customers/pay with: the customer and the bills it pays, comma-separated (core/owing.ts
 * takeBills: never a bill being checked; `debt` for a charge with no order). With an order held for the money:
 * every bill and that order.
 */
export function takeOf(w: Owing, past: boolean): { customer: string; bills: string } {
  const t = takeWithHeld(w, w.c.id, w.held, past);
  return { customer: t.customer, bills: t.bills };
}

/**
 * The promise to show on To collect: the one due today and still open, or one whose day has passed and was
 * not kept (spec 02 §5.6). A promise for a later day is not shown here (it is on the customer's own screen).
 */
export function promiseToShow(b: Books, c: Customer, today: Day): PayPromise | null {
  return b.promises.filter((p) => p.customerId === c.id).map((p) => ({ p, st: promiseState(p, c, today) }))
    .filter((x) => (x.p.on === today && x.st === 'open') || x.st === 'broken')
    .sort((x, y) => (y.p.on < x.p.on ? -1 : y.p.on > x.p.on ? 1 : y.p.id - x.p.id))[0]?.p || null;
}

/* ---------------- rhythm ---------------- */


export interface Due { c: Customer; late: number; every: number; usual: UGX }

/** Late or due today, not gone quiet: who is due by the one rule (core/customers.ts), the latest first. */
export function due(b: Books, now: Ms): Due[] {
  return dueCustomers(b.customers, b.orders, dayOf(now)).map(({ c, r }) => ({ c, late: r.late || 0, every: r.every || 0, usual: usualValue(b, c) }))
    .sort((x, y) => y.late - x.late);
}

export function usualValue(b: Books, c: Customer): UGX {
  return sum(c.usual, (u) => u.qty * ((b.items.find((i) => i.id === u.itemId && i.variantIdx === u.variantIdx) || { price: 0 }).price || 0));
}

/* ---------------- tell them ---------------- */

/** Live orders whose price the Manager changed, not told yet. */
export function priceTells(b: Books): Order[] {
  return mine(b).filter((o) => o.lines.some(priceUntold));
}

/** Asks of Grace's that Moses listed, not told yet (told: kept on this phone, `told`). */
export function askTells(b: Books, told: string[]): SourcingAsk[] {
  return b.asks.filter((a) => a.status === 'listed' && a.requests.some((r) => r.by === b.me.id && r.customerId) && !told.includes('ask:' + a.id));
}

/** What an ask's customer asked for, at the shop's price now. */
export function askValue(b: Books, a: SourcingAsk): UGX {
  const it = a.itemId ? b.items.find((i) => i.id === a.itemId) : null, r = a.requests[0];
  return it && it.price && r ? it.price * r.qty : 0;
}

/** "the maroon roof paint", "the 56 inch ceiling fans": what it is, as said to a customer. */
export function askSaid(a: Pick<SourcingAsk, 'itemId' | 'name'>, b: Books, qty: number): string {
  const it = a.itemId ? b.items.find((i) => i.id === a.itemId) : null, name = it ? it.name : a.name;
  const [base, variant] = name.split(/ · |, /);
  const v = (variant || '').replace(/\b\d+\s?(L|kg|m|mm)\b/g, '').trim();
  // Many of a thing take an s, but not after a size ("the solar water pump 1hp", "the tile cutter 600mm").
  const plural = !it && qty > 1 && !/\d/.test(base.trim().split(/\s+/).pop() || '');
  return `the ${v ? v + ' ' : ''}${base.toLowerCase()}${plural ? 's' : ''}`;
}

/* ---------------- needs you ---------------- */

export interface Needs {
  take: Owing[];
  tellPrice: Order[];
  tellAsk: SourcingAsk[];
  waiting: ReturnType<typeof waitingChats>;
  late: Order[];
  total: number;
}

export function needs(b: Books, cb: ChatBooks | null, now: Ms, told: string[]): Needs {
  const take = owing(b, now).filter((w) => w.take > 0).sort((x, y) => y.age - x.age);
  const tellPrice = priceTells(b).filter((o) => !told.includes('price:' + o.id)), tellAsk = askTells(b, told);
  const waiting = cb ? waitingChats(cb, b.me.id, now) : [];
  const lateN = mine(b).filter((o) => packingLate(o, now));
  const late = lateN.length > 1 ? lateN : [];
  return { take, tellPrice, tellAsk, waiting, late, total: take.length + tellPrice.length + tellAsk.length + waiting.length + late.length };
}

/* ---------------- next move ---------------- */

export type Move =
  | { kind: 'due'; c: Customer; value: UGX; d: Due }
  | { kind: 'chat'; c: Customer; value: UGX; draftKey: string; chat: number; qty: number; unit: string; since: Ms }
  | { kind: 'ask'; c: Customer; value: UGX; ask: SourcingAsk }
  | { kind: 'price'; c: Customer; value: UGX; order: Order };

interface DraftLike { key: string; customerId: string | null; chatId: number | null; lines: { qty: number; unit: string; price: number | null }[] }

/** One move per customer, the one worth most; then the most valuable first. */
export function moves(b: Books, cb: ChatBooks | null, now: Ms, told: string[], drafts: DraftLike[]): Move[] {
  const all: Move[] = [];
  due(b, now).forEach((d) => { if (d.usual > 0) all.push({ kind: 'due', c: d.c, value: d.usual, d }); });
  (cb ? waitingChats(cb, b.me.id, now) : []).forEach((w) => {
    const c = custOf(b, w.chat.customerId), dr = c && drafts.find((x) => x.chatId === w.chat.id);
    if (c && dr) all.push({ kind: 'chat', c, value: sum(dr.lines, (l) => l.qty * (l.price || 0)), draftKey: dr.key, chat: w.chat.id, qty: sum(dr.lines, (l) => l.qty), unit: dr.lines[0] ? dr.lines[0].unit : '', since: w.since });
  });
  askTells(b, told).forEach((a) => { const c = custOf(b, a.requests[0].customerId); if (c) all.push({ kind: 'ask', c, value: askValue(b, a), ask: a }); });
  priceTells(b).filter((o) => !told.includes('price:' + o.id)).forEach((o) => { const c = custOf(b, o.customerId); if (c) all.push({ kind: 'price', c, value: 0, order: o }); });
  const rank = { due: 0, chat: 1, ask: 2, price: 3 };
  const best = new Map<string, Move>();
  all.forEach((m) => { const cur = best.get(m.c.id); if (!cur || m.value > cur.value || (m.value === cur.value && rank[m.kind] < rank[cur.kind])) best.set(m.c.id, m); });
  return [...best.values()].sort((x, y) => y.value - x.value || rank[x.kind] - rank[y.kind]);
}

/* ---------------- your day ---------------- */

/** Placed today by Grace; an order entered twice counts once (the later copy is left out). */
export function placedToday(b: Books, now: Ms): Order[] {
  const today = dayOf(now);
  const os = b.orders.filter((o) => !o.cancelled && !o.counter && o.placedBy === b.me.id && dayOf(o.placedAt) === today && o.placedAt <= now);
  return os.filter((o) => !os.some((x) => x.id < o.id && copyOf(x, o))).sort((x, y) => x.placedAt - y.placedAt);
}

/** The same customer, the same lines, within five minutes: entered twice. */
export function copyOf(a: Order, b: Order): boolean {
  return a.customerId != null && a.customerId === b.customerId && Math.abs(a.placedAt - b.placedAt) <= 5 * 60000 && a.lines.length === b.lines.length
    && a.lines.every((l, i) => l.itemId === b.lines[i].itemId && l.qty === b.lines[i].qty);
}

export function moneyInToday(b: Books, now: Ms) {
  const today = dayOf(now);
  return b.payments.filter((p) => p.by === b.me.id && p.day === today && p.at <= now && !p.qa).sort((x, y) => x.at - y.at);
}

/* ---------------- the shop's aisles ---------------- */

/** The month before ("2026-10" → "2026-09"). */
const monthBefore = (m: string): string => { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };

/**
 * Sells most: the aisles with the most money sold this month so far, the most first. On a month's first day,
 * with nothing sold yet, last month's, and it says so (TD06 "the shop, last month"; TD11 "this month").
 */
export function sellsMost(b: Books, now: Ms, n = 3): { aisles: string[]; when: 'this month' | 'last month' } {
  const month = dayOf(now).slice(0, 7);
  let by = soldByAisle(b, month, now), when: 'this month' | 'last month' = 'this month';
  if (!by.size) { by = soldByAisle(b, monthBefore(month), now); when = 'last month'; }
  return { aisles: [...by].sort((x, y) => y[1] - x[1]).slice(0, n).map(([a]) => a), when };
}

/**
 * The aisle of what was asked of Sourcing: its catalogue item's (the ask's own item, else the one item named
 * like it). With no match there is no aisle; it is never guessed from words.
 */
export function askAisle(b: Books, a: Pick<SourcingAsk, 'itemId' | 'name'>): string {
  const own = a.itemId ? b.items.find((i) => i.id === a.itemId) : null;
  if (own) return own.aisle;
  // Its very name first (the catalogue grew to the shop's 1,153 items: "Contact cement" is named like "Cement" too).
  const same = b.items.find((i) => i.name.toLowerCase() === a.name.trim().toLowerCase());
  if (same) return same.aisle;
  const base = a.name.split(/ · |, /)[0].trim().toLowerCase();
  const hit = base ? b.items.filter((i) => i.name.toLowerCase().includes(base)) : [];
  return hit.length === 1 ? hit[0].aisle : '';
}
