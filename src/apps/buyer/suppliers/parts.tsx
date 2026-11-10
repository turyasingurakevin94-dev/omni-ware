/*
 * The small pieces the Suppliers screens share: a supplier's neutral tile
 * (suppliers are not people: #F1EEE8, ink initials), the answer chip in the
 * shared words, and a salesperson's face by display name.
 */
import type { JSX } from 'preact';
import { WORD } from '../../../core/buyer/rules.ts';
import type { BuyerBooks, LineState } from '../../../core/buyer/types.ts';
import { initials } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import type { Member, Ms } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { cx } from '../../../ui/util.tsx';
import './parts.css';

/** A supplier's tile: 40 on a row, 52 in the hero, 32 on the sheet's strip. */
export function SupTile(p: { name: string; size?: 32 | 38 | 40 | 52 }): JSX.Element {
  return <span aria-hidden="true" class={cx('ow-b-suppliers-tile', 's' + (p.size || 40))}>{initials(p.name)}</span>;
}

/** Each state's chip tone: good, bad, warn (Price up, an ask gone late) or neutral. */
export function chipTone(st: LineState, late = false): 'good' | 'bad' | 'warn' | 'neutral' {
  if (st === 'found' || st === 'in') return 'good';
  if (st === 'notfound' || st === 'short' || st === 'removed') return 'bad';
  if (st === 'priceup' || st === 'clientwaits' || (st === 'asked' && late)) return 'warn';
  return 'neutral';
}

/** "Found · 09:25" (the answer's time, never the ask's, except an ask with no answer). */
export function StateChip(p: { state: LineState; at: Ms | null; late?: boolean }): JSX.Element {
  return (
    <span class={cx('ow-b-suppliers-chip', 't-' + chipTone(p.state, p.late))}>
      {p.at != null ? <>{WORD[p.state]} · <span class="mono">{hm(p.at)}</span></> : WORD[p.state]}
    </span>
  );
}

/** "09:25": two-digit hours, as the shared words write times. */
export function hm(ms: Ms): string {
  const t = clock(ms);
  return /^\d:/.test(t) ? '0' + t : t;
}

export function member(b: BuyerBooks, id: string | null): Member | null {
  return id ? b.team.find((m) => m.id === id) || null : null;
}

/** First names only, as the shop says them ("Grace", "Moses"). */
export const first = (m: Member | null, or = ''): string => (m ? m.name.split(' ')[0] : or);

export function Face(p: { m: Member | null; size?: number }): JSX.Element | null {
  return p.m ? <Avatar initials={p.m.initials} tint={p.m.tint} size={p.size || 20} /> : null;
}

/** The person who holds a role (Moses for sourcing, Ruth for manager), by display name. */
export function byRole(b: BuyerBooks, role: Member['role']): Member | null {
  return b.team.find((m) => m.role === role) || null;
}
