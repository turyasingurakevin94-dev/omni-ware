/*
 * The Counter tab (boards KC01–KC19, docs/canvas/sales-agent/boards/): a walk-in sale, paid and
 * gone. Entered from the red +'s "Counter sale" (SL01) and from Find (TD13); routes in ROUTES.md.
 *
 *   counter           KC01–KC10, KC12, KC13, KC17–KC19 (the sale; KC04 and KC06 are its sheets)
 *   counter/wait      KC11: the sale waits for the Manager's price
 *   counter/sold      KC14 cash, KC15 mobile
 *   counter/receipt   KC16, over Sold
 *
 * Parity specs: test/parity/counter.json.
 */
import { effect } from '@preact/signals';
import { toast } from '../../../ui/toast.tsx';
import { orderNo } from '../../../core/names.ts';
import { top } from '../shell/nav.ts';
import { books, refresh } from '../shell/store.ts';
import type { TabModule } from '../shell/types.ts';
import { Counter, manager } from './Counter.tsx';
import { Receipt } from './Receipt.tsx';
import { Sold } from './Sold.tsx';
import { bringBack, sale, waitingLines } from './state.ts';
import { Wait } from './Wait.tsx';

/*
 * Ruth's yes brings a waiting sale back (KC11 "Serve the next walk-in"; the handoff rule: she is
 * pushed, and so is Grace when she answers). While a sale of Grace's waits and she is not on its
 * screen, the books are read every few seconds; when the answer is in, the counter takes the sale
 * back if nothing else is on it, and says so either way.
 */
let poll = 0;
const told = new Set<number>();
effect(() => {
  const b = books.value;
  if (!b) return;
  const mine = b.orders.filter((o) => o.counter && !o.invoiced && !o.cancelled && !o.voided && o.placedBy === b.me.id);
  const waiting = mine.filter((o) => waitingLines(o.lines).length > 0);
  if (waiting.length && !poll) poll = window.setInterval(() => { void refresh(); }, 5000);
  if (!waiting.length && poll) { window.clearInterval(poll); poll = 0; }
  mine.filter((o) => !waitingLines(o.lines).length && o.lines.some((l) => l.priceReview) && !told.has(o.id)).forEach((o) => {
    told.add(o.id);
    const t = top.peek();
    if (t.id === 'counter/wait') return;
    toast.show(`${manager(b).first} said yes · ${orderNo(o.id)}`);
    if (t.id === 'counter' && !sale.peek().lines.length) bringBack(o);
  });
});

export const tab: TabModule = {
  id: 'counter',
  root: 'counter',
  screens: {
    'counter': { view: Counter },
    'counter/wait': { view: Wait },
    'counter/sold': { view: Sold },
    'counter/receipt': { view: Receipt },
  },
};

