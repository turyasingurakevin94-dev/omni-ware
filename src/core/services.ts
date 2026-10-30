/*
 * The shop's own charges (app_settings.presets.services, read by supabase/rows.ts settingsOf), said
 * once: which one is the delivery fee, and what one comes to on an order.
 *
 *   delivery    a service whose name says deliver or transport (sales.html:8351 nwChargeKind);
 *               the one naming the customer's area first, else the first such
 *   amount      percent: of the goods (money.ts chargeAmount, sales.html:8358); fixed: its value;
 *               fixed with `per` ("bag"): its value for each one of those on the order
 *               (spec 04 Q3, the default: loading is charged per bag)
 */
import { chargeAmount, goodsTotal } from './money.ts';
import type { Line, ShopSettings, UGX } from './types.ts';

export type Service = ShopSettings['services'][number];

export const isDelivery = (s: Service): boolean => /deliver|transport/i.test(s.label);

/** The delivery fee for an area: the service naming the area, else the shop's one delivery fee. */
export function deliveryFor(services: Service[], area: string): Service | null {
  const all = services.filter(isDelivery), a = area.trim().toLowerCase();
  return (a && all.find((s) => s.label.toLowerCase().includes(a))) || all[0] || null;
}

/** The lines a per-unit service is counted on: sold by that unit, or named for it ("Iron sheet" for "sheet"). */
export function perLines(s: Service, lines: Line[]): Line[] {
  if (!s.per) return [];
  const w = s.per.toLowerCase(), named = new RegExp(`\\b${w.replace(/[^a-z]/g, '')}`, 'i');
  return lines.filter((l) => l.qty > 0 && l.state !== 'dropped' && (l.unit.toLowerCase() === w || named.test(l.name)));
}

/** What the service comes to on these lines. */
export function serviceAmount(s: Service, lines: Line[]): UGX {
  if (s.per) return perLines(s, lines).reduce((n, l) => n + l.qty, 0) * Math.max(0, s.value);
  return chargeAmount({ id: 0, label: s.label, type: s.type, value: s.value }, goodsTotal(lines));
}
