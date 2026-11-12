/*
 * The Decide sheet's navy head (Today p2; every Decide board): ✕ · "n of N" with its dashes ·
 * next ›; the asker's face, "From Musa · Store", the age chip (amber past an hour); "Asked 09:15 ·
 * #0551 Nansana Hardware"; the ask as the title; one reason chip.
 */
import type { JSX } from 'preact';
import type { Ask, MOrder, Person } from '../../../core/manager/types.ts';
import { askWord, hm, ROLE, waited } from '../../../core/manager/words.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';

export interface HeadProps {
  a: Ask; asker: Person | null; order: MOrder | null; n: number; of: number; now: number;
  title?: string; chip: { text: string; tone: 'amber' | 'mint' | 'rose' } | null;
  onClose: () => void; onNext: (() => void) | null;
}

export function titleOf(a: Ask): string {
  if (a.kind === 'price') return askWord('price', a.mode);
  if (a.kind === 'loss') return askWord('loss', undefined, a.reports[0] ? a.reports[0].why : 'damaged');
  return askWord(a.kind);
}

export function Head(p: HeadProps): JSX.Element {
  const { a, asker, order } = p;
  const late = p.now - a.at >= 3600e3;
  const where = order ? `${orderNo(order.id)} ${order.customerName}` : '';
  return (
    <header class="mg-d-head">
      <div class="mg-d-row">
        <button type="button" class="mg-d-x" aria-label="Close" onClick={p.onClose}><Icon name="close" size={18} stroke={2.2} /></button>
        <div class="mg-d-n" aria-label={`${p.n} of ${p.of} waiting`}>
          <b>{`${p.n} of ${p.of}`}</b>
          <span class="mg-d-dash" aria-hidden="true">{Array.from({ length: p.of }, (_, i) => <i key={i} class={i + 1 < p.n ? 'done' : i + 1 === p.n ? 'now' : ''} />)}</span>
        </div>
        {p.onNext && <button type="button" class="mg-d-next" aria-label="Next decision" onClick={p.onNext}>next<Icon name="chevron-right" size={16} stroke={2.4} /></button>}
      </div>
      <div class="mg-d-row">
        {asker && <Avatar initials={asker.initials} tint={asker.tint === 'me' ? 'n' : asker.tint} size={40} />}
        <div class="mg-d-who">
          <span class="mg-d-from">
            <b>{asker ? `From ${firstWord(asker.name)} · ${ROLE[asker.role]}` : 'Spotted by the app'}</b>
            <span class={'mg-d-age' + (late ? ' late' : '')} aria-label={`waiting ${waited(a.at, p.now)}`}><Icon name="clock" size={13} stroke={2.2} />{waited(a.at, p.now)}</span>
          </span>
          <span class="mg-d-asked">{[`Asked ${hm(a.at)}`, where].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
      <h1 class="mg-d-title">{p.title || titleOf(a)}</h1>
      {p.chip && <span class={'mg-chip ' + p.chip.tone}>{p.chip.text}</span>}
    </header>
  );
}
