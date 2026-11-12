/*
 * D-33 A new item to price (DecidePrice "Default · D-33"): Moses listed an item with its cost;
 * the scale shows cost · +25% (the item's markup, the shop's by default) · the rivals' band
 * 34–36k. One answer: Markup 25% · 35,000 (the `markup` write); Moses sees Markup 25%.
 */
import { money } from '../../../../core/money.ts';
import { markupTicks, rivalsWord } from '../../../../core/manager/decide-money.ts';
import { pct, shopPriceOf } from '../../../../core/manager/price.ts';
import type { MarkupAsk } from '../../../../core/manager/types.ts';
import { ANSWER } from '../../../../core/manager/words.ts';
import type { Kind } from '../kit.ts';
import { PriceScale, ScaleCard, type Mark } from './pricecard.tsx';

export const kind: Kind<MarkupAsk> = (c) => {
  const a = c.a, price = shopPriceOf(a.cost, a.markup);
  const [lo, hi] = markupTicks(a.cost, a.markup);
  const word = `${ANSWER.markup} ${pct(a.markup)}`;
  const marks: Mark[] = [
    { v: a.cost, kind: 'cost', label: 'Cost', txt: money(a.cost), pos: 'down', align: 'left' },
    { v: lo, kind: 'tick' },
    { v: price, kind: 'shop', label: `+${pct(a.markup)}`, txt: money(price), pos: 'up', fill: 'navy' },
    { v: hi, kind: 'tick' },
  ];
  if (a.rivals) marks.push({ v: a.rivals[1], kind: 'ghost', label: 'Rivals', txt: rivalsWord(a.rivals), pos: 'down', align: 'right', tone: 'soft' });
  return {
    evidence: (
      <ScaleCard title={a.name}>
        <PriceScale cost={a.cost} marks={marks} band={a.rivals || undefined}
          label={`Cost ${money(a.cost)}, plus ${pct(a.markup)} is ${money(price)}${a.rivals ? `, rivals ${rivalsWord(a.rivals)}` : ''}`} />
      </ScaleCard>
    ),
    dock: {
      told: [a.askerId || ''],
      word,
      primary: { tap: { label: `${word} · ${money(price)}`, on: () => c.tap(`${word} · ${money(price)}`, 'markup', [a.productId, a.markup]) } },
    },
  };
};
