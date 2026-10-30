/*
 * chats/customer · CH33: the customer, from the chat. Whose they are and since when, their page,
 * who served them this year (each person as a bar of what they sold, with their messages and
 * orders), what happened lately (orders placed, the Manager's prices, gives), and the three acts:
 * Call, Take payment (what they owe), Give to a teammate.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { money, orderTotal, short } from '../../../core/money.ts';
import { TINTS, firstWord, orderNo } from '../../../core/names.ts';
import { clock, dayLabel, dayOf } from '../../../core/time.ts';
import type { Member, Ms } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet, HeadChip } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, chats, now, source } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { GiveSheet } from './GiveSheet.tsx';
import { faceOf } from './model.ts';
import { open } from './parts.tsx';
import './sheets.css';

const KIND: Record<string, string> = { contractor: 'Contractor', reseller: 'Reseller', retail: 'Retail' };

export function ChatCustomer(p: ScreenProps): JSX.Element {
  const id = Number(p.params.id);
  const b = books.value, cb = chats.value, t = now.value;
  const [served, setServed] = useState<{ by: string; messages: number }[] | null>(null);
  useEffect(() => { source.served(id).then((x) => setServed(x), () => setServed([])); }, [id]);
  const chat = cb && cb.chats.find((c) => c.id === id);
  const cust = b && chat && chat.customerId ? b.customers.find((c) => c.id === chat.customerId) : null;
  if (!b || !cb || !chat || !cust) return <FullSheet onBack={nav.back} backLabel="Back to the chat" head={<div class="ow-shead" />} />;
  const first = firstWord(cust.name), year = dayOf(t).slice(0, 4), me = b.me;
  const owner = b.members.find((m) => m.id === chat.ownerId) || null;
  const orders = b.orders.filter((o) => o.customerId === cust.id && !o.voided && !o.cancelled && dayOf(o.placedAt).startsWith(year));
  const rows = (served || []).map((s) => {
    const m = b.members.find((x) => x.id === s.by) as Member;
    const mine = orders.filter((o) => o.placedBy === s.by);
    return { m, msgs: s.messages, n: mine.length, sum: mine.reduce((a, o) => a + orderTotal(o), 0) };
  }).filter((r) => r.m).sort((x, y) => y.sum - x.sum || y.msgs - x.msgs);
  const all = rows.reduce((a, r) => a + r.sum, 0) || 1;
  // Lately: orders placed and the Manager's prices on them, newest first.
  const feed: { at: Ms; who: Member | undefined; what: JSX.Element; sub: string }[] = [];
  orders.forEach((o) => {
    feed.push({ at: o.placedAt, who: b.members.find((m) => m.id === o.placedBy), what: <>Placed <span class="mono">{orderNo(o.id)}</span>{` · ${money(o.toldTotal ?? orderTotal(o))}`}</>, sub: '' });
    o.lines.filter((l) => l.priceReview && l.priceReview.state === 'changed').forEach((l) => {
      const r = l.priceReview as NonNullable<typeof l.priceReview>;
      feed.push({ at: r.at, who: b.members.find((m) => m.id === r.by), what: <><span class="mono">{orderNo(o.id)}</span>{` now ${money(orderTotal(o))} · ${firstWord(r.byName)}`}</>, sub: `${money(r.price)} a ${l.name.split(' · ')[0].split(' ').filter((w) => !/^G\d+$/.test(w)).pop()?.toLowerCase()}` });
    });
  });
  feed.sort((x, y) => y.at - x.at);
  const when = (at: Ms) => (dayOf(at) === dayOf(t) ? `today ${clock(at)}` : `${dayLabel(at)} ${clock(at)}`);
  const lately = feed.slice(0, 4);
  return (
    <FullSheet onBack={nav.back} backLabel="Back to the chat" pad="12px 16px 18px" gap={8}
      head={
        <div class="cu-head">
          <span aria-hidden="true" class="ow-shead-grab" />
          <div class="cu-row">
            <Avatar {...faceOf(cust)} size={44} ring="0 0 0 3px #16203C, 0 0 0 5px rgba(255,255,255,.18)" />
            <div><span>{cust.name}</span><span>{[cust.place, cust.kind ? KIND[cust.kind] : '', cust.everyDays ? `every ${cust.everyDays} days` : ''].filter(Boolean).join(' · ')}</span></div>
            <button type="button" class="ow-shead-x" aria-label="Close" onClick={nav.back}><Icon name="close" size={16} stroke={2.2} /></button>
          </div>
          <div class="ow-shead-chips">
            {owner && (
              <HeadChip on={() => open('customers/customer', { id: cust.id })} label={`${firstWord(owner.name)}’s customer since ${dayLabel(chat.ownerAt || t)}`}>
                <Avatar {...faceOf(owner)} size={22} class="cv-chip-face" style={owner.id === me.id ? { background: '#2F3D66' } : undefined} />{`${firstWord(owner.name)}’s`}
                <span class="cv-chip-away">{`· since ${dayLabel(chat.ownerAt || t)}`}</span>
              </HeadChip>
            )}
            <HeadChip on={() => open('customers/customer', { id: cust.id })} label={`Open ${cust.name}’s page`}>Their page<span class="cv-chip-i"><Icon name="chevron-right" size={13} stroke={2.4} /></span></HeadChip>
          </div>
        </div>
      }>
      <div class="cu-gh"><h2>{`Who served ${first}`}</h2><span class="mono">this year</span></div>
      <div role="img" aria-label={`Who served ${first} this year: ${rows.map((r) => `${firstWord(r.m.name)} ${short(r.sum)}`).join(', ')}`} class="cu-card">
        {rows.map((r) => {
          const tint = TINTS[r.m.tint] || TINTS.t4;
          return (
            <div key={r.m.id} class="cu-who">
              <Avatar {...faceOf(r.m)} size={34} font={12} />
              <span>
                <span><span>{firstWord(r.m.name)}</span><b class="mono">{short(r.sum)}</b></span>
                <span aria-hidden="true"><span style={{ width: `${Math.round(r.sum / all * 100)}%`, background: r.m.tint === 'me' ? tint.bg : tint.fg }} /></span>
                <span class="mono">{`${r.msgs} message${r.msgs === 1 ? '' : 's'} · ${r.n} order${r.n === 1 ? '' : 's'}`}</span>
              </span>
            </div>
          );
        })}
      </div>
      {!!lately.length && <div class="cu-gh gap"><h2>Lately</h2></div>}
      {!!lately.length && (
        <div class="cu-card feed">
          {lately.map((f, i) => (
            <div key={i} class="cu-f">
              <span>{f.who && <Avatar {...faceOf(f.who)} size={28} font={11} />}{i < lately.length - 1 && <i />}</span>
              <span class={i < lately.length - 1 ? undefined : 'last'}><span>{f.what}</span><span class="mono">{f.sub ? `${when(f.at)} · ${f.sub}` : when(f.at)}</span></span>
            </div>
          ))}
        </div>
      )}
      <div class="cu-acts">
        <Tap href={`tel:${cust.phone.replace(/\s/g, '')}`} class="cu-act"><span class="i"><Icon name="phone" size={19} stroke={1.8} /></span><b>Call</b><span>{first}</span></Tap>
        <Tap on={() => open('customers/pay', { customer: cust.id })} class="cu-act"><span class="w"><Icon name="cash" size={19} stroke={1.8} /></span><b>Take payment</b><span class="mono">{money(Math.max(0, cust.owes))}</span></Tap>
        <Tap on={() => sheet.open(() => <GiveSheet chatId={id} />, { label: `Give ${first} to…`, top: 178 })} class="cu-act"><span class="b"><Icon name="hand-over" size={19} stroke={1.8} /></span><b>Give</b><span>to a teammate</span></Tap>
      </div>
    </FullSheet>
  );
}
