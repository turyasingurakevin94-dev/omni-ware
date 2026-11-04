/*
 * TD16, TD17, TD25 · Your day. Placed: the orders Grace placed today, by time, the earlier ones
 * folded, what was sold today (billed) beside the total; her best customers this month. Money in:
 * how they paid (split bar), each payment, the week by day, what is still to collect. A TEST record
 * shows struck through, "Test · not counted", and is in no figure (0167).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money, orderTotal, short } from '../../../core/money.ts';
import { orderNo, STAGE_WORD } from '../../../core/names.ts';
import { addDays, clock, dayLabel, dayOf, monthName, monthOf, weekday } from '../../../core/time.ts';
import type { Books, Method, Order } from '../../../core/types.ts';
import { Avatar, FaceStack } from '../../../ui/Avatar.tsx';
import { IconTile } from '../../../ui/ActRow.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon, STAGE_ICON, phCoins, type IconName } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import type { ScreenProps } from '../shell/types.ts';
import { books, now } from '../shell/store.ts';
import { faceOf, moneyInToday, owing, placedToday, readyToCollect, soldIn, total, weekStart } from './data.ts';
import { go } from './go.ts';
import './day.css';

const METHOD: Record<Method, { word: string; icon: IconName; color: string }> = {
  momo: { word: 'Mobile', icon: 'mobile', color: '#6FDCB0' }, bank: { word: 'Bank', icon: 'bank', color: '#9DB7E0' }, cash: { word: 'Cash', icon: 'cash', color: '#DDE3F0' },
};

export function Day(p: ScreenProps): JSX.Element {
  const b = books.value, n = now.value, [view, setView] = useState<string>(String(p.params.view || 'placed'));
  if (!b) return <main class="td-wait" aria-busy="true" />;
  const close = () => nav.back();
  return (
    <FullSheet onBack={close} backLabel="Back to Today" head={
      <div class="ow-shead td-day-h">
        <span aria-hidden="true" class="ow-shead-grab" />
        <div class="ow-shead-row">
          <span class="td-day-t"><span>Your day</span><span>{dayLabel(n)}</span></span>
          <button type="button" class="ow-shead-x" aria-label="Close" onClick={close}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <div role="tablist" aria-label="Show" class="td-seg">
          {[['placed', 'Placed'], ['money', 'Money in']].map(([k, w]) => (
            <Tap key={k} on={() => setView(k)} current={view === k} class={view === k ? 'on' : undefined}>{w}</Tap>
          ))}
        </div>
        {view === 'money' ? <MoneyHead b={b} now={n} /> : <PlacedHead b={b} now={n} />}
      </div>
    }>
      {view === 'money' ? <MoneyBody b={b} now={n} /> : <PlacedBody b={b} now={n} />}
    </FullSheet>
  );
}

function PlacedHead(p: { b: Books; now: number }): JSX.Element {
  const os = placedToday(p.b, p.now).filter((o) => !o.qa), today = dayOf(p.now);
  const sold = soldIn(p.b, monthOf(today)).filter((o) => o.invoicedAt != null && dayOf(o.invoicedAt) === today && o.invoicedAt <= p.now);
  return (
    <div class="td-day-fig">
      <span><span>{`Placed today · ${os.length} orders`}</span><span><span>UGX</span><span class="mono">{money(total(os))}</span></span></span>
      {sold.length > 0 && (
        <button type="button" class="td-day-sold" aria-label={`Sold today: ${money(total(sold))}${sold.length === 1 ? `, order ${orderNo(sold[0].id)}` : ''}`}
          onClick={() => go('orders/order', { id: sold[0].id })}>
          <span>Sold today</span><span class="mono">{money(total(sold))}</span><span class="mono">{sold.length === 1 ? orderNo(sold[0].id) : `${sold.length} bills`}</span>
        </button>
      )}
    </div>
  );
}

function stagePill(o: Order): JSX.Element {
  if (o.qa) return <span class="td-spill t">Test · not counted</span>;
  if (readyToCollect(o)) return <span class="td-spill g">Ready to collect</span>;
  return <span class="td-spill"><Icon name={STAGE_ICON[o.stage]} size={13} stroke={2.2} />{STAGE_WORD[o.stage]}</span>;
}

function PlacedBody(p: { b: Books; now: number }): JSX.Element {
  const b = p.b, all = placedToday(b, p.now), real = all.filter((o) => !o.qa), [open, setOpen] = useState(false);
  const fold = open ? 0 : Math.max(0, real.length - 5), early = real.slice(0, fold), shown = all.filter((o) => !early.includes(o));
  const best = bestCustomers(b, p.now), qa = all.some((o) => o.qa);
  return (
    <>
      <div class="ow-group p14 td-day-list">
        {early.length > 0 && (
          <button type="button" class="td-day-row" onClick={() => setOpen(true)}>
            <span class="mono td-day-at">{clock(early[0].placedAt)}</span>
            <span class="td-day-early"><FaceStack ground="#FFFFFF" max={99} faces={early.map((o) => faceOf(b, o))} />{`${early.length} earlier`}</span>
            <span class="mono td-day-amt">{money(total(early))}</span>
            <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
          </button>
        )}
        {shown.map((o) => {
          const c = o.customerId ? b.customers.find((x) => x.id === o.customerId) : null;
          return (
            <Tap key={o.id} class={cx('td-day-row', o.qa && 'qa')} on={() => go('orders/order', { id: o.id })}>
              <span class="mono td-day-at">{clock(o.placedAt)}</span>
              {o.qa ? <span aria-hidden="true" class="td-day-flag"><Icon name="flag" size={14} stroke={2} /></span> : <Avatar {...faceOf(b, o)} size={32} />}
              <span class="td-day-t2"><span>{c ? c.name : o.qa ? o.client.name : 'Walk-in order'}</span><span>{!o.qa && <span class="mono">{orderNo(o.id)}</span>}{stagePill(o)}</span></span>
              <span class="mono td-day-amt">{money(orderTotal(o))}</span>
            </Tap>
          );
        })}
        <div class="td-day-tot"><span>{`${real.length} orders`}</span><span class="mono">{money(total(real))}</span></div>
      </div>
      {qa ? (
        <div class="td-day-test"><Icon name="flag" size={18} stroke={2} /><span>A TEST record stays in the books, in no figure</span></div>
      ) : best.length > 0 && (
        <Tap on={() => nav.replace('today/goal')} class="td-best">
          <span class="td-best-h"><span>{`Best customers · sold in ${monthName(p.now)}`}</span><span class="ow-chev"><Icon name="chevron-right" size={14} stroke={2.4} style={{ opacity: 0.7 }} /></span></span>
          {best.map((x) => (
            <span key={x.c.id} class="td-best-r">
              <Avatar initials={x.c.initials} tint={x.c.tint} size={24} />
              <span>{x.c.name}</span>
              <span aria-hidden="true"><span style={{ width: `${Math.round((x.sum / best[0].sum) * 100)}%` }} /></span>
              <b class="mono">{money(x.sum)}</b>
            </span>
          ))}
        </Tap>
      )}
    </>
  );
}

/** Grace's own invoiced sales this month, by customer, the top three (FACTS lead ruling: Grace only). */
function bestCustomers(b: Books, nowMs: number) {
  const by = new Map<string, number>();
  soldIn(b, monthOf(dayOf(nowMs))).forEach((o) => { if (o.customerId) by.set(o.customerId, (by.get(o.customerId) || 0) + orderTotal(o)); });
  return [...by].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([id, sum]) => ({ c: b.customers.find((c) => c.id === id) as Books['customers'][0], sum })).filter((x) => x.c);
}

function MoneyHead(p: { b: Books; now: number }): JSX.Element {
  const ps = moneyInToday(p.b, p.now), sum = ps.reduce((s, x) => s + x.amount, 0);
  const by = (['momo', 'bank', 'cash'] as Method[]).map((m) => ({ m, v: ps.filter((x) => x.method === m).reduce((s, x) => s + x.amount, 0) })).filter((x) => x.v > 0);
  return (
    <div class="td-day-in">
      <span><span>{`Money in today · ${ps.length} payment${ps.length === 1 ? '' : 's'}`}</span><span><span>UGX</span><span class="mono">{money(sum)}</span></span></span>
      <span role="img" aria-label={by.map((x) => `${METHOD[x.m].word} ${money(x.v)}`).join(', ').replace(/^(\w)/, (c) => c).replace(/, (\w)/g, (_m, c) => ', ' + c.toLowerCase())} class="td-day-split">
        {by.map((x) => <span key={x.m} style={{ flex: Math.round(x.v / 1000), background: METHOD[x.m].color }} />)}
      </span>
      <span class="td-day-key">{by.map((x) => <span key={x.m}><span aria-hidden="true" style={{ background: METHOD[x.m].color }} />{METHOD[x.m].word} <b class="mono">{short(x.v)}</b></span>)}</span>
    </div>
  );
}

function MoneyBody(p: { b: Books; now: number }): JSX.Element {
  const b = p.b, ps = moneyInToday(b, p.now), sum = ps.reduce((s, x) => s + x.amount, 0), today = dayOf(p.now), mon = weekStart(today);
  const days = Array.from({ length: 6 }, (_x, i) => addDays(mon, i)).filter((d) => d <= today);
  const week = days.map((d) => ({ d, v: b.payments.filter((x) => x.by === b.me.id && x.day === d && x.at <= p.now && !x.qa).reduce((s, x) => s + x.amount, 0) }));
  const max = Math.max(1, ...week.map((x) => x.v)), top = week.reduce((m, x) => (x.v > m.v ? x : m), week[0]);
  const owe = owing(b, p.now), oweSum = owe.reduce((s, w) => s + w.owes, 0);
  return (
    <>
      <div class="ow-group p14 td-day-list">
        {ps.map((x) => {
          const c = x.customerId ? b.customers.find((y) => y.id === x.customerId) : null, m = METHOD[x.method];
          return (
            <button type="button" key={x.id} class="td-day-row" onClick={() => go('customers/paid', { id: x.id })}>
              <span class="mono td-day-at">{clock(x.at)}</span>
              <Avatar {...(c ? { initials: c.initials, tint: c.tint } : { initials: 'WI', tint: 't4' as const })} size={32} />
              <span class="td-day-t2"><span>{c ? c.name : 'Walk-in order'}</span>
                <span><span class="td-day-m"><Icon name={m.icon} size={14} stroke={2} />{x.method === 'momo' && x.ref ? <span class="mono">{x.ref}</span> : m.word}</span>{(x.method !== 'momo' || !x.ref) && x.orderId && <span class="mono">{`· ${orderNo(x.orderId)}`}</span>}</span></span>
              <span class="mono td-day-amt in">{'+' + money(x.amount)}</span>
            </button>
          );
        })}
        <div class="td-day-tot"><span>Total in</span><span class="mono">{money(sum)}</span></div>
      </div>
      <div class="td-week">
        <span class="td-week-h"><span>This week in</span><span class="mono">{money(week.reduce((s, x) => s + x.v, 0))}</span></span>
        <span role="img" aria-label={`Money in each day this week; today ${money(week[week.length - 1].v)}`} class="td-week-bars">
          {week.map((x) => {
            const isToday = x.d === today, label = isToday || (x === top && x.v > 0);
            return (
              <span key={x.d} class={isToday ? 'now' : undefined}>
                {label && <span class="mono">{short(x.v, 2)}</span>}
                <span style={{ height: `${Math.max(12, Math.round((x.v / max) * 62))}px` }} />
                <span>{weekday(x.d)[0]}</span>
              </span>
            );
          })}
        </span>
      </div>
      {oweSum > 0 && (
        <Tap on={() => nav.replace('today/to-collect')} class="td-still">
          <IconTile tone="warn" duo={phCoins} size={38} />
          <span class="td-still-t"><span>Still to collect</span><span class="td-still-f"><FaceStack ground="#FFFFFF" max={99} faces={owe.slice().sort((x, y) => Number(!!y.held) - Number(!!x.held) || Number(y.checked > 0) - Number(x.checked > 0) || (x.c.id < y.c.id ? -1 : 1)).map((w) => ({ initials: w.c.initials, tint: w.c.tint }))} /></span></span>
          <b class="mono">{money(oweSum)}</b>
          <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
        </Tap>
      )}
    </>
  );
}
