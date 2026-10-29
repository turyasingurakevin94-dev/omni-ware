/*
 * The Customers tab (boards CU01–CU43, docs/canvas/sales-agent/boards/).
 * Owned by the customers builder: register this tab's screens and routes here,
 * one file per screen beside this one. Screen ids start with "customers/";
 * the root's id is "customers". Parity specs: test/parity/customers.json.
 */
import { Todo } from '../shell/Todo.tsx';
import type { TabModule } from '../shell/types.ts';

function CustomersRoot() {
  return <Todo title="Customers" boards="CU01–CU43" />;
}

export const tab: TabModule = {
  id: 'customers',
  root: 'customers',
  screens: {
    'customers': { view: CustomersRoot },
  },
};
