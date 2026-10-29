/*
 * P18 · The track head: where an order is (LANGUAGE.md §3 P18). On the
 * sheet's navy top, under a hairline: the stage word and its line, then one
 * rail through the five stages (Checking · Buying · Packing · On the road ·
 * Delivered); done stops ticked in mint, the stop it is on large and
 * glowing (amber when it waits on you), the ones to come outlined. Under
 * each, its name and when (mono) or "now".
 *
 *   <Track stage="packing" sub="Musa · since 10:05" times={{ checking: '9:14', buying: '9:31' }} />
 *   <Track stage="checking" waits sub="Not paid yet" />                 the now-stop amber
 *   <Track stage="delivered" sub="Collected 11:42" times={…} />          every stop ticked, the line full
 *
 * P18b · StageDots: the small dots of one order on a light card (a customer's orders).
 *   <StageDots stage="packing" ready={false} waits={false} />
 */
import type { JSX } from 'preact';
import { STAGES, STAGE_WORD } from '../core/names.ts';
import type { Stage } from '../core/types.ts';
import { Icon, STAGE_ICON } from './icons.tsx';
import { cx } from './util.tsx';
import './track.css';

export interface TrackProps {
  stage: Stage;
  sub: string;
  /** It waits on you (or on Ruth for you): the now-stop amber. */
  waits?: boolean;
  /** When each stage happened, "9:14". */
  times?: Partial<Record<Stage, string>>;
  /** The big word, when not the stage's own ("Ready to collect"). */
  word?: string;
}

export function Track(p: TrackProps): JSX.Element {
  const at = STAGES.indexOf(p.stage), done = p.stage === 'delivered';
  const t = p.times || {};
  return (
    <div class="ow-track">
      <div class="ow-track-h"><span class="ow-track-w">{p.word || STAGE_WORD[p.stage]}</span><span class="ow-track-s">{p.sub}</span></div>
      <div role="img" aria-label={`${STAGE_WORD[p.stage]}: step ${at + 1} of 5`} class="ow-rail">
        <div class="ow-rail-stops">
          <span aria-hidden="true" class="ow-rail-line" />
          {at > 0 && <span aria-hidden="true" class="ow-rail-line on" style={{ width: `${at * 20}%` }} />}
          {STAGES.map((s, i) => i < at || done
            ? <span key={s} class="ow-stop done"><Icon name="check" size={12} stroke={2.8} /></span>
            : i === at
              ? <span key={s} class={cx('ow-stop now', p.waits && 'waits')}><Icon name={STAGE_ICON[s]} size={16} stroke={2.2} /></span>
              : <span key={s} class="ow-stop next"><Icon name={STAGE_ICON[s]} size={12} stroke={2.2} /></span>)}
        </div>
        <div class="ow-rail-names">
          {STAGES.map((s, i) => (
            <span key={s} class={cx(i < at || done ? 'done' : i === at ? 'now' : '', i === at && p.waits && 'waits')}>
              <b class={s === 'road' ? 'nw' : undefined}>{STAGE_WORD[s]}</b>
              {i === at && !done ? <em>now</em> : <em class={t[s] ? 'mono' : undefined}>{t[s] || ''}</em>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** P18b · five 28 px dots on a light card: done navy with a tick, now ringed, to come dashed; names under. */
export function StageDots(p: { stage: Stage; waits?: boolean; ready?: boolean }): JSX.Element {
  const at = STAGES.indexOf(p.stage);
  return (
    <div role="img" aria-label={`${STAGE_WORD[p.stage]}: step ${at + 1} of 5`} class="ow-sdots">
      {STAGES.map((s, i) => (
        <span key={s} class={cx('ow-sdot', i < at ? 'done' : i === at ? 'now' : 'next', i === at && p.waits && 'waits', i === at && p.ready && 'ready')}>
          <span aria-hidden="true">{i < at ? <Icon name="check" size={13} stroke={3} /> : <Icon name={STAGE_ICON[s]} size={14} stroke={2} />}</span>
          <b>{STAGE_WORD[s]}</b>
        </span>
      ))}
    </div>
  );
}
