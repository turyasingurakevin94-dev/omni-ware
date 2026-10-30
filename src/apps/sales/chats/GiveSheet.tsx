/*
 * CH30 · Give your customer to a teammate, with a note; CH32 · the Manager moves any chat.
 * The S04 picker (who is free, as a load bar; you first with "has it"), the note filled in from
 * the chat (the order, where, what the customer still needs to hear; or what they say they paid),
 * who gets a push, and one navy button. A give waits its 10 s Undo (hand_conversation cannot be
 * taken back); a move goes at once (both people are pushed by the server).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { firstWord } from '../../../core/names.ts';
import type { Member } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Meter } from '../../../ui/Bar.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { sheet } from '../../../ui/sheet.tsx';
import { books, chats, drafts, now, refresh } from '../shell/store.ts';
import { LSheet } from './LSheet.tsx';
import { chatView, faceOf, managers, ownedBy, salesTeam } from './model.ts';
import { Ring, write } from './parts.tsx';
import { METHOD_WORD, giveNote, saysPaid } from './read.ts';
import { shown, undoable } from './undo.tsx';
import './sheets.css';

export function GiveSheet(p: { chatId: number; onDone?: () => void }): JSX.Element {
  const b = books.value, cb = chats.value, t = now.value;
  const chat = cb && cb.chats.find((c) => c.id === p.chatId);
  const [to, setTo] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  if (!b || !cb || !chat) return <LSheet title="Give" onClose={sheet.close}><span /></LSheet>;
  const v = chatView(b, cb, chat, t, drafts.value), me = b.me, owner = v.owner;
  const move = owner?.id !== me.id;
  const first = v.customer ? firstWord(v.customer.name) : v.title;
  const waiting = (id: string) => cb.chats.filter((c) => c.ownerId === id && chatView(b, cb, c, t, []).waitMins != null).length;
  const sales = salesTeam(b).filter((m) => m.id !== me.id && m.id !== chat.ownerId)
    .sort((x, y) => waiting(x.id) - waiting(y.id) || ownedBy(cb, x.id).length - ownedBy(cb, y.id).length);
  const people: Member[] = move ? sales : [me, ...sales, ...managers(b).filter((m) => m.id !== me.id)];
  const pick = to || (sales.find((m) => m.presence === 'on') || sales[0] || people[0]).id;
  const target = b.members.find((m) => m.id === pick) as Member;
  const msgs = cb.recent.filter((m) => m.chatId === chat.id);
  const said = saysPaid([...msgs].reverse().find((m) => m.dir === 'in') || null);
  const accounts = b.members.find((m) => m.role === 'accounts');
  const filled = said && v.customer
    ? `${first} says they sent ${money(said.amount)}${said.method ? ` on ${METHOD_WORD[said.method]}` : ''}.${accounts ? ` ${firstWord(accounts.name)} checks it.` : ''}`
    : giveNote(b, v.customer, msgs, t);
  const text = note ?? filled;
  const go = () => {
    sheet.close();
    if (move) { void write('give', [chat.id, pick, text], `${v.title} is ${firstWord(target.name)}’s now`); return; }
    shown.give = { chatId: chat.id, event: { id: 'pending-give', chatId: chat.id, at: t, kind: 'handed', by: me.id, to: pick, note: text.trim() } };
    const done = () => { shown.give = null; if (p.onDone) p.onDone(); };
    undoable(`${first} is ${firstWord(target.name)}’s now`, async () => { await write('give', [chat.id, pick, text]); shown.give = null; await refresh(); }, { top: 4, onUndo: done });
    if (p.onDone) p.onDone();
  };
  return (
    <LSheet ground={move} title={move ? `Move ${v.title}` : `Give ${first} to…`}
      eyebrow={move ? `${firstWord(me.name)} · Manager · any chat` : `${v.title} · ${firstWord((owner || me).name)}’s`} onClose={sheet.close}>
      {move && owner && (
        <>
          <div class="gv-card">
            <Ring face={v.face} mins={v.waitMins} badge={faceOf(owner)} />
            <span><span>{v.title}</span><span>{v.waitMins != null ? <>waiting <b class="mono">{v.waitMins}</b> m · </> : ''}{`${firstWord(owner.name)}${owner.presence !== 'on' ? ' away' : ''}`}</span></span>
          </div>
          <div aria-hidden="true" class="gv-move">
            <span><span class={owner.presence !== 'on' ? 'dim' : undefined}><Avatar {...faceOf(owner)} size={44} /></span><b>{firstWord(owner.name)}</b></span>
            <span><i /><i /><Icon name="arrow-right" size={22} stroke={2.4} /></span>
            <span><Avatar {...faceOf(target)} size={44} ring="0 0 0 3px #F7F5F2, 0 0 0 5px #16203C" /><b>{firstWord(target.name)}</b></span>
          </div>
        </>
      )}
      <div class="gv-people">
        {people.map((m) => {
          const n = ownedBy(cb, m.id).length, w = waiting(m.id), self = m.id === me.id && !move, away = m.presence !== 'on';
          const line = m.role === 'manager' && m.id !== me.id ? `Manager · ${away ? 'away' : 'on now'} · ${n ? `${n} chats` : 'no chats'}`
            : `${self ? 'You · ' : ''}${n} chats · ${w ? `${w} waiting` : 'none waiting'}${away ? ' · away' : ''}`;
          const on = pick === m.id;
          return (
            <label key={m.id} class="gv-p">
              <span class={away ? 'dim' : undefined}><Avatar {...faceOf(m)} size={40} /><i class={away ? 'away' : undefined} /></span>
              <span><span>{m.name}</span><span>{line}</span></span>
              <Meter pct={Math.min(100, Math.round(4 + 4 * n + 2.5 * w + (away ? 10 : 0)))} w={48} h={6} fill={w >= 2 ? '#95530C' : '#0F6B43'} />
              <input type="radio" name="to" checked={on} disabled={self} aria-label={m.name} onChange={() => setTo(m.id)} />
              {self ? <span class="gv-has">has it</span> : <span aria-hidden="true" class={'gv-mark' + (on ? ' on' : '')}>{on && <Icon name="check" size={13} stroke={3} />}</span>}
            </label>
          );
        })}
      </div>
      <label class="gv-note"><span>{`A note for ${firstWord(target.name)}`}</span>
        <textarea rows={2} value={text} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
      </label>
      <div class="gv-hint"><span><Icon name="bell" size={16} stroke={2} /></span>
        <span>{move && owner ? `${firstWord(owner.name)} and ${firstWord(target.name)} get a push` : `${firstWord(target.name)} gets a push · the chat keeps a record`}</span>
      </div>
      <Button icon="hand-over" class="gv-go" onClick={go}>{`${move ? 'Move' : 'Give'} to ${firstWord(target.name)}`}</Button>
    </LSheet>
  );
}
