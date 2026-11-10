/*
 * P02b · The goal ring (LANGUAGE.md §3 P02b): the goal at a glance where the
 * goal is the subject (Goal, Your day, Goal hit). On navy: the done arc
 * white with round caps, what is on the move after it in mint at 40%, a
 * faint inner disc, the % in mono.
 *
 *   <GoalRing pct={36} movePct={9} label="Goal: 36 percent, 14 days left" on={…} />
 *   <GoalRing pct={100} hit size={200} />            Goal hit: a full mint ring and the trophy
 */
import type { JSX } from 'preact';
import { Icon } from './icons.tsx';
import { Tap } from './util.tsx';
import './goalring.css';

export interface GoalRingProps {
  pct: number;
  /** On the move, as % of the goal (the mint arc after the white one). */
  movePct?: number;
  hit?: boolean;
  /** 120 by default; everything scales (the Goal sheet's dial is 200). */
  size?: number;
  /** "of goal" under the figure. */
  caption?: string;
  label?: string;
  on?: () => void;
}

export function GoalRing(p: GoalRingProps): JSX.Element {
  const C = 314.2, done = (C * Math.min(100, p.pct)) / 100, move = (C * Math.max(0, Math.min(100 - p.pct, p.movePct || 0))) / 100;
  const k = (p.size || 120) / 120;
  const ring = (
    <>
      <svg width={120 * k} height={120 * k} viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10" />
        {p.hit ? <circle cx="60" cy="60" r="50" fill="none" stroke="#6FDCB0" stroke-width="10" />
          : <>
            {move > 0 && <circle cx="60" cy="60" r="50" fill="none" stroke="#6FDCB0" stroke-opacity=".4" stroke-width="10" stroke-dasharray={`${move.toFixed(1)} ${C}`} stroke-dashoffset={(-done).toFixed(1)} transform="rotate(-90 60 60)" />}
            {done > 0 && <circle cx="60" cy="60" r="50" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-dasharray={`${done.toFixed(1)} ${C}`} transform="rotate(-90 60 60)" />}
          </>}
        {!p.hit && <circle cx="60" cy="60" r="38" fill="rgba(255,255,255,.04)" />}
      </svg>
      {p.hit ? (
        <span class="ow-gring-in hit">
          <span class="ow-gring-cup" style={{ width: `${64 * k}px`, height: `${64 * k}px` }}><Icon name="trophy" size={26 * k} stroke={1.9} /></span>
          <span class="ow-gring-cap">Goal hit</span>
        </span>
      ) : (
        <span class="ow-gring-in">
          <span class="mono" style={{ fontSize: `${Math.round(26 * Math.sqrt(k))}px` }}>{`${Math.round(p.pct)}%`}</span>
          <span class="ow-gring-sub">{p.caption || 'of goal'}</span>
        </span>
      )}
    </>
  );
  const style = { width: `${120 * k}px`, height: `${120 * k}px` };
  return p.on
    ? <Tap on={p.on} label={p.label} class="ow-gring" style={style}>{ring}</Tap>
    : <span role="img" aria-label={p.label || `${Math.round(p.pct)} percent of the goal`} class="ow-gring" style={style}>{ring}</span>;
}
