/*
 * D-22 Peter asks: fewer (DecideOrders p6): per line Agreed / Kept (Cement 50 kg 20 → 12 · −340,000);
 * the line on the order before and after; what the agent gets back of what was paid. Agreed · −340,000
 * (agent, a tap) · Kept (agent with nothing agreed). An ask to cancel agrees the whole order.
 */
import { money } from '../../../../core/money.ts';
import { agentChange, firstIn, lineBefore } from '../../../../core/manager/decide-orders.ts';
import type { AgentAsk } from '../../../../core/manager/types.ts';
import { ANSWER, askWord } from '../../../../core/manager/words.ts';
import { firstWord, orderNo } from '../../../../core/names.ts';
import { SplitBar } from '../../../../ui/Bar.tsx';
import type { Kind } from '../kit.ts';
import './after.css';

const HATCH = 'repeating-linear-gradient(135deg, #DCEBE3 0 4px, #EEF5F1 4px 8px)';

export const kind: Kind<AgentAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId)!;
  const picks = c.a.lines.map((l) => c.pick<boolean>(`ag:${l.idx}`, true));
  const agreed = c.a.lines.filter((_, i) => picks[i][0]).map((l) => l.idx);
  const ch = agentChange(o, c.a.lines, agreed, c.a.cancel);
  const who = c.asker ? firstWord(c.asker.name) : '';
  const holder = c.b.team.find((p) => p.id === o.holderId && p.role === 'buyer') || firstIn(c.b, 'buyer');
  const label = `${ANSWER.agreed} · −${money(ch.less)}`;
  const kept = () => c.tap(ANSWER.kept, 'agent', [o.id, [], false]);
  return {
    title: `${who} ${askWord('agent')}`.trim(),
    evidence: (
      <>
        {c.a.lines.map((l, i) => {
          const ln = o.lines[l.idx], [on, setOn] = picks[i];
          const fig = lineBefore(o, l, on);
          return (
            <div key={l.idx} class="mg-card">
              <div class="mg-af-ag">
                <span>
                  <b>{ln.name}</b>
                  <span class="mg-mono">{`${l.from} → `}<i>{l.to}</i>{` · −${money(Math.round((l.from - l.to) * (ln.price || 0)))}`}</span>
                </span>
                <span class="mg-af-seg" role="radiogroup" aria-label={`${ln.name}: agree or keep`}>
                  <button type="button" role="radio" aria-checked={on} onClick={() => setOn(true)}>{ANSWER.agreed}</button>
                  <button type="button" role="radio" aria-checked={!on} onClick={() => setOn(false)}>{ANSWER.kept}</button>
                </span>
              </div>
              <div class="mg-af-owes">
                <span>{`${firstWord(ln.name)} on ${orderNo(o.id)}`}</span>
                <span class="mg-mono">{fig.was !== fig.now && <><s>{money(fig.was)}</s>{' → '}</>}<b>{money(fig.now)}</b></span>
              </div>
              <SplitBar h={8} gap={0} parts={[{ value: fig.now, color: '#16203C' }, { value: fig.was - fig.now, color: HATCH }]} />
              {i === c.a.lines.length - 1 && o.paid > 0 && (
                <div class="mg-af-note">
                  <b>{`${who} gets back ${money(ch.back)}`}</b>
                  <span>{ch.back ? `${money(ch.stays)} paid stays on it · ${money(ch.total)} is the order` : `${money(o.paid)} paid stays on it · ${money(ch.total)} is more`}</span>
                </div>
              )}
            </div>
          );
        })}
      </>
    ),
    dock: {
      told: [c.asker ? c.asker.id : '', holder ? holder.id : ''],
      word: ANSWER.agreed,
      primary: { tap: { label, disabled: agreed.length || c.a.cancel ? undefined : 'Nothing agreed', on: () => c.tap(label, 'agent', [o.id, agreed, c.a.cancel]) } },
      secondary: { label: ANSWER.kept, on: kept },
    },
  };
};
