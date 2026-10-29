/*
 * FACTS §2: the team at 10:41. Ids are the demo's logins ('u-grace' …);
 * a driver with no login is 'staff:<name>', as the supabase source names them.
 */
import type { Member, Role, Tint } from '../../types.ts';
import { t } from './clock.ts';

export const GRACE = 'u-grace', BRIAN = 'u-brian', FAITH = 'u-faith', RUTH = 'u-ruth', ESTHER = 'u-esther', MOSES = 'u-moses',
  DENIS = 'u-denis', MUSA = 'u-musa', JOSEPH = 'u-joseph', SSALI = 'staff:ssali', HASSAN = 'staff:hassan', COUNTER = 'u-counter';

/** Chat ids the presence points at (chats.ts uses the same). */
export const CHAT = { kato: 101, lubowa: 102, kyaligonza: 103, mukono: 104, nansana: 105, ggaba: 106, mamaShine: 107, okot: 108 } as const;

function m(id: string, name: string, initials: string, role: Role, tint: Tint, presence: Member['presence'], since: number | null, extra: Partial<Member> = {}): Member {
  return { id, name, initials, role, tint, presence, presenceSince: since, inChat: null, typingIn: null, ...extra };
}

export function people(): Member[] {
  return [
    m(GRACE, 'Grace Akello', 'GA', 'sales', 'me', 'on', t('7:50')),
    // Brian is typing a reply to Kato and has the new number open (FACTS §2; CH01, CH03).
    m(BRIAN, 'Brian Ouma', 'BO', 'sales', 't3', 'on', t('8:02'), { inChat: CHAT.mamaShine, typingIn: CHAT.kato }),
    m(FAITH, 'Faith Nambi', 'FN', 'sales', 't1', 'away', t('8:41')),
    m(RUTH, 'Ruth Nakato', 'RN', 'manager', 't2', 'on', t('7:30')),
    m(ESTHER, 'Esther Auma', 'EA', 'accounts', 't5', 'on', t('8:00')),
    m(MOSES, 'Moses Lubega', 'ML', 'sourcing', 't4', 'on', t('8:10')),
    m(DENIS, 'Denis Okello', 'DO', 'buyer', 't3', 'out', t('9:31')),
    m(MUSA, 'Musa Kiggundu', 'MK', 'store', 't4', 'on', t('7:15')),
    m(SSALI, 'Ssali', 'SS', 'driver', 't4', 'out', t('9:55')),
    m(HASSAN, 'Hassan', 'HA', 'driver', 't4', null, null),
    m(JOSEPH, 'Joseph Mukasa', 'JM', 'owner', 't1', null, null),
    // The counter team rang up the 6 counter sales before 10:41 (FACTS lead ruling); not a cast person.
    m(COUNTER, 'Counter', 'CT', 'sales', 't4', 'on', t('8:30')),
  ];
}
