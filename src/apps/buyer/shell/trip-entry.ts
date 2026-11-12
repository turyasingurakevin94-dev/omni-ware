/*
 * The red +: it opens the trip. Its count is the stops on the plan (core/buyer/rules.ts planStops, the one
 * definition the Plan's head and Today's trip card read too: a held line is not a stop); on the road, the
 * stops still to do. None when there is nothing to buy.
 */
import { computed } from '@preact/signals';
import { planStops } from '../../../core/buyer/rules.ts';
import { books } from './store.ts';

export const tripBadge = computed(() => {
  const b = books.value;
  return b ? planStops(b).length : 0;
});
