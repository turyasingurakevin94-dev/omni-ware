/*
 * The in area's screens (docs/spec/04-screens-store-routes.md §2): in (stage sheet), in/checkin, in/delivery, in/return, in/ride.
 * Until an id is given here the shell draws its placeholder (shell/Placeholder.tsx).
 * A stage sheet's screen is drawn inside shell/StageSheet.tsx. See src/apps/store/README.md.
 */
import type { ScreenDef } from '../shell/nav.ts';

export const screens: Record<string, ScreenDef> = {};
