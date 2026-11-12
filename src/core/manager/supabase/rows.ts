/*
 * The one place a row becomes one of the Manager's shapes (src/core/manager/types.ts):
 * the orders, the customers, the team, the shop, today's money and answers. The asks
 * are built from the same rows in asks.ts (where each asker wrote it), the line rules
 * in lines.ts. A row is read the way Sales reads it wherever the shapes meet (the order's
 * lines and total, a customer's bills: src/core/supabase/rows.ts, src/core/owing.ts).
 *
 * Where the books do not say what a screen needs, the default is named beside it.
 */
import { money, orderTotal, promiseState, whole } from '../../money.ts';
import { initials, invoiceNo, orderNo, personName, phone9, tintFor } from '../../names.ts';
import { owingOf, type Owing } from '../../owing.ts';
import type { Row } from '../../supabase/client.ts';
import { customerOf, orderOf, paymentAskOf, priceBookOf, settingsOf, type PriceBook } from '../../supabase/rows.ts';
import { dayOf } from '../../time.ts';
import type { Customer, Order, ShopSettings } from '../../types.ts';
import type { Cust, Day, Done, ManagerBooks, MLine, MOrder, Ms, Person, Shop, Stage, TeamRole } from '../types.ts';
import { asksOf, restockOf } from './asks.ts';
import { atZero, heldCodeOf, inPlay, isLive, ms, quoteOf, type Q } from './lines.ts';
import type { MSession, Raw } from './read.ts';

const num = (v: unknown): number => Number(v) || 0;

/** Everything a mapper needs from one read: the rows, the price book, the orders both ways, who is who. */
export interface Ctx {
  raw: Raw;
  s: MSession;
  now: Ms;
  today: Day;
  month: Day;
  pb: PriceBook;
  settings: ShopSettings;
  qs: Q[];
  q: Map<number, Q>;
  /** The same orders as Sales reads them (lines priced, totals): src/core/supabase/rows.ts orderOf. */
  o: Map<number, Order>;
  /** A login → its staff id (staff.user_id), else 'user:<uuid>'. */
  staffOf: (userId: unknown) => string | null;
  supplier: (id: unknown) => string;
  customers: Map<string, Customer>;
  /** A customer's bills by the server's rule (src/core/owing.ts), worked out once per read. */
  owing: (customerId: string) => Owing;
}

export function ctxOf(raw: Raw, s: MSession, now: Ms): Ctx {
  const presets = raw.presets || {};
  const pb = priceBookOf(raw.products, raw.prices, raw.stock, raw.lots, presets.defaultMarkup || {});
  const qs = raw.quotes.map(quoteOf);
  const byUser = new Map(raw.staff.filter((x) => x.user_id).map((x) => [String(x.user_id), String(x.id)]));
  const sup = new Map(raw.suppliers.map((x) => [String(x.id), String(x.name || '')]));
  const logBy = new Map<string, Row[]>();
  raw.debtLog.forEach((l) => { const k = String(l.customer_id); logBy.set(k, [...(logBy.get(k) || []), l]); });
  const today = dayOf(now), settings = settingsOf(presets);
  const o = new Map(raw.quotes.map((r) => [Number(r.id), orderOf(r, pb)]));
  const customers = new Map(raw.customers.map((c) => [String(c.id), customerOf(c, logBy.get(String(c.id)) || [])]));
  const books = { orders: [...o.values()], paymentAsks: raw.payAsks.map(paymentAskOf), settings }, owed = new Map<string, Owing>();
  const owing = (id: string): Owing => {
    if (!owed.has(id)) { const c = customers.get(id); owed.set(id, c ? owingOf(books, c, today) : owingOf(books, customerOf({ id }, []), today)); }
    return owed.get(id) as Owing;
  };
  return {
    raw, s, now, today, month: today.slice(0, 8) + '01', pb, settings, qs, q: new Map(qs.map((x) => [Number(x.id), x])), o, owing, customers,
    staffOf: (u) => (u == null || u === '' ? null : byUser.get(String(u)) || 'user:' + String(u)),
    supplier: (id) => (id === '__stock__' ? 'Shelf' : sup.get(String(id || '')) || ''),
  };
}

/* ---------------- the orders ---------------- */

const STAGES: Stage[] = ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'];
const stageOf = (q: Q): Stage => (!isLive(q) ? 'cancelled' : STAGES.includes(q.status) ? q.status : 'draft');

/** The item's own wholesale markup as a fraction (variant, then product), when it is a percent. */
function markupOf(pb: PriceBook, pid: string, vi: number | null): number | null {
  const p = pb.products.get(pid);
  if (!p) return null;
  const v = vi != null ? (p.variantsRaw[vi] as Row | undefined) : undefined;
  if (v && num(v.wholesaleMarkupValue) > 0) return v.wholesaleMarkupType === 'fixed' ? null : num(v.wholesaleMarkupValue) / 100;
  return p.wholesaleMarkupValue > 0 && p.wholesaleMarkupType === 'percent' ? p.wholesaleMarkupValue / 100 : null;
}

function lineOfQ(x: Ctx, q: Q, o: Order, it: Row, idx: number): MLine {
  const l = o.lines[idx], sid = it.supplierId ? String(it.supplierId) : null;
  const conf: Row = sid && q.supplierConfirms ? q.supplierConfirms[sid] || {} : {};
  const up = it.priceWas != null && num(it.priceWas) > 0 && num(it.price) > num(it.priceWas);
  const vi = it.variantIdx == null || it.variantIdx === '' ? null : Number(it.variantIdx);
  return {
    idx, name: l.name, unit: l.unit, qty: l.qty, cost: l.cost,
    // A line typed at 0 is 0 (a given-away line, or one waiting for its why), never the shop's price.
    price: atZero(it) ? 0 : l.price, shopPrice: l.shopPrice, markup: it.productId ? markupOf(x.pb, String(it.productId), vi) : null,
    supplierId: sid, supplierName: x.supplier(sid),
    buying: up ? 'up' : conf.state === 'confirmed' ? 'found' : conf.state === 'problem' ? 'notfound' : null,
    packed: it.pickStatus === 'short' ? Math.max(0, num(it.pickedQty)) : null,
    givenAway: it.givenAway && it.givenAway.why ? String(it.givenAway.why) : null,
    productId: it.productId ? String(it.productId) : null,
  };
}

export function mOrderOf(x: Ctx, q: Q): MOrder {
  const o = x.o.get(Number(q.id)) as Order, stage = stageOf(q), items: Row[] = Array.isArray(q.items) ? q.items : [];
  const holder = stage === 'preparing' ? q.assignedWorkerId : stage === 'pending_delivery' && q.assignedDeliveryId && !String(q.assignedDeliveryId).startsWith('__') ? q.assignedDeliveryId : null;
  return {
    id: Number(q.id), customerId: o.customerId, customerName: o.client.name, sellerId: x.staffOf(q.takenBy),
    stage, stageAt: o.stageAt, createdAt: o.placedAt,
    lines: items.map((it, i) => lineOfQ(x, q, o, it, i)),
    total: orderTotal(o), paid: whole(q.amountPaid), paidBy: mostPaidBy(o), holderId: holder ? String(holder) : null,
    deliveredAt: o.deliveredAt, invoiced: !!q.invoiced, invoiceNo: q.invoiced ? invoiceNo(Number(q.id)) : null,
    credit: !!(q.credit && num(q.credit.pct) > 0),
    driver: q.carrier && q.carrier.name ? String(q.carrier.name) : null,
    heldCode: heldCodeOf(x, q, o),
    twinOk: (Array.isArray(q.dupOkWith) ? q.dupOkWith : []).map(Number).filter((n: number) => n > 0),
    counter: !!(q.counter || q.counterSale),
  };
}

/**
 * The orders the screens show (§5 Q15 default: the orders in play and the queues only): every order
 * that can still change, and the rest of the last 60 days. Test orders (0167) are left out.
 */
export function ordersOf(x: Ctx, keep: Set<number>): MOrder[] {
  const since = x.now - 60 * 864e5;
  return x.qs.filter((q) => !q.qa && (inPlay(q) || keep.has(Number(q.id)) || (x.o.get(Number(q.id)) as Order).placedAt >= since)).map((q) => mOrderOf(x, q));
}

/* ---------------- the customers ---------------- */

function lookAlikes(x: Ctx): Map<string, { id: string; why: 'phone' | 'name' }> {
  const apart = new Set(x.raw.apart.map((r) => (r && r.ref && Array.isArray(r.ref.apart) ? r.ref.apart.map(String).sort().join('|') : '')).filter(Boolean));
  const out = new Map<string, { id: string; why: 'phone' | 'name' }>();
  const cs = x.raw.customers.filter((c) => !c.qa);
  const group = (why: 'phone' | 'name', key: (c: Row) => string) => {
    const by = new Map<string, Row[]>();
    cs.forEach((c) => { const k = key(c); if (k) by.set(k, [...(by.get(k) || []), c]); });
    by.forEach((list) => list.forEach((a) => list.forEach((b) => {
      const ka = String(a.id), kb = String(b.id);
      if (ka !== kb && !out.has(ka) && !apart.has([ka, kb].sort().join('|'))) out.set(ka, { id: kb, why });
    })));
  };
  group('phone', (c) => phone9(c.phone || ''));
  group('name', (c) => String(c.name || '').trim().toLowerCase());
  return out;
}

export function customersOf(x: Ctx): Cust[] {
  const salesOrders = [...x.o.values()], look = lookAlikes(x);
  const fresh = x.raw.fresh, old: Row = (fresh && fresh.old_debts) || {}, done: Row = (fresh && fresh.confirmed) || {};
  return x.raw.customers.map((r) => {
    const c = x.customers.get(String(r.id)) as Customer, w = x.owing(c.id);
    const mine = salesOrders.filter((o) => o.customerId === c.id && !o.qa).sort((a, b) => b.placedAt - a.placedAt);
    const sellers: string[] = [];
    mine.forEach((o) => { const sid = x.staffOf(o.placedBy); if (sid && !sellers.includes(sid)) sellers.push(sid); });
    return {
      id: c.id, name: c.name, initials: c.initials, phone: c.phone, place: c.place, owes: whole(r.debt),
      limit: num(r.credit_limit) > 0 ? whole(r.credit_limit) : null, termsDays: r.terms_days == null ? null : num(r.terms_days),
      bills: w.bills.map((b) => ({ orderId: b.orderId ?? 0, day: b.day, left: b.left })),
      promises: x.raw.promises.filter((p) => String(p.customer_id) === c.id).sort((a, b) => String(a.promised_on).localeCompare(String(b.promised_on)))
        .map((p) => {
          const pp = { on: String(p.promised_on), madeOn: String(p.made_on), amount: p.amount == null ? null : whole(p.amount) };
          return { id: String(p.id), ...pp, state: promiseState(pp, c, x.today) };
        }),
      sellers, orders: mine.length, lookAlike: look.get(c.id) || null,
      oldBooks: old[c.id] != null && !done[c.id] ? { amount: whole(old[c.id]), since: String((fresh && fresh.made_at) || '').slice(0, 10) } : null,
      qa: !!r.qa,
    };
  });
}

/* ---------------- the team ---------------- */

const ROLES: TeamRole[] = ['sales', 'buyer', 'store', 'accounts', 'sourcing', 'agent', 'driver', 'manager', 'owner'];
const teamRole = (r: unknown): TeamRole => (r === 'admin' ? 'owner' : r === 'staff' ? 'store' : ROLES.includes(r as TeamRole) ? (r as TeamRole) : 'store');

/** The newest open sales goal naming this login and covering today (manager_notes kind 'target'). */
function goalOf(x: Ctx, who: string): Row | null {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  return x.raw.targets.filter((r) => {
    const b: Row = r.body || {};
    return r.status === 'open' && String(b.who || '') === who && (b.metric || 'sales') === 'sales' && num(b.aim) > 0 && ISO.test(String(b.from || '')) && ISO.test(String(b.to || '')) && b.from <= x.today && x.today <= b.to;
  }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null;
}

/** Invoiced this month (not voided, not a test), as Sales totals an order. */
const billedThisMonth = (x: Ctx, q: Q): boolean => !!q.invoiced && !q.voided && !q.qa && dayOf(ms(q.invoiced_ts) || ms(q.invoicedAt) || ms(q.date) || 0) >= x.month;

export function teamOf(x: Ctx): Person[] {
  const members = new Map(x.raw.members.map((m) => [String(m.user_id), m]));
  const live = x.qs.filter(inPlay);
  const holds = (id: string, role: TeamRole, uid: string | null, off: boolean): string => {
    if (off) return 'Off';
    const packing = live.filter((q) => q.status === 'preparing' && String(q.assignedWorkerId || '') === id && q.pickingStatus !== 'done').length;
    if (packing) return `Packing ${packing}`;
    if (live.some((q) => q.status === 'pending_delivery' && String(q.assignedDeliveryId || '') === id)) return 'On the road';
    if (role === 'buyer') { const n = x.raw.trips.filter((t) => !t.voided && String(t.assigned_worker_id || '') === id && ['assigned', 'accepted', 'collected'].includes(t.status)).length; return n ? `${n} ${n === 1 ? 'trip' : 'trips'}` : ''; }
    if (role === 'sales' && uid) { const n = live.filter((q) => String(q.takenBy || '') === uid).length; return n ? `${n} ${n === 1 ? 'order' : 'orders'}` : ''; }
    return '';
  };
  const person = (id: string, uid: string | null, names: unknown[], roleRaw: unknown, off: boolean): Person => {
    const role = uid ? teamRole(roleRaw) : roleRaw === 'sales' || roleRaw === 'buyer' ? teamRole(roleRaw) : 'driver';
    const name = personName(names.map((n) => (n == null ? null : String(n))), null);
    const g = uid ? goalOf(x, uid) : null;
    const sold = uid ? x.qs.filter((q) => billedThisMonth(x, q) && String(q.takenBy || '') === uid).reduce((s, q) => s + orderTotal(x.o.get(Number(q.id)) as Order), 0) : 0;
    return {
      id, userId: uid, name, initials: initials(name), tint: uid && uid === x.s.userId ? 'me' : tintFor(name), role, off,
      goal: g ? whole(g.body.aim) : null, goalNoteId: g ? String(g.id) : null, sold, holds: holds(id, role, uid, off),
    };
  };
  const out = x.raw.staff.map((st) => {
    const uid = st.user_id ? String(st.user_id) : null, m = uid ? members.get(uid) : undefined;
    return person(String(st.id), uid, [m && m.display_name, st.name], m ? m.role : st.role, !!st.unavailable);
  });
  x.raw.members.filter((m) => !x.raw.staff.some((st) => String(st.user_id || '') === String(m.user_id)))
    .forEach((m) => out.push(person('user:' + String(m.user_id), String(m.user_id), [m.display_name], m.role, false)));
  // Agents who ask on an order (agent_id; the agents' own logins are not shop members).
  const agents = new Map<string, string>();
  x.raw.quotes.forEach((r) => { if (r.agent_id && !agents.has(String(r.agent_id))) agents.set(String(r.agent_id), String((r.payload && r.payload.originAgentName) || '')); });
  agents.forEach((name, id) => { const p = person('agent:' + id, null, [name], 'agent', false); out.push({ ...p, role: 'agent', name: p.name, holds: '' }); });
  return out;
}

/* ---------------- the shop, money in, today's answers ---------------- */

export function shopOf(x: Ctx, team: Person[]): Shop {
  const p = x.raw.presets || {}, d: Row = p.defaultMarkup || {};
  const own = goalOf(x, '');
  const goals = team.reduce((s, t) => s + (t.goal || 0), 0);
  const limits: Partial<Record<Stage, number>> = {};
  Object.entries((p.orderStageLimits || {}) as Row).forEach(([k, v]) => { if (STAGES.includes(k as Stage) && num(v) > 0) limits[k as Stage] = num(v); });
  return {
    name: x.s.shopName, goal: goals || (own ? whole(own.body.aim) : 0), holdDays: x.settings.holdDays, stageLimits: limits,
    defaultMarkup: d.wholesaleType !== 'fixed' && num(d.wholesaleValue) > 0 ? num(d.wholesaleValue) / 100 : 0,
    // The books keep no counter goal (no target names the counter): 0 until one does.
    counterGoal: 0,
    counterSold: x.qs.filter((q) => (q.counter || q.counterSale) && billedThisMonth(x, q)).reduce((s, q) => s + orderTotal(x.o.get(Number(q.id)) as Order), 0),
  };
}

/** Money in today, by account: receipts (receive_payment, counter_sale: 0169 type 'receipt'), test rows left out. */
export function inTodayOf(x: Ctx): ManagerBooks['inToday'] {
  const out = { cash: 0, momo: 0, bank: 0 };
  x.raw.cash.filter((t) => t.type === 'receipt' && !t.qa && String(t.date || '').slice(0, 10) === x.today).forEach((t) => {
    const k = t.account === 'momo' || t.account === 'bank' ? t.account : 'cash';
    out[k as 'cash' | 'momo' | 'bank'] += whole(t.amount);
  });
  return out;
}

/**
 * Today's answers, from the owner's log (decision_log, today, newest first). The log keeps a sentence
 * ("Approved Cement at 46,000 for Kato"), not the app's answer word nor who was told: the default is the
 * sentence as the word, the order and amount as the line under it, nobody told; 'auto' when the run wrote it.
 */
export function doneOf(x: Ctx): Done[] {
  return x.raw.log.map((r) => {
    const ref: Row = r.ref || {}, amt = r.amount == null ? null : whole(r.amount);
    const sub = [ref.table === 'saved_quotes' && ref.id != null ? orderNo(Number(ref.id)) : '', amt ? money(amt) : ''].filter(Boolean).join(' · ');
    return { at: ms(r.created_at) || 0, word: String(r.what || ''), sub, told: [], auto: r.role === 'auto' || !r.by };
  });
}

/** Everything, as last read. */
export function booksOf(raw: Raw, s: MSession, now: Ms): ManagerBooks {
  const x = ctxOf(raw, s, now);
  const team = teamOf(x);
  const asks = asksOf(x);
  const keep = new Set(asks.map((a) => a.orderId).filter((n): n is number => n != null));
  const me = team.find((p) => p.userId === s.userId) || {
    id: s.staffId || 'user:' + s.userId, userId: s.userId, name: s.name, initials: initials(s.name), tint: 'me' as const, role: teamRole(s.role),
    off: false, goal: null, goalNoteId: null, sold: 0, holds: '',
  };
  return {
    at: now, me, shop: shopOf(x, team), team, customers: customersOf(x), orders: ordersOf(x, keep), asks,
    restock: restockOf(x), inToday: inTodayOf(x), done: doneOf(x),
  };
}

/** The account most of an order's money came in by (a refund goes back the same way); null with none paid. */
function mostPaidBy(o: Order): 'cash' | 'momo' | 'bank' | null {
  const by = new Map<string, number>();
  (o.payments || []).forEach((p) => by.set(p.method, (by.get(p.method) || 0) + p.amount));
  const best = [...by.entries()].sort((x, y) => y[1] - x[1])[0];
  return best ? (best[0] as 'cash' | 'momo' | 'bank') : null;
}
