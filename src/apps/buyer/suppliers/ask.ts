/*
 * Ask again (the Suppliers row's one act): WhatsApp opens with the message
 * written, and the ask is recorded through the outbox. Sales sees "Asked"
 * with the new time; offline it is kept on this phone and sent later.
 */
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { toast } from '../../../ui/toast.tsx';
import { act, isDemo, now } from '../shell/store.ts';
import { first, hm, member } from './parts.tsx';
import { askText, intlPhone, supplierRows } from './rules.ts';

export function openWhatsApp(phone: string, text?: string): void {
  if (isDemo || typeof window === 'undefined') return;
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  window.open(`https://wa.me/${intlPhone(phone)}${q}`, '_blank', 'noopener');
}

export async function askAgain(b: BuyerBooks, sid: string): Promise<void> {
  const s = b.suppliers.find((x) => x.id === sid);
  if (!s) return;
  const row = supplierRows(b, now.value).find((r) => r.s.id === sid);
  const seller = first(member(b, row ? row.sellerId : null), 'Sales');
  openWhatsApp(s.phone, askText(b, sid));
  try {
    const r = await act('ask', sid, 'whatsapp');
    if (r.kept) toast.show('No signal · saved on this phone', { kind: 'warn', sub: `${s.name} · sends later` });
    else toast.show(`Asked ${s.name}`, { sub: `${seller} sees: Asked · ${hm(now.value)}` });
  } catch (e) {
    toast.show('Not sent', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void askAgain(b, sid); } });
  }
}
