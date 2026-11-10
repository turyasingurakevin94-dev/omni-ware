/*
 * The 32 customers FACTS counts but never names (38 in all, FACTS §3), and
 * the last order of each, so their rhythms read as FACTS says:
 *   Gone quiet 8 (every 14 days, last order in August)
 *   Due Mon 19 Oct 1 · Tue 20 Oct 1 · Thu 22 Oct 2 (CU03's week strip, drawn without names)
 *   the rest due after Thu 22 Oct.
 * Three of them carry Grace's other October invoices, 855,500 (#0512-#0514),
 * so Sold · October adds up to 12,480,000.
 * The names are the demo's (not in docs/canvas-cast.md): Kampala places, no cast name, no Kireka.
 */
import { addDays } from '../../time.ts';
import type { Customer, Line, Order } from '../../types.ts';
import { C, L, O, P, PAID } from './build.ts';
import { d } from './clock.ts';
import { GRACE } from './people.ts';
import { initials, tintFor } from '../../names.ts';

const NAMES = [
  'Bukoto Builders', 'Kawempe Hardware', 'Kisaasi Steel Works', 'Najjera Homes', 'Kyanja Contractors', 'Kansanga Tiles', 'Muyenga Glass', 'Bweyogerere Traders',
  'Namugongo Roofing', 'Seeta Builders', 'Gayaza Hardware', 'Matugga Masons', 'Wakiso Timber', 'Entebbe Road Stores', 'Kajjansi Plumbers', 'Lweza Builders',
  'Munyonyo Homes', 'Kabalagala Paints', 'Nsambya Fixings', 'Mengo Hardware', 'Rubaga Contractors', 'Nateete Steel', 'Busega Stores', 'Mutundwe Builders',
  'Kawaala Hardware', 'Kasubi Traders', 'Bwaise Fittings', 'Kalerwe Stores', 'Kyebando Builders', 'Naguru Interiors', 'Kololo Fittings', 'Kitintale Hardware',
];

/** [every, last order day] per customer, in NAMES order. */
function rhythm(i: number): [number, string] {
  if (i < 8) return [14, addDays('2026-08-20', i)];          // gone quiet
  if (i === 8) return [30, '2026-09-19'];                    // due Mon 19 Oct
  if (i === 9) return [30, '2026-09-20'];                    // due Tue 20 Oct
  if (i === 10 || i === 11) return [30, '2026-09-22'];       // due Thu 22 Oct
  if (i >= 12 && i <= 14) return [30, `2026-10-0${i - 11}`]; // the three October invoices
  return [30, addDays('2026-09-23', (i - 15) % 7)];          // due Fri 23 – Thu 29 Oct (invoiced in September)
}

export function backgroundCustomers(): Customer[] {
  return NAMES.map((name, i) => C({
    id: 'C' + String(101 + i).padStart(3, '0'), name, initials: initials(name), tint: tintFor(name),
    phone: `0772 6${String(10 + i).padStart(2, '0')} ${String(100 + i * 7).slice(-3)}`, place: name.split(' ')[0], owes: 0, everyDays: rhythm(i)[0],
  }));
}

/** Each background customer's last order: delivered, invoiced and paid. #0512-#0514 are Grace's October invoices. */
export function backgroundOrders(): Order[] {
  const october: Record<number, [number, Line[]]> = {
    12: [512, [L('iron-g26-3m', 2), L('emulsion-cream-20', 2)]],                         // 412,000
    13: [513, [L('iron-g30-3m', 1), L('tile-glue-20', 2), L('emulsion-cream-20', 1)]],   // 278,500
    14: [514, [L('iron-g30-3m', 2), L('nails-4-25kg', 1)]],                              // 165,000
  };
  return NAMES.map((_n, i) => {
    const day = rhythm(i)[1], placed = d(day, '10:00'), delivered = d(addDays(day, 1), '12:00');
    const [id, lines] = october[i] || [300 + i, [L('cement-hima-50', 4 + (i % 5)), L('wood-glue-1l', 1 + (i % 3))]];
    return O({
      id, customerId: 'C' + String(101 + i).padStart(3, '0'), by: GRACE, placedAt: placed, stage: 'delivered', stageAt: delivered, deliveredAt: delivered,
      invoicedAt: delivered, lines, paid: PAID, payments: [P(1, delivered, 0, 'cash')],
    });
  }).map((o) => ({ ...o, payments: o.payments.map((p) => ({ ...p, amount: o.paid })) }));
}
