/*
 * The shop's own charges (app_settings.presets.services, read by supabase/rows.ts settingsOf), said
 * once, from the preset's own fields only, never from words in its name (the lead's ruling, 3 Nov):
 *
 *   delivery    a service whose `kind` is 'delivery'; the one whose `area` is the customer's first
 *   amount      percent: of the goods (money.ts chargeAmount, sales.html:8358); fixed: its value;
 *               fixed with `per` ("bag"): its value for each one on the lines sold by that unit (Q3)
 *
 * A preset with neither `kind` nor `per` (sales.html sets neither yet) is a flat fee, as sales.html
 * charges it. Whether presets get `kind` and `per` is with Kevin.
 */
import { chargeAmount, goodsTotal } from './money.ts';
import type { Line, ShopSettings, UGX } from './types.ts';

export type Service = ShopSettings['services'][number];

export const isDelivery = (s: Service): boolean => s.kind === 'delivery';

/** The delivery fee for an area: the delivery service set for that area, else the shop's one. */
export function deliveryFor(services: Service[], area: string): Service | null {
  const all = services.filter(isDelivery), a = area.trim().toLowerCase();
  return (a && all.find((s) => (s.area || '').toLowerCase() === a)) || all[0] || null;
}

/** The lines a per-unit service is counted on: those sold by that unit. */
export function perLines(s: Service, lines: Line[]): Line[] {
  if (!s.per) return [];
  const u = s.per.toLowerCase();
  return lines.filter((l) => l.qty > 0 && l.state !== 'dropped' && l.unit.toLowerCase() === u);
}

/** What the service comes to on these lines. */
export function serviceAmount(s: Service, lines: Line[]): UGX {
  if (s.per) return perLines(s, lines).reduce((n, l) => n + l.qty, 0) * Math.max(0, s.value);
  return chargeAmount({ id: 0, label: s.label, type: s.type, value: s.value }, goodsTotal(lines));
}
