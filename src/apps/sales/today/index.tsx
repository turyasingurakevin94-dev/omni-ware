/*
 * The Today tab (boards TD01–TD25, docs/canvas/sales-agent/boards/; the route ids are in
 * ../shell/ROUTES.md). One file per screen beside this one. Parity specs: test/parity/today.json.
 *
 *   today                    TD01 (its states TD02–TD09), Today.tsx; Tell them (TD04) is its sheet, Tell.tsx
 *   today/to-collect         TD05 ToCollect.tsx
 *   today/find { q? }        TD11–TD14 Find.tsx
 *   today/goal               TD15 Goal.tsx
 *   today/day { view? }      TD16, TD17, TD25 Day.tsx
 *   today/you                TD18 You.tsx
 *   today/asks { id? }       TD19–TD24 Asks.tsx (the list), Ask.tsx (one ask), AskNew.tsx (Ask Moses, a sheet)
 *   today/signed-elsewhere   TD10 Elsewhere.tsx (the shell shows it before the tabs)
 */
import type { TabModule } from '../shell/types.ts';
import { Asks } from './Asks.tsx';
import { Day } from './Day.tsx';
import { Elsewhere } from './Elsewhere.tsx';
import { Find } from './Find.tsx';
import { Goal } from './Goal.tsx';
import { ToCollect } from './ToCollect.tsx';
import { Today } from './Today.tsx';
import { You } from './You.tsx';

export const tab: TabModule = {
  id: 'today',
  root: 'today',
  screens: {
    'today': { view: Today },
    'today/to-collect': { view: ToCollect },
    'today/find': { view: Find },
    'today/goal': { view: Goal },
    'today/day': { view: Day },
    'today/you': { view: You },
    'today/asks': { view: Asks },
    'today/signed-elsewhere': { view: Elsewhere },
  },
};
