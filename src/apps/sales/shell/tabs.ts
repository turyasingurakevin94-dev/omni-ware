/*
 * The six tab modules, and nothing else. A tab builder adds screens in
 * their own folder's index.tsx; this file never changes for it.
 */
import { tab as chats } from '../chats/index.tsx';
import { tab as counter } from '../counter/index.tsx';
import { tab as customers } from '../customers/index.tsx';
import { tab as orders } from '../orders/index.tsx';
import { tab as sell } from '../sell/index.tsx';
import { tab as today } from '../today/index.tsx';
import type { TabModule } from './types.ts';

export const TABS: TabModule[] = [today, chats, sell, counter, orders, customers];
