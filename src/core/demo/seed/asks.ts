/*
 * FACTS §6 "Asks" and §5 "Asked of Sourcing: 4 = 1 asked · 1 looking · 1 found · 0 priced · 1 listed".
 */
import type { SourcingAsk } from '../../types.ts';
import { d, t } from './clock.ts';
import { KATO, LUBOWA, MUKONO, NANSANA } from './orders-live.ts';
import { GRACE } from './people.ts';

export function sourcingAsks(): SourcingAsk[] {
  return [
    { id: 'SRC-PUMP', name: 'Solar water pump 1hp', status: 'asked', createdAt: t('9:20'), stageAt: t('9:20'), itemId: null,
      requests: [{ at: t('9:20'), by: GRACE, customerId: KATO, qty: 2 }], tried: [] },
    { id: 'SRC-FAN', name: 'Ceiling fan, 56 inch', status: 'looking', createdAt: d('2026-10-14', '10:20'), stageAt: d('2026-10-14', '11:00'), itemId: null,
      requests: [{ at: d('2026-10-14', '10:20'), by: GRACE, customerId: LUBOWA, qty: 4 }],
      tried: [{ supplier: 'Katwe Fabricators', at: d('2026-10-14', '11:00') }, { supplier: 'Kiseka Steel', at: d('2026-10-15', '10:00') }, { supplier: 'Owino Plumbing', at: d('2026-10-16', '10:00') }] },
    { id: 'SRC-CUTTER', name: 'Tile cutter 600mm', status: 'found', createdAt: d('2026-10-15', '16:15'), stageAt: d('2026-10-16', '14:00'), itemId: null,
      requests: [{ at: d('2026-10-15', '16:15'), by: GRACE, customerId: NANSANA, qty: 1 }], tried: [] },
    { id: 'SRC-PAINT', name: 'Roof paint · maroon 20L', status: 'listed', createdAt: d('2026-10-15', '9:00'), stageAt: t('10:34'), itemId: 'roof-paint-maroon-20',
      requests: [{ at: d('2026-10-15', '9:00'), by: GRACE, customerId: MUKONO, qty: 6 }], tried: [] },
  ];
}
