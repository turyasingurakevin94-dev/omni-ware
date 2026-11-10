/*
 * CH05 · New chat: a light sheet over the Chats list. Who wrote lately, each with their 24-hour
 * reply window as a bar (open: hours left; shut: dashed, the shop's message only), your best
 * customers first; a search over every customer and number; one way out: New customer.
 * A row opens the chat (or the order started from it); a customer with no chat opens WhatsApp.
 * CH09 · searching: "Customers n", a teammate's chat with whose it is, a customer with no chat
 * "no chat yet · opens WhatsApp". CH19 · a typed number no chat has: "Message this number · opens
 * WhatsApp" (sales.html:9975; the shop's number can only answer someone who wrote in 24 hours).
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { orderTotal } from '../../../core/money.ts';
import { phone9 } from '../../../core/names.ts';
import { dayOf } from '../../../core/time.ts';
import type { Books, Customer } from '../../../core/types.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phClock, phSearch, phUserPlus, phWhatsapp } from '../../../ui/icons.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav, resumeOrder, screen } from '../shell/nav.ts';
import { books, chats, drafts, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { ChatsList } from './List.tsx';
import { chatView, whose, type ChatView } from './model.ts';
import './newchat.css';
import { ClearButton } from '../../../ui/Search.tsx';

/** Leaving for another screen: the sheet closes without going back (the screen takes this one's place). */
let leaving = false;
function go(id: string, params: Record<string, string | number | null>): void {
  leaving = true;
  sheet.close();
  if (screen(id)) nav.replace(id, params);
  leaving = false;
}
const goChat = (v: ChatView) => (v.draft ? resumeOrder(v.draft.key) : go('chats/chat', { id: v.chat.id }));

/** Wrote lately: in the last two days. */
const LATELY_MS = 48 * 3600 * 1000;

/** What each customer bought this year: the best first. */
function spend(b: Books, id: string | null): number {
  const year = dayOf(b.at).slice(0, 4);
  return b.orders.filter((o) => o.customerId === id && !o.cancelled && !o.voided && dayOf(o.placedAt).startsWith(year)).reduce((t, o) => t + orderTotal(o), 0);
}

function Row(p: { v: ChatView }): JSX.Element {
  const v = p.v, w = v.window, me = books.value?.me;
  // A teammate's chat says whose it is (CH09: "Brian’s · shut").
  const theirs = v.owner && me && v.owner.id !== me.id ? `${whose(v.owner)} · ` : '';
  return (
    <Tap on={() => goChat(v)} class="ch-nc-row" label={theirs ? `${v.title}, ${whose(v.owner)}${w.open ? '' : ', the chat is shut'}` : undefined}>
      {v.face && <Avatar {...v.face} size={40} />}
      <span class="ch-nc-t">
        <span>{v.title}</span>
        {w.open ? <span class="open"><Icon name="clock" size={13} stroke={2.2} />{theirs}<b class="mono">{w.hoursLeft}</b> h to reply</span>
          : <span><Icon name="lock" size={13} stroke={2.2} />{`${theirs}shut`}</span>}
      </span>
      <span aria-hidden="true" class={'ch-nc-bar' + (w.open ? '' : ' shut')}>{w.open && <span style={{ width: `${Math.round(w.hoursLeft / 24 * 100)}%` }} />}</span>
    </Tap>
  );
}

/** A customer with no chat: WhatsApp on this phone, with their number (spec 04 §2a, Q11). */
function Other(p: { c: Customer }): JSX.Element {
  const d = phone9(p.c.phone);
  return (
    <a href={d ? `https://wa.me/256${d}` : undefined} target="_blank" rel="noopener" class="ch-nc-row">
      <Avatar initials={p.c.initials} tint={p.c.tint} size={40} />
      <span class="ch-nc-t"><span>{p.c.name}</span><span class="open"><Icon name="whatsapp" size={13} stroke={2.2} />no chat yet · opens WhatsApp</span></span>
      <span aria-hidden="true" class="ch-nc-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
    </a>
  );
}

/** CH19 · a typed number that no chat has: message it from WhatsApp on this phone. */
function Number_(p: { d: string; shown: string }): JSX.Element {
  return (
    <a href={`https://wa.me/256${p.d}`} target="_blank" rel="noopener" aria-label={`Message ${p.shown} on WhatsApp`} class="ch-nc-row">
      <span aria-hidden="true" class="ch-nc-wa"><Duo i={phWhatsapp} size={22} color="#0F6B43" /></span>
      <span class="ch-nc-t"><span>Message this number</span><span class="open"><Icon name="whatsapp" size={13} stroke={2.2} />opens WhatsApp</span></span>
      <span aria-hidden="true" class="ch-nc-chev"><Icon name="chevron-right" size={16} stroke={2.2} /></span>
    </a>
  );
}

function NewChatSheet(p: { q?: string }): JSX.Element {
  const [q, setQ] = useState(p.q || '');
  const b = books.value, cb = chats.value, t = now.value;
  if (!b || !cb) return <LightSheet title="New chat" onClose={sheet.close}><span /></LightSheet>;
  const views = cb.chats.filter((c) => c.ownerId === b.me.id && c.lastInAt && t - c.lastInAt < LATELY_MS).map((c) => chatView(b, cb, c, t, drafts.value));
  const lately = [...views.filter((v) => v.window.open), ...views.filter((v) => !v.window.open)];
  const best = new Map(lately.map((v) => [v.chat.id, spend(b, v.chat.customerId)]));
  lately.sort((x, y) => Number(y.window.open) - Number(x.window.open) || (best.get(y.chat.id) || 0) - (best.get(x.chat.id) || 0));
  const s = q.trim().toLowerCase(), digits = s.replace(/[^0-9]/g, '');
  const hits = s ? b.customers.filter((c) => !c.qa && (c.name.toLowerCase().includes(s) || (digits.length >= 3 && c.phone.replace(/[^0-9]/g, '').includes(digits)))).slice(0, 8) : [];
  const withChat = (c: Customer) => cb.chats.find((x) => x.customerId === c.id);
  // A whole number (9 digits, no letters): its chat if one has it, else "Message this number" (sales.html:9973-9977).
  const num = digits.length >= 9 && !/[a-z]/.test(s) ? digits.slice(-9) : '';
  const numChat = num ? cb.chats.find((x) => phone9(x.phone) === num) || null : null;
  return (
    <LightSheet title="New chat" onClose={sheet.close} pad="12px 16px 24px" gap={12}
      foot={<Tap on={() => go('customers/new', digits.length >= 9 ? { phone: q.trim() } : {})} class="ch-nc-new"><Duo i={phUserPlus} size={20} color="#FFFFFF" />New customer</Tap>}>
      <label class={'ch-nc-search' + (q ? ' on' : '')}>
        <Duo i={phSearch} size={20} color="#1C2233" />
        <input type="search" placeholder="Customer, or a phone number" aria-label="Customer, or a phone number" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        {q && <ClearButton disc={26} label="Clear the search" on={() => setQ('')} />}
      </label>
      {!s && <div class="ch-nc-h"><Duo i={phClock} size={18} color="#5F6980" /><span>Wrote lately</span><span><i />24 h to reply</span></div>}
      {!s && !!lately.length && <GroupCard pad={14}>{lately.map((v) => <Row key={v.chat.id} v={v} />)}</GroupCard>}
      {!!num && !numChat && !hits.length && <>
        <div class="ch-nc-h"><Icon name="phone" size={18} stroke={1.8} style={{ color: '#5F6980' }} /><span>No chat with this number</span></div>
        <GroupCard pad={14}><Number_ d={num} shown={q.trim()} /></GroupCard>
      </>}
      {!!numChat && !hits.some((c) => c.id === numChat.customerId) && <GroupCard pad={14}><Row v={chatView(b, cb, numChat, t, drafts.value)} /></GroupCard>}
      {!!hits.length && <div class="ch-nc-h"><Icon name="customers" size={18} stroke={1.8} style={{ color: '#5F6980' }} /><span>Customers</span><span class="mono">{hits.length}</span></div>}
      {!!hits.length && (
        <GroupCard pad={14}>{hits.map((c) => {
          const ch = withChat(c);
          return ch ? <Row key={c.id} v={chatView(b, cb, ch, t, drafts.value)} /> : <Other key={c.id} c={c} />;
        })}</GroupCard>
      )}
    </LightSheet>
  );
}

/** chats/new: the Chats list with the New chat sheet over it; closing the sheet goes back. */
export function NewChatScreen(p: ScreenProps): JSX.Element {
  const q = typeof p.params.q === 'string' ? p.params.q : '';
  useEffect(() => {
    sheet.open(() => <NewChatSheet q={q} />, { label: 'New chat', top: 236, onClose: () => { if (!leaving) nav.back(); } });
    return () => { leaving = true; if (sheet.isOpen) sheet.close(); leaving = false; };
  }, []);
  return <ChatsList params={{}} />;
}

