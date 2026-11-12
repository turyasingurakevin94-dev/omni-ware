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
import { notDoneOf, TELL, type NotDone } from '../notdone.ts';

export { notDoneLine, TELL, type NotDone, type NotDoneTone } from '../notdone.ts';
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

/** What went wrong with a write (or 'snapshot', the read), in the yard's words. `write` is the StoreSource method's name. */
export function notDone(e: unknown, write: string): NotDone {
  const prefix = WRITE_CODE[write] || 'ST';
  // A read, not a write (TD07, PRIV-03): "Could not load the yard", never filled from direct reads.
  const failed = write === 'snapshot' ? 'Could not load the yard' : `That did not save · tell ${TELL}`;
  return notDoneOf(e, prefix, failed, { OWCSH: 'Not paid yet · it leaves when paid' });
}
