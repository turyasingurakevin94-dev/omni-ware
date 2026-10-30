/*
 * SL18–SL20 · their price on a line (S03 keypad, in a light sheet):
 *   SL18  under the shop's price: the Manager decides it ("Ruth says yes before it is packed")
 *   SL19  about ten times the shop's: a zero too many? "Make it 38,200"
 *   SL20  under what it costs the shop: refused (0171 OWCST); only "Keep 38,000". The cost is never said.
 * The first key replaces the figure; the rest add to it.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { lineTotal } from '../../../core/money.ts';
import { priceTooLow } from '../../../core/orders.ts';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Keypad, ladderPct } from '../../../ui/Keypad.tsx';
import { fig } from '../../../ui/Money.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { books, me } from '../shell/store.ts';
import { first, lastPaid } from './insights.ts';
import { cur, setPrice } from './model.ts';
import { manager } from './people.ts';
import './price.css';

/** How many of a unit, said: "40 sheets", "20 bags". */
export function countWord(qty: number, name: string, unit: string): string {
  const noun = /sheet/i.test(name) ? 'sheet' : unit === 'pc' ? 'piece' : unit;
  return `${qty} ${noun}${qty === 1 ? '' : 's'}`;
}

export function PriceSheet(p: { lineId: number }): JSX.Element | null {
  const x = cur.value, b = books.value, l = x ? x.lines.find((y) => y.lineId === p.lineId) : null;
  const [typed, setTyped] = useState<string | null>(null);
  if (!x || !b || !l || l.shopPrice == null) return null;
  const shop = l.shopPrice, now = l.price ?? shop, v = typed == null ? now : Number(typed || 0);
  const low = v > 0 && priceTooLow(l, v), high = v >= shop * 5, under = !low && v > 0 && v < shop;
  const last = x.customerId ? lastPaid(b, x.customerId, l.itemId, l.variantIdx) : null, m = manager(b);
  const c = x.customerId ? b.customers.find((y) => y.id === x.customerId) : null;
  const short = l.name.split(' · ')[0];
  const pct = low ? 2.5 : high ? 98 : ladderPct(v, l.cost || 0, shop);
  const tone = low || high ? 'bad' : '';
  const keep = () => { if (now !== shop) setPrice(l.lineId, shop, ''); sheet.close(); };
  const use = (n: number) => { setPrice(l.lineId, n, me.value ? me.value.id : ''); sheet.close(); };
  const was = lineTotal(l), will = lineTotal({ ...l, price: v });
  const label = `${fig(v)} is ${under ? 'under' : low ? 'under the cost, below' : 'at'} the shop's price of ${fig(shop)}${last === shop ? `, which is also what ${c ? first(c.name) : 'they'} paid last` : ''}`;
  return (
    <LightSheet title={`Price · ${short}`} onClose={sheet.close} pad="10px 16px 20px" gap={10}>
      <div role="img" aria-label={label} class="sl-ladder">
        <div class="sl-ladder-t">
          <span class="sl-ladder-b" />
          <span class="sl-ladder-k" />
          {last === shop && !high && !low && <span aria-hidden="true" class="sl-ladder-last" />}
          {high ? <span class="mono sl-ladder-x">{`×${Math.round(v / shop)}`}<Icon name="arrow-right" size={11} stroke={2.6} /></span>
            : <span class={'sl-ladder-m' + (low ? ' bad' : '')} style={{ left: `calc(${pct}% - 10px)` }} />}
        </div>
        <div class="sl-ladder-l"><span>cost</span><span class="mono">{`shop${last === shop ? ' · last' : ''} ${fig(shop)}`}</span></div>
      </div>
      <div class={'sl-pf ' + tone}>
        <span class="sl-pf-t"><span>Their price, each</span><span class="mono">{fig(v)}<span aria-hidden="true" class="sl-caret" /></span></span>
        {under && <span class="mono sl-pfield-d"><Icon name="tag" size={12} stroke={2.4} />{fig(v - shop)}</span>}
      </div>
      <div class="sl-outcome"><span>{`${countWord(l.qty, l.name, l.unit)} come to`}</span>{low ? <span class="mono faint">—</span> : <span class="mono">{v !== now && <><s>{fig(was)}</s>{' → '}</>}{fig(will)}</span>}</div>
      {under && <div class="sl-callout warn"><span aria-hidden="true" class="ow-av" style={avatarStyle({ initials: m.initials, tint: m.tint, size: 28, font: 11 })}>{m.initials}</span><span>{`Under the shop’s price. ${m.first} says yes before it is packed.`}</span></div>}
      {high && <div class="sl-callout bad"><Icon name="warning" size={18} stroke={2} /><span>About {Math.round(v / shop)} times the shop’s <span class="mono">{fig(shop)}</span>. A zero too many?</span></div>}
      {low && <div class="sl-callout bad"><Icon name="lock" size={18} stroke={2} /><span>Under what it costs the shop. It can’t go this low.</span></div>}
      <Keypad value={typed == null ? '' : typed} onChange={(d) => setTyped(d)} />
      <div class={'sl-two' + (low ? ' one' : '')}>
        {low
          ? <button type="button" class="sl-btn navy" onClick={keep}>Keep <span class="mono">{fig(shop)}</span></button>
          : high
            ? <><button type="button" class="sl-btn ghost" onClick={() => use(v)}>Yes, <span class="mono">{fig(v)}</span></button><button type="button" class="sl-btn navy" onClick={() => use(Math.round(v / 10))}>Make it <span class="mono">{fig(Math.round(v / 10))}</span></button></>
            : <><button type="button" class="sl-btn ghost" onClick={keep}>Keep <span class="mono">{fig(shop)}</span></button><button type="button" class="sl-btn navy" disabled={!(v > 0)} onClick={() => use(v)}>Use <span class="mono">{fig(v)}</span></button></>}
      </div>
    </LightSheet>
  );
}
