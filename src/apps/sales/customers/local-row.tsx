/*
 * LOCAL PART (for the lead to move into src/ui beside P10 CustomerRow): the
 * customer row as the Customers list draws it, with what P10 cannot say:
 *   - the act on the right: Take payment (the sand coins disc), WhatsApp, or a chevron;
 *   - a chip under the sub ("125k checked", the hatched dot);
 *   - the figure's word ("to take", "owes") or a two-line note ("+320k / #0551");
 *   - the sub in a tone (late amber, due green, being checked blue);
 *   - a ring that has not started still shows its 3 px start (Ring44).
 * And the list group's header (S09's GroupHead with a word after the sum, or words alone).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Duo, Icon, phCoins, phWhatsapp } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import type { Tint } from '../../../core/types.ts';
import type { RingTone } from './data.ts';
import { Ring44 } from './local-rings.tsx';

export interface RowProps {
  initials: string;
  tint: Tint;
  tone: RingTone;
  fill: number;
  name: ComponentChildren;
  /** The name for labels ("Kyaligonza and Sons"). */
  label: string;
  sub: string;
  subTone?: 'late' | 'due' | 'info' | null;
  chip?: string | null;
  fig?: string | null;
  word?: string | null;
  note?: [string, string] | null;
  act?: 'take' | 'wa' | 'chev' | null;
  on: () => void;
  onAct?: () => void;
}

const SUB = { late: '#95530C', due: '#0F6B43', info: '#1A5A8A' } as const;

export function Row(p: RowProps): JSX.Element {
  return (
    <div class="cu-row">
      <button type="button" class="cu-row-main" onClick={p.on}>
        <Ring44 initials={p.initials} tint={p.tint} tone={p.tone} fill={p.fill} />
        <span class="cu-row-t">
          <span class="cu-row-n"><span>{p.name}</span></span>
          <span class="cu-row-s" style={p.subTone ? { color: SUB[p.subTone], fontWeight: 700 } : undefined}>{p.sub}</span>
          {p.chip && <span class="cu-row-chip"><span aria-hidden="true" /><b class="mono">{p.chip.split(' ')[0]}</b>{' ' + p.chip.split(' ').slice(1).join(' ')}</span>}
        </span>
        {p.fig && (
          <span class="cu-row-f"><span class="mono">{p.fig}</span>
            {p.note ? <span class="mono note">{p.note[0]}<br />{p.note[1]}</span> : p.word && <span>{p.word}</span>}</span>
        )}
      </button>
      {p.act === 'take' && <button type="button" class="cu-row-take" aria-label={`Take payment from ${p.label}`} onClick={p.onAct}><Duo i={phCoins} size={19} /></button>}
      {p.act === 'wa' && <button type="button" class="cu-row-wa" aria-label={`WhatsApp ${p.label}`} onClick={p.onAct}><Duo i={phWhatsapp} size={19} color="#0F6B43" /></button>}
      {p.act === 'chev' && <span aria-hidden="true" class="cu-row-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>}
    </div>
  );
}

/** A list group's header: the 10 px dot (or hatched), the title, the count, then the sum and its word, or words alone. */
export function Group(p: { dot?: string; hatch?: boolean; title: string; count?: number; sum?: string; word?: string; right?: string; railGap?: boolean }): JSX.Element {
  return (
    <div class="cu-gh">
      {(p.dot || p.hatch) && <span aria-hidden="true" class={cx('cu-gh-dot', p.hatch && 'hatch')} style={p.dot ? { background: p.dot } : undefined} />}
      <span class="cu-gh-t">{p.title}</span>
      <span class="mono cu-gh-n">{p.count != null ? p.count : ''}</span>
      {p.sum != null && <span class="mono cu-gh-sum"><b>{p.sum}</b> <span>{p.word}</span></span>}
      {p.right && <span class={cx('cu-gh-r', p.railGap && 'rail')}>{p.right}</span>}
    </div>
  );
}

export function Card(p: { children: ComponentChildren; class?: string }): JSX.Element {
  return <div class={cx('cu-card', p.class)}>{p.children}</div>;
}
