/*
 * The shelf at the counter: KC01's best sellers as tiles (one tap adds one) and the other aisles;
 * under a basket (KC03, KC08, KC18), the best sellers as rows, as many as fit above the dock.
 */
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { AisleChips } from '../../../ui/Aisles.tsx';
import { AISLE, Duo, Icon, aisleKey, phFlame } from '../../../ui/icons.tsx';
import { ItemSquare } from '../../../ui/ItemSquare.tsx';
import { fig, isPriced, PRICE_COMING } from '../../../ui/Money.tsx';
import type { Item } from '../../../core/types.ts';

/** The other aisles, in the canvas's order (KC01); those the tiles show are left out. */
const AISLES = ['Paint', 'Doors & locks', 'Roofing', 'Electrical', 'Tools', 'Timber', 'Steel', 'Sanitary', 'Cement', 'Fasteners', 'Plumbing', 'Adhesives'];

export function SoldHead(p: { meta?: string }): JSX.Element {
  return (
    <div class="kc-sec">
      <Duo i={phFlame} size={18} color="#C93A30" />
      <h2>Sold most today</h2>
      {p.meta && <span class="mono">{p.meta}</span>}
    </div>
  );
}

export function Tiles(p: { items: Item[]; onAdd: (it: Item) => void }): JSX.Element {
  return (
    <div class="kc-tiles">
      {p.items.map((it, i) => {
        const a = AISLE[aisleKey(it.aisle)];
        return (
          <div key={it.id} class="kc-tile">
            <span class="kc-tile-band" style={{ background: `linear-gradient(150deg, ${a.soft} 0%, #FFFFFF 160%)` }}>
              <Duo i={a.i} size={38} color={a.ink} />
              <span class={'kc-rank mono' + (i === 0 ? ' first' : '')}>{i + 1}</span>
            </span>
            <span class="kc-tile-b">
              <span class="kc-tile-n">{it.name}</span>
              <span class="kc-shelf"><span class="mono">{fig(it.onShelf || 0)}</span> on shelf</span>
              <span class="kc-tile-f">
                {isPriced(it.price) ? <span class="kc-each"><span class="mono">{fig(it.price)}</span><small>{`per ${it.unit}`}</small></span> : <span class="kc-each"><small>{PRICE_COMING}</small></span>}
                <button type="button" class="kc-plus" aria-label={`Add one ${it.name}`} onClick={() => p.onAdd(it)}><Icon name="plus" size={18} stroke={2.6} /></button>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function OtherAisles(p: { skip: string[]; onAisle: (name: string) => void }): JSX.Element {
  return <AisleChips aisles={AISLES.filter((a) => !p.skip.includes(a)).map((name) => ({ name, on: () => p.onAisle(name) }))} />;
}

/** One best seller under a basket: the square, the name, the shelf, the price each and a navy +. */
function Row(p: { it: Item; onAdd: (it: Item) => void }): JSX.Element {
  const it = p.it;
  return (
    <div class="kc-row">
      <ItemSquare aisle={it.aisle} size={44} />
      <span class="kc-row-t">
        <span class="kc-row-n">{it.name}</span>
        <span class="kc-pill"><span class="mono">{fig(it.onShelf || 0)}</span>on shelf</span>
      </span>
      {isPriced(it.price) ? <span class="kc-row-p"><b class="mono">{fig(it.price)}</b><small>{`per ${it.unit}`}</small></span> : <span class="kc-row-p"><small>{PRICE_COMING}</small></span>}
      <button type="button" class="kc-plus navy" aria-label={`Add one ${it.name}`} onClick={() => p.onAdd(it)}><Icon name="plus" size={16} stroke={2.6} /></button>
    </div>
  );
}

/**
 * The rows that fit between what is above and the dock: nothing is hidden under it (BRIEF "360 px").
 * With none fitting, the head goes too.
 */
export function SoldRows(p: { items: Item[]; onAdd: (it: Item) => void }): JSX.Element | null {
  const box = useRef<HTMLDivElement>(null);
  const fit = () => {
    const el = box.current;
    if (!el) return;
    el.style.display = 'contents';
    // What sits on the screen's foot: the no-signal band (KC17), else the dock.
    const foot = (document.querySelector('.ow-dockwrap > .ow-notice') || document.querySelector('.ow-dock')) as HTMLElement | null;
    const limit = (foot ? foot.getBoundingClientRect().top : window.innerHeight) - 8;
    const rows = [...el.querySelectorAll<HTMLElement>('.kc-row')];
    rows.forEach((r) => { r.style.display = ''; });
    let shown = 0;
    rows.forEach((r) => { if (r.getBoundingClientRect().bottom <= limit) shown++; else r.style.display = 'none'; });
    el.style.display = shown ? 'contents' : 'none';
  };
  useLayoutEffect(fit);
  // Again when the screen changes (the keyboard, the dock's own height).
  useEffect(() => {
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
    const foot = document.querySelector('.ow-dockwrap, .ow-dock');
    if (ro && foot) ro.observe(foot);
    const mo = new MutationObserver(() => fit());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', fit);
    return () => { if (ro) ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', fit); };
  }, []);
  if (!p.items.length) return null;
  return (
    <div ref={box} style={{ display: 'contents' }}>
      <SoldHead />
      <div class="kc-rows">{p.items.map((it) => <Row key={it.id} it={it} onAdd={p.onAdd} />)}</div>
    </div>
  );
}
