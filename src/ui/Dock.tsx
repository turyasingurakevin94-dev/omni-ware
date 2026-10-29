/*
 * P15 · The dark dock (LANGUAGE.md §3 P15): the order's footing. How it
 * gets there, what it comes to, and the one move (the Slide). Navy, top
 * corners 26, fixed at the bottom; the screen above leaves its height + 16.
 *
 *   <Dock mode={{ value: 'pickup', onChange: setMode }} total={1750000} sub={{ text: '1 price coming', tone: 'amber' }}
 *     slide={{ label: 'Slide to place · 3 items', knobLabel: 'Place this order', onCommit: place }} />
 *   <Dock words="Counter sale · 2 items" total={52000} slide={…}><MethodPicker navy … /><TheyGave … /></Dock>   S02, a counter sale
 *   total={null}: nothing in it (the dashed dots and "0"); mode.value 'delivery' with `address`: the field row on top.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon } from './icons.tsx';
import { fig } from './Money.tsx';
import { Slide, type SlideProps } from './Slide.tsx';
import { cx, type Fig } from './util.tsx';
import './dock.css';

export type Mode = 'pickup' | 'delivery';

/** Pickup · Delivery: the on segment white with its word, the off one its icon only. A radio group. */
export function ModeSwitch(p: { value: Mode; onChange: (m: Mode) => void }): JSX.Element {
  const seg = (m: Mode, word: string, icon: 'store' | 'truck') => {
    const on = p.value === m;
    return (
      <button type="button" role="radio" aria-checked={on} aria-label={on ? undefined : word} class={cx('ow-mode', on && 'on')} onClick={() => p.onChange(m)}>
        <span><Icon name={icon} size={on ? 18 : 20} />{on && word}</span>
      </button>
    );
  };
  return <div role="radiogroup" aria-label="How it gets there" class="ow-modes">{seg('pickup', 'Pickup', 'store')}{seg('delivery', 'Delivery', 'truck')}</div>;
}

export interface DockProps {
  mode?: { value: Mode; onChange: (m: Mode) => void };
  /** In place of the switch: "Counter sale · 2 items". */
  words?: string;
  /** null: nothing in it yet. */
  total: Fig | null;
  sub?: { text: string; tone: 'mint' | 'amber' | 'rose' };
  /** The delivery field (shown when mode is delivery). */
  address?: { value: string; onInput: (v: string) => void; placeholder?: string };
  slide: SlideProps;
  /** Drawn in place (the parts gallery) instead of fixed to the bottom. */
  inline?: boolean;
  style?: JSX.CSSProperties;
  /** Between the top row and the slide (S02: how they paid, they gave). */
  children?: ComponentChildren;
}

export function Dock(p: DockProps): JSX.Element {
  const empty = p.total == null;
  return (
    <div class={cx('ow-dock', p.inline && 'inline', empty && 'empty')} style={p.style}>
      {p.address && p.mode && p.mode.value === 'delivery' && (
        <label class="ow-dock-addr"><Icon name="pin" size={18} style={{ color: '#B3BCD2' }} />
          <input value={p.address.value} placeholder={p.address.placeholder || 'Where to'} aria-label="Delivery address" onInput={(e) => p.address && p.address.onInput((e.target as HTMLInputElement).value)} />
        </label>
      )}
      <div class={cx('ow-dock-top', p.words && 'words')}>
        {p.words ? <span class="ow-dock-words">{p.words}</span> : p.mode && <ModeSwitch {...p.mode} />}
        <div class="ow-dock-sum">
          {empty
            ? <span class="ow-dock-none"><span aria-hidden="true"><i /><i /><i /></span><span class="mono">0</span></span>
            : <span class="mono ow-dock-total">{fig(p.total as Fig)}</span>}
          {!empty && p.sub && <span class={'mono ow-dock-sub ' + p.sub.tone}>{p.sub.text}</span>}
        </div>
      </div>
      {p.children}
      <Slide {...p.slide} state={empty ? 'empty' : p.slide.state} />
    </div>
  );
}
