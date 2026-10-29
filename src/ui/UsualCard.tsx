/*
 * P29 · The usual card: a regular customer's usual, on the order
 * (LANGUAGE.md §3 P29; as built: SL03). The header (the again mark, "Kato's
 * usual" over a bar with one segment per item, how many are in, "Add all");
 * then up to four tiles: in (white, a green outline and tick) or to add
 * (the navy tile, a mint +). All in: one green bar. A usual of one item is
 * one navy row (UsualOne).
 *
 *   <UsualCard title="Kato's usual" items={[
 *     { aisle: 'Cement', name: 'Cement', qty: '×40 bag', in: true, note: 'every order', on: … },
 *     { aisle: 'Roofing', name: 'Iron sheet', qty: '×30 pc', on: …, label: 'Add Iron sheet, usual ×30 pc' }]} onAll={…} />
 *   <UsualOne aisle="Cement" name="Cement · Hima 50kg" sub="×40 bag · 1,340,000" onAdd={…} />
 */
import type { JSX } from 'preact';
import { AisleIcon, Duo, phAgain, phCheck, phCheckCircle, phPlus } from './icons.tsx';
import { ItemSquare } from './ItemSquare.tsx';
import { cx } from './util.tsx';
import './usual.css';

export interface UsualItem {
  aisle: string;
  name: string;
  /** "×40 bag". */
  qty: string;
  in?: boolean;
  /** Under the name on an "in" tile ("every order", "5 of 7"). */
  note?: string;
  label?: string;
  on: () => void;
}

export function UsualCard(p: { title: string; items: UsualItem[]; onAll?: () => void }): JSX.Element {
  const n = p.items.filter((i) => i.in).length, all = n === p.items.length;
  if (all) {
    return <div class="ow-usual-done"><Duo i={phCheckCircle} size={18} />{`${p.title} is in`}</div>;
  }
  return (
    <div class="ow-usual">
      <div class="ow-usual-h">
        <span aria-hidden="true" class="ow-usual-mark"><Duo i={phAgain} size={18} color="#1C2233" /></span>
        <span class="ow-usual-ht">
          <span>{p.title}</span>
          <span aria-hidden="true" class="ow-usual-seg">{p.items.map((i, k) => <span key={k} class={i.in ? 'in' : undefined} />)}</span>
        </span>
        <span class="ow-usual-r">
          <span class={cx('mono ow-usual-n', n > 0 && 'some')}>{`${n}/${p.items.length}`}</span>
          {p.onAll && (
            <button type="button" class="ow-usual-all" aria-label={`Add all ${p.items.length - n} of the usual`} onClick={p.onAll}>
              <span><span aria-hidden="true"><Duo i={phPlus} size={11} color="#16203C" /></span>{`Add all ${p.items.length - n}`}</span>
            </button>
          )}
        </span>
      </div>
      <div class="ow-usual-tiles">
        {p.items.slice(0, 4).map((i, k) => i.in ? (
          <button key={k} type="button" class="ow-utile in" aria-label={i.label || `${i.name}, in`} onClick={i.on}>
            <span aria-hidden="true" class="ow-utile-b in"><Duo i={phCheck} size={11} color="#FFFFFF" /></span>
            <ItemSquare aisle={i.aisle} size={40} />
            <span class="ow-utile-n">{i.name}</span>
            <span class="ow-utile-s">{i.note || i.qty}</span>
          </button>
        ) : (
          <button key={k} type="button" class="ow-utile" aria-label={i.label || `Add ${i.name}, usual ${i.qty}`} onClick={i.on}>
            <span aria-hidden="true" class="ow-utile-b"><Duo i={phPlus} size={12} color="#16203C" /></span>
            <span aria-hidden="true" class="ow-utile-sq"><AisleIcon aisle={i.aisle} size={24} color="#FFFFFF" /></span>
            <span class="ow-utile-n">{i.name}</span>
            <span class="mono ow-utile-q">{i.qty}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** A usual of one item: one 76 px navy row, the 52 px square, the name, the qty and amount in mint, a 44 px mint +. */
export function UsualOne(p: { aisle: string; name: string; sub: string; onAdd: () => void }): JSX.Element {
  return (
    <div class="ow-usual-one">
      <span aria-hidden="true" class="ow-usual-one-sq"><AisleIcon aisle={p.aisle} size={30} color="#FFFFFF" /></span>
      <span class="ow-usual-one-t"><span>{p.name}</span><span class="mono">{p.sub}</span></span>
      <button type="button" aria-label={`Add ${p.name}`} onClick={p.onAdd}><Duo i={phPlus} size={16} color="#16203C" /></button>
    </div>
  );
}
