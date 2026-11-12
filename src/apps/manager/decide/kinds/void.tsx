/*
 * D-19 Void asked (DecideOrders p4): entered twice, the twin that stays beside the one to void (same
 * total · same day); what was paid on it and what the customer owes after (as a deposit, and the
 * figure with a refund instead). Money paid: Refund · Deposit is picked first; till then the knob is
 * grey, "Pick refund or deposit". Slide Voided · 320,000 (voidBill) · Kept as billed (a tap).
 */
import { money } from '../../../../core/money.ts';
import { owesAfterVoid } from '../../../../core/manager/decide-orders.ts';
import { AFTER_WORDS } from '../../../../core/manager/words.ts';
import type { MOrder, VoidAsk } from '../../../../core/manager/types.ts';
import { twins } from '../../../../core/manager/watch.ts';
import { ANSWER } from '../../../../core/manager/words.ts';
import { orderNo } from '../../../../core/names.ts';
import { dayLabel } from '../../../../core/time.ts';
import type { JSX } from 'preact';
import type { Kind } from '../kit.ts';
import { MoneyChips, moneyOf, OwesBar, type How } from './after.tsx';

function Twin(p: { o: MOrder; drop: boolean }): JSX.Element {
  return (
    <span class={'mg-af-twin' + (p.drop ? ' drop' : '')}>
      <span>{orderNo(p.o.id)}<span class={'mg-pill' + (p.drop ? '' : ' good')}>{p.drop ? AFTER_WORDS.void : AFTER_WORDS.stays}</span></span>
      <b>{money(p.o.total)}</b>
      <em>{`${dayLabel(p.o.createdAt).slice(4)} · ${p.o.lines.length} line${p.o.lines.length === 1 ? '' : 's'}`}</em>
    </span>
  );
}

export const kind: Kind<VoidAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId)!;
  const cust = c.b.customers.find((x) => x.id === o.customerId) || null;
  const pair = twins(c.b).find((t) => t.drop.id === o.id || t.keep.id === o.id) || null;
  const stays = pair ? (pair.drop.id === o.id ? pair.keep : pair.drop) : null;
  const sameDay = stays ? dayLabel(stays.createdAt) === dayLabel(o.createdAt) : false;
  const [how, setHow] = c.pick<How>('how', null);
  const shown: 'refund' | 'deposit' = how || 'deposit';
  const other: 'refund' | 'deposit' = shown === 'deposit' ? 'refund' : 'deposit';
  const label = `${ANSWER.voided} · ${money(o.total)}`;
  const paid = o.paid > 0;
  return {
    evidence: (
      <>
        {stays && (
          <div class="mg-card">
            <div class="mg-card-h"><span>{AFTER_WORDS.enteredTwice}</span><span class="mg-mono mg-soft">{[stays.total === o.total ? 'same total' : '', sameDay ? 'same day' : ''].filter(Boolean).join(' · ')}</span></div>
            <div class="mg-af-twins"><Twin o={stays} drop={false} /><span class="mg-af-eq" aria-hidden="true">=</span><Twin o={o} drop /></div>
          </div>
        )}
        {!stays && c.a.note && <div class="mg-quote">{c.a.note}</div>}
        {cust && (
          <OwesBar who={`${cust.name} owes`} was={cust.owes} now={owesAfterVoid(cust, o, paid ? shown : 'refund')}
            head={paid ? <div class="mg-af-row"><span>{`Paid on ${orderNo(o.id)}`}</span><b class="mg-mono">{money(o.paid)}</b></div> : undefined}
            under={paid ? `with ${other === 'refund' ? ANSWER.refund : ANSWER.deposit} instead: ${money(owesAfterVoid(cust, o, other))}` : undefined} />
        )}
      </>
    ),
    dock: {
      told: [c.asker ? c.asker.id : '', o.sellerId || ''],
      word: ANSWER.voided,
      above: paid ? <MoneyChips paid={o.paid} how={how} onPick={setHow} /> : null,
      primary: { slide: { label, disabled: paid && !how ? AFTER_WORDS.pickMoney : undefined, on: () => c.slide(label, 'voidBill', [c.a.askId, o.id, c.a.reason, paid ? moneyOf(how, o.paidBy) : null]) } },
      secondary: { label: ANSWER.keptBilled, on: () => c.tap(ANSWER.keptBilled, 'keepBilled', [c.a.askId]) },
    },
  };
};
