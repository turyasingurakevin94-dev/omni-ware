/*
 * KC02 · Find: "2 paint" is read as ×2 of paint. The best match opens with the stepper and
 * "Add · 370,000"; the rest add with one tap, or, when the shelf has none, "Order in" turns
 * the sale into an order (sell/order).
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Duo, phSparkle } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import type { Item } from '../../../core/types.ts';
import { QtyStep } from './local-line.tsx';
import { markOf } from './shop.ts';
import './find.css';

export interface FindProps {
  qty: number;
  words: string;
  /** Read as: shown when a count was read from the words. */
  read: boolean;
  items: Item[];
  onAdd: (it: Item, qty: number) => void;
  onOrderIn: (it: Item, qty: number) => void;
}

const onShelf = (it: Item) => (it.onShelf || 0) > 0;

function Shelf(p: { it: Item; mono11?: boolean }): JSX.Element {
  return onShelf(p.it)
    ? <span class="kc-pill"><span class={'mono' + (p.mono11 ? '' : ' n')}>{fig(p.it.onShelf || 0)}</span>on shelf</span>
    : <span class="kc-pill info">{p.it.orderIn ? 'Order in' : 'Out'}</span>;
}

export function Find(p: FindProps): JSX.Element {
  const top = p.items[0], rest = p.items.slice(1, 5);
  const [n, setN] = useState(p.qty);
  useEffect(() => setN(p.qty), [p.qty, top && top.id]);
  const mark = top ? markOf(top.name, p.words) : null;
  return (
    <>
      {p.read && (
        <div class="kc-read">
          <Duo i={phSparkle} size={14} color="#5F6980" />Read as
          <span class="kc-read-n mono">{`×${p.qty}`}</span>
          <span class="kc-read-w">{p.words}</span>
        </div>
      )}
      {top && (
        <div class="kc-best">
          <div class="kc-best-h">
            <ItemSquare aisle={top.aisle} size={44} />
            <span class="kc-best-t">
              <span class="kc-best-n">{mark ? <><mark>{mark[0]}</mark>{mark[1]}</> : top.name}</span>
              <span class="kc-best-s"><span class="mono kc-per">{`${fig(top.price || 0)} /${top.unit}`}</span><Shelf it={top} mono11 /></span>
            </span>
          </div>
          <div class="kc-best-f">
            <QtyStep qty={n} unit={top.unit} onChange={(v) => setN(Math.max(1, v))} />
            {onShelf(top)
              ? <button type="button" class="kc-add" onClick={() => p.onAdd(top, n)}>Add ·<span class="mono">{fig(n * (top.price || 0))}</span></button>
              : <button type="button" class="kc-add" onClick={() => p.onOrderIn(top, n)}>Order in<span class="mono">{fig(n)}</span></button>}
          </div>
        </div>
      )}
      {!!rest.length && (
        <div class="kc-more">
          {rest.map((it) => (
            <div key={it.id} class="kc-more-r">
              <ItemSquare aisle={it.aisle} size={44} />
              <span class="kc-more-t">
                <span class="kc-row-n">{it.name}</span>
                <span class="mono kc-per">{`${fig(it.price || 0)} /${it.unit}`}</span>
                <Shelf it={it} />
              </span>
              {onShelf(it)
                ? <button type="button" class="kc-addn mono" aria-label={`Add ${p.qty} ${it.name}`} onClick={() => p.onAdd(it, p.qty)}>{`+${p.qty}`}</button>
                : <button type="button" class="kc-orderin" aria-label={`Order in ${p.qty} ${it.name.split(' · ')[0]}: the sale becomes an order`} onClick={() => p.onOrderIn(it, p.qty)}>Order in<span class="mono">{fig(p.qty)}</span></button>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
