/*
 * D-7 Not paid yet · on credit? (MoneyCredit p3 = Today p2): the Store has packed an unpaid order
 * and the truck waits, so it heads the queue. The truck clock, would owe against the picked
 * limit chip, and who the customer is (Owes 0 · 1st order on credit · Cash customer). The dock:
 * the limit chips (the smallest that covers, picked), then On credit · load it · Cash first · it
 * stays. No chip: "Pick a limit to load it". Writes `storeCredit`.
 */
import { money } from '../../../../core/money.ts';
import { orderNo } from '../../../../core/names.ts';
import { limitChip, limitChoices, wouldOwe } from '../../../../core/manager/credit.ts';
import { creditFacts, gaugeMax, orderLeft, truckWait } from '../../../../core/manager/decide-money.ts';
import type { StoreCreditAsk } from '../../../../core/manager/types.ts';
import { ANSWER, creditChip } from '../../../../core/manager/words.ts';
import type { Kind } from '../kit.ts';
import { LimitChips, OweGauge, type GMark } from './owe.tsx';

const R = 22, CIRC = 2 * Math.PI * R;

export const kind: Kind<StoreCreditAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId);
  const cu = o && o.customerId ? c.b.customers.find((x) => x.id === o.customerId) : null;
  if (!o || !cu) return { evidence: <div class="mg-card">This order is gone</div>, dock: { told: [], word: '', primary: { tap: { label: '', disabled: 'This order is gone', on: () => undefined } } } };
  const need = wouldOwe(cu, o), left = orderLeft(o);
  const choices = limitChoices(need, cu.termsDays);
  const [on, setOn] = c.pick<number | null>('limit', 0);
  const pick = on != null ? choices[on] : null;
  const w = truckWait(c.a.at, c.now);
  const marks: GMark[] = pick ? [{ v: pick.limit, label: `${limitChip(pick.limit, pick.days).split(' · ')[0]} limit`, tone: 'good' }] : [];
  const yes = `${ANSWER.loadIt} · ${money(left)}`;
  const carrier = c.a.carrier || o.driver;
  return {
    chip: cu.limit ? null : { text: creditChip('nolimit', 0), tone: 'amber' },
    evidence: (
      <>
        <div class="mg-card mg-ow-truck">
          <span class="mg-ow-ring" role="img" aria-label={`The truck has waited ${w.mins} minutes`}>
            <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
              <circle cx="27" cy="27" r={R} fill="none" stroke="#F3DCC4" stroke-width="5" />
              <circle cx="27" cy="27" r={R} fill="none" stroke="#95530C" stroke-width="5" stroke-linecap="round" stroke-dasharray={`${(w.fill * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`} transform="rotate(-90 27 27)" />
            </svg>
            <span><b>{w.mins}</b><small>min</small></span>
          </span>
          <span class="t"><b>{carrier ? `Truck waits · ${carrier}` : 'Truck waits'}</b><span>{`${orderNo(o.id)} packed · not paid`}</span></span>
        </div>
        <OweGauge label="Would owe" parts={[...(cu.owes > 0 ? [{ v: cu.owes, k: 'Owes' }] : []), { v: left, k: orderNo(o.id), hatch: true }]}
          max={gaugeMax([need, pick && pick.limit])} marks={marks} legend={false}>
          <div class="mg-ow-chips">{creditFacts(cu).map((f) => <span key={f.text} class={'mg-pill' + (f.tone === 'good' ? ' good' : '')}>{f.text}</span>)}</div>
        </OweGauge>
      </>
    ),
    dock: {
      told: [c.a.askerId || '', o.sellerId || ''],
      word: ANSWER.loadIt,
      above: <LimitChips choices={choices} on={on} set={setOn} clear />,
      primary: { tap: { label: yes, disabled: pick ? undefined : 'Pick a limit to load it', on: () => c.tap(yes, 'storeCredit', [o.id, true, pick]) } },
      secondary: { label: ANSWER.itStays, on: () => c.tap(ANSWER.itStays, 'storeCredit', [o.id, false, null]) },
    },
  };
};
