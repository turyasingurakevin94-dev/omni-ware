/*
 * A promise (route `money/promise` { customer }, Money p3, D-28): How much (All · Oldest bill · Part),
 * Which day (today and the six after it; Pick a day later), their promises, what is left if kept.
 * The dock: "Promised · 2,310,000 · Mon 19", a tap held 10 s with Undo in the dock, then the sheet
 * goes. Not sent: the shell's bar says it, the picks stay.
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { addDays, dayLabel, dayOf, weekday } from '../../../core/time.ts';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { oldestDays } from '../../../core/manager/credit.ts';
import { dayChip, firstPromiseDay, ifKept, promiseAmounts, promiseTally, promiseWeek } from '../../../core/manager/money.ts';
import { ANSWER } from '../../../core/manager/words.ts';
import { Icon } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import type { Params } from '../../../ui/stack.ts';
import { cx } from '../../../ui/util.tsx';
import { nav, top } from '../shell/nav.ts';
import { answer, books, now, online } from '../shell/store.ts';
import { sellerOf } from './Money.tsx';
import { ErrStrip, HeldStrip, MoneyDock, MoneySheet, Tile } from './parts.tsx';
import './sheets.css';

type How = 'all' | 'oldest' | 'part';
const STATE_WORD = { kept: 'Kept', broken: 'Broken', open: 'Open' } as const;

export function PromiseSheet(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  const [how, setHow] = useState<How>('all');
  const [part, setPart] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const later = useRef<HTMLInputElement>(null);
  if (!b) return null;
  const c = b.customers.find((x) => x.id === p.params.customer);
  if (!c) return null;
  const today = dayOf(now.value), on = day || firstPromiseDay(today), week = promiseWeek(today);
  const amounts = promiseAmounts(c), partN = Math.min(amounts.all, Number(part.replace(/\D/g, '')) || 0);
  const amount = how === 'all' ? amounts.all : how === 'oldest' ? amounts.oldest : partN;
  const kept = ifKept(c, amount), tally = promiseTally(c), seller = sellerOf(b, c);
  const word = `${ANSWER.promised} · ${dayChip(on)}`, label = `${ANSWER.promised} · ${money(amount)} · ${dayChip(on)}`;
  const me = top.value.key;
  const send = () => {
    setSent(word);
    setError(false);
    answer(null, label, 'promise', [c.id, on, amount], {
      quiet: true,
      undo: () => setSent(null),
      then: (r) => { if (r && top.peek().key === me) nav.back(); else if (!r) { setSent(null); setError(true); } },
    });
  };
  const seg = (k: How, name: string, v: JSX.Element | string, aria: string) => (
    <button type="button" class="mg-mo-seg" aria-pressed={how === k} aria-label={aria} onClick={() => setHow(k)}>
      <span>{name}</span>{typeof v === 'string' ? <b class="mono">{v}</b> : v}
    </button>
  );
  return (
    <MoneySheet label="Promise" top={40}
      head={<div class="mg-mo-sh"><Tile c={c} /><span class="mg-mo-pr-who"><b>{c.name}</b><span class="mono">{`owes ${money(c.owes)} · oldest ${oldestDays(c, today)} d`}</span></span></div>}
      dock={sent
        ? <MoneyDock strip={<HeldStrip word={sent} sub={seller ? `${firstWord(seller.name)} sees it` : ''} />} />
        : error ? <MoneyDock strip={<ErrStrip word={word} why={online.value ? 'Not saved' : 'Not saved · no signal'} retry={send} />} />
        : <MoneyDock told={seller ? [seller] : []} word={word}
          tap={{ label, icon: 'check', on: send, disabled: amount > 0 ? undefined : 'Type how much' }} />}>
      <h1 class="mg-mo-title">Promise</h1>
      <SectionHead title="How much" />
      <div class="mg-mo-segs">
        {seg('all', 'All', money(amounts.all), `All ${money(amounts.all)}`)}
        {seg('oldest', 'Oldest bill', money(amounts.oldest), `Oldest bill ${money(amounts.oldest)}`)}
        {how === 'part'
          ? <label class="mg-mo-seg on"><span>Part</span><input class="mono" inputMode="numeric" aria-label="Part: how much" value={part} placeholder="0"
            ref={(el) => { if (el && !part) el.focus(); }} onInput={(e) => setPart(money(Number((e.target as HTMLInputElement).value.replace(/\D/g, '')) || 0).replace(/^0$/, ''))} /></label>
          : seg('part', 'Part', <Icon name="grid" size={18} stroke={2} />, 'Part, type an amount')}
      </div>
      <SectionHead title="Which day" />
      <div class="mg-mo-days">
        {week.map((d, i) => i === 0
          ? <span key={d} class="mg-mo-day today"><span>{weekday(d)}</span><b class="mono">{Number(d.slice(8))}</b></span>
          : <button type="button" key={d} class={cx('mg-mo-day', d === on && 'on')} aria-pressed={d === on} aria-label={`Promised ${dayLabel(d)}`} onClick={() => setDay(d)}>
            <span>{weekday(d)}</span><b class="mono">{Number(d.slice(8))}</b></button>)}
      </div>
      <button type="button" class="mg-mo-later" aria-label={`Pick a day later than ${dayChip(week[6])}`}
        onClick={() => { const el = later.current; if (el) { try { el.showPicker(); } catch (_e) { el.focus(); } } }}>
        <Icon name="calendar" size={16} stroke={2} />{on > week[6] ? `Pick a day later · ${dayChip(on)}` : 'Pick a day later'}
        <input ref={later} type="date" class="mg-mo-later-in" min={addDays(week[6], 1)} tabIndex={-1} aria-hidden="true"
          onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) setDay(v); }} />
      </button>
      {c.promises.length > 0 && (
        <>
          <SectionHead title="Their promises" meta={[tally.kept && `${tally.kept} kept`, tally.broken && `${tally.broken} broken`].filter(Boolean).join(' · ')} />
          <div class="mg-mo-card mg-mo-theirs">
            {[...c.promises].sort((x, y) => (x.on < y.on ? -1 : 1)).map((x) => (
              <div key={x.id} class="r">
                <i class={x.state} />
                <span class="mono d">{dayLabel(x.on)}</span>
                <span class="mono a">{x.amount != null ? money(x.amount) : ''}</span>
                <span class={cx('mg-mo-chip', x.state === 'kept' ? 'good' : x.state === 'broken' ? 'bad' : '')}>{STATE_WORD[x.state]}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div class="mg-mo-card mg-mo-ifkept">
        <div class="h"><b>{`If kept · ${dayChip(on)}`}</b><span class="mono"><s>{money(c.owes)}</s>{` → ${money(kept.after)}`}</span></div>
        <div class="bar" aria-hidden="true">
          {kept.bills.map((x, i) => (
            <i key={i} style={{ flex: x.left, background: x.cleared >= x.left ? (i % 2 ? '#8D99B5' : '#16203C') : x.cleared > 0 ? `linear-gradient(90deg, #16203C ${(x.cleared / x.left) * 100}%, #ECE8E1 0)` : '#ECE8E1' }} />
          ))}
        </div>
        <div class="k mono">{kept.bills.slice(0, 2).map((x) => <span key={x.day + x.orderId}>{`${dayLabel(x.day)} · ${money(x.left)}`}</span>)}</div>
      </div>
    </MoneySheet>
  );
}
