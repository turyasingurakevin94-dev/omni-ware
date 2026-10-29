/*
 * P22 · The full-screen "Sent" moment (LANGUAGE.md §3 P22; as built: SL28
 * "Placed", CU40 "Paid", KC14 "Sold"), and the end-of-flow block every
 * such screen ends with: ONE white button, one label, the same on every
 * screen, "Back to Today", over a 4 px mint bar that goes back by itself.
 * A second, quieter move is a glass pill above it, never a second button.
 *
 *   <Moment title="Placed" onClose={nav.home}
 *     who={{ face: { initials: 'KC', tint: 't0' }, name: 'Kato Construction', ref: '#0560', on: openOrder, label: 'Open #0560' }}
 *     note={{ duo: phWhatsapp, text: 'Picture sent to Kato' }}
 *     items={{ aisles: ['Roofing', 'Cement', 'Doors & locks'], title: '3 items · pickup', sub: 'Not paid yet', amount: 2190000 }}
 *     next={[{ icon: 'checking', title: 'Checking', sub: 'now · Moses finds the cost · Ruth prices it' }, …]}
 *     end={<EndOfFlow on={nav.home} ms={8000} quiet={{ label: 'Sell again', on: … }} />} />
 */
import { Fragment, type ComponentChildren, type JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Avatar, type Face } from './Avatar.tsx';
import { Duo, Icon, type IconName } from './icons.tsx';
import { ItemSquare } from './ItemSquare.tsx';
import { fig } from './Money.tsx';
import { Tap, cx, type Fig } from './util.tsx';
import './moment.css';

export interface MomentProps {
  title: string;
  onClose?: () => void;
  who: { face: Face; name: string; ref: string; on?: () => void; label?: string };
  /** A line in mint under the who chip ("Picture sent to Kato"). */
  note?: { duo?: string; text: string };
  /** What went: the item squares stacked, the words, the amount. */
  items?: { aisles: string[]; title: string; sub?: string; amount: Fig };
  /** "What happens next": the first step is now (mint). */
  next?: { icon: IconName; title: string; sub: string }[];
  end: ComponentChildren;
  /** Drawn as a card (the parts gallery) instead of the whole screen. */
  card?: boolean;
}

export function Moment(p: MomentProps): JSX.Element {
  return (
    <div class={cx('ow-moment', p.card && 'card')}>
      {p.onClose && <div class="ow-moment-x"><button type="button" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button></div>}
      <div class="ow-moment-top">
        <span aria-hidden="true" class="ow-moment-tick"><Icon name="check" size={46} stroke={2.8} /></span>
        <h1>{p.title}</h1>
        <button type="button" class="ow-moment-who" aria-label={p.who.label} onClick={p.who.on}>
          <Avatar {...p.who.face} size={30} font={11} />
          <span class="ow-moment-who-n">{p.who.name}</span>
          <span class="mono ow-moment-who-r">{p.who.ref}</span>
          {p.who.on && <span class="ow-moment-who-go"><Icon name="chevron-right" size={14} stroke={2.4} /></span>}
        </button>
        {p.note && (
          <span class="ow-moment-note">
            {p.note.duo && <Duo i={p.note.duo} size={16} color="#6FDCB0" />}{p.note.text}<Icon name="check" size={14} stroke={2.8} />
          </span>
        )}
      </div>
      {p.items && (
        <div class="ow-moment-items">
          <span aria-hidden="true" class="ow-moment-sq">
            {p.items.aisles.slice(0, 3).map((a, i) => i ? <span key={i} class="ow-moment-sq-r"><ItemSquare aisle={a} size={32} radius={10} icon={20} /></span> : <ItemSquare key={i} aisle={a} size={32} radius={10} icon={20} />)}
          </span>
          <span class="ow-moment-items-t"><span>{p.items.title}</span>{p.items.sub && <span>{p.items.sub}</span>}</span>
          <span class="mono ow-moment-items-a">{fig(p.items.amount)}</span>
        </div>
      )}
      {p.next && p.next.length > 0 && <WhatsNext steps={p.next} />}
      {p.end}
    </div>
  );
}

/** "What happens next": a glass card of steps, the first (now) in mint, joined by a short line. */
export function WhatsNext(p: { steps: { icon: IconName; title: string; sub: string }[]; title?: string }): JSX.Element {
  return (
    <div class="ow-next-steps">
      <span class="ow-next-steps-h">{p.title || 'What happens next'}</span>
      {p.steps.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true" class="ow-next-steps-line" />}
          <div class="ow-next-step">
            <span aria-hidden="true" class={cx('ow-next-step-sq', i === 0 && 'now')}><Icon name={s.icon} size={20} stroke={i === 0 ? 2 : 1.9} /></span>
            <span class="ow-next-step-t"><span>{s.title}</span><span>{s.sub}</span></span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

export interface EndOfFlowProps {
  /** "Back to Today", always. */
  label?: string;
  on: () => void;
  /** Goes back by itself after this long (the mint bar runs it); 0: it waits. */
  ms?: number;
  /** The bar drawn still at this % (the parts gallery). */
  pct?: number;
  /** The quieter second move, a glass pill above. */
  quiet?: { label: string; icon?: IconName; on: () => void };
}

/** The end of every flow: one white button, one label, and the mint bar that returns to Today by itself. */
export function EndOfFlow(p: EndOfFlowProps): JSX.Element {
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!p.ms) return undefined;
    const raf = requestAnimationFrame(() => setRun(true));
    const t = window.setTimeout(p.on, p.ms);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [p.ms]);
  const w = p.ms ? (run ? '100%' : '0%') : `${p.pct ?? 0}%`;
  return (
    <div class="ow-end">
      {p.quiet && <button type="button" class="ow-end-quiet" onClick={p.quiet.on}>{p.quiet.icon && <Icon name={p.quiet.icon} size={16} stroke={2.2} />}{p.quiet.label}</button>}
      <Tap on={p.on} class="ow-end-btn">{p.label || 'Back to Today'}</Tap>
      <span aria-hidden="true" class="ow-end-bar"><span style={{ width: w, transition: p.ms ? `width ${p.ms}ms linear` : undefined }} /></span>
    </div>
  );
}
