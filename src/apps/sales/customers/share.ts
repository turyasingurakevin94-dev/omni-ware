/*
 * "Share the shop's price list" (the Customers head): the items with a
 * price, by aisle, through the phone's own share sheet; where there is
 * none, copied for pasting. Resolves with the words for a toast, or null.
 */
import { money } from '../../../core/money.ts';
import type { Books } from '../../../core/types.ts';

export function priceListText(b: Books): string {
  const aisles = new Map<string, string[]>();
  b.items.filter((i) => i.price != null).forEach((i) => {
    const l = aisles.get(i.aisle) || [];
    l.push(`${i.name} · ${money(i.price)} a ${i.unit}`);
    aisles.set(i.aisle, l);
  });
  const parts = [...aisles].map(([a, l]) => `${a}\n${l.join('\n')}`);
  return [`${b.shop.name} · prices`, ...parts, b.settings.shopPhone].join('\n\n');
}

export async function shareList(b: Books): Promise<string | null> {
  const text = priceListText(b);
  try {
    if (navigator.share) { await navigator.share({ title: `${b.shop.name} prices`, text }); return null; }
    await navigator.clipboard.writeText(text);
    return 'Price list copied';
  } catch (_e) {
    return null;
  }
}
