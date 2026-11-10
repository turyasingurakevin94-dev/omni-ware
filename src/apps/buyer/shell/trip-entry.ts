/*
 * The red +: it opens the trip. Its count is the stops the trip has to make
 * (planned, or still to do on the road); none when there is nothing to buy.
 */
import { computed } from '@preact/signals';
import { tripPlan } from '../../../core/buyer/rules.ts';
import { books } from './store.ts';

export const tripBadge = computed(() => {
  const b = books.value;
  if (!b) return 0;
  if (b.trip && (b.trip.state === 'cash' || b.trip.state === 'on')) return b.trip.stops.filter((s) => !s.off && !s.done).length;
  return tripPlan(b).stops.length;
});
