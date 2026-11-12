/*
 * Team p2 (route `team/person` { staff }, a sheet): one person. The head: their goal ring, name,
 * role and how far off pace; her goal this month with the pace mark. Holds now (Open: the decision
 * on it, or the order); Her customers owe, by the age of the oldest bill against the hold line;
 * Her pace a day (so far · needs). The dock: Nudge Faith (the pen changes the words).
 * Empty (Team states): "Nothing in hand", and the job the app would give her.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { aboutPace, nudgeTitle } from '../../../core/manager/nudge.ts';
import { askOn, custOf, dayRate, freeMove, holdsNow, inM } from '../../../core/manager/team.ts';
import type { ManagerBooks, MOrder, Person as P } from '../../../core/manager/types.ts';
import { onPace, pace } from '../../../core/manager/watch.ts';
import { ROLE, STAGE } from '../../../core/manager/words.ts';
import { money, short } from '../../../core/money.ts';
import { firstWord, orderNo, TINTS } from '../../../core/names.ts';
import { dayOf, monthName } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import type { Params } from '../../../ui/stack.ts';
import { titleOf } from '../decide/Head.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { MoveAct, tapMove } from './Move.tsx';
import { CloseX, DockMove, Sees, TeamSheet } from './Sheet.tsx';
import { STAGE_ICON_OF } from './stageIcon.ts';

const pc = (n: number): string => `${Math.max(0, Math.min(100, n * 100)).toFixed(1)}%`;

function Ring(p: { x: P; frac: number }): JSX.Element {
  const c = 2 * Math.PI * 29, f = Math.max(0, Math.min(1, p.frac));
  return (
    <span class="mg-tp-ring" role="img" aria-label={`${firstWord(p.x.name)}, ${Math.round(f * 100)}% of the goal`}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="4" />
        {f > 0 && <circle cx="32" cy="32" r="29" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray={`${(c * f).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 32 32)" />}
      </svg>
      <Avatar initials={p.x.initials} tint={p.x.tint} size={48} font={17} />
    </span>
  );
}

function Holds(p: { b: ManagerBooks; o: MOrder }): JSX.Element {
  const o = p.o, a = askOn(p.b, o.id), asker = a && a.askerId ? p.b.team.find((x) => x.id === a.askerId) : null;
  const open = () => (a ? nav.push('decide', { id: a.key }) : nav.push('orders/order', { id: o.id }));
  return (
    <div class="mg-tp-card">
      <span class={'mg-tp-sq' + (a ? ' warn' : '')} aria-hidden="true"><Icon name={STAGE_ICON_OF[o.stage]} size={20} stroke={2} /></span>
      <span class="mg-tp-main">
        <b>{o.customerName}</b>
        <span class="mg-tp-chips">
          <span class="mg-tp-no" aria-label={asker ? `From ${firstWord(asker.name)}, order ${orderNo(o.id)}` : `Order ${orderNo(o.id)}`}>
            {asker && <i aria-hidden="true" style={{ background: TINTS[asker.tint].bg, boxShadow: `inset 0 0 0 2px ${TINTS[asker.tint].fg}` }} />}{orderNo(o.id)}
          </span>
          <span class="mg-tp-soft">{a ? titleOf(a) : STAGE[o.stage]}</span>
        </span>
      </span>
      <button type="button" class="mg-tp-open" aria-label={a ? `Decide ${titleOf(a)} on ${orderNo(o.id)}` : `Open ${orderNo(o.id)}`} onClick={open}>Open</button>
    </div>
  );
}

function Empty(p: { b: ManagerBooks; x: P }): JSX.Element {
  const m = freeMove(p.b), mine = m && m.to.id === p.x.id ? m : null, to = firstWord(p.x.name);
  return (
    <div class="mg-tp-empty">
      <span>Nothing in hand</span>
      {mine && (
        <div class="mg-tp-card">
          <span class="mg-tp-sq" aria-hidden="true"><Icon name={STAGE_ICON_OF[mine.order.stage]} size={20} stroke={2} /></span>
          <span class="mg-tp-main"><b>{mine.order.customerName}</b><span class="mg-tp-soft">{`${orderNo(mine.order.id)} · ${STAGE[mine.order.stage]}`}</span></span>
          <MoveAct id={'give:' + mine.order.id} word={`Give it to ${to}`} label={`Give order ${orderNo(mine.order.id)} to ${to}`}
            on={() => tapMove('give:' + mine.order.id, `Given to ${to}`, 'giveTo', [mine.order.id, p.x.id])} />
        </div>
      )}
    </div>
  );
}

function Owe(p: { b: ManagerBooks; x: P }): JSX.Element | null {
  const list = custOf(p.b, p.x.id, dayOf(now.value)), hold = p.b.shop.holdDays;
  if (!list.length) return null;
  return (
    <>
      <SectionHead title={`${p.x.role === 'sales' ? 'Her' : 'Their'} customers owe`} meta={money(list.reduce((s, y) => s + y.c.owes, 0))} after />
      {list.map(({ c, days }) => {
        const scale = Math.max(40, days + 4);
        return (
          <div key={c.id} class="mg-tp-card">
            <span class="mg-tp-sq" aria-hidden="true">{c.initials}</span>
            <span class="mg-tp-main" style={{ gap: '6px' }}>
              <span class="mg-tp-ln"><b>{c.name}</b><span class="mg-mono" style={{ fontSize: '13px', fontWeight: 600 }}>{money(c.owes)}</span></span>
              <span class="mg-tp-age" role="img" aria-label={`Oldest bill ${days} days; credit holds at ${hold} days`}>
                <i style={{ width: pc(7 / scale), borderRadius: '999px 0 0 999px', background: 'var(--good-soft)' }} />
                <i style={{ width: pc((hold - 7) / scale), background: 'var(--warn-soft)' }} />
                <i style={{ flex: 1, borderRadius: '0 999px 999px 0', background: 'var(--bad-soft)' }} />
                <i class="mk" style={{ left: pc(hold / scale) }} />
                <i class="dot" style={{ left: pc(days / scale), background: days > hold ? 'var(--bad)' : 'var(--warn)' }} />
              </span>
              <span class="mg-tp-soft">{`${days} d · holds at ${hold} d`}</span>
            </span>
          </div>
        );
      })}
    </>
  );
}

export function Person(p: { params: Params }): JSX.Element | null {
  const b = books.value, t = now.value;
  const x = b ? b.team.find((y) => y.id === p.params.staff) : null;
  const [edit, setEdit] = useState<string | null>(null);
  if (!b || !x) return null;
  const name = firstWord(x.name), her = x.role === 'sales' ? 'Her' : 'Their', month = monthName(t);
  const goal = x.goal || 0, op = onPace(x.sold, x.goal, t), rate = dayRate(x.sold, x.goal, t), pcx = pace(t);
  const holds = holdsNow(b, x), words = edit ?? aboutPace(x, t, month), id = 'nudge:' + x.id;
  const top = Math.max(rate.soFar, rate.needs, 1);
  return (
    <TeamSheet follow label={x.name} head={(
      <>
        <div class="mg-ts-who">
          {goal ? <Ring x={x} frac={op.pct} /> : <Avatar initials={x.initials} tint={x.tint} size={52} font={16} />}
          <span class="mg-ts-name">
            <b>{x.name}</b>
            <span class="mg-ts-role">{ROLE[x.role]}
              {goal > 0 && (op.ahead < 0
                ? <span class="mg-ts-tag"><span class="mg-mono">{inM(-op.ahead)}</span> behind pace</span>
                : <span class="mg-ts-tag up"><span class="mg-mono">{inM(op.ahead)}</span> ahead</span>)}
            </span>
          </span>
          <CloseX />
        </div>
        {goal > 0 && (
          <div class="mg-tp-goal">
            <span class="mg-tp-over">{`${her.toUpperCase()} GOAL · ${month.toUpperCase()}`}</span>
            <span class="mg-tp-fig">{money(x.sold)} <small>{`of ${short(goal)}`}</small></span>
            <span class="mg-tp-bar" role="img" aria-label={`${Math.round(op.pct * 100)}% of ${short(goal)}; pace mark at ${Math.round(op.pacePct * 100)}%`}>
              <i style={{ width: pc(op.pct), background: TINTS[x.tint].bg }} /><i class="tick" style={{ left: pc(op.pacePct) }} />
            </span>
            <span class="mg-tp-foot">
              <span><b class="mg-mono">{`${Math.round(op.pct * 100)}%`}</b>{' · '}<b class="mg-mono">{pcx.daysLeft}</b> days left</span>
              <span><b class="mg-mono">{inM(rate.needs)}</b> a day</span>
            </span>
          </div>
        )}
      </>
    )} dock={(
      <>
        <Sees who={name} word={nudgeTitle(b.me)} />
        {edit != null && <textarea class="mg-ts-words" aria-label={`What ${name} gets`} value={edit} onInput={(e) => setEdit((e.target as HTMLTextAreaElement).value)} />}
        <DockMove id={id} icon="send" word={`Nudge ${name}`} done={`Nudged ${name}`} off={x.userId ? (words.trim() ? undefined : 'Write the words') : `${name} has no phone`}
          on={() => tapMove(id, `Nudged ${name}`, 'nudge', [x.id, null, words.trim()])}
          before={<button type="button" class="mg-ts-pen" aria-label="Other words" aria-pressed={edit != null} onClick={() => setEdit(edit == null ? words : null)}><Icon name="pen" size={20} stroke={2} /></button>} />
      </>
    )}>
      <SectionHead title="Holds now" meta={String(holds.length)} />
      {holds.length ? holds.map((o) => <Holds key={o.id} b={b} o={o} />) : <Empty b={b} x={x} />}
      <Owe b={b} x={x} />
      {goal > 0 && (
        <>
          <SectionHead title={`${her} pace`} meta="a day" after />
          <div class="mg-tp-pace" role="img" aria-label={`So far ${inM(rate.soFar)} a day; needs ${inM(rate.needs)} a day for ${short(goal)}; at ${inM(rate.soFar)} the month ends near ${short(rate.ends)}`}>
            <span class="mg-tp-pr"><span>So far</span><i><i style={{ width: pc(rate.soFar / top), background: TINTS[x.tint].fg }} /></i><b>{inM(rate.soFar)}</b></span>
            <span class="mg-tp-pr"><span>Needs</span><i><i style={{ width: pc(rate.needs / top), background: 'var(--navy)' }} /></i><b>{inM(rate.needs)}</b></span>
            <span class="mg-tp-pf"><span>{`at ${inM(rate.soFar)} → ~${short(rate.ends)}`}</span><span>{`${short(goal)} needs ${inM(rate.needs)}`}</span></span>
          </div>
        </>
      )}
    </TeamSheet>
  );
}
