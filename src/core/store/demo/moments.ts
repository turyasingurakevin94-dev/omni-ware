/*
 * The sample day, built: 10:41 from FACTS, then the later moments and the what-ifs
 * the boards draw (FACTS §8; flags.ts lists them). A moment is what the yard would
 * hold by then if each job before it had been done as the boards draw it; a what-if
 * changes only what it names. Gaps FACTS leaves (when #0534 was delivered, what was
 * left by 17:30) are filled as plainly as the boards allow and named here.
 */
import type { YardBooks, YardOrder } from '../types.ts';
import { alerts, counts, returns, trip, tripLine, trips } from './coming.ts';
import type { StoreDemoFlags } from './flags.ts';
import { carrier, line, order, orders } from './orders.ts';
import { AISLES, NOW, agents, customers, items, people, suppliers, t } from './shop.ts';
import { shelfAt } from './shelf.ts';

const byId = (b: YardBooks, id: number): YardOrder => {
  const o = b.orders.find((x) => x.id === id);
  if (!o) throw new Error('No sample order ' + id);
  return o;
};
const stamp = (o: YardOrder, status: YardOrder['status'], at: number) => { o.status = status; o.stageEnteredAt = at; o.stageLog = [...o.stageLog, { status, at }]; };
const deliver = (o: YardOrder, to: string, at: number, collected: boolean) => {
  if (collected && !o.carrier) { o.carrier = carrier('client', to, at); o.assignedDeliveryId = '__client__'; o.handoverCheckedAt = at; }
  o.deliveredTo = to; o.deliveredAt = at; o.moneyHold = false; o.pickingStatus = 'done'; o.pickingDoneAt = o.pickingDoneAt ?? at;
  if (!collected) o.deliveredPhoto = `demo/${o.id}.jpg`;
  stamp(o, 'completed', at);
};
/** A trip's lines all in at the yard (receive_trip): on the shelf, the orders' lines received, an order all in to Packing. */
function checkIn(b: YardBooks, ids: string[], at: number): void {
  b.trips.filter((x) => ids.includes(x.id)).forEach((tr) => {
    tr.status = 'collected'; tr.collectedAt = tr.collectedAt ?? at; tr.yardCheckedAt = at; tr.yardCheckedBy = b.me.userId; tr.yardReceivedAt = at;
    tr.lines.forEach((l) => {
      const got = l.gotQty ?? l.qty;
      l.yardQty = got;
      const it = b.items.find((x) => x.key === l.key);
      if (it) it.books += got;
      const o = l.orderId != null ? b.orders.find((x) => x.id === l.orderId) : null;
      const ol = o && o.lines.find((x) => x.productId === l.productId && !x.dropped);
      if (ol && got > 0) { ol.receivedAt = at; ol.receivedQty = got; }
    });
  });
  b.orders.filter((o) => o.status === 'awaiting_goods' && !o.lines.some((l) => l.supplierId !== '__stock__' && !l.dropped && !l.receivedAt)).forEach((o) => stamp(o, 'preparing', at));
}

/** 10:41 exactly as FACTS draws it. */
export function baseDay(): YardBooks {
  const ps = people();
  return {
    shopName: 'Mukasa Hardware', at: t('7:52'), me: ps[0], onSince: t('7:30'), people: ps, orders: orders(), trips: trips(), returns: returns(),
    counts: counts(), reports: [], asks: [], items: items(), log: [], aisles: AISLES.slice(), bays: 4, customers: customers(), suppliers: suppliers(),
    agents: agents(), alerts: alerts(),
    // FACTS §4: 3 pc bent found at 10:20 while packing #0552, not reported yet (TD01's "Bent · Iron sheet G28").
    found: [{ key: 'p-is28', name: 'Iron sheet G28 · 3m', qty: 3, unit: 'pc', why: 'damaged', word: 'Bent', at: t('10:20'), by: 'u-mk' }],
  };
}

/** The later moments, in order: each one includes the ones before it. */
const STEPS: [number, (b: YardBooks) => void][] = [
  [1047, (b) => { const o = byId(b, 555); o.moneyHold = false; o.paidAt = t('10:45'); o.paidBy = 'u-ga'; }],
  // #0552 packed 10:52 (the wheelbarrows on), still not paid: To load (OU01).
  [1052, (b) => {
    const o = byId(b, 552);
    o.lines[1] = { ...o.lines[1], pickStatus: 'done', pickedQty: 2 };
    o.pickingStatus = 'done'; o.pickingDoneAt = t('10:52');
  }],
  [1130, (b) => {
    deliver(byId(b, 555), 'Walk-in', t('10:47'), true);
    deliver(byId(b, 534), 'Kato Construction', t('10:58'), false);
    // #0552's wheelbarrows packed at 10:52 (its pickingDoneAt below): on bay 1, Not paid yet until 13:20 (TD02's To load 2).
    const k = byId(b, 552);
    k.lines[1] = { ...k.lines[1], pickStatus: 'done', pickedQty: 2 };
    k.pickingStatus = 'done'; k.pickingDoneAt = t('10:52');
    b.trips.filter((x) => x.id.startsWith('TRIP-1017B-')).forEach((x) => { x.status = 'collected'; x.collectedAt = t('11:30'); x.lines.forEach((l) => { if (l.gotQty == null) l.gotQty = l.qty; }); });
  }],
  [1200, (b) => {
    checkIn(b, ['TRIP-1017B-1', 'TRIP-1017B-2'], t('11:34'));
    deliver(byId(b, 547), 'Ggaba Stores', t('11:20'), false);
    const n = byId(b, 556);
    n.lines.forEach((l) => { l.pickStatus = 'done'; l.pickedQty = l.qty; });
    deliver(n, 'Nansana Hardware', t('11:10'), true);
    const h = b.trips.find((x) => x.id === 'TRIP-HIMA-1');
    if (h) { h.status = 'collected'; h.collectedAt = t('12:00'); }
  }],
  // Grace takes Kato's money 13:12; Ssali is back; the run waits to load (OU02–OU07, OU17).
  [1315, (b) => { const o = byId(b, 552); o.moneyHold = false; o.paidAt = t('13:12'); o.paidBy = 'u-ga'; }],
  [1405, (b) => {
    checkIn(b, ['TRIP-HIMA-1'], t('12:10'));
    const o = byId(b, 552);
    o.lines[1] = { ...o.lines[1], pickStatus: 'done', pickedQty: 2 };
    o.pickingStatus = 'done'; o.pickingDoneAt = t('10:52'); o.moneyHold = false;
    o.carrier = carrier('staff', 'Ssali', t('13:20'), 'st-ss'); o.assignedDeliveryId = 'st-ss';
    stamp(o, 'pending_delivery', t('13:20'));
  }],
  [1510, (b) => {
    // By 15:10 (TD03: 3 ready) the three jobs TD01 still lists are done, and stay done at 17:30: the bent sheets reported
    // 10:50 (Ruth wrote them off 12:30), #0548's return taken back 11:40, and aisle C counted, with Ruth since 14:40.
    b.reports.unshift({ id: 'rep-bent', key: 'p-is28', productId: 'p-is28', variantIdx: null, name: 'Iron sheet G28 · 3m', qty: 3, why: 'damaged', photo: 'demo/report.jpg',
      by: 'u-mk', byName: 'Musa Kiggundu', status: 'written_off', decidedAt: t('12:30'), createdAt: t('10:50') });
    b.counts.unshift({ id: 'cnt-c', aisle: 'Aisle C · Fasteners', place: 'aisle:fasteners', countedBy: 'u-mk', countedByName: 'Musa Kiggundu', lines: [], missing: [],
      status: 'sent', decidedAt: null, createdAt: t('14:40') });
    const r = b.returns.find((x) => x.id === 'ret-0548');
    if (r) { r.status = 'accepted'; r.decidedAt = t('11:40'); }
    deliver(byId(b, 552), 'Kato Construction', t('14:05'), false);
    b.orders.push(order(559, 'awaiting_goods', t('13:50'), {
      client: { name: 'Lubowa Builders', phone: '0774 120 556' }, customerId: 'c-lub', deliverTo: 'Lubowa', lines: [line(0, 'p-tim', 10, { supplierId: 's-katwe' })],
    }));
    b.trips.push(trip('TRIP-1017C-1', 's-katwe', 'Katwe Timber', 'st-mk', 'assigned', [tripLine(0, 'p-tim', 10, 559)], {
      createdAt: t('15:10'), assignedAt: t('15:10'), acceptedAt: null, note: 'Hassan drives', dueAt: t('16:00'),
    }));
  }],
  [1730, (b) => {
    checkIn(b, ['TRIP-1017C-1'], t('16:10'));
    [549, 546, 559].forEach((id, i) => {
      const o = byId(b, id);
      o.lines.forEach((l) => { if (!l.dropped) { l.pickStatus = 'done'; l.pickedQty = l.receivedQty ?? l.qty; } });
      o.carrier = carrier('staff', 'Ssali', t('16:20'), 'st-ss'); o.assignedDeliveryId = 'st-ss';
      deliver(o, o.client.name, t(['16:40', '16:55', '17:10'][i]), false);
    });
  }],
];

/** The what-ifs, each changing only what it names. */
function whatIf(b: YardBooks, f: StoreDemoFlags): void {
  switch (f.state) {
    case 'cancel-0530': { const o = byId(b, 530); o.cancelledAt = t('10:38'); o.cancelledByName = 'Ruth Nakato'; stamp(o, 'cancelled', t('10:38')); break; }
    case 'cancel-0534': { const o = byId(b, 534); o.cancelledAt = t('10:39'); o.cancelledByName = 'Ruth Nakato'; stamp(o, 'cancelled', t('10:39')); break; }
    case 'ggaba-closed': byId(b, 547).comingBack = { why: 'Closed', at: t('10:40'), by: 'u-mk', byName: 'Musa Kiggundu' }; break;
    case 'agent':
      b.orders.push(order(554, 'pending_delivery', t('9:50'), {
        client: { name: 'Peter Sserwadda', phone: '0772 554 554' }, deliveryMode: 'agent_pickup', originAgentId: 'a-ps', agentSettled: true, takenBy: 'u-ga',
        assignedWorkerId: 'st-op', pickingStatus: 'done', pickingDoneAt: t('10:20'), stageEnteredAt: t('10:20'), deliverTo: '',
        lines: [{ ...line(0, 'p-wg', 4), pickStatus: 'done', pickedQty: 4 }],
      }));
      break;
    case 'empty': case 'first-day':
      b.orders = []; b.trips = []; b.returns = []; b.counts = b.counts.filter((c) => c.status === 'accepted'); b.alerts = []; b.found = [];
      // Nothing waits: every aisle counted yesterday (no count due either).
      b.items.forEach((i) => { i.countedAt = t('16:00', '2026-10-16'); });
      break;
    case 'extra-answered':
      // Musa asked about a roll of binding wire not on Denis's list at 11:33; Ruth kept it at 11:48 (IN13).
      b.asks.unshift({ id: 'ask-bw', kind: 'extra', ref: 'TRIP-1017B-2', by: 'u-mk', byName: 'Musa Kiggundu', status: 'accepted', createdAt: t('11:33'), decidedAt: t('11:48'), decidedBy: 'u-rn',
        payload: { tripId: 'TRIP-1017B-2', supplierId: 's-kiseka', key: 'p-bw', productId: 'p-bw', variantIdx: null, name: 'Binding wire 20kg', qty: 1, unit: 'roll', why: 'Sent by mistake' } });
      break;
    case 'return-decided': {
      // Musa checked #0548's bags at the gate 11:02, sent 11:03; Ruth took them back 11:20 (IN22).
      const g = b.returns.find((x) => x.id === 'ret-0548');
      b.returns.unshift({ id: 'ret-0548-mk', orderId: 548, lines: [{ idx: 0, name: 'Cement · Hima 50kg', unit: 'bag', qty: 2, shown: '2 bag', condition: 'damaged' }],
        reason: 'Damaged', note: g ? g.note : '', by: 'u-mk', byName: 'Musa Kiggundu', status: 'accepted', decidedAt: t('11:20'), createdAt: t('11:03') });
      break;
    }
    case 'for-you': {
      const o = byId(b, 556); o.assignedWorkerId = 'st-mk'; o.pickingAssignedAt = t('10:40');
      b.alerts.unshift({ id: 'al-fy', kind: 'order.pick', at: t('10:40'), fromId: 'u-rn', text: 'Ruth gave you #0556 to pack', data: { orderId: 556 }, forYou: true });
      break;
    }
    // Nobody else with a yard login is on: Joy is off, and Okello has no login on this day (TD24 lists only Joy and Hassan).
    case 'nobody': b.people = b.people.filter((p) => p.id !== 'st-op'); b.people.filter((p) => p.id === 'st-jn').forEach((p) => { p.away = true; }); break;
    default: break;
  }
}

/** &state=okello-0556: Okello took #0556 at 10:43 and packed the cement at 10:44 (PK13, PK17). */
export function okelloTakes0556(b: YardBooks): void {
  const o = byId(b, 556);
  o.assignedWorkerId = 'st-op'; o.pickingAssignedAt = t('10:43'); o.workerAcceptedAt = t('10:43'); o.pickingStatus = 'in_progress'; o.pickCursor = 1;
  o.lines[0] = { ...o.lines[0], pickStatus: 'done', pickedQty: o.lines[0].qty };
  o.lines[1] = { ...o.lines[1], pickStatus: 'pending' };
  o.stageLog = [...o.stageLog, { status: 'preparing', at: t('10:44') }];
}

/** The day at the flags' moment, from the phone of the flags' person. */
export function dayAt(f: StoreDemoFlags): { books: YardBooks; now: number } {
  const b = baseDay();
  STEPS.filter(([at]) => at <= f.at).forEach(([, fn]) => fn(b));
  whatIf(b, f);
  if (f.state === 'first-day') {
    const joy = b.people.find((p) => p.id === 'st-jn') as YardBooks['me'];
    joy.away = false; b.me = joy; b.onSince = t('7:55');
  }
  if (f.as === 'okello') {
    const op = b.people.find((p) => p.id === 'st-op') as YardBooks['me'];
    b.me = op; b.onSince = t('7:45');
    b.asks.push({ id: 'ask-ho', kind: 'handover', ref: 'u-op', payload: { toStaffId: 'st-op', toUserId: 'u-op', toName: 'Okello Peter', orders: [552], waiting: 4, bays: [1] },
      by: 'u-mk', byName: 'Musa Kiggundu', status: 'sent', createdAt: t('10:42'), decidedAt: null, decidedBy: null });
    // W22 moved Musa's half-packed #0552 to Okello (his name on it, the picks kept; screens Q19).
    b.orders.filter((o) => o.id === 552).forEach((o) => { o.assignedWorkerId = 'st-op'; });
  }
  // Whoever holds the phone is 'me' (navy); the rest keep their tints (Grace is navy on every canvas, FACTS §1; Musa slate off his phone).
  b.people.forEach((p) => { if (p !== b.me && p.id === 'st-mk') p.tint = 't4'; });
  b.me.tint = 'me';
  const hm = String(f.at).padStart(4, '0');
  const now = f.at === 1041 ? NOW : t(`${hm.slice(0, 2)}:${hm.slice(2)}`);
  shelfAt(b, f, now);
  return { books: b, now };
}
