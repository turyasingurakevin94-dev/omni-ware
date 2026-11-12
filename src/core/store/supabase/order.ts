/*
 * The Store's order writes (data §3 W1–W11, §6c W3', W27), each as store.html makes it
 * (2307–2454). Every one is changeOrder: re-read the one order (store_order), refuse if it
 * moved since the phone showed it (p_expect, 0162), change the fresh copy, then send ONLY
 * the keys this tap changed and each line's pick answer through store_patch_order.
 * The stage moves the Store may make: Packing → On the road | Delivered, On the road →
 * Delivered (STORE_STATUS_MOVES; the database checks them too, 0164 0173 0178).
 * The pushes are the server's (0120, 0183), after the write; none is sent from here.
 */
import { dataError, isDataError } from '../../datasource.ts';
import { ok } from '../../supabase/write.ts';
import type { Row, Sb } from '../../supabase/client.ts';
import type { CarrierPick, DoorProof, PickAnswer } from '../source.ts';
import type { StoreSession, YardBooks } from '../types.ts';
import { putBack as putBackLines } from '../pack.ts';
import { isPickup } from '../yard.ts';
import { readOrderRow } from './read.ts';

/** store.html:2289 ORDER_KEYS, plus 0183's comingBack: the only payload keys compared and sent. */
export const ORDER_KEYS = ['items', 'assignedWorkerId', 'assignedDeliveryId', 'pickingStatus', 'pickCursor', 'pickingAssignedAt', 'workerAcceptedAt',
  'pickingDoneAt', 'bay', 'carrier', 'stageEnteredAt', 'stageLog', 'deliveredTo', 'deliveredAt', 'deliveredPhoto', 'deliveredPhotoKind', 'deliveredNote',
  'handoverCheckedAt', 'letGoAsk', 'comingBack'];
const MOVES: Record<string, string[]> = { preparing: ['pending_delivery', 'completed'], pending_delivery: ['completed'] };
const ANSWERED = ['done', 'short'];

/** The order as store.html holds it: the payload spread over the row (store.html:1111 rowToQuote). */
export type Q = Row;
export const quoteOf = (r: Row): Q => ({ id: r.id, status: r.status || 'draft', invoiced: !!r.invoiced, voided: !!r.voided, client: { name: r.client_name || '', phone: r.client_phone || '' }, items: [], ...(r.payload || {}) });

/** What the phone saw (store.html:2301 seenOf), sent as p_expect. */
export function seenOf(r: Row | null): Row | null {
  if (!r) return null;
  const q = quoteOf(r);
  return { status: q.status, pickingStatus: q.pickingStatus ?? null, pickingDoneAt: q.pickingDoneAt ?? null, carrierAt: q.carrier && q.carrier.at != null ? q.carrier.at : null };
}
const asText = (v: unknown): string => (v == null ? '' : String(v));
function seenDiffers(seen: Row, q: Q): boolean {
  const now: Row = { status: q.status, pickingStatus: q.pickingStatus, pickingDoneAt: q.pickingDoneAt, carrierAt: q.carrier && q.carrier.at };
  return ['status', 'pickingStatus', 'pickingDoneAt', 'carrierAt'].some((k) => asText(seen[k]) !== asText(now[k]));
}

/** A line the yard never picks (store.html:1540 lineNotPicked). */
const notPicked = (q: Q, it: Row): boolean => !!it && ((!it.supplierId && !!it.clientWaits) || (!!q.pickSettle && !((Number(it.qty) || 0) > 0)));

/** store.html setSavedQuoteStatus: the stage and its log. */
function move(q: Q, status: string, now: number): void {
  q.status = status;
  q.stageEnteredAt = now;
  q.stageLog = [...(Array.isArray(q.stageLog) ? q.stageLog : []), { status, at: now }];
}

/** A clash or the money gate, read off the server's refusal (OWSTALE 40001; OWCSH). */
function reword(e: unknown): never {
  if (isDataError(e) && e.kind === 'refused') {
    if (e.code === '40001' || /OWSTALE|someone else just changed/i.test(e.message)) throw dataError('clash', 'Someone else just did this');
    if (/cash customer|OWCSH/i.test(e.message)) throw dataError('refused', 'Not paid yet', 'OWCSH');
  }
  throw e;
}

/** store.html:2307 changeOrder. `fn` returns false: nothing is sent. */
export async function changeOrder(sb: Sb, s: StoreSession, id: number, seen: Row | null, fn: (q: Q) => boolean | void): Promise<Row | null> {
  const row = await readOrderRow(sb, s, id);
  if (!row) throw dataError('refused', 'That order is no longer on the books', 'P0002');
  const q = quoteOf(row), was = quoteOf(row), before = q.status;
  if (q.voided) return null;
  if (seen && seenDiffers(seen, q)) throw dataError('clash', 'Someone else just did this');
  if (fn(q) === false) return null;
  if (q.status !== before && !(MOVES[before] || []).includes(q.status)) throw dataError('refused', 'That order has moved on', 'P0001');
  const same = (a: unknown, b: unknown) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  const patch: Row = {};
  ORDER_KEYS.forEach((k) => { if (k !== 'items' && !same(q[k], was[k])) patch[k] = q[k] === undefined ? null : q[k]; });
  const items = (q.items || []).map((it: Row, idx: number) => ({ idx, lineId: it.lineId || null, pickStatus: it.pickStatus ?? null, pickedQty: it.pickedQty ?? null }));
  const args: Row = { p_shop: s.shopId, p_id: Number(id), p_patch: patch, p_status: q.status !== before ? q.status : null, p_items: items };
  if (seen) args.p_expect = seen;
  try { return await ok<Row | null>(sb.rpc('store_patch_order', args)); } catch (e) { return reword(e); }
}

/** Every order write of the Store, given the phone's last copy of the order (seen) and the books (for a pickup). */
export function orderWrites(sb: Sb, s: StoreSession, seen: (id: number) => Row | null, books: () => YardBooks | null) {
  const change = (id: number, fn: (q: Q) => boolean | void) => changeOrder(sb, s, id, seen(id), fn).then(() => undefined);
  const mine = (): string => { if (!s.staffId) throw dataError('refused', 'Ask Ruth for a staff row first', 'P0001'); return s.staffId; };
  const carrierOf = (c: CarrierPick, now: number): Row => ({ kind: c.kind, name: c.name || '', what: c.what || '', phone: c.phone || '', at: now, by: s.name, ...(c.staffId ? { staffId: c.staffId } : {}) });
  const load = (q: Q, c: CarrierPick, now: number) => {
    q.carrier = carrierOf(c, now);
    q.assignedDeliveryId = c.kind === 'staff' ? c.staffId : c.kind === 'hired' ? '__carrier__' : c.kind === 'agent' ? '__agent__' : '__client__';
    if (q.status === 'preparing') { q.pickingStatus = 'done'; q.pickingDoneAt = q.pickingDoneAt || now; move(q, 'pending_delivery', now); }
  };
  return {
    /** W1 store.html:2368 takeOrder. */
    claim: (id: number) => change(id, (q) => {
      const me = mine(), now = Date.now();
      if (q.status !== 'preparing' || q.pickingStatus === 'done') return false;
      if (q.assignedWorkerId && String(q.assignedWorkerId) !== me && q.pickingStatus === 'in_progress') throw dataError('clash', 'Someone else is packing it');
      if (q.pickingStatus === 'in_progress') return false;
      q.assignedWorkerId = me; q.pickingAssignedAt = q.pickingAssignedAt || now; q.workerAcceptedAt = now; q.pickingStatus = 'in_progress'; q.pickCursor = q.pickCursor || 0;
      (q.items || []).forEach((it: Row) => { if (!ANSWERED.includes(it.pickStatus) && !notPicked(q, it)) it.pickStatus = 'pending'; });
      return true;
    }),
    /** W2 store.html:2344 setPick / flushPicks. */
    pick: (id: number, answers: PickAnswer[], cursor: number) => change(id, (q) => {
      if (q.status !== 'preparing') return false;
      answers.forEach((a) => { const it = (q.items || [])[a.idx]; if (!it) return; it.pickStatus = a.status; it.pickedQty = a.status === 'done' ? Number(it.qty) || 0 : a.qty; });
      q.pickCursor = cursor;
      return true;
    }),
    /** W3 store.html:2384 finishPack; W3' a pickup moves to Ready to collect (0183). */
    finishPack: (id: number, bay: number | null) => change(id, (q) => {
      if (q.status !== 'preparing') return false;
      if (!(q.items || []).every((it: Row) => notPicked(q, it) || ANSWERED.includes(it.pickStatus))) throw dataError('refused', 'Answer every line first', 'P0001');
      const now = Date.now(), b = books(), o = b && b.orders.find((x) => x.id === id);
      q.pickingStatus = 'done'; q.pickingDoneAt = now;
      if (bay) q.bay = bay;
      if (b && o && isPickup(o, b.customers)) move(q, 'pending_delivery', now);
      return true;
    }),
    /** W4. */
    setBay: (id: number, bay: number) => change(id, (q) => { q.bay = bay; return true; }),
    /** W5 store.html:2396 unpackOrder. */
    unpack: (id: number) => change(id, (q) => {
      if (q.voided || q.status !== 'preparing' || q.pickingStatus !== 'done' || q.carrier) return false;
      q.pickingStatus = 'in_progress'; q.pickingDoneAt = null; q.bay = null;
      return true;
    }),
    /** W6 store.html:4089 release; put back clears the ticks. */
    release: (id: number, putBack: boolean) => change(id, (q) => {
      q.assignedWorkerId = undefined; q.workerAcceptedAt = undefined; q.pickingAssignedAt = undefined; q.pickingStatus = undefined;
      if (putBack) { (q.items || []).forEach((it: Row) => { it.pickStatus = null; it.pickedQty = null; }); q.pickCursor = 0; }
      return true;
    }),
    /** W8 store.html:2400 applyLoad, per order. */
    load: async (ids: number[], c: CarrierPick) => {
      for (const id of ids) await change(id, (q) => { if (q.status !== 'preparing') return false; load(q, c, Date.now()); return true; });
    },
    /** W9 store.html:2416 handOver: out of the gate and done in one go. */
    handOver: (id: number, name: string, agent: boolean) => change(id, (q) => {
      if (!['preparing', 'pending_delivery'].includes(q.status)) return false;
      const now = Date.now(), c: CarrierPick = { kind: agent ? 'agent' : 'client', name, what: '', phone: '', staffId: null };
      if (q.status === 'preparing') load(q, c, now);
      else if (!q.carrier) { q.carrier = carrierOf(c, now); q.assignedDeliveryId = agent ? '__agent__' : '__client__'; }
      q.handoverCheckedAt = now; q.deliveredTo = name.trim().slice(0, 80) || null; q.deliveredAt = new Date(now).toISOString();
      move(q, 'completed', now);
      return true;
    }),
    /** W10 store.html:2437 markDelivered (the photo first, to delivery-photos). */
    deliver: async (id: number, p: DoorProof) => {
      let path: string | null = null;
      if (p.photo) {
        const o = books()?.orders.find((x) => x.id === id);
        path = `${s.shopId}/${(o && o.originAgentId) || 'shop'}/${id}-${uuid()}.jpg`;
        await ok(sb.storage.from('delivery-photos').upload(path, p.photo, { contentType: 'image/jpeg' }));
      }
      await change(id, (q) => {
        if (q.status !== 'pending_delivery') return false;
        const now = Date.now();
        q.deliveredTo = p.to.trim().slice(0, 80) || null; q.deliveredAt = new Date(now).toISOString(); q.deliveredPhoto = path;
        if (p.kind === 'note') q.deliveredPhotoKind = 'note';
        if (!path && p.kind === 'none') { q.deliveredPhotoKind = 'none'; q.deliveredNote = String(p.note || '').slice(0, 200); }
        move(q, 'completed', now);
        return true;
      });
    },
    /** W27 (0183): can't deliver · bring it back; it stays On the road. */
    cantDeliver: (id: number, why: string) => change(id, (q) => {
      if (q.status !== 'pending_delivery') return false;
      q.comingBack = { why: why.slice(0, 120), at: Date.now(), by: s.userId, byName: s.name };
      return true;
    }),
    /** W11 store.html:4805: the ask rides on the order (letGoAsk; the books keep creditAsk). */
    askLetGo: (id: number, c: CarrierPick | null) => change(id, (q) => {
      if (q.status !== 'preparing' && q.status !== 'pending_delivery') return false;
      q.letGoAsk = { at: Date.now(), by: s.userId, byName: s.name, carrier: c ? carrierOf(c, Date.now()) : q.carrier || null };
      return true;
    }),
    /**
     * W7 (0183): a cancelled order's goods back on the shelf. Not changeOrder (that leaves a called-off
     * order alone): the one key store_patch_order takes on one, stamped once with the server's time and
     * person. No stock moves (it never left the books, 0177) and no push.
     */
    putBack: async (id: number) => {
      const o = books()?.orders.find((x) => x.id === id);
      const lines = o ? putBackLines(o).map((x) => ({ idx: x.line.idx, qty: x.qty })) : [];
      await ok(sb.rpc('store_patch_order', { p_shop: s.shopId, p_id: Number(id), p_patch: { putBack: { lines } }, p_status: null, p_items: null }));
    },
    /** W11a. */
    withdrawLetGo: (id: number) => change(id, (q) => { if (!q.letGoAsk || q.letGoAsk.answer) return false; q.letGoAsk = undefined; return true; }),
  };
}

export function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
