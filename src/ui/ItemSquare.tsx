/*
 * An item with no photo shows its aisle's icon in its aisle's colours
 * (LANGUAGE.md §2.4): the duotone in the aisle's ink on a square of
 * linear-gradient(145deg, <soft> 0%, #FFFFFF 150%). The same aisle is the
 * same colour on every screen; a photo fills the same square.
 *
 *   <ItemSquare aisle="Roofing" size={40} />                 a line card (radius 12, icon 24)
 *   <ItemSquare aisle="Tools" size={34} radius={9} icon={20} />   the check list
 *   <ItemSquare aisle="Doors & locks" size={34} radius={9} icon={20} dropped />   a dropped line: flat crimson soft, no outline
 *   <ItemSquare photo="…" size={40} />
 */
import type { JSX } from 'preact';
import { AISLE, Duo, aisleKey } from './icons.tsx';

export interface ItemSquareProps {
  aisle: string;
  size?: number;
  radius?: number;
  /** The icon's box (24 in 40, 26 in 44, 22 in 38, 20 in 34). */
  icon?: number;
  photo?: string;
  /** A dropped line: the square crimson soft, flat, the icon crimson (P20). */
  dropped?: boolean;
}

const ICON: Record<number, number> = { 30: 18, 32: 20, 34: 20, 38: 22, 40: 24, 44: 26, 52: 30 };

export function ItemSquare(p: ItemSquareProps): JSX.Element {
  const a = AISLE[aisleKey(p.aisle)], s = p.size || 40;
  const style: JSX.CSSProperties = {
    width: `${s}px`, height: `${s}px`, flex: 'none', borderRadius: `${p.radius ?? 12}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    background: p.dropped ? '#FBE5E2' : `linear-gradient(145deg, ${a.soft} 0%, #FFFFFF 150%)`,
    boxShadow: p.dropped ? undefined : 'inset 0 0 0 1px rgba(0,0,0,.035)',
  };
  return (
    <span aria-hidden="true" style={style}>
      {p.photo ? <img src={p.photo} alt="" width={s} height={s} style={{ objectFit: 'cover' }} /> : <Duo i={a.i} size={p.icon || ICON[s] || 24} color={p.dropped ? '#8E2A22' : a.ink} />}
    </span>
  );
}
