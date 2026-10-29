/*
 * Writing to the books, the writes sales.html makes, each with its line:
 * the same tables, RPCs and edge functions. Never a new backend path
 * without its migration: an order is placed through place_order (0180, spec
 * 05 Q3) and a cancel is asked through ask_cancel (0181). On a database
 * without them the write says so ('missing') and nothing is sent.
 */
import { dataError, type CounterPay, type CounterResult, type OrderDraft, type PayArgs, type PayResult } from '../datasource.ts';
import { invoiceNo } from '../names.ts';
import { orderPayload } from '../orders.ts';
import type { BillAsk, ChatNote, Customer, CustomerKind, Day, Message, Order, PayPromise, PaymentAsk, Session, SourcingAsk, Stage, UGX } from '../types.ts';
import { isMissing, isNetwork, type Row, type Sb } from './client.ts';
import { askOf, billAskOf, cancelAskOf, customerOf, messageOf, paymentAskOf, promiseOf } from './rows.ts';

/** A failed call, classified (sales.html isNetworkError, rpcMissing; the server's five-letter codes). */
function fail(e: unknown): never {
  const x = e as { message?: string; code?: string } | null;
  if (isNetwork(e)) throw dataError('offline', 'No signal');
  if (isMissing(e)) throw dataError('missing', String(x?.message || e), String(x?.code || ''));
  const m = String(x?.message || e);
  throw dataError('refused', m.replace(/^[A-Z0-9]{5}: /, ''), (m.match(/^([A-Z0-9]{5}):/) || [])[1] || String(x?.code || ''));
}

async function ok<T = Row>(p: Promise<{ data: T; error: unknown }>): Promise<T> {
  let r: { data: T; error: unknown };
  try { r = await p; } catch (e) { return fail(e); }
  if (r.error) fail(r.error);
  return r.data;
}

/** sales.html:4031 issueRowId: a row id from the server's block (next_row_id_blocks, 0138). */
async function rowId(sb: Sb, s: Session, kind: string, floor: number): Promise<number> {
  const data = await ok<Row>(sb.rpc('next_row_id_blocks', { p_shop_id: s.shopId, p_kinds: [kind], p_count: 1, p_floors: { [kind]: floor } }));
  const v = data && data[kind];
  if (v == null) throw dataError('refused', 'No id came back for ' + kind);
  return Number(v);
}

/** sales.html:3966 ordPatch: an order changes by the keys that change, merged on the server (ow_patch_order, 0165). */
export async function patchOrder(sb: Sb, s: Session, id: number, patch: Row, name: string | null = null, phone: string | null = null): Promise<void> {
  await ok(sb.rpc('ow_patch_order', { p_shop_id: s.shopId, p_id: id, p_patch: patch, p_client_name: name, p_client_phone: phone }));
}

/**
 * place_order (0180): numbered and placed in one write on the server, as sales.html:8718 slide:place
 * inserted it, and every guard on saved_quotes still judges it. The draft's key places it once. The
 * server keeps from the payload only what Sales decides; it writes the number, the date, the times,
 * who took it, nothing paid and the shop's Credit charge pct itself.
 */
export async function placeOrder(sb: Sb, s: Session, d: OrderDraft, stage: Stage, now: number): Promise<number> {
  const payload = orderPayload(d, stage, s.userId, now);
  const row = { client_name: d.client.name || 'Walk-in', client_phone: d.client.phone || null, status: stage === 'packing' ? 'preparing' : 'draft', payload };
  const r = await ok<Row>(sb.rpc('place_order', { p_shop_id: s.shopId, p_row: row, p_key: d.key || null }));
  if (!r || !r.ok || r.id == null) throw dataError('refused', 'The order did not go through');
  return Number(r.id);
}

/** sales.html:9281 payRpc: the transaction ID rides only when typed; before 0155 the write goes again without it. */
async function rpcWithRef(sb: Sb, fn: string, args: Row, ref: string): Promise<Row> {
  if (!ref) return ok<Row>(sb.rpc(fn, args));
  const r = await sb.rpc(fn, { ...args, p_ref: ref }).then((x: Row) => x, (e: unknown) => ({ data: null, error: e }));
  if (r.error && /p_ref|PGRST202|Could not find the function|does not exist/i.test(String(r.error.message || '') + ' ' + String(r.error.code || ''))) return ok<Row>(sb.rpc(fn, args));
  if (r.error) fail(r.error);
  return r.data;
}

/** sales.html:11023 ctSell: the whole counter sale is one write (counter_sale, 0136/0155). */
export async function counterSale(sb: Sb, s: Session, d: OrderDraft, pay: CounterPay, now: number): Promise<{ id: number; invoice: string; paid: UGX; change: UGX; waiting: 'price' | null }> {
  const payload = orderPayload(d, 'checking', s.userId, now);
  const row = { client_name: d.client.name || 'Walk-in', client_phone: d.client.phone || null, payload: { client: payload.client, items: payload.items, charges: payload.charges, credit: payload.credit, customerId: d.customerId } };
  const ref = pay.method === 'cash' ? '' : String(pay.ref || '').trim().slice(0, 40);
  const r = await rpcWithRef(sb, 'counter_sale', { p_shop_id: s.shopId, p_quote_id: null, p_row: row, p_method: pay.method, p_given: Number(pay.given) || 0 }, ref);
  if (!r || !r.ok) throw dataError('refused', 'the sale did not go through');
  return { id: Number(r.id), invoice: r.invoice || invoiceNo(Number(r.id)), paid: Number(r.pay) || 0, change: Number(r.change) || 0, waiting: r.waiting === 'price' ? 'price' : null };
}

export type CounterOut = Omit<CounterResult, 'order'>;

/** sales.html:9221 slide:pay and 9254 payOrderSlide: one write, receive_payment (0140, 0165, 0169). */
export async function receivePayment(sb: Sb, s: Session, a: PayArgs): Promise<PayResult & { rows: Row[] }> {
  const ref = a.method === 'cash' ? '' : String(a.ref || '').trim().slice(0, 40);
  const args: Row = { p_shop_id: s.shopId, p_customer_id: a.orderId != null ? null : a.customerId, p_amount: Math.round(a.amount), p_method: a.method, p_picks: a.picks, p_order_id: a.orderId };
  // 0165: p_over is sent only when there is something to say, so a database before 0165 still takes the payment (sales.html:3600).
  if (a.over) args.p_over = a.over;
  const d = (await rpcWithRef(sb, 'receive_payment', args, ref)) || {};
  return { payments: [], amount: Number(d.amount) || 0, before: Number(d.before) || 0, after: Number(d.after) || 0, deposit: Number(d.deposit) || 0, change: 0, rows: d.cashRows || [] };
}

/** sales.html:6104 ordMarkTold: priceToldAt on each line whose changed price they have not been told. */
export async function markPriceTold(sb: Sb, s: Session, orderId: number, now: number): Promise<void> {
  const cur = await ok<Row>(sb.from('saved_quotes').select('payload').eq('shop_id', s.shopId).eq('id', orderId).maybeSingle());
  if (!cur) throw dataError('refused', 'That order is not on the server');
  const at = new Date(now).toISOString();
  const items = ((cur.payload || {}).items || []).map((it: Row) => (it.priceReview && it.priceReview.state === 'changed' && !(Date.parse(it.priceToldAt || '') >= Date.parse(String(it.priceReview.at)) || Number(it.priceToldAt) >= Number(it.priceReview.at)) ? { ...it, priceToldAt: at } : it));
  await patchOrder(sb, s, orderId, { items });
}

/** sales.html:5820 ordphsave: the order's phone, as the server holds the client now. */
export async function setClientPhone(sb: Sb, s: Session, orderId: number, phone: string): Promise<void> {
  const cur = await ok<Row>(sb.from('saved_quotes').select('payload').eq('shop_id', s.shopId).eq('id', orderId).maybeSingle());
  const client = { ...((cur && cur.payload && cur.payload.client) || {}), phone };
  await patchOrder(sb, s, orderId, { client }, null, phone);
}

/** sales.html:6283: an ask to the Manager about a bill (invoice_asks, 0123). */
export async function askBill(sb: Sb, s: Session, o: Order, a: { kind: 'void' | 'credit'; amount: UGX; reason: string; note: string }): Promise<BillAsk> {
  const row = {
    shop_id: s.shopId, quote_id: o.id, customer_id: o.customerId, kind: a.kind, lines: [], amount: Math.round(a.amount),
    reason: a.kind === 'void' && !a.reason ? 'Raised twice' : a.reason || null, note: a.note.trim() || null,
    asked_by: s.userId, asked_by_name: s.name, asked_role: s.role, status: 'sent',
  };
  const r = await ok<Row>(sb.from('invoice_asks').insert(row).select().maybeSingle());
  return billAskOf(r || { ...row, id: 'local-' + Date.now(), created_at: new Date().toISOString() });
}

export async function withdrawBillAsk(sb: Sb, id: string): Promise<void> {
  await ok(sb.rpc('withdraw_invoice_ask', { p_id: id }));
}

/** ask_cancel (0181): ask the Manager to cancel your own order before its invoice; asked again, the same ask comes back. */
export async function askCancel(sb: Sb, s: Session, o: Order, why: string): Promise<BillAsk> {
  const r = await ok<Row>(sb.rpc('ask_cancel', { p_shop_id: s.shopId, p_order: o.id, p_why: why, p_note: null }));
  if (!r || !r.ok || !r.id) throw dataError('refused', 'The ask did not go through');
  return cancelAskOf({ id: r.id, quote_id: o.id, customer_id: o.customerId, why, amount: r.amount, status: r.status || 'sent', asked_by: s.userId, created_at: r.at });
}

/** withdraw_cancel_ask (0181): the asker takes it back while it waits; again is no harm. */
export async function withdrawCancelAsk(sb: Sb, id: string): Promise<void> {
  await ok(sb.rpc('withdraw_cancel_ask', { p_id: id }));
}

/** sales.html:7213: a promise to pay (payment_promises, 0089; promise.record 0121). */
export async function recordPromise(sb: Sb, s: Session, a: { customerId: string; on: Day; amount: UGX | null }, maxId: number, today: Day): Promise<PayPromise> {
  const id = await rowId(sb, s, 'row:payment_promise', maxId);
  const row = { shop_id: s.shopId, id, customer_id: a.customerId, promised_on: a.on, made_on: today, amount: a.amount, note: '' };
  await ok(sb.from('payment_promises').insert(row));
  return promiseOf(row);
}

/** sales.html:11218: an ask to Accounts to correct a payment (payment_asks, 0130); amount is the payment as recorded. */
export async function askPaymentFix(sb: Sb, s: Session, a: { paymentId: number; what: string; want: Row; note: string; amount: UGX; customerId: string | null; orderId: number | null }): Promise<PaymentAsk> {
  const row = {
    shop_id: s.shopId, cash_txn_id: a.paymentId, customer_id: a.customerId, quote_id: a.orderId, amount: Math.round(a.amount), what: a.what, want: a.want,
    note: a.note || null, asked_by: s.userId, asked_by_name: s.name, asked_role: s.role, status: 'sent',
  };
  const r = await ok<Row>(sb.from('payment_asks').insert(row).select().maybeSingle());
  return paymentAskOf(r || { ...row, id: 'local-' + Date.now(), created_at: new Date().toISOString() });
}

export async function withdrawPaymentAsk(sb: Sb, id: string): Promise<void> {
  await ok(sb.rpc('withdraw_payment_ask', { p_id: id }));
}

/** sales.html:7690: a customer id from next_entity_id ('C', 3), then one insert; before 0170 without kind. */
export async function addCustomer(sb: Sb, s: Session, a: { name: string; phone: string; place: string; kind: CustomerKind | null }, floor: number): Promise<Customer> {
  const id = String(await ok(sb.rpc('next_entity_id', { p_shop_id: s.shopId, p_kind: 'customer', p_prefix: 'C', p_pad: 3, p_floor: floor })));
  const row: Row = { id, shop_id: s.shopId, name: a.name, phone: a.phone, location: a.place, notes: '', debt: 0, kind: a.kind };
  let r = await sb.from('customers').insert(row).then((x: Row) => x, (e: unknown) => ({ error: e }));
  if (r.error && /kind/.test(String(r.error.message || '')) && /column|schema/i.test(String(r.error.message || ''))) { delete row.kind; r = await sb.from('customers').insert(row).then((x: Row) => x, (e: unknown) => ({ error: e })); }
  if (r.error) fail(r.error);
  return customerOf(row, []);
}

/** sales.html:10618 srcWrite: one lead per item; asked again adds a request to it, as the server has it now. */
export async function askSourcing(sb: Sb, s: Session, a: { name: string; qty: number; customerId: string | null; chatId: number | null }, existingId: string | null, now: number): Promise<SourcingAsk> {
  const ask = { at: new Date(now).toISOString(), source: 'sourcing.ask', customerId: a.customerId, customerName: '', phone: '', variant: '', qty: a.qty || 1, orderId: null, conversationId: a.chatId, note: '', by: s.userId, salesName: s.name };
  if (existingId) {
    const cur = await ok<Row>(sb.from('sourcing_leads').select('*').eq('shop_id', s.shopId).eq('id', existingId).maybeSingle());
    const requests = ((cur && cur.requests) || []).concat([ask]);
    await ok(sb.from('sourcing_leads').update({ requests }).eq('shop_id', s.shopId).eq('id', existingId));
    return askOf({ ...(cur || {}), requests });
  }
  const row = { id: 'SRC-' + now.toString(36).toUpperCase(), shop_id: s.shopId, name: a.name, notes: '', status: 'asked', created_at: new Date(now).toISOString(), stage_entered_at: now, requests: [ask], candidates: [] };
  await ok(sb.from('sourcing_leads').insert(row));
  return askOf(row);
}

/** sales.html:8160: a search that found nothing (log_search_miss, 0146). Never waits, never fails out loud. */
export function logSearchMiss(sb: Sb, s: Session, words: string, client: string | null): void {
  try { Promise.resolve(sb.rpc('log_search_miss', { p_shop_id: s.shopId, p_words: words, p_source: 'sales', p_order_id: null, p_client: client })).catch(() => {}); } catch (_e) { /* fire and forget */ }
}

/** sales.html:4300 waErr: the edge function's own reason. */
async function waReason(error: Row): Promise<string> {
  let m = String(error.message || error);
  try { const b = await error.context.json(); if (b && b.error) m = b.error; } catch (_e) { /* the plain message */ }
  return m;
}

/** sales.html:4301 waSendText and 4325 waSendReplyTemplate: wa-send, which refuses a shut 24-hour window. */
export async function waSend(sb: Sb, s: Session, chatId: number, text: string, template: boolean, now: number): Promise<Message> {
  let res: Row;
  try {
    res = await sb.functions.invoke('wa-send', { body: template ? { shopId: s.shopId, action: 'send-reply-template', conversationId: chatId, text, name: s.name } : { shopId: s.shopId, action: 'send', conversationId: chatId, text } });
  } catch (e) { return fail(e); }
  if (res.error) {
    const why = await waReason(res.error);
    if (isNetwork(why) || /Failed to send a request/i.test(why)) throw dataError('offline', 'No signal');
    throw dataError(/Unknown action/i.test(why) ? 'missing' : 'refused', why);
  }
  if (template && !(res.data && res.data.sent)) throw dataError('refused', 'the send was refused');
  return messageOf({ id: 'sent-' + now, conversation_id: chatId, sent_at: new Date(now).toISOString(), direction: 'out', msg_type: template ? 'template' : 'text', body: text, sent_by: s.userId, status: 'sent' });
}

/** sales.html:10407: a team note, never sent (wa_notes, 0170). */
export async function addNote(sb: Sb, s: Session, chatId: number, body: string, now: number): Promise<ChatNote> {
  await ok(sb.from('wa_notes').insert({ shop_id: s.shopId, conversation_id: chatId, body, by_user: s.userId, by_name: s.name, mentions: [] }));
  return { id: 'n' + now, chatId, at: now, by: s.userId, body };
}

/** sales.html:9959 take_conversation (chat.take); 10436 hand_conversation (your own customer). */
export async function takeChat(sb: Sb, chatId: number): Promise<void> {
  await ok(sb.rpc('take_conversation', { p_conv: chatId }));
}
export async function giveChat(sb: Sb, chatId: number, to: string, note: string): Promise<void> {
  await ok(sb.rpc('hand_conversation', { p_conv: chatId, p_to: to, p_note: note.trim() || null }));
}

/** sales.html:4192 waMarkRead: the one column of a chat the browser may write. */
export async function markRead(sb: Sb, chatId: number, now: number): Promise<void> {
  await ok(sb.from('wa_conversations').update({ last_read_at: new Date(now).toISOString() }).eq('id', chatId));
}

/** sales.html:9866 chTouch: touch_presence, fire and forget. */
export function touch(sb: Sb, s: Session, chatId: number | null, typing: boolean): void {
  try { Promise.resolve(sb.rpc('touch_presence', { p_shop_id: s.shopId, p_conv: chatId, p_typing: typing })).catch(() => {}); } catch (_e) { /* fire and forget */ }
}

/** sales.html:10452 chat_served (0170). */
export async function served(sb: Sb, s: Session, chatId: number): Promise<{ by: string; name: string; messages: number }[]> {
  const rows = await ok<Row[]>(sb.rpc('chat_served', { p_shop_id: s.shopId, p_conv: chatId }));
  return (rows || []).map((r) => ({ by: String(r.user_id), name: String(r.name || ''), messages: Number(r.messages) || 0 }));
}
