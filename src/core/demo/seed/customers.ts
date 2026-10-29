/*
 * FACTS §3: the six cast customers, their ledgers (§3.1), rhythms (§3.2)
 * and usuals. The debt logs are written so the open bills and their ages
 * come out as FACTS says (money.ts openCharges): Kato 420,000 under 21 days
 * (#0531 15 d, #0544 8 d); Kyaligonza 420,000 past (#0533, 54 d); Ggaba
 * 290,000 past (#0521 67 d to collect, #0528 being checked); Mukono 780,000
 * under (#0532 9 d, #0541 6 d); Nansana 0; Lubowa 0 in the books while its
 * two bills say 349,000 (a payment of 13 Oct names no bill: being checked).
 * The other 32 of the 38 are in background.ts.
 */
import type { Customer, UsualLine } from '../../types.ts';
import { C, charge, pay } from './build.ts';
import { GGABA, KATO, KYALIGONZA, LUBOWA, MUKONO, NANSANA } from './orders-live.ts';

/** Kato's and Kyaligonza's usual (LANGUAGE P09, FACTS §3.2 O7): 2,672,000. */
const USUAL: UsualLine[] = [
  { itemId: 'cement-hima-50', variantIdx: null, qty: 40, seen: 7, of: 7 },
  { itemId: 'iron-g28-3m', variantIdx: null, qty: 30, seen: 5, of: 7 },
  { itemId: 'nails-4-25kg', variantIdx: null, qty: 2, seen: 3, of: 7 },
];

export function castCustomers(): Customer[] {
  return [
    C({ id: KATO, name: 'Kato Construction', initials: 'KC', tint: 't0', phone: '0772 418 220', place: 'Ntinda', kind: 'contractor',
      address: 'Ntinda site, Plot 12, Ntinda Rd', owes: 420000, creditLimit: 2000000, everyDays: 10, usual: USUAL,
      debtLog: [
        charge('2026-10-02', 980000, 511), pay('2026-10-02', 980000, 511, 7000),
        charge('2026-10-02', 300000, 531),
        charge('2026-10-06', 3620000, 529), pay('2026-10-08', 3620000, 529, 7001),
        charge('2026-10-09', 120000, 544),
        charge('2026-10-16', 1240000, 545), pay('2026-10-16', 1000000, 545, 8000), pay('2026-10-16', 240000, 545, 8001),
      ] }),
    C({ id: KYALIGONZA, name: 'Kyaligonza & Sons', initials: 'KS', tint: 't1', phone: '0772 455 610', owes: 420000, everyDays: 14, usual: USUAL,
      debtLog: [
        charge('2026-08-24', 1110000, 533),
        pay('2026-10-09', 160000, 533, 7002), pay('2026-10-14', 142000, 533, 7005), pay('2026-10-17', 388000, 533, 9003),
        charge('2026-10-12', 865000, 535), pay('2026-10-12', 865000, 535, 7004),
      ] }),
    C({ id: GGABA, name: 'Ggaba Stores', initials: 'GS', tint: 't4', phone: '0772 503 118', place: 'Ggaba', kind: 'reseller', address: 'Ggaba', owes: 290000, everyDays: 10,
      debtLog: [
        charge('2026-08-11', 165000, 521),
        charge('2026-08-17', 125000, 264), pay('2026-08-17', 125000, 264, null, 'Cash'),
        charge('2026-08-17', 125000, 528),
        charge('2026-10-16', 119000, 548), pay('2026-10-16', 119000, 548, 8003),
      ] }),
    C({ id: MUKONO, name: 'Mukono Roofing', initials: 'MR', tint: 't3', phone: '0772 577 402', place: 'Mukono', address: 'Mukono', owes: 780000, everyDays: 7,
      debtLog: [
        charge('2026-10-08', 470000, 532),
        charge('2026-10-11', 1520000, 541), pay('2026-10-11', 1210000, 541, 7003),
      ] }),
    C({ id: NANSANA, name: 'Nansana Hardware', initials: 'NH', tint: 't5', phone: '0772 590 774', place: 'Nansana', address: 'Nansana', owes: 0, creditLimit: null, everyDays: 14,
      debtLog: [
        charge('2026-10-16', 2460000, 538), pay('2026-10-16', 1990000, 538, 8005),
        charge('2026-10-16', 85500, 536), pay('2026-10-16', 85500, 536, 8004),
        // 560,000 by Mobile at 8:52 cleared the 470,000 left; 90,000 is over, waiting for Give change or Deposit (OR15).
        pay('2026-10-17', 470000, 538, 9002),
      ] }),
    C({ id: LUBOWA, name: 'Lubowa Builders', initials: 'LB', tint: 't2', phone: '0772 410 233', place: 'Lubowa', kind: 'contractor', address: 'Lubowa', owes: 0, everyDays: 5,
      debtLog: [
        charge('2026-10-06', 180000, 539), charge('2026-10-12', 169000, 542),
        pay('2026-10-13', 349000, null, null, 'Payment — no bill named'),
        charge('2026-10-16', 380000, 540), pay('2026-10-16', 380000, 540, 8002),
      ] }),
  ];
}
