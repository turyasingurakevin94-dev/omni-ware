/*
 * D-20 Cancel asked (DecideOrders p2): the reason quote; where the order is (the stage dots, since
 * its stage time); Packed · Paid · Order; who stops. Nothing paid: Cancelled · #0556 is a tap (Undo 10).
 * Money paid: a slide, with Refund · Deposit picked first as for a void (D-19). Kept: a tap.
 */
import { money } from '../../../../core/money.ts';
import { AFTER_WORDS, packedOf, UI_STAGE, whoStops } from '../../../../core/manager/decide-orders.ts';
import type { CancelAsk } from '../../../../core/manager/types.ts';
import { ANSWER, hm } from '../../../../core/manager/words.ts';
import { firstWord, orderNo } from '../../../../core/names.ts';
import { Avatar } from '../../../../ui/Avatar.tsx';
import { StageDots } from '../../../../ui/Track.tsx';
import type { Kind } from '../kit.ts';
import { MoneyChips, moneyOf, type How } from './after.tsx';

export const kind: Kind<CancelAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId)!;
  const stops = whoStops(o, c.b.team);
  const [how, setHow] = c.pick<How>('how', null);
  const label = `${ANSWER.cancelled} · ${orderNo(o.id)}`;
  const asker = c.asker ? c.asker.id : o.sellerId || '';
  const told = [asker, ...stops.map((s) => s.id)].filter((v, i, all) => v && all.indexOf(v) === i);
  const keep = { label: ANSWER.kept, on: () => c.tap(ANSWER.kept, 'keepOrder', [c.a.askId, '']) };
  return {
    chip: o.paid > 0 ? { text: AFTER_WORDS.paid(money(o.paid)), tone: 'amber' } : { text: AFTER_WORDS.nothingPaid, tone: 'mint' },
    evidence: (
      <>
        {c.a.note && <div class="mg-quote">{c.a.note}</div>}
        <div class="mg-card">
          <div class="mg-card-h"><span>{`Where ${orderNo(o.id)} is`}</span><span class="mg-mono mg-soft">{`since ${hm(o.stageAt)}`}</span></div>
          <StageDots stage={UI_STAGE[o.stage]} />
          <div class="mg-af-tiles">
            <span><b>{packedOf(o)}</b><em>Packed</em></span>
            <span><b>{money(o.paid)}</b><em>Paid</em></span>
            <span><b>{money(o.total)}</b><em>Order</em></span>
          </div>
        </div>
        {stops.length > 0 && (
          <div class="mg-card">
            <div class="mg-card-h"><span>Who stops</span></div>
            {stops.map((s) => {
              const p = c.b.team.find((x) => x.id === s.id)!;
              return (
                <div class="mg-af-who" key={s.id}>
                  <Avatar initials={p.initials} tint={p.tint === 'me' ? 'n' : p.tint} size={28} />
                  <b>{firstWord(p.name)}</b>
                  <span class="mg-mono">{s.what}</span>
                </div>
              );
            })}
          </div>
        )}
      </>
    ),
    dock: o.paid > 0
      ? {
        told, word: ANSWER.cancelled,
        above: <MoneyChips paid={o.paid} how={how} onPick={setHow} />,
        primary: { slide: { label, disabled: how ? undefined : AFTER_WORDS.pickMoney, on: () => c.slide(label, 'cancel', [c.a.askId, o.id, moneyOf(how)]) } },
        secondary: keep,
      }
      : {
        told, word: ANSWER.cancelled,
        primary: { tap: { label, on: () => c.tap(label, 'cancel', [c.a.askId, o.id, null]) } },
        secondary: keep,
      },
  };
};
