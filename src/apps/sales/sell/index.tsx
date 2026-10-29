/*
 * The New sale tab (boards SL01–SL31, docs/canvas/sales-agent/boards/).
 * Owned by the sell builder: register this tab's screens and routes here,
 * one file per screen beside this one. Screen ids start with "sell/";
 * the root's id is "sell". Parity specs: test/parity/sell.json.
 */
import { Todo } from '../shell/Todo.tsx';
import type { TabModule } from '../shell/types.ts';

function SellRoot() {
  return <Todo title="New sale" boards="SL01–SL31" />;
}

export const tab: TabModule = {
  id: 'sell',
  root: 'sell',
  screens: {
    'sell': { view: SellRoot },
  },
};
