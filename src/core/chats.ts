/*
 * Who is waiting for a reply, said once (sales.html:4103-4110 waWaiting,
 * waIsClosing): a chat whose newest message is theirs, not a closing word
 * ("thanks", "ok received"), not older than a week, and, for the
 * salesperson's own view, theirs or nobody's yet. The tab bar's count and
 * the Chats tab both read this.
 */
import type { Chat, ChatBooks, Message, Ms } from './types.ts';

/** A week: an older last word is not someone waiting (sales.html WA_WAIT_MAX_MINS, SAL-08). */
export const WAIT_MAX_MS = 7 * 24 * 3600 * 1000;

/** "Thanks", "ok, received", "webale": the end of a conversation, not a question (sales.html:4101 waIsClosing). */
export function isClosing(body: string): boolean {
  const s = String(body || '').trim().toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return false;
  return s.split(' ').length <= 4 && /^(ok(ay)?|okey|thanks?( you)?|thank you( so much| very much)?|thx|received|noted|well received|welcome|fine|great|good|alright|sure|asante|webale( nyo)?|ok thanks|ok thank you|thanks received|received thanks|ok received|got it)$/.test(s);
}

/** Each chat's newest message. */
export function lastMessages(recent: Message[]): Map<number, Message> {
  const m = new Map<number, Message>();
  recent.forEach((x) => { const cur = m.get(x.chatId); if (!cur || x.at >= cur.at) m.set(x.chatId, x); });
  return m;
}

export interface Waiting { chat: Chat; last: Message; since: Ms }

/**
 * Chats waiting for a reply, longest wait first. scope 'mine': the salesperson's own and the
 * new numbers nobody has taken; 'team': everyone's (CH04).
 */
export function waitingChats(cb: ChatBooks, meId: string, now: Ms, scope: 'mine' | 'team' = 'mine'): Waiting[] {
  const last = lastMessages(cb.recent), out: Waiting[] = [];
  cb.chats.forEach((c) => {
    if (scope === 'mine' && c.ownerId && c.ownerId !== meId) return;
    const m = last.get(c.id);
    if (!m || m.dir !== 'in' || isClosing(m.body) || now - m.at > WAIT_MAX_MS) return;
    // How long, from their last message (sales.html waWaiting measures it so).
    out.push({ chat: c, last: m, since: m.at });
  });
  return out.sort((a, b) => a.since - b.since);
}
