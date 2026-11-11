/*
 * The yard as the Store app sees it (docs/spec/04-screens-store-data.md).
 * Plain types only (spec 07): Node runs this file as it is.
 *
 * NO MONEY. Not a price, a total, an amount owed or paid: the database strips
 * every money key before a Store phone sees an order (ow_store_payload, 0164,
 * 0182), and these types have no field to hold one. "Not paid yet" is a label
 * (YardOrder.moneyHold), never a figure (FACTS head; GLOSSARY "Money on a phone").
 *
 * These are the app's words. src/core/store/supabase/rows.ts is the one place a
 * snapshot row becomes one of them; the demo (src/core/store/demo) builds them
 * straight from FACTS.md. Where a field comes from is written beside it.
 */
import type { Ms, Role, Tint } from '../types.ts';

/** saved_quotes.status (data §2). */
export type YardStatus = 'draft' | 'awaiting_goods' | 'preparing' | 'pending_delivery' | 'completed' | 'cancelled';

/** items[].pickStatus: the line's answer (W1 sets 'pending', W2 'done' or 'short'). */
export type PickStatus = 'pending' | 'done' | 'short';

/** One line of an order, as ow_store_payload passes it (data §2 items[]). */
export interface YardLine {
  /** Its place in items[]: every write names a line by it (p_items idx). */
  idx: number;
  lineId: string | null;
  /** The stock key: productId, or productId::variantIdx (shelf.ts stockKey). */
  key: string;
  productId: string;
  variantIdx: number | null;
  name: string;
  qty: number;
  /** The line's own unit, lower case ("pc", "bag", "ctn"). */
  unit: string;
  packQty: number;
  packUnit: string;
  qtyIn: 'unit' | 'pack';
  /** '__stock__' for our shelf; a supplier id for a line bought in. */
  supplierId: string | null;
  /** The client waits while Sourcing finds it: nothing to pick (pack.ts notPicked). */
  clientWaits: boolean;
  pickStatus: PickStatus | null;
  pickedQty: number | null;
  /** A bought-in line arrived (receive_trip writes both). */
  receivedAt: Ms | null;
  receivedQty: number | null;
  /**
   * Taken off the order before the yard ("not found → dropped", FACTS #0552's hinge). The demo draws it;
   * the books keep it as items[].removed, which 0182's allow-list does NOT pass yet: on the real books
   * this is always false (README "Gaps").
   */
  dropped: boolean;
}

/** payload.carrier: who takes it (W8, W9). */
export interface Carrier {
  kind: 'staff' | 'hired' | 'client' | 'agent';
  name: string;
  /** A hired driver's vehicle, or what the collector came with. */
  what: string;
  phone: string;
  at: Ms | null;
  /** The login that loaded it. */
  by: string | null;
  staffId: string | null;
  /** When he is expected back at the yard ("out · back ~12:10"): the demo's; the books have none (absent). */
  dueBack?: Ms | null;
}

/** payload.comingBack (0182, W27): can't deliver · bring it back. */
export interface ComingBack { why: string; at: Ms; by: string | null; byName: string }

/** A credit note the Manager raised (payload.takenBack, the books' creditNotes; 0182 adds restocked). */
export interface TakenBack { askId: string | null; voided: boolean; restocked: boolean; lines: { idx: number; qty: number; restocked: boolean | null }[] }

/** An order in the yard: its stage, its lines and who holds it. No money (head of file). */
export interface YardOrder {
  id: number;
  status: YardStatus;
  invoiced: boolean;
  invoicedAt: Ms | null;
  voided: boolean;
  /** saved_quotes.date, 'YYYY-MM-DD' (a backdated order is left off To pack). */
  date: string;
  /** The collector's name and phone prefilled ("Walk-in" when none). */
  client: { name: string; phone: string };
  customerId: string | null;
  lines: YardLine[];
  /** The packer (a staff id), and the claim (W1). */
  assignedWorkerId: string | null;
  pickingAssignedAt: Ms | null;
  workerAcceptedAt: Ms | null;
  pickingStatus: 'in_progress' | 'done' | null;
  pickCursor: number;
  pickingDoneAt: Ms | null;
  bay: number | null;
  carrier: Carrier | null;
  /** A staff id, '__carrier__', '__agent__' or '__client__'. */
  assignedDeliveryId: string | null;
  stageEnteredAt: Ms | null;
  stageLog: { status: YardStatus; at: Ms }[];
  /** The proof (W9, W10). */
  deliveredTo: string | null;
  deliveredAt: Ms | null;
  deliveredPhoto: string | null;
  deliveredPhotoKind: 'note' | 'none' | null;
  deliveredNote: string | null;
  handoverCheckedAt: Ms | null;
  /** The Store's ask to let it go on credit (W11; the books' creditAsk), and the Manager's answer. */
  letGoAsk: { at: Ms; by: string | null; byName: string; answer: { decision: string; at: Ms | null } | null } | null;
  letGo: { decision: string; at: Ms | null } | null;
  agentSettled: boolean;
  deliveryMode: string | null;
  deliveryAddress: string | null;
  originAgentId: string | null;
  cancelledAt: Ms | null;
  cancelledByName: string | null;
  voidedAt: Ms | null;
  pickSettle: { pick: string; at: Ms | null; lines: { idx: number; picked: number; ordered: number }[] } | null;
  pickShortfallAckAt: Ms | null;
  takenBack: TakenBack[];
  runDriver: string | null;
  takenBy: string | null;
  createdAt: Ms | null;
  savedAt: Ms | null;
  /** Where · when · phone, the order's own (Sales writes them; 0182 passes them). Null on an old order: yard.ts destinationOf falls back. */
  deliverTo: string | null;
  deliverWhen: string | null;
  deliverPhone: string | null;
  /** A counter sale: never a yard collection (0182, IM-31). */
  counter: boolean;
  comingBack: ComingBack | null;
  /** store_money_holds lists it: "Not paid yet", a label only. */
  moneyHold: boolean;
  /**
   * The order this one is a copy of (#0557 → 556): Look only. No app marks a copy yet (data §6d
   * order.copy "not in 0182"): the demo draws it, the real books give null.
   */
  copyOf: number | null;
  /** When the run leaves ("leaves 13:20"), and who took the money and when ("Paid · Grace 13:12"): the demo's; the books have none (absent). */
  leavesAt?: Ms | null;
  paidAt?: Ms | null;
  paidBy?: string | null;
}

/** A collection_trips line (ow_strip_money(t.lines)). */
export interface TripLine {
  idx: number;
  orderId: number | null;
  key: string;
  productId: string | null;
  variantIdx: number | null;
  name: string;
  qty: number;
  unit: string;
  packQty: number;
  packUnit: string;
  /** null = not answered; 0 is an answer (ride.ts tripLineGot). */
  gotQty: number | null;
  /** The Buyer could not find it ("Gutter bracket · not found"). */
  notFound: boolean;
  /** The yard's own count once checked in (receive_trip's p_lines shop): the demo's; the books do not pass it yet (null). */
  yardQty?: number | null;
}

/** collection_trips: a Buyer's stop, a supplier's delivery, or a ride. */
export interface Trip {
  id: string;
  supplierId: string | null;
  supplierName: string;
  status: 'open' | 'assigned' | 'collecting' | 'collected' | 'confirmed' | string;
  /** assigned_worker_id: the runner's staff id, '__supplier__' for a supplier's delivery. */
  runnerId: string | null;
  createdAt: Ms | null;
  assignedAt: Ms | null;
  acceptedAt: Ms | null;
  collectedAt: Ms | null;
  confirmedAt: Ms | null;
  note: string;
  lines: TripLine[];
  voided: boolean;
  yardCheckedAt: Ms | null;
  yardCheckedBy: string | null;
  yardReceivedAt: Ms | null;
  differenceAcceptedAt: Ms | null;
  /** When it is expected at the yard ("back ~11:30", "today 12:00"): the demo's; the books have none (null). */
  dueAt: Ms | null;
}

/** invoice_asks the yard raised: a return at the gate (W18). */
export interface StoreReturn {
  id: string;
  orderId: number;
  lines: { idx: number; name: string; unit: string; qty: number; shown: string; condition: 'good' | 'damaged' }[];
  reason: string;
  note: string;
  by: string | null;
  byName: string;
  status: 'sent' | 'accepted' | 'declined' | 'withdrawn' | string;
  decidedAt: Ms | null;
  createdAt: Ms;
  /** When it reaches the gate ("~11:00 with Ssali", TD01, TD11): the demo's; the books have none (undefined). */
  dueAt?: Ms | null;
}

/** stock_counts (W20). */
export interface StockCount {
  id: string;
  /** "Spot count · Wire nails 4\"" or "Aisle C · Fasteners". */
  aisle: string;
  /** counts.ts place: 'aisle:<category>' or 'item:<key>'. */
  place: string | null;
  countedBy: string | null;
  countedByName: string;
  lines: { key: string; productId: string; variantIdx: number | null; name: string; counted: number; system: number; held: number }[];
  missing: { key: string; productId: string; variantIdx: number | null; name: string }[];
  status: 'sent' | 'accepted' | 'recount' | 'replaced' | string;
  decidedAt: Ms | null;
  createdAt: Ms;
}

/** stock_reports (W17): a loss, damaged · lost · stolen. */
export interface StockReport {
  id: string;
  key: string;
  productId: string;
  variantIdx: number | null;
  name: string;
  qty: number;
  why: 'damaged' | 'lost' | 'stolen';
  /** The word for Ruth ("bent"): stock_reports.note. Optional: older rows have none. */
  note?: string;
  photo: string | null;
  by: string | null;
  byName: string;
  status: 'sent' | 'written_off' | 'dismissed' | string;
  decidedAt: Ms | null;
  createdAt: Ms;
}

/** store_asks: an extra, a restock, a handover, a close (W15, W16, W22, W23). */
export interface StoreAsk {
  id: string;
  kind: 'extra' | 'restock' | 'handover' | 'close' | string;
  ref: string;
  payload: Record<string, unknown>;
  by: string | null;
  byName: string;
  status: 'sent' | 'accepted' | 'declined' | string;
  createdAt: Ms;
  decidedAt: Ms | null;
  decidedBy: string | null;
}

/** A product on the shelf, no price (snapshot products + units + stock). */
export interface ShelfItem {
  key: string;
  productId: string;
  variantIdx: number | null;
  name: string;
  /** The category: the aisle's name ("Roofing"); null = "No aisle yet". */
  category: string | null;
  unit: string;
  packUnit: string;
  packQty: number;
  /** stock.qty: the books' figure. The shelf figure is shelf.ts onShelf, never this one on screen. */
  books: number;
  /** When it was last counted (snapshot counted + accepted counts). */
  countedAt: Ms | null;
  image: string | null;
  /** A loose level counted in another unit ("Loose, open carton · kg", 25 kg a carton): units.pieces_per_unit. Optional: the books give none yet. */
  loose?: { unit: string; per: number } | null;
  /** When Sourcing listed it ("new today", SH42): optional, the books give none yet. */
  listedAt?: Ms | null;
}

/** A person of the shop the yard names (staff ∪ members, never an email handle). */
export interface YardPerson {
  /** The staff row's id, or 'user:<auth id>' for a login with no staff row. */
  id: string;
  userId: string | null;
  name: string;
  initials: string;
  tint: Tint;
  role: Role;
  /** staff.unavailable: away today. */
  away: boolean;
  phone: string;
}

/** A push this phone got today (Alerts, TD10). Read on the phone, never from the books. */
export interface YardAlert {
  id: string;
  kind: string;
  at: Ms;
  fromId: string | null;
  text: string;
  /** For this person (the bell counts these, WORD-10), or for the yard at large (TD10 "In the yard today"). */
  forYou: boolean;
  /** The push's data, for its route (shell/pushes.ts). */
  data: Record<string, unknown>;
}

/**
 * Damage seen in the yard and not reported yet (TD01 "Bent · Iron sheet G28 · found 10:20 · 3"): a
 * phone draft (found while packing). The demo's; the books have none until it is reported (README "Gaps").
 */
export interface YardFound { key: string; name: string; qty: number; unit: string; why: 'damaged' | 'lost' | 'stolen'; word: string; at: Ms; by: string | null }

/** Who the phone holder is, and the shop. */
export interface StoreSession {
  userId: string;
  shopId: string;
  shopName: string;
  role: Role;
  name: string;
  /** The holder's staff row (snapshot me.staff_id): null = no staff row (data D12: sees no drops). */
  staffId: string | null;
}

/** The yard's day: everything a Store screen reads (store_snapshot, store_live). */
export interface YardBooks {
  shopName: string;
  /** When this copy was read (the head's "saved 7:52"). */
  at: Ms;
  me: YardPerson;
  /** Since when the holder is on (TD01 "on since 7:30"): the demo's; the books have none (null). */
  onSince: Ms | null;
  people: YardPerson[];
  orders: YardOrder[];
  trips: Trip[];
  returns: StoreReturn[];
  counts: StockCount[];
  reports: StockReport[];
  asks: StoreAsk[];
  items: ShelfItem[];
  /** stock_log, four weeks: the item's "what moved". */
  log: { key: string; type: string; delta: number; at: Ms; note: string }[];
  /** The aisles in their letter order (A Roofing … L Sanitary). */
  aisles: string[];
  /** presets.bays: 1–12, default 4. */
  bays: number;
  /** tint: the customer's face, as the canvas casts it (the demo's; absent on the books: tintFor the name). */
  customers: { id: string; name: string; phone: string; location: string; tint?: Tint }[];
  suppliers: { id: string; name: string; location: string }[];
  agents: { id: string; name: string; terms: 'before' | 'on_delivery'; tint?: Tint }[];
  alerts: YardAlert[];
  /** Damage seen and not reported yet (YardFound): the demo's; the books give none (undefined). */
  found?: YardFound[];
}

/** Read after the first paint, at most every 10 minutes (data §1a #6). */
export interface YardSide {
  places: { name: string; lat: number; lng: number }[];
  routes: { from: string; to: string; km: number; mins: number; line: unknown }[];
  roadNames: Record<string, string>;
}
