/*
 * P12 · The order line card (LANGUAGE.md §3 P12). Closed: the item square
 * (or photo), the name, "40 bag × 33,500", ONE chip saying what matters most
 * (Out > Price coming > under the shop's price > Order in > low shelf > the
 * line's amount). Open (being edited): the navy outline and what edits it
 * under the head row (the Stepper, the price field, a LineNote).
 *
 *   <LineCard aisle="Cement" name="Cement · Hima 50kg" qty={40} unit="bag" price={33500} chip={{ kind: 'amount', v: 1340000 }} on={open} />
 *   <LineCard open aisle="Roofing" name="Iron sheet G28 · 3m" qty={40} unit="pc" price={36500} chip={{ kind: 'under', v: -1500 }}>
 *     <div class="ow-row"><Stepper value={40} unit="pc" onChange={…} /><LineNote>Ruth says yes<br />before it is packed</LineNote></div>
 *   </LineCard>
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon } from './icons.tsx';
import { ItemSquare } from './ItemSquare.tsx';
import { fig } from './Money.tsx';
import { cx, type Fig } from './util.tsx';
import './linecard.css';

export type LineChipKind = 'amount' | 'under' | 'out' | 'coming' | 'orderin' | 'shelf';

/** The one chip on a line. under: the difference ("−1,500"); shelf: how many are on it. */
export function LineChip(p: { kind: LineChipKind; v?: Fig }): JSX.Element {
  switch (p.kind) {
    case 'under': return <span class="ow-lchip under mono"><Icon name="tag" size={12} stroke={2.4} />{p.v != null ? fig(p.v) : ''}</span>;
    case 'out': return <span class="ow-lchip words bad">Out</span>;
    case 'coming': return <span class="ow-lchip words warn">Price coming</span>;
    case 'orderin': return <span class="ow-lchip words info">Order in</span>;
    case 'shelf': return <span class="ow-lchip mono shelf">{`${p.v != null ? fig(p.v) : ''} on shelf`}</span>;
    default: return <span class="ow-lchip mono">{p.v != null ? fig(p.v) : ''}</span>;
  }
}

export interface LineCardProps {
  aisle: string;
  photo?: string;
  name: string;
  qty: Fig;
  unit: string;
  /** The price each; null: no price yet. */
  price: Fig | null;
  chip?: { kind: LineChipKind; v?: Fig };
  open?: boolean;
  on?: () => void;
  /** Open: what edits the line, under the head row. */
  children?: ComponentChildren;
}

export function LineCard(p: LineCardProps): JSX.Element {
  const head = (
    <>
      <ItemSquare aisle={p.aisle} photo={p.photo} size={40} />
      <span class="ow-line-t">
        <span class="ow-line-n">{p.name}</span>
        <span class="mono ow-line-s">{`${fig(p.qty)} `}<span class="ow-word">{p.unit}</span>{` × ${p.price == null ? '…' : fig(p.price)}`}</span>
      </span>
      {p.chip && <LineChip {...p.chip} />}
    </>
  );
  if (p.open) {
    return (
      <div class="ow-line open">
        <div class="ow-line-h">{head}</div>
        {p.children}
      </div>
    );
  }
  return <button type="button" class={cx('ow-line')} onClick={p.on}>{head}</button>;
}

/** The one line of words a line needs, in amber ("Ruth says yes before it is packed"). */
export function LineNote(p: { children: ComponentChildren }): JSX.Element {
  return <span class="ow-line-note">{p.children}</span>;
}
