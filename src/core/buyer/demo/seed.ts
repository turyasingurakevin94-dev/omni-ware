/*
 * The Buyer's sample shop: Sat 17 Oct 2026, the canvas's shared data
 * (docs/audit/buyer/handover.md, the Buyer canvas's BRIEF). Same people as
 * the Sales demo (src/core/demo/seed/people.ts), Denis signed in.
 *
 *   morning   09:00 · every line to ask (the default)
 *   midday    11:15 · the answers in: Nakawa, Namanve, Owino found, Kiseka not found,
 *             the ridge cap's price up, Ndeeba late · the trip ready to plan
 *   trip      11:45 · the cash given, on the trip, no stop done yet
 *   empty     nothing to buy
 */
import { at } from '../../time.ts';
import type { Member, Ms } from '../../types.ts';
import { BRIAN, DENIS, ESTHER, FAITH, GRACE, MOSES, MUSA, RUTH, people } from '../../demo/seed/people.ts';
import type { BLine, BOrder, BuyerBooks, Confirm, ListPrice, Supplier } from '../types.ts';

export type BuyerDemoState = 'morning' | 'midday' | 'trip' | 'empty';

const DAY = '2026-10-17';
export const tb = (hm: string): Ms => at(DAY, hm);

export const SUP = {
  namanve: 's-namanve', nakawa: 's-nakawa', kiseka: 's-kiseka', owino: 's-owino', katwe: 's-katwe', ndeeba: 's-ndeeba',
} as const;

function team(): Member[] {
  const tint: Record<string, Member['tint']> = { [DENIS]: 'me', [GRACE]: 't0', [BRIAN]: 't3', [FAITH]: 't1' };
  return people().map((m) => ({ ...m, tint: tint[m.id] || m.tint, presence: m.id === DENIS ? 'on' : m.presence }));
}

function suppliers(): Supplier[] {
  const s = (id: string, name: string, place: string, phone: string, whatsapp: boolean, found: number, replyMins: number): Supplier =>
    ({ id, name, place, phone, whatsapp, found, asked: 10, replyMins });
  return [
    s(SUP.namanve, 'Namanve Sheets', 'Namanve', '0772 410 220', true, 9, 12),
    s(SUP.nakawa, 'Nakawa Cement Depot', 'Nakawa', '0772 418 903', false, 8, 20),
    s(SUP.owino, 'Owino Plumbing', 'Owino', '0701 225 640', true, 7, 35),
    s(SUP.kiseka, 'Kiseka Steel', 'Kiseka', '0752 330 118', true, 6, 25),
    s(SUP.katwe, 'Katwe Fabricators', 'Katwe', '0782 554 017', true, 8, 40),
    s(SUP.ndeeba, 'Ndeeba Timber Works', 'Ndeeba', '0703 662 905', true, 5, 60),
  ];
}

function prices(): ListPrice[] {
  const p = (item: string, supplierId: string, price: number, unit: string, hm: string, daysAgo = 0): ListPrice =>
    ({ item, productId: 'p-' + item.toLowerCase().replace(/[^a-z0-9]+/g, '-'), supplierId, price, unit, at: tb(hm) - daysAgo * 86400000 });
  return [
    p('Iron sheet G28', SUP.namanve, 38000, 'sht', '8:00', 1),
    p('Ridge cap 3 m', SUP.namanve, 24000, 'pcs', '8:00', 3),
    p('Cement 50 kg', SUP.nakawa, 34000, 'bag', '8:00', 1),
    p('Y12 rebar 12 m', SUP.kiseka, 42000, 'pcs', '8:00', 2),
    p('Y12 rebar 12 m', SUP.katwe, 41000, 'pcs', '8:00', 34),
    p('Y10 rebar 12 m', SUP.kiseka, 31000, 'pcs', '8:00', 2),
    p('Y16 rebar 12 m', SUP.katwe, 74500, 'pcs', '8:00', 6),
    p('PVC pipe 4 in', SUP.owino, 45000, 'pcs', '8:00', 1),
    p('Timber 2×4', SUP.ndeeba, 9000, 'pcs', '8:00', 4),
  ];
}

function line(idx: number, name: string, qty: number, unit: string, cost: number, sell: number, supplierId: string | null): BLine {
  return {
    idx, lineId: null, name, productId: 'p-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), qty, unit, cost, sell, supplierId,
    priceWas: null, repricedAt: null, ruthDecides: false, clientWaits: null, removed: null, switchedFrom: null, got: null,
  };
}

function orders(): BOrder[] {
  const o = (id: number, client: string, sellerId: string, hm: string, lines: BLine[], status: BOrder['status'] = 'draft'): BOrder =>
    ({ id, client, customerId: 'c-' + id, sellerId, status, placedAt: tb(hm), lines, confirms: {} });
  return [
    o(550, 'Kato Construction', GRACE, '8:20', [
      line(0, 'Iron sheet G28', 40, 'sht', 38000, 47500, SUP.namanve),
      line(1, 'Cement 50 kg', 20, 'bag', 34000, 42500, SUP.nakawa),
    ]),
    o(551, 'Nansana Hardware', BRIAN, '7:40', [line(0, 'Cement 50 kg', 10, 'bag', 34000, 42500, SUP.nakawa)], 'preparing'),
    o(552, 'Mukono Roofing', FAITH, '8:35', [
      line(0, 'Iron sheet G28', 20, 'sht', 38000, 47500, SUP.namanve),
      line(1, 'Ridge cap 3 m', 10, 'pcs', 24000, 26000, SUP.namanve),
    ]),
    o(553, 'Ggaba Stores', GRACE, '8:50', [
      line(0, 'Y12 rebar 12 m', 30, 'pcs', 42000, 52500, SUP.kiseka),
      line(1, 'PVC pipe 4 in', 12, 'pcs', 45000, 56000, SUP.owino),
    ]),
    o(554, 'Lubowa Builders', BRIAN, '9:10', [line(0, 'Timber 2×4', 50, 'pcs', 9000, 11500, SUP.ndeeba)]),
  ];
}

const asked = (hm: string): Confirm => ({ state: 'asked', askedAt: tb(hm), answeredAt: null, how: 'whatsapp' });
const answer = (c: Confirm, state: Confirm['state'], hm: string): Confirm => ({ ...c, state, answeredAt: tb(hm) });

/** The 11:15 answers (the canvas's Replies and Plan). */
function midday(os: BOrder[]): void {
  const by = (id: number) => os.find((o) => o.id === id) as BOrder;
  const o550 = by(550), o552 = by(552), o553 = by(553), o554 = by(554);
  o550.confirms[SUP.namanve] = answer(asked('9:05'), 'found', '9:31');
  o550.confirms[SUP.nakawa] = { ...answer(asked('9:05'), 'found', '9:25'), how: 'call' };
  o552.confirms[SUP.namanve] = answer(asked('9:05'), 'found', '9:31');
  const cap = o552.lines[1];
  cap.priceWas = 24000; cap.cost = 27000; cap.repricedAt = tb('9:31'); cap.ruthDecides = true;
  o553.confirms[SUP.kiseka] = answer(asked('9:20'), 'notfound', '9:35');
  o553.confirms[SUP.owino] = answer(asked('9:20'), 'found', '9:50');
  o554.confirms[SUP.ndeeba] = asked('10:40');
}

export interface Seeded { books: BuyerBooks; now: Ms }

export function seed(state: BuyerDemoState | null): Seeded {
  const st = state || 'morning';
  const os = st === 'empty' ? orders().filter((o) => o.status !== 'draft') : orders();
  const me = team().find((m) => m.id === DENIS) as Member;
  const books: BuyerBooks = { me, team: team(), orders: os, suppliers: suppliers(), prices: prices(), trip: null, savedAt: 0 };
  let now = tb('9:00');
  if (st === 'midday' || st === 'trip') { midday(os); now = tb('11:15'); }
  if (st === 'trip') {
    now = tb('11:45');
    books.trip = {
      id: 'trip-1017', state: 'on', handedInAt: null,
      cash: { amount: 3500000, askedAt: tb('11:30'), givenAt: tb('11:45'), by: ESTHER },
      stops: [
        { supplierId: SUP.nakawa, lines: [{ orderId: 550, idx: 1 }], planned: 680000, paid: null, done: false, off: false },
        { supplierId: SUP.owino, lines: [{ orderId: 553, idx: 1 }], planned: 540000, paid: null, done: false, off: false },
        { supplierId: SUP.namanve, lines: [{ orderId: 550, idx: 0 }, { orderId: 552, idx: 0 }], planned: 2280000, paid: null, done: false, off: false },
      ],
    };
  }
  books.savedAt = now;
  void MOSES; void MUSA; void RUTH;
  return { books, now };
}
