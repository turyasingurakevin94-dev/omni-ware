/*
 * The shop as the Manager app sees it (docs/spec/04-screens-manager.md,
 * 04-screens-manager-data.md). Plain types only (spec 07): Node runs this file as it is.
 *
 * The Manager sees money: every figure here is whole shillings (UGX). These are
 * the app's words, not the database's columns: src/core/manager/supabase/rows.ts
 * is the one place a row becomes one of them; the demo (src/core/manager/demo)
 * builds them from docs/canvas/manager/BRIEF.md, the sample day.
 *
 * The decisions are not stored as such: each ask lives where the asking app
 * wrote it (a line's priceNote, payload.creditAsk, store_asks, stock_reports,
 * invoice_asks, cancel_asks …). The source turns each open one into an `Ask`;
 * src/core/manager/queue.ts orders them, and the decide/*.ts files draw the evidence.
 */
import type { Day, Ms, Tint, UGX } from '../types.ts';

export type { Day, Ms, Tint, UGX };

/** The order's stage (saved_quotes.status); the screens' words are in words.ts STAGE. */
export type Stage = 'draft' | 'awaiting_goods' | 'preparing' | 'pending_delivery' | 'completed' | 'cancelled';

/** The roles a person on the team holds, as the Manager's screens name them ("From Musa · Store"). */
export type TeamRole = 'sales' | 'buyer' | 'store' | 'accounts' | 'sourcing' | 'agent' | 'driver' | 'manager' | 'owner';

export interface Person {
  /** staff.id (or the login for a member with no staff row: 'user:<uuid>'). */
  id: string;
  /** The login, when they have one (pushes go to it); null for a driver with no phone. */
  userId: string | null;
  /** Display name (staff.name tidied, else shop_members.display_name). Never the email. */
  name: string;
  initials: string;
  tint: Tint;
  role: TeamRole;
  /** Off today (staff.unavailable). */
  off: boolean;
  /** Sales: this month's goal (manager_notes kind 'target', body.who), or null. */
  goal: UGX | null;
  goalNoteId: string | null;
  /** Sales: invoiced this month by them (the orders they took). */
  sold: UGX;
  /** What they hold now, in words the Team tab draws ("Packing 2", "3 orders", "On the road"). */
  holds: string;
}

export interface Bill {
  /** The order it is for; 0 for the opening balance. */
  orderId: number;
  day: Day;
  /** What is still owed on it. */
  left: UGX;
}

export interface Promise_ {
  id: string;
  on: Day;
  madeOn: Day;
  amount: UGX | null;
  state: 'kept' | 'broken' | 'open';
}

export interface Cust {
  id: string;
  name: string;
  initials: string;
  phone: string;
  place: string;
  /** customers.debt; below 0 is a deposit. */
  owes: UGX;
  /** customers.credit_limit; null = no limit set (cash only). */
  limit: UGX | null;
  termsDays: number | null;
  /** Unpaid bills, oldest first (the opening balance as orderId 0). */
  bills: Bill[];
  promises: Promise_[];
  /** Who sells to them (staff ids), the one who sold last first. */
  sellers: string[];
  /** How many orders they have. */
  orders: number;
  /** A record that looks like this one (same phone or name), not marked "Not the same": its id. */
  lookAlike: { id: string; why: 'phone' | 'name' } | null;
  /** The old books' figure after a fresh start, not yet confirmed (fresh_starts.old_debts). */
  oldBooks: { amount: UGX; since: Day } | null;
  /** A test record (0167): kept, in no figure. */
  qa: boolean;
}

export interface MLine {
  idx: number;
  name: string;
  unit: string;
  qty: number;
  /** items[].price: what it costs us; null = not known yet. */
  cost: UGX | null;
  /** items[].sellPrice: what it sells at; null = price coming. */
  price: UGX | null;
  /** The shop's price for it now (cost × the item's markup). */
  shopPrice: UGX | null;
  /** The item's markup, as a fraction (0.25), when known. */
  markup: number | null;
  /** '__stock__' or a supplier id. */
  supplierId: string | null;
  supplierName: string;
  /** Buying: 'found' | 'up' (price up) | 'notfound' | null. */
  buying: 'found' | 'up' | 'notfound' | null;
  /** Packed: how many went (pickedQty), when packed short. */
  packed: number | null;
  givenAway: string | null;
  productId: string | null;
}

export interface MOrder {
  id: number;
  customerId: string | null;
  customerName: string;
  /** Who took it (payload.takenBy staff id). */
  sellerId: string | null;
  stage: Stage;
  /** When it entered its stage. */
  stageAt: Ms;
  createdAt: Ms;
  lines: MLine[];
  total: UGX;
  paid: UGX;
  /** Who holds it now (the packer, the driver, the buyer): a staff id. */
  holderId: string | null;
  deliveredAt: Ms | null;
  invoiced: boolean;
  invoiceNo: string | null;
  /** On credit (payload.credit). */
  credit: boolean;
  /** The order's own trip with a driver (Ssali), its name. */
  driver: string | null;
  /** The hourly run could not bill it: the database's code (OWSML, OWGIV, OWTPC, OWPRC, OWSHP). */
  heldCode: string | null;
  /** The two orders Ruth marked "Both are real". */
  twinOk: number[];
  counter: boolean;
}

/* ---------------- the asks (one per open decision) ---------------- */

interface AskBase {
  /** Unique in the queue: '<kind>:<row id>' (the decide route's id). */
  key: string;
  /** When it was asked. */
  at: Ms;
  /** The asker's staff id (or a person's id); null when the app spots it (D-9, D-10, D-21). */
  askerId: string | null;
  /** Someone is standing there (a counter sale, a truck waiting): first in the queue. */
  standing: boolean;
  orderId: number | null;
}

export type PriceMode = 'under' | 'coming' | 'up';
export interface PriceAsk extends AskBase { kind: 'price'; mode: PriceMode; idx: number; asked: UGX | null; costWas: UGX | null }
export interface CounterAsk extends AskBase { kind: 'counter'; idx: number; asked: UGX }
export interface MarkupAsk extends AskBase { kind: 'markup'; productId: string; name: string; cost: UGX; rivals: [UGX, UGX] | null; markup: number }
export interface CreditAsk extends AskBase { kind: 'credit'; why: 'limit' | 'age' | 'nolimit' }
export interface StoreCreditAsk extends AskBase { kind: 'storecredit'; carrier: string | null }
export interface LimitAsk extends AskBase { kind: 'limit'; askId: string; customerId: string; amount: UGX; days: number; why: string }
export interface BillAsk extends AskBase { kind: 'bill'; code: string }
export interface GivenAsk extends AskBase { kind: 'given'; idxs: number[] }
export interface ShortAsk extends AskBase { kind: 'short' }
export interface CheckinLine { name: string; unit: string; brought: number; counted: number; cost: UGX; place: string }
export interface CheckinAsk extends AskBase { kind: 'checkin'; tripId: string; runnerId: string | null; lines: CheckinLine[]; note: { text: string; at: Ms; handoffId: string } | null }
export interface ExtraAsk extends AskBase { kind: 'extra'; askId: string; tripId: string; name: string; unit: string; qty: number; onList: number; cost: UGX | null; from: string }
export interface LossReport { id: string; key: string; name: string; unit: string; qty: number; why: 'damaged' | 'lost' | 'stolen'; note: string; photo: string | null; cost: UGX; shelf: number }
export interface LossAsk extends AskBase { kind: 'loss'; reports: LossReport[] }
export interface CountLine { key: string; name: string; system: number; counted: number; cost: UGX }
export interface CountAsk extends AskBase { kind: 'count'; countId: string; aisle: string; lines: CountLine[] }
export interface ReturnAsk extends AskBase { kind: 'return'; askId: string; lines: { idx: number; qty: number }[]; amount: UGX; reason: string; note: string }
export interface VoidAsk extends AskBase { kind: 'void'; askId: string; amount: UGX; reason: string; note: string }
export interface CancelAsk extends AskBase { kind: 'cancel'; askId: string; why: string; note: string }
export interface TwinsAsk extends AskBase { kind: 'twins'; keep: number; drop: number; same: boolean }
export interface AgentAsk extends AskBase { kind: 'agent'; cancel: boolean; lines: { idx: number; from: number; to: number }[] }
export interface CartonAsk extends AskBase { kind: 'carton'; restockId: string; name: string; unit: string; forOrder: number; forShelf: number; cost: UGX; perMonth: number }

export type Ask = PriceAsk | CounterAsk | MarkupAsk | CreditAsk | StoreCreditAsk | LimitAsk | BillAsk | GivenAsk | ShortAsk
  | CheckinAsk | ExtraAsk | LossAsk | CountAsk | ReturnAsk | VoidAsk | CancelAsk | TwinsAsk | AgentAsk | CartonAsk;
export type AskKind = Ask['kind'];

/** Denis's restock list (D-23): not an ask, a list the Manager can hold. */
export interface RestockLine { id: string; name: string; unit: string; qty: number; cost: UGX; weeksLeft: number | null; held: boolean }

/** One line of Today's answers (the decision log, and what the app did by itself). */
export interface Done {
  at: Ms;
  /** The answer's words ("Approved", "Billed itself"). */
  word: string;
  /** The line under it ("#0555 · 46,000"). */
  sub: string;
  /** Who was told (staff ids). */
  told: string[];
  /** The app did it by itself. */
  auto: boolean;
}

export interface Shop {
  name: string;
  /** This month's goal for the shop (the sum of the people's, else the shop's own). */
  goal: UGX;
  /** Credit hold days (presets.creditHold), 21 by default. */
  holdDays: number;
  /** Stage limits in minutes (presets.orderStageLimits). */
  stageLimits: Partial<Record<Stage, number>>;
  /** The shop's default markup, a fraction. */
  defaultMarkup: number;
  /** Counter and agents' goal for the month. */
  counterGoal: UGX;
  counterSold: UGX;
}

/** Everything the Manager's screens read, as last read. */
export interface ManagerBooks {
  at: Ms;
  me: Person;
  shop: Shop;
  team: Person[];
  customers: Cust[];
  orders: MOrder[];
  asks: Ask[];
  restock: RestockLine[];
  /** Money in today, by account (test payments left out). */
  inToday: { cash: UGX; momo: UGX; bank: UGX };
  /** Today's answers, newest first. */
  done: Done[];
}

export interface ManagerSession {
  userId: string;
  shopId: string;
  shopName: string;
  email: string;
  role: string;
  staffId: string | null;
}
