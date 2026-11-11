/*
 * Today's parts (TD01, TD06, TD09): the yard in the hero (jobs left, the bar of done · ready · later),
 * the compact head that stays when scrolled (TD09), On the move, a Needs you row, Waiting on others,
 * Done today with who sees it, and Waiting to send (TD06).
 */
import type { JSX } from 'preact';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import type { Kept } from '../../../core/outbox.ts';
import { orderFace, personFace, shortName, whoIs } from '../../../core/store/faces.ts';
import { readyJobs, laterJobs, type Done, type Job } from '../../../core/store/jobs.ts';
import { keptLine } from '../../../core/store/outbox.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { counts as yardCounts, isPickup, ordersAt, NOT_PAID } from '../../../core/store/yard.ts';
import { clock, dayOf, daysApart, howLong } from '../../../core/time.ts';

/** How long, by the calendar past a day ("2 days" for Thu 15:30 → Sat 10:41), else as the clock says ("41 m"). */
export function sinceDays(at: number, now: number): string {
  const d = daysApart(dayOf(at), dayOf(now));
  return d >= 1 ? (d === 1 ? '1 day' : `${d} days`) : howLong(at, now);
}
import { IconTile, MiniRow } from '../../../ui/ActRow.tsx';
import { avatarStyle, FaceStack, type Face } from '../../../ui/Avatar.tsx';
import { AisleIcon, Icon } from '../../../ui/icons.tsx';
import { StageTiles } from '../../../ui/StageTiles.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { itemWord, rowOf } from './cards.tsx';

/** The bar's cells: one per job of the day, done white, ready mint, later empty. */
export function YardBar(p: { done: number; ready: number; later: number; thin?: boolean }): JSX.Element {
  const cells = [...Array(p.done).fill('d'), ...Array(p.ready).fill('r'), ...Array(p.later).fill('l')];
  return (
    <span aria-hidden="true" class={cx('st-ybar', p.thin && 'thin')}>
      {(cells.length ? cells : ['l']).map((c, i) => <span key={i} class={c} />)}
    </span>
  );
}

/** The hero's yard (TD01): "The yard · today", "7 jobs left · 5 done", the bar and its legend, "on since 7:30". */
export function YardHead(p: { jobs: Job[]; done: number; onSince: number | null; on: () => void; first?: boolean }): JSX.Element {
  const r = readyJobs(p.jobs).filter((j) => j.kind !== 'close').length, l = laterJobs(p.jobs).length, left = r + l;
  const clear = left === 0 && !p.first;
  return (
    <>
      <Tap on={p.on} label={p.first ? 'No jobs yet: the first one lands here' : `${left} jobs left, ${p.done} done. Open the day.`} class="st-yfig">
        <span class="st-yeye">The yard · today<Icon name="chevron-right" size={14} stroke={2.4} style={{ opacity: 0.7 }} /></span>
        <span class="st-ybig"><span class="mono n">{left}</span><span class="w">{p.first ? 'jobs yet' : 'jobs left'}</span>
          {p.first ? <span class="m">the first one lands here</span> : clear ? <span class="m">· the yard is clear</span> : <span class="mono d">{`· ${p.done} done`}</span>}</span>
      </Tap>
      <Tap on={p.on} label={p.first ? 'Day 1' : `${p.done} done, ${r} ready now, ${l} later`} class="st-ybarwrap">
        {p.first ? <span aria-hidden="true" class="st-ybar first"><span /></span> : <YardBar done={p.done} ready={r} later={l} />}
        <span class="st-yleg">
          <span class="st-yleg-l">
            <span><span aria-hidden="true" class="dt d" /><b class="mono">{p.done}</b>done</span>
            {!clear && !p.first && <span><span aria-hidden="true" class="dt r" /><b class="mono">{r}</b>ready</span>}
            {!clear && !p.first && <span><span aria-hidden="true" class="dt l" /><b class="mono">{l}</b>later</span>}
          </span>
          <span class="st-yleg-r">{p.first ? 'day 1' : <>on since <span class="mono">{p.onSince ? clock(p.onSince) : '—'}</span></>}<Icon name="chevron-right" size={14} stroke={2.4} style={{ opacity: 0.7 }} /></span>
        </span>
      </Tap>
    </>
  );
}

/** TD09: the navy strip that stays at the top once the hero has scrolled away. */
export function CompactHead(p: { done: number; ready: number; later: number; on: () => void }): JSX.Element {
  return (
    <Tap on={p.on} label="Back to the top of Today" class="st-chead">
      <span class="st-chead-t">Today</span>
      <span class="st-chead-r"><YardBar done={p.done} ready={p.ready} later={p.later} thin /><span class="mono"><b>{p.ready + p.later}</b>{` left · ${p.done} done`}</span></span>
    </Tap>
  );
}

const uniqFaces = (fs: Face[]): Face[] => fs.filter((f, i) => fs.findIndex((g) => g.initials === f.initials) === i);

/** On the move: Coming in · To pack · To load · On the road, the faces in each (TD01). */
export function OnTheMove(p: { b: YardBooks; me: string | null; now: number; jobs: Job[]; go: (id: string) => void; children?: JSX.Element | null }): JSX.Element {
  const { b, me, now } = p, c = yardCounts(b, me, now);
  const coming = p.jobs.filter((j) => j.kind === 'coming' || j.kind === 'checkin' || j.kind === 'delivery' || j.kind === 'ride');
  const comingFaces = coming.map((j) => { const t0 = j.trips![0], r = j.kind === 'ride' ? b.people.find((x) => x.role === 'buyer') : whoIs(b, t0.runnerId); return r ? personFace(r) : { initials: t0.supplierName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), tint: 't4' as const }; });
  const of = (os: YardOrder[]) => uniqFaces(os.map((o) => orderFace(o, b) as Face));
  const toPack = [...ordersAt(b, 'for-you', me, now), ...ordersAt(b, 'to-pack', me, now)], packing = ordersAt(b, 'packing', me, now);
  const toLoad = ordersAt(b, 'packed', me, now), road = [...ordersAt(b, 'road', me, now), ...ordersAt(b, 'coming-back', me, now), ...ordersAt(b, 'ready', me, now)];
  const backNow = coming.filter((j) => j.ready).length;
  return (
    <StageTiles tiles={[
      { stage: 'buying', word: 'Coming in', icon: 'tray-in', count: coming.length, faces: uniqFaces(comingFaces as Face[]), need: backNow || undefined, mark: backNow ? 'money' : undefined,
        label: `${coming.length} coming in${coming.length ? ': ' + coming.map((j) => rowOf(j, b, now).title + (j.at ? ` ${j.ready ? 'at' : 'about'} ${clock(j.at)}` : '')).join(', ') : ''}`, on: () => p.go('in') },
      { stage: 'packing', word: 'To pack', icon: 'orders', count: toPack.length, extra: packing.length ? `+${packing.length}` : undefined, faces: of([...toPack, ...packing]),
        label: `${toPack.length} to pack${toPack.length ? ', ' + toPack.map((o) => orderNo(o.id)).join(', ') : ''}${packing.length ? `; plus ${packing.length} packing now, ${packing.map((o) => orderNo(o.id)).join(', ')}` : ''}`, on: () => p.go('pack') },
      { stage: 'road', word: 'To load', icon: 'trolley', count: toLoad.length, faces: of(toLoad), mark: toLoad.some((o) => o.moneyHold) ? 'money' : undefined,
        label: `${toLoad.length} to load${toLoad.length ? ': ' + toLoad.map((o) => `${orderNo(o.id)}${o.moneyHold ? ', not paid yet' : ''}${o.bay != null ? `, on bay ${o.bay}` : ''}`).join('; ') : ''}`, on: () => p.go('out/load') },
      { stage: 'delivered', word: 'On the road', icon: 'truck', count: c.onTheRoad, faces: of(road), mark: c.onTheRoad ? 'ready' : undefined,
        label: `${c.onTheRoad} on the road${c.readyToCollect ? `: ${c.onTheRoad - c.readyToCollect} with drivers, ${c.readyToCollect} ready to collect at the gate` : ''}`, on: () => p.go('out/road') },
    ]}>{p.children}</StageTiles>
  );
}

/** The row under the tiles (TD01) and in Waiting on others (TD09): Not paid yet, on its bay; the yard taps nothing. */
export function UnpaidRow(p: { o: YardOrder; b: YardBooks; now: number; on: () => void }): JSX.Element {
  const { o, b } = p, s = whoIs(b, o.takenBy), ruth = b.people.find((x) => x.role === 'manager');
  const faces = [s, ruth].filter(Boolean).map((x) => personFace(x) as Face);
  const days = sinceDays(o.pickingDoneAt ?? o.stageEnteredAt ?? p.now, p.now);
  return (
    <MiniRow face={orderFace(o, b) as Face} name={`${shortName(o)} · ${NOT_PAID}`} sub={`${orderNo(o.id)}${o.bay != null ? ` · bay ${o.bay}` : ''} · ${days}`} subMono
      pill={<FaceStack faces={faces} ground="#FFFFFF" />} on={p.on}
      label={`${orderNo(o.id)} ${shortName(o)}, not paid yet${o.bay != null ? `, bay ${o.bay}` : ''} for ${days}. ${s ? firstWord(s.name) : 'Sales'} takes the money, ${ruth ? firstWord(ruth.name) : 'the manager'} may let it go. Nothing for the yard to do.`} />
  );
}

/** A Needs you row: the tone square, two lines, a figure, the navy act (TD01). The whole row is the link. */
export function NeedRow(p: { j: Job; b: YardBooks; now: number; on: () => void }): JSX.Element {
  const r = rowOf(p.j, p.b, p.now);
  return (
    <Tap on={p.on} label={r.label} class="st-need">
      <IconTile tone={r.tone} icon={r.icon} size={38} />
      <span class="st-need-t"><span>{r.title}</span><span class="mono">{r.sub}</span></span>
      {r.fig && <b class="mono st-need-fig">{r.fig}</b>}
      <span class="st-need-act">{r.act}</span>
    </Tap>
  );
}

/** Done today: each with who sees it now (TD09). */
export function DoneRow(p: { d: Done; b: YardBooks }): JSX.Element {
  const { d, b } = p, o = d.orders[0];
  const sellers = uniqFaces(d.orders.map((x) => whoIs(b, x.takenBy)).filter(Boolean).map((x) => personFace(x) as Face));
  const ruth = b.people.find((x) => x.role === 'manager'), runner = d.trips ? whoIs(b, d.trips[0].runnerId) : null;
  let title = '', sub = clock(d.at), faces: Face[] = [], word = '', icon: 'orders' | 'tray-in' | 'truck' | 'count' | 'gate' | 'warning' | 'return' = 'orders';
  switch (d.kind) {
    case 'packed': title = `Packed · ${orderNo(o.id)}`; faces = sellers; word = isPickup(o, b.customers) ? 'Ready to collect' : 'Packed'; break;
    case 'checked-in': icon = 'tray-in'; title = d.trips && d.trips[0].runnerId === '__supplier__' ? `Checked in · ${d.trips[0].supplierName}` : 'Checked in · trip'; sub = `${clock(d.at)} · ${counted(d.lines || 0, 'line')}`; faces = runner ? [personFace(runner) as Face] : []; word = 'Checked in'; break;
    case 'loaded': icon = 'truck'; title = `Loaded · ${d.name}`; sub = `${clock(d.at)} · ${counted(d.orders.length, 'order')}`; faces = sellers; word = 'On the road'; break;
    case 'handed-over': icon = 'gate'; title = 'Handed over'; sub = `${clock(d.at)} · ${orderNo(o.id)}`; faces = sellers; word = 'Delivered'; break;
    case 'delivered': icon = 'truck'; title = `Delivered · ${orderNo(o.id)}`; faces = sellers; word = 'Delivered'; break;
    case 'counted': icon = 'count'; title = `Counted · ${itemWord(d.name || '').replace(/ G\d+$/, '')}`; faces = ruth ? [personFace(ruth) as Face] : []; word = d.status === 'sent' ? 'Ruth looks' : 'Accepted'; break;
    case 'reported': icon = 'warning'; title = `Reported · ${itemWord(d.name || '')}`; faces = ruth ? [personFace(ruth) as Face] : []; word = d.status === 'sent' ? 'Ruth looks' : 'Ruth decided'; break;
    case 'returned': icon = 'return'; title = `Return · ${o ? orderNo(o.id) : ''}`; faces = ruth ? [personFace(ruth) as Face] : []; word = d.status === 'sent' ? 'Ruth decides' : 'Ruth decided'; break;
  }
  return (
    <div class="st-done">
      <IconTile tone="good" icon={icon} size={38} iconSize={18} />
      <span class="st-need-t"><span>{title}</span><span class="mono">{sub}</span></span>
      <span class="st-sees">{faces.length > 0 && <FaceStack faces={faces} ground="#F1EEE8" />}{word}</span>
    </div>
  );
}

/** Waiting to send (TD06): each kept write, Not sent yet · when, who sees it once it goes, Remove. */
export function KeptRow(p: { k: Kept; b: YardBooks; onRemove: () => void }): JSX.Element {
  const l = keptLine(p.k, p.b), o = /^#(\d+)/.exec(l.title), ord = o ? p.b.orders.find((x) => x.id === Number(o[1])) : null;
  const line = ord && p.k.kind === 'pick' ? ord.lines[0] : null, aisle = line ? (p.b.items.find((i) => i.key === line.key) || { category: null }).category : null;
  return (
    <div class="st-kept">
      {aisle ? <span aria-hidden="true" class="st-kept-sq"><AisleIcon aisle={aisle} size={24} /></span>
        : <IconTile tone={l.icon === 'report' ? 'bad' : 'info'} icon={l.icon === 'report' ? 'camera' : l.icon === 'count' ? 'count' : 'orders'} size={40} />}
      <span class="st-kept-t"><span>{l.title}</span>
        <span class="st-kept-s"><Icon name="clock" size={12} stroke={2.4} />{p.k.state === 'refused' ? 'Not sent' : 'Not sent yet'}<span class="mono">{`· ${clock(p.k.at)}`}</span></span></span>
      {l.who && <span aria-hidden="true" class="ow-av st-kept-who" style={avatarStyle({ ...personFace(l.who), size: 24 })}>{l.who.initials}</span>}
      <button type="button" class="st-kept-x" aria-label="Remove it from this phone" onClick={p.onRemove}><Icon name="trash" size={18} stroke={2} /></button>
    </div>
  );
}
