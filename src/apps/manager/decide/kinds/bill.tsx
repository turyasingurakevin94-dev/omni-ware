/*
 * D-9 Can't bill itself (Orders p1 "Can't bill itself": Walk-in · Only 567 · check it · #0561 ·
 * Grace · 1 line): why the hourly run held it (heldWord), the order's lines and total. Bill it
 * (billSmall, a tap with Undo 10) · Open the order. DecideOrders does not draw this sheet: it is the
 * Orders row in the sheet's shape. D-11 (Price coming / Packed short) goes to its own kind.
 */
import { money } from '../../../../core/money.ts';
import type { BillAsk } from '../../../../core/manager/types.ts';
import { ANSWER, heldWord } from '../../../../core/manager/words.ts';
import { firstWord, orderNo } from '../../../../core/names.ts';
import { nav } from '../../shell/nav.ts';
import type { Kind } from '../kit.ts';
import './after.css';

export const kind: Kind<BillAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId)!;
  const seller = c.b.team.find((p) => p.id === o.sellerId) || null;
  const word = `${ANSWER.billIt} · ${money(o.total)}`;
  return {
    chip: { text: heldWord(c.a.code, o.total), tone: 'amber' },
    evidence: (
      <div class="mg-card">
        <div class="mg-card-h"><b class="mg-af-name">{o.customerName}</b><span class="mg-mono mg-soft">{orderNo(o.id)}</span></div>
        {o.lines.map((l) => (
          <div class="mg-af-row" key={l.idx}>
            <span>{`${l.qty} ${l.name}`}<span class="mg-mono mg-soft">{` · ${money(l.price || 0)} a ${l.unit}`}</span></span>
            <span class="mg-mono s">{money(Math.round((l.price || 0) * l.qty))}</span>
          </div>
        ))}
        <div class="mg-af-row"><span class="mg-soft">{[seller ? firstWord(seller.name) : '', o.counter ? 'counter sale' : '', `${o.lines.length} line${o.lines.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span><b class="mg-mono">{money(o.total)}</b></div>
      </div>
    ),
    dock: {
      told: [o.sellerId || ''],
      word: 'Invoiced',
      primary: { tap: { label: word, on: () => c.tap('Invoiced', 'billSmall', [o.id]) } },
      secondary: { label: 'Open', on: () => nav.push('orders/order', { id: o.id }) },
    },
  };
};
