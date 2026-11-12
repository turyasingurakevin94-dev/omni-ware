/*
 * The Manager demo's people and customers: docs/canvas/manager/BRIEF.md "Shared data",
 * Sat 17 Oct 2026, Mukasa Hardware. Every name, tint and figure is the brief's.
 */
import { at } from '../../time.ts';
import type { Cust, Day, Ms, Person, Shop } from '../types.ts';

export const DAY: Day = '2026-10-17';
/** A moment on the sample day: t('09:40'). */
export const t = (hm: string, day: Day = DAY): Ms => at(day, hm);

const p = (id: string, name: string, initials: string, tint: Person['tint'], role: Person['role'], extra: Partial<Person> = {}): Person => ({
  id, userId: role === 'driver' ? null : 'u-' + id, name, initials, tint, role, off: false, goal: null, goalNoteId: null, sold: 0, holds: '', ...extra,
});

export function team(): Person[] {
  return [
    p('ruth', 'Ruth Nakato', 'RN', 'me', 'manager'),
    p('grace', 'Grace Akello', 'GA', 't0', 'sales', { goal: 35_000_000, goalNoteId: 'g-grace', sold: 23_400_000 }),
    p('brian', 'Brian Ouma', 'BO', 't2', 'sales', { goal: 30_000_000, goalNoteId: 'g-brian', sold: 16_170_000 }),
    p('faith', 'Faith Nambi', 'FN', 't1', 'sales', { goal: 30_000_000, goalNoteId: 'g-faith', sold: 14_910_000 }),
    p('denis', 'Denis Okello', 'DO', 't3', 'buyer', { holds: '3 orders' }),
    p('musa', 'Musa Kiggundu', 'MK', 't6', 'store', { holds: 'Packing 2' }),
    p('joy', 'Joy Namata', 'JN', 't5', 'store', { holds: 'Free' }),
    p('esther', 'Esther Auma', 'EA', 't4', 'accounts', { holds: '2.84M in' }),
    p('moses', 'Moses Lubega', 'ML', 'n', 'sourcing', { holds: 'Prices' }),
    p('peter', 'Peter Sserwadda', 'PS', 'n', 'agent', { holds: 'Agent · #0560' }),
    p('ssali', 'Ssali', 'SS', 'n', 'driver', { holds: 'On the road' }),
    p('hassan', 'Hassan', 'HA', 'n', 'driver', { off: true, holds: 'Off' }),
  ];
}

export function shop(): Shop {
  return {
    name: 'Mukasa Hardware',
    goal: 105_000_000,
    holdDays: 21,
    stageLimits: { draft: 120, awaiting_goods: 1440, preparing: 120, pending_delivery: 240 },
    defaultMarkup: 0.25,
    counterGoal: 10_000_000,
    counterSold: 6_630_000,
  };
}

const c = (id: string, name: string, initials: string, x: Partial<Cust>): Cust => ({
  id, name, initials, phone: '', place: '', owes: 0, limit: null, termsDays: null, bills: [], promises: [], sellers: [], orders: 0,
  lookAlike: null, oldBooks: null, qa: false, ...x,
});

export function customers(): Cust[] {
  return [
    c('kyaligonza', 'Kyaligonza & Sons', 'KS', {
      phone: '0772 401 118', place: 'Kawempe', owes: 2_310_000, limit: 5_000_000, termsDays: 21, sellers: ['grace', 'brian'], orders: 14,
      bills: [{ orderId: 512, day: '2026-09-09', left: 1_450_000 }, { orderId: 518, day: '2026-09-14', left: 860_000 }],
      promises: [
        { id: 'pr-1', on: '2026-09-21', madeOn: '2026-09-15', amount: 400_000, state: 'kept' },
        { id: 'pr-2', on: '2026-10-02', madeOn: '2026-09-25', amount: 1_000_000, state: 'broken' },
        { id: 'pr-3', on: '2026-10-09', madeOn: '2026-10-03', amount: 1_000_000, state: 'broken' },
      ],
    }),
    c('ggaba', 'Ggaba Stores', 'GS', {
      phone: '0772 418 330', place: 'Ggaba', owes: 1_615_000, limit: 2_000_000, termsDays: 14, sellers: ['grace'], orders: 6,
      bills: [{ orderId: 531, day: '2026-10-01', left: 1_615_000 }],
      lookAlike: { id: 'gaba', why: 'phone' }, oldBooks: { amount: 290_000, since: '2026-10-01' },
    }),
    c('gaba', 'Gaba Stores', 'GS', { phone: '0772 418 330', place: 'Ggaba', sellers: ['grace'], orders: 1, lookAlike: { id: 'ggaba', why: 'phone' } }),
    c('mukono', 'Mukono Roofing', 'MR', {
      phone: '0752 330 914', place: 'Mukono', owes: 1_214_000, limit: null, sellers: ['faith'], orders: 5,
      bills: [{ orderId: 535, day: '2026-10-05', left: 1_214_000 }],
    }),
    c('kato', 'Kato Construction', 'KC', {
      phone: '0772 418 220', place: 'Ntinda', owes: 878_000, limit: 3_000_000, termsDays: 14, sellers: ['grace'], orders: 22,
      bills: [{ orderId: 538, day: '2026-10-13', left: 438_000 }, { orderId: 544, day: '2026-10-16', left: 320_000 }, { orderId: 545, day: '2026-10-16', left: 120_000 }],
    }),
    c('lubowa', 'Lubowa Builders', 'LB', {
      phone: '0701 225 640', place: 'Lubowa', owes: 662_000, limit: 1_500_000, termsDays: 21, sellers: ['brian'], orders: 9,
      bills: [{ orderId: 547, day: '2026-09-22', left: 662_000 }],
      promises: [{ id: 'pr-4', on: '2026-10-19', madeOn: '2026-10-15', amount: 662_000, state: 'open' }],
    }),
    c('nansana', 'Nansana Hardware', 'NH', { phone: '0782 119 450', place: 'Nansana', limit: null, sellers: ['grace'], orders: 1 }),
    c('walkin', 'Walk-in', 'WI', { sellers: ['grace'] }),
  ];
}
