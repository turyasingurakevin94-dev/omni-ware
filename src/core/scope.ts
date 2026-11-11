/*
 * What a Sales write is about, for the outbox's order (SAL-3, docs/audit/cross-app/ROUND-1.md;
 * spec 06 §7): writes on one order, draft, customer or chat go in the order they were made; a write
 * on another thing never waits behind them. Anything not listed keeps the one line ('*').
 */
import type { ScopeOf } from './outbox.ts';

const CHAT = ['send', 'sendTemplate', 'sendImage', 'sendCatalog'];
const ORDER = ['counterLines', 'markPriceTold', 'setClientPhone', 'assignOrder', 'askCancel'];

type Obj = Record<string, unknown>;
const first = (args: unknown): unknown => (Array.isArray(args) ? args[0] : args);

export const salesScope: ScopeOf = (kind, args) => {
  const a = first(args);
  if (CHAT.includes(kind) && a != null) return 'chat:' + String(a);
  if (ORDER.includes(kind) && a != null) return 'order:' + String(a);
  const o = (a && typeof a === 'object' ? a : {}) as Obj;
  if ((kind === 'placeOrder' || kind === 'counterSale') && o.key) return 'draft:' + String(o.key);
  if (kind === 'askBill' && o.orderId != null) return 'order:' + String(o.orderId);
  if (kind === 'receivePayment') return o.customerId ? 'customer:' + String(o.customerId) : o.orderId != null ? 'order:' + String(o.orderId) : '*';
  if (kind === 'recordPromise' && o.customerId) return 'customer:' + String(o.customerId);
  if ((kind === 'withdrawBillAsk' || kind === 'withdrawPaymentAsk') && a != null) return 'ask:' + String(a);
  if (kind === 'askPaymentFix' && o.paymentId != null) return 'payment:' + String(o.paymentId);
  if (kind === 'addCustomer') return 'customer:new:' + String(o.name || '');
  if (kind === 'askSourcing') return 'sourcing:' + String(o.name || '');
  return '*';
};
