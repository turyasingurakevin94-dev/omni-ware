/* The money area's screens, by route id (shell/routes.ts). Built to the canvas (docs/canvas/manager/ Money, Added2). */
import type { ScreenDef } from '../../../ui/stack.ts';
import { Customer } from './Customer.tsx';
import { Debtor } from './Debtor.tsx';
import { LimitSheet } from './Limit.tsx';
import { MergeSheet } from './Merge.tsx';
import { Money } from './Money.tsx';
import { OpeningSheet } from './Opening.tsx';
import { PromiseSheet } from './Promise.tsx';

export const screens: Record<string, ScreenDef> = {
  money: { view: Money },
  'money/debtor': { view: Debtor, tabBar: false },
  'money/promise': { view: PromiseSheet, tabBar: false, bars: false },
  'money/customer': { view: Customer, tabBar: false },
  'money/limit': { view: LimitSheet, tabBar: false, bars: false },
  'money/merge': { view: MergeSheet, tabBar: false, bars: false },
  'money/opening': { view: OpeningSheet, tabBar: false, bars: false },
};
