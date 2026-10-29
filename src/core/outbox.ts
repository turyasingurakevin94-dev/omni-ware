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

  constructor(store: OutboxStore, sender: Sender, clock: () => Ms = Date.now) {
    this.store = store;
    this.sender = sender;
    this.clock = clock;
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
   * Send a write. With signal it goes now and resolves with the server's answer (a refusal rejects,
   * nothing kept). With no signal, or while older writes are still kept, it is kept and resolves
   * { kept: true } so the screen can say "Kept on this phone".
   */
  async run<T = unknown>(kind: string, args: unknown): Promise<{ kept: false; value: T } | { kept: true; id: string }> {
    await this.ready();
    // Sent in order: nothing jumps a write that is still waiting.
    if (this.list.some((k) => k.state !== 'refused')) return { kept: true, id: await this.keep(kind, args) };
    try {
      const value = (await this.sender(kind, args)) as T;
      return { kept: false, value };
    } catch (e) {
      if (isOffline(e)) return { kept: true, id: await this.keep(kind, args) };
      throw e;
    }
  }

  /** Try every kept write, oldest first. Stops at the first that still has no signal. */
  async flush(): Promise<{ sent: number; refused: number; left: number }> {
    await this.ready();
    if (this.flushing) return { sent: 0, refused: 0, left: this.list.length };
    this.flushing = true;
    let sent = 0, refused = 0;
    try {
      for (const k of this.list.slice()) {
        if (k.state === 'refused') continue;
        k.state = 'sending'; k.tries += 1;
        try {
          await this.sender(k.kind, k.args);
          this.list = this.list.filter((x) => x.id !== k.id);
          sent += 1;
        } catch (e) {
          if (isOffline(e)) { k.state = 'kept'; break; }
          k.state = 'refused';
          k.reason = String((e as Error)?.message || e);
          refused += 1;
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
    k.state = 'kept'; k.reason = '';
    await this.persist();
  }

  private async keep(kind: string, args: unknown): Promise<string> {
    const at = this.clock();
    const id = `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.list.push({ id, kind, args, at, tries: 0, state: 'kept', reason: '' });
    await this.persist();
    return id;
  }

  private async ready(): Promise<void> {
    if (this.loaded) return;
    this.list = await this.store.load().catch(() => []);
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
