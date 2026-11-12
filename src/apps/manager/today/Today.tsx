/*
 * Today (route `today`; docs/canvas/manager/Today.dc.html p1 "TODAY · 09:40"): the navy hero
 * (the month's sales invoiced against the shop's goal, ahead or behind the pace), the four
 * "On the move" tiles, Needs you (Needs.tsx) and Watch. The shell draws the bar, the red + and
 * the amber "No signal" bar.
 */
import type { JSX } from 'preact';
import { money, short } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { dayLabel, greeting, monthName } from '../../../core/time.ts';
import { heroGoal, stageTiles, watchTiles } from '../../../core/manager/today.ts';
import type { ManagerBooks, Stage } from '../../../core/manager/types.ts';
import { hm, STAGE } from '../../../core/manager/words.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon, STAGE_ICON } from '../../../ui/icons.tsx';
import { nav } from '../shell/nav.ts';
import { books, kept, now, online, waiting } from '../shell/store.ts';
import { Dot, Needs } from './Needs.tsx';
import './today.css';

const ICON: Record<Stage, keyof typeof STAGE_ICON> = {
  draft: 'checking', awaiting_goods: 'buying', preparing: 'packing', pending_delivery: 'road', completed: 'delivered', cancelled: 'delivered',
};

function Hero(p: { b: ManagerBooks; at: number }): JSX.Element {
  const g = heroGoal(p.b, p.at), me = p.b.me;
  const waits = kept.value.filter((k) => k.state !== 'refused').length;
  const pct = Math.round(g.pct * 100);
  const ahead = g.ahead >= 0;
  return (
    <header class="mg-today-hero">
      <div class="mg-today-hi">
        <h1>{`${greeting(p.at)}, ${firstWord(me.name)}`}</h1>
        {waits > 0 ? <span class="mg-today-live warn"><i />{`${waits} waiting to send`}</span>
          : online.value ? <span class="mg-today-live"><i />Live</span>
            : <span class="mg-today-live warn"><i />{`Saved ${hm(p.b.at)}`}</span>}
        <button type="button" class="mg-today-me" aria-label={`${firstWord(me.name)}, your page`} onClick={() => nav.push('shell/you', {})}>{me.initials}</button>
      </div>
      <button type="button" class="mg-today-sold" aria-label={`Sales invoiced in ${monthName(p.at)}: ${money(g.sold)} UGX. Open the team`} onClick={() => nav.tab('team')}>
        <span class="mg-today-over"><span>{`SALES INVOICED · ${monthName(p.at).toUpperCase()} ›`}</span><span class="d">{dayLabel(p.at)}</span></span>
        <span class="mg-today-fig">{money(g.sold)} <small>UGX</small></span>
      </button>
      <button type="button" class="mg-today-goal" onClick={() => nav.push('team/goals', {})}
        aria-label={`${pct}% of the ${money(g.goal)} goal; ${money(Math.abs(g.ahead))} ${ahead ? 'ahead of' : 'behind'} the pace. Open goals`}>
        <span class="mg-today-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, pct)}%` }} /><b style={{ left: `${Math.min(100, g.pacePct * 100).toFixed(1)}%` }} /></span>
        <span class="mg-today-gl">
          <span><b>{`${pct}%`}</b> of <b>{short(g.goal)}</b> · <b>{g.daysLeft}</b> days left ›</span>
          <span class={'mg-today-ahead' + (ahead ? '' : ' behind')}>{`${ahead ? '+' : '−'}${short(Math.abs(g.ahead), 2)} ${ahead ? 'ahead' : 'behind'}`}</span>
        </span>
      </button>
    </header>
  );
}

function Tiles(p: { b: ManagerBooks }): JSX.Element {
  const tiles = stageTiles(p.b, waiting.value);
  const who = (id: string) => p.b.team.find((x) => x.id === id) || null;
  return (
    <div class="mg-today-tiles">
      {tiles.map((t) => {
        const ppl = t.holders.map(who).filter((x): x is NonNullable<typeof x> => !!x);
        const names = ppl.map((x) => firstWord(x.name));
        const label = `${STAGE[t.stage]}: ${t.count} ${t.count === 1 ? 'order' : 'orders'}${t.need ? `, ${t.need} ${t.need === 1 ? 'waits' : 'wait'} on you` : ''}${names.length ? `, ${names.join(' and ')} ${names.length === 1 ? 'holds' : 'hold'} them` : ''}`;
        return (
          <button type="button" key={t.stage} class="mg-today-tile" aria-label={label} onClick={() => nav.tab('orders')}>
            <span class="n"><Icon name={STAGE_ICON[ICON[t.stage]]} size={15} stroke={1.9} /><b>{t.count}</b></span>
            <span class="w">{STAGE[t.stage]}</span>
            <span class="f">{ppl.slice(0, 4).map((x) => <Dot key={x.id} tint={x.tint} />)}</span>
            {t.need > 0 && <span class="need" aria-hidden="true">{t.need}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Watch(p: { b: ManagerBooks; at: number }): JSX.Element | null {
  const tiles = watchTiles(p.b, p.at);
  if (!tiles.length) return null;
  return (
    <>
      <div class="mg-today-sec">
        <Icon name="eye" size={18} stroke={2} />
        <span class="t">Watch</span>
        <span class="m">{tiles.map((t) => t.head).join(' · ')}</span>
        <b>{tiles.length}</b>
      </div>
      <div class="mg-today-watch" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
        {tiles.map((t) => (
          <div key={t.key} class="mg-today-wt">
            <span class="h"><Avatar initials={t.staff.initials} tint={t.staff.tint === 'me' ? 'n' : t.staff.tint} size={18} /><b>{t.figure}</b></span>
            <button type="button" aria-label={t.label} onClick={() => nav.push('team/nudge', t.order != null ? { staff: t.staff.id, order: t.order } : { staff: t.staff.id })}>Nudge</button>
          </div>
        ))}
      </div>
    </>
  );
}

export function Today(): JSX.Element {
  const b = books.value;
  if (!b) return <main class="mg-today" aria-busy="true" />;
  const at = now.value;
  return (
    <main class="mg-today">
      <Hero b={b} at={at} />
      <div class="mg-today-body">
        <Tiles b={b} />
        <Needs b={b} at={at} />
        <Watch b={b} at={at} />
      </div>
    </main>
  );
}
