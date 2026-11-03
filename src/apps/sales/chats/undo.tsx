/*
 * Undo instead of a confirm (BRIEF "Fewest steps"; GLOSSARY "Undo" keeps it 10 s). A give and an
 * ask of Ruth cannot be taken back on the books (hand_conversation leaves the chat with the new
 * salesperson; a team note stays), so the write waits the 10 seconds: Undo drops it, the screen
 * shows it done meanwhile, and leaving the chat sends it at once.
 *
 *   undoable('Kato is Brian’s now', () => write('give', […]), { top: 4, onUndo: … })
 *   the toast (CH21, CH31) is drawn on the page, above every sheet
 *   sendPending()      leaving: what waits goes now
 */
import { signal } from '@preact/signals';
import { render, type JSX } from 'preact';
import { Icon } from '../../../ui/icons.tsx';

interface Pending { id: number; text: string; top: number; commit: () => unknown; onUndo: () => void; timer: number }

export const pending = signal<Pending | null>(null);
/** A give that waits its 10 s: the chat shows it done meanwhile (its event and note). */
export const shown = { give: null as null | { chatId: number; event: import('../../../core/types.ts').ChatEvent } };
/** The Manager's move that waits its 10 s: every screen shows the chat as the new person's meanwhile (CH32). */
export const moving = signal<{ chatId: number; to: string } | null>(null);
/** The chats as they are about to be: a waiting move already applied. */
export function seen<T extends { chats: { id: number; ownerId: string | null }[] }>(cb: T | null): T | null {
  const m = moving.value;
  return cb && m ? { ...cb, chats: cb.chats.map((c) => (c.id === m.chatId ? { ...c, ownerId: m.to } : c)) } : cb;
}
let n = 0;

/** What waits goes now (its 10 s ran out, the screen is left, or another write comes). */
export function sendPending(): void {
  const p = pending.value;
  if (!p) return;
  clearTimeout(p.timer);
  pending.value = null;
  void p.commit();
}

/** The toast lives on the page itself, above any sheet (a full sheet's own layer would hide it under a light sheet's scrim). */
let host: HTMLElement | null = null;
function mount(): void {
  if (host || typeof document === 'undefined') return;
  host = document.createElement('div');
  document.body.appendChild(host);
  render(<UndoToast />, host);
}

export function undoable(text: string, commit: () => unknown, o: { top?: number; onUndo?: () => void; ms?: number } = {}): void {
  mount();
  sendPending();
  const id = ++n;
  const timer = window.setTimeout(() => { if (pending.value && pending.value.id === id) sendPending(); }, o.ms ?? 10000);
  pending.value = { id, text, top: o.top ?? 4, commit, onUndo: o.onUndo || (() => {}), timer };
}

function undo(): void {
  const p = pending.value;
  if (!p) return;
  clearTimeout(p.timer);
  pending.value = null;
  p.onUndo();
}

export function UndoToast(): JSX.Element | null {
  const p = pending.value;
  if (!p) return null;
  return (
    <div role="status" class="cv-toast" style={{ top: `${p.top}px` }}>
      <span aria-hidden="true"><Icon name="check" size={15} stroke={3} /></span>
      <span>{p.text}</span>
      <button type="button" onClick={undo}><span>Undo</span></button>
    </div>
  );
}
