/*
 * The Out area's small parts, drawn the same on several of its boards (OU01–OU31): faces, the
 * driver chips, "After the slide · X sees", the dock at the foot of a sheet with its hint line,
 * the drop's place row, and the bar a flow draws under its head (No signal · That did not save).
 * Everything here is composed from src/ui; the words come in as props.
 */
import type { ComponentChildren, JSX } from 'preact';
import { firstWord, initials, tintFor } from '../../../core/names.ts';
import type { YardBooks, YardOrder, YardPerson } from '../../../core/store/types.ts';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { StatusPill } from '../../../ui/Pill.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import { OIcon } from './icons.tsx';
import './out.css';

/* ---- faces ---- */

/** The customer's face: as the shop casts it, a walk-in in slate, else a tint from the name. */
export function custFace(b: YardBooks, o: YardOrder): Face {
  const c = b.customers.find((x) => x.id === o.customerId);
  const walkIn = /^walk-?in$/i.test(o.client.name.trim());
  return { initials: walkIn ? 'WI' : initials(o.client.name), tint: c && c.tint ? c.tint : walkIn ? 't4' : tintFor(o.client.name) };
}

/** A person by staff id or login id. */
export function person(b: YardBooks, id: string | null | undefined): YardPerson | null {
  if (!id) return null;
  return b.people.find((p) => p.id === id || p.userId === id) || null;
}

/** The salesperson who took the order (Grace), and the manager (Ruth). */
export const seller = (b: YardBooks, o: YardOrder): YardPerson | null => person(b, o.takenBy);
export const manager = (b: YardBooks): YardPerson | null => b.people.find((p) => p.role === 'manager') || null;

/** A person's face; on a light ground the holder is slate ("Me" is a chip, not a badge). */
export const faceOf = (p: YardPerson | null): Face => (p ? { initials: p.initials, tint: p.tint === 'me' ? 't4' : p.tint } : { initials: '?', tint: 't4' });

/** "Kato" from "Kato Construction", "Walk-in" kept whole. */
export const shortName = (name: string): string => (/^walk-?in$/i.test(name.trim()) ? 'Walk-in' : firstWord(name));

/* ---- pills and rows ---- */

export const NotPaid = (): JSX.Element => <StatusPill tone="caution">Not paid yet</StatusPill>;

/** A light card of rows (P10b's group: white, radius 18, hairline). */
export function Card(p: { pad?: 12 | 14; class?: string; children: ComponentChildren }): JSX.Element {
  return <div class={cx('ou-card', p.pad === 14 && 'p14', p.class)}>{p.children}</div>;
}

/** A section's head: a dot (or a dashed ring), its words, a count; something on the right. */
export function DotHead(p: { dot?: string; ring?: boolean; title: string; count?: number | string; right?: ComponentChildren; class?: string }): JSX.Element {
  return (
    <div class={cx('ou-dothead', p.class)}>
      {p.ring ? <span aria-hidden="true" class="ou-dot ring" /> : p.dot && <span aria-hidden="true" class="ou-dot" style={{ background: p.dot }} />}
      <span class="ou-dothead-t">{p.title}</span>
      {p.count != null && <span class="mono ou-dothead-n">{p.count}</span>}
      <span class="ou-flex" />
      {p.right}
    </div>
  );
}

/** Where it goes: the pin, "Ntinda site · today afternoon", the phone, "From GA" (OU01, OU02). */
export function DropPlace(p: { place: string; phone: string; from: Face | null }): JSX.Element {
  return (
    <div class="ou-place">
      <span class="ou-place-ic"><Icon name="pin" size={16} stroke={2} /></span>
      <span class="ou-place-t"><span>{p.place}</span>{p.phone && <span class="mono">{p.phone}</span>}</span>
      {p.from && <span class="ou-place-from">From <Avatar {...p.from} size={20} font={11} /></span>}
    </div>
  );
}

/* ---- who drives ---- */

export type DriverPick = { kind: 'staff'; id: string } | { kind: 'hired' } | { kind: 'me' };

/** Ssali · Hassan · Hired · Me (OU02): the chosen one navy; Hired opens the hired sheet. */
export function DriverChips(p: { drivers: YardPerson[]; me: YardPerson; chosen: DriverPick | null; dim?: boolean; hiredName?: string | null;
  onPick: (d: DriverPick) => void; onHired: () => void }): JSX.Element {
  const on = (d: DriverPick) => !!p.chosen && p.chosen.kind === d.kind && (d.kind !== 'staff' || (p.chosen as { id: string }).id === d.id);
  const chip = (key: string, d: DriverPick, face: ComponentChildren, word: string, act: () => void, pressed: boolean | null = on(d)) => (
    <button key={key} type="button" aria-pressed={pressed == null ? undefined : pressed} disabled={p.dim} class={cx('ou-chip', on(d) && 'on')} onClick={act}>{face}{word}</button>
  );
  return (
    <div role="group" aria-label="Who drives" class={cx('ou-chips', p.dim && 'dim')}>
      {p.drivers.map((x) => chip(x.id, { kind: 'staff', id: x.id }, <Avatar initials={x.initials} tint="t4" size={24} font={11} style={{ letterSpacing: '-.02em' }} />, firstWord(x.name), () => p.onPick({ kind: 'staff', id: x.id })))}
      {chip('hired', { kind: 'hired' }, <span aria-hidden="true" class="ou-chip-hired"><Icon name="truck" size={13} stroke={2} /></span>, p.hiredName || 'Hired', p.onHired, null)}
      {chip('me', { kind: 'me' }, <Avatar initials={p.me.initials} tint="t4" size={24} font={11} style={{ letterSpacing: '-.02em' }} />, 'Me', () => p.onPick({ kind: 'me' }))}
    </div>
  );
}

/* ---- before and after the commit ---- */

/** The dashed "After the slide · Grace and Kato see: On the road · Ssali" strip (BRIEF). */
export function AfterSlide(p: { faces: Face[]; who: string; what: string; ground?: string }): JSX.Element {
  return (
    <div class="ou-after">
      <span class="ou-after-k">After the slide</span>
      <span class="ou-flex" />
      <span aria-hidden="true" class="ou-after-f">
        {p.faces.map((f, i) => <Avatar key={i} {...f} size={24} font={11} class="ou-face" style={{ letterSpacing: '-.02em', marginLeft: i ? '-6px' : undefined, borderColor: p.ground }} />)}
      </span>
      <span class="ou-after-t">{p.who} see:<br />{p.what}</span>
    </div>
  );
}

export type HintIcon = IconName | 'store-gate';

/** The navy dock at the foot of a sheet (OU01, OU02, OU10): the slide, and one line under it. */
export function SheetDock(p: { hint?: { icon: IconName; text: string; tone?: 'mint' | 'amber' | 'plain'; iconTone?: 'mint' | 'plain' } | null; children: ComponentChildren }): JSX.Element {
  const h = p.hint;
  return (
    <div class="ou-dock">
      {p.children}
      {h && (
        <span class={cx('ou-hint', h.tone === 'amber' && 'amber')}>
          <span class={cx('ou-hint-ic', (h.iconTone || 'plain') === 'mint' && 'mint')}><Icon name={h.icon} size={13} stroke={2.2} /></span>{h.text}
        </span>
      )}
    </div>
  );
}

/** The bar under a flow's head: amber no signal with white Try again, or the red "That did not save" (OU06, OU07, OU16, OU25, OU28). */
export function FlowBar(p: { kind: 'offline' | 'failed'; code?: string; onRetry: () => void; children?: ComponentChildren }): JSX.Element {
  if (p.kind === 'failed') {
    return (
      <Notice kind="failed" class="ou-bar failed" action={{ label: 'Try again', on: p.onRetry }}>
        <b class="ou-bar-bad">That did not save{p.code && <> · <span class="mono">{p.code}</span></>}</b><br /><span class="ou-bar-bad soft">tell Kevin if it comes back</span>
      </Notice>
    );
  }
  return <Notice kind="offline" class="ou-bar" action={{ label: 'Try again', on: p.onRetry }}>{p.children || 'No signal · 1 not sent yet · kept on this phone'}</Notice>;
}

/* ---- the empty boards (OU14, OU15, OU30) ---- */

/** The ghost of what is coming, with its navy tile (P24). */
export function Ghost(p: { tile: ComponentChildren; children: ComponentChildren }): JSX.Element {
  return (
    <div class="ou-ghost-w">
      <div aria-hidden="true" class="ou-ghost">{p.children}</div>
      <span aria-hidden="true" class="ou-ghost-tile">{p.tile}</span>
    </div>
  );
}

/** One ghost row: a dashed face, two bars, a dashed pill (or a dashed button with its word). */
export function GhostRow(p: { op?: number; word?: string; h?: number }): JSX.Element {
  return (
    <div class="ou-grow" style={{ opacity: p.op ?? 1, minHeight: p.h ? `${p.h}px` : undefined }}>
      <span class="ou-grow-face" />
      <span class="ou-grow-bars"><span /><span /></span>
      {p.word ? <span class="ou-grow-btn">{p.word}</span> : <span class="ou-grow-pill" />}
    </div>
  );
}

export function EmptyWords(p: { title: string; sub: string }): JSX.Element {
  return <div class="ou-empty-w"><h2>{p.title}</h2><span>{p.sub}</span></div>;
}

/** The navy way in under an empty board ("To load 2", "To pack 1"). */
export function WayIn(p: { icon: 'layers' | 'orders'; word: string; count: number; on: () => void }): JSX.Element {
  return (
    <Tap on={p.on} class="ou-way">
      <span class="ou-way-ic">{p.icon === 'layers' ? <OIcon name="layers" size={18} stroke={2} /> : <Icon name="orders" size={18} stroke={2} />}</span>{p.word}{p.count > 0 && <> <span class="mono">{p.count}</span></>}
    </Tap>
  );
}

/** The two tiles under an empty board: where else to look. */
export function SideTiles(p: { tiles: { icon: ComponentChildren; title: ComponentChildren; sub: string; good?: boolean; on: () => void; label: string }[] }): JSX.Element {
  return (
    <div class="ou-tiles">
      {p.tiles.map((t) => (
        <Tap key={t.label} on={t.on} label={t.label} class={cx('ou-tile', t.good && 'good')}>
          <span class="ou-tile-ic">{t.icon}</span>
          <span class="ou-tile-t"><span>{t.title}</span><span>{t.sub}</span></span>
        </Tap>
      ))}
    </div>
  );
}

/** A plain order row on an empty board's list: face, name, "#0552 · → Ntinda", a status pill. */
export function MiniOrder(p: { face: Face; name: string; sub: string; pill: ComponentChildren; on?: () => void; label?: string; h?: number }): JSX.Element {
  const body = (
    <>
      <Avatar {...p.face} size={32} font={12} style={{ letterSpacing: '-.02em' }} />
      <span class="ou-mini-t"><span>{p.name}</span><span class="mono">{p.sub}</span></span>
      {p.pill}
    </>
  );
  const style = p.h ? { minHeight: `${p.h}px` } : undefined;
  return p.on ? <Tap on={p.on} label={p.label} class="ou-mini" style={style}>{body}</Tap> : <div class="ou-mini" style={style}>{body}</div>;
}

/** The small soft pill with an icon ("To load", "Packing now", "Coming"). */
export function SoftPill(p: { tone: 'info' | 'warn' | 'good' | 'bad'; icon?: ComponentChildren; children: ComponentChildren }): JSX.Element {
  return <span class={cx('ou-spill', 't-' + p.tone)}>{p.icon}{p.children}</span>;
}
