/*
 * The shelf area's screens (docs/spec/04-screens-store-routes.md §2): shelf (tab), shelf/aisle, shelf/find, shelf/scan, shelf/item, shelf/count, shelf/report, shelf/ask.
 * Until an id is given here the shell draws its placeholder (shell/Placeholder.tsx).
 * A stage sheet's screen is drawn inside shell/StageSheet.tsx. See src/apps/store/README.md.
 */
import type { ScreenDef } from '../shell/nav.ts';

export const screens: Record<string, ScreenDef> = {};
