/*
 * The Customers list's groups (CU01–CU05), read once from the books:
 * who owes (past and under the 21-day hold), what is being checked, the
 * promises, who is due this week, who has gone quiet, who was opened lately.
 */
import { orderOwes } from '../../../core/money.ts';
import { addDays, clock, dayLabel, dayOf, weekday } from '../../../core/time.ts';
import type { Books, Customer, Day, Ms, PayPromise } from '../../../core/types.ts';
import { customersOf, moneyOf, promiseOf, rhythmOf, waitingOnMe, type Money, type Rhythm } from './data.ts';

export interface Who {
  c: Customer;
  m: Money;
  r: Rhythm;
  promise: PayPromise | null;
  /** The nearer of their promise and the day their oldest bill reaches the hold. */
  next: Day;
}

export interface ListData {
  all: Who[];
  owe: Who[];
  past: Who[];
  under: Who[];
  checked: Who[];
  promised: Who[];
  due: Who[];
  quiet: Who[];
  /** The week ahead after today: [day, customers due]. */
  week: [Day, Who[]][];
  owes: number;
  take: number;
  under21: number;
  checkedIn: number;
  checkedAll: number;
}

export function listData(b: Books, today: Day): ListData {
  const all = customersOf(b).map((c) => {
    const m = moneyOf(b, c, today), r = rhythmOf(b, c, today), promise = promiseOf(b, c, today);
    const next = [promise ? promise.on : '9999', m.hold || '9999'].sort()[0];
    return { c, m, r, promise, next };
  });
  const byNext = (x: Who, y: Who) => (x.next < y.next ? -1 : x.next > y.next ? 1 : y.m.owes - x.m.owes);
  const owe = all.filter((w) => w.m.owes > 0);
  const past = owe.filter((w) => w.m.past).sort(byNext), under = owe.filter((w) => !w.m.past).sort(byNext);
  const checked = all.filter((w) => w.m.checkedIn > 0 || w.m.apart > 0).sort((x, y) => (x.m.past === y.m.past ? 0 : x.m.past ? -1 : 1));
  const promised = all.filter((w) => w.promise && w.m.owes > 0).sort((x, y) => ((x.promise as PayPromise).on < (y.promise as PayPromise).on ? -1 : 1));
  const due = all.filter((w) => w.r.tone === 'late' || w.r.tone === 'due').sort((x, y) => x.r.toDue - y.r.toDue);
  const quiet = all.filter((w) => w.r.tone === 'quiet');
  const week: [Day, Who[]][] = Array.from({ length: 5 }, (_, i) => addDays(today, i + 1)).map((d) => [d, all.filter((w) => w.r.due === d && w.r.tone === 'early')]);
  const sum = (l: Who[], f: (w: Who) => number) => l.reduce((s, w) => s + f(w), 0);
  return {
    all, owe, past, under, checked, promised, due, quiet, week,
    owes: sum(owe, (w) => w.m.owes), take: sum(past, (w) => w.m.take), under21: sum(under, (w) => w.m.take),
    checkedIn: sum(owe, (w) => w.m.checkedIn), checkedAll: sum(checked, (w) => w.m.checkedIn + w.m.apart),
  };
}

/** "67 days · 2 bills" past the hold; under it "9 days · promised today" or "15 days · hold Fri 23 Oct". */
export function oweSub(w: Who, today: Day): string {
  const n = w.m.bills.length, age = `${w.m.oldest} days`;
  if (w.m.past) return `${age} · ${n} bill${n === 1 ? '' : 's'}`;
  if (w.promise) return `${age} · promised ${w.promise.on === today ? 'today' : weekday(w.promise.on)}`;
  return `${age} · hold ${w.m.hold ? dayLabel(w.m.hold) : ''}`;
}

/** "4 days late · every 14 days", "Due today · every 7 days", "Due Tue 27 Oct". */
export function dueSub(w: Who, withEvery: boolean): string {
  const r = w.r, every = withEvery && r.every ? ` · every ${r.every} days` : '';
  if (r.tone === 'late' || r.tone === 'quiet') { const n = -r.toDue; return `${n} day${n === 1 ? '' : 's'} late${every}`; }
  if (r.tone === 'due') return `Due today${every}`;
  return r.due ? `Due ${dayLabel(r.due)}` : '';
}

/** A live order that waits on Sales for money: "+320k" and "#0551" beside what they owe. */
export function waitingNote(b: Books, c: Customer): [number, number] | null {
  const o = waitingOnMe(b, c)[0];
  return o ? [orderOwes(o), o.id] : null;
}

/** Customers opened on this phone lately (kept on the phone; the demo seeds FACTS' morning). */
export function openedLately(b: Books, opened: { customerId: string; at: Ms }[], now: Ms): { c: Customer; at: Ms; when: string }[] {
  const seen = new Set<string>(), out: { c: Customer; at: Ms; when: string }[] = [];
  opened.slice().sort((x, y) => y.at - x.at).forEach((o) => {
    const c = b.customers.find((x) => x.id === o.customerId);
    if (!c || seen.has(c.id)) return;
    seen.add(c.id);
    const d = dayOf(o.at), today = dayOf(now);
    out.push({ c, at: o.at, when: d === today ? `opened today ${clock(o.at)}` : d === addDays(today, -1) ? 'opened yesterday' : `opened ${weekday(d)}` });
  });
  return out;
}
