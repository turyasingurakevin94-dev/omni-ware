/*
 * The shop as the Buyer app sees it (docs/spec/04-screens-buyer.md). Plain
 * types only (docs/spec/07-stack.md): Node runs this file as it is.
 *
 * These are the app's words. The two sources (src/core/buyer/demo,
 * src/core/buyer/supabase) both hand the app these shapes; where a field
 * lives in the books is written beside it.
 */
import type { Member, Ms, UGX } from '../types.ts';

/**
 * Where one line stands, in the words both apps use (docs/audit/buyer/handover.md §6):
 * To ask · Asked · Found · Not found · Price up · Client waits · Removed · On the trip · Short · In.
 */
export type LineState = 'toask' | 'asked' | 'found' | 'notfound' | 'priceup' | 'clientwaits' | 'removed' | 'ontrip' | 'short' | 'in';

/** How the Buyer asked a supplier (supplierConfirms[sid].how). */
export type AskWay = 'whatsapp' | 'call' | 'visit';

/** A supplier's answer for one order (saved_quotes.supplierConfirms[supplierId]). */
export interface Confirm {
  /** asked: no answer yet · found: they have it · notfound: they do not (the books' 'confirmed' / 'problem'). */
  state: 'asked' | 'found' | 'notfound';
  askedAt: Ms | null;
  answeredAt: Ms | null;
  how: AskWay | null;
}

/** One line of an order as the Buyer works it (saved_quotes.items[idx]). */
export interface BLine {
  /** Its place in items[] when read (for order on screen only: a removed line shifts the rest). */
  idx: number;
  /** The line's name in every write: items[].lineId (buyer.html names lines by it, never by position). */
  key: string;
  name: string;
  productId: string | null;
  qty: number;
  unit: string;
  /** What it costs us a unit (items[].price): the supplier's price, the agreed one once answered. */
  cost: UGX;
  /** What the client pays a unit (items[].sellPrice). */
  sell: UGX;
  /** Who we buy it from (items[].supplierId); null when nobody does yet. */
  supplierId: string | null;
  /** The cost before a supplier's new price (items[].priceWas), and when it changed (repricedAt). */
  priceWas: UGX | null;
  repricedAt: Ms | null;
  /** The new cost is over the selling price: the Manager decides (items[].priceNote 'nomargin'). */
  ruthDecides: boolean;
  /** The client waits while Sourcing finds it (items[].clientWaits). */
  clientWaits: { at: Ms; via: 'sourcing' | null } | null;
  /** Taken off the bill (saved_quotes.droppedLines). */
  removed: { at: Ms; reason: string } | null;
  /** The item it replaced (buyer_handoffs item_switch). */
  switchedFrom: string | null;
  /** What came in (items[].receivedQty); null before the trip comes back. */
  got: number | null;
}

/** saved_quotes.status as the Buyer meets it. */
export type BStatus = 'draft' | 'awaiting_goods' | 'preparing' | 'pending_delivery' | 'completed' | 'cancelled';

export interface BOrder {
  id: number;
  client: string;
  customerId: string | null;
  /** The salesperson who took it (saved_quotes.user_id). */
  sellerId: string;
  status: BStatus;
  placedAt: Ms;
  lines: BLine[];
  /** Per supplier id. */
  confirms: Record<string, Confirm>;
}

/** A price on the shop's list (product prices by supplier). */
export interface ListPrice {
  item: string;
  productId: string | null;
  supplierId: string;
  price: UGX;
  unit: string;
  /** When someone last confirmed it. */
  at: Ms;
}

export interface Supplier {
  id: string;
  name: string;
  /** Where they are: the market or area the trip drives to (Kiseka, Owino, Katwe …). */
  place: string;
  phone: string;
  whatsapp: boolean;
  /** Of the last asks, how many found it, and how long they take to answer. */
  found: number;
  asked: number;
  replyMins: number | null;
}

/** One line taken on a stop of the trip. */
export interface StopLine {
  orderId: number;
  key: string;
}

export interface Stop {
  supplierId: string;
  lines: StopLine[];
  /** What the plan says it costs. */
  planned: UGX;
  /** What was paid there; null until the stop is done. */
  paid: UGX | null;
  done: boolean;
  /** Taken off this trip before the cash ask. */
  off: boolean;
}

/** The buying trip (collection_trips), one at a time. */
export interface Trip {
  id: string;
  /** planned: not sent yet · cash: the cash ask waits on Accounts · on: cash in hand, buying · in: handed in. */
  state: 'planned' | 'cash' | 'on' | 'in';
  stops: Stop[];
  cash: { amount: UGX; askedAt: Ms | null; givenAt: Ms | null; by: string | null };
  handedInAt: Ms | null;
}

export interface BuyerBooks {
  me: Member;
  team: Member[];
  orders: BOrder[];
  suppliers: Supplier[];
  prices: ListPrice[];
  trip: Trip | null;
  /** When this copy was read. */
  savedAt: Ms;
}
