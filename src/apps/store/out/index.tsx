/*
 * The out area's screens (docs/spec/04-screens-store-routes.md §2): out/load (stage sheet), out/run, out/gate, out/gate-code, out/road (stage sheet), out/door, out/cant-deliver.
 * Until an id is given here the shell draws its placeholder (shell/Placeholder.tsx).
 * A stage sheet's screen is drawn inside shell/StageSheet.tsx. See src/apps/store/README.md.
 */
import type { ScreenDef } from '../shell/nav.ts';

export const screens: Record<string, ScreenDef> = {};
