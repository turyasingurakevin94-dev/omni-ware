/*
 * The Orders tab (docs/canvas/buyer/Orders.dc.html): Checking, one order,
 * and Switch item. The Not found sheet is openNotFound (NotFound.tsx).
 *
 *   'orders'          (filter: all · asked · notfound · ruth)   the Checking list, with the bar
 *   'orders/order'    (id)                                      one order
 *   'orders/switch'   (id, key)                                 another item for a line not found
 */
import type { ScreenDef } from '../shell/nav.ts';
import { OrdersList } from './List.tsx';
import { OrderScreen } from './Order.tsx';
import { SwitchScreen } from './Switch.tsx';

export const screens: Record<string, ScreenDef> = {
  'orders': { view: OrdersList, tabBar: true },
  'orders/order': { view: OrderScreen, tabBar: false },
  'orders/switch': { view: SwitchScreen, tabBar: false },
};
