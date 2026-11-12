/*
 * Today's navy hero (board Today, phones 1, 2 and 4): the greeting, the date and Live
 * (Offline when the phone has no signal), the avatar, "TO BUY TODAY ›" with what the
 * found lines cost (opens the trip), and the bar "N of M suppliers found ›" (opens Replies).
 * After the hand-in: the bar is mint and says what was paid and the cash back.
 *
 * The shared Hero (src/ui/Hero.tsx) draws Sales's month and goal; the Buyer's hero draws
 * one figure and one bar, so it is drawn here, on the same tokens.
 */
import type { JSX } from 'preact';
import { handIn, tiles, toBuy } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { dayLabel } from '../../../core/time.ts';
import { fig } from '../../../ui/Money.tsx';
import { Tap, barW } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { firstName, hm } from './rules.ts';
import './head.css';

export function greeting(now: number): string {
  const h = Number(hm(now).slice(0, 2));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** `waiting`: writes not on the books yet — never Live while any wait (SAL-3). */
export function Head(p: { b: BuyerBooks; now: number; offline: boolean; waiting?: number }): JSX.Element {
  const { b, now } = p;
  const t = tiles(b, now), buy = toBuy(b);
  const back = b.trip && b.trip.state === 'in' && !t.found ? handIn(b.trip, b) : null;
  const pct = back ? (b.trip && b.trip.cash.amount ? (back.paid / b.trip.cash.amount) * 100 : 100) : t.suppliers ? (t.foundSuppliers / t.suppliers) * 100 : 0;
  return (
    <header class="ow-b-today-hero">
      <div class="ow-b-today-hero-top">
        <div class="ow-b-today-hero-hi">
          <span class="ow-b-today-hero-greet">{`${greeting(now)}, ${firstName(b.me)}`}</span>
          <span class="ow-b-today-hero-date">{dayLabel(now)}
            {p.offline
              ? <span class="ow-b-today-live off"><i aria-hidden="true" />Offline</span>
              : p.waiting
                ? <span class="ow-b-today-live off"><i aria-hidden="true" />{`${p.waiting} waiting to send`}</span>
                : <span class="ow-b-today-live"><i aria-hidden="true" />Live</span>}
          </span>
        </div>
        <span class="ow-b-today-me" aria-label={firstName(b.me)} role="img">{b.me.initials}</span>
      </div>
      <div class="ow-b-today-buy">
        <Tap on={() => nav.push('trip')} label={`To buy today: ${fig(buy)} UGX. Open the trip.`} class="ow-b-today-buy-fig">
          <span class="ow-b-today-eyebrow">TO BUY TODAY ›</span>
          <span class="mono ow-b-today-fig">{fig(buy)} <small>UGX</small></span>
        </Tap>
        <span aria-hidden="true" class={'ow-b-today-bar' + (back ? ' mint' : '')}><i style={{ width: barW(pct) }} /></span>
        {back ? (
          <span class="ow-b-today-line">Paid <b class="mono">{fig(back.paid)}</b> · back <b class="mono mint">{fig(back.back)}</b></span>
        ) : (
          <Tap on={() => nav.push('replies')} class="ow-b-today-line tap" label={`${t.foundSuppliers} of ${t.suppliers} suppliers found. Open Replies.`}>
            <span><b class="mono">{t.foundSuppliers}</b> of <b class="mono">{t.suppliers}</b> suppliers found ›</span>
          </Tap>
        )}
      </div>
    </header>
  );
}
