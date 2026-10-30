/*
 * Who is waiting for a reply, said once (sales.html:4103-4110 waWaiting,
 * waIsClosing): a chat whose newest message is theirs, not a closing word
 * ("thanks", "ok received"), not older than a week, and, for the
 * salesperson's own view, theirs or nobody's yet. The tab bar's count and
 * the Chats tab both read this.
 */
import { orderTotal } from './money.ts';
import { dayOf } from './time.ts';
import type { Chat, ChatBooks, Message, Ms, Order } from './types.ts';

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

export interface Served { by: string; messages: number; orders: number; total: number }

/**
 * Who served a customer this year (CH33; the lead's ruling, 30 Oct; spec 04 §4): the messages each
 * person sent in their chat (chat_served), and the orders each person took for the customer this
 * year (saved_quotes payload.takenBy) with their total. Only the Sales team's order takers count
 * orders: a Manager's order is never Sales' serving, even when she wrote in the chat (FACTS #0498;
 * the lead's ruling, 30 Oct). Biggest total first, then most messages.
 */
export function servedThisYear(orders: Order[], customerId: string, messages: { by: string; messages: number }[], year: string, sales: Set<string>): Served[] {
  const per = new Map<string, Served>();
  const get = (by: string) => { let s = per.get(by); if (!s) { s = { by, messages: 0, orders: 0, total: 0 }; per.set(by, s); } return s; };
  messages.forEach((m) => { get(m.by).messages += m.messages; });
  orders.filter((o) => o.customerId === customerId && o.placedBy && !o.voided && !o.cancelled && dayOf(o.placedAt).startsWith(year))
    .filter((o) => sales.has(o.placedBy as string))
    .forEach((o) => { const s = get(o.placedBy as string); s.orders += 1; s.total += orderTotal(o); });
  return [...per.values()].sort((a, b) => b.total - a.total || b.messages - a.messages);
}
