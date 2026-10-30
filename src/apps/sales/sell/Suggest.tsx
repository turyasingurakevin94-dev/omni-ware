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

/** How far above the dock a suggestion must end (SL06, SL22), or above the no-signal notice over it (SL27). */
const MARGIN = { dock: 16, notice: 12 };

export function Suggest(p: { b: Books; c: Customer | null }): JSX.Element | null {
  const x = cur.value, b = p.b, c = p.c, box = useRef<HTMLDivElement>(null), [fit, setFit] = useState<{ rows: number; chips: boolean }>({ rows: 3, chips: true });
  const newest = x && x.lines.length ? x.lines[x.lines.length - 1] : null;
  const w = newest ? oftenWith(b, c ? c.id : null, itemKey(newest), new Set(x ? x.lines.map(itemKey) : []), me.value ? me.value.id : '') : null;
  const key = `${x ? x.lines.map((l) => `${itemKey(l)}:${l.qty}`).join() : ''}|${w ? w.rows.length : 0}|${openId.value}|${openWarns.value}|${online.value}`;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const notice = document.querySelector('.sl-notice'), bar = notice || document.querySelector('.sl-dock');
    const limit = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - (notice ? MARGIN.notice : MARGIN.dock) + window.scrollY;
    const kids = [...el.querySelectorAll<HTMLElement>('[data-fit]')];
    let rows = 0, chips = false;
    const bottom = (k: HTMLElement) => k.getBoundingClientRect().bottom + window.scrollY;
    // Lay them all out once, then keep what ends above the line (preact keeps its own style when the state does not change, so put it back here).
    kids.forEach((k) => { k.style.display = ''; });
    for (const k of kids) if (k.dataset.fit === 'row' && bottom(k) <= limit) rows++;
    // The rows that fit stay; the aisles come under them if they fit too (SL27).
    let r = 0;
    kids.forEach((k) => { if (k.dataset.fit === 'row') k.style.display = r++ < rows ? '' : 'none'; });
    const ch = kids.find((k) => k.dataset.fit === 'chips');
    if (ch) { chips = bottom(ch) <= limit; ch.style.display = chips ? '' : 'none'; }
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
