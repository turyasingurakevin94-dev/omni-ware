/*
 * The Sell tab, the red + (boards SL01–SL31, docs/canvas/sales-agent/boards/).
 *   sell         SL01, SL02   who is it for? (a sheet over the screen it came from)
 *   sell/order   SL03–SL27, SL30, SL31   building the order
 *   sell/aisle   SL12         an aisle open, from the order
 *   sell/placed  SL28, SL29   placed
 * Parity specs: test/parity/sell.json.
 */
import type { TabModule } from '../shell/types.ts';
import { AisleScreen } from './Aisle.tsx';
import { OrderScreen } from './Order.tsx';
import { PlacedScreen } from './Placed.tsx';
import { Who } from './Who.tsx';

export const tab: TabModule = {
  id: 'sell',
  root: 'sell',
  screens: {
    'sell': { view: Who, tabBar: false },
    'sell/order': { view: OrderScreen, tabBar: false },
    'sell/aisle': { view: AisleScreen, tabBar: false },
    'sell/placed': { view: PlacedScreen, tabBar: false },
  },
};
