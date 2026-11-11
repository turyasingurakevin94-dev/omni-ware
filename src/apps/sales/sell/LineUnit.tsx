/*
 * SL42 · the open line's unit, as the agent app says it: a chip "1 bundle = 10 pcs · 20 pcs in all" while it is
 * counted in bundles (agent.html line 9238), and the same Pcs | Bundle switch as the card (SL43), each with its
 * price (10,500 · 105,000, core/units.ts). An item with one unit has neither. A tap counts the line in that unit,
 * whole ones rounding up (model.ts setUnit), and the stepper, the price and the amount follow at once.
 */
import type { JSX } from 'preact';
import type { Item, Line } from '../../../core/types.ts';
import { capWord, inPack, packEach } from '../../../core/units.ts';
import { fig } from '../../../ui/Money.tsx';
import { Duo, phBox } from '../../../ui/icons.tsx';
import { setUnit } from './model.ts';

export function UnitSwitch(p: { l: Line; it: Item | undefined }): JSX.Element | null {
  const it = p.it, each = it ? packEach(it) : null;
  if (!it || each == null || it.price == null) return null;
  const pack = inPack(p.l), packPrice = each * it.packQty;
  return (
    <>
      {pack && (
        <span class="sl-unit-pk"><Duo i={phBox} size={14} color="currentColor" />
          {'1 '}{it.packUnit}{' = '}<span class="mono">{fig(it.packQty)}</span>{` ${it.unit} · `}<span class="mono">{fig(p.l.qty)}</span>{` ${it.unit} in all`}
        </span>
      )}
      <div role="radiogroup" aria-label={`Sell ${it.name} by`} class="sl-unit">
        <button type="button" role="radio" aria-checked={!pack} class={pack ? '' : 'on'} aria-label={`By the ${it.unit}, ${fig(it.price)} a ${it.unit}`} onClick={() => setUnit(p.l.lineId, 'unit')}>
          {capWord(it.unit)}<span class="mono">{fig(it.price)}</span>
        </button>
        <button type="button" role="radio" aria-checked={pack} class={pack ? 'on' : ''} aria-label={`By the ${it.packUnit} of ${it.packQty}, ${fig(packPrice)} a ${it.packUnit}`} onClick={() => setUnit(p.l.lineId, 'pack')}>
          {capWord(it.packUnit)}<span class="mono">{fig(packPrice)}</span>
        </button>
      </div>
    </>
  );
}
