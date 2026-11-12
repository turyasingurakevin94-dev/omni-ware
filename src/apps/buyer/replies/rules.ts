/*
 * The Replies tab's own small rules, pure (books in, words out). The shop's
 * rules are src/core/buyer/rules.ts; these only say them the way this tab
 * draws them.
 *
 *   waitWord(askedAt, now)   "35m", "2h": how long a supplier has had the ask
 *   orderWord(o, trip)       what Sales sees for an order: On hold, Buying, or its most pressing line word
 *   seesWord(b, o)           the same, with who acts next ("Price up · Ruth decides"): the one word every "{Seller} sees:" shows
 *   salesSees(b, ids)        per salesperson, the orders they see moving and their word
 *   seller(b, o)             the salesperson's face and display name
 */
import { readyForBuying, lineState, WORD } from '../../../core/buyer/rules.ts';
import { holdOf } from '../orders/rules.ts';
import type { BOrder, BuyerBooks, LineState, Trip } from '../../../core/buyer/types.ts';
import type { Member, Ms } from '../../../core/types.ts';

/** "35m" under an hour, then "2h" (fits the 64 px count box). */
export function waitWord(askedAt: Ms | null, now: Ms): string {
  const m = Math.max(0, Math.floor((now - (askedAt || now)) / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
}

/** The order is (or is about to be) in Buying: every line found or off the bill. */
export function isBuying(o: BOrder): boolean {
  return o.status === 'awaiting_goods' || readyForBuying(o);
}

/** The line words that matter most to Sales come first. */
const PRESS: LineState[] = ['notfound', 'priceup', 'clientwaits', 'toask', 'asked', 'found'];

export interface OrderSees { order: BOrder; word: string; push: boolean }

/** What Sales sees for this order now. A push goes out for Not found and Price up (BRIEF "What Sales gets"). */
export function orderWord(o: BOrder, trip: Trip | null): OrderSees {
  const h = holdOf(o);
  if (h) return { order: o, word: h.word, push: false };
  if (isBuying(o)) return { order: o, word: 'Buying', push: false };
  const states = o.lines.filter((l) => !l.removed).map((l) => lineState(o, l, trip));
  const st = PRESS.find((s) => states.includes(s)) || 'found';
  return { order: o, word: WORD[st], push: st === 'notfound' || st === 'priceup' };
}

export function seller(b: BuyerBooks, o: BOrder): Member | null {
  return b.team.find((m) => m.id === o.sellerId) || null;
}

export function firstName(m: Member | null): string {
  return m ? m.name.trim().split(/\s+/)[0] : 'Sales';
}

export interface SeesGroup { who: Member | null; orders: OrderSees[] }

/** Per salesperson, the given orders with the word they see; the oldest order first. */
export function salesSees(b: BuyerBooks, ids: number[]): SeesGroup[] {
  const os = b.orders.filter((o) => ids.includes(o.id)).sort((x, y) => x.id - y.id);
  const by = new Map<string, SeesGroup>();
  os.forEach((o) => {
    const g = by.get(o.sellerId) || { who: seller(b, o), orders: [] };
    g.orders.push(withWho(b, orderWord(o, b.trip)));
    by.set(o.sellerId, g);
  });
  return [...by.values()];
}

/**
 * The word as Sales gets it (BRIEF "What Sales gets"): who acts next on it, by display name.
 * Price up · Ruth decides; Client waits · Moses finds it.
 */
/** What the salesperson sees for this order, in one word with who acts next (BUY-04): Replies, the order sheet and Done agree. */
export function seesWord(b: BuyerBooks, o: BOrder): OrderSees {
  return withWho(b, orderWord(o, b.trip));
}

function withWho(b: BuyerBooks, s: OrderSees): OrderSees {
  const by = (role: Member['role']) => b.team.find((m) => m.role === role) || null;
  if (s.word === WORD.priceup) return { ...s, word: `${WORD.priceup} · ${firstName(decider(b))} decides` };
  if (s.word === WORD.clientwaits) { const m = by('sourcing'); return m ? { ...s, word: `${WORD.clientwaits} · ${firstName(m)} finds it` } : s; }
  return s;
}

/** The orders Sales sees move on Replies: those with an answer in, and those whose line now waits on Sourcing. */
export function seenOrders(b: BuyerBooks, answered: number[]): number[] {
  const waits = b.orders.filter((o) => (o.status === 'draft' || o.status === 'awaiting_goods') && o.lines.some((l) => lineState(o, l, b.trip) === 'clientwaits')).map((o) => o.id);
  return [...new Set([...answered, ...waits])];
}

/** The Manager who decides a price over the selling price (decision-rights: the Manager decides prices). */
export function decider(b: BuyerBooks): Member | null {
  return b.team.find((m) => m.role === 'manager') || null;
}
