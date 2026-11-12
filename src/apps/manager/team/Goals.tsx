/*
 * Team p3 (route `team/goals`, D-29): Goals and limits. The shop's goal split by person (it adds
 * up); each person's −/+; Next month · Goals · 105M (one tap, Undo 10 s; spec §7 Q3: this month's
 * goals, as they stand); the stage limits (a tap steps the limit; the badge: orders over it now);
 * the credit hold line with who is past it. Save sends what changed: goals('this'), stageLimits,
 * holdDays. Nothing changed: "Nothing to save".
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { COUNTER, goalSplit, holdLine, LIMIT_STAGES, nextLimit, nextMonthGoals } from '../../../core/manager/team.ts';
import type { Stage } from '../../../core/manager/types.ts';
import { limitsOf, stuck } from '../../../core/manager/watch.ts';
import { limitWord, STAGE } from '../../../core/manager/words.ts';
import { short } from '../../../core/money.ts';
import { firstWord, TINTS } from '../../../core/names.ts';
import { addDays, dayOf, monthName } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { SplitBar } from '../../../ui/Bar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { toast } from '../../../ui/toast.tsx';
import { Bars } from '../shell/App.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, now } from '../shell/store.ts';
import { MoveAct, phaseOf, tapMove } from './Move.tsx';
import { STAGE_ICON_OF } from './stageIcon.ts';
import './goals.css';

const M = 1_000_000;
const pc = (n: number): string => `${Math.max(0, Math.min(100, n * 100)).toFixed(1)}%`;

export function Goals(): JSX.Element | null {
  const b = books.value, t = now.value;
  const [goals, setGoals] = useState<Record<string, number> | null>(null);
  const [lims, setLims] = useState<Partial<Record<Stage, number>> | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  if (!b) return null;
  const split = goalSplit(b);
  const g = (id: string, first: number) => (goals && id in goals ? goals[id] : first);
  const rows = split.map((s) => ({ ...s, goal: g(s.id, s.goal) }));
  const sum = rows.reduce((s, x) => s + x.goal, 0);
  const shopLims = limitsOf(b.shop), l = { ...shopLims, ...(lims || {}) };
  const hold = days ?? b.shop.holdDays;
  const over = stuck({ orders: b.orders, shop: { ...b.shop, stageLimits: l } }, t);
  const line = holdLine(b, dayOf(t), hold), scale = Math.max(40, ...line.all.map((x) => x.days + 2));
  const goalsChanged = split.some((s) => g(s.id, s.goal) !== s.goal);
  const limsChanged = LIMIT_STAGES.filter((st) => (Number(l[st]) || 0) !== (Number(shopLims[st]) || 0));
  const daysChanged = hold !== b.shop.holdDays;
  const dirty = goalsChanged || limsChanged.length > 0 || daysChanged;
  const month = monthName(t), next = monthName(addDays(dayOf(t).slice(0, 8) + '01', 32));
  const nid = 'goals:next', nph = phaseOf(nid), set = nph === 'held' || nph === 'done';
  const sales = rows.filter((x) => x.p).map((x) => x.p!);

  const save = async () => {
    setBusy(true);
    try {
      if (goalsChanged) await act('goals', 'this', rows.map((x) => ({ staffId: x.id, amount: x.goal })));
      if (limsChanged.length) await act('stageLimits', Object.fromEntries(limsChanged.map((st) => [st, l[st]])));
      if (daysChanged) await act('holdDays', hold);
      setGoals(null); setLims(null); setDays(null);
      toast.show(`${month} · set`);
    } catch (_e) { /* the bar or the toast says it; the changes stay on the page */ }
    setBusy(false);
  };

  return (
    <main class="mg-tg">
      <header class="mg-tg-hero">
        <div class="mg-tg-top">
          <button type="button" class="mg-tg-back" aria-label="Back to Team" onClick={() => nav.back()}><Icon name="back" size={20} stroke={2.2} /></button>
          <h1>Goals and limits</h1>
        </div>
        <span class="mg-tg-over">{`SHOP'S GOAL · ${month.toUpperCase()}`}</span>
        <span class="mg-tg-fig">{sum.toLocaleString('en-US')} <small>UGX</small></span>
        <SplitBar h={12} gap={3} label={rows.map((x) => `${x.p ? firstWord(x.p.name) : 'Counter and agents'} ${short(x.goal)}`).join(', ') + `: ${short(sum)}`}
          parts={rows.map((x) => ({ value: x.goal, color: x.p ? TINTS[x.p.tint].bg : 'rgba(255,255,255,.5)' }))} />
        <span class="mg-tg-keys" aria-hidden="true">
          {rows.filter((x) => x.goal > 0).map((x) => <span key={x.id} style={{ flex: x.goal }}>{`${x.p ? x.p.initials : 'Counter'} ${short(x.goal)}`}</span>)}
        </span>
        <span class="mg-tg-adds"><Icon name="check" size={16} stroke={2.4} />Adds up to <span class="mg-mono">{short(sum)}</span></span>
      </header>

      <div class="mg-tg-list">
        <SectionHead title="Each person" meta={month} />
        <div class="mg-tg-card">
          {rows.map((x) => {
            const who = x.p ? firstWord(x.p.name) : 'Counter · agents';
            return (
              <div key={x.id} class="mg-tg-person">
                {x.p ? <Avatar initials={x.p.initials} tint={x.p.tint} size={32} /> : <span class="mg-tg-sq" aria-hidden="true"><Icon name="store" size={18} stroke={2} /></span>}
                <span class="mg-tg-who"><b>{who}</b><span class="mg-mono">{`${short(x.sold, 2)} so far`}</span></span>
                <Stepper value={Math.round(x.goal / M)} unit="M" what={x.id === COUNTER ? 'millions: the counter and agents\' goal' : `millions: ${who}'s goal`}
                  onChange={(n) => setGoals({ ...(goals || {}), [x.id]: n * M })} />
              </div>
            );
          })}
        </div>

        <div class={'mg-tg-next' + (set ? ' set' : '')}>
          <span class="mg-tg-sq big" aria-hidden="true"><Icon name={set ? 'check' : 'calendar'} size={20} stroke={2} /></span>
          {set ? (
            <span class="mg-tg-who">
              <b class="ok">{`${next} · set`}</b>
              <span class="mg-tg-sees"><Icon name="bell" size={14} stroke={2} />
                <span class="faces" aria-label={sales.map((p) => firstWord(p.name)).join(', ')}>{sales.map((p) => <i key={p.id} style={{ background: TINTS[p.tint].bg, boxShadow: `0 0 0 2px #fff, inset 0 0 0 2px ${TINTS[p.tint].fg}` }} />)}</span>
                {sales.length === 1 ? 'sees it' : 'see it'}</span>
            </span>
          ) : (
            <span class="mg-tg-who"><b>{nph === 'idle' ? 'Next month' : next}</b><span class="mg-mono">{nph === 'idle' ? next : rows.map((x) => short(x.goal)).join(' · ')}</span></span>
          )}
          <MoveAct id={nid} word={`Goals · ${short(sum)}`} label={`Goals for ${next}: ${rows.map((x) => `${x.p ? firstWord(x.p.name) : 'counter and agents'} ${short(x.goal)}`).join(', ')}: ${short(sum)}`}
            on={() => tapMove(nid, `${next} · set`, 'goals', ['next', nextMonthGoals(rows)])} />
        </div>

        <SectionHead title="Stage limits" meta={`${over.length} over`} after />
        <div class="mg-tg-tiles">
          {LIMIT_STAGES.map((st) => {
            const n = over.filter((x) => x.o.stage === st).length, v = Number(l[st]) || 0;
            return (
              <button key={st} type="button" class="mg-tg-tile" onClick={() => setLims({ ...(lims || {}), [st]: nextLimit(st, v) })}
                aria-label={`${STAGE[st]}: ${limitWord(v)}${n ? `, ${n} over` : ''}. Change`}>
                <span class="v"><Icon name={STAGE_ICON_OF[st]} size={16} stroke={2} /><b class="mg-mono">{limitWord(v)}</b></span>
                <span class="s">{STAGE[st]}</span>
                {n > 0 && <span class="mg-tg-need mg-mono" aria-hidden="true">{n}</span>}
              </button>
            );
          })}
        </div>

        <SectionHead title="Credit hold line" meta={`${line.past.length} past it`} after />
        <div class="mg-tg-hold">
          <div class="mg-tg-hold-row">
            <span class="mg-tg-line" role="img" aria-label={`Customers by oldest bill: ${line.all.map((x) => `${firstWord(x.c.name)} ${x.days} days`).join(', ')}; the hold line at ${hold} days`}>
              <span class="track"><i style={{ width: pc(hold / scale) }} /><i class="past" /></span>
              <i class="mark" style={{ left: pc(hold / scale) }} />
              {line.all.map((x) => <i key={x.c.id} class="dot" style={{ left: pc(x.days / scale) }} />)}
            </span>
            <Stepper value={hold} unit="d" min={1} what="days before credit holds" onChange={setDays} />
          </div>
          <span class="mg-tg-past mg-mono">{line.past.length ? line.past.map((x) => `${firstWord(x.c.name)} ${x.days} d`).join(' · ') : 'Nobody past it'}</span>
        </div>
      </div>

      <footer class="mg-tg-dock">
        <Bars />
        <button type="button" class="mg-tg-save" aria-disabled={dirty && !busy ? undefined : 'true'} aria-busy={busy || undefined}
          onClick={() => { if (dirty && !busy) void save(); }}>
          {busy ? <><span class="ow-spin" aria-hidden="true" />Sending…</> : dirty ? 'Save' : 'Nothing to save'}
        </button>
      </footer>
    </main>
  );
}
