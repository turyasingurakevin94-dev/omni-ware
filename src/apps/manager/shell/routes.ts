/*
 * The Manager's routes: one id per page of the approved canvas (docs/spec/04-screens-manager.md §2).
 * The one place an id, its area, its kind and its boards are written; test/manager-shell.test.js
 * checks it against the spec.
 *
 *   tab     a tab root, with the bar (today, orders, money, team)
 *   sheet   rises over the screen under it (decide, the person and nudge sheets, the promise, the limit)
 *   pushed  one page on screen; Back walks the stack
 *   full    full screen, no bar (sign-in and boot)
 */
import type { RouteKind } from '../../../ui/stack.ts';

export type Area = 'shell' | 'today' | 'decide' | 'orders' | 'money' | 'team';
export interface Route { id: string; area: Area; kind: RouteKind; params: string; boards: string }

const r = (id: string, area: Area, kind: RouteKind, params: string, boards: string): Route => ({ id, area, kind, params, boards });

export const ROUTES: Route[] = [
  r('shell/sign-in', 'shell', 'full', '', 'Added p1 (AD01)'),
  r('shell/no-reach', 'shell', 'full', '', 'Added p2 (AD01)'),
  r('shell/you', 'shell', 'sheet', '', 'Added p3 (AD02)'),

  r('today', 'today', 'tab', '', 'Today p1'),

  r('decide', 'decide', 'sheet', '{ id?, asker? }', 'Today p2–p3 · DecidePrice · DecideOrders · DecideStock · MoneyCredit'),
  r('decide/done', 'decide', 'sheet', '', 'Today p4'),

  r('orders', 'orders', 'tab', '{ filter? }', 'Orders p1'),
  r('orders/order', 'orders', 'pushed', '{ id }', 'Orders p2'),
  r('orders/stuck', 'orders', 'pushed', '', 'Orders p3'),
  r('orders/bill', 'orders', 'pushed', '', 'Orders p4'),
  r('orders/stock', 'orders', 'pushed', '', 'Added p4 (AD05)'),

  r('money', 'money', 'tab', '', 'Money p1'),
  r('money/debtor', 'money', 'pushed', '{ customer }', 'Money p2'),
  r('money/promise', 'money', 'sheet', '{ customer }', 'Money p3'),
  r('money/customer', 'money', 'pushed', '{ customer }', 'Money p4'),
  r('money/limit', 'money', 'sheet', '{ customer }', 'Added2 p1 (AD03)'),
  r('money/merge', 'money', 'sheet', '{ keep, drop }', 'Added2 p2 (AD04)'),
  r('money/opening', 'money', 'sheet', '{ customer }', 'Added2 p3 (AD04)'),

  r('team', 'team', 'tab', '', 'Team p1'),
  r('team/person', 'team', 'sheet', '{ staff }', 'Team p2'),
  r('team/goals', 'team', 'pushed', '', 'Team p3'),
  r('team/nudge', 'team', 'sheet', '{ staff, order? }', 'Team p4'),
];

export const TABS = ['today', 'orders', 'money', 'team'] as const;
export type Tab = (typeof TABS)[number];

export function route(id: string): Route | undefined {
  return ROUTES.find((x) => x.id === id);
}
