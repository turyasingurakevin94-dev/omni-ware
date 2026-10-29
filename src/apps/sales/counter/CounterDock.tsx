/*
 * The counter's dock (P15 with S02 inside): what the sale comes to, how they pay, what they gave,
 * and the one move. Its states, one per board:
 *   empty KC01 · cash KC03 (Exact chosen), KC05 (change), KC07 (short) · counted KC06 → fourth tile ·
 *   mobile KC08 (the ID first), KC09 (ID in) · under the shop's price KC10 (Ask Ruth first) ·
 *   short on the shelf KC18 · sending KC13 · no signal KC17 · not sold KC19 (above the dock).
 */
import type { ComponentChildren, JSX } from 'preact';
import { Dock } from '../../../ui/Dock.tsx';
import { Icon } from '../../../ui/icons.tsx';
import { fig } from '../../../ui/Money.tsx';
import { MethodPicker } from '../../../ui/PayMethod.tsx';
import { Slide } from '../../../ui/Slide.tsx';
import { toast } from '../../../ui/toast.tsx';
import { notesFor } from '../../../core/money.ts';
import type { Method } from '../../../core/types.ts';
import { LockedSlide, SendingSlide, type LockIcon } from './local-slide.tsx';
import '../../../ui/dock.css';
import './dock.css';

/** The frame: fixed to the bottom, with what sits on it (the no-signal band, the not-sold card). */
export function DockFrame(p: { above?: ComponentChildren; children: ComponentChildren }): JSX.Element {
  return <div class="kc-dockwrap">{p.above}{p.children}</div>;
}

export function EmptyDock(): JSX.Element {
  return (
    <DockFrame>
      <Dock words="Counter sale" total={null} slide={{ label: 'Add an item to sell', knobLabel: 'Sell', onCommit: () => undefined }} />
    </DockFrame>
  );
}

/** The navy dock with its top row: the words (amber when something waits) and the total. */
export function NavyDock(p: { words: string; amber?: boolean; total: number; tight?: boolean; children: ComponentChildren }): JSX.Element {
  return (
    <div class={'ow-dock kc-dock' + (p.tight ? ' tight' : '')}>
      <div class="ow-dock-top words">
        <span class={'ow-dock-words' + (p.amber ? ' kc-amber' : '')}>{p.words}</span>
        <div class="ow-dock-sum"><span class="mono ow-dock-total">{fig(p.total)}</span></div>
      </div>
      {p.children}
    </div>
  );
}

export function Methods(p: { value: Method; onChange: (m: Method) => void; dim?: boolean }): JSX.Element {
  return <div class={p.dim ? 'kc-dim' : undefined}><MethodPicker navy value={p.value} onChange={p.onChange} /></div>;
}

export interface TenderProps {
  total: number;
  notes: number[];
  given: number | 'exact';
  counted: number | null;
  onPick: (v: number | 'exact') => void;
  onCount: () => void;
  dim?: boolean;
}

/** They gave: Exact and the two likely notes (a counted amount the fourth); then the change, or what is short. */
export function Tender(p: TenderProps): JSX.Element {
  const n = p.given === 'exact' ? p.total : p.given, change = n - p.total;
  const tiles: (number | 'exact')[] = ['exact', ...p.notes];
  const counted = p.counted != null && !p.notes.includes(p.counted) && p.counted !== p.total ? p.counted : null;
  return (
    <div class={'kc-gave' + (p.dim ? ' kc-dim' : '')}>
      <div class="kc-gave-h">
        <span>They gave</span>
        <button type="button" class="kc-glass" onClick={p.onCount}><span><Icon name="cash" size={15} stroke={2} />{counted != null ? 'Count again' : 'Other amount'}</span></button>
      </div>
      <div role="radiogroup" aria-label="They gave" class={'kc-gave-o' + (counted != null ? ' four' : '')}>
        {tiles.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={p.given === t} aria-label={t === 'exact' ? `Exact, ${fig(p.total)}` : undefined}
            class={(t === 'exact' ? '' : 'mono') + (p.given === t ? ' on' : '')} onClick={() => p.onPick(t)}>{t === 'exact' ? 'Exact' : fig(t)}</button>
        ))}
        {counted != null && (
          <button type="button" role="radio" aria-checked={p.given === counted} aria-label={`They gave ${fig(counted)}. Count again`} class={'mono pen' + (p.given === counted ? ' on' : '')} onClick={p.onCount}>
            {fig(counted)}<Icon name="pen" size={13} stroke={2.2} />
          </button>
        )}
      </div>
      {change > 0 && <div class="kc-gave-c"><span>Give change</span><span class="mono">{fig(change)}</span></div>}
      {change < 0 && (
        <div class="kc-gave-c short">
          <span>Short by</span>
          <span class="kc-gave-s">
            <span role="img" aria-label={`${fig(-change)} still to come`} class="kc-dash">{notesShort(-change).map((x, i) => <span key={i} class="mono">{fig(x)}</span>)}</span>
            <span class="mono">{fig(-change)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/** The missing money as the notes still to come (KC07: one dashed 2,000); under 1,000 counts as a 1,000. */
const notesShort = (v: number): number[] => notesFor(Math.ceil(v / 1000) * 1000).slice(0, 3);

/** The transaction ID (Mobile, Bank): amber until it is in, mint with a tick once it is; Paste reads their SMS. */
export function RefField(p: { value: string; onInput: (v: string) => void }): JSX.Element {
  const ok = !!p.value.trim();
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      const id = (t.match(/ID\s*:?\s*([A-Z0-9]{6,})/i) || t.match(/(\d{8,})/) || [])[1];
      if (id) p.onInput(id); else toast.show('Copy the SMS first', { kind: 'warn' });
    } catch (_e) { toast.show('Copy the SMS first', { kind: 'warn' }); }
  };
  return (
    <label class={'kc-ref' + (ok ? ' ok' : '')}>
      <span class="kc-ref-t">
        <span>Transaction ID</span>
        <input type="text" inputmode="numeric" aria-label="Transaction ID" placeholder="Type the ID" value={p.value} autocomplete="off" spellcheck={false}
          onInput={(e) => p.onInput((e.target as HTMLInputElement).value)} />
      </span>
      {ok ? <span aria-hidden="true" class="kc-ref-ok"><Icon name="check" size={14} stroke={3.2} /></span>
        : <button type="button" class="kc-paste" aria-label="Paste the ID" onClick={(e) => { e.preventDefault(); void paste(); }}><span>Paste</span></button>}
    </label>
  );
}

/** The one move: the slide, or why it cannot go yet, or "Sending…". */
export function Move(p: { sending: boolean; locked: { icon: LockIcon; label: string; amber?: boolean } | null; label: string; onSell: () => unknown }): JSX.Element {
  if (p.sending) return <SendingSlide />;
  if (p.locked) return <LockedSlide {...p.locked} />;
  return <Slide label={p.label} knobLabel="Sell it" onCommit={p.onSell} onHint={() => toast.show('Slide the red button across', { kind: 'warn' })} />;
}

/** KC17: the sand band the dock sits on. */
export function NoSignal(): JSX.Element {
  return (
    <div role="status" class="kc-band">
      <Icon name="offline" size={18} stroke={2} style={{ color: '#95530C' }} />
      <span>No signal · your lines are kept on this phone</span>
    </div>
  );
}

/** KC19: not sold, nothing taken; above the dock. */
export function NotSold(p: { onClose: () => void }): JSX.Element {
  return (
    <div role="alert" class="kc-fail">
      <div>
        <span aria-hidden="true" class="kc-fail-i"><Icon name="warning" size={18} stroke={2.2} /></span>
        <span class="kc-fail-t"><b>Not sold · nothing taken</b><span>Slide again to sell</span></span>
        <button type="button" aria-label="Close" onClick={p.onClose}><Icon name="close" size={16} stroke={2.2} /></button>
      </div>
    </div>
  );
}
