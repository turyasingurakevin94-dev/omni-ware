/*
 * The four glyphs the Pack boards draw that src/ui/icons.tsx does not have (store-agent PK01, PK02,
 * PK09, PK13, PK14, PK17): a copy, look only (an eye), came in at the gate, To load's stack. Same
 * grid and stroke as Icon (24 box, round ends). Kept here, not in src/ui, so the shared module (and
 * the Sales and Buyer builds) do not change; move them to icons.tsx when a second area needs one.
 */
import type { JSX } from 'preact';

const G = {
  copy: "<rect x='8' y='8' width='12' height='12' rx='2'/><path d='M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3'/>",
  eye: "<path d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'/><circle cx='12' cy='12' r='3'/>",
  'came-in': "<path d='M12 3v11M7.5 9.5 12 14l4.5-4.5M4 14v6h16v-6'/>",
  layers: "<path d='M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5'/>",
};

export function Glyph(p: { name: keyof typeof G; size?: number; stroke?: number; style?: JSX.CSSProperties }): JSX.Element {
  return (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={p.stroke || 1.8}
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style={p.style} dangerouslySetInnerHTML={{ __html: G[p.name] }} />
  );
}
