/* The Decide area's screens (shell/routes.ts): the one sheet, and All decided. */
import type { ScreenDef } from '../../../ui/stack.ts';
import { Decide } from './Decide.tsx';
import { Done } from './Done.tsx';

export const screens: Record<string, ScreenDef> = {
  decide: { view: Decide, tabBar: false, bars: false },
  'decide/done': { view: Done, tabBar: false },
};
