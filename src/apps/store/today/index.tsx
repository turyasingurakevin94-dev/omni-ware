/*
 * The Today area's screens (routes §2 "Today" and "Shell"): today, today/alerts, today/with-ruth,
 * today/you, today/pass-yard, today/close-yard, and the boot screens shell/sign-in, shell/checking,
 * shell/no-reach. Each draws its Not done bar itself (bars: false): Today at the top of its page,
 * the slides over their dock.
 */
import type { ScreenDef } from '../shell/nav.ts';
import { Alerts } from './Alerts.tsx';
import { Checking, NoReach } from './Boot.tsx';
import { CloseYard } from './CloseYard.tsx';
import { PassYard } from './PassYard.tsx';
import { SignIn } from './SignIn.tsx';
import { Today } from './Today.tsx';
import { WithRuth } from './WithRuth.tsx';
import { You } from './You.tsx';

export const screens: Record<string, ScreenDef> = {
  today: { view: () => <Today />, bars: false },
  'today/alerts': { view: () => <Alerts /> },
  'today/with-ruth': { view: () => <WithRuth /> },
  'today/you': { view: () => <You /> },
  'today/pass-yard': { view: ({ params }) => <PassYard to={params.to ? String(params.to) : null} />, bars: false },
  'today/close-yard': { view: () => <CloseYard />, bars: false },
  'shell/sign-in': { view: () => <SignIn /> },
  'shell/checking': { view: () => <Checking /> },
  'shell/no-reach': { view: () => <NoReach /> },
};
