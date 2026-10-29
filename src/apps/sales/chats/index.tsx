/*
 * The Chats tab (boards CH01–CH33, docs/canvas/sales-agent/boards/).
 * Owned by the chats builder: register this tab's screens and routes here,
 * one file per screen beside this one. Screen ids start with "chats/";
 * the root's id is "chats". Parity specs: test/parity/chats.json.
 */
import { Todo } from '../shell/Todo.tsx';
import type { TabModule } from '../shell/types.ts';

function ChatsRoot() {
  return <Todo title="Chats" boards="CH01–CH33" />;
}

export const tab: TabModule = {
  id: 'chats',
  root: 'chats',
  screens: {
    'chats': { view: ChatsRoot },
  },
};
