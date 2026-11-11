/*
 * The demo's writes: each changes the sample yard as the server function it stands in
 * for would (data §3; store_patch_order's stage moves, receive_trip, store_asks …).
 * Plain mutations of the day; index.ts wraps each in the wait, the offline and the
 * &fail=… rules. A refusal is the server's words and code, as the real books give it.
 */
import { dataError } from '../../datasource.ts';
import type { CheckInLine, CloseYard, CountSend, DoorProof, Extra, Loss, PassYard, PickAnswer, Restock, ReturnAsk, CarrierPick } from '../source.ts';
import type { Carrier, StoreAsk, YardBooks, YardOrder } from '../types.ts';
import { isPickup } from '../yard.ts';

const MOVES: Record<string, string[]> = { preparing: ['pending_delivery', 'completed'], pending_delivery: ['completed'] };
let seq = 0;
const id = (p: string) => `${p}-${(++seq).toString(36)}`;

export function demoWrites(b: () => YardBooks, now: () => number, putBacks: Set<number>) {
  const me = () => b().me;
  const order = (oid: number): YardOrder => {
    const o = b().orders.find((x) => x.id === oid);
    if (!o) throw dataError('refused', 'That order is no longer on the books', 'P0002');
    return o;
  };
  const move = (o: YardOrder, status: YardOrder['status']) => {
    if (!(MOVES[o.status] || []).includes(status)) throw dataError('refused', 'That order has moved on', 'P0001');
    o.status = status; o.stageEnteredAt = now(); o.stageLog = [...o.stageLog, { status, at: now() }];
  };
  const carrierOf = (c: CarrierPick): Carrier => ({ ...c, at: now(), by: me().name });
  const asked = (kind: string, ref: string, payload: Record<string, unknown>): StoreAsk => {
    const a: StoreAsk = { id: id('ask'), kind, ref, payload, by: me().userId, byName: me().name, status: 'sent', createdAt: now(), decidedAt: null, decidedBy: null };
    b().asks.unshift(a);
    return a;
  };
  const answered = (o: YardOrder) => o.lines.every((l) => l.dropped || (!l.supplierId && l.clientWaits) || l.pickStatus === 'done' || l.pickStatus === 'short');
  const load = (o: YardOrder, c: CarrierPick) => {
    if (o.moneyHold) throw dataError('refused', 'Not paid yet', 'OWCSH');
    o.carrier = carrierOf(c);
    o.assignedDeliveryId = c.kind === 'staff' ? c.staffId : c.kind === 'hired' ? '__carrier__' : c.kind === 'agent' ? '__agent__' : '__client__';
    if (o.status === 'preparing') { o.pickingStatus = 'done'; o.pickingDoneAt = o.pickingDoneAt ?? now(); move(o, 'pending_delivery'); }
  };

  return {
    claim(oid: number) {
      const o = order(oid);
      if (o.status !== 'preparing' || o.pickingStatus === 'done') return;
      if (o.assignedWorkerId && o.assignedWorkerId !== me().id && o.pickingStatus === 'in_progress') throw dataError('clash', 'Someone else is packing it');
      if (o.pickingStatus === 'in_progress') return;
      o.assignedWorkerId = me().id; o.pickingAssignedAt = o.pickingAssignedAt ?? now(); o.workerAcceptedAt = now(); o.pickingStatus = 'in_progress';
      o.lines.forEach((l) => { if (l.pickStatus !== 'done' && l.pickStatus !== 'short' && !l.dropped) l.pickStatus = 'pending'; });
    },
    pick(oid: number, answers: PickAnswer[], cursor: number) {
      const o = order(oid);
      if (o.status !== 'preparing') throw dataError('refused', 'That order has moved on', 'P0001');
      answers.forEach((a) => { const l = o.lines[a.idx]; if (l) { l.pickStatus = a.status; l.pickedQty = a.status === 'done' ? l.qty : a.qty; } });
      o.pickCursor = cursor;
    },
    finishPack(oid: number, bay: number | null) {
      const o = order(oid);
      if (o.status !== 'preparing') return;
      if (!answered(o)) throw dataError('refused', 'Answer every line first', 'P0001');
      o.pickingStatus = 'done'; o.pickingDoneAt = now();
      if (bay) o.bay = bay;
      if (isPickup(o, b().customers)) move(o, 'pending_delivery');
    },
    setBay(oid: number, bay: number) { order(oid).bay = bay; },
    unpack(oid: number) {
      const o = order(oid);
      if (o.voided || o.status !== 'preparing' || o.pickingStatus !== 'done' || o.carrier) throw dataError('refused', 'It has left the yard', 'P0001');
      o.pickingStatus = 'in_progress'; o.pickingDoneAt = null; o.bay = null;
    },
    release(oid: number, putBack: boolean) {
      const o = order(oid);
      o.assignedWorkerId = null; o.workerAcceptedAt = null; o.pickingAssignedAt = null; o.pickingStatus = null;
      if (putBack) { o.lines.forEach((l) => { l.pickStatus = null; l.pickedQty = null; }); o.pickCursor = 0; }
    },
    putBack(oid: number) { order(oid); putBacks.add(oid); },
    load(ids: number[], c: CarrierPick) { ids.forEach((x) => { const o = order(x); if (o.status === 'preparing') load(o, c); }); },
    handOver(oid: number, name: string, agent: boolean) {
      const o = order(oid);
      if (o.status !== 'preparing' && o.status !== 'pending_delivery') throw dataError('refused', 'That order has moved on', 'P0001');
      if (o.moneyHold) throw dataError('refused', 'Not paid yet', 'OWCSH');
      const c: CarrierPick = { kind: agent ? 'agent' : 'client', name, what: '', phone: '', staffId: null };
      if (o.status === 'preparing') load(o, c);
      else if (!o.carrier) { o.carrier = carrierOf(c); o.assignedDeliveryId = agent ? '__agent__' : '__client__'; }
      o.handoverCheckedAt = now(); o.deliveredTo = name.trim().slice(0, 80) || null; o.deliveredAt = now();
      move(o, 'completed');
    },
    deliver(oid: number, p: DoorProof) {
      const o = order(oid);
      if (o.status !== 'pending_delivery') throw dataError('refused', 'That order has moved on', 'P0001');
      o.deliveredTo = p.to.trim().slice(0, 80) || null; o.deliveredAt = now(); o.deliveredPhoto = p.photo ? `demo/${oid}-door.jpg` : null;
      if (p.kind === 'note') o.deliveredPhotoKind = 'note';
      if (!p.photo && p.kind === 'none') { o.deliveredPhotoKind = 'none'; o.deliveredNote = String(p.note || '').slice(0, 200); }
      o.comingBack = null;
      move(o, 'completed');
    },
    cantDeliver(oid: number, why: string) {
      const o = order(oid);
      if (o.status !== 'pending_delivery') throw dataError('refused', 'That order has moved on', 'P0001');
      o.comingBack = { why, at: now(), by: me().userId, byName: me().name };
    },
    askLetGo(oid: number, c: CarrierPick | null) { const o = order(oid); o.letGoAsk = { at: now(), by: me().userId, byName: me().name, answer: null }; if (c) o.runDriver = c.staffId; },
    withdrawLetGo(oid: number) { order(oid).letGoAsk = null; },
    nameDirection(_key: string, name: string) { if (!name.trim()) throw dataError('refused', 'Give it a name', 'P0001'); },
    lockRoute() { /* the demo has no map server: the road is kept as drawn */ },
    checkIn(lines: CheckInLine[]) {
      const at = now(), ids = [...new Set(lines.map((l) => l.trip))];
      ids.forEach((tid) => {
        const tr = b().trips.find((x) => x.id === tid);
        if (!tr) throw dataError('refused', 'That trip is gone', 'P0002');
        if (tr.yardCheckedAt) throw dataError('clash', 'Someone else checked it in');
        tr.lines.forEach((l) => {
          const c = lines.find((x) => x.trip === tid && x.idx === l.idx), got = c ? c.counted : l.gotQty ?? l.qty;
          const it = b().items.find((x) => x.key === l.key);
          if (it) it.books += got;
          const o = l.orderId != null ? b().orders.find((x) => x.id === l.orderId) : null, ol = o && o.lines.find((x) => x.productId === l.productId && !x.dropped);
          if (ol && got > 0) { ol.receivedAt = at; ol.receivedQty = got; }
        });
        tr.status = 'collected'; tr.yardCheckedAt = at; tr.yardCheckedBy = me().userId; tr.yardReceivedAt = at;
      });
      b().orders.filter((o) => o.status === 'awaiting_goods' && !o.lines.some((l) => l.supplierId !== '__stock__' && !l.dropped && !l.receivedAt))
        .forEach((o) => { o.status = 'preparing'; o.stageEnteredAt = at; o.stageLog = [...o.stageLog, { status: 'preparing', at }]; });
    },
    notOnList(x: Extra) { asked('extra', x.tripId, { ...x, photo: x.photo ? 'demo/extra.jpg' : null }); },
    returnAsk(r: ReturnAsk) {
      order(r.orderId);
      b().returns.unshift({ id: id('ret'), orderId: r.orderId, lines: r.lines, reason: r.reason, note: r.note, by: me().userId, byName: me().name, status: 'sent', decidedAt: null, createdAt: now() });
    },
    withdrawReturn(rid: string) { const r = b().returns.find((x) => x.id === rid && x.by === me().userId); if (!r) throw dataError('refused', 'Not your return', 'P0001'); r.status = 'withdrawn'; },
    rideTick(tid: string, got: Record<number, number | null>) {
      const tr = b().trips.find((x) => x.id === tid);
      if (!tr || tr.runnerId !== me().id) throw dataError('refused', 'That trip is not yours any more', 'P0001');
      Object.entries(got).forEach(([k, v]) => { const l = tr.lines[Number(k)]; if (l) l.gotQty = v; });
      tr.status = 'collecting'; tr.acceptedAt = tr.acceptedAt ?? now();
    },
    rideHandIn(ids: string[]) {
      ids.forEach((tid) => {
        const tr = b().trips.find((x) => x.id === tid);
        if (!tr) throw dataError('refused', 'That trip is gone', 'P0002');
        if (!tr.lines.every((l) => l.gotQty != null)) throw dataError('refused', 'Load every line first', 'P0001');
        tr.status = 'collected'; tr.collectedAt = now();
      });
    },
    restock(r: Restock) { asked('restock', r.key, { ...r }); },
    reportLoss(r: Loss) {
      b().reports.unshift({ id: id('rep'), key: r.key, productId: r.productId, variantIdx: r.variantIdx, name: r.name, qty: r.qty, why: r.why, photo: r.photo ? 'demo/report.jpg' : null,
        by: me().userId, byName: me().name, status: 'sent', decidedAt: null, createdAt: now() });
    },
    sendCount(c: CountSend) {
      const place = c.aisle.startsWith('Spot count') ? 'item:' + (c.lines[0] ? c.lines[0].key : '') : 'aisle:' + c.aisle.split(' · ')[1]?.toLowerCase();
      const open = b().counts.find((x) => x.status === 'sent' && x.place === place);
      if (open) open.status = 'replaced';
      b().counts.unshift({ id: id('cnt'), ...c, place, countedBy: me().userId, countedByName: me().name, status: 'sent', decidedAt: null, createdAt: now() });
    },
    replaceCount(oldId: string, c: CountSend) {
      const old = b().counts.find((x) => x.id === oldId);
      if (old && old.status === 'sent') old.status = 'replaced';
      b().counts.unshift({ id: id('cnt'), ...c, place: old ? old.place : null, countedBy: me().userId, countedByName: me().name, status: 'sent', decidedAt: null, createdAt: now() });
    },
    passYard(p: PassYard) {
      asked('handover', p.toUserId || p.toStaffId, { ...p });
      p.orders.forEach((x) => { const o = order(x); if (o.status === 'preparing' && o.pickingStatus !== 'done') o.assignedWorkerId = p.toStaffId; });
    },
    gotYard(aid: string) { const a = b().asks.find((x) => x.id === aid); if (!a) throw dataError('refused', 'That ask is gone', 'P0002'); a.status = 'accepted'; a.decidedAt = now(); a.decidedBy = me().userId; },
    closeYard(c: CloseYard) { asked('close', new Date(now()).toISOString().slice(0, 10), { ...c }); },
    setMyName(name: string) { if (!name.trim()) throw dataError('refused', 'Write your name', 'P0001'); me().name = name.trim(); },
  };
}
