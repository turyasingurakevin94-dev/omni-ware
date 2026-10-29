/*
 * P05 · The light top bar while building an order (LANGUAGE.md §3 P05).
 * Row 1: the × circle, the who pill, a basket chip for each other order
 * still open. Row 2: search with the mic, and the aisles button.
 *
 *   <TopBar onClose={…} who={<WhoPill on={pick} />} baskets={[{ face: { initials: 'KS', tint: 't1' }, count: 2, label: 'Open order for Kyaligonza and Sons, 2 items', on: … }]}
 *     search={{ placeholder: 'Add an item', label: 'Add an item: type its name', value: q, onInput: setQ, onMic: listen }} onAisles={…} />
 *   <WhoPill on={pick} />                                                           empty: dashed, "Who is it for?"
 *   <WhoPill on={pick} face={{ initials: 'KC', tint: 't0' }} name="Kato Construction" sub="Every 10 days · owes 420k" dot="#0F6B43" />
 *   <WhoPill on={pick} face={…} name="Nakato Mary" sub="New customer" isNew />
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar, type Face } from './Avatar.tsx';
import { Duo, Icon, phBasket, phGrid, phSparkle, phSwap } from './icons.tsx';
import { Search, type SearchProps } from './Search.tsx';
import { Tap } from './util.tsx';
import './topbar.css';

export interface WhoPillProps {
  on: () => void;
  face?: Face;
  name?: string;
  sub?: string;
  /** The tone dot before the line (#0F6B43 a regular). */
  dot?: string;
  /** A new customer: the spark before the line. */
  isNew?: boolean;
  /** Words in place of "Who is it for?" (a counter sale's pill). */
  empty?: string;
}

export function WhoPill(p: WhoPillProps): JSX.Element {
  if (!p.face || !p.name) {
    return (
      <Tap on={p.on} class="ow-who empty">
        <Icon name="person" size={20} />
        <span class="ow-who-n">{p.empty || 'Who is it for?'}</span>
        <Duo i={phSwap} size={18} color="#5F6980" />
      </Tap>
    );
  }
  return (
    <Tap on={p.on} label={`${p.name}. Change customer`} class="ow-who">
      <Avatar {...p.face} size={38} />
      <span class="ow-who-t">
        <span class="ow-who-n">{p.name}</span>
        {p.sub && <span class="ow-who-s">{p.isNew ? <Duo i={phSparkle} size={12} color="#1A5A8A" /> : <span aria-hidden="true" class="ow-who-dot" style={{ background: p.dot || '#0F6B43' }} />}{p.sub}</span>}
      </span>
      <Duo i={phSwap} size={18} color="#5F6980" />
    </Tap>
  );
}

export interface Basket { face: Face; count: number; label: string; on: () => void }

/** An order still open: the face with an amber ring, the basket, the amber count. */
export function BasketChip(p: Basket): JSX.Element {
  return (
    <button type="button" class="ow-basket" aria-label={p.label} onClick={p.on}>
      <Avatar {...p.face} size={34} ring="basket" />
      <Duo i={phBasket} size={18} color="#5F6980" />
      <span aria-hidden="true" class="ow-basket-n mono">{p.count}</span>
    </button>
  );
}

export interface TopBarProps {
  onClose: () => void;
  closeLabel?: string;
  who: ComponentChildren;
  baskets?: Basket[];
  search: SearchProps;
  onAisles?: () => void;
}

export function TopBar(p: TopBarProps): JSX.Element {
  return (
    <div class="ow-topbar">
      <div class="ow-topbar-r">
        <button type="button" class="ow-close-c" aria-label={p.closeLabel || 'Close the order'} onClick={p.onClose}><Icon name="close" size={18} stroke={2} /></button>
        {p.who}
        {(p.baskets || []).map((b, i) => <BasketChip key={i} {...b} />)}
      </div>
      <div class="ow-topbar-r s">
        <Search {...p.search} />
        {p.onAisles && <button type="button" class="ow-aisles-b" aria-label="Browse the aisles" onClick={p.onAisles}><Duo i={phGrid} size={22} color="#1C2233" /></button>}
      </div>
    </div>
  );
}
