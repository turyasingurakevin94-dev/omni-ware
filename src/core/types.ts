/*
 * The shop as the Sales app sees it. Plain types only (docs/spec/07-stack.md):
 * Node runs this file as it is, so no enum, no namespace.
 *
 * These are the app's words, not the database's columns. The two data
 * sources (src/core/supabase, src/core/demo) both hand the app these shapes;
 * src/core/supabase/rows.ts is the one place a row becomes one of them.
 * Where a field comes from in the database is written beside it.
 */

/** Whole Uganda shillings (docs/spec/02-money.md §1: every money figure is whole). */
export type UGX = number;
/** A moment, in milliseconds since 1970. */
export type Ms = number;
/** A calendar day in Kampala, 'YYYY-MM-DD' (spec 02 §8 Q13). */
export type Day = string;

/** Avatar tint: identity, never state (LANGUAGE.md §1.1). 'me' is the phone's owner. */
export type Tint = 't0' | 't1' | 't2' | 't3' | 't4' | 't5' | 'me';

/** shop_members.role (spec 05 §1), plus 'driver' for a staff row with no login. */
export type Role = 'owner' | 'admin' | 'manager' | 'sales' | 'buyer' | 'store' | 'accounts' | 'sourcing' | 'staff' | 'driver';

/** Cash · Mobile · Bank on screen; cash_txns.account in the books. */
export type Method = 'cash' | 'momo' | 'bank';

export interface Member {
  /** The login (auth user id). A driver with no login: 'staff:<staff id>'. */
  id: string;
  /** Display name (shop_members.display_name, else staff.name). Never the email handle. */
  name: string;
  initials: string;
  role: Role;
  tint: Tint;
  /** member_presence: on now, away (and since when), or out (buying, driving). */
  presence: 'on' | 'away' | 'out' | null;
  presenceSince: Ms | null;
  /** The chat they have open, and the chat they are typing in (member_presence.conv_id, typing_at). */
  inChat: number | null;
  typingIn: number | null;
}

export type CustomerKind = 'contractor' | 'reseller' | 'retail';

/** customer_debt_log: every charge and payment on a customer's balance (spec 02 §5). */
export interface DebtEntry {
  id: number;
  day: Day;
  type: 'charge' | 'payment' | 'opening' | 'adjust';
  amount: UGX;
  orderId: number | null;
  paymentId: number | null;
  note: string;
}

export interface Customer {
  id: string;
  name: string;
  initials: string;
  tint: Tint;
  phone: string;
  phone2: string;
  /** customers.location: "Ntinda". */
  place: string;
  kind: CustomerKind | null;
  /** Where deliveries go: "Plot 12, Ntinda Rd". */
  address: string;
  /** customers.debt, kept by the server (0169 saved_quotes_sync_debt). Below 0 is a deposit. */
  owes: UGX;
  /** customers.credit_limit; null or 0 = no limit set (the Manager decides). */
  creditLimit: UGX | null;
  termsDays: number | null;
  /** Their ordering rhythm in days ("every 10 days"); null when not known yet. */
  everyDays: number | null;
  /** Their usual: what they buy most orders. */
  usual: UsualLine[];
  debtLog: DebtEntry[];
  /** A test record (0167): kept, listed, in no figure. */
  qa: boolean;
}

export interface UsualLine {
  itemId: string;
  variantIdx: number | null;
  qty: number;
  /** How often it is in their orders, e.g. 7 of 7 ("every order"), 5 of 7. */
  seen: number;
  of: number;
}

/** The five stages (spec 01 §1a). The status column: draft, awaiting_goods, preparing, pending_delivery, completed. */
export type Stage = 'checking' | 'buying' | 'packing' | 'road' | 'delivered';

export interface StageStep {
  stage: Stage;
  at: Ms;
  /** Who moved it there, when known (member id). */
  by: string | null;
}

/** What happened to a line on its way (Buying, Packing). */
export type LineState = 'waiting' | 'came' | 'packed' | 'short' | 'dropped';

/** The Manager's answer on a line's price (items[].priceReview, written only with price.approve). */
export interface PriceReview {
  state: 'approved' | 'changed';
  price: UGX;
  was: UGX | null;
  by: string;
  byName: string;
  at: Ms;
}

export interface Line {
  lineId: number;
  itemId: string;
  variantIdx: number | null;
  name: string;
  unit: string;
  packUnit: string;
  packQty: number;
  qty: number;
  /** The selling price each. null = "Price coming" (no shop price yet, spec 02 Q4). */
  price: UGX | null;
  /** The cost each (items[].price). The floor; never drawn. */
  cost: UGX | null;
  /** The shop's price each, when the line has a rule (to show "−1,000" against it). */
  shopPrice: UGX | null;
  /** Our shelf, a supplier, or nobody yet (items[].supplierId '__stock__' / id / ''). */
  from: 'shelf' | 'supplier' | 'none';
  supplierId: string;
  /** Who set a price the Manager decides, and why (decision-rights "The price decision"). */
  priceBy: string | null;
  priceNote: 'under' | 'nomargin' | 'nocost' | null;
  priceReview: PriceReview | null;
  /** When the customer was told of the Manager's price (items[].priceToldAt). */
  priceToldAt: Ms | null;
  state: LineState | null;
  stateAt: Ms | null;
}

export interface Charge {
  id: number;
  /** "Delivery · Ntinda", "Loading". The credit charge is never one of these: see money.ts. */
  label: string;
  type: 'fixed' | 'percent';
  value: number;
}

/** A payment as it sits on an order (payload.payments[]); written only by server functions. */
export interface OrderPayment {
  id: number;
  day: Day;
  amount: UGX;
  method: Method;
  /** The cash book receipt it matches (cash_txns.id). */
  paymentId: number | null;
}

export interface Order {
  id: number;
  customerId: string | null;
  /** Who it is for, as written on the order ("Walk-in" for none). */
  client: { name: string; phone: string };
  placedAt: Ms;
  /** payload.takenBy: the salesperson's login. */
  placedBy: string | null;
  stage: Stage;
  stageAt: Ms;
  stageLog: StageStep[];
  /** Who holds it now (Ruth deciding, Denis buying, Musa packing, Ssali driving). */
  holderId: string | null;
  lines: Line[];
  charges: Charge[];
  /** payload.credit: on credit terms (the Credit charge line, money.ts). */
  credit: { pct: number; days: number } | null;
  discount: UGX;
  payments: OrderPayment[];
  /** saved_quotes.amount_paid = the sum of payments. */
  paid: UGX;
  invoiced: boolean;
  invoicedAt: Ms | null;
  voided: boolean;
  /** status 'cancelled' (0177), or a void before the invoice. */
  cancelled: boolean;
  /** A counter sale: invoiced and paid on the spot (counter_sale). */
  counter: boolean;
  /** Where it goes; null = they collect it. */
  deliverTo: string | null;
  deliveredAt: Ms | null;
  /** What the customer was told it comes to, when that differs from now (#0552: told 1,750,000). */
  toldTotal: UGX | null;
  qa: boolean;
}

/** A receipt in the cash book (cash_txns), in what the app needs of it. */
export interface Payment {
  id: number;
  at: Ms;
  day: Day;
  amount: UGX;
  method: Method;
  customerId: string | null;
  orderId: number | null;
  /** Who took it (member id), when known. */
  by: string | null;
  /** The mobile money or bank transaction ID. */
  ref: string;
  qa: boolean;
}

export interface Item {
  id: string;
  variantIdx: number | null;
  /** Exactly as FACTS §7 spells it: "Iron sheet G28 · 3m". */
  name: string;
  aisle: string;
  unit: string;
  packUnit: string;
  packQty: number;
  /** The shop's price each. null = "Price coming". */
  price: UGX | null;
  /** The pack's price, when it sells by the pack too (Zawaina hinge: 80,000 a carton of 50). */
  packPrice: UGX | null;
  /** The cost each, the floor a typed price may not go under (0171). Never drawn. null = not known. */
  cost: UGX | null;
  /** On the shelf to sell. null = not shown. */
  onShelf: number | null;
  /** None on the shelf, but it can be ordered in from a supplier. */
  orderIn: boolean;
  /** Listed today by Sourcing (Roof paint: 10:34). */
  listedAt: Ms | null;
}

/** A WhatsApp chat (wa_conversations). */
export interface Chat {
  id: number;
  waId: string;
  /** "0701 552 904". */
  phone: string;
  /** The name on their WhatsApp ("Mama Shine"). */
  profileName: string;
  customerId: string | null;
  /** The chat's salesperson (owner_user_id, 0170). null = nobody has taken it. */
  ownerId: string | null;
  ownerAt: Ms | null;
  lastInAt: Ms | null;
  lastAt: Ms | null;
  lastReadAt: Ms | null;
}

export interface Message {
  id: string;
  chatId: number;
  at: Ms;
  dir: 'in' | 'out';
  kind: 'text' | 'image' | 'audio' | 'document' | 'template' | 'catalog';
  body: string;
  /** Who sent an outgoing message (wa_messages.sent_by). */
  by: string | null;
  /** sent → delivered → read, or failed; 'kept' = on this phone, not sent yet. */
  state: 'sent' | 'delivered' | 'read' | 'failed' | 'kept' | null;
}

/** A team note on a chat, never sent to the customer (wa_notes, 0170). */
export interface ChatNote {
  id: string;
  chatId: number;
  at: Ms;
  by: string;
  body: string;
}

/** What happened to a chat: taken, handed (Give), moved by the Manager (wa_conv_events). */
export interface ChatEvent {
  id: string;
  chatId: number;
  at: Ms;
  kind: 'taken' | 'handed' | 'moved';
  by: string;
  to: string | null;
  note: string;
}

/** A customer's promise to pay (payment_promises). */
export interface PayPromise {
  id: number;
  customerId: string;
  on: Day;
  madeOn: Day;
  amount: UGX | null;
}

/** An item asked of Sourcing (sourcing_leads), with each time it was asked. */
export interface SourcingAsk {
  id: string;
  name: string;
  status: 'asked' | 'looking' | 'found' | 'priced' | 'listed' | 'dropped';
  createdAt: Ms;
  stageAt: Ms;
  itemId: string | null;
  requests: { at: Ms; by: string | null; customerId: string | null; qty: number }[];
  /** Suppliers asked, and when ("Katwe Fabricators Wed 14 Oct"). */
  tried: { supplier: string; at: Ms }[];
}

/** An ask to the Manager about a bill: void it, or credit a return (invoice_asks, 0123). */
export interface BillAsk {
  id: string;
  orderId: number;
  customerId: string | null;
  /** void · credit (a return): invoice_asks (0123); cancel: cancel_asks (0181), before the invoice. */
  kind: 'void' | 'credit' | 'cancel';
  amount: UGX;
  reason: string;
  status: 'sent' | 'accepted' | 'declined' | 'withdrawn';
  by: string;
  at: Ms;
}

/** An ask to Accounts to correct a payment (payment_asks, 0130), or to settle paid-over money. */
export interface PaymentAsk {
  id: string;
  paymentId: number | null;
  customerId: string | null;
  orderId: number | null;
  what: 'method' | 'amount' | 'bill' | 'day' | 'over' | 'balance';
  amount: UGX;
  status: 'sent' | 'done' | 'declined' | 'withdrawn';
  by: string;
  at: Ms;
}

/**
 * The salesperson's goal (manager_notes kind 'target', body {who, metric: 'sales', aim, from, to}; set by
 * the Manager, goal.set). Measured by the invoices of the orders they took (sales.html:6559 myTarget).
 */
export interface Goal {
  from: Day;
  to: Day;
  target: UGX;
}

/** The shop's settings Sales uses (app_settings.presets; spec 05 §4). */
export interface ShopSettings {
  /** presets.creditPct: the Credit charge, % of the order (FACTS: 3). */
  creditPct: number;
  /** presets.creditHold.days: the hold line (21 when unset; spec 02 Q8). */
  holdDays: number;
  /** presets.chaseAfterDays (7 when unset). */
  chaseAfterDays: number;
  /** presets.services: delivery and loading fees the order can carry. */
  services: { id: string; label: string; type: 'fixed' | 'percent'; value: number }[];
  shopPhone: string;
  shopAddress: string;
}

/** The phone's copy of the books: everything the Sales app reads, as of `at`. */
export interface Books {
  at: Ms;
  shop: { id: string; name: string };
  settings: ShopSettings;
  /** The signed-in person. */
  me: Member;
  /** Everyone in the shop the app names (the team, the Manager, Accounts, Sourcing, the yard). */
  members: Member[];
  customers: Customer[];
  orders: Order[];
  items: Item[];
  payments: Payment[];
  promises: PayPromise[];
  asks: SourcingAsk[];
  billAsks: BillAsk[];
  paymentAsks: PaymentAsk[];
  goal: Goal | null;
}

/** The shop's WhatsApp, read separately (it refreshes faster: spec 06 §2). */
export interface ChatBooks {
  at: Ms;
  /** Whether the shop's number is connected (wa-send 'status'). */
  connected: boolean;
  chats: Chat[];
  /** The newest messages across all chats (enough for who is waiting and what they said). */
  recent: Message[];
}

export interface Thread {
  chatId: number;
  messages: Message[];
  notes: ChatNote[];
  events: ChatEvent[];
}

/** Who is signed in, to which shop. */
export interface Session {
  userId: string;
  shopId: string;
  shopName: string;
  role: Role;
  name: string;
}
