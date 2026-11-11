/*
 * A job, said on Today: as the Next job card (JobCard) and as a Needs you row. The rule of which job
 * comes first is core/store/jobs.ts; this file only words and draws one (TD01–TD04, TD09, TD32).
 */
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { aisleLetter, countAge } from '../../../core/store/counts.ts';
import { orderFace, personFace, shortName, supplierFace, whoIs } from '../../../core/store/faces.ts';
import { CLOSE_FROM, type Job } from '../../../core/store/jobs.ts';
import { canClose, checksDone, closeChecks, closeFigures } from '../../../core/store/shift.ts';
import { readAside } from './aside.ts';
import type { YardBooks, YardLine, YardOrder } from '../../../core/store/types.ts';
import { destinationOf, isPickup, moneyHeld, NOT_PAID } from '../../../core/store/yard.ts';
import { clock, howLong } from '../../../core/time.ts';
import type { TileTone } from '../../../ui/ActRow.tsx';
import type { IconName } from '../../../ui/icons.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Dot, type JobCardProps, type JobTile } from './JobCard.tsx';

/** What a person calls an item on a tile: "Iron sheet G28 · 3m" → "Iron sheet", "Soft close hinge · flat" → "Hinge". */
export function itemWord(name: string): string {
  const words = name.split(' · ')[0].split(',')[0].split(/\s+/).filter((w) => w && !/\d|["”]/.test(w));
  const w = words.length > 2 ? words[words.length - 1] : words.join(' ');
  return w ? w[0].toUpperCase() + w.slice(1) : name;
}

const aisleOf = (b: YardBooks, key: string): string | null => (b.items.find((i) => i.key === key) || { category: null }).category;
const live = (o: YardOrder): YardLine[] => o.lines.filter((l) => !l.dropped);
const seller = (b: YardBooks, o: YardOrder) => whoIs(b, o.takenBy);
const tripName = (b: YardBooks, j: Job): string => {
  const t0 = j.trips?.[0];
  if (!t0) return 'Trip';
  if (t0.runnerId === '__supplier__') return t0.supplierName;
  const p = whoIs(b, t0.runnerId);
  return `${p ? firstWord(p.name) : 'The'}'s trip`;
};

function lineTiles(b: YardBooks, o: YardOrder, withLetter: boolean): JobTile[] {
  return o.lines.map((l) => {
    const aisle = aisleOf(b, l.key), mark = l.dropped ? 'drop' : l.pickStatus === 'done' ? 'done' : o.pickingStatus === 'in_progress' ? 'wait' : undefined;
    const letter = withLetter ? aisleLetter(b, aisle) : '';
    return { aisle: aisle || 'other', text: `${l.qty} ${l.unit}`, sub: letter ? `${itemWord(l.name).split(' ')[0]} · ${letter}` : itemWord(l.name), mark, strike: l.dropped } as JobTile;
  });
}

/** The Next job card for a job. `me` is the holder's first name ("Musa checks it in"). */
export function cardOf(j: Job, b: YardBooks, now: number, go: () => void, compact = false): JobCardProps {
  const me = firstWord(b.me.name);
  const o = j.orderId != null ? b.orders.find((x) => x.id === j.orderId) : undefined;
  if ((j.kind === 'carry-on' || j.kind === 'for-you' || j.kind === 'pack') && o) {
    const s = seller(b, o), sn = s ? firstWord(s.name) : 'Sales', lines = live(o), packed = lines.filter((l) => l.pickStatus === 'done').length;
    const carry = j.kind === 'carry-on', driver = whoIs(b, o.runDriver), where = destinationOf(o, b.customers);
    return {
      compact,
      tag: carry ? { tone: 'blue', icon: 'orders', text: 'Packing now · yours' } : { tone: 'blue', icon: 'orders', text: `${j.kind === 'for-you' ? 'For you' : 'To pack'} · ${howLong(o.stageEnteredAt ?? now, now)}` },
      from: s ? { face: personFace(s), text: `From ${sn} · ${clock(o.createdAt ?? now)}` } : undefined,
      ring: { tone: carry ? 'mint' : 'none', fill: lines.length ? packed / lines.length : 0, face: orderFace(o, b) },
      name: o.client.name,
      big: carry ? `${packed} of ${lines.length}` : counted(lines.length, 'line'), bigTone: carry ? 'mint' : 'white',
      bigSub: carry ? (o.bay != null ? `packed · bay ${o.bay}` : 'packed') : orderNo(o.id),
      legend: <>
        {!isPickup(o, b.customers) && driver && <span class="st-dotw"><Icon name="truck" size={12} stroke={2.2} style={{ color: '#FFFFFF' }} />{driver.name}</span>}
        {isPickup(o, b.customers) && <span class="st-dotw"><Icon name="gate" size={12} stroke={2.2} style={{ color: '#FFFFFF' }} />They collect at the gate</span>}
        {!isPickup(o, b.customers) && !driver && where && <span class="st-dotw">{where.split(',')[0]}</span>}
        {moneyHeld(o) && <Dot color="#F5B26B">{NOT_PAID}</Dot>}
      </>,
      tiles: [...lineTiles(b, o, !carry), ...b.orders.filter((x) => x.copyOf === o.id).map((c) => ({ icon: 'void' as IconName, text: orderNo(c.id), sub: 'copy · skip' }))],
      foot: carry ? { label: `${sn} sees`, value: `Packing · ${me}`, inline: true } : { label: `${sn} sees`, value: `Packing · ${me}` },
      act: { label: carry ? 'Carry on' : 'Start packing', aria: `${carry ? 'Carry on packing' : 'Pack'} ${orderNo(o.id)} for ${o.client.name}`, on: go },
    };
  }
  if ((j.kind === 'checkin' || j.kind === 'delivery' || j.kind === 'ride' || j.kind === 'coming') && j.trips) {
    // A ride's runner is this person; the one who sent it is the Buyer (a trip keeps no sender: the shop's buyer).
    const t0 = j.trips[0], supplier = t0.runnerId === '__supplier__', runner = j.kind === 'ride' ? b.people.find((p) => p.role === 'buyer') || null : whoIs(b, t0.runnerId);
    const face = runner ? personFace(runner) : supplierFace(t0.supplierName), rn = runner ? firstWord(runner.name) : t0.supplierName;
    const lines = j.trips.flatMap((t) => t.lines.filter((l) => !l.notFound));
    const missing = j.trips.flatMap((t) => t.lines.filter((l) => l.notFound)).length;
    const orders = new Set(lines.map((l) => l.orderId).filter((x) => x != null));
    const since = j.at ?? now, ride = j.kind === 'ride';
    const tiles: JobTile[] = lines.map((l) => ({ aisle: aisleOf(b, l.key) || 'other', text: `${l.qty} ${l.unit}`, sub: l.orderId != null ? orderNo(l.orderId) : 'shelf' }));
    if (ride) {
      const oid = lines[0]?.orderId, ord = oid != null ? b.orders.find((x) => x.id === oid) : null;
      const l0 = lines[0];
      tiles.splice(0, tiles.length,
        { aisle: aisleOf(b, l0?.key || '') || 'other', text: l0 ? `${l0.qty} ${l0.unit}` : '', sub: l0 ? l0.name.split(' · ')[0].split(' ').slice(1).join(' ') + (l0.name.includes(' · ') ? ' · ' + l0.name.split(' · ')[1] : '') : '' },
        { icon: 'pin', text: firstWord(t0.supplierName), sub: j.trips.length === 1 ? 'one stop' : `${j.trips.length} stops` },
        ...(ord ? [{ icon: 'orders' as IconName, text: orderNo(ord.id), sub: destinationOf(ord, b.customers) || shortName(ord) }] : []));
    }
    return {
      compact,
      tag: ride ? { tone: 'amber', icon: 'send', text: `${rn} sent you · ${howLong(since, now)}` }
        : j.kind === 'coming' ? { tone: 'glass', icon: 'clock', text: `About ${clock(since)}` }
          : { tone: 'amber', icon: 'clock', text: `${supplier ? 'At the gate' : 'Back at the yard'} · ${howLong(since, now)}` },
      from: { face, text: `From ${rn} · ${clock(ride ? t0.assignedAt ?? since : since)}` },
      ring: { tone: 'amber', fill: Math.min(1, (now - since) / 9e5), face },
      name: ride ? t0.supplierName : supplier ? `${t0.supplierName} · delivery` : `${rn}'s trip`,
      big: counted(lines.length, 'line'), bigTone: 'amber',
      bigSub: ride ? (lines[0]?.orderId != null ? `for ${orderNo(lines[0].orderId as number)}` : '') : j.trips.map((t) => firstWord(t.supplierName)).join(' · '),
      legend: ride ? <>{t0.note && <span class="st-dotw"><Icon name="truck" size={12} stroke={2.2} style={{ color: '#FFFFFF' }} />{t0.note}</span>}<Dot color="#6FDCB0">{`${rn} pays there`}</Dot></>
        : <>{orders.size > 0 && <Dot color="#6FDCB0">{`${counted(orders.size, 'order')} wait`}</Dot>}{missing > 0 && <Dot color="#F7A196">{`${missing} not found`}</Dot>}</>,
      tiles,
      foot: ride ? { label: `${rn} sees`, value: `Buying · ${me} rides it` } : { label: `${rn} sees · ${supplier ? 'At the gate' : 'Back at the yard'}`, value: `${me} checks it in` },
      act: ride ? { label: 'Start the trip', aria: `Start the trip to ${t0.supplierName}`, on: go } : { label: j.kind === 'coming' ? 'Look' : 'Check it in', aria: `Check in ${tripName(b, j)}, ${counted(lines.length, 'line')}`, on: go },
    };
  }
  if (j.kind === 'close') {
    const ck = closeChecks(b, b.me.id, now, readAside(now)), f = closeFigures(b, b.me.id, now), ruthP = b.people.find((p) => p.role === 'manager');
    const stays = ck.filter((c) => c.kind === 'bay').map((c) => c.orders[0]), withR = ck.find((c) => c.kind === 'ruth');
    const first = stays[0];
    return {
      compact,
      tag: { tone: 'mint', icon: 'moon', text: `From ${CLOSE_FROM}` },
      from: ruthP ? { face: personFace(ruthP), text: `${firstWord(ruthP.name)} gets the log` } : undefined,
      ring: { tone: canClose(ck) ? 'done' : 'mint', fill: ck.length ? checksDone(ck) / ck.length : 0, face: personFace(b.me) },
      name: 'Close the yard', big: `${checksDone(ck)} of ${ck.length}`, bigTone: 'mint', bigSub: 'checked',
      legend: <>{stays.length > 0 && <Dot color="#F5B26B">{`${stays.length} stays · ${stays.map((o) => orderNo(o.id)).join(' ')}`}</Dot>}{withR && <Dot color="#9DB7E0">{`${withR.n || 1} with ${ruthP ? firstWord(ruthP.name) : 'Ruth'}`}</Dot>}</>,
      tiles: [{ icon: 'truck', text: `${f.out} out` }, { icon: 'tray-in', text: `${f.in} in` }, { icon: 'return', text: `${f.back} return` }],
      foot: { label: 'Tomorrow starts with', value: first ? <><span class="mono">{orderNo(first.id)}</span>{first.bay != null ? ` · bay ${first.bay}` : ''}</> : 'a clear yard' },
      act: { label: 'Close the yard', on: go },
    };
  }
  // The rest as the Next job: a return, a report, a count, a load, a hand-over (one face, one figure).
  const row = rowOf(j, b, now);
  const ruth = b.people.find((p) => p.role === 'manager');
  return {
    compact,
    tag: { tone: 'blue', icon: row.icon, text: row.title },
    from: ruth ? { face: personFace(ruth), text: `${firstWord(ruth.name)} sees it` } : undefined,
    ring: { tone: 'none', fill: 0, face: o ? orderFace(o, b) : personFace(b.me) },
    name: row.title, big: row.fig || row.act, bigTone: 'mint', bigSub: row.sub,
    tiles: [], foot: { label: 'Next', value: row.act }, act: { label: row.act, aria: row.label, on: go },
  };
}

export interface NeedRow { icon: IconName; tone: TileTone; title: string; sub: string; fig?: string; act: string; label: string }

/** A Needs you row (TD01, TD09): the job's icon, its words, its one act. */
export function rowOf(j: Job, b: YardBooks, now: number): NeedRow {
  const o = j.orderId != null ? b.orders.find((x) => x.id === j.orderId) : undefined;
  switch (j.kind) {
    case 'return': {
      const r = j.ret, who = o ? shortName(o) : '', q = r ? r.lines.map((l) => `${l.qty} ${l.unit}`).join(' + ') : '';
      return { icon: 'return', tone: 'info', title: `Coming back · ${orderNo(j.orderId as number)}`, sub: [j.at ? clock(j.at) : '', q, who].filter(Boolean).join(' · '), act: 'Gate',
        label: `Return from ${who}, ${orderNo(j.orderId as number)}, ${r ? r.lines.map((l) => `${l.qty} ${(r.reason || '').split(' ')[0].toLowerCase()} ${l.unit}s`).join(', ') : ''}, back about ${j.at ? clock(j.at) : ''}` };
    }
    case 'coming': case 'checkin': case 'delivery': {
      const ts = j.trips || [], t0 = ts[0], supplier = t0 && t0.runnerId === '__supplier__';
      const bought = ts.filter((t) => t.status === 'collected' || t.lines.every((l) => l.gotQty != null)).length;
      const lines = ts.flatMap((t) => t.lines.filter((l) => !l.notFound));
      if (supplier) return { icon: 'tray-in', tone: 'info', title: `${t0.supplierName} · delivery`, sub: `${j.ready ? 'at the gate' : clock(j.at ?? now)} · ${lines.map((l) => `${l.qty} ${l.unit}`).join(' · ')}`, act: j.ready ? 'Check in' : 'Look', label: `${t0.supplierName} delivery, ${j.ready ? 'at the gate' : 'about ' + clock(j.at ?? now)}` };
      const name = tripName(b, j);
      return j.ready
        ? { icon: 'tray-in', tone: 'info', title: `${name} back`, sub: `at the yard · ${counted(lines.length, 'line')}`, act: 'Check in', label: `Check in ${name}, ${counted(lines.length, 'line')}` }
        : { icon: 'cart', tone: 'info', title: `${name} back`, sub: `about ${clock(j.at ?? now)} · ${bought} of ${ts.length}`, act: 'Look', label: `${name}, ${bought} of ${ts.length} suppliers, back about ${clock(j.at ?? now)}` };
    }
    case 'ride': { const t0 = j.trips?.[0]; return { icon: 'truck', tone: 'warn', title: `Ride · ${t0 ? t0.supplierName : ''}`, sub: t0 && t0.note ? t0.note : 'one stop', act: 'Start', label: `Start the trip to ${t0 ? t0.supplierName : ''}` }; }
    case 'report': {
      const f = (b.found || []).find((x) => x.key === j.itemKey), name = f ? f.name.split(' · ')[0] : '', letter = aisleLetter(b, aisleOf(b, j.itemKey || ''));
      return { icon: 'warning', tone: 'bad', title: `${f ? f.word : 'Damaged'} · ${name}`, sub: `found ${clock(j.at ?? now)}${letter ? ` · aisle ${letter}` : ''}`, fig: f ? String(f.qty) : undefined, act: 'Report',
        label: `${f ? f.qty : ''} ${f ? f.word.toLowerCase() : 'damaged'} ${itemWord(name).toLowerCase()}s to report, found ${clock(j.at ?? now)}${letter ? ` in aisle ${letter}` : ''}` };
    }
    case 'count': {
      const it = b.items.filter((i) => i.category === j.aisle && i.countedAt != null).sort((x, y) => (x.countedAt as number) - (y.countedAt as number))[0];
      const days = it ? countAge(it.countedAt, now) : null, letter = aisleLetter(b, j.aisle || null);
      return { icon: 'count', tone: 'warn', title: `Count · aisle ${letter}`, sub: `${j.aisle}${days != null ? ` · ${counted(days, 'day')}` : ''}`, act: 'Count', label: `Count aisle ${letter}, ${j.aisle}${days != null ? `: not counted for ${counted(days, 'day')}` : ''}` };
    }
    case 'load': return { icon: 'trolley', tone: 'info', title: 'To load', sub: o ? `${orderNo(o.id)} · bay ${o.bay ?? '—'}` : '', act: 'Load', label: 'Open To load' };
    case 'gate': return { icon: 'gate', tone: 'good', title: `Ready to collect · ${orderNo(j.orderId as number)}`, sub: o ? shortName(o) : '', act: 'Gate', label: `Hand over ${orderNo(j.orderId as number)} at the gate` };
    case 'close': return { icon: 'moon', tone: 'neutral', title: 'Close the yard', sub: 'from 17:30', act: 'Close', label: 'Close the yard' };
    default: return { icon: 'orders', tone: 'info', title: `${j.kind === 'carry-on' ? 'Carry on' : 'Pack'} · ${o ? orderNo(o.id) : ''}`, sub: o ? `${shortName(o)} · ${counted(live(o).length, 'line')}` : '', act: j.kind === 'carry-on' ? 'Carry on' : 'Pack', label: `Pack ${o ? orderNo(o.id) : ''}` };
  }
}
