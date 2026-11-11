/*
 * The red +: the trip. One screen id, three faces by where the trip stands
 * (model.viewOf): Plan (no trip on, or the cash ask waiting on Accounts),
 * On the trip (cash in hand, stops to do), Hand in (every stop done). The
 * last stop stays on On the trip while its Undo runs (TripOn phone 4), then
 * Hand in comes up. Stops done with no signal read as done (model.tripBooks).
 */
import type { JSX } from 'preact';
import { books, kept } from '../shell/store.ts';
import { justDone } from './after.ts';
import { HandIn } from './HandIn.tsx';
import { tripBooks, viewOf } from './model.ts';
import { On } from './On.tsx';
import { Plan } from './Plan.tsx';

export function Trip(): JSX.Element {
  const raw = books.value;
  if (!raw) return <main class="ow-b-trip" aria-busy="true" />;
  const b = tripBooks(raw, kept.value), v = viewOf(b);
  if (v === 'plan') return <Plan b={raw} />;
  return v === 'on' || justDone.value ? <On b={b} /> : <HandIn b={b} />;
}
