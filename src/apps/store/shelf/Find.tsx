/*
 * shelf/find · SH02 (what was typed found), SH42 (nothing found).
 *
 *   found      All · Items · Orders (a chip's count is its rows), "Did you mean" narrower words, the best item
 *              first as a card with its next move (Count it again · Open), the other items, the orders
 *   nothing    "Nothing called “emalshon”", Did you mean emulsion, the closest on our shelf, tell Moses
 *              it is in the yard but not on our list, the aisles
 *
 * The words typed stay in the route's params, so Back lands on the search (routes §2).
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { closestTo, findShelf, nearWord, PAGE } from '../../../core/store/find.ts';
import { aislesOf, letterOf, noAisle } from '../../../core/store/shelf.ts';
import type { ShelfItem, YardBooks } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { nav, top, type Params } from '../shell/nav.ts';
import { act, books, me, now } from '../shell/store.ts';
import { ItemPic } from './glyphs.tsx';
import { GroupHead } from './parts.tsx';
import { ItemRow, itemState, Marked, openOrder, OrderRow, StateChips, stateLine, stateRank } from './rows.tsx';
import './find.css';

type Kind = 'all' | 'items' | 'orders';

/** An item row's own screen: a due count opens the aisle's count, an order in opens Coming in, else the item. */
function openItem(b: YardBooks, it: ShelfItem, s: ReturnType<typeof itemState>): void {
  if (s.due && !s.recount && it.category) nav.push('shelf/count', { aisle: it.category });
  else if (s.orderIn.length && !s.shelf) nav.push('in');
  else if (s.low) nav.push('shelf/ask', { key: it.key });
  else nav.push('shelf/item', { key: it.key });
  void b;
}

export function Find(p: { params: Params }): JSX.Element {
  const b = books.value, at = now.value;
  const [q, setQ] = useState(String(p.params.q || '')), [kind, setKind] = useState<Kind>('all'), [more, setMore] = useState(1);
  const input = useRef<HTMLInputElement>(null);
  if (!b) return <main class="sh-wait" aria-busy="true" />;
  const set = (v: string) => { setQ(v); setKind('all'); setMore(1); top.peek().params.q = v; };
  const typed = q.trim().length > 0;
  const f = findShelf(b, q, (it) => stateRank(itemState(b, it, at)));
  const total = f.items.length + f.orders.length;
  return (
    <div class="sh-find">
      <div class="sh-find-top">
        <Tap on={() => nav.back()} label="Back to Shelf" class="sh-find-b"><Icon name="back" size={20} stroke={2.2} /></Tap>
        <label class={cx('sh-find-f', typed && 'typed')}>
          <Icon name="search" size={19} stroke={2} />
          <input ref={input} type="search" value={q} placeholder="Item, aisle or order #" aria-label="Find an item, aisle or order" autoFocus
            onInput={(e) => set((e.target as HTMLInputElement).value)} />
          {typed && <button type="button" aria-label="Clear" class="sh-find-x" onClick={() => { set(''); if (input.current) input.current.focus(); }}><Icon name="close" size={16} stroke={2.2} /></button>}
        </label>
        <Tap on={() => nav.push('shelf/scan')} label="Scan a shelf label" class="sh-find-b"><Icon name="scan" size={20} stroke={2} /></Tap>
      </div>
      <main class={cx('sh-find-main', typed && total === 0 && 'none')}>
        {!typed ? <Aisles b={b} first={null} at={at} />
          : total === 0 ? <Nothing b={b} q={q} at={at} onSearch={set} />
          : (
            <>
              <div role="group" aria-label="Show" class="sh-fchips">
                {([['all', 'All', total], ['items', 'Items', f.items.length], ['orders', 'Orders', f.orders.length]] as [Kind, string, number][]).filter((c) => c[0] === 'all' || c[2] > 0).map(([k, w, n]) => (
                  <button key={k} type="button" aria-pressed={kind === k} class={cx('sh-fchip', kind === k && 'on')} onClick={() => setKind(k)}>{w}<b class="mono">{n}</b></button>
                ))}
              </div>
              {f.narrower.length > 0 && (
                <div class="sh-dym">
                  <span>Did you mean</span>
                  {f.narrower.map((w) => <Tap key={w} on={() => set(w)} class="sh-dym-c"><span><Icon name="search" size={14} stroke={2.2} />{w}</span></Tap>)}
                </div>
              )}
              {kind !== 'orders' && f.items.length > 0 && (
                <>
                  <GroupHead dot="#3A3F9B" title="Items" meta={String(f.items.length)} />
                  <Best b={b} it={f.items[0]} q={q} at={at} />
                  {f.items.length > 1 && (
                    <div class="sh-list">
                      {f.items.slice(1, PAGE * more).map((it) => { const s = itemState(b, it, at); return <ItemRow key={it.key} b={b} it={it} s={s} q={q} line={stateLine(b, it, s, at)} on={() => openItem(b, it, s)} />; })}
                    </div>
                  )}
                  {f.items.length > PAGE * more && <button type="button" class="sh-more" onClick={() => setMore(more + 1)}>Show 30 more<Icon name="chevron-down" size={16} stroke={2.2} /></button>}
                </>
              )}
              {kind !== 'items' && f.orders.length > 0 && (
                <>
                  <div class="sh-gap" />
                  <GroupHead dot="#8DA2D6" title="Orders" meta={String(f.orders.length)} />
                  <div class="sh-list">
                    {f.orders.map((o) => {
                      const l = o.lines.find((x) => f.items.some((it) => it.key === x.key));
                      return <OrderRow key={o.id} b={b} o={o} what={l ? `${l.qty} ${l.unit}` : ''} me={me.value} now={at} on={() => openOrder(b, o, me.value, at, (id, pp) => nav.push(id, pp as Params))} />;
                    })}
                  </div>
                </>
              )}
            </>
          )}
      </main>
    </div>
  );
}

/** The best match, a card with its next move. */
function Best(p: { b: YardBooks; it: ShelfItem; q: string; at: number }): JSX.Element {
  const s = itemState(p.b, p.it, p.at), ruth = p.b.people.find((x) => x.role === 'manager') || { initials: 'RN', tint: 't2' };
  const move = s.ruth ? 'Count it again' : s.due ? 'Count' : s.low ? 'We need more' : 'Count';
  const go = () => (s.low && !s.ruth && !s.due ? nav.push('shelf/ask', { key: p.it.key }) : nav.push('shelf/count', { key: p.it.key }));
  const line = stateLine(p.b, p.it, s, p.at);
  return (
    <div class="sh-best">
      <div class="sh-best-r">
        <ItemPic it={p.it} size={44} />
        <span class="sh-best-t"><span><Marked text={p.it.name} q={p.q} /></span><span><StateChips b={p.b} it={p.it} s={s} ruth={ruth} />{line && <span>{line}</span>}</span></span>
      </div>
      <div class="sh-best-a">
        <button type="button" class="sh-best-go" onClick={go}><Icon name={move === 'We need more' ? 'cart' : 'tally'} size={18} stroke={2} />{move}</button>
        <button type="button" class="sh-best-open" onClick={() => nav.push('shelf/item', { key: p.it.key })}>Open</button>
      </div>
    </div>
  );
}

function Nothing(p: { b: YardBooks; q: string; at: number; onSearch: (q: string) => void }): JSX.Element {
  const b = p.b, word = nearWord(b, p.q);
  const close = word ? closestTo(b, word, (it) => (itemState(b, it, p.at).low ? 0 : it.listedAt ? 1 : itemState(b, it, p.at).orderIn.length ? 0 : 2)) : [];
  const moses = b.people.find((x) => x.role === 'sourcing');
  const tell = () => {
    const el = document.createElement('input');
    el.type = 'file'; el.accept = 'image/*'; el.setAttribute('capture', 'environment');
    el.onchange = () => {
      const photo = el.files && el.files[0] ? el.files[0] : null;
      void act('notOnList', { tripId: '', supplierId: null, key: null, productId: null, variantIdx: null, name: p.q.trim(), qty: 1, unit: 'pc', why: 'In the yard, not on our list', newItem: true, photo })
        .then(() => toast.show(`Sent to ${moses ? moses.name.split(' ')[0] : 'Sourcing'}`)).catch(() => undefined);
    };
    el.click();
  };
  return (
    <>
      <div class="sh-none">
        <span aria-hidden="true" class="sh-none-pic"><Icon name="search" size={30} stroke={1.8} /><span>?</span></span>
        <span class="sh-none-t">{`Nothing called “${p.q.trim()}”`}</span>
        {word && <Tap on={() => p.onSearch(word)} class="sh-none-dym">Did you mean <span>{word}</span></Tap>}
      </div>
      {close.length > 0 && (
        <div class="sh-list">
          <div class="sh-close-h">CLOSEST ON OUR SHELF</div>
          {close.map((it) => { const s = itemState(b, it, p.at); return <ItemRow key={it.key} b={b} it={it} s={s} line={stateLine(b, it, s, p.at)} on={() => openItem(b, it, s)} />; })}
        </div>
      )}
      <button type="button" class="sh-tell" onClick={tell}>
        <span aria-hidden="true" class="sh-tell-f">{moses && <Avatar initials={moses.initials} tint={moses.tint} size={30} font={11} />}</span>
        <span class="sh-tell-t"><span>In the yard but not on our list?</span><span>{`${moses ? moses.name.split(' ')[0] : 'Sourcing'} adds it · send a photo`}</span></span>
        <span class="sh-tell-b">Tell</span>
      </button>
      <Aisles b={b} first={close[0] ? close[0].category : null} at={p.at} />
    </>
  );
}

/** "Or open an aisle": the nearest aisle first, five, then all of them. */
function Aisles(p: { b: YardBooks; first: string | null; at: number }): JSX.Element {
  const all = aislesOf(p.b, p.at), i = Math.max(0, all.findIndex((a) => a.name === p.first));
  // The closest aisle, the one before it, the shop's first two, the one after it: five, then all of them.
  const near = [all[i], all[i - 1], all[0], all[1], all[i + 1], ...all].filter((x, j, l) => x && l.indexOf(x) === j).slice(0, 5);
  const total = all.reduce((n, a) => n + a.items.length, 0);
  return (
    <>
      <div class="sh-open-h">Or open an aisle</div>
      <div class="sh-open">
        {near.map((a) => (
          <Tap key={a.name} on={() => nav.push('shelf/aisle', { aisle: a.name })} class="sh-open-t" label={`Aisle ${a.letter}, ${a.name}`}>
            <span><ItemSquare aisle={a.name} size={34} radius={10} icon={20} /><b class="mono">{letterOf(p.b, a.name)}</b></span>
            <span><span>{a.name}</span><span class="mono">{`${a.items.length} items`}</span></span>
          </Tap>
        ))}
        {p.first == null && (noAisle(p.b).length > 0 || p.b.items.some((x) => x.listedAt != null && p.at - x.listedAt < 864e5)) && (
          <Tap on={() => nav.push('shelf/aisle', { aisle: '' })} class="sh-open-t" label="No aisle yet">
            <span><span aria-hidden="true" class="sh-open-q mono">?</span></span>
            <span><span>No aisle yet</span><span class="mono">{`${noAisle(p.b).length} items`}</span></span>
          </Tap>
        )}
        <Tap on={() => nav.tab('shelf')} class="sh-open-t all" label="All aisles">
          <span aria-hidden="true" class="sh-open-all"><Icon name="grid" size={18} stroke={2} /></span>
          <span><span>All aisles</span><span class="mono">{`${all.length} · ${total.toLocaleString('en-US')}`}</span></span>
        </Tap>
      </div>
    </>
  );
}
