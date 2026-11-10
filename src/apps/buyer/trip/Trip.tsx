/*
 * The red +: the trip. One screen id, three faces by where the trip stands
 * (model.viewOf): Plan (no trip on, or the cash ask waiting on Accounts),
 * On the trip (cash in hand, stops to do), Hand in (every stop done).
 */
import type { JSX } from 'preact';
import { books } from '../shell/store.ts';
import { HandIn } from './HandIn.tsx';
import { viewOf } from './model.ts';
import { On } from './On.tsx';
import { Plan } from './Plan.tsx';

export function Trip(): JSX.Element {
  const b = books.value;
  if (!b) return <main class="ow-b-trip" aria-busy="true" />;
  const v = viewOf(b);
  return v === 'plan' ? <Plan b={b} /> : v === 'on' ? <On b={b} /> : <HandIn b={b} />;
}
