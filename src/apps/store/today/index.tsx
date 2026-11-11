/*
 * The Today area's screens (routes §2 "Today"): today, today/alerts, today/with-ruth,
 * today/you, today/pass-yard, today/close-yard. Each id not given here is the shell's
 * placeholder (shell/Placeholder.tsx) until it is built. The shell's boot screens
 * (shell/checking, shell/no-reach) are drawn by this area too.
 */
import type { ScreenDef } from '../shell/nav.ts';
import { Today } from './Today.tsx';

export const screens: Record<string, ScreenDef> = {
  today: { view: () => <Today /> },
};
