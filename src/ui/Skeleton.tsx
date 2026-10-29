/*
 * P25 · Skeleton loading (LANGUAGE.md §3 P25; as built: CU08, CH07). The
 * real layout with shimmer blocks where words and figures will be; tiles
 * keep their size; a small ring and the words of what is coming sit at the
 * section header's right. The head stays (real greeting, figures as blocks).
 *
 *   <Shim w="70%" h={12} />  <Shim w={44} h={44} round />  <Shim w={120} h={12} navy />
 *   <LoadingHead text="Getting your customers" />          the header row: a block, the ring and the words
 *   <SkeletonRows rows={2} />                              customer rows (P10) in a group card
 */
import type { JSX } from 'preact';
import { GroupCard } from './ActRow.tsx';
import './skeleton.css';

export function Shim(p: { w: number | string; h: number; round?: boolean; navy?: boolean; r?: number }): JSX.Element {
  return (
    <span aria-hidden="true" class={'ow-shim' + (p.navy ? ' navy' : '')}
      style={{ width: typeof p.w === 'number' ? `${p.w}px` : p.w, height: `${p.h}px`, borderRadius: p.round ? '999px' : p.r != null ? `${p.r}px` : undefined, flex: p.round ? 'none' : undefined }} />
  );
}

/** The ring and the words of what is coming (role status). */
export function Loading(p: { text: string }): JSX.Element {
  return <span role="status" class="ow-loading"><span aria-hidden="true" />{p.text}</span>;
}

/** A section header while it loads: the title as a block, the loading words at the right. */
export function LoadingHead(p: { text: string }): JSX.Element {
  return <div class="ow-loadhead"><Shim w={120} h={12} /><Loading text={p.text} /></div>;
}

/** Customer rows (P10) as they will be: the ring, two lines, the amount, the disc. */
export function SkeletonRows(p: { rows?: number }): JSX.Element {
  return (
    <GroupCard>
      {Array.from({ length: p.rows || 2 }, (_, i) => (
        <div key={i} class="ow-skrow">
          <Shim w={44} h={44} round />
          <span class="ow-skrow-t"><Shim w="70%" h={12} /><Shim w="40%" h={10} /></span>
          <Shim w={44} h={12} />
          <span aria-hidden="true" class="ow-skrow-disc" />
        </div>
      ))}
    </GroupCard>
  );
}
