/*
 * D-18 Return asked (DecideOrders p3): the reason quote; each line coming back with a stepper and
 * its credit (5 × 11,250 = −56,250); Back on the shelf · Off what they owe, and Change (back or
 * damaged; cash back only when money was paid on it); what the customer owes before and after.
 * Slide Credit note raised · 56,250 (creditNote) · Kept as sold (a tap).
 */
import { money } from '../../../../core/money.ts';
import { firstIn, returnAmount, returnMoney } from '../../../../core/manager/decide-orders.ts';
import { AFTER_WORDS } from '../../../../core/manager/words.ts';
import type { ReturnAsk } from '../../../../core/manager/types.ts';
import { ANSWER } from '../../../../core/manager/words.ts';
import { Stepper } from '../../../../ui/Stepper.tsx';
import type { Kind } from '../kit.ts';
import { OwesBar } from './after.tsx';

export const kind: Kind<ReturnAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId)!;
  const cust = c.b.customers.find((x) => x.id === o.customerId) || null;
  const qtys = c.a.lines.map((l) => c.pick<number>(`qty:${l.idx}`, l.qty));
  const lines = c.a.lines.map((l, i) => ({ idx: l.idx, qty: qtys[i][0] }));
  const [back, setBack] = c.pick<boolean>('back', true);
  const [cashBack, setCash] = c.pick<boolean>('cash', false);
  const amount = returnAmount(o, lines);
  const owes = cust ? cust.owes : 0;
  const m = returnMoney(owes, amount, o.paid, cashBack);
  // Change walks the choices: back → damaged, then (money paid) the same two with cash back.
  const change = () => {
    if (back) { setBack(false); return; }
    setBack(true);
    if (o.paid > 0) setCash(!cashBack);
  };
  const label = `${ANSWER.creditNote} · ${money(amount)}`;
  const acc = firstIn(c.b, 'accounts');
  return {
    evidence: (
      <>
        {c.a.note && <div class="mg-quote">{c.a.note}</div>}
        <div class="mg-card">
          {c.a.lines.map((l, i) => {
            const ln = o.lines[l.idx], [q, setQ] = qtys[i];
            return (
              <div key={l.idx} class="mg-af-line-wrap">
                <div class="mg-card-h"><b class="mg-af-name">{ln.name}</b><span class="mg-mono mg-soft">{`${money(ln.price || 0)} a ${ln.unit}`}</span></div>
                <div class="mg-af-step">
                  <Stepper value={q} unit="" min={1} max={ln.qty} what={ln.name} onChange={setQ} />
                  <span class="mg-af-credit">
                    <span class="mg-mono mg-soft">{`${q} × ${money(ln.price || 0)}`}</span>
                    <b>{`−${money(Math.round(q * (ln.price || 0)))}`}</b>
                  </span>
                </div>
              </div>
            );
          })}
          <div class="mg-af-how">
            <span>{back ? AFTER_WORDS.backOnShelf : AFTER_WORDS.damaged}<i>{cashBack ? `${AFTER_WORDS.cashBack} ${money(m.cash)}` : AFTER_WORDS.offOwes}</i></span>
            <button type="button" class="mg-af-link" onClick={change}>Change</button>
          </div>
        </div>
        {cust && <OwesBar who={`${cust.name} owes`} was={owes} now={m.owesAfter} />}
      </>
    ),
    dock: {
      told: [c.asker ? c.asker.id : o.sellerId || '', acc ? acc.id : ''],
      word: ANSWER.creditNote,
      primary: { slide: { label, on: () => c.slide(label, 'creditNote', [c.a.askId, o.id, lines.map((l) => ({ ...l, back })), cashBack]) } },
      secondary: { label: ANSWER.keptSold, on: () => c.tap(ANSWER.keptSold, 'keepSold', [c.a.askId]) },
    },
  };
};
