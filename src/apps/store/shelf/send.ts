/*
 * One send to Ruth or Denis (a count, a loss, an ask), as the boards draw its life (lead ruling "One rule for sends"):
 *
 *   idle → held (10 s: "Sending…", Changed your mind? Undo · 9 s) → sent (the Sent screen)
 *                                                                → kept (no signal: "Not sent yet · kept on this phone")
 *                                                                → failed ("That did not save · … · code SC-502", Try again)
 *   held → idle on Undo; kept → idle on Remove; failed → sent on Try again.
 *
 * The write goes through the shell (store.ts hold / act): its outbox, its live read. It is held quiet: the screen's
 * Undo pill says it where the board puts it, not the shell's toast.
 */
import { useState } from 'preact/hooks';
import type { WriteName } from '../../../core/store/source.ts';
import { act, discard, hold, kept, notDone } from '../shell/store.ts';

export type Phase = 'idle' | 'held' | 'sent' | 'kept' | 'failed' | 'clash';

export interface Send { phase: Phase; code: string; go: (label: string, kind: WriteName, args: unknown[]) => void; retry: () => void; remove: () => void; reset: () => void }

export function useSend(): Send {
  const [phase, setPhase] = useState<Phase>('idle'), [code, setCode] = useState(''), [last, setLast] = useState<{ kind: WriteName; args: unknown[] } | null>(null);
  const ended = (r: { kept: boolean } | null) => {
    if (r) { setPhase(r.kept ? 'kept' : 'sent'); return; }
    const n = notDone.peek();
    setCode(n && n.code ? n.code : '');
    setPhase(n && n.tone === 'someone' ? 'clash' : 'failed');
    if (n && n.tone !== 'failed') notDone.value = null;
  };
  return {
    phase, code,
    go(label, kind, args) {
      setLast({ kind, args });
      setPhase('held');
      hold(label, kind, args, () => setPhase('idle'), { quiet: true, then: ended });
    },
    retry() {
      if (!last) return;
      notDone.value = null;
      setPhase('held');
      act(last.kind, ...last.args).then(ended, () => ended(null));
    },
    remove() {
      const k = [...kept.peek()].reverse().find((x) => last && x.kind === last.kind);
      if (k) void discard(k.id);
      setPhase('idle');
    },
    reset() { setPhase('idle'); setCode(''); },
  };
}
