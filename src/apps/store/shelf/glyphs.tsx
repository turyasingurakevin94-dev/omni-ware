/*
 * The Shelf's own pictures (store-agent SH boards; screens Q18): an item's square with the thing drawn
 * in its aisle's ink (a sheet, a ridge, a nail with its size, a tin, a wheelbarrow, a tyre, a screw), and
 * the three ways a loss happens. Any other item shows its aisle's icon (src/ui ItemSquare).
 *
 *   <ItemPic it={item} size={44} />        the head and the rows
 *   <Glyph g="damaged" size={20} />
 */
import type { JSX } from 'preact';
import { AISLE, Duo, aisleKey } from '../../../ui/icons.tsx';

const G: Record<string, string> = {
  sheet: "<path d='M3 8.5h18l-1.5 8H1.5z' fill='currentColor' fill-opacity='.14'/><path d='M3 8.5h18l-1.5 8H1.5zM5.5 8.5 4 16.5M9.5 8.5 8 16.5M13.5 8.5 12 16.5M17.5 8.5 16 16.5'/>",
  ridge: "<path d='M2.5 16 12 9l9.5 7'/><path d='M2.5 19 12 12l9.5 7'/><path d='M12 9v3'/>",
  nail: "<path d='M5 8v8' stroke-width='2.6'/><path d='M5 12h12.5l3 0'/><path d='M17.5 11 20.5 12l-3 1'/>",
  tin: "<path d='M6 8.5h12V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19z' fill='currentColor' fill-opacity='.14'/><path d='M6 8.5h12V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19zM5.5 8.5h13M8 8.5a4 4 0 0 1 8 0M9 13h6'/>",
  barrow: "<path d='M2.5 8h12l-2.5 6H6z' fill='currentColor' fill-opacity='.16'/><path d='M2.5 8h12l-2.5 6H6zM14.5 8 21 5.5M6 14l-1.5 4.5M12 14l2.5 2'/><circle cx='16.5' cy='17.5' r='2.3'/>",
  tyre: "<circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='3.5'/><path d='M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20'/>",
  screw: "<path d='M4 9v6h3V9z' fill='currentColor' fill-opacity='.2'/><path d='M4 9v6h3V9zM7 12h11l2.5 0M9 10.5l1 3M11.5 10.5l1 3M14 10.5l1 3M16.5 10.5l1 3'/>",
  carton: "<path d='M4 8.5 12 5l8 3.5v8L12 20l-8-3.5z' fill='currentColor' fill-opacity='.12'/><path d='M4 8.5 12 5l8 3.5v8L12 20l-8-3.5zM4 8.5 12 12l8-3.5M12 12v8M7 13.5h3'/>",
  damaged: "<path d='M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5'/><path d='M12 12l-1.5 3 2 2-1 4'/>",
  lost: "<rect x='4' y='4' width='16' height='16' rx='3' stroke-dasharray='3 3'/><path d='M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.4v.5M12 16.6h.01'/>",
  stolen: "<rect x='4.5' y='10.5' width='15' height='10' rx='2'/><path d='M8 10.5V7.5a4 4 0 0 1 7.7-1.6M12 14.5v2.5'/>",
  torch: "<path d='M8 3h8v4l-2 3v11h-4V10L8 7zM12 13v2'/>",
};
export type GlyphName = keyof typeof G;

export function Glyph(p: { g: GlyphName; size?: number; stroke?: number; style?: JSX.CSSProperties }): JSX.Element {
  return (
    <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={p.stroke || 1.8}
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style={p.style} dangerouslySetInnerHTML={{ __html: G[p.g] }} />
  );
}

/** The thing an item is, from its name; null: the aisle's icon. */
export function glyphOf(name: string): GlyphName | null {
  const n = name.toLowerCase();
  if (/ridge/.test(n)) return 'ridge';
  if (/iron sheet|roofing sheet/.test(n)) return 'sheet';
  if (/nails?\b/.test(n)) return 'nail';
  if (/tyre/.test(n)) return 'tyre';
  if (/wheelbarrow/.test(n)) return 'barrow';
  if (/screw/.test(n)) return 'screw';
  if (/paint|emulsion|primer|varnish/.test(n)) return 'tin';
  return null;
}

/** A nail's size under its picture ("4\"", "2.5\""). */
const sizeOf = (name: string): string | null => { const m = /(\d+(?:\.\d+)?)"/.exec(name); return m ? `${m[1]}"` : null; };

export interface ItemPicProps { it: { name: string; category: string | null }; size?: number; radius?: number }

/** The item's square: its aisle's soft gradient, the thing in the aisle's ink. */
export function ItemPic(p: ItemPicProps): JSX.Element {
  const a = AISLE[aisleKey(p.it.category || '')], s = p.size || 44, g = glyphOf(p.it.name), size = g === 'nail' ? sizeOf(p.it.name) : null;
  const icon = Math.round(s * (s >= 44 ? 28 / 44 : 25 / 38));
  return (
    <span aria-hidden="true" class="sh-pic" style={{ width: `${s}px`, height: `${s}px`, borderRadius: `${p.radius ?? (s >= 44 ? 12 : 11)}px`, background: `linear-gradient(145deg, ${a.soft} 0%, #FFFFFF 150%)`, color: a.ink }}>
      {g ? <Glyph g={g} size={icon} stroke={g === 'nail' ? 2.2 : 1.7} style={size ? { marginTop: '-9px' } : undefined} /> : <Duo i={a.i} size={Math.round(s * 0.55)} color={a.ink} />}
      {size && <span class="sh-pic-size mono">{size}</span>}
    </span>
  );
}
