/*
 * The price kinds' shared evidence (DecidePrice p1–p4, D-33): the line card, the price scale
 * (cost · the asker · the shop's on one track, "never under cost" hatched), the scale card with
 * its three figures, the "Price set · another price" rung, and the keypad sheet it opens
 * (S03 parts in a LightSheet; Use waits under cost). Used by price.tsx, counter.tsx, markup.tsx.
 */
import { units } from '../../../../core/manager/decide-stock.ts';
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { money } from '../../../../core/money.ts';
import { orderNo } from '../../../../core/names.ts';
import { scale as scaleOf, underCost } from '../../../../core/manager/price.ts';
import type { MLine, MOrder, Tint, UGX } from '../../../../core/manager/types.ts';
import { TINTS } from '../../../../core/names.ts';
import { Button } from '../../../../ui/Button.tsx';
import { Icon } from '../../../../ui/icons.tsx';
import { Keypad, Outcome, PriceField } from '../../../../ui/Keypad.tsx';
import { PRICE_COMING } from '../../../../ui/Money.tsx';
import { sheet, LightSheet } from '../../../../ui/sheet.tsx';
import './pricecard.css';

/** "−1,500", "+77,500": a signed figure as the boards write it. */
export function signed(n: number): string {
  return (n < 0 ? '−' : n > 0 ? '+' : '') + money(Math.abs(n));
}

/** The line: its name and count, the customer; its total and price a unit (or "Price coming"). */
export function ItemCard(p: { l: MLine; price: UGX | null; sub: string }): JSX.Element {
  return (
    <div class="mg-pc-item">
      <div class="t"><b>{p.l.name} · <span class="mg-mono">{`${p.l.qty} ${units(p.l.qty, p.l.unit)}`}</span></b><span>{p.sub}</span></div>
      {p.price != null
        ? <div class="f"><b class="mg-mono">{money(Math.round(p.price * p.l.qty))}</b><span class="mg-mono">{`${money(p.price)} a ${p.l.unit}`}</span></div>
        : <div class="f"><b class="soon">{PRICE_COMING}</b></div>}
    </div>
  );
}

export interface Mark {
  v: UGX;
  kind: 'cost' | 'shop' | 'their' | 'bad' | 'ghost' | 'tick';
  label?: string;
  txt?: string;
  pos?: 'up' | 'down';
  align?: 'center' | 'left' | 'right';
  tone?: 'bad' | 'soft';
  /** Fill the track from cost to here (navy, or grey). */
  fill?: 'navy' | 'grey';
  tint?: Tint;
}

/** The price scale: one track, the under-cost zone hatched, a pin per figure, its label above or below. */
export function PriceScale(p: { cost: UGX; marks: Mark[]; zone?: boolean; band?: [UGX, UGX]; label: string }): JSX.Element {
  const at = scaleOf([p.cost, ...p.marks.map((m) => m.v), ...(p.band || [])]);
  const c = at(p.cost);
  return (
    <div class="mg-pc-scale" role="img" aria-label={p.label}>
      <div class="mg-pc-track">
        <div class="bar">
          <i class="zone" style={{ width: `${c}%` }} />
          {p.band && <i class="band" style={{ left: `${at(p.band[0])}%`, width: `${at(p.band[1]) - at(p.band[0])}%` }} />}
          {p.marks.filter((m) => m.fill).map((m, i) => <i key={'f' + i} class={'fill ' + m.fill} style={{ left: `${c}%`, width: `${Math.max(0, at(m.v) - c)}%` }} />)}
        </div>
        {p.marks.map((m, i) => {
          const t = m.tint ? TINTS[m.tint] : null;
          return <i key={i} class={'pin ' + m.kind} style={{ left: `${at(m.v)}%`, ...(t ? { background: t.bg, boxShadow: `0 0 0 2px #fff, inset 0 0 0 3px ${t.fg}` } : {}) }} />;
        })}
      </div>
      {p.marks.filter((m) => m.label).map((m, i) => (
        <span key={'l' + i} class={`lab ${m.pos || 'down'} ${m.align || 'center'} ${m.tone || ''}`} style={{ left: `${at(m.v)}%` }}>
          <span>{m.label}</span><b class="mg-mono">{m.txt}</b>
        </span>
      ))}
      {p.zone && <span class="zl"><Icon name="lock" size={12} stroke={2} />never under cost</span>}
    </div>
  );
}

export interface Fact { k: string; v: string; tone?: 'good' | 'warn' | 'bad' }

export function ScaleCard(p: { title?: string; unit?: string; children: JSX.Element; facts?: Fact[] }): JSX.Element {
  return (
    <div class="mg-pc-card">
      {p.title && <div class="h"><b>{p.title}</b>{p.unit && <span class="mg-mono">{`UGX a ${p.unit}`}</span>}</div>}
      {p.children}
      {p.facts && (
        <div class="facts">
          {p.facts.map((f) => <span key={f.k}><span>{f.k}</span><b class={'mg-mono ' + (f.tone || '')}>{f.v}</b></span>)}
        </div>
      )}
    </div>
  );
}

/** "Price set · another price · 38,000 or more": opens the keypad. */
export function Rung(p: { floor: UGX | null; on: () => void; label?: string; sub?: string }): JSX.Element {
  const sub = p.sub || (p.floor != null ? `another price · ${money(p.floor)} or more` : 'another price');
  return (
    <button type="button" class="mg-pc-rung" aria-label={`${p.label || 'Price set'}: ${sub}`} onClick={p.on}>
      <span class="i"><Icon name="pen" size={18} stroke={2} /></span>
      <span class="t"><b>{p.label || 'Price set'}</b><span class="mg-mono">{sub}</span></span>
    </button>
  );
}

interface PadProps {
  o: MOrder;
  l: MLine;
  /** What the keypad types: a price (waits under `floor`), or the cost (D-2 with none known). */
  what: 'price' | 'cost';
  floor: UGX | null;
  /** The shop's price, for the difference chip (price only). */
  shop: UGX | null;
  /** The line's figure now, struck in the outcome. */
  was: UGX | null;
  onUse: (v: UGX) => void;
}

function Pad(p: PadProps): JSX.Element {
  const [d, setD] = useState('');
  const v = d ? Number(d) : null;
  const under = p.what === 'price' && v != null && underCost(v, p.floor);
  const diff = v == null ? undefined : under ? `under ${money(p.floor)}` : p.what === 'price' && p.shop != null && v !== p.shop ? signed(v - p.shop) : undefined;
  const word = p.what === 'cost' ? `Cost, a ${p.l.unit}` : `Price, a ${p.l.unit}`;
  return (
    <LightSheet eyebrow={`${orderNo(p.o.id)} · ${p.o.customerName}`} title={`${p.what === 'cost' ? 'Cost' : 'Price'} · ${p.l.name}`} onClose={sheet.close} pad="10px 16px 20px"
      foot={<Button h={52} fs={15} state={v == null || under ? 'disabled' : 'idle'} icon="check" onClick={() => { if (v != null && !under) { sheet.close(); p.onUse(v); } }}>
        {v == null ? 'Use' : under ? `Use · under ${money(p.floor)}` : `Use ${money(v)}`}
      </Button>}>
      <div class={under ? 'mg-pc-under' : ''}>
        <PriceField label={word} value={v == null ? '—' : v} diff={diff} />
      </div>
      {p.what === 'price' && v != null && <Outcome words={`${p.l.qty} ${p.l.unit} come to`} was={p.was ?? undefined} now={Math.round(v * p.l.qty)} />}
      <Keypad value={d} onChange={setD} max={8} />
    </LightSheet>
  );
}

/** Open the keypad sheet over the Decide sheet. */
export function openPad(p: PadProps): void {
  sheet.open(() => <Pad {...p} />, { label: `${p.what === 'cost' ? 'Cost' : 'Price'} · ${p.l.name}` });
}
