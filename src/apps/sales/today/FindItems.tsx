/*
 * Find, when the words are an item (TD13) or nothing at all (TD14).
 */
import { counted, sayItem } from '../../../core/names.ts';
import { NoneMark } from '../../../ui/Empty.tsx';
import { nearAisles } from '../../../core/aisles.ts';
import { oftenWith as often } from '../../../core/often.ts';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { capWord as cap, sellsByPack } from '../../../core/units.ts';
import type { Books, Item, Ms } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Duo, Icon, phLink } from '../../../ui/icons.tsx';
import { Tap } from '../../../ui/util.tsx';
import { drafts } from '../shell/store.ts';
import { openAsk } from './AskNew.tsx';
import { Marked, shelf, unitWord } from './Find.tsx';
import { go, itemsParam } from './go.ts';
import { isPriced, PRICE_COMING } from '../../../ui/Money.tsx';

/** The order being built most lately (the red +'s), to add to. */
function openDraft() {
  return drafts.value.slice().sort((x, y) => y.at - x.at)[0] || null;
}
function addTo(itemId: string): void {
  const d = openDraft();
  const items = itemsParam(itemId);
  if (d) go('sell/order', d.chatId != null ? { customer: d.customerId, from: 'chat', chat: d.chatId, items } : { customer: d.customerId, items });
  else go('sell', { items });
}

/** The ids of what is bought with this item most (the two "Often with" shows). */
export function oftenIds(b: Books, it: Item): string[] {
  return oftenWith(b, it).map((x) => x.item.id);
}

/** Items bought with this one in the shop's orders (core/often.ts, P13's rule over the whole shop): how many of its orders had each. */
function oftenWith(b: Books, it: Item): { item: Item; had: number; of: number }[] {
  const r = often(b.orders, { itemId: it.id, variantIdx: it.variantIdx ?? null }, { customerId: null, me: null, n: 2 });
  return r.rows.map((x) => ({ item: b.items.find((i) => i.id === x.itemId && (i.variantIdx ?? null) === x.variantIdx) || b.items.find((i) => i.id === x.itemId) as Item, had: x.n, of: r.of })).filter((x) => x.item);
}

function AskCard(p: { b: Books; title: string; name: string }): JSX.Element {
  const ml = p.b.members.find((m) => m.role === 'sourcing');
  return (
    <Tap on={() => openAsk({ name: p.name })} class="td-askme">
      <span aria-hidden="true" class="td-askme-av">{ml && <Avatar initials={ml.initials} tint={ml.tint} size={30} font={11} />}</span>
      <span class="td-askme-t"><span>{p.title}</span><span>{`${ml ? ml.name.split(' ')[0] : 'Sourcing'} gets it in`}</span></span>
      <span class="td-askme-b">Ask</span>
    </Tap>
  );
}

export function ItemFound(p: { b: Books; q: string; items: Item[] }): JSX.Element {
  const b = p.b, [openId, setOpen] = useState(p.items[0].id), it = p.items.find((i) => i.id === openId) || p.items[0];
  const rest = p.items.filter((i) => i !== it), often = oftenWith(b, it), d = openDraft(), dc = d && d.customerId ? b.customers.find((c) => c.id === d.customerId) : null;
  const word = p.q.trim().toLowerCase(), u = unitWord(it.unit), pack = sellsByPack(it);
  return (
    <>
      <div class="td-item-open">
        <div class="td-item-h">
          <ItemSquare aisle={it.aisle} size={44} icon={26} />
          <span class="td-find-t"><span class="big"><Marked text={it.name} q={p.q.trim()} /></span>
            <span>{it.onShelf && it.onShelf > 0 ? <span class="td-spill t"><span class="mono">{it.onShelf}</span> on shelf</span> : shelf(it)}</span></span>
        </div>
        {it.price != null && (
          <div class={'td-item-prices' + (pack ? '' : ' one')}>
            <div><span>{`One ${u}`}</span><span class="mono">{money(it.price)}</span></div>
            {pack && <div><span>{`${cap(it.packUnit)} of ${it.packQty}`}</span><span class="mono">{money(it.price * it.packQty)}</span></div>}
          </div>
        )}
        <div class="td-item-acts">
          <Tap on={() => go('counter')} class="td-item-sell"><Icon name="store" size={17} stroke={2} />Sell at the counter</Tap>
          {dc && <Tap on={() => addTo(it.id)} label={`Add to ${dc.name.split(' ')[0]}'s order`} class="td-item-add"><Avatar initials={dc.initials} tint={dc.tint} size={30} font={11} /><Icon name="plus" size={15} stroke={2.6} />Add</Tap>}
        </div>
      </div>
      {rest.length > 0 && (
        <div class="ow-group p14">
          {rest.map((i) => (
            <button type="button" key={i.id} class="td-find-row" onClick={() => setOpen(i.id)}>
              <ItemSquare aisle={i.aisle} size={40} />
              <span class="td-find-t"><span><Marked text={i.name} q={p.q.trim()} /></span><span>{shelf(i)}</span></span>
              {i.price == null ? <span class="td-spill w">Price coming</span> : <span class="td-find-fig"><b class="mono">{money(i.price)}</b><small>{`a ${unitWord(i.unit)}`}</small></span>}
            </button>
          ))}
        </div>
      )}
      {often.length > 0 && (
        <>
          <div class="td-find-h"><Duo i={phLink} size={18} color="#0E6A6A" /><h2>{`Often with this ${word}`}</h2><span class="td-find-note">in the shop's orders</span></div>
          {often.map((o) => (
            <div key={o.item.id} class="td-often">
              <ItemSquare aisle={o.item.aisle} size={44} icon={26} />
              <span class="td-often-t"><span>{o.item.name}</span><span><span aria-hidden="true"><span style={{ width: `${Math.round((o.had / o.of) * 100)}%` }} /></span><b class="mono">{`${o.had}/${o.of}`}</b></span></span>
              {isPriced(o.item.price) ? <span class="td-find-fig"><b class="mono">{money(o.item.price)}</b><small>{`per ${unitWord(o.item.unit)}`}</small></span> : <span class="td-find-fig"><small>{PRICE_COMING}</small></span>}
              <button type="button" aria-label={`Add ${o.item.name}`} class="td-often-add" onClick={() => addTo(o.item.id)}><Icon name="plus" size={16} stroke={2.6} /></button>
            </div>
          ))}
        </>
      )}
      <AskCard b={b} title={`Not the ${word} they want?`} name={p.q.trim()} />
    </>
  );
}

/** Edit distance, for "Did you mean". */
function dist(a: string, b: string): number {
  const m = Array.from({ length: b.length + 1 }, (_x, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = m[0]; m[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return m[b.length];
}

export function Nothing(p: { b: Books; q: string; now: Ms; onSearch: (q: string) => void }): JSX.Element {
  const b = p.b, q = p.q.trim(), words = new Set<string>();
  b.items.forEach((i) => i.name.toLowerCase().split(/[^a-z]+/).forEach((w) => { if (w.length > 3) words.add(w); }));
  const best = [...words].map((w) => ({ w, d: dist(q.toLowerCase(), w) })).sort((x, y) => x.d - y.d)[0];
  const mean = best && best.d <= Math.max(2, Math.floor(q.length / 4)) ? best.w : null;
  const close = mean ? b.items.filter((i) => i.name.toLowerCase().includes(mean)) : [];
  const tiles = nearAisles(b, close, p.now).slice(0, 6);
  return (
    <>
      <div class="td-none">
        <NoneMark big />
        <span class="td-none-t">{`Nothing called “${q}”`}</span>
        {mean && <Tap on={() => { const el = document.getElementById('closest'); if (el) el.scrollIntoView({ block: 'start' }); }} class="td-none-mean">Did you mean <span>{mean}</span></Tap>}
      </div>
      {close.length > 0 && (
        <div id="closest" class="td-closest">
          <div>CLOSEST IN THE SHOP</div>
          <div>
            {close.slice(0, 3).map((i) => (
              <div key={i.id} class="td-closest-r">
                <button type="button" class="td-find-main-a" onClick={() => p.onSearch(i.name)}>
                  <ItemSquare aisle={i.aisle} size={40} />
                  <span class="td-find-t"><span>{i.name}</span><span>{shelf(i)}{i.price != null && <>{' · '}<span class="mono td-ink">{money(i.price)}</span></>}</span></span>
                </button>
                <Tap on={() => go('sell', { items: itemsParam(i.id) })} label={`Put ${sayItem(i.name)} on an order`} class="td-find-act"><Icon name="plus" size={17} stroke={2.2} /></Tap>
              </div>
            ))}
          </div>
        </div>
      )}
      <AskCard b={b} title="Not what they need?" name={q} />
      <div class="td-aisles-h">Or open an aisle</div>
      <div class="td-aisles">
        {tiles.map((a) => (
          <Tap key={a.name} on={() => go('sell', { aisle: a.name })} class="td-aisle">
            <ItemSquare aisle={a.name} size={38} icon={22} />
            <span><span>{a.name}</span><span class="mono">{`${counted(a.count, 'item')}`}</span></span>
          </Tap>
        ))}
      </div>
    </>
  );
}
