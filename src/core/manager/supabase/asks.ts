/*
 * Every open decision, built from where its asker wrote it (types.ts "the decisions are not
 * stored as such"). One builder per kind, each naming the manager.html test it follows; the
 * key is '<kind>:<id>' as the demo's (a price: 'price:<order>:<idx>'). askerId is the asker's
 * staff id (a login is mapped through staff.user_id, else 'user:<uuid>'); null when the app
 * spots it itself (an untagged price, a held bill, a 0 with no why).
 *
 * Where the books say nothing for a kind, it is named here and none is built:
 *   markup (D-33)  no ask exists until 0184's markup.wanted (data §3 P-11)
 *   limit  (D-32)  no customer_asks table until 0184 (P-12)
 *   twins  (D-21)  the app spots them from the orders (src/core/manager/watch.ts twins): not built twice
 */
import { orderTotal, whole } from '../../money.ts';
import type { Row } from '../../supabase/client.ts';
import { stockKey } from '../../supabase/rows.ts';
import { fifoUnitCost } from '../../price.ts';
import type { Order } from '../../types.ts';
import type { Ask, CheckinLine, LossReport, RestockLine } from '../types.ts';
import { agentKey, agentOpen, costWas, creditAskOpen, freeOpen, heldCodeOf, isLive, kindOf, ms, priceNow, shortWaits, waitsPrice, type Q } from './lines.ts';
import type { Ctx } from './rows.ts';

const num = (v: unknown): number => Number(v) || 0;
const vi = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
const base = (key: string, at: number, askerId: string | null, orderId: number | null, standing = false) => ({ key, at, askerId, orderId, standing });

/** An item's cost each off the shelf (getFIFOUnitCost), else 0. */
export const shelfCost = (x: Ctx, key: string): number => whole(fifoUnitCost(x.pb.lots.get(key) || [], 1) || 0);
const itemName = (x: Ctx, pid: unknown, fallback: unknown): string => String(fallback || (x.pb.products.get(String(pid || '')) || { name: '' }).name || 'Item');
const unitOf = (x: Ctx, key: string): string => ((x.pb.rows.get(key) || [])[0] || { unit: '' }).unit;

/* ---------------- on an order ---------------- */

/** D-1 … D-4: each line whose price waits (lineWaitsPrice); a counter sale's customer is standing there. */
function priceAsks(x: Ctx, q: Q): Ask[] {
  if (!isLive(q) || q.invoiced) return [];
  const id = Number(q.id), counter = !!(q.counter || q.counterSale), at0 = ms(q.createdAt) || ms(q.savedAt) || 0;
  return (Array.isArray(q.items) ? q.items : []).flatMap((it: Row, idx: number): Ask[] => {
    if (!waitsPrice(it, x.pb)) return [];
    const at = ms(it.priceAt) || at0, asker = x.staffOf(it.priceBy);
    const typed = num(it.sellPrice) > 0 ? whole(it.sellPrice) : null;
    if (counter) return [{ ...base(`counter:${id}:${idx}`, at, asker || x.staffOf(q.takenBy), id, true), kind: 'counter', idx, asked: typed ?? priceNow(it, x.pb) }];
    const was = costWas(it), k = kindOf(it, x.pb);
    return [{ ...base(`price:${id}:${idx}`, at, asker, id), kind: 'price', mode: was != null ? 'up' : k === 'under' ? 'under' : 'coming', idx, asked: typed, costWas: was }];
  });
}

/** D-10: lines at 0 with no why (freeOpenLines 4517). */
function givenAsk(q: Q): Ask[] {
  if (!isLive(q) || q.invoiced) return [];
  const idxs = (Array.isArray(q.items) ? q.items : []).map((it: Row, i: number) => (freeOpen(it) ? i : -1)).filter((i: number) => i >= 0);
  return idxs.length ? [{ ...base(`given:${q.id}`, ms(q.stageEnteredAt) || ms(q.createdAt) || 0, null, Number(q.id)), kind: 'given', idxs }] : [];
}

/** D-9: the run left it under 1,000 (OWSML). The other codes are their own asks (price, short, given). */
function billAsk(x: Ctx, q: Q): Ask[] {
  const code = heldCodeOf(x, q, x.o.get(Number(q.id)) as Order);
  return code === 'OWSML' ? [{ ...base(`bill:${q.id}`, ms(q.deliveredAt) || ms(q.stageEnteredAt) || 0, null, Number(q.id)), kind: 'bill', code }] : [];
}

/**
 * D-5, D-6: an order in Checking the gate holds (creditCase 1948): over the limit, an old bill past the
 * hold, or on credit with no limit (0167). Answered once creditCheck says release or cash ("hold" waits on).
 */
function creditAsk(x: Ctx, q: Q): Ask[] {
  if (!isLive(q) || q.status !== 'draft' || creditAskOpen(q)) return [];
  const c = q.customerId != null ? x.customers.get(String(q.customerId)) : undefined;
  if (!c) return [];
  const amt = Math.max(0, orderTotal(x.o.get(Number(q.id)) as Order) - whole(q.amountPaid)), limit = num(c.creditLimit), withIt = c.owes + amt;
  const cust = x.raw.customers.find((r) => String(r.id) === c.id) as Row;
    const over = limit > 0 && withIt > limit, old = num(cust.debt) > 0 && x.owing(c.id).age > x.settings.holdDays;
  const noLimit = !(limit > 0) && !!q.credit && num(q.credit.pct) > 0;
  if (!over && !old && !noLimit) return [];
  if (q.creditCheck && q.creditCheck.decision && q.creditCheck.decision !== 'hold') return [];
  return [{ ...base(`credit:${q.id}`, ms(q.createdAt) || 0, x.staffOf(q.takenBy), Number(q.id)), kind: 'credit', why: over ? 'limit' : old ? 'age' : 'nolimit' }];
}

/** D-7: the Store's "on credit?" (payload.creditAsk, 0156; the new Store writes letGoAsk, kept as creditAsk 0183:297). */
function storeCreditAsk(x: Ctx, q: Q): Ask[] {
  const a = isLive(q) && !q.invoiced ? creditAskOpen(q) : null;
  if (!a) return [];
  const carrier = (a.carrier && a.carrier.name) || (q.carrier && q.carrier.name) || null;
  return [{ ...base(`storecredit:${q.id}`, ms(a.at) || 0, x.staffOf(a.by), Number(q.id), true), kind: 'storecredit', carrier: carrier ? String(carrier) : null }];
}

/** D-12: packed short, not settled (pickShortfallLinesOf; the Store's pickingStatus 'done'). */
function shortAsk(q: Q): Ask[] {
  return shortWaits(q) ? [{ ...base(`short:${q.id}`, ms(q.pickingDoneAt) || 0, q.assignedWorkerId ? String(q.assignedWorkerId) : null, Number(q.id)), kind: 'short' }] : [];
}

/** D-22: an agent asks for fewer, or to cancel (agentAsks 5578). The asker is the agent ('agent:<id>'). */
function agentAsk(q: Q, agentId: unknown): Ask[] {
  const a = agentOpen(q);
  if (!a) return [];
  const items: Row[] = Array.isArray(q.items) ? q.items : [];
  const lines = a.lines.map((l) => { const idx = items.findIndex((it) => agentKey(it) === agentKey(l)); return { idx, from: idx >= 0 ? num(items[idx].qty) : 0, to: num(l.to) }; }).filter((l) => l.idx >= 0);
  const at = ms((q.agentChange && q.agentChange.at) || (q.agentCancel && q.agentCancel.at)) || 0;
  return [{ ...base(`agent:${q.id}`, at, agentId ? 'agent:' + String(agentId) : null, Number(q.id)), kind: 'agent', cancel: a.cancel, lines }];
}

/* ---------------- in their own tables ---------------- */

/** D-13: the yard's count differs from what the Buyer brought (tripDiffs 5247), with the Buyer's open note. */
function checkinAsks(x: Ctx): Ask[] {
  const got = (l: Row) => (l.gotQty != null && Number.isFinite(Number(l.gotQty)) && Number(l.gotQty) >= 0 ? Number(l.gotQty) : num(l.qty));
  return x.raw.trips.filter((t) => !t.voided && t.yard_checked_at && !t.difference_accepted_at).flatMap((t): Ask[] => {
    const place = x.supplier(t.supplier_id);
    const lines: CheckinLine[] = (Array.isArray(t.lines) ? t.lines : []).map((l: Row) => ({
      name: String(l.productName || l.name || 'Item'), unit: String(l.unit || ''), brought: got(l), counted: l.yardQty == null ? got(l) : num(l.yardQty),
      cost: whole(num(l.gotPrice) > 0 ? l.gotPrice : l.expectedPrice), place: x.supplier(l.supplierId || t.supplier_id) || place,
    }));
    if (!lines.some((l) => l.counted !== l.brought)) return [];
    const h = x.raw.yardNotes.find((n) => String((n.payload && n.payload.tripId) || n.ref || '') === String(t.id));
    return [{
      ...base(`checkin:${t.id}`, ms(t.yard_checked_at) || 0, x.staffOf(t.yard_checked_by), null), kind: 'checkin', tripId: String(t.id),
      runnerId: t.assigned_worker_id ? String(t.assigned_worker_id) : null, lines,
      note: h ? { text: String((h.payload && h.payload.words) || ''), at: ms(h.created_at) || 0, handoffId: String(h.id) } : null,
    }];
  });
}

/** D-15: the Store's "Not on the list · keep it?" (store_asks kind extra, 0157; old/store.html sendExtras). */
function extraAsks(x: Ctx): Ask[] {
  return x.raw.storeAsks.filter((a) => a.status === 'sent').map((a): Ask => {
    const p: Row = a.payload || {}, tripId = String(p.tripId || a.ref || ''), t = x.raw.trips.find((r) => String(r.id) === tripId);
    const line: Row | undefined = t && Array.isArray(t.lines) ? t.lines.find((l: Row) => String(l.productId || '') === String(p.productId || '') && vi(l.variantIdx) === vi(p.variantIdx)) : undefined;
    const sid = p.supplierId || (t && t.supplier_id), key = String(p.key || stockKey(String(p.productId || ''), vi(p.variantIdx)));
    const row = (x.pb.rows.get(key) || []).find((r) => r.supplierId === String(sid || ''));
    const cost = line && num(line.gotPrice || line.expectedPrice) > 0 ? whole(line.gotPrice || line.expectedPrice) : row ? whole(row.wholesale ?? row.retail ?? 0) || null : null;
    return {
      ...base(`extra:${a.id}`, ms(a.created_at) || 0, x.staffOf(a.asked_by), null), kind: 'extra', askId: String(a.id), tripId,
      name: itemName(x, p.productId, p.name), unit: String(p.unit || ''), qty: num(p.qty), onList: line ? num(line.qty) : 0, cost, from: x.supplier(sid),
    };
  });
}

/** D-16: the Store's loss reports, one ask per reporter and minute (several sent at once are one decision). */
function lossAsks(x: Ctx): Ask[] {
  const by = new Map<string, Row[]>();
  x.raw.reports.filter((r) => r.status === 'sent').forEach((r) => {
    const k = `${r.reported_by || ''}|${String(r.created_at || '').slice(0, 16)}`;
    by.set(k, [...(by.get(k) || []), r]);
  });
  return [...by.values()].map((rs): Ask => {
    const reports: LossReport[] = rs.map((r) => {
      const key = String(r.key || stockKey(String(r.product_id || ''), vi(r.variant_idx)));
      const why = r.why === 'lost' || r.why === 'stolen' ? r.why : 'damaged';
      return { id: String(r.id), key, name: itemName(x, r.product_id, r.name), unit: unitOf(x, key), qty: num(r.qty), why, note: String(r.note || ''), photo: r.photo_path ? String(r.photo_path) : null, cost: shelfCost(x, key), shelf: x.pb.stock.get(key) || 0 };
    });
    return { ...base(`loss:${rs[0].id}`, ms(rs[0].created_at) || 0, x.staffOf(rs[0].reported_by), null), kind: 'loss', reports };
  });
}

/** D-17: a blind count sent (stock_counts status 'sent'). */
function countAsks(x: Ctx): Ask[] {
  return x.raw.counts.filter((c) => c.status === 'sent').map((c): Ask => ({
    ...base(`count:${c.id}`, ms(c.created_at) || 0, x.staffOf(c.counted_by), null), kind: 'count', countId: String(c.id), aisle: String(c.aisle || c.place || ''),
    lines: (Array.isArray(c.lines) ? c.lines : []).map((l: Row) => {
      const key = String(l.key || stockKey(String(l.productId || ''), vi(l.variantIdx)));
      return { key, name: itemName(x, l.productId, l.name), system: l.system == null ? num(x.pb.stock.get(key)) : num(l.system), counted: num(l.counted), cost: shelfCost(x, key) };
    }),
  }));
}

/** D-18, D-19: a return or a void asked on an invoice (invoice_asks status 'sent', its order in the books). */
function invoiceAsks(x: Ctx): Ask[] {
  return x.raw.invoiceAsks.filter((a) => a.status === 'sent' && x.q.has(Number(a.quote_id))).map((a): Ask => {
    const b = base(`${a.kind === 'void' ? 'void' : 'return'}:${a.id}`, ms(a.created_at) || 0, x.staffOf(a.asked_by), Number(a.quote_id));
    const common = { askId: String(a.id), amount: whole(a.amount), reason: String(a.reason || ''), note: String(a.note || '') };
    return a.kind === 'void' ? { ...b, kind: 'void', ...common }
      : { ...b, kind: 'return', ...common, lines: (Array.isArray(a.lines) ? a.lines : []).map((l: Row) => ({ idx: num(l.idx), qty: num(l.qty) })) };
  });
}

/** D-20: Sales asks to cancel (cancel_asks status 'sent', 0181), the order live and not billed. */
function cancelAsks(x: Ctx): Ask[] {
  return x.raw.cancelAsks.filter((a) => { const q = x.q.get(Number(a.quote_id)); return a.status === 'sent' && !!q && isLive(q) && !q.invoiced; })
    .map((a): Ask => ({ ...base(`cancel:${a.id}`, ms(a.created_at) || 0, x.staffOf(a.asked_by), Number(a.quote_id)), kind: 'cancel', askId: String(a.id), why: String(a.why || ''), note: String(a.note || '') }));
}

/** Weeks the shelf lasts at this month's selling (restockWeeks 5765), or null with no sales. */
function weeksLeft(x: Ctx, pid: string, v: number | null, left: number): number | null {
  const days = Math.max(1, Number(x.today.slice(8, 10)));
  let sold = 0;
  x.qs.forEach((q) => {
    if (!q.invoiced || q.voided || String(q.invoicedAt || q.invoiced_at || '').slice(0, 10) < x.month) return;
    (Array.isArray(q.items) ? q.items : []).forEach((it: Row) => { if (String(it.productId || '') === pid && vi(it.variantIdx) === v) sold += num(it.qty); });
  });
  return sold > 0 ? left / (sold / days) / 7 : null;
}

/** D-24: the shelf part of a carton bought for one order (restock_buys held, for_line, nobody's hold: 0151). */
function cartonAsks(x: Ctx): Ask[] {
  return x.raw.restock.filter((r) => r.status === 'held' && r.for_line && !r.held_by).map((r): Ask => {
    const [oid, lid] = String(r.for_line).split(':'), q = x.q.get(Number(oid));
    const it: Row | undefined = q && Array.isArray(q.items) ? q.items.find((y: Row, i: number) => String(y.lineId) === lid || (y.lineId == null && String(i) === lid)) : undefined;
    const pid = String(r.product_id || ''), v = vi(r.variant_idx), w = weeksLeft(x, pid, v, num(r.qty));
    return {
      ...base(`carton:${r.id}`, ms(r.created_at) || 0, x.staffOf(r.created_by), q ? Number(q.id) : null), kind: 'carton', restockId: String(r.id),
      name: itemName(x, pid, ''), unit: String(r.unit || ''), forOrder: it ? num(it.qty) : 0, forShelf: num(r.qty), cost: whole(r.price),
      // "~14 months of selling": the shelf part at this month's pace; 0 when nothing sold this month.
      perMonth: w != null ? Math.round((w / 4.35) * 10) / 10 : 0,
    };
  });
}

/** Every open ask. */
export function asksOf(x: Ctx): Ask[] {
  const agentOf = new Map(x.raw.quotes.map((r) => [Number(r.id), r.agent_id]));
  const onOrders = x.qs.filter((q) => !q.qa).flatMap((q) => [
    ...priceAsks(x, q), ...givenAsk(q), ...billAsk(x, q), ...creditAsk(x, q), ...storeCreditAsk(x, q), ...shortAsk(q), ...agentAsk(q, agentOf.get(Number(q.id))),
  ]);
  return [...onOrders, ...checkinAsks(x), ...extraAsks(x), ...lossAsks(x), ...countAsks(x), ...invoiceAsks(x), ...cancelAsks(x), ...cartonAsks(x)];
}

/** D-23: the Buyer's restock list (restock_buys planned or held), less the cartons that wait on an answer. */
export function restockOf(x: Ctx): RestockLine[] {
  return x.raw.restock.filter((r) => (r.status === 'planned' || r.status === 'held') && !(r.status === 'held' && r.for_line && !r.held_by)).map((r) => {
    const pid = String(r.product_id || ''), v = vi(r.variant_idx), key = stockKey(pid, v);
    return { id: String(r.id), name: itemName(x, pid, ''), unit: String(r.unit || ''), qty: num(r.qty), cost: whole(r.price), weeksLeft: weeksLeft(x, pid, v, x.pb.stock.get(key) || 0), held: r.status === 'held' };
  });
}
