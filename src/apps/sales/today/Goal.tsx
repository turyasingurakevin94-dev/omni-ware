/*
 * TD15 · Your goal: the ring (sold, then on the move) with today's pace marked, the three figures,
 * what it takes a day against what Grace sells a day, and who gets her there (on the move, then
 * her next moves), each a bar segment.
 */
import type { JSX } from 'preact';
import { money, short } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { dayOf, daysApart, monthName } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { StatusPill } from '../../../ui/Pill.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, chats, drafts, now } from '../shell/store.ts';
import { TitleHead } from './bits.tsx';
import { due, mine, moves } from './data.ts';
import { go } from './go.ts';
import { useLocal } from './local.ts';
import { countWord, scrollToNext } from './NextMoves.tsx';
import { goalOf } from './Today.tsx';
import './goal.css';

const R = 84, C = 2 * Math.PI * R;

/** The ring: r 84, stroke 16 on a 200 box at 168 px; the pace tick and its word. */
function Dial(p: { sold: number; move: number; target: number; pace: number; pct: number }): JSX.Element {
  const done = (C * Math.min(1, p.sold / p.target)), mv = C * Math.max(0, Math.min(1 - p.sold / p.target, p.move / p.target));
  const a = 2 * Math.PI * p.pace, x = (r: number) => (100 + r * Math.sin(a)).toFixed(1), y = (r: number) => (100 - r * Math.cos(a)).toFixed(1);
  return (
    <div class="td-goal-dial">
      <svg width="168" height="168" viewBox="0 0 200 200" aria-hidden="true" style={{ overflow: 'visible' }}>
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,.08)" stroke-width="16" />
        {mv > 0 && <circle cx="100" cy="100" r={R} fill="none" stroke="#6FDCB0" stroke-opacity=".4" stroke-width="16" stroke-dasharray={`${mv.toFixed(1)} ${C.toFixed(1)}`} stroke-dashoffset={(-done).toFixed(1)} transform="rotate(-90 100 100)" />}
        <circle cx="100" cy="100" r={R} fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" stroke-dasharray={`${done.toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 100 100)" />
        <circle cx="100" cy="100" r="66" fill="rgba(255,255,255,.04)" />
        <line x1={x(72)} y1={y(72)} x2={x(96)} y2={y(96)} stroke="#F5B26B" stroke-width="3" stroke-linecap="round" />
        <text x={x(105)} y={(Number(y(105)) + 5).toFixed(1)} text-anchor={Math.sin(a) < 0 ? 'end' : 'start'} font-family="Figtree" font-size="14" font-weight="700" fill="#F5B26B">pace</text>
      </svg>
      <span class="td-goal-in"><span class="mono">{`${p.pct}%`}</span><span class="mono"><span>{money(p.sold)}</span></span><span class="mono">{`of ${money(p.target)}`}</span></span>
    </div>
  );
}

export function Goal(): JSX.Element {
  const b = books.value, n = now.value, L = useLocal();
  const g = b && goalOf(b, n);
  if (!b || !b.goal || !g) return <main class="td-wait" aria-busy="true" />;
  const today = dayOf(n), month = monthName(today), from = b.goal.from;
  const gone = daysApart(from, today) + 1, days = daysApart(from, b.goal.to) + 1, toGo = Math.max(0, g.target - g.sold);
  const need = g.daysLeft > 0 ? toGo / g.daysLeft : toGo, sells = gone > 0 ? g.sold / gone : 0;
  const setter = b.members.find((m) => m.role === 'manager');
  const live = mine(b), ms = moves(b, chats.value, n, L.told, drafts.value).filter((m) => m.value > 0);
  const late = new Map(due(b, n).map((d) => [d.c.id, d.late]));
  const reach = g.move + ms.reduce((s, m) => s + m.value, 0);
  const tone = (cid: string) => (late.has(cid) ? ((late.get(cid) as number) > 0 ? '#95530C' : '#0F6B43') : '#0F6B43');
  const close = () => nav.back();
  return (
    <FullSheet onBack={close} backLabel="Back to Today" head={
      <TitleHead small title={`Your ${month} goal`} onClose={close}
        sub={<>{setter && <Avatar initials={setter.initials} tint={setter.tint} size={18} />}{`${setter ? firstWord(setter.name) + ' set it · ' : ''}${g.daysLeft} days left`}</>}>
        <Dial sold={g.sold} move={g.move} target={g.target} pace={Math.min(1, gone / days)} pct={g.pct} />
        <div class="td-goal-tiles">
          <span><span>Sold</span><span class="mono">{short(g.sold, 2)}</span></span>
          <span><span class="m">On the move</span><span class="mono">{short(g.move, 2)}</span></span>
          <span><span class="a">To go</span><span class="mono">{short(toGo, 2)}</span></span>
        </div>
      </TitleHead>
    }>
      <div class="td-goal-card">
        <div class="td-goal-ch"><span>What it takes{sells < need && <StatusPill tone="caution" class="td-goal-pill">Behind pace</StatusPill>}</span></div>
        <div class="td-goal-pace"><span>Needed</span><span aria-hidden="true"><span style={{ width: '100%' }} /></span><b class="mono">{short(need, 2)}<span> a day</span></b></div>
        <div class="td-goal-pace now"><span>You sell now</span><span aria-hidden="true"><span style={{ width: `${Math.round((sells / need) * 100)}%` }} /></span><b class="mono">{short(sells, 2)}<span> a day</span></b></div>
      </div>
      <div class="td-goal-card who">
        <div class="td-goal-ch"><span>Who gets you there</span><span class="mono">{`${short(reach)} of ${short(toGo)}`}</span></div>
        <span role="img" aria-label={`${short(reach).replace('M', ' million')} of the ${short(toGo).replace('M', ' million')} to go is in reach`} class="td-goal-bar">
          <span style={{ flex: Math.round(g.move / 1e4), background: '#16203C' }} />
          {ms.map((m) => <span key={m.c.id} style={{ flex: Math.round(m.value / 1e4), background: tone(m.c.id) }} />)}
          <span style={{ flex: Math.max(0, Math.round((toGo - reach) / 1e4)) }} />
        </span>
        <div class="td-goal-rows">
          <Tap on={() => go('orders')} class="td-goal-row">
            <span aria-hidden="true" class="td-goal-av move"><Icon name="trend" size={16} stroke={2.2} /></span>
            <span class="td-goal-t"><span>On the move</span><span>{`${live.length} orders`}</span></span>
            <span class="mono">{'+' + money(g.move)}</span>
            <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
          </Tap>
          {ms.map((m) => {
            const it = m.kind === 'ask' && m.ask.itemId ? b.items.find((i) => i.id === m.ask.itemId) : null;
            const sub = m.kind === 'due' ? `${m.d.late} days late · their usual` : m.kind === 'chat' ? `asked for ${countWord(m.qty, m.unit, (b.items.find((i) => i.unit === m.unit) || { name: '' }).name)}`
              : m.kind === 'ask' ? `${countWord(m.ask.requests[0].qty, it ? it.unit : '', '')} of ${(it ? it.name : m.ask.name).split(' · ')[0].toLowerCase()}` : '';
            const on = m.kind === 'due' ? () => { nav.home(); setTimeout(scrollToNext, 60); }
              : m.kind === 'chat' ? () => go('sell/order', { customer: m.c.id, from: 'chat' })
              : m.kind === 'ask' ? () => go('today/asks', { id: m.ask.id }) : () => go('customers/customer', { id: m.c.id });
            return (
              <Tap key={m.c.id} on={on} class="td-goal-row">
                <span aria-hidden="true" class="td-goal-av" style={{ background: `var(--${m.c.tint}-bg)`, color: `var(--${m.c.tint}-fg)`, boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 4px ${tone(m.c.id)}` }}>{m.c.initials}</span>
                <span class="td-goal-t"><span>{m.c.name}</span><span class={m.kind === 'due' ? 'late' : undefined}>{sub}</span></span>
                <span class="mono">{'+' + money(m.value)}</span>
                <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
              </Tap>
            );
          })}
        </div>
      </div>
    </FullSheet>
  );
}
