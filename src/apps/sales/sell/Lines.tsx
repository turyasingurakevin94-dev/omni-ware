/*
 * The order's lines (P12), newest first, and the one line open for editing:
 *   SL06  the count, the shelf, their price (the shop's, or what they paid last), the bin
 *   SL13  more than the shelf holds: "8 short" → Make it 12 / Order in 8
 *   SL14  a count under 1: "use the bin to remove it" (the count is not taken)
 *   SL15  a carton-only item asked by the kg: 1 carton beside 20 × 1 kg
 *   SL22  a price under the shop's: Ruth decides before it is packed
 * The count is taken when the line closes (tap its head, another line, or anything else).
 */
import { computed, signal } from '@preact/signals';
import type { JSX } from 'preact';
import { lineTotal } from '../../../core/money.ts';
import { lineWaits } from '../../../core/orders.ts';
import type { Books, Item, Line } from '../../../core/types.ts';
import { Icon } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig } from '../../../ui/Money.tsx';
import { Stepper } from '../../../ui/Stepper.tsx';
import { toast } from '../../../ui/toast.tsx';
import { books } from '../shell/store.ts';
import { buyer, manager } from './people.ts';
import { add, cur, itemOf, openId, orderInRest, remove, restOf, restore, setPrice, setQty } from './model.ts';
import { openPrice, openPriceComing } from './sheets.tsx';
import { lastPaid } from './insights.ts';
import './lines.css';

/** What was asked of a line in other words than its own ("20 kg" of a carton-only item: SL15). */
export const askedAs = signal<Map<number, { qty: number; unit: string; alt: Item | null }>>(new Map());
/** The count being changed on the open line, before it is taken. */
const editQty = signal<number | null>(null);

/** The open line shows a warning of its own (a count under 1, a carton for kg): the boards set it closer (SL14, SL15). */
export const openWarns = computed(() => openId.value != null && ((editQty.value != null && editQty.value < 1) || askedAs.value.has(openId.value)));

/** Close the open line, taking its count. */
export function closeLine(): void {
  const id = openId.value, q = editQty.value;
  if (id != null && q != null && q >= 1) setQty(id, q);
  editQty.value = null;
  openId.value = null;
}

export function openLine(id: number): void {
  if (openId.value === id) { closeLine(); return; }
  closeLine();
  openId.value = id;
}

const noInch = (s: string) => s.replace(/"/g, ' inch');

function Sub(p: { l: Line; it?: Item }): JSX.Element {
  const l = p.l, x = cur.value, rest = x ? restOf(x, l) : 0;
  if (l.price == null) return <span class="mono sl-line-s">{`${fig(l.qty)} `}<span class="ow-word">{l.unit}</span>{' · '}<span class="ow-word">Order in</span></span>;
  return <span class="mono sl-line-s">{`${fig(l.qty)} `}<span class="ow-word">{l.unit}</span>{` × ${fig(l.price)}`}{rest > 0 && <span class="ow-word">{` · ${rest} order in`}</span>}</span>;
}

/** SL40 · part from our shelf, the rest ordered in: a split bar and who buys it. */
function SplitPanel(p: { b: Books; shelf: number; rest: number }): JSX.Element {
  const d = buyer(p.b), all = p.shelf + p.rest;
  return (
    <div class="sl-split">
      <div class="sl-split-h"><span><Icon name="cart" size={16} stroke={2.2} /><b class="mono">{p.rest}</b> order in</span><span>{`${d.first} buys them`}</span></div>
      <div role="img" aria-label={`${p.shelf} of ${all} from our shelf, ${p.rest} ordered in`} class="sl-split-bar"><span style={{ width: `${(100 * p.shelf) / all}%` }} /><span /></div>
      <div class="sl-split-k"><span><i class="s" /><b class="mono">{p.shelf}</b> from our shelf</span><span><i class="o" /><b class="mono">{p.rest}</b> order in</span></div>
    </div>
  );
}

function Head(p: { l: Line; b: Books; chip?: JSX.Element }): JSX.Element {
  const l = p.l, it = itemOf(p.b, l.itemId, l.variantIdx);
  return (
    <>
      <ItemSquare aisle={it ? it.aisle : ''} size={40} />
      <span class="sl-line-t"><span class="sl-line-n">{l.name}</span><Sub l={l} it={it} /></span>
      {p.chip || (l.price == null ? <span class="sl-chip warn">Price coming</span> : <span class="mono sl-chip">{fig(lineTotal(l))}</span>)}
    </>
  );
}

/** One line, closed: a tap opens it (the hinge with no price opens its "Price coming" sheet). */
export function LineRow(p: { l: Line; b: Books; on?: () => void }): JSX.Element {
  return (
    <a href="#" class="sl-line" onClick={(e) => { e.preventDefault(); (p.on || (() => openLine(p.l.lineId)))(); }}><Head l={p.l} b={p.b} /></a>
  );
}

function binIt(l: Line): void {
  const gone = remove(l.lineId);
  editQty.value = null;
  if (gone) toast.show(`Removed ${gone.name.split(' · ')[0]}`, { undo: () => restore(gone) });
}

function Bin(p: { l: Line; bad?: boolean }): JSX.Element {
  return (
    <button type="button" class={'sl-bin' + (p.bad ? ' bad' : '')} aria-label={`Remove ${noInch(p.l.name.split(' · ')[0])}`} onClick={() => binIt(p.l)}>
      <Icon name="trash" size={19} stroke={2} />
    </button>
  );
}

function Shelf(p: { n: number }): JSX.Element {
  return <span class="sl-shelf-c"><b class="mono">{fig(p.n)}</b> on shelf</span>;
}

/** Their price, each: a tap opens the keypad (SL18). */
function PriceLink(p: { l: Line }): JSX.Element {
  const l = p.l, diff = l.price != null && l.shopPrice != null ? l.price - l.shopPrice : 0;
  return (
    <a href="#" class="sl-pfield" aria-label={`Their price, each: ${fig(l.price || 0)}. Change it`} onClick={(e) => { e.preventDefault(); openPrice(l.lineId); }}>
      <span class="sl-pfield-t"><span>Their price, each</span><span class="mono">{fig(l.price || 0)}</span></span>
      {diff < 0
        ? <span class="mono sl-pfield-d"><Icon name="tag" size={12} stroke={2.4} />{fig(diff)}</span>
        : diff === 0 ? <span class="sl-pfield-ok"><Icon name="check" size={13} stroke={3} />shop’s price</span> : null}
    </a>
  );
}

/** The open line. */
export function OpenLine(p: { l: Line; b: Books; me: string; customerId: string | null }): JSX.Element {
  const l = p.l, b = p.b, it = itemOf(b, l.itemId, l.variantIdx), shelf = it && it.onShelf != null ? it.onShelf : null;
  const q = editQty.value ?? l.qty, set = (n: number) => { editQty.value = n; };
  const asked = askedAs.value.get(l.lineId);
  const x = cur.value, split = x && x.split ? x.split[l.lineId] : undefined, rest = split != null && q > split ? q - split : 0;
  const shortNow = !rest && l.from === 'shelf' && shelf != null && q > shelf ? q - shelf : 0;
  if (q < 1) {
    return (
      <div class="sl-open g12">
        <div class="sl-open-h"><Head l={l} b={b} /></div>
        <div class="sl-open-r">
          <div class="sl-step bad">
            <button type="button" aria-label="Fewer" disabled><Icon name="minus" size={18} stroke={2.2} /></button>
            <span class="mono">0<span class="ow-word">{l.unit}</span><s aria-label={`was ${l.qty}`}>{l.qty}</s></span>
            <button type="button" aria-label="More" onClick={() => set(1)}><Icon name="plus" size={18} stroke={2.2} /></button>
          </div>
          <span class="sl-flex" /><Bin l={l} bad />
        </div>
        <div role="alert" class="sl-alert"><Icon name="warning" size={16} stroke={2.2} /><span>At least <span class="mono">1</span> — use the bin to remove it</span></div>
        <PriceLink l={l} />
      </div>
    );
  }
  const stepRow = (
    <div class="sl-open-r">
      <Stepper value={q} unit={l.unit} min={0} onChange={set} />
      <span class="sl-flex" />{shelf != null && <Shelf n={shelf} />}
    </div>
  );
  if (asked && asked.unit !== l.unit) {
    const alt = asked.alt;
    return (
      <div class="sl-open g12">
        <div class="sl-open-h"><Head l={l} b={b} /></div>
        {stepRow}
        <div class="sl-whole">
          <span class="sl-whole-w"><Icon name="warning" size={14} stroke={2.2} />{`Sold by the ${l.unit === 'ctn' ? 'carton' : l.unit} only · you typed `}<b class="mono">{asked.qty}</b>{` ${asked.unit}`}</span>
          <div class="sl-whole-g">
            <button type="button" aria-pressed="true" class="sl-whole-c on">
              <span>{`${l.qty} ${l.unit === 'ctn' ? 'carton' : l.unit}`}</span><span>{`${l.packQty * l.qty} ${l.packUnit} · in the order`}</span><span class="mono">{fig(lineTotal(l))}</span>
            </button>
            {alt && (
              <button type="button" aria-pressed="false" class="sl-whole-c" onClick={() => { remove(l.lineId); const n = add(alt, asked.qty); askedAs.value = new Map(); openId.value = n.lineId; }}>
                <span>{`${asked.qty} × 1 ${asked.unit}`}</span><span>{alt.name}</span><span class="mono">{fig(asked.qty * (alt.price || 0))}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  if (shortNow > 0 && shelf != null) {
    return (
      <div class="sl-open">
        <div class="sl-open-h"><Head l={l} b={b} chip={<span class="sl-chip warn">{`${shortNow} short`}</span>} /></div>
        {stepRow}
        <div class="sl-short">
          <div class="sl-short-h"><span><Icon name="warning" size={16} stroke={2.2} /><b class="mono">{shortNow}</b> short</span><span><b class="mono">{q}</b> asked · <b class="mono">{shelf}</b> on shelf</span></div>
          <div role="img" aria-label={`${shelf} of ${q} on shelf, ${shortNow} short`} class="sl-short-bar"><span style={{ width: `${(100 * shelf) / q}%` }} /><span /></div>
          <div class="sl-short-g">
            <button type="button" onClick={() => { editQty.value = null; setQty(l.lineId, shelf); }}>Make it <span class="mono">{shelf}</span></button>
            <button type="button" onClick={() => { if (editQty.value != null) setQty(l.lineId, q); editQty.value = null; orderInRest(l.lineId, shelf); }}>Order in <span class="mono">{shortNow}</span></button>
          </div>
        </div>
        <PriceLink l={l} />
      </div>
    );
  }
  if (l.price != null && lineWaits(l)) {
    const m = manager(b);
    return (
      <div class="sl-open">
        <div class="sl-open-h"><Head l={l} b={b} /></div>
        {stepRow}
        <div class="sl-open-r g8"><div class="sl-flex0"><PriceLink l={l} /></div><Bin l={l} /></div>
        <div class="sl-ruth">
          <span aria-hidden="true" class="sl-ruth-av">{m.initials}</span>
          <span class="sl-ruth-t"><span>{`${m.first} decides`}</span><span>says yes before it is packed</span></span>
          <span role="img" aria-label="Waiting" class="sl-ruth-w" />
        </div>
      </div>
    );
  }
  const last = p.customerId ? lastPaid(b, p.customerId, l.itemId, l.variantIdx) : null;
  return (
    <div class="sl-open">
      <div class="sl-open-h"><Head l={l} b={b} /></div>
      {stepRow}
      {rest > 0 && split != null && <SplitPanel b={b} shelf={split} rest={rest} />}
      <div class="sl-open-p">
        <PriceLink l={l} />
        <div class="sl-open-r g6">
          {last != null && <button type="button" class={'sl-pchip' + (l.price === last && last !== l.shopPrice ? ' on' : '')} onClick={() => setPrice(l.lineId, last, p.me)}>last <span class="mono">{fig(last)}</span></button>}
          {l.shopPrice != null && <button type="button" class={'sl-pchip' + (l.price === l.shopPrice ? ' on' : '')} onClick={() => setPrice(l.lineId, l.shopPrice as number, p.me)}>shop <span class="mono">{fig(l.shopPrice)}</span></button>}
          <span class="sl-flex" /><Bin l={l} />
        </div>
      </div>
    </div>
  );
}

/** All the lines: the open one first, then the rest, newest first (an order resumed keeps its own order under them). */
export function Lines(p: { me: string; extra?: JSX.Element | null }): JSX.Element | null {
  const x = cur.value, b = books.value;
  if (!x || !b || !x.lines.length) return null;
  const k = x.kept || 0, list = [...x.lines.filter((l) => l.lineId > k).reverse(), ...x.lines.filter((l) => l.lineId <= k)], open = list.find((l) => l.lineId === openId.value) || null;
  const rest = list.filter((l) => l !== open);
  return (
    <>
      {open && <OpenLine l={open} b={b} me={p.me} customerId={x.customerId} />}
      {(rest.length > 0 || p.extra) && (
        <div class="sl-lines">
          {rest.map((l) => <LineRow key={l.lineId} l={l} b={b} on={l.price == null ? () => openPriceComing(l.itemId, l.lineId) : undefined} />)}
          {p.extra}
        </div>
      )}
    </>
  );
}
