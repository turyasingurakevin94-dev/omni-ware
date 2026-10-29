/*
 * LOCAL PART (for the lead to move into src/ui, as states of P15's Slide): the slide that cannot go
 * yet, and the slide while it sends, as the KC boards draw them. The Slide part's 'blocked' and
 * 'offline' states draw the arrows on a grey knob; the counter's say why on the knob itself:
 *   lock (Type the ID first, Ask Ruth first, Short · 2,000) · hourglass (Waiting for Ruth) ·
 *   no signal (Back online to sell) · the box (1 short); a label in #B3BCD2, or amber when short.
 * Sending (KC13): the fill runs the whole width, the knob waits at the end with a spinner.
 *
 *   <LockedSlide icon="lock" label="Type the ID first" />
 *   <LockedSlide icon="box" label="1 short" />          the box in amber
 *   <LockedSlide icon="lock" label="Short · 2,000" amber />
 *   <SendingSlide />
 */
import type { JSX } from 'preact';
import { Duo, Icon, phBox } from '../../../ui/icons.tsx';
import './slide.css';

export type LockIcon = 'lock' | 'hourglass' | 'offline' | 'box';

export function LockedSlide(p: { icon: LockIcon; label: string; amber?: boolean }): JSX.Element {
  const knob = p.icon === 'box' ? <Duo i={phBox} size={22} color="#F5B26B" />
    : <Icon name={p.icon} size={20} stroke={2} style={{ color: p.icon === 'lock' ? '#DDE3F0' : '#F5B26B' }} />;
  return (
    <button type="button" class="kc-lslide" disabled aria-disabled="true">
      <span aria-hidden="true" class="kc-lslide-k">{knob}</span>
      <span class={'kc-lslide-l' + (p.amber ? ' amber' : '')}>{p.label}</span>
    </button>
  );
}

export function SendingSlide(): JSX.Element {
  return (
    <div role="status" class="kc-sslide">
      <span aria-hidden="true" class="kc-sslide-f" />
      <span class="kc-sslide-l">Sending…</span>
      <span aria-hidden="true" class="kc-sslide-k">
        <svg width="22" height="22" viewBox="0 0 24 24" class="kc-spin"><circle cx="12" cy="12" r="8.5" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.6" /><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" /></svg>
      </span>
    </div>
  );
}
