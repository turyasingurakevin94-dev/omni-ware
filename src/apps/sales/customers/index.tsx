/*
 * The Customers tab (boards CU01–CU43, docs/canvas/sales-agent/boards/).
 *
 *   customers             { filter? }                     the list: Owe · Due · Quiet · All, search (CU01–CU08)
 *   customers/customer    { id }                          one customer (CU10–CU13; sheets CU12, CU15)
 *   customers/new         { phone?, name?, chat? }        New customer, a sheet over the list (CU20–CU23)
 *   customers/pay         { customer, bills? } | { order } Take payment (CU30–CU36)
 *   customers/paid        { id }                          Paid (CU40–CU43)
 *
 * Parity specs: test/parity/customers.json.
 */
import type { TabModule } from '../shell/types.ts';
export { openBillChecked } from './BillCheck.tsx';
import { CustomerScreen } from './Customer.tsx';
import { ListScreen } from './List.tsx';
import { NewScreen } from './New.tsx';
import { PaidScreen } from './Paid.tsx';
import { PayScreen } from './Pay.tsx';

export const tab: TabModule = {
  id: 'customers',
  root: 'customers',
  screens: {
    'customers': { view: ListScreen },
    'customers/customer': { view: CustomerScreen },
    'customers/new': { view: NewScreen },
    'customers/pay': { view: PayScreen },
    'customers/paid': { view: PaidScreen },
  },
};
