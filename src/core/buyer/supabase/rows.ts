/*
 * The rows buyer.html reads, turned into the Buyer app's books
 * (src/core/buyer/types.ts). Pure: raw rows in, BuyerBooks out, so a test
 * can hand it sample rows (test/buyer-supabase-rows.test.js).
 *
 * Choices (docs/spec/04-screens-buyer-data.md):
 *   - a line is named by items[].lineId (made 'L<order>-<index>' when missing, §0);
 *   - lines on our shelf ('__stock__') are not the Buyer's: nothing to ask, nothing to buy. They are left out;
 *   - a removed line comes from payload.droppedLines (it has no lineId: its key is 'dropped:<n>', read only);
 *   - a "yes" whose terms no longer match (stale, buyer.html "again") reads To ask;
 *   - a round is the trips of one runner sharing an id stem (§7 #4); "done here" and what was
 *     paid come from the phone's keep until the hand-in (keep.ts).
 */
import type { Row } from '../../supabase/client.ts';
import { membersOf } from '../../supabase/rows.ts';
import { dayOf } from '../../time.ts';
import type { Member, Ms, Session } from '../../types.ts';
import type { AskWay, BLine, BOrder, BStatus, BuyerBooks, Confirm, ListPrice, Stop, Supplier, Trip } from '../types.ts';
import { gotOf, linePaid, locParts, priceRowOf, roundOrder, runsToGo, stem, tripPlanned, tripsCovering, type PriceRow, type Run } from './buy.ts';
import type { Keep } from './keep.ts';
import { agedOff, confirmState, createdMs, priceWaits, quoteOf, received, SHELF, type Q } from './order.ts';

export interface Raw {
  session: Session;
  members: Row[]; staff: Row[]; agents: Row[];
  suppliers: Row[]; products: Row[]; prices: Row[];
  quotes: Row[]; trips: Row[]; handoffs: Row[]; restock: Row[];
  /** A supplier phone the Buyer saved on this phone (ow-buyer-phones:<shop>). */
  phones: Record<string, string>;
  keep: Keep;
  now: Ms;
}

const ms = (v: unknown): Ms | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Date.parse(String(v));
  return isNaN(n) ? (Number(v) || null) : n;
};
const LIVE: BStatus[] = ['draft', 'awaiting_goods', 'preparing', 'pending_delivery'];
const HOW: Record<string, AskWay> = { wa: 'whatsapp', phone2: 'whatsapp', call: 'call', person: 'visit' };

/** The Buyer's staff row (buyer.html:894 myStaff): the runner id on a trip. */
export const myStaffOf = (raw: Pick<Raw, 'staff' | 'session'>): Row | null => raw.staff.find((s) => s.user_id && String(s.user_id) === raw.session.userId) || null;

/** "Name — 4 inch / flat" (buyer.html:906 productVariantLabel). */
export function itemName(products: Row[], pid: unknown, vi: unknown, fallback: string): string {
  const p = products.find((x) => String(x.id) === String(pid));
  if (!p) return fallback;
  const v = vi == null || vi === '' || !Array.isArray(p.variants) ? null : p.variants[Number(vi)];
  return v && v.combo ? `${p.name} — ${Object.values(v.combo).join(' / ')}` : String(p.name || fallback);
}

function confirmOf(q: Q, sid: string): Confirm | null {
  const rec = (q.supplierConfirms || {})[sid];
  if (!rec) return null;
  const c = confirmState(q, sid), how = c.askedHow ? HOW[c.askedHow] || 'whatsapp' : 'whatsapp';
  if (c.state === 'stale') return { state: 'asked', askedAt: null, answeredAt: null, how: null };
  if (c.state === 'confirmed' || c.state === 'problem') {
    return { state: c.state === 'confirmed' ? 'found' : 'notfound', askedAt: c.askedAt || c.at, answeredAt: c.at, how: c.askedAt ? how : null };
  }
  return { state: 'asked', askedAt: c.askedAt, answeredAt: null, how: c.askedAt ? how : null };
}

/** What came for a line: the yard's count once received, else the newest answer on a trip still standing. */
function gotFor(q: Q, it: Row, trips: Row[]): number | null {
  if (received(it)) return Number(it.receivedQty);
  const on = trips.filter((t) => !t.voided).filter((t) => tripsCovering([{ ...t, status: 'open' }], q, q.id, it.lineId).length)
    .sort((a, b) => (ms(b.created_at) || 0) - (ms(a.created_at) || 0));
  for (const t of on) {
    const l = (t.lines || []).find((x: Row) => String(x.orderId) === String(q.id) && String(x.lineId) === String(it.lineId));
    if (l && gotOf(l) != null) return gotOf(l);
  }
  return null;
}

function lineOf(q: Q, it: Row, idx: number, products: Row[], trips: Row[]): BLine {
  const cw = it.clientWaits && typeof it.clientWaits === 'object' ? it.clientWaits : it.clientWaits ? {} : null;
  return {
    idx, key: String(it.lineId), name: itemName(products, it.productId, it.variantIdx, String(it.productName || 'Item')),
    productId: it.productId != null ? String(it.productId) : null, qty: Number(it.qty) || 0, unit: String(it.unit || ''),
    cost: Math.round(Number(it.price) || 0), sell: Math.round(Number(it.sellPrice) || 0),
    supplierId: it.supplierId ? String(it.supplierId) : null,
    priceWas: it.priceWas != null ? Math.round(Number(it.priceWas)) : null, repricedAt: ms(it.repricedAt),
    ruthDecides: priceWaits(it), clientWaits: cw ? { at: ms(cw.at) || 0, via: cw.via === 'sourcing' ? 'sourcing' : null } : null,
    removed: null, switchedFrom: it.switchedFrom && it.switchedFrom.name ? String(it.switchedFrom.name) : null,
    got: gotFor(q, it, trips),
  };
}

export function orderOf(q: Q, products: Row[], trips: Row[]): BOrder {
  const items: Row[] = (q.items || []).filter(Boolean);
  const lines = items.map((it, i) => (it.supplierId === SHELF ? null : lineOf(q, it, i, products, trips))).filter((l): l is BLine => !!l);
  (Array.isArray(q.droppedLines) ? q.droppedLines : []).forEach((d: Row, i: number) => lines.push({
    idx: items.length + i, key: 'dropped:' + i, name: itemName(products, d.productId, d.variantIdx, String(d.productName || 'Item')),
    productId: d.productId != null ? String(d.productId) : null, qty: Number(d.qty) || 0, unit: String(d.unit || ''), cost: 0, sell: Math.round(Number(d.sellPrice) || 0),
    supplierId: null, priceWas: null, repricedAt: null, ruthDecides: false, clientWaits: null,
    removed: { at: ms(d.droppedAt) || 0, reason: String(d.reason || '') }, switchedFrom: null, got: null,
  }));
  const confirms: Record<string, Confirm> = {};
  Object.keys(q.supplierConfirms || {}).forEach((sid) => { const c = confirmOf(q, sid); if (c) confirms[sid] = c; });
  return {
    id: Number(q.id), client: String((q.client && q.client.name) || 'Unnamed client'), customerId: q.customerId ? String(q.customerId) : null,
    sellerId: String(q.takenBy || q.user_id || ''), status: (q.cancelledAt ? 'cancelled' : q.status) as BStatus,
    placedAt: createdMs(q), lines, confirms,
  };
}

/** A supplier's record from the asks on every order: asked, found, and the median minutes to answer. */
function supplierOf(s: Row, quotes: Q[], phones: Record<string, string>): Supplier {
  const id = String(s.id), recs = quotes.map((q) => (q.supplierConfirms || {})[id]).filter(Boolean) as Row[];
  const mins = recs.filter((r) => r.askedAt && r.at && r.at > r.askedAt && r.state !== 'pending').map((r) => (r.at - r.askedAt) / 60000).sort((a, b) => a - b);
  const phone = String(s.phone || s.phone2 || phones[id] || '');
  const parts = locParts(s.location);
  return {
    id, name: String(s.name || ''), place: parts[parts.length - 1] || '', phone, whatsapp: !!phone,
    found: recs.filter((r) => r.state === 'confirmed').length, asked: recs.filter((r) => r.askedAt).length,
    replyMins: mins.length ? Math.round(mins[Math.floor(mins.length / 2)]) : null,
  };
}

function listPriceOf(r: PriceRow, products: Row[]): ListPrice | null {
  const price = r.wholesale != null ? r.wholesale : r.retail;
  if (price == null) return null;
  return { item: itemName(products, r.productId, r.variantIdx, 'Item'), productId: r.productId != null ? String(r.productId) : null, supplierId: String(r.supplierId), price: Math.round(price), unit: r.unit, at: ms(r.date) || 0 };
}

/** buyer.html:3841 roundCashAsk: today's open cash ask no round took yet, for these suppliers (any, when none given). */
export function pendingCashAsk(raw: Raw, sids: string[] | null): Row | null {
  const key = (xs: unknown[]) => xs.map(String).sort().join(','), today = dayOf(raw.now);
  return raw.handoffs.filter((h) => h.kind === 'trip_cash' && h.status !== 'withdrawn' && String(h.ref || '').startsWith('round:') && !(h.payload || {}).round && h.cash_back == null
    && dayOf(ms(h.created_at) || 0) === today && (sids == null || key((h.payload || {}).supplierIds || []) === key(sids))
    && !raw.trips.some((t) => !t.voided && ((h.payload || {}).supplierIds || []).map(String).includes(String(t.supplier_id)) && (ms(t.created_at) || 0) > (ms(h.created_at) || 0)))
    .sort((a, b) => (ms(a.created_at) || 0) - (ms(b.created_at) || 0)).slice(-1)[0] || null;
}

/** My rounds by stem, each in creation order (buyer.html:4049 roundStops). Supplier deliveries are no round. */
export function myRounds(raw: Raw): Row[][] {
  const me = myStaffOf(raw);
  if (!me) return [];
  const by = new Map<string, Row[]>();
  raw.trips.filter((t) => String(t.assigned_worker_id) === String(me.id)).forEach((t) => { const k = stem(t.id); by.set(k, [...(by.get(k) || []), t]); });
  return [...by.values()].map((r) => r.sort((a, b) => (ms(a.created_at) || 0) - (ms(b.created_at) || 0)))
    .sort((a, b) => (ms(b[0].created_at) || 0) - (ms(a[0].created_at) || 0));
}
export const liveRound = (raw: Raw): Row[] | null => myRounds(raw).find((r) => r.some((t) => !t.voided && t.status === 'collecting')) || null;

const stopOfTrip = (t: Row, keep: Keep): Stop => {
  const k = keep.pay[t.id] || {}, collected = t.status === 'collected' || t.status === 'confirmed';
  const lines = (Array.isArray(t.lines) ? t.lines : []).filter((l: Row) => l.orderId !== 'restock' && isFinite(Number(l.orderId)))
    .map((l: Row) => ({ orderId: Number(l.orderId), key: String(l.lineId) }));
  const fromLines = (t.lines || []).reduce((s: number, l: Row) => s + linePaid(l), 0);
  const paid = collected ? Math.round(t.pay && t.pay.amount != null ? Number(t.pay.amount) : fromLines) : k.done ? Math.round(Number(k.amount) || 0) : null;
  return { supplierId: String(t.supplier_id), lines, planned: Math.round(tripPlanned(t)), paid, done: collected || !!k.done, doneAt: k.done ? ms(k.done) : collected ? ms(t.collected_at) : null, off: !!t.voided };
};
const stopOfRun = (r: Run, off: boolean): Stop => ({
  supplierId: r.supplierId, lines: r.lines.map((l) => ({ orderId: Number(l.q.id), key: String(l.it.lineId) })), planned: Math.round(r.total), paid: null, done: false, off,
});

/** The one trip the app shows: my round on the road, else the cash ask, else the plan, else today's round handed in. */
export function tripOf(raw: Raw, runs: Run[]): Trip | null {
  const live = liveRound(raw);
  const cashOf = (rid: string) => raw.handoffs.filter((h) => h.kind === 'trip_cash' && h.status !== 'withdrawn' && String((h.payload || {}).round || '') === rid).slice(-1)[0] || null;
  const roundTrip = (r: Row[], state: Trip['state']): Trip => {
    const id = stem(r[0].id), h = cashOf(id);
    return {
      id, state, stops: r.map((t) => stopOfTrip(t, raw.keep)),
      cash: {
        amount: h ? Math.round(Number(h.payload.amount) || 0) : r.reduce((s, t) => s + (Number(t.cash_given) || 0), 0),
        askedAt: h ? ms(h.created_at) : null, givenAt: h && h.status === 'done' ? ms(h.done_at || h.created_at) : null, by: null,
      },
      handedInAt: state === 'in' ? Math.max(...r.map((t) => ms(t.collected_at) || 0)) : null,
    };
  };
  if (live) return roundTrip(live, 'on');
  const ordered = roundOrder(runs, raw.suppliers);
  const ask = pendingCashAsk(raw, null);
  if (ask) {
    const sids = ((ask.payload || {}).supplierIds || []).map(String);
    return {
      id: 'plan', state: ask.status === 'done' ? 'on' : 'cash', stops: ordered.map((r) => stopOfRun(r, !sids.includes(r.supplierId))),
      cash: { amount: Math.round(Number((ask.payload || {}).amount) || 0), askedAt: ms(ask.created_at), givenAt: ask.status === 'done' ? ms(ask.done_at || ask.created_at) : null, by: null },
      handedInAt: null,
    };
  }
  if (ordered.length) {
    const stops = ordered.map((r) => stopOfRun(r, raw.keep.off.includes(r.supplierId)));
    return { id: 'plan', state: 'planned', stops, cash: { amount: stops.filter((s) => !s.off).reduce((t, s) => t + s.planned, 0), askedAt: null, givenAt: null, by: null }, handedInAt: null };
  }
  const today = dayOf(raw.now);
  const back = myRounds(raw).find((r) => r.some((t) => !t.voided) && r.every((t) => t.voided || t.status === 'collected' || t.status === 'confirmed')
    && r.some((t) => t.collected_at && dayOf(ms(t.collected_at) || 0) === today));
  return back ? roundTrip(back, 'in') : null;
}

/** The books, from the rows. */
export function booksOf(raw: Raw): BuyerBooks {
  const s = raw.session, quotes = raw.quotes.map(quoteOf);
  const team = membersOf(raw.members, raw.staff, [], s.userId);
  const me: Member = team.find((m) => m.id === s.userId) || { id: s.userId, name: s.name, initials: s.name.slice(0, 2).toUpperCase(), role: s.role, tint: 'me', presence: null, presenceSince: null, inChat: null, typingIn: null };
  const prices = raw.prices.map(priceRowOf);
  const runs = runsToGo(quotes, raw.trips, prices, raw.restock, raw.now);
  const orders = quotes.filter((q) => !q.voided && !q.cancelledAt && !agedOff(q, raw.now) && LIVE.includes(q.status))
    .map((q) => orderOf(q, raw.products, raw.trips));
  return {
    me, team, orders,
    suppliers: raw.suppliers.map((x) => supplierOf(x, quotes, raw.phones)),
    prices: prices.map((r) => listPriceOf(r, raw.products)).filter((p): p is ListPrice => !!p),
    trip: tripOf(raw, runs),
    savedAt: raw.now,
  };
}
