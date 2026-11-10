/*
 * The Orders tab's own pure rules (books in, words and figures out). The
 * line states themselves are src/core/buyer/rules.ts (lineState, WORD); this
 * file only says how the Orders screens group and show them.
 *
 *   checking(b)              the orders still in Checking (draft, not every line found)
 *   buying(b)                orders that just left Checking for Buying
 *   orderView(o, b, now)     one order: total, its lines' states, the word that matters most, the act on its row
 *   nextSupplier(b, line)    the next best supplier for a line from the price list
 *   switchOptions(b, l, q)   the price list rows a line can switch to
 */
import { LATE_MS, lineState, readyForBuying, WORD } from '../../../core/buyer/rules.ts';
import type { BLine, BOrder, BuyerBooks, LineState, ListPrice, Supplier } from '../../../core/buyer/types.ts';
import { clock } from '../../../core/time.ts';
import type { Member, Ms, UGX } from '../../../core/types.ts';

/** "09:31": the shared words write times with two hour digits (BRIEF "Asked · 09:05"). */
export const hm = (ms: Ms): string => clock(ms).padStart(5, '0');

/** A line's colour in a strip, on light and on navy. */
export const STRIP: Record<LineState, string> = {
  toask: '#C9C4BA', asked: '#95530C', found: '#0F6B43', notfound: '#8E2A22', priceup: '#3A3F9B',
  clientwaits: '#7A4A02', removed: '#E6E3DD', ontrip: '#16203C', short: '#95530C', in: '#0F6B43',
};
export const STRIP_NAVY: Record<LineState, string> = {
  toask: 'rgba(255,255,255,.22)', asked: '#F5B26B', found: '#6FDCB0', notfound: '#F7A196', priceup: '#E4E6FA',
  clientwaits: '#F5B26B', removed: 'rgba(255,255,255,.12)', ontrip: '#B3BCD2', short: '#F5B26B', in: '#6FDCB0',
};
/** A state word's soft pill: background, ink. */
export const PILL: Record<LineState, [string, string]> = {
  toask: ['#F1EEE8', '#5F6980'], asked: ['#FDEEE1', '#7A4A02'], found: ['#E4F4EA', '#0F6B43'], notfound: ['#FBE5E2', '#8E2A22'],
  priceup: ['#FDEEE1', '#7A4A02'], clientwaits: ['#FDEEE1', '#7A4A02'], removed: ['#F1EEE8', '#5F6980'],
  ontrip: ['#E8EBF0', '#16203C'], short: ['#FDEEE1', '#7A4A02'], in: ['#E4F4EA', '#0F6B43'],
};
/** The ink a state word is written in on white (the list row's word, "Grace sees"). */
export const INK: Record<LineState, string> = {
  toask: '#7A4A02', asked: '#95530C', found: '#0F6B43', notfound: '#8E2A22', priceup: '#7A4A02',
  clientwaits: '#7A4A02', removed: '#5F6980', ontrip: '#16203C', short: '#95530C', in: '#0F6B43',
};

/** Which word an order's row shows: the one that needs someone most. */
const RANK: LineState[] = ['notfound', 'priceup', 'toask', 'asked', 'clientwaits', 'short', 'ontrip', 'found', 'in', 'removed'];

export type Filter = 'all' | 'toask' | 'asked' | 'notfound' | 'ruth';
export const FILTERS: { id: Filter; word: string; state: LineState | null; dot: string | null }[] = [
  { id: 'all', word: 'All', state: null, dot: null },
  { id: 'toask', word: 'To ask', state: 'toask', dot: null },
  { id: 'asked', word: 'Asked', state: 'asked', dot: '#95530C' },
  { id: 'notfound', word: 'Not found', state: 'notfound', dot: '#8E2A22' },
  { id: 'ruth', word: 'decides', state: 'priceup', dot: null },
];

export interface LineView {
  line: BLine;
  state: LineState;
  /** "09:31": when the supplier answered (or was asked); null when nobody was asked. */
  at: string | null;
  supplier: Supplier | null;
  total: UGX;
}

export interface OrderView {
  order: BOrder;
  seller: Member | null;
  lines: LineView[];
  /** The lines still on the bill. */
  live: LineView[];
  total: UGX;
  found: number;
  /** The word that matters most and the line it is about. */
  top: LineView | null;
  /** Asked over 30 minutes ago with no answer: the row's act is Ask again. */
  late: boolean;
}

function lineAt(o: BOrder, l: BLine, st: LineState): string | null {
  if (st === 'priceup' && l.repricedAt) return hm(l.repricedAt);
  const c = l.supplierId ? o.confirms[l.supplierId] : null;
  if (!c) return null;
  if (st === 'asked') return c.askedAt ? hm(c.askedAt) : null;
  if (c.answeredAt) return hm(c.answeredAt);
  return c.askedAt ? hm(c.askedAt) : null;
}

export function orderView(o: BOrder, b: BuyerBooks, now: Ms): OrderView {
  const lines = o.lines.map((line): LineView => {
    const state = lineState(o, line, b.trip);
    return { line, state, at: lineAt(o, line, state), supplier: b.suppliers.find((s) => s.id === line.supplierId) || null, total: line.cost * line.qty };
  });
  const live = lines.filter((x) => x.state !== 'removed');
  const top = [...live].sort((x, y) => RANK.indexOf(x.state) - RANK.indexOf(y.state))[0] || null;
  const late = live.some((x) => {
    const c = x.state === 'asked' && x.line.supplierId ? o.confirms[x.line.supplierId] : null;
    return !!c && !!c.askedAt && now - c.askedAt > LATE_MS;
  });
  return {
    order: o, seller: b.team.find((m) => m.id === o.sellerId) || null, lines, live,
    total: live.reduce((t, x) => t + x.total, 0), found: live.filter((x) => x.state === 'found').length, top, late,
  };
}

/** Still in Checking: a draft with a line not found yet. Oldest first. */
export function checking(b: BuyerBooks): BOrder[] {
  return b.orders.filter((o) => o.status === 'draft' && !readyForBuying(o)).sort((x, y) => x.placedAt - y.placedAt);
}

/** Left Checking: every line found (the server moves it to Buying), not yet on a trip. */
export function buying(b: BuyerBooks): BOrder[] {
  return b.orders.filter((o) => readyForBuying(o) || (o.status === 'awaiting_goods' && o.lines.every((l) => l.got == null)));
}

/** Rows by what needs someone most (Not found, then Ruth decides, then Asked …), then the oldest order. */
export function byNeed(vs: OrderView[]): OrderView[] {
  const r = (v: OrderView) => (v.top ? RANK.indexOf(v.top.state) : RANK.length);
  return [...vs].sort((x, y) => r(x) - r(y) || x.order.placedAt - y.order.placedAt);
}

/** Every line, grouped by state so the strip reads as a count: Asked, Found, Not found, Ruth decides, the rest. */
const STRIP_ORDER: LineState[] = ['toask', 'asked', 'found', 'notfound', 'priceup', 'clientwaits', 'ontrip', 'short', 'in', 'removed'];
export function byState(states: LineState[]): LineState[] {
  return [...states].sort((x, y) => STRIP_ORDER.indexOf(x) - STRIP_ORDER.indexOf(y));
}

export function matches(v: OrderView, f: Filter): boolean {
  const st = FILTERS.find((x) => x.id === f)?.state;
  return !st || v.live.some((x) => x.state === st);
}

/** What the salesperson sees for each line, the words once each: "Found · Price up · Ruth decides". */
export function seesWords(v: OrderView, decider: string): { word: string; state: LineState }[] {
  const out: { word: string; state: LineState }[] = [];
  v.lines.forEach((x) => {
    const word = x.state === 'priceup' ? `${WORD.priceup} · ${decider} decides` : x.state === 'asked' && x.at ? `${WORD.asked} · ${x.at}` : WORD[x.state];
    if (!out.some((w) => w.word === word)) out.push({ word, state: x.state });
  });
  return out;
}

const same = (p: ListPrice, l: BLine): boolean => (p.productId && l.productId ? p.productId === l.productId : p.item === l.name);

/** The list price a line's own supplier has for it (the "list 41,000 · 34 days" under a price). */
export function listPrice(b: BuyerBooks, l: BLine, supplierId: string): ListPrice | null {
  return b.prices.find((p) => p.supplierId === supplierId && same(p, l)) || null;
}

export interface Alt { price: ListPrice; supplier: Supplier; days: number }

/**
 * The next best supplier for a line: the same item on the price list from another supplier, the cheapest
 * first, then the one that finds things more often. null when nobody else has it on the list.
 */
export function nextSupplier(b: BuyerBooks, l: BLine, now: Ms): Alt | null {
  const rows = b.prices.filter((p) => same(p, l) && p.supplierId !== l.supplierId)
    .map((price) => ({ price, supplier: b.suppliers.find((s) => s.id === price.supplierId) as Supplier, days: Math.max(0, Math.floor((now - price.at) / 86400000)) }))
    .filter((x) => !!x.supplier)
    .sort((x, y) => x.price.price - y.price.price || y.supplier.found / Math.max(1, y.supplier.asked) - x.supplier.found / Math.max(1, x.supplier.asked));
  return rows[0] || null;
}

export interface SwitchRow { price: ListPrice; supplier: Supplier; same: boolean; diff: UGX; ruth: boolean; total: UGX }

/** The price list rows a line can switch to: matching the words typed, the same item first, without the one not found. */
export function switchOptions(b: BuyerBooks, l: BLine, q: string): SwitchRow[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return b.prices
    .filter((p) => !(same(p, l) && p.supplierId === l.supplierId))
    .filter((p) => words.every((w) => p.item.toLowerCase().includes(w)))
    .map((price) => ({ price, supplier: b.suppliers.find((s) => s.id === price.supplierId) as Supplier }))
    .filter((x) => !!x.supplier)
    .map((x) => ({ ...x, same: same(x.price, l), diff: x.price.price - l.cost, ruth: x.price.price > l.sell, total: x.price.price * l.qty }))
    .sort((x, y) => Number(y.same) - Number(x.same) || Number(x.ruth) - Number(y.ruth) || x.price.price - y.price.price);
}

/** The word to search first: the item's kind ("Y12 rebar 12 m" → "rebar"), the longest plain word. */
export function firstQuery(name: string): string {
  const w = name.split(/\s+/).filter((x) => /^[a-z]+$/i.test(x) && x.length > 2);
  return (w.sort((x, y) => y.length - x.length)[0] || name).toLowerCase();
}

/** A person by role (Ruth the Manager, Moses in Sourcing), by display name. */
export function byRole(b: BuyerBooks, role: Member['role']): Member | null {
  return b.team.find((m) => m.role === role) || null;
}
