/*
 * Money and counts as people read them (LANGUAGE.md §1.6): IBM Plex Mono,
 * tabular figures. In full where someone acts on it ("1,250,000"), short in
 * a tile or a summary ("1.2M", "+146k"). The rules are src/core/money.ts's.
 *
 *   <Money n={1810000} />                  1,810,000
 *   <Money n={3240000} short sign />       +3.2M
 *   <Money n="1.9M" />                     a string is drawn as given
 *   fig(1810000)  fig(1900000, true)       the same, as text, for a label
 */
import type { JSX } from 'preact';
import { money, short } from '../core/money.ts';
import type { Fig } from './util.tsx';

/** A figure as text: a number in full (or short), a string as given. */
export function fig(v: Fig, isShort?: boolean, sign?: boolean): string {
  if (typeof v === 'string') return v;
  const s = isShort ? short(Math.abs(v)) : money(Math.abs(v));
  return (v < 0 ? '−' : sign && v > 0 ? '+' : '') + s;
}

export interface MoneyProps {
  n: Fig;
  short?: boolean;
  /** "+" before a positive amount (a minus is always written, as "−"). */
  sign?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}

export function Money(p: MoneyProps): JSX.Element {
  return <span class={'mono' + (p.class ? ' ' + p.class : '')} style={p.style}>{fig(p.n, p.short, p.sign)}</span>;
}

/** "40 bag × 33,500": the count and price in mono, the unit word in Figtree (P12, P20). */
export function QtyLine(p: { qty: Fig; unit: string; tail: string; class?: string; style?: JSX.CSSProperties }): JSX.Element {
  return <span class={'mono' + (p.class ? ' ' + p.class : '')} style={p.style}>{`${fig(p.qty)} `}<span class="ow-word">{p.unit}</span>{` ${p.tail}`}</span>;
}
