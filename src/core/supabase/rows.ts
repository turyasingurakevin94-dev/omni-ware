/*
 * The one place a database row becomes one of the app's shapes (types.ts).
 * Each mapper names the sales.html mapper it follows, so the two read the
 * books the same way (sales.html:3911-3975 loadAll, rowToQuote, rowToAsk …).
 */
import { whole } from '../money.ts';
import { initials, phoneText, stageOf, tintFor } from '../names.ts';
import { cheapestRow, fifoUnitCost, shopPrice, type PriceRow, type ProductRow } from '../price.ts';
import type {
  BillAsk, Chat, ChatEvent, ChatNote, Customer, CustomerKind, DebtEntry, Item, Line, Member, Message, Method, Ms, Order,
  OrderPayment, PayPromise, Payment, PaymentAsk, Role, ShopSettings, SourcingAsk, StageStep,
} from '../types.ts';
import type { Row } from './client.ts';

const ms = (v: unknown): Ms | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const n = Date.parse(String(v));
  return Number.isNaN(n) ? (Number(v) || null) : n;
};
const num = (v: unknown): number => Number(v) || 0;
const method = (v: unknown): Method => (v === 'momo' || v === 'bank' ? v : 'cash');

/** app_settings.presets → the settings Sales uses (sales.html:3933-3946). */
export function settingsOf(presets: Row): ShopSettings {
  const hold = presets.creditHold && Number(presets.creditHold.days) > 0 ? Number(presets.creditHold.days) : 21;
  return {
    creditPct: Number(presets.creditPct) > 0 ? Number(presets.creditPct) : 0,
    holdDays: hold,
    chaseAfterDays: presets.chaseAfterDays != null ? Number(presets.chaseAfterDays) : 7,
    services: (Array.isArray(presets.services) ? presets.services : []).map((s: Row, i: number) => ({
      id: String(s.id ?? i), label: String(s.label || s.name || 'Charge'), type: s.type === 'percent' ? 'percent' : 'fixed', value: num(s.value ?? s.price),
    })),
    shopPhone: String(presets.shopPhone ?? presets.waPhone ?? ''),
    shopAddress: String(presets.shopAddress || ''),
  };
}

/** shop_members + staff + member_presence → the people the app names. */
export function membersOf(members: Row[], staff: Row[], presence: Row[], meId: string): Member[] {
  const byUser = new Map(staff.filter((s) => s.user_id).map((s) => [String(s.user_id), s]));
  const seenAt = new Map(presence.map((p) => [String(p.user_id), p]));
  const out: Member[] = members.map((m) => {
    const id = String(m.user_id), st = byUser.get(id), pr = seenAt.get(id);
    const name = String(m.display_name || (st && st.name) || roleName(m.role));
    const seen = pr ? ms(pr.seen_at) : null, typing = pr ? ms(pr.typing_at) : null;
    return {
      id, name, initials: initials(name), role: m.role as Role, tint: id === meId ? 'me' : tintFor(name),
      // "On now" = seen in the last 2 minutes (sales.html chLoadPresence reads it every 20 s).
      presence: seen == null ? null : Date.now() - seen < 120000 ? 'on' : 'away',
      presenceSince: seen,
      inChat: pr && pr.conv_id != null ? Number(pr.conv_id) : null,
      typingIn: typing != null && Date.now() - typing < 10000 && pr && pr.conv_id != null ? Number(pr.conv_id) : null,
    };
  });
  // Drivers and yard staff with no login are named too (an order's holder).
  staff.filter((s) => !s.user_id).forEach((s) => {
    const name = String(s.name || 'Staff');
    out.push({ id: 'staff:' + s.id, name, initials: initials(name), role: 'driver', tint: tintFor(name), presence: null, presenceSince: null, inChat: null, typingIn: null });
  });
  return out;
}

/** A person with no name the apps can show is named by their role (0168), never "Someone". */
export function roleName(role: string): string {
  return ({ owner: 'The owner', admin: 'The owner', manager: 'The manager', accounts: 'Accounts', sourcing: 'Sourcing', buyer: 'The buyer', store: 'The store', sales: 'Sales', staff: 'Staff' } as Record<string, string>)[role] || 'Staff';
}

/** customers + customer_debt_log → Customer (sales.html:3921 customers map). */
export function customerOf(c: Row, log: Row[]): Customer {
  const debtLog: DebtEntry[] = log.map((l) => ({
    id: num(l.id), day: String(l.date || '').slice(0, 10),
    type: l.type === 'charge' ? 'charge' : l.type === 'opening' ? 'opening' : l.type === 'adjust' ? 'adjust' : 'payment',
    amount: num(l.amount), orderId: l.quote_id == null ? null : Number(l.quote_id), paymentId: l.cash_txn_id == null ? null : Number(l.cash_txn_id), note: String(l.note || ''),
  }));
  const name = String(c.name || '');
  return {
    id: String(c.id), name, initials: initials(name), tint: tintFor(name),
    phone: phoneText(c.phone || ''), phone2: phoneText(c.phone2 || ''), place: String(c.location || ''),
    kind: (['contractor', 'reseller', 'retail'].includes(c.kind) ? c.kind : null) as CustomerKind | null,
    address: String(c.address || c.location || ''),
    owes: whole(c.debt), creditLimit: c.credit_limit == null ? null : num(c.credit_limit), termsDays: c.terms_days ?? null,
    // The rhythm and the usual come from their orders; the Customers tab works them out (sales.html custRhythm).
    everyDays: null, usual: [],
    debtLog, qa: !!c.qa,
  };
}

/** The pricing context the order and item mappers need: products, supplier rows, lots, the shop's default markup. */
export interface PriceBook {
  products: Map<string, ProductRow & { name: string; category: string; variantsRaw: Row[] }>;
  rows: Map<string, PriceRow[]>;
  lots: Map<string, { qty: number; cost: number | null }[]>;
  stock: Map<string, number>;
  shopDefault: Row;
}

export function stockKey(pid: string, vi: number | null): string {
  return vi == null ? pid : `${pid}::${vi}`;
}

export function priceBookOf(products: Row[], prices: Row[], stock: Row[], lots: Row[], shopDefault: Row): PriceBook {
  const rows = new Map<string, PriceRow[]>();
  prices.forEach((r) => {
    const vi = r.variant_idx == null || r.variant_idx === '' ? null : Number(r.variant_idx);
    const pr: PriceRow = {
      productId: String(r.product_id), variantIdx: vi, supplierId: String(r.supplier_id || ''),
      wholesale: r.wholesale == null ? null : Number(r.wholesale), retail: r.retail == null ? null : Number(r.retail),
      unit: String(r.unit || ''), packUnit: String(r.pack_unit || ''), packQty: num(r.pack_qty), outOfStock: !!r.out_of_stock,
      tiers: Array.isArray(r.tiers) ? r.tiers : [],
    };
    const k = stockKey(pr.productId, vi);
    if (!rows.has(k)) rows.set(k, []);
    (rows.get(k) as PriceRow[]).push(pr);
  });
  const lotMap = new Map<string, { qty: number; cost: number | null }[]>();
  lots.forEach((l) => { const k = String(l.key); if (!lotMap.has(k)) lotMap.set(k, []); (lotMap.get(k) as { qty: number; cost: number | null }[]).push({ qty: num(l.qty), cost: l.cost == null ? null : Number(l.cost) }); });
  return {
    products: new Map(products.map((p) => [String(p.id), {
      id: String(p.id), name: String(p.name || ''), category: String(p.category || ''), variantsRaw: p.variants || [], variants: p.variants || [],
      wholesaleMarkupType: p.wholesale_markup_type === 'fixed' ? 'fixed' : 'percent', wholesaleMarkupValue: num(p.wholesale_markup_value),
      retailMarkupType: p.retail_markup_type === 'fixed' ? 'fixed' : 'percent', retailMarkupValue: num(p.retail_markup_value),
      stockWholesaleMarkupType: p.stock_wholesale_markup_type === 'fixed' ? 'fixed' : 'percent', stockWholesaleMarkupValue: num(p.stock_wholesale_markup_value),
      stockRetailMarkupType: p.stock_retail_markup_type === 'fixed' ? 'fixed' : 'percent', stockRetailMarkupValue: num(p.stock_retail_markup_value),
    }])),
    rows, lots: lotMap, stock: new Map(stock.map((s) => [String(s.key), num(s.qty)])), shopDefault: shopDefault || {},
  };
}

/** "Name — 4 inch / flat" (sales.html:4230 productVariantLabel). */
function itemName(pb: PriceBook, pid: string, vi: number | null, fallback: string): string {
  const p = pb.products.get(pid);
  if (!p) return fallback;
  const v = vi != null ? (p.variantsRaw[vi] as Row | undefined) : undefined;
  return v && v.combo ? `${p.name} — ${Object.values(v.combo).join(' / ')}` : p.name;
}

/** saved_quotes.payload.items[i] → Line (spec 01 §4b). price null = "Price coming" (sales.html linePriceToConfirm). */
export function lineOf(it: Row, pb: PriceBook): Line {
  const vi = it.variantIdx == null || it.variantIdx === '' ? null : Number(it.variantIdx);
  const pid = String(it.productId || ''), supplierId = String(it.supplierId || '');
  const cost = num(it.price) > 0 ? num(it.price) : null;
  const shop = shopPrice({
    product: pb.products.get(pid) || null, variantIdx: vi, supplierId, qty: num(it.qty), packQty: num(it.packQty), cost: cost || 0,
    row: (pb.rows.get(stockKey(pid, vi)) || []).find((r) => r.supplierId === supplierId) || null, shopDefault: pb.shopDefault,
  });
  const typed = it.sellPrice != null && it.sellPrice !== '' && Number(it.sellPrice) > 0 ? whole(it.sellPrice) : null;
  const given = it.givenAway ? 0 : null;
  return {
    lineId: num(it.lineId), itemId: pid, variantIdx: vi, name: String(it.productName || itemName(pb, pid, vi, '')),
    unit: String(it.unit || ''), packUnit: String(it.packUnit || ''), packQty: num(it.packQty), qty: num(it.qty),
    price: given ?? typed ?? shop, cost, shopPrice: shop,
    from: supplierId === '__stock__' ? 'shelf' : supplierId ? 'supplier' : 'none', supplierId,
    priceBy: it.priceBy ? String(it.priceBy) : null, priceNote: ['under', 'nomargin', 'nocost'].includes(it.priceNote) ? it.priceNote : null,
    priceReview: it.priceReview && (it.priceReview.state === 'approved' || it.priceReview.state === 'changed')
      ? { state: it.priceReview.state, price: whole(it.priceReview.price), was: it.priceReview.was == null ? null : whole(it.priceReview.was), by: String(it.priceReview.by || ''), byName: String(it.priceReview.byName || ''), at: ms(it.priceReview.at) || 0 }
      : null,
    priceToldAt: ms(it.priceToldAt),
    state: it.pickStatus === 'done' ? 'packed' : it.pickStatus === 'short' ? 'short' : num(it.receivedQty) > 0 ? 'came' : null,
    stateAt: ms(it.pickedAt || it.receivedAt),
  };
}

/** saved_quotes row → Order (sales.html:4011 rowToQuote: the payload over the columns). */
export function orderOf(q: Row, pb: PriceBook): Order {
  const p: Row = q.payload || {};
  const stage = stageOf(String(q.status || 'draft'));
  const log: StageStep[] = (Array.isArray(p.stageLog) ? p.stageLog : []).map((s: Row) => ({ stage: stageOf(String(s.status)), at: ms(s.at) || 0, by: s.by ? String(s.by) : null }));
  const placedAt = ms(p.createdAt) || ms(p.savedAt) || ms(q.date) || 0;
  const payments: OrderPayment[] = (Array.isArray(p.payments) ? p.payments : []).map((x: Row) => ({
    id: num(x.id), day: String(x.date || '').slice(0, 10), amount: whole(x.amount), method: method(x.method), paymentId: x.cashTxnId == null ? null : Number(x.cashTxnId),
  }));
  return {
    id: num(q.id), customerId: p.customerId != null && p.customerId !== '' ? String(p.customerId) : null,
    client: { name: String((p.client && p.client.name) || q.client_name || 'Walk-in'), phone: phoneText((p.client && p.client.phone) || q.client_phone || '') },
    placedAt, placedBy: p.takenBy ? String(p.takenBy) : null,
    stage, stageAt: ms(p.stageEnteredAt) || placedAt, stageLog: log.length ? log : [{ stage, at: placedAt, by: null }],
    holderId: stage === 'packing' && p.assignedWorkerId ? 'staff:' + p.assignedWorkerId : stage === 'road' && p.assignedDeliveryId && !String(p.assignedDeliveryId).startsWith('__') ? 'staff:' + p.assignedDeliveryId : null,
    lines: (Array.isArray(p.items) ? p.items : []).map((it: Row) => lineOf(it, pb)),
    charges: (Array.isArray(p.charges) ? p.charges : []).map((c: Row, i: number) => ({ id: num(c.id) || i + 1, label: String(c.label || c.service || 'Charge'), type: c.type === 'percent' ? 'percent' : 'fixed', value: num(c.value) })),
    credit: p.credit && Number(p.credit.pct) > 0 ? { pct: Number(p.credit.pct), days: num(p.credit.days) } : null,
    discount: whole(p.discount),
    payments, paid: whole(q.amount_paid),
    invoiced: !!q.invoiced, invoicedAt: ms(q.invoiced_ts) || ms(q.invoiced_at),
    voided: !!q.voided, cancelled: q.status === 'cancelled' || !!p.cancelledAt,
    counter: !!(p.counter || p.counterSale),
    deliverTo: p.deliveryAddress ? String(p.deliveryAddress) : p.deliverTo ? String(p.deliverTo) : null,
    deliveredAt: ms(p.deliveredAt),
    toldTotal: null,
    qa: !!q.qa,
  };
}

/** One Item per product, or per variant (the shelf price first, else the cheapest supplier's). */
export function itemsOf(pb: PriceBook, held: Map<string, number>): Item[] {
  const out: Item[] = [];
  pb.products.forEach((p) => {
    const vis: (number | null)[] = p.variantsRaw.length ? p.variantsRaw.map((_v, i) => i) : [null];
    vis.forEach((vi) => {
      const k = stockKey(p.id, vi), rows = pb.rows.get(k) || [], onHand = pb.stock.get(k) || 0;
      const best = cheapestRow(rows, 1), lotCost = fifoUnitCost(pb.lots.get(k) || [], 1);
      const fromShelf = onHand > 0 && lotCost != null;
      const cost = fromShelf ? lotCost : best ? (best.retail ?? best.wholesale ?? 0) : 0;
      const price = shopPrice({ product: p, variantIdx: vi, supplierId: fromShelf ? '__stock__' : best ? best.supplierId : '', qty: 1, packQty: best ? best.packQty : 0, cost: cost || 0, row: fromShelf ? null : best, shopDefault: pb.shopDefault });
      out.push({
        id: p.id, variantIdx: vi, name: itemName(pb, p.id, vi, p.name), aisle: p.category,
        unit: best ? best.unit : '', packUnit: best ? best.packUnit : '', packQty: best ? best.packQty : 0,
        price, packPrice: null, cost: cost && cost > 0 ? whole(cost) : null,
        onShelf: Math.max(0, onHand - (held.get(k) || 0)), orderIn: !!best, listedAt: null,
      });
    });
  });
  return out;
}

/** What live orders will take off the shelf (sales.html:4258 heldIndex): shelf lines past Checking, not invoiced. */
export function heldOf(orders: Order[]): Map<string, number> {
  const m = new Map<string, number>();
  orders.forEach((o) => {
    if (o.invoiced || o.voided || o.cancelled || o.stage === 'checking') return;
    o.lines.forEach((l) => { if (l.from !== 'shelf' && l.state !== 'came') return; const k = stockKey(l.itemId, l.variantIdx); m.set(k, (m.get(k) || 0) + Math.max(0, l.qty)); });
  });
  return m;
}

/** cash_txns → Payment (sales.html:8985 rowToTxn); the customer from the debt log line that names it. */
export function paymentOf(t: Row, customerOfTxn: Map<number, string>, orderCustomer: Map<number, string | null>): Payment {
  const id = num(t.id), orderId = t.quote_id == null ? null : Number(t.quote_id);
  const at = ms(`${t.date}T${t.time || '00:00'}:00+03:00`) || ms(t.date) || 0;
  return {
    id, at, day: String(t.date || '').slice(0, 10), amount: whole(t.amount), method: method(t.account),
    customerId: customerOfTxn.get(id) ?? (orderId != null ? orderCustomer.get(orderId) ?? null : null),
    orderId, by: t.entered_by ? String(t.entered_by) : null, ref: String(t.ref || ''), qa: !!t.qa,
  };
}

/** payment_promises → PayPromise (sales.html rowToPromise). */
export function promiseOf(r: Row): PayPromise {
  return { id: num(r.id), customerId: String(r.customer_id), on: String(r.promised_on), madeOn: String(r.made_on), amount: r.amount == null ? null : whole(r.amount) };
}

/** sourcing_leads → SourcingAsk (sales.html rowToLead). */
export function askOf(r: Row): SourcingAsk {
  const status = ['asked', 'looking', 'found', 'priced', 'listed', 'dropped'].includes(r.status) ? r.status : 'asked';
  return {
    id: String(r.id), name: String(r.name || ''), status, createdAt: ms(r.created_at) || 0, stageAt: ms(r.stage_entered_at) || ms(r.created_at) || 0,
    itemId: r.product_id ? String(r.product_id) : null,
    requests: (Array.isArray(r.requests) ? r.requests : []).map((x: Row) => ({ at: ms(x.at) || 0, by: x.by ? String(x.by) : null, customerId: x.customerId != null ? String(x.customerId) : null, qty: num(x.qty) || 1 })),
    tried: (Array.isArray(r.candidates) ? r.candidates : []).map((x: Row) => ({ supplier: String(x.supplierName || x.name || ''), at: ms(x.askedAt || x.at) || 0 })),
  };
}

/** invoice_asks → BillAsk (sales.html rowToAsk). */
export function billAskOf(r: Row): BillAsk {
  return { id: String(r.id), orderId: num(r.quote_id), customerId: r.customer_id ? String(r.customer_id) : null, kind: r.kind === 'credit' ? 'credit' : 'void', amount: whole(r.amount), reason: String(r.reason || ''), status: r.status, by: String(r.asked_by || ''), at: ms(r.created_at) || 0 };
}

/** cancel_asks (0181) → BillAsk, kind 'cancel': what the order came to when asked, and why. */
export function cancelAskOf(r: Row): BillAsk {
  const status = r.status === 'accepted' || r.status === 'declined' || r.status === 'withdrawn' ? r.status : 'sent';
  return { id: String(r.id), orderId: num(r.quote_id), customerId: r.customer_id ? String(r.customer_id) : null, kind: 'cancel', amount: whole(r.amount), reason: String(r.why || ''), status, by: String(r.asked_by || ''), at: ms(r.created_at) || 0 };
}

/** payment_asks → PaymentAsk (sales.html rowToPayAsk). */
export function paymentAskOf(r: Row): PaymentAsk {
  return { id: String(r.id), paymentId: r.cash_txn_id == null ? null : Number(r.cash_txn_id), customerId: r.customer_id ? String(r.customer_id) : null, orderId: r.quote_id == null ? null : Number(r.quote_id), what: r.what, amount: whole(r.amount), status: r.status, by: String(r.asked_by || ''), at: ms(r.created_at) || 0 };
}

/** wa_conversations → Chat; the customer is the one whose number ends the same, if exactly one does (sales.html waMatchCustomer). */
export function chatOf(c: Row, customers: Customer[]): Chat {
  const suf = String(c.wa_id || '').replace(/[^0-9]/g, '').slice(-9);
  const hits = suf ? customers.filter((x) => [x.phone, x.phone2].some((p) => p.replace(/[^0-9]/g, '').slice(-9) === suf)) : [];
  return {
    id: num(c.id), waId: String(c.wa_id || ''), phone: phoneText(c.wa_id || ''), profileName: String(c.profile_name || ''),
    customerId: hits.length === 1 ? hits[0].id : null, ownerId: c.owner_user_id ? String(c.owner_user_id) : null, ownerAt: ms(c.owner_at),
    lastInAt: ms(c.last_inbound_at), lastAt: ms(c.last_message_at), lastReadAt: ms(c.last_read_at),
  };
}

/** wa_messages → Message. */
export function messageOf(m: Row): Message {
  const kind = ['image', 'audio', 'document', 'template'].includes(m.msg_type) ? m.msg_type : m.msg_type === 'interactive' ? 'catalog' : 'text';
  return {
    id: String(m.id), chatId: num(m.conversation_id), at: ms(m.sent_at) || ms(m.created_at) || 0, dir: m.direction === 'out' ? 'out' : 'in',
    kind, body: String(m.body || ''), by: m.sent_by ? String(m.sent_by) : null,
    state: m.direction === 'out' ? (['sent', 'delivered', 'read', 'failed'].includes(m.status) ? m.status : 'sent') : null,
  };
}

export function noteOf(n: Row): ChatNote {
  return { id: String(n.id), chatId: num(n.conversation_id), at: ms(n.created_at) || 0, by: String(n.by_user || ''), body: String(n.body || '') };
}

export function eventOf(e: Row): ChatEvent {
  const kind = e.kind === 'moved' || e.kind === 'move' ? 'moved' : e.kind === 'handed' || e.kind === 'hand' ? 'handed' : 'taken';
  return { id: String(e.id), chatId: num(e.conversation_id), at: ms(e.created_at) || 0, kind, by: String(e.by_user || e.actor || ''), to: e.to_user ? String(e.to_user) : null, note: String(e.note || '') };
}
