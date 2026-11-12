/*
 * Plain error words for the yard (docs/spec/04-screens-store.md §4.8, REL-07, REL-09;
 * store.html:1003–1015 failWord, 2294 failSay). No SQL, function or migration name on
 * screen; a sentence the database says on purpose shows as it is.
 *
 * The three bars the shell draws (BRIEF "No signal"):
 *   amber  'offline'  "No signal" · the work kept on this phone · white Try again
 *   red    'failed'   "That did not save · tell Kevin · code CI-502" · navy Try again
 *   blue   'someone'  "Someone else just did this · Refreshed"
 * A refusal the person can act on ("Not paid yet", "Your login cannot do this one")
 * is 'refused': said in place, no bar.
 */
import { isDataError } from '../datasource.ts';

export type NotDoneTone = 'offline' | 'failed' | 'someone' | 'refused';
export interface NotDone { tone: NotDoneTone; text: string; code: string }

/** Who the red bar says to tell (screens Q14: "tell Kevin", as drawn). */
export const TELL = 'Kevin';

/**
 * Each write's code letters, so "code CI-502" says where it failed (the boards' sample codes:
 * ST-301, CI-502, RT-417, TR-233, SC-502, SR-502, LD-412). Keys are StoreSource write names.
 */
export const WRITE_CODE: Record<string, string> = {
  claim: 'PK', pick: 'PK', finishPack: 'PK', setBay: 'PK', unpack: 'PK', release: 'PK', putBack: 'PK',
  load: 'LD', handOver: 'GT', deliver: 'DR', cantDeliver: 'DR', askLetGo: 'LD', withdrawLetGo: 'LD', nameDirection: 'LD', lockRoute: 'LD',
  checkIn: 'CI', notOnList: 'CI', returnAsk: 'RT', withdrawReturn: 'RT', rideTick: 'TR', rideHandIn: 'TR',
  restock: 'SR', reportLoss: 'SR', sendCount: 'SC', replaceCount: 'SC',
  passYard: 'ST', gotYard: 'ST', closeYard: 'ST', setMyName: 'ST', pushOn: 'ST',
};

/** A sentence the database says on purpose (P0001 raise, 22023 bad value, P0002 not found): shown as it is. */
const ON_PURPOSE = new Set(['P0001', '22023', 'P0002']);

/** What went wrong with a write (or 'snapshot', the read), in the yard's words. `write` is the StoreSource method's name. */
export function notDone(e: unknown, write: string): NotDone {
  const prefix = WRITE_CODE[write] || 'ST';
  // A read, not a write (TD07, PRIV-03): "Could not load the yard", never filled from direct reads.
  const failed = write === 'snapshot' ? 'Could not load the yard' : `That did not save · tell ${TELL}`;
  if (!isDataError(e)) return { tone: 'failed', text: failed, code: `${prefix}-E` };
  const code = e.code || '';
  // A demo &fail=… code is a whole board code already ("CI-502").
  const full = /^[A-Z]{2}-\w+$/.test(code) ? code : `${prefix}-${code || 'E'}`;
  switch (e.kind) {
    case 'offline': return { tone: 'offline', text: 'No signal', code: '' };
    case 'clash': return { tone: 'someone', text: 'Someone else just did this · Refreshed', code: '' };
    case 'signed-out': return { tone: 'refused', text: 'Sign in again', code: '' };
    case 'missing': return { tone: 'failed', text: failed, code: full };
    default:
      if (code === 'OWCSH') return { tone: 'refused', text: 'Not paid yet · it leaves when paid', code: '' };
      if (code === '42501') return { tone: 'refused', text: 'Your login cannot do this one', code: '' };
      if (ON_PURPOSE.has(code) && e.message) return { tone: 'refused', text: e.message, code: '' };
      return { tone: 'failed', text: failed, code: full };
  }
}

/** The red bar's one line: "That did not save · tell Kevin · code CI-502". */
export function notDoneLine(n: NotDone): string {
  return n.code ? `${n.text} · code ${n.code}` : n.text;
}
