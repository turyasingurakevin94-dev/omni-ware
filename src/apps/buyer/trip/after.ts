/*
 * What the trip remembers between its faces: the stop just done (its Undo
 * runs 5 s, TripOn Success), and the one hand-in (TripOn phone 4 and
 * TripHandIn phone 1 slide the same "Hand in").
 */
import { signal } from '@preact/signals';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { act } from '../shell/store.ts';

/** The stop just done, for its Undo (5 s). While it shows, the last stop stays on On the trip (phone 4). */
export const justDone = signal<{ sid: string; at: number } | null>(null);
export const UNDO_S = 5;

/** Hand in: the goods to the Store, the cash back to Accounts; then Handed in (or saved on this phone). */
export async function handInNow(onFail?: () => void): Promise<void> {
  try {
    const r = await act('handIn');
    justDone.value = null;
    nav.replace('trip/done', { kept: r.kept });
  } catch (e) {
    if (onFail) onFail();
    toast.show('Not handed in', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void handInNow(onFail); } });
  }
}
