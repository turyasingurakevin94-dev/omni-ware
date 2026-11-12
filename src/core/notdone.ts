/*
 * What went wrong with a write or a read, in plain words (the Store's rules, REL-07, REL-09;
 * shared by every role app that has the three bars). No SQL, function or migration name on
 * screen; a sentence the database says on purpose shows as it is.
 *
 *   offline  "No signal" · the work kept on this phone
 *   failed   "That did not save · tell Kevin · code CI-502"
 *   someone  "Someone else just did this · Refreshed"
 *   refused  a refusal the person can act on, said in place
 */
import { isDataError } from './datasource.ts';

export type NotDoneTone = 'offline' | 'failed' | 'someone' | 'refused';
export interface NotDone { tone: NotDoneTone; text: string; code: string }

/** Who the red bar says to tell (Store screens Q14: "tell Kevin", as drawn). */
export const TELL = 'Kevin';

/** A sentence the database says on purpose (P0001 raise, 22023 bad value, P0002 not found): shown as it is. */
const ON_PURPOSE = new Set(['P0001', '22023', 'P0002']);

/**
 * The words for an error. `prefix` is the write's code letters ("CI"); `failed` the red bar's words;
 * `refusals` the codes the app words itself ({ OWCSH: 'Not paid yet · it leaves when paid' }).
 */
export function notDoneOf(e: unknown, prefix: string, failed: string, refusals: Record<string, string> = {}): NotDone {
  if (!isDataError(e)) return { tone: 'failed', text: failed, code: `${prefix}-E` };
  const code = e.code || '';
  const full = /^[A-Z]{2}-\w+$/.test(code) ? code : `${prefix}-${code || 'E'}`;
  switch (e.kind) {
    case 'offline': return { tone: 'offline', text: 'No signal', code: '' };
    case 'clash': return { tone: 'someone', text: 'Someone else just did this · Refreshed', code: '' };
    case 'signed-out': return { tone: 'refused', text: 'Sign in again', code: '' };
    case 'missing': return { tone: 'failed', text: failed, code: full };
    default:
      if (refusals[code]) return { tone: 'refused', text: refusals[code], code: '' };
      if (code === '42501') return { tone: 'refused', text: 'Your login cannot do this one', code: '' };
      if (ON_PURPOSE.has(code) && e.message) return { tone: 'refused', text: e.message, code: '' };
      return { tone: 'failed', text: failed, code: full };
  }
}

/** The red bar's one line: "That did not save · tell Kevin · code CI-502". */
export function notDoneLine(n: NotDone): string {
  return n.code ? `${n.text} · code ${n.code}` : n.text;
}
