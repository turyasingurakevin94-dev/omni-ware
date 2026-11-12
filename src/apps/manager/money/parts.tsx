/*
 * The Money area's own pieces, drawn once for its pages and sheets (boards Money, Added2):
 * the hold track, a person's dot, a customer's tile, the head of a customer page, the light
 * sheet over a page, the navy dock (who sees it, one answer, the second), the held strip
 * with Undo, and the "Waits" rows of what this phone keeps for signal.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { money } from '../../../core/money.ts';
import { TINTS } from '../../../core/names.ts';
import { firstWord } from '../../../core/names.ts';
import { trackFrac } from '../../../core/manager/money.ts';
import type { Cust, ManagerBooks, Person } from '../../../core/manager/types.ts';
import { whoSee } from '../../../core/manager/words.ts';
import type { Kept } from '../../../core/outbox.ts';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { useDragClose } from '../../../ui/sheet.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { nav } from '../shell/nav.ts';
import { Bars } from '../shell/App.tsx';
import { held, undoHeld } from '../shell/store.ts';
import './parts.css';

/** The band colours (Money p1): under 7 d · 8–21 d · 22–30 d · over 30 d. On navy the oldest is amber. */
export const BAND_INK = { u7: '#0F6B43', u21: '#8D99B5', u30: '#95530C', o30: '#8E2A22' } as const;
const ROW_INK = { u7: '#0F6B43', u21: '#5F6980', u30: '#95530C', o30: '#8E2A22' } as const;

/** The hold track: how old the oldest bill is, the hold line dashed across it. */
export function Track(p: { days: number; hold: number; band: keyof typeof ROW_INK; w: number; navy?: boolean }): JSX.Element {
  const fill = p.navy ? '#F5B26B' : ROW_INK[p.band], x = trackFrac(p.hold) * p.w;
  return (
    <svg width={p.w} height="14" viewBox={`0 0 ${p.w} 14`} aria-hidden="true" class="mg-mo-track">
      <rect x="0" y="4" width={p.w} height="6" rx="3" fill={p.navy ? 'rgba(255,255,255,.14)' : '#ECE8E1'} />
      <rect x="0" y="4" width={Math.max(4, trackFrac(p.days) * p.w)} height="6" rx="3" fill={fill} />
      <line x1={x} y1="0" x2={x} y2="14" stroke={p.navy ? '#FFFFFF' : '#1C2233'} stroke-width="2" stroke-dasharray="2 2" />
    </svg>
  );
}

/** A person's dot: their tint, ringed in their ink (who is told, who sells there). */
export function Dot(p: { who: Person | null | undefined }): JSX.Element | null {
  if (!p.who) return null;
  const t = TINTS[p.who.tint] || TINTS.t4;
  return <i aria-hidden="true" class="mg-mo-dot" style={{ background: t.bg, boxShadow: `inset 0 0 0 2px ${t.fg}` }} />;
}

/** A customer's two letters on the neutral tile (glass on navy). */
export function Tile(p: { c: Pick<Cust, 'initials'>; size?: number; navy?: boolean }): JSX.Element {
  const s = p.size || 40;
  return <span aria-hidden="true" class={cx('mg-mo-tile', p.navy && 'navy')} style={{ width: `${s}px`, height: `${s}px`, fontSize: s >= 40 ? '13px' : '12px' }}>{p.c.initials}</span>;
}

export const sellersOf = (b: ManagerBooks, c: Cust): Person[] => c.sellers.map((id) => b.team.find((x) => x.id === id)).filter((x): x is Person => !!x);

/** "Grace · Brian sell here" with their dots. */
export function Sellers(p: { people: Person[] }): JSX.Element {
  const n = p.people.map((x) => firstWord(x.name));
  return (
    <span class="mg-mo-sellers">
      {p.people.map((x) => <Dot key={x.id} who={x} />)}
      {n.length ? `${n.join(' · ')} ${n.length === 1 ? 'sells' : 'sell'} here` : ''}
    </span>
  );
}

/** The navy head of a customer page: Back, the tile, the name, who sells there; the figure under it. */
export function CustHead(p: { c: Cust; people: Person[]; children: ComponentChildren }): JSX.Element {
  return (
    <header class="mg-mo-chead">
      <div class="mg-mo-chead-r">
        <button type="button" class="mg-mo-back" aria-label="Back to Money" onClick={() => nav.back()}><Icon name="back" size={20} stroke={2.2} /></button>
        <Tile c={p.c} navy />
        <div class="mg-mo-chead-n"><b>{p.c.name}</b><Sellers people={p.people} /></div>
      </div>
      {p.children}
    </header>
  );
}

/** The light sheet over a page (Money p3, Added2 p1–p3): the grabber, the head, the body, the dock. `top` is where the board draws it, of 780. */
export function MoneySheet(p: { label: string; top: number; head: ComponentChildren; dock: ComponentChildren; children: ComponentChildren; noBars?: boolean }): JSX.Element {
  const box = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  useDragClose(box, () => nav.back(), scrim);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') nav.back(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div class="mg-mo-layer">
      <div ref={scrim} class="mg-mo-scrim" aria-hidden="true" onClick={() => nav.back()} />
      <div ref={box} class="mg-mo-sheet" role="dialog" aria-modal="true" aria-label={p.label} style={{ top: `calc(${p.top} / 780 * 100%)` }}>
        <span aria-hidden="true" class="mg-mo-grab" />
        <div class="mg-mo-sheet-b">
          <div class="mg-mo-sheet-h">{p.head}<button type="button" class="mg-mo-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={18} stroke={2.2} /></button></div>
          {p.children}
        </div>
        {!p.noBars && <div class="mg-mo-bars"><Bars /></div>}
        {p.dock}
      </div>
    </div>
  );
}

export interface Ans { label: string; icon?: IconName; dot?: Person | null; on: () => void; disabled?: string; busy?: boolean; label2?: string }

/**
 * The navy dock (BRIEF "Dock rule"): who sees it and the word they see (or "Goes in the owner's log"),
 * then one white answer or the red-knob slide, and an outline second. `row`: the two side by side (p2).
 */
export function MoneyDock(p: {
  told?: Person[]; word?: string; mint?: boolean; log?: boolean; error?: string | null;
  tap?: Ans; slide?: { label: string; sending: string; on: () => Promise<void>; lock?: string; offline?: boolean };
  second?: Ans | null; row?: boolean; strip?: ComponentChildren; class?: string;
}): JSX.Element {
  const names = (p.told || []).map((x) => firstWord(x.name));
  return (
    <footer class={cx('mg-mo-dock', p.class)}>
      {p.strip || (
        <>
          {(p.log || (p.told && p.told.length) || p.word) && <div class="mg-mo-sees">
            {p.log ? <><Icon name="list" size={14} stroke={2} /><span>Goes in the owner's log</span></>
              : <><Icon name="bell" size={14} stroke={2} />{(p.told || []).map((x) => <Dot key={x.id} who={x} />)}<span>{whoSee(names)}</span>
                {p.word && <span class={cx('mg-mo-word', p.mint && 'mint')}>{p.word}</span>}</>}
          </div>}
          {p.error && <span class="mg-mo-err"><Icon name="warning" size={14} stroke={2.2} />{p.error}</span>}
          <div class={cx('mg-mo-acts', p.row && 'row')}>
            {p.tap && <AnsButton a={p.tap} white />}
            {p.slide && (
              <Slide label={p.slide.label} onCommit={p.slide.on} sendWord={p.slide.sending} state={p.slide.offline ? 'offline' : 'ready'}
                offlineLabel="Waits for signal" lock={p.slide.lock ? { icon: 'lock', label: p.slide.lock } : undefined}
                onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />
            )}
            {p.second && <AnsButton a={p.second} />}
          </div>
        </>
      )}
    </footer>
  );
}

function AnsButton(p: { a: Ans; white?: boolean }): JSX.Element {
  const a = p.a;
  return (
    <button type="button" class={cx('mg-mo-ans', p.white ? 'white' : 'out')} aria-disabled={a.disabled ? 'true' : undefined} aria-busy={a.busy || undefined}
      aria-label={a.label2} onClick={() => { if (a.disabled) toast.show(a.disabled, { kind: 'warn' }); else if (!a.busy) a.on(); }}>
      {a.busy ? <span class="mg-mo-spin" aria-hidden="true" /> : a.dot ? <Dot who={a.dot} /> : a.icon && !a.disabled && <Icon name={a.icon} size={18} stroke={2.2} />}
      <span>{a.disabled || a.label}</span>
    </button>
  );
}

/** A page's dock fixed at the bottom, the shell's bars (no signal, not sent) above it (Money p2). */
export function PageDock(p: { children: ComponentChildren }): JSX.Element {
  return <div class="mg-mo-pagedock"><div class="mg-mo-bars"><Bars /></div>{p.children}</div>;
}

/** Not sent, as the board's error card in the dock: what, "Not saved · no signal" (or why), Try again. */
export function ErrStrip(p: { word: string; why: string; retry: () => void }): JSX.Element {
  return (
    <div class="mg-mo-errcard" role="alert">
      <span class="i"><Icon name="warning" size={18} stroke={2.2} /></span>
      <span class="t"><b>{p.word}</b><span class="mono">{p.why}</span></span>
      <button type="button" class="mg-mo-pill navy" onClick={p.retry}><Icon name="retry" size={16} stroke={2.2} />Try again</button>
    </div>
  );
}

/** The held answer's strip in the dock: "Promised · Mon 19 · Grace sees it", Undo with its seconds. */
export function HeldStrip(p: { word: string; sub: string }): JSX.Element {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(i); }, []);
  const h = held.value, left = h ? Math.max(0, Math.ceil((h.until - Date.now()) / 1000)) : 0;
  return (
    <div class="mg-mo-strip" role="status">
      <span class="ok"><Icon name="check" size={16} stroke={2.4} /></span>
      <span class="t"><b>{p.word}</b><span><Icon name="bell" size={12} stroke={2} />{p.sub}</span></span>
      {h && <button type="button" class="mg-mo-undo" aria-label={`Undo, ${left} seconds left`} onClick={() => undoHeld()}><i class="mono">{left}</i>Undo</button>}
    </div>
  );
}

/** What this phone keeps for signal, as the board's offline rows: "Nudge Grace · Waits". */
export function waitsRows(b: ManagerBooks, kept: Kept[], customerId?: string): { key: string; face: string; title: string; sub: string; person: boolean; tint: Person['tint'] | null }[] {
  return kept.filter((k) => k.state !== 'refused').map((k) => {
    const a = (Array.isArray(k.args) ? k.args : [k.args]) as unknown[];
    if (k.kind === 'nudge') {
      const who = b.team.find((x) => x.id === a[0]);
      if (customerId || !who) return null;
      return { key: k.id, face: who.initials, title: `Nudge ${firstWord(who.name)}`, sub: '', person: true, tint: who.tint };
    }
    const c = b.customers.find((x) => x.id === a[0]);
    if (!c || (customerId && c.id !== customerId)) return null;
    if (k.kind === 'setLimit') {
      const l = a[1] as { limit: number; days: number } | null;
      return { key: k.id, face: c.initials, title: l ? `Limit ${money(l.limit)}` : 'Cash only', sub: l ? `${l.days} days` : c.name, person: false, tint: null };
    }
    if (k.kind === 'promise') return { key: k.id, face: c.initials, title: `Promised · ${money(a[2] as number)}`, sub: c.name, person: false, tint: null };
    return null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
}

export function Waits(p: { rows: ReturnType<typeof waitsRows> }): JSX.Element | null {
  if (!p.rows.length) return null;
  return (
    <>
      {p.rows.map((r) => (
        <div class="mg-mo-waits" key={r.key}>
          <span aria-hidden="true" class={cx('mg-mo-wface', r.person && 'p')} style={r.tint ? { background: (TINTS[r.tint] || TINTS.t4).bg, color: (TINTS[r.tint] || TINTS.t4).fg } : undefined}>{r.face}</span>
          <span class="t"><b>{r.title}</b>{r.sub && <span class="mono">{r.sub}</span>}</span>
          <span class="mg-mo-wpill"><Icon name="clock" size={14} stroke={2.2} />Waits</span>
        </div>
      ))}
    </>
  );
}
