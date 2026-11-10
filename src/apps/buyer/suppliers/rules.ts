/*
 * The Suppliers tab's own rules (pure: books in, rows and words out). The
 * line rules come from src/core/buyer/rules.ts; these only gather them by
 * supplier, search, and age the price list.
 *
 *   supplierRows(b, now)     one row per supplier: its answer chip, who in Sales waits, whether it waits on Denis
 *   heroStats(b)             found of the last asks and the reply time, across suppliers
 *   places(b)                the place chips, in route order
 *   findSuppliers(rows, b, q)  the rows a search finds (name, place or an item they sell)
 *   closeTo(b, q)            when nobody sells it: the list's items nearest the words
 *   boughtFrom(b, sid, now)  what we buy from one supplier, its price and how old it is
 *   withThem(b, sid)         the live lines with one supplier now
 *   askText(b, sid)          the WhatsApp message for asking a supplier again
 */
import type { Ms, UGX } from '../../../core/types.ts';
import { LATE_MS, ROUTE, lineRefs, type LineRef } from '../../../core/buyer/rules.ts';
import type { BuyerBooks, LineState, ListPrice, Supplier } from '../../../core/buyer/types.ts';

const DAY_MS = 86400000;
/** A list price older than this is old: the supplier should be asked again (the board's amber "34 d old"). */
export const FRESH_DAYS = 7;

/** What a supplier's chip shows, strongest first: a price for Ruth, a no, an ask with no answer, one to ask, a yes. */
const CHIP_ORDER: LineState[] = ['priceup', 'notfound', 'asked', 'toask', 'found'];

export interface SupRow {
  s: Supplier;
  /** The answer chip; null when nothing of theirs is live. */
  state: LineState | null;
  at: Ms | null;
  /** Asked over 30 minutes ago with no answer: Ask again, on Denis. */
  waits: boolean;
  /** The salesperson of the oldest order waiting on them, and the orders. */
  sellerId: string | null;
  orders: number[];
}

const live = (r: LineRef) => r.state !== 'removed' && r.state !== 'in' && r.state !== 'short' && r.state !== 'ontrip';

export function supplierRows(b: BuyerBooks, now: Ms): SupRow[] {
  const refs = lineRefs(b).filter(live);
  const rows = b.suppliers.map((s): SupRow => {
    const mine = refs.filter((r) => r.line.supplierId === s.id);
    const state = CHIP_ORDER.find((st) => mine.some((r) => r.state === st)) || null;
    const ofState = mine.filter((r) => r.state === state);
    const times = ofState.map((r) => {
      const c = r.order.confirms[s.id];
      if (state === 'priceup') return r.line.repricedAt ?? c?.answeredAt ?? null;
      if (state === 'asked') return c?.askedAt ?? null;
      return state === 'toask' ? null : c?.answeredAt ?? null;
    }).filter((t): t is Ms => t != null);
    const at = times.length ? (state === 'asked' ? Math.min(...times) : Math.max(...times)) : null;
    const orders = [...new Set(mine.map((r) => r.order))].sort((x, y) => x.placedAt - y.placedAt);
    return {
      s, state, at, waits: state === 'asked' && at != null && now - at > LATE_MS,
      sellerId: orders.length ? orders[0].sellerId : null, orders: orders.map((o) => o.id),
    };
  });
  const rank = (r: SupRow) => (r.waits ? 0 : r.state ? 1 : 2);
  return rows.sort((x, y) => rank(x) - rank(y) || (y.at || 0) - (x.at || 0) || x.s.name.localeCompare(y.s.name));
}

export interface HeroStats { found: number; asked: number; replyMins: number | null }

/** Found of the last asks, summed; the reply time, the mean of the suppliers that have one. */
export function heroStats(b: BuyerBooks): HeroStats {
  const found = b.suppliers.reduce((t, s) => t + s.found, 0), asked = b.suppliers.reduce((t, s) => t + s.asked, 0);
  const rs = b.suppliers.map((s) => s.replyMins).filter((m): m is number => m != null);
  return { found, asked, replyMins: rs.length ? Math.round(rs.reduce((t, m) => t + m, 0) / rs.length) : null };
}

/** "12 min", "1 h", "2 h". */
export function replyWord(mins: number): string {
  return mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`;
}

/** A supplier who answers within 20 minutes is Fast. */
export const isFast = (s: Supplier): boolean => s.replyMins != null && s.replyMins <= 20;

/** The places suppliers are in, in the trip's route order, each with its count. */
export function places(b: BuyerBooks): { place: string; count: number }[] {
  const by = new Map<string, number>();
  b.suppliers.forEach((s) => by.set(s.place, (by.get(s.place) || 0) + 1));
  const idx = (p: string) => { const i = ROUTE.indexOf(p); return i < 0 ? ROUTE.length : i; };
  return [...by.entries()].map(([place, count]) => ({ place, count })).sort((x, y) => idx(x.place) - idx(y.place) || x.place.localeCompare(y.place));
}

const norm = (t: string) => t.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, ' ').trim();
const words = (t: string) => norm(t).split(/[^a-z0-9]+/).filter(Boolean);

/** Rows whose name, place or any listed item holds every word typed. */
export function findSuppliers(rows: SupRow[], b: BuyerBooks, q: string): SupRow[] {
  const ws = words(q);
  if (!ws.length) return rows;
  return rows.filter((r) => {
    const hay = norm([r.s.name, r.s.place, ...b.prices.filter((p) => p.supplierId === r.s.id).map((p) => p.item)].join(' '));
    return ws.every((w) => hay.includes(w));
  });
}

export interface Close { price: ListPrice; supplier: Supplier; same: Set<string> }

/** The list's items that share a word of three letters or more with the search, best first (three at most). */
export function closeTo(b: BuyerBooks, q: string): Close[] {
  const ws = new Set(words(q));
  const key = [...ws].filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  if (!key.length) return [];
  return b.prices.map((price) => {
    const iw = words(price.item), score = key.filter((w) => iw.includes(w)).length;
    const supplier = b.suppliers.find((s) => s.id === price.supplierId);
    return { price, supplier, score, same: new Set(iw.filter((w) => ws.has(w))) };
  }).filter((c): c is Close & { score: number; supplier: Supplier } => c.score > 0 && !!c.supplier)
    .sort((x, y) => y.score - x.score || x.price.price - y.price.price).slice(0, 3);
}

export interface Bought {
  price: ListPrice;
  /** What we pay now: a newer answer on a live line beats the list. */
  now: UGX;
  was: UGX | null;
  days: number;
  fresh: boolean;
}

/** How old a price is, in whole days. */
export const ageDays = (at: Ms, now: Ms): number => Math.max(0, Math.floor((now - at) / DAY_MS));

/** "Today", "1 d", "34 d". */
export const ageWord = (days: number): string => (days === 0 ? 'Today' : `${days} d`);

export function boughtFrom(b: BuyerBooks, sid: string, now: Ms): Bought[] {
  const refs = lineRefs(b);
  return b.prices.filter((p) => p.supplierId === sid).map((price) => {
    const newer = refs.find((r) => r.line.supplierId === sid && r.line.name === price.item && r.line.priceWas != null
      && r.line.repricedAt != null && r.line.repricedAt > price.at);
    const at = newer ? (newer.line.repricedAt as Ms) : price.at, days = ageDays(at, now);
    return { price, now: newer ? newer.line.cost : price.price, was: newer ? price.price : null, days, fresh: days <= FRESH_DAYS };
  });
}

/** The live lines with one supplier now, oldest order first. */
export function withThem(b: BuyerBooks, sid: string): LineRef[] {
  return lineRefs(b).filter((r) => r.line.supplierId === sid && r.state !== 'removed')
    .sort((x, y) => x.order.placedAt - y.order.placedAt || x.line.idx - y.line.idx);
}

/** The ask, written for WhatsApp: every live line of theirs still asked or to ask. */
export function askText(b: BuyerBooks, sid: string): string {
  const s = b.suppliers.find((x) => x.id === sid);
  const ls = withThem(b, sid).filter((r) => r.state === 'asked' || r.state === 'toask' || r.state === 'notfound');
  const items = ls.map((r) => `- ${r.line.name} × ${r.line.qty} ${r.line.unit}`).join('\n');
  return `Hello ${s ? s.name : ''}, do you have:\n${items}\nPlease tell me today. ${b.me.name.split(' ')[0]}`;
}

/** A Ugandan number for wa.me / tel: links. */
export function intlPhone(p: string): string {
  const d = String(p || '').replace(/[^0-9]/g, '');
  if (d.startsWith('256')) return d;
  return d.length >= 9 ? '256' + d.slice(-9) : d;
}
