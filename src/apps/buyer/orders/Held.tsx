/*
 * Orders on hold (cross-app round 1, BUY-1; board XR1Hold): Sales asked the Manager to cancel
 * (cancel_asks, 0181). The Buyer neither asks nor buys until she decides, so a held order is out
 * of every count and money on the tab and listed last, under "On hold":
 *
 *   <HeldGroup b={b} />    the divider and one grey row per held order (no act; the card opens it)
 *   <HoldPill />           "Cancel asked · hold"
 *   <HoldCard o={o} … />   the order's one amber card: who asked, when, why, and what to do
 */
import type { JSX } from 'preact';
import { heldOrders } from '../../../core/buyer/rules.ts';
import type { BOrder, BuyerBooks } from '../../../core/buyer/types.ts';
import { firstWord, initials, orderNo } from '../../../core/names.ts';
import { clock } from '../../../core/time.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { nav } from '../shell/nav.ts';
import { FromChip, Initials } from './parts.tsx';
import { byRole } from './rules.ts';

/** The shared words for a hold: Sales shows "Cancel asked"; the Buyer adds what it means for him. */
export const HOLD_WORD = 'Cancel asked · hold';

export function HoldPill(p: { short?: boolean }): JSX.Element {
  return <span class="ow-b-orders-hold"><Icon name="pause" size={14} stroke={2.2} />{p.short ? 'hold' : HOLD_WORD}</span>;
}

function RuthChip(p: { b: BuyerBooks }): JSX.Element | null {
  const ruth = byRole(p.b, 'manager');
  if (!ruth) return null;
  return <span class="ow-b-orders-ruth grey"><span aria-hidden="true">{ruth.initials}</span>{`${firstWord(ruth.name)} decides`}</span>;
}

function HeldRow(p: { b: BuyerBooks; o: BOrder }): JSX.Element {
  const { b, o } = p, seller = b.team.find((m) => m.id === o.sellerId) || null;
  const live = o.lines.filter((l) => !l.removed);
  const total = live.reduce((t, l) => t + l.cost * l.qty, 0);
  const open = () => nav.push('orders/order', { id: o.id });
  return (
    <div class="ow-b-orders-row held" onClick={open}>
      <button type="button" class="top" aria-label={`${o.client}, ${orderNo(o.id)}: on hold, a cancel is asked. Open`}>
        <Initials name={o.client} ini={initials(o.client)} />
        <span class="who"><span class="n">{o.client}</span><FromChip who={seller} no={o.id} /></span>
        <span class="mono sum">{fig(total)}</span>
      </button>
      <div class="foot">
        <div class="state">
          <div class="ow-b-orders-strip" aria-hidden="true" style={{ gap: '3px' }}>{live.map((l) => <span key={l.key} class="hold" />)}</div>
          <span><HoldPill /></span>
        </div>
        <RuthChip b={b} />
      </div>
    </div>
  );
}

/** "On hold" and its rows, under the Checking rows; nothing when no order is held. */
export function HeldGroup(p: { b: BuyerBooks }): JSX.Element | null {
  const held = heldOrders(p.b);
  if (!held.length) return null;
  return (
    <>
      <div class="ow-b-orders-heldsec" role="heading" aria-level={2}><span>On hold</span><span class="mono">{held.length}</span><i aria-hidden="true" /></div>
      {held.map((o) => <HeldRow key={o.id} b={p.b} o={o} />)}
    </>
  );
}

/** The held order's card: "Cancel asked · hold · Grace asked Ruth · 9:40 · why · Don't ask or buy. Ruth decides." */
export function HoldCard(p: { b: BuyerBooks; o: BOrder }): JSX.Element | null {
  const h = p.o.hold;
  if (!h) return null;
  const ruth = byRole(p.b, 'manager'), rn = ruth ? firstWord(ruth.name) : 'The manager';
  return (
    <div class="ow-b-orders-holdcard" role="status">
      <div class="h">
        <span aria-hidden="true" class="ic"><Icon name="pause" size={22} stroke={2.2} /></span>
        <span class="t"><b>{HOLD_WORD}</b><span>{`${h.by} asked ${rn} · `}<span class="mono">{clock(h.at)}</span></span></span>
      </div>
      {h.why && <span class="why">{`“${h.why}”`}</span>}
      <div class="do">{ruth && <Avatar initials={ruth.initials} tint={ruth.tint} size={30} />}<b>{`Don't ask or buy. ${rn} decides.`}</b></div>
    </div>
  );
}
