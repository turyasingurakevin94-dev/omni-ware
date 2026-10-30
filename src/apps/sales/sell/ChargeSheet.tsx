/*
 * SL16 · add a charge: the shop's own charges (presets.services) at the
 * shop's rate, worked out from the order by core/services.ts (loading: a
 * rate a bag, for the bags in it; spec 04 Q3), one tap; or any other amount.
 * The charge goes on the order as one line; the total is money.ts's.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDelivery, perLines, serviceAmount } from '../../../core/services.ts';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { books } from '../shell/store.ts';
import { Frame } from './Frame.tsx';
import { whose } from './insights.ts';
import { addCharge, cur, itemOf } from './model.ts';
import { openAmount } from './sheets.tsx';
import './charge.css';

export function ChargeSheet(): JSX.Element | null {
  const b = books.value, x = cur.value;
  const list = b ? b.settings.services.filter((s) => !isDelivery(s)) : [];
  const [pick, setPick] = useState(list.length ? list[0].id : 'other');
  if (!b || !x) return null;
  const c = x.customerId ? b.customers.find((y) => y.id === x.customerId) : null;
  const eye = `${c ? whose(c.name) : 'This'} order`;
  const sv = list.find((s) => s.id === pick) || null, on = sv && sv.per ? sv.per : null;
  const lines = sv ? perLines(sv, x.lines) : [];
  const n = lines.reduce((s, l) => s + l.qty, 0), amount = sv ? serviceAmount(sv, x.lines) : 0;
  const first = lines[0], it = first ? itemOf(b, first.itemId, first.variantIdx) : null;
  const thing = first ? first.name.split(' · ')[0].split(' ')[0].toLowerCase() : '';
  const other = (label: string, rate?: number) => openAmount({ title: label, eyebrow: eye, value: 0, rate, verb: 'Add', onUse: (v) => addCharge(label, v) });
  const add = () => { if (sv && amount > 0) { addCharge(sv.label, amount); sheet.close(); } };
  return (
    <Frame title="Add a charge" eyebrow={eye} onClose={sheet.close} pad="12px 16px 20px"
      foot={<button type="button" class="sl-btn navy" disabled={!(amount > 0)} onClick={add}><Icon name="plus" size={18} stroke={2.4} />Add <span class="mono">{fig(amount)}</span></button>}>
      <div role="group" aria-label="What for" class="sl-chg-k">
        {list.map((s) => <button key={s.id} type="button" aria-pressed={pick === s.id} class={pick === s.id ? 'on' : ''} onClick={() => setPick(s.id)}>{s.label}</button>)}
        <button type="button" aria-pressed={pick === 'other'} class={pick === 'other' ? 'on' : ''} onClick={() => { setPick('other'); other('Other charge'); }}>Other</button>
      </div>
      {sv && on && (
        <div class="sl-chg">
          <div class="sl-chg-h">
            <ItemSquare aisle={it ? it.aisle : ''} size={44} />
            <span class="sl-chg-t"><span>{`${sv.label} the ${thing}`}</span><span>the shop’s rate · <span class="mono">{fig(sv.value)}</span>{` a ${on}`}</span></span>
            <span class="mono sl-chg-a">{fig(amount)}</span>
          </div>
          <div role="img" aria-label={`${n} ${on}s at ${fig(sv.value)} each`} class="sl-chg-blocks">{Array.from({ length: Math.min(n, 60) }, (_, i) => <span key={i} />)}</div>
          <span class="sl-chg-n"><b class="mono">{n}</b>{` ${on}s × `}<b class="mono">{fig(sv.value)}</b></span>
        </div>
      )}
      <a href="#" class="sl-chg-other" onClick={(e) => { e.preventDefault(); other(sv ? sv.label : 'Other charge', amount || undefined); }}><Icon name="pen" size={16} stroke={2} />Other amount</a>
    </Frame>
  );
}
