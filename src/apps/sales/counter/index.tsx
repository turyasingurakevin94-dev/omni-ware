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
import type { TabModule } from '../shell/types.ts';
import { Counter } from './Counter.tsx';
import { Receipt } from './Receipt.tsx';
import { Sold } from './Sold.tsx';
import { Wait } from './Wait.tsx';

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

