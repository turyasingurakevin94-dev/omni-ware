/*
 * SL42 · the open line's unit switch, under its name: the item's unit and its pack, only when the pack has its
 * own price (core/units.ts sellsByPack); an item with one unit has none. A tap counts the line in that unit,
 * whole ones rounding up (model.ts setUnit), and the stepper, the price and the amount follow at once.
 */
import type { JSX } from 'preact';
import type { Item, Line } from '../../../core/types.ts';
import { inPack, packEach } from '../../../core/units.ts';
import { fig } from '../../../ui/Money.tsx';
import { setUnit } from './model.ts';

export function UnitSwitch(p: { l: Line; it: Item | undefined }): JSX.Element | null {
  const it = p.it, each = it ? packEach(it) : null;
  if (!it || each == null || it.price == null) return null;
  const pack = inPack(p.l), packPrice = each * it.packQty;
  return (
    <div role="radiogroup" aria-label="Sold by" class="sl-unit">
      <button type="button" role="radio" aria-checked={!pack} class={pack ? '' : 'on'} aria-label={`By the ${it.unit}, ${fig(it.price)} a ${it.unit}`} onClick={() => setUnit(p.l.lineId, 'unit')}>
        {it.unit}<span class="mono">{fig(it.price)}</span>
      </button>
      <button type="button" role="radio" aria-checked={pack} class={pack ? 'on' : ''} aria-label={`By the ${it.packUnit} of ${it.packQty}, ${fig(packPrice)} a ${it.packUnit}`} onClick={() => setUnit(p.l.lineId, 'pack')}>
        {`${it.packUnit} of ${it.packQty}`}<span class="mono">{fig(packPrice)}</span>
      </button>
    </div>
  );
}
