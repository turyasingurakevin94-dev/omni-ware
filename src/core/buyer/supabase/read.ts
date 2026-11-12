/*
 * Reading the books the way buyer.html does (docs/spec/04-screens-buyer-data.md §1):
 * the same tables, the same paged read (src/core/supabase/read.ts selectAll),
 * read whole, as buyer.html:807 loadAll does (§7 #9 asks for windows; until
 * Kevin answers, the same reads).
 *
 * Read only for what the designed pages need: no stock, stock_lots,
 * purchase_invoices, app_settings or store_asks (the shelf, the supplier
 * score, restock: not designed). restock_buys is read for one rule only: a
 * carton waiting on the Manager's OK stays off the trip (buyer.html:1223).
 */
import { dataError } from '../../datasource.ts';
import type { Session } from '../../types.ts';
import { isNetwork, type Row, type Sb } from '../../supabase/client.ts';
import { readSession, selectAll } from '../../supabase/read.ts';
import { loadKeep } from './keep.ts';
import type { Raw } from './rows.ts';

/** buyer.html:1640 chooseShop: buyer, owner, admin and manager logins open it. */
export const BUYER_ROLES = ['buyer', 'owner', 'admin', 'manager'];

export const readBuyerSession = (sb: Sb): Promise<Session | null> => readSession(sb, BUYER_ROLES, 'the Buyer app');

/** A read that failed, classified (no signal / the server said no). */
export function readFail(e: unknown): never {
  if (isNetwork(e)) throw dataError('offline', 'No signal');
  const x = e as { message?: string; code?: string } | null;
  throw dataError('refused', String((x && x.message) || e), String((x && x.code) || ''));
}

const quiet = (p: Promise<Row[]>): Promise<Row[]> => p.then((x) => x, () => []);

function phonesOf(shopId: string): Record<string, string> {
  try { const v = JSON.parse(localStorage.getItem('ow-buyer-phones:' + shopId) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_e) { return {}; }
}

/** buyer.html:807 loadAll, less what no designed page reads. */
export async function readRaw(sb: Sb, s: Session, now: number): Promise<Raw> {
  const id = s.shopId;
  try {
    const [suppliers, products, prices, quotes, trips, staff, agents, handoffs, restock, membersR, cancelR] = await Promise.all([
      selectAll(sb, id, 'suppliers'), selectAll(sb, id, 'products'), selectAll(sb, id, 'prices'), selectAll(sb, id, 'saved_quotes'),
      // buyer.html reads these as empty when the table is missing (.catch(() => [])).
      quiet(selectAll(sb, id, 'collection_trips')), quiet(selectAll(sb, id, 'staff')), quiet(selectAll(sb, id, 'agents')),
      quiet(selectAll(sb, id, 'buyer_handoffs')), quiet(selectAll(sb, id, 'restock_buys')),
      // The team's names (display_name since 0164), as Sales reads them.
      sb.from('shop_members').select('user_id, role, display_name').eq('shop_id', id).then((r: Row) => (r && !r.error && r.data) || [], () => []),
      // X-1: orders Sales asked the Manager to cancel, still waiting (0181; none before it).
      sb.from('cancel_asks').select('quote_id').eq('shop_id', id).eq('status', 'sent').then((r: Row) => (r && !r.error && r.data) || [], () => []),
    ]);
    return { session: s, cancelAsked: (cancelR as Row[]).map((x) => Number(x.quote_id)), members: membersR, staff, agents, suppliers, products, prices, quotes, trips, handoffs, restock, phones: phonesOf(id), keep: loadKeep(s.userId, id), now };
  } catch (e) { return readFail(e); }
}

/** One row, as the server has it now (buyer.html:2436 changeOrder, 4013 flushTrip). */
export async function readRow(sb: Sb, s: Session, table: 'saved_quotes' | 'collection_trips', id: unknown): Promise<Row | null> {
  let r: Row;
  try { r = await sb.from(table).select('*').eq('shop_id', s.shopId).eq('id', id).maybeSingle(); } catch (e) { return readFail(e); }
  if (r.error) readFail(r.error);
  return r.data || null;
}

/** buyer.html:2473 readAppAnswers: the newest supplier-app answer per order and supplier, 14 days back. */
export async function readAppAnswers(sb: Sb, s: Session, now: number): Promise<Row[]> {
  try {
    const r = await sb.from('supplier_answers').select('id, order_id, supplier_id, state, terms, changes, note, at')
      .eq('shop_id', s.shopId).gte('at', new Date(now - 14 * 864e5).toISOString()).order('at');
    if (r.error || !Array.isArray(r.data)) return [];   // no 0132 yet
    const latest = new Map<string, Row>();
    r.data.forEach((a: Row) => latest.set(String(a.order_id) + '|' + String(a.supplier_id), a));
    return [...latest.values()];
  } catch (_e) { return []; }
}
