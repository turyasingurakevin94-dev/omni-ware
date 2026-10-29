/*
 * P06 · Section headers (LANGUAGE.md §3 P06).
 *
 *   <SectionHead title="On the move" meta="12 live · 8 done" />
 *   <SectionHead title="Needs you" dot count={7} after />          the 8 px crimson dot, the count after
 *   <SectionHead title="Get going" meta="1 of 3" metaTone="good" after />
 *   <SectionHead title="Next move" right={<PlayAll count={4} amount="6.1M" on={…} />} />
 *   <GroupHead dot="#F5B26B" title="Checking" count={3} sum={542000} />   a list group's header (S09)
 */
import type { ComponentChildren, JSX } from 'preact';
import { Duo, phPlay } from './icons.tsx';
import { fig } from './Money.tsx';
import { Tap, cx, type Fig } from './util.tsx';
import './section.css';

export interface SectionHeadProps {
  title: string;
  /** Mono, right (13 #5F6980). */
  meta?: string;
  metaTone?: 'good';
  /** "Needs you": the 8 px #8E2A22 dot before, the count after. */
  dot?: boolean;
  count?: number;
  /** It follows a card: 6 px further down. */
  after?: boolean;
  right?: ComponentChildren;
}

export function SectionHead(p: SectionHeadProps): JSX.Element {
  if (p.dot) {
    return (
      <div class={cx('ow-sec', 'dot', p.after && 'after')}>
        <span aria-hidden="true" class="ow-sec-dot" />
        <h2>{p.title}</h2>
        {p.count != null && <span class="mono ow-sec-count">{p.count}</span>}
      </div>
    );
  }
  return (
    <div class={cx('ow-sec', p.after && 'after', p.right != null && 'r')}>
      <h2>{p.title}</h2>
      {p.meta && <span class={cx('mono ow-sec-meta', p.metaTone)}>{p.meta}</span>}
      {p.right}
    </div>
  );
}

/** The Play-all pill: navy, 36 visible inside a 44 target, the mint play disc, the sum in mint. */
export function PlayAll(p: { count: number; amount: string; on: () => void }): JSX.Element {
  return (
    <Tap on={p.on} label={`Play all ${p.count}, ${p.amount}`} class="ow-play">
      <span><span aria-hidden="true" class="ow-play-disc"><Duo i={phPlay} size={10} color="#16203C" /></span>{`Play all ${p.count}`}<b class="mono">{p.amount}</b></span>
    </Tap>
  );
}

/** A list group's header: the 10 px tone dot, the title 14/700, the count (mono 12), the sum at the right. */
export function GroupHead(p: { dot: string; title: string; count: number; sum?: Fig }): JSX.Element {
  return (
    <div class="ow-ghead">
      <span aria-hidden="true" style={{ background: p.dot }} />
      <span class="ow-ghead-t">{p.title}</span>
      <span class="mono ow-ghead-n">{p.count}</span>
      {p.sum != null && <span class="mono ow-ghead-sum">{fig(p.sum)}</span>}
    </div>
  );
}
