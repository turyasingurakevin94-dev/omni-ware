/*
 * D-4 At the counter · under the shop's price (DecidePrice p2): a walk-in stands there paying
 * cash, so it waits first in the queue. The same evidence as D-1 (price.tsx `under`) with the
 * chip "Paying now · cash", the line read "Walk-in · paying now · cash", and no rung: the answer
 * is Approved or the shop's price, so Grace's counter screen can turn to pay.
 */
import { lineShopPrice } from '../../../../core/manager/price.ts';
import type { CounterAsk } from '../../../../core/manager/types.ts';
import type { Kind } from '../kit.ts';
import { under } from './price.tsx';

export const kind: Kind<CounterAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId);
  const l = o ? o.lines[c.a.idx] : null;
  if (!o || !l) return { evidence: <div class="mg-card">This line is gone</div>, dock: { told: [], word: '', primary: { tap: { label: '', disabled: 'This line is gone', on: () => undefined } } } };
  const v = under(c, o, l, lineShopPrice(l, c.b.shop.defaultMarkup), { sub: `${o.customerName} · paying now · cash` });
  return { ...v, chip: { text: 'Paying now · cash', tone: 'amber' } };
};
