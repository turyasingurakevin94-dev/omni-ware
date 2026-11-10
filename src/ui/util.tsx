/*
 * Two helpers every part uses. `Tap` is the board's `<a href>` for anything
 * that goes somewhere: a real link (so it looks and focuses as the board's
 * does) that runs `on` instead of following "#". `cx` joins class names.
 *
 *   <Tap on={() => nav.push('orders')} label="Open Orders" class="ow-x">…</Tap>
 *   <Tap href="tel:0772418220" label="Call Kato Construction">…</Tap>
 */
import type { ComponentChildren, JSX } from 'preact';

/**
 * A bar's fill, as a width: never below 0 or past the bar (a goal passed seven times over, a debt over
 * its limit), whatever the figure beside it says. `after`: the part of the bar already filled before it.
 */
export function barW(pct: number, after = 0): string {
  const a = Math.max(0, Math.min(100, after));
  return `${Math.max(0, Math.min(100 - a, pct))}%`;
}

/**
 * Words with a figure: the words, and the figure that never shrinks ("Slide to record " · "420,000", "Every 10
 * days · " · "owes 420k", "Slide to place · " · "3 items"). The figure is the last " · " part when it has one,
 * else a figure at the end. With large text or a narrow phone the words give way (…) and the figure stays whole.
 */
export function figureTail(text: string): [string, string] {
  const dot = text.lastIndexOf(' · ');
  if (dot >= 0 && /\d/.test(text.slice(dot + 3))) return [text.slice(0, dot + 3), text.slice(dot + 3)];
  const m = /^(.*? )([+−#-]?\d[\d,.]*[kMB]?(?: [a-z]+)?)$/.exec(text);
  return m ? [m[1], m[2]] : [text, ''];
}

/** figureTail drawn: one line whose words give way before its figure. */
export function Keep(p: { text: string }): JSX.Element {
  const [words, fig] = figureTail(p.text);
  return <span class="ow-fit"><span class="ow-give">{words}</span>{fig && <span class="ow-keep">{fig}</span>}</span>;
}

export function cx(...a: (string | false | null | undefined)[]): string {
  return a.filter(Boolean).join(' ');
}

export interface TapProps {
  /** What it does. Without it, `href` is followed. */
  on?: () => void;
  href?: string;
  /** aria-label: needed when the link holds only an icon or a picture. */
  label?: string;
  class?: string;
  style?: JSX.CSSProperties;
  current?: boolean;
  children?: ComponentChildren;
}

export function Tap(p: TapProps): JSX.Element {
  return (
    <a href={p.href || '#'} class={p.class} style={p.style} aria-label={p.label} aria-current={p.current ? 'page' : undefined}
      onClick={p.on ? (e) => { e.preventDefault(); (p.on as () => void)(); } : undefined}>
      {p.children}
    </a>
  );
}

/** Money and counts in a part's props: a number is written in full ("1,250,000"); a string is drawn as given ("1.9M"). */
export type Fig = number | string;
