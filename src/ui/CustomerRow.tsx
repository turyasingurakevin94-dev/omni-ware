/*
 * P10 · The customer row with its due ring (LANGUAGE.md §3 P10). The ring
 * fills as their usual gap runs out (green due, amber late, crimson gone
 * quiet, grey early); the line under the name says it in the ring's tone;
 * what they owe at the right; a WhatsApp disc. The row is a div: the main
 * part is one button, the disc a sibling (never a control in a control).
 * Rows sit in a GroupCard (ActRow.tsx), 64 tall.
 *
 *   <CustomerRow face={{ initials: 'KS', tint: 't1' }} tone="late" fill={1} name="Kyaligonza & Sons"
 *     sub="4 days late · every 14 days" owes="420k" on={…} onWhatsApp={…} />
 *   tone={null}: nothing due, the line in #5F6980 600.
 */
import type { JSX } from 'preact';
import { RING_TONE, RingAvatar, type Face } from './Avatar.tsx';
import { Duo, phWhatsapp } from './icons.tsx';
import { fig } from './Money.tsx';
import type { Fig } from './util.tsx';
import './customerrow.css';

export interface CustomerRowProps {
  face: Face;
  tone: keyof typeof RING_TONE | null;
  /** How much of their gap has run out, 0 to 1. */
  fill?: number;
  name: string;
  sub: string;
  /** What they owe (written short, "420k"); none when nothing. */
  owes?: Fig;
  /** The word under it ("owes"). */
  owesWord?: string;
  on: () => void;
  onWhatsApp?: () => void;
  class?: string;
}

export function CustomerRow(p: CustomerRowProps): JSX.Element {
  return (
    <div class={'ow-crow' + (p.class ? ' ' + p.class : '')}>
      <button type="button" class="ow-crow-main" onClick={p.on}>
        <RingAvatar {...p.face} tone={p.tone || 'early'} fill={p.tone ? p.fill ?? 1 : 0} />
        <span class="ow-crow-t">
          <span class="ow-crow-name">{p.name}</span>
          <span class="ow-crow-sub" style={p.tone ? { color: RING_TONE[p.tone], fontWeight: 700 } : undefined}>{p.sub}</span>
        </span>
        {p.owes != null && <span class="ow-crow-owes"><span class="mono">{fig(p.owes, true)}</span><span>{p.owesWord || 'owes'}</span></span>}
      </button>
      {p.onWhatsApp && (
        <button type="button" class="ow-crow-wa" aria-label={`WhatsApp ${p.name.replace(/&/g, 'and')}`} onClick={p.onWhatsApp}>
          <Duo i={phWhatsapp} size={19} color="#0F6B43" />
        </button>
      )}
    </div>
  );
}
