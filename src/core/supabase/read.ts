/*
 * Reading the books, the reads sales.html makes (boot 4832-4876, loadAll
 * 3911-3958, loadWA 4059-4068, loadThread 4070-4079, chLoadPresence 9862).
 * Same tables, same filters; only what the Sales screens use is mapped.
 *
 * Not read here (sales.html reads them; no Sales canvas board needs them yet):
 * suppliers, product_links, collection_trips, statements_sent,
 * buyer_handoffs (item switches: the Orders tab adds them when it needs "Tell them").
 */
import { dataError } from '../datasource.ts';
import { dayOf } from '../time.ts';
import type { Books, ChatBooks, Customer, Goal, Role, Session, Thread } from '../types.ts';
import { isNetwork, type Row, type Sb } from './client.ts';
import {
  askOf, billAskOf, chatOf, customerOf, eventOf, heldOf, itemsOf, membersOf, messageOf, noteOf, orderOf,
  paymentAskOf, paymentOf, priceBookOf, promiseOf, settingsOf,
} from './rows.ts';

/** sales.html:3866 selectAll: a whole table for the shop, 1,000 rows a page, by key. */
async function selectAll(sb: Sb, shopId: string, table: string, keyCol: string = 'id', filter?: (q: Sb) => Sb): Promise<Row[]> {
  let rows: Row[] = [], total: number | null = null;
  for (;;) {
    let q: Sb = sb.from(table).select('*', total === null ? { count: 'exact' } : undefined).eq('shop_id', shopId);
    if (filter) q = filter(q);
    if (rows.length) q = q.gt(keyCol, rows[rows.length - 1][keyCol]);
    const r: Row = await q.order(keyCol, { ascending: true }).limit(1000);
    if (r.error) throw r.error;
    if (total === null) total = typeof r.count === 'number' ? r.count : null;
    const page = r.data || [];
    rows = rows.concat(page);
    if (!page.length || (total !== null && rows.length >= total)) break;
  }
  return rows;
}

const quiet = <T>(p: Promise<T>, empty: T): Promise<T> => p.then((x) => x, () => empty);
const data = (r: { data?: Row[] | null; error?: unknown }): Row[] => (r && !r.error && r.data) || [];

/**
 * Who is signed in, and to which shop (sales.html:4833-4858 boot): the login, then their
 * shop_members rows; Sales opens for sales, owner, admin or manager. More than one such shop:
 * the first (the shop picker is the shell's to draw when it is needed).
 */
export async function readSession(sb: Sb): Promise<Session | null> {
  const { data: u, error: ue } = await sb.auth.getUser();
  const user = !ue && u && u.user ? u.user : null;
  if (!user) {
    if (isNetwork(ue)) throw dataError('offline', 'No signal');
    return null;
  }
  let { data: ms, error } = await sb.from('shop_members').select('shop_id, role, display_name, shops(name, created_at)').eq('user_id', user.id);
  // Before 0164 there is no display_name: the same read without it.
  if (error && /display_name/.test(String(error.message || ''))) ({ data: ms, error } = await sb.from('shop_members').select('shop_id, role, shops(name, created_at)').eq('user_id', user.id));
  if (error) throw isNetwork(error) ? dataError('offline', 'No signal') : dataError('refused', String(error.message || error));
  const pick = ((ms || []) as Row[]).find((m) => ['sales', 'owner', 'admin', 'manager'].includes(m.role));
  if (!pick) throw dataError('refused', 'This login is not in Sales', 'role');
  const meta = user.user_metadata || {};
  return {
    userId: String(user.id), shopId: String(pick.shop_id), shopName: String((pick.shops && pick.shops.name) || 'The shop'), role: pick.role as Role,
    name: String(pick.display_name || meta.full_name || meta.name || String(user.email || '').split('@')[0]),
  };
}

/** sales.html:3884 monthStartISO, in Kampala (spec 02 Q13). */
function monthStart(now: number): string {
  return dayOf(now).slice(0, 8) + '01';
}

/** The books, as sales.html loadAll reads them. */
export async function readBooks(sb: Sb, s: Session, now: number): Promise<Books> {
  const id = s.shopId;
  const [customers, debtLog, products, prices, stock, lots, quotes, settingsR, cash, staff, targetsR, membersR, presenceR, promises, billAsks, payAsks, leads] = await Promise.all([
    selectAll(sb, id, 'customers'), selectAll(sb, id, 'customer_debt_log'), selectAll(sb, id, 'products'), selectAll(sb, id, 'prices'),
    selectAll(sb, id, 'stock', 'key'), selectAll(sb, id, 'stock_lots'), selectAll(sb, id, 'saved_quotes'),
    sb.from('app_settings').select('presets').eq('shop_id', id).maybeSingle(),
    selectAll(sb, id, 'cash_txns', 'id', (q) => q.gte('date', monthStart(now))),
    quiet(selectAll(sb, id, 'staff'), [] as Row[]),
    // The salesperson's goal: the owner's open targets (0085 kind 'target'); the Manager sets them (goal.set).
    quiet(sb.from('manager_notes').select('*').eq('shop_id', id).eq('kind', 'target').eq('status', 'open').limit(50), { data: [] }),
    // Who holds which role (display_name since 0164).
    quiet(sb.from('shop_members').select('user_id, role, display_name').eq('shop_id', id), { data: [] }),
    quiet(sb.from('member_presence').select('*').eq('shop_id', id), { data: [] }),
    quiet(selectAll(sb, id, 'payment_promises'), [] as Row[]),
    quiet(sb.from('invoice_asks').select('*').eq('shop_id', id).gte('created_at', new Date(now - 120 * 864e5).toISOString()), { data: [] }),
    quiet(sb.from('payment_asks').select('*').eq('shop_id', id).gte('created_at', new Date(now - 60 * 864e5).toISOString()), { data: [] }),
    quiet(sb.from('sourcing_leads').select('id, name, status, voided, product_id, assigned_staff_id, created_at, stage_entered_at, requests, candidates').eq('shop_id', id).eq('voided', false).limit(1000), { data: [] }),
  ]);
  const presets: Row = (settingsR && settingsR.data && settingsR.data.presets) || {};
  const pb = priceBookOf(products, prices, stock, lots, presets.defaultMarkup || {});
  const logBy = new Map<string, Row[]>();
  debtLog.forEach((l) => { const k = String(l.customer_id); if (!logBy.has(k)) logBy.set(k, []); (logBy.get(k) as Row[]).push(l); });
  const custs: Customer[] = customers.map((c) => customerOf(c, logBy.get(String(c.id)) || []));
  const orders = quotes.map((q) => orderOf(q, pb));
  const txnCustomer = new Map<number, string>();
  debtLog.forEach((l) => { if (l.cash_txn_id != null) txnCustomer.set(Number(l.cash_txn_id), String(l.customer_id)); });
  const orderCustomer = new Map(orders.map((o) => [o.id, o.customerId]));
  const members = membersOf(data(membersR), staff, data(presenceR), s.userId);
  const me = members.find((m) => m.id === s.userId) || { id: s.userId, name: s.name, initials: s.name.slice(0, 2).toUpperCase(), role: s.role, tint: 'me' as const, presence: 'on' as const, presenceSince: now, inChat: null, typingIn: null };
  // sales.html:6559 myTarget: my own open sales target covering today, the newest; none of my own → none
  // (the shop's goal stands in only when it names nobody: the Today tab may add that).
  const today = dayOf(now), ISO = /^\d{4}-\d{2}-\d{2}$/;
  const t = data(targetsR).filter((r) => { const b = (r.body || {}) as Row; return String(b.who || '') === s.userId && b.metric === 'sales' && Number(b.aim) > 0 && ISO.test(String(b.from || '')) && ISO.test(String(b.to || '')) && b.from <= today && today <= b.to; })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
  const goal: Goal | null = t ? { from: String(t.body.from), to: String(t.body.to), target: Number(t.body.aim) } : null;
  return {
    at: now,
    shop: { id, name: s.shopName },
    settings: settingsOf(presets),
    me, members, customers: custs, orders,
    items: itemsOf(pb, heldOf(orders)),
    // Money in: the receipts receive_payment and counter_sale write (0169: type 'receipt').
    payments: cash.filter((t) => t.type === 'receipt').map((t) => paymentOf(t, txnCustomer, orderCustomer)),
    promises: promises.map(promiseOf),
    asks: data(leads).map(askOf),
    billAsks: data(billAsks).map(billAskOf),
    paymentAsks: data(payAsks).map(paymentAskOf),
    goal,
  };
}

/** sales.html:4059 loadWA: the newest 100 chats and 500 messages; wa-send says whether the number is connected. */
export async function readChats(sb: Sb, shopId: string, customers: Customer[], now: number): Promise<ChatBooks> {
  const [cR, mR] = await Promise.all([
    sb.from('wa_conversations').select('*').eq('shop_id', shopId).order('last_message_at', { ascending: false }).limit(100),
    sb.from('wa_messages').select('*').eq('shop_id', shopId).order('sent_at', { ascending: false }).limit(500),
  ]);
  if (cR.error) throw isNetwork(cR.error) ? dataError('offline', 'No signal') : cR.error;
  if (mR.error) throw isNetwork(mR.error) ? dataError('offline', 'No signal') : mR.error;
  let connected = false;
  try { const { data: st } = await sb.functions.invoke('wa-send', { body: { shopId, action: 'status' } }); connected = !!(st && st.configured); } catch (_e) { connected = false; }
  return { at: now, connected, chats: (cR.data || []).map((c: Row) => chatOf(c, customers)), recent: (mR.data || []).slice().reverse().map(messageOf) };
}

/** sales.html:4070 loadThread: the chat's 300 messages, its team notes and what happened to it (0170). */
export async function readThread(sb: Sb, chatId: number): Promise<Thread> {
  const { data: msgs, error } = await sb.from('wa_messages').select('*').eq('conversation_id', chatId).order('sent_at', { ascending: true }).limit(300);
  if (error) throw isNetwork(error) ? dataError('offline', 'No signal') : error;
  const [nR, eR] = await Promise.all([
    quiet(sb.from('wa_notes').select('*').eq('conversation_id', chatId).order('created_at', { ascending: true }).limit(200), { data: [] }),
    quiet(sb.from('wa_conv_events').select('*').eq('conversation_id', chatId).order('created_at', { ascending: true }).limit(100), { data: [] }),
  ]);
  return { chatId, messages: (msgs || []).map(messageOf), notes: data(nR).map(noteOf), events: data(eR).map(eventOf) };
}
