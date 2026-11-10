/*
 * CU03 · who is due, the week ahead, on src/ui WeekStrip (P03c): the customers the list below
 * names keep their tint; the ones it does not name are soft dots (GHOST).
 */
import type { JSX } from 'preact';
import { WeekStrip } from '../../../ui/PageHead.tsx';
import { TINTS } from '../../../core/names.ts';
import { weekday } from '../../../core/time.ts';
import type { Day } from '../../../core/types.ts';
import { GHOST } from './list-bodies.tsx';
import type { ListData } from './list-data.ts';

export function WeekHead(p: { d: ListData; today: Day; day: Day | null; onDay: (d: Day) => void }): JSX.Element {
  const late = p.d.due.filter((w) => w.r.tone === 'late'), now = p.d.due.filter((w) => w.r.tone === 'due');
  let g = 0;
  const days = [
    { key: 'late', name: 'Late', count: late.length, dots: late.map((w) => TINTS[w.c.tint].bg), kind: 'late' as const },
    { key: 'today', name: 'Today', count: now.length, dots: now.map((w) => TINTS[w.c.tint].bg), kind: 'today' as const },
    ...p.d.week.map(([d, l]) => ({ key: d, name: weekday(d), count: l.length, dots: l.map(() => GHOST[g++ % 3]), kind: undefined })),
  ].map((c) => ({ ...c, selected: p.day === c.key, on: () => (c.kind ? p.onDay('') : p.onDay(c.key)) }));
  return <WeekStrip title="Who's due, the week ahead" hint="tap a day" days={days} />;
}
