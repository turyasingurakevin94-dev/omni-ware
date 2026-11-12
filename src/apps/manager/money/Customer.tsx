/*
 * The customer (route `money/customer` { customer }, Money p4): what they owe against their limit;
 * D-32 "Credit asked" in place while Esther's ask waits (one tap: Limit · Cash only, Undo 10);
 * Limit now · Change (the limit sheet, D-25); Look alike · Open (the merge sheet, D-26);
 * Old books · Open (the opening balance sheet, D-27). What this phone keeps for signal says "Waits".
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { dayLabel, dayOf } from '../../../core/time.ts';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { oldestDays } from '../../../core/manager/credit.ts';
import type { Cust, LimitAsk } from '../../../core/manager/types.ts';
import { ANSWER, creditChip, waited, whoSee, hm } from '../../../core/manager/words.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import type { Params } from '../../../ui/stack.ts';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { answer, books, kept, now, waiting } from '../shell/store.ts';
import { CustHead, sellersOf, Waits, waitsRows } from './parts.tsx';
import './debtor.css';

/** Customers whose old books were taken on this phone just now: the card shows "0 left" (Added2 Old books · done). */
export const booksDone = signal<string[]>([]);

const sinceWord = (day: string) => dayLabel(day).split(' ').slice(1).join(' ');
const limitWord = (limit: number, days: number) => `Limit ${money(limit)} · ${days} days`;

function Rec(p: { c: Cust; on: boolean; open: () => void }): JSX.Element {
  return (
    <button type="button" class="mg-mo-rec" aria-pressed={p.on} aria-label={`Keep ${p.c.name}`} onClick={p.open}>
      <span class="h"><span class={cx('mg-mo-tick', p.on && 'on')}>{p.on && <Icon name="check" size={12} stroke={3} />}</span><b>{p.c.name}</b></span>
      <span class="mono m">{p.c.phone}</span>
      <span class="r"><span class="mono m">{p.c.orders === 1 ? '1 order' : `${p.c.orders} orders`}</span><b class="mono v">{money(Math.max(0, p.c.owes))}</b></span>
    </button>
  );
}

function Asked(p: { a: LimitAsk; c: Cust }): JSX.Element | null {
  const b = books.value!;
  const who = b.team.find((x) => x.id === p.a.askerId) || null, seller = b.team.find((x) => x.id === p.c.sellers[0]) || null;
  const told = [who, seller].filter((x, i, l) => x && l.indexOf(x) === i).map((x) => firstWord(x!.name));
  const word = limitWord(p.a.amount, p.a.days);
  const why = p.a.why ? p.a.why.charAt(0).toLowerCase() + p.a.why.slice(1) : '';
  return (
    <div class="mg-mo-ask">
      <div class="mg-mo-ask-h">
        {who && <Avatar initials={who.initials} tint={who.tint} size={36} />}
        <span class="n"><b>{`From ${who ? firstWord(who.name) : ''} · Credit asked`}</b><span class="mono">{[hm(p.a.at), why].filter(Boolean).join(' · ')}</span></span>
        <span class="mg-mo-chip">{waited(p.a.at, now.value)}</span>
      </div>
      <div class="mg-mo-ask-to">
        <span class="mono">{p.c.limit ? money(p.c.limit) : creditChip('nolimit', 0)}</span><Icon name="chevron-right" size={16} stroke={2.2} />
        <b class="mono">{`${money(p.a.amount)} · ${p.a.days} days`}</b>
      </div>
      <div class="mg-mo-ask-a">
        <button type="button" class="mg-mo-pill navy" onClick={() => answer(p.a.key, word, 'limitAsk', [p.a.askId, true, { limit: p.a.amount, days: p.a.days }])}>{word}</button>
        <button type="button" class="mg-mo-pill" onClick={() => answer(p.a.key, ANSWER.cashOnly, 'limitAsk', [p.a.askId, false, null])}>{ANSWER.cashOnly}</button>
      </div>
      <div class="mg-mo-ask-who"><Icon name="bell" size={14} stroke={2} /><span>{whoSee(told)} <b>{word}</b></span></div>
    </div>
  );
}

export function Customer(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const c = b.customers.find((x) => x.id === p.params.customer);
  if (!c) return null;
  const today = dayOf(now.value), days = oldestDays(c, today);
  const ask = waiting.value.find((a): a is LimitAsk => a.kind === 'limit' && a.customerId === c.id) || null;
  const twin = c.lookAlike ? b.customers.find((x) => x.id === c.lookAlike!.id) || null : null;
  const share = c.limit ? Math.max(0, c.owes) / c.limit : 0;
  const merge = (keep: string) => twin && nav.push('money/merge', { keep, drop: keep === c.id ? twin.id : c.id });
  return (
    <main class="mg-mo-page">
      <CustHead c={c} people={sellersOf(b, c)}>
        <div class="mg-mo-dhead">
          <button type="button" class="mg-mo-eye" onClick={() => nav.push('money/debtor', { customer: c.id })}>OWES ›</button>
          <span class="mg-mo-cfig mono">{money(Math.max(0, c.owes))} <small>UGX</small></span>
          {c.limit ? (
            <>
              <div class="mg-mo-cbar" aria-hidden="true"><i style={{ width: `${Math.min(100, share * 100)}%` }} /></div>
              <span class="mg-mo-soft"><b>{`${Math.round(share * 100)}%`}</b> of the <b>{money(c.limit)}</b> limit{days > 0 && <> · oldest <b>{`${days} d`}</b></>}</span>
            </>
          ) : <span class="mg-mo-soft">{creditChip('nolimit', 0)}{days > 0 && <> · oldest <b>{`${days} d`}</b></>}</span>}
        </div>
      </CustHead>
      <div class="mg-mo-body">
        <Waits rows={waitsRows(b, kept.value, c.id)} />
        {ask && <Asked a={ask} c={c} />}
        <div class="mg-mo-card mg-mo-lnow">
          <span class="n"><span>Limit now</span><b class="mono">{c.limit ? `${money(c.limit)} · ${c.termsDays || 0} days` : ANSWER.cashOnly}</b></span>
          <button type="button" class="mg-mo-pill" aria-label={`Change the limit for ${c.name}`} onClick={() => nav.push('money/limit', { customer: c.id })}>Change</button>
        </div>
        {twin && (
          <div class="mg-mo-card mg-mo-alike">
            <div class="mg-mo-alike-h">
              <Icon name="link" size={20} stroke={2} /><b>Look alike</b>
              <span class="mg-mo-chip warn">{c.lookAlike!.why === 'phone' ? 'Same phone' : 'Same name'}</span>
              <button type="button" class="mg-mo-pill" aria-label={`Open: merge ${twin.name} into ${c.name} (a slide)`} onClick={() => merge(c.id)}><Icon name="chevron-right" size={16} stroke={2.2} />Open</button>
            </div>
            <div class="mg-mo-pair"><Rec c={c} on open={() => merge(c.id)} /><Rec c={twin} on={false} open={() => merge(twin.id)} /></div>
          </div>
        )}
        {c.oldBooks ? (
          <div class="mg-mo-card mg-mo-old">
            <span class="i"><Icon name="note" size={18} stroke={2} /></span>
            <span class="n"><b>Old books</b><span class="mono">{`since ${sinceWord(c.oldBooks.since)}`}</span></span>
            <b class="mono f">{money(c.oldBooks.amount)}</b>
            <button type="button" class="mg-mo-pill" aria-label={`Open: opening balance ${money(c.oldBooks.amount)} (a slide)`} onClick={() => nav.push('money/opening', { customer: c.id })}><Icon name="chevron-right" size={16} stroke={2.2} />Open</button>
          </div>
        ) : booksDone.value.includes(c.id) && (
          <div class="mg-mo-card mg-mo-old done">
            <span class="i"><Icon name="note" size={18} stroke={2} /></span>
            <span class="n"><b>Old books</b></span>
            <b class="mono f">0 left</b>
          </div>
        )}
      </div>
    </main>
  );
}
