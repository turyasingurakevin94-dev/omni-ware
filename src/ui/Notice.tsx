/*
 * P27 · The notice bar (LANGUAGE.md §3 P27): full width directly under the
 * head (or above the dock when the dock is the subject), 44 tall at least.
 *
 *   <Notice kind="offline" action={{ label: 'Try again', on: flush }}>No signal · <b class="mono">2</b> not sent yet</Notice>
 *   <Notice kind="someone">Someone else just did this · Refreshed</Notice>
 *   <Notice kind="paused">Paused by Ruth</Notice>
 */
import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName } from './icons.tsx';
import './notice.css';

const KIND: Record<'offline' | 'someone' | 'paused', IconName> = { offline: 'offline', someone: 'undo', paused: 'clock' };

export interface NoticeProps {
  kind: 'offline' | 'someone' | 'paused';
  action?: { label: string; on: () => void };
  class?: string;
  children: ComponentChildren;
}

export function Notice(p: NoticeProps): JSX.Element {
  return (
    <div role="status" class={'ow-notice k-' + p.kind + (p.class ? ' ' + p.class : '')}>
      <span class="ow-notice-ic"><Icon name={KIND[p.kind]} size={18} stroke={2} /></span>
      <span class="ow-notice-t">{p.children}</span>
      {p.action && <button type="button" class="ow-notice-act" onClick={p.action.on}><span>{p.action.label}</span></button>}
    </div>
  );
}

/**
 * A callout inside a card or sheet: a tone soft box, an icon, one line that says the next step
 * ("Under the shop's price. Ruth says yes before it is packed.").
 *
 *   <Callout tone="warn" icon="clock">Under the shop's price. Ruth says yes before it is packed.</Callout>
 */
export function Callout(p: { tone: 'warn' | 'info' | 'good' | 'bad'; icon: IconName; children: ComponentChildren }): JSX.Element {
  return <div class={'ow-callout c-' + p.tone}><span class="ow-callout-ic"><Icon name={p.icon} size={18} stroke={2} /></span><span>{p.children}</span></div>;
}
