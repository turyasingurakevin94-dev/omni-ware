/*
 * The Chats tab (boards CH01–CH33, docs/canvas/sales-agent/boards/). Its screens:
 *   chats            the list: Mine, Waiting, New, Team (CH01–CH04), no chats yet (CH06), loading (CH07)
 *   chats/new        New chat, the sheet over the list (CH05)
 *   chats/chat       one chat (CH10–CH15, CH31) and its sheets: Send (CH20), Send a price (CH21), Give (CH30)
 *   chats/customer   the customer, from the chat (CH33)
 * The Manager's Move (CH32) opens over the Team view. Parity specs: test/parity/chats.json.
 */
import type { TabModule } from '../shell/types.ts';
import { ChatScreen } from './Chat.tsx';
import { ChatCustomer } from './Customer.tsx';
import { ChatsList } from './List.tsx';
import { NewChatScreen } from './NewChat.tsx';

export const tab: TabModule = {
  id: 'chats',
  root: 'chats',
  screens: {
    'chats': { view: ChatsList },
    'chats/new': { view: NewChatScreen },
    'chats/chat': { view: ChatScreen },
    'chats/customer': { view: ChatCustomer },
  },
};
