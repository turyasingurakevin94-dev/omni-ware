/*
 * Trip · On the trip (TripOn.dc.html): one row per stop. The navy hero is
 * the cash in hand; the route marks the stop now; the stop now opens its
 * lines with Got it all / Short; stops done show what was paid; the dock
 * counts what is paid and the Hand in slide waits for the last stop. A stop just
 * done shows its time and Undo for 5 seconds (the board's Success state).
 */
import { signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { StopCount } from '../../../core/buyer/source.ts';
import { shortWord } from '../../../core/buyer/rules.ts';
import type { BuyerBooks, Stop } from '../../../core/buyer/types.ts';
import { counted, orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Dock } from '../../../ui/Dock.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { act, kept, now, online } from '../shell/store.ts';
import { byRole, keptStops, liveStops, sellersOf, stopLines, supplierOf } from './model.ts';
import { GavePill, NavyHero, RouteStrip, Sees, type RouteNode } from './parts.tsx';
import { StopCard } from './StopCard.tsx';
import './on.css';

/** The stop just done, for its Undo (5 s). */
const justDone = signal<{ sid: string; at: number } | null>(null);
const UNDO_S = 5;

export function On(p: { b: BuyerBooks }): JSX.Element {
  const b = p.b, t = b.trip;
  if (!t) return <main class="ow-b-trip" />;
  const stops = liveStops(t), waiting = keptStops(kept.value);
  const isDone = (s: Stop) => s.done || waiting.has(s.supplierId);
  const done = stops.filter(isDone), paid = stops.reduce((x, s) => x + (s.paid ?? 0), 0);
  const nowAt = stops.findIndex((s) => !isDone(s));
  const inHand = t.cash.amount - paid;
  const esther = byRole(b, 'accounts');
  const orders = [...new Set(stops.flatMap((s) => s.lines.map((l) => l.orderId)))].map((id) => b.orders.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);

  const nodes: RouteNode[] = [{ kind: 'home', label: 'Shop' }, ...stops.map((s, i): RouteNode => ({
    kind: isDone(s) ? 'done' : i === nowAt ? 'now' : 'todo', n: i + 1, label: supplierOf(b, s.supplierId)?.place || '',
  }))];

  const stopDone = async (s: Stop, counts: StopCount[], amount: number) => {
    const r = await act('stopDone', s.supplierId, counts, amount);
    const name = supplierOf(b, s.supplierId)?.name || 'Stop';
    if (r.kept) toast.show('Saved on this phone', { kind: 'warn', sub: `${name} · sends when online` });
    else justDone.value = { sid: s.supplierId, at: now.value };
  };

  const left = stops.length - done.length;
  return (
    <main class="ow-b-trip">
      <NavyHero title="On the trip" at={2} text={`Out · ${t.cash.givenAt ? clock(t.cash.givenAt) : '—'}`} onClose={() => nav.back()}
        pill={t.cash.givenAt ? <GavePill who={esther} at={clock(t.cash.givenAt)} /> : undefined}
        eyebrow="Cash in hand" amount={inHand} pct={stops.length ? (done.length / stops.length) * 100 : 0}
        foot={`${done.length} of ${counted(stops.length, 'stop')} · ${fig(paid)} paid`} />
      <RouteStrip nodes={nodes} donePct={stops.length ? (done.length / stops.length) * 100 : 0} />
      <div class="ow-b-trip-body">
        {(!online.value || waiting.size > 0) && <Notice kind="offline">{waiting.size ? `Offline · saved · ${waiting.size} to send` : 'No signal · stops save on this phone'}</Notice>}
        {stops.map((s, i) => {
          if (i === nowAt) {
            return <StopCard key={s.supplierId} b={b} n={i + 1} stop={s} inHand={inHand} onDone={(c, a) => stopDone(s, c, a)} />;
          }
          return <StopRow key={s.supplierId} b={b} n={i + 1} stop={s} kept={waiting.has(s.supplierId)} next={i === nowAt + 1} />;
        })}
        <Sees who={sellersOf(b, orders)} word="On the trip" />
      </div>
      <Dock words="Paid" total={paid} sub={{ text: `${done.length} of ${counted(stops.length, 'stop')}`, tone: 'mint' }}>
        <Slide label={`Hand in · ${counted(left, 'stop')} to go`} onCommit={() => undefined} lock={{ icon: 'lock', label: `Hand in · ${counted(left, 'stop')} to go` }} />
      </Dock>
    </main>
  );
}

/** A stop that is not the one now: done (what came, what was paid), saved on this phone, or still to come. */
function StopRow(p: { b: BuyerBooks; n: number; stop: Stop; kept: boolean; next: boolean }): JSX.Element {
  const s = p.stop, sup = supplierOf(p.b, s.supplierId), rows = stopLines(p.b, s);
  if (p.kept) {
    return (
      <div class="ow-b-on-row kept">
        <span class="ow-b-on-n kept"><Icon name="check" size={16} stroke={2.4} /></span>
        <span class="ow-b-on-t"><b>{sup?.name}</b><span class="mono">sends when back</span></span>
        <span class="mono ow-b-on-amt">{fig(s.planned)}</span>
      </div>
    );
  }
  if (s.done) {
    const short = rows.find((r) => r.line.got != null && r.line.got < r.line.qty);
    const diff = (s.paid ?? 0) - s.planned;
    const j = justDone.value && justDone.value.sid === s.supplierId ? justDone.value : null;
    const sub = [short ? shortWord(short.line.got as number, short.line.qty) : 'Got it all', !short && diff ? fig(diff, false, true) : '', j ? clock(j.at) : ''].filter(Boolean).join(' · ');
    return (
      <div class="ow-b-on-row">
        <span class={cx('ow-b-on-n', short ? 'short' : 'done')}><Icon name="check" size={16} stroke={2.4} /></span>
        <span class="ow-b-on-t"><b>{sup?.name}</b><span class={cx('mono', short && 'short')}>{sub}</span></span>
        {j ? <UndoStop sid={s.supplierId} name={sup?.name || 'the stop'} /> : <span class="mono ow-b-on-amt good">{fig(s.paid ?? 0)}</span>}
      </div>
    );
  }
  const ids = [...new Set(s.lines.map((l) => l.orderId))];
  const sub = p.next ? `Next · ${counted(s.lines.length, 'line')}` : [counted(s.lines.length, 'line'), ...ids.map(orderNo)].join(' · ');
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
