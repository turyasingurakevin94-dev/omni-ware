/*
 * What the Customers tab reads off the books (FACTS §3): their rhythm's ring, promises and live orders.
 * Who owes and their bills are core/owing.ts's (owingOf), the rhythm core/customers.ts's, the money
 * rules core/money.ts's: never re-derived here.
 */
import { heldFor } from '../../../core/orders.ts';
import { rhythm } from '../../../core/customers.ts';
import type { Books, Customer, Day, Order, PayPromise } from '../../../core/types.ts';

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

/**
 * The ring and dots of a customer's rhythm, read off the one rule (core/customers.ts rhythm: last order, due,
 * gone quiet). Only the picture is worked out here: the tone and how much of their gap has run out.
 */
export function rhythmOf(b: Books, c: Customer, today: Day): Rhythm {
  const r = rhythm(c, b.orders, today), last = r.lastOrder, every = r.every;
  if (!last || !every || !r.last || !r.next) return { every, last, lastDay: r.last, due: null, toDue: 1, tone: 'early', fill: 0 };
  const toDue = -(r.late || 0), gone = r.since || 0;
  const tone: RingTone = r.quiet ? 'quiet' : toDue < 0 ? 'late' : toDue === 0 ? 'due' : 'early';
  return { every, last, lastDay: r.last, due: r.next, toDue, tone, fill: tone === 'early' ? Math.max(0, Math.min(1, gone / every)) : 1 };
}

/** The promise to pay still ahead (or today), soonest first. */
export function promiseOf(b: Books, c: Customer, today: Day): PayPromise | null {
  return b.promises.filter((p) => p.customerId === c.id && p.on >= today).sort((x, y) => (x.on < y.on ? -1 : 1))[0] || null;
}

/** Live orders that wait on Sales for money before they move (Mukono's #0551: "Not paid yet"). */
export function waitingOnMe(b: Books, c: Customer): Order[] {
  return b.orders.filter((o) => o.customerId === c.id && heldFor(o, b.me.id));
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
