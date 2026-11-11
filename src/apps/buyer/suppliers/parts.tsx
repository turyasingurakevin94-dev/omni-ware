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
import { Icon } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { cx } from '../../../ui/util.tsx';
import { kept, online } from '../shell/store.ts';
import './parts.css';

/** A supplier's tile: 40 on a row, 52 in the hero, 32 on the sheet's strip. */
export function SupTile(p: { name: string; size?: 32 | 38 | 40 | 44 | 52 }): JSX.Element {
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
      {p.at != null ? <>{WORD[p.state]} · <span class="mono">{clock(p.at)}</span></> : WORD[p.state]}
    </span>
  );
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

/** A write of this kind for this supplier (and item) is kept on this phone, waiting for signal. */
export function keptFor(kind: 'ask' | 'confirmPrice' | 'suggestPhone', sid: string, item?: string): boolean {
  return kept.value.some((k) => k.kind === kind && Array.isArray(k.args) && String(k.args[0]) === sid && (item == null || String(k.args[2]) === item));
}

/** No signal, or writes kept (Suppliers OFFLINE): the thin band, no button (they send when the signal is back). */
export function OffBand(): JSX.Element | null {
  if (online.value && !kept.value.length) return null;
  return <Notice kind="offline">{kept.value.length ? 'No signal · saved on this phone' : 'No signal'}</Notice>;
}

/** "Sends later": a row's write kept on this phone. */
export const SendsLater = (): JSX.Element => <span class="ow-b-suppliers-later-chip">Sends later</span>;

/** "Moses sees it when back" (the bell line under a kept write). */
export const SeesWhenBack = (p: { who: string }): JSX.Element => (
  <span class="ow-b-suppliers-later"><Icon name="bell" size={14} stroke={2} />{`${p.who} sees it when back`}</span>
);
