/*
 * What the Customers tab reads off the books, once (FACTS §3): each
 * customer's bills, what is being checked, their rhythm, promises and live
 * orders. Pure functions over Books and today; the money rules are
 * src/core/money.ts's (orderOwes, holdDay, pastHold), never re-derived here.
 */
import { holdDay, orderOwes, pastHold } from '../../../core/money.ts';
import { addDays, dayOf, daysApart } from '../../../core/time.ts';
import type { Books, Customer, Day, Order, PayPromise, PaymentAsk } from '../../../core/types.ts';

export interface Bill {
  order: Order;
  id: number;
  /** The day it was billed (its invoice). */
  day: Day;
  /** Still to pay on it. */
  left: number;
  age: number;
  past: boolean;
  /** Esther is checking it (an open payment ask names it). */
  checked: boolean;
}

/** A customer's open bills, oldest first: invoiced, not voided, with something left (receive_payment's order, 0169). */
export function billsOf(b: Books, c: Customer, today: Day): Bill[] {
  const asks = openAsks(b, c.id);
  return b.orders
    .filter((o) => o.customerId === c.id && o.invoiced && !o.voided && !o.qa && orderOwes(o) > 0)
    .sort((x, y) => (x.invoicedAt || 0) - (y.invoicedAt || 0))
    .map((o) => {
      const day = dayOf(o.invoicedAt || o.placedAt);
      return { order: o, id: o.id, day, left: orderOwes(o), age: daysApart(day, today), past: pastHold(day, today, b.settings.holdDays), checked: asks.some((a) => a.orderId === o.id) };
    });
}

/** Asks to Esther that still wait on this customer (payment_asks, status sent). */
export function openAsks(b: Books, customerId: string): PaymentAsk[] {
  return b.paymentAsks.filter((a) => a.customerId === customerId && a.status === 'sent' && (a.what === 'bill' || a.what === 'balance'));
}

export interface Money {
  owes: number;
  bills: Bill[];
  /** Inside what they owe and being checked (Ggaba's #0528). */
  checkedIn: number;
  /** The bills say more than the balance, and Esther is checking (Lubowa: 349,000 apart, owes 0). */
  apart: number;
  /** What Sales should take now: owes less what is being checked. */
  take: number;
  past: boolean;
  oldest: number;
  hold: Day | null;
}

export function moneyOf(b: Books, c: Customer, today: Day): Money {
  const bills = billsOf(b, c, today), owes = Math.max(0, c.owes);
  const checkedIn = bills.filter((x) => x.checked).reduce((s, x) => s + x.left, 0);
  const sum = bills.reduce((s, x) => s + x.left, 0);
  const apart = openAsks(b, c.id).some((a) => a.what === 'balance') ? Math.max(0, sum - owes) : 0;
  const oldest = owes > 0 && bills.length ? bills[0].age : 0;
  return {
    owes, bills, checkedIn, apart, take: Math.max(0, owes - checkedIn),
    past: owes > 0 && oldest > b.settings.holdDays, oldest,
    hold: owes > 0 && bills.length ? holdDay(bills[0].day, b.settings.holdDays) : null,
  };
}

export type RingTone = 'due' | 'late' | 'quiet' | 'early';

export interface Rhythm {
  every: number | null;
  last: Order | null;
  lastDay: Day | null;
  due: Day | null;
  /** Days to the due day: 0 today, below 0 late. */
  toDue: number;
  tone: RingTone;
  /** How much of their gap has run out, 0 to 1. */
  fill: number;
}

/** Last order = the most recent order placed (FACTS §3.2); next due = last + their rhythm; twice the gap = gone quiet. */
export function rhythmOf(b: Books, c: Customer, today: Day): Rhythm {
  const mine = b.orders.filter((o) => o.customerId === c.id && !o.qa && !o.cancelled);
  const last = mine.reduce<Order | null>((m, o) => (!m || o.placedAt > m.placedAt ? o : m), null);
  const every = c.everyDays && c.everyDays > 0 ? c.everyDays : null;
  if (!last || !every) return { every, last, lastDay: last ? dayOf(last.placedAt) : null, due: null, toDue: 1, tone: 'early', fill: 0 };
  const lastDay = dayOf(last.placedAt), due = addDays(lastDay, every), toDue = daysApart(today, due), gone = daysApart(lastDay, today);
  const tone: RingTone = gone >= every * 2 ? 'quiet' : toDue < 0 ? 'late' : toDue === 0 ? 'due' : 'early';
  return { every, last, lastDay, due, toDue, tone, fill: tone === 'early' ? Math.max(0, Math.min(1, gone / every)) : 1 };
}

/** The promise to pay still ahead (or today), soonest first. */
export function promiseOf(b: Books, c: Customer, today: Day): PayPromise | null {
  return b.promises.filter((p) => p.customerId === c.id && p.on >= today).sort((x, y) => (x.on < y.on ? -1 : 1))[0] || null;
}

/** Live orders that wait on Sales for money before they move (Mukono's #0551: "Not paid yet"). */
export function waitingOnMe(b: Books, c: Customer): Order[] {
  return b.orders.filter((o) => o.customerId === c.id && !o.invoiced && !o.cancelled && !o.voided && o.stage !== 'delivered' && o.holderId === b.me.id && orderOwes(o) > 0);
}

/** Live orders (not delivered, not called off), newest first. */
export function liveOf(b: Books, c: Customer): Order[] {
  return b.orders.filter((o) => o.customerId === c.id && !o.cancelled && !o.voided && o.stage !== 'delivered').sort((x, y) => y.placedAt - x.placedAt);
}

/** Grace's customers: everyone in the books but test records (FACTS §3: 38). */
export function customersOf(b: Books): Customer[] {
  return b.customers.filter((c) => !c.qa);
}

/** "Kato" from "Kato Construction"; "Ggaba" from "Ggaba Stores" (the first word, as the boards call them). */
export function short(name: string): string {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/** "Ntinda · Contractor". */
export function placeKind(c: Customer): string {
  const kind = c.kind ? c.kind[0].toUpperCase() + c.kind.slice(1) : '';
  return [c.place, kind].filter(Boolean).join(' · ');
}

/** "701 552 904" from any way it was typed (0701…, +256 701…, 701552904). */
export function nine(s: string): string {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('256')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
}
export const spaced = (d: string) => d.replace(/^(\d{3})(\d{0,3})(\d{0,3}).*$/, (_m, a, b, c) => [a, b, c].filter(Boolean).join(' ')) || d;
