/*
 * The Pack area's own small parts (store-agent PK01–PK22), built from src/ui: a face with the
 * packer's badge, a section head, the push card, the where card, the not-done card that takes
 * the dock's place, the notice at the top of a body, and the line strip under a pack card's head.
 * Each is drawn once here and used by every Pack screen.
 */
import type { ComponentChildren, JSX } from 'preact';
import { Avatar } from '../../../ui/Avatar.tsx';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { Notice } from '../../../ui/Notice.tsx';
import { Tap, cx } from '../../../ui/util.tsx';
import type { YardFace } from '../../../core/store/faces.ts';
import type { Where } from '../../../core/store/pack.ts';
import { notDone, online, kept, flush, status, books } from '../shell/store.ts';
import { clock } from '../../../core/time.ts';
import { nav, stack } from '../shell/nav.ts';
import './pack.css';

/** A customer's face, with the packer's (or Ruth's) small face at its foot (PK01 "KC · MK"). */
export function FaceBadge(p: { face: YardFace; badge?: YardFace | null; size?: number; dim?: boolean }): JSX.Element {
  const s = p.size || 32;
  if (!p.badge) return <span class={cx('pk-face', p.dim && 'dim')}><Avatar {...p.face} size={s} /></span>;
  return (
    <span class="pk-face badge" style={{ width: `${s}px`, height: `${s}px` }}>
      <Avatar {...p.face} size={s} />
      <span class="pk-face-b"><Avatar {...p.badge} size={18} style={{ boxShadow: '0 0 0 2px #FFFFFF' }} /></span>
    </span>
  );
}

/** P06 on the sheet: the stage's dot, its title and count, and a line on the right. */
export function Section(p: { dot: string; title: string; count: number; meta?: ComponentChildren }): JSX.Element {
  return (
    <div class="pk-sec">
      <span aria-hidden="true" class="pk-sec-dot" style={{ background: p.dot }} />
      <h2>{p.title}</h2>
      <span class="mono pk-sec-n">{p.count}</span>
      <span class="pk-sec-sp" />
      {p.meta != null && <span class="pk-sec-meta">{p.meta}</span>}
    </div>
  );
}

/** The push that brought the work, as a card with the sender's face and a bell (PK08, PK09, PK10). */
export function PushCard(p: { face: YardFace; title: string; sub: string; on?: () => void; label?: string }): JSX.Element {
  const inner = (
    <>
      <span class="pk-push-f"><Avatar {...p.face} size={36} /><span class="pk-push-bell"><Icon name="bell" size={10} stroke={2.6} /></span></span>
      <span class="pk-push-t"><b>{p.title}</b><span class="mono">{p.sub}</span></span>
      <span class="pk-chev"><Icon name="chevron-right" size={14} stroke={2.4} /></span>
    </>
  );
  return p.on ? <Tap on={p.on} label={p.label} class="pk-card pk-push">{inner}</Tap> : <div class="pk-card pk-push">{inner}</div>;
}

/** Where · when · phone (IM-01, IM-02): the order's own; a pickup is "They collect · at the gate". */
export function WhereCard(p: { where: Where; name: string; sub?: string }): JSX.Element {
  const w = p.where;
  const title = w.pickup ? 'They collect · at the gate' : [w.to, w.when].filter(Boolean).join(' · ');
  const sub = p.sub ?? (w.pickup ? `they collect${w.phone ? ' · ' + w.phone : ''}` : `we deliver${w.phone ? ' · ' + w.phone : ''}`);
  return (
    <div class="pk-card pk-where">
      <span aria-hidden="true" class={cx('pk-where-i', w.pickup && 'pickup')}><Icon name={w.pickup ? 'store' : 'truck'} size={20} stroke={1.9} /></span>
      <span class="pk-where-t"><b>{title}</b><span class={cx(!p.sub && 'mono')}>{sub}</span></span>
      {!w.pickup && w.phone && <Tap href={'tel:+256' + w.phone.replace(/\D/g, '').replace(/^0/, '')} label={`Call ${p.name}`} class="pk-call"><Icon name="phone" size={18} stroke={2} /></Tap>}
    </div>
  );
}

/** "Not done · that did not save" in the dock's place (PK12, PK19, PK22): what was kept, the code, and Try again. */
export function NotDoneCard(p: { what: string; onRetry: () => void; onClose: () => void }): JSX.Element {
  const n = notDone.value;
  return (
    <div role="alert" class="pk-fail">
      <div class="pk-fail-r">
        <span aria-hidden="true" class="pk-fail-i"><Icon name="warning" size={18} stroke={2.2} /></span>
        <span class="pk-fail-t">
          <b>Not done · that did not save</b>
          <span>{p.what}</span>
          {n && n.code && <span class="mono pk-fail-c">{`tell Kevin · ${n.code}`}</span>}
        </span>
        <button type="button" class="pk-fail-x" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
      <button type="button" class="pk-fail-go" onClick={p.onRetry}><Icon name="undo" size={18} stroke={2.2} />Try again</button>
    </div>
  );
}

/**
 * The bar at the top of a Pack body (PK11, PK13, PK20): amber no signal (with what waits, or when the copy
 * was saved), blue "Someone else just did this · Refreshed". The red one is NotDoneCard, by the dock.
 */
export function TopNotice(p: { waitingWord?: 'not sent yet' | null }): JSX.Element | null {
  const n = notDone.value, waiting = kept.value.filter((k) => k.state !== 'refused').length, b = books.value;
  if (!online.value || waiting > 0) {
    return (
      <Notice kind="offline" class={waiting > 0 && p.waitingWord ? 'pk-notice tall' : 'pk-notice'} action={{ label: 'Try again', on: () => { void flush(); } }}>
        {waiting > 0 && p.waitingWord ? <>No signal · <b class="mono">{waiting}</b> {p.waitingWord}</>
          : <>No signal · saved <b class="mono">{b ? clock(b.at) : ''}</b></>}
      </Notice>
    );
  }
  if (n && n.tone === 'someone') return <Notice kind="someone" class="pk-notice">{n.text}</Notice>;
  return null;
}

/** The head's line when the phone reads its copy: "Updating · saved 7:52" in amber. */
export function savedLine(): string | null {
  const b = books.value;
  return status.value === 'updating' && !online.value && b ? `Updating · saved ${clock(b.at)}` : null;
}

/** A soft square with an icon (the where card's, the check-in link's). */
export function IconSquare(p: { icon: IconName; tone: 'info' | 'good' | 'warn' | 'plain'; size?: number }): JSX.Element {
  return <span aria-hidden="true" class={'pk-isq t-' + p.tone} style={p.size ? { width: `${p.size}px`, height: `${p.size}px` } : undefined}><Icon name={p.icon} size={20} stroke={1.9} /></span>;
}

/** Back to the sheet: the one under, or To pack in this screen's place (PK02's Close and its strip). */
export function toSheet(): void {
  const s = stack.value;
  if (s.length > 1 && s[s.length - 2].id === 'pack') nav.back();
  else nav.replace('pack');
}
