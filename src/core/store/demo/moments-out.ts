/*
 * The two earlier moments the Out area's empty boards draw (FACTS §8 names none before 10:41; the
 * boards name their own clock, spec §2a). Each is the 10:41 day wound back: what had not happened yet
 * is taken out, nothing else.
 *
 *   &at=930   OU14 Nobody on the road: Ssali has not left (9:55); #0534 and #0547 packed, To load;
 *             #0555, #0556 and #0557 not placed yet; #0552 placed 9:14, not yet waiting on goods (9:31)
 *   &at=1010  OU15 Nobody to hand over: Ssali out since 9:55; #0555 still packing (ready 10:15);
 *             Peter Sserwadda's agent pickup #0554 placed 9:50, To pack (packed 10:20, FACTS §2)
 *
 * Gaps FACTS leaves, filled plainly: when #0534 and #0547 were packed (the seed's 9:40 and 9:45 are
 * after OU14's 9:30, which draws both packed: here 9:20 and 9:25), and who packs #0555 (Okello: Musa
 * holds #0552 from 10:05).
 */
import type { YardBooks, YardOrder } from '../types.ts';
import { line, order } from './orders.ts';
import { t } from './shop.ts';

const byId = (b: YardBooks, id: number): YardOrder | undefined => b.orders.find((x) => x.id === id);

/** The day at &at=930 or &at=1010 (any clock before 10:41 takes the latest of the two at or before it). */
export function earlier(b: YardBooks, at: number): void {
  if (at >= 1041 || at < 930) return;
  const now = at >= 1010 ? t('10:10') : t('9:30');
  b.orders = b.orders.filter((o) => (o.createdAt ?? 0) <= now);
  b.alerts = b.alerts.filter((a) => a.at <= now);
  b.found = (b.found || []).filter((f) => f.at <= now);

  // #0552: 40 pc packed 10:30 (not yet); before 10:05 not packing, before 9:31 not waiting on goods either.
  const k = byId(b, 552);
  if (k) {
    k.lines = k.lines.map((l) => ({ ...l, pickStatus: l.dropped ? l.pickStatus : null, pickedQty: null }));
    if (now < t('10:05')) {
      Object.assign(k, { status: 'draft', pickingStatus: null, pickCursor: 0, assignedWorkerId: null, pickingAssignedAt: null, workerAcceptedAt: null, bay: null });
      k.lines = k.lines.map((l) => ({ ...l, receivedAt: null, receivedQty: null }));
      k.stageLog = k.stageLog.filter((s) => s.at <= now);
    } else k.lines[1] = { ...k.lines[1], pickStatus: 'pending' };
  }

  // #0534 and #0547 before Ssali left at 9:55: packed, To load.
  if (now < t('9:55')) {
    ([[534, '9:20'], [547, '9:25']] as const).forEach(([id, hm]) => {
      const o = byId(b, id);
      if (!o) return;
      Object.assign(o, { status: 'preparing', carrier: null, assignedDeliveryId: null, pickingDoneAt: t(hm), stageEnteredAt: t(hm) });
      o.stageLog = [{ status: 'preparing', at: t(hm) }];
    });
  }

  // #0555 still packing until 10:15 (Okello), not paid.
  const w = byId(b, 555);
  if (w) {
    Object.assign(w, { status: 'preparing', pickingStatus: 'in_progress', pickingDoneAt: null, assignedWorkerId: 'st-op', pickingAssignedAt: t('9:45'), workerAcceptedAt: t('9:45'), stageEnteredAt: t('9:40') });
    w.lines = w.lines.map((l) => ({ ...l, pickStatus: 'pending', pickedQty: null }));
    w.stageLog = [{ status: 'preparing', at: t('9:40') }];
  }

  // #0554, Peter's agent pickup placed 9:50: To pack, before #0556 (placed 10:02).
  if (now >= t('9:50')) {
    const p = order(554, 'preparing', t('9:50'), {
      client: { name: 'Peter Sserwadda', phone: '0772 554 554' }, deliveryMode: 'agent_pickup', originAgentId: 'a-ps', agentSettled: true, deliverTo: '',
      lines: [line(0, 'p-wg', 4)],
    });
    const i = b.orders.findIndex((o) => o.id === 556);
    b.orders.splice(i < 0 ? b.orders.length : i, 0, p);
  }
}
