/*
 * FACTS §2, §3.3, §3.4, §5: the shop's WhatsApp at 10:41.
 *   Grace 6 chats · 2 waiting (Kato, Lubowa) · Brian 9 · none waiting · Faith 4 · 1 waiting (Ggaba, 38 m)
 *   the new number 0701 552 904 "Mama Shine", 4 m, nobody's yet (Brian is looking)
 * The words are the boards' (CH01, CH03, CH10).
 */
import type { Chat, ChatEvent, Message } from '../../types.ts';
import { d, t } from './clock.ts';
import { GGABA, KATO, KYALIGONZA, LUBOWA, MUKONO, NANSANA } from './orders-live.ts';
import { BRIAN, CHAT, FAITH, GRACE } from './people.ts';

function chat(id: number, waId: string, profileName: string, customerId: string | null, ownerId: string | null, lastInAt: number | null, lastAt: number, read: boolean): Chat {
  const phone = ('0' + waId.slice(3)).replace(/^(0\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
  return { id, waId, phone, profileName, customerId, ownerId, ownerAt: ownerId ? d('2026-10-12', '9:00') : null, lastInAt, lastAt, lastReadAt: read ? lastAt : null };
}

let n = 0;
const msg = (chatId: number, at: number, dir: 'in' | 'out', body: string, by: string | null = null, kind: Message['kind'] = 'text'): Message =>
  ({ id: 'm' + ++n, chatId, at, dir, kind, body, by: dir === 'out' ? by : null, state: dir === 'out' ? 'read' : null });

/** Background chats: their customer wrote, and was answered. */
const BG: [id: number, owner: string, name: string, wa: string][] = [
  [109, GRACE, 'Bukoto Builders', '256772610100'],
  ...[110, 111, 112, 113, 114, 115, 116, 117].map((id, i) => [id, BRIAN, ['Kawempe Hardware', 'Kisaasi Steel Works', 'Najjera Homes', 'Kyanja Contractors', 'Kansanga Tiles', 'Muyenga Glass', 'Bweyogerere Traders', 'Namugongo Roofing'][i], `2567726${11 + i}${String(107 + i * 7).slice(-3)}`] as [number, string, string, string]),
  ...[118, 119, 120].map((id, i) => [id, FAITH, ['Seeta Builders', 'Gayaza Hardware', 'Matugga Masons'][i], `2567726${19 + i}${String(163 + i * 7).slice(-3)}`] as [number, string, string, string]),
];

export function chats(): Chat[] {
  return [
    chat(CHAT.kato, '256772418220', 'Kato', KATO, GRACE, t('10:29'), t('10:29'), false),
    chat(CHAT.lubowa, '256772410233', 'Lubowa Builders', LUBOWA, GRACE, t('10:29'), t('10:29'), false),
    chat(CHAT.kyaligonza, '256772455610', 'Kyaligonza', KYALIGONZA, GRACE, t('10:09'), t('10:12'), true),
    chat(CHAT.mukono, '256772577402', 'Mukono Roofing', MUKONO, GRACE, t('10:33'), t('10:38'), true),
    chat(CHAT.nansana, '256772590774', 'Nansana Hardware', NANSANA, GRACE, d('2026-10-15', '16:02'), d('2026-10-15', '16:10'), true),
    chat(CHAT.ggaba, '256772503118', 'Ggaba Stores', GGABA, FAITH, t('10:03'), t('10:03'), false),
    chat(CHAT.mamaShine, '256701552904', 'Mama Shine', null, null, t('10:37'), t('10:37'), false),
    chat(CHAT.okot, '256782310117', 'Okot J.', null, BRIAN, t('8:30'), t('8:35'), true),
    // Background chats belong to the first 12 background customers (background.ts), same order and numbers.
    ...BG.map(([id, owner, name, wa], i) => chat(id, wa, name, 'C' + String(101 + i), owner, d('2026-10-16', '9:00'), d('2026-10-16', '9:20'), true)),
  ];
}

export function messages(): Message[] {
  return [
    msg(CHAT.kato, d('2026-10-16', '12:31'), 'in', 'The sheets came. Thank you.'),
    msg(CHAT.kato, t('9:02'), 'in', 'Can you do 40 iron sheets G28 by Friday? Also 2 wheelbarrows.'),
    msg(CHAT.kato, t('9:06'), 'out', 'Yes Kato. Sending the price now.', GRACE),
    msg(CHAT.kato, t('9:14'), 'out', 'Done: order #0552, 1,750,000.', GRACE),
    msg(CHAT.kato, t('10:29'), 'in', 'Can it come to the Ntinda site?'),

    msg(CHAT.lubowa, d('2026-10-14', '10:15'), 'in', 'Do you have ceiling fans, 56 inch? We need 4.'),
    msg(CHAT.lubowa, d('2026-10-14', '10:20'), 'out', 'Not yet. Moses is finding them.', GRACE),
    msg(CHAT.lubowa, t('10:29'), 'in', 'G28 iron sheets, 60 pcs?'),

    msg(CHAT.kyaligonza, t('10:09'), 'in', 'The 142,000 on Wednesday was Mobile, 124,000. Please check.'),
    msg(CHAT.kyaligonza, t('10:12'), 'out', 'Thank you. Esther is checking it.', GRACE),

    msg(CHAT.mukono, t('10:31'), 'in', 'Is the maroon roof paint in? We need 6 tins.'),
    msg(CHAT.mukono, t('10:33'), 'in', '', null, 'image'),
    msg(CHAT.mukono, t('10:38'), 'out', 'The maroon 20L is 185,000. We have 24.', GRACE),

    msg(CHAT.nansana, d('2026-10-15', '16:02'), 'in', 'How much is a carton of 4 inch nails?'),
    msg(CHAT.nansana, d('2026-10-15', '16:10'), 'out', 'Wire nails 4" · 25kg ctn: 96,000', GRACE),

    msg(CHAT.ggaba, t('10:03'), 'in', 'I sent 165,000 on Mobile this morning'),

    msg(CHAT.mamaShine, t('10:37'), 'in', '', null, 'image'),
    msg(CHAT.mamaShine, t('10:37'), 'in', 'Do you have 3m iron sheets? How much?'),

    msg(CHAT.okot, t('8:30'), 'in', 'Morning. A price for 20 bags of cement?'),
    msg(CHAT.okot, t('8:35'), 'out', '33,500 a bag. 670,000 for 20.', BRIAN),

    ...BG.flatMap(([id, owner]) => [
      msg(id, d('2026-10-16', '9:00'), 'in', 'Thank you, received.'),
      msg(id, d('2026-10-16', '9:20'), 'out', 'Welcome. See you next time.', owner),
    ]),
  ];
}

/** "Brian took 0782 310 117 "Okot J." · this morning" (CH03). */
export function chatEvents(): ChatEvent[] {
  return [{ id: 'e1', chatId: CHAT.okot, at: t('8:20'), kind: 'taken', by: BRIAN, to: BRIAN, note: '' }];
}
