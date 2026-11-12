/*
 * The frame of the Team sheets (Team p2 one person, p4 nudge): it rises over the page under it,
 * 14 px of navy-3 above; the navy head with the grabber (pull down or ✕ to close); the light body;
 * the navy dock that follows the content. And the dock's one move (DockMove), in every state:
 * the white answer, held with Undo 10 s, sending, waits, not sent.
 */
import type { ComponentChildren, JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { hm } from '../../../core/manager/words.ts';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { useDragClose } from '../../../ui/sheet.tsx';
import { nav } from '../shell/nav.ts';
import { undoHeld } from '../shell/store.ts';
import { movedAt, phaseOf, retryMove, useSecondsLeft } from './Move.tsx';
import './sheet.css';

export function TeamSheet(p: { label: string; head: ComponentChildren; children: ComponentChildren; dock: ComponentChildren; follow?: boolean }): JSX.Element {
  const box = useRef<HTMLDivElement>(null), scrim = useRef<HTMLDivElement>(null);
  useDragClose(box, () => nav.back(), scrim);
  return (
    <div class="mg-ts" role="dialog" aria-label={p.label}>
      <div class="mg-ts-scrim" ref={scrim} onClick={() => nav.back()} />
      <div class={'mg-ts-box' + (p.follow ? ' follow' : '')} ref={box}>
        <header class="mg-ts-head"><span class="mg-ts-grab" aria-hidden="true" />{p.head}</header>
        <div class="mg-ts-body">{p.children}</div>
        <footer class="mg-ts-dock">{p.dock}</footer>
      </div>
    </div>
  );
}

export function CloseX(): JSX.Element {
  return <button type="button" class="mg-ts-x" aria-label="Close" onClick={() => nav.back()}><Icon name="close" size={18} stroke={2.2} /></button>;
}

/** "Faith sees [Ruth nudged you]": the bell, who, the word they get. */
export function Sees(p: { who: string; word: string }): JSX.Element {
  return <span class="mg-ts-sees"><Icon name="bell" size={14} stroke={2} />{`${p.who} sees `}<b>{p.word}</b></span>;
}

/** The dock's white answer for a row move `id`; after the tap: "Nudged · 09:40" with Undo, then sent. */
export function DockMove(p: { id: string; icon: IconName; word: string; done: string; on: () => void; off?: string; before?: ComponentChildren }): JSX.Element {
  const ph = phaseOf(p.id), left = useSecondsLeft(ph === 'held');
  if (ph === 'held' || ph === 'done' || ph === 'waits') {
    return (
      <div class="mg-ts-strip" role="status">
        <span class="ok"><Icon name={ph === 'waits' ? 'clock' : 'check'} size={18} stroke={2.4} /></span>
        <b>{`${p.done} · `}<span class="mg-mono">{hm(movedAt(p.id))}</span></b>
        {ph === 'held' && <button type="button" class="mg-ts-undo" onClick={() => undoHeld()}><Icon name="undo" size={16} stroke={2} />Undo · <span class="mg-mono">{`${left} s`}</span></button>}
        {ph === 'waits' && <span class="mg-ts-waits">Waits</span>}
      </div>
    );
  }
  if (ph === 'sending') return <button type="button" class="mg-ts-ans" disabled aria-busy="true"><span class="ow-spin" aria-hidden="true" />Sending…</button>;
  if (ph === 'error') {
    return (
      <>
        <span class="mg-ts-err" role="alert"><Icon name="warning" size={16} stroke={2} />Not sent · Try again</span>
        <button type="button" class="mg-ts-ans" onClick={() => retryMove(p.id)}>Try again</button>
      </>
    );
  }
  return (
    <div class="mg-ts-row">
      {p.before}
      <button type="button" class="mg-ts-ans" aria-disabled={p.off ? 'true' : undefined} onClick={() => { if (!p.off) p.on(); }}>
        {!p.off && <Icon name={p.icon} size={18} stroke={2} />}{p.off || p.word}
      </button>
    </div>
  );
}
