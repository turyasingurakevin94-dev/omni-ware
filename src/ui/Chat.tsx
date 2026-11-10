/*
 * S01 · Chat bubbles (LANGUAGE.md §5.2 S01). The chat is a full sheet
 * (FullSheet + SheetHead pad="chat" with HeadChips) on the chat ground
 * #EDE7DD; the composer is Composer.tsx.
 *
 *   <Typing face={{ initials: 'BO', tint: 't3' }}>Brian is typing a reply</Typing>     the green strip under the head
 *   <ChatDay>Today</ChatDay>                                                          a centred pill (also the system line)
 *   <Bubble from="theirs" at="9:02">Can you do 40 iron sheets…</Bubble>
 *   <Bubble from="ours" who="Grace" at="9:06" read>Yes Kato. Sending the price now.</Bubble>
 *   <Bubble from="ours" who="Grace" at="9:20" notSent>…</Bubble>                       at 70%, "Not sent yet" under it
 *   <TeamNote who="Grace">Brian, #0552 leaves only when Kato pays 1,810,000.</TeamNote>  never sent to the customer
 *   <ChatThread>…bubbles…</ChatThread>                                                the ground and its spacing
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar, type Face } from './Avatar.tsx';
import { Icon } from './icons.tsx';
import { cx } from './util.tsx';
import './chat.css';

export function ChatThread(p: { children: ComponentChildren }): JSX.Element {
  return <div class="ow-thread">{p.children}</div>;
}

export function ChatDay(p: { children: ComponentChildren }): JSX.Element {
  return <span class="ow-chatday">{p.children}</span>;
}

export interface BubbleProps {
  from: 'theirs' | 'ours';
  /** Ours: the sender's first name on top (each reply carries its sender). */
  who?: string;
  at: string;
  /** Ours: read (the tick blue). */
  read?: boolean;
  notSent?: boolean;
  children: ComponentChildren;
}

export function Bubble(p: BubbleProps): JSX.Element {
  const ours = p.from === 'ours';
  return (
    <div class={cx('ow-bubble', ours ? 'ours' : 'theirs', p.notSent && 'notsent')}>
      {ours && p.who && <span class="ow-bubble-who">{p.who}</span>}
      {p.children}
      <span class="mono ow-bubble-at">{p.at}{ours && !p.notSent && <span class={cx('ow-bubble-tick', p.read && 'read')}><Icon name="check" size={13} stroke={2.6} /></span>}</span>
      {p.notSent && <span class="ow-bubble-ns"><Icon name="clock" size={12} stroke={2.4} />Not sent yet</span>}
    </div>
  );
}

export function TeamNote(p: { who: string; children: ComponentChildren }): JSX.Element {
  return (
    <div class="ow-note">
      <span class="ow-note-h"><Icon name="note" size={14} stroke={2} />{`${p.who} · team note`}</span>
      <span class="ow-note-t">{p.children}</span>
    </div>
  );
}

/** The green strip under the head while a teammate is typing. */
export function Typing(p: { face: Face; children: ComponentChildren }): JSX.Element {
  return (
    <div role="status" class="ow-typing">
      <Avatar {...p.face} size={22} />
      <span class="ow-typing-t">{p.children}</span>
      <span aria-hidden="true" class="ow-typing-dots"><i /><i /><i /></span>
    </div>
  );
}
