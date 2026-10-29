/*
 * The demo's switches, read from the page's address (src/core/demo/README.md):
 *
 *   ?demo                    the sample shop at Sat 17 Oct 2026 10:41 (the default demo)
 *   &offline=1               no signal: reads come from the copy, writes are kept on this phone
 *   &clock=15:40             another time of day (TD07's calm afternoon); the day stays
 *   &state=first-day         a new salesperson's first day (TD06)
 *   &state=empty             nothing live, nobody owes, no chats (CH06, OR04, CU06)
 *   &state=signed-elsewhere  someone else signed in under this screen (TD10)
 *   &state=loading           the books never arrive (CH07, CU08 skeletons)
 *
 * Only what taps cannot cause is a flag. Everything else is reached by tapping.
 */
export type DemoStateName = 'first-day' | 'empty' | 'signed-elsewhere' | 'loading';

export interface DemoFlags {
  on: boolean;
  offline: boolean;
  /** "15:40", or null for 10:41. */
  clock: string | null;
  state: DemoStateName | null;
}

const STATES: DemoStateName[] = ['first-day', 'empty', 'signed-elsewhere', 'loading'];

/** Reads ?demo&offline=1&clock=15:40&state=… from a query string. */
export function readFlags(search: string): DemoFlags {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const clock = q.get('clock');
  const state = q.get('state') as DemoStateName | null;
  return {
    on: q.has('demo'),
    offline: q.get('offline') === '1',
    clock: clock && /^\d{1,2}:\d{2}$/.test(clock) ? clock : null,
    state: state && STATES.includes(state) ? state : null,
  };
}
