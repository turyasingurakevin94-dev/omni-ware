/*
 * The sell tab's own additions to the demo, owned by the sell builder (no other tab edits it).
 * Each keeps FACTS.md true and says which board needs it. Totals FACTS states never move.
 *
 *   the shop's 1,153 items in 12 aisles (FACTS §6), so the aisles count as drawn (SL03, SL11)
 *     and an aisle has its kinds (SL12: Nails 9 · Screws 24 · Bolts 18; 18 new; a carton beside the kg)
 *   Kato's orders hold what "Often with Iron sheet G28" counts by core/often.ts (SL05) and the
 *     aisles he buys from (SL03: 3), each at the total it had (FACTS §3.2's year by seller)
 *   Lubowa's 5 orders (SL04: Often with Iron sheet G28 2/2 · 2/2)
 *   what Grace sells most, the last 30 days (SL31: Cement, Iron sheet G28, Wire nails 4" · 1kg),
 *     and the five aisles she sells from most (SL03, SL30, SL31): only the 29 background orders
 *     whose figures FACTS never gives are re-lined, each paid in full again
 *   the shop's cutting charge, Ntinda's travel time (SL16, SL17); the sentence the demo hears (SL10)
 *   (Sell's endings, #0560 and #0561, are placed at &clock=15:05, after the Orders tab's #0559)
 */
import { orderTotal } from '../../../money.ts';
import { at } from '../../../time.ts';
import type { Item, Line } from '../../../types.ts';
import type { DemoFlags } from '../../flags.ts';
import { L, O, P, charge, pay } from '../build.ts';
import { d, TODAY } from '../clock.ts';
import type { DemoState } from '../index.ts';
import { AISLES } from '../items.ts';
import { LUBOWA } from '../orders-live.ts';
import { GRACE } from '../people.ts';

/* ---------------- the catalogue ---------------- */

/** Kinds and sizes per aisle; never a word another board searches (sheet, tile, paint, hinge, pipe, wheel, glue …). */
const KINDS: Record<string, [string[], string[]]> = {
  Roofing: [['Flashing', 'Fascia board', 'Barge trim', 'Eaves trim', 'Valley strip', 'Skylight panel', 'Purlin', 'Batten', 'Drip edge', 'Apron strip'], ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m']],
  Cement: [['Lime', 'Plaster mix', 'Sand bag', 'Aggregate', 'Mortar mix', 'Render mix', 'Screed'], ['10kg', '25kg']],
  Plumbing: [['Elbow', 'Tee', 'Socket', 'Union', 'Reducer', 'Gate valve', 'Ball valve', 'Float valve', 'Waste trap', 'Tank connector', 'Nipple', 'End cap', 'Hose clamp', 'Bib tap', 'Pillar tap'], ['½"', '¾"', '1"', '1¼"', '1½"', '2"', '3"', '4"', '15mm', '20mm', '25mm', '32mm', '40mm', '50mm']],
  Paint: [['Varnish', 'Wall putty', 'Primer', 'Thinner', 'Wood stain', 'Brush', 'Roller', 'Masking strip', 'Sandpaper', 'Filler', 'Sealer', 'Lacquer'], ['clear 1L', 'clear 4L', 'white 1L', 'white 4L', 'brown 1L', 'grey 4L', '2 inch', '3 inch']],
  Electrical: [['Socket outlet', 'Switch', 'Cable', 'Conduit', 'Breaker', 'Lamp holder', 'Bulb', 'Junction box', 'Fuse', 'Plug top', 'Extension lead', 'Earth rod', 'Tube light', 'Ceiling rose', 'Cable clip strip'], ['1 gang', '2 gang', '1.5mm', '2.5mm', '4mm', '6mm', '10A', '13A', '16A', '20A', '32A', '9W', '12W']],
  Tools: [['Hammer', 'Spanner', 'Chisel', 'Trowel', 'Spade', 'Hoe', 'Saw', 'Level', 'Tape measure', 'Pliers', 'Screwdriver', 'Mallet', 'Crowbar', 'File', 'Drill bit', 'Pick axe', 'Rake', 'Float'], ['small', 'medium', 'large', '8 inch', '10 inch', '12 inch', 'heavy', 'light']],
  Timber: [['Plank', 'Plywood', 'Blockboard', 'Hardboard', 'Batten 2x2', 'Rafter 3x2', 'Moulding'], ['8ft', '10ft', '14ft', '6mm', '9mm', '12mm']],
  Steel: [['Rebar', 'Angle bar', 'Flat bar', 'Square tube', 'Round tube', 'Mesh roll', 'Binding coil', 'Channel'], ['8mm', '10mm', '12mm', '16mm', '25mm', '40mm', '50mm', '6m']],
  'Doors & locks': [['Padlock', 'Door lock', 'Bolt latch', 'Door stopper', 'Door closer', 'Key blank', 'Hasp', 'Mortice lock', 'Cylinder', 'Lever set'], ['30mm', '40mm', '50mm', '60mm', 'brass', 'chrome', 'black']],
  Sanitary: [['Basin', 'Toilet seat', 'Cistern', 'Shower head', 'Sink', 'Mirror', 'Towel rail', 'Soap dish', 'Floor drain', 'Bidet spray', 'Urinal'], ['white', 'ivory', 'steel', 'small', 'large', 'single', 'double', 'round', 'square']],
  Adhesives: [['Sealant', 'Silicone', 'Contact adhesive', 'Epoxy', 'Putty'], ['clear', 'white', 'brown', 'grey', '300ml', '1L']],
};

/** Fasteners: the kinds SL12 draws (Nails 9 · Screws 24 · Bolts 18), then the rest, each fewer than Bolts. */
const FASTENERS: [string, string[], string[]][] = [
  ['Nails', ['Wire nails 2"', 'Wire nails 6"', 'Panel nails 1"', 'Masonry nails 3"', 'Clout nails 1.5"'], []],
  ['Screws', ['Wood screws', 'Drywall screws', 'Self-tap screws', 'Coach screws'], ['1.5 inch', '2 inch', '2.5 inch', '3 inch', '4 inch', '5 inch']],
  ['Bolts', ['Hex bolts', 'Carriage bolts', 'Anchor bolts'], ['M6', 'M8', 'M10', 'M12', 'M16', 'M20']],
  ['Washers', ['Flat washers', 'Spring washers'], ['M6', 'M8', 'M10', 'M12', 'M16', 'M20', 'M24', 'M30']],
  ['Anchors', ['Wall anchors', 'Sleeve anchors'], ['6mm', '8mm', '10mm', '12mm', '14mm', '16mm', '20mm']],
  ['Rivets', ['Pop rivets', 'Solid rivets'], ['3mm', '4mm', '5mm', '6mm', '8mm', '10mm']],
  ['Hooks', ['Cup hooks', 'Wall hooks'], ['small', 'medium', 'large', '1 inch', '2 inch']],
  ['Staples', ['Fence staples'], ['20mm', '25mm', '30mm', '40mm', '50mm', '60mm', '75mm', '90mm', '100mm']],
  ['Clips', ['Spring clips'], ['10mm', '12mm', '16mm', '20mm', '25mm', '32mm', '40mm', '50mm']],
  ['Chains', ['Link chains'], ['3mm', '4mm', '5mm', '6mm', '8mm', '10mm', '12mm', '16mm']],
];
const FASTENER_COUNT = [5, 23, 18, 16, 14, 12, 10, 9, 8, 8];

/**
 * A generated item, priced and named as a catalogue would, never with a word a board searches
 * (sheet, tile, paint, cement, hinge, pipe, nails …). One exception waits on the lead (see extra()):
 * the Paint aisle's fillers carry no price, because core/items.ts findItems matches an aisle's name and
 * KC02 draws "paint" finding the shop's three paints only.
 */
function made(id: string, name: string, aisle: string, n: number, unit = 'pc', priced = true): Item {
  const p = 1000 * (3 + ((n * 7) % 40)), price = priced ? p : null, out = n % 9 === 4, orderIn = n % 5 === 2;
  return {
    id, variantIdx: null, name, aisle, unit, packUnit: '', packQty: 0, price, packPrice: null, cost: price == null ? null : Math.round(price / 1.25),
    onShelf: orderIn || out ? 0 : 6 + ((n * 13) % 90), orderIn, listedAt: null,
  };
}

function catalogue(s: DemoState): void {
  const b = s.books, by = (id: string) => b.items.find((i) => i.id === id) as Item;
  const sib = (from: string, id: string, name: string, unit: string, price: number, extra: Partial<Item>): Item =>
    ({ ...by(from), id, name, unit, price, cost: Math.round(price / 1.25), packPrice: null, listedAt: null, ...extra });
  // The other sizes of sale the shelf cards switch between (SL12: kg | ctn, pc | box).
  const added: Item[] = [
    sib('roofing-nails-2-5', 'roofing-nails-2-5-ctn', 'Roofing nails 2.5" · 25kg ctn', 'ctn', 100000, { packUnit: 'kg', packQty: 25, onShelf: 6 }),
    sib('nails-3', 'nails-3-ctn', 'Wire nails 3" · 25kg ctn', 'ctn', 92000, { packUnit: 'kg', packQty: 25, onShelf: 4 }),
    sib('concrete-nails-2', 'concrete-nails-2-pc', 'Concrete nails 2" · pc', 'pc', 400, { onShelf: 0, orderIn: true }),
  ];
  let n = 0;
  FASTENERS.forEach(([, bases, sizes], k) => {
    const names = sizes.length ? bases.flatMap((x) => sizes.map((z) => `${x} ${z}`)) : bases;
    names.slice(0, FASTENER_COUNT[k]).forEach((nm) => added.push(made(`g-${++n}`, nm, 'Fasteners', n, /nails/.test(nm) ? 'kg' : 'pc')));
  });
  AISLES.forEach((a) => {
    if (a.name === 'Fasteners') return;
    const have = b.items.filter((i) => i.aisle === a.name).length, [bases, sizes] = KINDS[a.name];
    const names = bases.flatMap((x) => sizes.map((z) => `${x} ${z}`));
    for (let i = 0; have + i < a.count; i++) added.push(made(`g-${++n}`, names[i % names.length] + (i >= names.length ? ` · ${Math.floor(i / names.length) + 1}` : ''), a.name, n, 'pc', a.name !== 'Paint'));
  });
  // 17 listed in the last 30 days, with the roof paint: "New 18" (SL11).
  added.filter((i) => i.aisle === 'Electrical' || i.aisle === 'Sanitary').slice(0, 17).forEach((i, k) => { i.listedAt = at(TODAY, '9:00') - (k + 1) * 864e5; });
  // The shop's aisles in its own order, as FACTS §6 lists them.
  const order = AISLES.map((a) => a.name);
  b.items = [...b.items, ...added].map((it, i) => ({ it, i })).sort((x, y) => order.indexOf(x.it.aisle) - order.indexOf(y.it.aisle) || x.i - y.i).map((x) => x.it);
}

/* ---------------- lines FACTS does not show ---------------- */

/** New lines for an order whose lines FACTS never draws; its total is checked when FACTS gives it. */
function reline(s: DemoState, id: number, lines: Line[], total?: number): void {
  const o = s.books.orders.find((x) => x.id === id);
  if (!o) return;
  const was = orderTotal(o), paidAll = o.paid >= was && was > 0;
  o.lines = lines.map((l, i) => ({ ...l, lineId: i + 1 }));
  const now = orderTotal(o);
  if (total != null && now !== total) throw new Error(`sell extra: #${id} comes to ${now}, FACTS says ${total}`);
  if (paidAll) { o.paid = now; if (o.payments.length === 1) o.payments[0].amount = now; }
}

const shelfL = (id: string, q: number) => L(id, q, { from: 'shelf', supplierId: '__stock__' });

function lines(s: DemoState, f: DemoFlags): void {
  // Kato (SL05 Often with Iron sheet G28 has ridge caps and roofing nails): two orders whose lines FACTS
  // never draws, each at its own total (FACTS §3.2's year by seller: Brian 2,180,000 · 3). #0498 is the
  // Orders tab's (FACTS §4.5); #0490 stays the usual.
  reline(s, 545, [L('iron-g28-3m', 20), L('nails-4-25kg', 4), L('ridge-g28', 3), L('roofing-nails-2-5', 10)], 1240000);
  reline(s, 437, [L('iron-g28-3m', 10), L('ridge-g28', 10)], 560000);
  // Lubowa (SL04): the bills keep their 380,000, 180,000 and 169,000.
  reline(s, 540, [L('iron-g28-3m', 7), L('ridge-g28', 4), L('roofing-nails-2-5', 10)], 380000);
  reline(s, 539, [L('ridge-g28', 10)], 180000);
  reline(s, 542, [L('ridge-g28', 5), L('roofing-nails-2-5', 10), L('wood-glue-1l', 2)], 169000);
  const b = s.books, placed = d('2026-09-25', '10:00'), came = d('2026-09-26', '12:00');
  if (f.state !== 'first-day' && !b.orders.some((o) => o.id === 508)) {
    const o = O({ id: 508, customerId: LUBOWA, by: GRACE, placedAt: placed, stage: 'delivered', stageAt: came, deliveredAt: came, invoicedAt: came,
      lines: [L('iron-g28-3m', 20), L('ridge-g28', 5), L('roofing-nails-2-5', 10)], payments: [P(1, came, 892000, 'cash')] });
    b.orders.push(o);
    const c = b.customers.find((x) => x.id === LUBOWA);
    if (c) c.debtLog.push(charge('2026-09-26', 892000, 508), pay('2026-09-26', 892000, 508));
  }
  // The background customers' last orders (figures FACTS never gives): what Grace sells most, the last
  // 30 days, is cement, then the G28 sheets, then the 1kg wire nails; her five aisles are Roofing,
  // Cement, Fasteners, Plumbing and Tools.
  b.orders.filter((o) => o.id >= 300 && o.id < 332).forEach((o) => {
    const i = o.id - 300;
    const two = i < 2 ? [shelfL('pvc-half-6m', 2), shelfL('nails-3', 5)]
      : i < 8 ? [shelfL('pvc-half-6m', 2), shelfL('wheelbarrow-tyre-16', 1)]
        : i < 20 ? [shelfL('iron-g28-3m', 4 + (i % 5))]
          : [shelfL('nails-4-1kg', 5 + (i % 4)), i % 2 ? shelfL('pvc-half-6m', 1) : shelfL('wheelbarrow-tyre-16', 1)];
    reline(s, o.id, [shelfL('cement-hima-50', 4 + (i % 5)), ...two]);
  });
}

export function extra(s: DemoState, f: DemoFlags): void {
  catalogue(s);
  lines(s, f);
  const b = s.books;
  // SL18: the iron sheet's cost (never shown; not in FACTS) puts 36,500 at the ladder's 66% (ui/Keypad ladderPct);
  // SL20's 24,000 is under it, so the floor refuses it (0171).
  const sheet = b.items.find((i) => i.id === 'iron-g28-3m');
  if (sheet) sheet.cost = 24500;
  // SL16, SL17: the shop's charges as presets.services would carry them (core/services.ts reads the
  // preset's own fields): loading 500 a bag (FACTS §6: 20 bags is 10,000; per: 'bag', spec 04 Q3); the
  // demo's own cutting fee, 10,000 flat (a seed value, named in the demo README); Ntinda's delivery
  // (kind: 'delivery', its area) about 35 minutes (FACTS §4.2: leaves 13:20, there ~13:55).
  const sv = b.settings.services, loading = sv.find((x) => x.id === 'loading');
  if (loading) loading.per = 'bag';
  if (!sv.some((x) => x.id === 'cutting')) sv.push({ id: 'cutting', label: 'Cutting', type: 'fixed', value: 10000 });
  const ntinda = sv.find((x) => x.id === 'delivery-ntinda');
  if (ntinda) Object.assign(ntinda, { kind: 'delivery' as const, area: 'Ntinda', mins: 35 });
  // SL10: what the demo hears when Grace says it (the demo has no microphone).
  (globalThis as { owDemoVoice?: string }).owDemoVoice = 'forty sheets of G28 and two cartons of four inch nails';
}
