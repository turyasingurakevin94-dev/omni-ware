/*
 * Two helpers every part uses. `Tap` is the board's `<a href>` for anything
 * that goes somewhere: a real link (so it looks and focuses as the board's
 * does) that runs `on` instead of following "#". `cx` joins class names.
 *
 *   <Tap on={() => nav.push('orders')} label="Open Orders" class="ow-x">…</Tap>
 *   <Tap href="tel:0772418220" label="Call Kato Construction">…</Tap>
 */
import type { ComponentChildren, JSX } from 'preact';

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
