/*
 * Ride a trip (route `in/ride { trip? }`; IN30–IN35): the Buyer sends someone from the yard to fetch
 * goods. At the stop: tick each line onto the truck (All on), then Done; at the yard: slide to hand it
 * in. Someone else checks it in, so the count stays blind (screens Q4). No money on this phone.
 *
 *   IN30 at the stop · IN31 at the yard · IN34 sending · IN33 no signal · IN35 not done · IN32 handed in
 *
 * Rules: core/store/ride.ts. Writes: W19 rideTick (Done at the stop), W19a rideHandIn (the slide).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { orderNo } from '../../../core/names.ts';
import { allOn, rideOf, rideStops, ticksFor, type Ticks } from '../../../core/store/ride.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemArt } from '../../../ui/ItemArt.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, books, me, notDone, now } from '../shell/store.ts';
import { byLogin, byRole, customerFace, Done, DoneWho, faceOf, first, HeadPill, HeadRail, InBar, InDock, Pill, Screen, Sees, Steps, TripHead, Updating } from './parts.tsx';
import './ride.css';

type Phase = 'load' | 'back' | 'sending' | 'kept' | 'failed' | 'done';

export function Ride(p: { trip?: string }): JSX.Element {
  const b = books.value as YardBooks, r = b ? rideOf(b, me.value, p.trip || null) : null;
  const [ticks, setTicks] = useState<Ticks>(() => {
    const t: Ticks = {};
    if (r) r.trip.lines.forEach((l) => { const s = r.trip.stops.find((x) => x.id === l.trip); const g = s && s.lines.find((x) => x.idx === l.idx); if (g && g.gotQty != null && s && s.acceptedAt) t[l.id] = g.gotQty; });
    return t;
  });
  const [edit, setEdit] = useState<string | null>(null), [doneAt, setDoneAt] = useState<number | null>(null);
  const [local, setLocal] = useState<Phase | null>(null), [kept, setKept] = useState(false), [handedAt, setHandedAt] = useState(0);
  if (!b || !r) return <Screen head={<TripHead lead={null} name="Ride a trip" sub="" onClose={() => nav.home()} />}><p class="in-gone-p">No trip for you now.</p></Screen>;
  const t = r.trip, stop = t.stops[0], short = stop.supplierName.split(' ')[0], denis = first(r.from ? r.from.name : 'The Buyer');
  const okello = b.people.find((x) => x.role === 'store' && x.id !== b.me.id && !x.away) || null, esther = byRole(b, 'accounts');
  const phase: Phase = local || (r.phase === 'load' ? 'load' : 'back');
  const nLines = t.lines.length, lineWord = `${nLines} ${nLines === 1 ? 'line' : 'lines'}`;
  const orderIds = [...new Set(t.lines.map((l) => l.orderId).filter((x): x is number => x != null))];
  const order = orderIds.length ? b.orders.find((o) => o.id === orderIds[0]) || null : null;
  const seller = order ? byLogin(b, order.takenBy) : null;

  if (phase === 'done') {
    const l = t.lines[0];
    return (
      <Done title="Handed in"
        who={<DoneWho lead={<span class="in-faces2 ri-two"><Avatar initials={b.me.initials} tint="t4" size={30} />{r.driver && <Avatar {...faceOf(r.driver)} size={30} />}</span>} name={stop.supplierName} sub={`${lineWord} · ${clock(handedAt)}`} />}>
        {l && (
          <div class="in-flow ri-flow" role="img" aria-label={`${ticks[l.id] ?? l.expected} ${l.unit} back at the yard`}>
            <div class="in-flow-r">
              <ItemArt name={l.name} size={44} />
              <span class="mono in-flow-n">{ticks[l.id] ?? l.expected}<span>{l.unit}</span></span>
              <span class="in-flow-arrow"><i /><Icon name="chevron-right" size={14} stroke={2.4} /></span>
              <span class="in-to mint"><Icon name="store" size={15} stroke={2.2} />Back at the yard</span>
            </div>
          </div>
        )}
        <Steps steps={[
          { lead: 'check', state: 'done', title: 'Handed in', sub: `${clock(handedAt)} · ${denis} told` },
          { lead: okello ? okello.initials : 'OP', state: 'now', title: `${first(okello ? okello.name : 'The yard')} checks it in`, sub: 'now · blind, at the yard' },
          { lead: 'note', state: 'next', title: `${first(esther ? esther.name : 'Accounts')} checks the receipt`, sub: `${denis} paid ${short}` },
          ...orderIds.map((id) => ({ lead: 'orders', state: 'next' as const, title: `${orderNo(id)} to Packing`, sub: `${first(seller ? seller.name : 'Sales')} sees it after the check-in` })),
        ]} />
      </Done>
    );
  }

  const onTruck = allOn(t, ticks), at = phase === 'load';
  const done = async () => {
    const when = now.value;
    setDoneAt(when);
    setLocal('back');
    notDone.value = null;
    try {
      for (const s of t.stops) { const x = await act('rideTick', s.id, ticksFor(t, s.id, ticks)); if (x.kept) setKept(true); }
    } catch (_e) { setLocal('load'); }
  };
  const handIn = async () => {
    setLocal('sending');
    notDone.value = null;
    try {
      const x = await act('rideHandIn', t.stops.map((s) => s.id));
      if (x.kept) { setKept(true); setLocal('kept'); return; }
      setHandedAt(now.value);
      setLocal('done');
    } catch (_e) { setLocal('failed'); }
  };
  const stops = rideStops({ ...r, phase: at ? 'load' : 'back' }, doneAt ? Object.fromEntries(t.stops.map((s) => [s.id, doneAt])) : {});
  const head = (
    <TripHead lead={<span aria-hidden="true" class="ri-faces"><Avatar initials={b.me.initials} tint="t4" size={34} />{r.driver && <Avatar {...faceOf(r.driver)} size={32} />}</span>}
      name={`Trip to ${stop.supplierName}`} sub={at ? `you ride · ${lineWord}` : `at the yard ${clock(now.value)}`} onClose={() => nav.back()}>
      <div class="ri-head">
        <div class="in-head-chips"><HeadPill face={faceOf(r.from)}>{`From ${denis} · Buyer`}</HeadPill>{r.driver && <HeadPill face={faceOf(r.driver)}>{`${first(r.driver.name)} drives`}</HeadPill>}<span class="in-flex" /></div>
        <HeadRail label={stops.map((s) => `${s.word} ${s.state === 'now' ? 'now' : s.at ? clock(s.at) : ''}`).join(', ')}
          stops={stops.map((s, i) => ({ word: s.word, at: s.state === 'now' ? 'now' : s.at ? `${i === stops.length - 1 && s.state === 'next' ? '~' : ''}${clock(s.at)}` : '', state: s.state, icon: i === stops.length - 1 ? 'store' : 'cart' }))} />
      </div>
    </TripHead>
  );

  if (at) {
    return (
      <Screen head={head} back="Back" pad="14px 16px 20px" gap={10}>
        <div class="in-ghead">
          <span aria-hidden="true" class="ri-sup">{stop.supplierName.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
          <h2>{`${stop.supplierName} · tick it on`}</h2><span class="in-flex" />
          <button type="button" class="ri-all" aria-pressed={onTruck} onClick={() => setTicks(onTruck ? {} : Object.fromEntries(t.lines.map((l) => [l.id, ticks[l.id] ?? l.expected])))}>
            <span><span class="ck"><Icon name="check" size={12} stroke={3} /></span>All on</span>
          </button>
        </div>
        <div class="in-card">
          {t.lines.map((l) => {
            const on = ticks[l.id] != null, n = ticks[l.id] ?? l.expected, o = b.orders.find((x) => x.id === l.orderId);
            return (
              <div key={l.id} class="ri-line">
                <ItemArt name={l.name} size={60} radius={14} />
                <span class="ri-line-t">
                  <span>{l.name}</span>
                  {edit === l.id
                    ? <Stepper value={n} unit={l.unit} onChange={(v) => setTicks({ ...ticks, [l.id]: v })} />
                    : <span class="ri-line-s">
                      <button type="button" class="ri-n" aria-label={`${n} ${l.unit === 'pc' ? 'pieces' : l.unit}: tap to change`} onClick={() => setEdit(l.id)}><b class="mono">{n}</b><span>{l.unit}</span><Icon name="pen" size={12} stroke={2.2} /></button>
                      {o && <span class="ri-for"><Avatar {...customerFace(b, o.client.name)} size={18} /><span class="mono">{orderNo(o.id)}</span></span>}
                    </span>}
                </span>
                <button type="button" class={cx('ri-tick', on && 'on')} aria-label={`${l.name.split(' ')[0]}: ${on ? 'on the truck' : 'not on yet'}`} aria-pressed={on}
                  onClick={() => { const x = { ...ticks }; if (on) delete x[l.id]; else x[l.id] = n; setTicks(x); setEdit(null); }}>
                  <Icon name="check" size={20} stroke={3} />
                </button>
              </div>
            );
          })}
        </div>
        <div class="ri-money"><span aria-hidden="true"><Icon name="lock" size={18} stroke={2} /></span><span><b>{`${denis} pays ${short} from his phone`}</b><span>you load it · no money on this phone</span></span></div>
        {order && (
          <div class="in-who ri-order">
            <Avatar {...customerFace(b, order.client.name)} size={36} />
            <span class="in-who-t"><span>{`${orderNo(order.id)} ${first(order.client.name)} waits on it`}</span><span class="mono">{`${first(seller ? seller.name : 'Sales')} placed it ${clock(order.createdAt ?? 0)}`}</span></span>
            <Pill tone="info" icon="cart">Buying</Pill>
          </div>
        )}
        <div class="rt-who">
          <span><Avatar {...faceOf(r.from)} size={22} />{`${denis} sees`}<b>{onTruck ? `Loaded at ${short} · ${clock(now.value)}` : `Buying · at ${short}`}</b></span>
          {order && <span><Avatar {...faceOf(seller)} size={22} />{`${first(seller ? seller.name : 'Sales')} sees`}<b>{`${orderNo(order.id)} · Buying`}</b></span>}
        </div>
        <div class="in-foot-end"><button type="button" class="in-navybtn" disabled={!onTruck} onClick={() => { void done(); }}><span class="ri-mint"><Icon name="check" size={18} stroke={2.6} /></span>{`Done at ${short} · back to the yard`}</button></div>
      </Screen>
    );
  }

  const gone =phase === 'sending', stuck = phase === 'kept' || kept, failed = phase === 'failed';
  const move = gone ? { kind: 'slide' as const, props: { label: 'Sending…', onCommit: () => undefined, state: 'sending' as const } }
    : stuck ? { kind: 'wait' as const, label: 'Waiting to send' } : { kind: 'slide' as const, props: { label: 'Slide to hand in the trip', onCommit: handIn } };
  const first2 = <Sees face={faceOf(r.from)} who={denis} what={stuck || failed ? `Buying · at ${short}` : 'Handed in'} />;
  const second = stuck ? <Updating at={clock(b.at)} /> : <Sees face={faceOf(okello)} who={first(okello ? okello.name : 'The yard')} what={failed ? 'nothing yet' : `Check it in · ${lineWord}`} />;
  const foot = (
    <div class="in-foot">
      <InBar kept={stuck} what="ticks" retry={failed ? () => { void handIn(); } : undefined} />
      <InDock ring={{ done: t.lines.filter((l) => ticks[l.id] != null).length, of: nLines }} lines={<>{first2}{second}</>} move={move} />
    </div>
  );
  return (
    <Screen head={head} foot={foot} back="Back" gap={10}>
      <div class="in-card in-card16 ri-truck">
        <div class="ri-truck-h"><Icon name="truck" size={20} stroke={2} /><h2>On the truck</h2><Pill tone="good" icon="check" size={11} stroke={3.2}>{`${t.lines.filter((l) => ticks[l.id] != null).length} of ${lineWord}`}</Pill></div>
        {t.lines.map((l) => {
          const o = b.orders.find((x) => x.id === l.orderId);
          return (
            <div key={l.id} class="ri-truck-l">
              <ItemArt name={l.name} size={64} radius={14} />
              <span class="ri-line-t"><span>{l.name}</span><span class="ri-line-s"><b class="mono">{ticks[l.id] ?? l.expected}</b><span class="u">{`${l.unit}${o ? ' · for' : ''}`}</span>{o && <><Avatar {...customerFace(b, o.client.name)} size={20} /><span class="mono o">{orderNo(o.id)}</span></>}</span></span>
              <span role="img" aria-label="Loaded" class="in-mark ok"><Icon name="check" size={12} stroke={3.2} /></span>
            </div>
          );
        })}
      </div>
      <div class="in-who"><Avatar {...faceOf(okello)} size={36} /><span class="in-who-t"><span class="sm">{`${first(okello ? okello.name : 'The yard')} checks it in`}</span><span class="w">blind · you loaded it, so he counts</span></span><Pill tone="info">next</Pill></div>
      <div class="ri-money"><span aria-hidden="true"><Icon name="lock" size={18} stroke={2} /></span><span><b>{`${denis} paid ${short}`}</b><span>{`${first(esther ? esther.name : 'Accounts')} checks his receipt · no money here`}</span></span></div>
    </Screen>
  );
}
