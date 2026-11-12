/*
 * The Shelf's shared pieces (store-agent SH boards), drawn once:
 *
 *   ItemHead       the navy head of an item's sheet: its square, its name, a line, Close; then its picture
 *   GroupHead      a dot, a title and a quiet figure ("What moved · 4 weeks")
 *   Moved          four weeks of what moved, one row each (shelf.ts moved)
 *   ShelfActs      Count · Report · We need more (P21's joined bar)
 *   SendButton     the navy "Send to Ruth" (sending: a spinner; disabled: grey)
 *   UndoPill       "Changed your mind? · Undo · 9 s" while a send waits its 10 s
 *   NoSignal       the amber strip "No signal · saved 7:52 · Try again"
 *   NotSaved       the red card "That did not save · … · tell Kevin · code SC-502 · Try again"
 *   KeptCard       "Not sent yet · kept on this phone · goes to Ruth by itself · Remove"
 *   SentMoment     the navy "Sent to Ruth" end of a send, its steps and who hears (P22, the Store's)
 *
 * Words for an item: shortName, soldBy, unitWord. No money anywhere.
 */
import { Fragment, type ComponentChildren, type JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { firstWord } from '../../../core/names.ts';
import { clock, dayLabel, dayOf, weekday } from '../../../core/time.ts';
import type { Ms } from '../../../core/types.ts';
import type { Moved as Row } from '../../../core/store/shelf.ts';
import type { ShelfItem, YardPerson } from '../../../core/store/types.ts';
import { ActBar } from '../../../ui/ActTiles.tsx';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { EndOfFlow } from '../../../ui/Moment.tsx';
import { cx, Tap } from '../../../ui/util.tsx';
import { held, undoHeld } from '../shell/store.ts';
import { ItemPic } from './glyphs.tsx';
import './parts.css';

/* ---------------- words ---------------- */

const UNIT: Record<string, [string, string]> = { pc: ['piece', 'pieces'], ctn: ['carton', 'cartons'], bag: ['bag', 'bags'], tin: ['tin', 'tins'], box: ['box', 'boxes'], pair: ['pair', 'pairs'], kg: ['kg', 'kg'], bundle: ['bundle', 'bundles'] };
/** "piece", "cartons". */
export const unitWord = (u: string, n = 1): string => (UNIT[u] ? UNIT[u][n === 1 ? 0 : 1] : u);
/** "sold by the piece", "sold by the kg". */
export const soldBy = (it: Pick<ShelfItem, 'unit'>): string => `sold by the ${unitWord(it.unit)}`;
/** "Iron sheet G28 · 3m" → "Iron sheet G28"; "Wheelbarrow, heavy duty" → "Wheelbarrow". */
export const shortName = (name: string): string => name.split(' · ')[0].split(', ')[0];
/** What a short name leaves out ("heavy duty"), or ''. */
export const nameRest = (name: string): string => { const s = name.split(' · ')[0], i = s.indexOf(', '); return i > 0 ? s.slice(i + 2) : ''; };
/** "today 10:30", "Thu 15 Oct", "Thu 16:10" (this week). */
export function whenSaid(at: Ms, now: Ms, time = true): string {
  if (dayOf(at) === dayOf(now)) return `today ${clock(at)}`;
  return now - at < 6 * 864e5 && time ? `${weekday(at)} ${clock(at)}` : dayLabel(at);
}

/* ---------------- the head ---------------- */

export function ItemHead(p: { it: ShelfItem; title?: string; sub: ComponentChildren; onClose: () => void; children?: ComponentChildren; pic?: ComponentChildren }): JSX.Element {
  return (
    <div class="sh-head">
      <span aria-hidden="true" class="sh-grab" />
      <div class="sh-head-row">
        {p.pic || <ItemPic it={p.it} size={44} />}
        <div class="sh-head-t"><span>{p.title || p.it.name}</span><span>{p.sub}</span></div>
        <button type="button" class="sh-x" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      {p.children}
    </div>
  );
}

/** The full sheet an item's screens sit in: the 40 px strip (the way back), the sheet, its head, its body. */
export function ItemSheet(p: { back: () => void; backLabel: string; head: ComponentChildren; children: ComponentChildren; body?: string }): JSX.Element {
  return (
    <div class="sh-full">
      <Tap on={p.back} label={p.backLabel} class="sh-full-back" />
      <div class="sh-full-sheet">
        {p.head}
        <div class={cx('sh-body', p.body)}>{p.children}</div>
      </div>
    </div>
  );
}

export function GroupHead(p: { dot: string; title: string; meta?: string }): JSX.Element {
  return (
    <div class="sh-ghead">
      <span aria-hidden="true" style={{ background: p.dot }} />
      <span>{p.title}</span>
      <span class="mono">{p.meta || ''}</span>
    </div>
  );
}

/* ---------------- what moved ---------------- */

const ROW: Record<Row['kind'], [IconName, string, string]> = {
  out: ['arrow-up', '#F1EEE8', '#5F6980'], packed: ['arrow-up', '#F1EEE8', '#5F6980'], in: ['arrow-down', '#E4F4EA', '#0F6B43'],
  count: ['tally', '#E3EEFB', '#1A5A8A'], writeoff: ['warning', '#FBE5E2', '#8E2A22'], kept: ['warning', '#E3EEFB', '#1A5A8A'], ask: ['cart', '#E3EEFB', '#1A5A8A'],
};
const ago = (at: Ms, now: Ms): string => (now - at < 3600e3 ? 'just now' : whenSaid(at, now));
const minus = (n: number): string => (n < 0 ? `−${-n}` : n > 0 ? `+${n}` : '0');

/** One row's words: what, and when (WORD-09: "Order #0552 · Kato"). */
function words(r: Row, now: Ms, ruth: string): [string, string] {
  const when = whenSaid(r.at, now);
  switch (r.kind) {
    case 'out': return [r.note, `out · ${when}`];
    case 'packed': { const [o, w, bay] = r.note.split(' · '); return [`${o} · ${w}`, `packed · ${dayLabel(r.at)}${bay ? ' · ' + bay : ''}`]; }
    case 'in': return [r.note, `in · ${dayLabel(r.at)}`];
    case 'count': {
      const aisle = /^Aisle (\w)/.exec(r.note);
      const asked = r.asked != null ? `blind · ${clock(r.asked)} · ` : '';
      return aisle ? [`Counted · aisle ${aisle[1]} · ${firstWord(r.who)}`, `${ruth} accepted · ${whenSaid(r.at, now)}`]
        : [`Counted · ${firstWord(r.who)} · ${ruth} accepted`, `${asked}${ago(r.at, now)}`];
    }
    case 'writeoff': return [`Written off · ${r.note} · ${ruth}`, `${ago(r.at, now)} · you reported ${r.asked != null ? clock(r.asked) : ''}`];
    case 'kept': return [`Report · kept on the shelf · ${ruth}`, `${ago(r.at, now)} · you reported ${r.asked != null ? clock(r.asked) : ''}`];
    // The answer's first part and when (SH32): "next trip" is the banner's, it already says it.
    case 'ask': return ['Asked for more · Denis', `${r.note ? r.note.split(' · ')[0] : 'Sent'} · ${ago(r.at, now)}`];
    default: return [r.note, when];
  }
}

export function Moved(p: { rows: Row[]; now: Ms; ruth: string; max?: number }): JSX.Element {
  return (
    <div class="sh-card">
      {p.rows.slice(0, p.max || 4).map((r, i) => {
        const [t, s] = words(r, p.now, p.ruth), [ic, bg, ink] = ROW[r.kind];
        return (
          <div key={i} class="sh-mv">
            <span aria-hidden="true" class="sh-mv-i" style={{ background: bg, color: ink }}><Icon name={ic} size={16} stroke={2} /></span>
            <span class="sh-mv-t"><span>{t}</span><span class="mono">{s}</span></span>
            {r.kind === 'ask' ? <b class="mono sh-mv-ask">{`${r.asked} ${r.unit}`}</b>
              : r.delta == null ? <span aria-label="no change" class="sh-mv-ok"><Icon name="check" size={13} stroke={3} /></span>
              : <b class={cx('mono', r.delta > 0 && 'up', r.delta < 0 && (r.kind === 'count' || r.kind === 'writeoff') && 'down', r.delta === 0 && 'zero')}>{minus(r.delta)}</b>}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- acts ---------------- */

export function ShelfActs(p: { onCount: () => void; onReport: () => void; onMore: () => void }): JSX.Element {
  return (
    <ActBar acts={[
      { tone: 'call', icon: 'tally', word: 'Count', sub: 'blind, to Ruth', on: p.onCount },
      { tone: 'fix', icon: 'warning', word: 'Report', sub: 'damaged, lost', on: p.onReport },
      { tone: 'receipt', icon: 'cart', word: 'We need more', sub: 'ask Denis', on: p.onMore },
    ]} />
  );
}

export function SendButton(p: { label: string; state?: 'idle' | 'sending' | 'disabled'; onClick: () => void; icon?: IconName }): JSX.Element {
  const s = p.state || 'idle';
  return (
    <button type="button" class={cx('sh-send', s)} disabled={s !== 'idle'} aria-disabled={s !== 'idle'} onClick={p.onClick}>
      {s === 'sending' ? <span aria-hidden="true" class="sh-spin" /> : <Icon name={p.icon || 'send'} size={18} stroke={2} />}{s === 'sending' ? 'Sending…' : p.label}
    </button>
  );
}

/** While a send waits its 10 s: "Changed your mind? · Undo · 9 s". */
export function UndoPill(): JSX.Element | null {
  const h = held.value, [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(t); }, []);
  if (!h) return null;
  const left = Math.max(1, Math.ceil((h.until - Date.now()) / 1000));
  return (
    <div role="status" class="sh-undo">
      <span>Changed your mind?</span>
      <button type="button" onClick={undoHeld}>Undo · <span>{left}</span> s</button>
    </div>
  );
}

/* ---------------- the states of a send ---------------- */

export function NoSignal(p: { saved: string; children?: ComponentChildren; onRetry: () => void }): JSX.Element {
  return (
    <div role="status" class="sh-nosig">
      <span aria-hidden="true"><Icon name="offline" size={18} stroke={2} /></span>
      <span>{p.children || <>No signal · saved <span class="mono">{p.saved}</span></>}</span>
      <button type="button" onClick={p.onRetry}><span>Try again</span></button>
    </div>
  );
}

export function NotSaved(p: { sub: ComponentChildren; onRetry: () => void; onClose: () => void }): JSX.Element {
  return (
    <div role="alert" class="sh-fail">
      <span aria-hidden="true" class="sh-fail-d">!</span>
      <span class="sh-fail-t">
        <span>That did not save</span><span>{p.sub}</span>
        <span><button type="button" onClick={p.onRetry}>Try again</button></span>
      </span>
      <button type="button" aria-label="Close" class="sh-fail-x" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
    </div>
  );
}

export function KeptCard(p: { to: string; onRemove: () => void }): JSX.Element {
  return (
    <div class="sh-kept">
      <span aria-hidden="true"><Icon name="offline" size={19} stroke={2} /></span>
      <span class="sh-kept-t"><span>Not sent yet</span><span>{`kept on this phone · goes to ${p.to} by itself`}</span></span>
      <button type="button" onClick={p.onRemove}>Remove</button>
    </div>
  );
}

/* ---------------- sent ---------------- */

export interface Step { icon: IconName; title: string; sub: string; on?: () => void }

/** The navy end of a send: the tick, "Sent to Ruth", who and what, three steps (sent · now · then), who hears, one button. */
export function SentMoment(p: { title: string; who: YardPerson; what: string; steps: [Step, Step, Step]; hears: [YardPerson, string, boolean][]; end: string; onEnd: () => void; onClose: () => void }): JSX.Element {
  return (
    <div class="sh-sent">
      <div class="sh-sent-x"><button type="button" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button></div>
      <div class="sh-sent-top">
        <span aria-hidden="true" class="sh-sent-tick"><Icon name="check" size={46} stroke={2.8} /></span>
        <h1>{p.title}</h1>
        <span class="sh-sent-who"><Avatar initials={p.who.initials} tint={p.who.tint} size={30} font={11} /><span>{p.who.name}</span><span class="mono">{p.what}</span></span>
      </div>
      <div class="sh-steps">
        <span class="sh-steps-h">What happens next</span>
        {p.steps.map((s, i) => {
          const body = (
            <>
              <span aria-hidden="true" class={cx('sh-step-sq', i === 0 && 'done', i === 1 && 'now')}><Icon name={s.icon} size={20} stroke={2} /></span>
              <span class="sh-step-t"><span>{s.title}</span><span>{s.sub}</span></span>
              {s.on && <span aria-hidden="true" class="sh-step-go"><Icon name="chevron-right" size={16} stroke={2.2} /></span>}
              {i < 2 && <span aria-hidden="true" class="sh-step-line" />}
            </>
          );
          return <Fragment key={i}>{s.on ? <Tap on={s.on} class="sh-step">{body}</Tap> : <div class="sh-step">{body}</div>}</Fragment>;
        })}
      </div>
      <div class="sh-hears">
        {p.hears.map(([who, line, push]) => (
          <span key={who.id} class={cx('sh-hear', push && 'push')}>
            <Avatar initials={who.initials} tint={who.tint} size={30} font={11} />
            <span><span>{who.name.split(' ')[0]}</span><span><Icon name={push ? 'bell' : 'list'} size={12} stroke={2.2} />{line}</span></span>
          </span>
        ))}
      </div>
      <EndOfFlow label={p.end} on={p.onEnd} ms={8000} />
    </div>
  );
}

/** A white sheet over the screen it opened from (P17's measures, drawn in the route): scrim, grabber, eyebrow, title, Close, body, foot. */
export function Over(p: { top: number; eyebrow: string; title: string; onClose: () => void; children: ComponentChildren; foot: ComponentChildren }): JSX.Element {
  return (
    <>
      <div aria-hidden="true" class="sh-scrim" onClick={p.onClose} />
      <div role="dialog" aria-label={p.title} class="sh-over" style={{ top: `calc(var(--app-top) + ${p.top}px)` }}>
        <span aria-hidden="true" class="sh-over-grab" />
        <div class="sh-over-h">
          <div><span>{p.eyebrow}</span><h2>{p.title}</h2></div>
          <button type="button" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
        </div>
        <div class="sh-over-b">{p.children}</div>
        <div class="sh-over-f">{p.foot}</div>
      </div>
    </>
  );
}

/** A figure's digits in mono inside words ("Gloss paint · 2 tin"). */
export function Nums(p: { text: string }): JSX.Element {
  return <>{p.text.split(/(\d[\d:.,]*)/).map((t, i) => (i % 2 ? <span key={i} class="mono">{t}</span> : t))}</>;
}
