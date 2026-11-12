/*
 * A tapped push opens a route (docs/spec/04-screens-store-routes.md §5): one map,
 * from the push's kind and data. A tap never takes an order (store.html:2696). With
 * no signal the route opens on the phone's copy and reads behind it.
 * test/store-shell.test.js checks every id this map opens is in routes.ts.
 */
import { isPickup, onATruck } from '../../../core/store/yard.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import type { Params } from './nav.ts';

export interface Opens { id: string; params: Params }
type Data = Record<string, unknown>;

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

export function pushRoute(kind: string, data: Data, b: YardBooks | null, me: string | null): Opens {
  const id = num(data.orderId ?? data.order_id ?? data.id), trip = str(data.tripId ?? data.trip_id), key = str(data.key);
  const o = b && id != null ? b.orders.find((x) => x.id === id) : null;
  switch (kind) {
    case 'order.pick': return o && o.assignedWorkerId && o.assignedWorkerId === me ? { id: 'pack/order', params: { id } } : { id: 'pack', params: id != null ? { first: id } : {} };
    case 'order.copy': return id != null ? { id: 'pack/look', params: { id } } : { id: 'today', params: {} };
    case 'order.cancelled': return o && onATruck(o) ? { id: 'out/road', params: {} } : id != null ? { id: 'pack/put-back', params: { id } } : { id: 'today', params: {} };
    case 'trip.back': return trip ? { id: 'in/checkin', params: { trip } } : { id: 'in', params: {} };
    case 'trip.sent': return { id: 'in/ride', params: trip ? { trip } : {} };
    case 'trip.taken': case 'trip.cancelled': return { id: 'today', params: {} };
    case 'trip.difference.decided': case 'pick.settled': return { id: 'today/with-ruth', params: {} };
    case 'store.ask.decided': {
      const k = str(data.askKind ?? data.kind_of ?? data.ask_kind);
      if (k === 'extra' && trip) return { id: 'in/checkin', params: { trip } };
      if (k === 'restock' && key) return { id: 'shelf/item', params: { key } };
      if (k === 'handover') return { id: 'today/pass-yard', params: {} };
      return key ? { id: 'shelf/item', params: { key } } : { id: 'today/with-ruth', params: {} };
    }
    case 'store.handover': return { id: 'today', params: {} };
    case 'credit.ask.decided': return o && b && isPickup(o, b.customers) ? { id: 'out/gate', params: { id } } : { id: 'out/load', params: {} };
    case 'job.given': return o && o.status === 'pending_delivery' && o.carrier && o.carrier.staffId === me ? { id: 'out/door', params: { id } } : { id: 'out/load', params: {} };
    case 'order.moved': return { id: 'today/alerts', params: {} };
    case 'return.coming': return { id: 'in', params: {} };
    case 'invoice.ask.decided': return id != null ? { id: 'in/return', params: { order: id } } : { id: 'today/with-ruth', params: {} };
    case 'stock.count.decided': case 'stock.report.decided': return key ? { id: 'shelf/item', params: { key } } : { id: 'shelf', params: {} };
    case 'stock.recount': {
      const aisle = str(data.aisle);
      return key ? { id: 'shelf/count', params: { key } } : aisle ? { id: 'shelf/count', params: { aisle } } : { id: 'shelf', params: {} };
    }
    default: return { id: 'today', params: {} };
  }
}

/** Every kind the map knows (routes §5), for the test. */
export const PUSH_KINDS = ['order.pick', 'order.copy', 'order.cancelled', 'trip.back', 'trip.sent', 'trip.taken', 'trip.cancelled', 'trip.difference.decided',
  'store.ask.decided', 'store.handover', 'pick.settled', 'credit.ask.decided', 'job.given', 'order.moved', 'return.coming', 'invoice.ask.decided',
  'stock.count.decided', 'stock.recount', 'stock.report.decided'];
