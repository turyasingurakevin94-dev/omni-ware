/*
 * LOCAL PART (for the lead to move into src/ui): the P10 due ring as the
 * Customers boards draw it. Two differences from src/ui RingAvatar:
 *   - a ring with nothing run out yet still draws its start, a 3 px dot at
 *     the top (the board's stroke-dasharray "0.0 125.7" with round caps);
 *   - BigRing: the 56 px ring of the customer sheet's head, on navy
 *     (track rgba(255,255,255,.12), r 26, the avatar inset 6 at 16 px type).
 */
import type { JSX } from 'preact';
import { RING_TONE } from '../../../ui/Avatar.tsx';
import { TINTS } from '../../../core/names.ts';
import type { Tint } from '../../../core/types.ts';
import type { RingTone } from './data.ts';

function ring(box: number, r: number, track: string, tone: RingTone, fill: number): JSX.Element {
  const c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, fill)), m = box / 2;
  return (
    <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
      <circle cx={m} cy={m} r={r} fill="none" stroke={track} stroke-width="3" />
      <circle cx={m} cy={m} r={r} fill="none" stroke={RING_TONE[tone]} stroke-width="3" stroke-linecap="round"
        stroke-dasharray={`${(c * f).toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${m} ${m})`} />
    </svg>
  );
}

/** P10 · 44 box, r 20, stroke 3 on #EFECE6, the avatar inset 6 px (12 px type). */
export function Ring44(p: { initials: string; tint: Tint; tone: RingTone; fill: number }): JSX.Element {
  const t = TINTS[p.tint] || TINTS.t4;
  return (
    <span aria-hidden="true" class="cu-ring">
      {ring(44, 20, '#EFECE6', p.tone, p.fill)}
      <span style={{ background: t.bg, color: t.fg }}>{p.initials}</span>
    </span>
  );
}

/** The customer sheet's 56 px ring on navy. */
export function BigRing(p: { initials: string; tint: Tint; tone: RingTone; fill: number }): JSX.Element {
  const t = TINTS[p.tint] || TINTS.t4;
  return (
    <span aria-hidden="true" class="cu-ring big">
      {ring(56, 26, 'rgba(255,255,255,.12)', p.tone, p.fill)}
      <span style={{ background: t.bg, color: t.fg }}>{p.initials}</span>
    </span>
  );
}
