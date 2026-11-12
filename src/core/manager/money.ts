/*
 * The Money tab's rules (docs/spec/04-screens-manager.md §6; boards Money p1–p4, Added2 AD03–AD04):
 * what came in today, the hold track, promises, the limit sheet's chips and bar, the look-alike
 * merge, the opening balance. One rule each; the screens (src/apps/manager/money/) only draw them.
 * Plain functions on the books' types: Node runs this file as it is.
 */
import { addDays, daysApart, weekday } from '../time.ts';
import { LADDER } from './credit.ts';
import type { BandKey } from './watch.ts';
import type { Bill, Cust, Day, ManagerBooks, Promise_, UGX } from './types.ts';

/** Money In today: cash + mobile money + bank (test payments are already left out by the source). */
export function inTodayTotal(t: ManagerBooks['inToday']): UGX {
  return t.cash + t.momo + t.bank;
}

/** The hold track (Money p1 rows, the lead card, p2's hero): 40 days end to end, the hold line on it. */
export const TRACK_DAYS = 40;
export function trackFrac(days: number): number {
  return Math.max(0, Math.min(1, days / TRACK_DAYS));
}

/** Held: their oldest unpaid bill is past the hold line, so new orders on credit wait (credit.ts creditWhy 'age'). */
export function isHeld(days: number, holdDays: number): boolean {
  return days > holdDays;
}

/** Where "Held at 21 d" sits on the age-band bar: the share of what is owed in the bands under the hold line. */
export function holdShare(bands: Record<BandKey, UGX>, holdDays: number): number {
  const total = bands.u7 + bands.u21 + bands.u30 + bands.o30;
  if (!total) return 0;
  const under = (holdDays >= 7 ? bands.u7 : 0) + (holdDays >= 21 ? bands.u21 : 0) + (holdDays >= 30 ? bands.u30 : 0);
  return under / total;
}

/** The words a nudge sends the salesperson (D-30): who owes, how much, how old. */
export function chaseWords(c: Pick<Cust, 'name' | 'owes'>, days: number, money: (n: number) => string): string {
  return `${c.name} owes ${money(c.owes)} · oldest bill ${days} d`;
}

/* ---------------- promises (D-28) ---------------- */

/** "Mon 19": a promise day as the chips and the dock write it. */
export function dayChip(day: Day): string {
  return `${weekday(day)} ${Number(day.slice(8, 10))}`;
}

/** The open promise still to come (on or after today), the soonest first: the row's "Promised Mon 19". */
export function openPromise(c: Pick<Cust, 'promises'>, today: Day): Promise_ | null {
  return c.promises.filter((p) => p.state === 'open' && p.on >= today).sort((a, b) => (a.on < b.on ? -1 : 1))[0] || null;
}

export function promiseTally(c: Pick<Cust, 'promises'>): { kept: number; broken: number } {
  return { kept: c.promises.filter((p) => p.state === 'kept').length, broken: c.promises.filter((p) => p.state === 'broken').length };
}

/** Which day: today and the six after it (today is drawn, not picked). */
export function promiseWeek(today: Day): Day[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i));
}

/** The day picked first: the first day after today that is not a Sunday (Sat 17 → Mon 19). */
export function firstPromiseDay(today: Day): Day {
  let d = addDays(today, 1);
  while (weekday(d) === 'Sun') d = addDays(d, 1);
  return d;
}

/** How much: All (what they owe) · Oldest bill (the oldest open bill). */
export function promiseAmounts(c: Pick<Cust, 'owes' | 'bills'>): { all: UGX; oldest: UGX } {
  const open = c.bills.filter((b) => b.left > 0);
  return { all: Math.max(0, c.owes), oldest: open.length ? open[0].left : Math.max(0, c.owes) };
}

/** If kept: each open bill, oldest first, and how much of it the promise clears. */
export function ifKept(c: Pick<Cust, 'owes' | 'bills'>, amount: UGX): { after: UGX; bills: (Bill & { cleared: UGX })[] } {
  let left = amount;
  const bills = c.bills.filter((b) => b.left > 0).map((b) => { const cleared = Math.min(b.left, Math.max(0, left)); left -= cleared; return { ...b, cleared }; });
  return { after: Math.max(0, c.owes - amount), bills };
}

/** The promises dots: each promise's place along the line, from a week before the first to today or the last promise (1 = the end); where today sits. */
export function promiseLine(ps: Promise_[], today: Day): { dots: { p: Promise_; x: number }[]; today: number } {
  if (!ps.length) return { dots: [], today: 1 };
  const sorted = [...ps].sort((a, b) => (a.on < b.on ? -1 : 1));
  const last = sorted[sorted.length - 1].on, end = last > today ? last : today;
  const from = addDays(sorted[0].on, -7), span = Math.max(1, daysApart(from, end));
  return { dots: sorted.map((p) => ({ p, x: daysApart(from, p.on) / span })), today: daysApart(from, today) / span };
}

/* ---------------- the limit (D-25) ---------------- */

/** The terms a limit may carry (AD03). */
export const TERMS = [7, 14, 30] as const;

/** The limit chips (AD03): the step under the limit now, the limit now, and the two above it. No limit: from the smallest that covers what they owe. */
export function limitLadder(now: UGX | null, owes: UGX): UGX[] {
  let i = now ? LADDER.findIndex((x) => x >= now) : LADDER.findIndex((x) => x >= owes);
  if (i < 0) i = LADDER.length - 1;
  const start = now ? Math.max(0, i - 1) : i;
  const out = LADDER.slice(start, start + 4);
  if (now && !out.includes(now)) out.splice(1, 0, now);
  return out.slice(0, 4);
}

/** The bar under the chips: what they owe on the scale of the bigger limit, the limit now marked, what is left (or over). */
export function limitBar(owes: UGX, now: UGX | null, picked: UGX | null): { fill: number; nowAt: number | null; left: UGX } {
  const scale = Math.max(now || 0, picked || 0, owes, 1);
  return { fill: Math.max(0, owes) / scale, nowAt: now ? now / scale : null, left: (picked || 0) - Math.max(0, owes) };
}

/* ---------------- look alike and old books (D-26, D-27) ---------------- */

/** After a merge: the kept record's orders and what it owes, both added. */
export function mergeAfter(keep: Pick<Cust, 'orders' | 'owes'>, drop: Pick<Cust, 'orders' | 'owes'>): { orders: number; owes: UGX } {
  return { orders: keep.orders + drop.orders, owes: keep.owes + drop.owes };
}

/** After the opening balance: what they owe, against the limit (left, or over when below 0). */
export function afterOpening(c: Pick<Cust, 'owes' | 'limit'>, amount: UGX): { owes: UGX; left: UGX | null; scale: number } {
  const owes = c.owes + amount;
  return { owes, left: c.limit ? c.limit - owes : null, scale: Math.max(c.limit || 0, owes, 1) };
}
