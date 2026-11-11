/*
 * The sample shop the yard sees (docs/canvas/store-agent/FACTS.md §1, §5): its
 * people, its shelf (no prices), its customers and suppliers. The day's orders are
 * in orders.ts, what comes in and the counts in coming.ts.
 *
 * Shelf figures: FACTS gives what the yard reads ("412 on shelf"), which is the books
 * less what has already left for orders not yet invoiced (spec §4.5). `books` here is
 * that figure plus what this sample day's packed, loaded and delivered orders hold, so
 * the shelf rule gives FACTS' figure back (tested in test/store-core.test.js).
 */
import { at } from '../../time.ts';
import type { Ms, Role, Tint } from '../../types.ts';
import { stockKey } from '../keys.ts';
import type { ShelfItem, YardBooks, YardPerson } from '../types.ts';

export const DAY = '2026-10-17';
/** A time on the sample day, or another: t('10:41'), t('15:40', '2026-10-16'). */
export const t = (hm: string, day: string = DAY): Ms => at(day, hm);
export const NOW = t('10:41');

const person = (id: string, userId: string | null, name: string, initials: string, tint: Tint, role: Role, phone = ''): YardPerson =>
  ({ id, userId, name, initials, tint, role, away: false, phone });

/** FACTS §1 (and Joy, whom TD05 and TD24 draw). Staff ids st-*, logins u-*. Musa holds the phone. */
export function people(): YardPerson[] {
  return [
    person('st-mk', 'u-mk', 'Musa Kiggundu', 'MK', 'me', 'store', '0772 300 101'),
    person('st-op', 'u-op', 'Okello Peter', 'OP', 't0', 'store', '0772 300 102'),
    // Joy (TD05, TD24): a yard login, off today.
    { ...person('st-jn', 'u-jn', 'Joy Namata', 'JN', 't1', 'store'), away: true },
    person('st-ss', null, 'Ssali', 'SS', 't4', 'driver', '0772 300 103'),
    person('st-hs', null, 'Hassan', 'HS', 't4', 'driver', '0772 300 104'),
    person('st-ga', 'u-ga', 'Grace Akello', 'GA', 'me', 'sales'),
    person('st-bo', 'u-bo', 'Brian Ouma', 'BO', 't3', 'sales'),
    person('st-fn', 'u-fn', 'Faith', 'FN', 't1', 'sales'),
    person('st-rn', 'u-rn', 'Ruth Nakato', 'RN', 't2', 'manager', '0772 300 110'),
    person('st-ea', 'u-ea', 'Esther Auma', 'EA', 't5', 'accounts'),
    person('st-do', 'u-do', 'Denis Okello', 'DO', 't3', 'buyer'),
    person('st-ml', 'u-ml', 'Moses Lubega', 'ML', 't4', 'sourcing'),
    person('st-jm', 'u-jm', 'Joseph Mukasa', 'JM', 't4', 'owner'),
  ];
}

/** The aisles in letter order, A–L (FACTS §5). */
export const AISLES = ['Roofing', 'Cement', 'Fasteners', 'Doors & locks', 'Adhesives', 'Paint', 'Tools', 'Plumbing', 'Electrical', 'Timber', 'Steel', 'Sanitary'];

/** [id, name, category, unit, packUnit, packQty, books]. books = FACTS' shelf + what this day's orders hold. */
const ITEMS: [string, string, string, string, string, number, number][] = [
  ['p-is28', 'Iron sheet G28 · 3m', 'Roofing', 'pc', 'bundle', 20, 472],   // 412 + #0552's 40 packed + #0534's 20 on the truck
  ['p-is26', 'Iron sheet G26 · 3m', 'Roofing', 'pc', '', 1, 12],
  ['p-rc28', 'Ridge cap G28', 'Roofing', 'pc', '', 1, 46],                 // 34 + #0530's 10 + #0555's 2
  ['p-is30', 'Iron sheet G30 · 3m', 'Roofing', 'pc', 'bundle', 20, 0],
  ['p-gb', 'Gutter bracket', 'Roofing', 'pc', '', 1, 0],
  ['p-cem', 'Cement · Hima 50kg', 'Cement', 'bag', '', 1, 130],            // 120 + #0534's 10 on the truck
  ['p-wn4', 'Wire nails 4" · 25kg ctn', 'Fasteners', 'ctn', '', 1, 20],     // 18 + #0530's and #0534's 1 each (#0543 is invoiced)
  ['p-wn3', 'Wire nails 3"', 'Fasteners', 'kg', '', 1, 96],
  ['p-rn', 'Roofing nails 2.5"', 'Fasteners', 'kg', '', 1, 145],           // 140 + #0547's 5
  ['p-cn2', 'Concrete nails 2"', 'Fasteners', 'box', '', 1, 0],
  ['p-zh', 'Zawaina hinge, normal 4 inch', 'Doors & locks', 'pair', 'carton', 50, 200],
  ['p-sch', 'Soft close hinge · flat', 'Doors & locks', 'pair', '', 1, 0],
  ['p-wg', 'Wood glue · 1L', 'Adhesives', 'tin', '', 1, 26],
  ['p-tg', 'Tile glue · 20kg', 'Adhesives', 'bag', '', 1, 32],             // 30 + #0547's 2
  ['p-rp', 'Roof paint · maroon 20L', 'Paint', 'tin', '', 1, 24],
  ['p-gp', 'Gloss paint · white 4L', 'Paint', 'tin', '', 1, 2],
  ['p-em', 'Emulsion · cream 20L', 'Paint', 'tin', '', 1, 0],
  ['p-wt', 'Wheelbarrow tyre, 16 inch', 'Tools', 'pc', '', 1, 6],
  ['p-wb', 'Wheelbarrow, heavy duty', 'Tools', 'pc', '', 1, 0],
  ['p-pvc', 'PVC pipe ½" · 6m', 'Plumbing', 'pc', '', 1, 64],
  ['p-tim', 'Timber 4x2 · 12ft', 'Timber', 'pc', '', 1, 0],
  // Not on Denis's list: one came off the truck by mistake (IN04, IN13).
  ['p-bw', 'Binding wire 20kg', 'Steel', 'roll', '', 1, 8],
];

/** Aisle A Roofing was counted Thu (Okello, accepted 16:10); aisle C Fasteners 30 days ago (due); the rest in between. */
function countedAt(cat: string): Ms {
  if (cat === 'Roofing') return t('16:10', '2026-10-15');
  if (cat === 'Fasteners') return t('16:00', '2026-09-17');
  return t('16:00', '2026-10-09');
}

export function items(): ShelfItem[] {
  return ITEMS.map(([id, name, category, unit, packUnit, packQty, books]) => ({
    key: stockKey(id, null), productId: id, variantIdx: null, name, category, unit, packUnit, packQty, books, countedAt: countedAt(category), image: null,
  }));
}

/** An item's line facts, for orders and trips. */
export function item(id: string): { name: string; unit: string; packUnit: string; packQty: number } {
  const r = ITEMS.find((x) => x[0] === id);
  if (!r) throw new Error('No sample item ' + id);
  return { name: r[1], unit: r[3], packUnit: r[4], packQty: r[5] };
}

export function customers(): YardBooks['customers'] {
  return [
    { id: 'c-kato', name: 'Kato Construction', phone: '0772 418 220', location: 'Ntinda', tint: 't0' },
    { id: 'c-kyal', name: 'Kyaligonza & Sons', phone: '0701 552 310', location: 'Bweyogerere', tint: 't1' },
    { id: 'c-nans', name: 'Nansana Hardware', phone: '0752 610 044', location: '', tint: 't5' },
    { id: 'c-ggaba', name: 'Ggaba Stores', phone: '0782 330 917', location: 'Ggaba', tint: 't4' },
    { id: 'c-lub', name: 'Lubowa Builders', phone: '0774 120 556', location: 'Lubowa', tint: 't2' },
  ];
}

export function suppliers(): YardBooks['suppliers'] {
  return [
    { id: 's-owino', name: 'Owino Hardware', location: 'Owino' },
    { id: 's-kiseka', name: 'Kiseka Steel', location: 'Nakivubo' },
    { id: 's-hima', name: 'Hima Cement', location: 'Hima' },
    { id: 's-katwe', name: 'Katwe Timber', location: 'Katwe' },
  ];
}

export function agents(): YardBooks['agents'] {
  return [{ id: 'a-ps', name: 'Peter Sserwadda', terms: 'on_delivery', tint: 't1' }];
}
