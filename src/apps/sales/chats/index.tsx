/*
 * The Chats tab (boards CH01–CH33, docs/canvas/sales-agent/boards/). Its screens:
 *   chats            the list: Mine, Waiting, New, Team (CH01–CH04), no chats yet (CH06), loading (CH07)
 *   chats/new        New chat, the sheet over the list (CH05)
 *   chats/chat       one chat (CH10–CH15, CH20, CH21, CH30, CH31)
 *   chats/customer   the customer, from the chat (CH33)
 * Parity specs: test/parity/chats.json.
 */
import type { TabModule } from '../shell/types.ts';
import { ChatsList } from './List.tsx';

export const tab: TabModule = {
  id: 'chats',
  root: 'chats',
  screens: {
    'chats': { view: ChatsList },
  },
};
