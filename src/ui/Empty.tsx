/*
 * P24 · The empty state, the agent's way (LANGUAGE.md §3 P24; as built:
 * OR04, CH06, CU06). Never a blank screen with a sentence: a ghost of what
 * is coming (GhostTiles, or any real card drawn dashed), a checklist of the
 * first moves (one done, the next one live), then one way in.
 *
 *   <EmptyState ghost={<GhostTiles title="On the move" meta="fills as you sell" />}
 *     title="Get going" steps={[
 *       { done: true, title: 'Add your customers', sub: '38 customers · done' },
 *       { icon: 'plus', title: 'Place an order', sub: 'with the red + · it shows here', on: … }, …]}
 *     way={{ label: 'New order', icon: 'plus', on: … }} />
 */
import type { ComponentChildren, JSX } from 'preact';
import { GroupCard } from './ActRow.tsx';
import { Button } from './Button.tsx';
import { Icon, type IconName } from './icons.tsx';
import { SectionHead } from './SectionHead.tsx';
import { Tap } from './util.tsx';
import './empty.css';

export interface FirstMove {
  done?: boolean;
  icon?: IconName;
  /** The icon's stroke (2.2 for a +, 2 for the others). */
  stroke?: number;
  title: string;
  sub: string;
  on?: () => void;
}

/** "Get going": a white group card of 60 px rows; done struck through, the next ones live with a chevron. */
export function Checklist(p: { steps: FirstMove[] }): JSX.Element {
  return (
    <GroupCard pad={14}>
      {p.steps.map((s, i) => {
        const inner = (
          <>
            <span aria-hidden="true" class={'ow-step-disc' + (s.done ? ' done' : '')}>
              {s.done ? <Icon name="check" size={14} stroke={3} /> : s.icon && <Icon name={s.icon} size={15} stroke={s.stroke || 2.2} />}
            </span>
            <span class="ow-step-t"><span>{s.title}</span><span>{s.sub}</span></span>
            {!s.done && <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>}
          </>
        );
        return s.done || !s.on
          ? <div key={i} class={'ow-step' + (s.done ? ' done' : '')}>{inner}</div>
          : <Tap key={i} on={s.on} class="ow-step">{inner}</Tap>;
      })}
    </GroupCard>
  );
}

export interface EmptyStateProps {
  ghost: ComponentChildren;
  title?: string;
  steps?: FirstMove[];
  way: { label: string; icon?: IconName; on: () => void };
}

export function EmptyState(p: EmptyStateProps): JSX.Element {
  const done = (p.steps || []).filter((s) => s.done).length;
  return (
    <div class="ow-empty">
      {p.ghost}
      {p.steps && p.steps.length > 0 && <SectionHead title={p.title || 'Get going'} meta={`${done} of ${p.steps.length}`} metaTone="good" after />}
      {p.steps && p.steps.length > 0 && <Checklist steps={p.steps} />}
      <Button icon={p.way.icon} stroke={2.4} onClick={p.way.on}>{p.way.label}</Button>
    </div>
  );
}
