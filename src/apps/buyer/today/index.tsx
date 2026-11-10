/*
 * The Today tab (board docs/canvas/buyer/Today.dc.html). One screen, `today`; its sheet
 * (Ask, for a supplier with no WhatsApp) is AskSheet.tsx. It opens the other tabs by id:
 * orders { filter }, replies, replies/price { supplier }, trip.
 */
import type { ScreenDef } from '../shell/nav.ts';
import { Today } from './Today.tsx';

export const screens: Record<string, ScreenDef> = { today: { view: Today } };
