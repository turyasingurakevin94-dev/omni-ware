/*
 * The out area's screens (docs/spec/04-screens-store-routes.md §2): out/load (stage sheet), out/run, out/gate,
 * out/gate-code, out/road (stage sheet), out/door, out/cant-deliver. Sheets (routes §4): openNameDirection
 * (OU31, NameSheet.tsx), openNoPhoto (OU23, Door.tsx), and the hired driver (OU03, Hired.tsx).
 * The rules they read are src/core/store/load.ts, gate.ts and door.ts.
 */
import type { ScreenDef } from '../shell/nav.ts';
import { CantDeliver } from './CantDeliver.tsx';
import { Door } from './Door.tsx';
import { Gate } from './Gate.tsx';
import { GateCode } from './GateCode.tsx';
import { Road } from './Road.tsx';
import { Run } from './Run.tsx';
import { ToLoad } from './ToLoad.tsx';

export { openNameDirection } from './NameSheet.tsx';
export { openNoPhoto } from './Door.tsx';

export const screens: Record<string, ScreenDef> = {
  'out/load': { view: () => <ToLoad /> },
  'out/run': { view: ({ params }) => <Run params={params} />, bars: false },
  'out/gate': { view: ({ params }) => <Gate params={params} />, bars: false },
  'out/gate-code': { view: ({ params }) => <GateCode params={params} />, bars: false },
  'out/road': { view: () => <Road />, bars: false },
  'out/door': { view: ({ params }) => <Door id={Number(params.id)} />, bars: false },
  'out/cant-deliver': { view: ({ params }) => <CantDeliver id={Number(params.id)} />, bars: false },
};
