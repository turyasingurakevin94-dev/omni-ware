/*
 * D-24 A carton for the shelf? (DecideStock p2): the carton bar (for the order · for the shelf),
 * how long the shelf part lasts at today's selling (a month a tick), and the two answer tiles.
 * Shelf part OK (a tap) buys the carton; Order only buys what the order needs.
 */
import { money } from '../../../../core/money.ts';
import { carton, units } from '../../../../core/manager/decide-stock.ts';
import type { CartonAsk } from '../../../../core/manager/types.ts';
import { ANSWER } from '../../../../core/manager/words.ts';
import { Icon } from '../../../../ui/icons.tsx';
import type { Kind } from '../kit.ts';
import './stock.css';

export const kind: Kind<CartonAsk> = (c) => {
  const a = c.a, k = carton(a, c.now);
  const ticks = Math.max(k.months + 1, 12);
  const ok = `${ANSWER.shelfOk} · ${money(k.shelf)}`, only = `${ANSWER.orderOnly} · ${money(k.order)}`;
  return {
    chip: { text: `${a.forOrder} for the order · ${a.forShelf} for the shelf`, tone: 'mint' },
    evidence: (
      <>
        <div class="mg-card">
          <div class="mg-card-h"><b class="mg-sk-h">The carton</b><span class="mg-mono mg-soft">{`${k.packs} ${units(k.packs, a.unit)}`}</span></div>
          <span class="mg-sk-cbar" role="img" aria-label={`${a.forOrder} ${units(a.forOrder, a.unit)} for the order, ${a.forShelf} for the shelf`}>
            <i style={{ width: `${Math.max(3, (a.forOrder / k.packs) * 100)}%` }} /><i class="shelf" />
          </span>
          <div class="mg-sk-ends">
            <span><span class="k"><i />For the order</span><b class="mg-mono">{a.forOrder}</b></span>
            <span class="r"><span class="k"><i class="g" />For the shelf</span><b class="mg-mono g">{a.forShelf}</b></span>
          </div>
          <hr class="mg-sk-hr" />
          <div class="mg-card-h"><b class="mg-sk-h13">Lasts</b><b class="mg-sk-h13">~<span class="mg-mono">{k.months}</span> months of selling</b></div>
          <span class="mg-sk-ticks" role="img" aria-label={`${a.forShelf} ${units(a.forShelf, a.unit)} last about ${k.months} months, to ${k.to}`}>
            {Array.from({ length: ticks }, (_, i) => <i key={i} class={i < k.months ? 'on' : ''} />)}
          </span>
          <div class="mg-sk-ends mg-mono mg-soft"><span>{k.from}</span><span>{k.to}</span></div>
        </div>
        <div class="mg-sk-two">
          <div class="mg-sk-out"><span class="h"><i class="good"><Icon name="shelf" size={15} stroke={2} /></i>{ANSWER.shelfOk}</span>
            <b class="mg-mono">{`${a.forShelf} · ${money(k.shelf)}`}</b><span class="s">{`carton ${money(k.whole)} · ${a.forOrder} for the order`}</span></div>
          <div class="mg-sk-out"><span class="h"><i><Icon name="orders" size={15} stroke={2} /></i>{ANSWER.orderOnly}</span>
            <b class="mg-mono">{`${a.forOrder} · ${money(k.order)}`}</b><span class="s">nothing on the shelf</span></div>
        </div>
      </>
    ),
    dock: {
      told: [a.askerId || ''],
      word: ANSWER.shelfOk,
      primary: { tap: { label: ok, on: () => c.tap(ok, 'carton', [a.restockId, true]) } },
      secondary: { label: only, on: () => c.tap(only, 'carton', [a.restockId, false]) },
    },
  };
};
