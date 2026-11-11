/*
 * The Out area's own strokes, drawn on its boards and not in the shared set (src/ui/icons.tsx):
 * the To load stack, the door, a camera with a stroke through it, the moon, the battery, a person
 * crossed, a cross in a ring and the map's arrow. Same grid and caps as Icon (24 box, round ends).
 * Spec Q18 asks whether they join the shared set; until then they live here, used only by Out.
 */
import type { JSX } from 'preact';

const S = {
  layers: "<path d='M12 3 3 7.5 12 12l9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5'/>",
  door: "<path d='M6 21V4h12v17M3 21h18M14.5 12.5h.01'/>",
  'camera-off': "<path d='M3 3l18 18M9 5.5h6.5L17 8h3v9M4 8h2v11h13'/><circle cx='12' cy='13' r='3.3'/>",
  moon: "<path d='M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'/>",
  battery: "<rect x='3' y='7' width='16' height='10' rx='2'/><path d='M21 10.5v3M6.5 10v4'/>",
  'person-x': "<circle cx='12' cy='8' r='4'/><path d='M4 21c0-4.4 3.6-8 8-8 1.6 0 3 .4 4.3 1.2M16 17l5 5M21 17l-5 5'/>",
  'x-circle': "<circle cx='12' cy='12' r='9'/><path d='m9 9 6 6M15 9l-6 6'/>",
  nav: "<path d='M3 11 21 3l-8 18-2-8z'/>",
  'coming-in': "<path d='M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4 19.5h16'/>",
};

export type OIconName = keyof typeof S;

export function OIcon(p: { name: OIconName; size?: number; stroke?: number; style?: JSX.CSSProperties }): JSX.Element {
  return (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={p.stroke || 1.8}
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style={p.style} dangerouslySetInnerHTML={{ __html: S[p.name] }} />
  );
}
