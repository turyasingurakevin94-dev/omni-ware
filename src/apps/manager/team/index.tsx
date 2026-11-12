/* The team area's screens, by route id (shell/routes.ts). Built to the canvas (docs/canvas/manager/Team.dc.html). */
import type { ScreenDef } from '../../../ui/stack.ts';
import { Goals } from './Goals.tsx';
import { Nudge } from './Nudge.tsx';
import { Person } from './Person.tsx';
import { Team } from './Team.tsx';

export const screens: Record<string, ScreenDef> = {
  team: { view: () => <Team /> },
  'team/person': { view: ({ params }) => <Person params={params} /> },
  'team/goals': { view: () => <Goals />, bars: false },
  'team/nudge': { view: ({ params }) => <Nudge params={params} /> },
};
