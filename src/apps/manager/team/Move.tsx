/*
 * The move on a row (Team states row: pressed → Nudged with Undo 10 s, sending, error, offline).
 * A tap is an `answer` held 10 s; the row draws its own strip (quiet), so each row keeps its state
 * here, by row id, while the Team pages are open:
 *
 *   idle     the row as drawn, its navy pill (Nudge · Give it to Joy)
 *   held     "Nudged · 09:40" / bell "Faith sees it" · Undo · 10 s
 *   sending  the pill a neutral spinner, "Sending…" (no tick before the shop says yes)
 *   done     "Nudged · 09:40" / "Faith sees it"
 *   waits    no signal: the row says "Waits"; it sends itself when back
 *   error    "Try again" on the row, the red line "Not sent · Try again" under it
 */
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { WriteName } from '../../../core/manager/source.ts';
import { hm, whoSee } from '../../../core/manager/words.ts';
import { Icon, type IconName } from '../../../ui/icons.tsx';
import { act, answer, held, now, undoHeld } from '../shell/store.ts';

export type Phase = 'idle' | 'held' | 'sending' | 'done' | 'waits' | 'error';
interface Move { phase: Exclude<Phase, 'idle'>; at: number; label: string; kind: WriteName; args: unknown[] }

const moves = signal<Record<string, Move>>({});
const put = (id: string, m: Move | null): void => {
  const next = { ...moves.value };
  if (m) next[id] = m; else delete next[id];
  moves.value = next;
};
const ended = (id: string, r: { kept: boolean } | null, e?: unknown): void => {
  const m = moves.peek()[id];
  if (m) put(id, { ...m, phase: e ? 'error' : r && r.kept ? 'waits' : 'done' });
};

/** A tap: held 10 s with Undo, then sent. `label` is the strip's word ("Nudged Faith"). */
export function tapMove(id: string, label: string, kind: WriteName, args: unknown[]): void {
  put(id, { phase: 'held', at: now.peek(), label, kind, args });
  answer(null, label, kind, args, { quiet: true, undo: () => put(id, null), then: (r, e) => ended(id, r, e) });
}

/** Try again: sent now. */
export function retryMove(id: string): void {
  const m = moves.peek()[id];
  if (!m) return;
  put(id, { ...m, phase: 'sending' });
  act(m.kind, ...m.args).then((r) => ended(id, r), (e) => ended(id, null, e || new Error('not sent')));
}

/** The row's phase now: a held move whose 10 s ran out is sending until the shop answers. */
export function phaseOf(id: string): Phase {
  const m = moves.value[id];
  if (!m) return 'idle';
  if (m.phase === 'held' && !(held.value && held.value.label === m.label)) return 'sending';
  return m.phase;
}
export const movedAt = (id: string): number => (moves.value[id] ? moves.value[id].at : 0);

export function useSecondsLeft(on: boolean): number {
  const [, tick] = useState(0);
  useEffect(() => { if (!on) return undefined; const i = setInterval(() => tick((x) => x + 1), 250); return () => clearInterval(i); }, [on]);
  const h = held.value;
  return h ? Math.max(0, Math.ceil((h.until - Date.now()) / 1000)) : 0;
}

/** The row's body after the move: "Nudged · 09:40" in green, bell "Faith sees it". */
export function Moved(p: { id: string; word: string; told: string }): JSX.Element {
  return (
    <span class="mg-team-body">
      <span class="mg-team-moved">{`${p.word} · `}<span class="mg-mono">{hm(movedAt(p.id))}</span></span>
      <span class="mg-team-sees"><Icon name="bell" size={14} stroke={2} />{`${whoSee([p.told])} it`}</span>
    </span>
  );
}

/** The row's right side for its phase: the pill, Undo · 10 s, Sending…, Waits, Try again (`after` when done). */
export function MoveAct(p: { id: string; icon?: IconName; word: string; label: string; on: () => void; after?: ComponentChildren }): JSX.Element | null {
  const ph = phaseOf(p.id), left = useSecondsLeft(ph === 'held');
  if (ph === 'held') {
    return <button type="button" class="mg-team-undo" onClick={() => undoHeld()}><Icon name="undo" size={16} stroke={2} />Undo · <span class="mg-mono">{`${left} s`}</span></button>;
  }
  if (ph === 'sending') return <button type="button" class="mg-team-pill busy" disabled aria-busy="true"><span class="ow-spin" aria-hidden="true" />Sending…</button>;
  if (ph === 'waits') return <span class="mg-team-waits">Waits</span>;
  if (ph === 'error') return <button type="button" class="mg-team-pill" onClick={() => retryMove(p.id)}>Try again</button>;
  if (ph === 'done') return (p.after as JSX.Element) || null;
  return <button type="button" class="mg-team-pill" aria-label={p.label} onClick={p.on}>{p.icon && <Icon name={p.icon} size={16} stroke={2} />}{p.word}</button>;
}

/** The red line under a row whose move was not sent. */
export function NotSent(p: { id: string }): JSX.Element | null {
  return phaseOf(p.id) === 'error' ? <div class="mg-team-notsent" role="alert"><Icon name="warning" size={16} stroke={2} />Not sent · Try again</div> : null;
}
