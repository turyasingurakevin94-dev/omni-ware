/*
 * D-32 Credit asked · {customer} (MoneyCredit p4): Accounts asks for a limit. Would owe with the
 * order that waits, against the limit now and the one asked (both marked); at each, what is
 * over or left and whether the order goes; the oldest bill; the terms; the asker's words.
 * Limit 3,000,000 · 14 days · Cash only. Writes `limitAsk`.
 */
import { money } from '../../../../core/money.ts';
import { orderNo } from '../../../../core/names.ts';
import { dayOf } from '../../../../core/time.ts';
import { atLimit, limitChip, oldestDays } from '../../../../core/manager/credit.ts';
import { gaugeMax, orderLeft, termsWord } from '../../../../core/manager/decide-money.ts';
import type { LimitAsk } from '../../../../core/manager/types.ts';
import { ANSWER, STAGE } from '../../../../core/manager/words.ts';
import { Avatar } from '../../../../ui/Avatar.tsx';
import type { Kind } from '../kit.ts';
import { Facts, OweGauge, type GMark, type Part } from './owe.tsx';

const M = (v: number) => limitChip(v, 0).split(' · ')[0];

export const kind: Kind<LimitAsk> = (c) => {
  const a = c.a;
  const cu = c.b.customers.find((x) => x.id === a.customerId);
  if (!cu) return { evidence: <div class="mg-card">This customer is gone</div>, dock: { told: [], word: '', primary: { tap: { label: '', disabled: 'This customer is gone', on: () => undefined } } } };
  const o = a.orderId != null ? c.b.orders.find((x) => x.id === a.orderId) || null : null;
  const left = o ? orderLeft(o) : 0, owes = Math.max(0, cu.owes), need = owes + left;
  const parts: Part[] = [{ v: owes, k: `Owes · ${cu.orders} orders` }];
  if (o) parts.push({ v: left, k: `${orderNo(o.id)} ${STAGE[o.stage]}`, hatch: true });
  const marks: GMark[] = [];
  if (cu.limit) marks.push({ v: cu.limit, label: `now ${M(cu.limit)}`, tone: 'ink' });
  marks.push({ v: a.amount, label: `asked ${M(a.amount)}`, tone: 'good' });
  const room = (lim: number | null, when: string, good: boolean) => {
    const r = atLimit(need, lim);
    const goes = r.over === 0;
    return (
      <span class={good ? 'good' : ''}>
        <span>{`At ${lim ? M(lim) : '0'} · ${when}`}</span>
        <b>{goes ? `${money(r.left)} left` : `${money(r.over)} over`}</b>
        {o && <small>{`${orderNo(o.id)} ${goes ? 'goes' : 'waits'}`}</small>}
      </span>
    );
  };
  const word = `Limit ${money(a.amount)} · ${a.days} days`;
  const pick = { limit: a.amount, days: a.days };
  const asker = c.asker;
  return {
    title: `Credit asked · ${cu.name}`,
    evidence: (
      <>
        <OweGauge label={o ? `Would owe with ${orderNo(o.id)}` : 'Owes'} parts={parts} max={gaugeMax([need, cu.limit, a.amount])} marks={marks} />
        <div class="mg-card mg-ow-room">{room(cu.limit, 'now', false)}{room(a.amount, 'asked', true)}</div>
        <Facts rows={[
          { icon: 'clock', k: 'Oldest bill', v: cu.bills.length ? `${oldestDays(cu, dayOf(c.now))} d` : 'none' },
          { icon: 'calendar', k: 'Terms', v: termsWord(a.days, cu.termsDays) },
        ]} />
        {a.why && (
          <div class="mg-ow-quote">
            {asker && <Avatar initials={asker.initials} tint={asker.tint === 'me' ? 'n' : asker.tint} size={24} />}
            <span>{`“${a.why}”`}</span>
          </div>
        )}
      </>
    ),
    dock: {
      told: [a.askerId || '', cu.sellers[0] || ''].filter((x, i, xs) => xs.indexOf(x) === i),
      word,
      primary: { tap: { label: word, on: () => c.tap(word, 'limitAsk', [a.askId, true, pick]) } },
      secondary: { label: ANSWER.cashOnly, on: () => c.tap(ANSWER.cashOnly, 'limitAsk', [a.askId, false, null]) },
    },
  };
};

