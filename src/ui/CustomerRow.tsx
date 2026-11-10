/*
 * P10 · The customer row with its due ring (LANGUAGE.md §3 P10; as built: the Customers list,
 * CU01–CU10). The ring fills as their usual gap runs out (green due, amber late, crimson gone
 * quiet, grey early), and a ring not started still shows its start; the line under the name can
 * say it in a tone; a chip under it ("125k checked", the hatched dot); the figure at the right with
 * its word ("owes", "to take") or a two-line note ("+320k / #0551"); then the one act: Take payment
 * (the sand coins disc), WhatsApp, or a chevron. The row is a div: the main part is one button,
 * the disc a sibling (never a control in a control). Rows sit in a GroupCard (ActRow.tsx), 64 tall.
 *
 *   <CustomerRow face={{ initials: 'KS', tint: 't1' }} tone="late" fill={1} name="Kyaligonza & Sons" label="Kyaligonza and Sons"
 *     sub="4 days late · every 14 days" subTone="late" fig="420k" word="owes" act="wa" on={…} onAct={…} />
 */
import type { ComponentChildren, JSX } from 'preact';
import { RING_TONE, RingAvatar, type Face } from './Avatar.tsx';
import { Duo, Icon, phCoins, phWhatsapp } from './icons.tsx';
import { cx } from './util.tsx';
import './customerrow.css';

export interface CustomerRowProps {
  face: Face;
  tone: keyof typeof RING_TONE;
  /** How much of their gap has run out, 0 to 1. */
  fill: number;
  name: ComponentChildren;
  /** The name for labels ("Kyaligonza and Sons"). */
  label: string;
  sub: string;
  subTone?: 'late' | 'due' | 'info' | 'quiet' | null;
  chip?: string | null;
  fig?: string | null;
  word?: string | null;
  note?: [string, string] | null;
  act?: 'take' | 'wa' | 'chev' | null;
  on: () => void;
  onAct?: () => void;
  class?: string;
}

const SUB = { late: '#95530C', due: '#0F6B43', info: '#1A5A8A', quiet: '#8E2A22' } as const;

export function CustomerRow(p: CustomerRowProps): JSX.Element {
  return (
    <div class={cx('ow-crow', p.class)}>
      <button type="button" class="ow-crow-main" onClick={p.on}>
        <RingAvatar face={p.face} tone={p.tone} fill={p.fill} start />
        <span class="ow-crow-t">
          <span class="ow-crow-n"><span>{p.name}</span></span>
          <span class="ow-crow-s" style={p.subTone ? { color: SUB[p.subTone], fontWeight: 700 } : undefined}>{p.sub}</span>
          {p.chip && <span class="ow-crow-chip"><span aria-hidden="true" /><b class="mono">{p.chip.split(' ')[0]}</b>{' ' + p.chip.split(' ').slice(1).join(' ')}</span>}
        </span>
        {p.fig && (
          <span class="ow-crow-f"><span class="mono">{p.fig}</span>
            {p.note ? <span class="mono note">{p.note[0]}<br />{p.note[1]}</span> : p.word && <span>{p.word}</span>}</span>
        )}
      </button>
      {p.act === 'take' && <button type="button" class="ow-crow-take" aria-label={`Take payment from ${p.label}`} onClick={p.onAct}><Duo i={phCoins} size={19} /></button>}
      {p.act === 'wa' && <button type="button" class="ow-crow-wa" aria-label={`WhatsApp ${p.label}`} onClick={p.onAct}><Duo i={phWhatsapp} size={19} color="#0F6B43" /></button>}
      {p.act === 'chev' && <span aria-hidden="true" class="ow-crow-chev"><Icon name="chevron-right" size={16} stroke={2.4} /></span>}
    </div>
  );
}
