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
  title?: string; chips: { text: string; tone: 'amber' | 'mint' | 'rose' }[]; where?: string;
  onClose: () => void; onNext: (() => void) | null;
}

export function titleOf(a: Ask): string {
  if (a.kind === 'price') return askWord('price', a.mode);
  if (a.kind === 'loss') return askWord('loss', undefined, a.reports[0] ? a.reports[0].why : 'damaged');
  return askWord(a.kind);
}

/** The asked line of an ask with no order: what it is about (DecideStock heads). */
function whereOf(a: Ask): string {
  switch (a.kind) {
    case 'loss': return a.reports.map((r) => `${r.name} · ${r.qty} ${r.unit}${r.qty === 1 || /s$/.test(r.unit) ? '' : 's'}`).join(', ');
    case 'carton': return `${a.name} · ${a.forOrder + a.forShelf} ${a.unit}s`;
    case 'extra': return `${a.from}`;
    case 'count': return a.aisle;
    case 'markup': return a.name;
    default: return '';
  }
}

export function Head(p: HeadProps): JSX.Element {
  const { a, asker, order } = p;
  const late = p.now - a.at >= 3600e3;
  const where = order ? `${orderNo(order.id)} ${order.customerName}` : p.where || whereOf(a);
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
      {p.chips.length > 0 && <div class="mg-chips">{p.chips.map((c) => <span key={c.text} class={'mg-chip ' + c.tone}>{c.text}</span>)}</div>}
    </header>
  );
}
