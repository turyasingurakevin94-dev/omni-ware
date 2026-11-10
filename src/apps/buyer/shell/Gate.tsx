/*
 * Signing in, before Today (the canvas's "Sign in" board, Gate.dc.html):
 * the navy head with the shop and the role, two fields, one button. Its
 * states: default, signing in, wrong email or password, no signal.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import { readError, signIn } from './store.ts';
import './gate.css';

export function Login(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; offline: boolean } | null>(readError.value ? { text: readError.value, offline: false } : null);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const go = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try { await signIn(email, password); } catch (x) {
      const off = isDataError(x) && x.kind === 'offline';
      setErr(off ? { text: 'No signal · try when you have signal', offline: true } : { text: 'Wrong email or password', offline: false });
    } finally { setBusy(false); }
  };
  const blocked = offline || err?.offline;
  return (
    <main class="ow-b-gate">
      <header class="ow-b-gate-head">
        <div class="ow-b-gate-brand">
          <span class="ow-b-gate-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6FDCB0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h13v10H3z" /><path d="M16 10h3l2 3v4h-5" /><circle cx="7" cy="18" r="1.6" /><circle cx="18" cy="18" r="1.6" /></svg>
          </span>
          <span><small>Mukasa Hardware</small><b>Buyer</b></span>
        </div>
        <p>Ask suppliers · plan the trip · hand in</p>
      </header>
      <form class="ow-b-gate-card" onSubmit={go}>
        <label>Email<input type="email" autocomplete="username" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} required /></label>
        <label>Password<input class={err && !err.offline ? 'bad' : ''} type="password" autocomplete="current-password" value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} required /></label>
        {(err || offline) && (
          <p role="alert" class={'ow-b-gate-err' + (blocked ? ' off' : '')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            {err ? err.text : 'No signal · try when you have signal'}
          </p>
        )}
        <button type="submit" class={'ow-b-gate-btn' + (busy ? ' busy' : '')} disabled={busy || !!blocked}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p class="ow-b-gate-hint">No login yet? Ask the shop for one</p>
    </main>
  );
}
