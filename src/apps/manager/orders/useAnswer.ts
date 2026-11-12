/*
 * An answer made in place on a row or a card (Orders p1, p3: "answered in place"): the states the
 * board draws, in the order they come.
 *
 *   idle     the buttons
 *   held     the navy strip "Nudged Denis · 09:40 · Undo" (10 s), the line "Denis is told · 10 s to undo"
 *   sending  the 10 s ran out and the write is on its way: "Nudging" with a spinner
 *   done     sent
 *   kept     no signal: the row says "Waits"
 *   error    "Not sent · Try again"
 *
 * The write itself goes through the shell's `answer` (the one outbox, the one Undo).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { WriteName } from '../../../core/manager/source.ts';
import { answer, held } from '../shell/store.ts';

export type Spot = 'idle' | 'held' | 'sending' | 'done' | 'kept' | 'error';

export interface InPlace {
  st: Spot;
  /** The words of the last answer ("Nudged Denis · 09:40"), for the strip and the error card. */
  label: string;
  go: (label: string, kind: WriteName, args: unknown[], key?: string | null) => void;
  retry: () => void;
}

export function useInPlace(quiet = true): InPlace {
  const [st, setSt] = useState<Spot>('idle');
  const last = useRef<{ label: string; kind: WriteName; args: unknown[]; key: string | null } | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const set = (s: Spot) => { if (alive.current) setSt(s); };

  // The held write left (its 10 s ran out, or the screen moved on) and was not undone: it is sending.
  const h = held.value;
  useEffect(() => { if (st === 'held' && !h) set('sending'); }, [h, st]);

  const go = (label: string, kind: WriteName, args: unknown[], key: string | null = null) => {
    last.current = { label, kind, args, key };
    setSt('held');
    answer(key, label, kind, args, {
      quiet,
      undo: () => set('idle'),
      then: (r, e) => set(e ? 'error' : r && r.kept ? 'kept' : 'done'),
    });
  };
  return {
    st,
    label: last.current ? last.current.label : '',
    go,
    retry: () => { const l = last.current; if (l) go(l.label, l.kind, l.args, l.key); },
  };
}

/**
 * A list whose rows leave the books when answered (an ask, a twin) keeps each answered row in its
 * place while its strip shows (Undo, then the answer and who sees it), so the result is drawn
 * where the board draws it: in the row, never over the head.
 */
export function useKept<T>(live: { key: string; v: T }[]): { rows: { key: string; v: T; gone: boolean }[]; keep: (key: string, v: T) => void } {
  const kept = useRef<Record<string, T>>({});
  const order = useRef<string[]>([]);
  const [, bump] = useState(0);
  live.forEach((r) => { if (!order.current.includes(r.key)) order.current.push(r.key); });
  const liveKeys = live.map((r) => r.key);
  const rows = order.current
    .map((key) => {
      const l = live.find((r) => r.key === key);
      if (l) return { key, v: l.v, gone: false };
      return key in kept.current ? { key, v: kept.current[key], gone: true } : null;
    })
    .filter((r): r is { key: string; v: T; gone: boolean } => !!r);
  return {
    rows: rows.filter((r) => liveKeys.includes(r.key) || r.gone),
    keep: (key, v) => { kept.current = { ...kept.current, [key]: v }; bump((i) => i + 1); },
  };
}
