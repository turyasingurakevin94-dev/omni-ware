/*
 * The orders in the yard at 10:41 (FACTS §2), with Sales' numbers, customers, times
 * and lines unchanged. No money: the yard's orders carry no price, total or amount.
 *
 *   To pack 1 (#0556) · Packing now 1 (#0552, Musa) · Packed 1 (#0530, not paid yet)
 *   On the road 3 (#0534, #0547 with Ssali; #0555 ready to collect) · Delivered today 1 (#0543)
 *   Waiting on goods +2 (#0549, #0546) · #0557 the copy of #0556 (Look only) · #0548 Fri, a return asked
 */
import type { Ms } from '../../types.ts';
import { stockKey } from '../keys.ts';
import type { Carrier, YardLine, YardOrder, YardStatus } from '../types.ts';
import { DAY, item, t } from './shop.ts';

/** A line: our shelf unless a supplier is named. */
export function line(idx: number, pid: string, qty: number, o: Partial<YardLine> = {}): YardLine {
  const it = item(pid);
  return {
    idx, lineId: `${pid}-${idx}`, key: stockKey(pid, null), productId: pid, variantIdx: null, name: it.name, qty, unit: it.unit,
    packQty: it.packQty, packUnit: it.packUnit, qtyIn: 'unit', supplierId: '__stock__', clientWaits: false,
    pickStatus: null, pickedQty: null, receivedAt: null, receivedQty: null, dropped: false, ...o,
  };
}
const done = (l: YardLine): YardLine => ({ ...l, pickStatus: 'done', pickedQty: l.qty });

export function carrier(kind: Carrier['kind'], name: string, at: Ms, staffId: string | null = null, o: Partial<Carrier> = {}): Carrier {
  return { kind, name, what: '', phone: '', at, by: 'Musa Kiggundu', staffId, ...o };
}

/** An order with every field the yard reads, as the snapshot would give it. */
export function order(id: number, status: YardStatus, placedAt: Ms, o: Partial<YardOrder>): YardOrder {
  return {
    id, status, invoiced: false, invoicedAt: null, voided: false, date: DAY, client: { name: 'Walk-in', phone: '' }, customerId: null, lines: [],
    assignedWorkerId: null, pickingAssignedAt: null, workerAcceptedAt: null, pickingStatus: null, pickCursor: 0, pickingDoneAt: null, bay: null,
    carrier: null, assignedDeliveryId: null, stageEnteredAt: placedAt, stageLog: [{ status, at: placedAt }], deliveredTo: null, deliveredAt: null,
    deliveredPhoto: null, deliveredPhotoKind: null, deliveredNote: null, handoverCheckedAt: null, letGoAsk: null, letGo: null, agentSettled: false,
    deliveryMode: null, deliveryAddress: null, originAgentId: null, cancelledAt: null, cancelledByName: null, voidedAt: null, pickSettle: null,
    pickShortfallAckAt: null, takenBack: [], runDriver: null, takenBy: 'u-ga', createdAt: placedAt, savedAt: placedAt,
    deliverTo: '', deliverWhen: null, deliverPhone: null, counter: false, comingBack: null, moneyHold: false, copyOf: null, ...o,
  };
}

const kato = { client: { name: 'Kato Construction', phone: '0772 418 220' }, customerId: 'c-kato' };
const ggaba = { client: { name: 'Ggaba Stores', phone: '0782 330 917' }, customerId: 'c-ggaba' };
const nansana = { client: { name: 'Nansana Hardware', phone: '0752 610 044' }, customerId: 'c-nans' };

export function orders(): YardOrder[] {
  const ssali = carrier('staff', 'Ssali', t('9:55'), 'st-ss', { dueBack: t('12:10') });
  return [
    // Packing · Musa since 10:05: 40 pc packed 10:30, the wheelbarrows came on Denis's trip 10:05, the hinge dropped.
    order(552, 'preparing', t('9:14'), {
      ...kato, assignedWorkerId: 'st-mk', pickingAssignedAt: t('10:05'), workerAcceptedAt: t('10:05'), pickingStatus: 'in_progress', pickCursor: 1, bay: 1,
      stageEnteredAt: t('9:14'), stageLog: [{ status: 'draft', at: t('9:14') }, { status: 'awaiting_goods', at: t('9:31') }, { status: 'preparing', at: t('10:05') }], moneyHold: true, deliverTo: 'Ntinda site, Plot 12, Ntinda Rd', deliverWhen: 'today afternoon', deliverPhone: '0772 418 220', runDriver: 'st-ss', leavesAt: t('13:20'),
      lines: [
        done(line(0, 'p-is28', 40)),
        line(1, 'p-wb', 2, { supplierId: 's-owino', receivedAt: t('10:05'), receivedQty: 2, pickStatus: 'pending' }),
        line(2, 'p-sch', 10, { supplierId: 's-kiseka', dropped: true }),
      ],
    }),
    // Packed Thu 15 Oct, 2 days on bay 2, not paid yet: the late one.
    order(530, 'preparing', t('11:20', '2026-09-29'), {
      client: { name: 'Kyaligonza & Sons', phone: '0701 552 310' }, customerId: 'c-kyal', takenBy: 'u-bo', date: '2026-09-29',
      assignedWorkerId: 'st-op', pickingAssignedAt: t('14:00', '2026-10-15'), workerAcceptedAt: t('14:00', '2026-10-15'), pickingStatus: 'done',
      pickingDoneAt: t('15:30', '2026-10-15'), bay: 2, stageEnteredAt: t('9:00', '2026-10-15'), moneyHold: true, deliverTo: 'Bweyogerere',
      lines: [done(line(0, 'p-rc28', 10)), done(line(1, 'p-wn4', 1))],
    }),
    // To pack: all on our shelf, Checking and Buying skipped; they collect at the gate.
    order(556, 'preparing', t('10:02'), { ...nansana, deliverTo: '', lines: [line(0, 'p-cem', 2), line(1, 'p-wg', 1)] }),
    // The copy of #0556: Ruth is cancelling it. Look only.
    order(557, 'preparing', t('10:03'), { ...nansana, deliverTo: '', copyOf: 556, lines: [line(0, 'p-cem', 2), line(1, 'p-wg', 1)] }),
    // On the road with Ssali since 9:55.
    order(534, 'pending_delivery', t('8:05'), {
      ...kato, carrier: ssali, assignedDeliveryId: 'st-ss', pickingStatus: 'done', pickingDoneAt: t('9:40'), stageEnteredAt: t('9:55'),
      deliverTo: 'Ntinda site, Plot 12, Ntinda Rd', deliverPhone: '0772 418 220',
      lines: [done(line(0, 'p-cem', 10)), done(line(1, 'p-is28', 20)), done(line(2, 'p-wn4', 1))],
    }),
    order(547, 'pending_delivery', t('16:20', '2026-10-16'), {
      ...ggaba, takenBy: 'u-fn', carrier: ssali, assignedDeliveryId: 'st-ss', pickingStatus: 'done', pickingDoneAt: t('9:45'), stageEnteredAt: t('9:55'),
      date: '2026-10-16', deliverTo: 'Ggaba', lines: [done(line(0, 'p-rn', 5)), done(line(1, 'p-tg', 2))],
    }),
    // Ready to collect at the gate since 10:15, not paid yet (Grace takes payment 10:45, collected 10:47).
    order(555, 'pending_delivery', t('9:40'), {
      client: { name: 'Walk-in', phone: '0772 418 905' }, assignedWorkerId: 'st-mk', pickingStatus: 'done', pickingDoneAt: t('10:15'), stageEnteredAt: t('10:15'),
      moneyHold: true, deliverTo: '', lines: [done(line(0, 'p-rc28', 2))],
    }),
    // Delivered 8:50, collected; invoiced at the counter (Sales FACTS: sold today).
    order(543, 'completed', t('8:20'), {
      invoiced: true, invoicedAt: t('8:50'), carrier: carrier('client', 'Walk-in', t('8:50')), assignedDeliveryId: '__client__', pickingStatus: 'done',
      pickingDoneAt: t('8:45'), stageEnteredAt: t('8:50'), deliveredTo: 'Walk-in', deliveredAt: t('8:50'), handoverCheckedAt: t('8:50'),
      lines: [done(line(0, 'p-wn4', 1))],
    }),
    // Hired drivers used before (OU03): Abudu to Ntinda Tue, Juma Ssekitto to Ggaba Sat 3 Oct; invoiced, off the board.
    order(521, 'completed', t('9:00', '2026-10-13'), {
      ...kato, date: '2026-10-13', invoiced: true, invoicedAt: t('15:00', '2026-10-13'), pickingStatus: 'done', deliverTo: 'Ntinda site, Plot 12, Ntinda Rd',
      carrier: carrier('hired', 'Abudu', t('11:30', '2026-10-13'), null, { what: 'UAX 318K', phone: '0701 552 310' }), assignedDeliveryId: '__carrier__',
      deliveredTo: 'Kato Construction', deliveredAt: t('12:40', '2026-10-13'), deliveredPhoto: 'demo/0521.jpg', lines: [done(line(0, 'p-cem', 20))],
    }),
    order(498, 'completed', t('9:00', '2026-10-03'), {
      ...ggaba, date: '2026-10-03', invoiced: true, invoicedAt: t('15:00', '2026-10-03'), pickingStatus: 'done', deliverTo: 'Ggaba',
      carrier: carrier('hired', 'Juma Ssekitto', t('11:00', '2026-10-03'), null, { what: 'UBF 902C', phone: '0759 902 114' }), assignedDeliveryId: '__carrier__',
      deliveredTo: 'Ggaba Stores', deliveredAt: t('12:10', '2026-10-03'), deliveredPhoto: 'demo/0498.jpg', lines: [done(line(0, 'p-rn', 10))],
    }),
    // Waiting on goods: both in Buying, their lines on Denis's trip.
    order(549, 'awaiting_goods', t('8:15'), {
      ...ggaba, deliverTo: 'Ggaba', lines: [line(0, 'p-cn2', 4, { supplierId: 's-owino' }), line(1, 'p-em', 1, { supplierId: 's-kiseka' })],
    }),
    order(546, 'awaiting_goods', t('9:30', '2026-10-11'), {
      client: { name: 'Lubowa Builders', phone: '0774 120 556' }, customerId: 'c-lub', date: '2026-10-11', deliverTo: 'Lubowa',
      lines: [line(0, 'p-is30', 20, { supplierId: 's-kiseka' }), line(1, 'p-gb', 6, { supplierId: 's-kiseka', dropped: true })],
    }),
    // Fri: delivered and paid; Grace asked a return (2 of 3 bags torn), reaching the gate ~11:00 with Ssali.
    order(548, 'completed', t('9:10', '2026-10-16'), {
      ...ggaba, date: '2026-10-16', invoiced: true, invoicedAt: t('13:30', '2026-10-16'), carrier: carrier('staff', 'Ssali', t('12:40', '2026-10-16'), 'st-ss'),
      assignedDeliveryId: 'st-ss', pickingStatus: 'done', stageEnteredAt: t('13:30', '2026-10-16'), deliveredTo: 'Ggaba Stores', deliveredAt: t('13:30', '2026-10-16'),
      deliveredPhoto: 'demo/0548.jpg', deliverTo: 'Ggaba', lines: [done(line(0, 'p-cem', 3)), done(line(1, 'p-wg', 1))],
    }),
  ];
}
