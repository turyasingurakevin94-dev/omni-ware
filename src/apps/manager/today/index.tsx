/* The today area's screens, by route id (shell/routes.ts). Built to the canvas (docs/canvas/manager/Today.dc.html p1). */
import type { ScreenDef } from '../../../ui/stack.ts';
import { Today } from './Today.tsx';

export const screens: Record<string, ScreenDef> = {
  today: { view: Today },
};
