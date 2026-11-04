/*
 * The counter tab's own additions to the demo, owned by the counter builder (no other tab edits it).
 * Change the seeded state here when a counter board needs something FACTS.md states and the shared
 * seed does not have yet; keep it true to FACTS.md, and say which board needs it.
 *
 *   the counter's 6 sales   KC14/KC15 draw them as bars: 42,000 · 88,000 · 61,000 (mobile) · 100,000 ·
 *                           35,000 (mobile) · 86,000 = 412,000 (FACTS §5). What was in them makes KC01's
 *                           "Sold most today" (Cement, Wire nails 4" · 1kg, Wood glue, PVC pipe) and the
 *                           rows under a basket (KC03: Wire nails; KC18: Wire nails, PVC pipe).
 *   Roof paint's cost       never drawn; KC10's ladder puts 170,000 at 66% of the way to the shop's 185,000.
 *   Ruth answers            the Manager is not in the demo: a counter sale that waits for her price (KC11)
 *                           gets her yes when it has waited three minutes (KC12 "Ruth said yes · in 3 m").
 */
import type { DemoFlags } from '../../flags.ts';
import type { DemoState } from '../index.ts';
import type { Line, Method } from '../../../types.ts';
import { L } from '../build.ts';
import { RUTH } from '../people.ts';

/** KC14's bars, in order: [order id, its lines, how it was paid]. */
const SALES: [number, Line[], Method][] = [
  [516, [L('cement-hima-50', 1), L('hinge-zawaina-4', 5)], 'cash'],
  [517, [L('cement-hima-50', 2), L('roofing-nails-2-5', 5)], 'cash'],
  [518, [L('cement-hima-50', 1), L('nails-4-1kg', 2), L('tile-grout-2', 1)], 'momo'],
  [519, [L('cement-hima-50', 1), L('nails-4-1kg', 1), L('pvc-half-6m', 3), L('handle-c-128', 8)], 'cash'],
  [520, [L('nails-4-1kg', 1), L('wood-glue-1l', 1), L('handle-c-128', 3)], 'momo'],
  [554, [L('nails-4-1kg', 2), L('wood-glue-1l', 3), L('pvc-half-6m', 1)], 'cash'],
];

/** How long Ruth takes to answer a counter price in the demo (real time, so KC11's "2 m" is really two minutes). */
export const RUTH_ANSWERS_MS = 3 * 60000;

export function extra(s: DemoState, _f: DemoFlags): void {
  const b = s.books;
  SALES.forEach(([id, lines, method]) => {
    const o = b.orders.find((x) => x.id === id);
    if (!o) return;
    const total = lines.reduce((t, l) => t + l.qty * (l.price || 0), 0);
    o.lines = lines.map((l, i) => ({ ...l, lineId: i + 1 }));
    o.paid = total;
    o.payments = o.payments.map((p) => ({ ...p, amount: total, method }));
    b.payments.filter((p) => p.orderId === id).forEach((p) => { p.amount = total; p.method = method; });
  });
  // KC01 "Say it": what the demo's phone hears at the counter (it has no microphone), into the find.
  (globalThis as { owDemoCounterVoice?: string }).owDemoCounterVoice = 'wood glue';
  const paint = b.items.find((i) => i.id === 'roof-paint-maroon-20');
  if (paint) paint.cost = 50000;
  if (typeof window !== 'undefined') ruthAnswers(s);
}

/** Ruth's yes to each counter price that waits, once it has waited RUTH_ANSWERS_MS on this phone. */
function ruthAnswers(s: DemoState): void {
  const seen = new Map<number, number>();
  window.setInterval(() => {
    s.books.orders.forEach((o) => {
      if (!o.counter || o.invoiced || o.cancelled) return;
      const waiting = o.lines.filter((l) => l.shopPrice != null && l.price != null && l.price < l.shopPrice && !(l.priceReview && l.priceReview.price === l.price));
      if (!waiting.length) { seen.delete(o.id); return; }
      const first = seen.get(o.id) ?? Date.now();
      seen.set(o.id, first);
      const waited = Date.now() - first;
      if (waited < RUTH_ANSWERS_MS) return;
      waiting.forEach((l) => {
        l.priceReview = { state: 'approved', price: l.price as number, was: l.shopPrice, by: RUTH, byName: 'Ruth Nakato', at: o.placedAt + Math.round(waited / 60000) * 60000 };
      });
    });
  }, 1000);
}
