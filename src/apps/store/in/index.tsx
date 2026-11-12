/*
 * The in area's screens (docs/spec/04-screens-store-routes.md §2): in (stage sheet), in/checkin, in/delivery, in/return, in/ride.
 * A stage sheet's screen is drawn inside shell/StageSheet.tsx. A screen with a dock draws the bars itself (bars: false).
 * See src/apps/store/README.md.
 */
import type { ScreenDef } from '../shell/nav.ts';
import { Checkin } from './Checkin.tsx';
import { ComingIn } from './ComingIn.tsx';
import { Delivery } from './Delivery.tsx';
import { Return } from './Return.tsx';
import { Ride } from './Ride.tsx';

export { openNotOnList } from './NotOnList.tsx';

export const screens: Record<string, ScreenDef> = {
  in: { view: () => <ComingIn /> },
  'in/checkin': { view: ({ params }) => <Checkin key={String(params.trip)} trip={String(params.trip || '')} />, bars: false },
  'in/delivery': { view: ({ params }) => <Delivery key={String(params.trip)} trip={String(params.trip || '')} />, bars: false },
  'in/return': { view: ({ params }) => <Return key={String(params.order)} order={Number(params.order)} />, bars: false },
  'in/ride': { view: ({ params }) => <Ride trip={params.trip ? String(params.trip) : undefined} />, bars: false },
};
