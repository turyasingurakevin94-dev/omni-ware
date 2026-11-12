/*
 * The Store canvas's item pictures (docs/canvas/store-agent, IN02–IN35): a drawn bag, box, tin,
 * sheets, coil or timber on its soft square, so the yard sees the thing it counts. An item the
 * canvas draws no picture for shows its aisle's icon (ItemSquare). Drawn at the boards' sizes:
 * the picture is 0.9 of its square (56 → 50, 40 → 36, 32 → 28).
 *
 *   <ItemArt name="Cement · Hima 50kg" size={56} radius={14} />
 *   <ItemArt name="Cement · Hima 50kg" torn size={56} />      a torn bag (a return, a delivery's torn ones)
 *   <ItemArt name="Emulsion · cream 20L" size={36} radius={11} ring />   stacked over another (a ring of white)
 */
import type { JSX } from 'preact';
import { ItemSquare } from './ItemSquare.tsx';

type Art = 'bag' | 'box' | 'tin' | 'glue' | 'sheets' | 'coil' | 'timber';

const SOFT: Record<Art, string> = { bag: '#EFECE6', box: '#E4E6FA', tin: '#F6E4F1', glue: '#ECE7F7', sheets: '#DCEAF8', coil: '#E8EBF0', timber: '#F6EBD9' };

/** Which picture an item gets, by what it is. */
export function artOf(name: string): Art | null {
  const n = name.toLowerCase();
  if (/cement/.test(n)) return 'bag';
  if (/nail/.test(n)) return 'box';
  if (/glue/.test(n)) return 'glue';
  if (/emulsion|paint/.test(n)) return 'tin';
  if (/sheet|ridge/.test(n)) return 'sheets';
  if (/wire/.test(n)) return 'coil';
  if (/timber/.test(n)) return 'timber';
  return null;
}

const TORN = (
  <>
    <path d="M38 44l4-4 2 5 4-2-1 8H36z" fill="#B9B2A4" /><path d="M36 51l2-7 4-4 2 5 4-2" fill="none" stroke="#8E2A22" stroke-width="1.6" stroke-linejoin="round" />
    <circle cx="42" cy="52" r="1.2" fill="#B9B2A4" /><circle cx="46" cy="54" r="1" fill="#B9B2A4" />
  </>
);

/** The bag on its own (the tiles of a return, a delivery's torn bags). */
export function BagArt(p: { size: number; torn?: boolean }): JSX.Element {
  return (
    <svg width={p.size} height={p.size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M15 20c0-3 2-5 5-5h24c3 0 5 2 5 5l2 28c0 3-2 5-5 5H18c-3 0-5-2-5-5z" fill="#E6DDCB" /><path d="M14.4 30h35.2l.8 11H13.6z" fill="#5F6980" />
      {p.torn ? TORN : <><path d="M22 35.5h20" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" /><path d="M20 15c4 2 20 2 24 0" fill="none" stroke="#CFC4AD" stroke-width="1.4" /></>}
    </svg>
  );
}

function Picture(p: { art: Art; size: number; torn?: boolean }): JSX.Element {
  const s = p.size;
  switch (p.art) {
    case 'bag': return <BagArt size={s} torn={p.torn} />;
    case 'box':
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M14 24 34 16l18 7-20 8z" fill="#E9CFA2" /><path d="M14 24v24l18 8V31z" fill="#D4AE74" /><path d="M32 31v25l20-8V23z" fill="#BE945B" />
          <path d="M14 24l18 7 20-8" fill="none" stroke="#A97E45" stroke-width="1" />
          <rect x="17" y="33" width="12" height="11" rx="1.5" fill="#FFFFFF" transform="skewY(20) translate(0 -11)" />
          <path d="M19.5 36.5h7M23 36.5v7" stroke="#3A3F9B" stroke-width="1.8" stroke-linecap="round" transform="skewY(20) translate(0 -11)" />
        </svg>
      );
    case 'tin':
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
          <ellipse cx="32" cy="18" rx="15" ry="5" fill="#C7CCD6" /><path d="M17 18v30c0 2.8 6.7 5 15 5s15-2.2 15-5V18c0 2.8-6.7 5-15 5s-15-2.2-15-5z" fill="#DDE1E8" />
          <path d="M17 26c0 2.8 6.7 5 15 5s15-2.2 15-5v15c0 2.8-6.7 5-15 5s-15-2.2-15-5z" fill="#F1E2C3" /><path d="M22 34.5h20" stroke="#7A3268" stroke-width="2.2" stroke-linecap="round" />
          <path d="M21 17c0-7 22-7 22 0" fill="none" stroke="#8F96A3" stroke-width="1.8" /><ellipse cx="32" cy="18" rx="11" ry="3.2" fill="#B5BBC6" />
        </svg>
      );
    case 'glue':
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
          <ellipse cx="32" cy="22" rx="12" ry="4" fill="#C7CCD6" /><path d="M20 22v24c0 2.2 5.4 4 12 4s12-1.8 12-4V22c0 2.2-5.4 4-12 4s-12-1.8-12-4z" fill="#E4E7EC" />
          <path d="M20 29c0 2.2 5.4 4 12 4s12-1.8 12-4v11c0 2.2-5.4 4-12 4s-12-1.8-12-4z" fill="#FFFFFF" /><path d="M25 36h14" stroke="#7A3268" stroke-width="2" stroke-linecap="round" />
          <ellipse cx="32" cy="22" rx="9" ry="2.6" fill="#B5BBC6" />
        </svg>
      );
    case 'sheets':
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M8 40l26-12 22 8-26 12z" fill="#8FA7C2" /><path d="M8 40v5l22 8v-5z" fill="#6E89A8" /><path d="M30 48v5l26-12v-5z" fill="#5D7899" />
          <path d="M8 34l26-12 22 8-26 12z" fill="#A9BED6" /><path d="M8 34v6l22 8v-6z" fill="#7F99B8" /><path d="M30 42v6l26-12v-6z" fill="#6A85A6" />
          <path d="M12 32.2l26-12M16 34l26-12M20 35.6l26-12M24 37.4l26-12" stroke="#C9D6E5" stroke-width="1.4" /><path d="M22 26l6 2.2v24l-6-2.2z" fill="#1A5A8A" opacity=".85" />
        </svg>
      );
    case 'coil':
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="34" r="17" fill="none" stroke="#7D8796" stroke-width="7" /><circle cx="32" cy="34" r="17" fill="none" stroke="#A9B1BD" stroke-width="2" stroke-dasharray="3 2" />
          <circle cx="32" cy="34" r="9" fill="#F4F5F7" /><path d="M48 30c5-2 8 0 9 3" fill="none" stroke="#7D8796" stroke-width="2" stroke-linecap="round" />
        </svg>
      );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 64 64" aria-hidden="true">
          <path d="M8 40 40 24l16 6-32 16z" fill="#D9B07A" /><path d="M8 40v6l16 6v-6z" fill="#B8874E" /><path d="M24 46v6l32-16v-6z" fill="#C99A60" />
          <path d="M8 33 40 17l16 6-32 16z" fill="#E6C18E" /><path d="M8 33v7l16 6v-7z" fill="#C3925A" /><path d="M24 39v7l32-16v-7z" fill="#D2A56C" />
          <path d="M12 31.5l30-15M16 33.3l30-15" stroke="#C99A60" stroke-width="1" /><ellipse cx="16" cy="43" rx="2.2" ry="1.6" fill="#A87843" />
          <ellipse cx="16" cy="36.2" rx="2.2" ry="1.6" fill="#B8874E" />
        </svg>
      );
  }
}

export interface ItemArtProps {
  name: string;
  /** Its aisle, for an item with no picture. */
  aisle?: string | null;
  size?: number;
  radius?: number;
  torn?: boolean;
}

export function ItemArt(p: ItemArtProps): JSX.Element {
  const art = artOf(p.name), s = p.size || 40, r = p.radius ?? (s >= 56 ? 14 : 12);
  if (!art) return <ItemSquare aisle={p.aisle || ''} size={s} radius={r} />;
  return (
    <span aria-hidden="true" class="ow-art" style={{
      width: `${s}px`, height: `${s}px`, flex: 'none', borderRadius: `${r}px`, background: `linear-gradient(145deg, ${SOFT[art]} 0%, #FFFFFF 150%)`,
      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.035)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Picture art={art} size={Math.floor(s * 0.9)} torn={p.torn} />
    </span>
  );
}
