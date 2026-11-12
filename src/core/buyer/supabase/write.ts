/*
 * The Buyer's order and list writes, each as buyer.html makes it
 * (docs/spec/04-screens-buyer-data.md §3; the W numbers are the spec's).
 * Every order write is changeOrder: re-read the row, change the fresh copy,
 * send only ORDER_KEYS through ow_patch_order (0165) with p_drop and p_status.
 * The pushes are the server's (triggers on saved_quotes, buyer_handoffs, prices).
 */
import { dataError } from '../../datasource.ts';
import type { Session, UGX } from '../../types.ts';
import type { Row, Sb } from '../../supabase/client.ts';
import { ok, patchOrder } from '../../supabase/write.ts';
import type { AskWay } from '../types.ts';
import { priceRowOf } from './buy.ts';
import { readRow } from './read.ts';
import { itemName, type Raw } from './rows.ts';
import { buyable, confirmState, costsOverSell, dropLine, leaveDraft, markAsked, patchOf, quoteOf, setConfirm, supplierGroups, supplierTerms, type Ctx, type Q } from './order.ts';

export interface Changed { q: Q; moved: boolean; held: Row | null }

/** buyer.html:2435 changeOrder. fn returns false: nothing is sent (the order changed under us), and null comes back. */
export async function changeOrder(sb: Sb, s: Session, id: number, fn: (q: Q) => boolean | void): Promise<Changed | null> {
  const row = await readRow(sb, s, 'saved_quotes', id);
  if (!row) throw dataError('refused', 'That order is no longer on the books', 'P0002');
  const q = quoteOf(row), before = q.status;
  if (fn(q) === false) return null;
  const was: Row = row.payload || {}, p = patchOf(q, was, before);
  const back = await patchOrder(sb, s, Number(id), p.patch, null, null, { drop: p.drop, status: p.status });
  const fresh = quoteOf(back || { ...row, ...(p.status ? { status: p.status } : {}), payload: { ...was, ...p.patch } });
  // The Checking gate (0174) may keep a move: the order comes back still in Checking, with gateHeldMove.
  return { q: fresh, moved: fresh.status !== before, held: q.status !== before && fresh.status === before && fresh.gateHeldMove ? fresh.gateHeldMove : null };
}

const ctx = (s: Session, raw: Raw, now: number): Ctx => ({ uid: s.userId, now, agents: raw.agents });
const lineAt = (q: Q, key: string): number => (q.items || []).findIndex((x: Row) => x && String(x.lineId) === String(key));
const supplierName = (raw: Raw, sid: string): string => String((raw.suppliers.find((x) => String(x.id) === String(sid)) || {}).name || '');
const HOW: Record<AskWay, string> = { whatsapp: 'wa', call: 'call', visit: 'person' };

/** Draft orders with lines of this supplier whose answer reads `k` (buyer.html:1407 answerOf; 5978 stageOf). */
function ordersAt(raw: Raw, sid: string, k: 'toask' | 'asked' | 'notfound'): number[] {
  return raw.quotes.map(quoteOf).filter((q) => q.status === 'draft' && !q.voided && !q.cancelledAt && buyable(raw.cancelAsked)(q) && supplierGroups(q).some((g) => String(g.supplierId) === String(sid)))
    .filter((q) => {
      const c = confirmState(q, sid);
      return k === 'asked' ? c.state === 'pending' && !!c.askedAt : k === 'notfound' ? c.state === 'problem' : c.state === 'stale' || (c.state === 'pending' && !c.askedAt);
    })
    .map((q) => Number(q.id));
}

/**
 * W1 buyer.html:6063 sentyes: every order with this supplier still To ask is marked asked, one by one.
 * The designed board also asks again: an order already Asked (late) gets a new askedAt, and one they said
 * No to goes back to pending first (W5a) and is asked anew. buyer.html's chase (W1c) stamps nothing: the
 * new app's re-ask does (asked of Kevin, spec §7 #7).
 */
export async function ask(sb: Sb, s: Session, raw: Raw, sid: string, way: AskWay, now: number): Promise<void> {
  const c = ctx(s, raw, now);
  const ids = [...ordersAt(raw, sid, 'toask'), ...ordersAt(raw, sid, 'asked'), ...ordersAt(raw, sid, 'notfound')];
  for (const id of ids) {
    await changeOrder(sb, s, id, (q) => {
      if (q.status !== 'draft') return false;
      if (confirmState(q, sid).state === 'problem') setConfirm(q, sid, 'pending', '', {}, c);
      markAsked(q, sid, HOW[way] || 'wa', now);
      return true;
    });
  }
}

/** The Undo window: only an answer this recent is taken back. */
const UNDO_WINDOW_MS = 2 * 60 * 1000;

/**
 * The board's Undo (buyer.html W5a, 1115: setOrderSupplierConfirm 'pending' keeps askedAt, clears the rest;
 * buyer.html:2531 holds a yes 6 s on the phone instead). A price this answer changed goes back to the one
 * before (priceWas). buyer.html has no way to move an order back from Buying to Checking (answerNow refuses
 * an order past draft; the stage move back is the Manager's): when the answer already moved an order, nothing
 * is written and it is refused as missing.
 */
export async function undoAnswer(sb: Sb, s: Session, raw: Raw, sid: string, now: number): Promise<void> {
  const recent = (q: Q) => { const r: Row = (q.supplierConfirms || {})[String(sid)] || {}; return (r.state === 'confirmed' || r.state === 'problem') && r.at && now - Number(r.at) < UNDO_WINDOW_MS; };
  const qs = raw.quotes.map(quoteOf).filter((q) => !q.voided && !q.cancelledAt && supplierGroups(q).some((g) => String(g.supplierId) === String(sid)) && recent(q));
  if (qs.some((q) => q.status !== 'draft')) throw dataError('missing', 'The order has moved to Buying: buyer.html has no way to take it back to Checking');
  const c = ctx(s, raw, now);
  for (const q0 of qs) {
    await changeOrder(sb, s, Number(q0.id), (q) => {
      if (q.status !== 'draft' || !recent(q)) return false;
      const at = Number(q.supplierConfirms[String(sid)].at);
      (q.items || []).forEach((it: Row) => {
        if (!it || String(it.supplierId) !== String(sid) || it.priceWas == null || !it.repricedAt || Math.abs(Number(it.repricedAt) - at) > 5000) return;
        it.price = Number(it.priceWas);
        delete it.priceWas; delete it.repricedAt; delete it.repricedBy;
        if (it.priceNote === 'nomargin' && it.priceReview == null) { delete it.priceNote; delete it.priceReview; }
      });
      setConfirm(q, sid, 'pending', '', {}, c);
      return true;
    });
  }
}

/** W2 / W5 buyer.html:2548 answerNow: confirmed or problem on every order that waits on them. W9 rides inside. */
export async function answer(sb: Sb, s: Session, raw: Raw, sid: string, state: 'confirmed' | 'problem', now: number): Promise<void> {
  for (const id of ordersAt(raw, sid, 'asked')) await changeOrder(sb, s, id, (q) => (q.status !== 'draft' ? false : void setConfirm(q, sid, state, '', {}, ctx(s, raw, now))));
}

/**
 * W4 buyer.html:2894 pgo: each new price on its line (priceWas once, repricedAt/By; over the selling price →
 * priceNote 'nomargin', the Manager decides), then their yes "said it on the phone". Orders of theirs with no new
 * price get a plain yes (W2). Then buyer_confirm_price on their list row, as pgo does; a list that cannot be
 * updated does not undo the answer (buyer.html says so in a toast).
 */
export async function answerPrice(sb: Sb, s: Session, raw: Raw, sid: string, prices: { orderId: number; key: string; cost: UGX }[], now: number): Promise<void> {
  const c = ctx(s, raw, now), listed: { pid: unknown; vi: unknown; each: number; qty: number }[] = [];
  for (const id of ordersAt(raw, sid, 'asked')) {
    const mine = prices.filter((p) => p.orderId === id);
    await changeOrder(sb, s, id, (q) => {
      if (q.status !== 'draft') return false;
      let changed = false;
      mine.forEach((p) => {
        const it: Row | undefined = (q.items || [])[lineAt(q, p.key)];
        if (!it || String(it.supplierId) !== String(sid) || Math.round(Number(it.price) || 0) === Math.round(p.cost)) return;
        if (it.priceWas == null) it.priceWas = Number(it.price) || 0;
        it.price = p.cost; it.repricedAt = now; it.repricedBy = s.userId;
        if (costsOverSell(it)) { it.priceNote = 'nomargin'; it.priceReview = null; }
        listed.push({ pid: it.productId, vi: it.variantIdx, each: p.cost, qty: Number(it.qty) || 0 });
        changed = true;
      });
      setConfirm(q, sid, 'confirmed', changed ? 'said it on the phone' : '', changed ? { via: 'phone' } : {}, c);
      return true;
    });
  }
  const rows = raw.prices.map(priceRowOf);
  for (const l of listed) {
    const vi = l.vi == null || l.vi === '' ? null : Number(l.vi);
    const row = rows.find((r) => r.productId === l.pid && r.variantIdx === vi && String(r.supplierId) === String(sid));
    if (row) await sb.rpc('buyer_confirm_price', { p_shop_id: s.shopId, p_price_id: row.id, p_wholesale: l.each, p_qty: l.qty || null }).then(() => undefined, () => undefined);
  }
}

/** W6 buyer.html:2681 pdo (another supplier): the line moves to them at their price, kept by hand (pickKept). */
export async function otherSupplier(sb: Sb, s: Session, raw: Raw, id: number, key: string, sid: string, cost: UGX, now: number): Promise<void> {
  const r = await changeOrder(sb, s, id, (q) => {
    const it: Row | undefined = q.status === 'draft' ? (q.items || [])[lineAt(q, key)] : undefined;
    if (!it || String(it.supplierId) === String(sid)) return false;
    it.supplierId = sid; it.supplierName = supplierName(raw, sid); it.price = cost; it.pickKept = String(sid);
    delete it.clientWaits; delete it.shelfAuto;
    leaveDraft(q, raw.agents, now);
    return true;
  });
  if (!r) throw dataError('refused', 'That line has already changed');
}

/**
 * W8a buyer.html:5202 nonewait (via Sourcing): the client waits; 0139 turns it into a Sourcing request.
 * buyer.html offers it only on a line nobody sells; the 0139 trigger needs no supplier on the line, so a
 * Not found line's supplier is taken off in the same write (spec §7: asked of Kevin).
 */
export async function clientWaits(sb: Sb, s: Session, raw: Raw, id: number, key: string, now: number): Promise<void> {
  const r = await changeOrder(sb, s, id, (q) => {
    const it: Row | undefined = q.status === 'draft' ? (q.items || [])[lineAt(q, key)] : undefined;
    if (!it) return false;
    if (it.supplierId) { it.supplierId = ''; delete it.supplierName; delete it.pickKept; }
    it.clientWaits = { at: now, by: s.userId, via: 'sourcing' };
    leaveDraft(q, raw.agents, now);
    return true;
  });
  if (!r) throw dataError('refused', 'That line has already changed');
}

/** W8 buyer.html:2668 / 5183: off the bill with its reason (needs 2+ lines); line.dropped and a Sourcing request are the server's. */
export async function removeLine(sb: Sb, s: Session, raw: Raw, id: number, key: string, reason: string, now: number): Promise<void> {
  let only = false;
  const r = await changeOrder(sb, s, id, (q) => {
    const idx = q.status === 'draft' ? lineAt(q, key) : -1;
    if (idx < 0) return false;
    if (q.items.length < 2) { only = true; return false; }
    dropLine(q, idx, reason || 'Nobody has it', s.userId, now);
    leaveDraft(q, raw.agents, now);
    return true;
  });
  if (!r) throw dataError('refused', only ? 'It is the only line: the order would be empty' : 'That line has already changed');
}

/** W7 buyer.html:5391 swapgo: another item in its place, then an item_switch hand-off to Sales (pushed by 0134). */
export async function switchItem(sb: Sb, s: Session, raw: Raw, id: number, key: string, to: { name: string; productId: string | null; supplierId: string; cost: UGX; why?: string }, now: number): Promise<void> {
  const why = to.why || 'Client wants it';   // buyer.html:5320 SWAP_WHY: the chip tapped, the first by default
  let from = { name: '', price: 0 };
  const row = to.productId ? raw.prices.map(priceRowOf).find((r) => String(r.productId) === String(to.productId) && String(r.supplierId) === String(to.supplierId)) : null;
  const r = await changeOrder(sb, s, id, (q) => {
    const it: Row | undefined = q.status === 'draft' ? (q.items || [])[lineAt(q, key)] : undefined;
    if (!it) return false;
    from = { name: itemName(raw.products, it.productId, it.variantIdx, String(it.productName || 'Item')), price: Number(it.price) || 0 };
    it.productId = to.productId; it.variantIdx = row ? row.variantIdx : null; it.productName = to.name;
    if (row) { if (row.unit) it.unit = row.unit; it.packUnit = row.packUnit || ''; it.packQty = Number(row.packQty) || 0; }
    it.supplierId = to.supplierId; it.supplierName = supplierName(raw, to.supplierId); it.price = Math.round(to.cost);
    delete it.priceReview; delete it.clientWaits;
    it.switchedFrom = { name: from.name, price: from.price, at: now, why, by: s.userId };
    return true;
  });
  if (!r) throw dataError('refused', 'That line has already changed');
  await passOn(sb, s, 'item_switch', 'sales', String(id), {
    orderId: id, client: String((r.q.client && r.q.client.name) || 'Unnamed client'), lineId: key, from: from.name, to: to.name, why,
    priceWas: from.price, priceNow: Math.round(to.cost), supplierId: to.supplierId,
  });
}

/** buyer.html:5426 passOn: a buyer_handoffs row (0125); its push is the server's. */
export async function passOn(sb: Sb, s: Session, kind: string, forRole: string, ref: string | null, payload: Row): Promise<Row> {
  const row = { id: crypto.randomUUID(), shop_id: s.shopId, kind, for_role: forRole, ref, payload, created_by: s.userId };
  await ok(sb.from('buyer_handoffs').insert(row));
  return row;
}
/** W24 buyer.html:5432 closeHandoff. */
export async function withdraw(sb: Sb, s: Session, id: string): Promise<void> {
  await ok(sb.from('buyer_handoffs').update({ status: 'withdrawn' }).eq('shop_id', s.shopId).eq('id', id));
}

/** W22 buyer.html:3419 commitConfirm: the price they said, on their list row (null = still the price). */
export async function confirmPrice(sb: Sb, s: Session, raw: Raw, sid: string, productId: string | null, item: string, price: UGX): Promise<void> {
  // A price of 0 is a slip, never a price (the database only refuses below 0).
  if (!(price > 0)) throw dataError('refused', 'Type their price first', 'noprice');
  const theirs = raw.prices.map(priceRowOf).filter((r) => String(r.supplierId) === String(sid) && (productId == null || String(r.productId) === String(productId)));
  const row = theirs.find((r) => itemName(raw.products, r.productId, r.variantIdx, '') === item) || (productId != null ? theirs[0] : null);
  if (!row) throw dataError('refused', 'Not on their price list: Sourcing adds it', 'noprice');
  const now = row.wholesale != null ? row.wholesale : row.retail;
  const qty = row.wholesale != null && row.packQty > 0 ? row.packQty : 1;
  await ok(sb.rpc('buyer_confirm_price', { p_shop_id: s.shopId, p_price_id: row.id, p_wholesale: Math.round(price) === Math.round(Number(now) || 0) ? null : Math.round(price), p_qty: qty }));
}

/** W23a buyer.html:6089 savephone: kept on this phone, and a sourcing_fix to Sourcing (supplier.edit is theirs). */
export async function suggestPhone(sb: Sb, s: Session, raw: Raw, sid: string, phone: string): Promise<void> {
  const v = String(phone || '').trim();
  if (v.replace(/\D/g, '').length < 9) throw dataError('refused', 'That number looks short', 'short');
  try {
    const k = 'ow-buyer-phones:' + s.shopId, ph = JSON.parse(localStorage.getItem(k) || '{}') || {};
    ph[String(sid)] = v; localStorage.setItem(k, JSON.stringify(ph));
  } catch (_e) { /* not kept on the phone */ }
  await passOn(sb, s, 'sourcing_fix', 'sourcing', sid, { supplierId: sid, supplier: supplierName(raw, sid), how: 'phone', fixes: [{ tab: 'sup', item: 'The supplier', field: 'phone', label: 'PHONE', was: '', now: v }] });
}

/**
 * W3 buyer.html:2473 readAppAnswers: a supplier-app answer is folded into its order when the order is still in
 * Checking, the supplier still has lines on it, nothing newer was recorded and the terms match. Twice is harmless.
 */
export async function foldAnswers(sb: Sb, s: Session, raw: Raw, answers: Row[], now: number): Promise<number> {
  const SAID: Row = { confirmed: 'Said have all', short: 'Said some short', none: 'Said none' };
  let n = 0;
  for (const a of answers) {
    const sid = String(a.supplier_id), at = Date.parse(a.at);
    const fits = (q: Q | null) => !!q && !q.voided && q.status === 'draft' && supplierGroups(q).some((g) => String(g.supplierId) === sid)
      && !((((q.supplierConfirms || {})[sid] || {}).at || 0) >= at) && a.terms === supplierTerms(q, sid);
    const local = raw.quotes.find((x) => String(x.id) === String(a.order_id));
    if (!fits(local ? quoteOf(local) : null)) continue;
    const note = SAID[a.state] ? SAID[a.state] + (a.note ? `: “${a.note}”` : '') : (a.note || '');
    try {
      const r = await changeOrder(sb, s, Number(a.order_id), (q) => (!fits(q) ? false
        : void setConfirm(q, sid, a.state === 'confirmed' ? 'confirmed' : 'problem', note, { by: 'supplier', at, short: a.state === 'short' ? a.changes : null }, ctx(s, raw, now))));
      if (r) n++;
    } catch (_e) { /* the next read tries again */ }
  }
  return n;
}
