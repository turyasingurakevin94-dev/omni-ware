/*
 * LOCAL PART (for the lead to move into src/ui): the counter's line card, P12 as the KC boards draw it.
 * What P12 (LineCard) cannot do yet:
 *   - the open card's gap is 14 (P12: 12), its chip a button that opens the price (KC10);
 *   - the chip "yes": Ruth's price, a green pill with a tick (KC12);
 *   - the stepper's fewer is a bin at 1, "Take it off" (KC03, KC10);
 *   - the shelf beside the stepper, a dot green (enough) or brown (short, KC18).
 *
 *   <LineHead line={l} chip={{ kind: 'amount', v: 33500 }} />
 *   <LineRow line={l} chip={…} on={open} />                       closed (KC03's Wood glue)
 *   <OpenLine line={l} chip={…} onChip={price} shelf={120} onQty={…}>…price, short…</OpenLine>
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import type { Line } from '../../../core/types.ts';
import '../../../ui/linecard.css';

export type Chip = { kind: 'amount' | 'under' | 'yes'; v: number };

export function LineChip(p: { chip: Chip; on?: () => void; label?: string }): JSX.Element {
  const c = p.chip;
  const inner = c.kind === 'under' ? <><Icon name="tag" size={12} stroke={2.4} />{fig(c.v)}</>
    : c.kind === 'yes' ? <><Icon name="check" size={11} stroke={3.2} />{fig(c.v)}</> : fig(c.v);
  const cls = 'kc-chip' + (c.kind === 'amount' ? '' : ' ' + c.kind);
  return p.on ? <button type="button" class={cls} aria-label={p.label} onClick={p.on}>{inner}</button> : <span class={cls}>{inner}</span>;
}

export function LineHead(p: { line: Line; aisle: string; chip: Chip; onChip?: () => void; chipLabel?: string }): JSX.Element {
  const l = p.line;
  return (
    <>
      <ItemSquare aisle={p.aisle} size={40} />
      <span class="kc-head-t">
        <span class="kc-head-n">{l.name}</span>
        <span class="kc-head-s mono">{`${fig(l.qty)} `}<span class="ow-word">{l.unit}</span>{` × ${l.price == null ? '…' : fig(l.price)}`}</span>
      </span>
      <LineChip chip={p.chip} on={p.onChip} label={p.chipLabel} />
    </>
  );
}

/** Closed: the whole row opens it. */
export function LineRow(p: { line: Line; aisle: string; chip: Chip; on: () => void }): JSX.Element {
  return (
    <a href="#" class="ow-line" aria-label={`${p.line.name}, ${p.line.qty} ${p.line.unit}. Change it`} onClick={(e) => { e.preventDefault(); p.on(); }}>
      <LineHead line={p.line} aisle={p.aisle} chip={p.chip} />
    </a>
  );
}

/** The stepper (P12b), with a bin for the last one. */
export function QtyStep(p: { qty: number; unit: string; onChange: (n: number) => void; bin?: boolean }): JSX.Element {
  const last = p.bin && p.qty <= 1;
  return (
    <div class="kc-step">
      <button type="button" aria-label={last ? 'Take it off' : 'Fewer'} onClick={() => p.onChange(p.qty - 1)}>
        {last ? <Icon name="trash" size={18} stroke={2} /> : <Icon name="minus" size={18} stroke={2.2} />}
      </button>
      <span class="mono">{p.qty}<span class="ow-word">{p.unit}</span></span>
      <button type="button" aria-label="More" onClick={() => p.onChange(p.qty + 1)}><Icon name="plus" size={18} stroke={2.2} /></button>
    </div>
  );
}

export interface OpenLineProps {
  line: Line;
  aisle: string;
  chip: Chip;
  onChip: () => void;
  onHead: () => void;
  onQty: (n: number) => void;
  /** On the shelf now; null: not shown. */
  shelf: number | null;
  children?: ComponentChildren;
}

export function OpenLine(p: OpenLineProps): JSX.Element {
  const l = p.line, short = p.shelf != null && l.qty > p.shelf;
  return (
    <div class="kc-open">
      <div class="kc-head" style={{ cursor: 'default' }}>
        <button type="button" class="kc-head" style={{ flex: 1, minWidth: 0 }} aria-label={`${l.name}, ${l.qty} ${l.unit}. Close it`} onClick={p.onHead}>
          <ItemSquare aisle={p.aisle} size={40} />
          <span class="kc-head-t">
            <span class="kc-head-n">{l.name}</span>
            <span class="kc-head-s mono">{`${fig(l.qty)} `}<span class="ow-word">{l.unit}</span>{` × ${l.price == null ? '…' : fig(l.price)}`}</span>
          </span>
        </button>
        <LineChip chip={p.chip} on={p.onChip} label={`Their price for each ${l.unit}`} />
      </div>
      <div class="kc-ctl">
        <QtyStep qty={l.qty} unit={l.unit} onChange={p.onQty} bin />
        <span class="gap" />
        {p.shelf != null && (
          <span class={'kc-stock' + (short ? ' short' : '')}><i aria-hidden="true" /><b class="mono">{fig(p.shelf)}</b>on shelf</span>
        )}
      </div>
      {p.children}
    </div>
  );
}
