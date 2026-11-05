/*
 * Next move (TD03): the best play as P09's dark card, then the rest one row each (Then), then the
 * orders not placed yet. And Who's due (TD07), when nothing else needs Grace.
 */
import type { JSX } from 'preact';
import { money, orderTotal, short } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import type { Books, ChatBooks, Customer, Ms } from '../../../core/types.ts';
import { GroupCard, IconTile, ActRow } from '../../../ui/ActRow.tsx';
import { RingAvatar } from '../../../ui/Avatar.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { NextMove } from '../../../ui/NextMove.tsx';
import { PlayAll, SectionHead, SubHead } from '../../../ui/SectionHead.tsx';
import { Tap } from '../../../ui/util.tsx';
import { drafts } from '../shell/store.ts';
import { askValue, due, moves, usualValue, type Move } from './data.ts';
import { go, tel } from './go.ts';
import { openTell } from './Tell.tsx';
import { howLong } from '../../../core/time.ts';

/** "60 sheets", "6 tins": a count in the item's own word. */
export function countWord(qty: number, unit: string, name: string): string {
  const head = name.split(/[·,]| G\d| \d/)[0].trim().split(' ').pop() || unit;
  const w = unit === 'pc' ? head.toLowerCase() : unit;
  return `${qty} ${qty === 1 ? w : w.endsWith('s') ? w : w + 's'}`;
}

/** To the next move: the Next move section, or, with none (the goal hit, TD08), Needs you (its head, above its rows). */
export function scrollToNext(): void {
  const el = document.getElementById('td-next') || document.querySelector('.td-needs')?.previousElementSibling || null;
  if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 54);
}

export function NextMoves(p: { b: Books; cb: ChatBooks | null; now: Ms; told: string[] }): JSX.Element | null {
  const b = p.b, ds = drafts.value, ms = moves(b, p.cb, p.now, p.told, ds);
  if (!ms.length && !ds.length) return null;
  const top = ms[0] && ms[0].kind === 'due' ? ms[0] : null, rest = top ? ms.slice(1) : ms;
  const all = ms.reduce((s, m) => s + m.value, 0), restV = rest.reduce((s, m) => s + m.value, 0);
  return (
    <>
      {ms.length > 0 && <div id="td-next"><SectionHead title="Next move" after right={<PlayAll count={ms.length} amount={short(all)} on={scrollToNext} />} /></div>}
      {top && top.kind === 'due' && (
        <NextMove tag={{ tone: 'amber', icon: 'clock', text: 'Due for their usual' }} pos={`1 of ${ms.length}`}
          face={{ initials: top.c.initials, tint: top.c.tint }} rhythm={1} late={Math.min(1, top.d.late / top.d.every)} name={top.c.name}
          big={`+${top.d.late} days`} bigSub="past their rhythm" legend={[`every ${top.d.every} days`, 'late']}
          usual={top.c.usual.map((u) => { const it = b.items.find((i) => i.id === u.itemId); return { aisle: it ? it.aisle : '', text: `${u.qty} ${it ? it.unit : ''}` }; })}
          footLabel="Their usual" footValue={top.value} phone={tel(top.c.phone)} callLabel={`Call ${top.c.name.replace('&', 'and')}`}
          act={{ label: 'Order usual', on: () => go('sell/order', { customer: top.c.id, from: 'usual' }) }} />
      )}
      {rest.length > 0 && <><SubHead title="Then" meta={`${rest.length} more · ${short(restV)}`} /><GroupCard pad={14}>{rest.map((m) => <MoveRow key={m.c.id} b={b} m={m} now={p.now} />)}</GroupCard></>}
      {ds.length > 0 && (
        <>
          <SubHead title="Not placed yet" meta={String(ds.length)} />
          <GroupCard pad={14}>
            {ds.map((d) => {
              const c = d.customerId ? b.customers.find((x) => x.id === d.customerId) : null, name = c ? c.name : d.client.name || 'Walk-in';
              return (
                <ActRow key={d.key} lead={<RingAvatar face={{ initials: c ? c.initials : 'WI', tint: c ? c.tint : 't4' }} tone="late" fill={1} />} title={name}
                  sub={`${d.lines.length} item${d.lines.length === 1 ? '' : 's'} · ${money(orderTotal({ lines: d.lines, charges: d.charges, discount: 0, credit: d.credit }))}`}
                  act={{ icon: 'chevron-right', kind: 'tile', label: `Resume ${name.replace('&', 'and')} order`, on: () => go('sell/order', d.chatId != null ? { customer: d.customerId, from: 'chat', chat: d.chatId } : { customer: d.customerId }) }} />
              );
            })}
          </GroupCard>
        </>
      )}
    </>
  );
}

function MoveRow(p: { b: Books; m: Move; now: Ms }): JSX.Element {
  const m = p.m, chip = m.value > 0 ? short(m.value) : undefined, who = m.c.name.replace('&', 'and');
  if (m.kind === 'chat') {
    const it = p.b.items.find((i) => i.unit === m.unit) || null;
    return <ActRow lead={<IconTile icon="message" tone="info" size={42} />} title={m.c.name} sub={`${countWord(m.qty, m.unit, it ? it.name : '')} · ${howLong(m.since, p.now)}`} chip={chip}
      act={{ icon: 'whatsapp', label: `Reply to ${who}`, on: () => go('sell/order', { customer: m.c.id, from: 'chat', chat: m.chat }) }} />;
  }
  if (m.kind === 'ask') {
    const it = m.ask.itemId ? p.b.items.find((i) => i.id === m.ask.itemId) : null, r = m.ask.requests[0];
    return <ActRow lead={<ItemSquare aisle={it ? it.aisle : ''} size={42} icon={24} />} title={`${(it ? it.name : m.ask.name).split(' · ')[0]} is in`}
      sub={`${firstWord(m.c.name)} asked for ${countWord(r.qty, it ? it.unit : '', it ? it.name : '')}`} chip={chip}
      act={{ icon: 'chevron-right', label: `Tell ${who} the ${(it ? it.name : m.ask.name).split(' · ')[0].split(' ').pop()} is in`, on: () => go('today/asks', { id: m.ask.id }) }} />;
  }
  if (m.kind === 'price') {
    return <ActRow lead={<IconTile icon="tag" tone="info" size={42} />} title={`${firstWord(m.c.name)} · a new price`}
      sub={`#${String(m.order.id).padStart(4, '0')} · ${money(m.order.toldTotal || 0)} → ${money(orderTotal(m.order))}`}
      act={{ icon: 'chevron-right', label: `Tell ${who} the new price`, on: () => openTell(0) }} />;
  }
  return <ActRow lead={<RingAvatar face={{ initials: m.c.initials, tint: m.c.tint }} tone="late" fill={1} />} title={m.c.name} sub={`${m.d.late} days late`} chip={chip}
    act={{ icon: 'chevron-right', label: `Order ${who}'s usual`, on: () => go('sell/order', { customer: m.c.id, from: 'usual' }) }} />;
}

/** What a due customer would likely order: their usual, else what they asked Sourcing for. */
function dueValue(b: Books, c: Customer): number {
  const u = usualValue(b, c);
  if (u > 0) return u;
  return b.asks.filter((a) => a.requests.some((r) => r.customerId === c.id) && a.status === 'listed').reduce((s, a) => s + askValue(b, a), 0);
}

/** TD07 · Who's due: late or due today, two to a row. */
export function WhoDue(p: { b: Books; cb: ChatBooks | null; now: Ms }): JSX.Element | null {
  const ds = due(p.b, p.now);
  if (!ds.length) return null;
  const sum = ds.reduce((s, d) => s + dueValue(p.b, d.c), 0);
  return (
    <>
      <SectionHead title="Who's due" meta={`${ds.length} · ${short(sum)}`} after />
      <div class="td-due">
        {ds.map((d) => {
          const usual = d.usual > 0, chat = p.cb ? p.cb.chats.find((c) => c.customerId === d.c.id) : null;
          return (
            <Tap key={d.c.id} class="td-due-card" on={() => (usual ? go('sell/order', { customer: d.c.id, from: 'usual' }) : (chat ? go('chats/chat', { id: chat.id }) : go('customers/customer', { id: d.c.id })))}>
              <RingAvatar face={{ initials: d.c.initials, tint: d.c.tint }} tone={d.late > 0 ? 'late' : 'due'} fill={1} />
              <span class="td-due-t"><span>{firstWord(d.c.name)}</span><span class={d.late > 0 ? 'late' : 'due'}>{d.late > 0 ? `${d.late} days late` : 'Due today'}</span></span>
              <span class={'td-due-p' + (usual ? '' : ' tile')}>{usual ? 'Order usual' : 'Say hi'}</span>
            </Tap>
          );
        })}
      </div>
    </>
  );
}
