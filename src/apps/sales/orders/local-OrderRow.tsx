/*
 * Local variants of S09's row (src/ui/StageGroup.tsx OrderRow), for the lead to fold into src/ui:
 * the status line also draws a day chip ("6 days", "2+ days"), the little "came" bar (1 of 2 came)
 * and a tick (Paid); the act may lead with an icon (Tell, the WhatsApp disc). And the group's
 * "Show 2 more" foot with its faces (OR01, OR02), and the customer's own order row of Find (OR03).
 */
import type { JSX } from 'preact';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Chevron } from '../../../ui/ActRow.tsx';
import { Duo, Icon, type IconName } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { cx } from '../../../ui/util.tsx';
import type { RowStatus } from './data.ts';
import './orders.css';

export interface RowAct { word: string; amount?: string; duo?: string; tone: 'warn' | 'good'; label: string; on: () => void }

function Status(p: { s: RowStatus }): JSX.Element {
  const s = p.s;
  return (
    <>
      {s.chip && <span class={cx('mono or-chip', s.chip.tone)}>{s.chip.text}</span>}
      {s.bar && (
        <span class="or-st">
          <span aria-hidden="true" class="or-bar">{Array.from({ length: s.bar.of }, (_, i) => <span key={i} class={i < (s.bar as { done: number }).done ? 'on' : ''} />)}</span>
          <span class={cx('ow-orow-w', s.tone)}>{s.text}</span>
        </span>
      )}
      {!s.bar && s.text && (s.face || s.tick
        ? <span class={cx('ow-orow-st', s.tick && 'or-tick')}>{s.face && <Avatar {...s.face} size={18} />}{s.tick && <Icon name="check" size={11} stroke={3.2} />}<span class={cx('ow-orow-w', s.tone)}>{s.text}</span></span>
        : <span class={cx('ow-orow-w', s.tone)}>{s.text}</span>)}
    </>
  );
}

export function OrderRow(p: { face: Face; name: string; no: string; status: RowStatus; amount: number; time: string; act?: RowAct; on: () => void }): JSX.Element {
  const left = (
    <>
      <Avatar {...p.face} size={40} />
      <span class="ow-orow-t">
        <span class="ow-orow-n">{p.name}</span>
        <span class="mono ow-orow-l">{p.no}{(p.status.text || p.status.chip) && <><span aria-hidden="true">·</span><Status s={p.status} /></>}</span>
      </span>
    </>
  );
  const a = p.act;
  if (a) {
    return (
      <div class="ow-orow">
        <button type="button" class="ow-orow-main" onClick={p.on}>{left}</button>
        <div class="ow-orow-r act">
          <span class="mono ow-orow-a">{fig(p.amount)}</span>
          <button type="button" class="ow-orow-act" aria-label={a.label} onClick={a.on}>
            <span class={cx('or-apill', a.tone, a.duo && 'ic')}>{a.duo && <Duo i={a.duo} size={15} />}{a.word}{a.amount && <> <span class="mono">{a.amount}</span></>}</span>
          </button>
        </div>
      </div>
    );
  }
  return (
    <div class="ow-orow">
      <button type="button" class="ow-orow-main" onClick={p.on}>
        {left}
        <span class="ow-orow-r"><span class="mono ow-orow-a">{fig(p.amount)}</span><span class="mono ow-orow-time">{p.time}</span></span>
        <Chevron />
      </button>
    </div>
  );
}

/** The foot of a folded group: the faces of what is folded, "Show 2 more", a chevron down. */
export function ShowMore(p: { faces: Face[]; n: number; on: () => void }): JSX.Element {
  return (
    <button type="button" class="or-more" onClick={p.on}>
      {p.faces.length > 0 && <span aria-hidden="true" class="or-more-f">{p.faces.map((f, i) => <Avatar key={i} {...f} size={24} class="or-more-a" />)}</span>}
      {`Show ${p.n} more`}<Icon name="chevron-down" size={14} stroke={2.2} />
    </button>
  );
}

/** A customer's own order (Find): the item's square or the stage's grey tile, when, the number and what, the amount and a pill. */
export function CustOrderRow(p: { aisle?: string; icon?: IconName; title: string; sub: string; amount: number; pill: { text: string; tone: 'info' | 'good' | 'warn'; tick?: boolean }; on: () => void }): JSX.Element {
  return (
    <button type="button" class="or-crow" onClick={p.on}>
      {p.aisle ? <ItemSquare aisle={p.aisle} size={40} /> : <span aria-hidden="true" class="or-crow-ic"><Icon name={p.icon || 'receipt'} size={20} /></span>}
      <span class="ow-orow-t"><span class="ow-orow-n">{p.title}</span><span class="mono or-crow-s">{p.sub}</span></span>
      <span class="or-crow-r"><span class="mono ow-orow-a">{fig(p.amount)}</span><span class={cx('or-crow-p', p.pill.tone)}>{p.pill.tick && <Icon name="check" size={11} stroke={3.2} />}{p.pill.text}</span></span>
    </button>
  );
}
