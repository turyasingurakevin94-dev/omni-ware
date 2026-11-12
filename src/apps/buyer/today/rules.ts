/*
 * Today's own small rules (pure). The Buyer's rules live in src/core/buyer/rules.ts;
 * these only shape them for Today's rows and cards.
 *
 *   hm(ms)              "09:05" (the board's times have the leading zero)
 *   shortItem(name)     "Ridge cap 3 m" → "Ridge cap", "Y12 rebar 12 m" → "Y12 rebar"
 *   itemName(name)      the whole name for a chip, an empty variant's trailing dash gone
 *   unitWord(n, unit)   "20 bags" (a word unit takes an s; "sht", "pcs", "m" stay as they are)
 *   sellersOf(b, os)    the salespeople behind some orders, by display name, once each
 *   waitingOn(b, now)   who Denis waits on when nothing waits on him: Ruth (a price), the suppliers asked
 *   tripReady(b, now)   the trip is Denis's next move: something found, nothing left to ask, no trip running
 *   calm(b, now)        nothing waits on Denis (nothing to ask, no Not found line, no late reply, no trip to start or running)
 */
import { clock } from '../../../core/time.ts';
import type { Member, Ms } from '../../../core/types.ts';
import { askGroups, lineRefs, replyRows, tiles } from '../../../core/buyer/rules.ts';
import type { BOrder, BuyerBooks } from '../../../core/buyer/types.ts';

export function hm(ms: Ms): string {
  return clock(ms).padStart(5, '0');
}

/** The item's name without its size ("Timber 2×4" → "Timber"; "Y12 rebar 12 m" → "Y12 rebar"), for a small chip. */
export function shortItem(name: string): string {
  const words = name.split(' '), out: string[] = [];
  for (const w of words) { if (out.length && /\d/.test(w)) break; out.push(w); }
  return out.join(' ') || name;
}

/** "20 bags", "1 bag", "40 sht": a unit that is a word (it has a vowel) takes an s; a short form does not. */
export function unitWord(n: number, unit: string): string {
  return n === 1 || /s$/i.test(unit) || !/[aeiou]/i.test(unit) ? unit : `${unit}s`;
}

/** An item's name for a chip, whole, without an empty variant's dash ("Expansion Bolts —" → "Expansion Bolts"; BUY-12). */
export function itemName(name: string): string {
  return name.replace(/[\s—–-]+$/, '').trim() || name;
}

/** One message per supplier: what we need from them, every order together. */
export function sellersOf(b: BuyerBooks, os: BOrder[]): Member[] {
  const ids = [...new Set(os.map((o) => o.sellerId))];
  return ids.map((id) => b.team.find((m) => m.id === id)).filter((m): m is Member => !!m);
}

export function firstName(m: Member): string {
  return m.name.split(' ')[0];
}

/** "Grace sees", "Grace · Faith see". */
export function seeWord(ms: Member[]): string {
  return ms.length === 1 ? `${firstName(ms[0])} sees` : `${ms.map(firstName).join(' · ')} see`;
}

export interface Waiter { key: string; initials: string; person: Member | null; name: string }

/** Who the work waits on that is not Denis: the Manager deciding a price, the suppliers asked. */
export function waitingOn(b: BuyerBooks, now: Ms): Waiter[] {
  const out: Waiter[] = [];
  const ruth = b.team.find((m) => m.role === 'manager') || null;
  if (ruth && lineRefs(b).some((r) => r.state === 'priceup')) out.push({ key: ruth.id, initials: ruth.initials, person: ruth, name: firstName(ruth) });
  replyRows(b, now).forEach((g) => out.push({
    key: g.supplier.id, person: null, name: g.supplier.name.split(' ')[0],
    initials: g.supplier.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
  }));
  return out;
}

/** The trip is on the road or waiting on its cash. */
export function tripRunning(b: BuyerBooks): boolean {
  return !!b.trip && (b.trip.state === 'cash' || b.trip.state === 'on');
}

/**
 * The trip is the next move (board Today phone 2, not phone 1): a supplier said yes, every supplier is
 * asked, and no trip is running. While one is still to ask, the ask comes first and the trip waits.
 */
export function tripReady(b: BuyerBooks, now: Ms): boolean {
  const t = tiles(b, now);
  return t.found > 0 && t.toask === 0 && !tripRunning(b);
}

/** Nothing waits on Denis: nothing to ask, no late reply, nothing found to buy, no trip running. */
export function calm(b: BuyerBooks, now: Ms): boolean {
  return askGroups(b, now).length === 0 && !lineRefs(b).some((r) => r.state === 'notfound' || r.state === 'nosupplier') && !replyRows(b, now).some((g) => g.late) && tiles(b, now).found === 0 && !tripRunning(b);
}
