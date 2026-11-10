/*
 * The Orders tab's small pieces, drawn the same on every screen of the tab
 * (docs/canvas/buyer/Orders.dc.html):
 *
 *   <FromChip who={grace} no={553} />         "From Grace · #0553": where the work came from in Sales
 *   <Strip states={['found', 'asked']} />     one segment per line, in the line's colour
 *   <Sees who="Grace" word="Switched" bell /> what Sales gets back
 *   <StateWord state="found" at="09:31" />    a line's state word as a soft pill
 *   <RowAct …/>                               the navy pill on a row (Ask again), with its sending state
 */
import type { ComponentChildren, JSX } from 'preact';
import { WORD } from '../../../core/buyer/rules.ts';
import type { LineState } from '../../../core/buyer/types.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import type { Member } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import { PILL, STRIP, STRIP_NAVY } from './rules.ts';
import './orders.css';

/** "From Grace · #0553": the seller's face, first name and the order number. */
export function FromChip(p: { who: Member | null; no: number; navy?: boolean }): JSX.Element {
  const name = p.who ? firstWord(p.who.name) : 'Sales';
  return (
    <span class={cx('ow-b-orders-from', p.navy && 'navy')}>
      {p.who && <Avatar initials={p.who.initials} tint={p.who.tint} size={20} />}
      <span class="w">{`From ${name} ·`}</span>
      <span class="mono">{orderNo(p.no)}</span>
    </span>
  );
}

/** One segment per line, its state's colour; a screen reader hears the words. */
export function Strip(p: { states: LineState[]; navy?: boolean; gap?: number }): JSX.Element {
  const label = p.states.map((s) => WORD[s]).join(', ');
  return (
    <div class="ow-b-orders-strip" role="img" aria-label={label} style={{ gap: `${p.gap ?? 3}px` }}>
      {p.states.map((s, i) => <span key={i} style={{ background: (p.navy ? STRIP_NAVY : STRIP)[s] }} />)}
    </div>
  );
}

/** "Grace sees: Switched" with the bell when a push goes. */
export function Sees(p: { who: string; children: ComponentChildren; bell?: boolean; navy?: boolean; class?: string }): JSX.Element {
  return (
    <span class={cx('ow-b-orders-sees', p.navy && 'navy', p.class)}>
      {p.bell !== false && <Icon name="bell" size={14} stroke={2} />}
      {`${p.who} sees:`} <b>{p.children}</b>
    </span>
  );
}

/** A line's state word, as a soft pill: "Found · 09:31". */
export function StateWord(p: { state: LineState; at?: string | null; word?: string; h?: 30 | 32 }): JSX.Element {
  const [bg, ink] = PILL[p.state];
  return (
    <span class="ow-b-orders-word" style={{ background: bg, color: ink, height: `${p.h || 32}px` }}>
      {p.word || WORD[p.state]}{p.at && <> · <span class="mono">{p.at}</span></>}
    </span>
  );
}

/** The navy pill on a row (44 tall). Sending: a spinner and the -ing word. */
export function RowAct(p: { icon: IconName; word: string; busyWord: string; busy: boolean; label?: string; on: () => void; kind?: 'navy' | 'line' }): JSX.Element {
  return (
    <button type="button" class={cx('ow-b-orders-act', p.kind === 'line' && 'line')} aria-label={p.label} aria-busy={p.busy || undefined}
      disabled={p.busy} onClick={(e) => { e.stopPropagation(); p.on(); }}>
      {p.busy ? <span aria-hidden="true" class="ow-b-orders-spin" /> : <Icon name={p.icon} size={16} stroke={2.2} />}
      {p.busy ? p.busyWord : p.word}
    </button>
  );
}

/** A supplier or client tile: the neutral ground (suppliers and clients are not people). */
export function Initials(p: { name: string; ini: string; size?: number }): JSX.Element {
  const s = p.size || 40;
  return <span aria-hidden="true" class="ow-b-orders-ini" style={{ width: `${s}px`, height: `${s}px`, fontSize: s >= 44 ? '15px' : '14px' }}>{p.ini}</span>;
}

/** The round grey "Waiting" chip of a write kept on the phone (no signal). */
export function Waiting(): JSX.Element {
  return <span class="ow-b-orders-word" style={{ background: '#F1EEE8', color: '#5F6980', height: '32px' }}><Icon name="clock" size={14} stroke={2.2} />Waiting</span>;
}
