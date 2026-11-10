/*
 * SL21 · an item with no selling price yet ("Price coming"): it still goes
 * on the order. Who brings the price, as faces on a path (Moses finds the
 * cost, Ruth sets the price at Checking, the customer hears it from you),
 * what is priced so far, how many. Spec 04 Q10: that order, the default.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { avatarStyle } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Frame } from './Frame.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { books } from '../shell/store.ts';
import { first, lastQty } from './insights.ts';
import { add, cur, itemOf, query, setQty, sums } from './model.ts';
import { manager, sourcing } from './people.ts';
import './coming.css';

export function ComingSheet(p: { itemId: string; variantIdx: number | null; lineId: number | null; qty?: number }): JSX.Element | null {
  const b = books.value, x = cur.value, it = b ? itemOf(b, p.itemId, p.variantIdx) : undefined;
  const line = x && p.lineId != null ? x.lines.find((l) => l.lineId === p.lineId) : null;
  const [n, setN] = useState(() => (line ? line.qty : p.qty || (b && x && x.customerId ? lastQty(b, x.customerId, p.itemId) : null) || 1));
  if (!b || !x || !it) return null;
  const c = x.customerId ? b.customers.find((y) => y.id === x.customerId) : null, s = sums.value, ml = sourcing(b), rn = manager(b);
  const short = it.name.split(' · ')[0], word = short.split(' ').slice(-1)[0].toLowerCase();
  const so = s ? s.cash : 0;
  const face = (f: { initials: string; tint: Parameters<typeof avatarStyle>[0]['tint'] }, now: boolean) => (
    <span aria-hidden="true" class="ow-av sl-path-av" style={{ ...avatarStyle({ ...f, size: 44, font: 14 }), boxShadow: `0 0 0 3px #FFFFFF, 0 0 0 5px ${now ? '#F5B26B' : '#E6E3DD'}` }}>{f.initials}</span>
  );
  const done = () => {
    if (line) setQty(line.lineId, n); else add(it, n);
    query.value = '';
    sheet.close();
  };
  return (
    <Frame title={short} icon={<ItemSquare aisle={it.aisle} size={44} />} onClose={sheet.close} pad="14px 16px 20px" class="sl-coming"
      foot={<button type="button" class="sl-btn navy" onClick={done}><Icon name="plus" size={18} stroke={2.4} />{line ? 'Done' : 'Add · price coming'}</button>}>
      <div class="sl-path">
        <div class="sl-path-h">
          <span aria-hidden="true" class="sl-path-ic"><Icon name="tag" size={20} stroke={2} /></span>
          <span class="sl-path-ht"><span>No selling price yet</span><span>It still goes on the order{it.orderIn && <span class="sl-tag info">Order in</span>}</span></span>
        </div>
        <div class="sl-path-r">
          <span aria-hidden="true" class="sl-path-line" />
          <div class="sl-path-s">{face(ml, true)}<span>{ml.first}</span><span class="now">finds the cost</span></div>
          <div class="sl-path-s">{face(rn, false)}<span>{rn.first}</span><span>sets the price at Checking</span></div>
          {c && <div class="sl-path-s">{face(c, false)}<span>{first(c.name)}</span><span>hears it from you</span></div>}
        </div>
      </div>
      <div role="img" aria-label={`${c ? first(c.name) : 'They'} pay ${fig(so)} now; the ${word} is added when ${rn.first} prices it`} class="sl-sofar">
        <div class="sl-sofar-b"><span /><span /></div>
        <div class="sl-sofar-l"><span>Priced so far <b class="mono">{fig(so)}</b></span><span>{`+ ${word}, when priced`}</span></div>
      </div>
      <div class="sl-many"><span>How many</span><Stepper value={n} unit={it.unit} min={1} onChange={setN} /></div>
    </Frame>
  );
}
