/*
 * The counter (KC01–KC10, KC12, KC13, KC17–KC19): a walk-in picks from the shelf, pays, goes.
 * The top bar (P05: × · who · search · aisles), then the shelf, the search or the basket, and the
 * dock (CounterDock.tsx). Selling is one write, counter_sale, through act (state.ts).
 */
import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { TopBar, WhoPill } from '../../../ui/TopBar.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { findItems, readQuery } from '../../../core/items.ts';
import { likelyNotes } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { howLong } from '../../../core/time.ts';
import type { Books, Customer, Item, Line } from '../../../core/types.ts';
import { nav, stack } from '../shell/nav.ts';
import { books, now, online } from '../shell/store.ts';
import { AskCard, YesCard } from './Ask.tsx';
import { CountSheet } from './Count.tsx';
import { DockFrame, EmptyDock, Methods, Move, NavyDock, NoSignal, NotSold, RefField, Tender } from './CounterDock.tsx';
import { Find } from './Find.tsx';
import { StillWho } from './local-whopill.tsx';
import { Picked } from './Picked.tsx';
import { OtherAisles, SoldHead, SoldRows, Tiles } from './Shelf.tsx';
import { bestSellers, counterToday, soldWith } from './shop.ts';
import { add, busy, failed, q, reset, restore, sale, sell, set, setPrice, setQty, toggle, totalOf, waitingLines } from './state.ts';
import { startWatch } from './watch.ts';
import { openWho } from './Who.tsx';
import './counter.css';

/** The Manager who decides a price under the shop's (decision-rights: the Manager prices). */
export function manager(b: Books): { initials: string; tint: Customer['tint']; first: string; id: string } {
  const m = b.members.find((x) => x.role === 'manager');
  return m ? { initials: m.initials, tint: m.tint, first: firstWord(m.name), id: m.id } : { initials: 'MG', tint: 't2', first: 'the Manager', id: '' };
}

/**
 * "Order in" turns the whole sale into an order (sales.html countertoorder), on the Sell tab's screen:
 * sell/order { customer, items } with items as JSON [{ itemId, qty, price }].
 */
export function orderIn(items: { itemId: string; qty: number; price: number | null }[], customerId: string | null): void {
  nav.replace('sell/order', { customer: customerId, items: JSON.stringify(items) });
  // The goods are the order's now: off the counter, so they cannot be sold twice.
  reset();
}
const asItems = (lines: Line[]) => lines.map((l) => ({ itemId: l.itemId, qty: l.qty, price: l.price }));

function listen(): void {
  const W = window as unknown as { SpeechRecognition?: new () => SpeechLike; webkitSpeechRecognition?: new () => SpeechLike };
  const R = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!R) { toast.show('Type it in the box', { kind: 'warn' }); return; }
  const r = new R();
  r.lang = 'en-UG';
  r.onresult = (e) => { q.value = e.results[0][0].transcript; };
  r.start();
}
interface SpeechLike { lang: string; start(): void; onresult: (e: { results: { transcript: string }[][] }) => void }

export function Counter(): JSX.Element {
  useEffect(() => { restore(); startWatch(); }, []);
  const b = books.value;
  if (!b) return <main class="kc" aria-busy="true" />;
  const s = sale.value, text = q.value, t = now.value, total = totalOf(s.lines);
  const cust = s.customerId ? b.customers.find((c) => c.id === s.customerId) || null : null;
  const itemOf = (l: Line) => b.items.find((i) => i.id === l.itemId);
  const short = s.lines.find((l) => { const it = itemOf(l); return !!it && it.onShelf != null && l.qty > it.onShelf; });
  const waits = s.quote == null ? waitingLines(s.lines) : [];
  const ruth = manager(b), face = cust ? { initials: cust.initials, tint: cust.tint } : { initials: 'WI', tint: 't4' as const };
  const pick = (it: Item, n = 1) => { add(it, n); q.value = ''; };
  const close = () => { sheet.close(); if (stack.value.length > 1) nav.back(); else nav.home(); };

  const top = (
    <TopBar onClose={close} closeLabel="Close the counter sale"
      who={busy.value
        ? <StillWho face={face} name="Counter sale" sub={`${cust ? cust.name : 'Walk-in'} · pay and go`} dot="var(--good)" />
        : <WhoPill on={openWho} face={face} name="Counter sale" sub={`${cust ? cust.name : 'Walk-in'} · pay and go`} dot="var(--good)" />}
      search={{ placeholder: 'Add an item', label: 'Add an item: type its name', value: text, onInput: (v) => { q.value = v; }, onMic: listen, class: 'kc-search' }}
      onAisles={() => { if (q.value) q.value = ''; else (document.querySelector('.kc-search input') as HTMLInputElement | null)?.focus(); }} />
  );

  let body: JSX.Element;
  if (text.trim()) {
    const r = readQuery(text), found = findItems(b.items, r.words);
    body = <Find qty={r.qty} words={r.words} read={r.counted} items={found} onAdd={pick} onOrderIn={(it, n) => orderIn([...asItems(s.lines), { itemId: it.id, qty: n, price: it.price }], s.customerId)} />;
  } else if (!s.lines.length) {
    const sales = counterToday(b, t), best = bestSellers(b, t).slice(0, 4);
    body = (
      <>
        <SoldHead meta={`${sales.length} sales · ${sales.reduce((a, x) => a + x.amount, 0).toLocaleString('en-US')}`} />
        <Tiles items={best} onAdd={(it) => pick(it)} />
        <OtherAisles skip={[...new Set(best.map((i) => i.aisle))]} onAisle={(a) => { q.value = a; }} />
      </>
    );
  } else {
    const yes = s.quote != null ? s.lines.find((l) => l.priceReview && l.priceReview.price === l.price) : undefined;
    const held = s.quote != null ? b.orders.find((o) => o.id === s.quote) : undefined;
    body = (
      <>
        <Picked lines={s.lines} items={b.items} open={s.open} pricing={s.pricing} onOpen={toggle} onPricing={(id) => set({ pricing: id })}
          onQty={setQty} onPrice={setPrice} onOrderIn={() => orderIn(asItems(s.lines), s.customerId)} />
        {s.method === 'momo' && !waits.length && <Sms total={total} shop={b.shop.name} />}
        {!!waits.length && (
          <AskCard ruth={ruth} shopTotal={totalOf(s.lines.map((l) => ({ ...l, price: l.shopPrice ?? l.price })))} asking={busy.value}
            onShop={() => { waits.forEach((l) => setPrice(l.lineId, l.shopPrice || 0)); set({ pricing: null }); }} onAsk={() => void ask()} />
        )}
        {yes && yes.priceReview && held && (
          <YesCard ruth={ruth} took={howLong(held.placedAt, yes.priceReview.at)} was={yes.shopPrice || 0} now={yes.price || 0} unit={yes.unit} />
        )}
        {!waits.length && !yes && <SoldRows items={soldWith(b, t, s.lines)} onAdd={(it) => pick(it)} />}
      </>
    );
  }

  return (
    <main class="kc">
      {top}
      <div class="kc-body" style={{ paddingBottom: '380px' }}>{body}</div>
      <CounterDock lines={s.lines} total={total} short={short ? { line: short, shelf: itemOf(short)?.onShelf || 0 } : null} waits={waits} ruth={ruth.first} />
    </main>
  );
}

/** Ask Ruth (KC10): the same write places the sale and asks; the screen waits for her (KC11). */
async function ask(): Promise<void> {
  const r = await sell(0);
  if (r && r.waiting) nav.replace('counter/wait', { id: r.order.id });
}

async function doSell(given: number): Promise<void> {
  const r = await sell(given);
  if (!r) return;
  if (r.waiting) { nav.replace('counter/wait', { id: r.order.id }); return; }
  nav.replace('counter/sold', { id: r.order.id });
}

/** KC08: where the ID is in their SMS (an example, with this sale's amount). */
function Sms(p: { total: number; shop: string }): JSX.Element {
  return (
    <div class="kc-sms">
      <div class="kc-sms-h">
        <span style={{ display: 'flex', color: '#5F6980' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg></span>
        <b>Their SMS</b><span class="kc-pill">example</span>
      </div>
      <p>{'You have sent '}<u>{`UGX ${p.total.toLocaleString('en-US')}`}</u>{` to ${p.shop.toUpperCase()}. `}<u>ID 12045889301</u>. Bal…</p>
    </div>
  );
}

function CounterDock(p: { lines: Line[]; total: number; short: { line: Line; shelf: number } | null; waits: Line[]; ruth: string }): JSX.Element {
  const s = sale.value, sending = busy.value, off = !online.value;
  if (!p.lines.length) return <EmptyDock />;
  if (p.short) {
    const miss = p.short.line.qty - p.short.shelf;
    return (
      <DockFrame>
        <NavyDock words={`${p.short.line.qty} asked · ${p.short.shelf} on shelf`} amber total={p.total}>
          <Move sending={false} locked={{ icon: 'box', label: `${miss} short` }} label="" onSell={() => undefined} />
        </NavyDock>
      </DockFrame>
    );
  }
  if (p.waits.length) {
    const under = p.waits.reduce((a, l) => a + ((l.price || 0) - (l.shopPrice || 0)) * l.qty, 0);
    return (
      <DockFrame>
        <NavyDock words={`−${Math.abs(under).toLocaleString('en-US')} · ${p.ruth} decides`} amber total={p.total}>
          <Move sending={false} locked={{ icon: 'lock', label: `Ask ${p.ruth} first` }} label="" onSell={() => undefined} />
        </NavyDock>
      </DockFrame>
    );
  }
  const notes = likelyNotes(p.total), given = s.given === 'exact' ? p.total : s.given;
  const cash = s.method === 'cash', shortBy = cash && given < p.total ? p.total - given : 0, change = cash && given > p.total;
  // Spec 04 Q6: mobile money needs its ID; a bank slip's is kept when typed.
  const needId = s.method === 'momo' && !s.ref.trim();
  const locked = off ? { icon: 'offline' as const, label: 'Back online to sell' }
    : shortBy ? { icon: 'lock' as const, label: `Short · ${shortBy.toLocaleString('en-US')}`, amber: true }
      : needId ? { icon: 'lock' as const, label: 'Type the ID first' } : null;
  const tight = !off && (sending || change || shortBy > 0 || !cash);
  const dock = (
    <NavyDock words={`Counter sale · ${p.lines.length} item${p.lines.length === 1 ? '' : 's'}`} total={p.total} tight={tight}>
      <Methods value={s.method} dim={sending} onChange={(m) => set({ method: m })} />
      {cash
        ? <Tender total={p.total} notes={notes} given={s.given} counted={s.counted} dim={sending} onPick={(v) => set({ given: v })} onCount={() => openCount(p.total)} />
        : <RefField value={s.ref} paste={s.method === 'momo'} onInput={(v) => set({ ref: v })} />}
      <Move sending={sending} locked={locked} label={`Slide to sell · ${p.total.toLocaleString('en-US')}`} onSell={() => doSell(cash ? given : 0)} />
    </NavyDock>
  );
  return (
    <DockFrame above={off ? <NoSignal /> : failed.value ? <NotSold onClose={() => { failed.value = false; }} /> : null}>{dock}</DockFrame>
  );
}

function openCount(total: number): void {
  sheet.open(() => <CountSheet total={total} />, { label: 'Count what they gave', top: 200 });
}

