/*
 * The one outbox (docs/spec/06-offline-sync-push.md §7, Kevin's answers):
 *
 *   Q4  every write goes through it, and is sent in order when signal comes back;
 *   Q5  a kept write the server refuses is kept, shown with the server's reason,
 *       until the person fixes or discards it;
 *   Q1  it lives in IndexedDB, one store per login (idbStore below);
 *   Q7  the words are "No signal" and "Kept on this phone".
 *
 * The outbox does not know what a write is: `send(kind, args)` is given by
 * the data source. A write tried with signal goes at once and its answer
 * (or refusal) comes straight back; only a write that could not reach the
 * server is kept.
 *
 * Cross-app round 1 (SAL-3, docs/audit/cross-app/ROUND-1.md): writes are kept
 * in order **per thing** (`scope`: an order, a draft, a customer), never one
 * line for all — a write that cannot go never holds up a write on something
 * else. A write still "no signal" after STUCK_TRIES tries while the books read
 * fine is not a signal problem: it is marked refused ("Not sent"), never
 * dropped. The scope '*' keeps the old single line for an app that asks for it.
 */
import { isDataError } from './datasource.ts';
import type { Ms } from './types.ts';

export interface Kept {
  id: string;
  kind: string;
  args: unknown;
  /** When it was first tried. */
  at: Ms;
  tries: number;
  /** kept: waiting for signal · refused: the server said no (reason) · sending: on its way. */
  state: 'kept' | 'sending' | 'refused';
  reason: string;
  /** What it writes to ('order:586', 'draft:d-…'); writes on one scope go in order. '*' waits for everything. */
  scope?: string;
}

/** The thing a write is about, for ordering (SAL-3). '*' = behind every kept write, and every later write behind it. */
export type ScopeOf = (kind: string, args: unknown) => string;

/** Tries that fail as "no signal" while the books read fine, before a kept write is called Not sent. */
export const STUCK_TRIES = 5;

export interface OutboxOptions {
  scopeOf?: ScopeOf;
  /** Whether the books were read fine just now (a stuck write is then not a signal problem). */
  readsOk?: () => boolean;
}

export interface OutboxStore {
  load(): Promise<Kept[]>;
  save(list: Kept[]): Promise<void>;
}

export type Sender = (kind: string, args: unknown) => Promise<unknown>;

/** No signal? Network failures from fetch or a DataError of kind 'offline'. */
export function isOffline(e: unknown): boolean {
  if (isDataError(e)) return e.kind === 'offline';
  return /fetch|network|Failed to fetch|NetworkError|Load failed/i.test(String((e as Error)?.message || e));
}

export class Outbox {
  private list: Kept[] = [];
  private loaded = false;
  private flushing = false;
  private store: OutboxStore;
  private sender: Sender;
  private clock: () => Ms;
  private listeners = new Set<(list: Kept[]) => void>();
  private sentFns = new Set<(id: string, value: unknown) => void>();
  private refusedFns = new Set<(id: string, reason: string) => void>();

  private scopeOf: ScopeOf;
  private readsOk: () => boolean;

  constructor(store: OutboxStore, sender: Sender, clock: () => Ms = Date.now, opt: OutboxOptions = {}) {
    this.store = store;
    this.sender = sender;
    this.clock = clock;
    this.scopeOf = opt.scopeOf || (() => '*');
    this.readsOk = opt.readsOk || (() => false);
  }

  private scope(k: Kept): string {
    return k.scope || this.scopeOf(k.kind, k.args);
  }

  /** Whether a write on `scope` must wait behind what is kept (not refused). */
  private waits(scope: string): boolean {
    return this.list.some((k) => k.state !== 'refused' && (scope === '*' || this.scope(k) === '*' || this.scope(k) === scope));
  }

  /** What is kept, in order. */
  async items(): Promise<Kept[]> {
    await this.ready();
    return this.list.slice();
  }

  onChange(fn: (list: Kept[]) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /**
   * A kept write reached the server and was taken: its id and the server's answer. Told before the list
   * changes, so a screen waiting on it knows it went before it sees it gone. Only this means "recorded";
   * a write that leaves the list without it was discarded.
   */
  onSent(fn: (id: string, value: unknown) => void): () => void {
    this.sentFns.add(fn);
    return () => { this.sentFns.delete(fn); };
  }

  /** A kept write the server refused (Q5): its id and the server's reason. It stays, to fix or discard. */
  onRefused(fn: (id: string, reason: string) => void): () => void {
    this.refusedFns.add(fn);
    return () => { this.refusedFns.delete(fn); };
  }

  /**
   * Send a write. With signal it goes now and resolves with the server's answer (a refusal rejects,
   * nothing kept). With no signal, or while older writes are still kept, it is kept and resolves
   * { kept: true } so the screen can say "Kept on this phone".
   */
  async run<T = unknown>(kind: string, args: unknown): Promise<{ kept: false; value: T } | { kept: true; id: string }> {
    await this.ready();
    const scope = this.scopeOf(kind, args);
    // A draft is placed once (SAL-4): the same write on the same draft, already kept, is that one.
    if (scope.startsWith('draft:')) {
      const same = this.list.find((k) => k.state !== 'refused' && k.kind === kind && this.scope(k) === scope);
      if (same) return { kept: true, id: same.id };
    }
    // Sent in order on the same thing: nothing jumps a write on it that is still waiting.
    if (this.waits(scope)) return { kept: true, id: await this.keep(kind, args, scope) };
    try {
      const value = (await this.sender(kind, args)) as T;
      return { kept: false, value };
    } catch (e) {
      if (isOffline(e)) return { kept: true, id: await this.keep(kind, args, scope) };
      throw e;
    }
  }

  /**
   * Try every kept write, oldest first. A write that still has no signal holds up only the later writes on
   * its own scope; after three such misses in one go the phone has no signal and the rest wait.
   */
  async flush(): Promise<{ sent: number; refused: number; left: number }> {
    await this.ready();
    if (this.flushing) return { sent: 0, refused: 0, left: this.list.length };
    this.flushing = true;
    let sent = 0, refused = 0, misses = 0;
    const held = new Set<string>();
    const refuse = (k: Kept, reason: string) => {
      k.state = 'refused'; k.reason = reason; refused += 1;
      this.refusedFns.forEach((fn) => fn(k.id, k.reason));
    };
    try {
      for (const k of this.list.slice()) {
        if (k.state === 'refused') continue;
        const scope = this.scope(k);
        if (held.has('*') || held.has(scope) || (scope === '*' && held.size)) continue;
        k.state = 'sending'; k.tries += 1;
        await this.persist();
        try {
          const value = await this.sender(k.kind, k.args);
          this.list = this.list.filter((x) => x.id !== k.id);
          sent += 1;
          this.sentFns.forEach((fn) => fn(k.id, value));
        } catch (e) {
          if (!isOffline(e)) refuse(k, String((e as Error)?.message || e));
          else if (k.tries >= STUCK_TRIES && this.readsOk()) refuse(k, `Not sent · tried ${k.tries} times`);
          else {
            k.state = 'kept'; held.add(scope); misses += 1;
            if (misses >= 3) { await this.persist(); break; }
          }
        }
        await this.persist();
      }
    } finally {
      this.flushing = false;
      await this.persist();
    }
    return { sent, refused, left: this.list.length };
  }

  /** Throw a kept or refused write away (the person chose to). */
  async discard(id: string): Promise<void> {
    await this.ready();
    this.list = this.list.filter((k) => k.id !== id);
    await this.persist();
  }

  /** Change a refused write's args and try it again in its place (the person fixed it). */
  async retry(id: string, args?: unknown): Promise<void> {
    await this.ready();
    const k = this.list.find((x) => x.id === id);
    if (!k) return;
    if (args !== undefined) k.args = args;
    k.state = 'kept'; k.reason = ''; k.tries = 0;
    await this.persist();
  }

  private async keep(kind: string, args: unknown, scope: string): Promise<string> {
    const at = this.clock();
    const id = `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.list.push({ id, kind, args, at, tries: 0, state: 'kept', reason: '', scope });
    await this.persist();
    return id;
  }

  private async ready(): Promise<void> {
    if (this.loaded) return;
    this.list = await this.store.load().catch(() => []);
    // A write left 'sending' by a closed app was not answered: it waits again.
    this.list.forEach((k) => { if (k.state === 'sending') k.state = 'kept'; });
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await this.store.save(this.list).catch(() => {});
    const copy = this.list.slice();
    this.listeners.forEach((fn) => fn(copy));
  }
}

/** For tests and the demo: kept in memory only. */
export function memoryStore(initial: Kept[] = []): OutboxStore {
  let list = initial.slice();
  return {
    load: async () => list.slice(),
    save: async (l) => { list = l.slice(); },
  };
}

/** IndexedDB, one store per login (06 Q1): database "ow-outbox", key "<app>:<user>". */
export function idbStore(app: string, userId: string): OutboxStore {
  const key = `${app}:${userId}`;
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const req = indexedDB.open('ow-outbox', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('kept'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const r = fn(db.transaction('kept', mode).objectStore('kept'));
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => reject(r.error);
    });
  };
  return {
    load: async () => ((await tx<Kept[] | undefined>('readonly', (s) => s.get(key))) || []),
    save: async (list) => { await tx('readwrite', (s) => s.put(list, key)); },
  };
}
