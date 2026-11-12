/*
 * Undo 10 s (docs/spec/04-screens-store.md §4.8; store.html:991 heldWrite, 2074 flushHeld;
 * FLOW-02; GLOSSARY "Undo"). Every write that moves goods or reaches Ruth waits 10 s with
 * Undo, then goes; it goes at once when the app is put away or the screen changes. One held
 * write at a time: holding a second sends the first.
 *
 *   const h = new Held();
 *   h.hold({ label: 'Packed #0552', send: () => act('finishPack', 552, 1), undo: () => reopen() });
 *   h.undo();      Undo: nothing is sent, the screen goes back
 *   h.flush();     put away / the screen changed: it goes now
 *
 * Plain TypeScript, no screen: the shell shows `current` as the P28 toast with its Undo
 * (src/ui/toast.tsx) and calls flush on visibilitychange and on every screen change.
 * The send itself goes through the outbox (src/core/outbox.ts), so a held write that finds
 * no signal is kept on the phone like any other ("Not sent yet").
 */
import type { Ms } from '../types.ts';

export const HOLD_MS = 10000;

export interface HeldWrite {
  /** What the toast says while it waits: "Packed #0552". */
  label: string;
  send: () => unknown;
  /** Put the screen back as it was. */
  undo?: () => void;
  /** The screen draws its own Undo (the Out area's end screens, OU05, OU12, OU22): no toast. */
  quiet?: boolean;
}

export interface HeldNow { label: string; until: Ms; quiet?: boolean }

type Timer = { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void; now: () => Ms };
const REAL: Timer = { set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>), now: () => Date.now() };

export class Held {
  private w: HeldWrite | null = null;
  private timer: unknown = null;
  private until = 0;
  private fns = new Set<(h: HeldNow | null) => void>();
  private t: Timer;
  private ms: number;

  constructor(ms: number = HOLD_MS, timer: Timer = REAL) {
    this.ms = ms;
    this.t = timer;
  }

  /** What waits now, or null. */
  get current(): HeldNow | null {
    return this.w ? { label: this.w.label, until: this.until, quiet: this.w.quiet } : null;
  }

  onChange(fn: (h: HeldNow | null) => void): () => void {
    this.fns.add(fn);
    return () => { this.fns.delete(fn); };
  }

  /** Hold a write for its 10 s. A write already waiting goes first. */
  hold(w: HeldWrite): void {
    this.flush();
    this.w = w;
    this.until = this.t.now() + this.ms;
    this.timer = this.t.set(() => { this.flush(); }, this.ms);
    this.tell();
  }

  /** Undo: the write never goes. */
  undo(): void {
    const w = this.w;
    if (!w) return;
    this.stop();
    if (w.undo) w.undo();
  }

  /** It goes now (its 10 s ran out, the app was put away, the screen changed). Returns the send's promise. */
  flush(): Promise<unknown> {
    const w = this.w;
    if (!w) return Promise.resolve();
    this.stop();
    return Promise.resolve().then(() => w.send());
  }

  private stop(): void {
    if (this.timer != null) this.t.clear(this.timer);
    this.timer = null;
    this.w = null;
    this.tell();
  }

  private tell(): void {
    const c = this.current;
    this.fns.forEach((fn) => fn(c));
  }
}
