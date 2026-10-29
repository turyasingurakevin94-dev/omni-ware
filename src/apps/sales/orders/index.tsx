/*
 * The Orders tab (boards OR01–OR26, docs/canvas/sales-agent/boards/).
 * Owned by the orders builder: register this tab's screens and routes here,
 * one file per screen beside this one. Screen ids start with "orders/";
 * the root's id is "orders". Parity specs: test/parity/orders.json.
 */
import { Todo } from '../shell/Todo.tsx';
import type { TabModule } from '../shell/types.ts';

function OrdersRoot() {
  return <Todo title="Orders" boards="OR01–OR26" />;
}

export const tab: TabModule = {
  id: 'orders',
  root: 'orders',
  screens: {
    'orders': { view: OrdersRoot },
  },
};
