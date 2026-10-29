/*
 * FACTS §4.1 and §4.2: the 12 live orders at 10:41, +3,240,000 on the move.
 * Where FACTS says "(not shown)" the lines are the demo's own, chosen from
 * the items so each order's total is FACTS' total exactly.
 *
 *   Checking 3 · 542,000    #0553 Kato, #0551 Mukono (Not paid yet · Take 1.1M), #0550 Walk-in (cancel asked)
 *   Buying 2 · 256,000      #0549 Ggaba (1 of 2 came), #0546 Lubowa (1 not found → Tell)
 *   Packing 4 · 2,221,000   #0552 Kato, #0530 Kyaligonza (late), #0556 Nansana, #0557 (the copy)
 *   On the road 3 · 221,000 #0534 Kato, #0547 Ggaba, #0555 Walk-in (ready to collect)
 */
import type { Order } from '../../types.ts';
import { L, O } from './build.ts';
import { d, t } from './clock.ts';
import { DENIS, GRACE, MUSA, RUTH, SSALI } from './people.ts';

export const KATO = 'C001', KYALIGONZA = 'C002', GGABA = 'C003', MUKONO = 'C004', NANSANA = 'C005', LUBOWA = 'C006';
const NTINDA = 'Ntinda site, Plot 12, Ntinda Rd';
const walkIn = (phone = '') => ({ name: 'Walk-in', phone });

export function liveOrders(): Order[] {
  return [
    // #0553 · Kato · today 10:16 · Checking: Ruth decides Grace's 17,000 a ridge cap (shop 18,000).
    O({ id: 553, customerId: KATO, placedAt: t('10:16'), by: GRACE, stage: 'checking', holder: RUTH,
      lines: [L('ridge-g28', 10, { price: 17000, priceBy: GRACE, priceNote: 'under', from: 'shelf', supplierId: '__stock__' })] }),
    // #0551 · Mukono · Sat 10 Oct · Checking · Not paid yet: Take 1.1M = 780,000 owed + this 320,000.
    O({ id: 551, customerId: MUKONO, placedAt: d('2026-10-10', '11:20'), by: GRACE, stage: 'checking', holder: GRACE,
      lines: [L('emulsion-cream-20', 2)] }),
    // #0550 · Walk-in · today 9:02 · Checking · Cancel asked (billAsks).
    O({ id: 550, customerId: null, client: walkIn(), placedAt: t('9:02'), by: GRACE, stage: 'checking', holder: RUTH,
      lines: [L('cement-hima-50', 1), L('wood-glue-1l', 1)] }),
    // #0549 · Ggaba · today 8:15 · Buying · 1 of 2 came.
    O({ id: 549, customerId: GGABA, placedAt: t('8:15'), by: GRACE, stage: 'buying', stageAt: t('8:40'), holder: DENIS,
      lines: [L('iron-g28-2m5', 1, { state: 'came', stateAt: t('10:20') }), L('wheelbarrow-tyre-16', 1, { from: 'supplier', supplierId: 'sup-demo', state: 'waiting' })] }),
    // #0546 · Lubowa · Sun 11 Oct · Buying · 1 not found → Grace tells them.
    O({ id: 546, customerId: LUBOWA, placedAt: d('2026-10-11', '10:05'), by: GRACE, stage: 'buying', stageAt: d('2026-10-12', '9:10'), holder: DENIS,
      lines: [L('emulsion-cream-20', 1, { state: 'came', stateAt: d('2026-10-16', '15:30') }), L('pvc-half-6m', 2), L('door-handle-set', 2, { from: 'supplier', supplierId: 'sup-demo', state: 'dropped', stateAt: t('9:45') })] }),
    // #0552 · Kato · the canvas's main order (§4.2). Placed 9:14 at Grace's 36,500; Ruth kept the shop's 38,000 at 9:28,
    // so it is 1,810,000 and Kato was told 1,750,000 ("Tell Kato · a new price", TD04). Leaves when paid.
    O({ id: 552, customerId: KATO, placedAt: t('9:14'), by: GRACE, stage: 'packing', stageAt: t('10:05'), holder: MUSA, deliverTo: NTINDA, toldTotal: 1750000,
      log: [{ stage: 'checking', at: t('9:14'), by: GRACE }, { stage: 'buying', at: t('9:31'), by: RUTH }, { stage: 'packing', at: t('10:05'), by: DENIS }],
      lines: [
        L('iron-g28-3m', 40, { from: 'shelf', supplierId: '__stock__', priceBy: GRACE, priceNote: 'under', state: 'packed', stateAt: t('10:30'),
          priceReview: { state: 'changed', price: 38000, was: 36500, by: RUTH, byName: 'Ruth Nakato', at: t('9:28') } }),
        L('wheelbarrow-hd', 2, { state: 'came', stateAt: t('10:05') }),
        L('hinge-soft-flat', 10, { state: 'dropped', stateAt: t('9:45'), priceNote: 'nocost' }),
      ] }),
    // #0530 · Kyaligonza · Tue 29 Sep · Packing since Thu 15 Oct: 2+ days, the 1 late.
    O({ id: 530, customerId: KYALIGONZA, placedAt: d('2026-09-29', '9:40'), by: GRACE, stage: 'packing', stageAt: d('2026-10-15', '9:00'), holder: MUSA,
      lines: [L('iron-g28-3m', 2), L('ridge-maroon', 8)] }),
    // #0556 · Nansana · today 10:02 · all on our shelf, Checking skipped.
    O({ id: 556, customerId: NANSANA, placedAt: t('10:02'), by: GRACE, stage: 'packing', stageAt: t('10:02'), holder: MUSA,
      log: [{ stage: 'packing', at: t('10:02'), by: GRACE }], lines: [L('cement-hima-50', 2), L('wood-glue-1l', 1)] }),
    // #0557 · the same, entered twice at 10:03; Ruth cancels the copy (OR19). Not in "Placed today".
    O({ id: 557, customerId: NANSANA, placedAt: t('10:03'), by: GRACE, stage: 'packing', stageAt: t('10:03'), holder: MUSA,
      log: [{ stage: 'packing', at: t('10:03'), by: GRACE }], lines: [L('cement-hima-50', 2), L('wood-glue-1l', 1)] }),
    // #0534 · Kato · today 8:05 · On the road with Ssali.
    O({ id: 534, customerId: KATO, placedAt: t('8:05'), by: GRACE, stage: 'road', stageAt: t('9:55'), holder: SSALI, deliverTo: NTINDA,
      lines: [L('ridge-g28', 2), L('tile-glue-20', 2)] }),
    // #0547 · Ggaba · Fri 16 Oct · On the road with Ssali.
    O({ id: 547, customerId: GGABA, placedAt: d('2026-10-16', '14:10'), by: GRACE, stage: 'road', stageAt: t('9:55'), holder: SSALI, deliverTo: 'Ggaba',
      lines: [L('gloss-white-4', 1), L('wood-glue-1l', 1), L('wood-screws-1', 1)] }),
    // #0555 · Walk-in · today 9:40 · ready to collect at the gate.
    O({ id: 555, customerId: null, client: walkIn('0772 418 905'), placedAt: t('9:40'), by: GRACE, stage: 'road', stageAt: t('10:15'), holder: null,
      lines: [L('ridge-g28', 2)] }),
  ];
}
