/*
 * P26 · Primary buttons, and when red (LANGUAGE.md §3 P26). One primary per
 * screen; navy is the default; red only commits money or ends something,
 * at most once, and never beside the red + or a slide.
 *
 *   <Button icon="person-plus" onClick={…}>Add a customer</Button>
 *   <Button kind="red" icon="cash" state={sending ? 'sending' : 'idle'} onClick={…}>Take 420,000</Button>
 *   <Button kind="ghost" h={52}>Keep 38,000</Button>     the quiet second choice
 *   <Button kind="white">Back to Today</Button>          the one move on navy
 *   <Button kind="green" duo={phWhatsapp}>Send on WhatsApp</Button>
 *   <FinishBar label="Finish" chip="Paid 1,810,000" on={…} />
 *
 * States: pressed (navy #243052, red #A82D24), disabled (45%, no shadow),
 * sending (the label becomes "Sending…" with a 16 px ring, the colour stays).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Duo, Icon, type IconName } from './icons.tsx';
import { cx } from './util.tsx';
import './button.css';

export interface ButtonProps {
  kind?: 'navy' | 'red' | 'white' | 'ghost' | 'green';
  icon?: IconName;
  /** The icon's stroke (2, or 2.4 for a +). */
  stroke?: number;
  /** A duotone instead (the WhatsApp disc on green). */
  duo?: string;
  /** 56 (the default), 52, 48. */
  h?: 56 | 52 | 48;
  /** The words' size: 16 (the default) or 15 (a pair of choices). */
  fs?: 15 | 16;
  state?: 'idle' | 'sending' | 'disabled';
  onClick?: () => void;
  label?: string;
  class?: string;
  style?: JSX.CSSProperties;
  children: ComponentChildren;
}

export function Button(p: ButtonProps): JSX.Element {
  const sending = p.state === 'sending';
  return (
    <button type="button" class={cx('ow-btn', 'k-' + (p.kind || 'navy'), p.h && p.h !== 56 && 'h' + p.h, sending && 'sending', p.class)}
      style={p.fs === 15 ? { fontSize: '15px', ...p.style } : p.style} aria-label={p.label} aria-busy={sending || undefined} disabled={p.state === 'disabled'}
      onClick={sending ? undefined : p.onClick}>
      {sending ? <span class="ow-spin" aria-hidden="true" />
        : p.duo ? <Duo i={p.duo} size={20} />
        : p.icon && <Icon name={p.icon} size={p.h === 52 ? 20 : 18} stroke={p.stroke || (p.h === 52 ? 1.8 : 2)} />}
      <span>{sending ? 'Sending…' : p.children}</span>
    </button>
  );
}

/** The Finish bar at the end of a done order: navy, a mint tick, the label, a mint glass chip. */
export function FinishBar(p: { label: string; chip?: ComponentChildren; on: () => void }): JSX.Element {
  return (
    <button type="button" class="ow-finish" onClick={p.on}>
      <span class="ow-finish-tick"><Icon name="check" size={22} stroke={2.6} /></span>
      <span class="ow-finish-l">{p.label}</span>
      {p.chip && <span class="ow-finish-chip mono">{p.chip}</span>}
    </button>
  );
}
