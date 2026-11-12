/*
 * The Manager's screen stack: the shared one (src/ui/stack.ts) with the Manager's routes.
 * Four tab roots, Today · Orders · Money · Team; the red + opens `decide` (shell/App.tsx).
 */
import { createStack, type Entry, type Params, type ScreenDef } from '../../../ui/stack.ts';
import { route, type Tab } from './routes.ts';

export type { Params, ScreenDef, Tab };

const NAME: Record<string, (p: Params) => string> = {
  today: () => 'Today', orders: () => 'Orders', money: () => 'Money', team: () => 'Team',
  'orders/order': () => 'the order', 'orders/bill': () => 'To bill', 'orders/stuck': () => 'Stuck',
  'money/debtor': () => 'the debtor', 'money/customer': () => 'the customer', 'team/goals': () => 'Goals',
};

const s = createStack({
  key: 'ow-manager-view',
  home: 'today',
  kindOf: (id) => route(id)?.kind ?? null,
  nameOf: (e: Entry) => (NAME[e.id] ? NAME[e.id](e.params) : null),
});

export const { nav, stack, top, under, isSheet, barTab, showTabBar, backTo, register, addScreens, screen } = s;
