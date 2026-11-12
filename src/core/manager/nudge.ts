/*
 * A nudge's words (D-30, D-31; handover.md §3 "Ruth nudged you" + the words). The app writes
 * them, so the Manager taps once; the pen changes them. One rule here: Team, Today and Money
 * all nudge with these words, and the push the person gets says the same.
 *
 *   nudgeTitle(me)                         "Ruth nudged you"
 *   aboutOrder(o, now, limits)             "The Lubowa Builders order (#0554) has waited 2 h 40 m in Checking, 40 m over its limit. Can you sort it now?"
 *   aboutPace(person, now)                 "You are 2.09M behind pace for October. 1.08M a day gets you to 30M."
 *   aboutDebt(cust, days)                  "Kyaligonza & Sons owes 2,310,000, the oldest bill 38 days. Can you chase it today?"
 *   CALL_ME                                "Call me when you can."
 */
import { money, short } from '../money.ts';
import { firstWord, orderNo } from '../names.ts';
import { inM } from './team.ts';
import type { Cust, MOrder, Ms, Person, Stage } from './types.ts';
import { onPace } from './watch.ts';
import { inStage, STAGE } from './words.ts';

export const CALL_ME = 'Call me when you can.';

/** The push's title, and the dock's "Denis sees Ruth nudged you". */
export function nudgeTitle(me: Pick<Person, 'name'>): string {
  return `${firstWord(me.name)} nudged you`;
}

/** An order: stuck (over its stage's limit) says how long and how far over; else where it waits. */
export function aboutOrder(o: Pick<MOrder, 'id' | 'customerName' | 'stage' | 'stageAt'>, now: Ms, limits: Partial<Record<Stage, number>>): string {
  const mins = Math.max(0, (now - o.stageAt) / 60000), limit = Number(limits[o.stage]) || 0;
  const what = `The ${o.customerName} order (${orderNo(o.id)})`;
  if (limit > 0 && mins > limit) {
    return `${what} has waited ${inStage(mins)} in ${STAGE[o.stage]}, ${inStage(mins - limit)} over its limit. Can you sort it now?`;
  }
  return `${what} is in ${STAGE[o.stage]} ${inStage(mins)}. Can you sort it now?`;
}

/** A salesperson behind the month's pace. */
export function aboutPace(p: Pick<Person, 'sold' | 'goal'>, now: Ms, month: string): string {
  const x = onPace(p.sold, p.goal, now);
  if (x.ahead >= 0) return `You are ${inM(x.ahead)} ahead of pace for ${month}. Keep it going.`;
  return `You are ${inM(-x.ahead)} behind pace for ${month}. ${inM(x.perDay)} a day gets you to ${short(p.goal || 0)}.`;
}

/** A customer to chase (Money's Nudge Grace). */
export function aboutDebt(c: Pick<Cust, 'name' | 'owes'>, oldestDays: number): string {
  return `${c.name} owes ${money(c.owes)}, the oldest bill ${oldestDays} days. Can you chase it today?`;
}
