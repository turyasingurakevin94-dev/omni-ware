/* The orders area's screens, by route id (shell/routes.ts). Built to the canvas (docs/canvas/manager/Orders.dc.html). */
import type { ScreenDef } from '../../../ui/stack.ts';
import { Order } from './Order.tsx';
import { Orders } from './Orders.tsx';
import { Stock } from './Stock.tsx';
import { Stuck } from './Stuck.tsx';
import { ToBill } from './ToBill.tsx';

// The pushed pages keep the bar (Orders p2–p4 draw it under them).
export const screens: Record<string, ScreenDef> = {
  orders: { view: Orders },
  'orders/order': { view: Order, tabBar: true },
  'orders/stuck': { view: Stuck, tabBar: true },
  'orders/bill': { view: ToBill, tabBar: true },
  'orders/stock': { view: Stock, tabBar: true },
};
