/*
 * Coming in (route `in`, a stage sheet; IN01, IN40): the yard's arrivals board. A Buyer's trip
 * stop by stop, what is back at the yard, a supplier's delivery, a return on its way, and what
 * was checked in today; each row opens its own screen (routes §3). Rules: core/store/arrivals.ts.
 */
import { orderFace, personFace } from '../../../core/store/faces.ts';
import { Fragment, type JSX } from 'preact';
import { useState } from 'preact/hooks';
import { arrivals, backNow, coming, nextDue, stopsOf, tripName, type Arrival } from '../../../core/store/arrivals.ts';
import type { CheckTrip } from '../../../core/store/checkin.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { counted, orderNo, firstWord } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemArt } from '../../../ui/ItemArt.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { StageSheet } from '../shell/StageSheet.tsx';
import { books, now } from '../shell/store.ts';
import { byLogin, byRole, GroupHead } from './parts.tsx';
import './comingin.css';

type Show = 'all' | 'back' | 'coming';

const Chev = (): JSX.Element => <span aria-hidden="true" class="ci-chev"><Icon name="chevron-right" size={14} stroke={2.2} /></span>;

/** The orders a trip brings goods for, as faces. */
function orderFaces(b: YardBooks, t: CheckTrip): JSX.Element {
  const ids = [...new Set(t.lines.map((l) => l.orderId).filter((x): x is number => x != null))];
  return (
    <span aria-hidden="true" class="ci-faces">
      {ids.map((id) => { const o = b.orders.find((x) => x.id === id); return o ? <Avatar key={id} {...orderFace(o, b)} size={26} /> : null; })}
    </span>
  );
}

/** A Buyer's trip: who, how much, then its stops on a little rail (Owino 9:50 · Kiseka · now · Yard ~11:30). */
function TripCard(p: { b: YardBooks; a: Arrival; all: Arrival[] }): JSX.Element {
  const t = p.a.trip as CheckTrip, runner = p.b.people.find((x) => x.id === t.runnerId) || null;
  const name = tripName(firstWord(runner ? runner.name : 'The'), t, p.all), stops = stopsOf(t);
  const lines = t.lines.filter((l) => !l.notFound).length, at = stops.find((s) => s.state === 'now');
  const yard = p.a.kind === 'back' ? 'now' : p.a.due ? `~${clock(p.a.due)}` : '';
  const said = `${name}: ${counted(lines, 'line')} from ${counted(t.stops.length, 'supplier')}, ${p.a.kind === 'back' ? 'back at the yard' : `buying at ${at ? at.name : 'the last stop'} now`}`
    + `${p.a.due && p.a.kind !== 'back' ? `, back about ${clock(p.a.due)}` : ''}`;
  const cells = [...stops.map((s) => ({ word: s.name.split(' ')[0], at: s.at ? clock(s.at) : s.state === 'now' ? 'now' : '', state: s.state })),
    { word: 'Yard', at: yard, state: p.a.kind === 'back' ? 'now' : 'next' }];
  const cols = { gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` };
  return (
    <button type="button" class="ci-trip" aria-label={said} onClick={() => nav.push('in/checkin', { trip: t.id })}>
      <span class="ci-trip-h">
        {runner && <Avatar {...personFace(runner)} size={40} />}
        <span class="ci-t"><span>{name}</span><span class="mono">{`${counted(lines, 'line')} · ${counted(t.stops.length, 'supplier')}`}</span></span>
        {orderFaces(p.b, t)}
        <Chev />
      </span>
      <span class="ci-rail" aria-hidden="true">
        <span class="ci-rail-dots" style={cols}>
          {cells.slice(1).map((c, i) => (
            <span key={i} class={cx('ci-rail-line', c.state === 'next' ? 'todo' : 'done')}
              style={{ left: `${(100 / cells.length) * (i + 0.5)}%`, width: `${100 / cells.length}%` }} />
          ))}
          {cells.map((c, i) => (
            <span key={i} class={cx('ci-stop', c.state)}>
              {c.state === 'done' ? <Icon name="check" size={12} stroke={3.2} /> : c.word === 'Yard' ? <Icon name="store" size={12} stroke={2} /> : <Icon name="cart" size={14} stroke={2.2} />}
            </span>
          ))}
        </span>
        <span class="ci-rail-words" style={cols}>
          {cells.map((c, i) => c.state === 'now' && c.word !== 'Yard'
            ? <span key={i} class="now">{`${c.word} · now`}</span>
            : <span key={i}>{c.word}{c.at && <> <em class="mono">{c.at}</em></>}</span>)}
        </span>
      </span>
    </button>
  );
}

/** One row of a section: the picture, two lines, a time pill, the chevron. */
function Row(p: { lead: JSX.Element; title: string; sub: string; pill?: JSX.Element; label?: string; on: () => void }): JSX.Element {
  return (
    <button type="button" class="ci-row" aria-label={p.label} onClick={p.on}>
      {p.lead}
      <span class="ci-t"><span>{p.title}</span><span class="mono">{p.sub}</span></span>
      {p.pill}
      <Chev />
    </button>
  );
}

function Section(p: { dot: string; title: string; count: number; children: JSX.Element[] }): JSX.Element {
  return (
    <>
      <GroupHead dot={p.dot} title={p.title} count={p.count} />
      <div class="in-card">{p.children}</div>
    </>
  );
}

function Empty(p: { b: YardBooks; checked: number }): JSX.Element {
  const denis = byRole(p.b, 'buyer');
  return (
    <div class="ci-empty">
      <div class="ci-ghost" aria-hidden="true">
        <div class="ci-ghost-h"><span>Coming in</span><span>{`fills as ${firstWord(denis ? denis.name : 'the Buyer')} buys`}</span></div>
        {[1, 0.7, 0.4].map((o) => (
          <div key={o} class="ci-ghost-r" style={{ opacity: o }}><span class="c" /><span class="t"><i /><i /></span><span class="p" /></div>
        ))}
      </div>
      <div class="ci-empty-m">
        <span aria-hidden="true" class="ci-empty-ic"><Icon name="arrive" size={40} stroke={1.8} /></span>
        <div><h2>Nothing coming in</h2><p>Trips, deliveries and returns land here</p></div>
      </div>
      <div class="ci-empty-end">
        <button type="button" class="ci-ask" onClick={() => nav.push('shelf/find')}><span><Icon name="plus" size={18} stroke={2.4} /></span>{`Ask ${firstWord(denis ? denis.name : 'the Buyer')} for more`}</button>
        {p.checked > 0 && (
          <button type="button" class="ci-checked" onClick={() => nav.home()}>
            <Icon name="delivered" size={18} stroke={2} /><span>{`${p.checked} checked in today · all in`}</span><Icon name="chevron-right" size={14} stroke={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}

export function ComingIn(): JSX.Element {
  const b = books.value, n = now.value;
  const [show, setShow] = useState<Show>('all');
  if (!b) return <StageSheet id="in" title="Coming in" />;
  const all = arrivals(b, n), come = coming(all), back = backNow(all), next = nextDue(all);
  const sub = come.length === 0 ? 'nothing coming' : `${back.length ? `${back.length} back at the yard` : 'nothing back yet'}${next ? ` · next ~${clock(next)}` : ''}`;
  const chip = (id: Show, word: string, count: number, dot?: string) => (
    <button key={id} type="button" class="ci-fchip" aria-pressed={show === id} onClick={() => setShow(id)}>
      {dot && <span aria-hidden="true" class="ci-fdot" style={{ background: dot }} />}{word}<b class="mono">{count}</b>
    </button>
  );
  const chips = come.length ? <div role="group" aria-label="Show" class="ci-fchips">{chip('all', 'All', come.length)}{chip('back', 'Back at the yard', back.length, '#6FDCB0')}{chip('coming', 'Coming', come.length - back.length, '#8DA2D6')}</div> : undefined;
  const checked = all.filter((a) => a.kind === 'checked');
  if (!come.length) return <StageSheet id="in" title="Coming in" count={0} sub={sub}><Empty b={b} checked={checked.length} /></StageSheet>;

  const want = (a: Arrival) => show === 'all' || (show === 'back') === back.includes(a);
  const buying = all.filter((a) => a.kind === 'buying' && want(a)), backTrips = all.filter((a) => a.kind === 'back' && want(a));
  const deliveries = all.filter((a) => a.kind === 'delivery' && want(a)), rets = all.filter((a) => a.kind === 'return' && want(a));
  const moses = byRole(b, 'sourcing');
  return (
    <StageSheet id="in" title="Coming in" count={come.length} sub={sub} chips={chips}>
      <div class="ci-body">
        {backTrips.map((a) => (
          <Fragment key={(a.trip as CheckTrip).id}>
            <GroupHead dot="#6FDCB0" title="Back at the yard" right={<span class="mono">check it in</span>} />
            <TripCard b={b} a={a} all={all} />
          </Fragment>
        ))}
        {buying.map((a) => {
          const st = stopsOf(a.trip as CheckTrip), done = st.filter((s) => s.state === 'done').length;
          return (
            <Fragment key={(a.trip as CheckTrip).id}>
              <GroupHead dot="#7FA2D6" title={`Buying · ${done} of ${st.length}`} right={a.due ? <span class="mono">{`back ~${clock(a.due)}`}</span> : undefined} />
              <TripCard b={b} a={a} all={all} />
            </Fragment>
          );
        })}
        {deliveries.length > 0 && (
          <Section dot="#9DB7E0" title="Deliveries" count={deliveries.length}>
            {deliveries.map((a) => {
              const t = a.trip as CheckTrip, l = t.lines[0], qty = t.lines.reduce((s, x) => s + x.expected, 0);
              return (
                <Row key={t.id} lead={<ItemArt name={l ? l.name : ''} size={32} radius={10} />} title={`${t.stops[0].supplierName} · delivery`}
                  sub={`${qty} ${l ? l.unit : ''} · shelf${moses ? ` · ${firstWord(moses.name)}` : ''}`}
                  pill={a.due ? <span class="ci-time mono">{clock(a.due)}</span> : undefined} on={() => nav.push('in/delivery', { trip: t.id })} />
              );
            })}
          </Section>
        )}
        {rets.length > 0 && (
          <Section dot="#F5B26B" title="Coming back" count={rets.length}>
            {rets.map((a) => {
              const r = a.ret!, o = b.orders.find((x) => x.id === r.orderId), name = o ? o.client.name : '';
              const bags = r.lines.reduce((s, l) => s + l.qty, 0), unit = r.lines[0] ? r.lines[0].unit : '';
              const bringer = o && o.carrier && o.carrier.kind === 'staff' ? o.carrier.name : null;
              return (
                <Row key={r.id} lead={<Avatar {...orderFace(o || { client: { name, phone: '' }, customerId: null }, b)} size={32} />} title={`${name} · return`}
                  sub={`${orderNo(r.orderId)} · ${bags} ${unit}${bringer ? ` · with ${firstWord(bringer)}` : ''}`}
                  pill={a.due ? <span class="ci-time mono amber">{`~${clock(a.due)}`}</span> : undefined} on={() => nav.push('in/return', { order: r.orderId })} />
              );
            })}
          </Section>
        )}
        {show === 'all' && checked.length > 0 && (
          <Section dot="#C9C4BA" title="Checked in today" count={checked.length}>
            {checked.map((a) => {
              const t = a.trip as CheckTrip, runner = b.people.find((x) => x.id === t.runnerId);
              const name = t.delivery ? `${t.stops[0].supplierName} · delivery` : tripName(firstWord(runner ? runner.name : 'The'), t, all);
              const lines = t.lines.filter((l) => !l.notFound), allIn = lines.every((l) => (l.yard ?? l.expected) >= l.expected);
              const packing = [...new Set(lines.map((l) => l.orderId).filter((x): x is number => x != null))]
                .map((id) => b.orders.find((o) => o.id === id)).find((o) => o && o.status === 'preparing');
              const who = byLogin(b, t.checkedBy);
              return (
                <Row key={t.id} lead={<span aria-hidden="true" class="ci-ok"><Icon name="check" size={16} stroke={2.8} /></span>} title={name}
                  sub={`${clock(a.due as number)} · ${counted(lines.length, 'line')} · ${allIn ? 'all in' : 'some differ'}`}
                  label={`${name}, checked in ${clock(a.due as number)}${who && who.id !== b.me.id ? ` by ${firstWord(who.name)}` : ''}, ${counted(lines.length, 'line')}, ${allIn ? 'all came' : 'some differ'}.${packing ? ` ${orderNo(packing.id)} is packing` : ''}`}
                  pill={packing ? <span class="in-pill t-info"><Icon name="orders" size={12} stroke={2.2} />{orderNo(packing.id)}</span> : undefined}
                  on={() => (packing ? nav.push('pack/order', { id: packing.id }) : nav.push('in/checkin', { trip: t.id }))} />
              );
            })}
          </Section>
        )}
        {show === 'all' && (
          <div class="ci-turned">
            <button type="button" class="ci-dashed" onClick={() => { const d = deliveries[0]; if (d && d.trip) nav.push('in/delivery', { trip: d.trip.id }); }}>
              <span aria-hidden="true"><Icon name="plus" size={16} stroke={2.4} /></span>
              <span class="ci-dashed-t"><span>A supplier turned up</span><span>check in a delivery no one listed</span></span>
              <Chev />
            </button>
          </div>
        )}
      </div>
    </StageSheet>
  );
}
