/*
 * P13 · "Often with" (LANGUAGE.md §3 P13): what this customer usually
 * takes with the item just added. A header naming the item and whose
 * orders, then one card per suggestion: the aisle square, the name, a bar
 * in the aisle's ink with how many of their orders had it, the price, a
 * navy round +.
 *
 *   <OftenWithHead item="Iron sheet G28" whose="in Kato's orders" />
 *   <OftenWith aisle="Roofing" name="Ridge cap G28" had={7} of={14} price={18000} unit="pc" onAdd={…} />
 */
import type { JSX } from 'preact';
import { Meter } from './Bar.tsx';
import { AISLE, Duo, Icon, aisleKey, phLink } from './icons.tsx';
import { ItemSquare } from './ItemSquare.tsx';
import { fig } from './Money.tsx';
import type { Fig } from './util.tsx';
import './oftenwith.css';

export function OftenWithHead(p: { item: string; whose: string }): JSX.Element {
  return (
    <div class="ow-often-h">
      <Duo i={phLink} size={18} color="#0E6A6A" />
      <h2>{`Often with ${p.item}`}</h2>
      <span>{p.whose}</span>
    </div>
  );
}

export interface OftenWithProps {
  aisle: string;
  name: string;
  /** In how many of their orders, of how many. */
  had: number;
  of: number;
  price: Fig;
  unit: string;
  onAdd: () => void;
}

export function OftenWith(p: OftenWithProps): JSX.Element {
  return (
    <div class="ow-often">
      <ItemSquare aisle={p.aisle} size={44} />
      <span class="ow-often-t">
        <span class="ow-often-n">{p.name}</span>
        <span class="ow-often-bar"><Meter pct={(100 * p.had) / Math.max(1, p.of)} fill={AISLE[aisleKey(p.aisle)].ink} /><b class="mono">{`${p.had}/${p.of}`}</b></span>
      </span>
      <span class="ow-often-p"><b class="mono">{fig(p.price)}</b><small>per {p.unit}</small></span>
      <button type="button" class="ow-often-add" aria-label={`Add ${p.name}`} onClick={p.onAdd}><Icon name="plus" size={16} stroke={2.6} /></button>
    </div>
  );
}
