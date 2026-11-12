/*
 * The goods-in screens' own pieces, drawn once (boards IN02–IN35): the trip's navy head, the dock
 * (the count ring, who sees what, the one slide), the bar over the dock (no signal / not done), the
 * navy end-of-flow screen, and the small things every card here uses (a pill, a "sees" line, a
 * group heading, a card). Composed from src/ui; the words come from the screens.
 */
import { Fragment, type ComponentChildren, type JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { YardBooks, YardPerson } from '../../../core/store/types.ts';
import { Avatar, type Face } from '../../../ui/Avatar.tsx';
import { FullSheet } from '../../../ui/FullSheet.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { EndOfFlow } from '../../../ui/Moment.tsx';
import { Slide, type SlideProps } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { cx } from '../../../ui/util.tsx';
import { backTo, nav } from '../shell/nav.ts';
import { flush, kept, notDone } from '../shell/store.ts';
import './in.css';

export const personOf = (b: YardBooks, pred: (p: YardPerson) => boolean): YardPerson | null => b.people.find(pred) || null;
export const byRole = (b: YardBooks, role: string): YardPerson | null => personOf(b, (p) => p.role === role);
export const byLogin = (b: YardBooks, userId: string | null): YardPerson | null => personOf(b, (p) => !!userId && p.userId === userId);

/** The board's small pill: soft ground, its ink, an optional icon. */
export function Pill(p: { tone: 'info' | 'good' | 'warn' | 'bad' | 'plain' | 'navy'; icon?: IconName; stroke?: number; size?: number; class?: string; children: ComponentChildren }): JSX.Element {
  return <span class={cx('in-pill', 't-' + p.tone, p.class)}>{p.icon && <Icon name={p.icon} size={p.size || 12} stroke={p.stroke || 2.2} />}{p.children}</span>;
}

/** "Denis sees Checked in" (on navy: the dock; on light: Told / Already told). */
export function Sees(p: { face: Face; who: string; what: string; light?: boolean }): JSX.Element {
  return (
    <span class={cx('in-sees', p.light && 'light')}>
      <Avatar {...p.face} size={p.light ? 24 : 20} onNavy={!p.light} />{`${p.who} sees`}<b>{p.what}</b>
    </span>
  );
}

/** A group's heading: a face or a dot, the title, then what sits right. */
export function GroupHead(p: { face?: Face; dot?: string; icon?: IconName; title: string; count?: number; right?: ComponentChildren }): JSX.Element {
  return (
    <div class="in-ghead">
      {p.face && <Avatar {...p.face} size={24} />}
      {p.dot && <span aria-hidden="true" class="in-dot" style={{ background: p.dot }} />}
      {p.icon && <span aria-hidden="true" class="in-ghead-ic"><Icon name={p.icon} size={14} stroke={2.2} /></span>}
      <h2>{p.title}</h2>
      {p.count != null && <span class="mono">{p.count}</span>}
      <span class="in-flex" />
      {p.right}
    </div>
  );
}

/** The trip's navy head (IN02): the face, the name and its line, Scan and Close, then the chips. */
/** When this phone kept a write of this kind that `test` matches (the outbox entry's time, IN07 "saved 11:33"), or null. */
export function keptAt(kind: string, test: (args: unknown[]) => boolean): number | null {
  const k = kept.value.find((x) => x.kind === kind && x.state !== 'refused' && Array.isArray(x.args) && test(x.args as unknown[]));
  return k ? k.at : null;
}
/** A check-in's args ([lines]) are for this trip: a line names one of its stops. */
export const forStops = (ids: string[]) => (a: unknown[]): boolean => Array.isArray(a[0]) && (a[0] as { trip?: string }[]).some((l) => !!l && ids.includes(String(l.trip)));

/** scanOff: Scan is drawn dimmed and does nothing while the work is sending (IN05, IN14). */
export function TripHead(p: { lead: ComponentChildren; name: string; sub: string; onScan?: () => void; scanOff?: boolean; onClose: () => void; closeLabel?: string; chips?: ComponentChildren; children?: ComponentChildren }): JSX.Element {
  return (
    <div class="in-head">
      <span aria-hidden="true" class="ow-shead-grab" />
      <div class="in-head-row">
        {p.lead}
        <div class="in-head-t"><span>{p.name}</span><span class="mono">{p.sub}</span></div>
        {p.onScan && <button type="button" class="in-head-b" aria-label="Scan a label" disabled={p.scanOff} onClick={p.onScan}><Icon name="scan-line" size={20} stroke={2} /></button>}
        <button type="button" class="in-head-b" aria-label={p.closeLabel || 'Close'} onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      {p.chips && <div class="in-head-chips">{p.chips}</div>}
      {p.children}
    </div>
  );
}

/** A glass chip on the head: "From Denis · Buyer". */
export function HeadPill(p: { face?: Face; children: ComponentChildren }): JSX.Element {
  return <span class="in-hpill">{p.face && <Avatar {...p.face} size={20} />}{p.children}</span>;
}

/**
 * The screen: a full sheet over Today (40 px strip = back), its head, the body, and the foot (bars + dock).
 * The strip goes back one, and its label names the screen really below (nav.ts backTo: "Back to Coming in", "Back to Today").
 */
export function Screen(p: { head: ComponentChildren; foot?: ComponentChildren; gap?: number; pad?: string; children: ComponentChildren }): JSX.Element {
  return (
    <FullSheet onBack={() => nav.back()} backLabel={backTo.value} head={p.head} pad={p.pad || '14px 16px 16px'} gap={p.gap ?? 8} foot={p.foot}>
      {p.children}
    </FullSheet>
  );
}

/** The dock's ring: counted of all ("1/3"), mint; the lines that differ in amber after it. */
export function Ring(p: { done: number; of: number; amber?: number }): JSX.Element {
  const c = 2 * Math.PI * 19, of = p.of || 1, a = Math.min(p.amber || 0, p.done), m = (p.done - a) / of, f = a / of;
  const arc = (frac: number, from: number, color: string) => frac > 0 && (
    <circle cx="22" cy="22" r="19" fill="none" stroke={color} stroke-width="4" stroke-dasharray={`${(c * frac).toFixed(1)} ${c.toFixed(1)}`}
      stroke-dashoffset={(-c * from).toFixed(1)} transform="rotate(-90 22 22)" />
  );
  return (
    <span class="in-ring" role="img" aria-label={`${p.done} of ${p.of} counted`}>
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="4" />
        {arc(m, 0, '#6FDCB0')}{arc(f, m, '#F5B26B')}
      </svg>
      <span class="mono">{`${p.done}/${p.of}`}</span>
    </span>
  );
}

export type DockSlide = { kind: 'slide'; props: SlideProps } | { kind: 'wait'; label: string } | { kind: 'button'; label: string; icon: IconName; on: () => void };

/** The dock (IN02): the ring and who sees what, over the one move. */
export function InDock(p: { ring?: { done: number; of: number; amber?: number }; lines: ComponentChildren; move: DockSlide }): JSX.Element {
  const m = p.move;
  return (
    <div class="in-dock">
      <div class="in-dock-top">
        {p.ring && <Ring {...p.ring} />}
        <div class="in-dock-lines">{p.lines}</div>
      </div>
      {m.kind === 'slide' && <Slide onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} {...m.props} />}
      {m.kind === 'wait' && (
        <button type="button" class="in-wait" disabled>
          <span aria-hidden="true"><Icon name="slide" size={22} stroke={2.4} /></span><span>{m.label}</span>
        </button>
      )}
      {m.kind === 'button' && <button type="button" class="in-navybtn" onClick={m.on}><Icon name={m.icon} size={18} stroke={2.2} />{m.label}</button>}
    </div>
  );
}

/** "Updating · saved 11:33" under the dock's sees line while the phone keeps the work. */
export const Updating = (p: { at: string }): JSX.Element => <span class="in-upd"><Icon name="lock" size={14} stroke={2.2} />{`Updating · saved ${p.at}`}</span>;

/**
 * The bar over the dock (IN07, IN08): amber "No signal · kept on this phone" with Try again, or red
 * "That did not save · tell Kevin / code CI-502 · your counts are kept" with navy Try again.
 */
export function InBar(p: { kept: boolean; what: string; offlineWords?: string; retry?: () => void }): JSX.Element | null {
  const n = notDone.value;
  if (n && n.tone === 'failed' && (p.retry || n.retry)) {
    const again = () => { notDone.value = null; (p.retry || n.retry as () => void)(); };
    return (
      <div role="alert" class="in-bar bad">
        <span class="in-bar-ic"><Icon name="warning" size={18} stroke={2} /></span>
        <span class="in-bar-t"><b>{n.text}</b><span>code <span class="mono">{n.code}</span>{` · your ${p.what} ${/s$/.test(p.what) ? 'are' : 'is'} kept`}</span></span>
        <button type="button" class="in-bar-navy" onClick={again}>Try again</button>
      </div>
    );
  }
  if (p.kept) {
    return (
      <div role="status" class="in-bar off">
        <span class="in-bar-ic"><Icon name="offline" size={18} stroke={2} /></span>
        <span class="in-bar-t1">{p.offlineWords || 'No signal · kept on this phone'}</span>
        <button type="button" class="in-bar-white" onClick={() => { void flush(); }}><span>Try again</span></button>
      </div>
    );
  }
  return null;
}

/**
 * The navy end of a flow (IN06, IN12, IN21, IN32): Undo and Close, the tick, the title, who, chips; cards; Back to Today.
 * Undo shows while the write waits its 10 s; with it, the bar runs 12 s, so it goes home after the write went.
 */
export function Done(p: { title: string; icon?: IconName; tick?: number; undo?: () => void; who: ComponentChildren; chips?: ComponentChildren; children?: ComponentChildren }): JSX.Element {
  const [ms] = useState(p.undo ? 12000 : 8000);
  return (
    <div class="in-done">
      <div class="in-done-top">
        {p.undo ? <button type="button" class="in-undo" onClick={p.undo}><Icon name="undo" size={16} stroke={2.2} />Undo<span class="mono">10 s</span></button> : <span />}
        <button type="button" class="in-done-x" aria-label="Close" onClick={() => nav.home()}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <div class="in-done-hero">
        <span aria-hidden="true" class="in-done-tick" style={p.tick ? { width: `${p.tick}px`, height: `${p.tick}px` } : undefined}><Icon name={p.icon || 'check'} size={p.icon ? 40 : 40} stroke={p.icon ? 2 : 2.8} /></span>
        <h1>{p.title}</h1>
        {p.who}
        {p.chips && <span class="in-done-chips">{p.chips}</span>}
      </div>
      {p.children}
      <EndOfFlow on={() => nav.home()} ms={ms} />
    </div>
  );
}

/** The who-chip on a navy end screen: a face (or faces), the name, then its figures in mono. */
export function DoneWho(p: { lead: ComponentChildren; name: string; sub: string }): JSX.Element {
  return <span class="in-done-who">{p.lead}<span class="n">{p.name}</span><span class="mono">{p.sub}</span></span>;
}

/** A glass chip on navy: amber "Sent to Ruth · 1 differs", mint "Denis told". */
export function NavyChip(p: { tone: 'amber' | 'mint' | 'glass'; face?: Face; children: ComponentChildren }): JSX.Element {
  return <span class={cx('in-nchip', p.tone)}>{p.face && <Avatar {...p.face} size={20} />}{p.children}</span>;
}

/** A white card on the ground (the boards' 18 px card). */
export function Card(p: { open?: 'navy' | 'amber'; pad?: string; gap?: number; class?: string; children: ComponentChildren; label?: string }): JSX.Element {
  return <div class={cx('in-card', p.open && 'open-' + p.open, p.class)} aria-label={p.label} style={{ padding: p.pad, gap: p.gap != null ? `${p.gap}px` : undefined }}>{p.children}</div>;
}

/** The end-of-flow button on the light ground (IN09, IN13, IN22): navy, "Back to Today". */
export const BackToToday = (): JSX.Element => (
  <div class="in-foot-end"><button type="button" class="in-navybtn" onClick={() => nav.home()}>Back to Today</button></div>
);

/** "What happens next" on a navy end screen (IN12, IN21, IN32): done (mint soft), now (mint), then the rest (glass). */
export interface Step { lead: IconName | string; state: 'done' | 'now' | 'next'; title: string; sub: string }
export function Steps(p: { steps: Step[] }): JSX.Element {
  return (
    <div class="in-steps">
      <span class="in-dcard-h">What happens next</span>
      {p.steps.map((s, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true" class="in-steps-line" />}
          <div class="in-step">
            <span aria-hidden="true" class={cx('in-step-sq', s.state)}>
              {/^[A-Z]{2}$/.test(s.lead) ? <span>{s.lead}</span> : <Icon name={s.lead as IconName} size={18} stroke={s.state === 'done' ? 2.8 : 2} />}
            </span>
            <span class="in-step-t"><span>{s.title}</span><span>{s.sub}</span></span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** Goods going somewhere, on navy: the pictures, how many, an arrow, where (IN12, IN21, IN32). */
export function FlowCard(p: { pics: ComponentChildren; n: string; unit?: string; to: ComponentChildren; label: string; note?: string; head?: string; mint?: boolean }): JSX.Element {
  return (
    <div class={cx('in-flow', !!p.head && 'with-h')} role="img" aria-label={p.label}>
      {p.head && <span class="in-dcard-h">{p.head}</span>}
      <div class="in-flow-r">
        <span class="in-flow-pics">{p.pics}</span>
        <span class={cx('mono in-flow-n', p.mint && 'mint')}>{p.n}{p.unit && <span>{p.unit}</span>}</span>
        <span class="in-flow-arrow"><i /><Icon name="chevron-right" size={14} stroke={2.4} /></span>
        {p.to}
      </div>
      {p.note && <span class="in-flow-note">{p.note}</span>}
    </div>
  );
}

/** A short rail in a navy head (IN22, IN30, IN31): done stops ticked, the one now lit (mint or amber), the rest waiting. */
export interface RailStop { word: string; at: string; state: 'done' | 'now' | 'next'; icon?: IconName }
export function HeadRail(p: { stops: RailStop[]; tone?: 'mint' | 'amber'; label: string }): JSX.Element {
  const n = p.stops.length, w = 100 / n, lit = p.stops.filter((x) => x.state !== 'next').length - 1;
  return (
    <div class="in-hrail" role="img" aria-label={p.label}>
      <div class="in-hrail-dots" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        <span aria-hidden="true" class="in-hrail-line" style={{ left: `${w / 2}%`, right: `${w / 2}%` }} />
        {lit > 0 && <span aria-hidden="true" class="in-hrail-line on" style={{ left: `${w / 2}%`, width: `${w * lit}%` }} />}
        {p.stops.map((x, i) => (
          <span key={i} class={cx('in-hrail-dot', x.state, p.tone)}>
            <Icon name={x.state === 'done' ? 'check' : x.icon || 'store'} size={x.state === 'now' ? 16 : 12} stroke={x.state === 'done' ? 2.8 : 2.2} />
          </span>
        ))}
      </div>
      <div class="in-hrail-words" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {p.stops.map((x, i) => <span key={i} class={cx(x.state, p.tone)}><b>{x.word}</b><em class={x.at === 'now' ? undefined : 'mono'}>{x.at}</em></span>)}
      </div>
    </div>
  );
}
