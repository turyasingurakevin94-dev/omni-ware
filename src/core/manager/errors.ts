/*
 * The Manager's error words (docs/spec/04-screens-manager-data.md §4b), on the shared rule
 * (src/core/notdone.ts): the three bars, and the refusals the screens say in place.
 * "Someone else just did this" for every answer someone else gave first (§4a).
 */
import { notDoneOf, TELL, type NotDone } from '../notdone.ts';

export { notDoneLine, type NotDone } from '../notdone.ts';

/** The refusals the app words itself, by code. */
const REFUSALS: Record<string, string> = {
  OWCST: 'Never under cost',
  OWVMN: 'Money was paid · pick refund or deposit',
  OWSTG: 'Someone else just did this',
  OWRST: 'Someone else just did this',
  OWWLK: 'A walk-in can\'t owe · take the money first',
  OWCRN: 'More than the bill',
  OWLOT: 'The shelf and its lots differ · tell ' + TELL,
};

/** What went wrong with a write (or 'snapshot', the read), in the Manager's words. */
export function notDone(e: unknown, write: string): NotDone {
  const failed = write === 'snapshot' ? 'Could not load the shop' : `Not sent · tell ${TELL}`;
  return notDoneOf(e, 'MG', failed, REFUSALS);
}
