/*
 * Where the Manager app's data comes from. Two sources give the same shapes:
 *
 *   supabase  the shop's real books (src/core/manager/supabase/; docs/spec/04-screens-manager-data.md)
 *   demo      the sample day of docs/canvas/manager/BRIEF.md, Sat 17 Oct 2026 09:40 (src/core/manager/demo/)
 *
 * One method per read and per answer. Screens never call a source: the shell's store
 * does (src/apps/manager/shell/store.ts `act` / `hold`), through the one outbox, so an
 * answer made with no signal is kept and sent once. A source never words an error:
 * it throws a DataError (src/core/datasource.ts); src/core/manager/errors.ts says it.
 *
 * A tap answer waits 10 s with Undo on the phone before it is sent (spec §3.3), so no
 * write here needs an undo of its own. A slide is sent at once.
 */
import type { Day, ManagerBooks, ManagerSession, Ms, Stage, UGX } from './types.ts';

export type PriceWord = 'approved' | 'set' | 'shop';
export type Money = { how: 'refund'; account: 'cash' | 'momo' | 'bank' } | { how: 'deposit' } | null;
export interface LimitPick { limit: UGX; days: number }

export interface ManagerSource {
  readonly kind: 'demo' | 'supabase';
  now(): Ms;
  online(): boolean;

  /* ---- who ---- */
  session(): Promise<ManagerSession | null>;
  signIn(email: string, password: string): Promise<ManagerSession>;
  signOut(): Promise<void>;

  /* ---- reads ---- */
  /** Everything (data §1): the queue's asks, the orders, the customers, the team, money in today, today's answers. */
  snapshot(): Promise<ManagerBooks>;
  /** The live refresh (every 45 s while open): the asks and the orders that can still change, over the last snapshot. */
  live(): Promise<ManagerBooks>;
  /** The copy this phone saved, or null (Could not reach the shop → open the copy). */
  savedCopy?(): Promise<ManagerBooks | null>;

  /* ---- prices (D-1 … D-4, D-33) ---- */
  price(orderId: number, idx: number, price: UGX, word: PriceWord): Promise<void>;
  /** D-2 with no known cost: the cost first, then the price. */
  costAndPrice(orderId: number, idx: number, cost: UGX, price: UGX): Promise<void>;
  /** D-2 with no known cost: ask the Buyer for it. */
  askCost(orderId: number, idx: number): Promise<void>;
  markup(productId: string, markup: number): Promise<void>;

  /* ---- credit (D-5, D-6, D-7, D-25, D-32) ---- */
  credit(orderId: number, yes: boolean, limit: LimitPick | null): Promise<void>;
  storeCredit(orderId: number, yes: boolean, limit: LimitPick | null): Promise<void>;
  limitAsk(askId: string, yes: boolean, limit: LimitPick | null): Promise<void>;
  setLimit(customerId: string, limit: LimitPick | null): Promise<void>;

  /* ---- the bill (D-8 … D-11, D-12) ---- */
  invoiceNow(orderId: number): Promise<void>;
  billSmall(orderId: number): Promise<void>;
  givenAway(orderId: number, idxs: number[], why: string): Promise<void>;
  /** D-10 Bill it: the lines at 0 go back to be priced (W13's other branch: no selling price, a price ask): D-2 asks it. */
  priceAgain(orderId: number, idxs: number[]): Promise<void>;
  settlePick(orderId: number, all: boolean): Promise<void>;

  /* ---- stock (D-13 … D-17, D-23, D-24) ---- */
  takeCheckin(tripId: string, noteId: string | null): Promise<void>;
  extra(askId: string, keep: boolean): Promise<void>;
  writeOff(reportIds: string[], keepIds: string[]): Promise<void>;
  keepOnShelf(reportIds: string[]): Promise<void>;
  countTaken(countId: string): Promise<void>;
  countAgain(countId: string): Promise<void>;
  restock(restockId: string, hold: boolean): Promise<void>;
  carton(restockId: string, ok: boolean): Promise<void>;

  /* ---- after the order (D-18 … D-22) ---- */
  creditNote(askId: string, orderId: number, lines: { idx: number; qty: number; back: boolean }[], cashBack: boolean): Promise<void>;
  keepSold(askId: string): Promise<void>;
  voidBill(askId: string, orderId: number, reason: string, money: Money): Promise<void>;
  keepBilled(askId: string): Promise<void>;
  cancel(askId: string, orderId: number, money: Money): Promise<void>;
  keepOrder(askId: string, words: string): Promise<void>;
  cancelTwin(dropId: number, keepId: number): Promise<void>;
  bothReal(a: number, b: number): Promise<void>;
  agent(orderId: number, agreed: number[], cancel: boolean): Promise<void>;

  /* ---- money and the team (D-26 … D-31) ---- */
  merge(keepId: string, dropId: string): Promise<void>;
  notSame(a: string, b: string): Promise<void>;
  opening(customerId: string, amount: UGX, since: Day): Promise<void>;
  promise(customerId: string, on: Day, amount: UGX): Promise<void>;
  goals(month: string, goals: { staffId: string; amount: UGX }[]): Promise<void>;
  stageLimits(limits: Partial<Record<Stage, number>>): Promise<void>;
  holdDays(days: number): Promise<void>;
  nudge(staffId: string, orderId: number | null, words: string): Promise<void>;
  giveTo(orderId: number, staffId: string): Promise<void>;

  /** This phone gets the Manager's pushes (the real books in the phone app). */
  pushOn?(): Promise<void>;
}

/** Every write's name, for the outbox, the demo's &fail=<write>, and the tests. */
export const WRITES = [
  'price', 'costAndPrice', 'askCost', 'markup',
  'credit', 'storeCredit', 'limitAsk', 'setLimit',
  'invoiceNow', 'billSmall', 'givenAway', 'priceAgain', 'settlePick',
  'takeCheckin', 'extra', 'writeOff', 'keepOnShelf', 'countTaken', 'countAgain', 'restock', 'carton',
  'creditNote', 'keepSold', 'voidBill', 'keepBilled', 'cancel', 'keepOrder', 'cancelTwin', 'bothReal', 'agent',
  'merge', 'notSame', 'opening', 'promise', 'goals', 'stageLimits', 'holdDays', 'nudge', 'giveTo',
] as const;
export type WriteName = (typeof WRITES)[number];
