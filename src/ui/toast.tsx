/*
 * P28 · Toasts (LANGUAGE.md §3 P28): the host and the toast itself. Top
 * centre, 14 px down, navy with a mint tick; warn is sand with a brown "!";
 * an Undo toast keeps a 44 px mint "Undo" for 10 seconds (GLOSSARY "Undo"),
 * and Undo runs the undo; an error sits at the bottom, above the tab bar or
 * the dock, as a white card with "Try again" and a 44 px ×.
 *
 *   toast.show('Added 40 bags', { undo: () => … })
 *   toast.show('No signal', { kind: 'warn' })
 *   toast.show('Not sent', { kind: 'error', sub: 'The server said …', retry: () => … })
 *   <ToastView text="Added 40 bags" undo={…} inline />      the toast drawn in place (the parts gallery)
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { Icon } from './icons.tsx';
import { Keep, cx } from './util.tsx';
import './toast.css';

type Kind = 'ok' | 'warn' | 'error';
interface Toast { id: number; text: string; kind: Kind; sub: string; undo: (() => void) | null; retry: (() => void) | null }

const current = signal<Toast | null>(null);
let n = 0, timer = 0;

export const toast = {
  show(text: string, o: { kind?: Kind; sub?: string; undo?: () => void; retry?: () => void; ms?: number } = {}): void {
    const t: Toast = { id: ++n, text, kind: o.kind || 'ok', sub: o.sub || '', undo: o.undo || null, retry: o.retry || null };
    current.value = t;
    clearTimeout(timer);
    const ms = o.ms ?? (t.undo ? 10000 : t.kind === 'error' ? 8000 : 3200);
    timer = window.setTimeout(() => { if (current.value && current.value.id === t.id) current.value = null; }, ms);
  },
  hide(): void {
    current.value = null;
  },
  /** What is showing (for tests and the parts gallery). */
  get text(): string | null {
    return current.value ? current.value.text : null;
  },
};

export interface ToastViewProps {
  text: string;
  kind?: Kind;
  sub?: string;
  undo?: (() => void) | null;
  retry?: (() => void) | null;
  /** Drawn in place instead of fixed to the screen. */
  inline?: boolean;
  /** How far above the bottom an error sits (the tab bar 84, the dock, or 0). */
  above?: number;
  onClose?: () => void;
}

/** How far inside the screen's edge a toast's last part must end (the boards' toasts reach within 3 px of it). */
const EDGE = 1;

export function ToastView(p: ToastViewProps): JSX.Element {
  const close = p.onClose || (() => toast.hide());
  // With large text or long words the toast would run past the screen and take Undo with it: the words give way (…).
  const words = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const w = words.current, box = w && w.parentElement;
    if (!w || !box) return;
    w.style.maxWidth = '';
    const right = Math.max(...[...box.children].map((c) => c.getBoundingClientRect().right)), left = box.getBoundingClientRect().left;
    const over = Math.max(right - (window.innerWidth - EDGE), EDGE - left);
    if (over > 0) w.style.maxWidth = `${Math.max(40, w.getBoundingClientRect().width - over)}px`;
  });
  if (p.kind === 'error') {
    return (
      <div role="alert" class={cx('ow-toast-error', p.inline && 'inline')} style={p.inline ? undefined : { bottom: `${(p.above || 0) + 12}px` }}>
        <span class="ow-toast-err-disc" aria-hidden="true">!</span>
        <span class="ow-toast-err-words"><b>{p.text}</b>{p.sub && <span>{p.sub}</span>}</span>
        {p.retry && <button type="button" class="ow-toast-retry" onClick={() => { close(); p.retry && p.retry(); }}>Try again</button>}
        <button type="button" class="ow-toast-x" aria-label="Close" onClick={close}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
    );
  }
  return (
    <div role="status" class={cx('ow-toast', p.kind === 'warn' && 'warn', p.undo && 'undo', p.inline && 'inline')}>
      <span class="ow-toast-disc" aria-hidden="true">{p.kind === 'warn' ? '!' : <Icon name="check" size={15} stroke={3} />}</span>
      <span ref={words} class="ow-toast-w"><Keep text={p.text} /></span>
      {p.undo && <button type="button" class="ow-toast-undo" onClick={() => { close(); p.undo && p.undo(); }}>Undo</button>}
    </div>
  );
}

export function ToastHost(p: { above: number }): JSX.Element | null {
  const t = current.value;
  if (!t) return null;
  return <ToastView key={t.id} text={t.text} kind={t.kind} sub={t.sub} undo={t.undo} retry={t.retry} above={p.above} />;
}

/**
 * An error that stays where the move is, above the dock, until it is closed (KC19 "Not sold · nothing
 * taken"): the error toast's look, in place.
 *   <FailCard title="Not sold · nothing taken" sub="Slide again to sell" onClose={…} />
 */
export function FailCard(p: { title: string; sub?: string; onClose: () => void }): JSX.Element {
  return (
    <div role="alert" class="ow-fail">
      <div>
        <span aria-hidden="true" class="ow-fail-i"><Icon name="warning" size={18} stroke={2.2} /></span>
        <span class="ow-fail-t"><b>{p.title}</b>{p.sub && <span>{p.sub}</span>}</span>
        <button type="button" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
    </div>
  );
}
