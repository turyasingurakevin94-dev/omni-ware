/*
 * The Orders tab (boards OR01–OR26, docs/canvas/sales-agent/boards/). Its screens and the sheets
 * other tabs may open (shell/ROUTES.md "Exported sheets"). Parity specs: test/parity/orders.json.
 */
import type { TabModule } from '../shell/types.ts';
import { OrdersList } from './List.tsx';
import { OrderScreen } from './Order.tsx';

export { openTell } from './Tell.tsx';
export { openWrong } from './Wrong.tsx';
export { openChange } from './Change.tsx';

export const tab: TabModule = {
  id: 'orders',
  root: 'orders',
  screens: {
    'orders': { view: OrdersList },
    'orders/order': { view: OrderScreen },
  },
};
