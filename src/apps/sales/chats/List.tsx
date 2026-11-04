/*
 * The Chats tab's root (CH01–CH04; CH06 no chats yet; CH07 loading). One head, four views:
 *   Mine     the numbers nobody has taken, yours waiting, then yours (CH01)
 *   Waiting  yours oldest first, the new number, the ones answered today (CH02)
 *   New      the new number with what they sent, and who took a number today (CH03)
 *   Team     who is on and how full their hands are; everyone's waiting (CH04)
 * A row opens the chat, or the order started from it; Take takes a new number in one tap.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { waitingChats } from '../../../core/chats.ts';
import type { DemoSource } from '../../../core/demo/index.ts';
import { firstWord } from '../../../core/names.ts';
import { clock, dayOf } from '../../../core/time.ts';
import type { Books, Chat, ChatBooks } from '../../../core/types.ts';
import { GroupCard } from '../../../ui/ActRow.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Meter } from '../../../ui/Bar.tsx';
import { Duo, Icon, phWhatsapp } from '../../../ui/icons.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { Tap } from '../../../ui/util.tsx';
import { GiveSheet } from './GiveSheet.tsx';
import { nav } from '../shell/nav.ts';
import { books, chats, drafts, isDemo, now, source } from '../shell/store.ts';
import { seen } from './undo.tsx';
import type { ScreenProps } from '../shell/types.ts';
import { Empty, Loading } from './ListEmpty.tsx';
import { ListHead, type PillFace } from './ListHead.tsx';
import { chatView, faceOf, firstSentence, listTime, managers, mineList, ownedBy, said, salesTeam, waitLine, whose, type ChatView } from './model.ts';
import { Dots, Pic, Ring, open, write } from './parts.tsx';
import './list.css';

export type Filter = 'mine' | 'waiting' | 'new' | 'team';

/** Open a row: the order started from this chat when there is one (SL04), else the chat. */
export function openChat(v: ChatView): void {
  if (v.draft) open('sell/order', { customer: v.draft.customerId, from: 'chat', chat: v.chat.id });
  else nav.push('chats/chat', { id: v.chat.id });
}

async function take(c: Chat): Promise<void> {
  if (await write('take', [c.id])) nav.push('chats/chat', { id: c.id });
}

/** The team pill: the Sales team's faces, who is on. While the chats load, the phone's copy of the team (the demo's own). */
function pill(b: Books | null): PillFace[] {
  const bk = b || (isDemo ? (source as DemoSource).state.books : null);
  return bk ? salesTeam(bk).map((m) => ({ face: faceOf(m), me: m.id === bk.me.id, away: m.presence !== 'on' })) : [];
}

export function ChatsList(p: ScreenProps): JSX.Element {
  const [filter, setFilter] = useState<Filter>(((p.params.filter as Filter) || 'mine'));
  const [q, setQ] = useState('');
  const b = books.value, cb = seen(chats.value), t = now.value;
  const manager = !!b && b.me.role === 'manager';
  const f: Filter = manager ? 'team' : filter;
  const head = (scope: 'mine' | 'team') => {
    const wl = b && cb ? waitLine(b, cb, t, scope) : null;
    const owned = b && cb ? ownedBy(cb, b.me.id).length : null;
    return (
      <ListHead count={owned} team={pill(b)} onTeam={() => setFilter('team')} onNew={() => nav.push('chats/new')} q={q} onQ={setQ}
        wait={wl && { ...wl, words: scope === 'team' ? 'waiting · the team' : wl.marks.length ? 'Waiting for a reply' : 'waiting for a reply' }} />
    );
  };
  if (!b || !cb) return <div>{head('mine')}<Loading /></div>;
  if (!cb.chats.length) return <div>{head('mine')}<Empty connected={cb.connected} /></div>;
  const mine = mineList(b, cb, t, drafts.value), owned = ownedBy(cb, b.me.id).length;
  const waits = waitingChats(cb, b.me.id, t, 'mine');
  const fresh = cb.chats.filter((c) => !c.ownerId && waits.some((w) => w.chat.id === c.id));
  const match = (v: ChatView) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const digits = s.replace(/[^0-9]/g, '');
    return [v.title, v.waName, said(v.last)].join(' ').toLowerCase().includes(s) || (digits.length >= 3 && v.chat.waId.includes(digits.replace(/^0/, '')));
  };
  return (
    <div>
      {head(f === 'team' ? 'team' : 'mine')}
      <main class="ch-main">
        {!manager && (
          <div role="group" aria-label="Show" class="ch-chips">
            {([['mine', 'Mine', owned], ['waiting', 'Waiting', waits.length], ['new', 'New', fresh.length], ['team', 'Team', null]] as [Filter, string, number | null][]).map(([k, w, n]) => (
              <button key={k} type="button" class={'ch-chip' + (f === k ? ' on' : '')} aria-pressed={f === k} onClick={() => setFilter(k)}>
                {k === 'waiting' && <i aria-hidden="true" />}{w}{n != null && <b class="mono">{n}</b>}
              </button>
            ))}
          </div>
        )}
        {f === 'mine' && <MineView rows={mine.filter(match)} />}
        {f === 'waiting' && <WaitingView b={b} cb={cb} t={t} match={match} />}
        {f === 'new' && <NewView b={b} cb={cb} t={t} match={match} />}
        {f === 'team' && <TeamView b={b} cb={cb} t={t} match={match} onNew={() => setFilter('new')} />}
      </main>
    </div>
  );
}

/* ---------------- Mine (CH01) ---------------- */

function MineView(p: { rows: ChatView[] }): JSX.Element {
  return <div class="ch-list"><GroupCard>{p.rows.map((v) => <MineRow key={v.chat.id} v={v} />)}</GroupCard></div>;
}

function Ticks(p: { read: boolean }): JSX.Element {
  return (
    <span aria-label={p.read ? 'read' : 'sent'} class={'ch-tick' + (p.read ? '' : ' grey')}>
      <svg width="16" height="12" viewBox="0 0 28 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 10.5 4.5 4.5L16 5.5" /><path d="m12 15 9.5-9.5" /></svg>
    </span>
  );
}

function MineRow(p: { v: ChatView }): JSX.Element {
  const v = p.v, me = books.value?.me, fresh = !v.chat.ownerId, last = v.last, t = now.value;
  let sub: JSX.Element;
  if (v.typing && !fresh) {
    sub = <span class="ch-typing"><span aria-hidden="true" class="ch-dots"><i /><i /><i /></span><span class="ch-ell">{`${firstWord(v.typing.name)} is typing a reply`}</span></span>;
  } else if (v.waitMins != null) {
    const words = said(last);
    sub = <><b class="mono">{`${v.waitMins} m`}</b><span aria-hidden="true" class="dot">·</span><span class="ch-ell">{fresh ? `“${firstSentence(words)}”` : words}</span></>;
  } else if (last && last.dir === 'out') {
    const who = last.by === me?.id ? 'You' : firstWord(books.value?.members.find((m) => m.id === last.by)?.name || '');
    sub = <>{v.asleep ? <span class="ch-lock"><Icon name="lock" size={14} stroke={2.2} /></span> : <Ticks read={last.state === 'read'} />}<span class="ch-ell">{`${who}: ${said(last)}`}</span></>;
  } else sub = <span class="ch-ell">{said(last)}</span>;
  const un = !fresh && v.unread > 0;
  return (
    <div class="ch-row">
      <Tap on={() => openChat(v)} class="ch-row-m">
        <Ring face={v.face} mins={v.waitMins} />
        <span class="ch-row-t">
          <span class="ch-row-1"><span class={v.face ? undefined : 'num'}>{v.title}</span><span class={'mono' + (un ? ' un' : '')}>{listTime(v.chat.lastAt, t)}</span></span>
          <span class="ch-row-2"><span>{sub}</span>{un && <span aria-label={`${v.unread} unread`} class="ch-unread">{v.unread}</span>}</span>
        </span>
      </Tap>
      {fresh && <button type="button" class="ch-take" aria-label={`Take ${v.title} as your customer`} onClick={() => { void take(v.chat); }}>Take</button>}
    </div>
  );
}

/* ---------------- the waiting rows (CH02, CH04) ---------------- */

function GroupHead(p: { title: string; n: number; dot?: 'warn' | 'bad' | null; gap?: boolean; more?: JSX.Element }): JSX.Element {
  return (
    <div class={'ch-gh' + (p.gap ? ' gap' : '') + (p.more ? ' more' : '')}>
      {p.dot && <i aria-hidden="true" class={p.dot === 'bad' ? 'bad' : undefined} />}
      <h2>{p.title}</h2>
      {p.more || <span class="mono">{p.n}</span>}
    </div>
  );
}

function WaitRow(p: { v: ChatView; sub: string; badge?: boolean; right?: JSX.Element; onRow?: () => void }): JSX.Element {
  const v = p.v, me = books.value?.me, mine = v.owner?.id === me?.id;
  const fresh = !v.chat.ownerId, late = (v.waitMins || 0) >= 30;
  return (
    <div class="ch-row w">
      <Tap on={p.onRow || (() => openChat(v))} class="ch-row-m">
        <Ring face={v.face} mins={v.waitMins} badge={p.badge && v.owner ? faceOf(v.owner) : null} />
        <span class="ch-row-t">
          <span class="ch-row-1">
            <span class={v.face ? undefined : 'num'}>{v.title}</span>
            {p.right || <b class={'mono' + (late ? ' late' : '')}>{`${v.waitMins} m`}</b>}
          </span>
          <span class="ch-row-s">{p.sub}</span>
        </span>
      </Tap>
      {fresh ? <button type="button" class="ch-take" aria-label={`Take ${v.title} as your customer`} onClick={() => { void take(v.chat); }}>Take</button>
        : v.waitMins != null && (
          <Tap on={() => openChat(v)} label={mine ? `Reply to ${v.title}` : `Reply to ${v.title}, ${firstWord(v.owner?.name || '')} is told`} class="ch-wa">
            <Duo i={phWhatsapp} size={19} color="#0F6B43" />
          </Tap>
        )}
    </div>
  );
}

function WaitingView(p: { b: Books; cb: ChatBooks; t: number; match: (v: ChatView) => boolean }): JSX.Element {
  const { b, cb, t } = p, d = drafts.value;
  const ws = waitingChats(cb, b.me.id, t, 'team');
  const views = ws.map((w) => chatView(b, cb, w.chat, t, d, ws)).filter(p.match);
  const mine = views.filter((v) => v.chat.ownerId === b.me.id), fresh = views.filter((v) => !v.chat.ownerId);
  // Answered today: they wrote today and your answer came after; how long it took.
  const answered = cb.chats.filter((c) => c.ownerId === b.me.id && c.lastInAt && dayOf(c.lastInAt) === dayOf(t) && !ws.some((w) => w.chat.id === c.id))
    .map((c) => {
      const msgs = cb.recent.filter((m) => m.chatId === c.id && dayOf(m.at) === dayOf(t));
      const reply = msgs.filter((m) => m.dir === 'out').pop();
      const asked = reply && msgs.find((m) => m.dir === 'in' && m.at <= reply.at && !msgs.some((o) => o.dir === 'out' && o.at > m.at && o.at < reply.at));
      return { v: chatView(b, cb, c, t, d, ws), mins: reply && asked ? Math.round((reply.at - asked.at) / 60000) : null };
    }).filter((x) => x.mins != null && p.match(x.v));
  const said1 = (v: ChatView) => `“${firstSentence(said(v.last))}”`;
  return (
    <div class="ch-list">
      {!!mine.length && <><GroupHead dot="warn" title={`${firstWord(b.me.name)}’s, oldest first`} n={mine.length} />
        <GroupCard>{mine.map((v) => <WaitRow key={v.chat.id} v={v} sub={said1(v)} />)}</GroupCard></>}
      {!!fresh.length && <><GroupHead dot="warn" title={fresh.length > 1 ? 'New numbers' : 'New number'} n={fresh.length} />
        <GroupCard>{fresh.map((v) => <WaitRow key={v.chat.id} v={v} sub={said1(v)} />)}</GroupCard></>}
      {!!answered.length && <><GroupHead title="Answered" n={answered.length} />
        <GroupCard>{answered.map(({ v, mins }) => (
          <WaitRow key={v.chat.id} v={v} sub={`You: ${said(v.last)}`}
            right={<span class="ch-in"><Icon name="check" size={12} stroke={3.2} />in <b class="mono">{`${mins} m`}</b></span>} />
        ))}</GroupCard></>}
    </div>
  );
}

/* ---------------- New (CH03) ---------------- */

function NewView(p: { b: Books; cb: ChatBooks; t: number; match: (v: ChatView) => boolean }): JSX.Element {
  const { b, cb, t } = p;
  const fresh = cb.chats.filter((c) => !c.ownerId).map((c) => chatView(b, cb, c, t, drafts.value)).filter((v) => v.waitMins != null && p.match(v));
  const took = cb.chats.filter((c) => c.ownerId && c.ownerAt && dayOf(c.ownerAt) === dayOf(t) && !c.customerId);
  return (
    <div class="ch-list">
      <GroupHead dot="warn" title={fresh.length > 1 ? 'New numbers' : 'New number'} n={fresh.length} />
      {fresh.map((v) => <NewCard key={v.chat.id} v={v} />)}
      {!!took.length && <GroupHead gap title="Taken today" n={took.length} />}
      {!!took.length && (
        <GroupCard>{took.map((c) => {
          const who = b.members.find((m) => m.id === c.ownerId);
          const hm = Number(clock(c.ownerAt as number).split(':')[0]);
          return (
            <div key={c.id} class="ch-took">
              {who && <Avatar {...faceOf(who)} size={36} font={12} />}
              <span class="ch-newcard-t">
                <span>{`${firstWord(who?.name || '')} took `}<span class="mono" style={{ fontWeight: 600 }}>{c.phone}</span></span>
                <span>{`“${c.profileName}” · ${hm < 12 ? 'this morning' : hm < 17 ? 'this afternoon' : 'this evening'}`}</span>
              </span>
            </div>
          );
        })}</GroupCard>
      )}
    </div>
  );
}

function NewCard(p: { v: ChatView }): JSX.Element {
  const v = p.v, last = v.last, by = v.looking;
  return (
    <div class="ch-newcard">
      <div>
        <Tap on={() => openChat(v)} class="ch-newcard-who">
          <Ring face={null} mins={v.waitMins} />
          <span class="ch-newcard-t"><span class="mono">{v.title}</span><span><b class="mono">{`${v.waitMins} m`}</b>{` · “${v.waName}”`}</span></span>
        </Tap>
        <button type="button" class="ch-take tick" aria-label={`Take ${v.title} as your customer`} onClick={() => { void take(v.chat); }}>
          <Icon name="check" size={16} stroke={2.6} />Take
        </button>
      </div>
      {last && (
        <Tap on={() => openChat(v)} class="ch-said">
          {last.kind === 'image' && <Pic m={last} w={64} h={64} r={10} icon={30} />}
          <span>{said(last)}</span>
        </Tap>
      )}
      {by && <span class="ch-here"><Avatar {...faceOf(by)} size={24} /><span>{`${firstWord(by.name)} is in this chat`}</span><Dots /></span>}
    </div>
  );
}

/* ---------------- Team (CH04) ---------------- */

function TeamView(p: { b: Books; cb: ChatBooks; t: number; match: (v: ChatView) => boolean; onNew: () => void }): JSX.Element {
  const { b, cb, t } = p;
  const ws = waitingChats(cb, b.me.id, t, 'team');
  const people = [...salesTeam(b), ...managers(b).filter((m) => m.id !== b.me.id || b.me.role === 'manager')];
  const views = ws.filter((w) => w.chat.ownerId).map((w) => chatView(b, cb, w.chat, t, drafts.value, ws)).filter(p.match);
  const fresh = ws.filter((w) => !w.chat.ownerId).length;
  const manager = b.me.role === 'manager';
  return (
    <div class="ch-list" style={manager ? { padding: 0 } : undefined}>
      <div class={'ch-strip' + (manager ? ' flat' : '')}>
        {people.map((m) => {
          const n = ownedBy(cb, m.id).length, waiting = ws.filter((w) => w.chat.ownerId === m.id).length, mgr = m.role === 'manager';
          return (
            <div key={m.id} class={'ch-mate' + (m.id === b.me.id ? ' me' : '')}>
              <span><span class={m.presence === 'on' ? undefined : 'away-face'} style={{ display: 'flex' }}><Avatar {...faceOf(m)} size={40} /></span><i aria-hidden="true" class={m.presence === 'on' ? undefined : 'away'} /></span>
              <b>{m.id === b.me.id ? 'You' : firstWord(m.name)}</b>
              <Meter pct={Math.round(Math.min(12, n) / 12 * 100)} w={48} h={6} fill={waiting >= 2 ? '#95530C' : '#0F6B43'} />
              {mgr ? <span>Manager</span> : <span><b class="mono">{n}</b> chats</span>}
              {mgr ? <span>{m.presence === 'on' ? 'on now' : 'away'}</span>
                : waiting ? <span class="warn"><b class="mono">{waiting}</b>{' waiting'}</span> : <span>none waiting</span>}
            </div>
          );
        })}
      </div>
      <GroupHead dot="bad" title="Waiting, oldest first" n={views.length}
        more={fresh ? <Tap on={p.onNew}>{`+${fresh} new`}<Icon name="chevron-right" size={14} stroke={2.4} /></Tap> : undefined} />
      <GroupCard>{views.map((v) => {
        const sub = v.typing ? `${firstWord(v.typing.name)} is typing a reply` : `${whose(v.owner)}${v.owner && v.owner.presence !== 'on' ? ' · away' : ''}`;
        // The Manager moves any teammate's chat from here (CH32); the WhatsApp disc still opens it.
        const move = manager && v.owner && v.owner.id !== b.me.id
          ? () => sheet.open(() => <GiveSheet chatId={v.chat.id} />, { label: `Move ${v.title}`, top: 196 }) : undefined;
        return <WaitRow key={v.chat.id} v={v} sub={sub} badge onRow={move} />;
      })}</GroupCard>
    </div>
  );
}
