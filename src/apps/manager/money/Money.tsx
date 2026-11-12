/*
 * Money (route `money`, Money p1): In today (cash · mobile money) in the hero; To collect with the
 * age-band bar and the hold line; the oldest debtor as the navy lead card with Nudge on it (D-30);
 * the others as rows with their hold track and their promise. Offline: the waiting taps say
 * "Waits", In today keeps its time. Nobody owes: the bar folds away, In today stays.
 */
import type { JSX } from 'preact';
import { dayOf, dayLabel } from '../../../core/time.ts';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { chaseWords, dayChip, holdShare, inTodayTotal, isHeld, openPromise } from '../../../core/manager/money.ts';
import { BANDS, bands, debtors, type BandKey } from '../../../core/manager/watch.ts';
import type { Cust, ManagerBooks, Person } from '../../../core/manager/types.ts';
import { ANSWER, hm } from '../../../core/manager/words.ts';
import { Hero } from '../../../ui/Hero.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { SectionHead } from '../../../ui/SectionHead.tsx';
import { nav } from '../shell/nav.ts';
import { answer, books, kept, now, online } from '../shell/store.ts';
import { BAND_INK, Dot, Tile, Track, Waits, waitsRows } from './parts.tsx';
import './money.css';

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Nudge the one who sells there (D-30): "Ruth nudged you" + who owes, how much, how old. Undo 10. */
export function nudge(b: ManagerBooks, c: Cust, days: number): void {
  const who = b.team.find((x) => x.id === c.sellers[0]);
  if (!who) return;
  answer(null, `${ANSWER.nudged} ${firstWord(who.name)}`, 'nudge', [who.id, null, chaseWords(c, days, money)]);
}

export const sellerOf = (b: ManagerBooks, c: Cust): Person | null => b.team.find((x) => x.id === c.sellers[0]) || null;

function Bands(p: { b: Record<BandKey, number>; hold: number }): JSX.Element {
  const total = p.b.u7 + p.b.u21 + p.b.u30 + p.b.o30, at = pct(holdShare(p.b, p.hold));
  return (
    <div class="mg-mo-card mg-mo-bands" role="img" aria-label={BANDS.map((x) => `${x.label} ${money(p.b[x.key])}`).join(', ')}>
      <div class="mg-mo-bands-at"><span style={{ left: at }}>Held at <b class="mono">{`${p.hold} d`}</b></span></div>
      <div class="mg-mo-bands-bar">
        <div>{BANDS.map((x) => p.b[x.key] > 0 && <i key={x.key} style={{ width: pct(p.b[x.key] / total), background: BAND_INK[x.key] }} />)}</div>
        <i class="line" style={{ left: at }} />
      </div>
      <div class="mg-mo-bands-k">
        {BANDS.map((x) => (
          <span key={x.key}><span><i style={{ background: BAND_INK[x.key] }} />{x.label}</span><b class="mono">{money(p.b[x.key])}</b></span>
        ))}
      </div>
    </div>
  );
}

export function Money(): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const today = dayOf(now.value), hold = b.shop.holdDays;
  const ds = debtors(b, today), sum = ds.reduce((s, d) => s + d.c.owes, 0);
  const lead = ds[0] && ds[0].days > hold ? ds[0] : null, rest = lead ? ds.slice(1) : ds;
  const waits = waitsRows(b, kept.value), nWait = kept.value.filter((k) => k.state !== 'refused').length;
  const t = b.inToday, inT = inTodayTotal(t), seller = lead ? sellerOf(b, lead.c) : null;
  return (
    <main class="mg-mo-main">
      <Hero greeting="Money" line={dayLabel(now.value)} status={nWait ? 'waiting' : online.value ? 'live' : 'updating'} waiting={nWait} savedAt={hm(b.at)}
        me={{ initials: b.me.initials, tint: b.me.tint }} onMe={() => nav.push('shell/you', {})}>
        <div class="mg-mo-in">
          <span class="mg-mo-eye">IN TODAY ›</span>
          <span class="mg-mo-big mono">{money(inT)} <small>UGX</small></span>
          <div class="mg-mo-in-bar" aria-hidden="true">
            {t.cash > 0 && <i style={{ width: pct(t.cash / Math.max(1, inT)) }} />}
            {t.momo > 0 && <i class="momo" />}
            {t.bank > 0 && <i class="bank" style={{ flex: `0 0 ${pct(t.bank / Math.max(1, inT))}` }} />}
          </div>
          <div class="mg-mo-in-k">
            <span><i />Cash <b class="mono">{money(t.cash)}</b></span>
            <span><i class="momo" />Mobile money <b class="mono">{money(t.momo)}</b></span>
            {t.bank > 0 && <span><i class="bank" />Bank <b class="mono">{money(t.bank)}</b></span>}
          </div>
        </div>
      </Hero>
      <div class="mg-mo-body">
        <Waits rows={waits} />
        {!online.value && <span class="mg-mo-asof mono">{`In today as of ${hm(b.at)} · ${money(inT)}`}</span>}
        {ds.length ? (
          <>
            <SectionHead title="To collect" meta={`${money(sum)} · ${ds.length}`} />
            <Bands b={bands(b, today)} hold={hold} />
            {lead && (
              <div class="mg-mo-lead">
                <button type="button" class="mg-mo-lead-top" aria-label={`${lead.c.name}, owes ${money(lead.c.owes)}`} onClick={() => nav.push('money/debtor', { customer: lead.c.id })}>
                  <Tile c={lead.c} size={38} navy />
                  <span class="n"><b>{lead.c.name}</b><span class="mono">{`oldest ${oldestDay(lead.c)} · ${lead.days} d`}</span></span>
                  <b class="mono f">{money(lead.c.owes)}</b>
                </button>
                <div class="mg-mo-lead-r">
                  <Track days={lead.days} hold={hold} band={lead.band} w={84} navy />
                  {isHeld(lead.days, hold) && <span class="mg-mo-chip held">Held</span>}
                  <span class="sp" />
                  {seller && (
                    <button type="button" class="mg-mo-nudge" aria-label={`Nudge ${firstWord(seller.name)} about ${lead.c.name}`} onClick={() => nudge(b, lead.c, lead.days)}>
                      <Dot who={seller} />{`Nudge ${firstWord(seller.name)}`}
                    </button>
                  )}
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <div class="mg-mo-list">
                {rest.map((d) => {
                  const pr = openPromise(d.c, today);
                  return (
                    <button type="button" key={d.c.id} class="mg-mo-row" aria-label={`${d.c.name}, owes ${money(d.c.owes)}`} onClick={() => nav.push('money/debtor', { customer: d.c.id })}>
                      <Tile c={d.c} size={36} />
                      <span class="n">
                        <b>{d.c.name}</b>
                        <span class="s">
                          <Track days={d.days} hold={hold} band={d.band} w={48} />
                          <span class="mono d">{`${d.days} d`}</span>
                          {pr && <span class="pr"><Icon name="calendar" size={12} stroke={2.2} />Promised <b class="mono">{dayChip(pr.on)}</b></span>}
                        </span>
                      </span>
                      <b class="mono f">{money(d.c.owes)}</b>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div class="mg-mo-none-h"><span><i />Who owes</span><b class="mono">0</b></div>
            <div class="mg-mo-none"><Icon name="check" size={18} stroke={2.4} />Nobody owes</div>
          </>
        )}
      </div>
    </main>
  );
}

/** "9 Sep": the day of their oldest unpaid bill. */
export function oldestDay(c: Cust): string {
  const open = c.bills.find((x) => x.left > 0);
  return open ? dayLabel(open.day).split(' ').slice(1).join(' ') : '';
}
