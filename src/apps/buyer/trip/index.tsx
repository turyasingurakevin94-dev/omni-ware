/* The trip tab's screens (TripPlan, TripOn, TripHandIn boards). */
import type { ScreenDef } from '../shell/nav.ts';
import { Done } from './Done.tsx';
import { HandInScreen } from './HandIn.tsx';
import { Trip } from './Trip.tsx';

export const screens: Record<string, ScreenDef> = {
  'trip': { view: Trip },
  'trip/handin': { view: HandInScreen },
  'trip/done': { view: Done },
};
