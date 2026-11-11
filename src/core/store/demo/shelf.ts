/*
 * The shelf of the sample day, as the Shelf boards draw it (docs/canvas/store-agent/
 * boards SH*, FACTS §5, §6): 1,153 items in 12 aisles, when each aisle was counted,
 * the units the yard counts in, four weeks of what moved, and the shelf's what-ifs.
 * moments.ts calls shelfAt() last, over the day it built; nothing else here changes
 * an order or a trip.
 *
 *   aisle sizes      A 86 · B 14 · C 132 · D 74 · E 31 · F 95 · G 143 · H 210 · I 178 · J 40 · K 62 · L 88 (SH01)
 *   days counted     A 2 · B 6 · C 30 · D 9 · E 4 · F 12 · G 8 · H 11 · I 5 · J 13 · K 7 · L 10 (SH01's bars)
 *   &at=921          before Musa's spot count of Wire nails 4" was sent (SH10–SH12, SH17–SH19)
 *   &state=recount · count-accepted · okello-counts · written-off · kept-on-shelf · restock-listed · shelf-calm
 *
 * The rest of each aisle is filled with plain items (no orders, no history), so the
 * aisle counts and "Show 30 more" are real; their names never contain a word the
 * boards search for ("nails", "emulsion").
 */
import type { Ms } from '../../types.ts';
import { stockKey } from '../keys.ts';
import type { ShelfItem, StockCount, YardBooks } from '../types.ts';
import type { StoreDemoFlags } from './flags.ts';
import { AISLES, DAY, t } from './shop.ts';

/** How many items each aisle holds (SH01, SH05, SH42). */
export const AISLE_SIZE: Record<string, number> = {
  Roofing: 86, Cement: 14, Fasteners: 132, 'Doors & locks': 74, Adhesives: 31, Paint: 95, Tools: 143, Plumbing: 210, Electrical: 178, Timber: 40, Steel: 62, Sanitary: 88,
};
/** Days since each aisle was last counted, at 10:41 (SH01's bars; C is over). */
export const AISLE_DAYS: Record<string, number> = {
  Roofing: 2, Cement: 6, Fasteners: 30, 'Doors & locks': 9, Adhesives: 4, Paint: 12, Tools: 8, Plumbing: 11, Electrical: 5, Timber: 13, Steel: 7, Sanitary: 10,
};
const COUNTED_AT: Record<string, string> = { Roofing: '16:10', Paint: '15:30' };

const dayBack = (n: number): string => new Date(Date.parse(DAY + 'T12:00:00Z') - n * 864e5).toISOString().slice(0, 10);

/** The words a filler item is made of, per aisle: never "nails", never "emulsion". */
const FILL: Record<string, [string[], string[]]> = {
  Roofing: [['Valley sheet', 'Gutter', 'Barge board', 'Roof vent', 'Downpipe', 'Fascia board', 'Ridge tile', 'Roofing felt'], ['2m', '3m', '4m', 'G30', 'G32', 'plain', 'grey', 'brown', 'white', 'black', 'red']],
  Cement: [['Lime', 'Sand bag', 'Tile grout', 'Plaster'], ['20kg', '25kg', 'white', 'grey']],
  Fasteners: [['Wood screws', 'Bolts', 'Washers', 'Hex nuts', 'Rivets', 'Staples', 'Hooks', 'Anchors', 'Coach screws', 'Threaded rod'], ['½ inch', '¾ inch', '1½ inch', '2 inch', '3 inch', 'M6', 'M8', 'M10', 'M12', 'M16', 'small', 'large', 'zinc']],
  'Doors & locks': [['Padlock', 'Door lock', 'Tower bolt', 'Door handle', 'Barrel bolt', 'Hasp', 'Door stop'], ['30mm', '40mm', '50mm', '60mm', 'brass', 'chrome', 'steel', 'heavy', 'light', 'black', 'gold']],
  Adhesives: [['Contact glue', 'Silicone', 'Epoxy', 'Super glue', 'Sealant'], ['clear', 'white', '250ml', '500ml', 'tube', 'tin', 'grey']],
  Paint: [['Gloss paint', 'Wood primer', 'Varnish', 'Thinner', 'Undercoat', 'Road paint', 'Metal paint'], ['1L', '4L', '20L', 'blue', 'green', 'grey', 'black', 'red', 'cream', 'yellow', 'brown', 'clear', 'white 1L', 'white 20L']],
  Tools: [['Hammer', 'Spade', 'Trowel', 'Hand saw', 'Pliers', 'Spanner', 'Tape measure', 'Chisel', 'Hoe', 'Panga', 'Level', 'Screwdriver'], ['small', 'medium', 'large', '8 inch', '10 inch', '12 inch', '5m', '8m', 'flat', 'cross', 'steel', 'wood']],
  Plumbing: [['PVC pipe', 'PVC elbow', 'PVC tee', 'Gate valve', 'Tap', 'Pipe clip', 'Socket', 'Reducer', 'Union', 'Ball valve', 'Tank connector', 'Float valve', 'Pipe glue', 'Waste trap'], ['½"', '¾"', '1"', '1¼"', '1½"', '2"', '3"', '4"', 'brass', 'chrome', 'plastic', 'grey', 'white', 'long', 'short']],
  Electrical: [['Cable', 'Switch', 'Socket', 'Bulb', 'Breaker', 'Conduit', 'Junction box', 'Lamp holder', 'Extension', 'Tube light', 'Plug', 'Fuse'], ['1.5mm', '2.5mm', '4mm', '6mm', '10A', '13A', '16A', '20A', '32A', 'single', 'double', 'LED', 'white', 'black', '5m']],
  Timber: [['Timber 2x2', 'Timber 3x2', 'Plywood', 'Hardboard', 'Blockboard'], ['8ft', '10ft', '12ft', '14ft', '4mm', '6mm', '9mm', '12mm']],
  Steel: [['Flat bar', 'Angle bar', 'Square tube', 'Round bar', 'BRC mesh', 'Binding wire'], ['20mm', '25mm', '32mm', '40mm', '50mm', 'Y8', 'Y10', 'Y12', 'Y16', 'A142']],
  Sanitary: [['Toilet seat', 'Basin', 'Shower head', 'Cistern', 'Pan connector', 'Sink', 'Mirror', 'Towel rail'], ['white', 'cream', 'chrome', 'small', 'large', 'round', 'square', 'steel', 'plastic', 'deluxe', 'basic']],
};

/** The named items some boards draw that FACTS does not list (SH14: aisle C). */
const NAMED: [string, string, string, string, number][] = [
  ['p-cln', 'Clout tacks', 'Fasteners', 'kg', 60],
  ['p-ws1', 'Wood screws 1 inch', 'Fasteners', 'box', 14],
];

/** The unit the yard counts in (FLOW-01): cartons and loose kilos, bundles and pieces. */
const UNITS: Record<string, Partial<ShelfItem>> = {
  'p-is26': { packUnit: 'bundle', packQty: 20 },
  'p-wn3': { packUnit: 'ctn', packQty: 25 },
  'p-rn': { packUnit: 'ctn', packQty: 25 },
  'p-cln': { packUnit: 'ctn', packQty: 25 },
  'p-wn4': { loose: { unit: 'kg', per: 25 } },
};

function plain(cat: string, n: number): ShelfItem[] {
  const [bases, sizes] = FILL[cat];
  const out: ShelfItem[] = [];
  for (let i = 0; out.length < n; i++) {
    const name = `${bases[i % bases.length]} · ${sizes[Math.floor(i / bases.length) % sizes.length]}${i >= bases.length * sizes.length ? ` ${Math.floor(i / (bases.length * sizes.length)) + 1}` : ''}`;
    const id = `p-${cat.slice(0, 3).toLowerCase()}-${i}`;
    out.push({ key: stockKey(id, null), productId: id, variantIdx: null, name, category: cat, unit: 'pc', packUnit: '', packQty: 1, books: cat === 'Roofing' ? 0 : 1 + ((i * 7) % 11), countedAt: null, image: null });
  }
  return out;
}

const row = (key: string, type: string, delta: number, at: Ms, note: string) => ({ key, type, delta, at, note });

/** Four weeks of what moved, as stock_log keeps it (WORD-09: "Order #0552 · Kato"). */
function log(): YardBooks['log'] {
  return [
    row('p-is28', 'out', -40, t('10:30'), 'Order #0552 · Kato'),
    row('p-is28', 'in', 200, t('11:20', '2026-10-13'), 'Delivery · Namanve Sheets'),
    row('p-is28', 'in', 100, t('15:00', '2026-10-07'), 'Check-in · Denis’s trip'),
    row('p-wn4', 'out', -1, t('8:20'), 'Order #0543 · Walk-in'),
    row('p-wn4', 'packed', -1, t('15:30', '2026-10-15'), 'Order #0530 · Kyaligonza · bay 2'),
    row('p-wn4', 'in', 10, t('15:00', '2026-10-07'), 'Check-in · Denis’s trip'),
    row('p-gp', 'out', -1, t('9:12'), 'Counter sale'),
    row('p-gp', 'out', -6, t('16:40', '2026-09-30'), 'Order #0501 · Nansana'),
    row('p-gp', 'out', -6, t('11:05', '2026-09-24'), 'Order #0488 · Kato'),
  ];
}

const count = (id: string, key: string, name: string, by: [string, string], counted: number, system: number, held: number, status: string, at: Ms, decided: Ms | null): StockCount => ({
  id, aisle: `Spot count · ${name}`, place: 'item:' + key, countedBy: by[0], countedByName: by[1],
  lines: [{ key, productId: key, variantIdx: null, name, counted, system, held }], missing: [], status, decidedAt: decided, createdAt: at,
});

/** The shelf of the day at the flags' moment (moments.ts calls this last). */
export function shelfAt(b: YardBooks, f: StoreDemoFlags, now: Ms): void {
  // The units the yard counts in, and the two named aisle-C items.
  b.items.forEach((it) => Object.assign(it, UNITS[it.key] || {}));
  NAMED.forEach(([id, name, cat, unit, books]) => b.items.push({ key: id, productId: id, variantIdx: null, name, category: cat, unit, packUnit: '', packQty: 1, books, countedAt: null, image: null, ...UNITS[id] }));
  // Aisle C in the order it stands on the shelf (SH14): Wire nails 3", Roofing nails, Clout nails, Wood screws, Wire nails 4".
  const order = ['p-wn3', 'p-rn', 'p-cln', 'p-ws1', 'p-wn4', 'p-cn2'];
  const fast = order.map((k) => b.items.find((x) => x.key === k)).filter((x): x is ShelfItem => !!x);
  b.items = [...b.items.filter((x) => !order.includes(x.key)), ...fast];
  // Every aisle filled to its size; each item counted when its aisle was.
  AISLES.forEach((cat) => {
    const have = b.items.filter((x) => x.category === cat).length;
    if (have < AISLE_SIZE[cat]) b.items.push(...plain(cat, AISLE_SIZE[cat] - have));
  });
  b.items.forEach((it) => { if (it.category && AISLE_DAYS[it.category] != null) it.countedAt = t(COUNTED_AT[it.category] || '16:00', dayBack(AISLE_DAYS[it.category])); });
  const rp = b.items.find((x) => x.key === 'p-rp');
  if (rp) rp.listedAt = t('10:34');
  b.log = log();
  // Aisle F was counted Mon 5 Oct, Ruth accepted (SH32's "Counted · aisle F").
  b.counts.push({ ...count('cnt-f', 'p-gp', 'Gloss paint · white 4L', ['u-op', 'Okello Peter'], 9, 9, 0, 'accepted', t('15:00', '2026-10-05'), t('15:30', '2026-10-05')), aisle: 'Aisle F · Paint', place: 'aisle:paint' });
  const wn4 = b.items.find((x) => x.key === 'p-wn4') as ShelfItem;
  const mine: [string, string] = ['u-mk', 'Musa Kiggundu'];

  // Before Musa's spot count was sent (9:21): no count with Ruth yet.
  if (f.at < 1041) {
    b.counts = b.counts.filter((c) => c.id !== 'cnt-wn4');
    b.alerts = b.alerts.filter((a) => a.kind !== 'stock.count.sent');
  }
  const wn4Count = () => b.counts.find((c) => c.id === 'cnt-wn4') as StockCount;
  switch (f.state) {
    case 'recount': wn4Count().status = 'recount'; wn4Count().decidedAt = now; break;
    case 'count-accepted':
      wn4Count().status = 'accepted'; wn4Count().decidedAt = now; wn4.books -= 1; wn4.countedAt = now;
      break;
    case 'okello-counts': break; // Okello's count lands as Musa sends his (demo/index.ts asks shelfClash).
    case 'written-off': case 'kept-on-shelf': {
      const off = f.state === 'written-off';
      b.reports.unshift({ id: 'rep-bent', key: 'p-is28', productId: 'p-is28', variantIdx: null, name: 'Iron sheet G28 · 3m', qty: 3, why: 'damaged', note: 'bent', photo: 'demo/report.jpg',
        by: 'u-mk', byName: mine[1], status: off ? 'written_off' : 'dismissed', decidedAt: now, createdAt: t('10:41') });
      if (off) (b.items.find((x) => x.key === 'p-is28') as ShelfItem).books -= 3;
      break;
    }
    case 'restock-listed':
      b.asks.unshift({ id: 'ask-gp', kind: 'restock', ref: 'p-gp', by: 'u-mk', byName: mine[1], status: 'accepted', createdAt: t('10:41'), decidedAt: now, decidedBy: 'u-do',
        payload: { key: 'p-gp', productId: 'p-gp', variantIdx: null, name: 'Gloss paint · white 4L', qty: 10, unit: 'tin', when: 'low', shortFor: [], answer: 'On the restock list · next trip' } });
      break;
    case 'shelf-calm': {
      // Everything looked at: aisle C counted this morning, the count accepted, the bent sheets reported and decided, Gloss paint restocked.
      b.items.filter((x) => x.category === 'Fasteners').forEach((x) => { x.countedAt = t('9:30'); });
      wn4Count().status = 'accepted'; wn4Count().decidedAt = t('10:10');
      const gp = b.items.find((x) => x.key === 'p-gp');
      if (gp) gp.books = 14;
      b.reports.unshift({ id: 'rep-bent', key: 'p-is28', productId: 'p-is28', variantIdx: null, name: 'Iron sheet G28 · 3m', qty: 3, why: 'damaged', note: 'bent', photo: null,
        by: 'u-mk', byName: mine[1], status: 'written_off', decidedAt: t('10:35'), createdAt: t('10:25') });
      break;
    }
    default: break;
  }
}

/**
 * &state=okello-counts: Okello's count of Wire nails 4" reaches Ruth just before Musa's (SH25). The first count Musa
 * sends for that item meets it: Okello's waits with Ruth, Musa's 9:21 one is replaced, and the write is refused as
 * someone else's. Returns true when it did so (index.ts then throws the clash).
 */
export function shelfClash(b: YardBooks, f: StoreDemoFlags, name: string, args: unknown[], now: Ms, done: { v: boolean }): boolean {
  if (f.state !== 'okello-counts' || done.v || (name !== 'sendCount' && name !== 'replaceCount')) return false;
  const c = (name === 'sendCount' ? args[0] : args[1]) as { lines?: { key: string }[] } | undefined;
  if (!c || !c.lines || !c.lines.some((l) => l.key === 'p-wn4')) return false;
  done.v = true;
  b.counts.filter((x) => x.place === 'item:p-wn4' && x.status === 'sent').forEach((x) => { x.status = 'replaced'; });
  b.counts.unshift(count('cnt-op', 'p-wn4', 'Wire nails 4" · 25kg ctn', ['u-op', 'Okello Peter'], 18, 18, 2, 'sent', now, null));
  return true;
}
