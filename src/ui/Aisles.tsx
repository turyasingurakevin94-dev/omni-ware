/*
 * P14 · Aisle chips and aisle tiles (LANGUAGE.md §3 P14). A chip row
 * bleeds past the gutters and scrolls; the tiles are a 3-up grid whose last
 * tile, "All aisles", is the navy tile.
 *
 *   <AisleChips aisles={[{ name: 'Tools', on: … }, { name: 'Doors & locks', on: … }]} />
 *   <AisleTiles tiles={[{ name: 'Roofing', count: 86, on: … }, …]} all={{ count: 1153, on: … }} />
 */
import type { JSX } from 'preact';
import { AisleIcon, Icon } from './icons.tsx';
import { ItemSquare } from './ItemSquare.tsx';
import { fig } from './Money.tsx';
import { Tap } from './util.tsx';
import './aisles.css';

export function AisleChips(p: { aisles: { name: string; on: () => void }[] }): JSX.Element {
  return (
    <div class="ow-achips">
      {p.aisles.map((a) => <Tap key={a.name} on={a.on} class="ow-achip"><AisleIcon aisle={a.name} size={18} />{a.name}</Tap>)}
    </div>
  );
}

export function AisleTiles(p: { tiles: { name: string; count: number; on: () => void }[]; all?: { count: number; on: () => void } }): JSX.Element {
  return (
    <div class="ow-atiles">
      {p.tiles.map((a) => (
        <Tap key={a.name} on={a.on} class="ow-atile">
          <ItemSquare aisle={a.name} size={38} />
          <span class="ow-atile-t"><span>{a.name}</span><span class="mono">{fig(a.count)}</span></span>
        </Tap>
      ))}
      {p.all && (
        <Tap on={p.all.on} class="ow-atile all">
          <span aria-hidden="true" class="ow-atile-all"><Icon name="grid" size={20} /></span>
          <span class="ow-atile-t"><span>All aisles</span><span class="mono">{fig(p.all.count)}</span></span>
        </Tap>
      )}
    </div>
  );
}
