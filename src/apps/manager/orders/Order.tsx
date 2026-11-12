/*
 * One order (route `orders/order` { id }, Orders p2): the navy head (the customer, who sold it, #no,
 * the total, the five-stage track); "Waits on {Ruth}" with each decision answered in place (the same
 * write the Decide sheet makes: a price ask's safe answer, `price` with its word; any other ask opens
 * its Decide card); who is told; then the Lines, each with what the Buyer found.
 */
import type { JSX } from 'preact';
import { asksOn, safePrice } from '../../../core/manager/orders.ts';
import { lineShopPrice, scale } from '../../../core/manager/price.ts';
import { askerOf, placeOf } from '../../../core/manager/queue.ts';
import type { Ask, ManagerBooks, MLine, MOrder } from '../../../core/manager/types.ts';
import { askWord, hm, STAGES, STAGE, waited, whoSee } from '../../../core/manager/words.ts';
import { money } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { IconTile, type TileTone } from '../../../ui/ActRow.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import type { Params } from '../../../ui/stack.ts';
import { nav } from '../shell/nav.ts';
import { answer, books, now, waiting } from '../shell/store.ts';
import { H2, Told } from './Bits.tsx';
import './orders.css';

function Head(p: { o: MOrder; b: ManagerBooks }): JSX.Element {
  const { o, b } = p;
  const seller = b.team.find((x) => x.id === o.sellerId) || null;
  const at = STAGES.indexOf(o.stage);
  return (
    <header class="mg-orders-ohead">
      <div class="row">
        <button type="button" class="back" aria-label="Back to Orders" onClick={() => nav.back()}><Icon name="back" size={20} stroke={2.2} /></button>
        <div class="who">
          <span class="nm">{o.customerName}</span>
          <span class="from">
            {seller && <Avatar initials={seller.initials} tint={seller.tint} size={22} />}
            {seller ? `From ${firstWord(seller.name)} · ` : ''}<span class="mono">{orderNo(o.id)}</span>
          </span>
        </div>
      </div>
      <div class="tot"><span><span class="mono">{money(o.total)}</span><span class="u">UGX</span></span><span class="mono n">{`${o.lines.length} ${o.lines.length === 1 ? 'line' : 'lines'}`}</span></div>
      <div class="track" role="img" aria-label={`${STAGE[o.stage]}: step ${at + 1} of 5`}>
        <div class="segs">{STAGES.map((s, i) => <i key={s} class={i < at ? 'done' : i === at ? 'now' : ''} />)}</div>
        <div class="names">{STAGES.map((s, i) => <span key={s} class={i < at ? 'done' : i === at ? 'now' : ''}>{STAGE[s]}</span>)}</div>
      </div>
    </header>
  );
}

/** A price ask's scale: what it sells at, the cost, the shop's price on one bar; under cost shaded. */
function PriceScale(p: { l: MLine; sells: number | null; shop: number | null }): JSX.Element | null {
  const { l, sells, shop } = p;
  if (shop == null) return null;
  const at = scale([sells, l.cost, shop]);
  const costAt = l.cost != null ? at(l.cost) : null;
  return (
    <div class="mg-orders-scale" aria-hidden="true">
      <span class="rail" />
      {costAt != null && <span class="under" style={{ width: `${costAt}%` }} />}
      {sells != null && <span class="tk sells" style={{ left: `${at(sells)}%` }} />}
      {costAt != null && <span class="tk cost" style={{ left: `${costAt}%` }} />}
      <span class="knob" style={{ left: `calc(${at(shop)}% - 11px)` }} />
      {sells != null && <span class="lb mono" style={{ left: 0 }}>{`sells ${money(sells)}`}</span>}
      {l.cost != null && <span class="lb mono cost" style={{ left: `${Math.min(costAt || 0, 56)}%` }}>{`cost ${money(l.cost)}`}</span>}
      <span class="lb mono shop" style={{ right: 0 }}>{`shop's ${money(shop)}`}</span>
    </div>
  );
}

function WaitCard(p: { a: Ask; o: MOrder; b: ManagerBooks; q: Ask[]; t: number }): JSX.Element {
  const { a, o, b } = p;
  const asker = askerOf(b, a), place = placeOf(p.q, a.key);
  const safe = safePrice(b, a);
  const l = 'idx' in a && typeof a.idx === 'number' ? o.lines[a.idx] : null;
  const shop = l ? lineShopPrice(l, b.shop.defaultMarkup) : null;
  const sells = l ? (a.kind === 'price' && a.mode === 'under' ? a.asked : l.price) : null;
  const word = askWord(a.kind, a.kind === 'price' ? a.mode : a.kind === 'credit' ? a.why : undefined);
  const seller = b.team.find((x) => x.id === o.sellerId) || null;
  const told = [seller ? firstWord(seller.name) : '', asker && (!seller || asker.id !== seller.id) ? firstWord(asker.name) : ''].filter(Boolean);
  const open = () => nav.push('decide', { id: a.key });
  const go = () => {
    if (!safe || safe.price == null) return;
    const label = `${safe.say} · ${money(safe.price)}`;
    answer(a.key, `${label} · ${orderNo(o.id)}`, 'price', [o.id, a.kind === 'price' || a.kind === 'counter' ? a.idx : 0, safe.price, safe.word]);
  };
  const under = sells != null && l && l.cost != null && sells < l.cost ? l.cost - sells : null;
  return (
    <>
      <div class="mg-orders-wait">
        <div class="h">
          {asker && <Avatar initials={asker.initials} tint={asker.tint} size={36} font={13} />}
          <div class="mid">
            <span class="t">{asker ? `From ${firstWord(asker.name)} · ${word}` : word}</span>
            <span class="mono s">{`Asked ${hm(a.at)} · ${firstWord(b.me.name)} decides`}</span>
          </div>
          <span class="pills">
            {place && <span class="mg-orders-pill navy">{`${place.n} of ${place.of}`}</span>}
            <span class="mg-orders-pill warn">{waited(a.at, p.t)}</span>
          </span>
        </div>
        {l && safe && <PriceScale l={l} sells={sells} shop={shop} />}
        {l && under != null && <span class="mono mg-orders-red">{`${l.qty} ${l.unit} · under cost by ${money(under)}`}</span>}
        <div class="acts">
          {safe ? (
            <>
              <button type="button" class="mg-orders-btn out h44" onClick={open}>{safe.word === 'set' ? 'Open' : 'Price set'}</button>
              {safe.price != null
                ? <button type="button" class="mg-orders-btn navy h44 grow" onClick={go}><Icon name="check" size={16} stroke={2.4} />{`${safe.say} · ${money(safe.price)}`}</button>
                : <button type="button" class="mg-orders-btn off h44 grow" aria-disabled="true" onClick={open}><Icon name="lock" size={16} stroke={2} />Set price</button>}
            </>
          ) : <button type="button" class="mg-orders-btn navy h44 grow" onClick={open}><Icon name="chevron-right" size={16} stroke={2.2} />Open</button>}
        </div>
      </div>
      {told.length > 0 && safe && (
        <Told card face={seller || asker} who={whoSee(told)} word={safe.say} />
      )}
    </>
  );
}

const FOUND: Record<string, { tone: TileTone; icon: IconName; word: string }> = {
  found: { tone: 'good', icon: 'check', word: 'Found' },
  up: { tone: 'warn', icon: 'tag', word: 'Price up' },
  notfound: { tone: 'bad', icon: 'warning', word: 'Not found' },
  coming: { tone: 'warn', icon: 'clock', word: 'Price coming' },
};

function LineRow(p: { l: MLine; a: Ask | null }): JSX.Element {
  const { l } = p;
  const k = l.price == null ? 'coming' : l.buying;
  const f = k ? FOUND[k] : null;
  const was = p.a && p.a.kind === 'price' && p.a.mode === 'up' && p.a.costWas != null && l.cost != null ? `cost ${money(p.a.costWas)} → ${money(l.cost)}` : null;
  return (
    <div class="mg-orders-line-card">
      <IconTile tone={f ? f.tone : 'neutral'} icon={f ? f.icon : 'shelf'} size={38} iconSize={18} />
      <div class="mid">
        <span class="t">{l.name}</span>
        <span class="mono s">{l.price != null ? `${l.qty} ${l.unit} × ${money(l.price)} = ${money(Math.round(l.qty * l.price))}` : `${l.qty} ${l.unit}`}</span>
        <span class="mono s">{was || l.supplierName}</span>
      </div>
      {f && <span class={'mg-orders-pill ' + f.tone}>{f.word}</span>}
    </div>
  );
}

export function Order(p: { params: Params }): JSX.Element | null {
  const b = books.value;
  if (!b) return null;
  const o = b.orders.find((x) => x.id === Number(p.params.id));
  if (!o) return <main class="mg-orders"><div class="mg-orders-body"><button type="button" class="mg-orders-btn out h44" onClick={() => nav.back()}>Back</button></div></main>;
  const q = waiting.value, asks = asksOn(q, o.id);
  return (
    <main class="mg-orders">
      <Head o={o} b={b} />
      <div class="mg-orders-body">
        {asks.length > 0 && <H2 dot title={`Waits on ${firstWord(b.me.name)}`} count={asks.length} />}
        {asks.map((a) => <WaitCard key={a.key} a={a} o={o} b={b} q={q} t={now.value} />)}
        <H2 title="Lines" count={o.lines.length} />
        {o.lines.map((l) => <LineRow key={l.idx} l={l} a={asks.find((a) => a.kind === 'price' && a.idx === l.idx) || null} />)}
      </div>
    </main>
  );
}
