/*
 * What is picked: one line open at a time (the stepper, the shelf; their price under the shop's
 * with the ladder, KC10; not all on the shelf, KC18), the others closed rows.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Icon } from '../../../ui/icons.tsx';
import { PriceLadder, ladderPct } from '../../../ui/Keypad.tsx';
import { fig } from '../../../ui/Money.tsx';
import { lineTotal } from '../../../core/money.ts';
import type { Item, Line } from '../../../core/types.ts';
import { LineLink, OpenLine, type PriceChipKind } from '../../../ui/LineCard.tsx';

type Chip = { kind: PriceChipKind; v: number };
const words = (l: Line) => ({ name: l.name, qty: l.qty, unit: l.unit, price: l.price });
import '../../../ui/keypad.css';

export interface PickedProps {
  lines: Line[];
  items: Item[];
  open: number | null;
  pricing: number | null;
  onOpen: (lineId: number) => void;
  onPricing: (lineId: number | null) => void;
  onQty: (lineId: number, qty: number) => void;
  onPrice: (lineId: number, price: number) => void;
  onOrderIn: () => void;
}

/** The one chip a line shows: Ruth's yes, what is under the shop's price, or what the line comes to. */
export function chipOf(l: Line): Chip {
  if (l.priceReview && l.price != null && l.priceReview.price === l.price) return { kind: 'yes', v: lineTotal(l) };
  if (l.shopPrice != null && l.price != null && l.price < l.shopPrice) return { kind: 'under', v: (l.price - l.shopPrice) * l.qty };
  return { kind: 'amount', v: lineTotal(l) };
}

function Price(p: { line: Line; onPrice: (v: number) => void; onShop: () => void }): JSX.Element {
  const l = p.line, shop = l.shopPrice || 0, price = l.price || 0;
  const [typed, setTyped] = useState<string | null>(null);
  const label = price < shop ? `${fig(price)} is under the shop’s price of ${fig(shop)}` : `${fig(price)} is the shop’s price or more`;
  return (
    <div class="kc-price">
      <PriceLadder pct={ladderPct(price, l.cost || 0, shop)} shop={shop} label={label} />
      <label class="kc-pfield">
        <span>
          <span class="k">Their price, each</span>
          <input type="text" inputmode="numeric" aria-label={`Their price for each ${l.unit}`} value={typed != null ? typed : fig(price)}
            onInput={(e) => {
              const raw = (e.target as HTMLInputElement).value, v = Number(raw.replace(/[^0-9]/g, '')) || 0;
              setTyped(v > 0 ? fig(v) : raw.replace(/[^0-9]/g, ''));
              if (v > 0) p.onPrice(v);
            }}
            onBlur={() => setTyped(null)} />
        </span>
        <button type="button" class="kc-shop" onClick={(e) => { e.preventDefault(); setTyped(null); p.onShop(); }}>shop<span class="mono">{fig(shop)}</span></button>
      </label>
    </div>
  );
}

function Short(p: { line: Line; shelf: number; onMake: () => void; onOrderIn: () => void }): JSX.Element {
  const l = p.line, miss = l.qty - p.shelf;
  return (
    <div class="kc-short">
      <div class="kc-short-h">
        <span><span style={{ display: 'flex', color: '#95530C' }}><Icon name="warning" size={16} stroke={2.2} /></span><b class="mono">{fig(miss)}</b>short</span>
        <span>{`${fig(l.qty)} asked · `}<b class="mono">{fig(p.shelf)}</b>{' on shelf'}</span>
      </div>
      <div role="img" aria-label={`${p.shelf} of ${l.qty} on the shelf, ${miss} short`} class="kc-short-bar">
        <span style={{ width: `${Math.floor((p.shelf / l.qty) * 100)}%` }} /><span />
      </div>
      <div class="kc-pair">
        <button type="button" aria-label={`Make it ${fig(p.shelf)}`} onClick={p.onMake}>Make it<span class="mono">{fig(p.shelf)}</span></button>
        <button type="button" onClick={p.onOrderIn}>Order in<span class="mono">{fig(miss)}</span></button>
      </div>
    </div>
  );
}

export function Picked(p: PickedProps): JSX.Element {
  return (
    <div class="kc-lines">
      {p.lines.map((l) => {
        const it = p.items.find((i) => i.id === l.itemId), aisle = it ? it.aisle : '';
        if (p.open !== l.lineId) return <LineLink key={l.lineId} {...words(l)} aisle={aisle} chip={chipOf(l)} on={() => p.onOpen(l.lineId)} />;
        const pricing = p.pricing === l.lineId, shelf = it && it.onShelf != null ? it.onShelf : null;
        return (
          <OpenLine key={l.lineId} {...words(l)} aisle={aisle} chip={chipOf(l)} shelf={pricing ? null : shelf}
            onChip={() => p.onPricing(pricing ? null : l.lineId)} onHead={() => p.onOpen(l.lineId)} onQty={(n) => p.onQty(l.lineId, n)}>
            {pricing && <Price line={l} onPrice={(v) => p.onPrice(l.lineId, v)} onShop={() => { p.onPrice(l.lineId, l.shopPrice || 0); p.onPricing(null); }} />}
            {shelf != null && l.qty > shelf && <Short line={l} shelf={shelf} onMake={() => p.onQty(l.lineId, shelf)} onOrderIn={p.onOrderIn} />}
          </OpenLine>
        );
      })}
    </div>
  );
}
