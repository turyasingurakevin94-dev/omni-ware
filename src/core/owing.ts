/*
 * Who owes, bill by bill (FACTS §3.1; spec 02 §5.3): each customer's open bills from the debt log, how old
 * they are, which are past the hold, and which Accounts is checking. "To collect" is what they owe; what can
 * be taken now is the bills past the hold that nobody is checking. Today reads it (To collect, Needs you);
 * Customers has its own copy built from invoiced orders, an open question (docs/spec/04-screens-sales.md §4).
 */
import { HOLD_DAYS, oldestAge, openCharges } from './money.ts';
import { dayOf, daysApart } from './time.ts';
import type { Books, Customer, Day, Ms, UGX } from './types.ts';

export interface OpenBill { day: Day; orderId: number | null; left: UGX; age: number; past: boolean; checked: boolean }

export interface Owed {
  c: Customer;
  owes: UGX;
  /** Open bills, oldest first. */
  bills: OpenBill[];
  /** Past the hold and not being checked: the money to take now. */
  take: UGX;
  past: UGX;
  under: UGX;
  checked: UGX;
  age: number;
}

/** Bills Accounts is checking: an open ask to Accounts on that bill (payment_asks, what 'bill'). */
export function checkedBills(b: Books): Set<number> {
  return new Set(b.paymentAsks.filter((a) => a.status === 'sent' && a.what === 'bill' && a.orderId != null).map((a) => a.orderId as number));
}

/** Everyone who owes (not test records), with their bills. */
export function owedBy(b: Books, now: Ms): Owed[] {
  const today = dayOf(now), hold = b.settings.holdDays || HOLD_DAYS, checked = checkedBills(b);
  const sum = (xs: OpenBill[]) => xs.reduce((s, x) => s + x.left, 0);
  return b.customers.filter((c) => !c.qa && c.owes > 0).map((c) => {
    const bills = openCharges(c).map((x) => {
      const age = daysApart(x.day, today);
      return { ...x, age, past: age > hold, checked: x.orderId != null && checked.has(x.orderId) };
    });
    return {
      c, owes: c.owes, bills, age: oldestAge(c, today),
      past: sum(bills.filter((x) => x.past)), under: sum(bills.filter((x) => !x.past)),
      checked: sum(bills.filter((x) => x.checked)), take: sum(bills.filter((x) => x.past && !x.checked)),
    };
  });
}

/**
 * The bills a Take pays, as customers/pay names them: the order ids, and `debt` for a charge that names no
 * order (an opening balance or an adjustment), so the Take pays all that it says. Past the hold: the bills past
 * it; otherwise every bill. A bill Accounts is checking is never in it (Ggaba: #0521 without #0528).
 */
export function takeBills(w: Pick<Owed, 'bills'>, past: boolean): string[] {
  const out: string[] = [];
  w.bills.filter((x) => !x.checked && (past ? x.past : true)).forEach((x) => {
    const k = x.orderId == null ? 'debt' : String(x.orderId);
    if (!out.includes(k)) out.push(k);
  });
  return out;
}
