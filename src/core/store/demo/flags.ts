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
 *   &state=empty            nothing to pack or packing: #0556, #0557 and #0530 gone, #0552 packed on bay 1; the trip,
 *                           #0555 at the gate, the road and Waiting on goods stay (PK14)
 *   &state=yard-empty       nothing in the yard at all (OU14, OU15, TD29, TD30)
 *   &state=for-you          Ruth gave #0556 to Musa at 10:40 (PK08)
 *   &state=okello-0556      Okello takes #0556 at 10:43 the moment Musa first packs it: the claim clashes (PK13, PK17)
 *   &state=first-day        Joy's first day (TD05)
 *   &state=nobody           nobody else with a yard login is on (TD24)
 *   &state=someone-checkin  Okello checks Denis's trip in at 11:32 while this phone counts it (IN09)
 *   &state=extra-answered   Ruth answered the binding wire not on the list: keep it, 11:48 (IN13)
 *   &state=return-decided   this phone sent #0548's return 11:03; Ruth took it back 11:20 (IN22)
 *   &state=signed-out       the sign-in (TD20, TD23, TD31)
 *   &state=loading          the shop never answers: "Checking your shop…" (TD21)
 *   &state=no-reach         no signal and no copy on the phone (TD22)
 *   &at=921                 before Musa's spot count of Wire nails 4" was sent (SH10–SH12, SH17–SH19; demo/shelf.ts)
 *   &state=recount · count-accepted · okello-counts · written-off · kept-on-shelf · restock-listed · shelf-calm
 *                           the shelf's what-ifs after 10:41 (SH13, SH16, SH25, SH22, SH24, SH32, SH06; demo/shelf.ts)
 *   &as=okello              Okello's phone: Musa passed him the yard 10:42 (TD15, TD25, TD32)
 *   &offline (or =1)        no signal: reads give the copy saved 7:52, writes are kept (amber bar);
 *                           the browser's 'online' event brings the signal back (the e2e's setOffline)
 *   &fail=<write>           that write (a StoreSource method: checkIn, load, sendCount …, or snapshot)
 *                           fails once with its board code (red bar); Try again then goes
 *   &push=<kind>[:<order id>]  a push tapped as the app opens (routes §5, shell/pushes.ts): &push=job.given opens To load
 *   &kept=1                 two writes already kept on this phone, with &offline (TD06's Waiting to send:
 *                           #0552's 40 pc packed 10:30, the bent sheets' report 10:24)
 *   &slow=1                 every write waits 60 s, so a board's "Sending…" can be seen (IN05, IN14, IN16, IN23, IN34)
 *   &update=1               a new build is ready (TD08)
 *   &big=1                  Big text on (You, TD12)
 */
export type StoreDemoState = 'cancel-0530' | 'cancel-0534' | 'ggaba-closed' | 'agent' | 'empty' | 'yard-empty' | 'first-day' | 'nobody' | 'signed-out' | 'loading' | 'no-reach'
  | 'for-you' | 'okello-0556' | ShelfState | 'someone-checkin' | 'extra-answered' | 'return-decided';
/** The shelf's what-ifs (demo/shelf.ts; SH13, SH16, SH25, SH22, SH24, SH32, SH06). */
export type ShelfState = 'recount' | 'count-accepted' | 'okello-counts' | 'written-off' | 'kept-on-shelf' | 'restock-listed' | 'shelf-calm';

export const STATES: StoreDemoState[] = ['cancel-0530', 'cancel-0534', 'ggaba-closed', 'agent', 'empty', 'yard-empty', 'first-day', 'nobody', 'signed-out', 'loading', 'no-reach', 'for-you', 'okello-0556',
  'recount', 'count-accepted', 'okello-counts', 'written-off', 'kept-on-shelf', 'restock-listed', 'shelf-calm',
  'someone-checkin', 'extra-answered', 'return-decided'];
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
  /** Seed the outbox with TD06's two kept writes. */
  kept: boolean;
  /** Writes wait 60 s (the Sending… boards). */
  slow: boolean;
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
    kept: on(q, 'kept'),
    slow: on(q, 'slow'),
  };
}

/** "10:47" from 1047. */
export const hhmm = (n: number): string => `${Math.floor(n / 100)}:${String(n % 100).padStart(2, '0')}`;

/** The board codes the red bar shows for a failed write (the boards' samples; the rest are <area>-502). */
export const FAIL_CODE: Record<string, string> = {
  snapshot: 'ST-104', passYard: 'ST-301', checkIn: 'CI-502', returnAsk: 'RT-417', rideHandIn: 'TR-233', sendCount: 'SC-502', replaceCount: 'SC-502', reportLoss: 'SR-502', load: 'LD-412',
};
