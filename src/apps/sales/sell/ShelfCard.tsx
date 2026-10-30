/*
 * local part · a shelf card in an aisle (SL12): the picture that tells one
 * from another on the shelf (a nail drawn to its length, "4 in"; else the
 * aisle's icon), the name, the price a unit, the shelf, and the + in the
 * unit chosen (kg | ctn); once in the order, a green outline, "In order"
 * and its count on a navy stepper. To move into src/ui with the Sell boards.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { Item, Line } from '../../../core/types.ts';
import { AISLE, Duo, Icon, aisleKey } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';

export interface Card { name: string; items: Item[]; sold: number }

/** A nail at its length: 16 px an inch and 4 more (2 in → 36, 3 in → 52), at most 64 (4 in and longer), centred. */
function Nail(p: { inches: number; ink: string }): JSX.Element {
  const len = Math.min(64, Math.round(4 + 16 * p.inches)), x0 = 60 - len / 2, x1 = 60 + len / 2;
  return (
    <svg width="120" height="40" viewBox="0 0 120 40" aria-hidden="true">
      <rect x={x0} y="17" width={len} height="5" rx="2.5" fill={p.ink} opacity=".75" />
      <rect x={x0 - 4} y="11" width="5" height="17" rx="2" fill={p.ink} />
      <path d={`M${x1} 17l8 2.5-8 2.5z`} fill={p.ink} opacity=".75" />
      <path d="M14 33h92" stroke={p.ink} stroke-opacity=".35" stroke-dasharray="1 7" />
    </svg>
  );
}

const big = (u: string) => /^(ctn|box|carton|bag)$/.test(u) ? 1 : 0;

export function ShelfCard(p: { card: Card; kind: string; line: Line | null; onAdd: (it: Item) => void; onQty: (lineId: number, n: number) => void }): JSX.Element {
  const cd = p.card, units = cd.items.slice().sort((x, y) => big(x.unit) - big(y.unit) || x.unit.localeCompare(y.unit));
  const [pick, setPick] = useState(cd.items[0].id);
  const it = p.line ? cd.items.find((i) => i.id === p.line?.itemId) || cd.items[0] : cd.items.find((i) => i.id === pick) || cd.items[0];
  const a = AISLE[aisleKey(it.aisle)], inches = (cd.name.match(/(\d+(?:\.\d+)?)"/) || [])[1];
  const nail = /nails/i.test(cd.name) && inches;
  const shelf = it.onShelf || 0;
  return (
    <div class={'sl-card2' + (p.line ? ' in' : '')}>
      <div class="sl-card2-pic" style={{ background: `linear-gradient(145deg, ${a.soft} 0%, #FFFFFF 150%)` }}>
        {nail ? <><Nail inches={Number(inches)} ink={a.ink} /><span class="mono" style={{ color: a.ink }}>{`${inches} in`}</span></> : <Duo i={a.i} size={30} color={a.ink} />}
      </div>
      {p.line && <span class="sl-card2-in"><Icon name="check" size={11} stroke={3.2} />In order</span>}
      <div class="sl-card2-b">
        <span class="sl-card2-n">{cd.name}</span>
        <span class="sl-card2-p"><span class="mono">{fig(it.price || 0)}</span><span>{`/${it.unit}`}</span></span>
        {shelf > 0 ? <span class="sl-card2-s"><b class="mono">{fig(shelf)}</b> on shelf</span>
          : it.orderIn ? <span class="sl-card2-o">Order in</span> : <span class="sl-card2-o bad">Out</span>}
        {p.line ? (
          <div class="sl-card2-step">
            <button type="button" aria-label="Fewer" onClick={() => p.onQty((p.line as Line).lineId, Math.max(1, (p.line as Line).qty - 1))}><Icon name="minus" size={16} stroke={2.4} /></button>
            <span class="mono">{`${p.line.qty} `}<span class="ow-word">{p.line.unit}</span></span>
            <button type="button" aria-label="More" onClick={() => p.onQty((p.line as Line).lineId, (p.line as Line).qty + 1)}><Icon name="plus" size={16} stroke={2.4} /></button>
          </div>
        ) : (
          <div class="sl-card2-r">
            <div role="radiogroup" aria-label="Sold by" class="sl-card2-u">
              {(units.length > 1 ? units : [it]).map((u) => <button key={u.id} type="button" role="radio" aria-checked={u.id === it.id} class={u.id === it.id ? 'on' : ''} onClick={() => setPick(u.id)}>{u.unit}</button>)}
            </div>
            <button type="button" class="sl-card2-add" aria-label="Add" onClick={() => p.onAdd(it)}><Icon name="plus" size={16} stroke={2.4} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
