/*
 * TD05 · To collect: what the 4 who owe owe the shop, split past and under the 21-day hold, with
 * the part Accounts is checking hatched. Past 21 days: take it now (Play all, or one by one).
 * Under: a held order's money first (Mukono: 780,000 + #0551), else a reminder on WhatsApp.
 */
import type { JSX } from 'preact';
import { money, short } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { dayLabel, dayOf } from '../../../core/time.ts';
import type { Books } from '../../../core/types.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { PlayAll, SectionHead } from '../../../ui/SectionHead.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, chats, now } from '../shell/store.ts';
import { TitleHead } from './bits.tsx';
import { holdOf, owing, takeHeld, type Owing } from './data.ts';
import { go } from './go.ts';
import './collect.css';

export function ToCollect(): JSX.Element {
  const b = books.value, n = now.value;
  if (!b) return <main class="td-wait" aria-busy="true" />;
  const all = owing(b, n), sum = all.reduce((s, w) => s + w.owes, 0);
  const past = all.filter((w) => w.past > 0).sort((x, y) => y.age - x.age), under = all.filter((w) => w.past === 0).sort((x, y) => Number(!!y.held) - Number(!!x.held) || y.owes - x.owes);
  const take = past.reduce((s, w) => s + w.take, 0), underSum = under.reduce((s, w) => s + w.under, 0), checked = all.reduce((s, w) => s + w.checked, 0);
  const pastNotChecked = all.reduce((s, w) => s + w.past - w.checked, 0);
  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back to Today" head={
      <TitleHead title="To collect" sub={`${all.length} customers owe the shop`} onClose={() => nav.back()}>
        <div class="td-col-pic">
          <span class="td-col-fig"><span>UGX</span><span class="mono">{money(sum)}</span></span>
          <span role="img" aria-label={`${money(pastNotChecked)} past 21 days, ${money(underSum)} under 21 days, ${money(checked)} being checked`} class="td-col-bar">
            <span style={{ flex: pastNotChecked }} /><span style={{ flex: underSum }} />{checked > 0 && <span style={{ flex: checked }} />}
          </span>
          <span class="td-col-key">
            <span><span aria-hidden="true" />Take <b class="mono">{money(take)}</b></span>
            <span><span aria-hidden="true" />Under 21 days</span>
            {checked > 0 && <span><span aria-hidden="true" />Being checked</span>}
          </span>
        </div>
      </TitleHead>
    }>
      {past.length > 0 && <SectionHead title="Past 21 days" right={<PlayAll count={past.length} amount={short(take)} on={() => go('customers/pay', { customer: past[0].c.id })} />} />}
      {past.length > 0 && <GroupCard>{past.map((w) => <OweRow key={w.c.id} b={b} w={w} past />)}</GroupCard>}
      {under.length > 0 && <SectionHead title="Under 21 days" meta={money(underSum)} after />}
      {under.length > 0 && <GroupCard>{under.map((w) => <OweRow key={w.c.id} b={b} w={w} />)}</GroupCard>}
    </FullSheet>
  );
}

function OweRow(p: { b: Books; w: Owing; past?: boolean }): JSX.Element {
  const { b, w } = p, c = w.c, today = dayOf(now.value), who = c.name.replace('&', 'and');
  const open = () => go('customers/customer', { id: c.id });
  const takeBills = w.bills.filter((x) => x.past && !x.checked), checker = b.members.find((m) => m.role === 'accounts');
  // A promise shows on the day it falls due (Mukono: today); a later one is on the customer's own screen.
  const promise = b.promises.filter((x) => x.customerId === c.id && x.on === today)[0];
  const chat = chats.value ? chats.value.chats.find((x) => x.customerId === c.id) : null;
  const amount = p.past ? w.take : w.held ? takeHeld(w) : 0;
  const sub = p.past && takeBills.length === 1 && takeBills[0].orderId ? `${orderNo(takeBills[0].orderId)} · ${takeBills[0].age} days`
    : amount > 0 ? `${w.age} days · ${w.bills.length} bills`
    : <><span class="mono">{money(w.owes)}</span>{` · hold ${dayLabel(holdOf(w, b) || today)}`}</>;
  const pay = () => (w.held ? go('sell/order', { customer: c.id }) : go('customers/pay', { customer: c.id }));
  return (
    <div class={'td-owe' + (amount > 0 && !(w.checked > 0 || w.held || promise) ? ' tight' : '')}>
      <div class="td-owe-r">
        <Tap on={w.held ? pay : open} class="td-owe-who">
          <Avatar initials={c.initials} tint={c.tint} size={40} />
          <span class="td-owe-t"><span>{c.name}</span><span>{sub}</span></span>
        </Tap>
        {amount > 0
          ? <Tap on={pay} label={`Take ${money(amount)} from ${who}${w.held ? `: ${money(w.owes)} owed and ${orderNo(w.held.id)}` : ''}`} class="td-owe-take"><span>Take <span class="mono">{money(amount)}</span></span></Tap>
          : <Tap on={() => (chat ? go('chats/chat', { id: chat.id }) : open())} label={`Remind ${who} on WhatsApp`} class="td-owe-wa"><Duo i={phWhatsapp} size={19} color="#0F6B43" /></Tap>}
      </div>
      {(w.checked > 0 || w.held || promise) && (
        <div class="td-owe-x">
          {w.checked > 0 && checker && (
            <Tap on={open} class="td-owe-chk"><span><Avatar initials={checker.initials} tint={checker.tint} size={20} /><span class="mono">{money(w.checked)}</span>{` being checked · ${firstWord(checker.name)}`}</span></Tap>
          )}
          {w.held && <span class="mono td-owe-sum">{`${money(w.owes)} + ${orderNo(w.held.id)} ${money(takeHeld(w) - w.owes)}`}</span>}
          {promise && promise.amount && (
            <span class="td-owe-prom"><Icon name="calendar" size={13} stroke={2.2} />Promised <span class="mono">{money(promise.amount)}</span>{' · today'}</span>
          )}
        </div>
      )}
    </div>
  );
}
