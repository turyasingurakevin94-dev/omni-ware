/*
 * CH05 · New chat: a light sheet over the Chats list. Who wrote lately, each with their 24-hour
 * reply window as a bar (open: hours left; shut: dashed, the shop's message only), your best
 * customers first; a search over every customer and number; one way out: New customer.
 * A row opens the chat (or the order started from it); a customer with no chat opens WhatsApp.
 */
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { orderTotal } from '../../../core/money.ts';
import { phone9 } from '../../../core/names.ts';
import { dayOf } from '../../../core/time.ts';
import type { Books, Customer } from '../../../core/types.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Duo, Icon, phClock, phSearch, phUserPlus } from '../../../ui/icons.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav, screen } from '../shell/nav.ts';
import { books, chats, drafts, now } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { ChatsList } from './List.tsx';
import { chatView, type ChatView } from './model.ts';
import './newchat.css';

/** Leaving for another screen: the sheet closes without going back (the screen takes this one's place). */
let leaving = false;
function go(id: string, params: Record<string, string | number | null>): void {
  leaving = true;
  sheet.close();
  if (screen(id)) nav.replace(id, params);
  leaving = false;
}
const goChat = (v: ChatView) => (v.draft ? go('sell/order', { customer: v.draft.customerId, from: 'chat', chat: v.chat.id }) : go('chats/chat', { id: v.chat.id }));

/** Wrote lately: in the last two days. */
const LATELY_MS = 48 * 3600 * 1000;

/** What each customer bought this year: the best first. */
function spend(b: Books, id: string | null): number {
  const year = dayOf(b.at).slice(0, 4);
  return b.orders.filter((o) => o.customerId === id && !o.cancelled && !o.voided && dayOf(o.placedAt).startsWith(year)).reduce((t, o) => t + orderTotal(o), 0);
}

function Row(p: { v: ChatView }): JSX.Element {
  const v = p.v, w = v.window;
  return (
    <Tap on={() => goChat(v)} class="nc-row">
      {v.face && <Avatar {...v.face} size={40} />}
      <span class="nc-t">
        <span>{v.title}</span>
        {w.open ? <span class="open"><Icon name="clock" size={13} stroke={2.2} /><b class="mono">{w.hoursLeft}</b> h to reply</span>
          : <span><Icon name="lock" size={13} stroke={2.2} />shut</span>}
      </span>
      <span aria-hidden="true" class={'nc-bar' + (w.open ? '' : ' shut')}>{w.open && <span style={{ width: `${Math.round(w.hoursLeft / 24 * 100)}%` }} />}</span>
    </Tap>
  );
}

/** A customer with no chat: WhatsApp on this phone, with their number. */
function Other(p: { c: Customer }): JSX.Element {
  const d = phone9(p.c.phone);
  return (
    <Tap href={d ? `https://wa.me/256${d}` : undefined} class="nc-row">
      <Avatar initials={p.c.initials} tint={p.c.tint} size={40} />
      <span class="nc-t"><span>{p.c.name}</span><span><Icon name="whatsapp" size={13} stroke={2.2} />opens WhatsApp</span></span>
    </Tap>
  );
}

function NewChatSheet(): JSX.Element {
  const [q, setQ] = useState('');
  const b = books.value, cb = chats.value, t = now.value;
  if (!b || !cb) return <LightSheet title="New chat" onClose={sheet.close}><span /></LightSheet>;
  const views = cb.chats.filter((c) => c.ownerId === b.me.id && c.lastInAt && t - c.lastInAt < LATELY_MS).map((c) => chatView(b, cb, c, t, drafts.value));
  const lately = [...views.filter((v) => v.window.open), ...views.filter((v) => !v.window.open)];
  const best = new Map(lately.map((v) => [v.chat.id, spend(b, v.chat.customerId)]));
  lately.sort((x, y) => Number(y.window.open) - Number(x.window.open) || (best.get(y.chat.id) || 0) - (best.get(x.chat.id) || 0));
  const s = q.trim().toLowerCase(), digits = s.replace(/[^0-9]/g, '');
  const hits = s ? b.customers.filter((c) => !c.qa && (c.name.toLowerCase().includes(s) || (digits.length >= 3 && c.phone.replace(/[^0-9]/g, '').includes(digits)))).slice(0, 8) : [];
  const withChat = (c: Customer) => cb.chats.find((x) => x.customerId === c.id);
  return (
    <LightSheet title="New chat" onClose={sheet.close} pad="12px 16px 24px" gap={12}
      foot={<Tap on={() => go('customers/new', digits.length >= 9 ? { phone: q.trim() } : {})} class="nc-new"><Duo i={phUserPlus} size={20} color="#FFFFFF" />New customer</Tap>}>
      <label class="nc-search">
        <Duo i={phSearch} size={20} color="#1C2233" />
        <input type="search" placeholder="Customer, or a phone number" aria-label="Customer, or a phone number" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </label>
      {!s && <div class="nc-h"><Duo i={phClock} size={18} color="#5F6980" /><span>Wrote lately</span><span><i />24 h to reply</span></div>}
      {!s && !!lately.length && <GroupCard pad={14}>{lately.map((v) => <Row key={v.chat.id} v={v} />)}</GroupCard>}
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
export function NewChatScreen(_p: ScreenProps): JSX.Element {
  useEffect(() => {
    sheet.open(() => <NewChatSheet />, { label: 'New chat', top: 236, onClose: () => { if (!leaving) nav.back(); } });
    return () => { leaving = true; if (sheet.isOpen) sheet.close(); leaving = false; };
  }, []);
  return <ChatsList params={{}} />;
}

