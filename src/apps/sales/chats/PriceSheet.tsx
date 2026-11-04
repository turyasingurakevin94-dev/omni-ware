/*
 * CH21 · Send a price: their usual first (tick what goes in the message), what is often bought
 * with it (P13), a search over the price list. An item with no price yet ("Price coming", CH34)
 * is asked of the Manager in one tap: a team note to her on this chat (wa_notes
 * mentions, so she gets a push), held 10 s for Undo. The message as it will read, then Send.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import { oftenWith } from '../../../core/often.ts';
import type { Books, Customer, Item } from '../../../core/types.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Duo, Icon, phAgain, phSearch, phSparkle } from '../../../ui/icons.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { replyWindow } from '../../../core/time.ts';
import { books, chats, now } from '../shell/store.ts';
import { PriceRow, usualItems } from './AddSheet.tsx';
import { managers } from './model.ts';
import { write } from './parts.tsx';
import { undoable } from './undo.tsx';
import './sheets.css';

/** "Wire nails 4" · 25kg ctn" → "Wire nails"; "Iron sheet G28 · 3m" → "Iron sheet G28". */
export const shortName = (it: Item) => it.name.split(' · ')[0].replace(/ \d.*$/, '');
/** "sheets" for an iron sheet: what an item is, plural. */
const kindOf = (it: Item) => (shortName(it).split(' ').filter((w) => !/^G\d+$/.test(w)).pop() || '').toLowerCase() + 's';

interface Often { it: Item; whose: string; rows: { it: Item; sub: string }[] }

/**
 * "Often with it" (LANGUAGE P13, the one rule: core/often.ts, agent.html:8890): the top two by count of
 * what came with "it", each with how many of those orders had it, less what the sheet shows already.
 * On the sheet, "it" is the last of their usual ticked that they have had twice or more, else the
 * first of their usual that they have (their own orders only). Searching, "it" is the item found
 * first, counted as the rule counts it (theirs, else mine; the header says which).
 */
function oftenFor(b: Books, c: Customer | null, tries: Item[], skip: Set<string>, theirsOnly: boolean): Often | null {
  for (const it of tries) {
    const r = oftenWith(b.orders, { itemId: it.id, variantIdx: null }, { customerId: c ? c.id : null, me: b.me.id, skip, n: 2 });
    if ((theirsOnly && !r.theirs) || !r.rows.length) continue;
    const rows = r.rows.map((x) => ({ it: b.items.find((i) => i.id === x.itemId), n: x.n })).filter((x): x is { it: Item; n: number } => !!x.it);
    return { it, whose: r.theirs && c ? `in ${firstWord(c.name)}’s orders` : 'in your orders', rows: rows.map((x) => ({ it: x.it, sub: `with ${kindOf(it)}, ${x.n} of ${r.of}` })) };
  }
  return null;
}

export function PriceSheet(p: { chatId: number; picked: string[]; onPut: (s: string) => void; onSent?: () => void }): JSX.Element {
  const b = books.value, cb = chats.value;
  const [picked, setPicked] = useState<string[]>(p.picked);
  const [asked, setAsked] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const chat = cb && cb.chats.find((c) => c.id === p.chatId);
  if (!b || !cb || !chat) return <LightSheet pad="12px 16px 22px" title="Send a price" onClose={sheet.close}><span /></LightSheet>;
  const cust = chat.customerId ? b.customers.find((c) => c.id === chat.customerId) || null : null;
  const first = cust ? firstWord(cust.name) : chat.phone;
  const usual = usualItems(b, cust), back = () => { sheet.close(); };
  const theirs = new Set(usual.map((u) => u.it.id));
  const ruth = managers(b)[0];
  const s = q.trim().toLowerCase();
  const found = s ? b.items.filter((i) => i.name.toLowerCase().includes(s)).slice(0, 6) : [];
  const often = s
    ? oftenFor(b, cust, found.slice(0, 1), new Set([...picked, ...found.map((i) => i.id)]), false)
    : oftenFor(b, cust, [...[...picked].reverse().filter((id) => theirs.has(id)), ...theirs].map((id) => b.items.find((i) => i.id === id)).filter((i): i is Item => !!i), theirs, true);
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const lines = picked.map((id) => b.items.find((i) => i.id === id)).filter((i): i is Item => !!i && i.price != null);
  const ask = (it: Item) => {
    if (!ruth) return;
    setAsked([...asked, it.id]);
    undoable(`Sent to ${firstWord(ruth.name)} · ${it.name}`, () => write('note', [chat.id, `@${firstWord(ruth.name)} the price of ${it.name}? For ${first}.`, [ruth.id]]),
      { top: 14, onUndo: () => setAsked((a) => a.filter((x) => x !== it.id)) });
  };
  const act = (it: Item) => {
    if (it.price == null) {
      return asked.includes(it.id)
        ? <button type="button" disabled class="ch-pr-asked" aria-label={`Asked ${ruth ? firstWord(ruth.name) : 'the Manager'} for the price of ${it.name}`}><Icon name="check" size={14} stroke={2.6} />Asked</button>
        : <button type="button" class="ch-pr-ask" aria-label={`Ask ${ruth ? firstWord(ruth.name) : 'the Manager'} for the price of ${it.name}`} onClick={() => ask(it)}>{`Ask ${ruth ? firstWord(ruth.name) : 'the Manager'}`}</button>;
    }
    const on = picked.includes(it.id);
    return (
      <button type="button" class={'ch-ad-add' + (on ? ' on' : '')} aria-pressed={on} aria-label={on ? `${shortName(it)}, in the message` : `Add the price of ${shortName(it)}`} onClick={() => toggle(it.id)}>
        <Icon name={on ? 'check' : 'plus'} size={16} stroke={on ? 2.8 : 2.6} />
      </button>
    );
  };
  const coming = <span class="ch-pr-coming"><span>Price coming</span></span>;
  const send = async () => {
    if (!lines.length) return;
    const text = lines.map((i) => `${i.name}: ${money(i.price)} a ${i.unit}`).join('\n');
    if (p.onSent) p.onSent();
    sheet.close();
    await write(replyWindow(chat.lastInAt, now.value).open ? 'send' : 'sendTemplate', [chat.id, text], lines.length === 1 ? 'Price sent' : `${lines.length} prices sent`);
  };
  return (
    <LightSheet pad="12px 16px 22px" ground title="Send a price" onClose={back}>
      <label class="ch-nc-search ch-pr-search"><Duo i={phSearch} size={20} color="#1C2233" />
        <input type="search" placeholder="Cement, iron sheets…" aria-label="Find an item" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </label>
      {s ? <GroupCard class="ch-bb">{found.map((it) => <PriceRow key={it.id} it={it} sub={it.price == null ? coming : it.aisle} act={act(it)} />)}</GroupCard>
        : !!usual.length && <>
          <div class="ch-ad-h"><Duo i={phSparkle} size={18} color="#0F6B43" /><span>{`${first}’s usual`}</span><span class="mono g">{`${usual.filter((u) => picked.includes(u.it.id)).length}/${usual.length}`}</span></div>
          <GroupCard class="ch-bb">{usual.map(({ it, sub }) => <PriceRow key={it.id} it={it} sub={sub} act={act(it)} />)}</GroupCard>
        </>}
      {often && <>
        <div class="ch-ad-h"><Duo i={phAgain} size={18} color="#5F6980" /><span>Often with it</span><span>{often.whose}</span></div>
        <GroupCard class="ch-bb">{often.rows.map(({ it, sub }) => <PriceRow key={it.id} it={it} sub={it.price == null ? coming : sub} act={act(it)} />)}</GroupCard>
      </>}
      <div class="ch-pr-foot">
        {!!lines.length && (
          <div class="ch-pr-preview"><span>{lines.map((i, k) => <span key={i.id}>{k > 0 && <br />}{`${i.name}: `}<b class="mono">{money(i.price)}</b>{` a ${i.unit}`}</span>)}</span></div>
        )}
        <Button icon="send" state={lines.length ? 'idle' : 'disabled'} onClick={() => { void send(); }}>{lines.length === 0 ? 'Send a price' : lines.length === 1 ? 'Send 1 price' : `Send ${lines.length} prices`}</Button>
      </div>
    </LightSheet>
  );
}
