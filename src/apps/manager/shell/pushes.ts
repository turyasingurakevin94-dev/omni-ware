/*
 * A tapped push opens the decision it is about (spec 04-screens-manager §2 "Push routes"): one map,
 * from the push's kind and its ref (push-send copies ref into data: table, id; orderId for an order).
 * The ask is found by its row: an ask's key is '<kind>:<row id>' (src/core/manager/supabase/asks.ts),
 * an order's asks by their orderId. Answered already: the order opens, or Today says so.
 */
import type { ManagerBooks } from '../../../core/manager/types.ts';
import type { Params } from '../../../ui/stack.ts';

export interface Opens { id: string; params: Params; gone?: boolean }
type Data = Record<string, unknown>;

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function pushRoute(kind: string, data: Data, b: ManagerBooks | null, waiting: string[]): Opens {
  const table = String(data.table || ''), rowId = data.id == null ? '' : String(data.id);
  const orderId = num(data.orderId ?? (table === 'saved_quotes' ? data.id : null));
  if (kind === 'payment.ask.decided') {
    const c = String(data.customerId ?? data.customer_id ?? '');
    return c ? { id: 'money/customer', params: { customer: c } } : { id: 'money', params: {} };
  }
  if (kind.startsWith('team.') || kind === 'goal.set') return { id: 'team', params: {} };
  const asks = b ? b.asks.filter((a) => waiting.includes(a.key)) : [];
  const byRow = rowId ? asks.find((a) => a.key.split(':')[1] === rowId) : undefined;
  const byOrder = orderId != null ? asks.find((a) => a.orderId === orderId) : undefined;
  const hit = byRow || byOrder;
  if (hit) return { id: 'decide', params: { id: hit.key } };
  if (orderId != null) return { id: 'orders/order', params: { id: orderId }, gone: true };
  return { id: 'today', params: {}, gone: true };
}
