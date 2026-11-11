/*
 * Name this direction (OU31, a sheet over To load; routes §4 openNameDirection): the load map with the
 * direction's wedge and its drops, the roads that way (the farthest picked), the name, the drops, the
 * names already given, and navy "Call it → Bweyogerere" (W12 nameDirection). The name is kept on the
 * yard's side (road_names), so every phone's To load reads "→ Bweyogerere" next.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { orderNo } from '../../../core/names.ts';
import { roadsThatWay, type Direction } from '../../../core/store/load.ts';
import { moneyHeld } from '../../../core/store/yard.ts';
import { orderFace } from '../../../core/store/faces.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { LightSheet, sheet } from '../../../ui/sheet.tsx';
import { act, books, side } from '../shell/store.ts';
import { OIcon } from './icons.tsx';
import { Card, MiniOrder, NotPaid } from './parts.tsx';

const CX = 164, CY = 88, W = 328, H = 176;

/** Where a ray from the yard leaves the map's box (the map's own 328 × 176 grid). */
function edge(deg: number): [number, number] {
  const dx = Math.sin((deg * Math.PI) / 180), dy = -Math.cos((deg * Math.PI) / 180);
  const t = Math.min(dx > 0 ? (W - CX) / dx : dx < 0 ? -CX / dx : Infinity, dy > 0 ? (H - CY) / dy : dy < 0 ? -CY / dy : Infinity);
  return [Math.round(CX + dx * t), Math.round(CY + dy * t)];
}

/** The direction's 45° wedge from the yard, as a path. */
function wedge(sector: number): string {
  const a = sector * 45 - 22.5, b = sector * 45 + 22.5;
  const pts = [edge(a)];
  // The box's corners between the two rays, in order.
  [[W, 0, 45 + 0], [W, H, 135], [0, H, 225], [0, 0, 315]].forEach(([x, y]) => {
    const deg = ((Math.atan2(x - CX, -(y - CY)) * 180) / Math.PI + 360) % 360;
    const rel = (deg - a + 360) % 360;
    if (rel > 0 && rel < b - a) pts.push([x, y]);
  });
  pts.sort((p, q) => (((Math.atan2(p[0] - CX, -(p[1] - CY)) * 180) / Math.PI - a + 720) % 360) - (((Math.atan2(q[0] - CX, -(q[1] - CY)) * 180) / Math.PI - a + 720) % 360));
  pts.push(edge(b));
  return `M${CX} ${CY} ` + pts.map(([x, y]) => `L${x} ${y}`).join(' ') + ' Z';
}

function Map(p: { d: Direction }): JSX.Element {
  const b = books.value!;
  const deg = (p.d.sector ?? 2) * 45, r = 116;
  const left = Math.round(CX + r * Math.sin((deg * Math.PI) / 180) - 14), top = Math.round(96 - r * Math.cos((deg * Math.PI) / 180) * 0.7);
  const o = p.d.drops[0].o;
  const way = p.d.compass ? `${p.d.compass[0].toUpperCase()}${p.d.compass.slice(1)} of the yard` : 'From the yard';
  return (
    <div role="img" class="nd-map" aria-label={`The load map: the yard in the middle; the ${p.d.compass || ''} direction is picked, with ${p.d.drops.map((x) => x.o.client.name.replace('&', 'and')).join(', ')} in it`}>
      <svg width="328" height="230" viewBox="0 0 328 176" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 120 C90 110 140 96 164 88 S260 50 328 44" fill="none" stroke="#FFFFFF" stroke-width="10" />
        <path d="M150 0 L170 176" fill="none" stroke="#FFFFFF" stroke-width="7" />
        <path d="M0 30 L328 150" fill="none" stroke="#FFFFFF" stroke-width="5" />
        <path d={wedge(p.d.sector ?? 2)} fill="#8DA2D6" fill-opacity=".28" stroke="#1A5A8A" stroke-width="1.5" stroke-dasharray="4 4" />
        <g stroke="#C9C4BA" stroke-width="1" stroke-dasharray="3 5"><path d="M164 88 L164 0 M164 88 L0 20 M164 88 L0 156 M164 88 L164 176" /></g>
      </svg>
      <span class="nd-yard"><Icon name="store" size={14} stroke={2} /></span>
      <span class="nd-drop" style={{ left: `${left}px`, top: `${top}px` }}>
        <Avatar {...orderFace(o, b)} size={28} font={11} style={{ letterSpacing: '-.02em', boxShadow: '0 0 0 2px #FFFFFF' }} />
        <span class="mono">{orderNo(o.id)}</span>
      </span>
      <span class="nd-way"><OIcon name="nav" size={13} stroke={2.2} />{way}</span>
    </div>
  );
}

function NameDirection(p: { d: Direction }): JSX.Element {
  const b = books.value!;
  const roads = roadsThatWay(side.value, b.shopName, p.d).slice(0, 3);
  const [name, setName] = useState(roads[0] || p.d.drops[0].place);
  const [busy, setBusy] = useState(false);
  const named = Object.values((side.value && side.value.roadNames) || {});
  const go = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await act('nameDirection', p.d.key, n);
      if (side.value) side.value = { ...side.value, roadNames: { ...side.value.roadNames, [p.d.key]: n } };
      sheet.close();
    } catch (_e) { setBusy(false); }
  };
  return (
    <LightSheet ground class="nd-sheet" eyebrow={`Load map · ${p.d.name}`} title="Name this direction" onClose={sheet.close}
      foot={<button type="button" class="nd-go" disabled={busy || !name.trim()} onClick={() => { void go(); }}><Icon name="check" size={18} stroke={2.4} />Call it → {name.trim()}</button>}>
      <Map d={p.d} />
      <div class="ou-list">
        <span class="ou-list-k">Roads that way</span>
        <div role="group" aria-label="Roads that way" class="nd-roads">
          {roads.map((r) => <button key={r} type="button" aria-pressed={r === name} class={'nd-road' + (r === name ? ' on' : '')} onClick={() => setName(r)}>{r}</button>)}
        </div>
      </div>
      <label class="nd-field"><span>→</span><input type="text" value={name} aria-label="Name of the direction" onInput={(e) => setName((e.target as HTMLInputElement).value)} /></label>
      <div class="ou-list">
        <span class="ou-list-k">Drops this way</span>
        <Card>{p.d.drops.map(({ o }) => <MiniOrder key={o.id} h={52} face={orderFace(o, b)} name={o.client.name} sub={`${orderNo(o.id)}${o.bay != null ? ` · bay ${o.bay}` : ''}`} pill={moneyHeld(o) ? <NotPaid /> : null} />)}</Card>
      </div>
      {named.length > 0 && <div class="nd-named">Named already{named.map((n) => <span key={n}>→ {n}</span>)}</div>}
    </LightSheet>
  );
}

/** OU31 over To load (routes §4). */
export function openNameDirection(d: Direction): void {
  sheet.open(() => <NameDirection d={d} />, { label: 'Name this direction', top: 64 });
}
