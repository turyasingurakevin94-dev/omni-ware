/*
 * P28 · Toasts: the host. Top centre, 14 px down, navy with a mint tick;
 * warn is sand with a brown "!"; an Undo toast keeps a 44 px mint "Undo"
 * for 10 seconds (GLOSSARY "Undo"); an error sits at the bottom, above the
 * tab bar or the dock, as a white card with "Try again".
 *
 *   toast.show('Added 40 bags', { undo: () => … })
 *   toast.show('No signal', { kind: 'warn' })
 *   toast.show('Not sent', { kind: 'error', sub: 'The server said …', retry: () => … })
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
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
};

const tick = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" /></svg>;

export function ToastHost(p: { above: number }): JSX.Element | null {
  const t = current.value;
  if (!t) return null;
  if (t.kind === 'error') {
    return (
      <div role="alert" class="ow-toast-error" style={{ bottom: `${p.above + 12}px` }}>
        <span class="ow-toast-err-disc" aria-hidden="true">!</span>
        <span class="ow-toast-err-words"><b>{t.text}</b>{t.sub && <span>{t.sub}</span>}</span>
        {t.retry && <button type="button" class="ow-toast-retry" onClick={() => { toast.hide(); t.retry && t.retry(); }}>Try again</button>}
        <button type="button" class="ow-toast-x" aria-label="Close" onClick={() => toast.hide()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    );
  }
  return (
    <div role="status" class={'ow-toast' + (t.kind === 'warn' ? ' warn' : '') + (t.undo ? ' undo' : '')}>
      <span class="ow-toast-disc" aria-hidden="true">{t.kind === 'warn' ? '!' : tick}</span>
      <span>{t.text}</span>
      {t.undo && <button type="button" class="ow-toast-undo" onClick={() => { toast.hide(); t.undo && t.undo(); }}>Undo</button>}
    </div>
  );
}
