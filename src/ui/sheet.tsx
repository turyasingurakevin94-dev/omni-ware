/*
 * P17 · The bottom sheet over navy: the host. A sheet comes up over the
 * screen it came from; the screen shows through the scrim above it
 * (rgba(12,19,38,.72)). The sheet's own look (light sheet, full sheet,
 * its title row and ×) is the sheet part's: the host only places it,
 * dims what is behind, and closes it on the scrim, Escape or back.
 *
 *   sheet.open(() => <MySheet />, { label: 'Who is it for?' })
 *   sheet.close()
 */
import { signal } from '@preact/signals';
import type { JSX, VNode } from 'preact';
import { useEffect } from 'preact/hooks';
import './sheet.css';

interface Open {
  render: () => VNode;
  label: string;
  /** How far down the sheet starts (P17: a light sheet's top at 300 of 800). null: it sizes to its content. */
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

export function SheetHost(): JSX.Element | null {
  const c = current.value;
  useEffect(() => {
    if (!c) return undefined;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') sheet.close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [c]);
  if (!c) return null;
  return (
    <div class="ow-sheet-layer">
      <div class="ow-scrim" aria-hidden="true" onClick={() => sheet.close()} />
      <div class="ow-sheet" role="dialog" aria-modal="true" aria-label={c.label} style={c.top != null ? { top: `${c.top}px` } : undefined}>
        {c.render()}
      </div>
    </div>
  );
}
