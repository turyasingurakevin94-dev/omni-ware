/*
 * P17 · The bottom sheet over navy (LANGUAGE.md §3 P17): the host, the
 * light sheet, and the pull-down that closes a sheet the way a phone's own
 * sheets go (agent.html sheetDrag): from the handle and header at any time,
 * or from anywhere once what is under the finger is scrolled to its top.
 * Past a third of its height, or a quick flick, it goes; short of that it
 * springs back. Fields keep their own drags. Escape, the scrim and the
 * phone's back close it too.
 *
 *   sheet.open(() => <LightSheet title="Who is it for?" onClose={sheet.close}>…</LightSheet>, { label: 'Who is it for?' })
 *   sheet.close()
 *   <LightSheet eyebrow="ORDER #0552 · KATO CONSTRUCTION" title="Something wrong" onClose={…} foot={<Button>…</Button>}>…</LightSheet>
 *
 * A full sheet about one thing (an order, a customer, a chat) is FullSheet.tsx.
 */
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX, RefObject, VNode } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './icons.tsx';
import { cx } from './util.tsx';
import './sheet.css';

interface Open {
  render: () => VNode;
  label: string;
  /** How far down the sheet starts (a light sheet's top at 300 of 800). null: it sizes to its content. */
  top: number | null;
  onClose: (() => void) | null;
}

const current = signal<Open | null>(null);

export const sheet = {
  open(render: () => VNode, o: { label: string; top?: number | null; onClose?: () => void } = { label: 'Sheet' }): void {
    current.value = { render, label: o.label, top: o.top ?? null, onClose: o.onClose ?? null };
  },
  close(): void {
    const c = current.value;
    current.value = null;
    if (c && c.onClose) c.onClose();
  },
  get isOpen(): boolean {
    return current.value != null;
  },
};

/**
 * Pull down to close (agent.html sheetDrag). `el` moves; `scrim` (optional) fades with it.
 * Touch only, as the agent's: a mouse drags from the grabber band instead (`grab`).
 */
export function useDragClose(el: RefObject<HTMLElement>, onClose: () => void, scrim?: RefObject<HTMLElement>, when?: unknown): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const s = el.current;
    if (!s) return undefined;
    let y0 = 0, x0 = 0, t0 = 0, dy = 0, on = false, decided = false;
    const scrolledInside = (n: Node | null): boolean => {
      for (; n && n.nodeType === 1; n = n.parentNode) { if ((n as HTMLElement).scrollTop > 0) return true; if (n === s) break; }
      return false;
    };
    const fade = (k: number) => { if (scrim && scrim.current) scrim.current.style.opacity = String(Math.max(0, k)); };
    const start = (e: TouchEvent) => {
      on = false;
      if (e.touches.length !== 1 || (e.target as Element).closest('input, textarea, select, [contenteditable]')) return;
      const t = e.touches[0];
      on = t.clientY - s.getBoundingClientRect().top < 72 || !scrolledInside(e.target as Node);
      y0 = t.clientY; x0 = t.clientX; t0 = Date.now(); dy = 0; decided = false;
    };
    const move = (e: TouchEvent) => {
      if (!on) return;
      const t = e.touches[0], my = t.clientY - y0, mx = t.clientX - x0;
      if (!decided) {
        if (Math.abs(my) < 6 && Math.abs(mx) < 6) return;
        decided = true;
        if (my <= 0 || Math.abs(mx) > Math.abs(my)) { on = false; return; }
        s.style.animation = 'none'; s.style.transition = 'none';
      }
      e.preventDefault();
      dy = Math.max(0, my);
      s.style.transform = `translateY(${dy}px)`;
      fade(1 - dy / s.offsetHeight);
    };
    const end = () => {
      if (!on || !decided) { on = false; return; }
      on = false;
      const flick = dy / Math.max(1, Date.now() - t0) > 0.6 && dy > 40;
      s.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
      if (dy > s.offsetHeight / 3 || flick) {
        s.style.transform = 'translateY(100%)'; fade(0);
        window.setTimeout(() => close.current(), 200);
      } else {
        s.style.transform = ''; fade(1);
      }
    };
    s.addEventListener('touchstart', start, { passive: true });
    s.addEventListener('touchmove', move, { passive: false });
    s.addEventListener('touchend', end);
    s.addEventListener('touchcancel', end);
    return () => {
      s.removeEventListener('touchstart', start);
      s.removeEventListener('touchmove', move);
      s.removeEventListener('touchend', end);
      s.removeEventListener('touchcancel', end);
    };
  }, [when]);
}

export function SheetHost(): JSX.Element | null {
  const c = current.value;
  const box = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  useDragClose(box, () => sheet.close(), scrim, c);
  useEffect(() => {
    if (!c) return undefined;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') sheet.close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [c]);
  if (!c) return null;
  return (
    <div class="ow-sheet-layer">
      <div ref={scrim} class="ow-scrim" aria-hidden="true" onClick={() => sheet.close()} />
      <div ref={box} class="ow-sheet" role="dialog" aria-modal="true" aria-label={c.label} style={c.top != null ? { top: `${c.top}px` } : undefined}>
        {c.render()}
      </div>
    </div>
  );
}

export interface LightSheetProps {
  title: string;
  /** "ORDER #0552 · KATO CONSTRUCTION" above the title. */
  eyebrow?: string;
  onClose: () => void;
  /** The body's padding (16 by default; the price sheet's "10px 16px 20px"). */
  pad?: string;
  gap?: number;
  /** The one button, pinned to the bottom. */
  foot?: ComponentChildren;
  /** #F7F5F2 instead of white. */
  ground?: boolean;
  class?: string;
  children: ComponentChildren;
}

/** P17 · a light sheet: the grabber (a 24 px band that closes), the title 22/700 and a 44 px ×, the body, the one button last. */
export function LightSheet(p: LightSheetProps): JSX.Element {
  return (
    <div class={cx('ow-lsheet', p.ground && 'ground', p.class)}>
      <button type="button" class="ow-grab" aria-label="Close" onClick={p.onClose} />
      <div class="ow-lsheet-h">
        <div class="ow-lsheet-ht">
          {p.eyebrow && <span class="ow-lsheet-eye">{p.eyebrow}</span>}
          <h2>{p.title}</h2>
        </div>
        <button type="button" class="ow-x-tile" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="ow-lsheet-b" style={{ padding: p.pad, gap: p.gap != null ? `${p.gap}px` : undefined }}>
        {p.children}
        {p.foot && <div class="ow-lsheet-foot">{p.foot}</div>}
      </div>
    </div>
  );
}
