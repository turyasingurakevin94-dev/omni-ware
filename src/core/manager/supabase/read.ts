/*
 * The Manager's reads (docs/spec/04-screens-manager-data.md §1), as manager.html loadAll
 * (1185) and refreshLive (1282) make them, with what the contract changes:
 *
 *   one Promise.all snapshot of §1b, plus R30 store_asks (§1e, never read by the old app)
 *   live(): the orders that can still change (the live filter) AND every queue a decision
 *           reads (R19–R22, R24, R25, R28, R30) and the customers, over the last snapshot (§1d's gap)
 *   R13 the cash book: today's money in only (§5 Q14: read only what a screen shows)
 *   not read: R17 statements_sent, R23 rival_prices (no ManagerBooks field needs them yet)
 *
 * A table a database may not have yet reads as empty; no signal is said, never read as empty (§1b).
 * The client, the session and the error classing are the shared core's (src/core/supabase).
 */
import { dataError } from '../../datasource.ts';
import { isNetwork, type Row, type Sb } from '../../supabase/client.ts';
import { readSession, selectAll } from '../../supabase/read.ts';
import { ok } from '../../supabase/write.ts';
import { at, dayOf } from '../../time.ts';
import type { Session } from '../../types.ts';

/** Roles let in (manager.html:2240 R2). */
export const MANAGER_ROLES = ['manager', 'owner', 'admin'];

/** Every row the books are made from, as last read. rows.ts and asks.ts turn them into ManagerBooks. */
export interface Raw {
  quotes: Row[];
  customers: Row[];
  debtLog: Row[];
  products: Row[];
  prices: Row[];
  stock: Row[];
  lots: Row[];
  presets: Row;
  /** Today's cash book (R13, cut to today). */
  cash: Row[];
  staff: Row[];
  members: Row[];
  suppliers: Row[];
  trips: Row[];
  targets: Row[];
  promises: Row[];
  invoiceAsks: Row[];
  counts: Row[];
  reports: Row[];
  restock: Row[];
  yardNotes: Row[];
  payAsks: Row[];
  fresh: Row | null;
  /** decision_log customer.edit lines (R27): "Not the same" pairs. */
  apart: Row[];
  cancelAsks: Row[];
  storeAsks: Row[];
  /** Today's decision log, newest first (Today's answers). */
  log: Row[];
}

/** The Manager's login: the shared session, and the staff row it holds (R4), if any. */
export interface MSession extends Session {
  email: string;
  staffId: string | null;
}

const net = (e: unknown): never => { throw isNetwork(e) ? dataError('offline', 'No signal') : e; };

/** A read of a table a database may not have yet: none on an error, except no signal (§1b). */
async function opt(p: Promise<{ data?: Row[] | Row | null; error?: unknown }> | PromiseLike<{ data?: Row[] | Row | null; error?: unknown }>): Promise<Row[]> {
  let r: { data?: Row[] | Row | null; error?: unknown };
  try { r = await p; } catch (e) { return net(e); }
  if (r.error) { if (isNetwork(r.error)) net(r.error); return []; }
  return Array.isArray(r.data) ? r.data : r.data ? [r.data] : [];
}

/** A whole table the books must have: an error is said, never read as empty. */
async function all(sb: Sb, shop: string, table: string, key = 'id', filter?: (q: Sb) => Sb): Promise<Row[]> {
  try { return await selectAll(sb, shop, table, key, filter); } catch (e) { return net(e); }
}

/** The same for a table older databases lack (store_asks before 0157, cancel_asks before 0181 …). */
async function allOpt(sb: Sb, shop: string, table: string, key = 'id', filter?: (q: Sb) => Sb): Promise<Row[]> {
  try { return await selectAll(sb, shop, table, key, filter); } catch (e) { if (isNetwork(e)) net(e); return []; }
}

/** R1, R2, R4: the login, its shop, and its staff row. */
export async function readManagerSession(sb: Sb, prefer: string | null = null): Promise<MSession | null> {
  const s = await readSession(sb, MANAGER_ROLES, 'the Manager', prefer);
  if (!s) return null;
  const [staff, auth] = await Promise.all([
    opt(sb.from('staff').select('id').eq('shop_id', s.shopId).eq('user_id', s.userId).limit(1)),
    Promise.resolve(sb.auth.getSession()).then((r: Row) => r, () => null),
  ]);
  const user: Row | null = auth && auth.data && auth.data.session ? auth.data.session.user : null;
  return { ...s, email: String((user && user.email) || ''), staffId: staff[0] ? String(staff[0].id) : null };
}

/** The live filter (manager.html:1276 liveQuoteFilter): what can still change. */
export function liveFilter(now: number): (q: Sb) => Sb {
  return (q) => q.or('status.neq.completed,invoiced.eq.false,voided.eq.true,invoiced_ts.gte.' + new Date(now - 2 * 864e5).toISOString());
}

/** The queues and the customers: read by the snapshot and again by every live read. */
async function readQueues(sb: Sb, id: string): Promise<Pick<Raw, 'customers' | 'invoiceAsks' | 'counts' | 'reports' | 'restock' | 'yardNotes' | 'payAsks' | 'cancelAsks' | 'storeAsks' | 'trips'>> {
  const now = Date.now();
  const [customers, trips, invoiceAsks, counts, reports, restock, yardNotes, payAsks, cancelAsks, storeAsks] = await Promise.all([
    all(sb, id, 'customers'),
    all(sb, id, 'collection_trips'),
    opt(sb.from('invoice_asks').select('*').eq('shop_id', id).eq('status', 'sent').limit(200)),
    opt(sb.from('stock_counts').select('*').eq('shop_id', id).order('created_at', { ascending: false }).limit(40)),
    opt(sb.from('stock_reports').select('*').eq('shop_id', id).eq('status', 'sent').limit(200)),
    opt(sb.from('restock_buys').select('*').eq('shop_id', id).in('status', ['planned', 'held']).limit(300)),
    opt(sb.from('buyer_handoffs').select('*').eq('shop_id', id).eq('for_role', 'manager').eq('kind', 'yard_note').eq('status', 'open').limit(200)),
    opt(sb.from('payment_asks').select('*').eq('shop_id', id).gte('created_at', new Date(now - 60 * 864e5).toISOString())),
    opt(sb.from('cancel_asks').select('*').eq('shop_id', id).eq('status', 'sent').limit(200)),
    // R30 (§1e): the Store's "Not on the list · keep it?" (0157).
    opt(sb.from('store_asks').select('*').eq('shop_id', id).eq('kind', 'extra').eq('status', 'sent').limit(200)),
  ]);
  return { customers, trips, invoiceAsks, counts, reports, restock, yardNotes, payAsks, cancelAsks, storeAsks };
}

/** The start of today in Kampala, as the database's timestamps write it. */
const todayStart = (now: number): string => new Date(at(dayOf(now), '00:00')).toISOString();

/** §1b + R30: everything, in one Promise.all. */
export async function readSnapshot(sb: Sb, s: MSession, now: number): Promise<Raw> {
  const id = s.shopId, today = dayOf(now);
  const [queues, quotes, debtLog, products, prices, stock, lots, settings, cash, staff, members, suppliers, targets, promises, fresh, apart, log] = await Promise.all([
    readQueues(sb, id),
    all(sb, id, 'saved_quotes'),
    all(sb, id, 'customer_debt_log'),
    all(sb, id, 'products'),
    all(sb, id, 'prices'),
    all(sb, id, 'stock', 'key'),
    allOpt(sb, id, 'stock_lots'),
    opt(sb.from('app_settings').select('presets').eq('shop_id', id).maybeSingle()),
    allOpt(sb, id, 'cash_txns', 'id', (q) => q.eq('date', today)),
    allOpt(sb, id, 'staff'),
    opt(sb.from('shop_members').select('user_id, role, display_name').eq('shop_id', id)),
    allOpt(sb, id, 'suppliers'),
    opt(sb.from('manager_notes').select('*').eq('shop_id', id).eq('kind', 'target').in('status', ['open', 'ended']).order('date', { ascending: false }).limit(100)),
    allOpt(sb, id, 'payment_promises'),
    opt(sb.from('fresh_starts').select('old_debts, confirmed, made_at').eq('shop_id', id).maybeSingle()),
    opt(sb.from('decision_log').select('ref').eq('shop_id', id).eq('task', 'customer.edit').limit(500)),
    opt(sb.from('decision_log').select('*').eq('shop_id', id).gte('created_at', todayStart(now)).order('created_at', { ascending: false }).limit(100)),
  ]);
  return {
    ...queues, quotes, debtLog, products, prices, stock, lots, presets: (settings[0] && settings[0].presets) || {},
    cash, staff, members, suppliers, targets, promises, fresh: fresh[0] || null, apart, log,
  };
}

/** §1d, the gap closed: the orders that can change, merged over the last; every queue and the customers again. */
export async function readLive(sb: Sb, s: MSession, last: Raw, now: number): Promise<Raw> {
  const [queues, quotes, log] = await Promise.all([
    readQueues(sb, s.shopId),
    all(sb, s.shopId, 'saved_quotes', 'id', liveFilter(now)),
    opt(sb.from('decision_log').select('*').eq('shop_id', s.shopId).gte('created_at', todayStart(now)).order('created_at', { ascending: false }).limit(100)),
  ]);
  const byId = new Map(last.quotes.map((r) => [Number(r.id), r]));
  quotes.forEach((r) => byId.set(Number(r.id), r));
  return { ...last, ...queues, quotes: [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id)), log };
}

/** §1c: one order as the books hold it now (every order write re-reads it first). */
export async function readOrderRow(sb: Sb, s: Pick<Session, 'shopId'>, id: number): Promise<Row | null> {
  return ok<Row | null>(sb.from('saved_quotes').select('*').eq('shop_id', s.shopId).eq('id', Number(id)).maybeSingle());
}

/** One row of a queue, re-read before an answer that has no function of its own to refuse twice. */
export async function readOne(sb: Sb, s: Pick<Session, 'shopId'>, table: string, id: string): Promise<Row | null> {
  return ok<Row | null>(sb.from(table).select('*').eq('shop_id', s.shopId).eq('id', id).maybeSingle());
}
