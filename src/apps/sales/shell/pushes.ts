/*
 * Where a tapped push opens (docs/spec/06-offline-sync-push.md §6b, Q8, Q9): one map, push kind → a
 * ROUTES.md id with its params, read from the push's data. test/sales-push-routes.test.js pairs it
 * with every kind the migrations send to Sales and with ROUTES.md.
 *
 * A push's data is what push-send (supabase/functions/push-send) puts in it: `kind`, then the outbox
 * row's `ref`, every value a string; a ref naming saved_quotes also gives its id as `orderId`. So:
 *
 *   an order's own push       { table: 'saved_quotes', id, orderId }          orderId
 *   item.switch, trip.short   { table: 'buyer_handoffs' | …, id, orderId }    orderId
 *   an ask about an order     { table: 'invoice_asks' | 'cancel_asks', id, quote }   quote
 *   a chat                    { table: 'wa_conversations', id }               id
 *   a customer                { table: 'customers', id }                      id
 *   request.listed            { table: 'sourcing_leads', id }                 id
 *   payment.ask.decided       { table: 'payment_asks', id }                   id, then the copy
 *
 * A push whose id is missing opens the list it lives in (sales.html:4932 pushOpen does the same).
 * A kind not here leaves the app where it is.
 *
 * Plain data and functions only (no Preact, no store): Node runs this file as it is for the test.
 * shell/open-push.ts does the opening.
 */
import type { Books } from '../../../core/types.ts';

/** A push's data as it arrives: every value a string. */
export type PushData = Record<string, string | undefined>;

export interface PushRoute {
  id: string;
  params: Record<string, string | number>;
}

export interface PushOpen {
  /** The data key this kind's page is named by (the test checks the migrations' ref gives it). */
  key: string;
  /** The page; `v` is the key's value, '' when the push did not carry it. */
  open(v: string, b: Books | null): PushRoute;
  /** The page is found through the phone's copy of the books: it waits for the copy once. */
  copy?: boolean;
}

const route = (id: string, params: Record<string, string | number> = {}): PushRoute => ({ id, params });

const order: PushOpen = { key: 'orderId', open: (v) => (v ? route('orders/order', { id: Number(v) }) : route('orders')) };
const askedOrder: PushOpen = { key: 'quote', open: (v) => (v ? route('orders/order', { id: Number(v) }) : route('orders')) };
const chat: PushOpen = { key: 'id', open: (v) => (v ? route('chats/chat', { id: Number(v) }) : route('chats')) };

/**
 * A payment ask Accounts answered: the push names only the ask (payment_asks.id), so the copy says
 * what it was about: its order, else its customer, else the day's money (sales.html:4952).
 */
const paymentAsk: PushOpen = {
  key: 'id',
  copy: true,
  open(v, b) {
    const a = v && b ? b.paymentAsks.find((x) => x.id === v) : undefined;
    if (a && a.orderId != null) return route('orders/order', { id: a.orderId });
    if (a && a.customerId) return route('customers/customer', { id: a.customerId });
    return route('today/day', { view: 'money' });
  },
};

/** Every push the migrations send to a salesperson (§6b), by kind. */
export const PUSHES: Record<string, PushOpen> = {
  'price.decided': order,
  'credit.decided': order,
  'price.changed': order,
  'line.dropped': order,
  'item.switch': order,
  'order.invoiced': order,
  'order.cancelled': order,
  'trip.short': order,
  'invoice.ask.decided': askedOrder,
  'order.cancel.ask.decided': askedOrder,
  'payment.ask.decided': paymentAsk,
  'request.listed': { key: 'id', open: (v) => (v ? route('today/asks', { id: v }) : route('today/asks')) },
  'chat.handed': chat,
  'chat.note': chat,
  'chat.reply_by_other': chat,
  'customer.changed': { key: 'id', open: (v) => (v ? route('customers/customer', { id: v }) : route('customers')) },
};

/** The page a push opens, or null for a kind the app has no page for. */
export function routeOf(d: PushData, b: Books | null): PushRoute | null {
  const p = PUSHES[String(d.kind || '')];
  if (!p) return null;
  const v = String(d[p.key] ?? '').trim();
  return p.open(/^[\w-]+$/.test(v) ? v : '', b);
}

/* ---- a push in the page's address: the service worker's tap (#push=…) and the demo's (?demo&push=…) ---- */

/** The address part that names a push: `push=<kind>&<key>=<value>…`. */
export function pushQuery(d: PushData): string {
  const q = new URLSearchParams();
  q.set('push', String(d.kind || ''));
  Object.keys(d).forEach((k) => { const v = d[k]; if (k !== 'kind' && v != null) q.set(k, v); });
  return q.toString();
}

/** A push named in a query or hash ("?demo&push=chat.note&id=101", "#push=…"), or null. */
export function pushFrom(part: string): PushData | null {
  const q = new URLSearchParams(part.replace(/^[?#]/, ''));
  const kind = q.get('push');
  if (!kind) return null;
  const d: PushData = { kind };
  q.forEach((v, k) => { if (k !== 'push') d[k] = v; });
  return d;
}
