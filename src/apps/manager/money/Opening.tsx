/*
 * Old books (route `money/opening` { customer }, Added2 p3, AD04, D-27): the figure from the fresh
 * start and since when; what they owe with it against the limit (the old books hatched); their bills,
 * the old books "new". The slide "Opening balance · 290,000" goes at once and in the owner's log;
 * no signal: it waits (a slide never queues). Done: the Old books card empties ("0 left").
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { dayLabel, dayOf } from '../../../core/time.ts';
import { money, short } from '../../../core/money.ts';
import { oldestDays } from '../../../core/manager/credit.ts';
import { afterOpening } from '../../../core/manager/money.ts';
import { Icon } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import type { Params } from '../../../ui/stack.ts';
import { toast } from '../../../ui/toast.tsx';
import { nav, top } from '../shell/nav.ts';
import { act, books, now, online } from '../shell/store.ts';
import { booksDone } from './Customer.tsx';
import { MoneyDock, MoneySheet } from './parts.tsx';
import './sheets.css';

const dm = (day: string) => dayLabel(day).split(' ').slice(1).join(' ');

export function OpeningSheet(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  const [error, setError] = useState(false);
  if (!b) return null;
  const c = b.customers.find((x) => x.id === p.params.customer);
  if (!c || !c.oldBooks) return null;
  const ob = c.oldBooks, today = dayOf(now.value), aft = afterOpening(c, ob.amount);
  const firstBill = c.bills.find((x) => x.orderId !== 0 && x.left > 0);
  const me = top.value.key;
  const go = async () => {
    setError(false);
    try {
      await act('opening', c.id, ob.amount, ob.since);
      booksDone.value = [...booksDone.value, c.id];
      if (top.peek().key === me) nav.back();
      toast.show(`Opening balance · ${money(ob.amount)}`, { sub: `${c.name} owes ${money(aft.owes)}` });
    } catch (_e) { setError(true); }
  };
  return (
    <MoneySheet label="Old books" top={136}
      head={<div class="mg-mo-sh"><span class="mg-mo-sh-i"><Icon name="note" size={20} stroke={2} /></span><span class="mg-mo-sh-t"><b>Old books</b><span>{`${c.name} · since ${dm(ob.since)}`}</span></span></div>}
      dock={<MoneyDock log error={error ? 'Not sent · Try again' : null}
        slide={{ label: `Opening balance · ${money(ob.amount)}`, sending: 'Sending…', on: go, offline: !online.value }} />}>
      <div class="mg-mo-card mg-mo-obfig">
        <span class="n"><span>Old books</span><span>from the fresh start · <b class="mono">{dm(ob.since)}</b></span></span>
        <b class="mono f">{money(ob.amount)}</b>
      </div>
      <div class="mg-mo-card mg-mo-obbar">
        <div class="h"><span>Owes</span><span class="mono"><s>{money(Math.max(0, c.owes))}</s>{` → ${money(aft.owes)}`}</span></div>
        <div class="bar">
          <div><i class="old" style={{ width: `${(ob.amount / aft.scale) * 100}%` }} /><i style={{ width: `${(Math.max(0, c.owes) / aft.scale) * 100}%` }} /></div>
          {c.limit && <i class="line" style={{ left: `${(c.limit / aft.scale) * 100}%` }} />}
        </div>
        {c.limit && aft.left != null && (
          <div class="k"><span>limit <b class="mono">{short(c.limit)}</b></span>
            <span class="warn"><b class="mono">{money(Math.abs(aft.left))}</b>{aft.left >= 0 ? ' left' : ' over'}</span></div>
        )}
      </div>
      <SectionHead title="Bills" meta="2" />
      <div class="mg-mo-list">
        <div class="mg-mo-obrow"><i class="old" /><span class="n"><b>Old books</b><span class="mono">{`since ${dm(ob.since)}`}</span></span><b class="mono f">{money(ob.amount)}</b><span class="mg-mo-chip warn">new</span></div>
        <div class="mg-mo-obrow"><i /><span class="n"><b>{c.orders === 1 ? '1 order' : `${c.orders} orders`}</b>
          <span class="mono">{firstBill ? `${dm(firstBill.day)} → ${dm(today)} · oldest ${oldestDays(c, today)} d` : ''}</span></span><b class="mono f">{money(Math.max(0, c.owes))}</b></div>
      </div>
    </MoneySheet>
  );
}
