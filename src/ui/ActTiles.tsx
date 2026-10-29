/*
 * P21 · The 3-up action tiles (LANGUAGE.md §3 P21). The joined bar (one
 * white card, three equal acts split by 1px #F1EEE8, each a 42 px tinted
 * disc over the word and a sub) is the default on an order or a customer;
 * separate tiles when a fourth act ("Fix it") joins.
 *
 *   <ActBar acts={[
 *     { tone: 'call', icon: 'phone', word: 'Call', sub: 'Kato', href: 'tel:0772418220' },
 *     { tone: 'tell', duo: phWhatsapp, word: 'Tell them', sub: "it's packing", on: … },
 *     { tone: 'receipt', icon: 'receipt', word: 'Receipt', sub: '1,810,000', on: … }]} />
 *   <ActGrid acts={[…4]} />
 */
import type { JSX } from 'preact';
import { Duo, Icon, type IconName } from './icons.tsx';
import { Tap, cx } from './util.tsx';
import './acttiles.css';

/** The disc's tint by act: call indigo, tell green, receipt blue, change sand, wrong red. */
const TONE = {
  call: ['#E4E6FA', '#3A3F9B'], tell: ['#E4F4EA', '#0F6B43'], receipt: ['#DCEAF8', '#1A5A8A'],
  change: ['#FDEEE1', '#7A4A02'], wrong: ['#FBE5E2', '#8E2A22'], plain: ['#F1EEE8', '#1C2233'],
} as const;

export interface Act {
  tone: keyof typeof TONE;
  icon?: IconName;
  duo?: string;
  word: string;
  sub?: string;
  on?: () => void;
  href?: string;
  label?: string;
}

export function ActBar(p: { acts: Act[] }): JSX.Element {
  return (
    <div class="ow-actbar">
      {p.acts.map((a, i) => (
        <Tap key={i} on={a.on} href={a.href} label={a.label} class="ow-act">
          <span aria-hidden="true" class="ow-act-disc" style={{ background: TONE[a.tone][0], color: TONE[a.tone][1] }}>
            {a.duo ? <Duo i={a.duo} size={19} /> : a.icon && <Icon name={a.icon} size={19} />}
          </span>
          <span class="ow-act-w">{a.word}</span>
          {a.sub && <span class="ow-act-s">{a.sub}</span>}
        </Tap>
      ))}
    </div>
  );
}

/** Separate tiles: 56 tall, white hairline, the icon over the word; 3 or 4 in a row. */
export function ActGrid(p: { acts: Act[] }): JSX.Element {
  return (
    <div class={cx('ow-actgrid', p.acts.length === 4 && 'four')}>
      {p.acts.map((a, i) => (
        <Tap key={i} on={a.on} href={a.href} label={a.label} class="ow-acttile">
          <span aria-hidden="true" style={{ display: 'flex', color: TONE[a.tone][1] }}>{a.duo ? <Duo i={a.duo} size={20} /> : a.icon && <Icon name={a.icon} size={20} />}</span>
          <span>{a.word}</span>
        </Tap>
      ))}
    </div>
  );
}
