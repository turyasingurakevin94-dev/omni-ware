/*
 * D-5 On credit? · held (MoneyCredit p1) and D-6 On credit? · No limit set (p2). Would owe =
 * what they owe + this order (navy + hatch). D-5: the oldest bill against "held from 21 d",
 * the promises, the bills. D-6: the gauge against the picked limit chip, the facts, and the
 * limit chips row in the dock (credit.ts limitChoices). Writes `credit`.
 */
import type { JSX } from 'preact';
import { money } from '../../../../core/money.ts';
import { orderNo } from '../../../../core/names.ts';
import { dayLabel, dayOf, daysApart } from '../../../../core/time.ts';
import { creditWhy, limitChip, limitChoices, oldestDays, wouldOwe } from '../../../../core/manager/credit.ts';
import { gaugeMax, holdTrack, orderLeft, promiseCounts } from '../../../../core/manager/decide-money.ts';
import type { CreditAsk, Cust, MOrder } from '../../../../core/manager/types.ts';
import { ANSWER, creditChip } from '../../../../core/manager/words.ts';
import { Icon } from '../../../../ui/icons.tsx';
import type { Ctx, Kind, KindView } from '../kit.ts';
import { Facts, LimitChips, OweGauge, type GMark } from './owe.tsx';

const gone: KindView = { evidence: <div class="mg-card">This order is gone</div>, dock: { told: [], word: '', primary: { tap: { label: '', disabled: 'This order is gone', on: () => undefined } } } };

/** D-5: the oldest bill on the hold track, the promises, the open bills. */
function held(c: Ctx<CreditAsk>, cu: Cust, today: string): JSX.Element {
  const open = cu.bills.filter((b) => b.left > 0);
  const ages = open.map((b) => daysApart(b.day, today));
  const old = Math.max(0, ...ages), hold = c.b.shop.holdDays;
  const t = holdTrack(ages, hold);
  const end = (Math.min(old, t.max) / t.max) * 100;
  const pr = promiseCounts(cu.promises);
  return (
    <>
      <div class="mg-card">
        <div class="mg-card-h"><span>Oldest bill</span><b class="mg-big">{`${old} d`}</b></div>
        <div class="mg-ow-hold" role="img" aria-label={`Oldest bill ${old} days, held from ${hold} days`}>
          <div class="tr">
            <i class="in" style={{ width: `${t.hold}%` }} />
            {old > hold && <i class="past" style={{ left: `${t.hold}%`, width: `${end - t.hold}%` }} />}
          </div>
          <i class="line" style={{ left: `${t.hold}%` }} />
          {t.dots.map((d, i) => <i key={i} class="dot" style={{ left: `${d}%` }} />)}
          <span class="lb mid" style={{ left: `${t.hold}%` }}>{`held from ${hold} d`}</span>
          {open[0] && <span class="lb end">{dayLabel(open[0].day).split(' ').slice(1).join(' ')}</span>}
        </div>
        {(pr.kept > 0 || pr.broken > 0) && (
          <div class="mg-ow-prom"><span>Promises</span>
            {pr.kept > 0 && <span class="mg-pill good">{`${pr.kept} kept`}</span>}
            {pr.broken > 0 && <span class="mg-pill warn">{`${pr.broken} broken`}</span>}
          </div>
        )}
      </div>
      {open.length > 0 && (
        <div class="mg-card mg-ow-bills">
          {open.map((b, i) => (
            <div key={b.orderId + ':' + i}>
              <span class="i"><Icon name="receipt" size={15} stroke={2} /></span>
              <span class="t"><b>{dayLabel(b.day)}</b><span>{`${i === 0 ? 'oldest bill' : 'bill'} · ${daysApart(b.day, today)} d`}</span></span>
              <b>{money(b.left)}</b>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export const kind: Kind<CreditAsk> = (c) => {
  const o: MOrder | undefined = c.b.orders.find((x) => x.id === c.a.orderId);
  const cu = o && o.customerId ? c.b.customers.find((x) => x.id === o.customerId) : null;
  if (!o || !cu) return gone;
  const today = dayOf(c.now);
  const why = creditWhy(cu, o, today, c.b.shop.holdDays) || c.a.why;
  const need = wouldOwe(cu, o), left = orderLeft(o), no = orderNo(o.id);
  const told = [c.a.askerId || o.sellerId || ''];
  const chip = { text: creditChip(why, oldestDays(cu, today)), tone: 'amber' as const };
  const yes = `${ANSWER.onCredit} · ${money(left)}`;
  const parts = [{ v: Math.max(0, cu.owes), k: 'Owes' }, { v: left, k: no, hatch: true }];

  if (why === 'nolimit') {
    // D-6: pick a limit, then On credit.
    const choices = limitChoices(need, cu.termsDays);
    const [on, setOn] = c.pick<number | null>('limit', 0);
    const pick = on != null ? choices[on] : null;
    const marks: GMark[] = pick ? [{ v: pick.limit, label: `${limitChip(pick.limit, pick.days).split(' · ')[0]} limit`, tone: 'good' }] : [];
    const oldest = oldestDays(cu, today);
    return {
      chip,
      evidence: (
        <>
          <OweGauge label="Would owe" parts={parts} max={gaugeMax([need, pick && pick.limit])} marks={marks} />
          <Facts rows={[
            { icon: 'clock', k: 'Oldest bill', v: cu.bills.length ? `${oldest} d` : 'none' },
            { icon: 'receipt', k: `${no} · ${o.lines.length} ${o.lines.length === 1 ? 'line' : 'lines'}`, v: money(left) },
            { icon: 'lock', k: 'Limit', v: cu.limit ? money(cu.limit) : 'none' },
          ]} />
        </>
      ),
      dock: {
        told, word: ANSWER.onCredit,
        above: <LimitChips choices={choices} on={on} set={setOn} clear />,
        primary: { tap: { label: yes, disabled: pick ? undefined : 'Pick a limit', on: () => c.tap(yes, 'credit', [o.id, true, pick]) } },
        secondary: { label: ANSWER.cashFirst, on: () => c.tap(ANSWER.cashFirst, 'credit', [o.id, false, null]) },
      },
    };
  }

  // D-5: over the limit, or an old bill.
  const marks: GMark[] = why === 'limit' && cu.limit ? [{ v: cu.limit, label: `${limitChip(cu.limit, cu.termsDays || 0).split(' · ')[0]} limit`, tone: 'ink' }] : [];
  return {
    chip,
    evidence: (
      <>
        <OweGauge label="Would owe" parts={parts} max={marks.length ? gaugeMax([need, cu.limit]) : need} marks={marks} />
        {held(c, cu, today)}
      </>
    ),
    dock: {
      told, word: ANSWER.onCredit,
      primary: { tap: { label: yes, on: () => c.tap(yes, 'credit', [o.id, true, null]) } },
      secondary: { label: ANSWER.cashFirst, on: () => c.tap(ANSWER.cashFirst, 'credit', [o.id, false, null]) },
    },
  };
};
