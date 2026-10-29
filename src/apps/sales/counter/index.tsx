/*
 * The Counter tab (boards KC01–KC19, docs/canvas/sales-agent/boards/).
 * Owned by the counter builder: register this tab's screens and routes here,
 * one file per screen beside this one. Screen ids start with "counter/";
 * the root's id is "counter". Parity specs: test/parity/counter.json.
 */
import { Todo } from '../shell/Todo.tsx';
import type { TabModule } from '../shell/types.ts';

function CounterRoot() {
  return <Todo title="Counter" boards="KC01–KC19" />;
}

export const tab: TabModule = {
  id: 'counter',
  root: 'counter',
  screens: {
    'counter': { view: CounterRoot },
  },
};
