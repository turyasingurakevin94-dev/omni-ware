/*
 * D-10 Can't bill itself · a line at 0 (DecideOrders p5): the line at 0, what it costs us (2 × 1,500
 * = 3,000), why it is free (Sample · Goodwill · Replacement · Other), and how the books carry it
 * (sells 0 · given away 3,000). Given away · Goodwill (givenAway, a tap) · Bill it (→ D-2: the line
 * goes back to be priced; the source has no write for that yet, so it waits).
 */
import { money } from '../../../../core/money.ts';
import { givenAtCost } from '../../../../core/manager/decide-orders.ts';
import type { GivenAsk } from '../../../../core/manager/types.ts';
import { ANSWER, GIVEN_WHY } from '../../../../core/manager/words.ts';
import { orderNo } from '../../../../core/names.ts';
import { SplitBar } from '../../../../ui/Bar.tsx';
import { Icon } from '../../../../ui/icons.tsx';
import type { Kind } from '../kit.ts';
import './after.css';

export const kind: Kind<GivenAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId)!;
  const [why, setWhy] = c.pick<string>('why', GIVEN_WHY[1]);
  const cost = givenAtCost(o, c.a.idxs);
  const word = `${ANSWER.givenAway} · ${why}`;
  return {
    evidence: (
      <>
        {c.a.idxs.map((i) => {
          const l = o.lines[i];
          return (
            <div class="mg-card" key={i}>
              <div class="mg-af-line">
                <span class="mg-af-gift" aria-hidden="true"><Icon name="tag" size={20} stroke={2} /></span>
                <b>{`${l.name} · ${l.qty} at 0`}</b>
                <span class="mg-mono mg-soft">{orderNo(o.id)}</span>
              </div>
              <div class="mg-af-row"><span class="lbl">At cost</span><span class="mg-mono">{`${l.qty} × ${money(l.cost || 0)} = ${money(Math.round((l.cost || 0) * l.qty))}`}</span></div>
              <div class="mg-af-why" role="radiogroup" aria-label="Why it is free">
                {GIVEN_WHY.map((w) => <button type="button" role="radio" key={w} aria-checked={why === w} onClick={() => setWhy(w)}>{w}</button>)}
              </div>
            </div>
          );
        })}
        <div class="mg-card">
          <div class="mg-af-row"><span>On the books</span><span class="mg-mono s">{`sells 0 · given away ${money(cost)}`}</span></div>
          <SplitBar h={8} gap={0} parts={[{ value: cost || 1, color: '#8D99B5' }]} />
        </div>
      </>
    ),
    dock: {
      told: [o.sellerId || ''],
      word,
      primary: { tap: { label: word, on: () => c.tap(word, 'givenAway', [o.id, c.a.idxs, why]) } },
      secondary: { label: ANSWER.billIt, disabled: 'not built yet', on: () => undefined },
    },
  };
};
