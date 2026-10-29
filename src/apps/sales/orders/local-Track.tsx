/*
 * A local variant of P18 (src/ui/Track.tsx) and P18b (StageDots), for the lead to fold in: a stage
 * an order skipped (all on our shelf: Checking and Buying, OR11, OR19) is drawn as a stop to come
 * with a dash and the word "skipped" under it. Everything else is the part's own, class for class.
 */
import type { JSX } from 'preact';
import { STAGES, STAGE_WORD } from '../../../core/names.ts';
import type { Stage } from '../../../core/types.ts';
import { Icon, STAGE_ICON } from '../../../ui/icons.tsx';
import { cx } from '../../../ui/util.tsx';
import '../../../ui/track.css';

export interface TrackProps {
  stage: Stage;
  sub: string;
  waits?: boolean;
  times?: Partial<Record<Stage, string>>;
  skipped?: Stage[];
}

export function Track(p: TrackProps): JSX.Element {
  const at = STAGES.indexOf(p.stage), done = p.stage === 'delivered', t = p.times || {}, sk = p.skipped || [];
  return (
    <div class="ow-track">
      <div class="ow-track-h"><span class="ow-track-w">{STAGE_WORD[p.stage]}</span><span class="ow-track-s">{p.sub}</span></div>
      <div role="img" aria-label={`${STAGE_WORD[p.stage]}: step ${at + 1} of 5`} class="ow-rail">
        <div class="ow-rail-stops">
          <span aria-hidden="true" class="ow-rail-line" />
          {at > 0 && <span aria-hidden="true" class="ow-rail-line on" style={{ width: `${at * 20}%` }} />}
          {STAGES.map((s, i) => sk.includes(s)
            ? <span key={s} class="ow-stop next"><Icon name="minus" size={12} stroke={2.2} /></span>
            : i < at || done
              ? <span key={s} class="ow-stop done"><Icon name="check" size={12} stroke={2.8} /></span>
              : i === at
                ? <span key={s} class={cx('ow-stop now', p.waits && 'waits')}><Icon name={STAGE_ICON[s]} size={16} stroke={2.2} /></span>
                : <span key={s} class="ow-stop next"><Icon name={STAGE_ICON[s]} size={12} stroke={2.2} /></span>)}
        </div>
        <div class="ow-rail-names">
          {STAGES.map((s, i) => (
            <span key={s} class={cx(sk.includes(s) ? '' : i < at || done ? 'done' : i === at ? 'now' : '', i === at && p.waits && 'waits')}>
              <b class={s === 'road' ? 'nw' : undefined}>{STAGE_WORD[s]}</b>
              {sk.includes(s) ? <em>skipped</em> : i === at && !done ? <em>now</em> : <em class={t[s] ? 'mono' : undefined}>{t[s] || ''}</em>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** P18b with skipped stops: a dash on the dashed disc. */
export function StageDots(p: { stage: Stage; skipped?: Stage[]; all?: boolean }): JSX.Element {
  const at = STAGES.indexOf(p.stage), sk = p.skipped || [];
  return (
    <div role="img" aria-label={`${STAGE_WORD[p.stage]}: step ${at + 1} of 5`} class="ow-sdots">
      {STAGES.map((s, i) => {
        const k = sk.includes(s) ? 'skip' : i < at || p.all ? 'done' : i === at ? 'now' : 'next';
        return (
          <span key={s} class={cx('ow-sdot', k)}>
            <span aria-hidden="true">{k === 'skip' ? <Icon name="minus" size={13} stroke={2.4} /> : k === 'done' ? <Icon name="check" size={13} stroke={3} /> : <Icon name={STAGE_ICON[s]} size={14} stroke={2} />}</span>
            <b>{STAGE_WORD[s]}</b>
          </span>
        );
      })}
    </div>
  );
}
