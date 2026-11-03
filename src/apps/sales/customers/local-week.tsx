/*
 * LOCAL PART (for the lead: a prop on src/ui WeekStrip): P03c as CU03 draws
 * it. The faces are colours, not tints: the customers named in the list
 * below keep their tint; the ones it does not name are soft dots (GHOST).
 */
import type { JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import { TINTS } from '../../../core/names.ts';
import { weekday } from '../../../core/time.ts';
import type { Day } from '../../../core/types.ts';
import { GHOST } from './list-bodies.tsx';
import type { ListData } from './list-data.ts';

interface Col { key: Day | 'late' | 'today'; name: string; count: number; dots: string[]; kind?: 'late' | 'today' }

export function WeekHead(p: { d: ListData; today: Day; day: Day | null; onDay: (d: Day) => void }): JSX.Element {
  const late = p.d.due.filter((w) => w.r.tone === 'late'), now = p.d.due.filter((w) => w.r.tone === 'due');
  let g = 0;
  const cols: Col[] = [
    { key: 'late', name: 'Late', count: late.length, dots: late.map((w) => TINTS[w.c.tint].bg), kind: 'late' },
    { key: 'today', name: 'Today', count: now.length, dots: now.map((w) => TINTS[w.c.tint].bg), kind: 'today' },
    ...p.d.week.map(([d, l]) => ({ key: d, name: weekday(d), count: l.length, dots: l.map(() => GHOST[g++ % 3]) })),
  ];
  return (
    <div class="ow-week">
      <span class="ow-week-h"><span><Icon name="calendar" size={14} stroke={2} />Who's due, the week ahead</span><span class="ow-week-hint">tap a day</span></span>
      <div class="ow-week-days">
        {cols.map((c) => {
          const sel = p.day === c.key;
          return (
            <button key={c.key} type="button" class={cx('ow-week-d', c.kind, sel && 'sel')} aria-pressed={sel} aria-label={`${c.name}: ${c.count ? c.count + ' due' : 'none due'}`}
              onClick={() => (c.kind ? p.onDay('') : p.onDay(c.key))}>
              <span class="ow-week-box">
                <span class={cx('mono', !c.count && 'none')}>{c.count || '·'}</span>
                <span class="ow-week-faces">{c.dots.slice(0, 3).map((bg, i) => <span key={i} style={{ background: bg }} />)}</span>
              </span>
              <span class="ow-week-n">{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
