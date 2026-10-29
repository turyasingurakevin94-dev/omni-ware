/*
 * The demo's one "now": Sat 17 Oct 2026, 10:41, Kampala (FACTS §1).
 * `&clock=15:40` moves the time of day (TD07's calm what-if); the day stays.
 */
import { at } from '../../time.ts';
import type { Day, Ms } from '../../types.ts';

export const TODAY: Day = '2026-10-17';
export const NOW: Ms = at(TODAY, '10:41');
/** The last sync the offline state shows: "Updating · saved 7:52" (FACTS §1). */
export const SAVED_AT: Ms = at(TODAY, '7:52');

/** A moment today: t('9:14'). */
export function t(hm: string): Ms {
  return at(TODAY, hm);
}

/** A moment on another day: d('2026-10-16', '12:20'). */
export function d(day: Day, hm: string = '12:00'): Ms {
  return at(day, hm);
}
