/*
 * Where the Sales app's data comes from. Two sources give the same shapes:
 *
 *   supabase  the shop's real books, read and written exactly as sales.html
 *             does today (src/core/supabase/; never a new backend path
 *             unless a migration exists)
 *   demo      the sample shop of docs/canvas/sales-agent/FACTS.md, in
 *             memory, at Sat 17 Oct 2026 10:41 (src/core/demo/)
 *
 * The app talks only to this interface, so every screen runs on the demo
 * exactly as it will on the books.
 */
import type {
  BillAsk, Books, Charge, ChatBooks, ChatNote, Customer, CustomerKind, Day, Line, Message, Method, Ms, Order,
  PayPromise, Payment, PaymentAsk, Session, SourcingAsk, Thread, UGX,
} from './types.ts';

/** Why a read or write did not land. The app words it; the source only classifies it. */
export type DataErrorKind =
  | 'offline'     // no signal: nothing reached the server (06: "No signal", "Kept on this phone")
  | 'refused'     // the server said no; `message` is its reason, `code` its code (OWCST, OWOVR, 42501 …)
  | 'missing'     // the books do not have this yet (a migration not run, or no backend path at all)
  | 'signed-out'  // the login is gone or is someone else's
  | 'clash';      // someone else changed it first (06 Q6)

export interface DataError extends Error {
  kind: DataErrorKind;
  code: string;
}

export function dataError(kind: DataErrorKind, message: string, code: string = ''): DataError {
  const e = new Error(message) as DataError;
  e.kind = kind;
  e.code = code;
  return e;
}

/**
 * This phone's pushes (spec 06 §6a). `why` says why they are off when the person cannot simply turn them on:
 * not-app (a browser: pushes come in the installed app), old-app (an install with no Firebase), denied (off in
 * the phone's settings), no-play (no Google Play services: no token).
 */
export interface PushState {
  on: boolean;
  why: 'not-app' | 'old-app' | 'denied' | 'no-play' | null;
}

export function isDataError(e: unknown): e is DataError {
  return !!e && typeof e === 'object' && 'kind' in e && e instanceof Error;
}

/** An order as the salesperson builds it, before it has a number. */
export interface OrderDraft {
  customerId: string | null;
  client: { name: string; phone: string };
  lines: Line[];
  charges: Charge[];
  /** On credit: the shop's pct (ShopSettings.creditPct) and days. */
  credit: { pct: number; days: number } | null;
  /** Where it goes; null = they collect it. */
  deliverTo: string | null;
  /** The chat it came from, if any. */
  chatId: number | null;
  /** The draft's own key: placed again with the same key, it is placed once (place_order, 0180). */
  key?: string;
}

export interface CounterPay {
  method: Method;
  /** Cash handed over (for change); 0 for Mobile and Bank. */
  given: UGX;
  /** The transaction ID for Mobile or Bank. */
  ref: string;
  /**
   * A counter sale placed already, that waited for the Manager's yes on a price: sold now as the books
   * hold it (counter_sale p_quote_id; sales.html:11098 slide:counterpay). The draft is not read then.
   */
  quote?: number | null;
}

export interface CounterResult {
  order: Order;
  /** "INV-0558". */
  invoice: string;
  paid: UGX;
  change: UGX;
  /** The sale waits for the Manager's yes on a price (counter_sale answers waiting: 'price'). */
  waiting: 'price' | null;
}

export interface PayArgs {
  /** A customer's bills (oldest first, or `picks`) … */
  customerId: string | null;
  /** … or one order before its invoice. */
  orderId: number | null;
  amount: UGX;
  method: Method;
  ref: string;
  /** Bills ticked, in order; null = oldest first. */
  picks: number[] | null;
  /** More than owed: change (handed back) or a deposit (kept). spec 02 §6. */
  over: 'change' | 'deposit' | null;
}

export interface PayResult {
  payments: Payment[];
  /** What went in the books. */
  amount: UGX;
  /** What they owed before, and after. */
  before: UGX;
  after: UGX;
  deposit: UGX;
  change: UGX;
}

export interface DataSource {
  readonly kind: 'demo' | 'supabase';
  /** The clock every screen uses (the demo's is fixed). */
  now(): Ms;
  /** Whether the phone has signal (the demo's `&offline=1` says no). */
  online(): boolean;

  /* who */
  session(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;

  /* reads */
  books(): Promise<Books>;
  chats(): Promise<ChatBooks>;
  thread(chatId: number): Promise<Thread>;
  /** One order as the books hold it now, null when it is gone: read again while a customer waits on it (a counter price). */
  order(id: number): Promise<Order | null>;

  /* orders */
  placeOrder(d: OrderDraft): Promise<Order>;
  counterSale(d: OrderDraft, pay: CounterPay): Promise<CounterResult>;
  /**
   * New lines on your own counter sale that waits (not yet sold): back to the shop's price, or lines
   * added after the Manager's yes (ow_patch_order, as sales.html:11136 countershop). A line the Manager
   * answered keeps her answer while its price stays hers.
   */
  counterLines(orderId: number, lines: Line[]): Promise<void>;
  /** The customer was told the Manager's new price (items[].priceToldAt). */
  markPriceTold(orderId: number): Promise<void>;
  setClientPhone(orderId: number, phone: string): Promise<void>;
  /**
   * A walk-in's order goes on a customer's account: they owe what is left of it (CU34, "who owes it?";
   * sales.html:9290 payOrderFor, the order's customerId and client by ow_patch_order).
   */
  assignOrder(orderId: number, customerId: string): Promise<void>;
  /** Ask the Manager to void a bill or credit a return (invoice_asks). */
  askBill(a: { orderId: number; kind: 'void' | 'credit'; amount: UGX; reason: string; note: string; lines?: { idx: number; qty: number }[] }): Promise<BillAsk>;
  /** Take back any ask of yours that still waits: a void, a credit or a cancel. */
  withdrawBillAsk(id: string): Promise<void>;
  /**
   * Ask the Manager to cancel your own order before its invoice (ask_cancel, cancel_asks, 0181).
   * Asked again while it waits, the same ask comes back. The Manager's yes is the one Cancel (0177).
   */
  askCancel(orderId: number, why: string, note?: string): Promise<BillAsk>;

  /* money */
  receivePayment(a: PayArgs): Promise<PayResult>;
  recordPromise(a: { customerId: string; on: Day; amount: UGX | null }): Promise<PayPromise>;
  /** Ask Accounts to correct a payment (payment_asks). */
  askPaymentFix(a: { paymentId: number; what: 'method' | 'amount' | 'bill' | 'day' | 'over'; want: Record<string, unknown>; note: string }): Promise<PaymentAsk>;
  withdrawPaymentAsk(id: string): Promise<void>;

  /* customers */
  addCustomer(a: { name: string; phone: string; place: string; kind: CustomerKind | null }): Promise<Customer>;

  /* sourcing */
  askSourcing(a: { name: string; qty: number; customerId: string | null; chatId: number | null; photo?: Blob | null }): Promise<SourcingAsk>;
  /** A search that found nothing, for Sourcing (log_search_miss). Fire and forget. */
  logSearchMiss(words: string, client: string | null): void;

  /* this phone */
  /** Whether this phone gets the person's pushes (its token in push_subscriptions). */
  pushState(): Promise<PushState>;
  /** Sign this phone up: the phone is asked, its token saved to push_subscriptions. */
  pushOn(): Promise<PushState>;
  /** Take this phone off: its push_subscriptions row deleted, the phone unregistered. */
  pushOff(): Promise<PushState>;

  /* chats */
  send(chatId: number, text: string): Promise<Message>;
  /** After the 24-hour window: the shop's approved reply template, their words inside it. */
  sendTemplate(chatId: number, text: string): Promise<Message>;
  /**
   * A picture, with words under it (wa-send 'send-image': the shop's image bucket, then its link).
   * A string is a link already in the bucket (an item's photo): sent as it is, not uploaded again.
   */
  sendImage(chatId: number, file: Blob | string, caption: string): Promise<Message>;
  /** The shop's WhatsApp catalogue as a card they can browse (wa-send 'send-catalog'). */
  sendCatalog(chatId: number): Promise<Message>;
  /** The photo at an order's door (Order.deliveredPhoto, 0111 delivery-photos): a short-lived link to open it. */
  deliveryPhoto(path: string): Promise<string>;
  /** A customer's picture, voice note or document: its link (wa-send 'media'). */
  media(messageId: string): Promise<{ link: string; mime: string }>;
  /** A team note, never sent to the customer; each member in `mentions` gets a push (wa_notes.mentions). */
  note(chatId: number, body: string, mentions?: string[]): Promise<ChatNote>;
  /** Take a new number as your customer (take_conversation, chat.take). */
  take(chatId: number): Promise<void>;
  /** Give your own customer's chat to a teammate, with a note (hand_conversation). */
  give(chatId: number, to: string, note: string): Promise<void>;
  markRead(chatId: number): Promise<void>;
  /** "Grace is in this chat / typing" (touch_presence). Fire and forget. */
  touch(chatId: number | null, typing: boolean): void;
  /** Who served this customer this year (chat_served). */
  served(chatId: number): Promise<{ by: string; name: string; messages: number }[]>;
}
