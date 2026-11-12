/* The Replies tab's screens: the list (with the bar, as the board draws it) and New price. */
import type { ScreenDef } from '../shell/nav.ts';
import { Price } from './Price.tsx';
import { Replies } from './Replies.tsx';

export const screens: Record<string, ScreenDef> = {
  'replies': { view: () => <Replies />, tabBar: true },
  'replies/price': { view: Price, tabBar: false },
};
