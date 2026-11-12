/*
 * D-1 Under the shop's price · D-2 Price coming · D-3 Price up (DecidePrice p1, p4, p3); the
 * mode is on the ask. The evidence is the line and the price scale (cost · the asker · the
 * shop's), the rung "Price set · another price" opens the keypad (never under cost). D-2 with
 * no known cost: "Cost ?" (type it) · Ask Denis, and Price set waits.
 */
import { money } from '../../../../core/money.ts';
import { firstWord } from '../../../../core/names.ts';
import { lineAt, markupTicks, oneUnit } from '../../../../core/manager/decide-money.ts';
import { lineShopPrice, markupOf, pct, priceOutcome, sameGain, shopPriceOf, underCost } from '../../../../core/manager/price.ts';
import type { CounterAsk, MLine, MOrder, Person, PriceAsk, UGX } from '../../../../core/manager/types.ts';
import { ANSWER } from '../../../../core/manager/words.ts';
import { TINTS } from '../../../../core/names.ts';
import type { Ctx, Dock, Kind, KindView } from '../kit.ts';
import { ItemCard, openPad, PriceScale, Rung, ScaleCard, signed, type Fact, type Mark } from './pricecard.tsx';

type C = Ctx<PriceAsk>;

/** Who is told of a price: the order's salesperson, then whoever asked. */
export function priceTold(o: MOrder, askerId: string | null): string[] {
  return [o.sellerId, askerId].filter((x, i, xs): x is string => !!x && xs.indexOf(x) === i);
}

/** The line's sub: the customer, and whose order it is when someone else asked ("Mukono Roofing · Faith's"). */
export function lineSub(b: Ctx['b'], o: MOrder, askerId: string | null): string {
  const s = o.sellerId && o.sellerId !== askerId ? b.team.find((p) => p.id === o.sellerId) : null;
  return s ? `${o.customerName} · ${firstWord(s.name)}'s` : o.customerName;
}

/** The answer "Price set · X" through the keypad: X at or above the floor. */
function setPrice(c: C, o: MOrder, l: MLine, floor: UGX | null, shop: UGX | null, was: UGX | null, costTyped: UGX | null): () => void {
  return () => openPad({
    o, l, what: 'price', floor, shop, was,
    onUse: (v) => c.tap(`${ANSWER.priceSet} · ${money(v)}`, costTyped != null ? 'costAndPrice' : 'price',
      costTyped != null ? [o.id, l.idx, costTyped, v] : [o.id, l.idx, v, 'set']),
  });
}

function totalOf(l: MLine, price: UGX): Dock['total'] {
  const x = lineAt(l, price);
  return { v: x.total, sub: x.gain != null ? `gain ${money(x.gain)}` : undefined };
}

/* ---- D-1 Under the shop's price (and D-4 at the counter, counter.tsx: no rung, its own line sub) ---- */
export function under(c: Ctx<PriceAsk | CounterAsk>, o: MOrder, l: MLine, shop: UGX | null, counter?: { sub: string }): KindView {
  const asked = c.a.asked ?? l.price ?? 0, cost = l.cost;
  const out = priceOutcome(asked, cost, shop, l.qty);
  const who = c.asker;
  const marks: Mark[] = [];
  if (cost != null) marks.push({ v: cost, kind: 'cost', label: 'Cost', txt: money(cost), pos: 'down', align: 'left' });
  marks.push({ v: asked, kind: 'their', label: who ? firstWord(who.name) : 'Asked', txt: money(asked), pos: 'up', fill: 'navy', tint: who && who.tint !== 'me' ? who.tint : 'n' });
  if (shop != null) marks.push({ v: shop, kind: 'shop', label: 'Shop\'s', txt: money(shop), pos: 'down', align: 'right' });
  const facts: Fact[] = [
    { k: `Gain a ${l.unit}`, v: out.gain != null ? money(out.gain) : '?', tone: 'good' },
    { k: 'Under the shop\'s', v: out.underShop != null ? signed(out.underShop) : '?', tone: 'warn' },
    { k: `On ${l.qty} ${l.unit}`, v: out.underShopTotal != null ? signed(out.underShopTotal) : '?', tone: 'warn' },
  ];
  const bad = underCost(asked, cost);
  return {
    evidence: (
      <>
        <ItemCard l={l} price={asked} sub={counter ? counter.sub : lineSub(c.b, o, c.a.askerId)} />
        {cost != null && (
          <ScaleCard title={oneUnit(l.unit)} unit={l.unit} facts={facts}>
            <PriceScale cost={cost} marks={marks} zone label={`Cost ${money(cost)}, ${who ? firstWord(who.name) : 'asked'} ${money(asked)}, the shop's ${money(shop)}`} />
          </ScaleCard>
        )}
        {!counter && <Rung floor={cost} on={setPrice(c as C, o, l, cost, shop, out.total, null)} />}
      </>
    ),
    dock: {
      told: priceTold(o, c.a.askerId),
      word: ANSWER.approved,
      total: totalOf(l, asked),
      primary: { tap: { label: `${ANSWER.approved} · ${money(asked)}`, disabled: bad && cost != null ? `Under ${money(cost)} · never under cost` : undefined, on: () => c.tap(`${ANSWER.approved} · ${money(asked)}`, 'price', [o.id, l.idx, asked, 'approved']) } },
      secondary: shop != null ? { label: `${ANSWER.shopsPrice} · ${money(shop)}`, on: () => c.tap(`${ANSWER.shopsPrice} · ${money(shop)}`, 'price', [o.id, l.idx, shop, 'shop']) } : null,
    },
  };
}

/* ---- D-3 Price up ---- */
function up(c: C, o: MOrder, l: MLine, shop: UGX | null): KindView {
  const cost = l.cost, sells = l.price, was = c.a.costWas;
  const same = cost != null ? sameGain(was, sells, cost) : null;
  const marks: Mark[] = [];
  if (was != null) marks.push({ v: was, kind: 'ghost' });
  if (sells != null) marks.push({ v: sells, kind: 'bad', label: 'Sells', txt: money(sells), pos: 'up', align: 'right', tone: 'bad' });
  if (cost != null) marks.push({ v: cost, kind: 'cost', label: 'Cost', txt: money(cost), pos: 'down', align: 'right' });
  if (same != null && same !== shop) marks.push({ v: same, kind: 'tick', label: 'Same gain', txt: money(same), pos: 'up', align: 'left' });
  if (shop != null) marks.push({ v: shop, kind: 'shop', label: 'Shop\'s', txt: money(shop), pos: 'down', align: 'right', fill: 'grey' });
  const cust = firstWord(o.customerName);
  const facts: Fact[] = [
    { k: 'Sells now', v: sells != null ? money(sells) : '?', tone: sells != null && underCost(sells, cost) ? 'bad' : undefined },
    { k: 'Cost now', v: cost != null ? money(cost) : '?' },
    { k: `${cust} pays`, v: shop != null && sells != null ? signed(Math.round((shop - sells) * l.qty)) : '?', tone: 'warn' },
  ];
  // D-3's two chips: what the cost did, and how far under it the sale now is.
  const chips = [
    ...(was != null && cost != null ? [{ text: `Cost ${money(was)} → ${money(cost)}`, tone: 'mint' as const }] : []),
    ...(sells != null && cost != null && sells < cost ? [{ text: `${signed(sells - cost)} under cost`, tone: 'amber' as const }] : []),
  ];
  const second = same != null && same !== shop && !underCost(same, cost) ? same : null;
  return {
    chips,
    evidence: (
      <>
        <ItemCard l={l} price={shop} sub={lineSub(c.b, o, c.a.askerId)} />
        {cost != null && (
          <ScaleCard title={oneUnit(l.unit)} unit={l.unit} facts={facts}>
            <PriceScale cost={cost} marks={marks} label={`Cost ${money(was)} now ${money(cost)}, sells ${money(sells)}, the shop's ${money(shop)}`} />
          </ScaleCard>
        )}
        <Rung floor={cost} on={setPrice(c, o, l, cost, shop, sells != null ? Math.round(sells * l.qty) : null, null)} />
      </>
    ),
    dock: {
      told: priceTold(o, c.a.askerId),
      word: ANSWER.shopsPrice,
      total: shop != null ? totalOf(l, shop) : null,
      primary: shop != null
        ? { tap: { label: `${ANSWER.shopsPrice} · ${money(shop)}`, on: () => c.tap(`${ANSWER.shopsPrice} · ${money(shop)}`, 'price', [o.id, l.idx, shop, 'shop']) } }
        : { tap: { label: ANSWER.priceSet, on: setPrice(c, o, l, cost, shop, null, null) } },
      secondary: second != null ? { label: `${ANSWER.priceSet} · ${money(second)}`, on: () => c.tap(`${ANSWER.priceSet} · ${money(second)}`, 'price', [o.id, l.idx, second, 'set']) } : null,
    },
  };
}

/** The buyer who brings the cost: the one holding the order, else the shop's buyer. */
function buyerOf(b: C['b'], o: MOrder): Person | null {
  const h = o.holderId ? b.team.find((p) => p.id === o.holderId && p.role === 'buyer') : null;
  return h || b.team.find((p) => p.role === 'buyer') || null;
}

/* ---- D-2 Price coming ---- */
function coming(c: C, o: MOrder, l: MLine): KindView {
  const [typed, setTyped] = c.pick<UGX | null>('cost', null);
  const cost = l.cost ?? typed;
  const buyer = buyerOf(c.b, o);
  const bname = buyer ? firstWord(buyer.name) : 'the buyer';
  const told = priceTold(o, c.a.askerId);
  if (cost == null) {
    const tint = buyer ? TINTS[buyer.tint] : TINTS.t3;
    return {
      evidence: (
        <>
          <ItemCard l={l} price={null} sub={lineSub(c.b, o, c.a.askerId)} />
          <div class="mg-pc-nocost">
            <button type="button" class="cost" aria-label={`Type the cost of ${l.name}`}
              onClick={() => openPad({ o, l, what: 'cost', floor: null, shop: null, was: null, onUse: setTyped })}>
              <span>Cost</span><b class="mg-mono">?</b>
            </button>
            <button type="button" class="ask" aria-label={`Ask ${bname} for the cost`} onClick={() => c.tap(`Asked ${bname}`, 'askCost', [o.id, l.idx])}>
              <i style={{ background: tint.bg, boxShadow: `inset 0 0 0 2px ${tint.fg}` }} />{`Ask ${bname}`}
            </button>
          </div>
        </>
      ),
      dock: { told, word: ANSWER.priceSet, primary: { tap: { label: ANSWER.priceSet, disabled: `Cost ? · Ask ${bname}`, on: () => undefined } } },
    };
  }
  const markup = markupOf(l, c.b.shop.defaultMarkup);
  const price = l.cost != null ? (lineShopPrice(l, c.b.shop.defaultMarkup) ?? shopPriceOf(cost, markup)) : shopPriceOf(cost, markup);
  const out = priceOutcome(price, cost, null, l.qty);
  const [lo, hi] = markupTicks(cost, markup);
  const marks: Mark[] = [
    { v: cost, kind: 'cost', label: 'Cost', txt: money(cost), pos: 'down', align: 'left' },
    { v: lo, kind: 'tick' },
    { v: price, kind: 'shop', label: `+${pct(markup)}`, txt: money(price), pos: 'up', fill: 'navy' },
    { v: hi, kind: 'tick' },
  ];
  const facts: Fact[] = [
    { k: `Gain a ${l.unit}`, v: money(out.gain), tone: 'good' },
    { k: 'Markup', v: pct(markup) },
    { k: `On ${l.qty} ${l.unit}`, v: signed(out.gainTotal || 0), tone: 'good' },
  ];
  const typedCost = l.cost == null ? cost : null;
  const args = typedCost != null ? [o.id, l.idx, typedCost, price] : [o.id, l.idx, price, 'set'];
  const from = [buyer && l.cost != null ? `Cost from ${bname}` : 'Cost', l.supplierId && l.supplierId !== '__stock__' ? firstWord(l.supplierName) : ''].filter(Boolean).join(' · ');
  return {
    chip: { text: `${from} ${money(cost)}`, tone: 'mint' },
    evidence: (
      <>
        <ItemCard l={l} price={price} sub={lineSub(c.b, o, c.a.askerId)} />
        <ScaleCard title={oneUnit(l.unit)} unit={l.unit} facts={facts}>
          <PriceScale cost={cost} marks={marks} zone label={`Cost ${money(cost)}, plus ${pct(markup)} is ${money(price)}`} />
        </ScaleCard>
        <Rung floor={cost} on={setPrice(c, o, l, cost, price, null, typedCost)} />
      </>
    ),
    dock: {
      told,
      word: ANSWER.priceSet,
      total: totalOf({ ...l, cost }, price),
      primary: { tap: { label: `${ANSWER.priceSet} · ${money(price)}`, on: () => c.tap(`${ANSWER.priceSet} · ${money(price)}`, typedCost != null ? 'costAndPrice' : 'price', args) } },
    },
  };
}

export const kind: Kind<PriceAsk> = (c) => {
  const o = c.b.orders.find((x) => x.id === c.a.orderId);
  const l = o ? o.lines[c.a.idx] : null;
  if (!o || !l) return { evidence: <div class="mg-card">This line is gone</div>, dock: { told: [], word: '', primary: { tap: { label: '', disabled: 'This line is gone', on: () => undefined } } } };
  const shop = lineShopPrice(l, c.b.shop.defaultMarkup);
  if (c.a.mode === 'up') return up(c, o, l, shop);
  if (c.a.mode === 'coming') return coming(c, o, l);
  return under(c, o, l, shop);
};
