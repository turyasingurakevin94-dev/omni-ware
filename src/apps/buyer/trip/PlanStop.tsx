/*
 * One stop of the planned trip (TripPlan.dc.html): a collapsed one-row card
 * (number · supplier · lines and orders · cost · chevron) that opens to its
 * lines and "Take off this trip"; off the trip it is dashed with "Put back".
 * Held lines sit dashed, open or closed (phone 3): a new price waits on Ruth, or the supplier has not answered.
 */
import type { JSX } from 'preact';
import { heldWord, priceTagWord, type LineRef } from '../../../core/buyer/rules.ts';
import type { BOrder, BuyerBooks, Stop } from '../../../core/buyer/types.ts';
import { clock } from '../../../core/time.ts';
import { counted, firstWord, orderNo } from '../../../core/names.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { cx } from '../../../ui/util.tsx';
import { byRole, memberOf, stopLines, stopOrders, supplierOf } from './model.ts';
import { OrderChip, OrderTags } from './parts.tsx';
import './plan.css';

export interface PlanStopProps {
  b: BuyerBooks;
  n: number;
  stop: Stop;
  open: boolean;
  /** The lines of this supplier held off the trip (price up). */
  held: LineRef[];
  busy: boolean;
  /** The cash ask is out: the plan is fixed. */
  locked: boolean;
  onToggle: () => void;
  onOff: (off: boolean) => void;
}

export function PlanStop(p: PlanStopProps): JSX.Element {
  const sup = supplierOf(p.b, p.stop.supplierId), name = sup ? sup.name : 'Supplier';
  if (p.stop.off) {
    return (
      <div class="ow-b-plan-off">
        <span class="mono ow-b-plan-n off">{p.n}</span>
        <span class="ow-b-plan-t"><b>{name}</b><span class="mono">Off this trip · <s>{fig(p.stop.planned)}</s></span></span>
        {!p.locked && <button type="button" class="ow-b-plan-link" disabled={p.busy} onClick={() => p.onOff(false)} aria-label={`Put ${name} back on this trip`}>{p.busy ? 'Saving…' : 'Put back'}</button>}
      </div>
    );
  }
  const rows = stopLines(p.b, p.stop), ids = stopOrders(p.stop);
  return (
    <div class={cx('ow-b-plan-stop', p.open && 'open')}>
      <button type="button" class="ow-b-plan-row" aria-expanded={p.open} onClick={p.onToggle}
        aria-label={`Stop ${p.n}, ${name}, ${counted(p.stop.lines.length, 'line')}, ${fig(p.stop.planned)}`}>
        <span class="mono ow-b-plan-n">{p.n}</span>
        <span class="ow-b-plan-t"><b>{name}</b><span class="ow-b-plan-meta"><span class="mono">{counted(p.stop.lines.length, 'line')}</span><OrderTags ids={ids} /></span></span>
        <span class="mono ow-b-plan-amt">{fig(p.stop.planned)}</span>
        <Icon name="chevron-down" size={18} stroke={2} class="ow-b-plan-chev" />
      </button>
      {p.open && rows.map((r) => (
        <div key={r.order.id + r.line.key} class="ow-b-plan-line">
          <span class="ow-b-plan-lt"><span>{r.line.name}</span>
            <span class="ow-b-plan-meta"><OrderChip who={memberOf(p.b, r.order.sellerId)} id={r.order.id} /><span class="mono">{`${r.line.qty} ${r.line.unit} × ${fig(r.line.cost)}`}</span></span>
          </span>
          <span class="mono ow-b-plan-lamt">{fig(r.line.qty * r.line.cost)}</span>
        </div>
      ))}
      {p.held.length > 0 && <HeldPrice b={p.b} held={p.held} />}
      {p.open && !p.locked && (
        <div class="ow-b-plan-foot">
          <button type="button" class="ow-b-plan-link" disabled={p.busy} onClick={() => p.onOff(true)} aria-label={`Take ${name} off this trip`}>{p.busy ? 'Saving…' : 'Take off this trip'}</button>
        </div>
      )}
    </div>
  );
}

/** Lines whose new cost is over the selling price: dashed, the old and new cost, "Price up", Ruth decides. */
export function HeldPrice(p: { b: BuyerBooks; held: LineRef[] }): JSX.Element {
  const ruth = byRole(p.b, 'manager');
  const sellers = [...new Set(p.held.map((r) => firstWord(memberOf(p.b, r.order.sellerId)?.name || '')))].filter(Boolean).join(' · ');
  return (
    <div class="ow-b-plan-heldwrap">
      {p.held.map((r) => (
        <div key={r.order.id + r.line.key} class="ow-b-plan-held">
          <div class="ow-b-plan-hrow">
            <span class="ow-b-plan-lt"><span class="dim">{r.line.name}</span>
              <span class="ow-b-plan-meta"><OrderChip who={memberOf(p.b, r.order.sellerId)} id={r.order.id} /><span class="mono">{`${r.line.qty} ${r.line.unit}`}</span></span>
            </span>
            <span class="ow-b-plan-was">{r.line.priceWas != null && <s class="mono">{fig(r.line.priceWas)}</s>}<b class="mono">{fig(r.line.cost)}</b></span>
          </div>
          {r.line.priceTag ? (
            // Found, but the Manager prices it before it is bought (BUY-3, question 2): the tag, no picture of a rise.
            <div class="ow-b-plan-hrow">
              {ruth && <Avatar initials={ruth.initials} tint={ruth.tint} size={28} />}
              <span class="ow-b-plan-ruth"><Icon name="bell" size={14} stroke={2} />{priceTagWord(r.line.priceTag, firstWord(ruth?.name || 'Ruth'))}</span>
            </div>
          ) : (
            <div class="ow-b-plan-hrow">
              <span class="ow-b-plan-up">Price up</span>
              <span class="mono ow-b-plan-sells">{`sells ${fig(r.line.sell)}`}</span>
              {ruth && <Avatar initials={ruth.initials} tint={ruth.tint} size={28} />}
              <span class="ow-b-plan-ruth"><Icon name="bell" size={14} stroke={2} />{`${firstWord(ruth?.name || 'Ruth')} decides`}</span>
            </div>
          )}
        </div>
      ))}
      {sellers && <div class="ow-b-plan-sees">{`${sellers} ${sellers.includes('·') ? 'see' : 'sees'}:`} <b>{p.held.every((r) => r.line.priceTag) ? 'Found' : `Price up · ${firstWord(ruth?.name || 'Ruth')} decides`}</b></div>}
    </div>
  );
}

/** A supplier with lines held off the trip and no stop: still Asked, or a price waits on Ruth. Dashed, "held". */
export function HeldRow(p: { b: BuyerBooks; supplierId: string; refs: LineRef[] }): JSX.Element {
  const sup = supplierOf(p.b, p.supplierId);
  const ids = [...new Set(p.refs.map((r) => r.order.id))];
  const asked = p.refs.find((r) => r.state === 'asked');
  const c = asked ? asked.order.confirms[p.supplierId] : null;
  const ruth = firstWord(byRole(p.b, 'manager')?.name || 'Ruth');
  const why = asked ? `Asked${c && c.askedAt ? ' · ' + clock(c.askedAt) : ''}` : heldWord(p.refs[0], ruth);
  return (
    <div class="ow-b-plan-off held">
      <span class="ow-b-plan-n off"><Icon name="clock" size={16} stroke={2} /></span>
      <span class="ow-b-plan-t"><b>{sup ? sup.name : 'Supplier'}</b><span class="mono">{[why, ...ids.map(orderNo)].join(' · ')}</span></span>
      <span class="mono ow-b-plan-heldw">held</span>
    </div>
  );
}

/** An order on hold (a cancel asked, BUY-1; board XR1Hold phone 5): off the trip until the Manager decides. */
export function HeldOrderRow(p: { o: BOrder }): JSX.Element {
  return (
    <div class="ow-b-plan-off held">
      <span class="ow-b-plan-n off"><Icon name="pause" size={16} stroke={2} /></span>
      <span class="ow-b-plan-t"><b>{p.o.client}</b><span class="mono">{`Cancel asked · ${orderNo(p.o.id)}`}</span></span>
      <span class="mono ow-b-plan-heldw">held</span>
    </div>
  );
}
