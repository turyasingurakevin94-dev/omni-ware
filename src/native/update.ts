/*
 * Staying current without a store release (spec 07 §4 "Offline (phone app)", spec 06 §4): the
 * installed app checks its live page (sales.html, buyer.html) now and then, keeps a copy of a newer one on the phone,
 * and switches to it the next time the app goes to the background, never in the middle of an order.
 * Moved from sales.html's native layer (its job 4); start.ts wires it to the Capacitor plugins.
 * Shared by every new app: `updater(app)` gives one app's check, on its own page, key and build id.
 *
 * What a copy is: one folder under the app's data, `live/<hash>/`, holding
 *   - index.html       the page, through the phone's swaps (apps/<role>/src/transform.js);
 *   - its own files    every file its <meta name="ow-files"> names (the tab files), fetched FROM THE
 *                      SERVER, beside the page, and each of the page's build;
 *   - the shell's      the Supabase client, the fonts and the swaps (transform.js and the files in
 *                      folders), copied from the copy running now: they belong to the app, not a build;
 *   - bundle.json      which page this is and its files.
 * All or nothing: a file missing, of another build or cut off, and nothing is staged.
 *
 * The safety rule: only a build of this app is ever staged. A page without the build id
 * tools/build-app.js writes (window.owSalesBuild, window.owBuyerBuild) and its <meta name="ow-files"> is refused, so an
 * app that ships the new page never turns itself back into the old one by fetching an old live page.
 */

/** One app's update: its live page, the key its state is kept under, and the build id its page carries. */
export interface NativeApp {
  role: string;
  /** The live page, e.g. https://omni-ware.vercel.app/sales.html. */
  source: string;
  /** Kept under the same key as the old native layer, so a phone it updated settles here. */
  key: string;
  /** The window variable tools/build-app.js writes the build id to (owSalesBuild). */
  build: string;
}

export const EVERY = 30 * 60 * 1000;

export interface Staged { dir: string; path: string; etag: string }
export interface UpdateState { checked?: number; etag?: string; staged?: Staged }
/** bundle.json: the copy running now. */
export interface Bundle { source: string; build?: string; files: string[] }
export interface Fetched { status: number; text: string; etag: string }

export interface UpdateIo {
  load(): UpdateState;
  save(s: UpdateState): void;
  now(): number;
  /** bundle.json of the copy running now. */
  running(): Promise<Bundle>;
  /** The files the page running now names (its <meta name="ow-files">). */
  runningNames(): string[];
  /** A GET from the server (native, so no CORS); `etag` asks for 304 when unchanged. */
  get(url: string, etag?: string): Promise<Fetched>;
  /** A file of the copy running now, as base64. */
  local(file: string): Promise<string>;
  sha256(text: string): Promise<string>;
  transform(html: string): string;
  write(path: string, data: string, utf8: boolean): Promise<void>;
  /** The folder's path on the phone, for WebView.setServerBasePath. */
  uri(dir: string): Promise<string>;
  remove(dir: string): Promise<void>;
}

export type CheckResult = 'staged-already' | 'waiting' | 'unchanged' | 'refused' | 'current' | 'missing' | 'staged' | 'failed';

/** The safety rule: the build id and file list of a whole build of this app, or null. */
function builtPageOf(app: NativeApp, html: string): { build: string; files: string[] } | null {
  // Half a page is worse than an old page.
  if (html.length < 100000 || html.indexOf('</html>') === -1) return null;
  const build = (html.match(new RegExp('window\\.' + app.build + '="([0-9a-f]{8,64})"')) || [])[1];
  const meta = html.match(/<meta name="ow-files" content="([^"]*)">/);
  if (!build || !meta) return null;
  const files = meta[1].split(/\s+/).filter(Boolean);
  if (!files.every((f) => /^[\w.-]+$/.test(f) && f !== 'index.html' && f !== 'bundle.json')) return null;
  return { build, files };
}

/** The shell's own files (the app's, not a build's): transform.js and everything in a folder (vendor/, fonts/). */
export function shellFiles(files: string[]): string[] {
  return files.filter((f) => f === 'transform.js' || f.indexOf('/') !== -1);
}


/**
 * Check the live page; stage a newer build. At most every EVERY, and never while a copy waits for
 * the background. The copy running now carries on whatever happens here.
 */
async function checkOf(app: NativeApp, io: UpdateIo): Promise<CheckResult> {
  const SOURCE = app.source, builtPage = (h: string) => builtPageOf(app, h), beside = (n: string) => new URL(n, SOURCE).href;
  const s = io.load();
  if (s.staged) return 'staged-already';
  if (io.now() - (s.checked || 0) < EVERY) return 'waiting';
  s.checked = io.now();
  io.save(s);
  try {
    const mine = await io.running();
    // A copy staged by the old layer has the page without its tab files: fetch it whole, once.
    const whole = io.runningNames().every((f) => mine.files.indexOf(f) !== -1);
    const res = await io.get(SOURCE, whole ? s.etag : undefined);
    if (res.status !== 200) return 'unchanged';
    const page = builtPage(res.text);
    if (!page) return 'refused';
    const hash = await io.sha256(res.text);
    if (hash === mine.source && whole) {
      const s1 = io.load(); s1.etag = res.etag; io.save(s1);
      return 'current';
    }
    // Every file first, into memory: one missing or of another build and nothing is written.
    const own: string[] = [];
    for (const f of page.files) {
      const r = await io.get(beside(f));
      if (r.status !== 200 || r.text.indexOf('"' + page.build + '"') === -1) return 'missing';
      own.push(r.text);
    }
    const shell = shellFiles(mine.files);
    const kept: string[] = [];
    for (const f of shell) kept.push(await io.local(f));

    const dir = 'live/' + hash.slice(0, 16);
    try {
      await io.write(dir + '/index.html', io.transform(res.text), true);
      for (let i = 0; i < page.files.length; i++) await io.write(dir + '/' + page.files[i], own[i], true);
      for (let i = 0; i < shell.length; i++) await io.write(dir + '/' + shell[i], kept[i], false);
      const files = ['index.html', ...page.files, ...shell, 'bundle.json'];
      await io.write(dir + '/bundle.json', JSON.stringify({ source: hash, build: page.build, files }), true);
    } catch (e) {
      await io.remove(dir).catch(() => undefined);
      throw e;
    }
    const uri = await io.uri(dir);
    const s2 = io.load();
    s2.staged = { dir, path: decodeURI(String(uri).replace(/^file:\/\//, '')), etag: res.etag };
    io.save(s2);
    return 'staged';
  } catch (_e) {
    // No signal, or the server is down: the copy already here carries on.
    return 'failed';
  }
}

export interface SettleIo {
  load(): UpdateState;
  save(s: UpdateState): void;
  basePath(): Promise<string>;
  persist(): Promise<void>;
  dirs(): Promise<string[]>;
  remove(dir: string): Promise<void>;
}

/** After a switch: the new copy becomes the one the app opens with, and copies nothing points at go. */
export async function settle(io: SettleIo): Promise<void> {
  const s = io.load();
  if (!s.staged) return;
  if ((await io.basePath()) !== s.staged.path) return;
  await io.persist();
  const keep = s.staged.dir.split('/').pop();
  s.etag = s.staged.etag;
  delete s.staged;
  io.save(s);
  const all = await io.dirs().catch(() => [] as string[]);
  await Promise.all(all.filter((n) => n !== keep).map((n) => io.remove('live/' + n).catch(() => undefined)));
}

/** One app's update functions. */
export function updater(app: NativeApp) {
  return {
    SOURCE: app.source,
    KEY: app.key,
    EVERY,
    /** The safety rule: the build id and file list of a whole build of this app, or null. */
    builtPage: (html: string) => builtPageOf(app, html),
    /** A file of `name` beside the live page. */
    beside: (name: string): string => new URL(name, app.source).href,
    check: (io: UpdateIo) => checkOf(app, io),
    settle,
    shellFiles,
  };
}
