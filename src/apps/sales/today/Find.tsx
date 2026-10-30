/*
 * TD11–TD14 · Find: one field for a chat, a customer, an order or an item.
 *
 *   nothing typed   who waits on WhatsApp, what Grace opened lately, what she searched, what sells
 *   a customer      the best match (New order, chat, call), their orders on the move, their chat,
 *                   what they usually buy, what they asked Moses for
 *   an item         the first item opened: one against the pack's price, Sell at the counter, add
 *                   to the open order; the others; what goes with it in the shop's orders; Ask Moses
 *   nothing         "Did you mean", the closest items, Ask Moses, the aisles
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { money, oldestAge, orderTotal } from '../../../core/money.ts';
import { firstWord, orderNo, STAGE_WORD } from '../../../core/names.ts';
import { addDays, dayLabel, dayOf, howLong, when } from '../../../core/time.ts';
import type { Books, Chat, ChatBooks, Customer, Item, Message, Ms, Order } from '../../../core/types.ts';
import { lastMessages, waitingChats } from '../../../core/chats.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import '../../../ui/section.css';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Duo, Icon, STAGE_ICON, phAgain, phMic, phSearch, phWhatsapp } from '../../../ui/icons.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import type { ScreenProps } from '../shell/types.ts';
import { books, chats, drafts, now, source } from '../shell/store.ts';
import { lastOrderAt, mine, opensOwn } from './data.ts';
import { askAisle, sellsMost } from './First.tsx';
import { go, tel } from './go.ts';
import { rememberOpened, rememberSearch, useLocal } from './local.ts';
import { ItemFound, Nothing, oftenIds } from './FindItems.tsx';
import './find.css';

export type Kind = 'all' | 'chats' | 'customers' | 'orders' | 'items';

/** The words typed, marked where they are in a name. */
export function Marked(p: { text: string; q: string }): JSX.Element {
  const i = p.q ? p.text.toLowerCase().indexOf(p.q.toLowerCase()) : -1;
  if (i < 0) return <>{p.text}</>;
  return <>{p.text.slice(0, i)}<mark>{p.text.slice(i, i + p.q.length)}</mark>{p.text.slice(i + p.q.length)}</>;
}

const has = (s: string, q: string) => s.toLowerCase().includes(q.toLowerCase());

export function matches(b: Books, cb: ChatBooks | null, q: string) {
  const w = q.trim(), digits = w.replace(/[^0-9]/g, '');
  const customers = w ? b.customers.filter((c) => !c.qa && (has(c.name, w) || (digits.length >= 3 && c.phone.replace(/\s/g, '').includes(digits)) || has(c.place, w))) : [];
  const ids = new Set(customers.map((c) => c.id));
  const orders = w ? b.orders.filter((o) => !o.qa && !o.cancelled && ((o.customerId && ids.has(o.customerId)) || (digits.length >= 2 && String(o.id).includes(digits.replace(/^0+/, ''))))) : [];
  const chatsHit = w && cb ? cb.chats.filter((c) => (c.customerId && ids.has(c.customerId)) || has(c.profileName, w) || (digits.length >= 3 && c.phone.replace(/\s/g, '').includes(digits))) : [];
  // Items by name, ready to sell first (on the shelf and priced); then, up to three, the rest of their aisle
  // that is not already bought with them (FindItems shows those under "Often with").
  const ready = (i: Item) => Number(!!(i.onShelf && i.onShelf > 0)) + Number(i.price != null);
  const named = w ? b.items.filter((i) => has(i.name, w)).sort((x, y) => ready(y) - ready(x)) : [];
  const near = named.length && named.length < 3 ? b.items.filter((i) => !named.includes(i) && i.aisle === named[0].aisle && !oftenIds(b, named[0]).includes(i.id)) : [];
  const items = [...named, ...near].slice(0, Math.max(3, named.length));
  return { customers, orders, chats: chatsHit, items, total: customers.length + orders.length + chatsHit.length + items.length };
}

export function Find(p: ScreenProps): JSX.Element {
  const b = books.value, cb = chats.value, n = now.value, L = useLocal();
  const [q, setQ] = useState(String(p.params.q || '')), [kind, setKind] = useState<Kind>('all');
  const input = useRef<HTMLInputElement>(null);
  const m = b ? matches(b, cb, q) : null;
  useEffect(() => {
    if (!q.trim() || !m) return undefined;
    const t = window.setTimeout(() => {
      rememberSearch(q, m.total > 0, n);
      if (!m.total) source.logSearchMiss(q.trim(), null);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [q]);
  if (!b || !m) return <main class="td-wait" aria-busy="true" />;
  const typed = q.trim().length > 0;
  const chips: [Kind, string, number | null][] = typed
    ? ([['all', 'All', m.total], ['customers', 'Customers', m.customers.length], ['orders', 'Orders', m.orders.length], ['chats', 'Chats', m.chats.length], ['items', 'Items', m.items.length]] as [Kind, string, number][]).filter((c) => c[0] === 'all' || c[2] > 0)
    : [['all', 'All', null], ['chats', 'Chats', cb ? waitingChats(cb, b.me.id, n).length : 0], ['customers', 'Customers', null], ['orders', 'Orders', null], ['items', 'Items', null]];
  const show = (k: Kind) => kind === 'all' || kind === k;
  return (
    <div class="td-find">
      <div class="td-find-top">
        <Tap on={() => nav.back()} label="Back to Today" class="td-find-back"><Icon name="back" size={20} stroke={2.2} /></Tap>
        <label class={cx('td-find-field', typed && 'typed')}>
          <Duo i={phSearch} size={20} color="#1C2233" />
          <input ref={input} type="search" placeholder="Name, order or item" aria-label="Find a chat, customer, order or item" value={q} autoFocus
            onInput={(e) => { setQ((e.target as HTMLInputElement).value); setKind('all'); }} />
          {typed
            ? <button type="button" aria-label="Clear" class="td-find-clear" onClick={() => { setQ(''); if (input.current) input.current.focus(); }}><Icon name="close" size={15} stroke={2.4} /></button>
            : <button type="button" aria-label="Say it" class="td-find-mic" onClick={() => listen(setQ)}><span><Duo i={phMic} size={18} color="#FFFFFF" /></span></button>}
        </label>
      </div>
      <main class="td-find-main">
        {(m.total > 0 || !typed) && (
          <div class={cx('td-find-chips', !typed && 'fade', typed && chips.length > 3 && 'tight')}>
            <div role="group" aria-label="Show">
              {chips.map(([k, w, c]) => (
                <button key={k} type="button" aria-pressed={kind === k} class={cx('td-chip', kind === k && 'on')} onClick={() => setKind(k)}>
                  {!typed && k === 'chats' && <span aria-hidden="true" class="td-chip-wa"><Duo i={phWhatsapp} size={16} /></span>}{w}{c != null && c > 0 && <b class="mono">{c}</b>}
                </button>
              ))}
            </div>
          </div>
        )}
        {!typed ? <Start b={b} cb={cb} now={n} show={show} searches={L.searches} lately={L.lately} onSearch={setQ} />
          : m.customers.length > 0 ? <CustomerFound b={b} cb={cb} now={n} q={q} m={m} show={show} />
          : m.items.length > 0 ? <ItemFound b={b} q={q} items={m.items} />
          : m.total > 0 ? <OrdersOnly b={b} now={n} orders={m.orders} />
          : <Nothing b={b} q={q} />}
      </main>
    </div>
  );
}


/** "Say it": the phone's own speech to text, when it has one. */
function listen(set: (v: string) => void): void {
  const W = window as unknown as { webkitSpeechRecognition?: new () => { lang: string; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; start: () => void } };
  if (!W.webkitSpeechRecognition) return;
  const r = new W.webkitSpeechRecognition();
  r.lang = 'en-UG';
  r.onresult = (e) => set(e.results[0][0].transcript);
  r.start();
}

/** The wait as a pill: amber from 10 minutes, grey before. */
function Wait(p: { since: Ms; now: Ms }): JSX.Element {
  return <span class={cx('mono td-wait-pill', p.now - p.since >= 10 * 60000 && 'long')}>{howLong(p.since, p.now)}</span>;
}

/** Their last words, quoted ("“G28 iron sheets, 60 pcs?”"), the first question when it runs on. */
function quote(ms: Message[], chatId: number): string {
  const t = ms.filter((x) => x.chatId === chatId && x.dir === 'in' && x.kind === 'text' && x.body).sort((x, y) => y.at - x.at)[0];
  return t ? `“${t.body.split('?')[0]}${t.body.includes('?') ? '?' : ''}”` : '';
}

/** S09's group head (dot, title, count or "3 of 14", sum) over a group card. */
export function Group(p: { dot: string; title: string; meta: string | number; sum?: number; children: ComponentChildren }): JSX.Element {
  return (
    <>
      <div class="ow-ghead"><span aria-hidden="true" style={{ background: p.dot }} /><span class="ow-ghead-t">{p.title}</span><span class="mono ow-ghead-n">{p.meta}</span>{p.sum != null && <span class="mono ow-ghead-sum">{money(p.sum)}</span>}</div>
      <div class="ow-group p14">{p.children}</div>
    </>
  );
}

function ChatRow(p: { b: Books; c: Chat; cb: ChatBooks; now: Ms; q?: string; act?: boolean }): JSX.Element {
  const c = p.c, cust = c.customerId ? p.b.customers.find((x) => x.id === c.customerId) : null;
  const last = lastMessages(p.cb.recent).get(c.id), since = last && last.dir === 'in' ? last.at : null;
  const draft = cust ? drafts.value.find((d) => d.chatId === c.id) : null;
  const open = () => (draft ? go('sell/order', { customer: c.customerId, from: 'chat', chat: c.id }) : go('chats/chat', { id: c.id }));
  const name = cust ? cust.name : null;
  const body = (
    <>
      {cust ? <Avatar initials={cust.initials} tint={cust.tint} size={40} /> : <span aria-hidden="true" class="td-find-anon"><Icon name="person" size={20} stroke={1.8} /></span>}
      <span class="td-find-t">
        <span class="td-find-n">{name ? <span>{p.q ? <Marked text={name} q={p.q} /> : name}</span> : <span><span class="mono">{c.phone}</span></span>}{p.act && since && <Wait since={since} now={p.now} />}</span>
        <span>{quote(p.cb.recent, c.id)}</span>
      </span>
    </>
  );
  if (!p.act) return <Tap on={open} class="td-find-row">{body}{since && <Wait since={since} now={p.now} />}</Tap>;
  return (
    <div class="td-find-row">
      <Tap on={open} class="td-find-main-a">{body}</Tap>
      <Tap on={open} label={`Reply to ${name || 'a new number'}`} class="td-find-act"><Icon name="whatsapp" size={17} stroke={2.2} /></Tap>
    </div>
  );
}

function Start(p: { b: Books; cb: ChatBooks | null; now: Ms; show: (k: Kind) => boolean; searches: string[]; lately: { kind: string; id: string }[]; onSearch: (q: string) => void }): JSX.Element {
  const b = p.b, wait = (p.cb ? waitingChats(p.cb, b.me.id, p.now) : []).sort((x, y) => x.since - y.since || y.chat.id - x.chat.id);
  const lately = p.lately.map((x) => ({ x, o: x.kind === 'order' ? b.orders.find((o) => String(o.id) === x.id) : null, c: x.kind === 'customer' ? b.customers.find((c) => c.id === x.id) : null, i: x.kind === 'item' ? b.items.find((i) => i.id === x.id) : null }))
    .filter((r) => r.o || r.c || r.i);
  const most = sellsMost(b);
  return (
    <>
      {p.show('chats') && wait.length > 0 && p.cb && (
        <Group dot="#0F6B43" title="Waiting on WhatsApp" meta={wait.length}>{wait.map((w) => <ChatRow key={w.chat.id} b={b} c={w.chat} cb={p.cb as ChatBooks} now={p.now} act />)}</Group>
      )}
      {lately.length > 0 && (
        <Group dot="#C9C4BA" title="Lately" meta={lately.length}>
          {lately.filter((r) => (r.o ? p.show('orders') : r.c ? p.show('customers') : p.show('items'))).map((r) => r.o ? (
            <Tap key={r.x.id} on={() => go('orders/order', { id: (r.o as Order).id })} class="td-find-row">
              <span aria-hidden="true" class="td-find-sq"><Icon name={STAGE_ICON[r.o.stage]} size={20} stroke={1.9} /></span>
              <span class="td-find-t"><span>{(b.customers.find((c) => c.id === (r.o as Order).customerId) || { name: 'Walk-in order' }).name}</span><span>{`${orderNo(r.o.id)} · ${STAGE_WORD[r.o.stage]} · ${dayOf(r.o.placedAt) === dayOf(p.now) ? 'today ' : ''}${when(r.o.placedAt, p.now)}`}</span></span>
              <span class="mono td-find-amt">{money(orderTotal(r.o))}</span>
            </Tap>
          ) : r.c ? (
            <Tap key={r.x.id} on={() => { rememberOpened({ kind: 'customer', id: (r.c as Customer).id }); go('sell/order', { customer: (r.c as Customer).id }); }} class="td-find-row">
              <Avatar initials={r.c.initials} tint={r.c.tint} size={40} />
              <span class="td-find-t"><span>{r.c.name}</span><span>{r.c.owes > 0 ? `oldest bill ${oldestAge(r.c, dayOf(p.now))} days` : r.c.place}</span></span>
              {r.c.owes > 0 && <span class="td-find-fig"><b class="mono">{money(r.c.owes)}</b><small>owes</small></span>}
            </Tap>
          ) : (
            <button type="button" key={r.x.id} class="td-find-row" onClick={() => p.onSearch((r.i as Item).name)}>
              <ItemSquare aisle={(r.i as Item).aisle} size={40} />
              <span class="td-find-t"><span>{(r.i as Item).name}</span><span>{shelf(r.i as Item)}</span></span>
              {(r.i as Item).price != null && <span class="td-find-fig"><b class="mono">{money((r.i as Item).price)}</b><small>{`a ${unitWord((r.i as Item).unit)}`}</small></span>}
            </button>
          ))}
        </Group>
      )}
      {p.searches.length > 0 && (
        <>
          <div class="td-find-h"><span class="td-find-hic"><Icon name="undo" size={16} stroke={2.2} /></span><span>You searched</span></div>
          <div class="td-find-words">{p.searches.map((w) => <Tap key={w} on={() => p.onSearch(w)}>{w}</Tap>)}</div>
        </>
      )}
      {most.length > 0 && (
        <Tap on={() => go('sell/order')} class="td-most">
          <span class="td-most-t"><span>Sells most</span><span>the shop, this month</span></span>
          <span class="td-most-ic">{most.map((a) => <ItemSquare key={a} aisle={a} size={34} icon={20} />)}</span>
          <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
        </Tap>
      )}
    </>
  );
}

export function unitWord(u: string): string {
  return u === 'pc' ? 'piece' : u;
}
export function shelf(i: Item): JSX.Element | string {
  return i.onShelf && i.onShelf > 0 ? <><span class="mono">{i.onShelf}</span> on shelf</> : i.orderIn ? <span class="td-orderin">Order in</span> : i.onShelf === 0 ? 'Out' : '';
}


function CustomerFound(p: { b: Books; cb: ChatBooks | null; now: Ms; q: string; m: ReturnType<typeof matches>; show: (k: Kind) => boolean }): JSX.Element {
  const b = p.b, c = p.m.customers[0], first = firstWord(c.name);
  const last = lastOrderAt(b, c.id), next = last != null && c.everyDays ? addDays(dayOf(last), c.everyDays) : null;
  const gone = last != null && c.everyDays ? Math.min(1, (p.now - last) / (c.everyDays * 864e5)) : 0, ring = Math.max(4, 144.5 * gone);
  const all = p.m.orders.filter((o) => o.customerId === c.id).length, live = mine(b).filter((o) => o.customerId === c.id).sort((x, y) => y.id - x.id);
  const chat = p.cb ? p.cb.chats.find((x) => x.customerId === c.id) : null;
  const asked = b.asks.filter((a) => a.status !== 'dropped' && a.status !== 'listed' && a.requests.some((r) => r.customerId === c.id));
  return (
    <>
      {p.show('customers') && (
        <div class="td-best-match">
          <Tap on={() => go('customers/customer', { id: c.id })} class="td-bm-who">
            <span aria-hidden="true" class="td-bm-ring"><svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3.5" />
              <circle cx="26" cy="26" r="23" fill="none" stroke="#6FDCB0" stroke-width="3.5" stroke-linecap="round" stroke-dasharray={`${ring.toFixed(1).replace(/\.0$/, '')} 144.5`} transform="rotate(-90 26 26)" /></svg>
              <span style={{ background: `var(--${c.tint}-bg)`, color: `var(--${c.tint}-fg)` }}>{c.initials}</span></span>
            <span class="td-bm-t"><span>Best match</span><span><Marked text={c.name} q={p.q} /></span>
              <span>{next ? `Due ${dayLabel(next)}` : c.place}{c.owes > 0 && <>{' · '}<span class="mono">{`owes ${money(c.owes)}`}</span></>}</span></span>
          </Tap>
          <div class="td-bm-acts">
            <Tap on={() => go('sell/order', { customer: c.id })} class="td-bm-new"><Icon name="plus" size={16} stroke={2.6} />{`New order for ${first}`}</Tap>
            {chat && <Tap on={() => go('chats/chat', { id: chat.id })} label={`Chat with ${c.name}`} class="td-bm-sq"><Icon name="whatsapp" size={19} stroke={2} /></Tap>}
            {c.phone && <Tap href={'tel:' + tel(c.phone)} label={`Call ${c.name}`} class="td-bm-sq"><Icon name="phone" size={19} stroke={2} /></Tap>}
          </div>
        </div>
      )}
      {p.show('orders') && live.length > 0 && (
        <Group dot="#1A5A8A" title="On the move" meta={`${live.length} of ${all}`} sum={live.reduce((s, o) => s + orderTotal(o), 0)}>
          {live.map((o) => (
            <button type="button" key={o.id} onClick={() => go('orders/order', { id: o.id })} class={cx('td-find-row', opensOwn(o) && 'own')}>
              <span aria-hidden="true" class="td-find-sq"><Icon name={STAGE_ICON[o.stage]} size={20} stroke={1.9} /></span>
              <span class="td-find-t"><span class="mono">{orderNo(o.id)}</span><span>{`${dayOf(o.placedAt) === dayOf(p.now) ? 'today ' : ''}${when(o.placedAt, p.now)}`}</span></span>
              <span class="td-find-st"><span>{STAGE_WORD[o.stage]}</span><span class="mono">{money(orderTotal(o))}</span></span>
            </button>
          ))}
        </Group>
      )}
      {p.show('chats') && p.m.chats.length > 0 && p.cb && (
        <Group dot="#0F6B43" title="Chats" meta={p.m.chats.length}>{p.m.chats.map((x) => <ChatRow key={x.id} b={b} c={x} cb={p.cb as ChatBooks} now={p.now} q={p.q} />)}</Group>
      )}
      {p.show('customers') && c.usual.length > 0 && (
        <>
          <div class="td-find-h"><Duo i={phAgain} size={18} color="#5F6980" /><span class="grow">{`${first} usually buys`}</span>{!p.m.items.length && <span class="td-find-note">{`no items called “${p.q.trim()}”`}</span>}</div>
          <div class="td-usual">
            {c.usual.slice(0, 3).map((u) => {
              const it = b.items.find((i) => i.id === u.itemId);
              if (!it) return null;
              const short = it.name.split(/ ·| G\d|,/)[0];
              return (
                <Tap key={u.itemId} on={() => go('sell/order', { customer: c.id, items: it.id })} label={`Start ${first}'s order with ${short}`} class="td-usual-t">
                  <ItemSquare aisle={it.aisle} size={36} icon={22} />
                  <span><span>{short}</span><span class="mono">{money(it.price || 0)}</span></span>
                  <span aria-hidden="true" class="td-usual-plus"><Icon name="plus" size={14} stroke={2.6} /></span>
                </Tap>
              );
            })}
          </div>
        </>
      )}
      {asked.map((a) => (
        <Tap key={a.id} on={() => go('today/asks', { id: a.id })} class="td-askcard">
          <ItemSquare aisle={askAisle(a.name)} size={38} icon={22} />
          <span class="td-find-t"><span>{`${first} asked ${firstWord((b.members.find((x) => x.role === 'sourcing') || { name: 'Sourcing' }).name)} for`}</span><span>{`${a.name} · ${a.requests.filter((r) => r.customerId === c.id).reduce((s, r) => s + r.qty, 0)} · ${STAGE_ASK[a.status]}`}</span></span>
          <span class="td-spill">{STAGE_ASK[a.status]}</span>
          <span aria-hidden="true" class="ow-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
        </Tap>
      ))}
    </>
  );
}

export const STAGE_ASK: Record<string, string> = { asked: 'Asked', looking: 'Looking', found: 'Found', priced: 'Priced', listed: 'Listed', dropped: 'Dropped' };

function OrdersOnly(p: { b: Books; now: Ms; orders: Order[] }): JSX.Element {
  return (
    <Group dot="#1A5A8A" title="Orders" meta={p.orders.length}>
      {p.orders.map((o) => (
        <Tap key={o.id} on={() => go('orders/order', { id: o.id })} class="td-find-row">
          <span aria-hidden="true" class="td-find-sq"><Icon name={STAGE_ICON[o.stage]} size={20} stroke={1.9} /></span>
          <span class="td-find-t"><span class="mono">{orderNo(o.id)}</span><span>{(p.b.customers.find((c) => c.id === o.customerId) || { name: 'Walk-in order' }).name}</span></span>
          <span class="td-find-st"><span>{STAGE_WORD[o.stage]}</span><span class="mono">{money(orderTotal(o))}</span></span>
        </Tap>
      ))}
    </Group>
  );
}
