/*
 * The short count's picture (store-agent PK04, PK05): one carton for each one here, filled, and
 * one dashed for each one short. At most `max` of each are drawn; the words beside say the count.
 */
import type { JSX } from 'preact';

function Box(p: { short?: boolean; size: number }): JSX.Element {
  return p.short ? (
    <svg width={p.size} height={p.size} viewBox="0 0 44 44" aria-hidden="true">
      <path d="M6 14 22 7l16 7v18l-16 7-16-7z" fill="#FDEEE1" stroke="#95530C" stroke-width="2" stroke-dasharray="4 3" stroke-linejoin="round" />
      <path d="M6 14l16 7 16-7M22 21v18" fill="none" stroke="#95530C" stroke-width="2" stroke-dasharray="4 3" />
    </svg>
  ) : (
    <svg width={p.size} height={p.size} viewBox="0 0 44 44" aria-hidden="true">
      <path d="M6 14 22 7l16 7v18l-16 7-16-7z" fill="#E4C79A" stroke="#7A4A02" stroke-width="2" stroke-linejoin="round" />
      <path d="M6 14l16 7 16-7M22 21v18" fill="none" stroke="#7A4A02" stroke-width="2" stroke-linejoin="round" />
      <path d="M14 10.5l16 7" stroke="#C9A06A" stroke-width="3" />
    </svg>
  );
}

export function Boxes(p: { have: number; of: number; size: number; max?: number }): JSX.Element {
  const m = p.max ?? 3, have = Math.min(m, p.have), short = Math.min(m, Math.max(0, p.of - p.have));
  return (
    <span class="pk-boxes">
      {Array.from({ length: have }, (_v, i) => <Box key={'h' + i} size={p.size} />)}
      {Array.from({ length: short }, (_v, i) => <Box key={'s' + i} short size={p.size} />)}
    </span>
  );
}
