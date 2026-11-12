/*
 * The Store's other writes (data §3 W12–W24), each as store.html makes it:
 * trips through receive_trip and store_patch_trip, asks into store_asks, losses
 * into stock_reports, returns through store_return_ask, counts into stock_counts
 * (store_count_replace for a second one of the place), the shift through
 * store_asks and answer_store_ask. Photos go to the one bucket, delivery-photos.
 */
import { dataError, isDataError } from '../../datasource.ts';
import { ok } from '../../supabase/write.ts';
import type { Row, Sb } from '../../supabase/client.ts';
import { countPlace } from '../keys.ts';
import type { CheckInLine, CloseYard, CountSend, Extra, Loss, PassYard, Restock, ReturnAsk } from '../source.ts';
import type { StoreSession } from '../types.ts';
import { changeOrder, uuid } from './order.ts';
import { readSide, readWaitingCount } from './read.ts';
import type { Snap } from './rows.ts';

const unitOf = (u: unknown): string => String(u || '').trim().toLowerCase();

/** store.html:2464 shelfPackFor: how many of the shelf's unit one of the line's is. */
export function shelfPackFor(units: Row[], l: Row): number {
  const v = l.variantIdx == null || l.variantIdx === '' ? null : Number(l.variantIdx);
  const rows = units.filter((u) => String(u.product_id) === String(l.productId) && (u.variant_idx == null ? null : Number(u.variant_idx)) === v);
  const shelf = rows.find((r) => Number(r.pack_qty) > 0 && r.pack_unit && unitOf(r.pack_unit) !== unitOf(r.unit));
  const said = unitOf(l.unit);
  if (!shelf || !said || said !== unitOf(shelf.pack_unit)) return 1;
  return Number(l.packQty) > 0 && unitOf(l.packUnit) === said ? Number(l.packQty) : Number(shelf.pack_qty);
}

export function yardWrites(sb: Sb, s: StoreSession, snap: () => Snap | null) {
  const upload = async (blob: Blob, folder: string): Promise<string> => {
    const path = `${s.shopId}/${folder}/${uuid()}.jpg`;
    await ok(sb.storage.from('delivery-photos').upload(path, blob, { contentType: 'image/jpeg' }));
    return path;
  };
  const ask = (kind: string, ref: string, payload: Row) => ok(sb.from('store_asks').insert({ shop_id: s.shopId, kind, ref, asked_by: s.userId, asked_by_name: s.name, payload }));
  const trip = (id: string): Row => {
    const t = ((snap() || {}).trips || []).find((x: Row) => String(x.id) === String(id));
    if (!t) throw dataError('refused', 'That trip is gone', 'P0002');
    return t;
  };
  const count = async (c: CountSend): Promise<void> => {
    const row: Row = { shop_id: s.shopId, aisle: c.aisle, counted_by: s.userId, counted_by_name: s.name, lines: c.lines, ...(c.missing.length ? { missing: c.missing } : {}) };
    try { await ok(sb.from('stock_counts').insert(row)); } catch (e) {
      // 0161: one waiting count per place; this one replaces it (store.html:2585).
      if (!(isDataError(e) && e.code === '23505')) throw e;
      const place = countPlace(c.aisle, c.lines.map((l) => l.key)), open = place ? await readWaitingCount(sb, s, place) : null;
      if (!open) throw e;
      await replace(open.id, c);
    }
  };
  const replace = (oldId: string, c: CountSend) => ok(sb.rpc('store_count_replace', { p_shop: s.shopId, p_old: oldId, p_aisle: c.aisle, p_lines: c.lines, p_missing: c.missing, p_name: s.name }));

  return {
    /** W12 store.html:2541 nameRoad. */
    nameDirection: async (key: string, name: string) => {
      const v = name.trim().slice(0, 40);
      if (!v) throw dataError('refused', 'Give it a name', 'P0001');
      await ok(sb.from('road_names').upsert({ shop_id: s.shopId, way_key: key, name: v }, { onConflict: 'shop_id,way_key' }));
    },
    /** W13 store.html:2614: the road from OSRM, kept in place_routes (a second lock of the same road is fine). */
    lockRoute: async (from: string, to: string) => {
      const side = await readSide(sb, s), a = side.places.find((p) => p.name === from), b = side.places.find((p) => p.name === to);
      if (!a || !b) throw dataError('refused', 'Put both places on the map first', 'P0001');
      let r: Row;
      try { r = await (await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`)).json(); } catch (_e) { throw dataError('offline', 'No signal'); }
      const route = r && r.routes && r.routes[0];
      if (!route) throw dataError('refused', 'No road found', 'P0001');
      const { error } = await sb.from('place_routes').insert({ shop_id: s.shopId, from_place: from, to_place: to, km: Math.round(route.distance / 100) / 10, mins: Math.round(route.duration / 60), line: route.geometry });
      if (error && error.code !== '23505') await ok(Promise.resolve({ data: null, error }));
    },
    /** W14 store.html:2472 receiveTrip, each stop: the count rides on each line; an unanswered line counts as expected. */
    checkIn: async (lines: CheckInLine[]) => {
      const units = ((snap() || {}).units || []) as Row[];
      for (const id of [...new Set(lines.map((l) => l.trip))]) {
        const t = trip(id), mine = lines.filter((l) => l.trip === id);
        const p = (t.lines || []).map((l: Row, i: number) => {
          const c = mine.find((x) => x.idx === i), expect = l.gotQty != null && Number(l.gotQty) >= 0 ? Number(l.gotQty) : Number(l.qty) || 0;
          return { shop: c ? c.counted : expect, pack: shelfPackFor(units, l), ...(c && c.why ? { why: c.why } : {}) };
        });
        await ok(sb.rpc('receive_trip', { p_shop: s.shopId, p_trip: id, p_lines: p }));
      }
    },
    /** W15 store.html:2485 sendExtras. */
    notOnList: async (x: Extra) => {
      const photo = x.newItem && x.photo ? await upload(x.photo, 'extras') : null;
      await ask('extra', x.tripId, { tripId: x.tripId, supplierId: x.supplierId, key: x.key, productId: x.productId, variantIdx: x.variantIdx, name: x.name, qty: x.qty, unit: x.unit, why: x.why,
        ...(x.newItem ? { newItem: true, photo } : {}) });
    },
    /** W16 store.html:2496 sendRestock. */
    restock: (r: Restock) => ask('restock', r.key, { key: r.key, productId: r.productId, variantIdx: r.variantIdx, name: r.name, qty: r.qty, unit: r.unit, when: r.when, shortFor: r.shortFor }).then(() => undefined),
    /** W17 store.html:2509 sendReport. */
    reportLoss: async (r: Loss) => {
      const photo = r.photo ? await upload(r.photo, 'reports') : null;
      await ok(sb.from('stock_reports').insert({ shop_id: s.shopId, key: r.key, product_id: r.productId, variant_idx: r.variantIdx == null ? null : String(r.variantIdx),
        name: r.name, qty: r.qty, why: r.why, photo_path: photo, note: r.note || null, reported_by: s.userId, reported_by_name: s.name }));
    },
    /**
     * W18 store.html:2528 sendReturn: the database prices it; the photo path rides in the note (data D11).
     * r.gateAt is not sent: store_return_ask has no field for it, so the books show the sent time as at the gate.
     */
    returnAsk: async (r: ReturnAsk) => {
      const photo = r.photo ? await upload(r.photo, 'returns') : null;
      const note = [r.note.trim() || 'Brought back at the gate', photo ? 'photo: ' + photo : ''].filter(Boolean).join(' · ');
      await ok(sb.rpc('store_return_ask', { p_shop: s.shopId, p_order: r.orderId, p_lines: r.lines, p_reason: r.reason, p_note: note }));
    },
    /** W18a. */
    withdrawReturn: (id: string) => ok(sb.rpc('withdraw_invoice_ask', { p_id: id })).then(() => undefined),
    /** W19 store.html:2552 patchTripSnap: only gotQty and the status, the trip still this phone's. */
    rideTick: (id: string, got: Record<number, number | null>) => ok(sb.rpc('store_patch_trip', { p_shop: s.shopId, p_id: id, p_got: got, p_status: 'collecting' })).then(() => undefined),
    /** W19a store.html:2571 handInTrip, every stop. */
    rideHandIn: async (ids: string[]) => {
      for (const id of ids) {
        if (!(trip(id).lines || []).every((l: Row) => l.gotQty != null)) throw dataError('refused', 'Load every line first', 'P0001');
        await ok(sb.rpc('store_patch_trip', { p_shop: s.shopId, p_id: id, p_got: {}, p_status: 'collected' }));
      }
    },
    /** W20 store.html:2579 sendCount (W20a on a clash of the place). */
    sendCount: count,
    /** W20a store.html:2595. */
    replaceCount: (oldId: string, c: CountSend) => replace(oldId, c).then(() => undefined),
    /** W22 store.html:6223: the ask, then each half-packed order to the colleague. */
    passYard: async (p: PassYard) => {
      await ask('handover', p.toUserId || p.toStaffId, { toStaffId: p.toStaffId, toUserId: p.toUserId, toName: p.toName, orders: p.orders, waiting: p.waiting, bays: p.bays });
      for (const id of p.orders) await changeOrder(sb, s, id, null, (q) => { if (q.status !== 'preparing' || q.pickingStatus === 'done') return false; q.assignedWorkerId = p.toStaffId; return true; });
    },
    /** W22a store.html:6245. */
    gotYard: (id: string) => ok(sb.rpc('answer_store_ask', { p_id: id, p_status: 'accepted', p_note: null })).then(() => undefined),
    /** W23 store.html:6282: a line in Ruth's log. */
    closeYard: (c: CloseYard) => ask('close', new Date().toISOString().slice(0, 10), { out: c.out, trips: c.trips, carries: c.carries, shelved: c.shelved }).then(() => undefined),
    /** W24 store.html:3184. */
    setMyName: (name: string) => ok(sb.rpc('set_my_name', { p_shop: s.shopId, p_name: name.trim().slice(0, 60) })).then(() => undefined),
  };
}
