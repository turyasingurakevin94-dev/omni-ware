/*
 * A customer's rhythm, once (docs/spec/04-screens-sales.md §4): when they last ordered, how far
 * past their usual gap they are, and so who is due and who has gone quiet. Pure functions over the
 * books' shapes; the caller passes `today` (Kampala).
 *
 *   last order   the most recent order placed, not cancelled, voided, a test record or the copy of an
 *                order entered twice (FACTS rule 1; Nansana's last is #0556 10:02, not the copy #0557)
 *   due          today is on or after last order + every N days (sales.html:4674 r.due)
 *   gone quiet   more than twice their gap since the last order (sales.html:4674 r.overdue:
 *                since > every × 2); gone quiet is its own group, never "due" (sales.html:6927)
 */
import { isCopy } from './orders.ts';
import { addDays, dayOf, daysApart } from './time.ts';
import type { Customer, Day, Order } from './types.ts';

export interface Rhythm {
  /** Their usual gap in days (Customer.everyDays), null when not known. */
  every: number | null;
  /** The day of their last order, null when none. */
  last: Day | null;
  /** Their last order itself, null when none. */
  lastOrder: Order | null;
  /** The day they are due next (last + every), null when not known. */
  next: Day | null;
  /** Days since the last order. */
  since: number | null;
  /** Days past the next due day: 0 = due today, below 0 = not due yet. */
  late: number | null;
  due: boolean;
  quiet: boolean;
}

export function rhythm(c: Customer, orders: Order[], today: Day): Rhythm {
  const lastOrder = orders.filter((o) => o.customerId === c.id && !o.cancelled && !o.voided && !o.qa && !isCopy(orders, o))
    .reduce<Order | null>((m, o) => (!m || o.placedAt > m.placedAt ? o : m), null);
  const last = lastOrder ? dayOf(lastOrder.placedAt) : null, every = c.everyDays && c.everyDays > 0 ? c.everyDays : null;
  const since = last ? daysApart(last, today) : null;
  const late = last && every ? daysApart(addDays(last, every), today) : null;
  const quiet = every != null && since != null && since > every * 2;
  return { every, last, lastOrder, next: last && every ? addDays(last, every) : null, since, late, due: late != null && late >= 0 && !quiet, quiet };
}

/** "Due today · every 7 days", "4 days late · every 14 days". */
export function dueWords(r: Rhythm): string {
  const every = `every ${r.every} days`, late = r.late || 0;
  return late === 0 ? `Due today · ${every}` : `${late} day${late === 1 ? '' : 's'} late · ${every}`;
}

/** Who is due (FACTS "Who's due 3"), the most owed first, then the latest. Test records are left out. */
export function dueCustomers(customers: Customer[], orders: Order[], today: Day): { c: Customer; r: Rhythm }[] {
  return customers.filter((c) => !c.qa).map((c) => ({ c, r: rhythm(c, orders, today) })).filter((x) => x.r.due)
    .sort((x, y) => y.c.owes - x.c.owes || (y.r.late || 0) - (x.r.late || 0));
}
