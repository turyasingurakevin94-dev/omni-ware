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
import { Stepper } from './Stepper.tsx';
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

/*
 * The counter's line (KC03, KC07, KC10–KC12, KC18): the open card a little
 * looser (gap 14), its head a button that closes it, the price chip a button
 * that opens the price (KC10), Ruth's yes as a green chip (KC12), the stepper
 * with its bin, and how many are on the shelf, its dot brown when short.
 *
 *   <PriceChip chip={{ kind: 'yes', v: 33500 }} on={price} label="Change the price of each tin" />
 *   <LineHead name={l.name} qty={l.qty} unit={l.unit} price={l.price} aisle="Adhesives" chip={chip} />
 *   <LineLink … on={open} />                                              closed: the whole row opens it
 *   <OpenLine … onHead={close} onChip={price} onQty={setQty} shelf={120}>…</OpenLine>
 */
export type PriceChipKind = 'amount' | 'under' | 'yes';

export function PriceChip(p: { chip: { kind: PriceChipKind; v: Fig }; on?: () => void; label?: string }): JSX.Element {
  const c = p.chip;
  const inner = c.kind === 'under' ? <><Icon name="tag" size={12} stroke={2.4} />{fig(c.v)}</>
    : c.kind === 'yes' ? <><Icon name="check" size={11} stroke={3.2} />{fig(c.v)}</> : fig(c.v);
  const cls = cx('ow-pchip', c.kind !== 'amount' && c.kind);
  return p.on ? <button type="button" class={cls} aria-label={p.label} onClick={p.on}>{inner}</button> : <span class={cls}>{inner}</span>;
}

export interface LineHeadProps { name: string; qty: Fig; unit: string; price: Fig | null; aisle: string; chip: { kind: PriceChipKind; v: Fig }; onChip?: () => void; chipLabel?: string }

function HeadWords(p: { name: string; qty: Fig; unit: string; price: Fig | null }): JSX.Element {
  return (
    <span class="ow-lh-t">
      <span class="ow-lh-n">{p.name}</span>
      <span class="ow-lh-s mono">{`${fig(p.qty)} `}<span class="ow-word">{p.unit}</span>{` × ${p.price == null ? '…' : fig(p.price)}`}</span>
    </span>
  );
}

/** The head of a line: the square, the name, "1 tin × 18,500", the price chip. */
export function LineHead(p: LineHeadProps): JSX.Element {
  return (
    <>
      <ItemSquare aisle={p.aisle} size={40} />
      <HeadWords {...p} />
      <PriceChip chip={p.chip} on={p.onChip} label={p.chipLabel} />
    </>
  );
}

/** Closed: the whole row is a link that opens it. */
export function LineLink(p: LineHeadProps & { on: () => void }): JSX.Element {
  return (
    <a href="#" class="ow-line" aria-label={`${p.name}, ${p.qty} ${p.unit}. Change it`} onClick={(e) => { e.preventDefault(); p.on(); }}>
      <LineHead {...p} onChip={undefined} />
    </a>
  );
}

/** How many are on the shelf: a dot, green when there are enough, brown when short (KC18). */
export function OnShelf(p: { n: Fig; short?: boolean }): JSX.Element {
  return <span class={cx('ow-onshelf', p.short && 'short')}><i aria-hidden="true" /><b class="mono">{fig(p.n)}</b>on shelf</span>;
}

export interface OpenLineProps extends LineHeadProps {
  onChip: () => void;
  onHead: () => void;
  onQty: (n: number) => void;
  /** On the shelf now; null: not shown. */
  shelf: number | null;
  children?: ComponentChildren;
}

export function OpenLine(p: OpenLineProps): JSX.Element {
  const q = Number(p.qty), short = p.shelf != null && q > p.shelf;
  return (
    <div class="ow-oline">
      <div class="ow-lh" style={{ cursor: 'default' }}>
        <button type="button" class="ow-lh" style={{ flex: 1, minWidth: 0 }} aria-label={`${p.name}, ${p.qty} ${p.unit}. Close it`} onClick={p.onHead}>
          <ItemSquare aisle={p.aisle} size={40} />
          <HeadWords {...p} />
        </button>
        <PriceChip chip={p.chip} on={p.onChip} label={`Change the price of each ${p.unit}`} />
      </div>
      <div class="ow-oline-ctl">
        <Stepper value={q} unit={p.unit} bin min={0} onChange={p.onQty} />
        <span class="gap" />
        {p.shelf != null && <OnShelf n={p.shelf} short={short} />}
      </div>
      {p.children}
    </div>
  );
}
