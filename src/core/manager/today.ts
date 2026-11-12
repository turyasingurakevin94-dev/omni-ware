/*
 * Today's rules (docs/canvas/manager/Today.dc.html p1; spec 04-screens-manager §3.4, §4, §6):
 * what the shop invoiced this month, the four "On the move" tiles, a Needs-you row's words and
 * its one safe answer (the same write and args as the Decide kind's primary, spec §4), and the
 * three Watch tiles. Plain TypeScript: Node runs it as it is.
 */
import { dayOf } from '../time.ts';
import { money, short } from '../money.ts';
import { firstWord, orderNo, plural } from '../names.ts';
import { limitChoices, wouldOwe } from './credit.ts';
import { isSlide } from './queue.ts';
import { lineShopPrice, shopPriceOf } from './price.ts';
import type { LimitPick, WriteName } from './source.ts';
import type { Ask, ManagerBooks, MOrder, Ms, Person, Stage, UGX } from './types.ts';
import { behind, debtors, onPace, onTheMove, pace, stuck } from './watch.ts';
import { ANSWER, askWord } from './words.ts';

/** The shop's sales invoiced this month: each salesperson's, plus the counter and the agents (BRIEF "Team": 61,110,000). */
export function invoicedMonth(b: Pick<ManagerBooks, 'team' | 'shop'>): UGX {
  return b.team.filter((p) => p.role === 'sales').reduce((s, p) => s + p.sold, 0) + b.shop.counterSold;
}

/** The hero's goal line: invoiced, the share of the goal, the pace mark, ahead (+) or behind (−). */
export function heroGoal(b: Pick<ManagerBooks, 'team' | 'shop'>, now: Ms): { sold: UGX; goal: UGX; pct: number; pacePct: number; ahead: UGX; daysLeft: number } {
  const sold = invoicedMonth(b), p = onPace(sold, b.shop.goal, now);
  return { sold, goal: b.shop.goal, pct: p.pct, pacePct: p.pacePct, ahead: p.ahead, daysLeft: pace(now).daysLeft };
}

/** The four live stages, in the order an order moves. */
export const LIVE: Stage[] = ['draft', 'awaiting_goods', 'preparing', 'pending_delivery'];

/**
 * One "On the move" tile: how many orders, how many of them wait on the Manager, who holds them (face dots,
 * staff ids). An order the Manager holds (it waits on her) shows its salesperson: the badge already says her part.
 */
export function stageTiles(b: Pick<ManagerBooks, 'orders' | 'me'>, waiting: Ask[]): { stage: Stage; count: number; need: number; holders: string[] }[] {
  const live = onTheMove(b);
  return LIVE.map((stage) => {
    const os = live.filter((o) => o.stage === stage);
    const ids = new Set(os.map((o) => o.id));
    const holders: string[] = [];
    os.forEach((o) => { const h = o.holderId && o.holderId !== b.me.id ? o.holderId : o.sellerId; if (h && !holders.includes(h)) holders.push(h); });
    return { stage, count: os.length, need: waiting.filter((a) => a.orderId != null && ids.has(a.orderId)).length, holders };
  });
}

/** An item's short name for a row: up to its first figure ("Ridge cap 3 m" → "Ridge cap", "Cement 50 kg" → "Cement"). */
export function shortItem(name: string): string {
  const i = name.search(/\s\d/);
  return (i > 0 ? name.slice(0, i) : name).trim();
}

const orderOf = (b: Pick<ManagerBooks, 'orders'>, a: Ask): MOrder | null => (a.orderId != null ? b.orders.find((o) => o.id === a.orderId) || null : null);

/** A row's title: the ask word, with the item where the board names it ("Price up · Ridge cap", "Damaged · 3 Cement"). */
export function rowTitle(a: Ask, b: Pick<ManagerBooks, 'orders'>): string {
  if (a.kind === 'price') {
    const w = askWord('price', a.mode), l = a.mode !== 'under' ? (orderOf(b, a) || { lines: [] as MOrder['lines'] }).lines[a.idx] : null;
    return l ? `${w} · ${shortItem(l.name)}` : w;
  }
  if (a.kind === 'loss') {
    const r = a.reports[0];
    return r ? `${askWord('loss', undefined, r.why)} · ${a.reports.reduce((s, x) => s + x.qty, 0)} ${shortItem(r.name)}` : askWord('loss');
  }
  return askWord(a.kind);
}

/** A row's mono line after the asker: the order (or the item), the evidence where the board draws one, then the age is added by the screen. */
export function rowEvidence(a: Ask): string[] {
  if (a.kind === 'return') return [orderNo(a.orderId || 0), `−${money(a.amount)}`];
  if (a.kind === 'loss') { const n = a.reports.reduce((s, x) => s + x.qty, 0); return [`${n} ${plural(n, a.reports[0] ? a.reports[0].unit : 'pc')}`]; }
  if (a.kind === 'carton' || a.kind === 'extra') return [a.name];
  if (a.kind === 'count') return [a.aisle];
  return a.orderId != null ? [orderNo(a.orderId)] : [];
}

/** The one safe answer on a row: the Decide kind's primary tap. Null: the row's pill is Open (a slide, or an answer that needs a pick first). */
export interface SafeAnswer {
  /** The pill: the answer word the asker sees ("Approved"). */
  word: string;
  /** The figure the answer moves, for the strip ("Approved · 46,000"); null when none. */
  amount: UGX | null;
  kind: WriteName;
  args: unknown[];
  /** Who is told (staff ids), the asker first. */
  told: string[];
}

const uniq = (ids: (string | null | undefined)[]): string[] => ids.filter((x, i, l): x is string => !!x && l.indexOf(x) === i);

export function safeAnswer(a: Ask, b: Pick<ManagerBooks, 'orders' | 'customers' | 'shop'>): SafeAnswer | null {
  if (isSlide(a, b)) return null;
  const o = orderOf(b, a);
  const told = uniq([a.askerId, o ? o.sellerId : null]);
  const cust = o && o.customerId ? b.customers.find((c) => c.id === o.customerId) || null : null;
  const firstLimit = (need: UGX): LimitPick => limitChoices(need, cust ? cust.termsDays : null)[0];
  switch (a.kind) {
    case 'price': {
      if (!o) return null;
      const l = o.lines[a.idx];
      if (a.mode === 'under') return a.asked != null ? { word: ANSWER.approved, amount: a.asked, kind: 'price', args: [o.id, a.idx, a.asked, 'approved'], told } : null;
      const shop = l ? lineShopPrice(l, b.shop.defaultMarkup) : null;
      if (shop == null) return null; // no cost known: Ask Denis, in the sheet
      return a.mode === 'up'
        ? { word: ANSWER.shopsPrice, amount: shop, kind: 'price', args: [o.id, a.idx, shop, 'shop'], told }
        : { word: ANSWER.priceSet, amount: shop, kind: 'price', args: [o.id, a.idx, shop, 'set'], told };
    }
    case 'counter': return o ? { word: ANSWER.approved, amount: a.asked, kind: 'price', args: [o.id, a.idx, a.asked, 'approved'], told } : null;
    case 'markup': return { word: ANSWER.markup, amount: shopPriceOf(a.cost, a.markup), kind: 'markup', args: [a.productId, a.markup], told };
    case 'credit': {
      if (!o) return null;
      const lim = a.why === 'nolimit' && cust ? firstLimit(wouldOwe(cust, o)) : null;
      return { word: ANSWER.onCredit, amount: o.total, kind: 'credit', args: [o.id, true, lim], told };
    }
    case 'storecredit': {
      if (!o || !cust) return null;
      const need = wouldOwe(cust, o);
      return { word: ANSWER.loadIt, amount: need, kind: 'storeCredit', args: [o.id, true, firstLimit(need)], told };
    }
    case 'bill': return o && a.code === 'OWSML' ? { word: ANSWER.billIt, amount: o.total, kind: 'billSmall', args: [o.id], told: uniq([o.sellerId]) } : null;
    case 'short': {
      if (!o) return null;
      const went = o.lines.reduce((s, l) => s + Math.round((l.price || 0) * (l.packed ?? l.qty)), 0);
      return { word: ANSWER.billWent, amount: went, kind: 'settlePick', args: [o.id, false], told };
    }
    case 'checkin': {
      const diff = a.lines.reduce((s, l) => s + (l.counted - l.brought) * l.cost, 0);
      return { word: ANSWER.takeCheckin, amount: diff, kind: 'takeCheckin', args: [a.tripId, a.note ? a.note.handoffId : null], told: uniq([a.askerId, a.runnerId]) };
    }
    case 'extra': return { word: ANSWER.keepIt, amount: a.qty * (a.cost || 0), kind: 'extra', args: [a.askId, true], told };
    case 'cancel': return o ? { word: ANSWER.cancelled, amount: null, kind: 'cancel', args: [a.askId, o.id, null], told: uniq([a.askerId, o.sellerId, o.holderId]) } : null;
    case 'agent': {
      if (!o) return null;
      const less = a.lines.reduce((s, l) => s + (l.from - l.to) * (o.lines[l.idx] ? o.lines[l.idx].price || 0 : 0), 0);
      return { word: ANSWER.agreed, amount: -less, kind: 'agent', args: [o.id, a.lines.map((l) => l.idx), a.cancel], told: uniq([a.askerId, o.holderId]) };
    }
    case 'carton': return { word: ANSWER.shelfOk, amount: a.forShelf * a.cost, kind: 'carton', args: [a.restockId, true], told };
    // D-10 needs a why picked; D-32 waits on 0184 (Q1): both open the sheet.
    default: return null;
  }
}

/** The three Watch tiles: the oldest stuck order, the salesperson furthest behind, the oldest debtor. Each names who a Nudge goes to. */
export interface WatchTile { key: 'stuck' | 'behind' | 'debtor'; staff: Person; order: number | null; figure: string; head: string; label: string }

export function watchTiles(b: Pick<ManagerBooks, 'orders' | 'shop' | 'team' | 'customers'>, now: Ms): WatchTile[] {
  const out: WatchTile[] = [];
  const who = (id: string | null | undefined) => (id ? b.team.find((p) => p.id === id) || null : null);
  const first = firstWord;
  const s = stuck(b, now)[0];
  const sp = s ? who(s.o.holderId || s.o.sellerId) : null;
  if (s && sp) out.push({ key: 'stuck', staff: sp, order: s.o.id, figure: `+${Math.round(s.over)} m`, head: `${orderNo(s.o.id)} stuck`, label: `Nudge ${first(sp.name)}: ${orderNo(s.o.id)} ${s.o.customerName}, ${Math.round(s.over)} minutes over` });
  const w = behind(b.team, now)[0];
  if (w && w.ahead < 0) out.push({ key: 'behind', staff: w.p, order: null, figure: `−${short(Math.abs(w.ahead), 2)}`, head: `${first(w.p.name)} behind`, label: `Nudge ${first(w.p.name)}: behind pace by ${money(Math.abs(w.ahead))}` });
  const d = debtors(b, dayOf(now))[0];
  const dp = d ? who(d.c.sellers[0]) : null;
  if (d && dp) out.push({ key: 'debtor', staff: dp, order: null, figure: `${d.days} d`, head: `${first(d.c.name)} ${d.days} d`, label: `Nudge ${first(dp.name)}: ${d.c.name} owes ${money(d.c.owes)}, oldest bill ${d.days} days` });
  return out;
}
