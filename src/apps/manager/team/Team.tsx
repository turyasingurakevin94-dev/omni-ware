/*
 * Team p1 (route `team`): the shop's month (sales invoiced against the goal, the pace mark, ahead
 * or behind), Sales by person with their goal bar and pace tick (Nudge on the ones behind),
 * Everyone else as tiles (what they hold; the need badge = their orders over the stage limit),
 * and the move the app spots: "Joy is free · #0551 · Musa has 2 · Give it to Joy".
 */
import type { JSX } from 'preact';
import { money, short } from '../../../core/money.ts';
import { aboutPace } from '../../../core/manager/nudge.ts';
import { everyoneElse, freeMove, goalSplit, inM, others, overLimit } from '../../../core/manager/team.ts';
import type { ManagerBooks, Person } from '../../../core/manager/types.ts';
import { onPace, pace } from '../../../core/manager/watch.ts';
import { firstWord, orderNo, TINTS } from '../../../core/names.ts';
import { monthName } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { MoveAct, Moved, NotSent, phaseOf, tapMove } from './Move.tsx';
import './team.css';

const pctOf = (n: number, of: number): string => `${of > 0 ? Math.max(0, Math.min(100, (n / of) * 100)).toFixed(1) : 0}%`;
const mono = (s: string): JSX.Element => {
  // The figures in a "holds" line in mono ("Packing 2", "2.84M in", "Agent · #0560").
  const parts = s.split(/(#?\d[\d.,]*M?)/);
  return <>{parts.map((x, i) => (i % 2 ? <b key={i} class="mg-mono">{x}</b> : x))}</>;
};

function Hero(p: { b: ManagerBooks }): JSX.Element {
  const b = p.b, t = now.value, team = others(b), off = team.filter((x) => x.off);
  const split = goalSplit(b), sold = split.reduce((s, x) => s + x.sold, 0), goal = b.shop.goal;
  const x = onPace(sold, goal, t), pc = pace(t), month = monthName(t);
  return (
    <header class="mg-team-hero">
      <div class="mg-team-top">
        <span class="mg-team-title">Team</span>
        <span class="mg-team-in"><i aria-hidden="true" /><b class="mg-mono">{team.length - off.length}</b>{' of '}<b class="mg-mono">{team.length}</b>{` in${off.length ? ' · ' + off.map((o) => firstWord(o.name)).join(' · ') + ' off' : ''}`}</span>
        <button type="button" class="mg-team-me" aria-label={`${firstWord(b.me.name)}, your page`} onClick={() => nav.push('shell/you')}>{b.me.initials}</button>
      </div>
      <button type="button" class="mg-team-sold" onClick={() => nav.push('team/goals')}
        aria-label={`Sales invoiced in ${month}: ${money(sold)} of ${money(goal)}, ${inM(Math.abs(x.ahead))} ${x.ahead >= 0 ? 'ahead of' : 'behind'} pace. Open goals and limits`}>
        <span class="mg-team-over">{`SALES INVOICED · ${month.toUpperCase()} ›`}</span>
        <span class="mg-team-fig">{money(sold)} <small>UGX</small></span>
        <span class="mg-team-bar" aria-hidden="true">
          {split.map((s, i) => <i key={s.id} style={{ width: pctOf(s.sold, goal), background: s.p ? TINTS[s.p.tint].bg : 'rgba(255,255,255,.5)', borderRadius: i === 0 ? '999px 0 0 999px' : i === split.length - 1 ? '0 3px 3px 0' : undefined }} />)}
          <i class="tick" style={{ left: pctOf(x.pacePct, 1) }} />
        </span>
        <span class="mg-team-foot">
          <span><b class="mg-mono">{`${Math.round(x.pct * 100)}%`}</b>{' of '}<b class="mg-mono">{short(goal)}</b>{' · '}<b class="mg-mono">{pc.daysLeft}</b>{' days left'}</span>
          <span class={'mg-mono ' + (x.ahead >= 0 ? 'up' : 'down')}>{x.ahead >= 0 ? `+${inM(x.ahead)} ahead` : `−${inM(-x.ahead)} behind`}</span>
        </span>
      </button>
    </header>
  );
}

function SalesRow(p: { b: ManagerBooks; s: Person }): JSX.Element {
  const s = p.s, t = now.value, x = onPace(s.sold, s.goal, t), name = firstWord(s.name), id = 'nudge:' + s.id, ph = phaseOf(id);
  const open = () => nav.push('team/person', { staff: s.id });
  const nudge = () => tapMove(id, `Nudged ${name}`, 'nudge', [s.id, null, aboutPace(s, t, monthName(t))]);
  const moved = ph === 'held' || ph === 'done';
  return (
    <div class="mg-team-card">
      <div class="mg-team-row">
        <button type="button" class="mg-team-open" aria-label={`${name}'s page`} onClick={open}>
          <Avatar initials={s.initials} tint={s.tint} size={38} />
          {moved ? <Moved id={id} word="Nudged" told={name} /> : (
            <span class="mg-team-body">
              <span class="mg-team-line"><b>{ph === 'waits' ? `Nudge ${name}` : name}</b>
                {ph !== 'waits' && (x.ahead >= 0 ? <span class="mg-team-ahead">Ahead</span> : <span class="mg-team-behind mg-mono">{`−${inM(-x.ahead)}`}</span>)}</span>
              {ph !== 'waits' && (
                <span class="mg-team-goal" aria-hidden="true"><i style={{ width: pctOf(s.sold, s.goal || 0), background: TINTS[s.tint].fg }} /><i class="tick" style={{ left: pctOf(x.pacePct, 1) }} /></span>
              )}
              <span class="mg-team-sub mg-mono">{`${money(s.sold)} of ${short(s.goal || 0)}`}</span>
            </span>
          )}
        </button>
        {x.ahead >= 0 && ph === 'idle'
          ? <button type="button" class="mg-team-chev" aria-label={`${name}'s page`} onClick={open}><Icon name="chevron-right" size={18} stroke={2.2} /></button>
          : <MoveAct id={id} icon="send" word="Nudge" label={`Nudge ${name}: ${inM(-x.ahead)} behind pace`} on={nudge}
            after={<button type="button" class="mg-team-chev" aria-label={`${name}'s page`} onClick={open}><Icon name="chevron-right" size={18} stroke={2.2} /></button>} />}
      </div>
      <NotSent id={id} />
    </div>
  );
}

function Tile(p: { b: ManagerBooks; x: Person }): JSX.Element {
  const x = p.x, name = firstWord(x.name), need = overLimit(p.b, x.id, now.value);
  const free = /^free$/i.test(x.holds);
  const go = () => {
    if (x.off) toast.show(`${name} is off today`, { kind: 'warn' });
    else nav.push('team/nudge', { staff: x.id });
  };
  const face = x.role === 'driver'
    ? <span class={'mg-team-ic' + (x.off ? ' off' : '')} aria-hidden="true"><Icon name={x.off ? 'moon' : 'truck'} size={16} stroke={2} /></span>
    : <Avatar initials={x.initials} tint={x.tint} size={28} />;
  return (
    <button type="button" class={'mg-team-tile' + (x.off ? ' off' : '')} onClick={go}
      aria-label={`${name}: ${x.holds}${need ? `, ${need} over its limit` : ''}`}>
      {face}
      <span class="n">{name}</span>
      <span class={'h' + (free ? ' free' : '')}>{mono(x.holds)}</span>
      {need > 0 && <span class="mg-team-need mg-mono" aria-hidden="true">{need}</span>}
    </button>
  );
}

function GiveRow(p: { b: ManagerBooks }): JSX.Element | null {
  const m = freeMove(p.b);
  // After the give the books move the order: keep the row on screen until its answer is in.
  const id = 'give:' + (m ? m.order.id : 'none');
  if (!m) return null;
  const to = firstWord(m.to.name), ph = phaseOf(id), moved = ph === 'held' || ph === 'done';
  return (
    <div class="mg-team-card">
      <div class="mg-team-row">
        <span class="mg-team-face">
          <Avatar initials={m.to.initials} tint={m.to.tint} size={38} />
          <span class="mg-team-ok" aria-hidden="true"><Icon name="check" size={12} stroke={3} /></span>
        </span>
        {moved ? <Moved id={id} word={`Given to ${to}`} told={to} /> : (
          <span class="mg-team-body">
            <b class="mg-team-t14">{`${to} is free`}</b>
            <span class="mg-team-sub mg-mono">{`${orderNo(m.order.id)} · ${firstWord(m.from.name)} has ${m.fromHas}`}</span>
          </span>
        )}
        <MoveAct id={id} icon="swap" word={`Give it to ${to}`} label={`Give order ${orderNo(m.order.id)}, ${m.order.customerName}, to ${to}`}
          on={() => tapMove(id, `Given to ${to}`, 'giveTo', [m.order.id, m.to.id])} />
      </div>
      <NotSent id={id} />
    </div>
  );
}

export function Team(): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const t = now.value, pc = pace(t);
  const sales = others(b).filter((x) => x.role === 'sales');
  const rest = everyoneElse(b);
  return (
    <main class="mg-team">
      <Hero b={b} />
      <div class="mg-team-list">
        <SectionHead title="Sales" meta={`▏pace · day ${pc.day} of ${pc.of}`} />
        {sales.map((s) => <SalesRow key={s.id} b={b} s={s} />)}
        <SectionHead title="Everyone else" meta={`${rest.filter((x) => !x.off).length} of ${rest.length} in`} after />
        <div class="mg-team-tiles">{rest.map((x) => <Tile key={x.id} b={b} x={x} />)}</div>
        <GiveRow b={b} />
      </div>
    </main>
  );
}
