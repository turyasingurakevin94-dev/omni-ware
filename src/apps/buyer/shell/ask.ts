/*
 * One Ask, the same from every screen (Today's row, Replies' Ask again, Orders' pill, the Not found
 * sheet's other supplier, a supplier's Ask again):
 *   - a supplier with WhatsApp: WhatsApp opens with the message written (inside the tap, so the phone
 *     allows it), then the ask is booked, so Sales sees "Asked";
 *   - one without WhatsApp: the Ask sheet opens (call them, then say what they said), nothing is booked yet;
 *   - an ask for that supplier already kept on this phone (no signal): nothing is sent twice.
 */
import { askGroups, askMessage, replyRows, waLink, type SupplierGroup } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { openAskSheet } from '../today/AskSheet.tsx';
import { act, books, kept, now, session } from './store.ts';

/** The supplier's lines to ask about now: to ask, else asked and waiting. */
export function groupOf(b: BuyerBooks, sid: string): SupplierGroup | null {
  return askGroups(b, now.value).find((g) => g.supplier.id === sid) || replyRows(b, now.value).find((g) => g.supplier.id === sid) || null;
}

/** An ask for this supplier is kept on this phone, waiting for signal. */
export const askKept = (sid: string): boolean => kept.value.some((k) => k.kind === 'ask' && Array.isArray(k.args) && String(k.args[0]) === sid);

/**
 * Ask a supplier. Resolves with the write's result when WhatsApp opened and the ask was booked (or was
 * already kept); null when the Ask sheet opened instead (no WhatsApp) or there is nothing to ask.
 */
export async function askSupplier(b: BuyerBooks, sid: string): Promise<{ kept: boolean } | null> {
  // The books as they are now: a screen may hold a copy from before its own last write.
  const now0 = books.value || b;
  const s = now0.suppliers.find((x) => x.id === sid);
  const g = groupOf(now0, sid);
  if (!s || !g) return null;
  if (askKept(sid)) return { kept: true };
  if (!s.whatsapp) { openAskSheet(now0, g); return null; }
  openWhatsApp(s.phone, askMessage(s, g.lines.map((r) => r.line), shopName()));
  return act('ask', sid, 'whatsapp');
}

export const shopName = (): string => (session.value ? session.value.shopName : 'the shop');

/** WhatsApp with the message written. Call it inside the tap, before any wait, or the phone may block it. */
export function openWhatsApp(phone: string, text: string): void {
  if (typeof window !== 'undefined') window.open(waLink(phone, text), '_blank', 'noopener');
}
