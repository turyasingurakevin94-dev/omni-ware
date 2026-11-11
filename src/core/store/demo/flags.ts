/*
 * The Store demo's switches, read from the page's address. Only what taps cannot cause
 * is a flag (as the Sales demo, src/core/demo/flags.ts); everything else is reached by
 * tapping from Today.
 *
 *   ?demo                   Sat 17 Oct 2026 10:41, FACTS.md as it stands
 *   &at=1047 (or 10:47)     a later moment (FACTS §8); the latest named moment at or before it applies:
 *                             1047  #0555 paid (Grace 10:45), at the gate (OU10, OU12)
 *                             1130  Denis's trip back at the yard, 3 lines; #0555 collected (TD02, IN02–IN09)
 *                             1200  Hima Cement at the gate, 100 bag; Denis's trip checked in 11:34 (IN10–IN15)
 *                             1315  #0552 paid (Grace 13:12), Ssali back: load the run (OU02–OU07, OU17)
 *                             1405  #0552 at the Ntinda site with Ssali (OU21–OU28)
 *                             1510  Denis sends Musa to Katwe Timber, Hassan drives (TD03, IN30–IN35)
 *                             1730  the yard is clear; Close the yard (TD04, TD16–TD19, TD27, TD28)
 *   &state=cancel-0530      #0530 cancelled on bay 2 (PK10)
 *   &state=cancel-0534      #0534 cancelled on Ssali's truck (OU27)
 *   &state=ggaba-closed     #0547 coming back · Ggaba closed (after OU24)
 *   &state=agent            #0554 Peter Sserwadda's pickup, ready at the gate, code 0554 (OU11, OU09)
 *   &state=empty            nothing in the yard (PK14, IN40, OU14, OU15, OU30, TD29, TD30)
 *   &state=first-day        Joy's first day (TD05)
 *   &state=nobody           nobody else with a yard login is on (TD24)
 *   &state=signed-out       the sign-in (TD20, TD23, TD31)
 *   &state=loading          the shop never answers: "Checking your shop…" (TD21)
 *   &state=no-reach         no signal and no copy on the phone (TD22)
 *   &as=okello              Okello's phone: Musa passed him the yard 10:42 (TD15, TD25, TD32)
 *   &offline (or =1)        no signal: reads give the copy saved 7:52, writes are kept (amber bar)
 *   &fail=<write>           that write (a StoreSource method: checkIn, load, sendCount …, or snapshot)
 *                           fails once with its board code (red bar); Try again then goes
 *   &push=<kind>[:<order id>]  a push tapped as the app opens (routes §5, shell/pushes.ts): &push=job.given opens To load
 *   &update=1               a new build is ready (TD08)
 *   &big=1                  Big text on (You, TD12)
 */
export type StoreDemoState = 'cancel-0530' | 'cancel-0534' | 'ggaba-closed' | 'agent' | 'empty' | 'first-day' | 'nobody' | 'signed-out' | 'loading' | 'no-reach';

export const STATES: StoreDemoState[] = ['cancel-0530', 'cancel-0534', 'ggaba-closed', 'agent', 'empty', 'first-day', 'nobody', 'signed-out', 'loading', 'no-reach'];
/** The named moments, HHMM. */
export const MOMENTS = [1041, 1047, 1052, 1130, 1200, 1315, 1405, 1510, 1730];

export interface StoreDemoFlags {
  on: boolean;
  /** The clock, HHMM (1041 by default). */
  at: number;
  state: StoreDemoState | null;
  as: 'okello' | null;
  offline: boolean;
  /** A StoreSource write's name, or 'snapshot'. */
  fail: string | null;
  update: boolean;
  big: boolean;
}

const on = (q: URLSearchParams, k: string): boolean => q.has(k) && q.get(k) !== '0';

export function readStoreFlags(search: string): StoreDemoFlags {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = (q.get('at') || '').replace(':', '');
  const at = /^\d{3,4}$/.test(raw) && Number(raw) % 100 < 60 && Number(raw) < 2400 ? Number(raw) : 1041;
  const state = q.get('state') as StoreDemoState | null;
  const fail = (q.get('fail') || '').trim();
  return {
    on: q.has('demo'),
    at,
    state: state && STATES.includes(state) ? state : null,
    as: (q.get('as') || '').toLowerCase() === 'okello' ? 'okello' : null,
    offline: on(q, 'offline'),
    fail: /^[a-zA-Z]+$/.test(fail) ? fail : null,
    update: on(q, 'update'),
    big: on(q, 'big'),
  };
}

/** "10:47" from 1047. */
export const hhmm = (n: number): string => `${Math.floor(n / 100)}:${String(n % 100).padStart(2, '0')}`;

/** The board codes the red bar shows for a failed write (the boards' samples; the rest are <area>-502). */
export const FAIL_CODE: Record<string, string> = {
  snapshot: 'ST-104', checkIn: 'CI-502', returnAsk: 'RT-417', rideHandIn: 'TR-233', sendCount: 'SC-502', replaceCount: 'SC-502', reportLoss: 'SR-502', load: 'LD-412',
};
