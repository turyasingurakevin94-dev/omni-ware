/*
 * P07 · "On the move" stage tiles (LANGUAGE.md §3 P07): the four live
 * stages as tiles in one white card, who is in each as faces, a dot when a
 * stage holds something of a kind, a numbered badge for how many need you.
 * The rows under the tiles are MiniRows (ActRow.tsx).
 *
 *   <StageTiles tiles={[
 *     { stage: 'checking', count: 3, faces: [...], need: 1, mark: 'money', on: … },
 *     { stage: 'packing', count: 4, faces: [...], more: 2, mark: 'late', on: … }, …]}>
 *     <MiniRow … />
 *   </StageTiles>
 *   <GhostTiles title="On the move" meta="fills as you sell" />    P24: the same card drawn as an outline
 */
import type { ComponentChildren, JSX } from 'preact';
import { STAGE_WORD } from '../core/names.ts';
import type { Stage } from '../core/types.ts';
import { FaceStack, type Face } from './Avatar.tsx';
import { Icon, STAGE_ICON } from './icons.tsx';
import { Tap } from './util.tsx';
import './stagetiles.css';

/** What a stage holds that matters: money to take (amber), ready (green), late (crimson). */
export type StageMark = 'money' | 'ready' | 'late';
const MARK: Record<StageMark, string> = { money: '#95530C', ready: '#0F6B43', late: '#8E2A22' };

export interface StageTile {
  stage: Stage;
  count: number;
  faces: Face[];
  /** "+2" after three faces. */
  more?: number;
  mark?: StageMark;
  /** How many need you: a badge in the mark's tone (amber when no mark). */
  need?: number;
  /** aria-label, e.g. "3 checking, 1 needs you". */
  label?: string;
  on: () => void;
}

export function StageTiles(p: { tiles: StageTile[]; children?: ComponentChildren }): JSX.Element {
  return (
    <div class="ow-stiles">
      <div class="ow-stiles-grid">
        {p.tiles.map((t) => {
          const zero = t.count === 0, tone = MARK[t.mark || 'money'];
          return (
            <Tap key={t.stage} on={t.on} class="ow-stile" label={t.label || `${t.count} ${STAGE_WORD[t.stage].toLowerCase()}${t.need ? `, ${t.need} need${t.need === 1 ? 's' : ''} you` : ''}`}>
              {t.need ? <span aria-hidden="true" class="ow-stile-need mono" style={{ background: tone }}>{t.need}</span>
                : t.mark && <span aria-hidden="true" class="ow-stile-dot" style={{ background: tone }} />}
              <span class="ow-stile-n"><Icon name={STAGE_ICON[t.stage]} size={15} stroke={1.9} /><span class="mono" style={zero ? { color: '#5F6980' } : undefined}>{t.count}</span></span>
              <span class="ow-stile-l">{STAGE_WORD[t.stage]}</span>
              {!zero && <FaceStack faces={t.faces} more={t.more} />}
            </Tap>
          );
        })}
      </div>
      {p.children}
    </div>
  );
}

/** P24 · the ghost of "On the move": the real card drawn dashed, its tiles as dashed outlines, nothing in them yet. */
export function GhostTiles(p: { title: string; meta: string; stages?: Stage[] }): JSX.Element {
  const st = p.stages || (['checking', 'buying', 'packing', 'road'] as Stage[]);
  return (
    <div class="ow-ghost">
      <div class="ow-ghost-h"><span>{p.title}</span><span>{p.meta}</span></div>
      <div aria-hidden="true" class="ow-ghost-grid">
        {st.map((s) => <span key={s}><Icon name={STAGE_ICON[s]} size={16} />{STAGE_WORD[s]}</span>)}
      </div>
    </div>
  );
}
