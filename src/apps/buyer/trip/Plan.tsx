/*
 * Trip · Plan (TripPlan.dc.html). The app proposes the round: every found
 * line, one stop per supplier, in route order (rules.tripPlan); held lines
 * dashed (Ruth decides · Asked). One slide sends the cash ask to Accounts;
 * while it waits, the card shows Esther told → Esther gives → Go, and the
 * dock's slide takes the ask back while she has not given it (R1You, BUY-14):
 * never with no signal, since she could give the cash meanwhile.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { UNIT, planStops, tiles, type LineRef } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { counted, firstWord } from '../../../core/names.ts';
import { dayLabel, whenShort } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Dock } from '../../../ui/Dock.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Slide, type SlideProps } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { act, discard, kept, me, now, online } from '../shell/store.ts';
import { byRole, memberOf, planNow, sellersOf, supplierOf } from './model.ts';
import { LightHead, RouteStrip, Sees, type RouteNode } from './parts.tsx';
import { HeldRow, PlanStop } from './PlanStop.tsx';
import './plan.css';

const SIGNAL = 'Take back needs signal';
const hint = () => toast.show('Slide the red button across', { kind: 'warn' });

export function Plan(p: { b: BuyerBooks }): JSX.Element {
  const b = p.b, plan = planNow(b);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const esther = byRole(b, 'accounts'), en = firstWord(esther?.name || 'Accounts');
  const on = plan.stops.filter((s) => !s.off);
  const heldPrice = (sid: string): LineRef[] => plan.held.filter((r) => r.state === 'priceup' && r.line.supplierId === sid);
  const stopIds = new Set(plan.stops.map((s) => s.supplierId));
  const heldElse = new Map<string, LineRef[]>();
  plan.held.filter((r) => r.line.supplierId && !stopIds.has(r.line.supplierId))
    .forEach((r) => { const k = r.line.supplierId as string; heldElse.set(k, [...(heldElse.get(k) || []), r]); });
  const orders = [...new Set(on.flatMap((s) => s.lines.map((l) => l.orderId)))].map((id) => b.orders.find((o) => o.id === id)).filter((o) => !!o);
  const sees = sellersOf(b, orders as NonNullable<(typeof orders)[number]>[]);
  const keptAsk = kept.value.some((k) => k.kind === 'askCash');
  const [back, setBack] = useState<{ err: string | null; at: number | null }>({ err: null, at: null });

  const nodes: RouteNode[] = [{ kind: 'home', label: 'Shop' }];
  plan.stops.forEach((s, i) => { if (!s.off) nodes.push({ kind: 'todo', n: i + 1, label: supplierOf(b, s.supplierId)?.place || '' }); });
  heldElse.forEach((_r, sid) => nodes.push({ kind: 'held', label: supplierOf(b, sid)?.place || '' }));

  const setOff = async (sid: string, off: boolean) => {
    setBusy(sid);
    try {
      await act('setStopOff', sid, off);
      if (off) setOpen(null);
    } catch (e) {
      toast.show('Not saved', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void setOff(sid, off); } });
    } finally { setBusy(null); }
  };
  const send = async () => {
    try {
      const r = await act('askCash');
      if (r.kept) { toast.show('Saved on this phone', { kind: 'warn', sub: 'Sends when online' }); return; }
      setBack({ err: null, at: null });
      const first = on[0] ? supplierOf(b, on[0].supplierId) : undefined;
      toast.show(`Sent to ${en}`, { sub: first ? `Go · stop 1 ${first.place}` : undefined });
    } catch (e) {
      toast.show('Not sent', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void send(); } });
    }
  };

  // Take back the cash ask (BUY-14): never kept on the phone. A write the outbox kept for want of signal is dropped at once.
  const takeBack = async () => {
    setBack({ err: null, at: null });
    try {
      const r = await act('takeBackCash');
      if (r.kept) {
        await Promise.all(kept.value.filter((k) => k.kind === 'takeBackCash').map((k) => discard(k.id)));
        setBack({ err: SIGNAL, at: null });
        return;
      }
      setBack({ err: null, at: now.value });
    } catch (e) {
      setBack({ err: String((e as Error).message || e), at: null });
    }
  };

  const empty = plan.stops.length === 0 && !plan.asking;
  const t = tiles(b, now.value);
  const slide: SlideProps = empty ? { label: 'Nothing found yet', onCommit: () => undefined, state: 'empty' }
    : plan.asking && !online.value
    ? { label: SIGNAL, onCommit: () => undefined, lock: { icon: 'offline', label: SIGNAL } }
    : plan.asking
    ? { label: 'Take back the ask', onCommit: takeBack, onHint: hint }
    : keptAsk ? { label: 'Sends when back', onCommit: () => undefined, lock: { icon: 'offline', label: 'Sends when back' } }
    : on.length === 0 ? { label: 'Put a stop back to send', onCommit: () => undefined, lock: { icon: 'lock', label: 'Put a stop back to send' } }
    : { label: `Send cash ask to ${en}`, onCommit: send, onHint: hint };
  const heldCount = plan.held.length;
  const sub = plan.asking && b.trip?.cash.askedAt
    ? { text: `${en} told · ${whenShort(b.trip.cash.askedAt, now.value)}`, tone: 'amber' as const }
    : { text: [counted(on.length, 'stop'), heldCount ? `${heldCount} held` : counted(plan.lines, 'line')].join(' · '), tone: 'mint' as const };

  return (
    <main class="ow-b-trip">
      <LightHead title="Plan the trip" at={1} text={`${dayLabel(now.value)} · ${counted(planStops(b).length, UNIT.stop)}`} me={me.value} onClose={() => nav.back()} />
      {(!online.value || keptAsk) && !plan.asking && <Notice kind="offline" class="ow-b-trip-notice">{keptAsk ? 'Offline · saved · 1 to send' : 'No signal · the ask waits on this phone'}</Notice>}
      {empty ? (
        <NoneYet toAsk={t.toask} asked={t.asked} />
      ) : (
        <>
          <RouteStrip nodes={nodes} />
          <div class="ow-b-trip-body">
            {back.at != null && !plan.asking && (
              <div class="ow-b-plan-taken" role="status"><Icon name="check" size={16} stroke={2.4} /><b>{`Ask taken back · ${en} told`}</b><span class="mono">{whenShort(back.at, now.value)}</span></div>
            )}
            {plan.stops.map((s, i) => (
              <PlanStop key={s.supplierId} b={b} n={i + 1} stop={s} open={open === s.supplierId} held={heldPrice(s.supplierId)}
                busy={busy === s.supplierId} locked={plan.asking || keptAsk}
                onToggle={() => setOpen(open === s.supplierId ? null : s.supplierId)} onOff={(off) => { void setOff(s.supplierId, off); }} />
            ))}
            {[...heldElse.entries()].map(([sid, refs]) => <HeldRow key={sid} b={b} supplierId={sid} refs={refs} now={now.value} />)}
            {plan.asking && b.trip && <CashAsk b={b} />}
          </div>
        </>
      )}
      {!empty && <Dock face={esther ? <Avatar initials={esther.initials} tint={esther.tint} size={36} /> : null} words={empty ? en : plan.asking ? `Waiting · ${en}` : `Cash from ${en}`} total={empty ? null : plan.cash} sub={sub}
        above={plan.asking ? <TakeBackBand en={en} offline={!online.value} err={back.err} retry={() => { void takeBack(); }} /> : undefined}>
        <Slide {...slide} />
        {plan.asking
          ? <div class="ow-b-trip-sees navy">{`${en}'s ask goes · `}<b>she is told</b></div>
          : <Sees who={sees} word="On the trip" then navy />}
      </Dock>}
    </main>
  );
}

/** Over the dock while the ask waits: no signal (Esther may give meanwhile), or the take back refused, with Try again. */
function TakeBackBand(p: { en: string; offline: boolean; err: string | null; retry: () => void }): JSX.Element | null {
  if (p.offline) return <Notice kind="offline" under>{`No signal · ${p.en} may give meanwhile`}</Notice>;
  if (!p.err) return null;
  return (
    <div class="ow-b-plan-backerr" role="alert">
      <Icon name="warning" size={18} stroke={2} />
      {p.err === SIGNAL ? <span>{SIGNAL}</span> : <span>Not taken back<small>{p.err}</small></span>}
      <button type="button" onClick={p.retry}><Icon name="undo" size={14} stroke={2.4} />Try again</button>
    </div>
  );
}

/** The cash ask on its way: Esther told (a tick and when) → Esther gives → Go. */
function CashAsk(p: { b: BuyerBooks }): JSX.Element {
  const c = p.b.trip ? p.b.trip.cash : null, esther = byRole(p.b, 'accounts') || memberOf(p.b, c?.by || null);
  const en = firstWord(esther?.name || 'Accounts');
  return (
    <div class="ow-b-plan-ask" role="status">
      <div class="ow-b-plan-askh"><b>Cash ask</b><span class="ow-b-plan-wait"><Icon name="clock" size={14} stroke={2} />Waiting</span></div>
      <div class="ow-b-plan-steps">
        <div class="ow-b-plan-step done"><span><Icon name="bell" size={18} stroke={2} /></span><b>{`${en} told`}</b><span class="mono">{c?.askedAt ? whenShort(c.askedAt, now.value) : '—'}</span></div>
        <div class="ow-b-plan-step"><span>{esther ? <Avatar initials={esther.initials} tint={esther.tint} size={30} /> : null}</span><b>{`${en} gives`}</b><span class="mono">—</span></div>
        <div class="ow-b-plan-step"><span><Icon name="pin" size={18} stroke={2} /></span><b>Go</b><span class="mono">—</span></div>
      </div>
    </div>
  );
}

/**
 * Nothing found yet (Additions.dc.html, phone E): the dashed card, then the way to the work: To ask · N
 * (Orders, to ask), else Asked · N (Replies) while asks are out; with nothing at all, back to Today.
 */
function NoneYet(p: { toAsk: number; asked: number }): JSX.Element {
  const way = p.toAsk > 0 ? { label: `To ask · ${p.toAsk}`, on: () => nav.push('orders', { filter: 'toask' }) }
    : p.asked > 0 ? { label: `Asked · ${p.asked}`, on: () => nav.push('replies') } : null;
  return (
    <div class="ow-b-trip-body ow-b-plan-empty">
      <div class="ow-b-plan-none">
        <span><Icon name="truck" size={24} stroke={1.8} /></span>
        <b>Nothing found yet</b>
        <span>The trip fills as suppliers say yes</span>
        <span class="mono">{`0 found · ${p.toAsk} to ask`}</span>
      </div>
      {way && <Button onClick={way.on}>{way.label}</Button>}
      {!way && <button type="button" class="ow-b-plan-home" onClick={() => nav.home()}>Nothing to ask either? Back to Today</button>}
    </div>
  );
}
