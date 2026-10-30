/*
 * While the order is still being filled (SL04, SL05, SL14, SL27): what this
 * customer takes with the newest line (P13 "Often with", the agent app's
 * count), then the aisles (P14 chips). Only what fits whole above the dock
 * is drawn: the screen never tucks a suggestion under it.
 */
import type { JSX } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Books, Customer } from '../../../core/types.ts';
import { AisleChips } from '../../../ui/Aisles.tsx';
import { OftenWith, OftenWithHead } from '../../../ui/OftenWith.tsx';
import { me, online } from '../shell/store.ts';
import { openWarns } from './Lines.tsx';
import { aisles, itemKey, oftenWith, whose } from './insights.ts';
import { add, cur, openId } from './model.ts';
import { openAisle } from './sheets.tsx';

/** How far above the dock (or the notice over it) a suggestion must end. */
const MARGIN = 16;

export function Suggest(p: { b: Books; c: Customer | null }): JSX.Element | null {
  const x = cur.value, b = p.b, c = p.c, box = useRef<HTMLDivElement>(null), [fit, setFit] = useState<{ rows: number; chips: boolean }>({ rows: 3, chips: true });
  const newest = x && x.lines.length ? x.lines[x.lines.length - 1] : null;
  const w = newest ? oftenWith(b, c ? c.id : null, itemKey(newest), new Set(x ? x.lines.map(itemKey) : []), me.value ? me.value.id : '') : null;
  const key = `${x ? x.lines.map((l) => `${itemKey(l)}:${l.qty}`).join() : ''}|${w ? w.rows.length : 0}|${openId.value}|${openWarns.value}|${online.value}`;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const bar = document.querySelector('.sl-notice') || document.querySelector('.sl-dock');
    const limit = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - MARGIN + window.scrollY;
    const kids = [...el.querySelectorAll<HTMLElement>('[data-fit]')];
    let rows = 0, chips = false;
    const bottom = (k: HTMLElement) => k.getBoundingClientRect().bottom + window.scrollY;
    // Lay them all out once, then keep what ends above the line.
    kids.forEach((k) => { k.style.display = ''; });
    for (const k of kids) {
      if (k.dataset.fit === 'row' && bottom(k) <= limit) rows++;
      if (k.dataset.fit === 'chips') chips = rows === kids.filter((y) => y.dataset.fit === 'row').length && bottom(k) <= limit;
    }
    // Put back what the measure showed (preact keeps its own style when the state does not change).
    let r = 0;
    kids.forEach((k) => { const on = k.dataset.fit === 'chips' ? chips : r++ < rows; k.style.display = on ? '' : 'none'; });
    if (rows !== fit.rows || chips !== fit.chips) setFit({ rows, chips });
  }, [key]);
  if (!w || !newest) return null;
  const name = newest.name.split(' · ')[0];
  return (
    <div ref={box} class="sl-suggest">
      {w.rows.length > 0 && fit.rows > 0 && <OftenWithHead item={name} whose={`in ${w.mine && c ? whose(c.name).replace('’', "'") : 'your'} orders`} />}
      {w.rows.map((r, i) => (
        <div key={itemKey(r.it)} data-fit="row" style={i < fit.rows ? undefined : { display: 'none' }}>
          <OftenWith aisle={r.it.aisle} name={r.it.name} had={r.had} of={w.of} price={r.it.price || 0} unit={r.it.unit} onAdd={() => add(r.it, 1)} />
        </div>
      ))}
      <div data-fit="chips" style={fit.chips ? undefined : { display: 'none' }}>
        <AisleChips aisles={aisles(b).map((a) => ({ name: a.name, on: () => openAisle(a.name) }))} />
      </div>
    </div>
  );
}
