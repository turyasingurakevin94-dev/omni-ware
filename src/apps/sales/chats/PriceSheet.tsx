/*
 * CH21 · Send a price: their usual first (tick what goes in the message), what is often bought
 * with it in their orders, a search over the price list. An item with no price yet ("Price
 * coming") is asked of the Manager in one tap: a team note to her on this chat (wa_notes
 * mentions, so she gets a push), held 10 s for Undo. The message as it will read, then Send.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import type { Books, Customer, Item } from '../../../core/types.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Duo, Icon, phAgain, phSearch, phSparkle } from '../../../ui/icons.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { replyWindow } from '../../../core/time.ts';
import { books, chats, now } from '../shell/store.ts';
import { PriceRow, usualItems } from './AddSheet.tsx';
import { LSheet } from './LSheet.tsx';
import { managers } from './model.ts';
import { write } from './parts.tsx';
import { undoable } from './undo.tsx';
import './sheets.css';

/** "Wire nails 4" · 25kg ctn" → "Wire nails"; "Iron sheet G28 · 3m" → "Iron sheet G28". */
export const shortName = (it: Item) => it.name.split(' · ')[0].replace(/ \d.*$/, '');
/** "sheets" for an iron sheet: what an item is, plural. */
const kindOf = (it: Item) => (shortName(it).split(' ').filter((w) => !/^G\d+$/.test(w)).pop() || '').toLowerCase() + 's';

/** Often with an item in this customer's orders: k of the n orders that had its kind; then the aisle's items with no price yet. */
function oftenWith(b: Books, c: Customer | null, anchor: Item | null, skip: Set<string>): { it: Item; sub: string }[] {
  if (!c || !anchor) return [];
  const kind = shortName(anchor).replace(/ G\d+$/, '');
  const had = b.orders.filter((o) => o.customerId === c.id && !o.cancelled && o.lines.some((l) => l.name.startsWith(kind)));
  const count = new Map<string, number>();
  had.forEach((o) => new Set(o.lines.map((l) => l.itemId)).forEach((id) => count.set(id, (count.get(id) || 0) + 1)));
  const best = [...count].filter(([id]) => !skip.has(id) && !b.items.find((i) => i.id === id)?.name.startsWith(kind))
    .sort((x, y) => y[1] - x[1]).slice(0, 1)
    .map(([id, k]) => ({ it: b.items.find((i) => i.id === id) as Item, sub: `with ${kindOf(anchor)}, ${k} of ${had.length}` })).filter((x) => x.it && x.it.price != null);
  const coming = b.items.filter((i) => i.price == null && i.aisle === anchor.aisle && !skip.has(i.id)).map((it) => ({ it, sub: '' }));
  return [...best, ...coming];
}

export function PriceSheet(p: { chatId: number; picked: string[]; onPut: (s: string) => void }): JSX.Element {
  const b = books.value, cb = chats.value;
  const [picked, setPicked] = useState<string[]>(p.picked);
  const [asked, setAsked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const chat = cb && cb.chats.find((c) => c.id === p.chatId);
  if (!b || !cb || !chat) return <LSheet title="Send a price" onClose={sheet.close}><span /></LSheet>;
  const cust = chat.customerId ? b.customers.find((c) => c.id === chat.customerId) || null : null;
  const first = cust ? firstWord(cust.name) : chat.phone;
  const usual = usualItems(b, cust), back = () => { sheet.close(); };
  const anchor = b.items.find((i) => i.id === [...picked].reverse().find((id) => b.items.find((x) => x.id === id)?.aisle === 'Roofing')) || usual.map((u) => u.it).find((i) => picked.includes(i.id)) || null;
  const often = oftenWith(b, cust, anchor, new Set(usual.map((u) => u.it.id)));
  const ruth = managers(b)[0];
  const s = q.trim().toLowerCase();
  const found = s ? b.items.filter((i) => i.name.toLowerCase().includes(s)).slice(0, 6) : [];
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const lines = picked.map((id) => b.items.find((i) => i.id === id)).filter((i): i is Item => !!i && i.price != null);
  const ask = (it: Item) => {
    if (!ruth) return;
    setAsked([...asked, it.id]);
    undoable(`Sent to ${firstWord(ruth.name)} · ${it.name}`, () => write('note', [chat.id, `@${firstWord(ruth.name)} the price of ${it.name}? ${first} asks.`, [ruth.id]]),
      { top: 14, onUndo: () => setAsked((a) => a.filter((x) => x !== it.id)) });
  };
  const act = (it: Item) => {
    if (it.price == null) {
      return asked.includes(it.id)
        ? <button type="button" disabled class="pr-asked" aria-label={`Asked ${ruth ? firstWord(ruth.name) : 'the Manager'} for the price of ${it.name}`}><Icon name="check" size={14} stroke={2.6} />Asked</button>
        : <button type="button" class="pr-ask" onClick={() => ask(it)}>{`Ask ${ruth ? firstWord(ruth.name) : 'the Manager'}`}</button>;
    }
    const on = picked.includes(it.id);
    return (
      <button type="button" class={'ad-add' + (on ? ' on' : '')} aria-pressed={on} aria-label={on ? `${shortName(it)}, in the message` : `Add the price of ${shortName(it)}`} onClick={() => toggle(it.id)}>
        <Icon name={on ? 'check' : 'plus'} size={16} stroke={on ? 2.8 : 2.6} />
      </button>
    );
  };
  const send = async () => {
    if (!lines.length) return;
    const text = lines.map((i) => `${i.name}: ${money(i.price)} a ${i.unit}`).join('\n');
    sheet.close();
    await write(replyWindow(chat.lastInAt, now.value).open ? 'send' : 'sendTemplate', [chat.id, text], lines.length === 1 ? 'Price sent' : `${lines.length} prices sent`);
  };
  return (
    <LSheet ground title="Send a price" onClose={back}>
      <label class="nc-search pr-search"><Duo i={phSearch} size={20} color="#1C2233" />
        <input type="search" placeholder="Cement, iron sheets…" aria-label="Find an item" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </label>
      {s ? <GroupCard>{found.map((it) => <PriceRow key={it.id} it={it} sub={it.aisle} act={act(it)} />)}</GroupCard> : (
        <>
          {!!usual.length && <>
            <div class="ad-h"><Duo i={phSparkle} size={18} color="#0F6B43" /><span>{`${first}’s usual`}</span><span class="mono g">{`${usual.filter((u) => picked.includes(u.it.id)).length}/${usual.length}`}</span></div>
            <GroupCard>{usual.map(({ it, sub }) => <PriceRow key={it.id} it={it} sub={sub} act={act(it)} />)}</GroupCard>
          </>}
          {!!often.length && <>
            <div class="ad-h"><Duo i={phAgain} size={18} color="#5F6980" /><span>Often with it</span></div>
            <GroupCard>{often.map(({ it, sub }) => <PriceRow key={it.id} it={it} sub={it.price == null ? <span class="pr-coming"><span>Price coming</span></span> : sub} act={act(it)} />)}</GroupCard>
          </>}
        </>
      )}
      <div class="pr-foot">
        {!!lines.length && (
          <div class="pr-preview"><span>{lines.map((i, k) => <span key={i.id}>{k > 0 && <br />}{`${i.name}: `}<b class="mono">{money(i.price)}</b>{` a ${i.unit}`}</span>)}</span></div>
        )}
        <Button icon="send" state={lines.length ? 'idle' : 'disabled'} onClick={() => { void send(); }}>{lines.length === 1 ? 'Send 1 price' : `Send ${lines.length} prices`}</Button>
      </div>
    </LSheet>
  );
}
