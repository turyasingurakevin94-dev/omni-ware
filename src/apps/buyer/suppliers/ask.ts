/*
 * Ask again (the Suppliers row's one act), through the one Ask (shell/ask.ts):
 * WhatsApp opens with the message written, or the Ask sheet when they have no WhatsApp.
 * What follows is drawn on the row itself (Suppliers.dc.html states): SUCCESS "✓ Asked · 11:10" and
 * "Brian sees: Asked · 11:10" for 5 seconds; OFFLINE "Sends later" (a kept ask is never sent twice).
 * A refused ask is the error toast with Try again.
 */
import { signal } from '@preact/signals';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import type { Ms } from '../../../core/types.ts';
import { toast } from '../../../ui/toast.tsx';
import { askSupplier } from '../shell/ask.ts';
import { now } from '../shell/store.ts';

/** The row just asked (SUCCESS), for 5 seconds. */
export const justAsked = signal<{ id: string; at: Ms } | null>(null);
const SHOW_MS = 5000;
let timer = 0;

/** Ask again from a supplier's row: the one Ask (shell/ask.ts). */
export async function askAgain(b: BuyerBooks, sid: string): Promise<void> {
  const s = b.suppliers.find((x) => x.id === sid);
  if (!s) return;
  try {
    const r = await askSupplier(b, sid);
    if (!r || r.kept) return;
    justAsked.value = { id: sid, at: now.value };
    clearTimeout(timer);
    timer = window.setTimeout(() => { justAsked.value = null; }, SHOW_MS);
  } catch (_e) {
    toast.show('Not sent', { kind: 'error', sub: `Ask ${s.name} again`, retry: () => { void askAgain(b, sid); } });
  }
}
