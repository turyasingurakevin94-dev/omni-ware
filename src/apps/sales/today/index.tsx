/*
 * The Today tab (boards TD01–TD25, docs/canvas/sales-agent/boards/).
 * Owned by the today builder: register this tab's screens and routes here,
 * one file per screen beside this one. Screen ids start with "today/";
 * the root's id is "today". Parity specs: test/parity/today.json.
 */
import { Todo } from '../shell/Todo.tsx';
import type { TabModule } from '../shell/types.ts';

function TodayRoot() {
  return <Todo title="Today" boards="TD01–TD25" />;
}

export const tab: TabModule = {
  id: 'today',
  root: 'today',
  screens: {
    'today': { view: TodayRoot },
  },
};
