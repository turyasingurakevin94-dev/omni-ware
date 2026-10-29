/*
 * FACTS §6: the items, spelled exactly as FACTS §7 says. The cost each is
 * not in FACTS (it is never drawn); the demo puts it at the shop's price
 * less the shop's default markup of 25% (docs/canvas-cast.md), so a typed
 * price has a floor (0171) and the shop's price has a rule.
 */
import type { Item } from '../../types.ts';
import { t } from './clock.ts';

type Row = [id: string, name: string, unit: string, price: number | null, onShelf: number | null | 'in' | 'out', aisle: string];

const ROWS: Row[] = [
  ['iron-g28-3m', 'Iron sheet G28 · 3m', 'pc', 38000, 412, 'Roofing'],
  ['iron-g26-3m', 'Iron sheet G26 · 3m', 'pc', 46000, 12, 'Roofing'],
  ['iron-g30-3m', 'Iron sheet G30 · 3m', 'pc', 34500, 'in', 'Roofing'],
  ['iron-g28-2m5', 'Iron sheet G28 · 2.5m', 'pc', 33000, 'out', 'Roofing'],
  ['ridge-g28', 'Ridge cap G28', 'pc', 18000, null, 'Roofing'],
  ['ridge-maroon', 'Ridge cap, maroon', 'pc', 20500, null, 'Roofing'],
  ['gutter-bracket', 'Gutter bracket', 'pc', null, null, 'Roofing'],
  ['cement-hima-50', 'Cement · Hima 50kg', 'bag', 33500, 120, 'Cement'],
  ['nails-4-25kg', 'Wire nails 4" · 25kg ctn', 'ctn', 96000, 18, 'Fasteners'],
  ['nails-4-1kg', 'Wire nails 4" · 1kg', 'kg', 9000, 80, 'Fasteners'],
  ['nails-3', 'Wire nails 3"', 'kg', 3850, 96, 'Fasteners'],
  ['roofing-nails-2-5', 'Roofing nails 2.5"', 'kg', 4200, 140, 'Fasteners'],
  ['concrete-nails-2', 'Concrete nails 2"', 'box', 18000, 'in', 'Fasteners'],
  ['wood-screws-1', 'Wood screws 1 inch', 'box', 4500, null, 'Fasteners'],
  ['hinge-soft-flat', 'Soft close hinge · flat', 'pair', null, 'in', 'Doors & locks'],
  ['hinge-zawaina-4', 'Zawaina hinge, normal 4 inch', 'pair', 1700, 200, 'Doors & locks'],
  ['handle-c-128', 'C-type pull handle 128mm', 'pc', 2500, 36, 'Doors & locks'],
  ['door-handle-set', 'Door handle set', 'set', 18000, null, 'Doors & locks'],
  ['wheelbarrow-hd', 'Wheelbarrow, heavy duty', 'pc', 145000, 'in', 'Tools'],
  ['wheelbarrow-tyre-16', 'Wheelbarrow tyre, 16 inch', 'pc', 38000, 6, 'Tools'],
  ['wood-glue-1l', 'Wood glue · 1L', 'tin', 18500, 26, 'Adhesives'],
  ['tile-glue-20', 'Tile glue · 20kg', 'bag', 42000, 30, 'Adhesives'],
  ['tile-grout-2', 'Tile grout · 2kg', 'pc', 9500, 64, 'Adhesives'],
  ['pvc-half-6m', 'PVC pipe ½" · 6m', 'pc', 12500, 64, 'Plumbing'],
  ['roof-paint-maroon-20', 'Roof paint · maroon 20L', 'tin', 185000, 24, 'Paint'],
  ['gloss-white-4', 'Gloss paint · white 4L', 'tin', 42000, 2, 'Paint'],
  ['emulsion-cream-20', 'Emulsion · cream 20L', 'tin', 160000, 'in', 'Paint'],
  ['timber-4x2-12', 'Timber 4x2 · 12ft', 'pc', 18000, null, 'Timber'],
];

export function items(): Item[] {
  return ROWS.map(([id, name, unit, price, shelf, aisle]) => ({
    id, variantIdx: null, name, aisle, unit,
    // Wire nails 4" · 25kg ctn is sold by the carton only, 3,840 a kg; Zawaina by the pair or the carton of 50.
    packUnit: id === 'hinge-zawaina-4' ? 'carton' : id === 'nails-4-25kg' ? 'kg' : '',
    packQty: id === 'hinge-zawaina-4' ? 50 : id === 'nails-4-25kg' ? 25 : 0,
    price,
    packPrice: id === 'hinge-zawaina-4' ? 80000 : null,
    cost: price == null ? null : Math.round(price / 1.25),
    onShelf: typeof shelf === 'number' ? shelf : shelf == null ? null : 0,
    orderIn: shelf === 'in',
    // Moses listed the roof paint today 10:34 (FACTS §6).
    listedAt: id === 'roof-paint-maroon-20' ? t('10:34') : null,
  }));
}

/** FACTS §6 "Aisles: 12 · 1,153 items": the shop's aisles and how many items each holds. */
export const AISLES: { name: string; count: number }[] = [
  { name: 'Roofing', count: 86 }, { name: 'Cement', count: 14 }, { name: 'Fasteners', count: 132 }, { name: 'Plumbing', count: 210 },
  { name: 'Paint', count: 95 }, { name: 'Electrical', count: 178 }, { name: 'Tools', count: 143 }, { name: 'Timber', count: 40 },
  { name: 'Steel', count: 62 }, { name: 'Doors & locks', count: 74 }, { name: 'Sanitary', count: 88 }, { name: 'Adhesives', count: 31 },
];
