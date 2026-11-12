/*
 * The shell's own screens: sign-in, could not reach the shop, You (AD01, AD02 on the canvas's
 * "Added while building" board). Until those boards are drawn and reviewed, their ids draw
 * the placeholder (spec 04-screens-manager §5: never a screen improvised in code).
 */
import type { ScreenDef } from '../../../ui/stack.ts';

export const shellScreens: Record<string, ScreenDef> = {};
