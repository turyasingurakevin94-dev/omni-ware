/*
 * customers/customer { id } · one customer (CU10, CU11, CU13, CU16, CU17; sheets CU12, CU15).
 * A full sheet over where it came from: the money picture in the navy head,
 * then their acts, their bills (each with its own Take), what is on the
 * move, their rhythm, and one navy button to sell to them.
 */
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { Button } from '../../../ui/Button.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { lastMessages } from '../../../core/chats.ts';
import { orderOwes, orderTotal, paidOver } from '../../../core/money.ts';
import { clock, dayLabel, dayOf, daysApart, howLong, when } from '../../../core/time.ts';
import { fig } from '../../../ui/Money.tsx';
import { isDataError } from '../../../core/datasource.ts';
import type { Books, ChatBooks, Customer, Member } from '../../../core/types.ts';
import { nav } from '../shell/nav.ts';
import { act, books, chats, drafts, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { openBillCheck } from './BillCheck.tsx';
import { AgeTrack, ApartHead, CustHead, PaidUp, SplitHead, first } from './cust-head.tsx';
import { Acts, AsksCard, BillRow, BillsCard, BillsHead, OnTheMove, PaidBills, Rhythm, TodayPaid } from './cust-cards.tsx';
import { billNo, owingOf } from '../../../core/owing.ts';
import { liveOf, placeKind, rhythmOf, short } from './data.ts';
import { markOpened } from './opened.ts';
import { openPromise } from './Promise.tsx';
import { sendStatement } from './statement.ts';
import './customers.css';

/** "Message Esther": a team note on their chat that mentions the checker, so 0170 pushes them (never sent to the customer). */
async function noteFor(chatId: number, who: Member, body: string): Promise<void> {
  try {
    const r = await act('note', chatId, body, [who.id]);
    toast.show(r.kept ? 'Not sent yet · sends with signal' : `${first(who.name)} gets a push`);
  } catch (e) {
    toast.show('Not sent', { kind: 'error', sub: isDataError(e) ? e.message : '' });
  }
}

const HOW = { cash: 'Cash', momo: 'Mobile', bank: 'Bank' } as const;

export function role(b: Books, r: 'manager' | 'accounts') {
  return b.members.find((m) => m.role === r) || b.me;
}

export function CustomerScreen(p: ScreenProps): JSX.Element {
  const b = books.value, c = b ? b.customers.find((x) => x.id === p.params.id) : null;
  useEffect(() => { if (c) markOpened(c.id, now.value); }, [c && c.id]);
  if (!b || !c) return <FullSheet onBack={() => nav.back()} backLabel="Back to Customers" head={<div class="ow-shead cu-head"><span aria-hidden="true" class="ow-shead-grab" /></div>} />;
  return <Sheet b={b} c={c} cb={chats.value} />;
}

function Sheet(p: { b: Books; c: Customer; cb: ChatBooks | null }): JSX.Element {
  const { b, c } = p, t = now.value, today = dayOf(t);
  const m = owingOf(b, c, today), r = rhythmOf(b, c, today), live = liveOf(b, c);
  const ruth = role(b, 'manager'), esther = role(b, 'accounts'), name = short(c.name);
  const pay = (bills?: number[]) => nav.push('customers/pay', bills ? { customer: c.id, bills: bills.join(',') } : { customer: c.id });
  const checkBill = (id: number) => openBillCheck(c.id, id);

  let picture: JSX.Element | null = null;
  if (m.apart > 0) picture = <ApartHead apart={m.apart} owes={m.owes} bills={m.bills} checker={esther} />;
  else if (m.checkedIn > 0) picture = <SplitHead owes={m.owes} oldest={m.age} collect={m.canTake} checked={m.checkedIn} checker={esther} onChecked={() => checkBill(m.bills.find((x) => x.checked)!.id)} />;
  else if (m.owes > 0) picture = <AgeTrack owes={m.owes} bills={m.bills} limit={c.creditLimit} manager={first(ruth.name)} hold={b.settings.holdDays} />;
  else picture = <PaidUp deposit={Math.max(0, -c.owes)} limit={c.creditLimit} manager={first(ruth.name)} />;
  // Nothing owed: their last bills, paid, so the page still says how they pay (CU16).
  const paid = m.owes > 0 || m.apart > 0 ? [] : b.orders.filter((o) => o.customerId === c.id && o.invoiced && !o.voided && !o.counter && orderOwes(o) <= 0).sort((x, y) => (y.invoicedAt || 0) - (x.invoicedAt || 0)).slice(0, 3);

  const head = m.apart > 0 ? <BillsHead title="Open bills · oldest first" note={`owes ${fig(m.owes)} in the books`} />
    : m.pastHold ? <BillsHead title="Bills · oldest first" hold={`new credit waits for ${first(ruth.name)}`} /> : null;
  // What is on the move, unless the sheet is about a bill being checked (CU11, CU13 need that room).
  const showMove = live.length > 0 && !m.apart && !m.checkedIn;
  // Nothing owed: today's money first (CU16: Nansana's 560,000 at 8:52, 90,000 over, OR15).
  const todays = paid.length || (m.owes <= 0 && !m.apart) ? b.payments.filter((x) => x.customerId === c.id && x.day === today && !x.qa).sort((x, y) => x.at - y.at).map((x) => {
    const asks = b.paymentAsks.filter((a) => a.paymentId === x.id && a.what === 'over');
    const over = asks.some((a) => a.status === 'done') ? 0 : paidOver(b, x).over;
    return { id: x.id, amount: x.amount, how: `${HOW[x.method]} · today ${clock(x.at)}`, over,
      overSub: asks.some((a) => a.status === 'sent') ? `Sent to ${first(esther.name)}` : 'Give change or Deposit', onOver: () => nav.push('orders/paid-over', { payment: x.id }) };
  }) : [];

  // The chat they asked in, while it waits (Lubowa · 12 m, CU13).
  const chat = p.cb ? p.cb.chats.find((x) => x.customerId === c.id) : null;
  const last = chat && p.cb ? lastMessages(p.cb.recent).get(chat.id) : null;
  const asked = last && last.dir === 'in' && last.body ? last : null;
  const ask = b.paymentAsks.find((a) => a.customerId === c.id && a.status === 'sent' && a.what === 'balance');

  const draft = drafts.value.find((d) => d.customerId === c.id);
  const sell = draft
    ? { icon: 'arrow-right' as const, word: `Resume order · ${orderTotal({ lines: draft.lines, charges: draft.charges, discount: 0, credit: draft.credit }).toLocaleString('en-US')}`, on: () => nav.push('sell/order', { customer: c.id }) }
    : c.usual.length ? { icon: 'undo' as const, word: 'Order usual', on: () => nav.push('sell/order', { customer: c.id, from: 'usual' }) }
      : { icon: 'plus' as const, word: 'New order', on: () => nav.push('sell/order', { customer: c.id }) };

  const rh = r.every && r.lastDay && r.due ? (() => {
    const gone = daysApart(r.lastDay, today), late = Math.max(0, -r.toDue);
    const pill = late ? `${late} day${late > 1 ? 's' : ''} late` : r.toDue === 0 ? 'Due today' : `in ${r.toDue} days`;
    const lastWords = r.lastDay === today && r.last ? `today ${when(r.last.placedAt, t)}` : dayLabel(r.lastDay);
    // Two bills and the move fill the sheet (CU10); with fewer, the dates fit under the blocks.
    const labels = showMove && m.bills.length > 1 ? null : late ? [dayLabel(r.lastDay), `due ${dayLabel(r.due)}`, 'today'] : [`last order ${lastWords}`, `due ${dayLabel(r.due)}`];
    return <Rhythm every={r.every} gone={gone} late={late} pill={pill} tone={late ? 'caution' : r.toDue === 0 ? 'good' : 'neutral'}
      label={`Last order ${lastWords}, due ${dayLabel(r.due)}, ${late ? `${late} days late` : r.toDue === 0 ? 'due today' : `due in ${r.toDue} days`}`} labels={labels} />;
  })() : null;

  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back to Customers" pad={showMove ? '12px 16px 14px' : undefined} gap={showMove ? 8 : undefined}
      head={<CustHead c={c} sub={placeKind(c)} tone={r.tone} fill={r.fill} onClose={() => nav.back()}>{picture}</CustHead>}>
      {todays.length > 0 && <TodayPaid rows={todays} />}
      {m.owes > 0 && <Acts acts={[
        { tone: 'take', icon: 'cash', word: 'Take payment', sub: m.canTake.toLocaleString('en-US'), on: () => pay() },
        { tone: 'promise', icon: 'calendar', word: 'Promise', sub: 'by when', on: () => openPromise(c.id) },
        { tone: 'statement', icon: 'receipt', word: 'Statement', sub: 'on WhatsApp', on: () => { void sendStatement(b, c, p.cb).then((w) => toast.show(w)); } },
      ]} />}
      {m.apart > 0 && <AsksCard checker={esther} askedAt={ask ? `asked ${dayOf(ask.at) === today ? 'today' : dayLabel(ask.at)} ${clock(ask.at)} · you get a push` : 'you get a push'}
        chat={asked && chat ? { who: name, ago: howLong(asked.at, t), text: asked.body, on: () => nav.push('chats/chat', { id: chat.id }) } : null}
        onEsther={chat ? () => { void noteFor(chat.id, esther, `@${first(esther.name)} ${name} is waiting on the ${fig(m.apart)} being checked`); } : null} />}
      {head}
      {m.bills.length > 0 && (
        <BillsCard>
          {m.bills.map((x) => <BillRow key={x.id} b={x} onTake={() => pay([x.id])} onChecked={m.checkedIn > 0 ? () => checkBill(x.id) : undefined}
            sub={x.checked && m.checkedIn > 0 ? `${billNo(x.id)} · paid already?` : undefined} />)}
        </BillsCard>
      )}
      {showMove && <OnTheMove orders={live} onOrder={(id) => nav.push('orders/order', { id })} />}
      {rh}
      {paid.length > 0 && <PaidBills orders={paid} onOrder={(id) => nav.push('orders/order', { id })} />}
      <div class="cu-sell"><Button icon={sell.icon} stroke={sell.icon === 'plus' ? 2.4 : 2.2} onClick={sell.on}>{sell.word}</Button></div>
    </FullSheet>
  );
}
