/*
 * A card of an order's lines (store-agent PK09 "What #0557 asks", PK10 "Put back", PK15 "Your ticks
 * stay", PK17 "What Nansana gets"): its title, a small bar with "1 of 2", then one row per line,
 * the aisle's square, the name, "2 bag · aisle B", and what the row ends in (a tick, a lock, a box
 * to tick). And the from → to card (PK10 bay → shelf, PK15 bay → To pack).
 */
import type { ComponentChildren, JSX } from 'preact';
import { aisleOf } from '../../../core/store/pack.ts';
import type { YardBooks, YardLine } from '../../../core/store/types.ts';
import { AISLE, Duo, aisleKey } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';

export interface ListRow { l: YardLine; qty?: number; end: ComponentChildren }

export function LinesCard(p: { b: YardBooks; title: string; bar?: ('on' | 'amber' | '')[]; count?: string; chip?: ComponentChildren; rows: ListRow[] }): JSX.Element {
  return (
    <div class="pk-card pk-list">
      <div class="pk-list-h">
        <span>{p.title}</span>
        {p.chip}
        {p.bar && <span class="pk-list-p"><span aria-hidden="true">{p.bar.map((x, i) => <i key={i} class={x} />)}</span>{p.count && <b class="mono">{p.count}</b>}</span>}
      </div>
      {p.rows.map((r) => {
        const a = aisleOf(p.b, r.l), k = AISLE[aisleKey(a ? a.name : r.l.name)];
        return (
          <div key={r.l.idx} class="pk-list-r">
            <span aria-hidden="true" class="pk-list-i" style={{ background: `linear-gradient(145deg, ${k.soft} 0%, #FFFFFF 150%)` }}><Duo i={k.i} size={20} color={k.ink} /></span>
            <span class="pk-list-t"><b>{r.l.name}</b><span class="mono">{`${r.qty ?? r.l.qty} `}<span class="pk-sans">{r.l.unit}</span>{a ? ` · aisle ${a.letter}` : ''}</span></span>
            {r.end}
          </div>
        );
      })}
    </div>
  );
}

export function FromTo(p: { label: string; from: ComponentChildren; to: ComponentChildren; fromTone: 'dash' | 'warn'; toTone: 'info' | 'good' }): JSX.Element {
  return (
    <div role="img" aria-label={p.label} class="pk-card pk-fromto">
      <span class={cx('pk-ft-a', p.fromTone)}>{p.from}</span>
      <span class="pk-ft-arrow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
      <span class={cx('pk-ft-b', p.toTone)}>{p.to}</span>
    </div>
  );
}
