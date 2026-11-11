/*
 * Load a run (out/run { dir }; OU02 default, OU03 hired, OU17 pressed, OU04 sending, OU05 loaded,
 * OU06 not sent, OU07 failed). The run's first drop heads the sheet (its track: Packed · Paid 13:12 ·
 * leaves 13:20); Paid · it can leave; where it goes; who drives (remembered, "Ssali drove Ntinda last");
 * what goes on the truck (everything starts on: tap only a line that stays); who sees it after the slide.
 *
 * The slide is the commit (W8 load): it waits its 10 s with the Undo on the end screen (OU05), then goes.
 * Kept with no signal: back here, "Not sent yet · sends when the signal is back" (OU06). Refused: "That did
 * not save · LD-412", the ticks and driver kept, Try again (OU07); Try again shows "Sending…" (OU04).
 * The ticks are this phone's (W8a: nothing is written for them).
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { firstWord, orderNo, plural } from '../../../core/names.ts';
import { droveLast, driverOf, driversOf, etaMins, packWords, runHeld, runOf, trackTimes, type Direction } from '../../../core/store/load.ts';
import type { CarrierPick } from '../../../core/store/source.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import { destinationOf, moneyHeld } from '../../../core/store/yard.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { FullSheet, SheetHead } from '../../../ui/FullSheet.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { Track } from '../../../ui/Track.tsx';
import { nav, type Params } from '../shell/nav.ts';
import { books, me, now, side } from '../shell/store.ts';
import { useCommit } from './commit.ts';
import { Done } from './Done.tsx';
import { openHired, type HiredPick } from './Hired.tsx';
import { AfterSlide, DriverChips, DropPlace, FlowBar, SheetDock, custFace, faceOf, person, seller, shortName, type DriverPick } from './parts.tsx';
import './run.css';

const hint = (t: string) => toast.show(t, { kind: 'warn' });

/** The carrier the slide sends: one of ours, a hired driver, or me. */
function carrierOf(b: YardBooks, pick: DriverPick | null, hired: HiredPick | null): CarrierPick | null {
  if (!pick) return null;
  if (pick.kind === 'hired') return hired ? { kind: 'hired', name: hired.name, what: hired.what, phone: hired.phone, staffId: null } : null;
  const p = pick.kind === 'me' ? b.me : person(b, pick.id);
  return p ? { kind: 'staff', name: p.name, what: '', phone: p.phone, staffId: p.id } : null;
}

function Lines(p: { b: YardBooks; d: Direction; off: Set<string>; dim: boolean; onTick: (k: string) => void; onAll: () => void }): JSX.Element {
  const lines = p.d.drops.flatMap(({ o }) => o.lines.filter((l) => !l.dropped).map((l) => ({ o, l, k: `${o.id}:${l.idx}` })));
  const on = lines.filter((x) => !p.off.has(x.k)).length, all = on === lines.length;
  return (
    <div class="rn-truck">
      <div class="rn-truck-h">
        <span class="rn-truck-ht">
          <span>What goes on the truck</span>
          <span><span aria-hidden="true" class="rn-bars">{lines.map((x) => <span key={x.k} class={p.off.has(x.k) ? 'off' : ''} />)}</span><span class="mono">{on} of {lines.length} on</span></span>
        </span>
        <button type="button" aria-pressed={all} disabled={p.dim} class={'rn-all' + (p.dim ? ' dim' : '')} onClick={p.onAll}><Icon name="check" size={14} stroke={3} />All on</button>
      </div>
      {lines.map(({ o, l, k }) => {
        const it = p.b.items.find((x) => x.key === l.key), q = l.pickedQty ?? l.qty;
        return (
          <button key={k} type="button" class="rn-line" aria-pressed={!p.off.has(k)} disabled={p.dim} onClick={() => p.onTick(k)}
            aria-label={`${l.name}, ${q} ${l.unit}${p.d.drops.length > 1 ? `, ${orderNo(o.id)}` : ''}: ${p.off.has(k) ? 'stays' : 'on'}`}>
            <ItemSquare aisle={(it && it.category) || 'Tools'} size={34} radius={9} icon={20} />
            <span class="rn-line-t"><span>{l.name}</span><span class="mono">{q} <span class="rn-u">{packWords(q, l.unit, l.packQty, l.packUnit)}</span></span></span>
            {p.off.has(k) ? <span aria-hidden="true" class="rn-tick off" /> : <span aria-hidden="true" class="rn-tick"><Icon name="check" size={13} stroke={3.2} /></span>}
          </button>
        );
      })}
    </div>
  );
}

export function Run(p: { params: Params }): JSX.Element {
  const b = books.value, dir = String(p.params.dir || '');
  const live = b ? runOf(b, side.value, me.value, now.value, dir) : null;
  const shot = useRef<Direction | null>(null);
  if (live && live.drops.length) shot.current = live;
  const d = shot.current;
  const [pick, setPick] = useState<DriverPick | null>(p.params.driver ? { kind: 'staff', id: String(p.params.driver) } : null);
  const [hired, setHired] = useState<HiredPick | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [pressing, setPressing] = useState(false);
  const { phase, code, commit: hold10, again: retry } = useCommit('load', d ? d.drops[0].o.id : 0);

  const ids = d ? d.drops.map((x) => x.o.id) : [];
  const chosen: DriverPick | null = pick || (b && d && driverOf(b, d) ? { kind: 'staff', id: driverOf(b, d) as string } : null);
  const carrier = b ? carrierOf(b, chosen, hired) : null;
  const who = carrier ? (carrier.kind === 'hired' ? `${carrier.name} (hired)` : carrier.name) : '';

  const commit = () => {
    if (!b || !d || !carrier) return;
    if (off.size) { hint('Everything goes on, or leave the line on its bay'); return; }
    hold10(`On the road · ${who}`, [ids, carrier]);
  };
  const again = () => (carrier ? retry([ids, carrier]) : Promise.resolve());
  // From To load's own slide: the run goes as it stands.
  useEffect(() => { if (p.params.go && phase === 'ready' && d && !runHeld(d)) commit(); }, []);
  useEffect(() => { if (p.params.hired) openHired(d, b, hired, (h) => { setHired(h); setPick({ kind: 'hired' }); }); }, []);

  if (!b || !d) return <main class="st-ph" />;
  const o = d.drops[0].o, from = seller(b, o), cust = custFace(b, o), n = now.value;

  if (phase === 'done') {
    const eta = etaMins(side.value, b.shopName, d.drops[0].place), leave = o.leavesAt ?? n;
    const at = clock(Math.max(leave, n));
    const bays = d.drops.map((x) => x.o.bay).filter((x) => x != null);
    return (
      <Done mark="check" title="On the road" chip={{ face: faceOf(carrier && carrier.staffId ? person(b, carrier.staffId) : null), name: who, sub: `${ids.map(orderNo).join(' ')} · ${d.name}` }}
        sees={[...(from ? [{ face: { initials: from.initials, tint: 'me' as const }, who: firstWord(from.name), what: `On the road · ${who}`, at }] : []), ...d.drops.map((x) => ({ face: custFace(b, x.o), who: shortName(x.o.client.name), what: `On the road · ${who}`, at }))]}
        next={[
          { icon: 'truck', title: 'On the road', sub: `${firstWord(who)}${eta != null ? ` · arrives ~${clock(Math.max(leave, n) + eta * 60000)}` : ''}` },
          { icon: 'camera', title: 'At the door', sub: 'his photo = Delivered' },
          { icon: 'receipt', title: 'The bill', sub: 'goes by itself 24 h after' },
        ]}
        undo={`Left ${at}${bays.length ? ` · bay ${bays.join(', ')} ${bays.length === 1 ? 'is' : 'are'} free` : ''}`} />
    );
  }

  const t = trackTimes(o), held = runHeld(d), busy = phase === 'sending';
  const dim = phase !== 'ready';
  const paidBy = person(b, o.paidBy);
  const last = droveLast(b, d.drops[0].place);
  const where = [destinationOf(o, b.customers)?.split(',')[0], o.deliverWhen].filter(Boolean).join(' · ');
  const head = (
    <>
      <SheetHead face={cust} name={o.client.name} sub={`${orderNo(o.id)}${o.bay != null ? ` · bay ${o.bay}` : ''}`} subMono phone={o.client.phone}
        callLabel={`Call ${o.client.name}`} onClose={() => nav.back()} style={{ padding: '10px 20px 18px', gap: '14px' }}>
        <Track stage="packing" word="Packed" sub={[moneyHeld(o) ? 'Not paid yet' : o.paidAt != null ? `Paid ${clock(o.paidAt)}` : 'Paid', o.leavesAt != null ? `leaves ${clock(o.leavesAt)}` : ''].filter(Boolean).join(' · ')}
          times={{ checking: t.checking != null ? clock(t.checking) : undefined, buying: t.buying != null ? clock(t.buying) : undefined, packing: t.packing != null ? clock(t.packing) : undefined }} />
      </SheetHead>
      {phase === 'kept' && <FlowBar kind="offline" onRetry={() => { void again(); }} />}
      {phase === 'failed' && <FlowBar kind="failed" code={code} onRetry={() => { void again(); }} />}
    </>
  );
  const label = `Slide to send ${firstWord(who) || 'the truck'} · ${d.drops.length} ${plural(d.drops.length, 'drop')}`;
  const foot = (
    <SheetDock hint={busy ? { icon: 'lock', text: 'Held on this phone until the shop says yes' }
      : phase === 'kept' ? { icon: 'clock', text: 'Sends when the signal is back', tone: 'amber' }
        : phase === 'failed' ? { icon: 'check', text: 'Your ticks and driver are kept', iconTone: 'mint' }
          : held ? { icon: 'bell', text: 'Opens when paid', iconTone: 'mint' }
            : pressing ? { icon: 'slide', text: 'Sends at the end · let go to stop' } : null}>
      {busy ? <Slide label={label} onCommit={() => undefined} state="sending" />
        : phase === 'kept' ? <Slide label="Not sent yet" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Not sent yet' }} />
          : phase === 'failed' ? <Slide label="Not saved yet" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Not saved yet' }} />
            : held ? <Slide label="Nothing can leave yet" onCommit={() => undefined} lock={{ icon: 'lock', label: 'Nothing can leave yet' }} />
              : <Slide label={label} onCommit={commit} onHint={() => hint('Slide the red button across')} pressWord="Keep going" onPress={setPressing} />}
    </SheetDock>
  );
  return (
    <FullSheet onBack={() => nav.back()} backLabel="Back to To load" head={head} foot={foot} pad="12px 16px 14px" gap={8}>
      {(phase === 'ready' || phase === 'sending') && (moneyHeld(o)
        ? <div class="rn-paid held"><Icon name="clock" size={16} stroke={2.2} /><span>Not paid yet · it leaves when paid</span></div>
        : <div class="rn-paid"><Icon name="check" size={16} stroke={2.6} /><span>Paid · it can leave</span>
          {paidBy && <><Avatar initials={paidBy.initials} tint="me" size={24} font={11} style={{ letterSpacing: '-.02em' }} /><span class="rn-paid-w">{firstWord(paidBy.name)} {o.paidAt != null ? clock(o.paidAt) : ''}</span></>}</div>)}
      <DropPlace place={where} phone={o.deliverPhone || o.client.phone} from={from ? { initials: from.initials, tint: 'me' } : null} />
      {phase === 'ready' && (
        <div class="rn-who"><span>Who drives</span>{last && <span>{`${firstWord(last.name)} drove ${d.drops[0].place} last`}</span>}</div>
      )}
      <DriverChips drivers={driversOf(b, d)} me={b.me} chosen={chosen} dim={dim || held} hiredName={hired && chosen && chosen.kind === 'hired' ? hired.name : null}
        onPick={setPick} onHired={() => openHired(d, b, hired, (h) => { setHired(h); setPick({ kind: 'hired' }); })} />
      <Lines b={b} d={d} off={off} dim={dim} onAll={() => setOff(new Set())} onTick={(k) => setOff((s) => { const x = new Set(s); if (x.has(k)) x.delete(k); else x.add(k); return x; })} />
      <AfterSlide faces={[...(from ? [{ initials: from.initials, tint: 'me' as const }] : []), ...d.drops.map((x) => custFace(b, x.o))]}
        who={[from ? firstWord(from.name) : null, ...d.drops.map((x) => shortName(x.o.client.name))].filter(Boolean).join(' and ')} what={`On the road · ${who}`} />
    </FullSheet>
  );
}

