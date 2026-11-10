/*
 * What shows before the tabs: signing in, and someone else signed in under
 * this screen (TD10). Neither is drawn on the canvas yet except TD10, which
 * the Today tab builds (its screen 'today/signed-elsewhere' replaces this
 * stand-in when it exists). The sign-in form must be drawn on the canvas
 * before it is styled further (CLAUDE.md "Canvas first").
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { isDataError } from '../../../core/datasource.ts';
import { screen } from './nav.ts';
import { elsewhere, readError, signIn, signOut } from './store.ts';
import './gate.css';

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
      <div class="ow-gate-brand">Omni-ware <b>SALES</b></div>
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

export function SignedElsewhere(): JSX.Element {
  const own = screen('today/signed-elsewhere');
  if (own) { const V = own.view; return <V params={{}} />; }
  const who = elsewhere.value;
  return (
    <main class="ow-gate">
      <div class="ow-gate-brand">Omni-ware <b>SALES</b></div>
      <div class="ow-gate-card">
        <h1>Signed in as someone else</h1>
        <p>{who ? `Nothing is saved as ${who.name.split(' ')[0]}.` : 'Nothing is saved.'}</p>
        <button type="button" class="ow-gate-btn" onClick={() => { void signOut(); }}>Sign in as yourself</button>
      </div>
    </main>
  );
}
