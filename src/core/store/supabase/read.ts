/*
 * The Store's reads (data §1), as store.html makes them. The yard reads no table
 * but its own: the day is one server function (store_snapshot, every money key
 * stripped in the database), refreshed by store_live; a failed snapshot is said on
 * screen, NEVER filled from direct reads (PRIV-03). The direct reads left carry no
 * money: stock (when not folded), places, place_routes, road_names, stock_counts.
 */
import { dataError } from '../../datasource.ts';
import { readSession } from '../../supabase/read.ts';
import { ok } from '../../supabase/write.ts';
import type { Row, Sb } from '../../supabase/client.ts';
import type { Session } from '../../types.ts';
import type { StockCount, StoreSession, YardSide } from '../types.ts';
import { countOf, type Snap } from './rows.ts';

/** Roles let in (store.html:2007; screens Q15: owner, admin, manager look only). */
export const STORE_ROLES = ['store', 'staff', 'owner', 'admin', 'manager'];

/** R1, R2: the login and its shop_members row. */
export async function readStoreSession(sb: Sb): Promise<StoreSession | null> {
  const s: Session | null = await readSession(sb, STORE_ROLES, 'the Store');
  return s ? { ...s, staffId: null } : null;
}

/** R4 store_snapshot; R5 the stock table when the snapshot did not fold it in (store.html:1197). */
export async function readSnapshot(sb: Sb, s: StoreSession): Promise<Snap> {
  const d = await ok<Snap>(sb.rpc('store_snapshot', { p_shop: s.shopId }));
  if (!d || typeof d !== 'object') throw dataError('refused', 'Could not load the yard', 'ST-301');
  if (!d.stock || typeof d.stock !== 'object') {
    const rows = await ok<Row[]>(sb.from('stock').select('key,product_id,variant_idx,qty').eq('shop_id', s.shopId));
    d.stock = Object.fromEntries((rows || []).map((r) => [String(r.key), Number(r.qty) || 0]));
  }
  return d;
}

/** §1d store_live: the same less what rarely changes; laid over the last snapshot. */
export async function readLive(sb: Sb, s: StoreSession, last: Snap): Promise<Snap> {
  const d = await ok<Snap>(sb.rpc('store_live', { p_shop: s.shopId }));
  return { ...last, ...(d || {}) };
}

/** §1c store_order: one order row, as the books hold it now. */
export async function readOrderRow(sb: Sb, s: StoreSession, id: number): Promise<Row | null> {
  return ok<Row | null>(sb.rpc('store_order', { p_shop: s.shopId, p_id: Number(id) }));
}

/** R6: places, routes, road names (store.html:1205 loadSide). */
export async function readSide(sb: Sb, s: StoreSession): Promise<YardSide> {
  const [places, routes, names] = await Promise.all([
    ok<Row[]>(sb.from('places').select('name,lat,lng').eq('shop_id', s.shopId)),
    ok<Row[]>(sb.from('place_routes').select('from_place,to_place,km,mins,line,locked_at').eq('shop_id', s.shopId)),
    ok<Row[]>(sb.from('road_names').select('way_key,name').eq('shop_id', s.shopId)),
  ]);
  return {
    places: (places || []).filter((p) => p.lat != null && p.lng != null).map((p) => ({ name: String(p.name), lat: Number(p.lat), lng: Number(p.lng) })),
    routes: (routes || []).map((r) => ({ from: String(r.from_place), to: String(r.to_place), km: Number(r.km) || 0, mins: Number(r.mins) || 0, line: r.line })),
    roadNames: Object.fromEntries((names || []).map((r) => [String(r.way_key), String(r.name)])),
  };
}

/** §1c the open count of a place (store.html:2585), for W20a. */
export async function readWaitingCount(sb: Sb, s: StoreSession, place: string): Promise<StockCount | null> {
  const rows = await ok<Row[]>(sb.from('stock_counts').select('*').eq('shop_id', s.shopId).eq('status', 'sent').eq('place', place).limit(1));
  return rows && rows[0] ? countOf(rows[0]) : null;
}

/** §1c store.html:5421: did my count of this aisle arrive since then? */
export async function readCountArrived(sb: Sb, s: StoreSession, aisle: string, since: number): Promise<boolean> {
  const rows = await ok<Row[]>(sb.from('stock_counts').select('id').eq('shop_id', s.shopId).eq('counted_by', s.userId).eq('aisle', aisle).gte('created_at', new Date(since).toISOString()).limit(1));
  return !!(rows && rows.length);
}
