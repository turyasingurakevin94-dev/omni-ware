/*
 * S03 · The price change keypad (LANGUAGE.md §5.2 S03), in a light sheet
 * "Price · Iron sheet G28": the ladder (where the price sits: cost, the
 * shop's price; cost is never written as a number to Sales), the price
 * field, what the line comes to, a Callout below the shop's price, the
 * keypad, and the pair "Keep 38,000" (ghost) / "Use 36,500" (navy).
 *
 *   <PriceLadder pct={ladderPct(36500, cost, 38000)} shop={38000} label="36,500 is under the shop's price of 38,000" />
 *   <PriceField label="Their price, each" value={36500} diff={-1500} />
 *   <Outcome words="40 sheets come to" was={1520000} now={1460000} />
 *   <Keypad value={typed} onChange={setTyped} />
 */
import type { JSX } from 'preact';
import { Icon } from './icons.tsx';
import { fig } from './Money.tsx';
import type { Fig } from './util.tsx';
import './keypad.css';

/** Where a price sits on the ladder, %: the cost end at 18, the shop's price at 72. */
export function ladderPct(price: number, cost: number, shop: number): number {
  if (!(shop > cost)) return price >= shop ? 80 : 40;
  return Math.max(2, Math.min(98, 18 + ((price - cost) / (shop - cost)) * 54));
}

export function PriceLadder(p: { pct: number; shop: Fig; label: string; shopWord?: string; shopPct?: number }): JSX.Element {
  const at = p.shopPct ?? 72;
  return (
    <div role="img" aria-label={p.label} class="ow-ladder">
      <div class="ow-ladder-t">
        <span class="ow-ladder-band" style={{ background: `linear-gradient(90deg, #FBE5E2 0 18%, #FDEEE1 18% ${at}%, #E4F4EA ${at}% 100%)` }} />
        <span class="ow-ladder-tick" style={{ left: `${at}%` }} />
        <span class="ow-ladder-mark" style={{ left: `calc(${p.pct}% - 10px)` }} />
      </div>
      <div class="ow-ladder-l"><span>cost</span><span class="mono" style={{ left: `${at}%` }}>{`${p.shopWord || 'shop'} ${fig(p.shop)}`}</span></div>
    </div>
  );
}

/** The price field: 60 tall, a 2 px ink outline, the key and the figure, the difference as a chip. */
export function PriceField(p: { label: string; value: Fig; diff?: Fig; style?: JSX.CSSProperties }): JSX.Element {
  return (
    <div class="ow-pfield" style={p.style}>
      <span class="ow-pfield-t"><span>{p.label}</span><span class="mono" aria-live="polite">{fig(p.value)}</span></span>
      {p.diff != null && <span class="mono ow-pfield-d">{fig(p.diff)}</span>}
    </div>
  );
}

/** "40 sheets come to 1,520,000 → 1,460,000": the old figure struck. */
export function Outcome(p: { words: string; was?: Fig; now: Fig }): JSX.Element {
  return (
    <div class="ow-outcome">
      <span>{p.words}</span>
      <span class="mono">{p.was != null && <><s>{fig(p.was)}</s> → </>}<b>{fig(p.now)}</b></span>
    </div>
  );
}

/** A 3 × 4 keypad of 56 px keys: digits, "000" and delete. It types: onChange gets the new digits. */
export function Keypad(p: { value: string; onChange: (v: string) => void; max?: number }): JSX.Element {
  const max = p.max || 9;
  const put = (k: string) => {
    const v = (p.value + k).replace(/^0+(?=\d)/, '');
    if (v.length <= max) p.onChange(v);
  };
  const key = (k: string) => <button key={k} type="button" class="ow-key mono" onClick={() => put(k)}>{k}</button>;
  return (
    <div class="ow-keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(key)}
      <button type="button" class="ow-key mono soft" onClick={() => put('000')}>000</button>
      {key('0')}
      <button type="button" class="ow-key soft" aria-label="Delete" onClick={() => p.onChange(p.value.slice(0, -1))}><Icon name="backspace" size={22} /></button>
    </div>
  );
}
