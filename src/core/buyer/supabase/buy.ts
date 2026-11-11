/*
 * What the trip buys, worked out as buyer.html does (docs/spec/04-screens-buyer-data.md §4a, §4c).
 * Pure: raw rows in. The real source plans and starts a round from these
 * runs, so what the books show as the planned trip is what gets written.
 *
 *   rankedAtQty     buyer.html:949 rankedPurchaseRowsAtQty (921, 932, 942)
 *   outlay          956 ipLineOutlay: a supplier with no retail price sells whole packs only
 *   confirmedBest   1247: the line's own supplier said yes → buy there at the agreed price
 *   runsToGo        1336 (no restock lines: the "what to buy" page is not designed)
 *   roundOrder      1467: areas with the most to buy first, then each area's stops biggest first
 *   stem            4081 tripRoundStem: a round is the trips sharing an id stem (spec §7 #4)
 */
import type { Row } from '../../supabase/client.ts';
import { agedOff, boughtIn, confirmState, received, type Q } from './order.ts';

export interface PriceRow {
  id: string; productId: string; variantIdx: number | null; supplierId: string;
  wholesale: number | null; retail: number | null; date: string | null; unit: string; packUnit: string; packQty: number;
  outOfStock: boolean; tiers: Row[];
}

/** buyer.html:777 rowToPrice. */
export function priceRowOf(p: Row): PriceRow {
  return {
    id: p.id, productId: p.product_id, variantIdx: p.variant_idx == null || p.variant_idx === '' ? null : Number(p.variant_idx), supplierId: p.supplier_id,
    wholesale: p.wholesale == null ? null : Number(p.wholesale), retail: p.retail == null ? null : Number(p.retail), date: p.date || null,
    unit: p.unit || '', packUnit: p.pack_unit || '', packQty: Number(p.pack_qty) || 0, outOfStock: !!p.out_of_stock, tiers: Array.isArray(p.tiers) ? p.tiers : [],
  };
}

type Side = 'wholesale' | 'retail';
export const productRows = (rows: PriceRow[], pid: string, vi: unknown): PriceRow[] => {
  const v = vi == null || vi === '' ? null : Number(vi);
  return rows.filter((r) => r.productId === pid && r.variantIdx === v);
};
const tiersFor = (r: PriceRow, kind: Side): Row[] => r.tiers.filter((t) => (kind === 'wholesale' ? r.packQty > 0 && t.minQty >= r.packQty : r.packQty === 0 || t.minQty < r.packQty));
function tiered(r: PriceRow, qty: number, kind: Side): number | null {
  const base = r[kind], tiers = tiersFor(r, kind);
  let best = base, bestMin = 0;
  tiers.forEach((t) => { if (t.price != null && qty >= t.minQty && t.minQty >= bestMin) { best = Number(t.price); bestMin = t.minQty; } });
  return best;
}
export function priceAtQty(r: PriceRow, qty: number): number | null {
  const nat: Side = r.packQty > 0 && qty >= r.packQty ? 'wholesale' : 'retail';
  const p = tiered(r, qty, nat);
  return p != null ? p : tiered(r, qty, nat === 'wholesale' ? 'retail' : 'wholesale');
}
const inf = (n: number | null): number => (n != null ? n : Infinity);
export function rankedAtQty(rows: PriceRow[], pid: string, vi: unknown, qty: number): (PriceRow & { purchasePrice: number | null })[] {
  return productRows(rows, pid, vi).filter((r) => !r.outOfStock)
    .sort((a, b) => inf(a.wholesale) - inf(b.wholesale) || inf(a.retail) - inf(b.retail))
    .map((r) => ({ ...r, purchasePrice: priceAtQty(r, qty) }))
    .sort((a, b) => inf(a.purchasePrice) - inf(b.purchasePrice));
}
export function outlay(r: PriceRow | null, qty: number): { units: number; rate: number; forcedPack: boolean } | null {
  if (!r || !(qty > 0)) return null;
  const units = r.retail == null && r.packQty > 0 ? Math.ceil(qty / r.packQty) * r.packQty : qty;
  const nat: Side = r.packQty > 0 && units >= r.packQty ? 'wholesale' : 'retail';
  let rate = tiered(r, units, nat);
  if (rate == null) rate = tiered(r, units, nat === 'wholesale' ? 'retail' : 'wholesale');
  return rate == null ? null : { units, rate, forcedPack: units > qty };
}

function confirmedBest(q: Q, it: Row, qty: number, rows: PriceRow[]): (PriceRow & { purchasePrice: number }) | null {
  const sid = it.supplierId;
  if (!boughtIn(it) || confirmState(q, sid).state !== 'confirmed') return null;
  const ranked = rankedAtQty(rows, it.productId, it.variantIdx, qty).find((r) => String(r.supplierId) === String(sid));
  const own = productRows(rows, it.productId, it.variantIdx).find((r) => String(r.supplierId) === String(sid));
  const row = ranked || (own ? { ...own, purchasePrice: priceAtQty(own, qty) } : null);
  const agreed = it.repricedAt && Number(it.price) > 0;
  const price = agreed ? Number(it.price) : row && row.purchasePrice != null ? row.purchasePrice : Number(it.price) > 0 ? Number(it.price) : null;
  if (price == null) return null;
  return { ...(row || { id: '', productId: it.productId, variantIdx: null, wholesale: null, retail: null, date: null, unit: '', packUnit: '', packQty: 0, outOfStock: false, tiers: [] }), supplierId: sid, purchasePrice: price };
}

/** buyer.html:1323 tripsCoveringLine (a trip line with no lineId matches the same item on the same order). */
export const tripLive = (t: Row): boolean => !!t && !t.voided && t.status !== 'confirmed';
export function tripsCovering(trips: Row[], q: Q | null, orderId: unknown, lineId: unknown): Row[] {
  const idless = (l: Row) => l.lineId == null || l.lineId === '' || l.lineId === 'undefined';
  const it: Row = (q && (q.items || []).find((x: Row) => String(x.lineId) === String(lineId))) || {};
  return trips.filter((t) => tripLive(t) && (Array.isArray(t.lines) ? t.lines : []).some((l: Row) => {
    if (String(l.orderId) !== String(orderId)) return false;
    if (String(l.lineId) === String(lineId)) return true;
    if (!idless(l) || !/^L\d+-\d+$/.test(String(lineId))) return false;
    return String(l.productId) === String(it.productId) && String(l.variantIdx == null ? '' : l.variantIdx) === String(it.variantIdx == null ? '' : it.variantIdx);
  }));
}

export interface RunLine { q: Q; it: Row; qty: number; unitCost: number; lineCost: number }
export interface Run { supplierId: string; total: number; lines: RunLine[] }

/** buyer.html:1223 cartonGate: a forced pack whose shelf part is over 10× the sale waits for the Manager's OK. */
function cartonWaits(q: Q, it: Row, need: number, out: { units: number; forcedPack: boolean } | null, restock: Row[]): boolean {
  if (!out || !out.forcedPack || !(need > 0)) return false;
  if (!(out.units - need > need * 10)) return false;
  const r = restock.filter((x) => x.for_line === q.id + ':' + it.lineId).slice(-1)[0];
  return !r || r.status === 'held' || r.status === 'cancelled';
}

/** buyer.html:1256 orderPurchaseLines + 1298 buyingListRuns + 1336 runsToGo, for orders past Checking. */
export function runsToGo(quotes: Q[], trips: Row[], rows: PriceRow[], restock: Row[], now: number): Run[] {
  const by = new Map<string, Run>();
  quotes.filter((q) => (q.status === 'awaiting_goods' || q.status === 'preparing') && !q.voided && !agedOff(q, now)).forEach((q) => {
    (q.items || []).filter(boughtIn).forEach((it: Row) => {
      const need = Number(it.qty) || 0;
      const best = confirmedBest(q, it, need, rows) || rankedAtQty(rows, it.productId, it.variantIdx, need).find((r) => r.purchasePrice != null) || null;
      if (!best || best.purchasePrice == null) return;
      const unitCost = Math.round(best.purchasePrice), out = outlay(best, need), got = received(it);
      const qty = got ? Number(it.receivedQty) : out ? out.units : need;
      const outstanding = got ? Math.max(0, need - Number(it.receivedQty)) : qty;
      const lineCost = unitCost * outstanding;
      if (!(lineCost > 0) || cartonWaits(q, it, need, got ? null : out, restock)) return;
      if (tripsCovering(trips, q, q.id, it.lineId).length) return;
      const sid = String(best.supplierId);
      if (!by.has(sid)) by.set(sid, { supplierId: sid, total: 0, lines: [] });
      const run = by.get(sid) as Run;
      run.total += lineCost; run.lines.push({ q, it, qty, unitCost, lineCost });
    });
  });
  return [...by.values()].sort((a, b) => b.total - a.total);
}

/** buyer.html:3454 locParts. */
export const locParts = (location: unknown): string[] => String(location || '').split(',').map((x) => x.trim()).filter(Boolean);

/** buyer.html:3456 roundAreas + 3467 roundOrder. */
export function roundOrder(runs: Run[], suppliers: Row[]): Run[] {
  const parts = runs.map((r) => locParts((suppliers.find((s) => String(s.id) === String(r.supplierId)) || {}).location));
  const key = (p: string) => p.toLowerCase(), area = new Map<Run, string>();
  runs.forEach((r, i) => {
    const shared = parts[i].find((p) => runs.some((_, j) => j !== i && parts[j].some((x) => key(x) === key(p))));
    area.set(r, shared || parts[i][parts[i].length - 1] || 'Other');
  });
  const by = new Map<string, Run[]>();
  runs.forEach((r) => { const a = (area.get(r) as string).toLowerCase(); by.set(a, [...(by.get(a) || []), r]); });
  const sum = (g: Run[]) => g.reduce((s, r) => s + r.total, 0);
  return [...by.values()].sort((a, b) => sum(b) - sum(a)).flatMap((g) => g.sort((a, b) => b.total - a.total));
}

/** buyer.html:4081 tripRoundStem. */
export function stem(id: unknown): string {
  const m = String(id || '').match(/^(TRIP-[A-Za-z0-9]+)-[0-9]+$/);
  return m ? m[1] : String(id || '');
}

/** buyer.html:1376 a trip line's answer: null = not answered, 0 is an answer. */
export function gotOf(l: Row): number | null {
  const n = Number(l && l.gotQty);
  return l && l.gotQty != null && isFinite(n) && n >= 0 ? n : null;
}
/** buyer.html:1382 tripLinePaid / 1383 tripPlanned. */
export const linePaid = (l: Row): number => { const g = gotOf(l); return g == null ? 0 : g * (Number(l.gotPrice != null ? l.gotPrice : l.expectedPrice) || 0); };
export const tripPlanned = (t: Row): number => (Array.isArray(t.lines) ? t.lines : []).reduce((s: number, l: Row) => s + (Number(l.qty) || 0) * (Number(l.expectedPrice) || 0), 0);
/** buyer.html:4063 tripPlanFor: an unanswered line counts in full. */
export const tripPlanFor = (t: Row): number => (Array.isArray(t.lines) ? t.lines : []).reduce((s: number, l: Row) => s + (gotOf(l) != null ? linePaid(l) : (Number(l.qty) || 0) * (Number(l.expectedPrice) || 0)), 0);
