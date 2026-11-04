/*
 * Who owes, bill by bill: one rule for Today and Customers (docs/spec/04-screens-sales.md §4.2), the server's
 * own (ow_customer_balance, 0169:639): what a customer owes is their opening balance (the debt log's lines that
 * name no order: charges less payments) plus what each live invoice still owes (invoiced, not voided, total less
 * paid). Their open bills are those invoices, oldest first, and one "Opening balance" bill when the lines with
 * no order still owe something (id DEBT; a Take names it `debt`, so it pays the whole of what its label says).
 *
 * Being checked: an open ask to Accounts names the bill (payment_asks what 'bill'), or asks about the whole
 * balance (what 'balance': every bill is being checked). A bill being checked is shown apart: it stays inside
 * what they owe (FACTS: To collect 1,910,000 holds Ggaba's 125,000) but is never in a Take. When the bills say
 * more than the balance (money paid that named no bill) and Accounts checks the balance, the difference is
 * "apart" (Lubowa: the bills say 349,000, the balance 0).
 */
import { HOLD_DAYS, holdDay, orderOwes } from './money.ts';
import { orderNo } from './names.ts';
import { dayOf, daysApart } from './time.ts';
import type { Books, Customer, Day, Ms, Order, UGX } from './types.ts';

/** The id of the opening-balance bill (no order is #0000). */
export const DEBT = 0;

export interface OpenBill {
  /** The order's id, or DEBT for the opening balance. */
  id: number;
  /** The order's id, or null for the opening balance. */
  orderId: number | null;
  order: Order | null;
  /** The day it was billed (its invoice; the oldest charge of the opening balance). */
  day: Day;
  left: UGX;
  age: number;
  /** Past the hold (FACTS §7: "Past 21 days"). */
  past: boolean;
  /** Accounts is checking it: an ask names it, or asks about the whole balance. */
  checked: boolean;
  /** An ask names this bill. */
  named: boolean;
}

export interface Owing {
  /** What they owe: ow_customer_balance, never below 0. */
  owes: UGX;
  /** Open bills, oldest first. */
  bills: OpenBill[];
  /** The bills past the hold that nobody is checking: the money to take now (Today's Take). */
  take: UGX;
  /** Inside what they owe and named by an ask (Ggaba's #0528). */
  checkedIn: UGX;
  /** What they owe less what an ask names: what Sales can take at all (Customers' Take payment). */
  canTake: UGX;
  /** The bills past the hold, under it, and being checked. */
  past: UGX;
  under: UGX;
  checked: UGX;
  /** The bills say more than the balance and Accounts checks the balance: the difference (Lubowa 349,000). */
  apart: UGX;
  /** The oldest open bill's age in days (0 when they owe nothing). */
  age: number;
  /** Owed past the hold: new credit waits for the Manager. */
  pastHold: boolean;
  /** The day the oldest bill reaches the hold, or null. */
  hold: Day | null;
}

/** Asks to Accounts that still wait on this customer's bills or balance (payment_asks, status sent). */
export function billAsks(b: Pick<Books, 'paymentAsks'>, customerId: string) {
  return b.paymentAsks.filter((a) => a.customerId === customerId && a.status === 'sent' && (a.what === 'bill' || a.what === 'balance'));
}

/** One customer's balance and open bills, by the server's rule. */
export function owingOf(b: Pick<Books, 'orders' | 'paymentAsks' | 'settings'>, c: Customer, today: Day): Owing {
  const hold = b.settings.holdDays || HOLD_DAYS, asks = billAsks(b, c.id), whole = asks.some((a) => a.what === 'balance');
  const bill = (id: number, order: Order | null, day: Day, left: UGX): OpenBill => {
    const age = daysApart(day, today), named = order != null && asks.some((a) => a.orderId === order.id);
    return { id, orderId: order ? order.id : null, order, day, left, age, past: age > hold, checked: named || whole, named };
  };
  const loose = c.debtLog.filter((e) => e.orderId == null);
  // As the server sums them: a charge adds, every other line (a payment) takes away.
  const opening = Math.round(loose.reduce((s, e) => s + (e.type === 'charge' ? e.amount : -e.amount), 0));
  const firstDay = loose.filter((e) => e.type === 'charge').map((e) => e.day).sort()[0] || today;
  const invoices = b.orders.filter((o) => o.customerId === c.id && o.invoiced && !o.voided && !o.qa && orderOwes(o) > 0)
    .sort((x, y) => (x.invoicedAt || x.placedAt) - (y.invoicedAt || y.placedAt))
    .map((o) => bill(o.id, o, dayOf(o.invoicedAt || o.placedAt), orderOwes(o)));
  const bills = (opening > 0 ? [bill(DEBT, null, firstDay, opening), ...invoices] : invoices).sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : 0));
  const sum = (xs: OpenBill[]) => xs.reduce((s, x) => s + x.left, 0);
  const owes = Math.max(0, opening + sum(invoices));
  const checkedIn = sum(bills.filter((x) => x.named)), oldest = owes > 0 && bills.length ? bills[0] : null;
  return {
    owes, bills, take: sum(bills.filter((x) => x.past && !x.checked)), checkedIn, canTake: Math.max(0, owes - checkedIn),
    past: sum(bills.filter((x) => x.past)), under: sum(bills.filter((x) => !x.past)), checked: sum(bills.filter((x) => x.checked)),
    apart: whole ? Math.max(0, sum(bills) - owes) : 0,
    age: oldest ? oldest.age : 0, pastHold: !!oldest && oldest.past, hold: oldest ? holdDay(oldest.day, hold) : null,
  };
}

export interface Owed extends Owing { c: Customer }

/** Everyone who owes (not test records), with their bills. */
export function owedBy(b: Books, now: Ms): Owed[] {
  const today = dayOf(now);
  return b.customers.filter((c) => !c.qa).map((c) => ({ c, ...owingOf(b, c, today) })).filter((w) => w.owes > 0);
}

/**
 * The bills a Take pays, as customers/pay names them: the order ids, and `debt` for the opening balance, so the
 * Take pays all that it says. Past the hold: the bills past it; otherwise every bill. A bill Accounts is checking
 * is never in it (Ggaba: #0521 without #0528).
 */
export function takeBills(w: Pick<Owing, 'bills'>, past: boolean): string[] {
  const out: string[] = [];
  w.bills.filter((x) => !x.checked && (past ? x.past : true)).forEach((x) => {
    const k = x.orderId == null ? 'debt' : String(x.orderId);
    if (!out.includes(k)) out.push(k);
  });
  return out;
}

/** A bill's name: its order number (#0531), or "Opening balance" (GLOSSARY: never an unlabelled debt). */
export const billNo = (id: number): string => (id === DEBT ? 'Opening balance' : orderNo(id));

/** customers/pay's `bills` param ("531,544", "debt,541") as bill ids: `debt` is DEBT. */
export function readBills(param: unknown): number[] | null {
  if (param == null || param === '') return null;
  return String(param).split(',').map((s) => s.trim()).map((s) => (s === 'debt' ? DEBT : Number(s))).filter((n) => n === DEBT || n > 0);
}
