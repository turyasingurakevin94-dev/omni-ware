/*
 * Bars that carry a picture (LANGUAGE.md §4.3): a split bar (one segment per
 * part, its width the part's share) and a meter (a fill on a track).
 *
 *   <SplitBar label="165,000 to collect, 125,000 being checked" h={10}
 *     parts={[{ value: 165000, color: '#F5B26B' }, { value: 125000, color: 'hatch' }]} />   S06, P03 owed bar, P03b stages
 *   <Meter pct={50} fill="#1A5A8A" />                     P13's "7/14", S04's load bar, P22's way back to Today
 */
import type { JSX } from 'preact';
import './bar.css';

export interface BarPart {
  value: number;
  /** A colour, or 'hatch' for "being checked" (S06). */
  color: string;
  /** The least width a part keeps, px (the owed bar: 6). */
  min?: number;
}

export function SplitBar(p: { parts: BarPart[]; label?: string; h?: number; gap?: number }): JSX.Element {
  return (
    <span role={p.label ? 'img' : undefined} aria-label={p.label} aria-hidden={p.label ? undefined : 'true'} class="ow-split"
      style={{ height: `${p.h || 8}px`, gap: `${p.gap ?? 3}px` }}>
      {p.parts.filter((x) => x.value > 0).map((x, i) => (
        <span key={i} style={{ flex: x.value, minWidth: x.min ? `${x.min}px` : undefined, background: x.color === 'hatch' ? 'var(--hatch)' : x.color }} />
      ))}
    </span>
  );
}

export interface MeterProps {
  /** 0 to 100. */
  pct: number;
  /** The track's width, px; it stretches when not given. */
  w?: number;
  h?: number;
  track?: string;
  fill?: string;
  class?: string;
}

export function Meter(p: MeterProps): JSX.Element {
  return (
    <span aria-hidden="true" class={'ow-meter' + (p.class ? ' ' + p.class : '')}
      style={{ width: p.w ? `${p.w}px` : undefined, flex: p.w ? 'none' : 1, height: `${p.h || 4}px`, background: p.track || '#F1EEE8' }}>
      <span style={{ width: `${Math.max(0, Math.min(100, p.pct))}%`, background: p.fill || '#0F6B43' }} />
    </span>
  );
}
