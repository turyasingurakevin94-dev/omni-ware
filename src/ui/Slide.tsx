/*
 * The slide (LANGUAGE.md §3 P15, P26: the default for money). A slide and
 * not a tap, because an order can be placed from a pocket by a tap and
 * cannot be by a slide (agent.html wireSlide). Drag the red knob; past 85%
 * of the way it commits, short of that it springs back; a tap without a
 * drag asks for the slide (onHint). A keyboard still presses it like any
 * button. While the commit runs the knob waits at the end.
 *
 *   <Slide label="Slide to place · 3 items" knobLabel="Place this order" onCommit={place} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
 *   state: 'ready' · 'sending' (the fill runs the width, "Sending…") · 'blocked' (grey knob: no customer)
 *          · 'offline' (grey knob, "Back online to sell") · 'empty' (glass knob with the basket)
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Duo, Icon, phBasket } from './icons.tsx';
import { cx } from './util.tsx';
import './slide.css';

export type SlideState = 'ready' | 'sending' | 'blocked' | 'offline' | 'empty';

export interface SlideProps {
  label: string;
  /** The knob's own name for a screen reader ("Place this order"). */
  knobLabel: string;
  onCommit: () => unknown;
  onHint?: () => void;
  state?: SlideState;
}

export function Slide(p: SlideProps): JSX.Element {
  const state = p.state || 'ready';
  const track = useRef<HTMLDivElement>(null), knob = useRef<HTMLButtonElement>(null), fill = useRef<HTMLSpanElement>(null);
  const [done, setDone] = useState(false);
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
    setDone(true);
    place(maxX(), true);
    Promise.resolve(p.onCommit()).catch(() => undefined).then(() => setDone(false));
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

  const words = state === 'sending' || done ? 'Sending…' : state === 'offline' ? 'Back online to sell' : p.label;
  return (
    <div ref={track} class={cx('ow-slide', 's-' + state, done && 's-sending')}>
      <span ref={fill} aria-hidden="true" class="ow-slide-fill" />
      <button ref={knob} type="button" class="ow-knob" aria-label={p.knobLabel} disabled={!live}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={(e) => { if ((e as MouseEvent).detail === 0 && live) commit(); }}>
        {state === 'empty' ? <Duo i={phBasket} size={22} color="#5C6788" /> : <Icon name="slide" size={22} stroke={2.4} />}
      </button>
      <span class="ow-slide-l" aria-hidden="true">{words}</span>
    </div>
  );
}
