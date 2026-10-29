/*
 * The Supabase client, made the way sales.html makes it (3565-3598):
 * the pinned supabase-js (2.118.0) is loaded by the page itself
 * (tools/build-app.js puts the old apps' <script> tag in), the project is
 * chosen by host (env.ts), and Sales keeps its own sign-in under
 * 'ow-sales-auth', carried over once from the shared login.
 *
 * supabase-js is untyped here on purpose: it is not a package of this
 * build (the page loads it), so its calls are typed loosely and the rows
 * are typed where they become the app's shapes (rows.ts).
 */
import { AUTH_KEY, envFor, type Env } from '../env.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Sb = any;
export type Row = Record<string, any>;

declare global {
  interface Window {
    supabase?: { createClient: (url: string, key: string, opts?: unknown) => Sb };
    Capacitor?: unknown;
  }
}

/** sales.html:3591-3597 owCarryLogin: the old shared login, carried over once so nobody is signed out. */
function carryLogin(env: Env): void {
  try {
    if (localStorage.getItem(AUTH_KEY) != null) return;
    const ref = (String(env.url).match(/^https:\/\/([^.]+)\./) || [])[1];
    const old = ref && localStorage.getItem('sb-' + ref + '-auth-token');
    if (old) localStorage.setItem(AUTH_KEY, old);
  } catch (_e) { /* private mode: nothing to carry */ }
}

let made: { sb: Sb; env: Env } | null = null;

/** The one client for this page. Null when supabase-js did not load (no signal on first open). */
export function client(): { sb: Sb; env: Env } | null {
  if (made) return made;
  if (typeof window === 'undefined' || !window.supabase) return null;
  const env = envFor(location.hostname, !!window.Capacitor);
  carryLogin(env);
  made = { sb: window.supabase.createClient(env.url, env.anon, { auth: { storageKey: AUTH_KEY } }), env };
  return made;
}

/** No signal (sales.html isNetworkError). */
export function isNetwork(e: unknown): boolean {
  return !!e && /fetch|network|Failed to fetch|NetworkError|Load failed/i.test(String((e as Error).message || e));
}

/** A function or column the books do not have yet (sales.html rpcMissing). */
export function isMissing(e: unknown): boolean {
  const x = e as { code?: string; message?: string } | null;
  return !!x && (x.code === 'PGRST202' || /Could not find the function|does not exist|schema cache/i.test(String(x.message || '')));
}
