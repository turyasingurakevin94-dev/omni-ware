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
import { Icon } from './icons.tsx';
import { cx } from './util.tsx';
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

export function ToastView(p: ToastViewProps): JSX.Element {
  const close = p.onClose || (() => toast.hide());
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
      <span>{p.text}</span>
      {p.undo && <button type="button" class="ow-toast-undo" onClick={() => { close(); p.undo && p.undo(); }}>Undo</button>}
    </div>
  );
}

export function ToastHost(p: { above: number }): JSX.Element | null {
  const t = current.value;
  if (!t) return null;
  return <ToastView key={t.id} text={t.text} kind={t.kind} sub={t.sub} undo={t.undo} retry={t.retry} above={p.above} />;
}
