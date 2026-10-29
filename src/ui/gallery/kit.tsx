/*
 * The parts gallery's own furniture (demo only, never in the page): a
 * board, its columns, the caption over each part, and the specimens of the
 * tokens (swatches, type, radii, icon tiles). The parts themselves are
 * src/ui's, used as a screen uses them.
 */
import type { ComponentChildren, JSX } from 'preact';
import './gallery.css';

/** The eyebrow over a part and its note at the right. */
export function Cap(p: { k: string; meta?: string }): JSX.Element {
  return <div class="g-cap"><span>{p.k}</span><span>{p.meta || ''}</span></div>;
}

/** A part and its caption, `gap` apart. */
export function Part(p: { k: string; meta?: string; gap?: number; children: ComponentChildren }): JSX.Element {
  return <div class="g-part" style={p.gap != null ? { gap: `${p.gap}px` } : undefined}><Cap k={p.k} meta={p.meta} />{p.children}</div>;
}

export function Col(p: { gap: number; children: ComponentChildren }): JSX.Element {
  return <section class="g-col" style={{ gap: `${p.gap}px` }}>{p.children}</section>;
}

export function Swatch(p: { name: string; hex: string }): JSX.Element {
  return (
    <div class="g-sw">
      <span class="g-sw-c" style={{ background: p.hex }} />
      <span class="g-sw-t"><span>{p.name}</span><span class="mono">{p.hex}</span></span>
    </div>
  );
}

/** A type specimen row: the words in their role, the measure at the right. */
export function TypeRow(p: { meta: string; children: ComponentChildren }): JSX.Element {
  return <div class="g-type-r">{p.children}<span class="g-type-m">{p.meta}</span></div>;
}

/** A radius as a corner. */
export function Corner(p: { r: number }): JSX.Element {
  return <span class="g-corner"><span style={{ borderTopLeftRadius: `${p.r}px` }} /><span class="mono">{p.r}</span></span>;
}

/** A square holding one icon, for the icon set. */
export function IconCell(p: { bg?: string; outline?: string; children: ComponentChildren }): JSX.Element {
  return <span class="g-icell" style={{ background: p.bg, boxShadow: p.outline ? `inset 0 0 0 1px ${p.outline}` : undefined }}>{p.children}</span>;
}

/** Does nothing: the gallery's taps go nowhere. */
export const nop = (): void => undefined;
