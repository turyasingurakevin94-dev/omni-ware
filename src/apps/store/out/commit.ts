/*
 * One commit's states on an Out screen (hand over, deliver, bring back): the slide holds the write its
 * 10 s with the end screen's own Undo (store.ts hold, quiet), then it goes.
 *   ready → done (Undo while it waits) → stays done when it lands
 *                                       → kept: "No signal · not sent yet" here, sends when the signal is back
 *                                       → failed: "That did not save · code", Try again
 *   Try again → sending ("Handing over…") → done | kept | failed
 * A write of this kind for this order still kept on the phone opens the screen as kept (after a reload too).
 */
import { useState } from 'preact/hooks';
import { notDone as wordIt } from '../../../core/store/errors.ts';
import type { WriteName } from '../../../core/store/source.ts';
import { act, flush, hold, kept } from '../shell/store.ts';

export type Phase = 'ready' | 'sending' | 'done' | 'kept' | 'failed';

/** A write of this kind about this order is waiting on the phone. */
export const keptFor = (kind: string, id: number): boolean =>
  kept.value.some((k) => k.kind === kind && Array.isArray(k.args) && (k.args[0] === id || (Array.isArray(k.args[0]) && (k.args[0] as number[]).includes(id))));

export function useCommit(kind: WriteName, id: number): {
  phase: Phase; code: string; commit: (label: string, args: unknown[], undo?: () => void) => void; again: (args: unknown[]) => Promise<void>; reset: () => void;
} {
  const [phase, setPhase] = useState<Phase>(() => (keptFor(kind, id) ? 'kept' : 'ready'));
  const [code, setCode] = useState('');
  const fail = (e: unknown) => { setCode(wordIt(e, kind).code); setPhase('failed'); };
  return {
    phase,
    code,
    reset: () => setPhase('ready'),
    commit(label, args, undo) {
      hold(label, kind, args, () => { setPhase('ready'); if (undo) undo(); }, {
        quiet: true,
        then: (r, e) => { if (r && r.kept) setPhase('kept'); else if (e) fail(e); },
      });
      setPhase('done');
    },
    async again(args) {
      const was = phase;
      setPhase('sending');
      if (was === 'kept') { await flush(); setPhase(keptFor(kind, id) ? 'kept' : 'done'); return; }
      try { const r = await act(kind, ...args); setPhase(r.kept ? 'kept' : 'done'); } catch (e) { fail(e); }
    },
  };
}
