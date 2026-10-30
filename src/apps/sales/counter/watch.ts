/*
 * A counter sale that waits for the Manager's price (KC11). While the Counter is open, that one
 * order is read again every 15 s (never the whole books); when her answer is in, the sale comes
 * back to the counter (KC12) if the counter is free, and a toast says so either way. Away from
 * the Counter, her push brings it back (the handoff rule).
 */
import { effect, signal } from '@preact/signals';
import { toast } from '../../../ui/toast.tsx';
import { orderNo } from '../../../core/names.ts';
import type { Order } from '../../../core/types.ts';
import { top } from '../shell/nav.ts';
import { books, source } from '../shell/store.ts';
import { bringBack, sale, waitingLines } from './state.ts';

/** The waiting sales as last read one by one (newer than the books). */
export const held = signal<Record<number, Order>>({});


export function heldOrder(id: number): Order | undefined {
  const b = books.value;
  return held.value[id] || (b ? b.orders.find((o) => o.id === id) : undefined);
}

/** Grace's counter sales not sold yet, as last known. */
function mine(): Order[] {
  const b = books.peek();
  if (!b) return [];
  const ids = new Set([...b.orders.filter((o) => o.counter && !o.invoiced && !o.cancelled && !o.voided && o.placedBy === b.me.id).map((o) => o.id), ...Object.keys(held.peek()).map(Number)]);
  return [...ids].map((id) => {
    const inBooks = b.orders.find((o) => o.id === id);
    return inBooks && (inBooks.invoiced || inBooks.cancelled) ? inBooks : held.peek()[id] || inBooks;
  }).filter((o): o is Order => !!o && !o.invoiced && !o.cancelled && !o.voided);
}

const told = new Set<number>();
let timer = 0;

async function readAgain(): Promise<void> {
  if (!top.peek().id.startsWith('counter')) return;
  for (const o of mine().filter((x) => waitingLines(x.lines).length)) {
    try {
      const fresh = await source.order(o.id);
      if (fresh) held.value = { ...held.peek(), [o.id]: fresh };
    } catch (_e) { /* no signal: the next read */ }
  }
}

/** Her answer is in: say so, and bring the sale back when the counter is free (not on its own wait screen, which does). */
function answered(o: Order, manager: string): void {
  if (told.has(o.id)) return;
  told.add(o.id);
  const t = top.peek();
  if (t.id === 'counter/wait') return;
  toast.show(`${manager} said yes · ${orderNo(o.id)}`);
  if (t.id === 'counter' && !sale.peek().lines.length) bringBack(o);
}

let started = false;

/** Begin watching (from the Counter's screens: at import time the shell's modules are not all loaded yet). */
export function startWatch(): void {
  if (started) return;
  started = true;
  // A full read of the books is newer than any one-order read before it.
  effect(() => { if (books.value) held.value = {}; });
  effect(watchOnce);
}

function watchOnce(): void {
  void held.value;
  const b = books.value, on = top.value.id.startsWith('counter');
  if (!b) return;
  const all = mine(), waiting = all.filter((o) => waitingLines(o.lines).length);
  if (waiting.length && on && !timer) timer = window.setInterval(() => { void readAgain(); }, 15000);
  if ((!waiting.length || !on) && timer) { window.clearInterval(timer); timer = 0; }
  const m = b.members.find((x) => x.role === 'manager');
  all.filter((o) => !waitingLines(o.lines).length && o.lines.some((l) => l.priceReview)).forEach((o) => answered(o, m ? m.name.split(' ')[0] : 'The Manager'));
}
