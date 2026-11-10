/*
 * Trip · Plan (TripPlan.dc.html). The app proposes the round: every found
 * line, one stop per supplier, in route order (rules.tripPlan); held lines
 * dashed (Ruth decides · Asked). One slide sends the cash ask to Accounts;
 * while it waits, the card shows Esther told → Esther gives → Go.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { tiles, type LineRef } from '../../../core/buyer/rules.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { counted, firstWord } from '../../../core/names.ts';
import { clock, dayLabel } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Dock } from '../../../ui/Dock.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Slide, type SlideProps } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav } from '../shell/nav.ts';
import { act, kept, me, now, online } from '../shell/store.ts';
import { byRole, memberOf, planNow, sellersOf, supplierOf } from './model.ts';
import { LightHead, RouteStrip, Sees, type RouteNode } from './parts.tsx';
import { HeldRow, PlanStop } from './PlanStop.tsx';
import './plan.css';

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
      const first = on[0] ? supplierOf(b, on[0].supplierId) : undefined;
      toast.show(`Sent to ${en}`, { sub: first ? `Go · stop 1 ${first.place}` : undefined });
    } catch (e) {
      toast.show('Not sent', { kind: 'error', sub: String((e as Error).message || e), retry: () => { void send(); } });
    }
  };

  const empty = plan.stops.length === 0 && !plan.asking;
  const t = tiles(b, now.value);
  const slide: SlideProps = empty ? { label: 'Nothing found yet', onCommit: () => undefined, state: 'empty' }
    : plan.asking
    ? { label: `Waiting for ${en}`, onCommit: () => undefined, lock: { icon: 'hourglass', label: `Waiting for ${en}` } }
    : keptAsk ? { label: 'Sends when back', onCommit: () => undefined, lock: { icon: 'offline', label: 'Sends when back' } }
    : on.length === 0 ? { label: 'Put a stop back to send', onCommit: () => undefined, lock: { icon: 'lock', label: 'Put a stop back to send' } }
    : { label: `Send cash ask to ${en}`, onCommit: send, onHint: hint };
  const heldCount = plan.held.length;
  const sub = plan.asking && b.trip?.cash.askedAt
    ? { text: `${en} told · ${clock(b.trip.cash.askedAt)}`, tone: 'amber' as const }
    : { text: [counted(on.length, 'stop'), heldCount ? `${heldCount} held` : counted(plan.lines, 'line')].join(' · '), tone: 'mint' as const };

  return (
    <main class="ow-b-trip">
      <LightHead title="Plan the trip" at={1} text={dayLabel(now.value)} me={me.value} onClose={() => nav.back()} />
      {(!online.value || keptAsk) && <Notice kind="offline" class="ow-b-trip-notice">{keptAsk ? 'Offline · saved · 1 to send' : 'No signal · the ask waits on this phone'}</Notice>}
      {empty ? (
        <NoneYet toAsk={t.toask} asked={t.asked} />
      ) : (
        <>
          <RouteStrip nodes={nodes} />
          <div class="ow-b-trip-body">
            {plan.stops.map((s, i) => (
              <PlanStop key={s.supplierId} b={b} n={i + 1} stop={s} open={open === s.supplierId} held={heldPrice(s.supplierId)}
                busy={busy === s.supplierId} locked={plan.asking}
                onToggle={() => setOpen(open === s.supplierId ? null : s.supplierId)} onOff={(off) => { void setOff(s.supplierId, off); }} />
            ))}
            {[...heldElse.entries()].map(([sid, refs]) => <HeldRow key={sid} b={b} supplierId={sid} refs={refs} />)}
            {plan.asking && b.trip && <CashAsk b={b} />}
          </div>
        </>
      )}
      {!empty && <Dock words={empty ? en : plan.asking ? `Waiting · ${en}` : `Cash from ${en}`} total={empty ? null : plan.cash} sub={sub}>
        <Slide {...slide} />
        {!empty && <Sees who={sees} word="On the trip" then={!plan.asking} navy />}
      </Dock>}
    </main>
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
        <div class="ow-b-plan-step done"><span><Icon name="bell" size={18} stroke={2} /></span><b>{`${en} told`}</b><span class="mono">{c?.askedAt ? clock(c.askedAt) : '—'}</span></div>
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
        <span><Icon name="basket" size={24} stroke={1.8} /></span>
        <b>Nothing found yet</b>
        <span>The trip fills as suppliers say yes</span>
        <span class="mono">{`0 found · ${p.toAsk} to ask`}</span>
      </div>
      {way && <Button onClick={way.on}>{way.label}</Button>}
      {!way && <button type="button" class="ow-b-plan-home" onClick={() => nav.home()}>Nothing to ask either? Back to Today</button>}
    </div>
  );
}
