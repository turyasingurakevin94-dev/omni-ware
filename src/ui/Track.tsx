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
 *   <Track stage="packing" skipped={['checking', 'buying']} … />          all on our shelf: those stops a dash, "skipped"
 *
 * P18b · StageDots: the small dots of one order on a light card (a customer's orders).
 *   <StageDots stage="packing" ready={false} waits={false} />
 *
 * P18c · Steps: a few named steps on a light card (the counter's ask).
 *   <Steps steps={[{ word: 'Ask', icon: 'send', state: 'done' }, { word: 'Ruth decides', icon: 'clock', state: 'now' }, { word: 'They pay', icon: 'cash', state: 'next' }]} />
 */
import type { JSX } from 'preact';
import { STAGES, STAGE_WORD } from '../core/names.ts';
import type { Stage } from '../core/types.ts';
import { Avatar, type Face } from './Avatar.tsx';
import { Icon, STAGE_ICON, type IconName } from './icons.tsx';
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
  /** Stages it skipped (all on our shelf: Checking and Buying, OR11, OR19): a dash, and "skipped" under. */
  skipped?: Stage[];
}

export function Track(p: TrackProps): JSX.Element {
  const at = STAGES.indexOf(p.stage), done = p.stage === 'delivered';
  const t = p.times || {}, sk = p.skipped || [];
  return (
    <div class="ow-track">
      <div class="ow-track-h"><span class="ow-track-w">{p.word || STAGE_WORD[p.stage]}</span><span class="ow-track-s">{p.sub}</span></div>
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

/**
 * P18b · five 28 px dots on a light card: done navy with a tick, now ringed, to come dashed, skipped
 * a dash on a grey disc; names under. all: every stop done (delivered).
 */
export function StageDots(p: { stage: Stage; waits?: boolean; ready?: boolean; skipped?: Stage[]; all?: boolean }): JSX.Element {
  const at = STAGES.indexOf(p.stage), sk = p.skipped || [];
  return (
    <div role="img" aria-label={`${STAGE_WORD[p.stage]}: step ${at + 1} of 5`} class="ow-sdots">
      {STAGES.map((s, i) => {
        const k = sk.includes(s) ? 'skip' : i < at || p.all ? 'done' : i === at ? 'now' : 'next';
        return (
          <span key={s} class={cx('ow-sdot', k, k === 'now' && p.waits && 'waits', k === 'now' && p.ready && 'ready')}>
            <span aria-hidden="true">{k === 'skip' ? <Icon name="minus" size={12} stroke={2.6} /> : k === 'done' ? <Icon name="check" size={12} stroke={3} /> : <Icon name={STAGE_ICON[s]} size={13} stroke={2} />}</span>
            <b>{STAGE_WORD[s]}</b>
          </span>
        );
      })}
    </div>
  );
}

export interface Step { word: string; icon: IconName; state: 'done' | 'now' | 'next' }

/** P18c · three steps on a light card (KC10/KC11: Ask · Ruth decides · They pay); the green part of the rail runs to the step that is now. */
export function Steps(p: { steps: Step[] }): JSX.Element {
  const now = p.steps.findIndex((s) => s.state === 'now');
  return (
    <div role="list" aria-label="Steps" class="ow-steps">
      <span aria-hidden="true" class="ow-steps-rail"><span style={{ width: `${Math.max(0, now) * 50}%` }} /></span>
      {p.steps.map((s) => (
        <span key={s.word} role="listitem" class={'ow-step-i ' + s.state}>
          <span class="ow-step-d">
            {s.state === 'done' ? <Icon name="check" size={14} stroke={3.2} /> : <Icon name={s.icon} size={s.state === 'now' ? 15 : 14} stroke={s.state === 'now' ? 2.2 : 2} />}
          </span>
          <span class="ow-step-w">{s.word}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * P18d · one step of an ask, down a light card (OR22 a return asked, OR27 paid over): done a green tick,
 * the one deciding their face glowing in amber, to come a dashed disc; a line down to the next step.
 *   <AskStep mark="ok" title="You asked" sub="2 sheets · bent · 10:14" line />
 *   <AskStep mark={ruthFace} title="Ruth checks it" sub="then the credit note, 76,000" tone="warn" />
 */
export function AskStep(p: { mark: 'ok' | 'to' | Face; title: string; sub: string; line?: boolean; tone?: 'warn' | 'soft' }): JSX.Element {
  const m = p.mark;
  return (
    <div class="ow-astep">
      {m === 'ok' ? <span aria-hidden="true" class="ow-astep-ok"><Icon name="check" size={13} stroke={3} /></span>
        : m === 'to' ? <span aria-hidden="true" class="ow-astep-to" />
          : <span aria-hidden="true" class="ow-astep-face"><Avatar {...m} size={28} font={11} style={{ boxShadow: '0 0 0 2px #F5B26B', letterSpacing: '-.04em' }} /></span>}
      {p.line && <span aria-hidden="true" class="ow-astep-line" />}
      <span class={cx('ow-astep-t', p.tone)}><span>{p.title}</span><span>{p.sub}</span></span>
    </div>
  );
}
