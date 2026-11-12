/*
 * One debtor (route `money/debtor` { customer }, Money p2): what they owe and the hold track in the
 * head; their bills, oldest first; their promises as dots (kept · broken · open); Chase: Call ·
 * Statement. The dock: Nudge Grace (D-30, Undo 10) · Promise (the sheet, D-28).
 * Statement: the books have no statement write for the Manager (data R17 reads statements_sent
 * only), so it says so and sends nothing.
 */
import type { JSX } from 'preact';
import { daysApart, dayLabel, dayOf } from '../../../core/time.ts';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { oldestDays } from '../../../core/manager/credit.ts';
import { isHeld, promiseLine, promiseTally } from '../../../core/manager/money.ts';
import { bandOf } from '../../../core/manager/watch.ts';
import type { Promise_ } from '../../../core/manager/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import type { Params } from '../../../ui/stack.ts';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { books, now } from '../shell/store.ts';
import { nudge, sellerOf } from './Money.tsx';
import { CustHead, MoneyDock, PageDock, sellersOf, Track } from './parts.tsx';
import './debtor.css';

const ink = { kept: '#0F6B43', broken: '#8E2A22', open: '#16203C' } as const;

function Dots(p: { ps: Promise_[]; today: string }): JSX.Element {
  const W = 300, x = (f: number) => 10 + f * (W - 20);
  const { dots: line, today: tx } = promiseLine(p.ps, p.today);
  return (
    <svg width="100%" height="44" viewBox={`0 0 ${W} 44`} preserveAspectRatio="xMidYMid meet" role="img"
      aria-label={line.map((d) => `${dayLabel(d.p.on)} ${d.p.state}`).join(', ')}>
      <line x1="10" y1="14" x2={W - 10} y2="14" stroke="#E6E3DD" stroke-width="2" />
      {line.map((d) => (
        <g key={d.p.id}>
          {d.p.state === 'kept'
            ? <><circle cx={x(d.x)} cy="14" r="7" fill={ink.kept} /><path d={`M${x(d.x) - 3} 14l2 2 4-4`} stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" /></>
            : <circle cx={x(d.x)} cy="14" r="6" fill="#fff" stroke={ink[d.p.state]} stroke-width="2.5" />}
          <text x={d.x > 0.93 ? W - 4 : x(d.x)} y="38" text-anchor={d.x > 0.93 ? 'end' : 'middle'} font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="#6B7480">{dayLabel(d.p.on).split(' ').slice(1).join(' ')}</text>
        </g>
      ))}
      <rect x={x(tx) - 1} y="4" width="2" height="20" fill="#1C2233" />
      <text x={tx >= 1 ? x(tx) - 3 : x(tx)} y="38" text-anchor={tx >= 1 ? 'end' : 'middle'} font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="#1C2233">today</text>
    </svg>
  );
}

export function Debtor(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const c = b.customers.find((x) => x.id === p.params.customer);
  if (!c) return <main class="mg-mo-page"><div class="mg-mo-body"><div class="mg-mo-none">Nobody owes</div></div></main>;
  const today = dayOf(now.value), hold = b.shop.holdDays, days = oldestDays(c, today);
  const seller = sellerOf(b, c), tally = promiseTally(c), open = c.bills.filter((x) => x.left > 0);
  const me = firstWord(b.me.name);
  return (
    <main class="mg-mo-page">
      <CustHead c={c} people={sellersOf(b, c)}>
        <div class="mg-mo-dhead">
          <button type="button" class="mg-mo-eye" onClick={() => nav.push('money/customer', { customer: c.id })}>
            OWES ›{isHeld(days, hold) && <span class="mg-mo-chip held">Held</span>}
          </button>
          <span class="mg-mo-big mono">{money(Math.max(0, c.owes))} <small>UGX</small></span>
          {days > 0 && <div class="mg-mo-dtrack"><Track days={days} hold={hold} band={bandOf(days)} w={260} navy /><b class="mono">{`${days} d`}</b></div>}
          <span class="mg-mo-soft">oldest bill · new orders held from <b>{`${hold} d`}</b></span>
        </div>
      </CustHead>
      <div class="mg-mo-body">
        <SectionHead title="Bills" meta={String(open.length)} />
        {open.length > 0 && (
          <div class="mg-mo-list">
            {open.map((x, i) => (
              <div class="mg-mo-bill" key={`${x.orderId}-${x.day}`}>
                <span class="i"><Icon name="receipt" size={18} stroke={2} /></span>
                <span class="n"><b class="mono">{dayLabel(x.day)}</b><span class="mono">{`${x.orderId === 0 ? 'old books' : i === 0 ? 'oldest bill' : 'bill'} · ${daysApart(x.day, today)} d`}</span></span>
                <b class="mono f">{money(x.left)}</b>
              </div>
            ))}
          </div>
        )}
        {c.promises.length > 0 && (
          <>
            <div class="mg-mo-sec2">
              <h2>Promises</h2>
              <span>{tally.kept > 0 && <span class="mg-mo-chip good">{`${tally.kept} kept`}</span>}{tally.broken > 0 && <span class="mg-mo-chip bad">{`${tally.broken} broken`}</span>}</span>
            </div>
            <div class="mg-mo-card mg-mo-dots"><Dots ps={c.promises} today={today} /></div>
          </>
        )}
        <SectionHead title="Chase" after />
        <div class="mg-mo-card mg-mo-chase">
          {c.phone && <a class="mg-mo-tilebtn" href={`tel:${c.phone.replace(/\s/g, '')}`} aria-label={`Call ${c.name}`}><Icon name="phone" size={18} stroke={2} />Call</a>}
          <button type="button" class="mg-mo-tilebtn" aria-label={`Statement for ${c.name}`}
            onClick={() => toast.show('Statement · not in this app yet', { kind: 'warn' })}><Icon name="receipt" size={18} stroke={2} />Statement</button>
        </div>
      </div>
      <PageDock>
        <MoneyDock row told={seller ? [seller] : []} word={`${me} nudged you`}
          tap={seller ? { label: `Nudge ${firstWord(seller.name)}`, dot: seller, on: () => nudge(b, c, days) } : undefined}
          second={{ label: 'Promise', icon: 'calendar', on: () => nav.push('money/promise', { customer: c.id }) }} />
      </PageDock>
    </main>
  );
}
