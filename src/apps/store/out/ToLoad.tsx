/*
 * To load (out/load, a stage sheet; OU01, OU30): packed deliveries by direction, nearest first. The first
 * direction is the next run: who drives (remembered) and where its first drop goes; every drop opens its
 * run (out/run { dir }). An unnamed direction offers "Name it" (OU31, NameSheet.tsx). Trucks: each driver
 * of ours, out or in the yard. Not paid yet is the label only: nothing can leave, the slide is locked and
 * "Opens when paid". The dock's slide sends the first run as it stands (the run's own screen is one tap).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { clock, dayOf, daysApart } from '../../../core/time.ts';
import { orderNo, plural } from '../../../core/names.ts';
import { directions, driverOf, driversOf, runHeld, trucks, type Direction } from '../../../core/store/load.ts';
import { onTheRoad } from '../../../core/store/door.ts';
import { counts, moneyHeld, ordersAt, destinationOf } from '../../../core/store/yard.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { Tap } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { StageSheet } from '../shell/StageSheet.tsx';
import { books, me, now, side } from '../shell/store.ts';
import { OIcon } from './icons.tsx';
import { openNameDirection } from './NameSheet.tsx';
import { Card, custFace, DotHead, DriverChips, DropPlace, EmptyWords, Ghost, GhostRow, MiniOrder, NotPaid, SheetDock, SideTiles, SoftPill, WayIn, person, seller, type DriverPick } from './parts.tsx';
import './load.css';

/** One drop's row: the face, "#0552 · bay 1" (with how long on the bay once it is a day), Not paid yet. */
function DropRow(p: { b: YardBooks; d: Direction; i: number; full: boolean }): JSX.Element {
  const o = p.d.drops[p.i].o, n = now.value;
  const days = o.pickingDoneAt != null ? daysApart(dayOf(o.pickingDoneAt), dayOf(n)) : 0;
  const age = days > 0 ? `${days} ${plural(days, 'day')}` : null;
  const label = `${o.client.name.replace('&', 'and')}, order ${orderNo(o.id).slice(1)}${o.bay != null ? `, bay ${o.bay}` : ''}${age ? `, ${age}` : ''}${moneyHeld(o) ? ', not paid yet' : ''}`;
  return (
    <Tap on={() => nav.push('out/run', { dir: p.d.key })} label={p.full ? undefined : label} class={'ld-drop' + (p.full ? '' : ' tall')}>
      <Avatar {...custFace(p.b, o)} size={32} font={12} style={{ letterSpacing: '-.02em' }} />
      <span class="ld-drop-t">
        <span>{o.client.name}</span>
        <span class="mono">{orderNo(o.id)}{o.bay != null && ` · bay ${o.bay}`}{age && <> · <b>{age}</b></>}</span>
      </span>
      {moneyHeld(o) && <NotPaid />}
      {p.full && <span aria-hidden="true" class="ld-chev"><Icon name="chevron-right" size={14} stroke={2.4} /></span>}
    </Tap>
  );
}

/** The next run: its head, who drives, and its drops with where the first one goes. */
function NextRun(p: { b: YardBooks; d: Direction; pick: DriverPick | null; onPick: (x: DriverPick) => void }): JSX.Element {
  const first = p.d.drops[0].o, from = seller(p.b, first);
  const where = [destinationOf(first, p.b.customers)?.split(',')[0], first.deliverWhen].filter(Boolean).join(' · ');
  return (
    <>
      <DotHead dot="#8DA2D6" title={p.d.name} count={p.d.drops.length}
        right={p.d.leavesAt != null && <span class="mono ld-leaves"><Icon name="clock" size={14} stroke={2.2} />leaves {clock(p.d.leavesAt)}</span>} />
      <DriverChips drivers={driversOf(p.b, p.d)} me={p.b.me} chosen={p.pick} dim={runHeld(p.d)} onPick={p.onPick} onHired={() => nav.push('out/run', { dir: p.d.key, hired: true })} />
      <Card>
        <div class="ld-run">
          {p.d.drops.map((_, i) => <DropRow key={i} b={p.b} d={p.d} i={i} full />)}
          <DropPlace place={where} phone={first.deliverPhone || first.client.phone} from={from ? { initials: from.initials, tint: 'me' } : null} />
        </div>
      </Card>
    </>
  );
}

/** A direction after the first: its head (with Name it when unnamed) and its drops. */
function OtherRun(p: { b: YardBooks; d: Direction }): JSX.Element {
  return (
    <>
      {p.d.named
        ? <DotHead dot="#8DA2D6" title={p.d.name} count={p.d.drops.length} />
        : (
          <div class="ou-dothead">
            <span aria-hidden="true" class="ou-dot ring" />
            <span class="ld-unnamed"><span>{p.d.name}</span><span>{`not named yet · ${p.d.drops.length}`}</span></span>
            <Tap on={() => openNameDirection(p.d)} class="ld-name"><span><Icon name="pen" size={14} stroke={2.2} />Name it</span></Tap>
          </div>
        )}
      <Card>{p.d.drops.map((_, i) => <DropRow key={i} b={p.b} d={p.d} i={i} full={false} />)}</Card>
    </>
  );
}

function Trucks(p: { b: YardBooks }): JSX.Element {
  const ts = trucks(p.b), inYard = ts.filter((t) => !t.out).length;
  return (
    <>
      <div class="ld-trucks-h"><span>Trucks</span><span class="mono">{inYard} in the yard</span></div>
      <div class="ld-trucks">
        {ts.map((t) => (
          <div key={t.p.id} class="ld-truck">
            <Avatar initials={t.p.initials} tint="t4" size={32} font={12} style={{ letterSpacing: '-.02em' }} />
            <span class="ld-truck-t"><span>{t.p.name}</span><span class={t.out ? '' : 'in'}>{t.out ? `out${t.dueBack != null ? ` · back ~${clock(t.dueBack)}` : ''}` : 'in the yard'}</span></span>
          </div>
        ))}
      </div>
    </>
  );
}

/** OU30: nothing packed to go out; what is being packed for a truck, and the ways on. */
function Empty(p: { b: YardBooks }): JSX.Element {
  const b = p.b, n = now.value, c = counts(b, me.value, n);
  const packing = [...ordersAt(b, 'packing', me.value, n), ...ordersAt(b, 'for-you', me.value, n), ...ordersAt(b, 'to-pack', me.value, n)]
    .filter((o) => !!destinationOf(o, b.customers)).slice(0, 2);
  const out = onTheRoad(b).reduce((s, r) => s + r.stops.length, 0), drivers = onTheRoad(b).map((r) => r.driver);
  return (
    <>
      <Ghost tile={<OIcon name="layers" size={34} stroke={1.8} />}>
        <div class="ou-ghost-head"><span class="ou-dot" /><b>→ a direction</b><span class="ou-flex" /><i><Icon name="clock" size={13} stroke={2.2} />leaves</i></div>
        <GhostRow /><GhostRow op={0.7} /><GhostRow op={0.4} />
      </Ghost>
      <EmptyWords title="Nothing to load" sub="Packed deliveries line up here by direction" />
      {packing.length > 0 && (
        <div class="ou-list">
          <span class="ou-list-k">Being packed · goes to load</span>
          <Card>{packing.map((o) => (
            <MiniOrder key={o.id} face={custFace(b, o)} name={o.client.name} sub={`${orderNo(o.id)} · → ${destinationOf(o, b.customers)?.split(/[ ,]/)[0]}`} on={() => nav.replace('pack')}
              pill={<SoftPill tone="info" icon={<Icon name="orders" size={12} stroke={2.6} />}>{o.pickingStatus === 'in_progress' ? 'Packing now' : 'To pack'}</SoftPill>} />
          ))}</Card>
        </div>
      )}
      <WayIn icon="orders" word="To pack" count={c.toPack} on={() => nav.replace('pack')} />
      <SideTiles tiles={[
        { label: 'Packed lands here by itself', icon: <Icon name="orders" size={20} stroke={1.9} />, title: 'Packed', sub: 'lands here by itself', on: () => nav.replace('pack') },
        { label: `On the road ${out}`, good: true, icon: <Icon name="truck" size={20} stroke={1.9} />, title: <>On the road <span class="mono">{out}</span></>, sub: drivers.length ? `${drivers.join(' and ')} ${drivers.length === 1 ? 'is' : 'are'} out` : 'nobody out', on: () => nav.replace('out/road') },
      ]} />
    </>
  );
}

export function ToLoad(): JSX.Element {
  const b = books.value;
  const ds = b ? directions(b, side.value, me.value, now.value) : [];
  const [pick, setPick] = useState<DriverPick | null>(null);
  if (!b) return <StageSheet flat id="out/load" title="To load" />;
  const n = ds.reduce((s, d) => s + d.drops.length, 0), first = ds[0] || null;
  const driverId = first ? driverOf(b, first) : null;
  const chosen: DriverPick | null = pick || (driverId ? { kind: 'staff', id: driverId } : null);
  const driver = chosen && chosen.kind === 'staff' ? person(b, chosen.id) : chosen && chosen.kind === 'me' ? b.me : null;
  const held = first ? runHeld(first) : true;
  const sub = n ? `${n} packed · ${ds.length} ${plural(ds.length, 'direction')}` : 'nothing packed to go out';
  const foot = first && (
    <SheetDock hint={held ? { icon: 'bell', text: 'Opens when paid', iconTone: 'mint' } : null}>
      {held
        ? <Slide label="Nothing can leave yet" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Nothing can leave yet' }} />
        : <Slide label={`Slide to send ${driver ? driver.name.split(' ')[0] : 'the truck'} · ${first.drops.length} ${plural(first.drops.length, 'drop')}`}
          onCommit={() => { nav.push('out/run', { dir: first.key, go: true, ...(driver ? { driver: driver.id } : {}) }); }} />}
    </SheetDock>
  );
  return (
    <StageSheet flat id="out/load" title="To load" count={n} sub={sub} foot={foot}>
      {first
        ? <>
          <NextRun b={b} d={first} pick={chosen} onPick={setPick} />
          {ds.slice(1).map((d) => <OtherRun key={d.key} b={b} d={d} />)}
          <Trucks b={b} />
        </>
        : <Empty b={b} />}
    </StageSheet>
  );
}
