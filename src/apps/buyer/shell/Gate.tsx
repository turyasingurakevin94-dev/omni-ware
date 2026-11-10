/*
 * Signing in, before the tabs. Same card as the Sales gate (its gate.css),
 * the Buyer's own name on it.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import { readError, signIn } from './store.ts';
import '../../sales/shell/gate.css';

export function Login(): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(readError.value);
  const go = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null);
    try { await signIn(email, password); } catch (x) {
      setErr(isDataError(x) && x.kind === 'offline' ? 'No signal. Try again when you have signal.' : (x as Error).message || 'Not signed in');
    } finally { setBusy(false); }
  };
  return (
    <main class="ow-gate">
      <div class="ow-gate-brand">Omni-ware <b>BUYER</b></div>
      <form class="ow-gate-card" onSubmit={go}>
        <h1>Sign in</h1>
        <label>Email<input type="email" autocomplete="username" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} required /></label>
        <label>Password<input type="password" autocomplete="current-password" value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} required /></label>
        {err && <p role="alert" class="ow-gate-err">{err}</p>}
        <button type="submit" class="ow-gate-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
