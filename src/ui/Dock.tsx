/*
 * P15 · The dark dock (LANGUAGE.md §3 P15): the order's footing. How it
 * gets there, what it comes to, and the one move (the Slide). Navy, top
 * corners 26, fixed at the bottom; the screen above leaves its real height (--dock-h) + 24; with the
 * keyboard up for a field above it, it sits at the end of the page instead (keyboard.ts).
 *
 *   <Dock mode={{ value: 'pickup', onChange: setMode }} total={1750000} sub={{ text: '1 price coming', tone: 'amber' }}
 *     slide={{ label: 'Slide to place · 3 items', onCommit: place }} />
 *   <Dock words="Counter sale · 2 items" total={52000} slide={…}><MethodPicker navy … /><TheyGave … /></Dock>   S02, a counter sale
 *   total={null}: nothing in it (the dashed dots and "0"); mode.value 'delivery' with `address`: the field row on top.
 *   <Dock words="Ruth decides first" amber tight total={…} above={offline ? <Notice kind="offline" under>…</Notice> : null} slide={{ …, lock: { icon: 'hourglass', label: 'Waiting for Ruth' } }}>…</Dock>
 */
import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
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
  /** The one move; without it the children end with their own. */
  slide?: SlideProps;
  /** The words in amber: something waits (the counter: "10 asked · 4 on shelf", "Ruth decides first"). */
  amber?: boolean;
  /** 12 between its rows instead of 14 (the counter with the transaction ID). */
  tight?: boolean;
  /** What sits on it, above (the no-signal band, an error card): the dock and it are fixed together. null: nothing now. */
  above?: ComponentChildren;
  /** Drawn in place (the parts gallery) instead of fixed to the bottom. */
  inline?: boolean;
  style?: JSX.CSSProperties;
  /** Between the top row and the slide (S02: how they paid, they gave). */
  children?: ComponentChildren;
}

/**
 * The page leaves the dock's real height (--dock-h on the root): a delivery row, a method picker or large
 * text make it taller than the canvas's 158, and nothing may sit under it. Gone with the dock.
 */
export function useDockHeight(ref: { current: HTMLElement | null }, on: boolean): void {
  useLayoutEffect(() => {
    const el = ref.current, root = document.documentElement;
    if (!on || !el) return undefined;
    const put = () => root.style.setProperty('--dock-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    put();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(put) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); root.style.removeProperty('--dock-h'); };
  }, [on]);
}

export function Dock(p: DockProps): JSX.Element {
  const empty = p.total == null, foot = useRef<HTMLDivElement>(null);
  useDockHeight(foot, !p.inline);
  const dock = (
    <div ref={p.above === undefined ? foot : undefined} class={cx('ow-dock', p.inline && 'inline', empty && 'empty', p.tight && 'tight')} style={p.style}>
      {p.address && p.mode && p.mode.value === 'delivery' && (
        <label class="ow-dock-addr"><Icon name="pin" size={18} style={{ color: '#B3BCD2' }} />
          <input value={p.address.value} placeholder={p.address.placeholder || 'Where to'} aria-label="Delivery address" onInput={(e) => p.address && p.address.onInput((e.target as HTMLInputElement).value)} />
        </label>
      )}
      <div class={cx('ow-dock-top', p.words && 'words')}>
        {p.words ? <span class={cx('ow-dock-words', p.amber && 'amber')}>{p.words}</span> : p.mode && <ModeSwitch {...p.mode} />}
        <div class="ow-dock-sum">
          {empty
            ? <span class="ow-dock-none"><span aria-hidden="true"><i /><i /><i /></span><span class="mono">0</span></span>
            : <span class="mono ow-dock-total">{fig(p.total as Fig)}</span>}
          {!empty && p.sub && <span class={'mono ow-dock-sub ' + p.sub.tone}>{p.sub.text}</span>}
        </div>
      </div>
      {p.children}
      {p.slide && <Slide {...p.slide} state={empty ? 'empty' : p.slide.state} />}
    </div>
  );
  return p.above === undefined ? dock : <div ref={foot} class="ow-dockwrap">{p.above}{dock}</div>;
}
