/*
 * Today (TD01, and its states TD02 busy, TD03 scrolled to Next move, TD06 first day,
 * TD07 all told, TD08 goal hit, TD09 no signal). One screen; the books decide the state:
 *
 *   first day   nothing of Grace's yet           Get going, the ghost of On the move
 *   busy        10 or more things need her       the hero shrinks to its head row; the goal is a strip
 *   all told    nothing needs her                "N paid since morning", Who's due
 *   goal hit    sold ≥ the goal                  the bar in proportion, "35M passed on …"
 *   no signal   the phone is offline             Updating · saved 7:52, Not sent yet first, chats wait
 */
import { MiniRow } from '../../../ui/ActRow.tsx';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { money, short } from '../../../core/money.ts';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { clock, dayLabel, dayOf, daysApart, howLong, monthName, monthOf } from '../../../core/time.ts';
import type { Books } from '../../../core/types.ts';
import { ActionPill } from '../../../ui/Pill.tsx';
import { NeedsRow } from '../../../ui/NeedsRow.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { Shim } from '../../../ui/Skeleton.tsx';
import { StageTiles } from '../../../ui/StageTiles.tsx';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { Tap, barW } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { books, chats, flush, kept, now, online } from '../shell/store.ts';
import { custOf, doneWeek, faceOf, mine, needs, owing, soldIn, takeHeld, takeOf, tiles, total } from './data.ts';
import { First } from './First.tsx';
import { go } from './go.ts';
import { useLocal } from './local.ts';
import { GoalStrip, Hero, type HeroGoal } from '../../../ui/Hero.tsx';
import { NextMoves, WhoDue, scrollToNext } from "./NextMoves.tsx";
import { openTell } from './Tell.tsx';
import './today.css';

export function greeting(hm: string): string {
  const h = Number(hm.split(':')[0]);
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** The goal as the hero and the strip draw it. */
export function goalOf(b: Books, nowMs: number) {
  const today = dayOf(nowMs), g = b.goal, sold = total(soldIn(b, monthOf(today))), move = total(mine(b));
  if (!g) return null;
  return { sold, move, target: g.target, pct: Math.round((sold / g.target) * 100), movePct: Math.round((move / g.target) * 100), daysLeft: daysApart(today, g.to), hit: sold >= g.target };
}

const STAGE_LABEL = { checking: 'checking', buying: 'buying', packing: 'packing', road: 'on the road' } as const;

export function Today(): JSX.Element {
  const b = books.value, cb = chats.value, n = now.value, L = useLocal(), off = !online.value;
  const [bar, setBar] = useState(false);
  useEffect(() => {
    const on = () => setBar(window.scrollY > 260);
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => window.removeEventListener('scroll', on);
  }, []);
  if (!b) return <main class="td-wait" aria-busy="true" />;

  const me = b.me, today = dayOf(n), hm = clock(n), name = firstWord(me.name);
  const first = !b.orders.some((o) => o.placedBy === me.id) && !b.payments.some((p) => p.by === me.id);
  const goal = goalOf(b, n), live = mine(b), owe = owing(b, n), nd = needs(b, cb, n, L.told);
  const kept_ = kept.value.length, busy = !first && nd.total >= 10, calm = !first && !off && nd.total === 0;
  const toTop = () => window.scrollTo(0, 0);

  const heroGoal: HeroGoal | undefined = !goal ? undefined : goal.hit
    ? { hit: true, target: goal.target, sold: goal.sold, over: '+' + short(goal.sold - goal.target), daysLeft: goal.daysLeft,
      label: `${monthName(today)} goal hit: ${money(goal.sold)} of ${money(goal.target)}, ${money(goal.sold - goal.target)} over` }
    : { pct: goal.pct, movePct: goal.movePct, target: short(goal.target), daysLeft: goal.daysLeft };
  const hero = (
    <Hero greeting={`${first ? 'Welcome' : greeting(hm)}, ${name}`} line={first ? 'Your first day' : dayLabel(n)}
      status={off ? 'updating' : 'live'} savedAt={clock(b.at)} me={{ initials: me.initials, tint: 'me' }}
      onMe={() => nav.push('today/you')} onFind={() => nav.push('today/find')}
      compact={busy ? <><b>{live.length}</b> on the move · <b class="w">{nd.total}</b> need you</> : undefined}
      month={monthName(today)} sold={money(goal ? goal.sold : 0)} note={first ? 'your first sale starts it' : undefined}
      soldLabel={`Sold in ${monthName(today)}: ${money(goal ? goal.sold : 0)}. Open your day.`} onSold={() => nav.push('today/day', { view: 'placed' })}
      goal={heroGoal} onGoal={() => nav.push('today/goal')}
      doors={first || off ? undefined : [
        { tone: 'mint', icon: 'trend', value: '+' + short(total(live)), label: 'on the move', on: () => go('orders') },
        { tone: 'amber', icon: 'cash', value: short(owe.reduce((s, w) => s + w.owes, 0)), label: 'to collect', on: () => nav.push('today/to-collect') },
      ]} />
  );

  if (first) return <>{hero}<First b={b} now={n} /></>;

  const ts = tiles(b, n), held = live.find((o) => o.stage === 'checking' && o.holderId === me.id);
  const heldOwing = held && owe.find((w) => w.c.id === held.customerId);
  const paid = calm ? b.payments.filter((p) => p.by === me.id && p.day === today && p.at <= n && Number(clock(p.at).split(':')[0]) >= 12) : [];
  const take = nd.take.reduce((s, w) => s + w.take, 0), tellN = nd.tellPrice.length + nd.tellAsk.length;
  const words = nd.tellPrice.length > 1 || nd.tellAsk.length > 1;
  const tellSub = [nd.tellPrice.length ? (words ? `${nd.tellPrice.length} new prices` : 'a new price') : '',
    nd.tellAsk.length ? (words ? `${nd.tellAsk.length} item${nd.tellAsk.length > 1 ? 's are' : ' is'} in` : 'an item is in') : ''].filter(Boolean).join(' · ');
  const newChats = nd.waiting.filter((w) => !w.chat.customerId && !w.chat.ownerId).length;
  const passed = goal && goal.hit ? passedOn(b, n, goal.target) : null;

  return (
    <>
      {bar && (
        <Tap on={toTop} label="Back to the top of Today" class="td-topbar">
          <span>Today</span>
          {goal && <span><span aria-hidden="true" class="td-topbar-bar"><span style={{ width: barW(goal.pct) }} /><span style={{ width: barW(goal.movePct, goal.pct) }} /></span>
            <span class="mono"><b>{`${goal.pct}%`}</b>{` ${money(goal.sold)}`}</span></span>}
        </Tap>
      )}
      {hero}
      {busy && goal && <GoalStrip pct={goal.pct} movePct={goal.movePct} target={short(goal.target)} daysLeft={goal.daysLeft} on={() => nav.push('today/goal')} />}
      {off && <Notice kind="offline" class="td-notice" action={{ label: 'Try again', on: () => { void flush(); } }}>No signal · <b class="mono">{kept_}</b> not sent yet</Notice>}
      <main class={'td-main' + (busy ? ' busy' : '')}>
        {passed && (
          <Tap on={scrollToNext} class="td-passed">
            <span aria-hidden="true" class="td-passed-ic"><Icon name="trophy" size={26} stroke={1.9} /></span>
            <span class="td-passed-t"><span>{`${short(goal ? goal.target : 0)} passed on ${dayLabel(passed.day)}`}</span><span>{`${counted(passed.early, 'day')} early · see your next move`}</span></span>
            <span class="td-passed-go"><Icon name="chevron-right" size={14} stroke={2.4} style={{ opacity: 0.7 }} /></span>
          </Tap>
        )}
        <SectionHead title="On the move" meta={`${live.length} live · ${off ? 'saved ' + clock(b.at) : doneWeek(b, n).length + ' done'}`} after={!!passed} />
          <StageTiles tiles={ts.map((t) => ({
            stage: t.stage, count: t.orders.length, faces: t.faces, more: t.more, mark: calm ? undefined : t.mark, need: calm ? undefined : t.need, on: () => go('orders', { stage: t.stage }),
            label: `${t.orders.length} ${STAGE_LABEL[t.stage as keyof typeof STAGE_LABEL]}${t.need && t.mark === 'money' ? `, ${t.need} needs you` : t.mark === 'late' ? `, ${t.need || 1} late` : t.mark === 'ready' ? ', 1 ready to collect' : ''}`,
          }))}>
            {!off && held && heldOwing ? (
              <MiniRow face={faceOf(b, held)} name={(custOf(b, held.customerId) || { name: '' }).name} sub={`${orderNo(held.id)} · Not paid yet`} subMono
                pill={<ActionPill tone="warn" word="Take" amount={short(takeHeld(heldOwing))} />} on={() => go('customers/pay', takeOf(heldOwing, false))} />
            ) : paid.length > 0 ? (
              <MiniRow faces={paid.map((p) => faceOf(b, p))} name={`${paid.length} paid since morning`} sub={paid.map((p) => firstWord((custOf(b, p.customerId) || { name: '' }).name)).join(' · ')}
                pill={<span class="td-mini-pill">{'+' + money(paid.reduce((s, p) => s + p.amount, 0))}</span>} on={() => nav.push('today/day', { view: 'money' })} />
            ) : null}
          </StageTiles>
        {calm ? <WhoDue b={b} cb={cb} now={n} /> : (
          <>
            <SectionHead title="Needs you" dot count={off ? kept_ + nd.take.length : nd.total} after />
            <div class="td-needs">
              {off && kept_ > 0 && <NeedsRow kind="notsent" title="Not sent yet" sub="kept on this phone" count={kept_} on={() => { void flush(); }} />}
              {nd.take.length > 0 && <NeedsRow kind="take" title="Take payment" sub={`${money(take)} · oldest ${counted(nd.take[0].age, 'day')}`} count={nd.take.length} on={() => nav.push('today/to-collect')} />}
              {!off && tellN > 0 && <NeedsRow kind="tell" title="Tell them" sub={tellSub} count={tellN} on={() => openTell(0)} />}
              {!off && nd.waiting.length > 0 && <NeedsRow kind="chats" title="Chats waiting" sub={`oldest ${howLong(nd.waiting[0].since, n)}${newChats ? ` · ${newChats} new` : ''}`} count={nd.waiting.length} on={() => nav.tab('chats')} />}
              {off && (
                <div class="td-needs-wait" aria-busy="true" aria-label="Chats come back when the phone is online">
                  <span aria-hidden="true" class="td-needs-wait-ic"><Duo i={phWhatsapp} size={20} /></span>
                  <span class="td-needs-wait-t"><span>Chats waiting</span><Shim w="62%" h={9} /></span>
                  <span class="td-needs-wait-p"><Icon name="offline" size={13} stroke={2.2} />back online</span>
                </div>
              )}
              {!off && nd.late.length > 0 && <NeedsRow kind="packing" title="Packing 2+ days" sub={`ask ${lateHolder(b, nd.late)} in one message`} count={nd.late.length} on={() => go('orders', { stage: 'packing' })} />}
            </div>
            {!off && <NextMoves b={b} cb={cb} now={n} told={L.told} />}
          </>
        )}
      </main>
    </>
  );
}

/** Who holds the late packing (Musa). */
function lateHolder(b: Books, os: { holderId: string | null }[]): string {
  const m = b.members.find((x) => x.id === os[0].holderId);
  return m ? firstWord(m.name) : 'the yard';
}

/** The day this month's sold passed the goal, and how many days before the month's end. */
function passedOn(b: Books, nowMs: number, target: number): { day: string; early: number } | null {
  const today = dayOf(nowMs), os = soldIn(b, monthOf(today)).sort((x, y) => (x.invoicedAt || 0) - (y.invoicedAt || 0));
  let run = 0;
  for (const o of os) {
    run += total([o]);
    if (run >= target) { const day = dayOf(o.invoicedAt || 0); return { day, early: daysApart(day, (b.goal as { to: string }).to) }; }
  }
  return null;
}
