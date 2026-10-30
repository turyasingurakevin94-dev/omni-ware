/*
 * chats/chat · one chat (CH10–CH15, CH31; the sheets CH20, CH21, CH30 open over it). A full sheet:
 * the navy head (who, what they owe and their rhythm or place, Call, whose chip to give it, the
 * order chip or the shut chip), the strip that matters now (a new number to take, no signal,
 * a teammate typing, your reply in a teammate's chat), the thread with what the app read in it,
 * the ready answers, and the composer. Every write goes through the outbox (act).
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { orderOwes } from '../../../core/money.ts';
import { firstWord, STAGE_WORD, orderNo } from '../../../core/names.ts';
import { money, short } from '../../../core/money.ts';
import type { Books, ChatNote, Thread as ThreadData } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet, HeadChip } from '../../../ui/FullSheet.tsx';
import { Tap } from '../../../ui/util.tsx';
import { Duo, Icon, STAGE_ICON, phSparkle } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Typing } from '../../../ui/Chat.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, chats, discardKept, drafts, flush, kept, now, online, source } from '../shell/store.ts';
import type { ScreenProps } from '../shell/types.ts';
import { AddSheet } from './AddSheet.tsx';
import { PaidCard, WantsCard } from './Cards.tsx';
import { ChatComposer } from './Composer.tsx';
import { GiveSheet } from './GiveSheet.tsx';
import { chatView, faceOf, salesTeam, managers, type ChatView } from './model.ts';
import { open, write, wrote } from './parts.tsx';
import { openOrder, readyAnswers, saysPaid, wantsToBuy } from './read.ts';
import { Thread, entries } from './Thread.tsx';
import { sendPending, shown } from './undo.tsx';
import './chat.css';

/** The last thread read of each chat (the copy shown while it reads again, or with no signal). */
const copies = new Map<number, ThreadData>();
/** What was typed and not sent, per chat. */
const typed = new Map<number, string>();

/** Money being checked for a customer: their bills with an open check by Accounts (payment_asks 'bill'). */
function checking(b: Books, customerId: string): number {
  const ids = new Set(b.paymentAsks.filter((a) => a.customerId === customerId && a.what === 'bill' && a.status === 'sent' && a.orderId != null).map((a) => a.orderId));
  return b.orders.filter((o) => ids.has(o.id)).reduce((t, o) => t + orderOwes(o), 0);
}

export function ChatScreen(p: ScreenProps): JSX.Element {
  const id = Number(p.params.id);
  const b = books.value, cb = chats.value, t = now.value;
  const chat = cb ? cb.chats.find((c) => c.id === id) : null;
  const [th, setTh] = useState<ThreadData | null>(copies.get(id) || null);
  const [text, setText] = useState(typed.get(id) || '');
  const [note, setNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [, redraw] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const keptN = kept.value.length;

  // Read the thread when the chat changes (a refresh after a write, a give, a kept write sent).
  useEffect(() => {
    let live = true;
    source.thread(id).then((x) => { if (live) { copies.set(id, x); setTh(x); } }, () => { /* the copy stays */ });
    return () => { live = false; };
  }, [id, chat && chat.lastAt, chat && chat.ownerId, keptN, wrote.value]);
  // Opened: read (with signal; no signal keeps nothing for it), here for the team.
  useEffect(() => {
    if (chat && online.value && chat.lastReadAt !== chat.lastAt) void act('markRead', id).catch(() => {});
    source.touch(id, false);
    return () => { sendPending(); source.touch(null, false); };
  }, [id]);
  useEffect(() => { typed.set(id, text); }, [text]);

  if (!b || !cb || !chat) return <FullSheet onBack={nav.back} backLabel="Back to Chats" head={<div class="ow-shead chat" />} ground="#EDE7DD" />;
  const v: ChatView = chatView(b, cb, chat, t, drafts.value);
  const me = b.me, mine = chat.ownerId === me.id, nobody = !chat.ownerId, owner = v.owner, cust = v.customer;
  const msgs = th ? th.messages : cb.recent.filter((m) => m.chatId === id);
  const first = cust ? firstWord(cust.name) : v.title;
  const shut = !v.window.open;
  const order = openOrder(b, cust, msgs), named = !!order && msgs.some((m) => m.body.includes(orderNo(order.id)));
  const lastIn = [...msgs].reverse().find((m) => m.dir === 'in') || null;
  const paid = cust && cust.owes > 0 ? saysPaid(v.waitMins != null ? lastIn : null) : null;
  const wants = nobody && v.waitMins != null && lastIn ? wantsToBuy(b, lastIn.body) : [];
  const pend = shown.give && shown.give.chatId === id ? shown.give.event : null;
  const answers = ((mine && !pend) || nobody) && v.waitMins != null && !note ? readyAnswers(b, cust, msgs, t) : [];
  const notes: ChatNote[] = th ? th.notes : [], events = [...(th ? th.events : []), ...(pend ? [pend] : [])];
  const items = entries(msgs, notes, events, kept.value, id);
  const whoseNow = pend ? b.members.find((m) => m.id === pend.to) || owner : owner;

  const give = () => sheet.open(() => <GiveSheet chatId={id} onDone={() => redraw((x) => x + 1)} />, { label: `Give ${first} to…`, top: 178 });
  const add = () => sheet.open(() => <AddSheet chatId={id} onPut={(s) => setText(s)} />, { label: `Send ${first}`, top: 56 });
  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (note) {
        const named = salesTeam(b).concat(managers(b)).filter((m) => m.id !== me.id && new RegExp('@' + firstWord(m.name), 'i').test(body)).map((m) => m.id);
        if (await write('note', [id, body, named], named.length ? 'Note saved · they get a push' : 'Note saved')) { setText(''); setNote(false); }
      } else if (await write(shut ? 'sendTemplate' : 'send', [id, body])) setText('');
    } finally { setSending(false); }
  };
  const mention = note ? (text.match(/@(\w*)$/) || [null, null])[1] : null;
  const rank = (m: { typingIn: number | null; presence: string | null }) => (m.typingIn === id ? 0 : m.presence === 'on' ? 1 : 2);
  const people = mention != null ? salesTeam(b).concat(managers(b)).filter((m) => m.id !== me.id).sort((x, y) => rank(x) - rank(y)) : [];

  const sub = cust
    ? <>{cust.owes > 0 ? <>Owes <b>{paid ? money(cust.owes) : short(cust.owes)}</b></> : 'Owes nothing'}{` · ${cust.kind === 'contractor' && cust.everyDays ? `every ${cust.everyDays} days` : cust.place}`}</>
    : `“${v.waName}” · not saved`;
  const chips = (
    <>
      {nobody && !cust && <HeadChip on={() => open('customers/new', { phone: chat.phone, name: v.waName })} label="Save this number as a new customer"><Icon name="person-plus" size={15} stroke={2.2} />Save as a customer</HeadChip>}
      {whoseNow && (
        <HeadChip label={whoseNow.id === me.id ? `${firstWord(me.name)}’s. Give ${first} to a teammate` : pend ? `${firstWord(whoseNow.name)}’s customer now` : `${firstWord(whoseNow.name)}’s customer${whoseNow.presence !== 'on' ? `, ${firstWord(whoseNow.name)} is away` : ''}`}
          on={() => (whoseNow.id === me.id || me.role === 'manager' ? give() : nav.push('chats/customer', { id }))}>
          <Avatar {...faceOf(whoseNow)} size={22} class="cv-chip-face" />{`${firstWord(whoseNow.name)}’s`}
          {whoseNow.id === me.id ? <span class="cv-chip-i"><Icon name="swap" size={14} stroke={2.2} /></span> : whoseNow.presence !== 'on' && <span class="cv-chip-away">· away</span>}
        </HeadChip>
      )}
      {mine && shut ? (
        <button type="button" class="ow-hchip shut" style={{ border: 'none', background: 'transparent', font: 'inherit', color: 'inherit' }} aria-label={`The chat is shut: they last wrote ${v.window.daysShut} days ago`}>
          <span><span class="cv-chip-i amber"><Icon name="lock" size={14} stroke={2.2} /></span>shut<b>{`${v.window.daysShut} days`}</b></span>
        </button>
      ) : order && (mine || named) && (
        <HeadChip on={() => open('orders/order', { id: order.id })} label={`Order ${orderNo(order.id)}, ${STAGE_WORD[order.stage]}. Open it`}>
          <span class="cv-chip-i amber"><Icon name={STAGE_ICON[order.stage]} size={14} stroke={2.4} /></span><span class="mono" style={{ fontWeight: 600 }}>{orderNo(order.id)}</span><span class="cv-chip-dim">·</span>{STAGE_WORD[order.stage]}<span class="cv-chip-i"><Icon name="chevron-right" size={13} stroke={2.4} /></span>
        </HeadChip>
      )}
    </>
  );
  const face = cust ? faceOf(cust) : null;
  const who = (
    <>
      {face ? <Avatar {...face} size={44} /> : <span aria-hidden="true" class="cv-num mono">{chat.phone.slice(-3)}</span>}
      <span class="ow-shead-t"><span class={'ow-shead-n' + (face ? '' : ' mono')}>{v.title}</span><span class="ow-shead-s">{sub}</span></span>
    </>
  );
  const phone = ((cust && cust.phone) || chat.phone).replace(/\s/g, '');
  const head = (
    <div class="ow-shead chat">
      <span aria-hidden="true" class="ow-shead-grab" />
      <div class="ow-shead-row">
        {cust ? <Tap on={() => nav.push('chats/customer', { id })} class="ow-shead-who link">{who}</Tap> : <span class="ow-shead-who">{who}</span>}
        <Tap href={`tel:${phone}`} label={`Call ${v.title}`} class="ow-shead-call"><Icon name="phone" size={18} stroke={2} /></Tap>
        <button type="button" class="ow-shead-x" aria-label="Close" onClick={nav.back}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="ow-shead-chips">{chips}</div>
    </div>
  );
  const typing = v.typing && v.typing.id !== chat.ownerId && !note && !pend ? v.typing : null;
  const told = owner && !mine && !nobody && owner.presence !== 'on' && !pend;
  return (
    <FullSheet onBack={nav.back} backLabel="Back to Chats" ground="#EDE7DD" pad="0" gap={0} head={head}
      foot={
        <>
          {!!answers.length && (
            <div role="group" aria-label="Quick replies" class="cv-quick">
              {answers.map((a) => (
                <button key={a.text} type="button" onClick={() => setText(a.text)}>
                  <span>{a.smart && <span style={{ display: 'flex' }}><Duo i={phSparkle} size={14} color="#0F6B43" /></span>}{a.text}</span>
                </button>
              ))}
            </div>
          )}
          {mention != null && (
            <div class="cv-mention"><div role="listbox" aria-label="Name a teammate">
              {people.map((m, i) => (
                <button key={m.id} type="button" class={i === 0 ? 'on' : undefined} onClick={() => setText(text.replace(/@\w*$/, `@${firstWord(m.name)} `))}>
                  <Avatar {...faceOf(m)} size={34} font={12} />
                  <span><span>{m.name}</span><span>{m.typingIn === id ? `typing to ${first} · gets a push` : m.presence === 'on' ? `${m.role === 'manager' ? 'Manager · ' : ''}on now · gets a push` : 'away · told when back'}</span></span>
                </button>
              ))}
            </div></div>
          )}
          {note && <div class="cv-notebar"><Icon name="lock" size={15} stroke={2.2} /><span style={{ flex: 1 }}>{`Team note · ${first} never sees it`}</span></div>}
          <ChatComposer to={first} toName={v.title} value={text} onInput={setText} onSend={() => { void send(); }} note={note} onNote={() => setNote(!note)}
            shut={shut && !note} onAdd={add} sending={sending} />
        </>
      }>
      {nobody && (
        <div class="cv-take">
          {v.looking && <Avatar {...faceOf(v.looking)} size={24} />}
          <span><span>Nobody has this number yet</span><span>{v.looking ? `${firstWord(v.looking.name)} is in this chat too` : 'first to take it has it'}</span></span>
          <button type="button" onClick={() => { void write('take', [id], `${v.title} is yours`); }}><Icon name="check" size={16} stroke={2.6} />Take</button>
        </div>
      )}
      {(!online.value || keptN > 0) && items.some((x) => x.k === 'kept') && (
        <Notice kind="offline" class="cv-offline">No signal · <b class="mono">{keptN}</b> not sent yet, kept on this phone</Notice>
      )}
      {typing && <Typing face={faceOf(typing)}>{`${firstWord(typing.name)} is typing a reply`}</Typing>}
      {told && owner && (
        <div class="cv-told">
          <span><Avatar {...faceOf(me)} size={24} /><Icon name="arrow-right" size={14} stroke={2.4} /><Avatar {...faceOf(owner)} size={24} /></span>
          <span>{`Your reply shows your name · ${firstWord(owner.name)} is told`}</span>
        </div>
      )}
      <div ref={scroll} class="cv-scroll">
        <Thread items={items} members={b.members} meId={me.id} who={first} now={t} days={online.value}
          onRetry={() => { void flush(); }} onChange={(k, s) => { void discardKept(k); setText(s); }}
          tail={<>
            {mine && shut && <span class="cv-shutnote"><Icon name="lock" size={13} stroke={2.4} />shut · goes as the shop</span>}
            {!!wants.length && lastIn && <WantsCard who={v.waName || v.title} at={lastIn.at} items={wants} onStart={() => open('sell', { chat: id, items: wants.map((x) => x.id).join(',') })} />}
            {paid && cust && <PaidCard who={cust.name} paid={paid} owes={cust.owes} checked={checking(b, cust.id)} checker={firstWord((b.members.find((m) => m.role === 'accounts') || { name: 'Accounts' }).name)}
              onTake={() => open('customers/customer', { id: cust.id })} />}
          </>} />
      </div>
    </FullSheet>
  );
}
