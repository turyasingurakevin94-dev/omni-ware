/*
 * P23 · Chips and status pills (LANGUAGE.md §3 P23).
 *
 *   <StatusPill tone="info" size="md" icon="checking">Checking</StatusPill>
 *   <StatusPill tone="good" tick>Paid</StatusPill>
 *   <DarkPill amount="1.9M" />                                  "9.6M to take": navy, the coins in amber
 *   <ChipRow label="Show"><FilterChip on count={20}>All</FilterChip>…</ChipRow>
 *   <ActionPill tone="warn" word="Take" amount="1.1M" />        the act on a row, 32 tall
 *   <NavyPill tone="amber" icon="clock">Due for their usual</NavyPill>
 *   <CodeChip>K7Q2</CodeChip>   <EarnChip>+40,000</EarnChip>
 */
import type { ComponentChildren, JSX } from 'preact';
import { Duo, Icon, phCoins, type IconName } from './icons.tsx';
import { fig } from './Money.tsx';
import { cx, type Fig } from './util.tsx';
import './pill.css';

export type Tone = 'good' | 'caution' | 'bad' | 'info' | 'neutral';

export interface StatusPillProps {
  tone: Tone;
  /** sm 24 (the default), md 28 (a stage pill with its icon), lg 30. */
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  /** A tick before the word (Paid, In). */
  tick?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  children: ComponentChildren;
}

export function StatusPill(p: StatusPillProps): JSX.Element {
  return (
    <span class={cx('ow-pill', 't-' + p.tone, 's-' + (p.size || 'sm'), p.class)} style={p.style}>
      {p.icon && <Icon name={p.icon} size={14} stroke={2.2} />}
      {p.tick && <Icon name="check" size={11} stroke={3.2} />}
      {p.children}
    </span>
  );
}

/** The dark status pill: a total with weight, the coins in amber (P23 "dark"). */
export function DarkPill(p: { amount: Fig; label?: string }): JSX.Element {
  return (
    <span class="ow-pill-dark" aria-label={p.label}>
      <Duo i={phCoins} size={14} color="#F5B26B" />
      <b class="mono">{fig(p.amount)}</b>
    </span>
  );
}

export interface FilterChipProps {
  on?: boolean;
  /** The stage's tone dot (S05) or any colour. */
  dot?: string;
  count?: Fig;
  /** An empty stage keeps its chip at 60% (S05). */
  dim?: boolean;
  onClick?: () => void;
  children: ComponentChildren;
}

/** A filter chip: 44 tall, white with a hairline; navy when chosen. */
export function FilterChip(p: FilterChipProps): JSX.Element {
  return (
    <button type="button" class={cx('ow-fchip', p.on && 'on', p.dim && 'dim')} aria-pressed={!!p.on} onClick={p.onClick}>
      {p.dot && <span aria-hidden="true" class="ow-fchip-dot" style={{ background: p.dot }} />}
      {p.children}
      {p.count != null && <b class="mono">{fig(p.count)}</b>}
    </button>
  );
}

/** A row of filter chips. `wrap`: on several lines; else one line that scrolls past the gutters. */
export function ChipRow(p: { label: string; wrap?: boolean; children: ComponentChildren }): JSX.Element {
  return <div role="group" aria-label={p.label} class={cx('ow-chiprow', p.wrap && 'wrap')}>{p.children}</div>;
}

export type ActTone = 'warn' | 'good' | 'info' | 'bad';

/** The act on a row: tone soft, tone ink, 13/700, the amount in mono ("Take 1.1M"). 32 tall, or 30 inside a 44 target (S09). */
export function ActionPill(p: { tone: ActTone; word: string; amount?: Fig; h?: 30 | 32 }): JSX.Element {
  return (
    <span class={cx('ow-apill', 'a-' + p.tone)} style={p.h === 30 ? { height: '30px' } : undefined}>
      {p.word}{p.amount != null && <span class="mono">{fig(p.amount)}</span>}
    </span>
  );
}

/** A tag on navy: mint, amber or glass; 26 tall with an icon (P09), or the small count pill of a page head ("4 owe"). */
export function NavyPill(p: { tone: 'mint' | 'amber' | 'glass'; icon?: IconName; small?: boolean; children: ComponentChildren }): JSX.Element {
  return (
    <span class={cx('ow-npill', 'n-' + p.tone, p.small && 'small')}>
      {p.icon && <Icon name={p.icon} size={13} stroke={2.4} />}
      {p.children}
    </span>
  );
}

/** A positive amount on a line: mono on good soft, radius 8. */
export function EarnChip(p: { children: ComponentChildren }): JSX.Element {
  return <span class="ow-chip8 mono e">{p.children}</span>;
}

/** A pickup code: mint mono on navy, radius 8. */
export function CodeChip(p: { children: ComponentChildren }): JSX.Element {
  return <span class="ow-chip8 mono c">{p.children}</span>;
}
