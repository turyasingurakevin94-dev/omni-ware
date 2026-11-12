/*
 * One order on the Orders list (Orders p1): who sold it, #no and the customer, what it is or what it
 * asks, the total, who holds it, the stage clock against the limit, and the line "{asker} sees:
 * {answer}" with its place in the queue. A stuck order carries its two answers on the row (D-31):
 * Give it to {Moses} (outline) · Nudge {Denis} (navy), answered in place (the states of the board's
 * second row: pressed, Nudging, Nudged · Undo, Not sent · Try again, Waits).
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { firstWord, orderNo } from '../../../core/names.ts';
import { clockOf, giveTo, holderOf, safeWord } from '../../../core/manager/orders.ts';
import { askerOf, placeOf } from '../../../core/manager/queue.ts';
import type { Ask, ManagerBooks, MOrder, Person } from '../../../core/manager/types.ts';
import { ANSWER, askWord, hm, inStage, limitWord, STAGE } from '../../../core/manager/words.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { nav } from '../shell/nav.ts';
import { undoHeld } from '../shell/store.ts';
import { Clock, Told } from './Bits.tsx';
import { useInPlace, type InPlace } from './useAnswer.ts';

/** What the order is, in a few words: its line (and the supplier asked), or how many lines. */
export function whatItIs(o: MOrder): string {
  if (o.lines.length !== 1) return `${o.lines.length} lines`;
  const l = o.lines[0];
  const asked = o.stage === 'draft' && l.supplierId && l.supplierId !== '__stock__' ? ` · asked ${firstWord(l.supplierName)}` : '';
  return `${l.name}${asked}`;
}

/** The words a nudge carries (the person sees "Ruth nudged you" and these). */
export function nudgeWords(o: MOrder, mins: number): string {
  return `${orderNo(o.id)} has waited ${inStage(mins)} in ${STAGE[o.stage]}. Can you sort it now?`;
}

function Spinner(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" class="mg-orders-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.6" />
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  );
}

/** The two answers of a stuck order, and every state they pass through. */
export function StuckAnswers(p: { o: MOrder; b: ManagerBooks; now: number; spot: InPlace; act: string; setAct: (s: string) => void }): JSX.Element {
  const { o, b, spot } = p;
  const holder = holderOf(b, o), to = giveTo(b, o), c = clockOf(o, b.shop, p.now);
  const stop = (e: Event) => e.stopPropagation();
  const nudge = holder && holder.id !== b.me.id ? () => { p.setAct(`Nudge ${firstWord(holder.name)}`); spot.go(`${ANSWER.nudged} ${firstWord(holder.name)} · ${hm(p.now)}`, 'nudge', [holder.id, o.id, nudgeWords(o, c.mins)]); } : null;
  const give = to ? () => { p.setAct(`Give it to ${firstWord(to.name)}`); spot.go(`Given to ${firstWord(to.name)} · ${orderNo(o.id)}`, 'giveTo', [o.id, to.id]); } : null;
  if (spot.st === 'held' || spot.st === 'done') {
    return (
      <div class="mg-orders-strip" role="status" onClick={stop}>
        <Icon name="check" size={18} stroke={2.4} />
        <span>{spot.label}</span>
        {spot.st === 'held' && <button type="button" onClick={() => undoHeld()}><Icon name="undo" size={16} stroke={2.2} />Undo</button>}
      </div>
    );
  }
  if (spot.st === 'kept') return <div class="mg-orders-acts" onClick={stop}><span class="mg-orders-waits"><Icon name="clock" size={16} stroke={2} />Waits</span></div>;
  if (spot.st === 'error') {
    return (
      <div class="mg-orders-err" role="alert" onClick={stop}>
        <span class="ic"><Icon name="warning" size={18} stroke={2} /></span>
        <span class="t"><b>Not sent</b><span class="mono">{`${p.act} · ${orderNo(o.id)}`}</span></span>
        <button type="button" class="mg-orders-btn navy" onClick={spot.retry}><Icon name="retry" size={16} stroke={2.2} />Try again</button>
      </div>
    );
  }
  const sending = spot.st === 'sending';
  return (
    <div class="mg-orders-acts" onClick={stop}>
      {give && to && (
        <button type="button" class="mg-orders-btn out face" aria-disabled={sending ? 'true' : undefined} onClick={() => { if (!sending) give(); }}>
          <Avatar initials={to.initials} tint={to.tint} size={28} />{`Give it to ${firstWord(to.name)}`}
        </button>
      )}
      {nudge && holder && (
        <button type="button" class="mg-orders-btn navy" aria-disabled={sending ? 'true' : undefined} onClick={() => { if (!sending) nudge(); }}>
          {sending ? <><Spinner />{p.act.startsWith('Nudge') ? 'Nudging' : 'Sending…'}</> : <><Icon name="send" size={16} stroke={2} />{`Nudge ${firstWord(holder.name)}`}</>}
        </button>
      )}
    </div>
  );
}

export function OrderCard(p: { o: MOrder; b: ManagerBooks; q: Ask[]; now: number; stuck?: boolean }): JSX.Element {
  const { o, b, q } = p;
  const spot = useInPlace(true);
  const [act, setAct] = useState('');
  const seller = b.team.find((x) => x.id === o.sellerId) || null;
  const ask = q.find((a) => a.orderId === o.id) || null;
  const holder: Person | null = ask ? b.me : holderOf(b, o);
  const c = clockOf(o, b.shop, p.now);
  const over = c.limit > 0 && c.mins > c.limit;
  const place = ask ? placeOf(q, ask.key) : null;
  const asker = ask ? askerOf(b, ask) : null;
  const nudged = holder && p.stuck ? holder : null;
  const sub = spot.st === 'held' && nudged ? `${firstWord(nudged.name)} is told · 10 s to undo`
    : ask ? askWord(ask.kind, ask.kind === 'price' ? ask.mode : ask.kind === 'credit' ? ask.why : undefined) : whatItIs(o);
  return (
    <div class={'mg-orders-card' + (p.stuck ? ' stuck' : '')} role="button" tabIndex={0} aria-label={`${orderNo(o.id)} ${o.customerName}`}
      onClick={() => nav.push(p.stuck ? 'orders/stuck' : 'orders/order', p.stuck ? {} : { id: o.id })}
      onKeyDown={(e) => { if (e.key === 'Enter') nav.push('orders/order', { id: o.id }); }}>
      <div class="top">
        {seller && <Avatar initials={seller.initials} tint={seller.tint} size={36} font={13} />}
        <div class="mid">
          <div class="nm"><span class="no mono">{orderNo(o.id)}</span><span class="cu">{o.customerName}</span></div>
          <span class={'sub mono' + (ask && spot.st !== 'held' ? ' warn' : '')}>{sub}</span>
        </div>
        <div class="end">
          <span class="tot mono">{money(o.total)}</span>
          {holder && <span class="who"><Avatar initials={holder.initials} tint={holder.tint} size={22} />{firstWord(holder.name)}</span>}
        </div>
      </div>
      {c.limit > 0 && <Clock fill={c.fillPct} tick={c.tickPct} over={over} text={`${inStage(c.mins)} / ${limitWord(c.limit)}`} />}
      {p.stuck && <StuckAnswers o={o} b={b} now={p.now} spot={spot} act={act} setAct={setAct} />}
      {p.stuck && nudged && (spot.st === 'idle' || spot.st === 'sending') && <Told who={`${firstWord(nudged.name)} sees`} word={`${firstWord(b.me.name)} nudged you`} />}
      {ask && asker && (
        <div class="mg-orders-tl">
          <Told who={`${firstWord(asker.name)} sees`} word={safeWord(b, ask)} />
          {place && <span class="mg-orders-place mono">{`${place.n} of ${place.of}`}</span>}
        </div>
      )}
    </div>
  );
}
