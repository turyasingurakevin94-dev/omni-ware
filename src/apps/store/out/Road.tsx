/*
 * On the road (out/road, a stage sheet; OU20 default, OU14 nobody out, OU25 no signal, OU27 cancelled on the
 * truck). Out now: each driver with his stops done (a bar), his route, one row per stop with Delivered beside
 * it (out/door). Ready to collect (the gate), Done today. A stop whose Delivered is still on this phone shows
 * "not sent yet"; an order cancelled on the truck is "Bring back", with the lines to put back at the gate.
 */
import type { JSX } from 'preact';
import { firstWord, orderNo, plural } from '../../../core/names.ts';
import { aisleLetter, aisleOf, bringBack, lineQty, onTheRoad, offTheTruck, type Run } from '../../../core/store/door.ts';
import { atTheGate, collectedToday } from '../../../core/store/gate.ts';
import { packWords, placeOf, yardPin } from '../../../core/store/load.ts';
import type { YardBooks, YardOrder } from '../../../core/store/types.ts';
import { counts, destinationOf, isCancelled, moneyHeld, ordersAt } from '../../../core/store/yard.ts';
import { clock, howLong } from '../../../core/time.ts';
import { orderFace, whoIs } from '../../../core/store/faces.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { StageSheet } from '../shell/StageSheet.tsx';
import { books, flush, me, now, online, side, status } from '../shell/store.ts';
import { keptFor } from './commit.ts';
import { Card, DotHead, EmptyWords, FlowBar, Ghost, GhostRow, MiniOrder, NotPaid, SideTiles, SoftPill, WayIn } from './parts.tsx';
import './road.css';

const tel = (p: string) => 'tel:+256' + p.replace(/[^0-9]/g, '').replace(/^0/, '');

/** Where a stop is, by its known place ("Ntinda"), else its first words. */
function placeName(b: YardBooks, o: YardOrder): string {
  const d = destinationOf(o, b.customers) || '', pin = placeOf(d, side.value, yardPin(side.value, b.shopName));
  return pin ? pin.name : d.split(',')[0].trim();
}

function RouteMap(p: { r: Run; b: YardBooks }): JSX.Element {
  return (
    <div role="img" aria-label={`${p.r.driver}'s route: ${p.r.stops.map((o) => destinationOf(o, p.b.customers)?.split(',')[0]).join(', then ')}`} class="rd-map">
      <svg width="304" height="78" viewBox="0 0 304 78" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        <path d="M0 58 C70 54 110 30 160 30 S250 64 304 56" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" />
        <path d="M120 0 L140 78" fill="none" stroke="#FFFFFF" stroke-width="6" />
        <rect x="200" y="8" width="40" height="18" rx="4" fill="#E1E4DC" /><rect x="24" y="10" width="34" height="20" rx="4" fill="#E1E4DC" />
        <path d="M30 58 C70 54 100 36 130 32" fill="none" stroke="#0F6B43" stroke-width="4" stroke-linecap="round" />
        <path d="M130 32 C170 28 230 64 270 58" fill="none" stroke="#0F6B43" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7" />
      </svg>
      <span aria-hidden="true" class="rd-yard"><Icon name="store" size={14} stroke={2} /></span>
      <span aria-hidden="true" class="rd-truck"><Icon name="truck" size={14} stroke={2} /></span>
      {p.r.stops.slice(0, 2).map((_, i) => <span key={i} aria-hidden="true" class="rd-pin mono" style={i ? { left: '262px', top: '46px' } : { left: '176px', top: '28px' }}>{i + 1}</span>)}
    </div>
  );
}

function Driver(p: { b: YardBooks; r: Run }): JSX.Element {
  const b = p.b, n = now.value, waiting = p.r.stops.filter((o) => keptFor('deliver', o.id)), back = p.r.stops.filter(bringBack);
  const done = waiting.length, left = p.r.stops.length - back.length;
  const dr = whoIs(b, p.r.staffId);
  const line = back.length ? `${left} ${plural(left, 'stop')} left · ${back.length} coming back`
    : waiting.length ? `${done} of ${p.r.stops.length} · not sent yet` : `${done} of ${p.r.stops.length} ${plural(p.r.stops.length, 'stop')}`;
  return (
    <div class={cx('rd-card', back.length > 0 && 'flat')}>
      <div class="rd-dr">
        <Avatar initials={dr ? dr.initials : p.r.driver.slice(0, 2).toUpperCase()} tint="t4" size={40} font={13} style={{ letterSpacing: '-.02em' }} />
        <span class="rd-dr-t">
          <span><b>{p.r.hired ? `${p.r.driver} (hired)` : p.r.driver}</b>{p.r.left != null && <span class="mono">{`left ${clock(p.r.left)} · ${howLong(p.r.left, n)}`}</span>}</span>
          {back.length ? <span class="mono rd-dr-l">{line}</span> : (
            <span class="rd-dr-b"><span aria-hidden="true">{p.r.stops.map((o, i) => <span key={i} class={keptFor('deliver', o.id) ? 'wait' : ''} />)}</span><span class="mono">{line}</span></span>
          )}
        </span>
        <a href={tel(dr ? dr.phone : '')} aria-label={`Call ${p.r.driver}`} class="rd-call"><Icon name="phone" size={18} stroke={2} /></a>
      </div>
      {!back.length && <RouteMap r={p.r} b={b} />}
      {p.r.stops.map((o, i) => {
        const kept = keptFor('deliver', o.id), cancel = isCancelled(o);
        return (
          <div key={o.id} class="rd-stop">
            <span aria-hidden="true" class="rd-no mono">{i + 1}</span>
            <Avatar {...orderFace(o, b)} size={32} font={12} style={{ letterSpacing: '-.02em' }} />
            <span class="rd-stop-t"><span>{o.client.name}</span><span class="mono">{`${orderNo(o.id)} · ${cancel ? 'skip ' : ''}${placeName(b, o)}`}</span></span>
            {cancel ? <span class="rd-back"><Icon name="return" size={13} stroke={2.2} />Bring back</span>
              : kept ? <span class="rd-wait" role="img" aria-label="Delivered, not sent yet"><Icon name="clock" size={16} stroke={2.2} /></span>
                : <Tap on={() => nav.push('out/door', { id: o.id })} class="rd-go" label={`Delivered: ${o.client.name}, ${orderNo(o.id)}`}><span><Icon name="camera" size={15} stroke={2} />Delivered</span></Tap>}
          </div>
        );
      })}
    </div>
  );
}

function BringBack(p: { b: YardBooks; o: YardOrder }): JSX.Element {
  const b = p.b, o = p.o, lines = offTheTruck(o), dr = o.carrier ? o.carrier.name : 'the driver';
  const by = o.cancelledByName || 'Ruth', byP = b.people.find((x) => x.name === by);
  return (
    <div class="rd-card bb">
      <div class="rd-bb-h">
        <Avatar initials={byP ? byP.initials : 'RN'} tint={byP ? byP.tint : 't2'} size={24} font={11} style={{ letterSpacing: '-.02em' }} />
        <span>{`${firstWord(by)} cancelled ${orderNo(o.id)} · ${dr} told`}</span><span class="mono">{clock(o.cancelledAt ?? now.value)}</span>
      </div>
      <Tap on={() => nav.push('pack/put-back', { id: o.id })} class="rd-bb-k"><span>Put back at the gate</span><span>{`${lines.length} ${plural(lines.length, 'line')}`}<Icon name="chevron-right" size={14} stroke={2.4} /></span></Tap>
      {lines.map((l) => {
        const q = lineQty(l), letter = aisleLetter(b, l.key);
        return (
          <div key={l.idx} class="rd-bb-l">
            <ItemSquare aisle={aisleOf(b, l.key) || 'Tools'} size={34} radius={9} icon={20} />
            <span class="rd-stop-t"><span>{l.name}</span><span class="mono">{q} <span class="rn-u">{packWords(q, l.unit, l.packQty, l.packUnit)}</span></span></span>
            {letter && <SoftPill tone="info">{letter}</SoftPill>}
          </div>
        );
      })}
    </div>
  );
}

function Empty(p: { b: YardBooks }): JSX.Element {
  const b = p.b, n = now.value, c = counts(b, me.value, n);
  const next = ordersAt(b, 'packed', me.value, n).filter((o) => !!destinationOf(o, b.customers) && !moneyHeld(o)).slice(0, 2);
  const done = collectedToday(b, n), gate = atTheGate(b, me.value, n).length;
  return (
    <>
      <Ghost tile={<Icon name="truck" size={34} stroke={1.8} />}>
        <div class="rd-ghost-dr"><span class="ou-grow-face" /><b>a driver</b></div>
        <GhostRow word="Delivered" /><GhostRow op={0.7} word="Delivered" />
      </Ghost>
      <EmptyWords title="Nobody on the road" sub="Loaded drops show here, a row per stop" />
      {next.length > 0 && (
        <div class="ou-list">
          <span class="ou-list-k">Next out</span>
          <Card>{next.map((o) => <MiniOrder key={o.id} h={52} on={() => nav.replace('out/load')} face={orderFace(o, b)} name={o.client.name} sub={`${orderNo(o.id)} · ${placeName(b, o)}`} pill={<SoftPill tone="info" icon={<Icon name="layers" size={12} stroke={2.4} />}>To load</SoftPill>} />)}</Card>
        </div>
      )}
      <WayIn icon="layers" word="To load" count={c.packed} on={() => nav.replace('out/load')} />
      <SideTiles tiles={[
        { label: `At the gate ${gate}`, icon: <Icon name="store" size={20} stroke={1.9} />, title: <>At the gate <span class="mono">{gate}</span></>, sub: 'ready to collect', on: () => nav.push('out/gate') },
        { label: `Delivered ${c.deliveredToday}`, good: true, icon: <Icon name="delivered" size={20} stroke={1.9} />, title: <>Delivered <span class="mono">{c.deliveredToday}</span></>, sub: done[0] ? `collected ${clock(done[0].deliveredAt as number)}` : 'today' },
      ]} />
    </>
  );
}

export function Road(): JSX.Element {
  const b = books.value, n = now.value;
  if (!b) return <StageSheet flat id="out/road" mint title="On the road" />;
  const runs = onTheRoad(b), ready = atTheGate(b, me.value, n), done = collectedToday(b, n), c = counts(b, me.value, n);
  const out = runs.reduce((s, r) => s + r.stops.length, 0), back = runs.flatMap((r) => r.stops.filter(isCancelled));
  const waiting = runs.flatMap((r) => r.stops.filter((o) => keptFor('deliver', o.id)));
  const offline = !online.value || waiting.length > 0;
  const total = out + ready.length;
  const sub = status.value === 'updating' && !online.value ? `Updating · saved ${clock(b.at)}`
    : back.length ? `${back.length} to bring back · ${out - back.length} out · ${ready.length} ready`
      : total ? `${out} out now · ${ready.length} ready · ${c.deliveredToday} delivered` : `nobody out · ${clock(n)}`;
  const chips = total > 0 && !back.length && !offline && (
    <>
      <Tap on={() => undefined} current class="rd-chip on"><span class="rd-chip-d" style={{ background: '#6FDCB0' }} />Out now<b class="mono">{out}</b></Tap>
      <Tap on={() => nav.push('out/gate')} class="rd-chip"><span class="rd-chip-d" style={{ background: '#F5B26B' }} />Ready<b class="mono">{ready.length}</b></Tap>
    </>
  );
  return (
    <StageSheet flat id="out/road" mint gap={8} title="On the road" count={total} sub={sub} chips={chips} amber={offline}
      bar={offline ? <FlowBar kind="offline" onRetry={() => { void flush(); }}>{waiting.length ? `No signal · ${waiting.length} not sent yet · kept on this phone` : 'No signal · kept on this phone'}</FlowBar> : null}>
      {!total ? <Empty b={b} /> : (
        <>
          {runs.length > 0 && <DotHead dot="#0F6B43" title="Out now" count={out}
            right={waiting.length ? <span class="mono rd-right amber"><Icon name="clock" size={13} stroke={2.2} />{`${orderNo(waiting[0].id)} not sent yet`}</span>
              : runs[0].dueBack != null ? <span class="mono rd-right"><Icon name="clock" size={13} stroke={2.2} />{`back ~${clock(runs[0].dueBack)}`}</span> : null} />}
          {runs.map((r) => <Driver key={r.driver} b={b} r={r} />)}
          {back.length > 0 && <DotHead dot="#8E2A22" title="Cancelled · bring it back" count={back.length} />}
          {back.map((o) => <BringBack key={o.id} b={b} o={o} />)}
          {ready.length > 0 && !back.length && <DotHead dot="#F5B26B" title="Ready to collect" count={ready.length} />}
          {ready.length > 0 && !back.length && (
            <Card>{ready.map((o) => (
              <Tap key={o.id} on={() => nav.push('out/gate', { id: o.id })} class="rd-ready">
                <Avatar {...orderFace(o, b)} size={32} font={12} style={{ letterSpacing: '-.02em' }} />
                <span class="rd-stop-t"><span>{o.client.name}</span><span class="mono">{`${orderNo(o.id)} · since ${clock(o.stageEnteredAt ?? n)}`}</span></span>
                {moneyHeld(o) ? <NotPaid /> : <SoftPill tone="good">Paid</SoftPill>}
                <span aria-hidden="true" class="ld-chev"><Icon name="chevron-right" size={14} stroke={2.4} /></span>
              </Tap>
            ))}</Card>
          )}
          {done[0] && !back.length && <div class="gt-done"><Icon name="check" size={16} stroke={2.8} /><span>Done today</span><span class="mono">{`${orderNo(done[0].id)} · collected ${clock(done[0].deliveredAt as number)}`}</span></div>}
        </>
      )}
    </StageSheet>
  );
}
