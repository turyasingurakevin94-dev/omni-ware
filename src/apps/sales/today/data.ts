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
import { waitingChats } from '../../../core/chats.ts';
import { HOLD_DAYS, holdDay, lineTotal, orderOwes, orderTotal, promiseState } from '../../../core/money.ts';
import { owedBy, type Owed } from '../../../core/owing.ts';
import { addDays, daysApart, dayOf } from '../../../core/time.ts';
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
export const packingLate = (o: Order, now: Ms) => o.stage === 'packing' && now - o.stageAt >= 2 * 864e5;
/** On the road with nowhere to go: ready to collect at the gate. */
export const readyToCollect = (o: Order) => o.stage === 'road' && !o.deliverTo;
/** In Checking and held for Grace: the money comes first ("Not paid yet"). */
export const heldForMe = (b: Books, o: Order) => o.stage === 'checking' && o.holderId === b.me.id;

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
export const takeHeld = (w: Owing): UGX => w.owes + (w.held ? orderOwes(w.held) : 0);

/**
 * What a Take opens customers/pay with: the customer and the bills it pays (order ids, comma-separated). Past the hold: the bills past it;
 * with an order held for the money: every bill and that order. A bill Accounts is checking is never in it
 * (Ggaba: #0521 without the 125,000 of #0528).
 */
export function takeOf(w: Owing, past: boolean): { customer: string; bills: string } {
  const bills = w.bills.filter((x) => !x.checked && x.orderId != null && (past ? x.past : true)).map((x) => x.orderId as number);
  return { customer: w.c.id, bills: (!past && w.held ? [...bills, w.held.id] : bills).join(',') };
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

export function lastOrderAt(b: Books, cid: string): Ms | null {
  const os = b.orders.filter((o) => o.customerId === cid && !o.voided && !o.qa);
  return os.length ? Math.max(...os.map((o) => o.placedAt)) : null;
}

export interface Due { c: Customer; late: number; every: number; usual: UGX }

/** Late or due today, not gone quiet (two rhythms or more): the latest first. */
export function due(b: Books, now: Ms): Due[] {
  const today = dayOf(now), out: Due[] = [];
  b.customers.forEach((c) => {
    if (c.qa || !c.everyDays) return;
    const last = lastOrderAt(b, c.id);
    if (last == null) return;
    const gap = daysApart(dayOf(last), today), late = gap - c.everyDays;
    if (late < 0 || gap >= 2 * c.everyDays) return;
    out.push({ c, late, every: c.everyDays, usual: usualValue(b, c) });
  });
  return out.sort((x, y) => y.late - x.late);
}

export function usualValue(b: Books, c: Customer): UGX {
  return sum(c.usual, (u) => u.qty * ((b.items.find((i) => i.id === u.itemId && i.variantIdx === u.variantIdx) || { price: 0 }).price || 0));
}

/* ---------------- tell them ---------------- */

/** Live orders whose price the Manager changed, not told yet. */
export function priceTells(b: Books): Order[] {
  return mine(b).filter((o) => o.lines.some((l) => l.priceReview && l.priceReview.state === 'changed' && !(l.priceToldAt && l.priceToldAt >= l.priceReview.at)));
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

/** Money sold in a month by aisle, the whole shop's (every seller and the counter; invoiced, up to now). */
function soldByAisle(b: Books, month: string, now: Ms): Map<string, number> {
  const by = new Map<string, number>();
  b.orders.filter((o) => counted(o) && o.invoiced && o.invoicedAt != null && o.invoicedAt <= now && dayOf(o.invoicedAt).startsWith(month)).forEach((o) => o.lines.forEach((l) => {
    const it = b.items.find((i) => i.id === l.itemId);
    if (it && it.aisle) by.set(it.aisle, (by.get(it.aisle) || 0) + lineTotal(l));
  }));
  return by;
}

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
 * The shop's aisles with how many products each holds (Books.aisles), the ones selling most this month first,
 * then the most products (TD14 "Or open an aisle").
 */
export function shopAisles(b: Books, now: Ms): { name: string; count: number }[] {
  const by = soldByAisle(b, dayOf(now).slice(0, 7), now);
  return b.aisles.slice().sort((x, y) => (by.get(y.name) || 0) - (by.get(x.name) || 0) || y.count - x.count);
}

/**
 * The aisle of what was asked of Sourcing: its catalogue item's (the ask's own item, else the one item named
 * like it). With no match there is no aisle; it is never guessed from words.
 */
export function askAisle(b: Books, a: Pick<SourcingAsk, 'itemId' | 'name'>): string {
  const own = a.itemId ? b.items.find((i) => i.id === a.itemId) : null;
  if (own) return own.aisle;
  const base = a.name.split(/ · |, /)[0].trim().toLowerCase();
  const hit = base ? b.items.filter((i) => i.name.toLowerCase().includes(base)) : [];
  return hit.length === 1 ? hit[0].aisle : '';
}
