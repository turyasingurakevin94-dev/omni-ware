/*
 * The one place a Store snapshot row becomes the app's shape (store.html:1106–1167
 * rowToTrip, rowToQuote, rowToReport, rowToReturn, rowToCount, rowToAsk; data §1b, §2).
 * Every key is the server's (store_snapshot / store_live, 0164 0166 0168, the allow-list
 * of 0182); no money key reaches here, and none is read. A dropped line (droppedLines)
 * follows the order's own lines; a cancelled order put back (putBack) leaves the day.
 */
import { initials, personName, tintFor } from '../../names.ts';
import { roleName } from '../../supabase/rows.ts';
import type { Row } from '../../supabase/client.ts';
import type { Role } from '../../types.ts';
import { countPlace, msOf, stockKey } from '../keys.ts';
import { putAway } from '../yard.ts';
import type { Carrier, ShelfItem, StockCount, StockReport, StoreAsk, StoreReturn, StoreSession, Trip, TripLine, YardBooks, YardLine, YardOrder, YardPerson } from '../types.ts';

/** The snapshot as read: the raw keys, kept so a write can send what the phone saw (p_expect). */
export type Snap = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const num = (v: unknown, d = 0): number => (v == null || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));
const str = (v: unknown): string => (v == null ? '' : String(v));
const strOrNull = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const vi = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
const unit = (v: unknown): string => str(v).trim().toLowerCase();

function lineOf(it: Row, idx: number): YardLine {
  const pid = str(it.productId), v = vi(it.variantIdx);
  return {
    idx, lineId: strOrNull(it.lineId), key: stockKey(pid, v), productId: pid, variantIdx: v, name: str(it.productName),
    qty: num(it.qty), unit: unit(it.unit), packQty: num(it.packQty, 1), packUnit: unit(it.packUnit), qtyIn: it.qtyIn === 'pack' ? 'pack' : 'unit',
    supplierId: strOrNull(it.supplierId), clientWaits: !!it.clientWaits,
    pickStatus: it.pickStatus === 'pending' || it.pickStatus === 'done' || it.pickStatus === 'short' ? it.pickStatus : null,
    pickedQty: it.pickedQty == null ? null : num(it.pickedQty), receivedAt: msOf(it.receivedAt), receivedQty: it.receivedQty == null ? null : num(it.receivedQty),
    dropped: false,
  };
}

/** A line taken off the order (payload.droppedLines, 0182): after the order's own lines, struck through. */
function droppedOf(d: Row, idx: number): YardLine {
  return { ...lineOf({ ...d, lineId: null }, idx), dropped: true, droppedWhy: strOrNull(d.reason) };
}

function carrierOf(c: Row | null | undefined): Carrier | null {
  if (!c || typeof c !== 'object') return null;
  const kind = c.kind === 'hired' || c.kind === 'client' || c.kind === 'agent' ? c.kind : 'staff';
  return { kind, name: str(c.name), what: str(c.what), phone: str(c.phone), at: msOf(c.at), by: strOrNull(c.by), staffId: strOrNull(c.staffId) };
}

/** An order row (id, status, invoiced, invoiced_ts, voided, date, client_name, client_phone, payload). */
export function orderOf(q: Row, holds: Row): YardOrder {
  const p: Row = q.payload || {};
  const ask = p.letGoAsk && typeof p.letGoAsk === 'object' ? p.letGoAsk : null;
  const back = p.comingBack && typeof p.comingBack === 'object' ? p.comingBack : null;
  return {
    id: num(q.id), status: q.status || 'draft', invoiced: !!q.invoiced, invoicedAt: msOf(q.invoiced_ts), voided: !!q.voided, date: str(q.date),
    client: { name: str(q.client_name) || 'Walk-in', phone: str(q.client_phone) }, customerId: strOrNull(p.customerId),
    lines: (Array.isArray(p.items) ? p.items : []).map((it: Row, i: number) => lineOf(it || {}, i))
      .concat((Array.isArray(p.droppedLines) ? p.droppedLines : []).map((d: Row, i: number) => droppedOf(d || {}, (Array.isArray(p.items) ? p.items.length : 0) + i))),
    assignedWorkerId: strOrNull(p.assignedWorkerId), pickingAssignedAt: msOf(p.pickingAssignedAt), workerAcceptedAt: msOf(p.workerAcceptedAt),
    pickingStatus: p.pickingStatus === 'in_progress' || p.pickingStatus === 'done' ? p.pickingStatus : null, pickCursor: num(p.pickCursor),
    pickingDoneAt: msOf(p.pickingDoneAt), bay: p.bay == null || p.bay === '' ? null : num(p.bay), carrier: carrierOf(p.carrier),
    assignedDeliveryId: strOrNull(p.assignedDeliveryId), stageEnteredAt: msOf(p.stageEnteredAt),
    stageLog: (Array.isArray(p.stageLog) ? p.stageLog : []).map((x: Row) => ({ status: x.status, at: msOf(x.at) || 0 })),
    deliveredTo: strOrNull(p.deliveredTo), deliveredAt: msOf(p.deliveredAt), deliveredPhoto: strOrNull(p.deliveredPhoto),
    deliveredPhotoKind: p.deliveredPhotoKind === 'note' || p.deliveredPhotoKind === 'none' ? p.deliveredPhotoKind : null,
    deliveredNote: strOrNull(p.deliveredNote), handoverCheckedAt: msOf(p.handoverCheckedAt),
    letGoAsk: ask && ask.at ? { at: msOf(ask.at) || 0, by: strOrNull(ask.by), byName: str(ask.byName), answer: ask.answer ? { decision: str(ask.answer.decision), at: msOf(ask.answer.at) } : null } : null,
    letGo: p.letGo && typeof p.letGo === 'object' ? { decision: str(p.letGo.decision), at: msOf(p.letGo.at) } : null,
    agentSettled: !!p.agentSettled, deliveryMode: strOrNull(p.deliveryMode), deliveryAddress: strOrNull(p.deliveryAddress), originAgentId: strOrNull(p.originAgentId),
    cancelledAt: msOf(p.cancelledAt), cancelledByName: strOrNull(p.cancelledByName), voidedAt: msOf(p.voidedAt),
    pickSettle: p.pickSettle && typeof p.pickSettle === 'object' ? { pick: str(p.pickSettle.pick), at: msOf(p.pickSettle.at), lines: (p.pickSettle.lines || []).map((l: Row) => ({ idx: num(l.idx), picked: num(l.picked), ordered: num(l.ordered) })) } : null,
    pickShortfallAckAt: msOf(p.pickShortfallAckAt),
    takenBack: (Array.isArray(p.takenBack) ? p.takenBack : []).map((cn: Row) => ({ askId: strOrNull(cn.askId), voided: !!cn.voided, restocked: !!cn.restocked,
      lines: (Array.isArray(cn.lines) ? cn.lines : []).map((l: Row) => ({ idx: num(l.idx), qty: num(l.qty), restocked: l.restocked == null ? null : !!l.restocked })) })),
    runDriver: strOrNull(p.runDriver), takenBy: strOrNull(p.takenBy), createdAt: msOf(p.createdAt), savedAt: msOf(p.savedAt),
    deliverTo: p.deliverTo == null ? null : str(p.deliverTo), deliverWhen: strOrNull(p.deliverWhen), deliverPhone: strOrNull(p.deliverPhone),
    counter: !!p.counter, comingBack: back && back.at ? { why: str(back.why), at: msOf(back.at) || 0, by: strOrNull(back.by), byName: str(back.byName) } : null,
    putBack: p.putBack && typeof p.putBack === 'object' ? { at: msOf(p.putBack.at) || 0, by: strOrNull(p.putBack.by), byName: str(p.putBack.byName),
      lines: (Array.isArray(p.putBack.lines) ? p.putBack.lines : []).map((l: Row) => ({ idx: num(l.idx), qty: num(l.qty) })) } : null,
    moneyHold: !!(holds && holds[String(q.id)]), copyOf: null,
  };
}

function tripLineOf(l: Row, idx: number): TripLine {
  const pid = strOrNull(l.productId), v = vi(l.variantIdx);
  return {
    idx, orderId: l.orderId == null || l.orderId === '' ? null : num(l.orderId), key: pid ? stockKey(pid, v) : '', productId: pid, variantIdx: v,
    name: str(l.productName || l.name), qty: num(l.qty), unit: unit(l.unit), packQty: num(l.packQty, 1), packUnit: unit(l.packUnit),
    gotQty: l.gotQty == null || !Number.isFinite(Number(l.gotQty)) || Number(l.gotQty) < 0 ? null : Number(l.gotQty), notFound: !!l.notFound,
  };
}

export function tripOf(r: Row, suppliers: Row[]): Trip {
  const s = suppliers.find((x) => String(x.id) === String(r.supplier_id));
  return {
    id: str(r.id), supplierId: strOrNull(r.supplier_id), supplierName: str(s && s.name), status: str(r.status), runnerId: strOrNull(r.assigned_worker_id),
    createdAt: msOf(r.created_at), assignedAt: msOf(r.assigned_at), acceptedAt: msOf(r.accepted_at), collectedAt: msOf(r.collected_at), confirmedAt: msOf(r.confirmed_at),
    note: str(r.note), lines: (Array.isArray(r.lines) ? r.lines : []).map((l: Row, i: number) => tripLineOf(l || {}, i)), voided: !!r.voided,
    yardCheckedAt: msOf(r.yard_checked_at), yardCheckedBy: strOrNull(r.yard_checked_by), yardReceivedAt: msOf(r.yard_received_at),
    differenceAcceptedAt: msOf(r.difference_accepted_at), dueAt: null,
  };
}

export function returnOf(r: Row): StoreReturn {
  return { id: str(r.id), orderId: num(r.quote_id), lines: Array.isArray(r.lines) ? r.lines : [], reason: str(r.reason), note: str(r.note),
    by: strOrNull(r.asked_by), byName: str(r.asked_by_name), status: str(r.status), decidedAt: msOf(r.decided_at), createdAt: msOf(r.created_at) || 0 };
}

export function countOf(c: Row): StockCount {
  const lines = Array.isArray(c.lines) ? c.lines : [];
  return { id: str(c.id), aisle: str(c.aisle), place: c.place || countPlace(c.aisle, lines.map((l: Row) => l && l.key)), countedBy: strOrNull(c.counted_by),
    countedByName: str(c.counted_by_name), lines, missing: Array.isArray(c.missing) ? c.missing : [], status: str(c.status), decidedAt: msOf(c.decided_at), createdAt: msOf(c.created_at) || 0 };
}

export function reportOf(r: Row): StockReport {
  return { id: str(r.id), key: str(r.key), productId: str(r.product_id), variantIdx: vi(r.variant_idx), name: str(r.name), qty: num(r.qty),
    why: r.why === 'lost' || r.why === 'stolen' ? r.why : 'damaged', photo: strOrNull(r.photo_path), by: strOrNull(r.reported_by), byName: str(r.reported_by_name),
    status: str(r.status), decidedAt: msOf(r.decided_at), createdAt: msOf(r.created_at) || 0 };
}

export function askOf(r: Row): StoreAsk {
  return { id: str(r.id), kind: str(r.kind), ref: str(r.ref), payload: r.payload || {}, by: strOrNull(r.asked_by), byName: str(r.asked_by_name),
    status: str(r.status) || 'sent', createdAt: msOf(r.created_at) || 0, decidedAt: msOf(r.decided_at), decidedBy: strOrNull(r.decided_by) };
}

/** products × variants, with units and the folded stock; an accepted count is the item counted (store.html:1151). */
function itemsOf(d: Snap, counts: StockCount[]): ShelfItem[] {
  const counted: Record<string, number> = {};
  Object.entries((d.counted || {}) as Row).forEach(([k, v]) => { const t = msOf(v); if (t) counted[k] = t; });
  counts.filter((c) => c.status === 'accepted').forEach((c) => c.lines.forEach((l) => { const t = c.decidedAt || c.createdAt; if (l && l.key && t > (counted[l.key] || 0)) counted[l.key] = t; }));
  const units = (d.units || []) as Row[], stock = (d.stock || {}) as Row, out: ShelfItem[] = [];
  ((d.products || []) as Row[]).forEach((p) => {
    const vars: Row[] = Array.isArray(p.variants) && p.variants.length ? p.variants : [null];
    vars.forEach((v, i) => {
      const idx = v ? i : null, key = stockKey(String(p.id), idx);
      const u = units.find((r) => String(r.product_id) === String(p.id) && (r.variant_idx == null ? null : Number(r.variant_idx)) === idx) || {};
      out.push({ key, productId: String(p.id), variantIdx: idx, name: v && v.name ? `${p.name} · ${v.name}` : str(p.name), category: strOrNull(p.category),
        unit: unit(u.unit) || 'pc', packUnit: unit(u.pack_unit), packQty: num(u.pack_qty, 1), books: num(stock[key]), countedAt: counted[key] || null, image: strOrNull(p.image) });
    });
  });
  return out;
}

/** staff ∪ members, each named once (personName), the holder first. */
function peopleOf(d: Snap, s: StoreSession): { me: YardPerson; people: YardPerson[] } {
  const members = (d.members || []) as Row[], staff = (d.staff || []) as Row[], seen = new Set<string>(), people: YardPerson[] = [];
  const person = (id: string, userId: string | null, name: string, role: Role, away: boolean, phone: string): YardPerson =>
    ({ id, userId, name, initials: initials(name), tint: userId === s.userId ? 'me' : tintFor(name), role, away, phone });
  staff.forEach((st) => {
    const m = members.find((x) => st.user_id && String(x.user_id) === String(st.user_id));
    const role = (m && m.role) || (st.user_id ? st.role : 'driver') || 'staff';
    people.push(person(String(st.id), strOrNull(st.user_id), personName([m && m.name, st.name], roleName(role)), role as Role, !!st.unavailable, str(st.phone)));
    if (st.user_id) seen.add(String(st.user_id));
  });
  members.filter((m) => !seen.has(String(m.user_id))).forEach((m) => people.push(person('user:' + m.user_id, String(m.user_id), personName([m.name], roleName(m.role)), m.role as Role, false, '')));
  const me = people.find((p) => p.userId === s.userId) || person('user:' + s.userId, s.userId, personName([d.me && d.me.name, s.name], roleName(s.role)), s.role, false, '');
  return { me, people };
}

/** The whole snapshot → the yard's day. */
export function booksOf(d: Snap, s: StoreSession, at: number): YardBooks {
  const holds = (d.holds || {}) as Row, suppliers = (d.suppliers || []) as Row[];
  const counts = ((d.counts || []) as Row[]).map(countOf);
  const presets = (d.presets || {}) as Row;
  const cats: string[] = Array.isArray(presets.categories) ? presets.categories.map((c: unknown) => (typeof c === 'string' ? c : str((c as Row).name))).filter(Boolean) : [];
  const { me, people } = peopleOf(d, s);
  return {
    shopName: s.shopName, at, me, onSince: null, people,
    orders: ((d.orders || []) as Row[]).map((q) => orderOf(q, holds)).filter((o) => !putAway(o)),
    trips: ((d.trips || []) as Row[]).map((t) => tripOf(t, suppliers)),
    returns: ((d.returns || []) as Row[]).map(returnOf), counts,
    reports: ((d.reports || []) as Row[]).map(reportOf), asks: ((d.asks || []) as Row[]).map(askOf),
    items: itemsOf(d, counts),
    log: ((d.log || []) as Row[]).map((l) => ({ key: str(l.key), type: str(l.type), delta: num(l.delta), at: msOf(l.at) || msOf(l.date) || 0, note: str(l.note) })),
    aisles: cats, bays: Math.min(12, Math.max(1, num(presets.bays, 4))),
    customers: ((d.customers || []) as Row[]).map((c) => ({ id: str(c.id), name: str(c.name), phone: str(c.phone), location: str(c.location) })),
    suppliers: suppliers.map((x) => ({ id: str(x.id), name: str(x.name), location: str(x.location) })),
    agents: ((d.agents || []) as Row[]).map((g) => ({ id: str(g.id), name: str(g.name), terms: g.terms === 'on_delivery' ? 'on_delivery' : 'before' })),
    alerts: [],
  };
}
