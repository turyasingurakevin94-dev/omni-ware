/*
 * The Buyer demo: the sample shop in memory behind BuyerSource. Every read
 * hands out a copy; every write changes the shop as the server function it
 * stands in for would, after a short wait so "Sending…" is seen.
 *
 *   ?demo                 09:00, every line to ask
 *   &state=midday|handoff|trip|empty
 *   &offline=1            no signal: writes are refused as offline (the outbox keeps them)
 */
import { dataError } from '../../datasource.ts';
import type { Session, UGX } from '../../types.ts';
import { readyForBuying, tripPlan, withStopDone } from '../rules.ts';
import type { BuyerSource, PriceAnswer, StopCount } from '../source.ts';
import type { AskWay, BLine, BOrder, BuyerBooks, Confirm } from '../types.ts';
import { seed, type BuyerDemoState } from './seed.ts';

const WRITE_MS = 250;
const copy = <T>(x: T): T => structuredClone(x);

export interface BuyerDemo extends BuyerSource {
  /** The shop itself, for tests. */
  readonly shop: BuyerBooks;
}

export function readState(search: string): { state: BuyerDemoState | null; offline: boolean } {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const s = q.get('state');
  return { state: s === 'midday' || s === 'handoff' || s === 'trip' || s === 'empty' || s === 'morning' ? s : null, offline: q.get('offline') === '1' };
}

export function buyerDemo(search: string = '?demo', opts: { instant?: boolean } = {}): BuyerDemo {
  const f = readState(search);
  const { books: b, now } = seed(f.state);
  const session: Session = { userId: b.me.id, shopId: 'shop-mukasa', shopName: 'Mukasa Hardware', role: 'buyer', name: b.me.name };
  const clock = () => now;

  const later = (fn: () => void): Promise<void> => new Promise((resolve, reject) => {
    if (f.offline) { reject(dataError('offline', 'No signal')); return; }
    const run = () => { try { fn(); b.savedAt = clock(); resolve(); } catch (e) { reject(e); } };
    if (opts.instant) run(); else setTimeout(run, WRITE_MS);
  });
  const order = (id: number): BOrder => {
    const o = b.orders.find((x) => x.id === id);
    if (!o) throw dataError('missing', `No order ${id}`);
    return o;
  };
  const lineOf = (o: BOrder, key: string): BLine => {
    const l = o.lines.find((x) => x.key === key);
    if (!l) throw dataError('missing', `No line ${key} on #0${o.id}`);
    return l;
  };
  /** The live orders holding lines of this supplier. */
  const withSupplier = (sid: string) => b.orders.filter((o) => (o.status === 'draft' || o.status === 'awaiting_goods') && o.lines.some((l) => l.supplierId === sid && !l.removed));
  /** orderLeaveDraft: every line found, the order moves to Buying. */
  const settle = () => b.orders.forEach((o) => { if (readyForBuying(o)) o.status = 'awaiting_goods'; });
  const answer = (sid: string, state: Confirm['state']) => withSupplier(sid).forEach((o) => {
    const c = o.confirms[sid];
    if (c && c.state === 'asked' && c.askedAt) o.confirms[sid] = { ...c, state, answeredAt: clock() };
  });

  return {
    kind: 'demo',
    get shop() { return b; },
    now: clock,
    online: () => !f.offline,
    session: async () => session,
    signIn: async () => session,
    signOut: async () => undefined,
    books: async () => copy(b),

    ask: (sid: string, way: AskWay) => later(() => {
      withSupplier(sid).forEach((o) => {
        const c = o.confirms[sid];
        if (!c || c.state !== 'found') o.confirms[sid] = { state: 'asked', askedAt: clock(), answeredAt: null, how: way };
      });
    }),
    answerYes: (sid) => later(() => { answer(sid, 'found'); settle(); }),
    answerPrice: (sid, ps: PriceAnswer[]) => later(() => {
      ps.forEach((p) => {
        const l = lineOf(order(p.orderId), p.key);
        if (p.cost !== l.cost) { l.priceWas = l.cost; l.cost = p.cost; l.repricedAt = clock(); l.ruthDecides = p.cost > l.sell; }
      });
      answer(sid, 'found'); settle();
    }),
    answerNo: (sid) => later(() => answer(sid, 'notfound')),
    undoAnswer: (sid) => later(() => withSupplier(sid).forEach((o) => {
      const c = o.confirms[sid];
      if (c && c.answeredAt) o.confirms[sid] = { ...c, state: 'asked', answeredAt: null };
      o.lines.forEach((l) => { if (l.supplierId === sid && l.priceWas != null) { l.cost = l.priceWas; l.priceWas = null; l.repricedAt = null; l.ruthDecides = false; } });
      if (o.status === 'awaiting_goods' && o.lines.some((l) => l.supplierId === sid)) o.status = 'draft';
    })),

    otherSupplier: (id, key, sid, cost: UGX) => later(() => {
      const o = order(id), l = lineOf(o, key);
      l.supplierId = sid; l.cost = cost; l.priceWas = null; l.ruthDecides = l.sell > 0 && cost > l.sell;
    }),
    clientWaits: (id, key) => later(() => {
      const l = lineOf(order(id), key);
      l.clientWaits = { at: clock(), via: 'sourcing' }; l.supplierId = null;
    }),
    removeLine: (id, key, reason) => later(() => { lineOf(order(id), key).removed = { at: clock(), reason }; settle(); }),
    switchItem: (id, key, to) => later(() => {
      const l = lineOf(order(id), key);
      l.switchedFrom = l.name; l.name = to.name; l.productId = to.productId; l.supplierId = to.supplierId; l.cost = to.cost;
      l.priceWas = null; l.ruthDecides = to.cost > l.sell;
    }),

    setStopOff: (sid, off) => later(() => {
      if (!b.trip || b.trip.state !== 'planned') { const p = tripPlan(b); b.trip = { id: 'trip-1017', state: 'planned', stops: p.stops, cash: { amount: p.cash, askedAt: null, givenAt: null, by: null }, handedInAt: null }; }
      const s = b.trip.stops.find((x) => x.supplierId === sid);
      if (s) s.off = off;
      b.trip.cash.amount = b.trip.stops.filter((x) => !x.off).reduce((t, x) => t + x.planned, 0);
    }),
    askCash: () => later(() => {
      if (!b.trip || b.trip.state !== 'planned') { const p = tripPlan(b); b.trip = { id: 'trip-1017', state: 'planned', stops: p.stops, cash: { amount: p.cash, askedAt: null, givenAt: null, by: null }, handedInAt: null }; }
      if (!b.trip.stops.some((s) => !s.off)) throw dataError('refused', 'Put a stop back to send');
      b.trip.state = 'cash'; b.trip.cash.askedAt = clock();
      // Esther gives it at once in the demo, so the trip can go on.
      b.trip.cash.givenAt = clock(); b.trip.cash.by = b.team.find((m) => m.role === 'accounts')?.id || null; b.trip.state = 'on';
    }),
    stopDone: (sid, counts: StopCount[], paid: UGX) => later(() => {
      const s = b.trip?.stops.find((x) => x.supplierId === sid);
      if (!b.trip || !s) throw dataError('missing', 'No such stop');
      counts.forEach((c) => lineOf(order(c.orderId), c.key));
      const n = withStopDone(b, sid, counts, paid, clock());
      b.orders = n.orders; b.trip = n.trip;
    }),
    undoStop: (sid) => later(() => {
      const s = b.trip?.stops.find((x) => x.supplierId === sid);
      if (!b.trip || !s) throw dataError('missing', 'No such stop');
      if (b.trip.state === 'in') throw dataError('refused', 'Already handed in');
      s.paid = null; s.done = false; s.doneAt = null;
    }),
    handIn: () => later(() => {
      if (!b.trip) throw dataError('missing', 'No trip');
      b.trip.state = 'in'; b.trip.handedInAt = clock();
    }),

    confirmPrice: (sid, productId, item, price) => later(() => {
      if (!(price > 0)) throw dataError('refused', 'Type their price first', 'noprice');
      const p = b.prices.find((x) => x.supplierId === sid && x.item === item);
      if (p) { p.price = price; p.at = clock(); } else b.prices.push({ item, productId, supplierId: sid, price, unit: 'pcs', at: clock() });
    }),
    suggestPhone: () => later(() => undefined),
    askSourcing: () => later(() => undefined),
  };
}
