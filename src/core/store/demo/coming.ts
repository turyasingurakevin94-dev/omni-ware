/*
 * What comes in, what comes back, the counts and the pushes at 10:41 (FACTS §3, §4, §6, §7).
 *
 *   Denis's trip · 2 suppliers   Owino (bought 9:50) and Kiseka (looking since 10:20), back ~11:30
 *   Denis's first trip           checked in 10:05 by Musa: 2 wheelbarrows for #0552
 *   Hima Cement · delivery       100 bag for the shelf, today 12:00 (the supplier brings it)
 *   #0548 return                 Grace asked Fri 15:40: 2 of 3 bags torn; at the gate ~11:00 with Ssali
 *   Counts                       aisle A accepted Thu 16:10 (Okello); Wire nails 4" 17 of 18, sent 9:21
 */
import type { Ms } from '../../types.ts';
import { stockKey } from '../keys.ts';
import type { StockCount, StoreReturn, Trip, TripLine, YardAlert } from '../types.ts';
import { item, t } from './shop.ts';

export function tripLine(idx: number, pid: string, qty: number, orderId: number | null, o: Partial<TripLine> = {}): TripLine {
  const it = item(pid);
  return { idx, orderId, key: stockKey(pid, null), productId: pid, variantIdx: null, name: it.name, qty, unit: it.unit, packQty: it.packQty, packUnit: it.packUnit, gotQty: null, notFound: false, ...o };
}

export function trip(id: string, supplierId: string, supplierName: string, runnerId: string, status: string, lines: TripLine[], o: Partial<Trip> = {}): Trip {
  return {
    id, supplierId, supplierName, status, runnerId, createdAt: t('8:40'), assignedAt: t('8:40'), acceptedAt: t('8:45'), collectedAt: null, confirmedAt: null,
    note: '', lines, voided: false, yardCheckedAt: null, yardCheckedBy: null, yardReceivedAt: null, differenceAcceptedAt: null, dueAt: null, ...o,
  };
}

export function trips(): Trip[] {
  return [
    // Denis's first trip, checked in by Musa at 10:05.
    trip('TRIP-1017A-1', 's-owino', 'Owino Hardware', 'st-do', 'collected', [tripLine(0, 'p-wb', 2, 552, { gotQty: 2 })], {
      createdAt: t('7:50'), collectedAt: t('9:58'), yardCheckedAt: t('10:05'), yardCheckedBy: 'u-mk', yardReceivedAt: t('10:05'),
    }),
    // Denis's trip, stop 1 of 2: bought at Owino Hardware 9:50.
    trip('TRIP-1017B-1', 's-owino', 'Owino Hardware', 'st-do', 'collecting', [tripLine(0, 'p-cn2', 4, 549, { gotQty: 4 })], { createdAt: t('9:20'), dueAt: t('11:30') }),
    // Stop 2 of 2: at Kiseka Steel since 10:20, looking. The gutter bracket is not found (Grace tells Lubowa).
    trip('TRIP-1017B-2', 's-kiseka', 'Kiseka Steel', 'st-do', 'collecting', [
      tripLine(0, 'p-em', 1, 549), tripLine(1, 'p-is30', 20, 546), tripLine(2, 'p-gb', 6, 546, { notFound: true, gotQty: 0 }),
    ], { createdAt: t('9:20'), dueAt: t('11:30') }),
    // The supplier brings it: Moses ordered it Fri.
    trip('TRIP-HIMA-1', 's-hima', 'Hima Cement', '__supplier__', 'assigned', [tripLine(0, 'p-cem', 100, null)], {
      createdAt: t('16:30', '2026-10-16'), assignedAt: t('16:30', '2026-10-16'), acceptedAt: null, dueAt: t('12:00'),
    }),
  ];
}

export function returns(): StoreReturn[] {
  return [{
    id: 'ret-0548', orderId: 548, lines: [{ idx: 0, name: 'Cement · Hima 50kg', unit: 'bag', qty: 2, shown: '2 bag', condition: 'damaged' }],
    reason: 'Torn bags', note: 'Grace: 2 of 3 bags came back torn', by: 'u-ga', byName: 'Grace Akello', status: 'sent', decidedAt: null, createdAt: t('15:40', '2026-10-16'), dueAt: t('11:00'),
  }];
}

export function counts(): StockCount[] {
  const wn4 = item('p-wn4'), is28 = item('p-is28');
  return [
    { id: 'cnt-a', aisle: 'Aisle A · Roofing', place: 'aisle:roofing', countedBy: 'u-op', countedByName: 'Okello Peter',
      lines: [{ key: 'p-is28', productId: 'p-is28', variantIdx: null, name: is28.name, counted: 412, system: 412, held: 0 }], missing: [],
      status: 'accepted', decidedAt: t('16:10', '2026-10-15'), createdAt: t('15:20', '2026-10-15') },
    { id: 'cnt-wn4', aisle: `Spot count · ${wn4.name}`, place: 'item:p-wn4', countedBy: 'u-mk', countedByName: 'Musa Kiggundu',
      lines: [{ key: 'p-wn4', productId: 'p-wn4', variantIdx: null, name: wn4.name, counted: 17, system: 18, held: 2 }], missing: [],
      status: 'sent', decidedAt: null, createdAt: t('9:21') },
  ];
}

const alert = (id: string, kind: string, at: Ms, fromId: string, text: string, data: Record<string, unknown>, forYou = false): YardAlert => ({ id, kind, at, fromId, text, data, forYou });

/** FACTS §7 and TD10: today's pushes (2 for you, 3 in the yard), and Fri's read one. */
export function alerts(): YardAlert[] {
  return [
    alert('al-1', 'order.pick', t('10:02'), 'u-ga', 'New to pack · #0556 Nansana · they collect', { orderId: 556 }),
    alert('al-2', 'trip.back', t('10:05'), 'u-do', 'Denis’s trip is back at the yard · 1 line', { tripId: 'TRIP-1017A-1' }),
    alert('al-3', 'order.copy', t('10:16'), 'u-rn', '#0557 is a copy · don’t pack it', { orderId: 557 }, true),
    alert('al-4', 'product.new', t('10:34'), 'u-ml', 'New item · Roof paint · maroon 20L · aisle F', { key: 'p-rp' }),
    alert('al-5', 'stock.count.sent', t('9:22'), 'u-rn', 'Your count of Wire nails 4" · Ruth is looking', { key: 'p-wn4' }, true),
    alert('al-6', 'order.moved', t('15:10', '2026-10-16'), 'u-rn', 'Ruth marked #0538 delivered', { orderId: 538, place: 'Nansana' }),
  ];
}
