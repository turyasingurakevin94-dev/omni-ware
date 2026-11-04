/*
 * The chats tab's own additions to the demo, owned by the chats builder (no other tab edits it).
 * Change the seeded state here when a chats board needs something FACTS.md states and the shared
 * seed does not have yet; keep it true to FACTS.md, and say which board needs it.
 *
 *   CH12  Mukono's thread: asked 10:31, a photo 10:33, Grace answered 10:38 (FACTS §5 "answered in 7 m")
 *   CH13  Nansana's Thursday thread, last written 16:02 (FACTS §1 "shut · 2 days")
 *   CH14  Mama Shine's photo with her question under it, one message (FACTS §3.4)
 *   CH15  Ggaba's morning: Faith opened at 8; "I sent 165,000 on Mobile this morning." at 10:03
 *   CH01, CH02, CH05  Kyaligonza last wrote Thu (FACTS §1 names only Kato, Lubowa, Mukono and Ggaba
 *         as writing today); Grace's answer this morning went as the shop's message
 *   CH01  Bukoto Builders, Grace's sixth chat (FACTS §2 "6 chats"), last spoke on Fri 2 Oct
 *   CH33  who served Kato this year: Grace 86 messages, Brian 31, Faith 7 (the year before the
 *         seeded thread)
 */
import { CHAT, BRIAN, FAITH, GRACE } from '../people.ts';
import { d, t } from '../clock.ts';
import type { DemoFlags } from '../../flags.ts';
import type { DemoState } from '../index.ts';
import type { Message } from '../../../types.ts';

type M = Omit<Message, 'id'>;
const inn = (chatId: number, at: number, body: string, media: string | null = null): M =>
  ({ chatId, at, dir: 'in', kind: media ? 'image' : 'text', body, by: null, state: null, media });
const out = (chatId: number, at: number, body: string, by: string, kind: Message['kind'] = 'text'): M =>
  ({ chatId, at, dir: 'out', kind, body, by, state: 'read' });

/** Each chat the boards draw whole, as they draw it. */
function threads(): Record<number, M[]> {
  const thu = (hm: string) => d('2026-10-15', hm), bukoto = (hm: string) => d('2026-10-02', hm);
  return {
    [CHAT.kyaligonza]: [
      inn(CHAT.kyaligonza, thu('9:30'), 'The 142,000 on Wednesday was Mobile, 124,000. Please check.'),
      out(CHAT.kyaligonza, t('10:12'), 'Thank you. Esther is checking it.', GRACE, 'template'),
    ],
    [CHAT.mukono]: [
      inn(CHAT.mukono, t('10:31'), 'Do you have the maroon one?'),
      inn(CHAT.mukono, t('10:33'), 'This one, 20 litres', 'aisle:Paint'),
      out(CHAT.mukono, t('10:38'), 'The maroon 20L is 185,000. We have 24.', GRACE),
    ],
    [CHAT.nansana]: [
      inn(CHAT.nansana, thu('15:38'), 'Good afternoon Grace.'),
      inn(CHAT.nansana, thu('15:40'), 'Do you have 4 inch nails?'),
      out(CHAT.nansana, thu('15:45'), 'Yes. How many cartons?', GRACE),
      inn(CHAT.nansana, thu('16:02'), 'This is the size. 3 cartons', 'aisle:Fasteners'),
      out(CHAT.nansana, thu('16:40'), 'Wire nails 4" · 25kg ctn: 96,000', GRACE),
    ],
    [CHAT.ggaba]: [
      inn(CHAT.ggaba, t('8:05'), 'Good morning. Are you open today?'),
      out(CHAT.ggaba, t('8:12'), 'Yes, we open at 8. Welcome.', FAITH),
      inn(CHAT.ggaba, t('10:03'), 'I sent 165,000 on Mobile this morning.'),
    ],
    [CHAT.mamaShine]: [
      inn(CHAT.mamaShine, t('10:37'), 'Do you have 3m iron sheets? How much?', 'aisle:Roofing'),
    ],
    109: [
      inn(109, bukoto('9:00'), 'Thank you, received.'),
      out(109, bukoto('9:20'), 'Welcome. See you next time.', GRACE),
    ],
  };
}

export function extra(s: DemoState, _f: DemoFlags): void {
  if (!s.chats.length) return;
  const redo = threads();
  // The shared seed's messages (ids m<n>) of these chats are redrawn; a message another tab's extra added (its own
  // id, as Today's busy afternoon) is kept, and keeps its id (the integration pass, 4 Nov: TD02 lost its chats).
  const base = (id: string) => /^m\d+$/.test(id);
  const kept = s.messages.filter((m) => !(m.chatId in redo) || !base(m.id));
  const all: (Omit<Message, 'id'> & { own?: string })[] = [...kept.map(({ id, ...m }) => (base(id) ? m : { ...m, own: id })), ...Object.values(redo).flat()].sort((a, b) => a.at - b.at);
  // Ids in order, so a message the demo adds later (m<n+1>) never repeats one.
  s.messages = all.map(({ own, ...m }, i) => ({ id: own || 'm' + (i + 1), ...m }));
  s.chats.forEach((c) => {
    const mine = s.messages.filter((m) => m.chatId === c.id);
    if (!mine.length || !(c.id in redo)) return;
    const ins = mine.filter((m) => m.dir === 'in');
    c.lastAt = mine[mine.length - 1].at;
    c.lastInAt = ins.length ? ins[ins.length - 1].at : null;
    if (c.lastReadAt != null) c.lastReadAt = c.lastAt;
  });
  // CH15: Esther checks Ggaba's #0528, 125,000 (FACTS §3.1: it may be #0264, paid in cash the same day).
  // A payment_asks row on the bill; added once, whichever tab's seed adds it first.
  if (!s.books.paymentAsks.some((a) => a.orderId === 528 && a.status === 'sent')) {
    s.books.paymentAsks.push({ id: 'pa-0528', paymentId: null, customerId: 'C003', orderId: 528, what: 'bill', want: {}, amount: 125000, status: 'sent', by: GRACE, at: d('2026-10-16', '11:00') });
  }
  // CH03: Brian took Okot J.'s number this morning (the chat's owner_at is when it was taken).
  const okot = s.chats.find((c) => c.id === CHAT.okot);
  if (okot) okot.ownerAt = t('8:20');
  // The orders placed from Kato's chat (payload.waConvId): #0552, named in the thread, and the others taken over it.
  [529, 552, 553, 437, 466, 511, 402].forEach((id) => { const o = s.books.orders.find((x) => x.id === id); if (o) o.chatId = CHAT.kato; });
  // CH33: the year before the seeded thread (chat_served counts every message sent this year).
  s.servedBefore[CHAT.kato] = { [GRACE]: 84, [BRIAN]: 31, [FAITH]: 7 };
}
