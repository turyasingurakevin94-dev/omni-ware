/*
 * S08 · Day blocks: one customer's rhythm (LANGUAGE.md §5.2 S08). A block
 * per day since their last order: grey inside their rhythm, an ink bar
 * where it ran out, amber for each day past it, dashed for days still
 * ahead. Labels under: the last order, when it was due, today.
 *
 *   <DayBlocks title="Kyaligonza · every 14 days" pill="4 days late" rhythm={14} late={4}
 *     labels={['29 Sep', 'due 13 Oct', 'today']} label="Last order Tue 29 Sep, due Tue 13 Oct, 4 days late" />
 *   ahead={3}: not due yet, three dashed days to go.  onNavy: amber #F5B26B on a navy head.
 */
import type { JSX } from 'preact';
import { StatusPill } from './Pill.tsx';
import { cx } from './util.tsx';
import './dayblocks.css';

export interface DayBlocksProps {
  title?: string;
  pill?: string;
  /** Days inside the rhythm since the last order. */
  rhythm: number;
  /** Days past it. */
  late?: number;
  /** Days still ahead before it is due. */
  ahead?: number;
  labels: [string, string, string];
  label: string;
  onNavy?: boolean;
}

export function DayBlocks(p: DayBlocksProps): JSX.Element {
  const late = p.late || 0, ahead = p.ahead || 0;
  const strip = (
    <>
      <div role="img" aria-label={p.label} class="ow-days-strip">
        {Array.from({ length: p.rhythm }, (_, i) => <span key={'r' + i} />)}
        {(late > 0 || ahead === 0) && <span class="due" />}
        {Array.from({ length: late }, (_, i) => <span key={'l' + i} class="late" />)}
        {Array.from({ length: ahead }, (_, i) => <span key={'a' + i} class="ahead" />)}
      </div>
      <div class="ow-days-l"><span>{p.labels[0]}</span><span>{p.labels[1]}</span><span class={late ? 'late' : undefined}>{p.labels[2]}</span></div>
    </>
  );
  if (!p.title) return <div class={cx('ow-days bare', p.onNavy && 'navy')}>{strip}</div>;
  return (
    <div class={cx('ow-days', p.onNavy && 'navy')}>
      <div class="ow-days-h"><span>{p.title}</span>{p.pill && <StatusPill tone={late ? 'caution' : 'neutral'}>{p.pill}</StatusPill>}</div>
      {strip}
    </div>
  );
}
