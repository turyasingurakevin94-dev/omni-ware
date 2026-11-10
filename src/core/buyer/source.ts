/*
 * Where the Buyer app's data comes from. Two sources give the same shapes:
 *
 *   supabase  the shop's real books, read and written as buyer.html does
 *             (src/core/buyer/supabase.ts; docs/spec/04-screens-buyer-data.md)
 *   demo      the sample shop of docs/canvas-cast.md on Sat 17 Oct 2026
 *             (src/core/buyer/demo.ts), the canvas's own figures
 *
 * Screens never call a source: the shell's store does (src/apps/buyer/shell/store.ts).
 * Every write may move an order: when the last line of an order is found it
 * moves to Buying (orderLeaveDraft), inside the same write.
 */
import type { Session, UGX } from '../types.ts';
import type { AskWay, BuyerBooks } from './types.ts';

/** A line is named by its order and key (BLine.key: items[].lineId). */
export interface PriceAnswer { orderId: number; key: string; cost: UGX }
export interface StopCount { orderId: number; key: string; got: number }

export interface BuyerSource {
  readonly kind: 'demo' | 'supabase';
  now(): number;
  online(): boolean;

  session(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;

  books(): Promise<BuyerBooks>;

  /* asking */
  /** Asked a supplier for every line of theirs not found yet, on every order (one message); asked again, the ask is new (no longer late). */
  ask(supplierId: string, way: AskWay): Promise<void>;
  /** They have it all at the same price: every asked line of theirs is Found. */
  answerYes(supplierId: string): Promise<void>;
  /** They have it at new prices: the lines' costs change; over the selling price, the Manager decides. */
  answerPrice(supplierId: string, prices: PriceAnswer[]): Promise<void>;
  /** They do not have it: every asked line of theirs is Not found (Sales is pushed). */
  answerNo(supplierId: string): Promise<void>;
  /** Undo an answer just recorded (the 5-second Undo): their lines go back to Asked, prices as they were. */
  undoAnswer(supplierId: string): Promise<void>;

  /* a line not found */
  /** Buy it from another supplier: the line goes back to To ask with them. */
  otherSupplier(orderId: number, key: string, supplierId: string, cost: UGX): Promise<void>;
  /** The client waits while Sourcing finds it (a request to Sourcing). */
  clientWaits(orderId: number, key: string): Promise<void>;
  /** Off the bill, with the reason Sales is told. */
  removeLine(orderId: number, key: string, reason: string): Promise<void>;
  /** Another item in its place (item_switch, Sales is pushed). */
  switchItem(orderId: number, key: string, to: { name: string; productId: string | null; supplierId: string; cost: UGX; why?: string }): Promise<void>;

  /* the trip */
  /** The planned trip's stops on or off. */
  setStopOff(supplierId: string, off: boolean): Promise<void>;
  /** Send the cash ask to Accounts for the trip as planned. */
  askCash(): Promise<void>;
  /** At a stop: what came (each line) and what was paid. */
  stopDone(supplierId: string, counts: StopCount[], paid: UGX): Promise<void>;
  /** Undo a stop just done (TripOn.dc.html, Success: "Undo 5"): open again, what came kept as a draft. Refused once handed in. */
  undoStop(supplierId: string): Promise<void>;
  /** Back at the shop: the goods to the Store to count in, the cash back to Accounts. */
  handIn(): Promise<void>;

  /* suppliers */
  /** A price the supplier told us by phone goes straight on the list (price.confirm). */
  confirmPrice(supplierId: string, productId: string | null, item: string, price: UGX): Promise<void>;
  /** A phone number or other detail, suggested to Sourcing. */
  suggestPhone(supplierId: string, phone: string): Promise<void>;
  /** Nobody sells it: Sourcing is asked to find it. */
  askSourcing(item: string): Promise<void>;
}
