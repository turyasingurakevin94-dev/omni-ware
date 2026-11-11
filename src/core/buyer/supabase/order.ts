/*
 * An order as buyer.html works on it, and the changes the Buyer makes to it
 * (docs/spec/04-screens-buyer-data.md §2, §4b). Pure: a quote in, the same
 * quote changed. Every change runs on the copy just re-read from the server
 * (write.ts changeOrder), then only ORDER_KEYS go back through ow_patch_order.
 *
 *   quoteOf            buyer.html:782 rowToQuote (the payload spread over defaults) + 794 withLineIds
 *   supplierTerms      1046 orderSupplierTerms (must match the server's ow_supplier_terms, 0174)
 *   confirmState       1050 orderSupplierConfirmState
 *   leaveDraft         1094 orderLeaveDraft (the Checking gate as the phone sees it)
 *   setConfirm         1110 setOrderSupplierConfirm
 *   markAsked          1130 markOrderSupplierAsked
 *   patchOf            2443 changeOrder's patch: ORDER_KEYS only, a key set to nothing dropped
 */
import type { Row } from '../../supabase/client.ts';

export type Q = Row;

/** buyer.html:2434: the only payload keys the Buyer ever sends. */
export const ORDER_KEYS = ['items', 'supplierConfirms', 'droppedLines', 'stageEnteredAt', 'stageLog', 'shopConfirmedAt', 'shopConfirmedTerms', 'pickingStatus'];
const STATUS_ORDER = ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'];
export const SHELF = '__stock__';

/** buyer.html:782 rowToQuote + 794 withLineIds: a line with no lineId gets 'L<orderId>-<index>', kept once written back. */
export function quoteOf(r: Row): Q {
  const q: Q = {
    id: r.id, status: r.status || 'draft', invoiced: !!r.invoiced, invoicedAt: r.invoiced_at, invoicedTs: r.invoiced_ts ? new Date(r.invoiced_ts).getTime() : null,
    amountPaid: Number(r.amount_paid) || 0, voided: !!r.voided, date: r.date, user_id: r.user_id,
    client: { name: r.client_name || '', phone: r.client_phone || '' }, items: [], savedAt: null, payments: [], customerId: null, debtCharged: 0, charges: [], credit: null,
    ...(r.payload || {}),
  };
  (q.items || []).forEach((it: Row, i: number) => { if (it && (it.lineId == null || it.lineId === '')) it.lineId = 'L' + q.id + '-' + i; });
  return q;
}

/** buyer.html:1016 createdMs. */
export function createdMs(q: Q): number {
  return Date.parse(q.createdAt || q.savedAt || '') || (q.date ? Date.parse(q.date + 'T08:00:00') : 0);
}
/** buyer.html:1018 quoteAgedOffBoard: invoiced 24 h ago leaves the board. */
export function agedOff(q: Q, now: number): boolean {
  return !!(q.invoiced && q.invoicedTs && now - q.invoicedTs >= 24 * 3600 * 1000);
}

export const boughtIn = (it: Row | null): boolean => !!(it && it.supplierId && it.supplierId !== SHELF);
export const received = (it: Row | null): boolean => !!(it && it.receivedAt && Number(it.receivedQty) > 0);
const awaitsGoods = (q: Q): boolean => (q.items || []).some((it: Row) => boughtIn(it) && !received(it));

/** buyer.html:1041 orderSupplierGroups: the lines by supplier, skipping our shelf and lines with no supplier. */
export function supplierGroups(q: Q): { supplierId: string; lines: Row[] }[] {
  const by = new Map<string, { supplierId: string; lines: Row[] }>();
  (q.items || []).forEach((it: Row) => {
    const sid = it && it.supplierId;
    if (!sid || sid === SHELF) return;
    const k = String(sid);
    if (!by.has(k)) by.set(k, { supplierId: sid, lines: [] });
    (by.get(k) as { lines: Row[] }).lines.push(it);
  });
  return [...by.values()];
}

const termOf = (it: Row, price: unknown): string => [it.productId, it.variantIdx == null ? '' : it.variantIdx, Number(it.qty) || 0, Math.round(Number(price) || 0)].join(':');

export function supplierTerms(q: Q, sid: string): string {
  const g = supplierGroups(q).find((x) => String(x.supplierId) === String(sid));
  return (g ? g.lines : []).map((it) => termOf(it, it.price)).join('|');
}

export type ConfirmWord = 'pending' | 'confirmed' | 'problem' | 'stale';
export function confirmState(q: Q, sid: string): { state: ConfirmWord; at: number | null; askedAt: number | null; askedHow: string | null } {
  const rec: Row = ((q && q.supplierConfirms) || {})[String(sid)] || {};
  const state: ConfirmWord = rec.state === 'confirmed' && rec.terms !== supplierTerms(q, sid) ? 'stale' : (rec.state || 'pending');
  return { state, at: rec.at || null, askedAt: rec.askedAt || null, askedHow: rec.askedHow || null };
}
const draftReady = (q: Q): boolean => supplierGroups(q).every((g) => confirmState(q, g.supplierId).state === 'confirmed');

/* ---- the agent gates (buyer.html:1059-1092) ---- */
const prepayAgent = (q: Q, agents: Row[]): boolean => {
  const a = q.originAgentId ? agents.find((x) => x.id === q.originAgentId) : null;
  return !!a && (a.payment_term || 'prepay') === 'prepay';
};
const agentPaymentBlocks = (q: Q, agents: Row[]): boolean => !!q.originAgentId && prepayAgent(q, agents) && q.agentPaymentStatus !== 'paid';
const agentOrderTerms = (q: Q): string => (q.items || []).map((it: Row) => termOf(it, it.sellPrice)).join('|');
function agentSuppliersConfirmed(q: Q): boolean {
  const items: Row[] = (q && q.items) || [];
  if (!items.length) return false;
  const confirms: Row = q.supplierConfirms || {};
  const termsFor = (sid: string) => items.filter((it) => it && String(it.supplierId) === String(sid)).map((it) => termOf(it, it.price)).join('|');
  return items.every((it) => {
    const sid = it && it.supplierId;
    if (sid === SHELF) return true;
    if (!sid) return false;
    const rec = confirms[String(sid)];
    return !!rec && rec.state === 'confirmed' && rec.terms === termsFor(sid);
  });
}
const shopChecked = (q: Q): boolean => !!(q.shopConfirmedAt && q.shopConfirmedTerms === agentOrderTerms(q));
function agentNeedsShopCheck(q: Q, agents: Row[]): boolean {
  if (!q || !q.originAgentId || q.status !== 'draft' || !prepayAgent(q, agents) || q.agentPaymentStatus === 'paid') return false;
  return !(shopChecked(q) || agentSuppliersConfirmed(q));
}
function agentOnHold(q: Q): boolean {
  const c = q && q.agentChange;
  const open = c && c.state === 'asked' ? (c.lines || []).filter((l: Row) => l && !l.decision) : [];
  return !!(q && !q.voided && (q.agentCancel || open.length));
}
/** buyer.html:1083 agentShelfConfirm (W6a: our shelf on an agent order). */
export function agentShelfConfirm(q: Q, now: number): void {
  if (!q || !q.originAgentId || q.status !== 'draft' || !agentSuppliersConfirmed(q) || shopChecked(q)) return;
  q.shopConfirmedAt = now; q.shopConfirmedTerms = agentOrderTerms(q);
}

/* ---- what waits for the Manager (buyer.html:4835-4845) ---- */
const PRICE_WAIT_NOTES = ['under', 'nomargin', 'nocost'];
export const costsOverSell = (it: Row): boolean => {
  const sell = it && it.sellPrice != null && it.sellPrice !== '' ? Number(it.sellPrice) : 0;
  return sell > 0 && Number(it.price) > sell && Number(it.qty) > 0;
};
export const priceWaits = (it: Row): boolean => !!it && PRICE_WAIT_NOTES.includes(it.priceNote) && !(it.priceReview && it.priceReview.state);
function creditHolds(q: Q): boolean {
  const d = q && q.creditCheck && q.creditCheck.decision;
  return d === 'hold' || (d === 'cash' && (q.items || []).reduce((t: number, it: Row) => t + (Number(it.qty) || 0) * (Number(it.sellPrice) || 0), 0) - (Number(q.amountPaid) || 0) > 0);
}
const noneOpen = (q: Q): Row[] => (q.items || []).filter((it: Row) => it && !it.supplierId && !it.clientWaits);

/** buyer.html:1020 setSavedQuoteStatus. */
function setStatus(q: Q, status: string, now: number): void {
  if (!STATUS_ORDER.includes(status)) return;
  if (q.status === 'preparing' && STATUS_ORDER.indexOf(status) > STATUS_ORDER.indexOf('preparing') && q.pickingStatus && q.pickingStatus !== 'done') q.pickingStatus = 'done';
  if (q.status !== status) {
    q.stageEnteredAt = now;
    q.stageLog = (Array.isArray(q.stageLog) ? q.stageLog : []).concat([{ status, at: now, auto: true }]);
  }
  q.status = status;
}

/** buyer.html:1094 orderLeaveDraft: every supplier said yes and nothing holds it → Buying, or Packing when nothing is to come. */
export function leaveDraft(q: Q, agents: Row[], now: number): boolean {
  if (!q || q.status !== 'draft' || !draftReady(q)) return false;
  if (agentNeedsShopCheck(q, agents) || agentPaymentBlocks(q, agents) || agentOnHold(q)) return false;
  if ((q.items || []).some(priceWaits) || creditHolds(q) || noneOpen(q).length) return false;
  setStatus(q, awaitsGoods(q) ? 'awaiting_goods' : 'preparing', now);
  return true;
}

export interface Ctx { uid: string; now: number; agents: Row[] }

/** buyer.html:1110 setOrderSupplierConfirm. 'pending' keeps askedAt and clears the rest. */
export function setConfirm(q: Q, sid: string, state: 'pending' | 'confirmed' | 'problem', note: string, extra: Row, c: Ctx): { moved: boolean; held: boolean } {
  const wasReady = q.status === 'draft' && draftReady(q);
  if (!q.supplierConfirms) q.supplierConfirms = {};
  const key = String(sid), prev: Row = q.supplierConfirms[key] || {};
  if (state === 'pending') {
    if (prev.askedAt) q.supplierConfirms[key] = { state: 'pending', at: null, askedAt: prev.askedAt, terms: null, note: '' };
    else delete q.supplierConfirms[key];
  } else {
    q.supplierConfirms[key] = { state, at: c.now, askedAt: prev.askedAt || null, terms: state === 'confirmed' ? supplierTerms(q, sid) : null, note: note || '', by: c.uid, ...extra };
  }
  if (state === 'confirmed' && q.originAgentId && q.status === 'draft' && agentSuppliersConfirmed(q) && !shopChecked(q)) {
    q.shopConfirmedAt = c.now; q.shopConfirmedTerms = agentOrderTerms(q);
  }
  let moved = false, held = false;
  if (!wasReady && q.status === 'draft' && draftReady(q)) { moved = leaveDraft(q, c.agents, c.now); held = !moved; }
  return { moved, held };
}

/** buyer.html:1130 markOrderSupplierAsked. how: wa · call · person · phone2. */
export function markAsked(q: Q, sid: string, how: string, now: number): void {
  if (!q.supplierConfirms) q.supplierConfirms = {};
  const key = String(sid), rec: Row = q.supplierConfirms[key] || { state: 'pending', at: null, terms: null, note: '' };
  rec.askedAt = now;
  if (how) rec.askedHow = how;
  q.supplierConfirms[key] = rec;
}

/** buyer.html:1155 ofDroppedRecord + the reason (2673, 5190). */
export function dropLine(q: Q, idx: number, reason: string, uid: string, now: number): void {
  const it: Row = q.items[idx];
  q.items.splice(idx, 1);
  q.droppedLines = (q.droppedLines || []).concat([{
    productId: it.productId, variantIdx: it.variantIdx === undefined ? null : it.variantIdx, productName: it.productName || '', unit: it.unit || '', qty: Number(it.qty) || 0,
    sellPrice: Number(it.sellPrice) || 0, agentSellPrice: Number(it.agentSellPrice) || 0, at: idx, reason, droppedAt: now, by: uid,
  }]);
}

/** buyer.html:2443-2446: only ORDER_KEYS; a key now undefined (or null where the server had none) is dropped. */
export function patchOf(q: Q, was: Row, before: string): { patch: Row; drop: string[]; status: string | null } {
  const patch: Row = {}, drop: string[] = [];
  ORDER_KEYS.forEach((k) => {
    if (q[k] === undefined || (q[k] === null && was[k] === undefined)) { if (k in was) drop.push(k); } else patch[k] = q[k];
  });
  return { patch, drop, status: q.status !== before ? q.status : null };
}
