/*
 * The thread of one chat (S01 in the chat boards' measures): days, their bubbles and ours (each
 * of ours carries its sender), their photos, what we typed with no signal (Not sent yet · Try
 * again · Change), who gave the chat to whom and the team's notes, never sent to the customer.
 */
import type { ComponentChildren, JSX } from 'preact';
import { firstWord } from '../../../core/names.ts';
import { clock, dayLabel, dayOf } from '../../../core/time.ts';
import type { ChatEvent, ChatNote, Member, Message, Ms } from '../../../core/types.ts';
import type { Kept } from '../../../core/outbox.ts';
import { Icon } from '../../../ui/icons.tsx';
import { Pic } from './parts.tsx';

export type Entry =
  | { k: 'msg'; at: Ms; m: Message }
  | { k: 'kept'; at: Ms; id: string; text: string }
  | { k: 'event'; at: Ms; e: ChatEvent }
  | { k: 'note'; at: Ms; n: ChatNote };

/** Every entry of a thread in time order (an event before the note it carries). */
export function entries(messages: Message[], notes: ChatNote[], events: ChatEvent[], kept: Kept[], chatId: number): Entry[] {
  const out: Entry[] = [
    ...messages.map((m) => ({ k: 'msg' as const, at: m.at, m })),
    ...kept.filter((x) => x.kind === 'send' && Array.isArray(x.args) && x.args[0] === chatId)
      .map((x) => ({ k: 'kept' as const, at: x.at, id: x.id, text: String((x.args as unknown[])[1] || '') })),
    ...events.map((e) => ({ k: 'event' as const, at: e.at, e })),
    ...notes.map((n) => ({ k: 'note' as const, at: n.at, n })),
  ];
  const rank = { msg: 0, kept: 1, event: 2, note: 3 };
  return out.sort((a, b) => a.at - b.at || rank[a.k] - rank[b.k]);
}

/** Our figures in mono: order numbers and amounts with thousands ("#0552", "1,750,000"). */
function figures(text: string): ComponentChildren {
  return text.split(/(#\d{4,}|\d{1,3}(?:,\d{3})+)/).map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p));
}

function Ticks(p: { state: Message['state'] }): JSX.Element {
  const read = p.state === 'read', two = read || p.state === 'delivered';
  return (
    <span aria-label={read ? 'read' : two ? 'delivered' : 'sent'} style={{ display: 'inline-flex', color: read ? '#1A5A8A' : '#6B7480', flex: 'none' }}>
      <svg width="16" height="12" viewBox="0 0 28 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m2 10.5 4.5 4.5L16 5.5" />{two && <path d="m12 15 9.5-9.5" />}
      </svg>
    </span>
  );
}

function Theirs(p: { m: Message; last: boolean }): JSX.Element {
  const m = p.m, at = <span class="cv-at">{clock(m.at)}</span>;
  if (m.kind === 'image') {
    if (m.body.length <= 20) {
      return <div class="cv-b inline"><Pic m={m} w={52} h={52} r={12} icon={28} flat /><span><span>{m.body}</span>{at}</span></div>;
    }
    return (
      <div class="cv-b pic" style={{ width: p.last ? '240px' : '200px' }}>
        <Pic m={m} w="auto" h={p.last ? 164 : 80} r={12} icon={p.last ? 44 : 36} flat />
        <span>{m.body}</span>{at}
      </div>
    );
  }
  return <div class="cv-b"><span>{m.body || (m.kind === 'audio' ? 'Voice note' : m.kind === 'document' ? 'A file' : '')}</span>{at}</div>;
}

export interface ThreadProps {
  items: Entry[];
  members: Member[];
  meId: string;
  /** The customer's first word, for "Grace gave Kato to Brian". */
  who: string;
  now: Ms;
  /** Day chips (an offline copy shows none: it is not the day's whole thread). */
  days: boolean;
  /** Under the last entry: the shut note, a read card. */
  tail?: ComponentChildren;
  onRetry: () => void;
  onChange: (id: string, text: string) => void;
}

export function Thread(p: ThreadProps): JSX.Element {
  const name = (id: string | null) => firstWord((p.members.find((m) => m.id === id) || { name: '' }).name);
  const out: JSX.Element[] = [];
  let day = '';
  const lastMsg = [...p.items].reverse().find((x) => x.k === 'msg');
  p.items.forEach((x, i) => {
    const d = dayOf(x.at);
    if (p.days && d !== day) out.push(<span key={'d' + d} class="cv-day">{d === dayOf(p.now) ? 'Today' : dayLabel(x.at)}</span>);
    day = d;
    if (x.k === 'msg' && x.m.dir === 'in') out.push(<Theirs key={x.m.id} m={x.m} last={x === lastMsg} />);
    else if (x.k === 'msg') {
      const m = x.m;
      out.push(
        <div key={m.id} class="cv-b ours">
          {m.by && <span class="cv-who">{name(m.by)}</span>}
          <span>{m.kind === 'catalog' ? 'The catalogue' : figures(m.body)}</span>
          <span class="cv-at">{clock(m.at)}<Ticks state={m.state} /></span>
        </div>,
      );
    } else if (x.k === 'kept') {
      out.push(
        <div key={x.id} class="cv-b ours kept">
          <span class="cv-who">{name(p.meId)}</span><span>{figures(x.text)}</span>
          <span class="cv-at">{clock(x.at)}<span aria-label="not sent yet" class="warn"><Icon name="clock" size={12} stroke={2.4} /></span></span>
        </div>,
        <div key={x.id + 'a'} class="cv-ns">
          <span><Icon name="clock" size={13} stroke={2.4} />Not sent yet</span>
          <button type="button" onClick={p.onRetry}><span>Try again</span></button>
          <button type="button" onClick={() => p.onChange(x.id, x.text)}><span>Change</span></button>
        </div>,
      );
    } else if (x.k === 'event') {
      const e = x.e, words = e.kind === 'taken' ? `${name(e.by)} took ${p.who}` : `${name(e.by)} ${e.kind === 'moved' ? 'moved' : 'gave'} ${p.who} to ${name(e.to)}`;
      out.push(<span key={e.id} class="cv-event"><Icon name="hand-over" size={14} stroke={2} />{words}<b>{clock(e.at)}</b></span>);
      if (e.note) out.push(<Note key={e.id + 'n'} by={name(e.by)} at={e.at}>{e.note}</Note>);
    } else out.push(<Note key={x.n.id} by={name(x.n.by)} at={x.at}>{x.n.body}</Note>);
    void i;
  });
  return <div class="cv-thread">{out}{p.tail}</div>;
}

function Note(p: { by: string; at: Ms; children: ComponentChildren }): JSX.Element {
  return (
    <div class="cv-note">
      <span><Icon name="note" size={14} stroke={2} /><span>{`${p.by} · team note`}</span><span>{clock(p.at)}</span></span>
      <span>{p.children}</span>
    </div>
  );
}
