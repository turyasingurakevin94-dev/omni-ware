/*
 * The slide (LANGUAGE.md §3 P15, P26: the default for money). A slide and
 * not a tap, because an order can be placed from a pocket by a tap and
 * cannot be by a slide (agent.html wireSlide). Drag the red knob; past 85%
 * of the way it commits, short of that it springs back; a tap without a
 * drag asks for the slide (onHint). A keyboard still presses it like any
 * button. While the commit runs the knob waits at the end.
 *
 *   <Slide label="Slide to place · 3 items" onCommit={place} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
 *   state: 'ready' · 'sending' (the fill runs the width, "Sending…") · 'blocked' (grey knob: no customer)
 *          · 'offline' (grey knob, "Back online to sell") · 'empty' (glass knob with the basket)
 *   lock: it cannot go yet, and the knob says why (the counter, KC07–KC18): a lock (Type the ID first,
 *         Ask Ruth first), an hourglass (Waiting for Ruth), no signal, the box in amber (1 short)
 *   <Slide … lock={{ icon: 'lock', label: 'Type the ID first' }} />
 *   <Slide … lock={{ icon: 'box', label: '1 short' }} />   <Slide … lock={{ icon: 'lock', label: 'Short · 2,000', amber: true }} />
 *   Sending (KC13): the fill runs the whole width, the knob waits at the end with a spinner.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Duo, Icon, phBasket, phBox } from './icons.tsx';
import { Keep, cx } from './util.tsx';
import './slide.css';

export type SlideState = 'ready' | 'sending' | 'blocked' | 'offline' | 'empty';

export interface SlideProps {
  /** The slide's words; they are its name too (P15: one control, named by what it says). */
  label: string;
  onCommit: () => unknown;
  onHint?: () => void;
  state?: SlideState;
  /** It cannot go yet: the knob says why, the label in #B3BCD2 (amber when short). */
  /** Why it cannot go yet; quiet: the paler track that says it when tapped (CU33, Take payment). */
  lock?: { icon: LockIcon; label: string; amber?: boolean; quiet?: boolean; onTap?: () => void };
}

export type LockIcon = 'lock' | 'hourglass' | 'offline' | 'box';

/** The words, then the figure that never shrinks. */
function Words(p: { label: string; class: string; read?: boolean }): JSX.Element {
  return <span class={p.class} aria-hidden={p.read ? undefined : 'true'}><Keep text={p.label} /></span>;
}

/** The slide that cannot go yet (the knob grey, its icon saying why). */
function Locked(p: { icon: LockIcon; label: string; amber?: boolean; quiet?: boolean; onTap?: () => void }): JSX.Element {
  const knob = p.icon === 'box' ? <Duo i={phBox} size={22} color="#F5B26B" />
    : <Icon name={p.icon} size={20} stroke={2} style={{ color: p.quiet ? '#FFFFFF' : p.icon === 'lock' ? '#DDE3F0' : '#F5B26B' }} />;
  return (
    <button type="button" class={cx('ow-lslide', p.quiet && 'quiet')} disabled={!p.onTap} aria-disabled="true" onClick={p.onTap}>
      <span aria-hidden="true" class="ow-lslide-k">{knob}</span>
      <Words class={cx('ow-lslide-l', p.amber && 'amber')} label={p.label} read />
    </button>
  );
}

/** Sending (KC13): the fill the whole width, "Sending…", the knob at the end with a spinner. */
function Sending(): JSX.Element {
  return (
    <div role="status" class="ow-sslide">
      <span aria-hidden="true" class="ow-sslide-f" />
      <span class="ow-sslide-l">Sending…</span>
      <span aria-hidden="true" class="ow-sslide-k">
        <svg width="22" height="22" viewBox="0 0 24 24" class="ow-sslide-spin"><circle cx="12" cy="12" r="8.5" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.6" /><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" /></svg>
      </span>
    </div>
  );
}

export function Slide(p: SlideProps): JSX.Element {
  const state = p.state || 'ready';
  const track = useRef<HTMLDivElement>(null), knob = useRef<HTMLButtonElement>(null), fill = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(false);
  // One commit per press (SAL-4): a second Enter or click in the same moment, before the re-render, is dropped.
  const fired = useRef(false);
  const live = state === 'ready' && !done;
  const drag = useRef({ x0: 0, dx: 0, max: 0, on: false, moved: false });

  const place = (x: number, anim: boolean) => {
    const k = knob.current, f = fill.current;
    if (!k || !f) return;
    k.style.transition = anim ? 'transform .25s' : 'none';
    f.style.transition = anim ? 'width .25s' : 'none';
    k.style.transform = x ? `translateX(${x}px)` : '';
    f.style.width = x ? `${50 + x}px` : '';
  };
  const maxX = () => (track.current && knob.current ? track.current.clientWidth - knob.current.offsetWidth - 10 : 0);

  // Sending: the knob at the end. Back to ready: it springs home.
  useEffect(() => {
    if (state === 'sending') place(maxX(), true);
    else if (!done) place(0, true);
  }, [state, done]);

  const commit = () => {
    if (fired.current) return;
    fired.current = true;
    setDone(true);
    place(maxX(), true);
    Promise.resolve(p.onCommit()).catch(() => undefined).then(() => { fired.current = false; setDone(false); });
  };

  const down = (e: PointerEvent) => {
    if (!live) return;
    const d = drag.current;
    d.on = true; d.moved = false; d.dx = 0; d.x0 = e.clientX; d.max = maxX();
    if (knob.current) knob.current.style.animation = 'none';
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch (_e) { /* capture is a nicety */ }
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d.on) return;
    d.dx = Math.max(0, Math.min(d.max, e.clientX - d.x0));
    if (d.dx > 6) d.moved = true;
    place(d.dx, false);
  };
  const up = () => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    if (knob.current) knob.current.style.animation = '';
    if (d.max > 0 && d.dx >= d.max * 0.85) commit();
    else { place(0, true); if (!d.moved && p.onHint) p.onHint(); }
  };

  // The slide is one control named by its words (P15): the knob carries them, the drawn words are not read twice.
  const words = state === 'sending' || done ? 'Sending…' : state === 'offline' ? 'Back online to sell' : p.label;
  if (state === 'sending' || done) return <Sending />;
  if (p.lock) return <Locked {...p.lock} />;
  return (
    <div ref={track} class={cx('ow-slide', 's-' + state)}>
      <span ref={fill} aria-hidden="true" class="ow-slide-fill" />
      <button ref={knob} type="button" class="ow-knob" aria-label={words} disabled={!live}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={(e) => { if ((e as MouseEvent).detail === 0 && live) commit(); }}>
        {state === 'empty' ? <Duo i={phBasket} size={22} color="#5C6788" /> : <Icon name="slide" size={22} stroke={2.4} />}
      </button>
      <Words class="ow-slide-l" label={words} />
    </div>
  );
}
