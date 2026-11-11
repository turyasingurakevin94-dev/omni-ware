/*
 * Ask again (the Suppliers row's one act), through the one Ask (shell/ask.ts):
 * WhatsApp opens with the message written, or the Ask sheet when they have no WhatsApp. Sales sees "Asked"
 * with the new time; offline it is kept on this phone and sent later.
 */
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { toast } from '../../../ui/toast.tsx';
import { askSupplier } from '../shell/ask.ts';
import { now } from '../shell/store.ts';
import { first, hm, member } from './parts.tsx';
import { supplierRows } from './rules.ts';

/** Ask again from a supplier's row: the one Ask (shell/ask.ts), and what Sales sees. */
export async function askAgain(b: BuyerBooks, sid: string): Promise<void> {
  const s = b.suppliers.find((x) => x.id === sid);
  if (!s) return;
  const row = supplierRows(b, now.value).find((r) => r.s.id === sid);
  const seller = first(member(b, row ? row.sellerId : null), 'Sales');
  try {
    const r = await askSupplier(b, sid);
    if (!r) return;
    if (r.kept) toast.show('No signal · saved on this phone', { kind: 'warn', sub: `${s.name} · sends later` });
    else toast.show(`Asked ${s.name}`, { sub: `${seller} sees: Asked · ${hm(now.value)}` });
  } catch (e) {
    toast.show('Not sent', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void askAgain(b, sid); } });
  }
}
