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
 *   &state=busy              an afternoon with 38 live and 22 needing Grace (TD02)
 *   &state=goal-hit          Thu 29 Oct, the month's goal passed (TD08)
 *   &state=test-record       a TEST order of Grace's at 10:30, in no figure (TD25)
 *   &as=ruth                 someone else of the team is signed in (CH32: Ruth, the Manager, moves a chat)
 *   &wa=off                  the shop's WhatsApp is not connected: nothing reaches a customer (CU43: the receipt waits)
 *   &fail=sale               the next counter sale is lost on its way, as when the signal drops mid-send (KC19)
 *   &fail=pay                the next payment is kept (no signal); meanwhile Brian takes 120,000 of Kato's at 10:50, so when it
 *                            goes again the shop refuses it as more than they owe (CU46)
 *   &listen=1                the phone can listen: "Say it" hears HEARD until Stop (CH16; no tap can cause speech)
 *
 * Only what taps cannot cause is a flag. Everything else is reached by tapping.
 */
export type DemoStateName = 'first-day' | 'empty' | 'signed-elsewhere' | 'loading' | 'busy' | 'goal-hit' | 'test-record';

export interface DemoFlags {
  on: boolean;
  offline: boolean;
  /** "15:40", or null for 10:41. */
  clock: string | null;
  state: DemoStateName | null;
  /** The first name of the team member signed in instead of Grace ("ruth"), or null. */
  as: string | null;
  /** &wa=off: the shop's WhatsApp number is not connected (ChatBooks.connected false). */
  waOff: boolean;
  /** 'sale': the next counter sale does not reach the server (KC19). 'pay': the next payment is kept, then refused (CU46). */
  fail: 'sale' | 'pay' | null;
  /** The phone listens (CH16): "Say it" hears HEARD and keeps listening until Stop. */
  listen: boolean;
}

/** What the demo's phone hears when it listens (&listen=1): Grace's answer to Kato's 10:29 (CH16). */
export const HEARD = 'Yes, it can come to the Ntinda site';

const STATES: DemoStateName[] = ['first-day', 'empty', 'signed-elsewhere', 'loading', 'busy', 'goal-hit', 'test-record'];

/** Reads ?demo&offline=1&clock=15:40&state=… from a query string. */
export function readFlags(search: string): DemoFlags {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const clock = q.get('clock');
  const state = q.get('state') as DemoStateName | null;
  const as = (q.get('as') || '').trim().toLowerCase();
  return {
    on: q.has('demo'),
    offline: q.get('offline') === '1',
    clock: clock && /^\d{1,2}:\d{2}$/.test(clock) ? clock : null,
    state: state && STATES.includes(state) ? state : null,
    as: /^[a-z]+$/.test(as) ? as : null,
    waOff: q.get('wa') === 'off',
    fail: q.get('fail') === 'sale' ? 'sale' : q.get('fail') === 'pay' ? 'pay' : null,
    listen: q.get('listen') === '1',
  };
}
