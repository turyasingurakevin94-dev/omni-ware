/*
 * CH20 · The chat's + (the paper clip): what to send, fewest taps first. The answer to what they
 * just wrote (Use puts it in the box), the prices of their usual (+ opens Send a price with it
 * picked), quick replies into the box, then other prices, the shop's catalogue and a photo.
 */
import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { money, short } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import type { Books, Customer, Item } from '../../../core/types.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Duo, Icon, phSparkle } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Tap } from '../../../ui/util.tsx';
import { books, chats, now } from '../shell/store.ts';
import { LSheet } from './LSheet.tsx';
import { open, write } from './parts.tsx';
import { PriceSheet, shortName } from './PriceSheet.tsx';
import { readyAnswers } from './read.ts';
import './sheets.css';

const QUICK = ['We have it', 'Price coming', 'Let me check', 'We are checking it', 'Yes, we deliver', 'Send your location'];

/** Their usual, as items with how often they are in their orders. */
export function usualItems(b: Books, c: Customer | null): { it: Item; sub: string }[] {
  if (!c) return [];
  return c.usual.map((u) => ({ it: b.items.find((i) => i.id === u.itemId) as Item, sub: u.seen >= u.of ? 'every order' : `${u.seen} of ${u.of} orders` })).filter((x) => x.it);
}

export function PriceRow(p: { it: Item; sub: JSX.Element | string; act: JSX.Element }): JSX.Element {
  return (
    <div class="ch-ad-row">
      <ItemSquare aisle={p.it.aisle} size={38} radius={10} icon={22} />
      <span><span>{p.it.name}</span>{typeof p.sub === 'string' ? <span class="mono">{p.sub}</span> : p.sub}</span>
      {p.it.price != null && <span class="ch-ad-pr"><b class="mono">{money(p.it.price)}</b><small>{`a ${p.it.unit}`}</small></span>}
      {p.act}
    </div>
  );
}

export function AddSheet(p: { chatId: number; onPut: (text: string) => void }): JSX.Element {
  const b = books.value, cb = chats.value, file = useRef<HTMLInputElement>(null);
  const chat = cb && cb.chats.find((c) => c.id === p.chatId);
  if (!b || !cb || !chat) return <LSheet title="Send" onClose={sheet.close}><span /></LSheet>;
  const cust = chat.customerId ? b.customers.find((c) => c.id === chat.customerId) || null : null;
  const first = cust ? firstWord(cust.name) : chat.phone;
  const answers = readyAnswers(b, cust, cb.recent.filter((m) => m.chatId === chat.id), now.value);
  const said = answers.map((a) => a.text.replace(/\.$/, '')).join('. ') + '.';
  const put = (s: string) => { sheet.close(); p.onPut(s); };
  const price = (pick: string[]) => sheet.open(() => <PriceSheet chatId={p.chatId} picked={pick} onPut={p.onPut} />, { label: 'Send a price', top: 84 });
  const usual = usualItems(b, cust);
  const photo = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    sheet.close();
    await write('sendImage', [chat.id, f, ''], 'Photo sent');
  };
  return (
    <LSheet title={`Send ${first}`} onClose={sheet.close}
      extra={cust && cust.owes > 0 && (
        <Tap on={() => { sheet.close(); open('customers/customer', { id: cust.id }); }} class="ch-ad-owes"><span>Owes <b class="mono">{short(cust.owes)}</b><Icon name="chevron-right" size={13} stroke={2.4} /></span></Tap>
      )}>
      {!!answers.length && (
        <>
          <div class="ch-ad-h"><Duo i={phSparkle} size={18} color="#0F6B43" /><span>For what they just wrote</span></div>
          <button type="button" class="ch-ad-use" onClick={() => put(said)}><span>{said}</span><span><Icon name="plus" size={14} stroke={2.6} />Use</span></button>
        </>
      )}
      {!!usual.length && (
        <>
          <div class="ch-ad-h"><span class="g"><Icon name="tag" size={17} stroke={2} /></span><span>Prices of their usual</span><span>tap + to add</span></div>
          <GroupCard class="ch-bb">{usual.map(({ it, sub }) => (
            <PriceRow key={it.id} it={it} sub={sub} act={
              <button type="button" class="ch-ad-add" aria-label={`Add the price of ${shortName(it)}`} onClick={() => price([it.id])}><Icon name="plus" size={16} stroke={2.6} /></button>
            } />
          ))}</GroupCard>
        </>
      )}
      <div class="ch-ad-h"><span class="s"><Icon name="message" size={17} stroke={2} /></span><span>Quick replies</span><span>into the box</span></div>
      <div role="group" aria-label="Quick replies" class="ch-ad-quick">{QUICK.map((q) => <button key={q} type="button" onClick={() => put(q)}>{q}</button>)}</div>
      <div class="ch-ad-tiles">
        <Tap on={() => price([])} class="ch-ad-tile"><span class="g"><Icon name="tag" size={19} stroke={1.9} /></span><b>Other prices</b><span>the price list</span></Tap>
        <Tap on={() => { sheet.close(); void write('sendCatalog', [chat.id], 'Catalogue sent'); }} class="ch-ad-tile"><span class="i"><Icon name="grid" size={19} stroke={1.9} /></span><b>Catalogue</b><span>our items</span></Tap>
        <Tap on={() => file.current?.click()} class="ch-ad-tile"><span class="n"><Icon name="camera" size={19} stroke={1.9} /></span><b>Photo</b><span>or a picture</span></Tap>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void photo(e); }} />
      </div>
    </LSheet>
  );
}
