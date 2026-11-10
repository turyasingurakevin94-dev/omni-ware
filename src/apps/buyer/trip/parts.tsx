/*
 * The trip's own pieces, drawn once for its three screens (TripPlan, TripOn,
 * TripHandIn boards): the light head and the navy hero with the three-step
 * bars, the route strip, the order chip (who took it · #0550), the
 * "Grace · Faith see: On the trip" line.
 */
import type { ComponentChildren, JSX } from 'preact';
import { orderNo } from '../../../core/names.ts';
import type { Member } from '../../../core/types.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { cx } from '../../../ui/util.tsx';
import './trip.css';

/** Plan · On the trip · Hand in: which of the three the screen is (1–3). */
function Steps(p: { at: 1 | 2 | 3; navy?: boolean; text: string }): JSX.Element {
  return (
    <span class="ow-b-trip-steps" aria-label={`Step ${p.at} of 3 · ${p.text}`}>
      {[1, 2, 3].map((i) => <i key={i} class={cx(i < p.at && 'done', i === p.at && 'now')} />)}
      <span class="mono">{p.text}</span>
    </span>
  );
}

/** The light head (Plan): close, the title over the steps, the buyer's face. */
export function LightHead(p: { title: string; at: 1 | 2 | 3; text: string; me: Member | null; onClose: () => void; right?: ComponentChildren }): JSX.Element {
  return (
    <header class="ow-b-trip-head">
      <button type="button" class="ow-b-trip-x" aria-label="Close the trip" onClick={p.onClose}><Icon name="close" size={20} stroke={2} /></button>
      <div class="ow-b-trip-ht"><h1>{p.title}</h1><Steps at={p.at} text={p.text} /></div>
      {p.right ?? (p.me && <Avatar initials={p.me.initials} tint="me" size={40} />)}
    </header>
  );
}

/** The navy hero (On the trip, Hand in): close, title and steps, a pill, then the big figure and its bar. */
export function NavyHero(p: {
  title: string; at: 1 | 2 | 3; text: string; onClose: () => void; pill?: ComponentChildren;
  eyebrow: string; amount: number; pct: number; mint?: boolean; foot: string; closeOff?: boolean;
}): JSX.Element {
  return (
    <header class="ow-b-trip-hero">
      <div class="ow-b-trip-hrow">
        <button type="button" class="ow-b-trip-x navy" aria-label="Close the trip" disabled={p.closeOff} onClick={p.onClose}><Icon name="close" size={20} stroke={2} /></button>
        <div class="ow-b-trip-ht"><h1>{p.title}</h1><Steps at={p.at} text={p.text} navy /></div>
        {p.pill}
      </div>
      <span class="ow-b-trip-eye">{p.eyebrow}</span>
      <span class="mono ow-b-trip-big"><small>UGX </small>{fig(p.amount)}</span>
      <span class="ow-b-trip-bar" aria-hidden="true"><i class={cx(p.mint && 'mint')} style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }} /></span>
      <span class="mono ow-b-trip-foot">{p.foot}</span>
    </header>
  );
}

/** Esther's tick on the hero: her face, a mint tick, when she gave the cash. */
export function GavePill(p: { who: Member | undefined; at: string }): JSX.Element {
  return (
    <span class="ow-b-trip-gave mono" aria-label={`${p.who ? p.who.name.split(' ')[0] : 'Accounts'} gave the cash at ${p.at}`}>
      {p.who && <Avatar initials={p.who.initials} tint={p.who.tint} size={28} />}
      <Icon name="check" size={14} stroke={2.6} />{p.at}
    </span>
  );
}

export type NodeKind = 'home' | 'homeNow' | 'todo' | 'now' | 'done' | 'held';
export interface RouteNode { kind: NodeKind; n?: number; label: string }

/** The route: the shop, then each stop's market, the line green up to the stops done. */
export function RouteStrip(p: { nodes: RouteNode[]; donePct?: number }): JSX.Element {
  return (
    <div class="ow-b-trip-route" role="list" aria-label="The route">
      <div class="ow-b-trip-rail" aria-hidden="true" />
      {p.donePct ? <div class="ow-b-trip-rail done" aria-hidden="true" style={{ width: `calc((100% - 88px) * ${p.donePct / 100})` }} /> : null}
      {p.nodes.map((x, i) => (
        <div key={i} role="listitem" class={'ow-b-trip-node k-' + x.kind}>
          <span class="mono">
            {x.kind === 'home' || x.kind === 'homeNow' ? <Icon name="store" size={14} stroke={2} />
              : x.kind === 'done' ? <Icon name="check" size={14} stroke={2.6} /> : x.n ?? ''}
          </span>
          <span>{x.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Who took the order and its number: "GA #0553". */
export function OrderChip(p: { who: Member | undefined; id: number; dim?: boolean }): JSX.Element {
  return (
    <span class={cx('ow-b-trip-chip', p.dim && 'dim')}>
      {p.who && <Avatar initials={p.who.initials} tint={p.who.tint} size={28} />}
      <span class="mono">{orderNo(p.id)}</span>
    </span>
  );
}

/** The order numbers on a stop, as small grey tags. */
export function OrderTags(p: { ids: number[] }): JSX.Element {
  return <>{p.ids.map((id) => <span key={id} class="mono ow-b-trip-tag">{orderNo(id)}</span>)}</>;
}

/** What Sales gets back: "Grace · Faith see: On the trip". */
export function Sees(p: { who: string; word: string; then?: boolean; navy?: boolean }): JSX.Element | null {
  if (!p.who) return null;
  const many = p.who.includes('·');
  return <div class={cx('ow-b-trip-sees', p.navy && 'navy')}>{`${p.who} ${p.then ? 'then ' : ''}${many ? 'see' : 'sees'}:`} <b>{p.word}</b></div>;
}
