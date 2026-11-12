/*
 * Credit, for the Manager's credit sheets (D-5, D-6, D-7, D-25, D-32): what the
 * customer would owe, why it is held, the limit choices. One rule each (spec §6).
 */
import { daysApart } from '../time.ts';
import type { Cust, Day, MOrder, UGX } from './types.ts';

/** What the customer would owe with this order: what they owe now + its total. */
export function wouldOwe(c: Pick<Cust, 'owes'>, o: Pick<MOrder, 'total' | 'paid'> | null): UGX {
  return Math.max(0, c.owes) + (o ? Math.max(0, o.total - o.paid) : 0);
}

/** Days since their oldest unpaid bill (0 when they owe nothing). */
export function oldestDays(c: Pick<Cust, 'bills'>, today: Day): number {
  const open = c.bills.filter((b) => b.left > 0);
  if (!open.length) return 0;
  return daysApart(open[0].day, today);
}

/** Why an order on credit is held (0119/0174 ow_gate_reason; 0167): no limit, over it, or an old bill. */
export function creditWhy(c: Pick<Cust, 'owes' | 'limit' | 'bills'>, o: Pick<MOrder, 'total' | 'paid'> | null, today: Day, holdDays: number): 'nolimit' | 'limit' | 'age' | null {
  if (!c.limit) return 'nolimit';
  if (wouldOwe(c, o) > c.limit) return 'limit';
  if (oldestDays(c, today) > holdDays) return 'age';
  return null;
}

/** The limits a chip may offer (spec §6 "Limit choices"). */
export const LADDER: UGX[] = [500_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000];

/** Terms that go with a limit: the customer's own, else 14 days under 3M and 30 from 3M. */
export function termsFor(limit: UGX, own: number | null): number {
  if (own) return own;
  return limit >= 3_000_000 ? 30 : 14;
}

/** Three chips: the smallest limit that covers what they would owe (picked), then the next two. */
export function limitChoices(need: UGX, own: number | null): { limit: UGX; days: number }[] {
  let i = LADDER.findIndex((x) => x >= need);
  if (i < 0) i = LADDER.length - 1;
  const ls = LADDER.slice(i, i + 3);
  while (ls.length < 3) ls.push(ls[ls.length - 1] * 2);
  return ls.map((limit) => ({ limit, days: termsFor(limit, own) }));
}

/** "1.5M · 14 d", "3M · 30 d": a chip's words. */
export function limitChip(limit: UGX, days: number): string {
  const m = limit / 1_000_000;
  const n = m >= 1 ? `${Number.isInteger(m) ? m : m.toFixed(1)}M` : `${Math.round(limit / 1000)}k`;
  return `${n} · ${days} d`;
}

/** D-32: at the limit they have now and at the one asked, what is over or left. */
export function atLimit(need: UGX, limit: UGX | null): { over: UGX; left: UGX } {
  const l = limit || 0;
  return { over: Math.max(0, need - l), left: Math.max(0, l - need) };
}
