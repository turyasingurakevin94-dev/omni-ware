/*
 * Trip · On the trip (TripOn.dc.html): one row per stop. The navy hero is
 * the cash in hand; the route marks the stop now; the stop now opens its
 * lines with Got it all / Short; stops done show what was paid; the dock
 * counts what is paid and the Hand in slide waits for the last stop. A stop just
 * done shows its time and Undo for 5 seconds (the board's Success state). With
 * every stop done (phone 4) the hero is the cash back and the slide hands in;
 * once the last Undo goes, Hand in comes up (Trip.tsx).
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { StopCount } from '../../../core/buyer/source.ts';
import { handIn, shortWord } from '../../../core/buyer/rules.ts';
import type { BuyerBooks, Stop } from '../../../core/buyer/types.ts';
import { counted, orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Dock } from '../../../ui/Dock.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, kept, now, online } from '../shell/store.ts';
import { handInNow, justDone, UNDO_S } from './after.ts';
import { byRole, keptStops, liveStops, sellersOf, stopLines, supplierOf } from './model.ts';
import { GavePill, NavyHero, RouteStrip, Sees, type RouteNode } from './parts.tsx';
import { StopCard } from './StopCard.tsx';
import './on.css';

export function On(p: { b: BuyerBooks }): JSX.Element {
  const b = p.b, t = b.trip;
  const card = useRef<HTMLDivElement>(null);
  const stops = t ? liveStops(t) : [], waiting = keptStops(kept.value);
  const nowAt = stops.findIndex((s) => !s.done);
  // The stop now in full above the dock: a new stop now scrolls into view (scroll-margin leaves the dock's room).
  useEffect(() => { if (nowAt > 0 && card.current) card.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [nowAt]);
  if (!t) return <main class="ow-b-trip" />;
  const done = stops.filter((s) => s.done), h = handIn(t, b), paid = h.paid;
  const all = stops.length > 0 && done.length === stops.length;
  const inHand = t.cash.amount - paid;
  const esther = byRole(b, 'accounts'), en = (esther?.name || 'Accounts').split(' ')[0];
  const orders = [...new Set(stops.flatMap((s) => s.lines.map((l) => l.orderId)))].map((id) => b.orders.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
  const lines = stops.reduce((x, s) => x + s.lines.length, 0);

  const nodes: RouteNode[] = [all ? { kind: 'homeNow', label: 'Back' } : { kind: 'home', label: 'Shop' }, ...stops.map((s, i): RouteNode => ({
    kind: s.done ? 'done' : i === nowAt ? 'now' : 'todo', n: i + 1, label: supplierOf(b, s.supplierId)?.place || '',
  }))];

  const stopDone = async (s: Stop, counts: StopCount[], amount: number) => {
    const r = await act('stopDone', s.supplierId, counts, amount);
    const name = supplierOf(b, s.supplierId)?.name || 'Stop';
    if (r.kept) toast.show('Saved on this phone', { kind: 'warn', sub: `${name} · sends when online` });
    else justDone.value = { sid: s.supplierId, at: now.value };
  };

  const left = stops.length - done.length, pct = stops.length ? (done.length / stops.length) * 100 : 0;
  return (
    <main class="ow-b-trip">
      {all
        ? <NavyHero title="On the trip" at={2} text={`Back · ${clock(now.value)}`} onClose={() => nav.back()}
            pill={b.me && <Avatar initials={b.me.initials} tint="me" onNavy size={40} />}
            eyebrow={`Cash back to ${en}`} amount={h.back} pct={100} mint foot={`${done.length} of ${counted(stops.length, 'stop')} · ${fig(paid)} paid`} />
        : <NavyHero title="On the trip" at={2} text={`Out · ${t.cash.givenAt ? clock(t.cash.givenAt) : '—'}`} onClose={() => nav.back()}
            pill={t.cash.givenAt ? <GavePill who={esther} at={clock(t.cash.givenAt)} /> : undefined}
            eyebrow="Cash in hand" amount={inHand} pct={pct} foot={`${done.length} of ${counted(stops.length, 'stop')} · ${fig(paid)} paid`} />}
      <RouteStrip nodes={nodes} donePct={pct} />
      <div class="ow-b-trip-body">
        {(!online.value || waiting.size > 0) && <Notice kind="offline">{waiting.size ? `Offline · saved · ${waiting.size} to send` : 'No signal · stops save on this phone'}</Notice>}
        {stops.map((s, i) => {
          if (i === nowAt) {
            return <div key={s.supplierId} ref={card} class="ow-b-on-now"><StopCard b={b} n={i + 1} stop={s} inHand={inHand} onDone={(c, a) => stopDone(s, c, a)} /></div>;
          }
          return <StopRow key={s.supplierId} b={b} n={i + 1} stop={s} kept={waiting.has(s.supplierId)} next={i === nowAt + 1} />;
        })}
        {!all && <Sees who={sellersOf(b, orders)} word="On the trip" />}
      </div>
      {all
        ? <Dock words="Paid" total={paid} sub={{ text: `${counted(lines, 'line')} · ${h.shorts.length} short`, tone: 'mint' }}>
            <Slide label="Hand in" onCommit={() => handInNow()} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
          </Dock>
        : <Dock words="Paid" total={paid} sub={{ text: `${done.length} of ${counted(stops.length, 'stop')}`, tone: 'mint' }}>
            <Slide label={`Hand in · ${counted(left, 'stop')} to go`} onCommit={() => undefined} lock={{ icon: 'lock', label: `Hand in · ${counted(left, 'stop')} to go` }} />
          </Dock>}
    </main>
  );
}

/** A stop that is not the one now: done (what came, what was paid), saved on this phone, or still to come. */
function StopRow(p: { b: BuyerBooks; n: number; stop: Stop; kept: boolean; next: boolean }): JSX.Element {
  const s = p.stop, sup = supplierOf(p.b, s.supplierId), rows = stopLines(p.b, s);
  const short = rows.find((r) => r.line.got != null && r.line.got < r.line.qty);
  const word = short ? shortWord(short.line.got as number, short.line.qty) : 'Got it all';
  if (p.kept) {
    return (
      <div class="ow-b-on-row kept">
        <span class="ow-b-on-n kept"><Icon name="check" size={16} stroke={2.4} /></span>
        <span class="ow-b-on-t"><b>{sup?.name}</b><span class={cx('mono', short && 'short')}>{`${word} · sends when back`}</span></span>
        <span class="mono ow-b-on-amt">{fig(s.paid ?? s.planned)}</span>
      </div>
    );
  }
  if (s.done) {
    const diff = (s.paid ?? 0) - s.planned;
    const j = justDone.value && justDone.value.sid === s.supplierId ? justDone.value : null;
    const at = s.doneAt ?? (j ? j.at : null);
    const sub = [word, at != null ? clock(at) : '', !short && diff ? fig(diff, false, true) : ''].filter(Boolean).join(' · ');
    return (
      <div class="ow-b-on-row">
        <span class={cx('ow-b-on-n', short ? 'short' : 'done')}><Icon name="check" size={16} stroke={2.4} /></span>
        <span class="ow-b-on-t"><b>{sup?.name}</b><span class={cx('mono', short && 'short')}>{sub}</span></span>
        {j ? <UndoStop sid={s.supplierId} name={sup?.name || 'the stop'} /> : <span class="mono ow-b-on-amt good">{fig(s.paid ?? 0)}</span>}
      </div>
    );
  }
  const ids = [...new Set(s.lines.map((l) => l.orderId))];
  const sub = [p.next ? `Next · ${counted(s.lines.length, 'line')}` : counted(s.lines.length, 'line'), ...ids.map(orderNo)].join(' · ');
  return (
    <div class="ow-b-on-row" aria-label={`Stop ${p.n}, ${sup?.name}, ${sub}`}>
      <span class="mono ow-b-on-n">{p.n}</span>
      <span class="ow-b-on-t"><b>{sup?.name}</b><span class="mono">{sub}</span></span>
      <span class="mono ow-b-on-amt dim">{fig(s.planned)}</span>
    </div>
  );
}


/** Undo with its seconds left; at 0 it goes and the stop stays done. */
function UndoStop(p: { sid: string; name: string }): JSX.Element {
  const [left, setLeft] = useState(UNDO_S), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (busy) return undefined;
    if (left <= 0) { justDone.value = null; return undefined; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, busy]);
  const undo = async () => {
    setBusy(true);
    try { await act('undoStop', p.sid); justDone.value = null; }
    catch (e) { setBusy(false); setLeft(0); toast.show('Not undone', { kind: 'error', sub: e instanceof Error ? e.message : '' }); }
  };
  return (
    <button type="button" class="ow-b-on-undo" disabled={busy} onClick={() => void undo()} aria-label={`Undo ${p.name}, ${left} seconds left`}>
      Undo <span class="mono">{left}</span>
    </button>
  );
}
