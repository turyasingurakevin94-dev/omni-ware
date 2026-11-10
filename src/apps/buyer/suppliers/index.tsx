/*
 * The Suppliers tab (docs/canvas/buyer/Suppliers.dc.html):
 *   suppliers        the list, its search ("Nobody sells it" when none match) and place chips
 *   suppliers/one    one supplier (id): found rate, reply time, Call / WhatsApp, lines with them, what we buy
 *   suppliers/fix    a price (id, item) or a phone the supplier told us
 */
import type { ScreenDef } from '../shell/nav.ts';
import { Fix } from './Fix.tsx';
import { Suppliers } from './List.tsx';
import { One } from './One.tsx';

export const screens: Record<string, ScreenDef> = {
  'suppliers': { view: Suppliers },
  'suppliers/one': { view: One, tabBar: true },
  'suppliers/fix': { view: Fix, tabBar: false },
};
