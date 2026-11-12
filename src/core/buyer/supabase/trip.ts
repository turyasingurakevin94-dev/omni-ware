/*
 * The buying trip's writes, as buyer.html makes them (docs/spec/04-screens-buyer-data.md
 * §3 W12–W19, §4c). One collection_trips row per stop; a round is the stops
 * sharing an id stem (TRIP-<base36>-n, §7 #4: the server's ow_trip_round does
 * the same). The round always goes with the Buyer as its runner and on the
 * cash Accounts handed over: sending it to someone else, a supplier delivery
 * and the Buyer's own money are not in the designed pages.
 *
 * "Done here" and what was paid stay on the phone until the hand-in, as in
 * buyer.html (keep.ts); the hand-in writes them to collection_trips.pay (0151).
 */
import { dataError } from '../../datasource.ts';
import type { Session, UGX } from '../../types.ts';
import type { Row, Sb } from '../../supabase/client.ts';
import { selectAll } from '../../supabase/read.ts';
import { ok } from '../../supabase/write.ts';
import { paidShares } from '../rules.ts';
import type { StopCount } from '../source.ts';
import { gotOf, priceRowOf, roundOrder, runsToGo, stem, tripPlanFor, type Run } from './buy.ts';
import { setOff, setStopPay } from './keep.ts';
import { buyable, quoteOf } from './order.ts';
import { readFail, readRow } from './read.ts';
import { liveRound, myStaffOf, pendingCashAsk, type Raw } from './rows.ts';
import { passOn, withdraw } from './write.ts';

const firstWord = (n: unknown): string => String(n || '').trim().split(/\s+/)[0] || '';
const shortName = (raw: Raw, sid: string): string => firstWord((raw.suppliers.find((x) => String(x.id) === String(sid)) || {}).name);
const namesOf = (raw: Raw, sids: string[]): string => {
  const n = sids.map((x) => shortName(raw, x));
  return n.length > 2 ? n.slice(0, 2).join(', ') + ' +' + (n.length - 2) : n.join(' and ');
};
const runsOf = (raw: Raw, trips: Row[] = raw.trips): Run[] => roundOrder(runsToGo(raw.quotes.map(quoteOf).filter(buyable(raw.cancelAsked)), trips, raw.prices.map(priceRowOf), raw.restock, raw.now), raw.suppliers);
const roundCash = (raw: Raw, rid: string): Row | null => raw.handoffs.filter((h) => h.kind === 'trip_cash' && h.status !== 'withdrawn' && String((h.payload || {}).round || '') === rid).slice(-1)[0] || null;

/** W12 buyer.html:3861 cashask (and 4481 tcashask for a round already out with no cash ask). */
export async function askCash(sb: Sb, s: Session, raw: Raw): Promise<void> {
  const live = liveRound(raw);
  if (live) {
    const rid = stem(live[0].id);
    if (roundCash(raw, rid)) throw dataError('refused', 'The cash for this trip is already asked', 'asked');
    const sids = live.map((x) => String(x.supplier_id));
    const v = Math.round(live.filter((x) => !x.voided && x.status === 'collecting').reduce((a, x) => a + tripPlanFor(x), 0));
    await passOn(sb, s, 'trip_cash', 'accounts', 'round:' + crypto.randomUUID().slice(0, 8), { supplierId: sids[0], supplierIds: sids, supplier: namesOf(raw, sids), stops: live.length, amount: v, for: s.name, roundOf: live[0].id, round: rid, v: 2 });
    return;
  }
  const runs = runsOf(raw).filter((r) => !raw.keep.off.includes(r.supplierId));
  if (!runs.length) throw dataError('refused', 'Put a stop back to send', 'nostops');
  const old = pendingCashAsk(raw, null);
  if (old && old.status === 'done') throw dataError('refused', 'The cash is handed over', 'given');
  // A changed sum replaces the open ask, so Accounts never sees two.
  if (old) await withdraw(sb, s, old.id);
  const sids = runs.map((r) => r.supplierId);
  await passOn(sb, s, 'trip_cash', 'accounts', 'round:' + crypto.randomUUID().slice(0, 8), {
    supplierId: sids[0], supplierIds: sids, supplier: namesOf(raw, sids), stops: runs.length, amount: Math.round(runs.reduce((t, r) => t + r.total, 0)), for: s.name, v: 2,
  });
}

/** W17a buyer.html:4449 dropStop: the stop is called off; the cash it carried moves to a stop that stays. */
async function dropStop(sb: Sb, s: Session, x: Row, note: string, keep: Row | null): Promise<void> {
  const cash = x.cash_given != null ? Number(x.cash_given) : null;
  if (keep && cash != null && cash > 0) {
    const k = (await readRow(sb, s, 'collection_trips', keep.id)) || keep;
    await ok(sb.from('collection_trips').update({ cash_given: (Number(k.cash_given) || 0) + cash }).eq('shop_id', s.shopId).eq('id', k.id));
  }
  await ok(sb.from('collection_trips').update({ voided: true, note, ...(keep && cash != null ? { cash_given: 0 } : {}) }).eq('shop_id', s.shopId).eq('id', x.id));
  setStopPay(s.userId, String(x.id), null);
}

/**
 * The planned trip's stops on or off. Before the cash ask, kept on the phone (buyer.html planSel). Changing
 * the stops while the ask waits withdraws it (the sum changed: ask again). On the road, a stop off is W17a.
 */
export async function setStopOff(sb: Sb, s: Session, raw: Raw, sid: string, off: boolean): Promise<void> {
  const live = liveRound(raw);
  if (live) {
    if (!off) throw dataError('refused', 'Its lines go back to the plan for the next trip', 'off');
    const x = live.find((t) => !t.voided && t.status === 'collecting' && String(t.supplier_id) === String(sid));
    if (!x) throw dataError('refused', 'That stop is not on the trip');
    const open = (t: Row) => t.id !== x.id && !t.voided && t.status === 'collecting' && !(raw.keep.pay[t.id] || {}).done;
    await dropStop(sb, s, x, 'Off the trip', live.find(open) || live.find((t) => t.id !== x.id && !t.voided) || null);
    return;
  }
  const ask = pendingCashAsk(raw, null);
  if (ask && ask.status === 'done') throw dataError('refused', 'The cash is handed over for these stops', 'given');
  const next = off ? [...raw.keep.off, sid] : raw.keep.off.filter((x) => x !== String(sid));
  if (off && !runsOf(raw).some((r) => !next.includes(r.supplierId))) throw dataError('refused', 'A trip needs one stop at least', 'nostops');
  if (ask) await withdraw(sb, s, ask.id);
  setOff(s.userId, s.shopId, next);
}

/** W13 buyer.html:3938 slide:trip, the Buyer as runner on Accounts' cash: one trip per stop, in round order. */
async function startRound(sb: Sb, s: Session, raw: Raw, now: number): Promise<Row[]> {
  let trips: Row[];
  try { trips = await selectAll(sb, s.shopId, 'collection_trips'); } catch (e) { return readFail(e); }
  const fresh: Raw = { ...raw, trips };
  const ask = pendingCashAsk(fresh, null);
  if (!ask) throw dataError('refused', 'Ask Accounts for the cash first', 'nocash');
  if (ask.status !== 'done') throw dataError('refused', 'Waiting for Accounts to hand over the cash', 'nocash');
  const me = myStaffOf(raw);
  if (!me) throw dataError('refused', 'You are not on the team yet: the owner adds you', 'nostaff');
  const sids = ((ask.payload || {}).supplierIds || []).map(String);
  const runs = runsOf(fresh, trips).filter((r) => sids.includes(r.supplierId));
  if (!runs.length) throw dataError('refused', 'Somebody is already on the way for those stops', 'taken');
  const stamp = now.toString(36).toUpperCase(), given = Number((ask.payload || {}).amount) || 0;
  let left = given;
  const rows = runs.map((run, i) => {
    const at = new Date(now + i).toISOString();
    const cash = i === runs.length - 1 ? Math.max(0, left) : Math.min(run.total, Math.max(0, left));
    left -= cash;
    return {
      id: 'TRIP-' + stamp + (runs.length > 1 ? '-' + (i + 1) : ''), shop_id: s.shopId, supplier_id: run.supplierId, status: 'collecting', assigned_worker_id: me.id,
      created_at: at, assigned_at: at, accepted_at: at, collected_at: null, confirmed_at: null, note: null, voided: false, cash_given: cash,
      lines: run.lines.map((l) => ({
        orderId: l.q.id, lineId: l.it.lineId, productId: l.it.productId, variantIdx: l.it.variantIdx == null ? null : l.it.variantIdx,
        productName: l.it.productName || 'Item', unit: l.it.unit || '', packUnit: l.it.packUnit || '', packQty: Number(l.it.packQty) || 0, qtyIn: l.it.qtyIn || '',
        clientName: (l.q.client && l.q.client.name) || 'Unnamed client', qty: l.qty, expectedPrice: l.unitCost, gotQty: null, gotPrice: null,
      })),
    };
  });
  for (const r of rows) await ok(sb.from('collection_trips').insert(r));
  // The cash belongs to this round from now on (0151).
  await ok(sb.from('buyer_handoffs').update({ payload: { ...(ask.payload || {}), round: stem(rows[0].id), v: 2 } }).eq('shop_id', s.shopId).eq('id', ask.id));
  setOff(s.userId, s.shopId, []);
  return rows;
}

/**
 * W15 + W17 buyer.html:4013 flushTrip, 4433 markStopDone: what came is written to the stop's lines, then the stop
 * is done on this phone with what was paid. Each line's price paid (gotPrice) is its share of that payment
 * (rules.paidShares, the rule the Hand in screen shows), so got × gotPrice adds up to what was really paid
 * and the order's cost in the books is the screen's. The first stop starts the round (W13).
 * The designed page takes no receipt photo: the stop is kept as "no receipt" (spec §7).
 */
export async function stopDone(sb: Sb, s: Session, raw: Raw, sid: string, counts: StopCount[], paid: UGX, now: number): Promise<void> {
  const round = liveRound(raw) || await startRound(sb, s, raw, now);
  const x = round.find((t) => !t.voided && t.status === 'collecting' && String(t.supplier_id) === String(sid));
  if (!x) throw dataError('refused', 'That stop is not on the trip');
  const row = await readRow(sb, s, 'collection_trips', x.id);
  if (!row || row.voided || row.status !== 'collecting') throw dataError('refused', 'That stop has already changed');
  const lines: Row[] = (Array.isArray(row.lines) ? row.lines : []).map((l: Row) => {
    const c = counts.find((k) => String(k.orderId) === String(l.orderId) && String(k.key) === String(l.lineId));
    if (!c || !(Number(c.got) >= 0)) return { ...l };
    return { ...l, gotQty: Number(c.got), gotPrice: l.expectedPrice == null ? null : Number(l.expectedPrice) };
  });
  await ok(sb.from('collection_trips').update({ lines }).eq('shop_id', s.shopId).eq('id', x.id));
  // buyer.html:4419 stopReadyWhy.
  const open = lines.filter((l) => gotOf(l) == null).length;
  if (open) throw dataError('refused', `Say what came back for ${open} more line${open === 1 ? '' : 's'} first: 0 is an answer`, 'unanswered');
  const none = lines.length > 0 && lines.every((l) => gotOf(l) === 0);
  if (!none) {
    const h = roundCash(raw, stem(x.id)) || (liveRound(raw) ? null : pendingCashAsk(raw, null));
    if (!h || h.status !== 'done') throw dataError('refused', 'No cash from Accounts yet', 'nocash');
    if (!(paid > 0)) throw dataError('refused', 'Enter what you paid first', 'nopay');
    const plan = tripPlanFor({ lines });
    if (plan > 0 && Math.abs(paid - plan) > plan * 0.3) throw dataError('refused', `Check the amount paid: ${Math.round(Math.abs(paid - plan) / plan * 100)}% off the plan`, 'odd');
    const priced = pricedLines(lines, paid);
    if (priced.some((l, i) => l.gotPrice !== lines[i].gotPrice)) await ok(sb.from('collection_trips').update({ lines: priced }).eq('shop_id', s.shopId).eq('id', x.id));
  }
  setStopPay(s.userId, String(x.id), { amount: none ? 0 : Math.round(paid), noReceipt: true, done: new Date(now).toISOString(), skip: false });
}

/** The stop's lines with each line's price paid: its share of the payment over what came (rules.paidShares). */
export function pricedLines(lines: Row[], paid: UGX): Row[] {
  const came = lines.map((l) => (gotOf(l) ?? 0) * (Number(l.expectedPrice) || 0));
  const shares = paidShares(paid, came);
  return lines.map((l, i) => {
    const g = gotOf(l);
    return g && g > 0 ? { ...l, gotPrice: shares[i] / g } : l;
  });
}

/**
 * Undo a stop just done (TripOn.dc.html, Success "Undo 5"). Done-here lives on this phone until the
 * hand-in (keep.ts), so undo clears it there; what came stays on the lines as a draft. Once the stop is
 * handed in (collected) there is nothing to undo here.
 */
export async function undoStop(sb: Sb, s: Session, raw: Raw, sid: string): Promise<void> {
  const round = liveRound(raw) || [];
  const x = round.find((t) => !t.voided && String(t.supplier_id) === String(sid));
  if (!x) throw dataError('refused', 'That stop is not on the trip');
  const row = await readRow(sb, s, 'collection_trips', x.id);
  if (!row || row.voided || row.status !== 'collecting') throw dataError('refused', 'Already handed in');
  setStopPay(s.userId, String(x.id), { done: null, amount: null });
}

/**
 * W18 buyer.html:4496 slide:handin: the stops done go in together (one collected_at); stops not reached are
 * off the round first, so the one push counts only what came back; then W19 each stop's prices to the list.
 * Not written here (pages not designed): receipts to Accounts (W20), own money (W18a), restock lines (W21).
 */
export async function handIn(sb: Sb, s: Session, raw: Raw, now: number): Promise<void> {
  const round = liveRound(raw);
  if (!round) throw dataError('refused', 'No trip on the road', 'notrip');
  const stops = round.filter((t) => !t.voided && t.status === 'collecting');
  const going = stops.filter((t) => (raw.keep.pay[t.id] || {}).done), left = stops.filter((t) => !going.includes(t));
  if (!going.length) throw dataError('refused', 'Say Done at a stop first', 'nodone');
  const ready: Row[] = [];
  for (const x of going) {
    const r = await readRow(sb, s, 'collection_trips', x.id);
    if (r && !r.voided && r.status === 'collecting') ready.push(r);
  }
  if (!ready.length) throw dataError('refused', 'That trip has already been handed in', 'done');
  for (const x of left) await dropStop(sb, s, x, 'Left for a later trip', ready[ready.length - 1]);
  const at = new Date(now).toISOString();
  for (const t of ready) {
    const lines = (t.lines || []).map((l: Row) => { const g = gotOf(l); return g != null && g < Number(l.qty) && l.gotPrice != null && Number(l.gotPrice) === Number(l.expectedPrice) ? { ...l, gotPrice: null } : l; });
    const P = raw.keep.pay[t.id] || {}, none = lines.length > 0 && lines.every((l: Row) => gotOf(l) === 0);
    const pay = { own: false, amount: none ? 0 : Math.round(Number(P.amount) || 0), receipt: 'none', at };
    await ok(sb.from('collection_trips').update({ status: 'collected', collected_at: at, lines, pay }).eq('shop_id', s.shopId).eq('id', t.id));
  }
  for (const t of ready) {
    await sb.rpc('trip_prices_to_list', { p_shop_id: s.shopId, p_trip_id: t.id }).then(() => undefined, () => undefined);
    setStopPay(s.userId, String(t.id), null);
  }
}
