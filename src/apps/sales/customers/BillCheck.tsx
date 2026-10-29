/*
 * CU12 · A bill being checked: "Paid already?". The open bill beside the
 * payment it may be the same money as; Sales says what the customer says
 * and sends it to Accounts (Esther), who corrects the books
 * (askPaymentFix → payment_asks). What is not being checked can still be taken.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { BillMatch } from '../../../ui/BillMatch.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { isDataError } from '../../../core/datasource.ts';
import { money } from '../../../core/money.ts';
import { orderNo, TINTS } from '../../../core/names.ts';
import { dayOf } from '../../../core/time.ts';
import type { Books, Payment } from '../../../core/types.ts';
import { act, books, now } from '../shell/store.ts';
import { role } from './Customer.tsx';
import { first } from './cust-head.tsx';
import { moneyOf, short } from './data.ts';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (day: string) => { const d = new Date(day + 'T00:00:00Z'); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
const WORD = { cash: 'cash', momo: 'Mobile', bank: 'Bank' } as const;

/** The payment the bill may be: theirs, the same amount, from the day it was billed, paid on another order. */
export function matchFor(b: Books, customerId: string, orderId: number, left: number, day: string): Payment | null {
  return b.payments.find((x) => x.customerId === customerId && x.amount === left && x.day === day && x.orderId !== orderId) || null;
}

export function openBillCheck(customerId: string, orderId: number): void {
  const b = books.value, c = b && b.customers.find((x) => x.id === customerId);
  if (!b || !c) return;
  sheet.open(() => <BillCheck customerId={customerId} orderId={orderId} />, { label: 'Paid already?', top: 330 });
}

function BillCheck(p: { customerId: string; orderId: number }): JSX.Element {
  const b = books.value!, c = b.customers.find((x) => x.id === p.customerId)!, today = dayOf(now.value);
  const m = moneyOf(b, c, today), bill = m.bills.find((x) => x.id === p.orderId);
  const esther = role(b, 'accounts'), name = short(c.name), t = TINTS[esther.tint];
  const [paid, setPaid] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!bill) return <LightSheet title="Paid already?" onClose={sheet.close}><span class="cu-k">{`${orderNo(p.orderId)} is settled`}</span></LightSheet>;
  const pay = matchFor(b, c.id, bill.id, bill.left, bill.day);
  const how = pay ? WORD[pay.method] : 'cash';

  const send = async () => {
    if (!pay) { toast.show(`${first(esther.name)} needs the payment it may be`, { kind: 'warn' }); return; }
    setBusy(true);
    try {
      const r = await act('askPaymentFix', { paymentId: pay.id, what: 'bill', want: { orderId: bill.id, paidAlready: paid }, note: paid ? 'Already paid that day' : 'Still owed' });
      sheet.close();
      toast.show(r.kept ? 'Kept on this phone · sends with signal' : `Sent to ${first(esther.name)}`);
    } catch (e) {
      toast.show('Not sent', { kind: 'error', sub: isDataError(e) ? e.message : '', retry: () => { void send(); } });
    } finally { setBusy(false); }
  };

  const choice = (on: boolean, title: string, sub: string, pick: () => void) => (
    <button type="button" role="radio" aria-checked={on} class={'cu-choice' + (on ? ' on' : '')} onClick={pick}>
      <span aria-hidden="true" class="cu-choice-dot">{on && <Icon name="check" size={13} stroke={3} />}</span>
      <span class="cu-choice-t"><span>{title}</span><span>{sub}</span></span>
    </button>
  );

  return (
    <LightSheet class="cu-ls" eyebrow={`Bill ${orderNo(bill.id)} · ${c.name}`} title="Paid already?" onClose={sheet.close} pad="12px 16px 20px" gap={12}
      foot={<Button icon="send" state={busy ? 'sending' : 'idle'} onClick={() => { void send(); }}>{`Send to ${first(esther.name)}`}</Button>}>
      <BillMatch label={`This bill, ${money(bill.left)} open from ${dm(bill.day)}, matches ${pay && pay.orderId ? `order ${orderNo(pay.orderId)}` : 'a payment'}, ${money(pay ? pay.amount : bill.left)} paid in ${how} the same day`}
        bill={{ k: `${orderNo(bill.id)} · open`, v: bill.left, sub: `billed ${dm(bill.day)}` }}
        paid={{ k: `paid in ${how}`, v: pay ? pay.amount : bill.left, sub: `receipt · ${dm(pay ? pay.day : bill.day)}` }} />
      <span class="cu-ask-h">{`What does ${name} say?`}</span>
      <div role="radiogroup" aria-label={`What does ${name} say?`} class="cu-choices">
        {choice(paid, 'Already paid that day', `the ${money(bill.left)} ${how} · take the bill off`, () => setPaid(true))}
        {choice(!paid, 'Still owed', 'keep it on the bill', () => setPaid(false))}
      </div>
      <div class="cu-who"><span aria-hidden="true" style={{ background: t.bg, color: t.fg }}>{esther.initials}</span>{`${first(esther.name)} checks it · ${name}’s ${money(m.take)} can still be taken`}</div>
    </LightSheet>
  );
}
