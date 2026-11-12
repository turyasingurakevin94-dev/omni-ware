/*
 * Where the Store app's data comes from. Two sources give the same shapes:
 *
 *   supabase  the shop's real books, read and written as store.html does
 *             (src/core/store/supabase/; docs/spec/04-screens-store-data.md)
 *   demo      the sample day of docs/canvas/store-agent/FACTS.md, Sat 17 Oct
 *             2026 10:41, and its later moments (src/core/store/demo/)
 *
 * One method per read of data §1 and per write of data §3 and §6c, named in its
 * comment (R1…, W1…W27). Screens never call a source: the shell's store does
 * (src/apps/store/shell/store.ts `act`), through the one outbox. A source never
 * words an error: it throws a DataError (src/core/datasource.ts) and
 * src/core/store/errors.ts says it.
 *
 * Every order write carries what the phone saw (p_expect, 0162): the source keeps
 * the order as last read and sends its status, pickingStatus, pickingDoneAt and
 * carrier.at; a clash throws kind 'clash' and the next read has the fresh order.
 *
 * Not here, on purpose: W8a (a WhatsApp link, nothing written), W10a (what stayed
 * on the truck: a phone draft), W18b and W21 (Ruth's, in her own app: data §6c,
 * IM-20/21), W28 (no write until Kevin answers screens Q11).
 */
import type { Ms } from '../types.ts';
import type { Carrier, StockCount, StoreSession, YardBooks, YardOrder, YardSide } from './types.ts';

/** W2: one line's answer. */
export interface PickAnswer { idx: number; status: 'done' | 'short'; qty: number }

/** W8: who takes a run. */
export type CarrierPick = Pick<Carrier, 'kind' | 'name' | 'what' | 'phone' | 'staffId'>;

/** W10: the proof at the door. */
export interface DoorProof {
  /** Who took it ("Kato's foreman"). */
  to: string;
  /** The photo (JPEG ≤ 1280 px), or none. */
  photo: Blob | null;
  /** 'door' a photo of the goods at the door · 'note' a signed note · 'none' no photo, with `note` the reason. */
  kind: 'door' | 'note' | 'none';
  note?: string;
}

/** W14: one line of a check-in, in the shelf's unit. */
export interface CheckInLine { trip: string; idx: number; counted: number; why?: string }

/** W15: an item not on the trip's list. */
export interface Extra {
  tripId: string;
  supplierId: string | null;
  key: string | null;
  productId: string | null;
  variantIdx: number | null;
  name: string;
  qty: number;
  unit: string;
  why: string;
  /** Not ours: a new item for Sourcing, with its photo. */
  newItem?: boolean;
  photo?: Blob | null;
}

/** W16: we need more. */
export interface Restock { key: string; productId: string; variantIdx: number | null; name: string; qty: number; unit: string; when: 'out' | 'low'; shortFor: number[] }

/** W17: a loss. */
export interface Loss { key: string; productId: string; variantIdx: number | null; name: string; qty: number; why: 'damaged' | 'lost' | 'stolen'; photo: Blob | null; note: string }

/** W18: a return at the gate (the database prices it, caps it, keeps the line's unit). */
export interface ReturnAsk {
  orderId: number;
  lines: { idx: number; name: string; unit: string; qty: number; shown: string; condition: 'good' | 'damaged' }[];
  reason: string;
  note: string;
  photo: Blob | null;
  /**
   * When the yard looked at it at the gate (IN20's head, IN22's "At the gate 11:02"). The demo keeps it; the real
   * store_return_ask has no field for it (p_lines, p_reason, p_note only), so the books' answer shows the sent time.
   */
  gateAt?: Ms;
}

/** W20: a count (spot or aisle). */
export type CountSend = Pick<StockCount, 'aisle' | 'lines' | 'missing'>;

/** W22: pass the yard. */
export interface PassYard { toStaffId: string; toUserId: string | null; toName: string; orders: number[]; waiting: number; bays: number[] }

/** W23: close the yard. */
export interface CloseYard { out: number; trips: number; carries: string[]; shelved: string[] }

export interface StoreSource {
  readonly kind: 'demo' | 'supabase';
  /** The clock every screen uses (the demo's is fixed at its moment). */
  now(): Ms;
  /** Whether the phone has signal (the demo's &offline says no). */
  online(): boolean;

  /* ---- who (R1, R2; W26) ---- */
  session(): Promise<StoreSession | null>;
  signIn(email: string, password: string): Promise<StoreSession>;
  signOut(): Promise<void>;
  /** W26: the password reset mail (redirect /store.html). */
  resetPassword(email: string): Promise<void>;

  /* ---- reads ---- */
  /** R4 store_snapshot (+ R5 stock when not folded): the whole day. */
  snapshot(): Promise<YardBooks>;
  /** §1d store_live every 45 s: orders, trips, holds, asks, counts, reports, returns, members, me, stock over the last snapshot. */
  live(): Promise<YardBooks>;
  /** §1c store_order: one order as the books hold it now. */
  order(id: number): Promise<YardOrder | null>;
  /** R6 places, place_routes, road_names (no money), at most every 10 minutes. */
  side(): Promise<YardSide>;
  /** §1c the count waiting for a place (one per place, 0161), or null. */
  waitingCount(place: string): Promise<StockCount | null>;
  /** §1c 5421: did a count sent before a dropped signal arrive? (so it never goes twice) */
  countArrived(aisle: string, since: Ms): Promise<boolean>;

  /* ---- Pack (order.pick) ---- */
  /** W1 the first Packed claims the order: this person, in progress, every open line pending. */
  claim(id: number): Promise<void>;
  /** W2 lines packed or short (the pick draft sent), and where the cursor is. */
  pick(id: number, answers: PickAnswer[], cursor: number): Promise<void>;
  /** W3 / W3' the last line: packed onto its bay; a pickup moves to Ready to collect (0182). */
  finishPack(id: number, bay: number | null): Promise<void>;
  /** W4 change the bay. */
  setBay(id: number, bay: number): Promise<void>;
  /** W5 unpack: back to packing, ticks kept, the bay freed (only in the yard, no carrier). */
  unpack(id: number): Promise<void>;
  /** W6 let go of an order you started; `putBack` also clears its ticks. */
  release(id: number, putBack: boolean): Promise<void>;
  /** W7 a cancelled order put back: stamped once on the order by the server (0182 `{putBack:{lines}}`), so every phone sees it and it leaves the yard's lists. */
  putBack(id: number): Promise<void>;

  /* ---- Out (order.load, order.deliver, route.lock) ---- */
  /** W8 load a run: each order On the road with its carrier (the money gate may refuse: OWCSH). */
  load(ids: number[], carrier: CarrierPick): Promise<void>;
  /** W9 hand over at the gate (client, or agent by code): Delivered · collected. */
  handOver(id: number, name: string, agent: boolean): Promise<void>;
  /** W10 deliver at the door, with its proof (the photo uploaded first). */
  deliver(id: number, proof: DoorProof): Promise<void>;
  /** W27 can't deliver · bring it back (0182 comingBack): stays On the road. */
  cantDeliver(id: number, why: string): Promise<void>;
  /** W11 ask Ruth to let it go on credit (a customer with a record only). */
  askLetGo(id: number, carrier: CarrierPick | null): Promise<void>;
  /** W11a take the ask back. */
  withdrawLetGo(id: number): Promise<void>;
  /** W12 name a direction ("→ Ntinda"). */
  nameDirection(key: string, name: string): Promise<void>;
  /** W13 lock a road route (OSRM, then place_routes). */
  lockRoute(from: string, to: string): Promise<void>;

  /* ---- Goods in (trip.checkin, stock.receive, trip.collect) ---- */
  /** W14 check in a trip (each stop not yet received): receive_trip puts it on the shelf, moves orders all in to Packing. */
  checkIn(lines: CheckInLine[]): Promise<void>;
  /** W15 not on the list / a new item: an ask to Ruth (or Moses for a new item). */
  notOnList(x: Extra): Promise<void>;
  /** W18 a return at the gate, to Ruth. */
  returnAsk(r: ReturnAsk): Promise<void>;
  /** W18a take a return back (your own). */
  withdrawReturn(id: string): Promise<void>;
  /** W19 ride a trip: a line onto the truck (null = not answered). */
  rideTick(tripId: string, got: Record<number, number | null>): Promise<void>;
  /** W19a hand in the ride at the yard (every stop). */
  rideHandIn(tripIds: string[]): Promise<void>;

  /* ---- Shelf (stock.count, stock.report, buy.restock asked) ---- */
  /** W16 we need more, to Denis. */
  restock(r: Restock): Promise<void>;
  /** W17 report a loss, to Ruth (the photo uploaded first). */
  reportLoss(r: Loss): Promise<void>;
  /** W20 send a count (a second one for the place → W20a). */
  sendCount(c: CountSend): Promise<void>;
  /** W20a count it again: replaces the waiting one. */
  replaceCount(oldId: string, c: CountSend): Promise<void>;

  /* ---- The shift ---- */
  /** W22 pass the yard to a colleague (held 10 s, Q17). */
  passYard(p: PassYard): Promise<void>;
  /** W22a "I've got it" (the colleague). */
  gotYard(askId: string): Promise<void>;
  /** W23 close the yard: a line in Ruth's log. */
  closeYard(c: CloseYard): Promise<void>;
  /** W24 my name. */
  setMyName(name: string): Promise<void>;
  /** W25 this phone gets the yard's pushes (the real books in the phone app; the demo has none). */
  pushOn?(): Promise<void>;
  /** The yard as this phone last saved it (its `at` the saved time), or null: what "Open the copy" opens when the shop cannot be reached (TD22). */
  savedCopy?(): Promise<YardBooks | null>;
}

/** Every write's name, for the outbox, &fail=<write> and the tests. */
export const WRITES = [
  'claim', 'pick', 'finishPack', 'setBay', 'unpack', 'release', 'putBack',
  'load', 'handOver', 'deliver', 'cantDeliver', 'askLetGo', 'withdrawLetGo', 'nameDirection', 'lockRoute',
  'checkIn', 'notOnList', 'returnAsk', 'withdrawReturn', 'rideTick', 'rideHandIn',
  'restock', 'reportLoss', 'sendCount', 'replaceCount',
  'passYard', 'gotYard', 'closeYard', 'setMyName',
] as const;
export type WriteName = (typeof WRITES)[number];
